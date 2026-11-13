import { describe, expect, it } from 'vitest';
import { runAll } from '../src/ai/matchWalk';
import { passportReviewScan } from '../src/ai/passportReview';
import { recordMatch } from './helpers/recordMatch';

describe('India Rules East round: the after-hand passport review', () => {
  it('names the passport you came closest to and only points at real discards', () => {
    let reviewed = 0;
    let slips = 0;
    for (const seed of [3, 6, 7, 11]) {
      const rec = recordMatch('india', seed, 'oneHand', 'beginner', { indiaRounds: 'E' });
      const t0 = performance.now();
      const r = runAll(passportReviewScan(rec, 0));
      const ms = performance.now() - t0;
      expect(ms, `seed ${seed} took ${ms.toFixed(0)} ms`).toBeLessThan(4000);
      if (!r) continue;
      reviewed++;
      const myDiscards = rec.hands[0].filter((a) => a.t === 'd' && a.s === 0).length;
      expect(r.turns.length).toBe(myDiscards);
      expect(r.turns.map((t) => t.turn)).toEqual(r.turns.map((_, i) => i + 1));
      for (const t of r.turns) expect(t.best).toBeLessThanOrEqual(t.after);
      expect(r.closest).not.toBeNull();
      expect(r.closest!.names.length).toBeGreaterThan(0);
      expect(r.closest!.fromReady).toBe(Math.min(...r.turns.map((t) => t.after)));
      if (r.leftBehind) {
        slips++;
        expect(r.leftBehind.turn).toBeGreaterThan(r.closest!.turn);
        expect(r.leftBehind.after).toBeGreaterThan(r.leftBehind.before);
        expect(r.leftBehind.betterAfter).toBeLessThan(r.leftBehind.after);
        expect(r.leftBehind.better).not.toBe(r.leftBehind.tile);
      }
      if (r.slip) {
        slips++;
        expect(r.slip.betterAfter).toBeLessThan(r.slip.after);
        expect(r.slip.turn).not.toBe(r.leftBehind?.turn);
      }
    }
    expect(reviewed).toBeGreaterThan(0);
    // A beginner bot leaves something to point at in four hands.
    expect(slips).toBeGreaterThan(0);
  });

  it('gives nothing for a spectator', () => {
    const rec = recordMatch('india', 3, 'oneHand', 'beginner', { indiaRounds: 'E' });
    expect(runAll(passportReviewScan(rec, -1))).toBeNull();
  });
});
