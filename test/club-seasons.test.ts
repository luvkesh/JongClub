import { beforeEach, describe, expect, it } from 'vitest';
import { claimAll, claimStep, claimable, emptyProgress, addXp, finalsQualified, FINALS_STEP, rewardTrack, seasonAt, seasonInfo, seasonXpForGame, SEASON_DAYS, SEASON_EPOCH, SEASON_STEPS, SEASON_TOTAL_XP, SEASON_XP_MAX_AWARD, stepCost, stepOf, themeOf, xpToReach } from '../src/club/seasons';
import { SEASON_THEMES, seasonFrameId, seasonTableId, seasonTileSetId } from '../src/cosmetics/seasonal';
import { CATALOG, TABLES, TILE_SETS, byId } from '../src/cosmetics/catalog';
import { leagueMembers, LEAGUE_SIZE, memberSeasonXp, simulatedLeague } from '../src/club/seasonLeague';
import { createTournament, FORMAT_IDS, FORMATS, tournamentVariation } from '../src/club/tournament';
import { VARIATIONS } from '../src/engine/rules';
import { ROSTER } from '../src/club/roster';

describe('season calendar', () => {
  it('starts season 1 on the epoch, a Monday', () => {
    const s = seasonAt(SEASON_EPOCH);
    expect(s.number).toBe(1);
    expect(s.day).toBe(0);
    expect(s.week).toBe(1);
    expect(s.start.toISOString().slice(0, 10)).toBe(SEASON_EPOCH);
    expect(s.start.getUTCDay()).toBe(1);
  });

  it('runs six weeks, then the next season begins', () => {
    expect(SEASON_DAYS).toBe(42);
    const last = seasonAt('2026-11-15');
    expect(last.number).toBe(1);
    expect(last.day).toBe(41);
    expect(last.week).toBe(6);
    expect(last.finalsOpen).toBe(true);
    expect(last.daysLeft).toBe(1);
    const next = seasonAt('2026-11-16');
    expect(next.number).toBe(2);
    expect(next.day).toBe(0);
    expect(next.finalsOpen).toBe(false);
    expect(next.start.getTime()).toBe(last.end.getTime());
  });

  it('is the same season for everyone on the same UTC day, whatever the time', () => {
    expect(seasonAt('2026-10-16T00:00:01Z')).toEqual(seasonAt('2026-10-16T23:59:59Z'));
    expect(seasonAt(new Date('2026-10-16T12:00:00Z')).number).toBe(1);
    expect(seasonAt('2026-10-16').week).toBe(2);
  });

  it('opens the Finals only in the last week', () => {
    for (let d = 0; d < SEASON_DAYS; d++) expect(seasonInfo(3, d).finalsOpen).toBe(d >= 35);
  });

  it('counts dates before the epoch as season 1 and cycles themes through World Tour destinations', () => {
    expect(seasonAt('2020-01-01').number).toBe(1);
    expect(themeOf(1).id).toBe(SEASON_THEMES[0].id);
    expect(themeOf(SEASON_THEMES.length + 1).id).toBe(SEASON_THEMES[0].id);
    const ids = VARIATIONS.map((v) => v.id);
    for (const t of SEASON_THEMES) expect(ids).toContain(t.destination);
    // Seasons a year apart are still deterministic.
    expect(seasonAt('2027-10-16').number).toBe(Math.floor((Date.UTC(2027, 9, 16) - Date.UTC(2026, 9, 5)) / 86_400_000 / 42) + 1);
  });
});

describe('season XP curve', () => {
  it('has twenty steps that cost a little more each time', () => {
    expect(SEASON_STEPS).toBe(20);
    expect(stepCost(1)).toBe(200);
    expect(stepCost(20)).toBe(390);
    for (let k = 2; k <= 20; k++) expect(stepCost(k)).toBeGreaterThan(stepCost(k - 1));
    expect(SEASON_TOTAL_XP).toBe(5900);
    expect(xpToReach(20)).toBe(SEASON_TOTAL_XP);
  });

  it('maps XP to steps at the boundaries', () => {
    expect(stepOf(0)).toEqual({ step: 0, into: 0, need: 200 });
    expect(stepOf(199).step).toBe(0);
    expect(stepOf(200)).toEqual({ step: 1, into: 0, need: 210 });
    expect(stepOf(xpToReach(7) - 1).step).toBe(6);
    expect(stepOf(xpToReach(7)).step).toBe(7);
    expect(stepOf(SEASON_TOTAL_XP)).toEqual({ step: 20, into: 0, need: 0 });
    expect(stepOf(SEASON_TOTAL_XP * 3).step).toBe(20);
    expect(stepOf(-50).step).toBe(0);
  });

  it('rewards playing: more for hands, wins and places, a bonus at the season destination', () => {
    const s = seasonAt(SEASON_EPOCH); // Hong Kong
    const base = { placement: 4, handsPlayed: 1, handsWon: 0, variation: 'classic' };
    const one = seasonXpForGame(base, s);
    expect(one).toBe(38);
    expect(seasonXpForGame({ ...base, handsPlayed: 4 }, s)).toBeGreaterThan(one);
    expect(seasonXpForGame({ ...base, handsWon: 1 }, s)).toBeGreaterThan(one);
    expect(seasonXpForGame({ ...base, placement: 1 }, s)).toBeGreaterThan(seasonXpForGame({ ...base, placement: 2 }, s));
    expect(seasonXpForGame({ ...base, variation: 'hongkong' }, s)).toBe(Math.round(one * 1.25));
    // A marathon still has a ceiling per game.
    expect(seasonXpForGame({ placement: 1, handsPlayed: 999, handsWon: 999, variation: 'hongkong' }, s)).toBeLessThanOrEqual(SEASON_XP_MAX_AWARD);
  });

  it('adds only whole, positive, capped amounts', () => {
    const p = emptyProgress(1);
    expect(addXp(p, 'game', 37.6)).toBe(38);
    expect(addXp(p, 'daily', -100)).toBe(0);
    expect(addXp(p, 'drill', Number.NaN)).toBe(0);
    expect(addXp(p, 'event', 1e9)).toBe(SEASON_XP_MAX_AWARD);
    expect(p.xp).toBe(38 + SEASON_XP_MAX_AWARD);
    expect(p.bySource).toEqual({ game: 38, daily: 0, drill: 0, event: SEASON_XP_MAX_AWARD });
  });
});

describe('reward track and claiming', () => {
  const theme = SEASON_THEMES[0];

  it('is cosmetics and Jong Points only, with the frame, cloth and tiles at 5, 10 and 20', () => {
    const track = rewardTrack(theme);
    expect(track).toHaveLength(20);
    expect(track.map((r) => r.step)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    for (const r of track) expect(!!r.jongPoints !== !!r.cosmetic).toBe(true);
    expect(track[4].cosmetic).toEqual({ category: 'frame', id: seasonFrameId(theme.id) });
    expect(track[9].cosmetic).toEqual({ category: 'table', id: seasonTableId(theme.id) });
    expect(track[19].cosmetic).toEqual({ category: 'tileSet', id: seasonTileSetId(theme.id) });
  });

  it('registers every season cosmetic in the catalogue as earned-only', () => {
    for (const t of SEASON_THEMES)
      for (const r of rewardTrack(t).filter((x) => x.cosmetic)) {
        const c = byId(r.cosmetic!.category, r.cosmetic!.id);
        expect(c, r.cosmetic!.id).toBeTruthy();
        expect(c!.price).toBe(0);
        expect(c!.earnedBy).toBeTruthy();
      }
    for (const t of SEASON_THEMES) {
      expect(TILE_SETS.some((s) => s.id === seasonTileSetId(t.id))).toBe(true);
      expect(TABLES.some((s) => s.id === seasonTableId(t.id))).toBe(true);
    }
    // Ids stay unique across the whole catalogue.
    const keys = CATALOG.map((c) => `${c.category}:${c.id}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('pays each reached step once, and nothing before it is reached', () => {
    const p = emptyProgress(1);
    const wallet = { jongPoints: 0, owned: [] as string[] };
    expect(claimStep(p, 1, wallet)).toBeNull();
    addXp(p, 'game', 200);
    expect(claimable(p)).toEqual([1]);
    expect(claimStep(p, 1, wallet)?.jongPoints).toBe(100);
    expect(claimStep(p, 1, wallet)).toBeNull();
    expect(wallet.jongPoints).toBe(100);
    expect(claimStep(p, 2, wallet)).toBeNull();
    expect(claimStep(p, 0, wallet)).toBeNull();
    expect(claimStep(p, 21, wallet)).toBeNull();
  });

  it('collects everything at once, including the cosmetics, without duplicates', () => {
    const p = emptyProgress(1);
    p.xp = SEASON_TOTAL_XP;
    const wallet = { jongPoints: 0, owned: [`frame:${seasonFrameId(theme.id)}`] };
    const got = claimAll(p, wallet);
    expect(got).toHaveLength(20);
    expect(claimable(p)).toEqual([]);
    expect(wallet.owned.sort()).toEqual([`frame:${seasonFrameId(theme.id)}`, `table:${seasonTableId(theme.id)}`, `tileSet:${seasonTileSetId(theme.id)}`].sort());
    const jp = rewardTrack(theme).reduce((a, r) => a + (r.jongPoints ?? 0), 0);
    expect(wallet.jongPoints).toBe(jp);
    expect(claimAll(p, wallet)).toEqual([]);
    expect(wallet.jongPoints).toBe(jp);
  });

  it('invites players to the Finals from step 6', () => {
    const p = emptyProgress(1);
    p.xp = xpToReach(FINALS_STEP) - 1;
    expect(finalsQualified(p)).toBe(false);
    p.xp += 1;
    expect(finalsQualified(p)).toBe(true);
  });
});

describe('season league', () => {
  const season = seasonAt('2026-10-20');
  const me = { name: 'Tester', rating: 1500, xp: 900 };

  it('seats you with the nearest members, the same table all season', () => {
    const a = leagueMembers(season.number, me);
    expect(a).toHaveLength(LEAGUE_SIZE - 1);
    expect(leagueMembers(season.number, me).map((m) => m.id)).toEqual(a.map((m) => m.id));
    const avg = a.reduce((s, m) => s + Math.abs(m.rating - me.rating), 0) / a.length;
    const all = ROSTER.reduce((s, m) => s + Math.abs(m.rating - me.rating), 0) / ROSTER.length;
    expect(avg).toBeLessThan(all);
  });

  it('ranks by season XP, with you after anyone tied', () => {
    const rows = simulatedLeague(season, me, new Date('2026-10-20T12:00:00Z'));
    expect(rows).toHaveLength(LEAGUE_SIZE);
    expect(rows.filter((r) => r.me)).toHaveLength(1);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].xp).toBeGreaterThanOrEqual(rows[i].xp);
    expect(rows.map((r) => r.rank)).toEqual(rows.map((_, i) => i + 1));
  });

  it("members' XP only grows through a season and starts at zero", () => {
    const m = ROSTER[3];
    expect(memberSeasonXp(m, season, season.start)).toBe(0);
    let last = -1;
    for (let d = 0; d <= SEASON_DAYS; d += 3) {
      const x = memberSeasonXp(m, season, new Date(season.start.getTime() + d * 86_400_000 + 3_600_000));
      expect(x).toBeGreaterThanOrEqual(last * 0.97);
      last = x;
    }
  });
});

describe('Season Finals tournament', () => {
  beforeEach(() => undefined);

  it('is a free format at the season destination, not listed with the regular events', () => {
    const f = FORMATS.season;
    expect(f.entry).toBe(0);
    expect(f.finalTable).toBe(true);
    expect(FORMAT_IDS).not.toContain('season');
    const d = new Date('2026-11-12T10:00:00Z');
    expect(tournamentVariation('season', d)).toBe(seasonAt(d).theme.destination);
    const t = createTournament('season', d, { name: 'You', rating: 1500 }, 42);
    expect(t.entrants).toHaveLength(16);
    expect(t.variation).toBe('hongkong');
  });
});

describe('addSeasonXp (storage)', () => {
  it('stores progress per season and reports new steps', async () => {
    const mem = new Map<string, string>();
    const ls = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    (globalThis as unknown as { localStorage: typeof ls }).localStorage = ls;
    const { addSeasonXp, seasonProgress } = await import('../src/progression/season');
    const d = new Date('2026-10-20T10:00:00Z');
    expect(addSeasonXp('game', 150, d)).toEqual({ added: 150, step: 0, newStep: false });
    expect(addSeasonXp('daily', 50, d)).toEqual({ added: 50, step: 1, newStep: true });
    expect(seasonProgress(1).xp).toBe(200);
    expect(seasonProgress(1).bySource).toEqual({ game: 150, daily: 50 });
    // The next season starts from zero.
    addSeasonXp('lesson', 80, new Date('2026-11-20T10:00:00Z'));
    expect(seasonProgress(2).xp).toBe(80);
    expect(seasonProgress(1).xp).toBe(200);
    expect([...mem.keys()]).toContain('jongclub.season.v1');
  });
});
