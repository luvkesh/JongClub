// The JongClub server (server/): accounts, sessions, ID tokens, profile sync,
// clubs, reminders and the live-table relay, end to end on a random port.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { leagueTable, startServer, weekOf, type RunningServer } from '../server/app.js';
import { connectCloud, type CloudLobby } from '../src/net/cloud';
import { RoomLink } from '../src/net/lockstep';
import type { RoomPeer } from '../src/net/room';

let srv: RunningServer;
let jwks: JsonWebKey[] = [];
let privateKey: CryptoKey;
const GOOGLE_ID = 'test-client.apps.googleusercontent.com';

const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function idToken(claims: Record<string, unknown>, kid = 'k1') {
  const head = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const body = b64url(JSON.stringify(claims));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

beforeAll(async () => {
  (globalThis as { window?: unknown }).window ??= globalThis;
  const pair = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  privateKey = pair.privateKey;
  jwks = [{ ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' } as JsonWebKey];
  srv = await startServer({
    port: 0,
    env: { JONGCLUB_STORE: 'memory', GOOGLE_CLIENT_ID: GOOGLE_ID, APPLE_SERVICES_ID: '', SESSION_SECRET: 'test-secret' },
    fetch: async () => new Response(JSON.stringify({ keys: jwks })),
  });
});

afterAll(async () => {
  await srv?.close();
});

async function call<T = Record<string, any>>(path: string, opts: { method?: string; body?: unknown; token?: string } = {}): Promise<{ status: number; data: T }> {
  const r = await fetch(srv.url + path, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: r.status, data: (await r.json()) as T };
}

const register = async (name: string, email: string) => (await call<{ token: string; user: { id: string } }>('/auth/register', { body: { name, email, password: 'tiles-and-tea' } })).data;

describe('accounts and sessions', () => {
  it('registers, signs in, refuses wrong passwords and duplicate emails', async () => {
    const a = await register('Mei Lin', 'mei@example.com');
    expect(a.token).toBeTruthy();
    expect((await call('/me', { token: a.token })).data.user.name).toBe('Mei Lin');
    expect((await call('/auth/login', { body: { email: 'MEI@example.com', password: 'tiles-and-tea' } })).status).toBe(200);
    expect((await call('/auth/login', { body: { email: 'mei@example.com', password: 'wrong-password' } })).status).toBe(401);
    expect((await call('/auth/register', { body: { name: 'X', email: 'mei@example.com', password: 'tiles-and-tea' } })).status).toBe(409);
    expect((await call('/auth/register', { body: { name: 'X', email: 'short@example.com', password: 'short' } })).status).toBe(400);
  });

  it('rejects tampered and missing session tokens', async () => {
    const a = await register('Tamper', 'tamper@example.com');
    const [body, sig] = a.token.split('.');
    const forged = `${b64url(JSON.stringify({ sub: 'someone-else', exp: 9e9 }))}.${sig}`;
    expect((await call('/me', { token: forged })).status).toBe(401);
    expect((await call('/me', { token: `${body}.${sig}x` })).status).toBe(401);
    expect((await call('/me')).status).toBe(401);
  });

  it('verifies Google ID tokens against the JWKS (RS256, issuer, audience, expiry)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const good = await idToken({ iss: 'https://accounts.google.com', aud: GOOGLE_ID, sub: 'g-123', email: 'kenji@example.com', email_verified: true, name: 'Kenji', exp: now + 600 });
    const r = await call('/auth/google', { body: { idToken: good } });
    expect(r.status).toBe(200);
    expect(r.data.user.name).toBe('Kenji');
    // The same identity signs in to the same account.
    expect((await call('/auth/google', { body: { idToken: good } })).data.user.id).toBe(r.data.user.id);
    const wrongAud = await idToken({ iss: 'https://accounts.google.com', aud: 'someone-else', sub: 'g-1', exp: now + 600 });
    expect((await call('/auth/google', { body: { idToken: wrongAud } })).status).toBe(401);
    const expired = await idToken({ iss: 'https://accounts.google.com', aud: GOOGLE_ID, sub: 'g-1', exp: now - 3600 });
    expect((await call('/auth/google', { body: { idToken: expired } })).status).toBe(401);
    const tampered = good.replace(/\.[^.]+\./, `.${b64url(JSON.stringify({ iss: 'https://accounts.google.com', aud: GOOGLE_ID, sub: 'admin', exp: now + 600 }))}.`);
    expect((await call('/auth/google', { body: { idToken: tampered } })).status).toBe(401);
  });

  it('reports Apple sign-in as not configured when its env var is unset', async () => {
    expect((await call('/auth/apple', { body: { idToken: 'x.y.z' } })).status).toBe(501);
    expect((await call('/config')).data).toMatchObject({ google: true, apple: false, email: true });
  });
});

describe('profile sync', () => {
  it('keeps the newest value of each field (last write wins per field)', async () => {
    const a = await register('Sync', 'sync@example.com');
    await call('/profile', { method: 'PUT', token: a.token, body: { fields: { jongPoints: { v: 100, t: 1000 }, name: { v: 'Sync', t: 1000 } } } });
    const r = await call('/profile', { method: 'PUT', token: a.token, body: { fields: { jongPoints: { v: 50, t: 500 }, xp: { v: 9, t: 2000 } } } });
    expect(r.data.accepted).toEqual(['xp']);
    const got = (await call('/profile', { token: a.token })).data.fields;
    expect(got.jongPoints.v).toBe(100);
    expect(got.xp.v).toBe(9);
  });

  it('builds the leaderboard from synced ratings', async () => {
    const a = await register('Rated', 'rated@example.com');
    await call('/profile', { method: 'PUT', token: a.token, body: { fields: { rating: { v: 1650, t: 1 }, ratedGames: { v: 12, t: 1 }, ratings: { v: { riichi: 1700 }, t: 1 } } } });
    const board = (await call('/leaderboard?variation=riichi', { token: a.token })).data.rows;
    expect(board[0]).toMatchObject({ name: 'Rated', rating: 1700, me: true });
  });
});

describe('private clubs', () => {
  it('founds a club, joins by invite, records results into the weekly league', async () => {
    const a = await register('Founder', 'founder@example.com');
    const b = await register('Friend', 'friend@example.com');
    const c = (await call('/clubs', { token: a.token, body: { name: 'Thursday Tiles', crest: 'jade', variation: 'riichi', houseRules: { redFives: '4' } } })).data.club;
    expect(c.members).toHaveLength(1);
    expect((await call(`/clubs/${c.id}`, { token: b.token })).status).toBe(403);
    const joined = (await call('/clubs/join', { token: b.token, body: { invite: c.invite } })).data.club;
    expect(joined.members.map((m: { name: string }) => m.name)).toEqual(['Founder', 'Friend']);
    await call(`/clubs/${c.id}/results`, { token: a.token, body: { place: 2 } });
    const league = (await call(`/clubs/${c.id}/results`, { token: b.token, body: { place: 1 } })).data.league;
    expect(league.map((r: { name: string; points: number }) => [r.name, r.points])).toEqual([
      ['Friend', 4],
      ['Founder', 2],
    ]);
    await call(`/clubs/${c.id}/tables`, { token: a.token, body: { code: 'abcde', title: 'Club night' } });
    expect((await call(`/clubs/${c.id}`, { token: b.token })).data.club.tables[0].code).toBe('abcde');
    expect((await call('/clubs', { token: b.token })).data.clubs).toHaveLength(1);
  });

  it('league tables sort by points, then wins', () => {
    const w = weekOf(new Date('2026-10-15T12:00:00Z'));
    expect(w).toBe('2026-10-12');
    const rows = leagueTable(
      [
        { uid: 'a', name: 'A', week: w, place: 2 },
        { uid: 'a', name: 'A', week: w, place: 2 },
        { uid: 'b', name: 'B', week: w, place: 1 },
        { uid: 'c', name: 'C', week: '2026-10-05', place: 1 },
      ],
      w,
    );
    // Level on points: B's win puts B first.
    expect(rows.map((r) => [r.name, r.points, r.wins])).toEqual([
      ['B', 4, 1],
      ['A', 4, 0],
    ]);
  });
});

describe('reminders', () => {
  it('records opt-ins (sending waits for an email provider)', async () => {
    const a = await register('Remind', 'remind@example.com');
    const r = await call('/reminders', { method: 'PUT', token: a.token, body: { daily: true, streak: true, friend: false } });
    expect(r.data).toMatchObject({ prefs: { email: 'remind@example.com', daily: true, streak: true, friend: false }, sending: false });
  });
});

describe('live-table relay (WebSocket)', () => {
  const lobbies: CloudLobby[] = [];
  afterAll(() => lobbies.forEach((l) => l.close()));
  const until = async (cond: () => boolean, ms = 3000) => {
    const end = Date.now() + ms;
    while (!cond()) {
      if (Date.now() > end) throw new Error('timed out');
      await new Promise((r) => setTimeout(r, 10));
    }
  };

  it('two cloud clients join a table and exchange presence', async () => {
    const a = await connectCloud(srv.url, () => null);
    const b = await connectCloud(srv.url, () => null);
    lobbies.push(a, b);
    expect(a.connected()).toBe(true);
    await a.presence({ who: { name: 'Aiko' } });
    await until(() => b.peers().some((p) => (p.presence.who as { name?: string })?.name === 'Aiko'));

    const ra = await a.join('jc-tbl01');
    const rb = await b.join('jc-tbl01');
    let seen: RoomPeer[] = [];
    rb.onPeers((c) => (seen = [...c.peers]));
    await ra.presence({ role: 'host', table: { title: 'Aiko’s table' } });
    await until(() => seen.some((p) => p.presence.role === 'host'));
    expect(rb.peers().filter((p) => p.isMe)).toHaveLength(1);
    expect(ra.peers()).toHaveLength(2);

    // Over 4 KiB is refused, as on claude.ai.
    await expect(ra.presence({ big: 'x'.repeat(5000) })).rejects.toThrow();
    // null deletes a key.
    await ra.presence({ table: null });
    await until(() => !rb.peers().find((p) => !p.isMe)?.presence.table);

    await rb.leave();
    await until(() => ra.peers().length === 1);
  });

  it('carries lockstep decisions from guest to host and back', async () => {
    const a = await connectCloud(srv.url, () => null);
    const b = await connectCloud(srv.url, () => null);
    lobbies.push(a, b);
    const ra = await a.join('jc-lock1');
    const rb = await b.join('jc-lock1');
    await until(() => ra.peers().length === 2 && rb.peers().length === 2);
    const host = ra.peers().find((p) => p.isMe)!.peer;
    const guest = rb.peers().find((p) => p.isMe)!.peer;
    const hl = new RoomLink(ra, [host, guest, null, null], host, true);
    const gl = new RoomLink(rb, [host, guest, null, null], host, false);
    gl.publish(0, 3, { t: 'd', s: 1, id: 42 });
    expect(await hl.next(1, 0, 3)).toEqual({ t: 'd', s: 1, id: 42 });
    hl.publish(0, 4, { t: 'd', s: 0, id: 7 });
    expect(await gl.next(0, 0, 4)).toEqual({ t: 'd', s: 0, id: 7 });
    hl.close();
    gl.close();
  });
});
