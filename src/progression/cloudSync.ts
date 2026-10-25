// Profile sync with the club server, for accounts signed in there.
//
// Rule, kept simple on purpose: last write wins per top-level profile field.
// This device remembers, per field, the value it last agreed with the server
// and when that value was written (its "shadow"). On each sync it sends the
// fields that changed here since then, stamped with the time of the change;
// the server keeps whichever write of each field is newest and answers with
// every field, and fields that are newer there are copied here.
//
// The first sync of an account on a device sends its fields stamped as old
// (time 1), so a fresh device never overwrites a profile the server already
// has, while a guest's progress still carries into a new, empty account.
// Known limit: two devices that both add Jong Points between syncs keep the
// later total, not the sum. Counters will move to server-side events when the
// server referees games.
//
// Without a server, or for guest and local accounts, nothing here runs.

import { currentAccount } from '../auth/account';
import { api, cloudSession, cloudUid, serverUrl } from '../net/api';
import { loadProfile, profileSaveHooks, saveProfile, type Profile } from './profile';

export interface Field {
  v: unknown;
  t: number;
}

export interface Shadow {
  /** JSON of each field's value as last agreed with the server. */
  last: Record<string, string>;
  /** When that value was written. */
  times: Record<string, number>;
}

export const emptyShadow = (): Shadow => ({ last: {}, times: {} });

/** The fields that changed locally since the shadow, stamped `now` (or 1 on a first sync), and the shadow after sending them. */
export function localChanges(p: Record<string, unknown>, shadow: Shadow, now: number): { send: Record<string, Field>; shadow: Shadow } {
  const first = !Object.keys(shadow.last).length;
  const next: Shadow = { last: { ...shadow.last }, times: { ...shadow.times } };
  const send: Record<string, Field> = {};
  for (const [k, v] of Object.entries(p)) {
    const json = JSON.stringify(v ?? null);
    if (next.last[k] === json) continue;
    const t = first ? 1 : now;
    send[k] = { v, t };
    next.last[k] = json;
    next.times[k] = t;
  }
  return { send, shadow: next };
}

/** Copy server fields that are newer than what this device last agreed. Returns the keys that changed. */
export function applyRemote(p: Record<string, unknown>, shadow: Shadow, remote: Record<string, Field>): string[] {
  const changed: string[] = [];
  for (const [k, f] of Object.entries(remote)) {
    if (!f || typeof f.t !== 'number' || f.t <= (shadow.times[k] ?? 0)) continue;
    p[k] = f.v;
    shadow.last[k] = JSON.stringify(f.v ?? null);
    shadow.times[k] = f.t;
    changed.push(k);
  }
  return changed;
}

const shadowKey = (uid: string) => `jongclub.cloud.sync.v1:${uid}`;

function readShadow(uid: string): Shadow {
  try {
    const raw = localStorage.getItem(shadowKey(uid));
    const s = raw ? JSON.parse(raw) : null;
    return s && typeof s.last === 'object' && typeof s.times === 'object' ? s : emptyShadow();
  } catch {
    return emptyShadow();
  }
}

function writeShadow(uid: string, s: Shadow) {
  try {
    localStorage.setItem(shadowKey(uid), JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** The server account this device is signed in to, if the session matches the active account. */
function syncUid(): string | null {
  const uid = cloudUid(currentAccount()?.id);
  return uid && serverUrl() && cloudSession()?.user.id === uid ? uid : null;
}

let inFlight: Promise<void> | null = null;

/** Push local changes, then take newer fields from the server into `p` (saved). */
export async function syncProfile(p: Profile, opts: { keepalive?: boolean } = {}): Promise<string[]> {
  const uid = syncUid();
  if (!uid) return [];
  await inFlight;
  let changed: string[] = [];
  inFlight = (async () => {
    const { send, shadow } = localChanges(p as unknown as Record<string, unknown>, readShadow(uid), Date.now());
    const r = Object.keys(send).length
      ? await api<{ fields: Record<string, Field> }>('/profile', { method: 'PUT', body: { fields: send }, keepalive: opts.keepalive })
      : await api<{ fields: Record<string, Field> }>('/profile');
    changed = applyRemote(p as unknown as Record<string, unknown>, shadow, r.fields);
    writeShadow(uid, shadow);
    if (changed.length) {
      // Repair anything odd the server held, the same way a local save is read back.
      saving = true;
      saveProfile(p);
      Object.assign(p, loadProfile());
      saving = false;
    }
  })().catch(() => {
    /* offline: try again on the next save */
  });
  await inFlight;
  inFlight = null;
  return changed;
}

/** Before the club opens: bring this account's profile down from the server (at most a few seconds). */
export async function syncProfileDown(): Promise<void> {
  if (!syncUid()) return;
  const p = loadProfile();
  await Promise.race([syncProfile(p), new Promise((r) => setTimeout(r, 4000))]);
}

let saving = false;
let timer: number | undefined;
let latest: Profile | null = null;

/** From now on, send changes a few seconds after each save, and when the page is hidden. */
export function startProfileSync() {
  if (!serverUrl()) return;
  profileSaveHooks.push((p) => {
    if (saving || !syncUid()) return;
    latest = p;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void syncProfile(p), 3000);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && latest) {
      window.clearTimeout(timer);
      void syncProfile(latest, { keepalive: true });
    }
  });
}
