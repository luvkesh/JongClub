// Private member clubs: a player founds a club with a name, a crest, a home
// variation and house rules; members join by invite link; the club has its own
// tables, a weekly league and a leaderboard.
//
// With a club server and a signed-in account, clubs live on the server and
// members are real people (server/app.js). Without one, a club is kept on this
// device and filled with members of the AI club roster (roster.ts), whose
// weekly league games are simulated from a fixed seed, so the screen means
// something offline too. Your own games at the club's tables count in both.

import { currentAccount } from '../auth/account';
import { api, cloudSignedIn } from '../net/api';
import { ROSTER, isOnline, type ClubMember } from './roster';
import { seedOf, unit } from './util';
import type { AvatarSpec } from '../cosmetics/catalog';
import { TABLES } from '../cosmetics/catalog';
import { tr } from '../i18n';

export interface ClubPerson {
  id: string;
  name: string;
  role: 'founder' | 'member';
  joined: string;
  /** An AI member of the club roster (local clubs). */
  ai?: boolean;
  avatar?: AvatarSpec;
}

export interface ClubTable {
  code: string;
  title: string;
  host: string;
  at: string;
}

export interface LeagueRow {
  id: string;
  name: string;
  games: number;
  wins: number;
  points: number;
  me?: boolean;
}

export interface PrivateClub {
  id: string;
  name: string;
  /** "<table colourway>|<emblem>", see CRESTS. */
  crest: string;
  variation: string;
  length: string;
  houseRules: Record<string, string>;
  invite: string;
  created: string;
  members: ClubPerson[];
  tables: ClubTable[];
  league: LeagueRow[];
  /** Monday of this league week (UTC). */
  week: string;
  /** Kept on this device (no server). */
  local: boolean;
}

export interface RatingRow {
  id: string;
  name: string;
  rating: number;
  me?: boolean;
  avatar?: AvatarSpec;
}

export interface ClubSpec {
  name: string;
  crest: string;
  variation: string;
  length: string;
  houseRules: Record<string, string>;
}

// ------------------------------------------------------------ crests and the league

/** Crest emblems: the brand mark or an honour tile. Colourways come from the Atelier's tables. */
export const CREST_EMBLEMS: { id: string; label: string; kind?: number }[] = [
  { id: 'mark', label: tr('JongClub mark') },
  { id: 'red', label: tr('Red Dragon'), kind: 31 },
  { id: 'green', label: tr('Green Dragon'), kind: 32 },
  { id: 'white', label: tr('White Dragon'), kind: 33 },
  { id: 'east', label: tr('East Wind'), kind: 27 },
  { id: 'south', label: tr('South Wind'), kind: 28 },
  { id: 'west', label: tr('West Wind'), kind: 29 },
  { id: 'north', label: tr('North Wind'), kind: 30 },
];

export function crestOf(crest: string) {
  const [table, emblem] = crest.split('|');
  return { table: TABLES.find((t) => t.id === table) ?? TABLES[2], emblem: CREST_EMBLEMS.find((e) => e.id === emblem) ?? CREST_EMBLEMS[0] };
}

/** League points for 1st..4th. */
export const LEAGUE_POINTS = [4, 2, 1, 0];

/** Monday (UTC) of the week holding `date`, as YYYY-MM-DD. */
export function leagueWeek(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export interface ClubResult {
  id: string;
  name: string;
  week: string;
  place: number;
}

export function leagueTable(results: ClubResult[], week: string): LeagueRow[] {
  const rows = new Map<string, LeagueRow>();
  for (const r of results) {
    if (r.week !== week) continue;
    const row = rows.get(r.id) ?? { id: r.id, name: r.name, games: 0, wins: 0, points: 0 };
    row.games++;
    if (r.place === 1) row.wins++;
    row.points += LEAGUE_POINTS[r.place - 1] ?? 0;
    rows.set(r.id, row);
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.games - b.games || a.name.localeCompare(b.name));
}

// ------------------------------------------------------------ local clubs (no server)

interface LocalStore {
  clubs: (Omit<PrivateClub, 'league' | 'week' | 'local' | 'members'> & { memberIds: string[] })[];
  results: Record<string, ClubResult[]>;
}

const storeKey = () => {
  const a = currentAccount();
  return a && a.provider !== 'guest' ? `jongclub.clubs.v1:${a.id}` : 'jongclub.clubs.v1';
};

function readLocal(): LocalStore {
  try {
    const s = JSON.parse(localStorage.getItem(storeKey()) ?? 'null');
    if (s && Array.isArray(s.clubs) && s.results && typeof s.results === 'object') return s;
  } catch {
    /* fall through */
  }
  return { clubs: [], results: {} };
}

function writeLocal(s: LocalStore) {
  try {
    localStorage.setItem(storeKey(), JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

const code = (n: number, seed: number) => {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < n; i++) s += a[seedOf(seed, i) % a.length];
  return s;
};

/** Six roster members who like the club's variation, picked from a seed. */
export function aiMembersFor(clubId: string, variation: string, n = 6): ClubMember[] {
  const ranked = ROSTER.map((m) => ({ m, k: unit(clubId, m.id) + (m.favoriteVariation === variation ? 0.6 : 0) })).sort((a, b) => b.k - a.k);
  return ranked.slice(0, n).map((x) => x.m);
}

/**
 * AI members' league games this week so far: a few games each, more for the
 * keen ones, placed by rating with some luck. Fixed for a given club, week and day.
 */
export function simulatedResults(clubId: string, members: ClubMember[], week: string, now: Date = new Date()): ClubResult[] {
  const days = Math.max(1, Math.min(7, Math.floor((now.getTime() - Date.parse(`${week}T00:00:00Z`)) / 86_400_000) + 1));
  const out: ClubResult[] = [];
  for (const m of members) {
    const games = Math.floor(unit(clubId, week, m.id, 'g') * m.activity * days * 0.7);
    for (let g = 0; g < games; g++) {
      const skill = (m.rating - 1500) / 1600;
      const roll = unit(clubId, week, m.id, g) - skill * 0.35;
      out.push({ id: m.id, name: m.name, week, place: roll < 0.25 ? 1 : roll < 0.5 ? 2 : roll < 0.78 ? 3 : 4 });
    }
  }
  return out;
}

function localView(c: LocalStore['clubs'][number], results: ClubResult[], now: Date): PrivateClub {
  const a = currentAccount();
  const meId = a?.id ?? 'guest';
  const ai = c.memberIds.map((id) => ROSTER.find((m) => m.id === id)).filter(Boolean) as ClubMember[];
  const week = leagueWeek(now);
  const members: ClubPerson[] = [
    { id: meId, name: 'You', role: 'founder', joined: c.created },
    ...ai.map((m): ClubPerson => ({ id: m.id, name: m.name, role: 'member', joined: c.created, ai: true, avatar: m.avatar })),
  ];
  // Members at the club right now sit at the club's tables, in twos and threes.
  const here = ai.filter((m) => isOnline(m, now));
  const tables: ClubTable[] = [];
  for (let i = 0; i + 1 < here.length; i += 3) tables.push({ code: code(5, seedOf(c.id, here[i].id)), title: tr('{name}’s table', { name: here[i].name }), host: here.slice(i, i + 3).map((m) => m.name).join(', '), at: now.toISOString() });
  const league = leagueTable([...simulatedResults(c.id, ai, week, now), ...results], week).map((r) => (r.id === meId ? { ...r, name: 'You', me: true } : r));
  return { ...c, members, tables, league, week, local: true };
}

const localBackend = {
  async list(now = new Date()): Promise<PrivateClub[]> {
    const s = readLocal();
    return s.clubs.map((c) => localView(c, s.results[c.id] ?? [], now));
  },
  async create(spec: ClubSpec, now = new Date()): Promise<PrivateClub> {
    const s = readLocal();
    const seed = seedOf(spec.name, now.getTime());
    const id = `local-${code(8, seed)}`;
    const c = { id, ...spec, invite: code(6, seed + 1), created: now.toISOString(), tables: [], memberIds: aiMembersFor(id, spec.variation).map((m) => m.id) };
    s.clubs.push(c);
    writeLocal(s);
    return localView(c, [], now);
  },
  async join(): Promise<PrivateClub> {
    throw new Error(tr('Joining a friend’s club needs the club server. Until it is live, found your own club here.'));
  },
  async leave(id: string) {
    const s = readLocal();
    s.clubs = s.clubs.filter((c) => c.id !== id);
    delete s.results[id];
    writeLocal(s);
  },
  async update(id: string, spec: Partial<ClubSpec>) {
    const s = readLocal();
    const c = s.clubs.find((x) => x.id === id);
    if (c) Object.assign(c, spec);
    writeLocal(s);
  },
  async result(id: string, place: number, now = new Date()) {
    const s = readLocal();
    const a = currentAccount();
    (s.results[id] ??= []).push({ id: a?.id ?? 'guest', name: 'You', week: leagueWeek(now), place });
    // Keep about two months.
    const oldest = leagueWeek(new Date(now.getTime() - 63 * 86_400_000));
    s.results[id] = s.results[id].filter((r) => r.week >= oldest);
    writeLocal(s);
  },
  async postTable() {},
  async dropTable() {},
  /** Members by rating in the club's variation (yours from your profile). */
  async leaderboard(club: PrivateClub, mine: { id: string; rating: number }): Promise<RatingRow[]> {
    const rows: RatingRow[] = club.members.map((m) => {
      const r = ROSTER.find((x) => x.id === m.id);
      return { id: m.id, name: m.name, avatar: m.avatar, rating: m.id === mine.id ? mine.rating : (r?.ratings[club.variation as keyof ClubMember['ratings']] ?? r?.rating ?? 1000), me: m.id === mine.id };
    });
    return rows.sort((a, b) => b.rating - a.rating);
  },
};

// ------------------------------------------------------------ server clubs

interface ServerClub extends Omit<PrivateClub, 'members' | 'league' | 'local'> {
  members: { uid: string; name: string; role: 'founder' | 'member'; joined: string }[];
  league: { uid: string; name: string; games: number; wins: number; points: number }[];
}

const fromServer = (c: ServerClub, me: string | undefined): PrivateClub => ({
  ...c,
  members: c.members.map((m) => ({ id: m.uid, name: m.name, role: m.role, joined: m.joined })),
  league: c.league.map((r) => ({ id: r.uid, name: r.name, games: r.games, wins: r.wins, points: r.points, me: r.uid === me })),
  local: false,
});

const myUid = () => currentAccount()?.id.replace(/^cloud-/, '');

const serverBackend = {
  async list(): Promise<PrivateClub[]> {
    return (await api<{ clubs: ServerClub[] }>('/clubs')).clubs.map((c) => fromServer(c, myUid()));
  },
  async create(spec: ClubSpec): Promise<PrivateClub> {
    return fromServer((await api<{ club: ServerClub }>('/clubs', { body: spec })).club, myUid());
  },
  async join(invite: string): Promise<PrivateClub> {
    return fromServer((await api<{ club: ServerClub }>('/clubs/join', { body: { invite } })).club, myUid());
  },
  async leave(id: string) {
    await api(`/clubs/${id}/leave`, { body: {} });
  },
  async update() {
    /* House rules are set when the club is founded (server clubs). */
  },
  async result(id: string, place: number) {
    await api(`/clubs/${id}/results`, { body: { place } });
  },
  async postTable(id: string, codeStr: string, title: string) {
    await api(`/clubs/${id}/tables`, { body: { code: codeStr, title } });
  },
  async dropTable(id: string, codeStr: string) {
    await api(`/clubs/${id}/tables/${codeStr}`, { method: 'DELETE' });
  },
  async leaderboard(club: PrivateClub): Promise<RatingRow[]> {
    const r = await api<{ rows: { uid: string; name: string; rating: number; avatar: AvatarSpec | null }[] }>(`/clubs/${club.id}/leaderboard`);
    const me = myUid();
    return r.rows.map((x) => ({ id: x.uid, name: x.name, rating: x.rating, avatar: x.avatar ?? undefined, me: x.uid === me }));
  },
};

/** Where clubs live right now: the server for a signed-in server account, else this device. */
export const clubsBackend = () => (cloudSignedIn() ? serverBackend : localBackend);
export const clubsAreLocal = () => !cloudSignedIn();

/** A game at a club table ended: count it in that club's league. Tags look like "club:<id>". */
export function clubOnFinish(tag: string | undefined, placement: number) {
  if (!tag?.startsWith('club:') || !(placement >= 1 && placement <= 4)) return;
  const id = tag.slice(5);
  void clubsBackend()
    .result(id, placement)
    .catch(() => {});
}

// ------------------------------------------------------------ invite links

const INVITE_KEY = 'jongclub.club-invite.v1';

/** A club invite from the page's link (?club=CODE), kept until the Club screen handles it. */
export function takeClubInvite(): boolean {
  try {
    const u = new URL(location.href);
    const c = u.searchParams.get('club')?.trim().toLowerCase();
    if (!c) return !!sessionStorage.getItem(INVITE_KEY);
    u.searchParams.delete('club');
    history.replaceState(null, '', u.toString());
    if (/^[a-z0-9]{4,16}$/.test(c)) sessionStorage.setItem(INVITE_KEY, c);
    return true;
  } catch {
    return false;
  }
}

export function pendingClubInvite(clear = false): string | null {
  try {
    const c = sessionStorage.getItem(INVITE_KEY);
    if (clear) sessionStorage.removeItem(INVITE_KEY);
    return c;
  } catch {
    return null;
  }
}

export function clubInviteLink(invite: string): string {
  const u = new URL(location.href);
  u.hash = '';
  u.search = '';
  u.searchParams.set('club', invite);
  return u.toString();
}
