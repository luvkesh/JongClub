// Multiplayer club: who is here, which live tables are open, and the
// waiting room of one table until its host starts the game.
//
// Default chosen for Phase 3: there is no JongClub game server yet, so live
// play runs peer-to-peer through the claude.ai artifact `room` capability.
// Anyone viewing the published JongClub page can see open tables and sit
// down. The host's browser is the referee (see lockstep.ts). The same
// TableSession API can later sit on a WebSocket server instead.

import type { AvatarSpec } from '../cosmetics/catalog';
import type { TableConfig } from '../ui/match';
import { seatsForVariation } from '../engine/rules';
import { RoomLink } from './lockstep';
import { DbNamedRoom, plain, type Db } from './dbroom';
import { MeshRoom, type LinkStatus } from './mesh';
import { liveDb, lobbyRoom, myPeer, newTableCode, userApi, type LobbyRoom, type RoomPeer } from './room';

export interface Who {
  name: string;
  avatar?: AvatarSpec;
}

/** A table as advertised in the lobby. */
export interface LobbyTable {
  code: string;
  title: string;
  variation: string;
  length: string;
  seated: number;
  /** Seats at the table (3 for Korean, else 4); from the variation, not from the advert. */
  seats: number;
  started: boolean;
  timer: number;
  host: string;
  ranked: boolean;
}

export interface StartSeat {
  kind: 'human' | 'ai';
  name: string;
  peer?: string;
  avatar?: AvatarSpec;
  personality?: string;
}

export interface TableInfo {
  title: string;
  cfg: TableConfig;
  /** Peer label in each seat (seat 0 is the host). */
  seats: (string | null)[];
  ranked: boolean;
  start?: { seed: number; seats: StartSeat[] };
}

// Control, zero-width and bidi characters are stripped from names others typed.
const CONTROL = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069]', 'g');

const clean = (s: unknown, max = 24) =>
  String(s ?? '')
    .replace(CONTROL, '')
    .trim()
    .slice(0, max) || 'Guest';

export function whoOf(p: RoomPeer | undefined): Who {
  const w = (p?.presence?.who ?? {}) as Partial<Who>;
  return { name: clean(w.name), avatar: w.avatar && typeof w.avatar === 'object' ? (w.avatar as AvatarSpec) : undefined };
}

/** Tables advertised in the shared store drop off the list after this long without a refresh. */
const ADVERT_FRESH = 20 * 60_000;
/** A host refreshes its advert this often. */
const ADVERT_EVERY = 5 * 60_000;

/** A lobby advert as someone else sent it (untrusted), or null. */
function readAdvert(t: Partial<LobbyTable> | undefined, host: string): LobbyTable | null {
  if (!t || typeof t.code !== 'string' || !/^[a-z0-9]{5}$/.test(t.code)) return null;
  const variation = clean(t.variation, 16);
  return {
    code: t.code,
    title: clean(t.title, 32),
    variation,
    length: clean(t.length, 16),
    seated: Math.max(1, Math.min(seatsForVariation(variation), Number(t.seated) || 1)),
    seats: seatsForVariation(variation),
    started: !!t.started,
    timer: Number(t.timer) || 0,
    host,
    ranked: !!t.ranked,
  };
}

export class Club {
  private listeners = new Set<() => void>();
  /** Adverts kept in the shared store (they reach devices the room link misses). */
  private stored: Record<string, unknown>[] = [];
  private advert: { code: string; json: string; at: number } | null = null;
  private advertTimer = 0;
  private constructor(
    readonly lobby: LobbyRoom | null,
    private db: Db | null,
    private uid: string | null,
  ) {
    lobby?.onPeers(() => this.emit());
    db?.collection('tables').onSnapshot(
      (snap) => {
        this.stored = snap.docs.filter((d) => d.exists).map((d) => d.data() ?? {});
        this.emit();
      },
      () => {},
    );
  }

  /** The club, or null when live play isn't available here. */
  static async connect(who: Who): Promise<Club | null> {
    const [lobby, db] = await Promise.all([lobbyRoom(), liveDb()]);
    if (!lobby && !db) return null;
    const uid = db ? await userApi().then((u) => (u ? u.id() : null)).catch(() => null) : null;
    const c = new Club(lobby, db, uid);
    await lobby?.presence({ who }).catch(() => {});
    return c;
  }

  setWho(who: Who) {
    void this.lobby?.presence({ who }).catch(() => {});
  }

  /** A table's room over both links (mesh.ts): either one reaching the other device is enough. */
  private async openRoom(name: string): Promise<MeshRoom> {
    const store = this.db ? new DbNamedRoom(this.db, name, this.uid) : null;
    let late = false;
    const joining = this.lobby ? this.lobby.join(name).catch(() => null) : Promise.resolve(null);
    // A room link that hangs must not hold the table up when the store can carry it.
    const room = store
      ? await Promise.race([joining, new Promise<null>((r) => setTimeout(() => ((late = true), r(null)), 6000))])
      : await joining;
    if (late) void joining.then((r) => r?.leave().catch(() => {}));
    if (!room && !store) throw new Error('Live tables are not available here.');
    return new MeshRoom(name, room, store);
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    // Copy first: a listener that re-renders subscribes a new one, which a live Set iteration would visit (endless loop).
    for (const fn of [...this.listeners]) fn();
  }

  /** People in the club right now (you included). */
  online(): { peer: string; who: Who; isMe: boolean; guest: boolean; atTable: boolean }[] {
    return (this.lobby?.peers() ?? [])
      .filter((p) => p.kind === 'viewer')
      .map((p) => ({ peer: p.peer, who: whoOf(p), isMe: p.isMe && p.sameTab, guest: p.guest, atTable: !!p.presence?.table }));
  }

  /** Public tables people are hosting now. */
  tables(): LobbyTable[] {
    const out = new Map<string, LobbyTable>();
    for (const p of this.lobby?.peers() ?? []) {
      const t = readAdvert(p.presence?.table as Partial<LobbyTable> | undefined, whoOf(p).name);
      if (t) out.set(t.code, t);
    }
    const now = Date.now();
    for (const d of this.stored) {
      if (!(now - (Number(d.at) || 0) < ADVERT_FRESH)) continue;
      const t = readAdvert(d as Partial<LobbyTable>, clean(d.host));
      if (t && !out.has(t.code)) out.set(t.code, t);
    }
    return [...out.values()];
  }

  async host(cfg: TableConfig, who: Who, opts: { title: string; isPrivate: boolean; ranked: boolean }): Promise<TableSession> {
    const code = newTableCode();
    const room = await this.openRoom(`jc-${code}`);
    const s = new TableSession(this, room, code, true, who, opts.isPrivate);
    await s.init({ title: opts.title, cfg, seats: new Array<string | null>(seatsForVariation(cfg.variation)).fill(null), ranked: opts.ranked });
    return s;
  }

  async join(code: string, who: Who, spectate = false): Promise<TableSession> {
    const c = code.trim().toLowerCase();
    if (!/^[a-z0-9]{5}$/.test(c)) throw new Error('Table codes are five letters or numbers.');
    const room = await this.openRoom(`jc-${c}`);
    const s = new TableSession(this, room, c, false, who, true, spectate);
    await s.init(null);
    return s;
  }

  /** Advertise (or stop advertising) your table in the lobby. */
  advertise(t: LobbyTable | null) {
    void this.lobby?.presence({ table: t }).catch(() => {});
    if (!this.db) return;
    const prev = this.advert;
    if (!t) {
      window.clearInterval(this.advertTimer);
      this.advert = null;
      if (prev) void this.db.doc(`tables/${prev.code}`).delete().catch(() => {});
      return;
    }
    const json = JSON.stringify(t);
    if (prev && prev.code !== t.code) void this.db.doc(`tables/${prev.code}`).delete().catch(() => {});
    if (prev?.code === t.code && prev.json === json && Date.now() - prev.at < ADVERT_EVERY - 5000) return;
    this.advert = { code: t.code, json, at: Date.now() };
    void this.db.doc(`tables/${t.code}`).set({ ...plain(t), at: Date.now() }).catch(() => {});
    window.clearInterval(this.advertTimer);
    this.advertTimer = window.setInterval(() => this.advertise(t), ADVERT_EVERY);
  }
}

export class TableSession {
  private listeners = new Set<() => void>();
  private unsub: () => void;
  private info: TableInfo | null = null;
  private left = false;
  private lastLink: RoomLink | null = null;

  constructor(
    private club: Club,
    readonly room: MeshRoom,
    readonly code: string,
    readonly isHost: boolean,
    private who: Who,
    private isPrivate: boolean,
    readonly spectating = false,
  ) {
    this.unsub = room.onPeers(() => this.update());
  }

  async init(info: TableInfo | null) {
    this.info = info;
    await this.room
      .presence({ who: this.who, role: this.isHost ? 'host' : this.spectating ? 'spectator' : 'player', table: info as unknown as Record<string, unknown> })
      .catch(() => {});
    this.update();
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get myPeer() {
    return myPeer(this.room);
  }

  private hostPeer(): RoomPeer | undefined {
    return this.room.peers().find((p) => p.presence?.role === 'host');
  }

  /** The table as the host describes it. */
  table(): TableInfo | null {
    if (this.isHost) return this.info;
    const t = this.hostPeer()?.presence?.table as TableInfo | undefined;
    return t && Array.isArray(t.seats) && t.cfg ? t : null;
  }

  hostName() {
    return whoOf(this.hostPeer()).name;
  }

  /** Seat by seat: who is sitting there (null = AI fills it). */
  seating(): ({ peer: string; who: Who; isMe: boolean } | null)[] {
    const t = this.table();
    if (!t) return [null, null, null, null];
    const peers = this.room.peers();
    return t.seats.map((label) => {
      const p = label ? peers.find((x) => x.peer === label) : undefined;
      return p ? { peer: p.peer, who: whoOf(p), isMe: p.isMe && p.sameTab } : null;
    });
  }

  spectators(): Who[] {
    // Watchers, and anyone who arrived after the seats were filled and the game began.
    const t = this.table();
    return this.room
      .peers()
      .filter((p) => p.presence?.role === 'spectator' || (!!t?.start && p.presence?.role === 'player' && !t.seats.includes(p.peer)))
      .map(whoOf);
  }

  /** How this tab reaches the table: the room link, the shared store, or neither. */
  links(): LinkStatus {
    return this.room.status();
  }

  hostPresent() {
    return this.isHost || !!this.hostPeer();
  }

  private update() {
    if (this.left) return;
    if (this.isHost && this.info && !this.info.start) {
      // Seat players in arrival order; free seats when people leave.
      const peers = this.room.peers();
      const me = myPeer(this.room);
      const seats = this.info.seats.slice();
      seats[0] = me;
      for (let i = 1; i < seats.length; i++) if (seats[i] && !peers.some((p) => p.peer === seats[i])) seats[i] = null;
      for (const p of peers) {
        if (p.presence?.role !== 'player' || seats.includes(p.peer)) continue;
        const free = seats.findIndex((x, i) => i > 0 && !x);
        if (free > 0) seats[free] = p.peer;
      }
      if (seats.some((x, i) => x !== this.info!.seats[i])) {
        this.info = { ...this.info, seats };
        void this.room.presence({ table: this.info as unknown as Record<string, unknown> }).catch(() => {});
      }
    }
    if (this.isHost && this.info) this.advertise();
    for (const fn of [...this.listeners]) fn();
  }

  private advertise() {
    if (!this.info || this.isPrivate) return this.club.advertise(null);
    const c = this.info.cfg;
    this.club.advertise({
      code: this.code,
      title: this.info.title,
      variation: c.variation,
      length: c.length,
      seated: this.info.seats.filter(Boolean).length,
      seats: this.info.seats.length,
      started: !!this.info.start,
      timer: c.timer,
      host: this.who.name,
      ranked: this.info.ranked,
    });
  }

  /** Host: start the game; empty seats are filled by AI players. */
  async start(aiNames: string[], seed: number) {
    // Once only: a second click must not restart the table with another seed.
    if (!this.isHost || !this.info || this.info.start || this.left) return;
    const seating = this.seating();
    let ai = 0;
    const seats: StartSeat[] = seating.map((s, i) => {
      if (s) return { kind: 'human', name: s.who.name, peer: s.peer, avatar: s.who.avatar };
      const personality = this.info!.cfg.personalities[ai % this.info!.cfg.personalities.length];
      const name = aiNames[ai++] ?? `Player ${i + 1}`;
      return { kind: 'ai', name, personality };
    });
    // Keep names distinct at the table.
    const seen = new Set<string>();
    for (const s of seats) {
      let n = s.name;
      let k = 2;
      while (seen.has(n)) n = `${s.name} ${k++}`;
      s.name = n;
      seen.add(n);
    }
    this.info = { ...this.info, start: { seed, seats } };
    await this.room.presence({ table: this.info as unknown as Record<string, unknown> }).catch(() => {});
    this.advertise();
    this.update();
  }

  /** The lockstep link for a started game. */
  link(): RoomLink | null {
    const t = this.table();
    const host = this.hostPeer()?.peer ?? (this.isHost ? this.myPeer : null);
    if (!t?.start || !host) return null;
    this.lastLink?.close();
    return (this.lastLink = new RoomLink(
      this.room,
      t.start.seats.map((s) => (s.kind === 'human' ? s.peer ?? null : null)),
      host,
      this.isHost,
    ));
  }

  /** Latest hand-start snapshot from the host (late spectators). */
  hostSnapshot() {
    const play = this.hostPeer()?.presence?.play as { hs?: { h: number; round: unknown; scores: number[]; pot: number; goulash?: 1 } } | undefined;
    return play?.hs ?? null;
  }

  async leave() {
    if (this.left) return;
    this.left = true;
    this.unsub();
    this.lastLink?.close();
    if (this.isHost) this.club.advertise(null);
    if (this.isHost && this.info?.start) {
      // Stay in the room a little while (play marked over) so players still
      // finishing the last hand can read the host's final decisions.
      await new Promise((r) => setTimeout(r, 15000));
    }
    await this.room.leave().catch(() => {});
  }
}
