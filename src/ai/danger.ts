// Defence model for the Asian variants: how likely each tile is to win
// for each opponent, and how threatening each opponent looks.
//
// Everything here reads only what a player at the table could see:
// discards, exposed melds, riichi sticks, dora indicators and the wall
// count. It never looks at hidden hands, the wall order or furiten flags.
// Nothing here is random, so it is safe for replays and lockstep play.

import type { MahjongGame } from '../engine/game';
import { KIND_COUNT, WIND_NAMES, isDragon, isHonor, tileName, windKind } from '../engine/tiles';
import { dealerTai } from '../engine/rules/taiwanese';
import { unseenCounts } from './evaluate';

/** Why a tile is (fairly) safe against one opponent. */
export type SafetyReason =
  /** They discarded it themselves. */
  | 'genbutsu'
  /** Someone let it go after their riichi and they did not win on it. */
  | 'passedRiichi'
  /** Someone let it go since their last discard and they did not take it. */
  | 'passed'
  /** Two-sided waits on it are ruled out by tiles they discarded. */
  | 'suji'
  /** Two-sided waits on it are ruled out because the tiles they need are all visible. */
  | 'kabe'
  /** Honour with every other copy visible. */
  | 'honourDead'
  /** Honour with only one copy unaccounted for. */
  | 'honourSeen'
  /** Close to tiles they threw away early. */
  | 'early'
  | 'none';

export interface OpponentRead {
  seat: number;
  /** Rough chance they are ready to win, 0..1. */
  tenpai: number;
  /** What dealing into them is likely to cost, relative to an ordinary hand (1). */
  value: number;
  /** tenpai × value: how much their danger counts. */
  threat: number;
  riichi: boolean;
  openMelds: number;
  /** Suit index (0 Characters, 1 Dots, 2 Bamboo) they seem to be collecting, or null. */
  flushSuit: number | null;
  dragonPungs: number;
  /** All exposed sets are pungs or kongs (two or more). */
  pungHand: boolean;
}

export interface TileDanger {
  /** Chance the tile wins for this opponent if they are ready, about 0..0.2. */
  hit: number;
  reason: SafetyReason;
  /** Tiles that justify the reason (suji partners, the visible wall tile). */
  via: number[];
}

export type ReadDepth = 'basic' | 'full';

const SUIT_LABEL = ['Characters', 'Dots', 'Bamboo'];
export const suitLabel = (s: number) => SUIT_LABEL[s];

/** Index of the claims-phase discard that is still being decided, so it is not "passed". */
function pendingDiscardIndex(game: MahjongGame): number {
  if (game.state.phase.kind !== 'claims') return -1;
  const log = game.state.log;
  for (let i = log.length - 1; i >= 0; i--) if (log[i].type === 'discard') return i;
  return -1;
}

export interface SafeSets {
  /** Kinds they discarded. */
  own: Set<number>;
  /** Kinds others discarded after their riichi. */
  afterRiichi: Set<number>;
  /** Kinds others discarded since their last discard. */
  sinceLast: Set<number>;
  /** The kind they declared riichi with, if any. */
  riichiKind: number | null;
  /** Their first few discards (before any riichi). */
  early: number[];
}

export function safeSets(game: MahjongGame, opp: number): SafeSets {
  const log = game.state.log;
  const pending = pendingDiscardIndex(game);
  const p = game.players[opp];
  const out: SafeSets = { own: new Set(p.discardKinds), afterRiichi: new Set(), sinceLast: new Set(), riichiKind: null, early: p.discardKinds.slice(0, 6) };
  let riichiAt = -1;
  let lastOwn = -1;
  for (let i = 0; i < log.length; i++) {
    const e = log[i];
    if (e.type !== 'discard' || e.seat !== opp) continue;
    lastOwn = i;
    if (e.riichi && riichiAt < 0) {
      riichiAt = i;
      out.riichiKind = e.tile.kind;
    }
  }
  for (let i = Math.max(0, Math.min(riichiAt < 0 ? Infinity : riichiAt, lastOwn < 0 ? Infinity : lastOwn)); i < log.length; i++) {
    const e = log[i];
    if (e.type !== 'discard' || e.seat === opp || i === pending) continue;
    if (riichiAt >= 0 && i > riichiAt) out.afterRiichi.add(e.tile.kind);
    if (lastOwn >= 0 && i > lastOwn) out.sinceLast.add(e.tile.kind);
  }
  if (riichiAt >= 0) {
    // Early reads only use discards made before the declaration.
    const before = log.slice(0, riichiAt).filter((e) => e.type === 'discard' && e.seat === opp).length;
    out.early = p.discardKinds.slice(0, Math.min(6, before));
  }
  return out;
}

const tw = (game: MahjongGame) => (game.profile.base ?? game.profile.id) === 'taiwanese';

/**
 * Taiwanese: chance an opponent is ready by open sets (rows, 0..4+) and
 * discards made (columns, 0..16), measured in self-play. Sixteen-tile hands
 * start about four tiles from ready, so nobody is close in the first few
 * turns, and closed hands catch up late.
 */
const TW_TENPAI = [
  [0, 0, 0, 0, 0.01, 0.02, 0.05, 0.08, 0.15, 0.22, 0.29, 0.32, 0.38, 0.5, 0.6, 0.7, 0.75],
  [0, 0, 0, 0, 0.02, 0.05, 0.1, 0.15, 0.19, 0.27, 0.32, 0.36, 0.37, 0.4, 0.49, 0.56, 0.6],
  [0, 0, 0, 0.03, 0.05, 0.1, 0.19, 0.26, 0.33, 0.39, 0.41, 0.42, 0.5, 0.56, 0.58, 0.58, 0.6],
  [0.3, 0.3, 0.3, 0.3, 0.32, 0.33, 0.34, 0.36, 0.38, 0.48, 0.55, 0.55, 0.55, 0.55, 0.55, 0.6, 0.6],
  [0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.78, 0.8, 0.8, 0.8, 0.8, 0.82, 0.85, 0.88, 0.9, 0.92, 0.95],
];

/** Concealed sets needed for a win in this profile (4, or 5 in Taiwanese). */
const setsNeeded = (game: MahjongGame) => game.profile.shapes.sets ?? 4;

/** What an ordinary winning hand is worth in this profile, in its own points. */
export function ordinaryPoints(game: MahjongGame): number {
  switch ((game.profile.base ?? game.profile.id)) {
    case 'riichi':
      return 5000;
    case 'taiwanese':
      return 700;
    case 'vietnamese':
      return 60; // 20 × (1 + phán), about 2 phán on average
    case 'singapore':
      return 64; // one share of a 2-tai hand
    case 'korean3':
      return 300; // 100 a point, about three points a hand
    default:
      return 64; // Classic and Dubai: 16 × 2^faan, about 2 faan on average
  }
}

export function readOpponent(game: MahjongGame, opp: number): OpponentRead {
  const p = game.players[opp];
  const open = p.melds.filter((m) => !m.concealed);
  const openMelds = open.length;
  const n = p.discardKinds.length;
  const scale = 4 / setsNeeded(game);
  const hasRiichi = !!game.profile.riichi;

  // ---- flush signs: exposures all in one suit, few discards of that suit
  const suitDisc = [0, 0, 0];
  for (const k of p.discardKinds) if (k < 27) suitDisc[Math.floor(k / 9)]++;
  const meldSuits = new Set(open.filter((m) => m.tiles[0].kind < 27).map((m) => Math.floor(m.tiles[0].kind / 9)));
  let flushSuit: number | null = null;
  const minSuit = suitDisc.indexOf(Math.min(...suitDisc));
  if (meldSuits.size === 1) {
    const s = [...meldSuits][0];
    if ((openMelds >= 2 || n >= 5) && suitDisc[s] <= 1 && suitDisc[s] * 4 <= n) flushSuit = s;
  } else if (meldSuits.size === 0 && n >= 8 && suitDisc[minSuit] === 0 && suitDisc.filter((c) => c >= 3).length === 2) flushSuit = minSuit;

  const dragonPungs = open.filter((m) => m.type !== 'chow' && isDragon(m.tiles[0].kind)).length;
  const pungHand = openMelds >= 2 && open.every((m) => m.type !== 'chow');

  // ---- how likely they are ready
  let tenpai: number;
  if (p.riichi) tenpai = 1;
  else if (tw(game)) {
    tenpai = openMelds >= 5 ? 1 : TW_TENPAI[Math.min(4, openMelds)][Math.min(16, n)];
    if (flushSuit !== null) tenpai = Math.min(0.95, tenpai + 0.05);
  } else {
    const m = openMelds * scale;
    const closedRate = hasRiichi ? 0.012 : 0.03; // Riichi players usually declare when ready
    tenpai = Math.min(hasRiichi ? 0.3 : 0.6, closedRate * n);
    if (m >= 4) tenpai = 0.95;
    else if (m >= 3) tenpai = Math.max(tenpai, 0.45 + 0.03 * n);
    else if (m >= 2) tenpai = Math.max(tenpai, 0.2 + 0.03 * n);
    else if (m >= 1) tenpai = Math.max(tenpai, 0.06 + 0.025 * n);
    if (flushSuit !== null) tenpai += 0.05;
    tenpai = Math.min(0.95, tenpai);
  }

  // ---- what it would cost
  let value = 1;
  if ((game.profile.base ?? game.profile.id) === 'riichi') {
    if (opp === game.dealer) value *= 1.5;
    if (p.riichi) value *= 1.15;
    else if (openMelds) value *= 0.75; // open hands are usually cheap
    const dora = game.doraKinds();
    const visibleDora = open.reduce((a, m) => a + m.tiles.reduce((b, t) => b + dora.filter((d) => d === t.kind).length, 0), 0);
    value *= 1 + 0.35 * visibleDora;
  } else if (tw(game) && opp === game.dealer) {
    // The dealer's tai (1, plus 2 for each deal kept) are added to what a
    // dealer collects, so a long dealer streak makes dealing in dearer.
    value *= 1 + 0.2 * dealerTai(game.state.round.repeat);
  }
  if (flushSuit !== null) value *= 1.8;
  value *= 1 + 0.45 * dragonPungs;
  if (pungHand) value *= 1.3;

  return { seat: opp, tenpai, value, threat: tenpai * value, riichi: p.riichi, openMelds, flushSuit, dragonPungs, pungHand };
}

export function readOpponents(game: MahjongGame, seat: number): OpponentRead[] {
  return game.players.map((_, o) => (o === seat ? null : readOpponent(game, o))).filter((r): r is OpponentRead => !!r);
}

const avail = (n: number) => (n <= 0 ? 0 : n === 1 ? 0.4 : n === 2 ? 0.75 : 1);

/**
 * Chance that `kind` wins for opponent `read.seat` if they are ready.
 * Calibrated loosely: a live middle tile against riichi is about 12%,
 * a live terminal about 6%, a live honour about 3%.
 */
export function tileDanger(game: MahjongGame, kind: number, read: OpponentRead, safe: SafeSets, unseen: number[], depth: ReadDepth = 'full'): TileDanger {
  const furiten = game.profile.furiten;
  // How surely a kind is ruled out for this opponent: 1 = cannot win on it now.
  const safeLevel = (k: number) => {
    if (safe.sinceLast.has(k) || safe.afterRiichi.has(k)) return 1;
    if (safe.own.has(k)) return furiten ? 1 : 0.6;
    return 0;
  };
  // Taiwanese has no furiten, but measured in self-play an opponent almost
  // never waits on a tile they discarded themselves; suji built on their
  // discards keeps the weaker credit.
  const lvl = tw(game) && safe.own.has(kind) && !safe.sinceLast.has(kind) ? 0.9 : safeLevel(kind);
  if (lvl === 1) {
    const reason: SafetyReason = safe.own.has(kind) && furiten ? 'genbutsu' : safe.afterRiichi.has(kind) ? 'passedRiichi' : 'passed';
    return { hit: 0, reason, via: [] };
  }
  const p = game.players[read.seat];
  const value = (k: number) => isDragon(k) || k === windKind(game.state.seatWinds[read.seat]) || k === windKind(game.prevailing);

  if (isHonor(kind)) {
    const u = unseen[kind];
    let pair = u >= 2 ? 0.8 : u === 1 ? 0.4 : 0;
    if (read.pungHand) pair *= 2;
    if (u >= 2 && !p.riichi && read.openMelds && value(kind)) pair *= 1.5;
    if (read.dragonPungs >= 2 && isDragon(kind)) pair *= 3;
    if (read.flushSuit !== null) pair *= 1.2;
    const hit = pair * 0.04 * (1 - lvl);
    const reason: SafetyReason = lvl > 0 ? 'genbutsu' : u === 0 ? 'honourDead' : u === 1 ? 'honourSeen' : 'none';
    return { hit, reason, via: [] };
  }

  const base = kind - (kind % 9);
  const r = kind % 9; // 0..8
  const u = (rr: number) => unseen[base + rr];
  let seq = 0;
  let sujiKills = 0;
  let kabeKills = 0;
  const sujiVia: number[] = [];
  const kabeVia: number[] = [];
  const shape = (a: number, b: number, weight: number, sujiPartner: number | null) => {
    if (a < 0 || b > 8) return;
    const av = avail(Math.min(u(a), u(b)));
    if (av === 0) {
      kabeKills++;
      for (const x of [a, b]) if (u(x) === 0 && !kabeVia.includes(base + x)) kabeVia.push(base + x);
      return;
    }
    let w = weight * av;
    if (sujiPartner !== null) {
      const s = safeLevel(base + sujiPartner);
      if (s >= 1) {
        sujiKills++;
        sujiVia.push(base + sujiPartner);
      }
      w *= 1 - s;
    }
    seq += w;
  };
  // Two-sided (or edge) shapes waiting on this tile, and the closed (middle) wait.
  shape(r + 1, r + 2, r + 2 === 8 ? 0.5 : 1, r + 2 === 8 ? null : r + 3);
  shape(r - 2, r - 1, r - 2 === 0 ? 0.5 : 1, r - 2 === 0 ? null : r - 3);
  shape(r - 1, r + 1, 0.6, null);
  const uk = unseen[kind];
  let pair = uk >= 2 ? 0.45 : uk === 1 ? 0.25 : 0;

  if (read.pungHand) {
    seq *= 0.4;
    pair *= 2.5;
  }
  let mult = 1 - lvl;
  if (read.flushSuit !== null) mult *= Math.floor(kind / 9) === read.flushSuit ? 1.8 : 0.15;
  let early = false;
  if (depth === 'full') {
    // Tiles beside their very early discards are a little less likely.
    if (safe.early.some((e) => e !== kind && e < 27 && Math.floor(e / 9) === Math.floor(kind / 9) && Math.abs(e - kind) <= 2)) {
      mult *= 0.85;
      early = true;
    }
    // Tiles straddling the riichi tile are a classic trap.
    const rk = safe.riichiKind;
    if (rk !== null && rk < 27 && rk !== kind && Math.floor(rk / 9) === Math.floor(kind / 9) && Math.abs(rk - kind) <= 2) mult *= 1.25;
  } else {
    // Basic reading only knows plain genbutsu: undo suji and kabe credit.
    if (sujiKills || kabeKills) seq = Math.max(seq, 1.2);
    sujiKills = kabeKills = 0;
  }
  // Sixteen-tile hands hold more shapes, so live suited tiles hit more often (measured).
  const hit = (seq + pair) * 0.04 * mult * (tw(game) ? 1.4 : 1);

  let reason: SafetyReason = 'none';
  let via: number[] = [];
  if (lvl > 0) reason = 'genbutsu';
  else if (sujiKills && seq < 0.7) {
    reason = 'suji';
    via = sujiVia;
  } else if (kabeKills && seq < 0.7) {
    reason = 'kabe';
    via = kabeVia;
  } else if (early) reason = 'early';
  return { hit, reason, via };
}

export interface DangerMap {
  reads: OpponentRead[];
  /** Expected cost (relative hand values) of discarding each kind: Σ tenpai × value × hit. */
  loss: number[];
  /** Per-opponent detail for each kind, aligned with reads. */
  detail: TileDanger[][];
}

export function dangerMap(game: MahjongGame, seat: number, depth: ReadDepth = 'full'): DangerMap {
  const reads = readOpponents(game, seat);
  const unseen = unseenCounts(game, seat);
  const safes = reads.map((r) => safeSets(game, r.seat));
  const loss = new Array(KIND_COUNT).fill(0);
  const detail: TileDanger[][] = [];
  for (let k = 0; k < KIND_COUNT; k++) {
    const row = reads.map((r, i) => tileDanger(game, k, r, safes[i], unseen, depth));
    detail.push(row);
    loss[k] = row.reduce((a, d, i) => a + d.hit * reads[i].threat, 0);
  }
  return { reads, loss, detail };
}

/** The opponent whose danger matters most right now, if anyone looks close. */
export function mainThreat(reads: OpponentRead[], min = 0.35): OpponentRead | null {
  let best: OpponentRead | null = null;
  for (const r of reads) if (r.tenpai >= min && (!best || r.threat > best.threat)) best = r;
  return best;
}

/** Overall label for one discard's risk. */
export function riskLabelFor(loss: number): string {
  return loss < 0.004 ? 'Safe' : loss < 0.015 ? 'Low' : loss < 0.04 ? 'Medium' : 'High';
}

const list = (ks: number[]) => {
  const names = ks.map(tileName);
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

/**
 * One plain sentence on why a tile is (or isn't) safe against one opponent.
 * `past` words it for a replay review ("was" instead of "is").
 */
export function safetySentence(kind: number, d: TileDanger, past = false): string {
  const Name = `The ${tileName(kind)}`;
  const is = past ? 'was' : 'is';
  const are = past ? 'were' : 'are';
  const cant = past ? "couldn't" : "can't";
  switch (d.reason) {
    case 'genbutsu':
      return d.hit === 0 ? `${Name} ${is} safe against them: they discarded it.` : `${Name} ${is} fairly safe against them: they discarded one earlier.`;
    case 'passedRiichi':
      return `${Name} ${is} safe against them: it was let go after their declaration and they didn't win on it.`;
    case 'passed':
      return `${Name} ${is} safe against them for now: it was let go since their last turn and they didn't take it.`;
    case 'suji':
      return `${Name} ${is} fairly safe against them: they discarded the ${list(d.via)}, so it ${cant} finish a two-sided wait.`;
    case 'kabe':
      return `${Name} ${is} fairly safe: all four of the ${list(d.via)} ${are} visible, so it ${cant} finish a two-sided wait.`;
    case 'honourDead':
      return `${Name} ${is} safe: every other copy ${is} visible, so nobody ${past ? 'could' : 'can'} be waiting on it.`;
    case 'honourSeen':
      return `${Name} ${is} fairly safe: the other copies ${are} already showing, so only a single-tile wait could use it.`;
    case 'early':
      return `${Name} ${is} a little safer: they threw away tiles next to it early on.`;
    default:
      return d.hit >= 0.08 ? `${Name} ${is} risky against them.` : `${Name} ${is} not a sure safe tile against them.`;
  }
}

/** Name and seat wind, e.g. "Mei (East)". */
export function seatLabel(game: MahjongGame, seat: number): string {
  return `${game.players[seat].name} (${WIND_NAMES[game.state.seatWinds[seat]]})`;
}

/** Short description of why an opponent looks dangerous. */
export function threatSentence(game: MahjongGame, read: OpponentRead, past = false): string {
  const who = seatLabel(game, read.seat);
  const riichiName = game.profile.callNames.riichi ?? 'riichi';
  const has = past ? 'had' : 'has';
  if (read.riichi) return `${who} ${has} declared ${riichiName}.`;
  const bits: string[] = [];
  if (read.flushSuit !== null) bits.push(`${past ? 'looked' : 'looks'} to be collecting ${suitLabel(read.flushSuit)}`);
  if (read.dragonPungs >= 2) bits.push(`${has} ${read.dragonPungs} dragon sets showing`);
  else if (read.openMelds) bits.push(`${has} ${read.openMelds} set${read.openMelds > 1 ? 's' : ''} showing`);
  if (!bits.length) bits.push(`${past ? 'might have been' : 'may be'} close to winning`);
  return `${who} ${bits.join(' and ')}${read.tenpai >= 0.6 ? (past ? ' and might have been ready' : ' and may be ready') : ''}.`;
}
