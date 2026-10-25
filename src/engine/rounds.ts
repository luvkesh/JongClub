// NEWS round framework: North, East, West, South as a configurable
// structure rather than logic baked into each variant. A RoundProfile
// says which prevailing winds are played and in what order, how seat
// winds are assigned, and when the dealer passes.

import { Wind, WINDS } from './tiles';
import { tr } from '../i18n';

export type DealerRetention =
  /** Dealer keeps the deal when they win. */
  | 'onDealerWin'
  /** Dealer keeps the deal when they win or the hand is drawn. */
  | 'onDealerWinOrDraw'
  /** Dealer keeps the deal when they win, or are ready (tenpai) at a drawn hand. */
  | 'onDealerWinOrTenpai'
  /** The deal always passes, except after a drawn hand (India Rules: each player is East once a round, plus an extra game after a draw). */
  | 'onDraw'
  /** The deal always passes. */
  | 'never';

export interface RoundProfile {
  /** Prevailing winds in play order, e.g. ['E','S','W','N'] or just ['E']. */
  prevailingWinds: Wind[];
  /** Seat winds handed out from the dealer onward in turn order. */
  seatWindOrder: Wind[];
  /** Dealer hands per prevailing wind before it advances (normally player count). */
  handsPerWind: number;
  dealerRetention: DealerRetention;
  /** Hard cap so retention can't stretch a game forever. 0 = none. */
  maxHands: number;
  /** Sudden death: the match ends with the first hand somebody wins (draws are replayed). */
  endOnFirstWin?: boolean;
  /** The rule set fixes which winds are played (India Rules: one chosen round, or all four):
   *  the match formats keep them, except a single hand or sudden death, which play the first. */
  lockWinds?: boolean;
}

export interface RoundState {
  windIndex: number;
  /** 0-based dealer hand within the current wind (advances when the deal passes). */
  dealerHand: number;
  /** Consecutive dealer repeats (honba / "bonus counters"). */
  repeat: number;
  dealerSeat: number;
  handsPlayed: number;
  finished: boolean;
}

export function initialRound(): RoundState {
  return { windIndex: 0, dealerHand: 0, repeat: 0, dealerSeat: 0, handsPlayed: 0, finished: false };
}

export const prevailingWind = (p: RoundProfile, r: RoundState): Wind =>
  p.prevailingWinds[Math.min(r.windIndex, p.prevailingWinds.length - 1)];

/** Seat wind for a seat given the current dealer. */
export function seatWind(p: RoundProfile, r: RoundState, seat: number, players: number): Wind {
  const offset = (seat - r.dealerSeat + players) % players;
  return p.seatWindOrder[offset % p.seatWindOrder.length];
}

/** Advance after a hand. `dealerWon`/`drawn` describe how the hand ended. */
export function advanceRound(p: RoundProfile, r: RoundState, players: number, outcome: { dealerWon: boolean; drawn: boolean; dealerTenpai?: boolean }): RoundState {
  const next = { ...r, handsPlayed: r.handsPlayed + 1 };
  const keep =
    (p.dealerRetention === 'onDealerWin' && outcome.dealerWon) ||
    (p.dealerRetention === 'onDealerWinOrDraw' && (outcome.dealerWon || outcome.drawn)) ||
    (p.dealerRetention === 'onDraw' && outcome.drawn) ||
    (p.dealerRetention === 'onDealerWinOrTenpai' && (outcome.dealerWon || (outcome.drawn && !!outcome.dealerTenpai)));
  if (keep) {
    next.repeat = r.repeat + 1;
  } else {
    next.repeat = outcome.drawn ? r.repeat + 1 : 0;
    next.dealerSeat = (r.dealerSeat + 1) % players;
    next.dealerHand = r.dealerHand + 1;
    if (next.dealerHand >= p.handsPerWind) {
      next.dealerHand = 0;
      next.windIndex = r.windIndex + 1;
    }
  }
  if (next.windIndex >= p.prevailingWinds.length) next.finished = true;
  if (p.maxHands > 0 && next.handsPlayed >= p.maxHands) next.finished = true;
  if (p.endOnFirstWin && !outcome.drawn) next.finished = true;
  return next;
}

/** "EAST ROUND", "Hand 3 / 4" labels for the HUD. */
export function roundLabel(p: RoundProfile, r: RoundState): { round: string; hand: string } {
  const w = prevailingWind(p, r);
  return {
    round: { E: tr('EAST ROUND'), S: tr('SOUTH ROUND'), W: tr('WEST ROUND'), N: tr('NORTH ROUND') }[w],
    hand: tr('Hand {n} / {total}', { n: Math.min(r.dealerHand + 1, p.handsPerWind), total: p.handsPerWind }),
  };
}

/** Clock for a timed match. */
export const TIMED_MINUTES = 30;

export type GameLength = 'oneHand' | 'eastRound' | 'eastSouth' | 'fullNews' | 'timed' | 'suddenDeath';

/**
 * Match formats. These are a setting of their own, separate from the rule set
 * (Riichi, Hong Kong...) and from the mode (standard or Goulash): any format
 * goes with any rule set.
 */
export const GAME_LENGTHS: Record<GameLength, { label: string; detail: string }> = {
  oneHand: { label: 'Single hand', detail: tr('One hand, about 4 minutes') },
  eastRound: { label: 'East round', detail: tr('East only: four or more hands, about 15 minutes') },
  eastSouth: { label: 'East + South', detail: tr('Two winds: eight or more hands') },
  fullNews: { label: 'Full E-S-W-N', detail: tr('All four winds, sixteen or more hands') },
  timed: { label: 'Timed match', detail: tr('Play for {n} minutes, then finish the round', { n: TIMED_MINUTES }) },
  suddenDeath: { label: 'Sudden death', detail: tr('The first hand anyone wins ends the match') },
};

export function roundProfileFor(length: GameLength, base: RoundProfile): RoundProfile {
  if (base.lockWinds) {
    const first = [base.prevailingWinds[0]];
    if (length === 'oneHand') return { ...base, prevailingWinds: first, maxHands: 1 };
    if (length === 'suddenDeath') return { ...base, prevailingWinds: first, maxHands: 0, endOnFirstWin: true };
    return base;
  }
  switch (length) {
    case 'oneHand':
      return { ...base, prevailingWinds: ['E'], maxHands: 1 };
    case 'eastRound':
      return { ...base, prevailingWinds: ['E'] };
    case 'eastSouth':
      return { ...base, prevailingWinds: ['E', 'S'] };
    // A three-seat table has no North seat, so its longest match is E-S-W.
    case 'fullNews':
      return { ...base, prevailingWinds: WINDS.slice(0, Math.min(WINDS.length, base.seatWindOrder.length)) };
    case 'timed':
      // Up to all four winds (three at a three-seat table); the clock usually ends it first (timedMatchOver).
      return { ...base, prevailingWinds: WINDS.slice(0, Math.min(WINDS.length, base.seatWindOrder.length)) };
    case 'suddenDeath':
      return { ...base, prevailingWinds: ['E'], maxHands: 0, endOnFirstWin: true };
  }
}

/**
 * Formats that need one shared clock, so they are offered at AI tables only.
 * Live tables run in lockstep and every client would read its own clock, so a
 * live table could disagree on the last hand; until the host shares "time is
 * up" through the action stream, a live table plays these as full E-S-W-N.
 */
export const AI_ONLY_LENGTHS: readonly GameLength[] = ['timed'];

/** The format a live (lockstep) table actually plays for `length`. */
export const liveSafeLength = (length: GameLength): GameLength => (AI_ONLY_LENGTHS.includes(length) ? 'fullNews' : length);

/**
 * Timed match: once the clock has run out, the match ends when the current
 * round is complete, i.e. when the next hand would open a new prevailing
 * wind (or the match is over anyway). `next` is the round after this hand
 * (MahjongGame.peekNextRound()). False for every other format.
 */
export function timedMatchOver(length: GameLength, startedAtMs: number, nowMs: number, current: RoundState, next: RoundState, minutes = TIMED_MINUTES): boolean {
  if (length !== 'timed') return false;
  if (nowMs - startedAtMs < minutes * 60_000) return false;
  return next.finished || next.windIndex !== current.windIndex;
}
