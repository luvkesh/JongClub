import { describe, expect, it } from 'vitest';
import { Connect, dealConnect, findPath } from '../src/minigames/games/connect/logic';
import { Rng } from '../src/engine/rng';

describe('mahjong connect paths', () => {
  // 4x3 board: . = empty, # = tile
  const grid = (rows: string[]) => {
    const w = rows[0].length;
    return { w, h: rows.length, empty: (x: number, y: number) => rows[y][x] === '.' };
  };
  it('joins neighbours and straight lines', () => {
    const g = grid(['##..', '....', '....']);
    expect(findPath(g.w, g.h, g.empty, 0, 1)).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
  });
  it('allows two turns, also round the outside', () => {
    const g = grid(['#.#.', '####', '....']);
    // 0 and 2 on the top row join over the top edge (outside ring).
    const p = findPath(g.w, g.h, g.empty, 0, 2)!;
    expect(p).not.toBeNull();
    expect(p.length - 2).toBeLessThanOrEqual(2);
  });
  it('refuses three turns', () => {
    // a at (0,1) boxed in except a winding corridor needing three turns.
    const g = grid(['#####', '#.#.#', '#.#.#', '##.##'].map((r) => r));
    const w = 5;
    const a = 1 * w + 1 - 1; // (0,1) is a tile '#'
    expect(findPath(w, 4, g.empty, a, a + 4)).toBeNull();
  });
  it('deals boards that have moves and can be played down', () => {
    for (let seed = 1; seed < 6; seed++) {
      const cells = dealConnect(10, 6, new Rng(seed));
      const g = new Connect(10, 6, cells);
      let guard = 0;
      while (g.left && guard++ < 200) {
        const p = g.pairs(1);
        if (!p.length) {
          if (!g.shuffle(new Rng(seed + guard))) break;
          continue;
        }
        g.remove(p[0][0], p[0][1]);
      }
      expect(g.left).toBe(0);
    }
  });
  it('gravity drops tiles into gaps', () => {
    const g = new Connect(1, 3, [5, 5, 7], 'down');
    // remove a fake pair at top two? remove(0,1) then 7 stays at bottom
    const moves = g.remove(0, 1);
    expect(moves).toEqual([]);
    const g2 = new Connect(1, 3, [7, 5, 5], 'down');
    expect(g2.remove(1, 2)).toEqual([[0, 2]]);
    expect(g2.cells).toEqual([-1, -1, 7]);
  });
});
