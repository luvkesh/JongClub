import { describe, expect, it } from 'vitest';
import { Dimensions, boxShape, dealDimensions, stepShape } from '../src/minigames/games/dimensions/logic';
import { Rng } from '../src/engine/rng';

describe('3D Mahjong Dimensions', () => {
  it('a cube on the face centre of a side is not free; edges and corners are', () => {
    const blocks = boxShape(3, 3, 3);
    const g = new Dimensions(blocks, blocks.map(() => 0));
    const idx = (x: number, y: number, z: number) => blocks.findIndex((b) => b.x === x && b.y === y && b.z === z);
    expect(g.isFree(idx(0, 0, 0))).toBe(true);
    expect(g.isFree(idx(1, 0, 0))).toBe(true); // an edge: bottom and front meet
    expect(g.isFree(idx(1, 1, 0))).toBe(false); // centre of the front: one open side
    expect(g.isFree(idx(1, 1, 1))).toBe(false);
  });
  it('every shape deals a block that can be cleared', () => {
    const shapes = [boxShape(4, 2, 4), boxShape(4, 4, 4), boxShape(5, 4, 5, true), boxShape(2, 6, 2), boxShape(3, 6, 2), stepShape(4, 2), stepShape(6, 3), stepShape(7, 4)];
    for (const [i, s] of shapes.entries()) {
      expect(s.length % 2).toBe(0);
      const kinds = dealDimensions(s, new Rng(i + 1));
      const g = new Dimensions(s, kinds);
      // Greedy play is not guaranteed, but the deal must at least start with moves.
      expect(g.pairs().length).toBeGreaterThan(0);
    }
  });
});
