// Who is at the table: a guest, a local email account, or a Google / Apple
// sign-in. There is no server yet, so accounts live on this device and each
// one keeps its own profile (Jong Points, collection, ratings) in its own slot.

import { setProfileSlot } from '../progression/profile';
import { cloudLogin, cloudRegister, serverUrl, setCloudSession } from '../net/api';
import { tr } from '../i18n';

export type Provider = 'guest' | 'email' | 'google' | 'apple';

export interface Account {
  id: string;
  provider: Provider;
  name: string;
  email?: string;
  picture?: string;
  /** Signed in through the demo stand-in because the real provider isn't configured. */
  demo?: boolean;
  since: string;
}

interface EmailRecord {
  id: string;
  name: string;
  email: string;
  salt: string;
  hash: string;
  created: string;
}

const SESSION_KEY = 'jongclub.auth.session.v1';
const ACCOUNTS_KEY = 'jongclub.auth.accounts.v1';
const GUEST_PROFILE_KEY = 'jongclub.profile.v1';

export const PROVIDER_LABEL: Record<Provider, string> = { guest: 'Guest', email: 'Email', google: 'Google', apple: 'Apple' };

const read = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const write = (key: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable: the session lasts until the page closes */
  }
};

let current: Account | null = read<Account>(SESSION_KEY);

/** The signed-in account (a guest counts once chosen), or null if nobody has chosen yet. */
export const currentAccount = () => current;

/** Point the profile store at this account's slot. Guests keep the original slot. */
export function activate(a: Account) {
  current = a;
  write(SESSION_KEY, a);
  if (a.provider === 'guest') {
    setProfileSlot(null);
    return;
  }
  const slot = `${GUEST_PROFILE_KEY}:${a.id}`;
  try {
    // First time on this device: carry the guest's progress over to the account.
    // Either way an account never plays under the placeholder name "Guest".
    const own = localStorage.getItem(slot);
    const guest = own ? null : localStorage.getItem(GUEST_PROFILE_KEY);
    const p = JSON.parse(own ?? guest ?? '{}');
    if (!own || !p.name || p.name === 'Guest') {
      if (!p.name || p.name === 'Guest') p.name = a.name;
      localStorage.setItem(slot, JSON.stringify(p));
    }
  } catch {
    /* ignore */
  }
  setProfileSlot(a.id);
}

export function signOut() {
  current = null;
  setCloudSession(null);
  write(SESSION_KEY, null);
  setProfileSlot(null);
}

export const guestAccount = (): Account => ({ id: 'guest', provider: 'guest', name: 'Guest', since: new Date().toISOString() });

// ------------------------------------------------------------ email (local)

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const hex = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (s: string): Uint8Array<ArrayBuffer> => new Uint8Array((s.match(/../g) ?? []).map((x) => parseInt(x, 16)));

async function hashPassword(password: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error(tr('This browser can’t create accounts securely. Try another browser, or play as a guest.'));
  const key = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150_000, hash: 'SHA-256' }, key, 256);
  return hex(bits);
}

const accounts = () => read<Record<string, EmailRecord>>(ACCOUNTS_KEY) ?? {};

export async function registerEmail(name: string, email: string, password: string): Promise<Account> {
  // With a club server the account lives there (src/net/api.ts), and works on every device.
  if (serverUrl()) return cloudRegister(name.trim(), email.trim().toLowerCase(), password);
  const e = email.trim().toLowerCase();
  const n = name.trim();
  if (!n) throw new Error(tr('Enter the name other players will see.'));
  if (!emailOk(e)) throw new Error(tr('That email address doesn’t look right.'));
  if (password.length < 8) throw new Error(tr('Use a password of at least 8 characters.'));
  const all = accounts();
  if (all[e]) throw new Error(tr('There’s already an account for that email on this device. Sign in instead.'));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const rec: EmailRecord = { id: `email-${hex(crypto.getRandomValues(new Uint8Array(6)))}`, name: n.slice(0, 24), email: e, salt: hex(salt), hash: await hashPassword(password, salt), created: new Date().toISOString() };
  all[e] = rec;
  write(ACCOUNTS_KEY, all);
  return { id: rec.id, provider: 'email', name: rec.name, email: e, since: new Date().toISOString() };
}

export async function signInEmail(email: string, password: string): Promise<Account> {
  if (!email.trim() || !password) throw new Error(tr('Enter your email and password.'));
  if (!emailOk(email.trim().toLowerCase())) throw new Error(tr('That email address doesn’t look right.'));
  if (serverUrl()) return cloudLogin(email.trim().toLowerCase(), password);
  const e = email.trim().toLowerCase();
  const rec = accounts()[e];
  // One message for both cases, so the form doesn't reveal which emails exist.
  const wrong = new Error(tr('That email and password don’t match an account on this device.'));
  if (!rec) throw wrong;
  if ((await hashPassword(password, unhex(rec.salt))) !== rec.hash) throw wrong;
  return { id: rec.id, provider: 'email', name: rec.name, email: e, since: new Date().toISOString() };
}

// ------------------------------------------------------------ identity providers

/** Read the claims of an ID token (Google or Apple). The signature is checked by the server once there is one. */
export function jwtClaims(token: string): Record<string, unknown> {
  try {
    const b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      Array.from(atob(b.padEnd(b.length + ((4 - (b.length % 4)) % 4), '=')), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    );
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export function providerAccount(provider: 'google' | 'apple', claims: Record<string, unknown>, nameHint?: string): Account {
  const email = typeof claims.email === 'string' ? claims.email : undefined;
  const name = (typeof claims.name === 'string' && claims.name) || nameHint || (email ? email.split('@')[0] : provider === 'apple' ? 'Apple player' : 'Google player');
  return {
    id: `${provider}-${String(claims.sub ?? email ?? Date.now())}`,
    provider,
    name: name.slice(0, 24),
    email,
    picture: typeof claims.picture === 'string' ? claims.picture : undefined,
    since: new Date().toISOString(),
  };
}

/** Stand-in used until the provider's client ID is set: a local account, marked demo. */
export function demoAccount(provider: 'google' | 'apple', name: string, email: string): Account {
  const e = email.trim().toLowerCase();
  if (!name.trim()) throw new Error(tr('Enter a name for the demo account.'));
  if (!emailOk(e)) throw new Error(tr('Enter an email address for the demo account.'));
  return { id: `${provider}-demo-${e}`, provider, name: name.trim().slice(0, 24), email: e, demo: true, since: new Date().toISOString() };
}
