import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Db } from '../src/net/dbroom';
import type { NamedRoom, PeersChange, RoomPeer } from '../src/net/room';

beforeAll(() => {
  const g = globalThis as { window?: unknown; addEventListener?: unknown; removeEventListener?: unknown };
  g.window ??= globalThis;
  g.addEventListener ??= () => {};
  g.removeEventListener ??= () => {};
});

type Snap = (s: { docs: { id: string; exists: boolean; data(): Record<string, unknown> }[] }) => void;
type Err = (e: { code: string; message: string }) => void;

/** A store whose listeners the test can break, the way a network drop does. */
function fakeDb() {
  const docs = new Map<string, Record<string, unknown>>();
  const listeners: { path: string; next: Snap; err?: Err; dead: boolean }[] = [];
  const snap = (path: string) => ({
    docs: [...docs].filter(([k]) => k.startsWith(path + '/')).map(([k, v]) => ({ id: k.slice(path.length + 1), exists: true, data: () => v })),
  });
  const notify = () => {
    for (const l of listeners) if (!l.dead) l.next(snap(l.path));
  };
  const db: Db = {
    doc: (path) => ({
      set: async (d) => void (docs.set(path, d), notify()),
      delete: async () => void (docs.delete(path), notify()),
    }),
    collection: (path) => ({
      doc: (id) => db.doc(`${path}/${id}`),
      onSnapshot(next, err) {
        const l = { path, next: next as Snap, err: err as Err | undefined, dead: false };
        listeners.push(l);
        queueMicrotask(() => !l.dead && l.next(snap(path)));
        return () => void (l.dead = true);
      },
    }),
  };
  return {
    db,
    docs,
    live: () => listeners.filter((l) => !l.dead).length,
    /** The store drops every listener with an error. */
    drop() {
      for (const l of listeners.filter((x) => !x.dead)) {
        l.dead = true;
        l.err?.({ code: 'unavailable', message: 'offline' });
      }
    },
  };
}

describe('DbNamedRoom', () => {
  afterEach(() => vi.useRealTimers());

  it('listens again after the store drops its listener, and reports connected again', async () => {
    vi.useFakeTimers();
    const { DbNamedRoom } = await import('../src/net/dbroom');
    const f = fakeDb();
    const room = new DbNamedRoom(f.db, 'jc-abcde', 'u1');
    await vi.advanceTimersByTimeAsync(10);
    expect(room.connected()).toBe(true);
    f.drop();
    expect(room.connected()).toBe(false);
    expect(room.error).toBe('unavailable');
    await vi.advanceTimersByTimeAsync(6000);
    expect(f.live()).toBe(1);
    expect(room.connected()).toBe(true);
    expect(room.error).toBeNull();
    // Another tab's presence still reaches us over the new listener.
    f.docs.set('rooms/jc-abcde/peers/zzzzzzzzzzzz', { p: { role: 'player' }, by: 'u2', at: Date.now(), n: 1 });
    await f.db.doc('rooms/jc-abcde/peers/zzzzzzzzzzzz').set({ p: { role: 'player' }, by: 'u2', at: Date.now(), n: 2 });
    await vi.advanceTimersByTimeAsync(10);
    expect(room.peers().some((p) => p.peer === 'zzzzzzzzzzzz')).toBe(true);
    await room.leave();
    expect(f.live()).toBe(0);
  });

  it('does not listen again once left', async () => {
    vi.useFakeTimers();
    const { DbNamedRoom } = await import('../src/net/dbroom');
    const f = fakeDb();
    const room = new DbNamedRoom(f.db, 'jc-fghjk', 'u1');
    await vi.advanceTimersByTimeAsync(10);
    f.drop();
    await room.leave();
    await vi.advanceTimersByTimeAsync(10000);
    expect(f.live()).toBe(0);
  });
});

describe('MeshRoom link status', () => {
  it('clears a room error once the room talks again', async () => {
    const { MeshRoom } = await import('../src/net/mesh');
    let onPeers: ((c: PeersChange) => void) | undefined;
    let onErr: ((e: { code: string; message: string }) => void) | undefined;
    let up = true;
    const room: NamedRoom = {
      name: 'jc-x',
      presence: async () => {
        if (!up) throw { code: 'disconnected' };
      },
      peers: (): RoomPeer[] => [],
      onPeers(fn, err) {
        onPeers = fn;
        onErr = err;
        return () => {};
      },
      connected: () => up,
      leave: async () => {},
    };
    const mesh = new MeshRoom('jc-x', room, null);
    expect(mesh.status().room).toBe('on');
    up = false;
    onErr?.({ code: 'disconnected', message: 'gone' });
    expect(mesh.status()).toMatchObject({ room: 'off', error: 'disconnected' });
    up = true;
    onPeers?.({ peers: [], joined: [], left: [], updated: [] });
    expect(mesh.status()).toMatchObject({ room: 'on', error: null });
    // A failed presence write marks it again; a good one clears it.
    up = false;
    await mesh.presence({ a: 1 });
    up = true;
    expect(mesh.status().error).toBe('disconnected');
    await mesh.presence({ a: 2 });
    expect(mesh.status()).toMatchObject({ room: 'on', error: null });
  });
});
