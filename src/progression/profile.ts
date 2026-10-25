// Player profile and progression, stored on this device.

import { DEFAULT_AVATAR, DEFAULT_LOADOUT, type AvatarSpec, type Loadout } from '../cosmetics/catalog';
import { VARIATIONS } from '../engine/rules';
import { lang, tr } from '../i18n';

// Three separate systems as the brief requires: Jong Points (currency),
// Rating (competitive, ranked only, never purchasable) and Club Level (XP).

export interface GameRecord {
  date: string;
  variation: string;
  length: string;
  placement: number;
  score: number;
  points: number;
  handsWon: number;
}

export interface Profile {
  name: string;
  jongPoints: number;
  xp: number;
  rating: number;
  ratedGames: number;
  games: number;
  gamesWon: number;
  handsPlayed: number;
  handsWon: number;
  selfDrawWins: number;
  bestHand: { points: number; value: number; name: string } | null;
  streak: number;
  longestStreak: number;
  daysPlayed: string[];
  achievements: Record<string, string>;
  history: GameRecord[];
  variationGames: Record<string, number>;
  variationWins: Record<string, number>;
  tileSet: string;
  table: string;
  lessonsDone: string[];
  /** Competitive rating per variation (overall lives in `rating`). */
  ratings: Record<string, number>;
  ratedByVariation: Record<string, number>;
  ratingHistory: { date: string; rating: number; variation: string }[];
  /** Per-variation analytics. */
  varStats: Record<string, VarStats>;
  /** Owned cosmetics as "category:id". */
  owned: string[];
  loadout: Loadout;
  avatar: AvatarSpec;
  region: string;
  /** Home city and ISO country code for city and country leaderboards, and how they were found. */
  city?: string;
  country?: string;
  locSource?: 'gps' | 'ip' | 'tz' | 'manual';
  /** Club members you follow (roster ids) and players you've met live (by name). */
  following: string[];
  friends: { id: string; name: string; since: string }[];
  /** Daily challenge results by UTC date. */
  daily: Record<string, DailyRecord>;
  trophies: { id: string; name: string; date: string }[];
}

export interface VarStats {
  games: number;
  wins: number;
  hands: number;
  handsWon: number;
  decisions: number;
  good: number;
  dealIns: number;
  calls: number;
  riichis: number;
  winPoints: number;
  placements: number[];
}

export interface DailyRecord {
  hand?: number;
  discard?: number;
  speed?: number;
  winds?: boolean;
  variation?: boolean;
}

export const emptyVarStats = (): VarStats => ({ games: 0, wins: 0, hands: 0, handsWon: 0, decisions: 0, good: 0, dealIns: 0, calls: 0, riichis: 0, winPoints: 0, placements: [0, 0, 0, 0] });

let KEY = 'jongclub.profile.v1';

/** Signed-in accounts keep their own profile (src/auth); guests use the original slot. */
export function setProfileSlot(accountId: string | null) {
  KEY = accountId ? `jongclub.profile.v1:${accountId}` : 'jongclub.profile.v1';
}

/** Start this profile again from nothing, keeping its name (developer mode). */
export function resetProfile(p: Profile) {
  const name = p.name;
  for (const k of Object.keys(p)) delete (p as unknown as Record<string, unknown>)[k];
  Object.assign(p, fresh(), { name });
  saveProfile(p);
}

const fresh = (): Profile => ({
  name: 'Guest',
  jongPoints: 0,
  xp: 0,
  rating: 1000,
  ratedGames: 0,
  games: 0,
  gamesWon: 0,
  handsPlayed: 0,
  handsWon: 0,
  selfDrawWins: 0,
  bestHand: null,
  streak: 0,
  longestStreak: 0,
  daysPlayed: [],
  achievements: {},
  history: [],
  variationGames: {},
  variationWins: {},
  tileSet: 'classic-ivory',
  table: 'classic-green',
  lessonsDone: [],
  ratings: {},
  ratedByVariation: {},
  ratingHistory: [],
  varStats: {},
  owned: [],
  loadout: { ...DEFAULT_LOADOUT },
  avatar: { ...DEFAULT_AVATAR },
  region: 'Middle East',
  following: [],
  friends: [],
  daily: {},
  trophies: [],
});

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? JSON.parse(raw) : null;
    if (s && typeof s === 'object' && !Array.isArray(s)) {
      const base = fresh();
      const p: Profile = { ...base, ...s };
      const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
      // Older saves kept cosmetics at the top level or with fewer slots.
      p.loadout = { ...base.loadout, ...(typeof s.tileSet === 'string' ? { tileSet: s.tileSet } : {}), ...(isObj(s.loadout) ? s.loadout : {}) };
      p.avatar = { ...base.avatar, ...(isObj(s.avatar) ? s.avatar : {}) };
      for (const k of ['ratings', 'ratedByVariation', 'varStats', 'daily', 'variationGames', 'variationWins', 'achievements'] as const) if (!isObj(s[k])) (p as unknown as Record<string, unknown>)[k] = base[k];
      for (const k of ['ratingHistory', 'owned', 'following', 'friends', 'trophies', 'history', 'daysPlayed', 'lessonsDone'] as const) if (!Array.isArray(s[k])) (p as unknown as Record<string, unknown>)[k] = base[k];
      // Counters must be plain non-negative numbers: a string would concatenate on +=, NaN would spread.
      for (const k of ['jongPoints', 'xp', 'rating', 'ratedGames', 'games', 'gamesWon', 'handsPlayed', 'handsWon', 'selfDrawWins', 'streak', 'longestStreak'] as const) {
        const v: unknown = p[k];
        const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
        p[k] = Number.isFinite(n) && n >= 0 ? n : base[k];
      }
      for (const k of ['name', 'tileSet', 'table', 'region'] as const) if (typeof p[k] !== 'string') p[k] = base[k];
      for (const k of ['city', 'country', 'locSource'] as const) if (p[k] !== undefined && typeof p[k] !== 'string') delete p[k];
      const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
      for (const k of ['ratings', 'ratedByVariation', 'variationGames', 'variationWins'] as const) {
        const rec = p[k];
        for (const v of Object.keys(rec)) if (!num(rec[v])) delete rec[v];
      }
      // Per-variation stats from older saves may miss newer counters.
      for (const v of Object.keys(p.varStats)) {
        const vs = p.varStats[v] as unknown;
        if (!isObj(vs)) {
          delete p.varStats[v];
          continue;
        }
        const e = emptyVarStats();
        const fixed = { ...e } as VarStats;
        for (const f of Object.keys(e) as (keyof VarStats)[]) if (f !== 'placements' && num(vs[f])) (fixed[f] as number) = vs[f] as number;
        if (Array.isArray(vs.placements)) fixed.placements = e.placements.map((_, i) => (num((vs.placements as unknown[])[i]) ? ((vs.placements as number[])[i]) : 0));
        p.varStats[v] = fixed;
      }
      if (p.bestHand !== null && (!isObj(p.bestHand) || !num(p.bestHand.points))) p.bestHand = null;
      return p;
    }
  } catch {
    /* storage unavailable: play as guest */
  }
  return fresh();
}

/** Called after every save (src/progression/cloudSync.ts sends changes to the club server). */
export const profileSaveHooks: ((p: Profile) => void)[] = [];

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
  for (const fn of profileSaveHooks) fn(p);
}

// ------------------------------------------------------------ club level

export const xpForLevel = (level: number) => 400 * level + 100 * level * level;

export function levelOf(xp: number) {
  let level = 1;
  let need = xpForLevel(level);
  let rest = xp;
  while (rest >= need) {
    rest -= need;
    level++;
    need = xpForLevel(level);
  }
  return { level, into: rest, need };
}

export function leagueOf(rating: number) {
  const tiers: [number, string, string][] = [
    [0, tr('Beginner'), '🌱'],
    [1100, tr('Bronze'), '🥉'],
    [1300, tr('Silver'), '🥈'],
    [1500, tr('Gold'), '🥇'],
    [1700, tr('Platinum'), '💠'],
    [1900, tr('Diamond'), '💎'],
    [2100, tr('Master'), '👑'],
  ];
  let t = tiers[0];
  for (const x of tiers) if (rating >= x[0]) t = x;
  return { name: t[1], icon: t[2] };
}

// ------------------------------------------------------------ achievements

export interface Achievement {
  id: string;
  name: string;
  detail: string;
  phase: 1 | 2 | 3;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-table', name: tr('First Table'), detail: tr('Win your first Mahjong game.'), phase: 1 },
  { id: 'first-hand', name: tr('Mahjong!'), detail: tr('Win your first hand.'), phase: 1 },
  { id: 'self-made', name: tr('Self Made'), detail: tr('Win a hand on your own draw.'), phase: 1 },
  { id: 'four-winds', name: tr('Four Winds'), detail: tr('Complete a full NEWS match.'), phase: 1 },
  { id: 'limit', name: tr('To the Limit'), detail: tr('Win a limit hand.'), phase: 1 },
  { id: 'student', name: tr('First Lesson'), detail: tr('Finish the 60-second guide.'), phase: 1 },
  { id: 'student-of-the-game', name: tr('Student of the Game'), detail: tr('Complete Mahjong Academy.'), phase: 2 },
  { id: 'riichi-master', name: tr('Riichi Master'), detail: tr('Win 100 Riichi games.'), phase: 2 },
  { id: 'passport', name: tr('World Tour Complete'), detail: tr('Play every available variation.'), phase: 2 },
  { id: 'collector', name: tr('Collector'), detail: tr('Own 10 tile sets.'), phase: 3 },
  { id: 'club-regular', name: tr('Club Regular'), detail: tr('Play 30 days in a row.'), phase: 1 },
];

export function unlock(p: Profile, id: string): boolean {
  if (p.achievements[id]) return false;
  p.achievements[id] = new Date().toISOString();
  return true;
}

// ------------------------------------------------------------ rewards

export interface MatchSummary {
  placement: number;
  finalScore: number;
  handsWon: number;
  handsPlayed: number;
  selfDraws: number;
  bestHand: { points: number; value: number; name: string } | null;
  limitHand: boolean;
  fullNews: boolean;
  variation: string;
  lengthLabel: string;
  /** The match format id and the prevailing winds it covered (India Rules can play any of its rounds). */
  length?: string;
  winds?: string[];
  ranked: boolean;
  /** What kind of game: ai, casual, ranked, private, daily, tournament, multiplayer. */
  mode?: string;
  /** Your discards, and how many matched the most efficient choice. */
  decisions?: number;
  goodDecisions?: number;
  dealIns?: number;
  calls?: number;
  riichis?: number;
  /** Points from hands you won. */
  winPoints?: number;
  /** Opponent strength: AI difficulty ids, or 'human'. */
  opponents?: string[];
  /** Ranked: each opponent's rating and final place, for the rating change. */
  field?: { rating: number; place: number }[];
}

export interface Rewards {
  jongPoints: number;
  xp: number;
  breakdown: { label: string; points: number }[];
  ratingBefore: number;
  ratingAfter: number;
  levelBefore: number;
  levelAfter: number;
  unlocked: string[];
}

export function applyMatch(p: Profile, m: MatchSummary): Rewards {
  const breakdown: { label: string; points: number }[] = [{ label: tr('Game played'), points: 50 }];
  if (m.handsWon) breakdown.push({ label: tr('Hands won × {n}', { n: m.handsWon }), points: 40 * m.handsWon });
  const place = [200, 100, 50, 0][m.placement - 1] ?? 0;
  if (place) breakdown.push({ label: tr('{place} place', { place: ordinal(m.placement) }), points: place });
  if (m.limitHand) breakdown.push({ label: tr('Limit hand'), points: 300 });
  const jp = breakdown.reduce((a, b) => a + b.points, 0);
  const levelBefore = levelOf(p.xp).level;
  const ratingBefore = p.rating;

  p.jongPoints += jp;
  p.xp += jp + m.handsPlayed * 10;
  p.games++;
  p.handsPlayed += m.handsPlayed;
  p.handsWon += m.handsWon;
  p.selfDrawWins += m.selfDraws;
  p.variationGames[m.variation] = (p.variationGames[m.variation] ?? 0) + 1;
  if (m.placement === 1) {
    p.gamesWon++;
    p.variationWins[m.variation] = (p.variationWins[m.variation] ?? 0) + 1;
    p.streak++;
    p.longestStreak = Math.max(p.longestStreak, p.streak);
  } else p.streak = 0;
  if (m.bestHand && (!p.bestHand || m.bestHand.points > p.bestHand.points)) p.bestHand = m.bestHand;
  const vs = (p.varStats[m.variation] ??= emptyVarStats());
  vs.games++;
  if (m.placement === 1) vs.wins++;
  vs.hands += m.handsPlayed;
  vs.handsWon += m.handsWon;
  vs.decisions += m.decisions ?? 0;
  vs.good += m.goodDecisions ?? 0;
  vs.dealIns += m.dealIns ?? 0;
  vs.calls += m.calls ?? 0;
  vs.riichis += m.riichis ?? 0;
  vs.winPoints += m.winPoints ?? 0;
  vs.placements[m.placement - 1] = (vs.placements[m.placement - 1] ?? 0) + 1;
  if (m.ranked) {
    // Four-player Elo: each opponent is a head-to-head result by final place.
    // Only ranked games move rating; nothing bought ever does.
    const field = m.field?.length ? m.field : [1, 2, 3, 4].filter((x) => x !== m.placement).map((place) => ({ rating: p.rating, place }));
    applyRating(p, m.variation, m.placement, field);
  }
  const today = new Date().toISOString().slice(0, 10);
  if (!p.daysPlayed.includes(today)) p.daysPlayed = [...p.daysPlayed, today].slice(-60);

  const unlocked: string[] = [];
  const u = (id: string, cond: boolean) => cond && unlock(p, id) && unlocked.push(id);
  u('first-table', m.placement === 1);
  u('first-hand', m.handsWon > 0);
  u('self-made', m.selfDraws > 0);
  u('four-winds', m.fullNews);
  u('limit', m.limitHand);
  u('riichi-master', (p.variationWins.riichi ?? 0) >= 100);
  u('passport', VARIATIONS.filter((v) => v.profile).every((v) => (p.variationGames[v.id] ?? 0) > 0));
  u('club-regular', consecutiveDays(p.daysPlayed) >= 30);

  p.history = [
    { date: new Date().toISOString(), variation: m.variation, length: m.lengthLabel, placement: m.placement, score: m.finalScore, points: jp, handsWon: m.handsWon },
    ...p.history,
  ].slice(0, 25);
  saveProfile(p);
  return { jongPoints: jp, xp: jp, breakdown, ratingBefore, ratingAfter: p.rating, levelBefore, levelAfter: levelOf(p.xp).level, unlocked };
}

/** Leaving a ranked game early: rated as a 4th-place finish, with no rewards. */
export function forfeitRanked(p: Profile, variation: string, field?: number[]) {
  applyRating(p, variation, 4, (field?.length ? field : [p.rating, p.rating, p.rating]).map((rating, i) => ({ rating, place: i + 1 })));
  saveProfile(p);
}

function applyRating(p: Profile, variation: string, placement: number, field: { rating: number; place: number }[]) {
  const own = p.ratings[variation] ?? p.rating;
  const k = p.ratedGames < 10 ? 48 : 24;
  const delta = (r: number) =>
    field.reduce((sum, o) => {
      const expected = 1 / (1 + 10 ** ((o.rating - r) / 400));
      const actual = placement < o.place ? 1 : placement > o.place ? 0 : 0.5;
      return sum + (k / 3) * (actual - expected);
    }, 0);
  p.rating = Math.max(100, Math.round(p.rating + delta(p.rating)));
  p.ratings[variation] = Math.max(100, Math.round(own + delta(own)));
  p.ratedByVariation[variation] = (p.ratedByVariation[variation] ?? 0) + 1;
  p.ratedGames++;
  p.ratingHistory = [...p.ratingHistory, { date: new Date().toISOString(), rating: p.rating, variation }].slice(-80);
}

function consecutiveDays(days: string[]) {
  const set = new Set(days);
  let n = 0;
  const d = new Date();
  while (set.has(d.toISOString().slice(0, 10))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export const ordinal = (n: number) => (lang() === 'en' ? `${n}${['st', 'nd', 'rd'][n - 1] ?? 'th'}` : tr('{n}th', { n }));
