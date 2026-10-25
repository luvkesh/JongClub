// Mini-game progress on this device: best results per game, mode and layout,
// the daily puzzle results, and how many Jong Points each game has paid today.
// Rewards go into the profile's Jong Points (the Atelier's currency) and never
// touch rating. One storage key holds it all.

import { isoDay, seedOf } from '../club/util';
import type { MiniGameDef, MiniLevel, MiniResult } from './types';

/** The most Jong Points one mini-game pays per UTC day (the daily puzzle's bonus comes on top). */
export const MINI_DAILY_CAP = 600;
/** Bonus for solving the daily puzzle, once per day. */
export const DAILY_PUZZLE_BONUS = 150;

const KEY = 'jongclub.minigames.v1';

export interface MiniBest {
  score: number;
  /** Fastest win in seconds (0 until won). */
  seconds: number;
  wins: number;
  plays: number;
}

export interface MiniStore {
  best: Record<string, MiniBest>;
  /** Jong Points paid per game per day: earned[day][gameId]. */
  earned: Record<string, Record<string, number>>;
  /** Daily puzzle results by day. */
  daily: Record<string, { game: string; won: boolean; seconds: number; score: number }>;
  /** Games whose how-to has been seen (it opens by itself the first time). */
  seen: string[];
  totalEarned: number;
  /** Mark which tiles can be taken in layered games (default on). */
  highlightFree?: boolean;
  /** Seconds without a move before a move is suggested (0 is off; default 5). */
  suggestAfter?: number;
}

const empty = (): MiniStore => ({ best: {}, earned: {}, daily: {}, seen: [], totalEarned: 0 });

let mem: MiniStore | null = null;

export function loadMini(): MiniStore {
  if (mem) return mem;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    mem = raw && typeof raw === 'object' ? { ...empty(), ...raw } : empty();
  } catch {
    mem = empty();
  }
  // Keep a week of daily ledgers.
  const keep = new Set(Array.from({ length: 8 }, (_, i) => isoDay(new Date(Date.now() - i * 86400e3))));
  for (const d of Object.keys(mem!.earned)) if (!keep.has(d)) delete mem!.earned[d];
  return mem!;
}

/** Whether layered games mark free tiles (gold edge) and blocked ones (cool shade). */
export function highlightFree(): boolean {
  return loadMini().highlightFree !== false;
}

export function setHighlightFree(on: boolean) {
  loadMini().highlightFree = on;
  saveMini();
}

/** Seconds of pause before a move is suggested; 0 when off. */
export function suggestAfter(): number {
  const s = loadMini().suggestAfter;
  return typeof s === 'number' && s >= 0 ? s : 5;
}

export function setSuggestAfter(s: number) {
  loadMini().suggestAfter = s;
  saveMini();
}

export function saveMini() {
  try {
    if (mem) localStorage.setItem(KEY, JSON.stringify(mem));
  } catch {
    /* storage unavailable */
  }
}

/** Forget the cached copy (tests). */
export const resetMiniCache = () => void (mem = null);

export const bestKey = (game: string, level: MiniLevel, variant = '') => `${game}:${level}${variant ? `:${variant}` : ''}`;

export function bestOf(key: string): MiniBest | null {
  return loadMini().best[key] ?? null;
}

/** Best result for a game across its modes, for the hub card. */
export function bestForGame(game: string): MiniBest | null {
  const all = Object.entries(loadMini().best).filter(([k]) => k.startsWith(`${game}:`));
  if (!all.length) return null;
  return all.reduce<MiniBest>((a, [, b]) => ({ score: Math.max(a.score, b.score), seconds: a.seconds && b.seconds ? Math.min(a.seconds, b.seconds) : a.seconds || b.seconds, wins: a.wins + b.wins, plays: a.plays + b.plays }), { score: 0, seconds: 0, wins: 0, plays: 0 });
}

export interface RecordOutcome {
  newBestScore: boolean;
  newBestTime: boolean;
  best: MiniBest;
}

export function recordResult(key: string, r: MiniResult): RecordOutcome {
  const s = loadMini();
  const prev = s.best[key] ?? { score: 0, seconds: 0, wins: 0, plays: 0 };
  const next: MiniBest = { ...prev, plays: prev.plays + 1 };
  const newBestScore = r.score > prev.score;
  if (newBestScore) next.score = r.score;
  let newBestTime = false;
  if (r.won) {
    next.wins++;
    if (!prev.seconds || r.seconds < prev.seconds) {
      newBestTime = prev.seconds > 0 || prev.wins > 0;
      next.seconds = Math.max(1, Math.round(r.seconds));
    }
  }
  s.best[key] = next;
  saveMini();
  return { newBestScore: newBestScore && prev.plays > 0, newBestTime, best: next };
}

export const earnedToday = (game: string, day = isoDay(new Date())) => loadMini().earned[day]?.[game] ?? 0;

/** Jong Points still available from a game today. */
export const leftToday = (game: string) => Math.max(0, MINI_DAILY_CAP - earnedToday(game));

export interface Payout {
  /** What the result was worth before the cap. */
  base: number;
  /** What was paid (capped), plus the daily puzzle bonus. */
  paid: number;
  bonus: number;
  capped: boolean;
}

/**
 * Work out and log a payout. The caller adds `paid` to the profile's Jong
 * Points and saves the profile.
 */
export function payout(def: MiniGameDef, r: MiniResult, level: MiniLevel, daily: boolean, day = isoDay(new Date())): Payout {
  const s = loadMini();
  const base = Math.max(0, Math.round(def.reward(r, level)));
  const before = s.earned[day]?.[def.id] ?? 0;
  const room = Math.max(0, MINI_DAILY_CAP - before);
  const paid = Math.min(base, room);
  let bonus = 0;
  if (daily && r.won && !s.daily[day]?.won) bonus = DAILY_PUZZLE_BONUS;
  if (daily) {
    const was = s.daily[day];
    if (!was || (r.won && !was.won) || (r.won === was.won && r.score > was.score)) s.daily[day] = { game: def.id, won: r.won, seconds: Math.round(r.seconds), score: r.score };
  }
  (s.earned[day] ??= {})[def.id] = before + paid;
  s.totalEarned += paid + bonus;
  saveMini();
  return { base, paid: paid + bonus, bonus, capped: paid < base };
}

export function markSeen(game: string) {
  const s = loadMini();
  if (!s.seen.includes(game)) {
    s.seen.push(game);
    saveMini();
  }
}
export const seenHowTo = (game: string) => loadMini().seen.includes(game);

// ------------------------------------------------------------ daily puzzle

/** One seed per game per UTC day: everyone gets the same board. */
export const miniDailySeed = (game: string, date: Date | string = new Date()) => seedOf(`jongclub-mini-${game}`, isoDay(date));

/** Today's daily puzzle result, if played. */
export const dailyResult = (date: Date | string = new Date()) => loadMini().daily[isoDay(date)] ?? null;

/** Consecutive days solved, up to today (or yesterday when today is still open). */
export function dailyStreak(now = new Date()): number {
  const s = loadMini();
  let n = 0;
  for (let i = s.daily[isoDay(now)]?.won ? 0 : 1; i < 400; i++) {
    const d = isoDay(new Date(now.getTime() - i * 86400e3));
    if (s.daily[d]?.won) n++;
    else break;
  }
  return n;
}
