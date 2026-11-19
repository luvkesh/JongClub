// Live tables: a player takes their seat back from a new tab or another device (by who they are,
// not by the tab), two tabs of one player never both play a seat, and hosting moves to the next
// player when the host leaves mid-game (src/net/lockstep.ts).
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PROMOTE_MS, RoomLink, keyOfPeer, samePlayer } from '../src/net/lockstep';
import type { NamedRoom, PeersChange, RoomPeer } from '../src/net/room';

beforeAll(() => {
  (globalThis as { window?: unknown }).window ??= globalThis;
});

/** An in-memory room shared by several tabs; `by` is each tab's user id, as the platform stamps it. */
class Hub {
  presence = new Map<string, Record<string, unknown>>();
  users = new Map<string, string | null>();
  rooms: Room[] = [];
  join(peer: string, uid: string | null = null) {
    const r = new Room(this, peer);
    this.rooms.push(r);
    this.presence.set(peer, {});
    this.users.set(peer, uid);
    this.notify();
    return r;
  }
  leave(peer: string) {
    this.presence.delete(peer);
    this.rooms = this.rooms.filter((r) => r.me !== peer);
    this.notify();
  }
  private queued = false;
  notify() {
    if (this.queued) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      for (const r of [...this.rooms]) for (const fn of [...r.fns]) fn({ peers: r.peers(), joined: [], left: [], updated: [] });
    });
  }
}

class Room implements NamedRoom {
  readonly name = 'jc-test';
  fns = new Set<(c: PeersChange) => void>();
  constructor(
    private hub: Hub,
    readonly me: string,
  ) {}
  async presence(patch: Record<string, unknown>) {
    const cur = { ...(this.hub.presence.get(this.me) ?? {}) };
    for (const [k, v] of Object.entries(patch)) if (v === null) delete cur[k];
    else cur[k] = JSON.parse(JSON.stringify(v));
    this.hub.presence.set(this.me, cur);
    this.hub.notify();
  }
  peers(): RoomPeer[] {
    const mine = this.hub.users.get(this.me) ?? null;
    return [...this.hub.presence].map(([peer, presence]) => {
      const by = this.hub.users.get(peer) ?? null;
      return { peer, presence, by, isMe: peer === this.me || (!!by && by === mine), sameTab: peer === this.me, kind: 'viewer', guest: false, updatedAt: 0 };
    });
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

describe('who a returning player is', () => {
  it('matches the same tab, then the same user, then the same browser; never two different users', () => {
    const seat = { pid: 'tab1', dev: 'dev1', uid: 'alice' };
    expect(samePlayer(seat, { pid: 'tab1', dev: 'dev1', uid: 'alice' })).toBe(3);
    expect(samePlayer(seat, { pid: 'tab9', dev: 'dev7', uid: 'alice' })).toBe(2); // another device
    expect(samePlayer(seat, { pid: 'tab1', dev: 'dev1', uid: 'bob' })).toBe(0); // a borrowed key, someone else
    expect(samePlayer({ pid: 'tab1', dev: 'dev1' }, { pid: 'tab2', dev: 'dev1' })).toBe(1); // no user ids: same browser
    expect(samePlayer({ pid: 'tab1', dev: 'dev1' }, { pid: 'tab2', dev: 'dev2' })).toBe(0);
    expect(samePlayer(null, { uid: 'alice' })).toBe(0);
  });

  it('takes the user id the platform vouches for over one the page says', () => {
    expect(keyOfPeer({ by: 'alice', presence: { uid: 'mallory', pid: 'p', dev: 'd' } })).toEqual({ pid: 'p', dev: 'd', uid: 'alice' });
    expect(keyOfPeer({ by: null, presence: { uid: 'alice' } })).toEqual({ pid: undefined, dev: undefined, uid: 'alice' });
  });
});

describe('seats and hosting that move', () => {
  const links: RoomLink[] = [];
  afterEach(() => {
    for (const l of links.splice(0)) l.close();
    vi.useRealTimers();
  });

  const seats = ['h', 'g1', 'g2', null];
  const keys = [{ pid: 'ph', uid: 'hana' }, { pid: 'p1', uid: 'gil' }, { pid: 'p2', uid: 'gwen' }, null];

  function table() {
    const hub = new Hub();
    const rooms = { h: hub.join('h', 'hana'), g1: hub.join('g1', 'gil'), g2: hub.join('g2', 'gwen') };
    const host = new RoomLink(rooms.h, seats, 'h', true, keys);
    const g1 = new RoomLink(rooms.g1, seats, 'h', false, keys);
    const g2 = new RoomLink(rooms.g2, seats, 'h', false, keys);
    links.push(host, g1, g2);
    for (const l of [host, g1, g2]) l.handStarted(0, fakeGame);
    return { hub, rooms, host, g1, g2 };
  }

  it('a player opening the table in a new tab (or on another device) takes the seat over from the old tab', async () => {
    vi.useFakeTimers();
    const { hub, host, g1, g2 } = table();
    let why = '';
    g1.onSeatLost = (w) => (why = w);
    // Same user, a new tab: new label, new tab key.
    const b = hub.join('g1b', 'gil');
    await b.presence({ role: 'player', pid: 'p1-new', play: { rejoin: 1, seat: 1, at: 5 } });
    await vi.advanceTimersByTimeAsync(1100);
    // The seat is the new tab's from the next hand; an AI plays it for the rest of this one.
    expect(host.returning(1)).toEqual([1]);
    expect(g2.returning(1)).toEqual([1]);
    expect(await host.next(1, 0, 3)).toBe('ai');
    await vi.advanceTimersByTimeAsync(1100);
    expect(await g2.next(1, 0, 3)).toBe('ai');
    // The old tab hears that its seat moved (it watches from now on).
    expect(why).toBe('moved');
    // From the next hand the host reads the new tab's decisions.
    const nb = new RoomLink(b, seats, 'h', false, keys);
    links.push(nb);
    nb.seatSince = 1;
    for (const l of [host, g2, nb]) l.handStarted(1, fakeGame);
    nb.publish(1, 0, { t: 'd', s: 1, id: 11 });
    expect(await host.next(1, 1, 0)).toEqual({ t: 'd', s: 1, id: 11 });
    expect(await g2.next(1, 1, 0)).toEqual({ t: 'd', s: 1, id: 11 });
  });

  it('someone else cannot claim a seat, and the host’s own seat is never handed away', async () => {
    vi.useFakeTimers();
    const { hub, host } = table();
    const x = hub.join('x', 'mallory');
    await x.presence({ role: 'player', pid: 'p1', play: { rejoin: 1, seat: 1, at: 5 } });
    const y = hub.join('hb', 'hana');
    await y.presence({ role: 'player', pid: 'ph2', play: { rejoin: 1, seat: 0, at: 5 } });
    await vi.advanceTimersByTimeAsync(2100);
    expect(host.returning(1)).toEqual([]);
  });

  it('when the host leaves mid-hand, the next player hosts on and everyone keeps the same moves', async () => {
    vi.useFakeTimers();
    const { hub, host, g1, g2 } = table();
    let epoch = 0;
    let lost = 0;
    g1.onPromote = (e) => (epoch = e);
    g2.onHostLost = () => lost++;
    g1.onHostLost = () => lost++;
    // Decisions the host applied before it went.
    host.publish(0, 0, { t: 'd', s: 0, id: 1 });
    g1.publish(0, 1, { t: 'd', s: 1, id: 2 });
    expect(await host.next(1, 0, 1)).toEqual({ t: 'd', s: 1, id: 2 });
    expect(await g2.next(0, 0, 0)).toEqual({ t: 'd', s: 0, id: 1 });
    expect(host.canHandOver()).toBe(true);
    host.close();
    hub.leave('h');
    const g2waits = g2.next(2, 0, 2);
    await vi.advanceTimersByTimeAsync(PROMOTE_MS + 1500);
    // g1 sits first after the host: it hosts now, and says so in its presence (the session adds role and he).
    expect(g1.isHost).toBe(true);
    expect(epoch).toBe(1);
    await hub.rooms.find((r) => r.me === 'g1')!.presence({ role: 'host', he: 1 });
    // g2's own move is read by the new host and passed on.
    g2.publish(0, 2, { t: 'd', s: 2, id: 3 });
    expect(await g1.next(2, 0, 2)).toEqual({ t: 'd', s: 2, id: 3 });
    expect(await g2waits).toEqual({ t: 'd', s: 2, id: 3 });
    // The old host's seat goes to an AI on every client at the same point.
    const onG1 = g1.next(0, 0, 4);
    const onG2 = g2.next(0, 0, 4);
    await vi.advanceTimersByTimeAsync(7500);
    expect(await onG1).toBe('ai');
    expect(await onG2).toBe('ai');
    expect(lost).toBe(0);
    // A watcher arriving now follows the new host (the earlier decisions are still there).
    const w = new RoomLink(hub.join('w'), seats, 'g1', false, keys, 1);
    links.push(w);
    w.handStarted(0, fakeGame);
    expect(await w.next(0, 0, 0)).toEqual({ t: 'd', s: 0, id: 1 });
    expect(await w.next(1, 0, 1)).toEqual({ t: 'd', s: 1, id: 2 });

    // The old host comes back (a reload: new label, same user) and is seated again at the next hand.
    const back = hub.join('h2', 'hana');
    await back.presence({ role: 'player', pid: 'ph', play: { rejoin: 1, seat: 0, at: 9 } });
    await vi.advanceTimersByTimeAsync(1100);
    expect(g1.returning(1)).toEqual([0]);
    expect(g2.returning(1)).toEqual([0]);
  });

  it('a host cut off while hosting moved on steps down when it sees the newer host', async () => {
    vi.useFakeTimers();
    const { rooms, host } = table();
    let deposed = 0;
    host.onDeposed = () => deposed++;
    await rooms.g1.presence({ role: 'host', he: 1 });
    await vi.advanceTimersByTimeAsync(1100);
    expect(deposed).toBe(1);
    expect(host.isHost).toBe(false);
  });

  it('with only AI players and watchers left, nobody takes over hosting', () => {
    const hub = new Hub();
    const host = new RoomLink(hub.join('h'), ['h', null, null, null], 'h', true);
    links.push(host);
    expect(host.canHandOver()).toBe(false);
  });
});
