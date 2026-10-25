// Club Season progress, stored on this device per account (its own key, next
// to the profile's slot). Other code earns season XP by calling
// addSeasonXp(source, amount); see club/seasons.ts for the rules.

import { currentAccount } from '../auth/account';
import { tr } from '../i18n';
import { addXp, emptyProgress, seasonAt, seasonXpForGame, stepOf, type SeasonGameSummary, type SeasonProgress, type SeasonXpSource } from '../club/seasons';

const BASE_KEY = 'jongclub.season.v1';

/** Guests keep the plain key; signed-in accounts their own slot, like the profile. */
function storageKey() {
  const a = currentAccount();
  return a && a.provider !== 'guest' ? `${BASE_KEY}:${a.id}` : BASE_KEY;
}

type Store = Record<string, SeasonProgress>;

function readStore(): Store {
  try {
    const raw = localStorage.getItem(storageKey());
    const s = raw ? (JSON.parse(raw) as Store) : {};
    return s && typeof s === 'object' ? s : {};
  } catch {
    return {};
  }
}

function writeStore(s: Store) {
  // Keep the current season and the two before it.
  const keep = Object.keys(s)
    .map(Number)
    .sort((a, b) => b - a)
    .slice(0, 3);
  const out: Store = {};
  for (const k of keep) out[k] = s[k];
  try {
    localStorage.setItem(storageKey(), JSON.stringify(out));
  } catch {
    /* storage unavailable: progress lasts until the page closes */
  }
  memo = out;
}

let memo: Store | null = null;
let memoKey = '';

function store(): Store {
  const k = storageKey();
  if (!memo || memoKey !== k) {
    memo = readStore();
    memoKey = k;
  }
  return memo;
}

const valid = (p: SeasonProgress | undefined, n: number): SeasonProgress => {
  if (!p || typeof p.xp !== 'number') return emptyProgress(n);
  return { season: n, xp: Math.max(0, p.xp), claimed: Array.isArray(p.claimed) ? p.claimed : [], bySource: p.bySource ?? {} };
};

/** Your progress in a season (the current one by default). */
export function seasonProgress(n = seasonAt().number): SeasonProgress {
  return valid(store()[n], n);
}

/** Save progress (after claiming rewards). */
export function saveSeasonProgress(p: SeasonProgress) {
  writeStore({ ...store(), [p.season]: p });
  for (const fn of listeners) fn(p);
}

const listeners = new Set<(p: SeasonProgress) => void>();
/** Hear about every change to season progress; returns an unsubscribe function. */
export function onSeasonChange(fn: (p: SeasonProgress) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/**
 * Earn season XP for playing: 'game' (a finished game), 'daily' (a daily
 * challenge completed), 'lesson' (a lesson passed), 'drill' (a drill or
 * review card done) or 'event'. Goes to the season running now. Returns the
 * XP added and the step reached, and whether that was a new step.
 */
export function addSeasonXp(source: SeasonXpSource, amount: number, date: Date = new Date()): { added: number; step: number; newStep: boolean } {
  const season = seasonAt(date);
  const p = seasonProgress(season.number);
  const before = stepOf(p.xp).step;
  const added = addXp(p, source, amount);
  if (added) saveSeasonProgress(p);
  const step = stepOf(p.xp).step;
  return { added, step, newStep: step > before };
}

/** The match-finish hook: season XP for a finished game, and a line for the results screen. */
export function seasonOnGame(m: SeasonGameSummary): string | null {
  const season = seasonAt();
  const r = addSeasonXp('game', seasonXpForGame(m, season));
  if (!r.added) return null;
  return r.newStep
    ? tr('Season {season}, {name}: +{xp} season XP · step {step} reached, collect it on the Season page.', { season: season.number, name: season.theme.name, xp: r.added, step: r.step })
    : tr('Season {season}, {name}: +{xp} season XP.', { season: season.number, name: season.theme.name, xp: r.added });
}
