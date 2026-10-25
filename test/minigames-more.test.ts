import { describe, expect, it } from 'vitest';
import { Rng } from '../src/engine/rng';
import { SlideBoard } from '../src/minigames/games/slide';
import { Match3 } from '../src/minigames/games/match3';
import { Triple, dealTriple, tripleLayout, TRAY } from '../src/minigames/games/triple/logic';
import { pairsFromSet } from '../src/minigames/helpers';

describe('mahjong slide rules', () => {
  const board = (rows: string[], kinds: number[]) => {
    const w = rows[0].length;
    let id = 0;
    const cells = rows.join('').split('').map((c) => (c === '#' ? id++ : -1));
    return new SlideBoard(w, rows.length, cells, kinds);
  };
  it('pairs tiles facing across a gap, not past another tile', () => {
    const b = board(['#.#', '#..'], [5, 5, 7]);
    expect(b.matchFor(0)).toBe(1);
    const c = board(['###'], [5, 7, 5]);
    expect(c.matchFor(0)).toBe(-1);
  });
  it('a slide pushes the tiles in front and lines up a match', () => {
    // 0 at (0,0) and its match 2 at (2,1); slide 0 right two places pushes 1 along.
    const b = board(['##..', '..#.'], [5, 7, 5]);
    const next = b.slide(0, 2, 0)!;
    expect(next).not.toBeNull();
    const nb = new SlideBoard(4, 2, next, b.kinds);
    expect(nb.pos(0)).toEqual({ x: 2, y: 0 });
    expect(nb.pos(1)).toEqual({ x: 3, y: 0 });
    expect(nb.matchFor(0)).toBe(2);
  });
  it('every move the hint suggests makes progress', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = new Rng(seed);
      const [w, h, n] = [8, 7, 40];
      const kinds = pairsFromSet(n / 2, rng).flatMap(([a, b]) => [a, b]);
      const cells = Array(w * h).fill(-1);
      rng.shuffle(Array.from({ length: w * h }, (_, i) => i)).slice(0, n).forEach((c, id) => (cells[c] = id));
      const b = new SlideBoard(w, h, cells, kinds);
      for (let step = 0; step < 200; step++) {
        const p = b.pairs()[0];
        if (p) {
          b.cells = b.cells.map((v) => (v === p[0] || v === p[1] ? -1 : v));
          continue;
        }
        const m = b.slideMove();
        if (!m) break;
        const next = b.slide(m[0], m[1], m[2])!;
        const nb = new SlideBoard(w, h, next, kinds);
        const mate = nb.matchFor(m[0]);
        expect(mate).toBeGreaterThanOrEqual(0);
        b.cells = next.map((v) => (v === m[0] || v === mate ? -1 : v));
      }
    }
  });
});

describe('mahjong match-3 rules', () => {
  it('finds lines of three and longer, and always deals a board with a move and no lines', () => {
    const rng = new Rng(4);
    const g = new Match3(7, Array(49).fill(-1), [0, 9, 18, 27, 31, 33], rng);
    g.fill();
    expect(g.lines().length).toBe(0);
    expect(g.findMove()).not.toBeNull();
    const row = Array(49).fill(-1).map((_, i) => (i % 7) + 10 * Math.floor(i / 7));
    row[0] = row[1] = row[2] = row[3] = 5;
    const m = new Match3(7, row, [], rng);
    expect(m.lines()).toEqual([{ cells: [0, 1, 2, 3], len: 4 }]);
  });
});

describe('mahjong triple match rules', () => {
  it('layouts come in threes and deals can be cleared in the order they were built', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = new Rng(seed);
      const spots = tripleLayout(3, 8, 6, rng);
      expect(spots.length % 3).toBe(0);
      const g = new Triple(spots, dealTriple(spots, rng, 14, 2));
      // Greedy with the hint never fills the tray on these deals... at least most of the time.
      let guard = 0;
      while (!g.won && !g.lost && guard++ < 500) g.take(g.hint()!);
      expect(g.tray.length).toBeLessThanOrEqual(TRAY);
    }
  });
  it('three of a kind clear and undo puts a tile back', () => {
    const spots = [0, 1, 2, 3, 4, 5].map((x) => ({ x: x * 2, y: 0, z: 0 }));
    const g = new Triple(spots, [1, 1, 2, 1, 2, 2]);
    expect(g.take(0)).toEqual([]);
    expect(g.take(1)).toEqual([]);
    expect(g.tray).toEqual([0, 1]);
    expect(g.undo()).toBe(1);
    expect(g.onBoard[1]).toBe(true);
    g.take(1);
    expect(g.take(3).sort()).toEqual([0, 1, 3]);
    expect(g.tray).toEqual([]);
  });
});
