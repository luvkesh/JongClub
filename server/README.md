# JongClub server

A small Node 22 service for the parts of JongClub that need to be shared between
people and devices: accounts, profiles, ratings, private clubs, reminder opt-ins and
the relay for live tables. It uses only Node built-ins (no npm packages): `node:http`,
`node:crypto`, `node:sqlite` and a hand-written WebSocket (RFC 6455) in `ws.js`.

The game works without it exactly as before (local profiles, AI clubs, live tables only
inside claude.ai). Point the game at a server and those features switch over.

## Run it locally

```bash
npm run server                      # http://127.0.0.1:8787, data in ./data/jongclub.sqlite
VITE_JONGCLUB_SERVER=http://127.0.0.1:8787 npm run dev
```

Instead of the build variable you can point an already built game at a server from the
browser console: `localStorage.setItem('jongclub.server.v1', 'http://127.0.0.1:8787')`, then
reload (remove the key to go back to local play).

Tests: `npx vitest run test/server.test.ts` starts the server on a random port with memory
storage, and covers accounts, tampered tokens, Google ID token checks (RS256 against a test
JWKS), profile sync, clubs, reminders, and two cloud clients exchanging presence and
lockstep decisions over the WebSocket relay.

## Environment

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `8787` | HTTP and WebSocket port. |
| `HOST` | `127.0.0.1` | Interface to listen on. Use `0.0.0.0` in a container. |
| `JONGCLUB_STORE` | `sqlite` | `sqlite` (falls back to `json` when `node:sqlite` is missing), `json` or `memory`. |
| `JONGCLUB_DATA` | `./data/jongclub` | Data file path without extension (`.sqlite` or `.json` is added). |
| `SESSION_SECRET` | generated | HMAC key for session tokens. If unset, one is generated and kept in the store. Set it explicitly in production. |
| `ALLOWED_ORIGINS` | any | Comma-separated origins allowed by CORS and for WebSocket upgrades, e.g. `https://jongclub.com`. Set it in production. |
| `GOOGLE_CLIENT_ID` | unset | Google sign-in. The same Web client ID as the game's `VITE_GOOGLE_CLIENT_ID` (comma-separate several). Unset: Google sign-in is refused (501). |
| `APPLE_SERVICES_ID` | unset | Sign in with Apple. The Services ID (the game's `VITE_APPLE_SERVICES_ID`); add an app bundle ID after a comma if a native app signs in too. Unset: refused (501). |
| `GOOGLE_JWKS_URL`, `APPLE_JWKS_URL` | provider's | Only for tests. |
| `EMAIL_PROVIDER` | unset | Reminder emails. Unset: opt-ins are recorded but nothing is sent. See below. |

`node:sqlite` is built into Node 22 and prints an "experimental" warning once at start;
that is expected. Postgres can replace it later: `store.js` documents the five-method
interface (get, put, del, list, close) a Postgres store would implement.

## What it does

**Accounts and sessions** (`auth.js`). Email and password, hashed with scrypt (N=16384,
parameters stored with the hash). Google and Apple: the game sends the provider's ID
token; the server fetches the provider's published keys (JWKS, cached for an hour),
checks the RS256 signature, issuer, audience (your client ID) and expiry, then finds or
creates the account. A verified email that already has an account joins it. Sessions are
HMAC-SHA256 signed tokens (60 days), sent as `Authorization: Bearer`. Sign-in attempts are
limited to 20 a minute per address.

**Profile sync** (`/profile`, client in `src/progression/cloudSync.ts`). Last write wins per
top-level profile field, by the time the field changed on the device. A device's first sync
sends its fields as old, so a fresh device never overwrites a profile the server already
has; a guest's progress still carries into a new empty account. Known limit: two devices
adding Jong Points between syncs keep the later total, not the sum. That moves to
server-side events once the server referees games.

**Ratings** (`/leaderboard`, `/clubs/:id/leaderboard`). Read from synced profiles. Until the
server referees games, ranked results are reported by the players' own clients, so treat
the global board as friendly, not official.

**Private clubs** (`/clubs…`). Found (name, crest, variation, length, house rules), join by
invite code, leave, record a result (4/2/1/0 league points), this week's league
(Monday to Sunday, UTC), club tables (listed for three hours), and members' leaderboard.

**Reminders** (`/reminders`). Records each account's email opt-in for "daily ready",
"friend at a table" and "streak ending". Sending needs an email provider (below).
On the device, reminders already work as notifications while the game is open or
installed (`src/ui/reminders.ts`).

**Live tables** (`rooms.js`, client `src/net/cloud.ts`). WebSocket at `/rt`. Rooms with the
same semantics as the claude.ai `room` capability that `src/net/room.ts` describes:
per-peer presence objects, top-level patches (null deletes a key), at most 4 KiB per peer,
every change broadcast to the room, join and leave. The lobby is the room `lobby`; a table
is `jc-<code>`. The server does not read game moves: lockstep rides inside presence and
the host's browser referees, as before. A tab keeps its peer label across reconnects (a
secret resume key), so a short drop doesn't free its seat. Messages are rate-limited per
connection (burst 40, 20 a second).

## API

All JSON. `Authorization: Bearer <token>` where marked (auth). Paths may also be prefixed
with `/api`.

| Method and path | Body | Answer |
| --- | --- | --- |
| `GET /health` | | `{ ok, storage }` |
| `GET /config` | | `{ email, google, apple, emailReminders }` |
| `POST /auth/register` | `{ name, email, password }` | `{ token, user }` |
| `POST /auth/login` | `{ email, password }` | `{ token, user }` |
| `POST /auth/google` | `{ idToken }` | `{ token, user }` |
| `POST /auth/apple` | `{ idToken, name? }` | `{ token, user }` |
| `GET /me` (auth) | | `{ user }` |
| `GET /profile` (auth) | | `{ fields: { key: { v, t } } }` |
| `PUT /profile` (auth) | `{ fields: { key: { v, t } } }` | `{ fields, accepted }` |
| `GET /leaderboard?variation=` | | `{ rows }` |
| `GET /clubs` (auth) | | `{ clubs }` |
| `POST /clubs` (auth) | `{ name, crest, variation, length, houseRules }` | `{ club }` |
| `POST /clubs/join` (auth) | `{ invite }` | `{ club }` |
| `GET /clubs/:id` (auth, member) | | `{ club }` |
| `POST /clubs/:id/leave` (auth) | | `{ ok }` |
| `POST /clubs/:id/results` (auth) | `{ place }` | `{ league }` |
| `GET /clubs/:id/league?week=` (auth) | | `{ week, league }` |
| `GET /clubs/:id/leaderboard` (auth) | | `{ rows }` |
| `POST /clubs/:id/tables` (auth) | `{ code, title }` | `{ tables }` |
| `DELETE /clubs/:id/tables/:code` (auth) | | `{ tables }` |
| `GET /reminders` (auth) | | `{ prefs, sending }` |
| `PUT /reminders` (auth) | `{ email?, daily, friend, streak }` | `{ prefs, sending }` |
| `GET /rt?peer=&key=&token=` | WebSocket | protocol in `rooms.js` |

## What you need to provide to go live

1. **Hosting.** Any host that runs a long-lived Node 22 process with WebSockets and a
   persistent disk (for SQLite), for example a small VM, Fly.io, Railway or Render. Run
   `node server/index.js` with `HOST=0.0.0.0`, behind HTTPS (the host's proxy or Caddy/nginx).
   For more than one server instance, swap SQLite for Postgres (see `store.js`) and add a
   shared pub/sub for rooms; one instance is plenty to start.
2. **Domain.** For example `api.jongclub.com` (or the game's own domain with `/api` routed
   to the server). Then build the game with `VITE_JONGCLUB_SERVER=https://api.jongclub.com`
   and set `ALLOWED_ORIGINS=https://jongclub.com`.
3. **Google OAuth Web client ID.** Google Cloud Console › APIs & Services › Credentials ›
   OAuth client ID › Web application, with the game's origin under Authorised JavaScript
   origins. Set it as `VITE_GOOGLE_CLIENT_ID` (game) and `GOOGLE_CLIENT_ID` (server).
4. **Apple Services ID and key.** In Apple Developer: a Services ID with Sign in with Apple
   enabled, the domain verified and the return URL registered (`VITE_APPLE_REDIRECT_URI`).
   Set `VITE_APPLE_SERVICES_ID` (game) and `APPLE_SERVICES_ID` (server). The server only
   verifies the ID token, which needs no private key; the Sign in with Apple key (.p8, key
   ID, team ID) is needed later only if the server should exchange authorisation codes or
   revoke tokens.
5. **Email sending provider** for reminder emails (item 10): for example Postmark, Amazon
   SES, Resend or SendGrid, with a sending domain (SPF/DKIM set up) and an API key. Then a
   small daily job reads the `reminders` collection and sends; `EMAIL_PROVIDER`, an API key
   and a from-address go in the environment. Until then opt-ins are only recorded.
6. **A session secret** (`SESSION_SECRET`, 32+ random bytes) and backups of the data file.
