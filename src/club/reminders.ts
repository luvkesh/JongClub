// Gentle reminders, opt-in: today's daily challenges are ready, a friend sat at
// a table, your streak is about to end. This file decides what is due; each
// kind is sent at most once a day (once per friend per day), and nothing is
// sent unless the player switched that kind on. src/ui/reminders.ts shows them.

import { currentStreak, dailyKey } from './daily';
import { tr } from '../i18n';

export type ReminderKind = 'daily' | 'friend' | 'streak';

export interface ReminderPrefs {
  daily: boolean;
  friend: boolean;
  streak: boolean;
  /** Also by email (needs a club server account and an email provider on the server). */
  email: boolean;
}

export const NO_REMINDERS: ReminderPrefs = { daily: false, friend: false, streak: false, email: false };

/** What was last sent: the day for daily and streak, the day per friend. */
export interface ReminderLog {
  daily?: string;
  streak?: string;
  friend?: Record<string, string>;
}

export interface Reminder {
  kind: ReminderKind;
  title: string;
  body: string;
  /** Replaces an earlier notification with the same tag. */
  tag: string;
}

export interface ReminderInput {
  prefs: ReminderPrefs;
  now: Date;
  /** Days that count toward the streak (played, or covered by a shield). */
  streakDays: string[];
  /** Today's daily challenges already started or done. */
  dailyStarted: boolean;
  /** Friends sitting at a live table right now. */
  friendsAtTables: string[];
  log: ReminderLog;
}

/** Local hour from which the daily reminder may go out. */
export const DAILY_FROM_HOUR = 9;
/** UTC hour from which a streak still open today is "about to end" (days end at midnight UTC). */
export const STREAK_FROM_UTC_HOUR = 18;

/** The reminders due now, and the log once they are sent. */
export function dueReminders(o: ReminderInput): { due: Reminder[]; log: ReminderLog } {
  const today = dailyKey(o.now);
  const log: ReminderLog = { ...o.log, friend: { ...(o.log.friend ?? {}) } };
  const due: Reminder[] = [];
  if (o.prefs.daily && log.daily !== today && !o.dailyStarted && o.now.getHours() >= DAILY_FROM_HOUR) {
    due.push({ kind: 'daily', title: tr('Today’s challenges are ready'), body: tr('Today’s Hand, the Perfect Discard and three more are waiting at the club.'), tag: 'jc-daily' });
    log.daily = today;
  }
  const playedToday = o.streakDays.some((d) => dailyKey(d) === today);
  const streak = currentStreak(o.streakDays, o.now);
  if (o.prefs.streak && log.streak !== today && !playedToday && streak >= 2 && o.now.getUTCHours() >= STREAK_FROM_UTC_HOUR) {
    due.push({ kind: 'streak', title: tr('Your {n}-day streak ends tonight', { n: streak }), body: tr('One game or one daily challenge keeps it going.'), tag: 'jc-streak' });
    log.streak = today;
  }
  if (o.prefs.friend)
    for (const name of o.friendsAtTables) {
      if (log.friend![name] === today) continue;
      due.push({ kind: 'friend', title: tr('{name} sat at a table', { name }), body: tr('Join them, or watch a hand.'), tag: `jc-friend-${name}` });
      log.friend![name] = today;
    }
  // Forget friends from earlier days.
  for (const [n, d] of Object.entries(log.friend!)) if (d !== today) delete log.friend![n];
  return { due, log };
}
