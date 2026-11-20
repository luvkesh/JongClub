import { describe, expect, it } from 'vitest';
import { VARIATIONS } from '../src/engine/rules';
import { sampleHand, specialTiles } from '../src/ui/variationCard';

describe('variation card pictures', () => {
  for (const v of VARIATIONS.filter((x) => x.profile && !x.parent)) {
    const p = v.profile!;
    it(`${v.id}: the winning hand uses real tiles from the set`, () => {
      const hand = sampleHand(v.id, p);
      const kinds = hand.flatMap((g) => g.tiles.map((t) => t.k));
      expect(kinds.every((k) => Number.isInteger(k))).toBe(true);
      expect(kinds.length).toBeGreaterThanOrEqual(p.handSize + 1);
      const counts = new Map<number, number>();
      for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
      for (const [k, n] of counts) if (k < 34) expect(n, `kind ${k}`).toBeLessThanOrEqual(4);
      if (!p.card) for (const k of kinds) expect(p.tileKinds.includes(k), `kind ${k}`).toBe(true);
      for (const s of specialTiles(p)) for (const t of s.tiles) if (t !== 'arrow') expect(Number.isInteger(t.k)).toBe(true);
    });
  }
});
