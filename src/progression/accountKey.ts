// Per-account storage keys, the way profiles are slotted (profile.ts):
// guests use the plain key, signed-in accounts add their id.

import { currentAccount } from '../auth/account';

export function accountKey(base: string): string {
  const a = currentAccount();
  return a && a.provider !== 'guest' ? `${base}:${a.id}` : base;
}

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage full or blocked: keep going without saving */
  }
}
