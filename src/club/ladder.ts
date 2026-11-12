// The cumulative leaderboard: a running table of every match played with the
// "Cumulative leaderboard" table option on. Each seat at the table (you, the
// club's AI regulars, or the people at a live table) gets a row by name, and
// a match adds its net result (final score minus the starting score),
// a win for first place and a tally of matches. Kept on this device, like
// the rest of the profile, until the club server opens.

import { tr } from '../i18n';

export interface LadderRow {
  name: string;
  /** Net points over the starting score, added up across matches. */
  points: number;
  matches: number;
  /** First places (a shared first place counts). */
  wins: number;
  /** Net points per variation id. */
  byVariation: Record<string, number>;
  /** The last match's ISO date. */
  last: string;
}

export interface LadderResult {
  variation: string;
  /** Every seat's name, final score and the starting score they began from. */
  seats: { name: string; score: number }[];
  startingScore: number;
  /** Team play: the two team totals, East–West then South–North (a team win counts for both partners). */
  teams?: [number, number];
  date?: string;
}

export const LADDER_KEY = 'jongclub.ladder.v1';

export function loadLadder(): LadderRow[] {
  try {
    const raw = localStorage.getItem(LADDER_KEY);
    const rows = raw ? (JSON.parse(raw) as LadderRow[]) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function saveLadder(rows: LadderRow[]) {
  try {
    localStorage.setItem(LADDER_KEY, JSON.stringify(rows));
  } catch {
    /* storage blocked: the table lives for this visit only */
  }
}

/** Best points first, then more wins, then the name. */
export function sortLadder(rows: LadderRow[]): LadderRow[] {
  return rows.slice().sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
}

/** Add a finished match to the ladder (pure: returns the new rows). */
export function addToLadder(rows: LadderRow[], r: LadderResult): LadderRow[] {
  const out = rows.map((x) => ({ ...x, byVariation: { ...x.byVariation } }));
  const top = r.teams ? Math.max(...r.teams) : Math.max(...r.seats.map((s) => s.score));
  r.seats.forEach((s, seat) => {
    let row = out.find((x) => x.name === s.name);
    if (!row) out.push((row = { name: s.name, points: 0, matches: 0, wins: 0, byVariation: {}, last: '' }));
    const net = s.score - r.startingScore;
    row.points += net;
    row.matches += 1;
    const won = r.teams ? r.teams[seat % 2] === top : s.score === top;
    if (won) row.wins += 1;
    row.byVariation[r.variation] = (row.byVariation[r.variation] ?? 0) + net;
    row.last = r.date ?? new Date().toISOString();
  });
  return out;
}

/** Record a match and say where `me` now stands: "Cumulative leaderboard: 2nd of 5 with 3,400 points". */
export function recordLadder(r: LadderResult, me: string): { rows: LadderRow[]; rank: number; points: number } {
  const rows = sortLadder(addToLadder(loadLadder(), r));
  saveLadder(rows);
  const i = rows.findIndex((x) => x.name === me);
  return { rows, rank: i + 1, points: rows[i]?.points ?? 0 };
}

export function clearLadder() {
  try {
    localStorage.removeItem(LADDER_KEY);
  } catch {
    /* storage blocked */
  }
}

/** "1st", "2nd"... for the ladder line (the profile's ordinal is for places too). */
export function ladderLine(rank: number, of: number, points: number, fmt: (n: number) => string, ordinal: (n: number) => string): string {
  const pts = points >= 0 ? `+${fmt(points)}` : `−${fmt(-points)}`;
  return tr('Cumulative leaderboard: you are {rank} of {n} with {points} points over all your matches.', { rank: ordinal(rank), n: of, points: pts });
}
