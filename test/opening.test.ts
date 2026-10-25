import { describe, expect, it } from 'vitest';
import { eastRoll, openingRules, wallBreak } from '../src/engine/opening';
import { MahjongGame } from '../src/engine/game';
import { VARIATIONS } from '../src/engine/rules/index';

const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);

describe('opening: throw for East and the wall break', () => {
  it('ties on the highest throw throw again, and only they do', () => {
    for (let seed = 1; seed < 400; seed++) {
      const { rounds, east } = eastRoll(seed, 4, 2);
      for (let r = 0; r < rounds.length; r++) {
        const best = Math.max(...rounds[r].map((t) => sum(t.values)));
        const top = rounds[r].filter((t) => sum(t.values) === best).map((t) => t.seat);
        if (r < rounds.length - 1) {
          expect(top.length).toBeGreaterThan(1);
          expect(rounds[r + 1].map((t) => t.seat)).toEqual(top);
        } else expect(top).toEqual([east]);
      }
      expect(eastRoll(seed, 4, 2)).toEqual(eastRoll(seed, 4, 2));
    }
  });

  it('every seat can become East', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed < 200; seed++) seen.add(eastRoll(seed, 4, 3).east);
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it('India Rules: the book example (East throws 8, North counts 16 tiles off for the flower wall)', () => {
    const rules = openingRules('india');
    expect(rules).toEqual({ dice: 2, method: 'count', segment: 'flower' });
    const wb = wallBreak(rules, [5, 3, 1, 1, 1, 1], 0, 4, 18, 0);
    expect(wb.wallSeat).toBe(3); // E 1, S 2, W 3, N 4, E 5, S 6, W 7, N 8
    expect(wb.count).toBe(8);
    expect(wb.segTiles).toBe(16);
    // North's wall is the first clockwise from East's: ring stacks 18..35, broken 8 in.
    expect(wb.start).toBe(18 + 8);
  });

  it('American: East breaks their own wall; Riichi marks the dead wall; Chinese classical throws twice', () => {
    const am = wallBreak(openingRules('american'), [6, 6, 1, 1, 1, 1], 2, 4, 19, 0);
    expect(am.wallSeat).toBe(2);
    expect(am.start).toBe(12);
    const ri = wallBreak(openingRules('riichi', 14), [2, 3, 1], 0, 4, 17, 14);
    expect(ri.wallSeat).toBe(0);
    expect(ri.segTiles).toBe(14);
    const cl = wallBreak(openingRules('classic'), [1, 1, 9, 4, 2, 9], 1, 4, 17, 0);
    expect(cl.throws).toHaveLength(2);
    expect(cl.wallSeat).toBe(2);
    expect(cl.throws[1].seat).toBe(2);
    expect(cl.count).toBe(2 + 6);
    expect(openingRules('hongkong').dice).toBe(3);
    expect(openingRules('taiwanese', 16).segment).toBe('last16');
  });

  it('every variation deals with a wall break in range', () => {
    for (const v of VARIATIONS) {
      if (!v.profile) continue;
      const g = new MahjongGame(v.profile, ['A', 'B', 'C', 'D'], 7);
      g.startHand(11);
      const wb = g.state.wallBreak!;
      const perSide = Math.ceil(g.state.wall.length / 8);
      expect(wb, v.id).toBeTruthy();
      expect(wb.start).toBeGreaterThanOrEqual(0);
      expect(wb.start).toBeLessThan(perSide * 4);
      expect(wb.segTiles).toBeLessThan(g.state.wall.length / 2);
      expect(g.state.dice).toHaveLength(3);
    }
  });
});
