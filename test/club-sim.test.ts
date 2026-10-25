import { describe, expect, it } from 'vitest';
import { simulateMatch } from '../src/club/sim';
import { getProfile } from '../src/engine/rules';

const base = {
  difficulties: ['casual', 'expert', 'beginner', 'strategic'] as const,
  personalities: ['shark', 'zen', 'wall', 'gambler'] as const,
  names: ['North Star', 'Jade', 'Pearl', 'Onyx'],
};
const cfg = (variation: string, length: 'oneHand' | 'eastRound', seed: number) => ({
  variation,
  length,
  seed,
  difficulties: [...base.difficulties],
  personalities: [...base.personalities],
  names: base.names,
});

describe('headless match simulation', () => {
  for (const v of ['classic', 'riichi', 'taiwanese', 'american', 'uae']) {
    it(`terminates and conserves points: ${v}`, () => {
      const r = simulateMatch(cfg(v, 'oneHand', 1234));
      expect(r.capped).toBe(false);
      expect(r.hands).toBe(1);
      expect(r.standings).toHaveLength(4);
      const start = getProfile(v)!.startingScore;
      const total = r.standings.reduce((a, s) => a + s.score, 0) + r.leftoverPot;
      expect(total).toBe(start * 4);
      // Best first.
      for (let i = 1; i < 4; i++) expect(r.standings[i - 1].score).toBeGreaterThanOrEqual(r.standings[i].score);
    }, 20_000);
  }

  it('plays a full East round to the end', () => {
    for (const v of ['classic', 'riichi']) {
      const r = simulateMatch(cfg(v, 'eastRound', 77));
      expect(r.capped).toBe(false);
      expect(r.hands).toBeGreaterThanOrEqual(r.standings.some((s) => s.score < 0) ? 1 : 4);
      expect(r.handResults).toHaveLength(r.hands);
      expect(r.standings.reduce((a, s) => a + s.score, 0) + r.leftoverPot).toBe(getProfile(v)!.startingScore * 4);
    }
  }, 30_000);

  it('is deterministic for a seed', () => {
    const a = simulateMatch(cfg('classic', 'eastRound', 99));
    const b = simulateMatch(cfg('classic', 'eastRound', 99));
    expect(a.standings).toEqual(b.standings);
    expect(a.hands).toBe(b.hands);
  });

  it('a single Classic hand is quick', () => {
    simulateMatch(cfg('classic', 'oneHand', 5)); // warm up
    const t = performance.now();
    for (let s = 0; s < 5; s++) simulateMatch(cfg('classic', 'oneHand', 10 + s));
    expect((performance.now() - t) / 5).toBeLessThan(150);
  });
});
