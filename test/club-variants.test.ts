// Daily challenges and tournaments work for every variation.

import { describe, expect, it } from 'vitest';
import { dailyChallenges, scoreTodaysHand, startingScoreOf } from '../src/club/daily';
import { simulateMatch } from '../src/club/sim';
import { createTournament, humanTable, isFinished, nextRound, playRound, prizes, standings, type HumanTableResult, type TournamentState } from '../src/club/tournament';
import type { VariationId } from '../src/club/roster';
import { VARIATIONS, getProfile, seatsOf } from '../src/engine/rules';

const human = { name: 'You', rating: 1500 };
const date = new Date('2026-10-09T12:00:00Z');

function humanResult(s: TournamentState): HumanTableResult {
  const start = startingScoreOf(s.variation);
  return [0, 1, 2, 3].map((seat) => ({ seat, score: start + (3 - seat) * 10 }));
}

describe('club play in every variation', () => {
  // Tournaments seat four per table; three-seat games (Korean) stay out of them.
  for (const v of VARIATIONS.filter((x) => seatsOf(x) === 4)) {
    it(`${v.id}: a quick tournament runs to the end with valid standings`, () => {
      let s = createTournament('quick', date, human, 11, { variation: v.id as VariationId, length: 'oneHand' });
      while (!isFinished(s)) {
        s = nextRound(s);
        s = playRound(s, humanTable(s) ? humanResult(s) : undefined);
      }
      const rows = standings(s);
      expect(rows).toHaveLength(8);
      expect(rows.reduce((a, r) => a + r.points, 0)).toBe(3 * 2 * 7);
      for (const r of s.history) for (const t of r.tables) expect([...t.placements].sort()).toEqual([1, 2, 3, 4]);
      for (const e of s.entrants) expect(Number.isFinite(e.totalScore)).toBe(true);
      expect(prizes(s)).toHaveLength(3);
    }, 120_000);
  }

  for (const v of VARIATIONS) {
    it(`${v.id}: simulated matches finish uncapped and zero-sum`, () => {
      const r = simulateMatch({ variation: v.id, length: 'eastRound', difficulties: ['casual', 'strategic', 'expert', 'beginner'], personalities: ['zen', 'shark', 'wall', 'gambler'], names: ['A', 'B', 'C', 'D'], seed: 99 });
      expect(r.capped).toBe(false);
      const start = getProfile(v.id)!.startingScore;
      expect(r.standings.reduce((a, x) => a + x.score, 0) + r.leftoverPot).toBe(seatsOf(v) * start);
    }, 120_000);
  }

  it('two months of daily challenges name playable variations with sane specs', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const d = new Date(Date.UTC(2026, 9, 1 + i));
      const c = dailyChallenges(d);
      for (const spec of [c.todaysHand, c.speedJong]) {
        expect(getProfile(spec.variation)).toBeTruthy();
        expect(spec.opponents).toHaveLength(3);
        expect(new Set(spec.opponents.map((o) => o.memberId)).size).toBe(3);
        seen.add(spec.variation);
      }
      expect(getProfile(c.variation.variation)).toBeTruthy();
      seen.add(c.variation.variation);
      expect(c.perfectDiscard.hand).toHaveLength(14);
      expect(Number.isFinite(scoreTodaysHand(c.todaysHand.variation, 100, true))).toBe(true);
    }
    // The UAE rulesets (Dubai Taiwanese, American, custom) share the UAE profile's days.
    expect([...seen].sort()).toEqual(VARIATIONS.filter((v) => !v.parent && seatsOf(v) === 4).map((v) => v.id).sort());
  }, 120_000);
});
