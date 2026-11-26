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
import { RoomLink, keyOfPeer, samePlayer, type SeatKey } from './lockstep';
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
  /** Who the player is, so they can take the seat again: their tab's rejoin key (kept across a reload), */
  pid?: string;
  /** this browser's key (kept across tabs and restarts), */
  dev?: string;
  /** and their claude.ai user id (the same on every device). */
  uid?: string;
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

/**
 * This tab's rejoin key: kept for the tab's life (a reload keeps it), so a player whose page
 * reloaded mid-game is recognised and seated again (lockstep.ts seatReturners).
 */
export const tabPid = (() => {
  let id: string | null = null;
  return () => {
    if (id) return id;
    const KEY = 'jongclub.live.pid.v1';
    try {
      id = globalThis.sessionStorage?.getItem(KEY) ?? null;
    } catch {
      /* no session storage */
    }
    if (!id || !/^[a-z0-9]{12}$/.test(id)) {
      const a = 'abcdefghjkmnpqrstuvwxyz23456789';
      const b = new Uint8Array(12);
      globalThis.crypto.getRandomValues(b);
      id = Array.from(b, (x) => a[x % a.length]).join('');
      try {
        globalThis.sessionStorage?.setItem(KEY, id);
      } catch {
        /* ignore */
      }
    }
    return id;
  };
})();

/**
 * This browser's key: kept across tabs and restarts, so a player who reopens the table in a new tab
 * gets their seat back even where there is no claude.ai user id to recognise them by.
 */
export const deviceKey = (() => {
  let id: string | null = null;
  return () => {
    if (id) return id;
    const KEY = 'jongclub.live.dev.v1';
    try {
      id = globalThis.localStorage?.getItem(KEY) ?? null;
    } catch {
      /* no storage */
    }
    if (!id || !/^[a-z0-9]{12}$/.test(id)) {
      const a = 'abcdefghjkmnpqrstuvwxyz23456789';
      const b = new Uint8Array(12);
      globalThis.crypto.getRandomValues(b);
      id = Array.from(b, (x) => a[x % a.length]).join('');
      try {
        globalThis.localStorage?.setItem(KEY, id);
      } catch {
        /* ignore */
      }
    }
    return id;
  };
})();

const REJOIN_KEY = 'jongclub.live.table.v1';

/** Remember (or forget) the table this tab sits at, so a reload takes it back there. */
function rememberTable(code: string | null, spectate = false) {
  try {
    if (code) globalThis.sessionStorage?.setItem(REJOIN_KEY, JSON.stringify({ code, spectate, at: Date.now() }));
    else globalThis.sessionStorage?.removeItem(REJOIN_KEY);
  } catch {
    /* no session storage */
  }
}

/** The table this tab was sitting at before the page reloaded (taken once), or null. */
export function tableBeforeReload(): { code: string; spectate: boolean } | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(REJOIN_KEY);
    if (!raw) return null;
    globalThis.sessionStorage?.removeItem(REJOIN_KEY);
    const v = JSON.parse(raw) as { code?: unknown; spectate?: unknown; at?: unknown };
    if (typeof v.code !== 'string' || !/^[a-z0-9]{5}$/.test(v.code) || !(Date.now() - Number(v.at) < 3 * 3600_000)) return null;
    return { code: v.code, spectate: !!v.spectate };
  } catch {
    return null;
  }
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
    readonly uid: string | null,
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
    // The viewer's claude.ai user id recognises a returning player on any tab or device.
    const uid = await userApi()
      .then((u) => (u ? u.id() : null))
      .then((id) => (typeof id === 'string' && id ? id : null))
      .catch(() => null);
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
    rememberTable(c, spectate);
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
  /** This tab hosts the table (it opened it, or took over when the host left mid-game). */
  private hosting: boolean;
  /** How many times hosting has moved at this table (the host's `he`). */
  private epoch = 0;
  /** The table as last described by its host (kept while hosting moves). */
  private lastTable: TableInfo | null = null;
  /** This tab gave up its seat to the same player's newer tab and now watches. */
  private watchOnly = false;
  /** Who played the seat when this tab asked for it back. */
  private claimFrom: string | null | undefined;

  constructor(
    private club: Club,
    readonly room: MeshRoom,
    readonly code: string,
    isHost: boolean,
    private who: Who,
    private isPrivate: boolean,
    readonly spectating = false,
  ) {
    this.hosting = isHost;
    this.unsub = room.onPeers(() => this.update());
  }

  get isHost() {
    return this.hosting;
  }

  /** Who this tab's player is (StartSeat pid / dev / uid). */
  myKey(): SeatKey {
    return { pid: tabPid(), dev: deviceKey(), uid: this.club.uid ?? undefined };
  }

  async init(info: TableInfo | null) {
    this.info = info;
    const k = this.myKey();
    await this.room
      .presence({ who: this.who, role: this.isHost ? 'host' : this.spectating ? 'spectator' : 'player', pid: k.pid, dev: k.dev, uid: k.uid ?? null, table: info as unknown as Record<string, unknown> })
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

  /** The host: the newest of the tabs saying so (hosting can move mid-game; `he` counts the moves). */
  private hostPeer(): RoomPeer | undefined {
    let best: RoomPeer | undefined;
    for (const p of this.room.peers()) {
      if (p.presence?.role !== 'host') continue;
      if (this.hosting ? p.isMe && p.sameTab : !best || (Number(p.presence?.he) || 0) > (Number(best.presence?.he) || 0)) best = p;
    }
    return best;
  }

  /** The table as the host describes it (while hosting moves to another player, as last seen). */
  table(): TableInfo | null {
    if (this.isHost) return this.info;
    const t = this.hostPeer()?.presence?.table as TableInfo | undefined;
    if (t && Array.isArray(t.seats) && t.cfg) return (this.lastTable = t);
    return this.lastTable?.start ? this.lastTable : null;
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
    // Watchers, and anyone who arrived after the seats were filled and the game began
    // (a player coming back to their own seat is not watching).
    const t = this.table();
    const seats = t?.start?.seats ?? [];
    return this.room
      .peers()
      .filter((p) => p.presence?.role === 'spectator' || (!!t?.start && p.presence?.role === 'player' && !t.seats.includes(p.peer) && !seats.some((x) => x.kind === 'human' && samePlayer(x, keyOfPeer(p)))))
      .map(whoOf);
  }

  /** The label playing seat `s` now: the latest player the host gave it back to, else who sat down at the start. */
  private seatLabel(s: number): string | null {
    const play = this.hostPeer()?.presence?.play as { back?: { s: number; h: number; p: string }[] } | undefined;
    let best: { h: number; p: string } | null = null;
    for (const b of Array.isArray(play?.back) ? play.back : []) if (b && b.s === s && typeof b.p === 'string' && (!best || b.h >= best.h)) best = b;
    return best?.p ?? this.table()?.start?.seats[s]?.peer ?? null;
  }

  /**
   * Arriving at a game under way: the seat this player held (this tab before a reload, or the same
   * person from a new tab, after closing the browser, or from another device), else -1. A seat whose
   * player is away comes first; a seat still played from another tab is taken over from it (the newer
   * tab wins). The seat the host plays is never taken from the host's page.
   */
  returnSeat(): number {
    const start = this.table()?.start;
    if (!start || this.isHost || this.spectating || this.watchOnly) return -1;
    const me = this.myPeer;
    const key = this.myKey();
    const peers = this.room.peers();
    const host = this.hostPeer()?.peer;
    let best = -1;
    let bestRank = 0;
    start.seats.forEach((x, i) => {
      if (x.kind !== 'human') return;
      const label = this.seatLabel(i);
      const sure = !!me && label === me ? 3 : samePlayer(x, key);
      if (!sure || (label && label === host)) return;
      const away = !label || !peers.some((p) => p.peer === label);
      const rank = sure * 2 + (away ? 1 : 0);
      if (rank > bestRank) {
        best = i;
        bestRank = rank;
      }
    });
    return best;
  }

  /** The same player is at this table in another tab that hosts it (that seat is never taken from the host's page). */
  hostIsMe(): boolean {
    const host = this.hostPeer();
    return !this.isHost && !!host && !(host.isMe && host.sameTab) && samePlayer(keyOfPeer(host), this.myKey()) > 0;
  }

  /** Tell the host this tab is back and claims `seat` (the host hands it to an AI at once, and back at the next hand). */
  markRejoining(seat: number) {
    this.claimFrom = this.seatLabel(seat);
    void this.room.presence({ role: 'player', play: { rejoin: 1, seat, at: Date.now() } }).catch(() => {});
  }

  /** The same player took this tab's seat from a newer tab: from now on this tab only watches. */
  watchHere() {
    this.watchOnly = true;
    void this.room.presence({ role: 'spectator', play: null }).catch(() => {});
  }

  /** The seat went to another tab of the same player that asked after this one did (the newer claim won). */
  seatMovedOn(seat: number): boolean {
    const label = this.seatLabel(seat);
    return this.claimFrom !== undefined && !!label && label !== this.myPeer && label !== this.claimFrom;
  }

  /** The hand from which the host gives this tab its seat back, once the host has noticed it (only a return after the seat's last takeover counts). */
  rejoinHand(seat: number): number | null {
    const play = this.hostPeer()?.presence?.play as { back?: { s: number; h: number; p: string }[]; to?: { s: number; h: number; i: number }[] } | undefined;
    const me = this.myPeer;
    let after = -1;
    for (const t of Array.isArray(play?.to) ? play.to : []) if (t && t.s === seat && typeof t.h === 'number') after = Math.max(after, t.h);
    let hand: number | null = null;
    for (const b of Array.isArray(play?.back) ? play.back : []) if (b && b.s === seat && b.p === me && typeof b.h === 'number' && b.h > after) hand = Math.max(hand ?? -1, b.h);
    return hand;
  }

  /** How this tab reaches the table: the room link, the shared store, or neither. */
  links(): LinkStatus {
    return this.room.status();
  }

  hostPresent() {
    return this.isHost || !!this.hostPeer();
  }

  /** The host left mid-game and this tab's link took over hosting. */
  private promote(epoch: number) {
    if (this.left) return;
    const t = this.table();
    if (!t) return;
    this.hosting = true;
    this.epoch = epoch;
    this.info = t;
    void this.room.presence({ role: 'host', he: epoch, table: t as unknown as Record<string, unknown> }).catch(() => {});
    this.update();
  }

  /** Another tab hosts now (this one was cut off while hosting moved): sit at the table as a player again. */
  stepDown() {
    if (!this.hosting) return;
    this.lastTable = this.info;
    this.hosting = false;
    this.club.advertise(null);
    void this.room.presence({ role: 'player', he: null, table: null, play: null }).catch(() => {});
    this.update();
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
      if (s) {
        const p = this.room.peers().find((x) => x.peer === s.peer);
        const k = p ? keyOfPeer(p) : {};
        return { kind: 'human', name: s.who.name, peer: s.peer, avatar: s.who.avatar, pid: k.pid, dev: k.dev, uid: k.uid };
      }
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
    // A reload brings the host back to the table (as a player: hosting has moved on by then).
    rememberTable(this.code);
    await this.room.presence({ table: this.info as unknown as Record<string, unknown> }).catch(() => {});
    this.advertise();
    this.update();
  }

  /** The lockstep link for a started game. */
  link(): RoomLink | null {
    const t = this.table();
    const hp = this.hostPeer();
    const host = this.isHost ? this.myPeer : hp?.peer;
    if (!t?.start || !host) return null;
    this.lastLink?.close();
    const link = new RoomLink(
      this.room,
      t.start.seats.map((s) => (s.kind === 'human' ? s.peer ?? null : null)),
      host,
      this.isHost,
      t.start.seats.map((s) => (s.kind === 'human' ? { pid: s.pid, dev: s.dev, uid: s.uid } : null)),
      this.isHost ? this.epoch : Number(hp?.presence?.he) || 0,
    );
    link.onPromote = (epoch) => this.promote(epoch);
    return (this.lastLink = link);
  }

  /** The host has ended the game (finished or left). */
  hostOver() {
    return !!(this.hostPeer()?.presence?.play as { over?: 1 } | undefined)?.over;
  }

  /** Latest hand-start snapshot from the host (late spectators). */
  hostSnapshot() {
    const play = this.hostPeer()?.presence?.play as { hs?: { h: number; round: unknown; scores: number[]; pot: number; goulash?: 1 }; over?: 1 } | undefined;
    return play?.hs ?? null;
  }

  async leave() {
    if (this.left) return;
    this.left = true;
    rememberTable(null);
    this.unsub();
    this.lastLink?.close();
    if (this.isHost) this.club.advertise(null);
    if (this.isHost && this.info?.start && this.lastLink?.finished) {
      // Stay in the room a little while (play marked over) so players still
      // finishing the last hand can read the host's final decisions.
      await new Promise((r) => setTimeout(r, 15000));
    }
    await this.room.leave().catch(() => {});
  }
}
