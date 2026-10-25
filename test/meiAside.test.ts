import { describe, expect, it } from 'vitest';
import { LESSONS } from '../src/ui/academy';
import { namedSets } from '../src/ui/meiAside';
import { parseKinds } from '../src/engine/tiles';

describe('tiles beside Mei’s words', () => {
  it('names the sets in the order Mei says them, mixed chow apart from chow', () => {
    const sets = namedSets('The threes can be a chow, a mixed chow, a pung or a crochet. The two is a pair, or a knit.');
    expect(sets.map((s) => s.label)).toEqual(['Chow', 'Mixed chow', 'Pung', 'Crochet', 'Pair', 'Knit']);
  });
  it('never repeats a tile, and avoids tiles the scene already shows', () => {
    const avoid = new Set(parseKinds('678s 777p'));
    for (const l of Object.values(LESSONS))
      for (const s of l.scenes) {
        // A pung is three of one tile; across the sets no tile comes back.
        const kinds = namedSets(s.say, avoid).flatMap((x) => [...new Set(x.kinds)]);
        expect(new Set(kinds).size).toBe(kinds.length);
        expect(kinds.some((k) => avoid.has(k))).toBe(false);
      }
  });
});
