// Reminders on this device: the Settings switches, and a gentle check every
// minute while JongClub is open or installed. They arrive as notifications
// (through the service worker when there is one) if the player allowed them,
// otherwise as a quiet note inside the app. Email reminders are recorded on
// the club server when signed in there; sending them needs an email provider
// on the server (server/README.md).

import { dueReminders, NO_REMINDERS, type ReminderLog, type ReminderPrefs } from '../club/reminders';
import { loadShield, streakDays } from '../club/streakShield';
import { dailyKey } from '../club/daily';
import { api, cloudSignedIn } from '../net/api';
import type { Club } from '../net/session';
import { loadProfile } from '../progression/profile';
import { flashNote, h } from './dom';
import './reminders.css';
import { tr } from '../i18n';

const PREFS_KEY = 'jongclub.reminders.v1';
const LOG_KEY = 'jongclub.reminders.log.v1';

const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

export const reminderPrefs = (): ReminderPrefs => read(PREFS_KEY, { ...NO_REMINDERS });

const canNotify = () => typeof Notification !== 'undefined';

async function notify(title: string, body: string, tag: string) {
  if (!canNotify() || Notification.permission !== 'granted') return flashNote(`${title}. ${body}`);
  // Another part of the app may register a service worker; use it when it is there (it works when installed).
  const sw = (navigator as Navigator & { serviceWorker?: ServiceWorkerContainer }).serviceWorker;
  const reg = sw ? await Promise.race([sw.ready.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 1000))]) : null;
  try {
    if (reg?.showNotification) await reg.showNotification(title, { body, tag });
    else new Notification(title, { body, tag });
  } catch {
    flashNote(`${title}. ${body}`);
  }
}

/** Check what is due and send it. */
export function checkReminders(club: Club | null, now = new Date()) {
  const prefs = reminderPrefs();
  if (!prefs.daily && !prefs.friend && !prefs.streak) return;
  const p = loadProfile();
  const friends = new Set(p.friends.map((f) => f.name));
  const atTables = club?.online().filter((x) => !x.isMe && x.atTable && friends.has(x.who.name)).map((x) => x.who.name) ?? [];
  const today = p.daily[dailyKey(now)];
  const { due, log } = dueReminders({
    prefs,
    now,
    streakDays: streakDays(p.daysPlayed, loadShield()),
    dailyStarted: !!today && Object.keys(today).length > 0,
    friendsAtTables: [...new Set(atTables)],
    log: read<ReminderLog>(LOG_KEY, {}),
  });
  write(LOG_KEY, log);
  for (const r of due) void notify(r.title, r.body, r.tag);
}

let started = false;

/** Start the once-a-minute check (call once, after the app opens). */
export function startReminders(club: () => Club | null) {
  if (started) return;
  started = true;
  const run = () => checkReminders(club());
  window.setTimeout(run, 15_000);
  window.setInterval(run, 60_000);
}

/** Settings: which reminders, and by email too when signed in to the club server. */
export function remindersField(): HTMLElement {
  const prefs = reminderPrefs();
  const note = h('small', { class: 'muted rem-note', 'aria-live': 'polite' });
  const save = async () => {
    write(PREFS_KEY, prefs);
    const any = prefs.daily || prefs.friend || prefs.streak;
    if (any && canNotify() && Notification.permission === 'default') await Notification.requestPermission().catch(() => 'denied');
    note.textContent = !any
      ? ''
      : canNotify() && Notification.permission === 'granted'
        ? tr('Reminders arrive as notifications while JongClub is open or installed.')
        : tr('Notifications are off for this site, so reminders appear inside JongClub.');
    if (cloudSignedIn())
      await api('/reminders', { method: 'PUT', body: { daily: prefs.email && prefs.daily, friend: prefs.email && prefs.friend, streak: prefs.email && prefs.streak } })
        .then((r) => prefs.email && !(r as { sending?: boolean }).sending && (note.textContent += tr(' Email reminders are saved and start once the club sends email.')))
        .catch(() => {});
  };
  const chip = (k: keyof ReminderPrefs, label: string, tip: string) => {
    const b = h('button', { type: 'button', class: prefs[k] ? 'on' : '', role: 'switch', 'aria-checked': String(prefs[k]), title: tip }, label);
    b.onclick = () => {
      prefs[k] = !prefs[k];
      b.classList.toggle('on', prefs[k]);
      b.setAttribute('aria-checked', String(prefs[k]));
      void save();
    };
    return b;
  };
  return h(
    'div',
    { class: 'field rem-field' },
    h('span', { title: tr('Opt-in reminders. Each kind is sent at most once a day.') }, tr('Reminders')),
    h(
      'div',
      { class: 'seg rem-seg' },
      chip('daily', tr('Daily ready'), tr('From 9 in the morning, if you have not started today’s challenges yet.')),
      chip('friend', tr('Friend at a table'), tr('When a friend sits down at a live table, once a day for each friend.')),
      chip('streak', tr('Streak ending'), tr('Late in the day (from 18:00 UTC), when a streak of two days or more ends unless you play today.')),
      cloudSignedIn() ? chip('email', tr('Also by email'), tr('Sends the same reminders by email as well, once the club sends email.')) : '',
    ),
    note,
  );
}
