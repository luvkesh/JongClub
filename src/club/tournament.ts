// Club tournaments: an AI field drawn from the roster plus the human. Tables
// the human is not at are simulated headlessly; the human's own table is
// played in the UI and its result passed to playRound. All state is plain
// JSON so the UI can keep it in localStorage between sessions.
// Prizes are Jong Points, trophies and cosmetics. Never money.

import type { Difficulty, Personality } from '../ai/players';
import { placementPoints } from './placement';
import type { GameLength } from '../engine/rounds';
import { VARIATIONS } from '../engine/rules';
import { Rng } from '../engine/rng';
import { difficultyForRating, ROSTER, type VariationId } from './roster';
import { buildProfile, simulateMatch } from './sim';
import { dayNumber, dayStart, isoDay, seedOf, unit } from './util';
import { tr } from '../i18n';
import { seasonAt } from './seasons';

/** 'season' is the Season Finals (club/seasons.ts): entered from the Season page, not listed with the others. */
export type FormatId = 'quick' | 'daily' | 'weekend' | 'global' | 'season';

export interface PrizeLine {
  /** Places from..to inclusive (1 = champion). */
  from: number;
  to: number;
  jongPoints: number;
  /** Cosmetic id from cosmetics/catalog.ts. */
  cosmetic?: string;
  /** Trophy id from TROPHIES. */
  trophy?: string;
}

export interface TournamentFormat {
  id: FormatId;
  name: string;
  /** Entry fee in Jong Points (0 = free). */
  entry: number;
  maxPlayers: number;
  /** Swiss rounds before any final. */
  rounds: number;
  length: GameLength;
  /** Top four after the Swiss rounds play one more table for the title. */
  finalTable: boolean;
  /** Invitation threshold on the human's rating (0 = open). */
  minRating: number;
  prizes: PrizeLine[];
  /** When it runs, in words. */
  schedule: string;
  formatText: string;
  rulesText: string;
}

export interface Trophy {
  id: string;
  name: string;
  blurb: string;
}

export const TROPHIES: Trophy[] = [
  { id: 'trophy-quick-cup', name: tr('Quick Table Cup'), blurb: tr('Top of an eight-player Quick Tournament.') },
  { id: 'trophy-daily-laurel', name: tr('Evening Laurel'), blurb: tr('Champion of a Daily Tournament.') },
  { id: 'trophy-weekend-crown', name: tr('Weekend Crown'), blurb: tr('Winner of the Weekend Championship final table.') },
  { id: 'trophy-global-dragon', name: tr('Golden Dragon'), blurb: tr('Champion of the invitation-only Global Championship.') },
  { id: 'trophy-season-finals', name: tr('Season Finals Cup'), blurb: tr('Champion of a Club Season’s closing tournament.') },
];

/** Placement points at each table: 1st 4, 2nd 2, 3rd 1, 4th 0. */
export const PLACEMENT_POINTS = [4, 2, 1, 0];

const STANDINGS_RULE = tr('Placement points at each table: 4 for first, 2 for second, 1 for third, 0 for fourth. Ties on points are broken by total score change across all rounds.');

export const FORMATS: Record<FormatId, TournamentFormat> = {
  quick: {
    id: 'quick',
    name: tr('Quick Tournament'),
    entry: 0,
    maxPlayers: 8,
    rounds: 3,
    length: 'oneHand',
    finalTable: false,
    minRating: 0,
    prizes: [
      { from: 1, to: 1, jongPoints: 250, trophy: 'trophy-quick-cup' },
      { from: 2, to: 2, jongPoints: 120 },
      { from: 3, to: 3, jongPoints: 60 },
    ],
    schedule: tr('Starts whenever you are ready.'),
    formatText: tr('Eight players at two tables. Three rounds of single hands, re-seated by standings after each round.'),
    rulesText: `${STANDINGS_RULE} ${tr('After each round the leaders sit together, Swiss style.')}`,
  },
  daily: {
    id: 'daily',
    name: tr('Daily Tournament'),
    entry: 200,
    maxPlayers: 16,
    rounds: 3,
    length: 'eastRound',
    finalTable: false,
    minRating: 0,
    prizes: [
      { from: 1, to: 1, jongPoints: 1500, trophy: 'trophy-daily-laurel' },
      { from: 2, to: 2, jongPoints: 800 },
      { from: 3, to: 3, jongPoints: 400 },
      { from: 4, to: 4, jongPoints: 200 },
    ],
    schedule: tr('Every day at 20:00 UTC.'),
    formatText: tr('Sixteen players at four tables. Three rounds of East rounds, re-seated by standings.'),
    rulesText: `${STANDINGS_RULE} ${tr('The variation changes with the day of the week.')}`,
  },
  weekend: {
    id: 'weekend',
    name: tr('Weekend Championship'),
    entry: 500,
    maxPlayers: 32,
    rounds: 4,
    length: 'eastRound',
    finalTable: true,
    minRating: 0,
    prizes: [
      { from: 1, to: 1, jongPoints: 5000, cosmetic: 'frame-champion', trophy: 'trophy-weekend-crown' },
      { from: 2, to: 2, jongPoints: 2500 },
      { from: 3, to: 3, jongPoints: 1200 },
      { from: 4, to: 4, jongPoints: 600 },
      { from: 5, to: 8, jongPoints: 300 },
    ],
    schedule: tr('Saturdays at 18:00 UTC.'),
    formatText: tr('Thirty-two players at eight tables. Four rounds of East rounds, then the top four meet at the final table.'),
    rulesText: `${STANDINGS_RULE} ${tr('The final table decides first to fourth place; everyone else is ranked by standings.')}`,
  },
  global: {
    id: 'global',
    name: tr('Global Championship'),
    entry: 1000,
    maxPlayers: 64,
    rounds: 4,
    length: 'eastRound',
    finalTable: true,
    minRating: 1700,
    prizes: [
      { from: 1, to: 1, jongPoints: 15000, cosmetic: 'frame-champion', trophy: 'trophy-global-dragon' },
      { from: 2, to: 2, jongPoints: 7500 },
      { from: 3, to: 3, jongPoints: 4000 },
      { from: 4, to: 4, jongPoints: 2000 },
      { from: 5, to: 8, jongPoints: 1000 },
      { from: 9, to: 16, jongPoints: 500 },
    ],
    schedule: tr('The first Sunday of every month at 16:00 UTC. By invitation: rating 1,700 or higher.'),
    formatText: tr('Sixty-four invited players at sixteen tables. Four rounds of East rounds, then a final table of the top four.'),
    rulesText: `${STANDINGS_RULE} ${tr('Invitation only: a rating of 1,700 or more. The final table decides the champion.')}`,
  },
  season: {
    id: 'season',
    name: tr('Season Finals'),
    entry: 0,
    maxPlayers: 16,
    rounds: 2,
    length: 'eastRound',
    finalTable: true,
    minRating: 0,
    prizes: [
      { from: 1, to: 1, jongPoints: 2000, trophy: 'trophy-season-finals' },
      { from: 2, to: 2, jongPoints: 1000 },
      { from: 3, to: 3, jongPoints: 600 },
      { from: 4, to: 4, jongPoints: 400 },
      { from: 5, to: 8, jongPoints: 200 },
    ],
    schedule: tr('The last week of every Club Season.'),
    formatText: tr('Sixteen players at four tables, at the season’s destination. Two rounds of East rounds, then the top four meet at the final table.'),
    rulesText: `${STANDINGS_RULE} ${tr('Free to enter for players who reach step 6 of the season’s reward track.')}`,
  },
};

export const FORMAT_IDS: FormatId[] = ['quick', 'daily', 'weekend', 'global'];

const HOURS = 3_600_000;
const DAY = 24 * HOURS;

/**
 * The next start at or after the beginning of `date`'s UTC day:
 * quick = `date` itself; daily = 20:00 UTC that day; weekend = the coming
 * Saturday (or that day) at 18:00 UTC; global = the first Sunday of the month
 * at 16:00 UTC, or next month's if this month's has gone.
 */
export function startTime(formatId: FormatId, date: Date = new Date()): Date {
  const day = dayStart(isoDay(date));
  switch (formatId) {
    case 'quick':
    case 'season':
      return new Date(date.getTime());
    case 'daily':
      return new Date(day.getTime() + 20 * HOURS);
    case 'weekend': {
      const ahead = (6 - day.getUTCDay() + 7) % 7;
      return new Date(day.getTime() + ahead * DAY + 18 * HOURS);
    }
    case 'global': {
      const firstSunday = (y: number, m: number) => {
        const first = new Date(Date.UTC(y, m, 1));
        return new Date(first.getTime() + ((7 - first.getUTCDay()) % 7) * DAY + 16 * HOURS);
      };
      const here = firstSunday(day.getUTCFullYear(), day.getUTCMonth());
      return here.getTime() >= day.getTime() ? here : firstSunday(day.getUTCFullYear(), day.getUTCMonth() + 1);
    }
  }
}

/** Whether the human can enter. Only the Global Championship is by invitation. */
export function entryStatus(formatId: FormatId, rating: number): { locked: boolean; reason?: string } {
  const f = FORMATS[formatId];
  if (rating < f.minRating) return { locked: true, reason: tr('Invitation only: reach a rating of {n} to be invited (you have {have}).', { n: f.minRating ?? 0, have: Math.round(rating) }) };
  return { locked: false };
}

const ROTATION: VariationId[] = ['classic', 'riichi', 'taiwanese', 'uae', 'vietnamese', 'singapore', 'indian', 'hongkong', 'mcr', 'sichuan', 'malaysian'];

/** Default variation: Quick is Classic; the others rotate by day, week or month. */
export function tournamentVariation(formatId: FormatId, date: Date = new Date()): VariationId {
  const d = dayNumber(isoDay(date));
  switch (formatId) {
    case 'quick':
      return 'classic';
    case 'daily':
      return ROTATION[d % ROTATION.length];
    case 'weekend':
      return ROTATION[Math.floor((d + 3) / 7) % ROTATION.length];
    case 'global':
      return ROTATION[(date.getUTCFullYear() * 12 + date.getUTCMonth()) % ROTATION.length];
    case 'season':
      return seasonAt(date).theme.destination as VariationId;
  }
}

// ------------------------------------------------------------ state

export interface Entrant {
  /** 'you' for the human, otherwise the roster member id. */
  id: string;
  name: string;
  rating: number;
  human: boolean;
  difficulty: Difficulty;
  personality: Personality;
  /** Placement points from the Swiss rounds. */
  points: number;
  /** Sum of score changes across all tables played. */
  totalScore: number;
  /** Placement (1..4) at each table played, in order. */
  placements: number[];
}

export interface TableSeating {
  table: number;
  /** Entrant indices in seat order; seat 0 deals first. The human is always seat 0. */
  seats: number[];
  final: boolean;
  seed: number;
}

export interface TableOutcome {
  table: number;
  seats: number[];
  /** Final score per seat. */
  scores: number[];
  /** Score change per seat. */
  deltas: number[];
  /** Placement per seat, 1..4. */
  placements: number[];
  /** Hands played (0 when supplied by the UI and unknown). */
  hands: number;
  /** Placement scoring: uma points per seat. */
  uma?: number[];
}

export interface RoundRecord {
  round: number;
  final: boolean;
  tables: TableOutcome[];
}

export interface TournamentState {
  version: 1;
  id: string;
  formatId: FormatId;
  name: string;
  variation: string;
  length: GameLength;
  seed: number;
  /** ISO timestamps. */
  createdAt: string;
  startsAt: string;
  /** Index 0 is the human. */
  entrants: Entrant[];
  /** Swiss rounds in this tournament (the final table is extra). */
  swissRounds: number;
  /** Rounds completed so far, final included. */
  roundsPlayed: number;
  /** Tables for the round in progress, or null between rounds. */
  current: TableSeating[] | null;
  /** AI tables of the current round already simulated. */
  pending: TableOutcome[];
  history: RoundRecord[];
  finished: boolean;
  /** Placement scoring: `points` hold uma placement points (one decimal) instead of 4/2/1/0. */
  scoring?: TournamentScoring;
}

export const HUMAN_INDEX = 0;

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** How standings count: placement points 4/2/1/0, or tournament placement scoring (uma). */
export type TournamentScoring = 'standings' | 'placement';

export interface CreateOptions {
  /** Standings (default) or placement points with uma, added up across rounds. */
  scoring?: TournamentScoring;
  /** Override the default variation for the format and date. */
  variation?: VariationId;
  /** Override the hand length (e.g. 'oneHand' for a short practice event). */
  length?: GameLength;
}

/** Build a tournament: the human plus an AI field from the roster. Throws if the human is not invited. */
export function createTournament(formatId: FormatId, date: Date, human: { name: string; rating: number }, seed: number, opts: CreateOptions = {}): TournamentState {
  const f = FORMATS[formatId];
  const gate = entryStatus(formatId, human.rating);
  if (gate.locked) throw new Error(gate.reason);
  const need = f.maxPlayers - 1;
  // The Global field is the club's strongest; elsewhere members near your rating.
  const field =
    formatId === 'global'
      ? [...ROSTER].sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id)).slice(0, need)
      : [...ROSTER]
          .map((m) => ({ m, key: Math.abs(m.rating - human.rating) + unit(seed, 'field', m.id) * 350 }))
          .sort((a, b) => a.key - b.key)
          .slice(0, need)
          .map((x) => x.m);
  const variation = opts.variation ?? tournamentVariation(formatId, date);
  const entrants: Entrant[] = [
    { id: 'you', name: human.name, rating: human.rating, human: true, difficulty: difficultyForRating(human.rating), personality: 'zen', points: 0, totalScore: 0, placements: [] },
    ...field.map((m) => ({
      id: m.id,
      name: m.name,
      rating: m.ratings[variation as VariationId] ?? m.rating,
      human: false,
      difficulty: m.difficulty,
      personality: m.personality,
      points: 0,
      totalScore: 0,
      placements: [],
    })),
  ];
  return {
    version: 1,
    id: `${formatId}-${isoDay(date)}-${seed >>> 0}`,
    formatId,
    name: f.name,
    variation,
    length: opts.length ?? f.length,
    seed: seed >>> 0,
    createdAt: date.toISOString(),
    startsAt: startTime(formatId, date).toISOString(),
    entrants,
    swissRounds: f.rounds,
    roundsPlayed: 0,
    current: null,
    pending: [],
    history: [],
    finished: false,
    ...(opts.scoring === 'placement' ? { scoring: 'placement' as const } : {}),
  };
}

/** The scoring line for a tournament's rules panel. */
export const PLACEMENT_RULE = tr('Placement scoring: each table pays +15, +5, −5 and −15 by place, plus each player’s score difference in thousands (hundreds at smaller-stake tables), added up across rounds. Ties are broken by total score change.');

export const isFinished = (s: TournamentState) => s.finished;

/** True when the next round to seat is the final table. */
export const isFinalNext = (s: TournamentState) => !s.finished && FORMATS[s.formatId].finalTable && s.roundsPlayed >= s.swissRounds;

/** Seat the tables for the next round (Swiss by standings; first round a seeded draw). */
export function nextRound(state: TournamentState): TournamentState {
  if (state.finished) throw new Error(tr('The tournament is over'));
  if (state.current) return state;
  const s = clone(state);
  const round = s.roundsPlayed;
  const seed = seedOf(s.seed, 'round', round);
  let order: number[];
  if (isFinalNext(s)) {
    order = standings(s)
      .slice(0, 4)
      .map((r) => r.index);
    s.current = [{ table: 0, seats: humanFirst(order, seed), final: true, seed: seedOf(seed, 'final') }];
    s.pending = [];
    return s;
  }
  if (round === 0) order = new Rng(seed).shuffle(s.entrants.map((_, i) => i));
  else order = standings(s).map((r) => r.index);
  const tables: TableSeating[] = [];
  for (let t = 0; t * 4 < order.length; t++) {
    const group = order.slice(t * 4, t * 4 + 4);
    tables.push({ table: t, seats: humanFirst(group, seedOf(seed, t)), final: false, seed: seedOf(seed, 'table', t) });
  }
  s.current = tables;
  s.pending = [];
  return s;
}

/** Shuffle seats deterministically, then put the human (if present) at seat 0. */
function humanFirst(group: number[], seed: number): number[] {
  const seats = new Rng(seed).shuffle(group.slice());
  const h = seats.indexOf(HUMAN_INDEX);
  if (h > 0) [seats[0], seats[h]] = [seats[h], seats[0]];
  return seats;
}

/** Details the UI needs to play the human's table this round, or null if the human is not seated. */
export function humanTable(state: TournamentState) {
  const t = state.current?.find((x) => x.seats.includes(HUMAN_INDEX));
  if (!t) return null;
  return {
    table: t.table,
    final: t.final,
    seed: t.seed,
    variation: state.variation,
    length: state.length,
    /** Seats 1..3, in seat order. */
    opponents: t.seats.slice(1).map((i) => {
      const e = state.entrants[i];
      return { entrant: i, id: e.id, name: e.name, rating: e.rating, difficulty: e.difficulty, personality: e.personality };
    }),
  };
}

/** AI tables in the current round not yet simulated (use with playAiTable to spread work out). */
export const pendingAiTables = (state: TournamentState): number[] =>
  (state.current ?? []).filter((t) => !t.seats.includes(HUMAN_INDEX) && !state.pending.some((p) => p.table === t.table)).map((t) => t.table);

/** Simulate one AI table of the current round; the outcome is held until playRound commits it. */
export function playAiTable(state: TournamentState, table: number): TournamentState {
  const t = state.current?.find((x) => x.table === table);
  if (!t) throw new Error('No such table this round');
  if (t.seats.includes(HUMAN_INDEX)) throw new Error('That is your table: play it and pass the result to playRound');
  if (state.pending.some((p) => p.table === table)) return state;
  const s = clone(state);
  const es = t.seats.map((i) => s.entrants[i]);
  const r = simulateMatch({
    variation: s.variation,
    length: s.length,
    difficulties: es.map((e) => e.difficulty),
    personalities: es.map((e) => e.personality),
    names: es.map((e) => e.name),
    seed: t.seed,
  });
  const scores = t.seats.map((_, seat) => r.standings.find((x) => x.seat === seat)!.score);
  s.pending.push(outcome(s, t, scores, r.hands));
  return s;
}

function outcome(s: TournamentState, t: TableSeating, scores: number[], hands: number): TableOutcome {
  const start = buildProfile(s.variation, s.length).startingScore;
  const order = scores.map((sc, seat) => ({ sc, seat })).sort((a, b) => b.sc - a.sc || a.seat - b.seat);
  const placements = scores.map((_, seat) => order.findIndex((o) => o.seat === seat) + 1);
  const out: TableOutcome = { table: t.table, seats: t.seats.slice(), scores, deltas: scores.map((x) => x - start), placements, hands };
  if (s.scoring === 'placement') out.uma = placementPoints(scores, start);
  return out;
}

/** The human's table result: final score per seat, as MatchHooks.onFinished reports standings. */
export type HumanTableResult = { seat: number; score: number }[];

/**
 * Finish the current round: simulate every remaining AI table and record the
 * human's table from `humanResult`. Required whenever the human is seated.
 */
export function playRound(state: TournamentState, humanResult?: HumanTableResult): TournamentState {
  let s = state.current ? state : nextRound(state);
  for (const t of pendingAiTables(s)) s = playAiTable(s, t);
  s = clone(s);
  const tables = s.current!;
  const outcomes = s.pending.slice();
  const mine = tables.find((t) => t.seats.includes(HUMAN_INDEX));
  if (mine) {
    if (!humanResult || humanResult.length !== mine.seats.length) throw new Error('Pass the result of your table: a score for each of its four seats');
    const scores = mine.seats.map((_, seat) => {
      const r = humanResult.find((x) => x.seat === seat);
      if (!r) throw new Error(`Missing score for seat ${seat}`);
      return r.score;
    });
    outcomes.push(outcome(s, mine, scores, 0));
  }
  outcomes.sort((a, b) => a.table - b.table);
  const final = tables[0].final;
  for (const o of outcomes)
    o.seats.forEach((idx, seat) => {
      const e = s.entrants[idx];
      e.totalScore += o.deltas[seat];
      e.placements.push(o.placements[seat]);
      if (!final) e.points = s.scoring === 'placement' ? Math.round((e.points + (o.uma?.[seat] ?? 0)) * 10) / 10 : e.points + (PLACEMENT_POINTS[o.placements[seat] - 1] ?? 0);
    });
  s.history.push({ round: s.roundsPlayed, final, tables: outcomes });
  s.roundsPlayed++;
  s.current = null;
  s.pending = [];
  const f = FORMATS[s.formatId];
  s.finished = final || (!f.finalTable && s.roundsPlayed >= s.swissRounds);
  return s;
}

export interface StandingRow {
  rank: number;
  index: number;
  id: string;
  name: string;
  human: boolean;
  points: number;
  totalScore: number;
  placements: number[];
  /** Place at the final table, when one has been played. */
  finalPlace?: number;
}

/** Live standings: placement points, then total score change, then rating. After a final, its result sets the top four. */
export function standings(state: TournamentState): StandingRow[] {
  const finalRound = state.history.find((r) => r.final);
  const finalPlace = new Map<number, number>();
  if (finalRound) for (const t of finalRound.tables) t.seats.forEach((idx, seat) => finalPlace.set(idx, t.placements[seat]));
  return state.entrants
    .map((e, index) => ({ e, index }))
    .sort((a, b) => {
      const fa = finalPlace.get(a.index) ?? 99;
      const fb = finalPlace.get(b.index) ?? 99;
      return fa - fb || b.e.points - a.e.points || b.e.totalScore - a.e.totalScore || b.e.rating - a.e.rating || a.e.id.localeCompare(b.e.id);
    })
    .map(({ e, index }, i) => ({
      rank: i + 1,
      index,
      id: e.id,
      name: e.name,
      human: e.human,
      points: e.points,
      totalScore: e.totalScore,
      placements: e.placements.slice(),
      finalPlace: finalPlace.get(index),
    }));
}

export interface PrizeAward {
  place: number;
  index: number;
  name: string;
  human: boolean;
  jongPoints: number;
  cosmetic?: string;
  trophy?: string;
}

/** Prizes by final place; empty until the tournament is finished. */
export function prizes(state: TournamentState): PrizeAward[] {
  if (!state.finished) return [];
  const f = FORMATS[state.formatId];
  const out: PrizeAward[] = [];
  for (const row of standings(state)) {
    const line = f.prizes.find((p) => row.rank >= p.from && row.rank <= p.to);
    if (!line) continue;
    out.push({ place: row.rank, index: row.index, name: row.name, human: row.human, jongPoints: line.jongPoints, cosmetic: line.cosmetic, trophy: line.trophy });
  }
  return out;
}

/** The human's prize, if any. */
export const humanPrize = (state: TournamentState) => prizes(state).find((p) => p.human) ?? null;

/** Display name of the tournament's variation. */
export const variationLabel = (state: TournamentState) => VARIATIONS.find((v) => v.id === state.variation)?.name ?? state.variation;
