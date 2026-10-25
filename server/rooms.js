// The live-table relay: presence rooms with the same semantics as the claude.ai
// `room` capability that src/net/room.ts describes (RoomLike / LobbyRoom /
// NamedRoom). Each peer has a presence object; a patch sets top-level keys
// (null deletes one); every change is broadcast to everyone in the room. The
// server never reads game moves: lockstep (src/net/lockstep.ts) rides inside
// presence, and the host's browser referees.
//
// Wire protocol, JSON text frames:
//   client -> server  { t: 'join' | 'leave', room, id }
//                     { t: 'presence', room, patch, id }
//                     { t: 'ping' }
//   server -> client  { t: 'hello', peer, by, guest }
//                     { t: 'ok', id, room?, peers? }       join answers with the full peer list
//                     { t: 'err', id, code, message }
//                     { t: 'peers', room, joined: Peer[], left: string[], updated: Peer[] }
//                     { t: 'pong' }
//   Peer = { peer, by, guest, presence, updatedAt }

import { randomBytes, createHash } from 'node:crypto';

/** Presence per peer per room, as on claude.ai. */
export const PRESENCE_LIMIT = 4096;
const ROOM_NAME = /^[a-z0-9][a-z0-9:_-]{0,63}$/i;
const MAX_ROOMS_PER_CONN = 8;
const MAX_PEERS = { lobby: 500, other: 64 };
/** Messages a connection may send: a burst of 40, refilled at 20 a second. */
const BURST = 40;
const REFILL_PER_S = 20;

const sha = (s) => createHash('sha256').update(String(s)).digest('hex');

export class RoomHub {
  constructor() {
    /** room name -> Map(peer -> { conn, presence, updatedAt }) */
    this.rooms = new Map();
    /** peer label -> sha256 of the tab's resume key, so a reconnecting tab keeps its label. */
    this.keys = new Map();
    /** peer label -> live connection */
    this.conns = new Map();
  }

  /**
   * Attach a WebSocket. `ask` is the tab's wish: { peer, key } to keep its label
   * across reconnects. `user` is { uid, name } for a signed-in account, else null.
   */
  attach(ws, ask, user) {
    let peer = typeof ask.peer === 'string' && /^[a-z0-9]{8,32}$/i.test(ask.peer) ? ask.peer : '';
    const key = typeof ask.key === 'string' && ask.key.length >= 16 ? ask.key : '';
    if (peer && (!key || (this.keys.has(peer) && this.keys.get(peer) !== sha(key)))) peer = '';
    if (!peer) peer = randomBytes(9).toString('base64url').replace(/[-_]/g, 'x');
    if (key) this.keys.set(peer, sha(key));
    // The same tab reconnecting: drop its old socket first.
    this.conns.get(peer)?.ws.close(4000, 'replaced');
    const conn = { ws, peer, by: user?.uid ?? null, guest: !user, rooms: new Set(), tokens: BURST, at: Date.now() };
    this.conns.set(peer, conn);
    ws.send(JSON.stringify({ t: 'hello', peer, by: conn.by, guest: conn.guest }));
    ws.on('message', (text) => this.onMessage(conn, text));
    ws.on('close', () => {
      for (const r of [...conn.rooms]) this.leave(conn, r);
      if (this.conns.get(peer) === conn) this.conns.delete(peer);
    });
    return conn;
  }

  peerOf(conn, entry) {
    return { peer: conn.peer, by: conn.by, guest: conn.guest, presence: entry.presence, updatedAt: entry.updatedAt };
  }

  snapshot(room) {
    const m = this.rooms.get(room);
    return m ? [...m.values()].map((e) => this.peerOf(e.conn, e)) : [];
  }

  broadcast(room, msg) {
    const m = this.rooms.get(room);
    if (!m) return;
    const text = JSON.stringify({ t: 'peers', room, joined: [], left: [], updated: [], ...msg });
    for (const e of m.values()) e.conn.ws.send(text);
  }

  allow(conn) {
    const now = Date.now();
    conn.tokens = Math.min(BURST, conn.tokens + ((now - conn.at) / 1000) * REFILL_PER_S);
    conn.at = now;
    if (conn.tokens < 1) return false;
    conn.tokens -= 1;
    return true;
  }

  onMessage(conn, text) {
    let m;
    try {
      m = JSON.parse(text);
    } catch {
      return conn.ws.close(1007, 'bad json');
    }
    if (!m || typeof m !== 'object') return;
    const err = (code, message) => conn.ws.send(JSON.stringify({ t: 'err', id: m.id, code, message }));
    if (m.t === 'ping') return conn.ws.send('{"t":"pong"}');
    if (!this.allow(conn)) return err('rate_limited', 'Too many messages; slow down.');
    const room = m.room;
    if (typeof room !== 'string' || !ROOM_NAME.test(room)) return err('invalid_argument', 'Bad room name.');
    if (m.t === 'join') {
      if (!conn.rooms.has(room)) {
        if (conn.rooms.size >= MAX_ROOMS_PER_CONN) return err('limit', 'Too many rooms open.');
        const max = room === 'lobby' ? MAX_PEERS.lobby : MAX_PEERS.other;
        if ((this.rooms.get(room)?.size ?? 0) >= max) return err('full', 'That room is full.');
        let r = this.rooms.get(room);
        if (!r) this.rooms.set(room, (r = new Map()));
        const entry = { conn, presence: {}, updatedAt: Date.now() };
        r.set(conn.peer, entry);
        conn.rooms.add(room);
        this.broadcast(room, { joined: [this.peerOf(conn, entry)] });
      }
      return conn.ws.send(JSON.stringify({ t: 'ok', id: m.id, room, peers: this.snapshot(room) }));
    }
    if (m.t === 'leave') {
      this.leave(conn, room);
      return conn.ws.send(JSON.stringify({ t: 'ok', id: m.id, room }));
    }
    if (m.t === 'presence') {
      const entry = this.rooms.get(room)?.get(conn.peer);
      if (!entry) return err('not_joined', 'Join the room first.');
      const patch = m.patch;
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return err('invalid_argument', 'Presence must be an object.');
      const next = { ...entry.presence };
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) delete next[k];
        else next[k] = v;
      }
      if (Buffer.byteLength(JSON.stringify(next)) > PRESENCE_LIMIT) return err('invalid_argument', 'Presence is over 4 KiB.');
      entry.presence = next;
      entry.updatedAt = Date.now();
      this.broadcast(room, { updated: [this.peerOf(conn, entry)] });
      return conn.ws.send(JSON.stringify({ t: 'ok', id: m.id }));
    }
    err('invalid_argument', 'Unknown message.');
  }

  leave(conn, room) {
    const r = this.rooms.get(room);
    conn.rooms.delete(room);
    if (!r?.delete(conn.peer)) return;
    if (!r.size) this.rooms.delete(room);
    else this.broadcast(room, { left: [conn.peer] });
  }

  /** Who is in a room (for HTTP endpoints such as a club's tables). */
  occupants(room) {
    return this.snapshot(room);
  }

  closeAll() {
    for (const c of [...this.conns.values()]) c.ws.close(1001, 'server shutting down');
  }
}
