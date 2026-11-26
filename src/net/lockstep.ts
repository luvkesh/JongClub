// Multiplayer lockstep over the artifact `room` capability.
//
// Every client runs the same deterministic engine from the same match seed.
// AI seats are computed locally (their decisions are seeded), so the only
// thing that travels is each human's own decisions. Each player publishes
// their decisions for the current hand in their presence; the host also
// mirrors every human decision it has applied, so nothing is lost if a
// presence update is missed. If a player leaves, the host hands their seat
// to an AI at an agreed point and every client follows.
//
// Presence is used instead of events because every viewer may set
// presence, while event topics need edit rights.

import type { MahjongGame } from '../engine/game';
import type { RoundState } from '../engine/rounds';
import type { ClaimResponse } from '../engine/state';
import type { Action } from './actions';
import type { NamedRoom, RoomPeer } from './room';
import { isTableSignal } from './etiquette';

export interface LockstepLink {
  /** Share one of your own seat's decisions. */
  publish(hand: number, index: number, a: Action): void;
  /** The decision `seat` made at (hand, index), or 'ai' once that seat was handed to an AI. */
  next(seat: number, hand: number, index: number): Promise<Action | 'ai'>;
  react(emoji: string): void;
  /** The table has already moved past (hand, index): play AI moves without pauses to catch up. */
  behind(hand: number, index: number): boolean;
  onReaction(fn: (seat: number, emoji: string) => void): void;
  /** A hand began (the host publishes scores so late spectators can join). */
  handStarted(hand: number, g: MahjongGame): void;
  /** This tab referees the table (hosting moves to another player if it leaves). */
  readonly isHost: boolean;
  /** Host: another player at the table could take over hosting if this tab left. */
  canHandOver?(): boolean;
  /** Host: hand a seat to an AI after this long without its player's decision (ms; 0 = never). */
  stallMs?: number;
  /** Seats a returning player takes again from the start of `hand` (they had been handed to an AI). */
  returning(hand: number): number[];
  /** Resolves once the host has started `hand` (or the link closed), so every client agrees who sits where. */
  handReady(hand: number): Promise<void>;
  /** Whether `seat` is played by an AI at (hand, index), after the host handed it over. */
  aiAt(seat: number, hand: number, index: number): boolean;
  /** `finished`: the game reached its end here (a host keeps its log up, marked over, for the others). */
  close(finished?: boolean): void;
}

// ---------------------------------------------------------------- compact encoding

const CLAIM: Record<string, string> = { win: 'w', pung: 'u', kong: 'k', chow: 'c', buy: 'b' };
const CLAIM_BACK: Record<string, ClaimResponse['type']> = { w: 'win', u: 'pung', k: 'kong', c: 'chow', b: 'buy' };

export function encodeAction(a: Action): string {
  switch (a.t) {
    case 'd':
      return `d${a.s}.${a.id}${a.r ? 'r' : ''}`;
    case 'w':
      return `w${a.s}`;
    case 'k':
      return `k${a.s}.${a.k}`;
    case 'g':
      return `l${a.s}.${a.m ?? '-'}.${a.ids.join('.')}`;
    case 'j':
      return `j${a.s}.${a.o}.${a.m}.${a.id}`;
    case 'c':
      if (a.r.type === 'pass') return `c${a.s}p`;
      return `c${a.s}${CLAIM[a.r.type]}${a.r.using ? '.' + a.r.using.join('.') : ''}`;
    case 'cp':
      return `p${a.s}.${a.ids.join('.')}`;
    case 'cv':
      return `v${a.s}${a.v}`;
    case 'gx':
      return `g${a.s}.${a.p}.${a.w}`;
    case 'wx':
      return `x${a.s}.${a.ids.join('.')}`;
    case 'tt':
      return `t${a.s}.${a.ids.join('.')}`;
    case 'sc':
      return `q${a.s}.${a.c}`;
    case 'rc':
      return `r${a.s}.${a.c}`;
    case 'a':
      return `a${a.s}`;
    case 'n':
      return `n${a.s}`;
  }
}

export function decodeAction(code: string): Action | null {
  const t = code[0];
  const s = Number(code[1]);
  if (!(s >= 0 && s < 4)) return null;
  const rest = code.slice(2);
  const nums = (x: string) => x.split('.').filter(Boolean).map(Number);
  switch (t) {
    case 'd': {
      const r = rest.endsWith('r');
      const id = Number((r ? rest.slice(0, -1) : rest).slice(1));
      return r ? { t: 'd', s, id, r: 1 } : { t: 'd', s, id };
    }
    case 'w':
      return { t: 'w', s };
    case 'k':
      return { t: 'k', s, k: Number(rest.slice(1)) };
    case 'l': {
      const [m, ...ids] = rest.slice(1).split('.');
      return m === '-' ? { t: 'g', s, ids: ids.map(Number) } : { t: 'g', s, ids: ids.map(Number), m: Number(m) };
    }
    case 'j': {
      const [o, m, id] = nums(rest);
      return { t: 'j', s, o, m, id };
    }
    case 'c': {
      if (rest === 'p') return { t: 'c', s, r: { type: 'pass' } };
      const type = CLAIM_BACK[rest[0]];
      if (!type || type === 'pass') return null;
      const using = nums(rest.slice(1));
      return { t: 'c', s, r: using.length ? { type, using } : { type } } as Action;
    }
    case 'p':
      return { t: 'cp', s, ids: nums(rest) };
    case 'v':
      return { t: 'cv', s, v: rest === '1' ? 1 : 0 };
    case 'g': {
      const [p, w] = nums(rest);
      const ok = (n: number): n is 0 | 1 | 3 => n === 0 || n === 1 || n === 3;
      return ok(p) && ok(w) ? { t: 'gx', s, p, w } : null;
    }
    case 'x':
      return { t: 'wx', s, ids: nums(rest) };
    case 't':
      return { t: 'tt', s, ids: nums(rest) };
    case 'q': {
      const [c] = nums(rest);
      return c >= 0 ? { t: 'sc', s, c } : null;
    }
    case 'r': {
      const [c] = nums(rest);
      return c >= 0 ? { t: 'rc', s, c } : null;
    }
    case 'a':
      return { t: 'a', s };
    case 'n':
      return { t: 'n', s };
  }
  return null;
}

// ---------------------------------------------------------------- presence shapes

/** What each player at a running table publishes. */
export interface PlayPresence {
  /** Hand number and this hand's decisions as "index:code". */
  h?: number;
  log?: string[];
  /** The previous hand, kept briefly for anyone still finishing it. */
  ph?: number;
  plog?: string[];
  /** Host: seats handed to an AI, from (hand, index) on. */
  to?: { s: number; h: number; i: number }[];
  /** Host: the position at the start of hand `h`, for spectators who arrive late. */
  hs?: { h: number; round: RoundState; scores: number[]; pot: number; /** American goulash hand (jokers may pass). */ goulash?: 1 };
  /** Latest reaction and a counter so repeats are noticed. */
  re?: { e: string; n: number };
  /** Host: the game is over here (finished or abandoned); nothing more will be published. */
  over?: 1;
  /** Host: a player who left came back as peer `p`; they take seat `s` again from the start of hand `h` (`at`: when they asked). */
  back?: { s: number; h: number; p: string; at?: number }[];
  /** A player back at the table (page reloaded, a new tab, another device) who waits to be given their seat again. */
  rejoin?: 1;
  /** The seat a returning player claims, and when they asked (a newer claim takes over an older one). */
  seat?: number;
  at?: number;
}

/** Who sat in a seat: their tab's rejoin key, this browser's key and their claude.ai user id (each when known). */
export interface SeatKey {
  pid?: string;
  dev?: string;
  uid?: string;
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

/** A peer's identity: the platform's user id (`by`) when it vouches for one, else what the page says. */
export function keyOfPeer(p: Pick<RoomPeer, 'by' | 'presence'>): SeatKey {
  const pr = p.presence ?? {};
  return { pid: str(pr.pid), dev: str(pr.dev), uid: str(p.by) ?? str(pr.uid) };
}

/**
 * How surely `k` is the person who sat in `seat`: 3 the same tab, 2 the same claude.ai user,
 * 1 the same browser (no user ids to compare), 0 someone else. Two different user ids never match.
 */
export function samePlayer(seat: SeatKey | null | undefined, k: SeatKey): 0 | 1 | 2 | 3 {
  if (!seat) return 0;
  if (seat.uid && k.uid && seat.uid !== k.uid) return 0;
  if (seat.pid && k.pid === seat.pid) return 3;
  if (seat.uid && k.uid) return 2;
  return seat.dev && k.dev === seat.dev ? 1 : 0;
}

const seatKeyOf = (v: SeatKey | string | null | undefined): SeatKey | null => (!v ? null : typeof v === 'string' ? { pid: v } : v);

/** After the host has been gone this long, the next player in seat order takes over hosting. */
export const PROMOTE_MS = 3000;
/** Others wait this long for a new host before the game ends. */
const NEW_HOST_WAIT_MS = 20000;

interface Entry {
  hand: number;
  index: number;
  action: Action;
}

function entriesOf(p: PlayPresence): Entry[] {
  const out: Entry[] = [];
  const read = (hand: number | undefined, log: string[] | undefined) => {
    if (hand === undefined || !Array.isArray(log)) return;
    for (const e of log) {
      if (typeof e !== 'string') continue;
      const k = e.indexOf(':');
      const index = Number(e.slice(0, k));
      const action = decodeAction(e.slice(k + 1));
      if (action && index >= 0) out.push({ hand, index, action });
    }
  };
  read(p.h, p.log);
  read(p.ph, p.plog);
  return out;
}

/**
 * Whether a seat is played by an AI at (hand, index): the host's latest takeover at or before that
 * point stands, unless the player came back at the start of a later hand.
 */
export function isAiAt(takeovers: readonly { s: number; h: number; i: number }[], backs: readonly { s: number; h: number }[], seat: number, hand: number, index: number): boolean {
  let take: { h: number; i: number } | null = null;
  for (const t of takeovers) if (t.s === seat && (t.h < hand || (t.h === hand && t.i <= index)) && (!take || t.h > take.h || (t.h === take.h && t.i > take.i))) take = t;
  if (!take) return false;
  return !backs.some((b) => b.s === seat && b.h > take!.h && b.h <= hand);
}

/** Bytes of `play` presence we allow ourselves (who + table use the rest of the 4 KiB). */
const PLAY_BUDGET = 2600;

/** Lockstep link for one running table. */
export class RoomLink implements LockstepLink {
  private mine: PlayPresence = {};
  private mirror = new Map<string, string>();
  private waiters: { seat: number; hand: number; index: number; since: number; resolve: (a: Action | 'ai') => void }[] = [];
  /**
   * Host: hand a seat to an AI when its player is still at the table but has not decided for this long
   * (their tab froze or slept, so their own clock never ran out). 0 = never.
   */
  stallMs = 0;
  private reactFns: ((seat: number, emoji: string) => void)[] = [];
  private seenReact = new Map<string, number>();
  private takeovers: { s: number; h: number; i: number }[] = [];
  private backs: { s: number; h: number; p: string; at?: number }[] = [];
  private seatKeys: (SeatKey | null)[];
  private claimSeen = new Map<string, number>();
  /** The host's last play presence as this guest saw it (a new host carries it on). */
  private lastHost: PlayPresence = {};
  /** The latest hand this client started. */
  private curHand = 0;
  /** This tab ended because the game finished. */
  finished = false;
  /** Guests: the host left and this tab now hosts (the session updates its presence). */
  onPromote?: (epoch: number) => void;
  /** Guests: the same, for the page (a note to the player). */
  onPromoted?: () => void;
  /** Host: another tab took over hosting while this one was cut off: step out and sit down again. */
  onDeposed?: () => void;
  private readyWaiters: { hand: number; resolve: () => void }[] = [];
  private goneSince = new Map<number, number>();
  private unsub: () => void;
  private tick: number;
  private closed = false;
  private hostEnded = false;
  onHostLost?: () => void;
  /**
   * Guests: this tab lost its seat, fired once: 'ai' when the host handed it to an AI (we were cut off or
   * away too long), 'moved' when the same player took it from another tab or device.
   */
  onSeatLost?: (why: 'ai' | 'moved') => void;
  private seatLost = false;
  /** Guests: the hand this client took its seat at (a takeover from then on means we lost it). */
  seatSince = 0;

  /**
   * @param seatPeers the room peer label sitting in each seat (null for AI seats)
   * @param hostPeer the host's peer label
   * @param iAmHost this tab is the host
   * @param seatPids who sat in each human seat (or just their tab's rejoin key), so the host can seat them again
   * @param epoch how many times hosting has moved (the host's `he`)
   */
  constructor(
    private room: NamedRoom,
    private seatPeers: (string | null)[],
    private hostPeer: string,
    private iAmHost: boolean,
    seatPids: (SeatKey | string | null)[] = [],
    private epoch = 0,
  ) {
    this.seatKeys = seatPids.map(seatKeyOf);
    this.unsub = room.onPeers(() => this.check());
    // A slow heartbeat notices departures even when nothing else changes.
    this.tick = window.setInterval(() => this.check(), 1000);
  }

  private push() {
    if (this.closed) return;
    const p: PlayPresence = { ...this.mine };
    if (this.iAmHost && this.mirror.size) {
      // Hosts publish everyone's decisions for the current and previous hand:
      // guests and spectators only ever take a decision from the host, so a
      // seat handed to an AI can never split the table.
      const merge = (hand: number | undefined, log: string[] | undefined) => {
        if (hand === undefined) return log;
        const all = new Map<string, string>();
        for (const e of log ?? []) all.set(e.slice(0, e.indexOf(':')), e);
        for (const [k, v] of this.mirror) if (k.startsWith(`${hand}/`)) all.set(k.slice(k.indexOf('/') + 1), v);
        return [...all.values()].sort((a, b) => parseInt(a) - parseInt(b));
      };
      p.log = merge(p.h, p.log);
      p.plog = merge(p.ph, p.plog);
    }
    // Presence is capped at 4 KiB in all (who and the table ride along), so the
    // previous hand goes first when a long hand (American with Charleston) needs the room.
    if (JSON.stringify(p).length > PLAY_BUDGET) {
      delete p.ph;
      delete p.plog;
    }
    void this.room.presence({ play: p as unknown as Record<string, unknown> }).catch(() => {});
  }

  publish(hand: number, index: number, a: Action) {
    const e = `${index}:${encodeAction(a)}`;
    if (this.mine.h !== hand) {
      this.mine.ph = this.mine.h;
      this.mine.plog = this.mine.log;
      this.mine.h = hand;
      this.mine.log = [];
    }
    this.mine.log!.push(e);
    this.push();
  }

  next(seat: number, hand: number, index: number): Promise<Action | 'ai'> {
    return new Promise((resolve) => {
      this.waiters.push({ seat, hand, index, since: Date.now(), resolve });
      this.check();
    });
  }

  behind(hand: number, index: number) {
    if (this.iAmHost || this.closed) return false;
    const host = this.room.peers().find((p) => p.peer === this.hostPeer);
    const play = (host?.presence?.play ?? {}) as PlayPresence;
    if (typeof play.h === 'number' && play.h > hand) return true;
    return play.h === hand && entriesOf(play).some((e) => e.hand === hand && e.index > index);
  }

  react(emoji: string) {
    const n = (this.mine.re?.n ?? 0) + 1;
    this.mine.re = { e: emoji, n };
    this.push();
  }

  onReaction(fn: (seat: number, emoji: string) => void) {
    this.reactFns.push(fn);
  }

  handStarted(hand: number, g: MahjongGame) {
    this.curHand = Math.max(this.curHand, hand);
    // Keep only the current and previous hand in presence.
    if (this.mine.h !== hand) {
      this.mine.ph = this.mine.h;
      this.mine.plog = this.mine.log;
      this.mine.h = hand;
      this.mine.log = [];
    }
    for (const k of [...this.mirror.keys()]) if (Number(k.split('/')[0]) < hand - 1) this.mirror.delete(k);
    if (this.iAmHost) {
      this.mine.hs = { h: hand, round: g.state.round, scores: g.players.map((p) => p.score), pot: g.state.riichiPot };
      if (g.state.goulash) this.mine.hs.goulash = 1;
    }
    this.push();
  }

  close(finished = false) {
    if (this.closed) return;
    this.finished = finished;
    // A host whose game finished keeps its log up (marked over) so anyone still finishing the
    // last hand can; the room itself is left a little later (TableSession.leave). A host who
    // leaves mid-game just goes: the next player takes over hosting (check).
    if (this.iAmHost && finished) {
      this.mine.over = 1;
      this.push();
    }
    this.closed = true;
    this.unsub();
    window.clearInterval(this.tick);
    for (const w of this.waiters) w.resolve('ai');
    this.waiters = [];
    for (const r of this.readyWaiters) r.resolve();
    this.readyWaiters = [];
    if (!this.iAmHost) void this.room.presence({ play: null }).catch(() => {});
  }

  get isHost() {
    return this.iAmHost;
  }

  get isClosed() {
    return this.closed;
  }

  returning(hand: number) {
    this.readHost();
    return [...new Set(this.backs.filter((b) => b.h === hand).map((b) => b.s))];
  }

  handReady(hand: number): Promise<void> {
    if (this.iAmHost || this.closed) return Promise.resolve();
    return new Promise((resolve) => {
      this.readyWaiters.push({ hand, resolve });
      this.check();
    });
  }

  aiAt(seat: number, hand: number, index: number) {
    this.readHost();
    return isAiAt(this.takeovers, this.backs, seat, hand, index);
  }

  /** The peer label playing `seat` at `hand` (a returning player's new label from their hand on). */
  private labelOf(seat: number, hand = Infinity): string | null {
    let best: { h: number; p: string } | null = null;
    for (const b of this.backs) if (b.s === seat && b.h <= hand && (!best || b.h >= best.h)) best = b;
    return best ? best.p : this.seatPeers[seat];
  }

  private peerOf(seat: number, hand = Infinity): RoomPeer | undefined {
    const label = this.labelOf(seat, hand);
    return label ? this.room.peers().find((p) => p.peer === label) : undefined;
  }

  /**
   * The seat's player is back at the table after a reload and waiting to sit down again (they can't
   * decide now, so the seat goes to an AI at once). A flag left over from a return already granted doesn't count.
   */
  private rejoining(seat: number, hand: number) {
    // The seat is promised to the same player in another tab from a later hand: an AI plays it until then.
    const cur = this.labelOf(seat, hand);
    if (this.backs.some((b) => b.s === seat && b.h > hand && b.p !== cur)) return true;
    const p = this.peerOf(seat, hand);
    if (!(p?.presence?.play as PlayPresence | undefined)?.rejoin) return false;
    return !this.backs.some((b) => b.s === seat && b.p === p!.peer && b.h <= hand);
  }

  /** Guests follow the host's takeovers and returns. */
  private readHost() {
    if (this.iAmHost) return;
    const host = this.room.peers().find((p) => p.peer === this.hostPeer);
    const hostPlay = (host?.presence?.play ?? {}) as PlayPresence;
    if (Array.isArray(hostPlay.to)) this.takeovers = hostPlay.to.filter((t) => t && typeof t.s === 'number');
    if (Array.isArray(hostPlay.back)) this.backs = hostPlay.back.filter((b) => b && typeof b.s === 'number' && typeof b.h === 'number' && typeof b.p === 'string');
    if (host && typeof hostPlay.h === 'number') this.lastHost = hostPlay;
  }

  /**
   * Host: a player asks for their seat again (their page reloaded, or they opened the table in a new
   * tab or on another device): give it to them from the next hand. The claim names the seat and must
   * come from the same person (samePlayer). A newer claim takes over an older one, even from a tab
   * still playing; the host's own seat is never handed away.
   */
  private seatReturners(peers: readonly RoomPeer[]) {
    if (!this.iAmHost) return;
    const next = (this.mine.h ?? -1) + 1;
    const me = this.myLabel(peers);
    let changed = false;
    for (const p of peers) {
      const play = p.presence?.play as PlayPresence | undefined;
      const s = play?.seat;
      if (!play?.rejoin || typeof s !== 'number' || (p.isMe && p.sameTab) || p.presence?.role !== 'player') continue;
      if (!samePlayer(this.seatKeys[s], keyOfPeer(p))) continue;
      const cur = this.labelOf(s);
      if (!cur || cur === me || this.backs.some((b) => b.s === s && b.p === p.peer && b.h === next)) continue;
      // A claim counts from when this host first saw it (one clock for every claim).
      const ck = `${p.peer}:${Number(play.at) || 0}`;
      const at = this.claimSeen.get(ck) ?? Date.now();
      this.claimSeen.set(ck, at);
      if (cur === p.peer) {
        // The same tab, back after its connection dropped (or it was away) for too long.
        if (!isAiAt(this.takeovers, this.backs, s, Infinity, Infinity)) continue;
      } else if (this.backs.some((b) => b.s === s && b.p !== p.peer && (b.at ?? 0) >= at && b.p === cur)) continue; // an older claim
      this.backs = this.backs.filter((b) => !(b.s === s && b.h >= next));
      this.backs.push({ s, h: next, p: p.peer, at });
      changed = true;
    }
    if (changed) {
      this.mine.back = this.backs.slice(-8);
      this.push();
    }
  }

  private myLabel(peers = this.room.peers()) {
    return peers.find((p) => p.isMe && p.sameTab)?.peer ?? null;
  }

  /** The seat `label` plays at `hand`, or -1. */
  private seatOfLabel(label: string | null, hand = this.curHand) {
    return label ? this.seatPeers.findIndex((_, s) => this.labelOf(s, hand) === label) : -1;
  }

  /**
   * Who hosts if the host goes: the first seat in seat order (not the host's) whose player is at the
   * table and playing it, not an AI. Every client works it out the same way from the host's last word.
   */
  successor(peers = this.room.peers()): string | null {
    const hostSeat = this.seatOfLabel(this.hostPeer);
    for (let s = 0; s < this.seatPeers.length; s++) {
      if (s === hostSeat) continue;
      const label = this.labelOf(s, this.curHand);
      if (!label || label === this.hostPeer || isAiAt(this.takeovers, this.backs, s, this.curHand, Infinity)) continue;
      if (peers.some((p) => p.peer === label)) return label;
    }
    return null;
  }

  canHandOver() {
    return this.successor() !== null;
  }

  /** The host left mid-game: this tab carries the table on from the host's last published state. */
  private promote(peers: readonly RoomPeer[]) {
    const me = this.myLabel(peers);
    if (!me) return;
    const old = this.lastHost;
    const hands = new Map<number, Map<string, string>>();
    const add = (h: number | undefined, log: string[] | undefined) => {
      if (typeof h !== 'number' || !Array.isArray(log)) return;
      const m = hands.get(h) ?? new Map<string, string>();
      hands.set(h, m);
      for (const e of log) {
        if (typeof e !== 'string') continue;
        const k = e.slice(0, e.indexOf(':'));
        if (!m.has(k)) m.set(k, e);
      }
    };
    add(old.h, old.log);
    add(old.ph, old.plog);
    add(this.mine.h, this.mine.log);
    add(this.mine.ph, this.mine.plog);
    const sorted = (h: number) => [...(hands.get(h)?.values() ?? [])].sort((a, b) => parseInt(a) - parseInt(b));
    const top = Math.max(this.curHand, ...hands.keys());
    const prev = hands.has(top - 1) ? top - 1 : undefined;
    this.mine = { h: top, log: sorted(top), ...(prev !== undefined ? { ph: prev, plog: sorted(prev) } : {}), ...(this.mine.re ? { re: this.mine.re } : {}) };
    if (this.takeovers.length) this.mine.to = this.takeovers;
    if (this.backs.length) this.mine.back = this.backs.slice(-8);
    if (old.hs) this.mine.hs = old.hs;
    this.iAmHost = true;
    this.epoch += 1;
    this.hostPeer = me;
    this.goneSince.clear();
    for (const w of this.waiters) w.since = Date.now();
    this.onPromote?.(this.epoch);
    this.push();
    this.onPromoted?.();
  }

  /** A newer host (hosting moved while this tab was cut off), or the lower seat of two that took over at once. */
  private newerHost(peers: readonly RoomPeer[]): RoomPeer | undefined {
    let best: RoomPeer | undefined;
    let bestHe = this.epoch;
    let bestSeat = this.iAmHost ? this.seatOfLabel(this.myLabel(peers)) : this.seatOfLabel(this.hostPeer);
    for (const p of peers) {
      if (p.peer === this.hostPeer || (p.isMe && p.sameTab) || p.presence?.role !== 'host') continue;
      const he = Number(p.presence?.he) || 0;
      const seat = this.seatOfLabel(p.peer);
      if (he > bestHe || (he === bestHe && he > 0 && seat >= 0 && (bestSeat < 0 || seat < bestSeat))) {
        best = p;
        bestHe = he;
        bestSeat = seat;
      }
    }
    return best;
  }

  private check() {
    if (this.closed) return;
    const peers = this.room.peers();
    const newer = this.newerHost(peers);
    if (newer) {
      if (this.iAmHost) {
        // Two tabs hosting: this one was cut off, or took over at the same moment from a higher seat. Step out.
        this.iAmHost = false;
        this.close();
        this.onDeposed?.();
        return;
      }
      this.hostPeer = newer.peer;
      this.epoch = Number(newer.presence?.he) || 0;
      this.goneSince.delete(-1);
    }
    const host = peers.find((p) => p.peer === this.hostPeer);
    const hostPlay = (host?.presence?.play ?? {}) as PlayPresence;
    if (hostPlay.over) this.hostEnded = true;
    this.readHost();
    this.seatReturners(peers);
    if (!this.iAmHost && !this.seatLost && this.onSeatLost) {
      const me = this.myLabel(peers);
      const seat = this.seatOfLabel(me, this.seatSince);
      const moved = seat >= 0 && this.backs.some((b) => b.s === seat && b.p !== me && b.h > this.seatSince);
      if (seat >= 0 && (moved || this.takeovers.some((t) => t.s === seat && t.h >= this.seatSince))) {
        this.seatLost = true;
        this.onSeatLost(moved ? 'moved' : 'ai');
        return;
      }
    }
    for (const r of [...this.readyWaiters]) {
      if (this.iAmHost || hostPlay.over || (typeof hostPlay.h === 'number' && hostPlay.h >= r.hand)) {
        this.readyWaiters = this.readyWaiters.filter((x) => x !== r);
        r.resolve();
      }
    }

    // Reactions.
    this.seatPeers.forEach((_, seat) => {
      const label = this.labelOf(seat);
      if (!label) return;
      const p = peers.find((x) => x.peer === label);
      const re = (p?.presence?.play as PlayPresence | undefined)?.re;
      if (!re || p?.isMe) return;
      const last = this.seenReact.get(label) ?? 0;
      // Only the preset reactions and phrases (src/net/etiquette.ts): never free text.
      if (re.n > last && isTableSignal(re.e)) {
        this.seenReact.set(label, re.n);
        if (last > 0 || re.n === 1) for (const fn of this.reactFns) fn(seat, re.e);
      }
    });

    for (const w of [...this.waiters]) {
      // Handed to an AI at or before this point?
      if (isAiAt(this.takeovers, this.backs, w.seat, w.hand, w.index)) {
        this.resolve(w, 'ai');
        continue;
      }
      // The host reads each player's own presence; everyone else reads only
      // what the host has applied (its mirror), so all clients agree.
      const sources = [this.iAmHost ? this.peerOf(w.seat, w.hand) : host].filter(Boolean) as RoomPeer[];
      let found: Action | null = null;
      for (const src of sources) {
        const play = (src.presence?.play ?? {}) as PlayPresence;
        const e = entriesOf(play).find((x) => x.hand === w.hand && x.index === w.index && x.action.s === w.seat);
        if (e) {
          found = e.action;
          break;
        }
      }
      if (found) {
        if (this.iAmHost) {
          this.mirror.set(`${w.hand}/${w.index}`, `${w.index}:${encodeAction(found)}`);
          this.push();
        }
        this.resolve(w, found);
        continue;
      }
      // Hosts hand a departed (or long-stalled) player's seat to an AI after a short grace period.
      if (this.iAmHost && this.stallMs > 0 && Date.now() - w.since > this.stallMs) {
        this.takeovers.push({ s: w.seat, h: w.hand, i: w.index });
        this.mine.to = this.takeovers;
        this.push();
        this.resolve(w, 'ai');
      } else if (this.iAmHost && (this.rejoining(w.seat, w.hand) || !this.peerOf(w.seat, w.hand))) {
        const since = this.goneSince.get(w.seat) ?? Date.now();
        this.goneSince.set(w.seat, since);
        if (Date.now() - since > 6000 || this.rejoining(w.seat, w.hand)) {
          this.takeovers.push({ s: w.seat, h: w.hand, i: w.index });
          this.mine.to = this.takeovers;
          this.push();
          this.resolve(w, 'ai');
        }
      } else this.goneSince.delete(w.seat);
    }

    // Host gone mid-game: the next player in seat order takes over hosting (every client
    // agrees who from the host's last word); with nobody to take over, the game ends.
    // A host that ended the game (over) is lost once we wait on a decision it never sent.
    const hostOver = !!hostPlay.over && this.waiters.length > 0;
    // A host who finished the game may leave while we read the last result; that is not a loss.
    const hostGone = !host && (!this.hostEnded || this.waiters.length > 0);
    if (!this.iAmHost && this.room.connected() && peers.length > 0 && (hostGone || hostOver)) {
      const since = this.goneSince.get(-1) ?? Date.now();
      this.goneSince.set(-1, since);
      const heir = hostGone && !this.hostEnded ? this.successor(peers) : null;
      if (heir && heir === this.myLabel(peers)) {
        if (Date.now() - since > PROMOTE_MS) this.promote(peers);
        return;
      }
      if (Date.now() - since > (host ? 2000 : heir ? NEW_HOST_WAIT_MS : 8000)) {
        this.onHostLost?.();
        this.close();
        return;
      }
    } else this.goneSince.delete(-1);
  }

  private resolve(w: (typeof this.waiters)[number], v: Action | 'ai') {
    this.waiters = this.waiters.filter((x) => x !== w);
    w.resolve(v);
  }
}
