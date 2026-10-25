// The JongClub server: accounts, sessions, profile sync, ratings, private
// clubs, reminder opt-ins and the live-table relay, on Node built-ins only.
// See server/README.md for the API, environment and what going live needs.

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { APPLE, GOOGLE, checkPassword, hashPassword, readSession, signSession, verifyIdToken } from './auth.js';
import { RoomHub } from './rooms.js';
import { openStore } from './store.js';
import { acceptWebSocket } from './ws.js';

const BODY_LIMIT = 300 * 1024;
const PROFILE_LIMIT = 256 * 1024;
const FIELD = /^[A-Za-z][A-Za-z0-9_]{0,40}$/;
const CONTROL = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069]', 'g');
const cleanName = (s, max = 24) => String(s ?? '').replace(CONTROL, '').trim().slice(0, max);
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const list = (s) => String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const id = (n = 9) => randomBytes(n).toString('base64url').replace(/[-_]/g, 'x');

/** Monday (UTC) of the week holding `date`, as YYYY-MM-DD: the club league's week. */
export function weekOf(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** League points for a finishing place (1st..4th). */
export const LEAGUE_POINTS = [4, 2, 1, 0];

export function leagueTable(results, week) {
  const rows = new Map();
  for (const r of results) {
    if (r.week !== week) continue;
    const row = rows.get(r.uid) ?? { uid: r.uid, name: r.name, games: 0, wins: 0, points: 0 };
    row.name = r.name;
    row.games++;
    if (r.place === 1) row.wins++;
    row.points += LEAGUE_POINTS[r.place - 1] ?? 0;
    rows.set(r.uid, row);
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.games - b.games || a.name.localeCompare(b.name));
}

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const fail = (status, code, message) => {
  throw new HttpError(status, code, message);
};

/**
 * Start the server. Every option falls back to the environment variable of the same
 * meaning (see README). Resolves once listening: { port, url, store, close() }.
 */
export async function startServer(opts = {}) {
  const env = { ...process.env, ...(opts.env ?? {}) };
  const store = opts.store ?? openStore(env.JONGCLUB_STORE || 'sqlite', env.JONGCLUB_DATA || './data/jongclub');
  const fetchImpl = opts.fetch ?? fetch;
  const google = { ...GOOGLE, jwks: env.GOOGLE_JWKS_URL || GOOGLE.jwks, audiences: list(env.GOOGLE_CLIENT_ID) };
  const apple = { ...APPLE, jwks: env.APPLE_JWKS_URL || APPLE.jwks, audiences: list(env.APPLE_SERVICES_ID) };
  const origins = list(env.ALLOWED_ORIGINS);
  const emailProvider = env.EMAIL_PROVIDER || '';

  // The signing secret: from the environment, else generated once and kept in the store.
  let secret = env.SESSION_SECRET;
  if (!secret) {
    secret = store.get('meta', 'secret')?.value;
    if (!secret) {
      secret = randomBytes(32).toString('hex');
      store.put('meta', 'secret', { value: secret });
    }
  }

  const hub = new RoomHub();

  // ---------------------------------------------------------------- helpers

  const tries = new Map();
  /** Sign-in attempts: 20 a minute per address. */
  const throttle = (ip) => {
    const now = Date.now();
    const t = tries.get(ip);
    if (!t || t.reset < now) return void tries.set(ip, { n: 1, reset: now + 60_000 });
    if (++t.n > 20) fail(429, 'rate_limited', 'Too many attempts. Wait a minute and try again.');
  };

  const userOf = (req) => {
    const h = req.headers.authorization ?? '';
    const uid = h.startsWith('Bearer ') ? readSession(secret, h.slice(7)) : null;
    return uid ? store.get('users', uid) : null;
  };
  const need = (req) => userOf(req) ?? fail(401, 'unauthorised', 'Sign in first.');

  const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email ?? null, providers: Object.keys(u.ids ?? {}), created: u.created });
  const session = (u) => ({ token: signSession(secret, u.id), user: publicUser(u) });

  const newUser = (name, email) => {
    const u = { id: id(), name: cleanName(name) || 'Player', email: email || null, ids: {}, created: new Date().toISOString() };
    store.put('users', u.id, u);
    if (email) store.put('emails', email, { uid: u.id });
    return u;
  };

  /** Find or create the account for a verified Google or Apple identity. */
  const identity = (provider, claims, nameHint) => {
    const key = `${provider}:${claims.sub}`;
    const link = store.get('identities', key);
    let u = link ? store.get('users', link.uid) : null;
    if (!u) {
      const email = typeof claims.email === 'string' && claims.email_verified !== false && claims.email_verified !== 'false' ? claims.email.toLowerCase() : null;
      // A verified email that already has an account joins that account.
      const byEmail = email ? store.get('emails', email) : null;
      u = byEmail ? store.get('users', byEmail.uid) : null;
      u ??= newUser(cleanName(claims.name) || cleanName(nameHint) || (email ? email.split('@')[0] : 'Player'), email);
      u.ids = { ...(u.ids ?? {}), [provider]: claims.sub };
      store.put('users', u.id, u);
      store.put('identities', key, { uid: u.id });
    }
    return u;
  };

  const clubFor = (cid, u) => {
    const c = store.get('clubs', cid) ?? fail(404, 'not_found', 'No such club.');
    if (!c.members.some((m) => m.uid === u.id)) fail(403, 'forbidden', 'Members only.');
    return c;
  };
  const clubView = (c) => ({ ...c, results: undefined, league: leagueTable(c.results, weekOf()), week: weekOf() });

  // ---------------------------------------------------------------- routes

  const routes = [
    ['GET', /^\/health$/, () => ({ ok: true, storage: store.kind })],
    ['GET', /^\/config$/, () => ({ email: true, google: google.audiences.length > 0, apple: apple.audiences.length > 0, emailReminders: !!emailProvider })],

    // Accounts.
    ['POST', /^\/auth\/register$/, async (req, b) => {
      throttle(req.socket.remoteAddress);
      const email = String(b.email ?? '').trim().toLowerCase();
      if (!cleanName(b.name)) fail(400, 'invalid', 'Enter the name other players will see.');
      if (!emailOk(email)) fail(400, 'invalid', 'That email address doesn’t look right.');
      if (String(b.password ?? '').length < 8) fail(400, 'invalid', 'Use a password of at least 8 characters.');
      if (store.get('emails', email)) fail(409, 'exists', 'There’s already an account for that email. Sign in instead.');
      const u = newUser(b.name, email);
      u.password = await hashPassword(String(b.password));
      store.put('users', u.id, u);
      return session(u);
    }],
    ['POST', /^\/auth\/login$/, async (req, b) => {
      throttle(req.socket.remoteAddress);
      const email = String(b.email ?? '').trim().toLowerCase();
      const link = store.get('emails', email);
      const u = link ? store.get('users', link.uid) : null;
      // One message for both cases, so the form doesn't reveal which emails exist.
      if (!u?.password || !(await checkPassword(String(b.password ?? ''), u.password))) fail(401, 'wrong', 'That email and password don’t match an account.');
      return session(u);
    }],
    ['POST', /^\/auth\/(google|apple)$/, async (req, b, m) => {
      throttle(req.socket.remoteAddress);
      const p = m[1] === 'google' ? google : apple;
      if (!p.audiences.length) fail(501, 'not_configured', `${m[1] === 'google' ? 'Google' : 'Apple'} sign-in isn’t set up on this server.`);
      let claims;
      try {
        claims = await verifyIdToken(b.idToken, { ...p, fetch: fetchImpl });
      } catch (e) {
        fail(401, 'bad_token', `That sign-in couldn’t be checked (${e.message}).`);
      }
      return session(identity(m[1], claims, b.name));
    }],
    ['GET', /^\/me$/, (req) => ({ user: publicUser(need(req)) })],

    // Profile sync: last write wins per top-level field, by the client's timestamp.
    ['GET', /^\/profile$/, (req) => ({ fields: store.get('profiles', need(req).id)?.fields ?? {} })],
    ['PUT', /^\/profile$/, (req, b) => {
      const u = need(req);
      const doc = store.get('profiles', u.id) ?? { fields: {} };
      const now = Date.now();
      const accepted = [];
      for (const [k, f] of Object.entries(b.fields ?? {})) {
        if (!FIELD.test(k) || !f || typeof f !== 'object' || !('v' in f)) continue;
        const t = Math.min(Number(f.t) || 0, now + 60_000);
        const cur = doc.fields[k];
        if (cur && cur.t >= t) continue;
        doc.fields[k] = { v: f.v, t };
        accepted.push(k);
      }
      if (Object.keys(doc.fields).length > 80 || Buffer.byteLength(JSON.stringify(doc)) > PROFILE_LIMIT) fail(413, 'too_large', 'Profile is too large.');
      doc.updatedAt = now;
      store.put('profiles', u.id, doc);
      // The display name follows the profile.
      const name = cleanName(doc.fields.name?.v);
      if (name && name !== u.name) store.put('users', u.id, { ...u, name });
      return { fields: doc.fields, accepted };
    }],

    // Ratings: read from synced profiles. Ranked results are reported by the
    // players' own clients until the server referees games (see README).
    ['GET', /^\/leaderboard$/, (req, _b, _m, q) => {
      const v = q.get('variation') || 'overall';
      const limit = Math.min(100, Number(q.get('limit')) || 50);
      const me = userOf(req);
      const rows = [];
      for (const u of store.list('users')) {
        const f = store.get('profiles', u.id)?.fields;
        if (!f?.ratedGames?.v) continue;
        const rating = v === 'overall' ? f.rating?.v : f.ratings?.v?.[v];
        if (typeof rating !== 'number') continue;
        rows.push({ name: cleanName(f.name?.v) || u.name, rating, region: f.region?.v ?? null, avatar: f.avatar?.v ?? null, me: me?.id === u.id });
      }
      rows.sort((a, b) => b.rating - a.rating);
      return { variation: v, rows: rows.slice(0, limit).map((r, i) => ({ rank: i + 1, ...r })) };
    }],

    // Private clubs.
    ['GET', /^\/clubs$/, (req) => {
      const u = need(req);
      return { clubs: store.list('clubs').filter((c) => c.members.some((m) => m.uid === u.id)).map(clubView) };
    }],
    ['POST', /^\/clubs$/, (req, b) => {
      const u = need(req);
      const name = cleanName(b.name, 32);
      if (!name) fail(400, 'invalid', 'Give the club a name.');
      if (store.list('clubs').filter((c) => c.owner === u.id).length >= 5) fail(400, 'limit', 'You can found up to five clubs.');
      const c = {
        id: id(),
        name,
        crest: cleanName(b.crest, 40) || 'jade',
        variation: cleanName(b.variation, 24) || 'classic',
        length: cleanName(b.length, 24) || 'eastRound',
        houseRules: Object.fromEntries(Object.entries(b.houseRules ?? {}).slice(0, 40).map(([k, v]) => [cleanName(k, 40), cleanName(v, 40)])),
        owner: u.id,
        invite: id(6).toLowerCase(),
        created: new Date().toISOString(),
        members: [{ uid: u.id, name: u.name, role: 'founder', joined: new Date().toISOString() }],
        results: [],
        tables: [],
      };
      store.put('clubs', c.id, c);
      store.put('invites', c.invite, { club: c.id });
      return { club: clubView(c) };
    }],
    ['POST', /^\/clubs\/join$/, (req, b) => {
      const u = need(req);
      const link = store.get('invites', String(b.invite ?? '').trim().toLowerCase());
      const c = link ? store.get('clubs', link.club) : null;
      if (!c) fail(404, 'not_found', 'That invite isn’t valid any more.');
      if (!c.members.some((m) => m.uid === u.id)) {
        if (c.members.length >= 200) fail(400, 'full', 'This club is full.');
        c.members.push({ uid: u.id, name: u.name, role: 'member', joined: new Date().toISOString() });
        store.put('clubs', c.id, c);
      }
      return { club: clubView(c) };
    }],
    ['GET', /^\/clubs\/([\w]+)$/, (req, _b, m) => ({ club: clubView(clubFor(m[1], need(req))) })],
    ['POST', /^\/clubs\/([\w]+)\/leave$/, (req, _b, m) => {
      const u = need(req);
      const c = clubFor(m[1], u);
      c.members = c.members.filter((x) => x.uid !== u.id);
      if (!c.members.length) {
        store.del('clubs', c.id);
        store.del('invites', c.invite);
      } else {
        if (c.owner === u.id) c.owner = c.members[0].uid;
        store.put('clubs', c.id, c);
      }
      return { ok: true };
    }],
    ['POST', /^\/clubs\/([\w]+)\/results$/, (req, b, m) => {
      const u = need(req);
      const c = clubFor(m[1], u);
      const place = Number(b.place);
      if (!(place >= 1 && place <= 4)) fail(400, 'invalid', 'Place must be 1 to 4.');
      c.results.push({ uid: u.id, name: u.name, week: weekOf(), place, at: new Date().toISOString() });
      // Keep about two months of games.
      const oldest = weekOf(new Date(Date.now() - 63 * 86_400_000));
      c.results = c.results.filter((r) => r.week >= oldest).slice(-5000);
      store.put('clubs', c.id, c);
      return { league: leagueTable(c.results, weekOf()) };
    }],
    ['GET', /^\/clubs\/([\w]+)\/league$/, (req, _b, m, q) => {
      const c = clubFor(m[1], need(req));
      const week = q.get('week') || weekOf();
      return { week, league: leagueTable(c.results, week) };
    }],
    ['GET', /^\/clubs\/([\w]+)\/leaderboard$/, (req, _b, m, q) => {
      const c = clubFor(m[1], need(req));
      const v = q.get('variation') || c.variation;
      const rows = c.members.map((mem) => {
        const f = store.get('profiles', mem.uid)?.fields ?? {};
        const rating = (v === 'overall' ? f.rating?.v : f.ratings?.v?.[v]) ?? f.rating?.v ?? 1000;
        return { uid: mem.uid, name: mem.name, rating: typeof rating === 'number' ? rating : 1000, avatar: f.avatar?.v ?? null };
      });
      rows.sort((a, b) => b.rating - a.rating);
      return { variation: v, rows };
    }],
    ['POST', /^\/clubs\/([\w]+)\/tables$/, (req, b, m) => {
      const u = need(req);
      const c = clubFor(m[1], u);
      const code = String(b.code ?? '').toLowerCase();
      if (!/^[a-z0-9]{5}$/.test(code)) fail(400, 'invalid', 'Bad table code.');
      const fresh = Date.now() - 3 * 3600_000;
      c.tables = c.tables.filter((t) => t.code !== code && Date.parse(t.at) > fresh).slice(-20);
      c.tables.push({ code, title: cleanName(b.title, 32) || `${u.name}’s table`, host: u.name, at: new Date().toISOString() });
      store.put('clubs', c.id, c);
      return { tables: c.tables };
    }],
    ['DELETE', /^\/clubs\/([\w]+)\/tables\/([a-z0-9]{5})$/, (req, _b, m) => {
      const c = clubFor(m[1], need(req));
      c.tables = c.tables.filter((t) => t.code !== m[2]);
      store.put('clubs', c.id, c);
      return { tables: c.tables };
    }],

    // Reminder opt-ins. Sending email needs a provider (README); until then this only records the choice.
    ['GET', /^\/reminders$/, (req) => ({ prefs: store.get('reminders', need(req).id) ?? null, sending: !!emailProvider })],
    ['PUT', /^\/reminders$/, (req, b) => {
      const u = need(req);
      const email = String(b.email ?? u.email ?? '').trim().toLowerCase();
      const prefs = { email: emailOk(email) ? email : null, daily: !!b.daily, friend: !!b.friend, streak: !!b.streak, updatedAt: new Date().toISOString() };
      store.put('reminders', u.id, prefs);
      return { prefs, sending: !!emailProvider };
    }],
  ];

  // ---------------------------------------------------------------- HTTP

  const cors = (req, res) => {
    const o = req.headers.origin;
    if (!o) return;
    if (!origins.length || origins.includes(o)) {
      res.setHeader('Access-Control-Allow-Origin', o);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Max-Age', '600');
    }
  };

  const readBody = (req) =>
    new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > BODY_LIMIT) {
          reject(new HttpError(413, 'too_large', 'Request too large.'));
          req.destroy();
        } else chunks.push(c);
      });
      req.on('end', () => {
        if (!size) return resolve({});
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          reject(new HttpError(400, 'bad_json', 'Body must be JSON.'));
        }
      });
      req.on('error', reject);
    });

  const server = createServer(async (req, res) => {
    cors(req, res);
    const send = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') return res.writeHead(204).end();
    const url = new URL(req.url ?? '/', 'http://local');
    const path = url.pathname.replace(/^\/api(?=\/)/, '');
    try {
      for (const [method, re, fn] of routes) {
        const m = re.exec(path);
        if (!m || method !== req.method) continue;
        const body = method === 'GET' || method === 'DELETE' ? {} : await readBody(req);
        return send(200, await fn(req, body && typeof body === 'object' ? body : {}, m, url.searchParams));
      }
      send(404, { error: 'not_found', message: 'No such endpoint.' });
    } catch (e) {
      if (e instanceof HttpError) return send(e.status, { error: e.code, message: e.message });
      console.error(e);
      send(500, { error: 'server_error', message: 'Something went wrong on the server.' });
    }
  });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://local');
    const o = req.headers.origin;
    if (url.pathname.replace(/^\/api(?=\/)/, '') !== '/rt' || (o && origins.length && !origins.includes(o))) return socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
    const ws = acceptWebSocket(req, socket, head);
    if (!ws) return;
    const uid = readSession(secret, url.searchParams.get('token'));
    const u = uid ? store.get('users', uid) : null;
    hub.attach(ws, { peer: url.searchParams.get('peer'), key: url.searchParams.get('key') }, u ? { uid: u.id, name: u.name } : null);
  });

  await new Promise((resolve) => server.listen(opts.port ?? Number(env.PORT ?? 8787), opts.host ?? env.HOST ?? '127.0.0.1', resolve));
  const port = server.address().port;
  return {
    port,
    url: `http://127.0.0.1:${port}`,
    store,
    hub,
    close: () =>
      new Promise((resolve) => {
        hub.closeAll();
        server.close(() => {
          store.close();
          resolve();
        });
        server.closeAllConnections?.();
      }),
  };
}
