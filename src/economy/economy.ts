// The Jong Points economy: ways to earn (daily login, first win of the day,
// rewarded adverts, weekly challenges, achievement rewards, bought packs) and
// ways to spend (Academy lessons one at a time or in bundles; cosmetics and
// tournament entries keep their own prices elsewhere).
//
// Everything lives in the profile on this device, like the rest of progress.
// Nothing here ever touches rating: purchases never raise a competitive rating.

import type { Profile } from '../progression/profile';
import { tr } from '../i18n';

// ------------------------------------------------------------ state

export interface Econ {
  /** Lessons the player had finished before lessons could be locked: they stay open. */
  kept: string[];
  /** Lessons unlocked one at a time, and bundles owned. */
  lessons: string[];
  bundles: string[];
  /** Daily login: the last day claimed (local 'YYYY-MM-DD') and its place on the 7-day ladder (1-7). */
  login: { last: string; day: number };
  /** Local day of the last first-win bonus. */
  firstWin: string;
  /** Rewarded adverts watched today. */
  ads: { day: string; n: number };
  /** This week's challenges: the week, the counters when it began, and what has been claimed. */
  week: { id: string; base: Record<string, number>; claimed: string[] };
  /** Achievement rewards collected. */
  achievements: string[];
  /** Real-money purchases (demo ones are marked). */
  purchases: { sku: string; date: string; demo: boolean }[];
}

const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayBefore = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d - 1));
};
/** The Monday that starts this local week, as its day. */
export const weekOf = (d = new Date()) => localDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)));

const arr = (x: unknown) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : []);
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** The profile's economy, created (and repaired) on first use. */
export function econOf(p: Profile, now = new Date()): Econ {
  const raw = (p as Profile & { econ?: unknown }).econ;
  const s = isObj(raw) ? raw : {};
  const login = isObj(s.login) ? s.login : {};
  const ads = isObj(s.ads) ? s.ads : {};
  const week = isObj(s.week) ? s.week : {};
  const e: Econ = {
    // The first time, keep every lesson already finished open for good.
    kept: isObj(raw) ? arr(s.kept) : [...p.lessonsDone],
    lessons: arr(s.lessons),
    bundles: arr(s.bundles),
    login: { last: typeof login.last === 'string' ? login.last : '', day: typeof login.day === 'number' && login.day >= 0 && login.day <= 7 ? login.day : 0 },
    firstWin: typeof s.firstWin === 'string' ? s.firstWin : '',
    ads: { day: typeof ads.day === 'string' ? ads.day : '', n: typeof ads.n === 'number' && ads.n >= 0 ? ads.n : 0 },
    week: { id: typeof week.id === 'string' ? week.id : '', base: isObj(week.base) ? (week.base as Record<string, number>) : {}, claimed: arr(week.claimed) },
    achievements: arr(s.achievements),
    purchases: Array.isArray(s.purchases) ? (s.purchases as Econ['purchases']).filter((x) => isObj(x) && typeof x.sku === 'string') : [],
  };
  // A new week starts its challenges from the counters as they stand now.
  const wk = weekOf(now);
  if (e.week.id !== wk) e.week = { id: wk, base: counters(p, wk), claimed: [] };
  (p as Profile & { econ?: Econ }).econ = e;
  return e;
}

// ------------------------------------------------------------ daily login

/** Jong Points for each day of a 7-day login run; missing a day starts again at Day 1. */
export const LOGIN_LADDER = [100, 150, 200, 250, 300, 400, 750];

/** Today's place on the ladder (1-7), whether it can be claimed, and its reward. */
export function loginStatus(p: Profile, now = new Date()) {
  const e = econOf(p, now);
  const today = localDay(now);
  const claimed = e.login.last === today;
  const day = claimed ? e.login.day : e.login.last === dayBefore(today) ? (e.login.day % 7) + 1 : 1;
  return { day, claimed, points: LOGIN_LADDER[day - 1] };
}

export function claimLogin(p: Profile, now = new Date()): number {
  const s = loginStatus(p, now);
  if (s.claimed) return 0;
  const e = econOf(p, now);
  e.login = { last: localDay(now), day: s.day };
  p.jongPoints += s.points;
  return s.points;
}

// ------------------------------------------------------------ winning games

/** The bonus on top of the usual game rewards for the day's first win. */
export const FIRST_WIN_BONUS = 150;

/** Pays the first win of the day once (call it for a first-place finish); returns the bonus, or 0. */
export function takeFirstWin(p: Profile, now = new Date()): number {
  const e = econOf(p, now);
  const today = localDay(now);
  if (e.firstWin === today) return 0;
  e.firstWin = today;
  return FIRST_WIN_BONUS;
}

export const firstWinToday = (p: Profile, now = new Date()) => econOf(p, now).firstWin === localDay(now);

// ------------------------------------------------------------ rewarded adverts

export const AD_REWARD = 100;
export const ADS_PER_DAY = 5;

export function adsLeft(p: Profile, now = new Date()) {
  const e = econOf(p, now);
  return e.ads.day === localDay(now) ? Math.max(0, ADS_PER_DAY - e.ads.n) : ADS_PER_DAY;
}

/** Pays one watched advert, if any are left today. */
export function payAd(p: Profile, now = new Date()): number {
  if (!adsLeft(p, now)) return 0;
  const e = econOf(p, now);
  const today = localDay(now);
  e.ads = { day: today, n: (e.ads.day === today ? e.ads.n : 0) + 1 };
  p.jongPoints += AD_REWARD;
  return AD_REWARD;
}

// ------------------------------------------------------------ weekly challenges

export interface Challenge {
  id: string;
  label: string;
  goal: number;
  points: number;
  /** The counter it measures. */
  counter: 'games' | 'wins' | 'hands' | 'lessons' | 'dailies';
}

export const CHALLENGES: Challenge[] = [
  { id: 'play5', label: tr('Play 5 games'), goal: 5, points: 300, counter: 'games' },
  { id: 'win3', label: tr('Win 3 games'), goal: 3, points: 500, counter: 'wins' },
  { id: 'hands10', label: tr('Win 10 hands'), goal: 10, points: 400, counter: 'hands' },
  { id: 'lesson1', label: tr('Pass a lesson test'), goal: 1, points: 300, counter: 'lessons' },
  { id: 'daily3', label: tr('Play the Daily Hand on 3 days'), goal: 3, points: 300, counter: 'dailies' },
];

function counters(p: Profile, week: string): Record<string, number> {
  return {
    games: p.games,
    wins: p.gamesWon,
    hands: p.handsWon,
    lessons: p.lessonsDone.length,
    // Daily hands are counted from the week's own days, so this one starts at 0.
    dailies: Object.keys(p.daily).filter((d) => d >= week && p.daily[d]?.hand !== undefined).length,
  };
}

/** Three challenges a week, rotating through the list. */
export function weekChallenges(p: Profile, now = new Date()) {
  const e = econOf(p, now);
  const n = Math.floor(Date.parse(`${e.week.id}T00:00:00Z`) / (7 * 864e5));
  const picks = [0, 1, 2].map((i) => CHALLENGES[(n + i * 2) % CHALLENGES.length]);
  const now_ = counters(p, e.week.id);
  return picks.map((c) => {
    const done = Math.min(c.goal, Math.max(0, now_[c.counter] - (c.counter === 'dailies' ? 0 : e.week.base[c.counter] ?? now_[c.counter])));
    return { ...c, done, ready: done >= c.goal && !e.week.claimed.includes(c.id), claimed: e.week.claimed.includes(c.id) };
  });
}

export function claimChallenge(p: Profile, id: string, now = new Date()): number {
  const c = weekChallenges(p, now).find((x) => x.id === id);
  if (!c?.ready) return 0;
  econOf(p, now).week.claimed.push(id);
  p.jongPoints += c.points;
  return c.points;
}

// ------------------------------------------------------------ achievements

/** Jong Points for each achievement, collected once. */
export const ACHIEVEMENT_JP: Record<string, number> = {
  'first-table': 300, 'first-hand': 200, 'self-made': 200, 'four-winds': 500, limit: 800, student: 200,
  'student-of-the-game': 2000, 'riichi-master': 3000, passport: 2000, collector: 1000, 'club-regular': 2000,
};

export const achievementsToClaim = (p: Profile) => Object.keys(p.achievements).filter((id) => ACHIEVEMENT_JP[id] && !econOf(p).achievements.includes(id));

export function claimAchievement(p: Profile, id: string): number {
  if (!achievementsToClaim(p).includes(id)) return 0;
  econOf(p).achievements.push(id);
  p.jongPoints += ACHIEVEMENT_JP[id];
  return ACHIEVEMENT_JP[id];
}

// ------------------------------------------------------------ lessons

/**
 * Free from the start, always: Levels 1 to 5 (Basics, the guided game and
 * Scoring teach enough to sit down and play; Winds and rounds and Hand shapes
 * are needed for a full India Rules match; the user, 2026-10-30) and every India Rules lesson
 * (the India Rules course 13 and 13A-F, and the Kolkata Joker Club).
 * 'guided' is Level 2, the guided game.
 */
export const FREE_LESSONS = ['basics', 'guided', 'scoring', 'rounds', 'shapes', 'india', 'india-east', 'india-south', 'india-west', 'india-west-doubles', 'india-west-big', 'india-north', 'indian'];

/** Lessons in Foundations (after Level 3) and Mastering Mahjong. */
export const FOUNDATIONS_PLUS = ['strategy', 'tradition', 'words'];
export const MASTERY = ['efficiency', 'waits', 'defence', 'value'];

export interface Price {
  jp: number;
  /** Indian rupees: India is the main market. */
  inr: number;
}

export const LESSON_PRICE: Price = { jp: 800, inr: 49 };
export const VARIATION_PRICE: Price = { jp: 1200, inr: 79 };

export const isFree = (id: string) => FREE_LESSONS.includes(id);
export const lessonPrice = (id: string): Price => (FOUNDATIONS_PLUS.includes(id) || MASTERY.includes(id) ? LESSON_PRICE : VARIATION_PRICE);

export interface Bundle {
  id: string;
  name: string;
  blurb: string;
  price: Price;
  /** The lessons it opens, from the whole Academy list. */
  lessons: (all: string[]) => string[];
}

export const BUNDLES: Bundle[] = [
  { id: 'foundations', name: tr('Foundations bundle'), blurb: tr('Levels 6 to 8: strategy, tradition and the words at the table.'), price: { jp: 1800, inr: 99 }, lessons: () => FOUNDATIONS_PLUS },
  { id: 'mastery', name: tr('Mastering Mahjong bundle'), blurb: tr('Levels 9 to 12: fast hands, reading waits, defence, and value over a long game.'), price: { jp: 2500, inr: 149 }, lessons: () => MASTERY },
  { id: 'world', name: tr('World variations bundle'), blurb: tr('Every variation lesson from beyond India: Chinese Classical, Hong Kong, Riichi, Taiwanese, American and the rest.'), price: { jp: 15000, inr: 499 }, lessons: (all) => all.filter((l) => !isFree(l) && !FOUNDATIONS_PLUS.includes(l) && !MASTERY.includes(l)) },
  { id: 'academy', name: tr('Complete Academy'), blurb: tr('Every lesson in the Academy, now and as new ones arrive.'), price: { jp: 18000, inr: 699 }, lessons: (all) => all.filter((l) => !isFree(l)) },
];

/** Whether the player may open a lesson. */
export function canOpen(p: Profile, id: string, all: string[]): boolean {
  if (isFree(id)) return true;
  const e = econOf(p);
  return e.kept.includes(id) || e.lessons.includes(id) || e.bundles.some((b) => BUNDLES.find((x) => x.id === b)?.lessons(all).includes(id));
}

/** Unlock with Jong Points; false if the balance is short. */
export function unlockLessonJp(p: Profile, id: string, all: string[]): boolean {
  if (canOpen(p, id, all)) return true;
  const { jp } = lessonPrice(id);
  if (p.jongPoints < jp) return false;
  p.jongPoints -= jp;
  econOf(p).lessons.push(id);
  return true;
}

export function buyBundleJp(p: Profile, id: string): boolean {
  const b = BUNDLES.find((x) => x.id === id);
  const e = econOf(p);
  if (!b || e.bundles.includes(id)) return !!b;
  if (p.jongPoints < b.price.jp) return false;
  p.jongPoints -= b.price.jp;
  e.bundles.push(id);
  return true;
}

// ------------------------------------------------------------ real money

/** Jong Points packs for real money (prices in rupees). */
export const JP_PACKS = [
  { sku: 'jp-1000', jp: 1000, inr: 49 },
  { sku: 'jp-2750', jp: 2750, inr: 129, extra: 10 },
  { sku: 'jp-6000', jp: 6000, inr: 249, extra: 20 },
  { sku: 'jp-15000', jp: 15000, inr: 549, extra: 35 },
];

/** Grants what a paid purchase bought: a points pack, a lesson ('lesson:<id>') or a bundle ('bundle:<id>'). */
export function grantPurchase(p: Profile, sku: string, demo: boolean, now = new Date()) {
  const e = econOf(p, now);
  const pack = JP_PACKS.find((x) => x.sku === sku);
  if (pack) p.jongPoints += pack.jp;
  else if (sku.startsWith('lesson:')) e.lessons.includes(sku.slice(7)) || e.lessons.push(sku.slice(7));
  else if (sku.startsWith('bundle:')) e.bundles.includes(sku.slice(7)) || e.bundles.push(sku.slice(7));
  else return;
  e.purchases.push({ sku, date: now.toISOString(), demo });
}

/** Rupees, with Indian digit grouping (₹1,499). */
export const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
