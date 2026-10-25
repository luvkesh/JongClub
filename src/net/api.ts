// The JongClub server (server/): where it is, the signed-in session, and a
// small typed client for its HTTP API. With no server configured every
// function here reports "not available" and the game stays local, as before.
//
// Where the server is, first found wins:
//   1. localStorage 'jongclub.server.v1' (a runtime setting, e.g. for testing a build)
//   2. VITE_JONGCLUB_SERVER at build time (.env.local), e.g. http://127.0.0.1:8787

import type { Account, Provider } from '../auth/account';

const SERVER_KEY = 'jongclub.server.v1';
const SESSION_KEY = 'jongclub.cloud.session.v1';

const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}) as Record<string, string | undefined>;

const store = {
  get(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key: string, v: string | null) {
    try {
      if (v === null) globalThis.localStorage?.removeItem(key);
      else globalThis.localStorage?.setItem(key, v);
    } catch {
      /* storage unavailable */
    }
  },
};

let override: string | null | undefined;

/** The server's base URL (no trailing slash), or null when the game runs without one. */
export function serverUrl(): string | null {
  const raw = override !== undefined ? override : store.get(SERVER_KEY) || env.VITE_JONGCLUB_SERVER || '';
  return raw ? raw.replace(/\/+$/, '') : null;
}

/** Point the game at a server (null: no server). Kept on this device; `persist: false` for tests. */
export function setServerUrl(url: string | null, persist = true) {
  if (persist) store.set(SERVER_KEY, url);
  else override = url;
}

export interface CloudUser {
  id: string;
  name: string;
  email: string | null;
  providers: string[];
}

export interface CloudSession {
  token: string;
  user: CloudUser;
  provider: Provider;
}

let memSession: CloudSession | null | undefined;

/** The server session of the signed-in account, if any. */
export function cloudSession(): CloudSession | null {
  if (memSession !== undefined) return memSession;
  try {
    const raw = store.get(SESSION_KEY);
    return raw ? (JSON.parse(raw) as CloudSession) : null;
  } catch {
    return null;
  }
}

export function setCloudSession(s: CloudSession | null) {
  memSession = s;
  store.set(SESSION_KEY, s ? JSON.stringify(s) : null);
}

/** Signed in to a server account right now. */
export const cloudSignedIn = () => !!serverUrl() && !!cloudSession();

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Call the server. Throws ApiError with a message fit to show the player. */
export async function api<T>(path: string, opts: { method?: string; body?: unknown; keepalive?: boolean; auth?: boolean } = {}): Promise<T> {
  const base = serverUrl();
  if (!base) throw new ApiError(0, 'no_server', 'The club server isn’t set up yet.');
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const s = cloudSession();
  if (s && opts.auth !== false) headers.authorization = `Bearer ${s.token}`;
  let res: Response;
  try {
    res = await fetch(base + path, { method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'), headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), keepalive: opts.keepalive });
  } catch {
    throw new ApiError(0, 'offline', 'The club server can’t be reached. Check your connection and try again.');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'error', data.message ?? 'Something went wrong. Please try again.');
  return data as T;
}

// ------------------------------------------------------------ accounts

const toAccount = (s: CloudSession): Account => ({
  id: `cloud-${s.user.id}`,
  provider: s.provider,
  name: s.user.name.slice(0, 24),
  email: s.user.email ?? undefined,
  since: new Date().toISOString(),
});

async function signIn(path: string, body: unknown, provider: Provider): Promise<Account> {
  const r = await api<{ token: string; user: CloudUser }>(path, { body, auth: false });
  const s: CloudSession = { token: r.token, user: r.user, provider };
  setCloudSession(s);
  return toAccount(s);
}

export const cloudRegister = (name: string, email: string, password: string) => signIn('/auth/register', { name, email, password }, 'email');
export const cloudLogin = (email: string, password: string) => signIn('/auth/login', { email, password }, 'email');
/** Exchange a Google or Apple ID token for a server session (the server checks the signature). */
export const cloudIdToken = (provider: 'google' | 'apple', idToken: string, name?: string) => signIn(`/auth/${provider}`, { idToken, name }, provider);

/** The server account id of a signed-in Account, or null for local accounts. */
export const cloudUid = (accountId: string | undefined) => (accountId?.startsWith('cloud-') ? accountId.slice(6) : null);
