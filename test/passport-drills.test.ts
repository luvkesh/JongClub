import { describe, expect, it } from 'vitest';
import { PASSPORT_DRILL_TYPES, isRight, makeDrill } from '../src/learn/drillGen';
import { passportPlans } from '../src/engine/rules/indiaPassport';
import { planSet } from '../src/learn/drillSchedule';
import { KIND_COUNT } from '../src/engine/tiles';

const counts = (hand: number[]) => {
  const c = new Array(KIND_COUNT).fill(0);
  for (const k of hand) c[k]++;
  return c;
};

describe('passport drills (India Rules, East round)', () => {
  it('spot the passport: a complete hand, four options, one right, and the engine agrees', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const d = makeDrill('passport', seed, 'india');
      expect(d.type).toBe('passport');
      expect(d.hand!.length).toBe(14);
      expect(counts(d.hand!).every((n) => n <= 4)).toBe(true);
      expect(d.options.length).toBe(4);
      expect(d.options.filter((o) => o.correct).length).toBe(1);
      expect(new Set(d.options.map((o) => o.label)).size).toBe(4);
      const plans = passportPlans(counts(d.hand!), [], 60, 99).filter((p) => p.missing === 0);
      expect(plans.length).toBeGreaterThan(0);
      expect(d.explanation).toMatch(/passport is/);
      expect(isRight(d, d.options.findIndex((o) => o.correct))).toBe(true);
    }
  });

  it('keep passports open: a tile answer the planner backs, with a reason', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const d = makeDrill('passportDiscard', seed, 'india');
      expect(d.type).toBe('passportDiscard');
      expect(d.pick).toBe('tile');
      expect(d.hand!.length).toBe(14);
      expect(d.correctTiles!.length).toBeGreaterThan(0);
      expect(d.correctTiles!.length).toBeLessThanOrEqual(2);
      // The right tiles are the nearest to a passport over every tile held.
      const c = counts(d.hand!);
      const after = (k: number) => {
        const x = c.slice();
        x[k]--;
        return passportPlans(x, [], 1, 0)[0]?.missing ?? 99;
      };
      const best = Math.min(...d.hand!.map(after));
      for (const k of d.correctTiles!) expect(after(k)).toBe(best);
      expect(isRight(d, d.correctTiles![0])).toBe(true);
      expect(d.explanation).toMatch(/all open/);
    }
  });

  it('is stable for the schedule: the same seed gives the same drill', () => {
    const a = makeDrill('passport', 5, 'india');
    const b = makeDrill('passport', 5, 'india');
    expect(a.hand).toEqual(b.hand);
    expect(a.options.map((o) => o.label)).toEqual(b.options.map((o) => o.label));
  });

  it('plans a passport set from both kinds, with India as the variation', () => {
    const plan = planSet({ items: [], skills: {}, days: {} } as never, '2026-11-12', { size: 6, focus: PASSPORT_DRILL_TYPES });
    expect(plan.length).toBe(6);
    expect(plan.every((p) => PASSPORT_DRILL_TYPES.includes(p.type) && p.variation === 'india')).toBe(true);
    expect(new Set(plan.map((p) => p.type)).size).toBe(2);
  });
});
