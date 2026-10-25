// Live tables on the JongClub server: the LobbyRoom / NamedRoom of room.ts
// over one WebSocket (protocol in server/rooms.js). Session, lockstep and the
// live UI use it exactly like the claude.ai room: presence patches, the peers
// list and onPeers. The socket reconnects by itself, rejoins its rooms and
// re-sends this tab's presence; the tab keeps its peer label across
// reconnects, so a short drop doesn't free its seat.

import { cloudSession, serverUrl } from './api';
import type { LobbyRoom, NamedRoom, PeersChange, RoomPeer, UserApi } from './room';

interface WirePeer {
  peer: string;
  by: string | null;
  guest: boolean;
  presence: Record<string, unknown>;
  updatedAt: number;
}

type Msg =
  | { t: 'hello'; peer: string; by: string | null; guest: boolean }
  | { t: 'ok'; id: number; room?: string; peers?: WirePeer[] }
  | { t: 'err'; id?: number; code: string; message: string }
  | { t: 'peers'; room: string; joined: WirePeer[]; left: string[]; updated: WirePeer[] }
  | { t: 'pong' };

const rand = (n: number) => {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => a[x % a.length]).join('');
};

/** This tab's peer label and resume key (kept for the tab's life, so a reload keeps the seat). */
function tabIdentity(): { peer: string; key: string } {
  const KEY = 'jongclub.cloud.peer.v1';
  try {
    const raw = globalThis.sessionStorage?.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* no session storage */
  }
  const id = { peer: rand(14), key: rand(24) };
  try {
    globalThis.sessionStorage?.setItem(KEY, JSON.stringify(id));
  } catch {
    /* ignore */
  }
  return id;
}

interface RoomState {
  peers: Map<string, WirePeer>;
  mine: Record<string, unknown>;
  fns: Set<(c: PeersChange) => void>;
  errFns: Set<(e: { code: string; message: string }) => void>;
  joined: boolean;
  /** join() calls waiting for the room's first peer list. */
  waiters: (() => void)[];
}

/** One WebSocket to the server carrying any number of rooms. */
export class CloudSocket {
  private ws: WebSocket | null = null;
  private seq = 0;
  private pending = new Map<number, { resolve: (m: Msg) => void; reject: (e: Error) => void }>();
  private rooms = new Map<string, RoomState>();
  private open = false;
  private stopped = false;
  private retry = 500;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  peer: string;
  private key: string;
  /** Resolves once the first connection said hello (or failed). */
  ready: Promise<boolean>;
  private readyFn: (ok: boolean) => void = () => {};

  constructor(
    private base: string,
    private token: () => string | null = () => null,
    identity = tabIdentity(),
  ) {
    this.peer = identity.peer;
    this.key = identity.key;
    this.ready = new Promise((r) => (this.readyFn = r));
    this.connect();
  }

  get connected() {
    return this.open;
  }

  private connect() {
    if (this.stopped) return;
    const q = new URLSearchParams({ peer: this.peer, key: this.key });
    const t = this.token();
    if (t) q.set('token', t);
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${this.base.replace(/^http/, 'ws')}/rt?${q}`);
    } catch {
      this.readyFn(false);
      return this.reconnectLater();
    }
    this.ws = ws;
    ws.onmessage = (e) => this.onMessage(String(e.data));
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.open = false;
      this.ws = null;
      if (this.pingTimer) clearInterval(this.pingTimer);
      for (const p of this.pending.values()) p.reject(new Error('disconnected'));
      this.pending.clear();
      this.readyFn(false);
      // Others see a change of connection; tell listeners so connected() is re-read.
      for (const [name, r] of this.rooms) if (r.joined) this.emit(name, { joined: [], left: [], updated: [] });
      this.reconnectLater();
    };
  }

  private reconnectLater() {
    if (this.stopped) return;
    const wait = this.retry;
    this.retry = Math.min(15000, this.retry * 2);
    setTimeout(() => this.connect(), wait);
  }

  private onMessage(text: string) {
    let m: Msg;
    try {
      m = JSON.parse(text);
    } catch {
      return;
    }
    if (m.t === 'hello') {
      this.peer = m.peer;
      this.open = true;
      this.retry = 500;
      this.readyFn(true);
      this.pingTimer = setInterval(() => this.raw({ t: 'ping' }), 25000);
      // Rejoin every room and put our presence back.
      for (const [name, r] of this.rooms) if (r.joined) void this.rejoin(name, r);
      return;
    }
    if (m.t === 'ok' || (m.t === 'err' && m.id !== undefined)) {
      const p = this.pending.get(m.id!);
      if (p) {
        this.pending.delete(m.id!);
        p.resolve(m);
      }
      return;
    }
    if (m.t === 'peers') {
      const r = this.rooms.get(m.room);
      if (!r) return;
      for (const p of [...m.joined, ...m.updated]) r.peers.set(p.peer, p);
      for (const label of m.left) r.peers.delete(label);
      this.emit(m.room, { joined: m.joined.map((p) => p.peer), left: m.left, updated: m.updated.map((p) => p.peer) });
    }
  }

  private raw(m: unknown) {
    if (this.ws && this.open) this.ws.send(JSON.stringify(m));
  }

  private request(m: Record<string, unknown>): Promise<Msg> {
    if (!this.ws || !this.open) return Promise.reject(new Error('disconnected'));
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify({ ...m, id }));
    });
  }

  private async rejoin(name: string, r: RoomState) {
    const ok = await this.request({ t: 'join', room: name }).catch(() => null);
    if (!ok || ok.t !== 'ok') return;
    r.peers = new Map((ok.peers ?? []).map((p) => [p.peer, p]));
    if (Object.keys(r.mine).length) await this.request({ t: 'presence', room: name, patch: r.mine }).catch(() => null);
    for (const w of r.waiters.splice(0)) w();
    this.emit(name, { joined: [], left: [], updated: [] });
  }

  private toPeer(p: WirePeer): RoomPeer {
    const me = p.peer === this.peer;
    return { peer: p.peer, by: p.by, isMe: me, sameTab: me, kind: 'viewer', guest: p.guest, presence: p.presence, updatedAt: p.updatedAt };
  }

  peersOf(name: string): RoomPeer[] {
    const r = this.rooms.get(name);
    return r ? [...r.peers.values()].map((p) => this.toPeer(p)) : [];
  }

  private emit(name: string, c: { joined: string[]; left: string[]; updated: string[] }) {
    const r = this.rooms.get(name);
    if (!r) return;
    const peers = this.peersOf(name);
    const pick = (labels: string[]) => peers.filter((p) => labels.includes(p.peer));
    const change: PeersChange = { peers, joined: pick(c.joined), left: c.left.map((peer) => ({ peer, by: null, isMe: false, sameTab: false, kind: 'viewer', guest: true, presence: {}, updatedAt: 0 })), updated: pick(c.updated) };
    for (const fn of [...r.fns]) fn(change);
  }

  /** Join a room (resolves once the server has sent its peers). */
  async join(name: string): Promise<void> {
    let r = this.rooms.get(name);
    if (!r) this.rooms.set(name, (r = { peers: new Map(), mine: {}, fns: new Set(), errFns: new Set(), joined: true, waiters: [] }));
    r.joined = true;
    if (this.open) return this.rejoin(name, r);
    // Not connected yet: the hello handler rejoins every room; wait for that, or for the first attempt to fail.
    const room = r;
    await new Promise<void>((resolve) => {
      room.waiters.push(resolve);
      void this.ready.then((ok) => !ok && resolve());
    });
  }

  async leave(name: string) {
    const r = this.rooms.get(name);
    if (!r) return;
    this.rooms.delete(name);
    await this.request({ t: 'leave', room: name }).catch(() => null);
  }

  /** Merge a presence patch (null deletes a key). Offline patches are sent on reconnect. */
  async presence(name: string, patch: Record<string, unknown>) {
    const r = this.rooms.get(name);
    if (!r) throw new Error('not_joined');
    const next = { ...r.mine };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete next[k];
      else next[k] = JSON.parse(JSON.stringify(v ?? null));
    }
    if (new TextEncoder().encode(JSON.stringify(next)).length > 4096) throw new Error('invalid_argument');
    r.mine = next;
    if (!this.open) return;
    const res = await this.request({ t: 'presence', room: name, patch });
    if (res.t === 'err') {
      for (const fn of r.errFns) fn({ code: res.code, message: res.message });
      throw new Error(res.code);
    }
  }

  onPeers(name: string, fn: (c: PeersChange) => void, onError?: (e: { code: string; message: string }) => void) {
    const r = this.rooms.get(name);
    if (!r) return () => {};
    r.fns.add(fn);
    if (onError) r.errFns.add(onError);
    return () => {
      r.fns.delete(fn);
      if (onError) r.errFns.delete(onError);
    };
  }

  close() {
    this.stopped = true;
    this.open = false;
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.ws?.close();
    this.ws = null;
  }
}

class CloudRoom implements NamedRoom {
  constructor(
    protected sock: CloudSocket,
    readonly name: string,
  ) {}
  presence(patch: Record<string, unknown>) {
    return this.sock.presence(this.name, patch);
  }
  peers() {
    return this.sock.peersOf(this.name);
  }
  onPeers(fn: (c: PeersChange) => void, onError?: (e: { code: string; message: string }) => void) {
    return this.sock.onPeers(this.name, fn, onError);
  }
  connected() {
    return this.sock.connected;
  }
  leave() {
    return this.sock.leave(this.name);
  }
}

/** The server's lobby: everyone in the club right now; join(name) opens a table room. */
export class CloudLobby extends CloudRoom implements LobbyRoom {
  constructor(sock: CloudSocket) {
    super(sock, 'lobby');
  }
  async join(name: string): Promise<NamedRoom> {
    await this.sock.join(name);
    return new CloudRoom(this.sock, name);
  }
  /** Close the socket (tests; the app keeps one for the page's life). */
  close() {
    this.sock.close();
  }
}

/** Connect to a server and join its lobby. Resolves within `waitMs` even if the server is down (it keeps retrying). */
export async function connectCloud(base: string, token: () => string | null = () => cloudSession()?.token ?? null, waitMs = 5000): Promise<CloudLobby> {
  const sock = new CloudSocket(base, token);
  const lobby = new CloudLobby(sock);
  await Promise.race([sock.join('lobby'), new Promise((r) => setTimeout(r, waitMs))]);
  return lobby;
}

/** The lobby on the configured server, or null when there is none. */
export function cloudLobby(): Promise<LobbyRoom | null> {
  const base = serverUrl();
  return base ? connectCloud(base).catch(() => null) : Promise.resolve(null);
}

/** Who you are to the server: your account id when signed in, else this tab's label. */
export function cloudUser(): UserApi {
  return { id: async () => cloudSession()?.user.id ?? tabIdentity().peer, isOwner: () => false };
}
