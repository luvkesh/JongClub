// What a hand is worth right now, for the hand-score card at the table (tap a
// player's plate) and the score calculator. Every variation scores through its
// own rule profile (game.evaluateWin), so wilds, cards, special rounds, house
// rules and minimums all count exactly as they would at a real win.
//
// Your own hand:
//   win       you hold a winning hand now (14 tiles on your turn)
//   ready     one tile from a win: each tile you wait on, with its score on a
//             discard and on a self-draw
//   discard   14 tiles, not a win: the discards that leave you ready, and what
//             each is worth
//   building  further away: how far, and the best win one swap from ready
// Another player's hand is hidden, so only what is on show counts: their sets,
// flowers and points. When a hand ends, the winner's score is the result.

import type { MahjongGame } from '../engine/game';
import type { HandScore } from '../engine/rules/types';
import { KIND_COUNT, isFlower, type Tile } from '../engine/tiles';
import { currentShanten, unseenCounts } from './evaluate';

export interface WinValue {
  score: HandScore;
  /** Net points the win itself pays you (payment rules applied; flower settlements and pots aside). */
  collect: number;
}

export interface WaitScore {
  kind: number;
  /** Winning on another player's discard (null: not a legal win that way, e.g. no yaku). */
  ron: WinValue | null;
  /** Drawing it yourself. */
  tsumo: WinValue | null;
  /** Copies you have not seen. */
  left: number;
}

export interface DiscardOption {
  /** Tile kind to throw. */
  discard: number;
  waits: WaitScore[];
  /** The best this discard can be worth. */
  best: WinValue | null;
}

export type HandNow =
  | { state: 'win'; win: WinValue; selfDrawn: boolean; winKind: number }
  | { state: 'ready'; waits: WaitScore[]; best: WinValue | null; low: WinValue | null }
  | { state: 'discard'; options: DiscardOption[] }
  | { state: 'building'; away: number; reach: { discard: number; draw: number; wait: number; value: WinValue } | null }
  | { state: 'won'; win: WinValue }
  | { state: 'none' };

/** What anyone can see of a seat's hand. */
export interface OnShow {
  points: number;
  sets: number;
  concealedKongs: number;
  flowers: number;
  tiles: number;
}

const better = (a: WinValue | null, b: WinValue | null) => (!a ? b : !b ? a : b.score.points > a.score.points || (b.score.points === a.score.points && b.collect > a.collect) ? b : a);
const lower = (a: WinValue | null, b: WinValue | null) => (!a ? b : !b ? a : b.score.points < a.score.points ? b : a);

/** Run `fn` with the seat holding `hand` (the real hand goes back after). */
export function withHand<T>(game: MahjongGame, seat: number, hand: Tile[], fn: () => T): T {
  const pl = game.players[seat];
  const real = pl.hand;
  pl.hand = hand;
  try {
    return fn();
  } finally {
    pl.hand = real;
  }
}

/** What a win with this score pays the winner: the profile's payment rule, a non-dealer discarder for a discard win. */
export function collectFor(game: MahjongGame, seat: number, score: HandScore, selfDrawn: boolean): number {
  const n = game.profile.players;
  let from: number | null = null;
  if (!selfDrawn) {
    for (let i = 1; i < n && from === null; i++) if ((seat + i) % n !== game.dealer) from = (seat + i) % n;
    if (from === null) from = (seat + 1) % n;
  }
  const stakes = game.state.goulash ? (game.profile.goulashStakes ?? 1) : 1;
  return game.profile
    .payments(seat, from, score, game.dealer, n, game.state.round.repeat)
    .reduce((a, p) => a + (p.to === seat ? p.amount : 0) - (p.from === seat ? p.amount : 0), 0) * stakes;
}

const value = (game: MahjongGame, seat: number, score: HandScore | undefined | null, selfDrawn: boolean): WinValue | null =>
  score ? { score, collect: collectFor(game, seat, score, selfDrawn) } : null;

/** Scores of each tile a 13-tile hand waits on (the seat's hand as it is now). */
export function waitScores(game: MahjongGame, seat: number, unseen = unseenCounts(game, seat)): WaitScore[] {
  const out: WaitScore[] = [];
  for (const k of game.waitsOf(seat)) {
    const ron = value(game, seat, game.evaluateWin(seat, k, false, true)?.score, false);
    const tsumo = value(game, seat, game.evaluateWin(seat, k, true, true)?.score, true);
    if (ron || tsumo) out.push({ kind: k, ron, tsumo, left: k < KIND_COUNT ? (unseen[k] ?? 0) : 0 });
  }
  return out;
}

const bestOf = (ws: WaitScore[]) => ws.reduce<WinValue | null>((a, w) => better(better(a, w.ron), w.tsumo), null);

/** Tiles the profile deals that a hand can hold (no flowers, which go aside). */
function drawKinds(game: MahjongGame): number[] {
  const kinds = new Set(game.profile.tileKinds.filter((k) => !isFlower(k) || !game.profile.flowers));
  return [...kinds];
}

/**
 * The seat's own hand now (call it for the viewer's seat: it reads concealed tiles).
 * `deep` also searches one swap ahead when the hand is one tile from ready.
 */
export function handNow(game: MahjongGame, seat: number, deep = true): HandNow {
  const ph = game.state.phase;
  const pl = game.players[seat];
  if (!pl) return { state: 'none' };
  if (ph.kind === 'handOver') {
    const r = ph.result;
    return r.type === 'win' && r.winner === seat && r.score ? { state: 'won', win: { score: r.score, collect: r.deltas[seat] ?? 0 } } : { state: 'none' };
  }
  // The deal and the passing phases have no hand to score yet.
  if (ph.kind !== 'turn' && ph.kind !== 'claims') return { state: 'none' };
  // A kong counts as a set of three; a card hand's exposures count tile by tile.
  const held = pl.hand.length + pl.melds.reduce((a, m) => a + (game.profile.card ? m.tiles.length : 3), 0);
  const full = held % 3 === 2;
  const unseen = unseenCounts(game, seat);
  if (full) {
    const last = ph.kind === 'turn' && ph.seat === seat && ph.drawn ? ph.drawn : pl.hand[pl.hand.length - 1];
    if (last) {
      const ev = game.evaluateWin(seat, last.kind, true, false, ph.kind === 'turn' && ph.afterKong);
      if (ev) return { state: 'win', win: value(game, seat, ev.score, true)!, selfDrawn: true, winKind: last.kind };
    }
    // Which discards leave you ready, and what each is worth.
    const options: DiscardOption[] = [];
    const seen = new Set<number>();
    pl.hand.forEach((t, i) => {
      if (seen.has(t.kind)) return;
      seen.add(t.kind);
      const rest = pl.hand.filter((_, j) => j !== i);
      const waits = withHand(game, seat, rest, () => waitScores(game, seat, unseen));
      if (waits.length) options.push({ discard: t.kind, waits, best: bestOf(waits) });
    });
    if (options.length) return { state: 'discard', options: options.sort((a, b) => (b.best?.score.points ?? 0) - (a.best?.score.points ?? 0)) };
    return { state: 'building', away: Math.max(1, currentShanten(game, seat)), reach: null };
  }
  const waits = waitScores(game, seat, unseen);
  if (waits.length) return { state: 'ready', waits, best: bestOf(waits), low: waits.reduce<WinValue | null>((a, w) => lower(a, better(w.ron, w.tsumo)), null) };
  const away = Math.max(1, currentShanten(game, seat));
  return { state: 'building', away, reach: deep && away === 1 && !game.profile.card ? reachOneSwap(game, seat) : null };
}

/** One tile from ready: the best win reachable by drawing one tile and throwing one. */
function reachOneSwap(game: MahjongGame, seat: number): { discard: number; draw: number; wait: number; value: WinValue } | null {
  const pl = game.players[seat];
  let best: { discard: number; draw: number; wait: number; value: WinValue } | null = null;
  const kinds = drawKinds(game);
  const tried = new Set<number>();
  pl.hand.forEach((t, i) => {
    if (tried.has(t.kind)) return;
    tried.add(t.kind);
    for (const k of kinds) {
      if (k === t.kind) continue;
      const hand = pl.hand.slice();
      hand[i] = { id: -100 - k, kind: k };
      withHand(game, seat, hand, () => {
        if (!game.isTenpai(seat)) return;
        for (const w of game.waitsOf(seat)) {
          const v = value(game, seat, game.evaluateWin(seat, w, false, true)?.score, false) ?? value(game, seat, game.evaluateWin(seat, w, true, true)?.score, true);
          if (v && (!best || v.score.points > best.value.score.points)) best = { discard: t.kind, draw: k, wait: w, value: v };
        }
      });
    }
  });
  return best;
}

/** What anyone can see of a seat's hand. */
export function onShow(game: MahjongGame, seat: number): OnShow {
  const pl = game.players[seat];
  return {
    points: pl.score,
    sets: pl.melds.filter((m) => !m.concealed).length,
    concealedKongs: pl.melds.filter((m) => m.concealed).length,
    flowers: pl.flowers.length,
    tiles: pl.hand.length,
  };
}

// ------------------------------------------------------------ the calculator

export interface CalcInput {
  /** Concealed tile kinds, the winning tile included (it is `winKind`, the last one if not given). */
  hand: number[];
  /** Declared sets: type and kinds; a kong declared from the hand is concealed. */
  melds: { type: 'chow' | 'pung' | 'kong'; kinds: number[]; concealed?: boolean }[];
  winKind?: number;
  selfDrawn: boolean;
  /** Riichi declared (Riichi family). */
  riichi?: boolean;
  /** Count the flowers this seat holds at the table. */
  flowers?: boolean;
}

export type CalcResult =
  | { ok: true; win: WinValue }
  | { ok: false; reason: 'count'; need: number }
  | { ok: false; reason: 'noWin' }
  | { ok: false; reason: 'noValue' };

/** Tiles the calculator's concealed hand needs for these declared sets (the winning tile included). */
export const calcNeed = (game: MahjongGame, melds: number) => game.profile.handSize + 1 - 3 * melds;

/**
 * Score any hand with the table's rules and this seat's place at the table (seat
 * and round wind, dealer, dora, the round's card). The live game is borrowed for
 * the call and left exactly as it was.
 */
export function calculate(game: MahjongGame, seat: number, input: CalcInput): CalcResult {
  const need = calcNeed(game, input.melds.length);
  if (input.hand.length !== need) return { ok: false, reason: 'count', need };
  const pl = game.players[seat];
  let id = -1000;
  const tile = (kind: number): Tile => ({ id: id--, kind });
  const winKind = input.winKind ?? input.hand[input.hand.length - 1];
  const rest = input.hand.slice();
  rest.splice(rest.lastIndexOf(winKind), 1);
  const saved = { hand: pl.hand, melds: pl.melds, flowers: pl.flowers, riichi: pl.riichi, ippatsu: pl.ippatsu, doubleRiichi: pl.doubleRiichi, phase: game.state.phase };
  try {
    pl.hand = rest.map(tile);
    pl.melds = input.melds.map((m) => ({ type: m.type, tiles: m.kinds.map(tile), concealed: !!m.concealed, from: m.concealed ? undefined : (seat + 1) % game.profile.players }));
    if (!input.flowers) pl.flowers = [];
    pl.riichi = !!input.riichi && !!game.profile.riichi && input.melds.every((m) => m.concealed);
    pl.ippatsu = false;
    pl.doubleRiichi = false;
    const ev = game.evaluateWin(seat, winKind, input.selfDrawn, true);
    if (ev) return { ok: true, win: value(game, seat, ev.score, input.selfDrawn)! };
    // Tell a hand that isn't a winning shape from one the rules won't pay (no yaku, under the minimum).
    const shape = game.waitsOf(seat).includes(winKind);
    return { ok: false, reason: shape ? 'noValue' : 'noWin' };
  } finally {
    Object.assign(pl, { hand: saved.hand, melds: saved.melds, flowers: saved.flowers, riichi: saved.riichi, ippatsu: saved.ippatsu, doubleRiichi: saved.doubleRiichi });
    game.state.phase = saved.phase;
  }
}
