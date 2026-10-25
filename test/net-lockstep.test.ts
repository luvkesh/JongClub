import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Action } from '../src/net/actions';
import { RoomLink, decodeAction, encodeAction } from '../src/net/lockstep';
import type { NamedRoom, PeersChange, RoomPeer } from '../src/net/room';

beforeAll(() => {
  (globalThis as { window?: unknown }).window ??= globalThis;
});

/** An in-memory room shared by several tabs: per-field presence merge and onPeers. */
class FakeHub {
  presence = new Map<string, Record<string, unknown>>();
  rooms: FakeRoom[] = [];
  oversize = 0;
  join(peer: string) {
    const r = new FakeRoom(this, peer);
    this.rooms.push(r);
    this.presence.set(peer, {});
    this.notify();
    return r;
  }
  leave(peer: string) {
    this.presence.delete(peer);
    this.rooms = this.rooms.filter((r) => r.me !== peer);
    this.notify();
  }
  private queued = false;
  /** Like the platform, deliveries are asynchronous and coalesced. */
  notify() {
    if (this.queued) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      for (const r of [...this.rooms]) for (const fn of [...r.fns]) fn({ peers: r.peers(), joined: [], left: [], updated: [] });
    });
  }
}

class FakeRoom implements NamedRoom {
  readonly name = 'jc-test';
  fns = new Set<(c: PeersChange) => void>();
  constructor(
    private hub: FakeHub,
    readonly me: string,
  ) {}
  async presence(patch: Record<string, unknown>) {
    const cur = { ...(this.hub.presence.get(this.me) ?? {}) };
    for (const [k, v] of Object.entries(patch)) if (v === null) delete cur[k];
    else cur[k] = JSON.parse(JSON.stringify(v));
    if (new TextEncoder().encode(JSON.stringify(cur)).length > 4096) {
      this.hub.oversize++;
      throw new Error('invalid_argument');
    }
    this.hub.presence.set(this.me, cur);
    this.hub.notify();
  }
  peers(): RoomPeer[] {
    return [...this.hub.presence].map(([peer, presence]) => ({ peer, presence, by: null, isMe: peer === this.me, sameTab: peer === this.me, kind: 'viewer', guest: false, updatedAt: 0 }));
  }
  onPeers(fn: (c: PeersChange) => void) {
    this.fns.add(fn);
    return () => this.fns.delete(fn);
  }
  connected() {
    return true;
  }
  async leave() {
    this.hub.leave(this.me);
  }
}

const fakeGame = { state: { round: { wind: 0, dealer: 0, repeat: 0 }, riichiPot: 0 }, players: [0, 1, 2, 3].map(() => ({ score: 25000 })) } as never;
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('action encoding', () => {
  it('round-trips every action kind', () => {
    const all: Action[] = [
      { t: 'd', s: 2, id: 117 },
      { t: 'd', s: 0, id: 5, r: 1 },
      { t: 'w', s: 3 },
      { t: 'k', s: 1, k: 27 },
      { t: 'j', s: 1, o: 3, m: 0, id: 144 },
      { t: 'c', s: 2, r: { type: 'pass' } },
      { t: 'c', s: 2, r: { type: 'chow', using: [3, 4] } },
      { t: 'c', s: 1, r: { type: 'pung' } },
      { t: 'cp', s: 3, ids: [1, 2, 3] },
      { t: 'cv', s: 0, v: 1 },
    ];
    for (const a of all) expect(decodeAction(encodeAction(a))).toEqual(a);
  });
});

describe('RoomLink lockstep', () => {
  const links: RoomLink[] = [];
  afterEach(() => {
    for (const l of links.splice(0)) l.close();
    vi.useRealTimers();
  });

  function table() {
    const hub = new FakeHub();
    const seats = ['h', 'g1', 'g2', null];
    const host = new RoomLink(hub.join('h'), seats, 'h', true);
    const g1 = new RoomLink(hub.join('g1'), seats, 'h', false);
    const g2 = new RoomLink(hub.join('g2'), seats, 'h', false);
    links.push(host, g1, g2);
    for (const l of [host, g1, g2]) l.handStarted(0, fakeGame);
    return { hub, host, g1, g2 };
  }

  it('guests only take moves the host has applied', async () => {
    const { host, g1, g2 } = table();
    let got: Action | 'ai' | null = null;
    void g2.next(1, 0, 4).then((a) => (got = a));
    g1.publish(0, 4, { t: 'd', s: 1, id: 9 });
    await flush();
    expect(got).toBeNull(); // g1 published, but the host has not applied it yet
    expect(await host.next(1, 0, 4)).toEqual({ t: 'd', s: 1, id: 9 });
    await flush();
    expect(got).toEqual({ t: 'd', s: 1, id: 9 });
  });

  it('matches Charleston passes committed in seat order (base + seat)', async () => {
    const { host, g1, g2 } = table();
    // Each client commits seats 0..3 at indexes 10..13.
    host.publish(0, 10, { t: 'cp', s: 0, ids: [1, 2, 3] });
    g1.publish(0, 11, { t: 'cp', s: 1, ids: [4, 5, 6] });
    g2.publish(0, 12, { t: 'cp', s: 2, ids: [7, 8, 9] });
    expect(await host.next(1, 0, 11)).toEqual({ t: 'cp', s: 1, ids: [4, 5, 6] });
    expect(await host.next(2, 0, 12)).toEqual({ t: 'cp', s: 2, ids: [7, 8, 9] });
    expect(await g1.next(0, 0, 10)).toEqual({ t: 'cp', s: 0, ids: [1, 2, 3] });
    expect(await g1.next(2, 0, 12)).toEqual({ t: 'cp', s: 2, ids: [7, 8, 9] });
  });

  it('hands a departed seat to an AI on every client at the same point', async () => {
    vi.useFakeTimers();
    const { hub, host, g2 } = table();
    hub.leave('g1');
    const onHost = host.next(1, 0, 7);
    const onG2 = g2.next(1, 0, 7);
    await vi.advanceTimersByTimeAsync(7500);
    expect(await onHost).toBe('ai');
    expect(await onG2).toBe('ai');
  });

  it('tells guests the host left only while they still need the host', async () => {
    vi.useFakeTimers();
    const { hub, g1 } = table();
    let lost = 0;
    g1.onHostLost = () => lost++;
    hub.leave('h');
    void g1.next(0, 0, 3);
    await vi.advanceTimersByTimeAsync(9500);
    expect(lost).toBe(1);
  });

  it('keeps presence under 4 KiB for a long hand', async () => {
    const { hub, host, g1, g2 } = table();
    for (let hand = 0; hand < 2; hand++) {
      for (const l of [host, g1, g2]) l.handStarted(hand, fakeGame);
      for (let i = 0; i < 160; i++) {
        const s = i % 4;
        if (s === 3) continue;
        const a: Action = i % 2 ? { t: 'c', s, r: { type: 'pass' } } : { t: 'd', s, id: 100 + (i % 44) };
        if (s === 0) host.publish(hand, i, a);
        else {
          (s === 1 ? g1 : g2).publish(hand, i, a);
          expect(await host.next(s, hand, i)).toEqual(a);
        }
      }
    }
    expect(hub.oversize).toBe(0);
  });
});
