// Private member clubs: the weekly league, the AI members of a local club and
// their simulated games, and a local club's round trip through storage.

import { beforeAll, describe, expect, it } from 'vitest';
import { aiMembersFor, clubOnFinish, clubsBackend, crestOf, leagueTable, leagueWeek, simulatedResults } from '../src/club/privateClubs';

beforeAll(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
  };
});

describe('private clubs', () => {
  it('weeks run Monday to Sunday (UTC)', () => {
    expect(leagueWeek(new Date('2026-10-18T23:00:00Z'))).toBe('2026-10-12');
    expect(leagueWeek(new Date('2026-10-19T00:30:00Z'))).toBe('2026-10-19');
  });

  it('scores 4/2/1/0 and ranks by points, wins, then fewer games', () => {
    const w = '2026-10-12';
    const rows = leagueTable(
      [
        { id: 'a', name: 'A', week: w, place: 1 },
        { id: 'b', name: 'B', week: w, place: 2 },
        { id: 'b', name: 'B', week: w, place: 2 },
        { id: 'c', name: 'C', week: w, place: 4 },
        { id: 'a', name: 'A', week: '2026-10-05', place: 1 },
      ],
      w,
    );
    expect(rows.map((r) => [r.id, r.points, r.games])).toEqual([
      ['a', 4, 1],
      ['b', 4, 2],
      ['c', 0, 1],
    ]);
  });

  it('picks AI members who favour the club’s variation, the same every time', () => {
    const a = aiMembersFor('local-x', 'riichi');
    expect(a).toHaveLength(6);
    expect(aiMembersFor('local-x', 'riichi').map((m) => m.id)).toEqual(a.map((m) => m.id));
    expect(a.filter((m) => m.favoriteVariation === 'riichi').length).toBeGreaterThanOrEqual(4);
  });

  it('simulates members’ games deterministically, growing through the week', () => {
    const members = aiMembersFor('local-y', 'classic');
    const mon = simulatedResults('local-y', members, '2026-10-12', new Date('2026-10-12T10:00:00Z'));
    const sun = simulatedResults('local-y', members, '2026-10-12', new Date('2026-10-18T10:00:00Z'));
    expect(sun.length).toBeGreaterThan(mon.length);
    expect(simulatedResults('local-y', members, '2026-10-12', new Date('2026-10-18T10:00:00Z'))).toEqual(sun);
    expect(sun.every((r) => r.place >= 1 && r.place <= 4)).toBe(true);
  });

  it('a local club keeps its rules, AI members and your league games', async () => {
    const back = clubsBackend();
    const c = await back.create({ name: 'Thursday Tiles', crest: 'jade-palace|red', variation: 'riichi', length: 'eastSouth', houseRules: { redFives: '4' } });
    expect(c.local).toBe(true);
    expect(c.members.filter((m) => m.ai)).toHaveLength(6);
    expect(crestOf(c.crest).emblem.label).toBe('Red Dragon');
    clubOnFinish(`club:${c.id}`, 1);
    clubOnFinish('daily:speedJong', 1);
    await new Promise((r) => setTimeout(r, 0));
    const [again] = await back.list();
    expect(again.houseRules).toEqual({ redFives: '4' });
    const me = again.league.find((r) => r.me)!;
    expect(me).toMatchObject({ games: 1, wins: 1, points: 4 });
    await expect(back.join('abcdef')).rejects.toThrow(/server/);
    await back.leave(c.id);
    expect(await back.list()).toEqual([]);
  });
});
