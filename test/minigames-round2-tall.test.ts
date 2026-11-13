// Upright phones get a taller Hex honeycomb (larger tiles): same tile count per level,
// a true honeycomb (every row half a tile off its neighbours), and every deal clears.
import { describe, expect, it } from 'vitest';
import { HexBoard, TALL_ROWS, dealHex, hexCells, rowCells } from '../src/minigames/games/hex';
import { Rng } from '../src/engine/rng';

describe('Hex tall honeycomb', () => {
  const R = { easy: 3, medium: 4, hard: 5 } as const;
  for (const level of ['easy', 'medium', 'hard'] as const) {
    it(`${level}: same count as the round board, whole axial cells, centred rows`, () => {
      const cells = rowCells(TALL_ROWS[level]);
      expect(cells.length).toBe(hexCells(R[level]).length);
      for (const c of cells) expect(Number.isInteger(c.q)).toBe(true);
      // Each tile has neighbours in the row below at x ± 0.5 (honeycomb), never straight below.
      const xs = new Set(cells.map((c) => `${c.q + c.r / 2},${c.r}`));
      for (const c of cells) expect(xs.has(`${c.q + c.r / 2},${c.r + 1}`)).toBe(false);
      expect(new Set(cells.map((c) => `${c.q},${c.r}`)).size).toBe(cells.length);
    });
    it(`${level}: deals clear by greedy free-pair play`, () => {
      for (let seed = 1; seed <= 40; seed++) {
        const g: HexBoard = dealHex(rowCells(TALL_ROWS[level]), new Rng(seed));
        const occ = g.kinds.map(() => true);
        const ord = g.order(occ, new Rng(seed + 99));
        expect(ord).not.toBeNull();
      }
    });
  }
});
