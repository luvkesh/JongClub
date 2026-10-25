import { describe, expect, it } from 'vitest';
import { fastShanten } from '../src/ai/fastShanten';
import { shanten } from '../src/engine/hand';
import { Rng } from '../src/engine/rng';
import { riichiProfile } from '../src/engine/rules/riichi';
import { taiwaneseProfile } from '../src/engine/rules/taiwanese';

describe('fast shanten', () => {
  it('matches the engine on random hands of every size', () => {
    const rng = new Rng(11);
    for (let i = 0; i < 3000; i++) {
      const profile = i % 3 === 0 ? taiwaneseProfile : riichiProfile;
      const size = profile === taiwaneseProfile ? 17 : 14;
      const melds = rng.int(3);
      const n = size - 3 * melds - rng.int(2);
      const counts = new Array(34).fill(0);
      // Concentrate some hands in one suit so rich shapes appear.
      const span = i % 2 ? 9 : 34;
      const base = span === 9 ? rng.int(3) * 9 : 0;
      for (let t = 0; t < n; ) {
        const k = base + rng.int(span);
        if (counts[k] < 4) counts[k]++, t++;
      }
      expect(fastShanten(counts, melds, profile.shapes)).toBe(shanten(counts, melds, profile.shapes));
    }
  });
});
