// 3D Mahjong Dimensions rules: a block of tile cubes, each showing its symbol
// on every side. A cube is free when two of its sides that share an edge are
// both open (left and front, top and right...); opposite sides alone are not
// enough. Turn the block to find free matching pairs. Deals are built from a
// removal order, so every block can be cleared.

import type { Rng } from '../../../engine/rng';
import { matchGroup, pairsFromSet } from '../../helpers';

export interface Block {
  x: number;
  y: number;
  z: number;
}

/** The six sides as unit steps; side i and side i^1 are opposite. */
export const SIDES: [number, number, number][] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/** Pairs of sides that share an edge (not opposite). */
const ADJ: [number, number][] = [];
for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) if (b !== (a ^ 1)) ADJ.push([a, b]);

/** A box of blocks w × h × d, optionally with its corners rounded off. */
export function boxShape(w: number, h: number, d: number, carve = false): Block[] {
  const out: Block[] = [];
  for (let y = 0; y < h; y++)
    for (let z = 0; z < d; z++)
      for (let x = 0; x < w; x++) {
        const corner = (x === 0 || x === w - 1) && (z === 0 || z === d - 1) && (y === h - 1 || y === 0);
        if (carve && corner) continue;
        out.push({ x, y, z });
      }
  return out;
}

/** A stepped ziggurat: each layer one block in from the one below on every side. */
export function stepShape(base: number, layers: number): Block[] {
  const out: Block[] = [];
  for (let y = 0; y < layers; y++) {
    const n = base - 2 * y;
    if (n <= 0) break;
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) out.push({ x: x + y, y, z: z + y });
  }
  return out;
}

export class Dimensions {
  readonly n: number;
  /** For each block and side, the block next to it there (-1 for none). */
  readonly nb: number[][];
  alive: boolean[];
  history: [number, number][] = [];

  constructor(
    readonly blocks: Block[],
    readonly kinds: number[],
  ) {
    this.n = blocks.length;
    const key = (b: Block) => `${b.x},${b.y},${b.z}`;
    const at = new Map(blocks.map((b, i) => [key(b), i]));
    this.nb = blocks.map((b) => SIDES.map(([dx, dy, dz]) => at.get(key({ x: b.x + dx, y: b.y + dy, z: b.z + dz })) ?? -1));
    this.alive = blocks.map(() => true);
  }

  get left() {
    return this.alive.filter(Boolean).length;
  }

  /** Whether side s of block i is open. */
  open(i: number, s: number, alive = this.alive) {
    const j = this.nb[i][s];
    return j < 0 || !alive[j];
  }

  isFree(i: number, alive = this.alive): boolean {
    if (!alive[i]) return false;
    return ADJ.some(([a, b]) => this.open(i, a, alive) && this.open(i, b, alive));
  }

  free(alive = this.alive): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.n; i++) if (this.isFree(i, alive)) out.push(i);
    return out;
  }

  canMatch(a: number, b: number) {
    return a !== b && this.isFree(a) && this.isFree(b) && matchGroup(this.kinds[a]) === matchGroup(this.kinds[b]);
  }

  pairs(): [number, number][] {
    const by = new Map<number, number[]>();
    for (const i of this.free()) {
      const g = matchGroup(this.kinds[i]);
      by.set(g, [...(by.get(g) ?? []), i]);
    }
    const out: [number, number][] = [];
    for (const ids of by.values()) for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) out.push([ids[i], ids[j]]);
    return out;
  }

  remove(a: number, b: number) {
    if (!this.canMatch(a, b)) return false;
    this.alive[a] = this.alive[b] = false;
    this.history.push([a, b]);
    return true;
  }

  undo(): [number, number] | null {
    const m = this.history.pop();
    if (!m) return null;
    this.alive[m[0]] = this.alive[m[1]] = true;
    return m;
  }
}

/** Kinds for a shape such that it can be cleared (pairs follow a removal order). */
export function dealDimensions(blocks: Block[], rng: Rng): number[] {
  const probe = new Dimensions(blocks, blocks.map(() => 0));
  for (let attempt = 0; attempt < 200; attempt++) {
    const alive = blocks.map(() => true);
    const order: [number, number][] = [];
    let ok = true;
    for (let left = blocks.length; left > 0; left -= 2) {
      const free = probe.free(alive);
      if (free.length < 2) {
        ok = false;
        break;
      }
      // Peel from the outside in: favour the highest and outermost free blocks.
      const a = free[rng.int(free.length)];
      const rest = free.filter((x) => x !== a);
      const b = rest[rng.int(rest.length)];
      alive[a] = alive[b] = false;
      order.push([a, b]);
    }
    if (!ok) continue;
    const pairs = pairsFromSet(blocks.length / 2, rng);
    const kinds = blocks.map(() => -1);
    order.forEach(([a, b], i) => {
      kinds[a] = pairs[i][0];
      kinds[b] = pairs[i][1];
    });
    return kinds;
  }
  throw new Error('shape cannot be dealt');
}
