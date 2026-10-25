import { describe, expect, it } from 'vitest';
import {
  FORMATS,
  createTournament,
  entryStatus,
  humanPrize,
  humanTable,
  isFinished,
  nextRound,
  pendingAiTables,
  playAiTable,
  playRound,
  prizes,
  standings,
  startTime,
  type HumanTableResult,
  type TournamentState,
} from '../src/club/tournament';

const date = new Date('2026-10-09T12:00:00Z'); // a Friday
const human = { name: 'Guest', rating: 1500 };

/** The human always wins their table by a little. */
function fakeHumanResult(s: TournamentState): HumanTableResult {
  const start = s.variation === 'riichi' ? 25000 : s.variation === 'taiwanese' ? 10000 : s.variation === 'american' ? 2000 : 5000;
  return [0, 1, 2, 3].map((seat) => ({ seat, score: seat === 0 ? start + 300 : start - 100 }));
}

describe('tournaments', () => {
  it('formats and schedule', () => {
    expect(FORMATS.quick.entry).toBe(0);
    expect(FORMATS.global.maxPlayers).toBe(64);
    expect(startTime('daily', date).toISOString()).toBe('2026-10-09T20:00:00.000Z');
    expect(startTime('weekend', date).toISOString()).toBe('2026-10-10T18:00:00.000Z');
    expect(startTime('global', date).toISOString()).toBe('2026-11-01T16:00:00.000Z');
    expect(startTime('global', new Date('2026-11-01T05:00:00Z')).toISOString()).toBe('2026-11-01T16:00:00.000Z');
    expect(entryStatus('global', 1650).locked).toBe(true);
    expect(entryStatus('global', 1750).locked).toBe(false);
    expect(() => createTournament('global', date, human, 1)).toThrow();
  });

  it('quick tournament runs end to end with a human table', () => {
    let s = createTournament('quick', date, human, 42);
    expect(s.entrants).toHaveLength(8);
    expect(new Set(s.entrants.map((e) => e.id)).size).toBe(8);
    let rounds = 0;
    while (!isFinished(s)) {
      s = nextRound(s);
      expect(s.current).toHaveLength(2);
      const mine = humanTable(s)!;
      expect(mine.opponents).toHaveLength(3);
      expect(() => playRound(s)).toThrow();
      s = playRound(s, fakeHumanResult(s));
      // Survives a localStorage round trip.
      s = JSON.parse(JSON.stringify(s));
      rounds++;
    }
    expect(rounds).toBe(3);
    const table = standings(s);
    expect(table).toHaveLength(8);
    // The human won every table: 12 points, top of the standings.
    expect(table[0].human).toBe(true);
    expect(table[0].points).toBe(12);
    // Every round hands out 4+2+1+0 at each of two tables.
    expect(table.reduce((a, r) => a + r.points, 0)).toBe(3 * 2 * 7);
    const p = prizes(s);
    expect(p[0].place).toBe(1);
    expect(p[0].trophy).toBe('trophy-quick-cup');
    expect(humanPrize(s)?.jongPoints).toBe(250);
  }, 30_000);

  it('Swiss re-seating puts the leaders together', () => {
    let s = createTournament('quick', date, human, 7);
    s = playRound(nextRound(s), fakeHumanResult(s));
    s = nextRound(s);
    const top4 = standings(s)
      .slice(0, 4)
      .map((r) => r.index)
      .sort();
    expect([...s.current![0].seats].sort()).toEqual(top4);
  }, 30_000);

  it('weekend championship ends with a final table', () => {
    let s = createTournament('weekend', date, human, 3, { length: 'oneHand', variation: 'classic' });
    expect(s.entrants).toHaveLength(32);
    s = nextRound(s);
    expect(s.current).toHaveLength(8);
    // AI tables can be simulated one at a time.
    const first = pendingAiTables(s)[0];
    s = playAiTable(s, first);
    expect(pendingAiTables(s)).not.toContain(first);
    s = playRound(s, fakeHumanResult(s));
    while (!isFinished(s)) {
      s = nextRound(s);
      s = playRound(s, humanTable(s) ? fakeHumanResult(s) : undefined);
    }
    expect(s.history).toHaveLength(5);
    expect(s.history[4].final).toBe(true);
    const table = standings(s);
    expect(table.slice(0, 4).map((r) => r.finalPlace)).toEqual([1, 2, 3, 4]);
    expect(prizes(s).filter((p) => p.place <= 8)).toHaveLength(8);
    expect(prizes(s)[0].cosmetic).toBe('frame-champion');
  }, 60_000);
});
