import { beforeEach, describe, expect, it } from 'vitest';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { runAll } = await import('../src/ai/matchWalk');
const { loadSkills, measureGame, saveSkill, skillValue, summarise, weakest, weakness } = await import('../src/progression/skills');
const { recordMatch } = await import('./helpers/recordMatch');

describe('skill ratings', () => {
  beforeEach(() => store.clear());

  it('measures a recorded game consistently', () => {
    for (const [variation, seed] of [['classic', 21], ['riichi', 22], ['american', 23]] as const) {
      const rec = recordMatch(variation, seed, 'eastRound');
      const g = runAll(measureGame(rec))!;
      expect(g).toBeTruthy();
      expect(g.variation).toBe(variation);
      expect(g.hands).toBe(rec.hands.length);
      expect(g.good).toBeLessThanOrEqual(g.decisions);
      expect(g.readyHands).toBeLessThanOrEqual(g.hands);
      expect(g.exposedDealIns).toBeLessThanOrEqual(g.exposedHands);
      expect(g.callHands).toBeLessThanOrEqual(g.hands);
      if (g.readyHands) expect(g.readyTurns / g.readyHands).toBeGreaterThanOrEqual(1);
      if (variation !== 'american') expect(g.decisions).toBeGreaterThan(0);
    }
  });

  it('stores games per account slot and summarises with a trend', () => {
    const base = { date: '2026-10-01', hands: 4, decisions: 20, good: 15, readyHands: 2, readyTurns: 16, exposedHands: 2, exposedDealIns: 1, callHands: 1 };
    saveSkill({ ...base, variation: 'classic' });
    saveSkill({ ...base, variation: 'classic', good: 10 });
    saveSkill({ ...base, variation: 'riichi' });
    expect(loadSkills()).toHaveLength(3);
    const [c] = summarise();
    expect(c.variation).toBe('classic');
    expect(c.games).toBe(2);
    expect(c.value.efficiency).toBeCloseTo(25 / 40);
    expect(c.value.defence).toBeCloseTo(0.5);
    expect(c.value.speed).toBeCloseTo(8);
    expect(c.trend.efficiency).toEqual([0.75, 0.5]);
    expect(weakest(c)).toBe('defence');
    expect(skillValue({ ...base, decisions: 0 }, 'efficiency')).toBeNull();
    expect(weakness('calls', 0.3)).toBe(0);
  });
});
