// The season league table: you and the club members nearest you, ranked by
// season XP. Until there is a server, the members' progress is simulated
// deterministically from the roster (the same for everyone on the same day).
// Everything goes through loadSeasonLeague, so a server can replace the
// source without touching the screen.

import { ROSTER, type ClubMember } from './roster';
import { SEASON_DAYS, SEASON_TOTAL_XP, type SeasonInfo } from './seasons';
import { seedOf, unit } from './util';

export interface SeasonLeagueRow {
  rank: number;
  name: string;
  city: string;
  xp: number;
  me: boolean;
  member?: ClubMember;
}

/** How many players share a league table (you plus the members nearest you). */
export const LEAGUE_SIZE = 20;

/** A member's season XP at a point in the season: each has their own pace, most finish part of the track. */
export function memberSeasonXp(m: ClubMember, season: SeasonInfo, now: Date): number {
  const elapsed = Math.min(1, Math.max(0, (now.getTime() - season.start.getTime()) / (SEASON_DAYS * 86_400_000)));
  const pace = (0.2 + 1.1 * unit('season-pace', season.number, m.id)) * m.activity;
  const finish = SEASON_TOTAL_XP * Math.min(1.5, pace);
  // Some start fast and slow down, others build up: a gentle curve per member.
  const curve = 0.75 + 0.5 * unit('season-curve', season.number, m.id);
  const day = Math.floor(elapsed * SEASON_DAYS);
  const wobble = 1 + (unit('season-day', season.number, m.id, day) - 0.5) * 0.06;
  return Math.max(0, Math.round(finish * Math.pow(elapsed, curve) * wobble));
}

/** The members in your league this season: those nearest your rating, with a little seeded variety. */
export function leagueMembers(season: number, me: { name: string; rating: number }): ClubMember[] {
  const seed = seedOf('season-league', season, me.name);
  return [...ROSTER]
    .map((m) => ({ m, key: Math.abs(m.rating - me.rating) + unit(seed, m.id) * 300 }))
    .sort((a, b) => a.key - b.key || a.m.id.localeCompare(b.m.id))
    .slice(0, LEAGUE_SIZE - 1)
    .map((x) => x.m);
}

/** The simulated league table (sync), for tests and as the offline source. */
export function simulatedLeague(season: SeasonInfo, me: { name: string; rating: number; xp: number }, now: Date = new Date()): SeasonLeagueRow[] {
  const rows: Omit<SeasonLeagueRow, 'rank'>[] = [
    { name: me.name, city: 'You', xp: me.xp, me: true },
    ...leagueMembers(season.number, me).map((m) => ({ name: m.name, city: m.city, xp: memberSeasonXp(m, season, now), me: false, member: m })),
  ];
  // Ties never favour you: you are listed after anyone on the same XP.
  rows.sort((a, b) => b.xp - a.xp || (a.me ? 1 : b.me ? -1 : a.name.localeCompare(b.name)));
  return rows.map((r, i) => ({ rank: i + 1, ...r }));
}

/** The league table for a season. Async so a server can answer it later. */
export async function loadSeasonLeague(season: SeasonInfo, me: { name: string; rating: number; xp: number }, now: Date = new Date()): Promise<SeasonLeagueRow[]> {
  return simulatedLeague(season, me, now);
}
