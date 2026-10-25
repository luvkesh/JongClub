// Passwords (scrypt), session tokens (HMAC-signed) and Google / Apple ID token
// checks (RS256 against the provider's published keys), all with node:crypto.

import { createHmac, createPublicKey, randomBytes, scrypt, timingSafeEqual, verify } from 'node:crypto';

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const fromB64url = (s) => Buffer.from(s, 'base64url');

// ------------------------------------------------------------ passwords

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

const scryptP = (pw, salt, n, r, p) =>
  new Promise((resolve, reject) => scrypt(pw, salt, KEYLEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? reject(e) : resolve(k))));

/** "scrypt$N$r$p$salt$hash", all parameters kept so they can be raised later. */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptP(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${b64url(salt)}$${b64url(key)}`;
}

export async function checkPassword(password, stored) {
  const [alg, n, r, p, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const want = fromB64url(hash);
  const got = await scryptP(password, fromB64url(salt), Number(n), Number(r), Number(p));
  return want.length === got.length && timingSafeEqual(want, got);
}

// ------------------------------------------------------------ session tokens

/** A compact signed token: base64url(JSON payload) + "." + base64url(HMAC-SHA256). */
export function signSession(secret, uid, ttlSeconds = 60 * 60 * 24 * 60, now = Date.now()) {
  const body = b64url(JSON.stringify({ sub: uid, exp: Math.floor(now / 1000) + ttlSeconds }));
  return `${body}.${b64url(createHmac('sha256', secret).update(body).digest())}`;
}

/** The user id in a valid, unexpired token, else null. */
export function readSession(secret, token, now = Date.now()) {
  if (typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const want = createHmac('sha256', secret).update(body).digest();
  const got = fromB64url(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const p = JSON.parse(fromB64url(body).toString('utf8'));
    return typeof p.sub === 'string' && p.exp * 1000 > now ? p.sub : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ ID tokens (Google, Apple)

export const GOOGLE = { jwks: 'https://www.googleapis.com/oauth2/v3/certs', issuers: ['accounts.google.com', 'https://accounts.google.com'] };
export const APPLE = { jwks: 'https://appleid.apple.com/auth/keys', issuers: ['https://appleid.apple.com'] };

const jwksCache = new Map();

/** The provider's signing keys, cached for an hour (refetched early when a key id is unknown). */
async function keysFor(url, kid, fetchImpl) {
  const hit = jwksCache.get(url);
  if (hit && hit.until > Date.now() && hit.keys.some((k) => k.kid === kid)) return hit.keys;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  const keys = (await res.json()).keys ?? [];
  jwksCache.set(url, { keys, until: Date.now() + 3600_000 });
  return keys;
}

/**
 * Verify an RS256 ID token and return its claims, or throw.
 * @param {{ jwks: string, issuers: string[], audiences: string[], fetch?: typeof fetch, now?: number }} o
 */
export async function verifyIdToken(token, o) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('malformed token');
  const header = JSON.parse(fromB64url(parts[0]).toString('utf8'));
  const claims = JSON.parse(fromB64url(parts[1]).toString('utf8'));
  if (header.alg !== 'RS256') throw new Error('unsupported alg');
  const keys = await keysFor(o.jwks, header.kid, o.fetch ?? fetch);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('unknown key');
  const key = createPublicKey({ key: jwk, format: 'jwk' });
  const ok = verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, fromB64url(parts[2]));
  if (!ok) throw new Error('bad signature');
  const now = Math.floor((o.now ?? Date.now()) / 1000);
  if (!o.issuers.includes(claims.iss)) throw new Error('wrong issuer');
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.some((a) => o.audiences.includes(a))) throw new Error('wrong audience');
  if (typeof claims.exp !== 'number' || claims.exp + 60 < now) throw new Error('expired');
  if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('no subject');
  return claims;
}
