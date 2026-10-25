// Live tables through the artifact `db` capability: the same NamedRoom as
// room.ts, kept as one small document per open tab under rooms/<name>/peers.
//
// Why: the platform `room` link is live-only and, between two computers, it
// can fail without a word (the host's table never reaches the other device).
// The db store is saved and synced for everyone who can open the page, so
// mesh.ts runs every table over both and either one is enough.
//
// Presence lives in the tab's document; a slow beat keeps it fresh so other
// tabs notice when a page closed without saying goodbye. Liveness is judged
// by when *this* tab last saw a document change, never by another device's
// clock.

import type { NamedRoom, PeersChange, RoomPeer } from './room';

interface DocSnap {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface QuerySnap {
  docs: DocSnap[];
}
type DbErr = { code: string; message: string };
interface DocRef {
  set(d: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
}
interface CollRef {
  doc(id: string): DocRef;
  onSnapshot(next: (s: QuerySnap) => void, err?: (e: DbErr) => void): () => void;
}
export interface Db {
  doc(path: string): DocRef;
  collection(path: string): CollRef;
}

/** Rewrite our document this often so others know the tab is still open. */
const BEAT = 20_000;
/** A tab whose document hasn't changed for this long has gone. */
const STALE = 65_000;
/** Leftovers from a tab that closed without cleaning up are ignored, and removed. */
const ANCIENT = 6 * 3600_000;

/** Plain JSON only: undefined fields dropped, nothing exotic. */
export const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v ?? null));

/** This tab's label on every live table (the same over room and db). */
export const TAB = (() => {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  const b = new Uint8Array(12);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => a[x % a.length]).join('');
})();

interface Other {
  presence: Record<string, unknown>;
  by: string | null;
  body: string;
  seen: number;
}

export class DbNamedRoom implements NamedRoom {
  private mine: Record<string, unknown> = {};
  private others = new Map<string, Other>();
  private fns = new Set<(c: PeersChange) => void>();
  private snapshot: readonly RoomPeer[] = [];
  private stale = true;
  private unsub: () => void;
  private timers: number[] = [];
  private writing = false;
  private dirty = false;
  private n = 0;
  private left = false;
  private live = false;
  /** The last error from the store (shown in the waiting room). */
  error: string | null = null;

  constructor(
    private db: Db,
    readonly name: string,
    private uid: string | null,
  ) {
    this.unsub = db.collection(`rooms/${name}/peers`).onSnapshot(
      (s) => this.onSnap(s),
      (e) => {
        this.error = e.code;
        this.live = false;
        this.emit();
      },
    );
    this.timers.push(
      window.setInterval(() => {
        if (Object.keys(this.mine).length) void this.flush();
      }, BEAT),
      window.setInterval(() => this.prune(), 4000),
    );
    window.addEventListener('pagehide', this.bye);
  }

  private ref() {
    return this.db.doc(`rooms/${this.name}/peers/${TAB}`);
  }

  private onSnap(s: QuerySnap) {
    if (this.left) return;
    this.live = true;
    this.error = null;
    const now = Date.now();
    const ids = new Set<string>();
    let changed = false;
    for (const d of s.docs) {
      if (d.id === TAB || !d.exists) continue;
      const body = d.data() ?? {};
      const at = Number(body.at) || 0;
      if (at && now - at > ANCIENT) {
        void this.db.doc(`rooms/${this.name}/peers/${d.id}`).delete().catch(() => {});
        continue;
      }
      ids.add(d.id);
      const json = JSON.stringify(body);
      const prev = this.others.get(d.id);
      if (prev?.body === json) continue;
      const p = body.p;
      this.others.set(d.id, {
        presence: p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {},
        by: typeof body.by === 'string' ? body.by : null,
        body: json,
        seen: now,
      });
      changed = true;
    }
    for (const id of [...this.others.keys()]) {
      if (!ids.has(id)) {
        this.others.delete(id);
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  private prune() {
    const now = Date.now();
    let changed = false;
    for (const [id, o] of this.others) {
      if (now - o.seen > STALE) {
        this.others.delete(id);
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  private emitting = false;

  /** Like the platform room: listeners hear about changes later, never inside presence(). */
  private emit() {
    this.stale = true;
    if (this.emitting) return;
    this.emitting = true;
    setTimeout(() => {
      this.emitting = false;
      if (this.left) return;
      const peers = this.peers();
      for (const fn of [...this.fns]) fn({ peers, joined: [], left: [], updated: [] });
    }, 0);
  }

  /** One write at a time; a burst of patches becomes one write. */
  private async flush() {
    if (this.left) return;
    if (this.writing) {
      this.dirty = true;
      return;
    }
    this.writing = true;
    try {
      do {
        this.dirty = false;
        this.n++;
        await this.ref().set({ p: this.mine, by: this.uid, at: Date.now(), n: this.n });
      } while (this.dirty && !this.left);
    } catch (e) {
      this.error = (e as DbErr)?.code ?? 'write_failed';
    } finally {
      this.writing = false;
    }
  }

  presence(patch: Record<string, unknown>): Promise<void> {
    if (this.left) return Promise.resolve();
    const next = { ...this.mine };
    for (const [k, v] of Object.entries(plain(patch))) {
      if (v === null) delete next[k];
      else next[k] = v;
    }
    this.mine = next;
    this.emit();
    void this.flush();
    return Promise.resolve();
  }

  peers(): readonly RoomPeer[] {
    if (!this.stale) return this.snapshot;
    this.stale = false;
    const me: RoomPeer = { peer: TAB, by: this.uid, isMe: true, sameTab: true, kind: 'viewer', guest: false, presence: this.mine, updatedAt: Date.now() };
    const rest = [...this.others].map(([peer, o]): RoomPeer => ({
      peer,
      by: o.by,
      isMe: !!this.uid && o.by === this.uid,
      sameTab: false,
      kind: 'viewer',
      guest: false,
      presence: o.presence,
      updatedAt: o.seen,
    }));
    return (this.snapshot = Object.freeze([me, ...rest]));
  }

  onPeers(fn: (c: PeersChange) => void) {
    this.fns.add(fn);
    return () => void this.fns.delete(fn);
  }

  connected() {
    return this.live && !this.error;
  }

  private bye = () => {
    void this.ref().delete().catch(() => {});
  };

  async leave() {
    if (this.left) return;
    this.left = true;
    this.unsub();
    for (const t of this.timers) window.clearInterval(t);
    window.removeEventListener('pagehide', this.bye);
    this.fns.clear();
    await this.ref().delete().catch(() => {});
  }
}
