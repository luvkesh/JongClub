// The streak shield: one free each week (Monday to Sunday, UTC). When a player
// misses a single day, the week's shield covers it and the daily streak lives
// on. It is applied by itself the next time the streak is looked at, never
// bought, and it never covers two missed days in a row.

import { currentAccount } from '../auth/account';
import { dailyKey } from './daily';
import { dayNumber, isoDay } from './util';
import { lang, tr } from '../i18n';

export interface ShieldState {
  /** Days (YYYY-MM-DD) a shield covered. */
  used: string[];
}

const fromDayNumber = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);

/** Monday of the week holding `iso`. */
export function weekStart(iso: string): string {
  const d = new Date(`${isoDay(iso)}T00:00:00Z`);
  return fromDayNumber(dayNumber(isoDay(iso)) - ((d.getUTCDay() + 6) % 7));
}

/** Is this week's shield still unused? */
export const shieldReady = (s: ShieldState, today: string) => !s.used.some((d) => weekStart(d) === weekStart(today));

/**
 * Use a shield if yesterday was missed while the streak was alive the day before.
 * Returns the new state, or null when nothing changes.
 */
export function settleShield(daysPlayed: string[], s: ShieldState, today: Date | string = new Date()): ShieldState | null {
  const t = dayNumber(dailyKey(today));
  const have = new Set([...daysPlayed, ...s.used].map((d) => dayNumber(isoDay(d))));
  const yesterday = t - 1;
  if (have.has(yesterday) || !have.has(yesterday - 1)) return null;
  const y = fromDayNumber(yesterday);
  if (!shieldReady(s, y)) return null;
  return { used: [...s.used, y].slice(-20) };
}

/** Days that count toward the streak: days played plus days a shield covered. */
export const streakDays = (daysPlayed: string[], s: ShieldState) => [...daysPlayed, ...s.used];

// ------------------------------------------------------------ storage, per account

const key = () => {
  const a = currentAccount();
  return a && a.provider !== 'guest' ? `jongclub.streak-shield.v1:${a.id}` : 'jongclub.streak-shield.v1';
};

export function loadShield(): ShieldState {
  try {
    const s = JSON.parse(localStorage.getItem(key()) ?? 'null');
    return s && Array.isArray(s.used) ? { used: s.used.filter((d: unknown) => typeof d === 'string') } : { used: [] };
  } catch {
    return { used: [] };
  }
}

function saveShield(s: ShieldState) {
  try {
    localStorage.setItem(key(), JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** The streak days for a profile, using this week's shield first if it is needed. */
export function shieldedDays(daysPlayed: string[], today: Date | string = new Date()): string[] {
  let s = loadShield();
  const next = settleShield(daysPlayed, s, today);
  if (next) saveShield((s = next));
  return streakDays(daysPlayed, s);
}

/** A line for the daily screen about this week's shield. */
export function shieldLine(today: Date | string = new Date()): string {
  const s = loadShield();
  const week = weekStart(dailyKey(today));
  const usedOn = s.used.find((d) => weekStart(d) === week);
  if (!usedOn) return tr('Streak shield ready: miss a day this week and your streak is kept.');
  const day = new Date(`${usedOn}T12:00:00Z`).toLocaleDateString(lang(), { weekday: 'long', timeZone: 'UTC' });
  return tr('This week’s streak shield kept your streak on {day}. A new one arrives on Monday.', { day });
}
