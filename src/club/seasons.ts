// Club Seasons: six-week seasons, each themed on a World Tour destination.
// The calendar is derived from a fixed epoch (like the daily seeds in
// daily.ts), so every member of the club is in the same season on the same
// day. Season XP comes only from playing: finished games, daily challenges,
// lessons and drills. The reward track is cosmetics and Jong Points only:
// no paid track, nothing random, nothing that touches play or rating.
// Pure logic, no DOM; storage lives in progression/season.ts.

import { SEASON_THEMES, seasonFrameId, seasonTableId, seasonTileSetId, type SeasonTheme } from '../cosmetics/seasonal';
import type { CosmeticCategory } from '../cosmetics/catalog';
import { dayNumber, isoDay } from './util';
import { tr } from '../i18n';

// ------------------------------------------------------------ calendar

/** Season 1 began on this Monday (UTC). */
export const SEASON_EPOCH = '2026-10-05';
export const SEASON_WEEKS = 6;
export const SEASON_DAYS = SEASON_WEEKS * 7;
const DAY_MS = 86_400_000;

export interface SeasonInfo {
  /** 1, 2, 3 ... */
  number: number;
  theme: SeasonTheme;
  /** First day (UTC midnight) and the first day of the next season. */
  start: Date;
  end: Date;
  /** Day of the season, 0..41. */
  day: number;
  /** Week of the season, 1..6. */
  week: number;
  /** Whole days left, counting today. */
  daysLeft: number;
  /** The last week: the Season Finals are open. */
  finalsOpen: boolean;
}

/** The theme of a season number (themes cycle). */
export const themeOf = (n: number) => SEASON_THEMES[(((n - 1) % SEASON_THEMES.length) + SEASON_THEMES.length) % SEASON_THEMES.length];

/** The season a date falls in. Dates before the epoch count as season 1. */
export function seasonAt(date: Date | string = new Date()): SeasonInfo {
  const d = dayNumber(isoDay(date)) - dayNumber(SEASON_EPOCH);
  const idx = Math.max(0, Math.floor(d / SEASON_DAYS));
  const day = Math.max(0, d - idx * SEASON_DAYS);
  return seasonInfo(idx + 1, day);
}

/** A season by number (day 0 unless given). */
export function seasonInfo(n: number, day = 0): SeasonInfo {
  const start = new Date(dayNumber(SEASON_EPOCH) * DAY_MS + (n - 1) * SEASON_DAYS * DAY_MS);
  const week = Math.floor(day / 7) + 1;
  return { number: n, theme: themeOf(n), start, end: new Date(start.getTime() + SEASON_DAYS * DAY_MS), day, week, daysLeft: SEASON_DAYS - day, finalsOpen: week === SEASON_WEEKS };
}

// ------------------------------------------------------------ season XP

export type SeasonXpSource = 'game' | 'daily' | 'lesson' | 'drill' | 'event';

/** Suggested amounts for callers that do not compute their own. */
export const SEASON_XP: Record<SeasonXpSource, number> = { game: 60, daily: 50, lesson: 80, drill: 15, event: 40 };

/** The most any single award can be worth (guards against bad callers). */
export const SEASON_XP_MAX_AWARD = 600;

export interface SeasonGameSummary {
  placement: number;
  handsPlayed: number;
  handsWon: number;
  variation: string;
}

/**
 * Season XP for a finished game: something for sitting down, more for every
 * hand played and won, a little for placing well, and a quarter more at the
 * season's own destination. Never anything for spending.
 */
export function seasonXpForGame(m: SeasonGameSummary, season: SeasonInfo): number {
  const hands = Math.min(16, Math.max(0, m.handsPlayed));
  let xp = 30 + 8 * hands + 12 * Math.min(hands, Math.max(0, m.handsWon)) + ([25, 12, 5, 0][m.placement - 1] ?? 0);
  if (isSeasonDestination(m.variation, season)) xp = Math.round(xp * 1.25);
  return Math.min(SEASON_XP_MAX_AWARD, xp);
}

/** Is this variation the season's destination (the Dubai season counts every UAE table)? */
export const isSeasonDestination = (variation: string, season: SeasonInfo) => variation === season.theme.destination || (season.theme.destination === 'uae' && variation.startsWith('uae'));

// ------------------------------------------------------------ the reward track

export const SEASON_STEPS = 20;

/** XP to go from step k-1 to step k (k = 1..20): 200, 210, ... 390. */
export const stepCost = (k: number) => 200 + 10 * (k - 1);

/** Total XP to reach step k. */
export const xpToReach = (k: number) => {
  let t = 0;
  for (let i = 1; i <= Math.min(k, SEASON_STEPS); i++) t += stepCost(i);
  return t;
};

export const SEASON_TOTAL_XP = xpToReach(SEASON_STEPS);

/** The step reached with this much XP (0..20), and progress to the next. */
export function stepOf(xp: number): { step: number; into: number; need: number } {
  let step = 0;
  let left = Math.max(0, xp);
  while (step < SEASON_STEPS && left >= stepCost(step + 1)) {
    left -= stepCost(step + 1);
    step++;
  }
  return { step, into: step >= SEASON_STEPS ? 0 : left, need: step >= SEASON_STEPS ? 0 : stepCost(step + 1) };
}

export interface SeasonReward {
  step: number;
  label: string;
  jongPoints?: number;
  cosmetic?: { category: CosmeticCategory; id: string };
}

/** Jong Points at the steps that do not carry a cosmetic. */
const JP_STEPS: Record<number, number> = { 1: 100, 2: 150, 3: 150, 4: 200, 6: 200, 7: 250, 8: 250, 9: 300, 11: 300, 12: 350, 13: 350, 14: 400, 15: 400, 16: 450, 17: 450, 18: 500, 19: 500 };

/** The season's track: 20 steps, the frame at 5, the cloth at 10 and the tile set at 20. */
export function rewardTrack(theme: SeasonTheme): SeasonReward[] {
  const out: SeasonReward[] = [];
  for (let k = 1; k <= SEASON_STEPS; k++) {
    if (k === 5) out.push({ step: k, label: tr('{name} Frame', { name: theme.name }), cosmetic: { category: 'frame', id: seasonFrameId(theme.id) } });
    else if (k === 10) out.push({ step: k, label: tr('{name} Cloth', { name: theme.name }), cosmetic: { category: 'table', id: seasonTableId(theme.id) } });
    else if (k === 20) out.push({ step: k, label: tr('{name} Tiles', { name: theme.name }), cosmetic: { category: 'tileSet', id: seasonTileSetId(theme.id) } });
    else out.push({ step: k, label: tr('{n} Jong Points', { n: JP_STEPS[k] }), jongPoints: JP_STEPS[k] });
  }
  return out;
}

// ------------------------------------------------------------ progress and claiming

/** One player's progress in one season. Plain JSON. */
export interface SeasonProgress {
  season: number;
  xp: number;
  /** Steps whose reward has been collected. */
  claimed: number[];
  /** XP by source, for the season screen. */
  bySource: Partial<Record<SeasonXpSource, number>>;
}

export const emptyProgress = (season: number): SeasonProgress => ({ season, xp: 0, claimed: [], bySource: {} });

/** Add XP (whole, non-negative, capped per award). Returns the XP actually added. */
export function addXp(p: SeasonProgress, source: SeasonXpSource, amount: number): number {
  const add = Math.max(0, Math.min(SEASON_XP_MAX_AWARD, Math.round(Number.isFinite(amount) ? amount : 0)));
  p.xp += add;
  p.bySource[source] = (p.bySource[source] ?? 0) + add;
  return add;
}

/** Steps reached but not yet collected. */
export const claimable = (p: SeasonProgress) => Array.from({ length: stepOf(p.xp).step }, (_, i) => i + 1).filter((k) => !p.claimed.includes(k));

/** What a reward needs from the player's profile: Jong Points and owned cosmetics ("category:id"). */
export interface RewardWallet {
  jongPoints: number;
  owned: string[];
}

/**
 * Collect one step's reward into the wallet. Returns the reward, or null if
 * the step is not reached or already collected. Collecting twice never pays twice.
 */
export function claimStep(p: SeasonProgress, step: number, wallet: RewardWallet): SeasonReward | null {
  if (step < 1 || step > SEASON_STEPS || p.claimed.includes(step) || stepOf(p.xp).step < step) return null;
  const r = rewardTrack(themeOf(p.season))[step - 1];
  if (r.jongPoints) wallet.jongPoints += r.jongPoints;
  if (r.cosmetic) {
    const key = `${r.cosmetic.category}:${r.cosmetic.id}`;
    if (!wallet.owned.includes(key)) wallet.owned.push(key);
  }
  p.claimed = [...p.claimed, step].sort((a, b) => a - b);
  return r;
}

/** Collect everything reached. */
export function claimAll(p: SeasonProgress, wallet: RewardWallet): SeasonReward[] {
  return claimable(p)
    .map((k) => claimStep(p, k, wallet))
    .filter((r): r is SeasonReward => !!r);
}

// ------------------------------------------------------------ Season Finals

/** Reach this step to be invited to the Season Finals. */
export const FINALS_STEP = 6;

export const finalsQualified = (p: SeasonProgress) => stepOf(p.xp).step >= FINALS_STEP;
