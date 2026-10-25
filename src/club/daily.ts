// Daily challenges. Everything is derived from the UTC date, so every member
// of the club gets the same hands, puzzle and goals on the same day.
// Rewards are Jong Points only.

import { AiPlayer, type Difficulty, type Personality } from '../ai/players';
import { evaluateDiscards, type DiscardEval } from '../ai/evaluate';
import { MahjongGame } from '../engine/game';
import type { GameLength } from '../engine/rounds';
import { getProfile, VARIATIONS } from '../engine/rules';
import type { HandResult, Meld } from '../engine/state';
import { windKind, type Wind } from '../engine/tiles';
import { andList, tr, trn } from '../i18n';
import { tileLabel } from '../i18n/tiles';
import { ROSTER, type ClubMember, type VariationId } from './roster';
import { buildProfile } from './sim';
import { applyAction, decisionAction } from '../net/actions';
import { dayNumber, dayStart, isoDay, seedOf } from './util';

// ------------------------------------------------------------ keys and seeds

/** The UTC day a challenge belongs to, 'YYYY-MM-DD'. Use it as a storage key. */
export const dailyKey = (date: Date | string = new Date()): string => isoDay(date);

/** One positive 31-bit seed per UTC day. Accepts 'YYYY-MM-DD' or any ISO timestamp. */
export const dailySeed = (dateISO: string): number => seedOf('jongclub-daily', isoDay(dateISO));

const variationName = (id: string) => VARIATIONS.find((v) => v.id === id)?.name ?? id;

// ------------------------------------------------------------ shared table spec

export interface DailyOpponent {
  memberId: string;
  name: string;
  difficulty: Difficulty;
  personality: Personality;
}

/**
 * A TableConfig-compatible spec (ui/match.ts) plus the fixed seed and the
 * opponents for seats 1..3. Start every hand with `seed` so the deal is the
 * same for everyone, and seed AI seat i with `seed + i * 101` as match.ts does.
 */
export interface DailyTableSpec {
  name: string;
  variation: VariationId;
  length: GameLength;
  difficulty: Difficulty;
  personalities: Personality[];
  houseRules: Record<string, string>;
  timer: number;
  hints: boolean;
  seed: number;
  opponents: DailyOpponent[];
}

/** Three distinct roster members for a seed, of a given minimum strength. */
function pickOpponents(seed: number, minRating = 1500): DailyOpponent[] {
  const pool = ROSTER.filter((m) => m.rating >= minRating);
  const out: ClubMember[] = [];
  for (let i = 0; out.length < 3 && i < 100; i++) {
    const m = pool[seedOf(seed, 'opp', i) % pool.length];
    if (!out.includes(m)) out.push(m);
  }
  return out.map((m) => ({ memberId: m.id, name: m.name, difficulty: m.difficulty, personality: m.personality }));
}

function tableSpec(name: string, variation: VariationId, seed: number, length: GameLength = 'oneHand'): DailyTableSpec {
  const opponents = pickOpponents(seed);
  return {
    name,
    variation,
    length,
    difficulty: 'strategic',
    personalities: opponents.map((o) => o.personality),
    houseRules: {},
    timer: 0,
    hints: false,
    seed,
    opponents,
  };
}

// ------------------------------------------------------------ today's hand

/** Monday..Sunday (UTC). Sunday = 0 in Date.getUTCDay(). */
const WEEKDAY_VARIATION: VariationId[] = ['riichi', 'classic', 'vietnamese', 'taiwanese', 'american', 'uae', 'singapore'];

/** Converts a variation's score delta into comparable challenge points. */
const DELTA_SCALE: Record<VariationId, number> = { classic: 1, riichi: 0.025, taiwanese: 0.15, american: 0.5, uae: 0.5, vietnamese: 1, indian: 0.5, singapore: 0.5, hongkong: 1, mcr: 8, sichuan: 2, malaysian: 0.5, india: 0.05,
  'riichi-tournament': 0.025, ema: 8, korean: 1, guangdong: 4, 'zung-jung': 0.5, european: 0.05, beijing: 4, northeast: 8, wuhan: 4, shanghai: 1, fujian: 1, thai: 1, indonesian: 1, filipino: 0.5, 'wright-patterson': 0.05 };
export const TODAYS_HAND_WIN_BONUS = 250;

export interface TodaysHand extends DailyTableSpec {
  /** Plain-English description of how the result is scored. */
  metric: string;
}

/** One hand, the same deal and opponents for everyone. Variation rotates by weekday. */
export function todaysHand(date: Date | string = new Date()): TodaysHand {
  const day = dailyKey(date);
  const variation = WEEKDAY_VARIATION[dayStart(day).getUTCDay()];
  return {
    ...tableSpec(tr('Today’s Hand'), variation, seedOf(dailySeed(day), 'hand')),
    metric: tr('Your score change in one hand of {name}, plus {n} for winning it.', { name: variationName(variation), n: TODAYS_HAND_WIN_BONUS }),
  };
}

/** Today's Hand result: seat 0's final score delta (scaled per variation) plus a bonus for winning. */
export function scoreTodaysHand(variation: string, delta: number, won: boolean): number {
  const scale = DELTA_SCALE[variation as VariationId] ?? 1;
  return Math.round(delta * scale) + (won ? TODAYS_HAND_WIN_BONUS : 0);
}

// ------------------------------------------------------------ perfect discard

export interface DiscardAnswer {
  kind: number;
  /** 100 for the best discard; lower is worse. */
  score: number;
  note: string;
}

export interface PerfectDiscardPuzzle {
  variation: 'classic' | 'riichi';
  /** The 14 tile kinds in hand, sorted. */
  hand: number[];
  /** Exposed melds as kinds (empty: the puzzle hand is always concealed). */
  melds: number[][];
  /** Riichi only: dora kinds showing. */
  doraKinds?: number[];
  seatWind: Wind;
  roundWind: Wind;
  /** Discards visible on the table, by seat (seat 0 is you). Useful tile counts take these into account. */
  discards: number[][];
  /** Every distinct discard, best first. Equal options share a score. */
  answers: DiscardAnswer[];
  explanation: string;
}

const rankEval = (a: DiscardEval, b: DiscardEval) => a.shanten - b.shanten || b.ukeire - a.ukeire || b.shapeBonus - a.shapeBonus || a.kind - b.kind;

const away = (s: number) => (s <= 0 ? tr('ready') : trn(s, '{n} tile from ready', '{n} tiles from ready'));

function listKinds(kinds: number[], max = 6) {
  const names = kinds.slice(0, max).map((k) => tileLabel(k));
  if (kinds.length > max) names.push(tr('{n} more', { n: kinds.length - max }));
  if (names.length <= 1) return names.join('');
  return andList(names);
}

function noteFor(e: DiscardEval, best: DiscardEval): string {
  const useful = e.shanten === 0 ? trn(e.ukeire, '{n} winning tile', '{n} winning tiles') : trn(e.ukeire, '{n} useful tile', '{n} useful tiles');
  const kinds = trn(e.improvers.length, '{n} kind', '{n} kinds');
  if (e.shanten > best.shanten) return tr('Breaks up a useful shape: {away}, {useful} ({kinds}).', { away: away(e.shanten), useful, kinds });
  if (e.shanten === 0) return tr('Ready, waiting on {useful} ({kinds}).', { useful, kinds });
  return tr('{away}, {useful} ({kinds}).', { away: `${away(e.shanten)[0].toUpperCase()}${away(e.shanten).slice(1)}`, useful, kinds });
}

function scoreFor(e: DiscardEval, best: DiscardEval, maxUke: number): number {
  if (e.shanten === best.shanten && e.ukeire === best.ukeire) return e.shapeBonus === best.shapeBonus ? 100 : 95;
  if (e.shanten === best.shanten) return Math.max(35, Math.min(94, Math.round((90 * e.ukeire) / Math.max(1, best.ukeire))));
  return Math.min(30, Math.round((30 * e.ukeire) / Math.max(1, maxUke)));
}

function explain(evals: DiscardEval[]): string {
  const best = evals[0];
  const ties = evals.filter((e) => rankEval(e, best) === 0 || (e.shanten === best.shanten && e.ukeire === best.ukeire));
  const runner = evals.find((e) => !ties.includes(e));
  const head =
    ties.length > 1
      ? tr(ties.length > 2 ? 'Discard the {tile} (the {others} are just as good).' : 'Discard the {tile} (the {others} is just as good).', { tile: tileLabel(best.kind), others: listKinds(ties.slice(1).map((e) => e.kind)) })
      : tr('Discard the {tile}.', { tile: tileLabel(best.kind) });
  const shape =
    best.shanten === 0
      ? ' ' + trn(best.ukeire, 'It leaves your hand ready, waiting on {n} winning tile: the {tiles}.', 'It leaves your hand ready, waiting on {n} winning tiles: the {tiles}.', { tiles: listKinds(best.improvers) })
      : ' ' + tr('It keeps you {away} and leaves {n} useful tiles across {kinds} kinds ({tiles}) that would bring you closer.', { away: away(best.shanten), n: best.ukeire, kinds: best.improvers.length, tiles: listKinds(best.improvers) });
  let compare = '';
  if (runner) {
    compare =
      ' ' +
      (runner.shanten > best.shanten
        ? tr('Letting go of the {tile} instead would set you back to {away}.', { tile: tileLabel(runner.kind), away: away(runner.shanten) })
        : tr('The next best choice, the {tile}, leaves only {n} useful tiles.', { tile: tileLabel(runner.kind), n: runner.ukeire }));
  }
  return head + shape + compare + ' ' + tr('Counts include only tiles you cannot already see.');
}

/**
 * Today's discard puzzle: a mid-hand, concealed 14-tile Classic or Riichi
 * hand reached by dealing and playing a few AI turns from the daily seed.
 */
export function perfectDiscard(date: Date | string = new Date()): PerfectDiscardPuzzle {
  const day = dailyKey(date);
  const variation: 'classic' | 'riichi' = dayNumber(day) % 2 === 0 ? 'classic' : 'riichi';
  const base = seedOf(dailySeed(day), 'discard');
  let fallback: PerfectDiscardPuzzle | null = null;
  for (let attempt = 0; attempt < 24; attempt++) {
    const p = buildPuzzle(variation, seedOf(base, attempt), 3 + (seedOf(base, attempt, 'turns') % 5));
    if (!p) continue;
    // Prefer puzzles with one clearly best answer.
    if (p.answers.length > 1 && p.answers[1].score < 95) return p;
    fallback ??= p;
  }
  return fallback ?? buildPuzzle('classic', base, 0)!;
}

export function buildPuzzle(variation: 'classic' | 'riichi', seed: number, ownTurns: number): PerfectDiscardPuzzle | null {
  const profile = buildProfile(variation, 'oneHand');
  const game = new MahjongGame(profile, ['You', 'East', 'South', 'West'], seed);
  const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, 'strategic', s === 0 ? 'teacher' : 'zen', seed + s * 101));
  game.startHand(seed);
  let turnsTaken = 0;
  for (let step = 0; step < 400; step++) {
    const ph = game.state.phase;
    if (ph.kind === 'handOver') return null;
    if (ph.kind === 'claims') {
      for (const s of game.pendingClaimSeats()) {
        const cur = game.state.phase;
        if (cur.kind !== 'claims') break;
        // Seat 0 stays concealed and keeps playing; others may call (but not win early).
        const r = s === 0 ? { type: 'pass' as const } : ais[s].decideClaim(game, cur.options[s], cur.tile.kind);
        game.respond(s, r.type === 'win' ? { type: 'pass' } : r);
      }
      continue;
    }
    if (ph.kind !== 'turn') return null;
    const seat = ph.seat;
    const opts = game.turnOptions(seat);
    if (seat === 0) {
      const pl = game.players[0];
      if (turnsTaken >= ownTurns && pl.melds.length === 0 && !opts.canWin && pl.hand.length === 14) {
        const evals = evaluateDiscards(game, 0).sort(rankEval);
        if (evals[0].shanten <= 2 && evals[0].ukeire > 0) return puzzleFrom(game, variation, evals);
      }
      turnsTaken++;
      const kind = ais[0].pickDiscardKind(game);
      const tile = (ph.drawn && ph.drawn.kind === kind ? ph.drawn : pl.hand.find((t) => t.kind === kind))!;
      game.discard(0, tile.id);
      if (turnsTaken > ownTurns + 6) return null;
      continue;
    }
    const d = ais[seat].decideTurn(game);
    if (d.action === 'win' || d.action === 'abort') return null;
    applyAction(game, decisionAction(seat, d));
  }
  return null;
}

function puzzleFrom(game: MahjongGame, variation: 'classic' | 'riichi', evals: DiscardEval[]): PerfectDiscardPuzzle {
  const best = evals[0];
  const maxUke = Math.max(...evals.map((e) => e.ukeire));
  const answers = evals.map((e) => ({ kind: e.kind, score: scoreFor(e, best, maxUke), note: noteFor(e, best) }));
  const pl = game.players[0];
  return {
    variation,
    hand: pl.hand.map((t) => t.kind).sort((a, b) => a - b),
    melds: pl.melds.map((m: Meld) => m.tiles.map((t) => t.kind)),
    doraKinds: variation === 'riichi' ? game.doraKinds() : undefined,
    seatWind: game.state.seatWinds[0],
    roundWind: game.prevailing,
    discards: game.players.map((p) => p.discards.map((t) => t.kind)),
    answers,
    explanation: explain(evals),
  };
}

/** Points for a puzzle guess: the answer's score (0 if the kind is not in hand). */
export const scorePerfectDiscard = (puzzle: PerfectDiscardPuzzle, kind: number) => puzzle.answers.find((a) => a.kind === kind)?.score ?? 0;

// ------------------------------------------------------------ speed jong

const SPEED_VARIATIONS: VariationId[] = ['classic', 'uae', 'taiwanese', 'indian', 'hongkong', 'sichuan'];

export interface SpeedJong extends DailyTableSpec {
  metric: string;
}

/**
 * Win one hand in as few turns as you can. A "turn" is each time it was your
 * go (a draw, or a call that lets you discard), counting the winning one; a
 * win on someone else's discard counts as one more turn.
 */
export function speedJong(date: Date | string = new Date()): SpeedJong {
  const day = dailyKey(date);
  const variation = SPEED_VARIATIONS[dayNumber(day) % SPEED_VARIATIONS.length];
  return {
    ...tableSpec(tr('Speed Jong'), variation, seedOf(dailySeed(day), 'speed')),
    metric: tr('Turns taken to win one hand. Fewer is better; a hand you do not win scores nothing.'),
  };
}

/** Challenge points for Speed Jong: 1000 for a win within 5 turns, 60 fewer per extra turn, at least 100. */
export function scoreSpeedJong(turns: number, won: boolean): number {
  if (!won) return 0;
  return Math.max(100, 1000 - 60 * Math.max(0, turns - 5));
}

export function speedJongRating(turns: number, won: boolean): 'Lightning' | 'Swift' | 'Steady' | 'Patient' | 'Not completed' {
  if (!won) return 'Not completed';
  return turns <= 7 ? 'Lightning' : turns <= 10 ? 'Swift' : turns <= 14 ? 'Steady' : 'Patient';
}

// ------------------------------------------------------------ four winds

/**
 * What the UI reports to a Four Winds goal. Call `check` after every hand you
 * finish (won or not) with that hand's details, and once more when the match
 * ends with `matchComplete: true`. The goal is met if any call returns true.
 *
 * - won: you won this hand.
 * - seatWind: your seat wind in this hand ('E' when you are dealer).
 * - roundWind: the prevailing (round) wind of this hand.
 * - dealerAtWin: you were the dealer when you won (false if you did not win).
 * - pungKindsAtWin: kinds of every pung or kong in your winning hand, exposed
 *   or concealed (tile kinds: winds 27..30 = E,S,W,N; dragons 31..33). Empty
 *   if you did not win. `pungKindsFromResult` computes it from a HandResult.
 * - dealtIn: you have discarded a winning tile to an opponent at any point in
 *   this match so far.
 * - length: the match length being played.
 * - matchComplete: the match has finished (all its hands are played).
 */
export interface FourWindsSummary {
  won: boolean;
  seatWind: Wind;
  roundWind: Wind;
  dealerAtWin: boolean;
  pungKindsAtWin: number[];
  dealtIn: boolean;
  length: GameLength;
  matchComplete?: boolean;
}

export interface FourWindsGoal {
  id: string;
  title: string;
  detail: string;
  /** Variation and length to play the goal in. */
  variation: VariationId;
  length: GameLength;
  check(summary: FourWindsSummary): boolean;
}

const dragonKinds = [31, 32, 33];

export const FOUR_WINDS_GOALS: FourWindsGoal[] = [
  {
    id: 'east-dealer',
    title: tr('The East Seat'),
    detail: tr('Win a hand while you are East, the dealer.'),
    variation: 'classic',
    length: 'eastRound',
    check: (s) => s.won && s.dealerAtWin,
  },
  {
    id: 'seat-wind-pung',
    title: tr('Your Own Wind'),
    detail: tr('Win holding a pung of your seat wind.'),
    variation: 'classic',
    length: 'eastRound',
    check: (s) => s.won && s.pungKindsAtWin.includes(windKind(s.seatWind)),
  },
  {
    id: 'south-round',
    title: tr('Southern Wind'),
    detail: tr('Win a hand while the round wind is South. Play East + South to get there.'),
    variation: 'classic',
    length: 'eastSouth',
    check: (s) => s.won && s.roundWind === 'S',
  },
  {
    id: 'clean-match',
    title: tr('Clean Hands'),
    detail: tr('Complete an East + South match without dealing in once.'),
    variation: 'classic',
    length: 'eastSouth',
    check: (s) => !!s.matchComplete && s.length === 'eastSouth' && !s.dealtIn,
  },
  {
    id: 'round-wind-pung',
    title: tr('Wind of the Round'),
    detail: tr('Win holding a pung of the round wind.'),
    variation: 'classic',
    length: 'eastRound',
    check: (s) => s.won && s.pungKindsAtWin.includes(windKind(s.roundWind)),
  },
  {
    id: 'dragon-pung',
    title: tr('Dragon’s Breath'),
    detail: tr('Win holding a pung of any dragon.'),
    variation: 'classic',
    length: 'eastRound',
    check: (s) => s.won && s.pungKindsAtWin.some((k) => dragonKinds.includes(k)),
  },
  {
    id: 'north-seat',
    title: tr('From the North'),
    detail: tr('Win a hand while your seat wind is North.'),
    variation: 'classic',
    length: 'eastRound',
    check: (s) => s.won && s.seatWind === 'N',
  },
];

/** Today's NEWS goal. */
export function fourWinds(date: Date | string = new Date()): FourWindsGoal {
  const day = dailyKey(date);
  return FOUR_WINDS_GOALS[seedOf(dailySeed(day), 'winds') % FOUR_WINDS_GOALS.length];
}

/** Pung and kong kinds in a winning hand: exposed melds plus three or more of a kind in the revealed hand. */
export function pungKindsFromResult(result: HandResult): number[] {
  if (result.type !== 'win') return [];
  const out = new Set<number>();
  for (const m of result.revealedMelds ?? []) if (m.type !== 'chow') out.add(m.tiles[0].kind);
  const counts = new Map<number, number>();
  for (const t of result.revealedHand ?? []) counts.set(t.kind, (counts.get(t.kind) ?? 0) + 1);
  for (const [k, n] of counts) if (n >= 3 && k < 34) out.add(k);
  return [...out].sort((a, b) => a - b);
}


// ------------------------------------------------------------ variation of the day

export interface VariationResult {
  variation: string;
  /** 1 = first. */
  placement: number;
  handsWon: number;
}

export interface VariationChallenge {
  id: string;
  variation: VariationId;
  length: GameLength;
  title: string;
  /** The target, e.g. "Win at least one hand". */
  target: string;
  check(result: VariationResult): boolean;
}

const VARIATION_TARGETS: { id: string; target: string; length: GameLength; ok: (r: VariationResult) => boolean }[] = [
  { id: 'win-hand', target: tr('Win at least one hand in a single-hand game or longer.'), length: 'oneHand', ok: (r) => r.handsWon >= 1 },
  { id: 'top-two', target: tr('Finish first or second in an East round.'), length: 'eastRound', ok: (r) => r.placement <= 2 },
  { id: 'two-wins', target: tr('Win two hands in an East round.'), length: 'eastRound', ok: (r) => r.handsWon >= 2 },
  { id: 'first-place', target: tr('Finish first in an East round.'), length: 'eastRound', ok: (r) => r.placement === 1 },
];

/** Every rated rule set gets a day of its own (the UAE rulesets share UAE's). */
const DAY_VARIATIONS: VariationId[] = ['classic', 'riichi', 'taiwanese', 'american', 'uae', 'vietnamese', 'indian', 'singapore', 'hongkong', 'mcr', 'sichuan', 'malaysian', 'india',
  // The Expansion tables.
  'guangdong', 'riichi-tournament', 'ema', 'korean', 'zung-jung', 'european', 'beijing', 'northeast', 'wuhan', 'shanghai', 'fujian', 'thai', 'indonesian', 'filipino', 'wright-patterson'];

/** Play a particular variation today and hit the target. */
export function variationChallenge(date: Date | string = new Date()): VariationChallenge {
  const day = dailyKey(date);
  const variation = DAY_VARIATIONS[(dayNumber(day) + 2) % DAY_VARIATIONS.length];
  const t = VARIATION_TARGETS[seedOf(dailySeed(day), 'variation') % VARIATION_TARGETS.length];
  return {
    id: `${variation}-${t.id}`,
    variation,
    length: t.length,
    title: tr('{name} Day', { name: variationName(variation) }),
    target: t.target,
    check: (r) => r.variation === variation && t.ok(r),
  };
}

// ------------------------------------------------------------ rewards and streaks

export type DailyChallengeId = 'todaysHand' | 'perfectDiscard' | 'speedJong' | 'fourWinds' | 'variation';

/** Jong Points for completing each challenge once on its day. */
export const dailyRewards: Record<DailyChallengeId, number> = {
  todaysHand: 150,
  perfectDiscard: 100,
  speedJong: 150,
  fourWinds: 200,
  variation: 120,
};

/** Extra Jong Points for completing all five on one day. */
export const DAILY_SWEEP_BONUS = 250;

export const CLUB_REGULAR_DAYS = 30;

const uniqueDays = (dates: string[]) => [...new Set(dates.map((d) => isoDay(d)))].map(dayNumber).sort((a, b) => a - b);

/** Longest run of consecutive UTC days in a list of ISO dates (order and duplicates don't matter). */
export function longestStreak(dates: string[]): number {
  const days = uniqueDays(dates);
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] === days[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

/**
 * The run of consecutive days ending today, or ending yesterday if today has
 * not been played yet (the streak is still alive until the day is over).
 */
export function currentStreak(dates: string[], today: Date | string = new Date()): number {
  const set = new Set(uniqueDays(dates));
  let d = dayNumber(dailyKey(today));
  if (!set.has(d)) d--;
  let n = 0;
  while (set.has(d)) {
    n++;
    d--;
  }
  return n;
}

/** Club Regular: play on 30 days in a row. */
export function clubRegular(dates: string[], today: Date | string = new Date()) {
  const current = currentStreak(dates, today);
  const longest = longestStreak(dates);
  return { current, longest, target: CLUB_REGULAR_DAYS, achieved: longest >= CLUB_REGULAR_DAYS };
}

/** All of today's challenges in one call. */
export function dailyChallenges(date: Date | string = new Date()) {
  return {
    key: dailyKey(date),
    todaysHand: todaysHand(date),
    perfectDiscard: perfectDiscard(date),
    speedJong: speedJong(date),
    fourWinds: fourWinds(date),
    variation: variationChallenge(date),
    rewards: dailyRewards,
  };
}

/** Starting score of a variation, handy for turning final scores into deltas. */
export const startingScoreOf = (variation: string) => getProfile(variation)?.startingScore ?? 0;
