// One live table over two links at once: the platform `room` (instant, but
// live-only) and the `db` store (dbroom.ts, saved and synced). Every presence
// patch goes to both; the peers list merges them by the tab label each page
// puts in its presence, so a player reachable over either link is at the
// table. Session and lockstep code see a single NamedRoom.

import { TAB, plain, type DbNamedRoom } from './dbroom';
import type { NamedRoom, PeersChange, RoomPeer } from './room';

export interface LinkStatus {
  /** The platform room: 'on', 'off' (joined, not connected) or 'none' (not available here). */
  room: 'on' | 'off' | 'none';
  /** The shared store. */
  store: 'on' | 'off' | 'none';
  /** The last error either link reported, if any. */
  error: string | null;
}

const TAB_RE = /^[a-z0-9]{12}$/;

export class MeshRoom implements NamedRoom {
  private fns = new Set<(c: PeersChange) => void>();
  private offs: (() => void)[] = [];
  private snapshot: readonly RoomPeer[] = [];
  private stale = true;
  private roomError: string | null = null;

  constructor(
    readonly name: string,
    private room: NamedRoom | null,
    private store: DbNamedRoom | null,
  ) {
    const changed = () => {
      this.stale = true;
      const peers = this.peers();
      for (const fn of [...this.fns]) fn({ peers, joined: [], left: [], updated: [] });
    };
    if (room)
      this.offs.push(
        room.onPeers(changed, (e) => {
          this.roomError = e.code;
          changed();
        }),
      );
    if (store) this.offs.push(store.onPeers(changed));
  }

  presence(patch: Record<string, unknown>): Promise<void> {
    const p = plain(patch);
    const sent: Promise<void>[] = [];
    if (this.room)
      sent.push(
        this.room.presence({ ...p, tab: TAB }).catch((e: { code?: string }) => {
          this.roomError = e?.code ?? 'presence_failed';
        }),
      );
    if (this.store) sent.push(this.store.presence(p));
    return Promise.all(sent).then(() => undefined);
  }

  peers(): readonly RoomPeer[] {
    if (!this.stale) return this.snapshot;
    this.stale = false;
    const out = new Map<string, RoomPeer>();
    for (const p of this.store?.peers() ?? []) out.set(p.peer, p);
    for (const p of this.room?.peers() ?? []) {
      const tab = p.isMe && p.sameTab ? TAB : p.presence?.tab;
      if (typeof tab !== 'string' || !TAB_RE.test(tab)) continue;
      const db = out.get(tab);
      // The room is the quicker link, so its copy wins when both have one.
      out.set(tab, { ...p, peer: tab, isMe: p.isMe || !!db?.isMe, sameTab: tab === TAB });
    }
    if (!out.has(TAB)) out.set(TAB, { peer: TAB, by: null, isMe: true, sameTab: true, kind: 'viewer', guest: false, presence: {}, updatedAt: Date.now() });
    return (this.snapshot = Object.freeze([...out.values()]));
  }

  onPeers(fn: (c: PeersChange) => void) {
    this.fns.add(fn);
    return () => void this.fns.delete(fn);
  }

  connected() {
    return !!this.room?.connected() || !!this.store?.connected();
  }

  status(): LinkStatus {
    return {
      room: !this.room ? 'none' : this.room.connected() && !this.roomError ? 'on' : 'off',
      store: !this.store ? 'none' : this.store.connected() ? 'on' : 'off',
      error: this.roomError ?? this.store?.error ?? null,
    };
  }

  async leave() {
    for (const off of this.offs) off();
    this.fns.clear();
    await Promise.all([this.room?.leave().catch(() => {}), this.store?.leave()]);
  }
}
