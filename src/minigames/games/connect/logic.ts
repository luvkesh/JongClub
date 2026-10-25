// Mahjong Connect rules: a flat grid of tiles; two matching tiles go when a
// path of at most three straight lines (two turns) joins them through empty
// cells, and the path may run round the outside of the board. Deals are built
// backwards, pair by pair, so the board can always be cleared. With gravity
// (Mahjong Cascade), tiles drop to fill the gaps a pair leaves.

import type { Rng } from '../../../engine/rng';
import { matchGroup, pairsFromSet } from '../../helpers';

export type Gravity = 'none' | 'down' | 'left';

/** A point on the padded grid: -1 and w/h are the ring outside the board. */
export interface Cell {
  x: number;
  y: number;
}

export class Connect {
  /** Kind in each cell (row major), -1 when empty. */
  cells: number[];
  history: { a: number; b: number; ka: number; kb: number; before: number[] }[] = [];

  constructor(
    readonly w: number,
    readonly h: number,
    cells: number[],
    readonly gravity: Gravity = 'none',
  ) {
    this.cells = [...cells];
  }

  idx(x: number, y: number) {
    return y * this.w + x;
  }
  at(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return this.cells[this.idx(x, y)];
  }
  get left() {
    return this.cells.filter((k) => k >= 0).length;
  }

  /** The joining path from a to b (cell indices) with at most two turns, or null. */
  path(a: number, b: number): Cell[] | null {
    return findPath(this.w, this.h, (x, y) => this.at(x, y) < 0, a, b);
  }

  canMatch(a: number, b: number) {
    return a !== b && this.cells[a] >= 0 && this.cells[b] >= 0 && matchGroup(this.cells[a]) === matchGroup(this.cells[b]) && !!this.path(a, b);
  }

  /** Every pair that can go now. */
  pairs(limit = Infinity): [number, number][] {
    const by = new Map<number, number[]>();
    this.cells.forEach((k, i) => {
      if (k < 0) return;
      const g = matchGroup(k);
      by.set(g, [...(by.get(g) ?? []), i]);
    });
    const out: [number, number][] = [];
    for (const ids of by.values())
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++) {
          if (this.path(ids[i], ids[j])) {
            out.push([ids[i], ids[j]]);
            if (out.length >= limit) return out;
          }
        }
    return out;
  }

  /** Take a pair off; returns where every remaining tile moved (gravity), as [from, to] cell pairs. */
  remove(a: number, b: number): [number, number][] {
    const before = [...this.cells];
    this.history.push({ a, b, ka: this.cells[a], kb: this.cells[b], before });
    this.cells[a] = this.cells[b] = -1;
    return this.settle();
  }

  undo(): number[] | null {
    const m = this.history.pop();
    if (!m) return null;
    this.cells = m.before;
    return this.cells;
  }

  /** Drop tiles into gaps (gravity); returns the moves as [from, to]. */
  private settle(): [number, number][] {
    const moves: [number, number][] = [];
    if (this.gravity === 'down') {
      for (let x = 0; x < this.w; x++) {
        let dst = this.h - 1;
        for (let y = this.h - 1; y >= 0; y--) {
          const i = this.idx(x, y);
          if (this.cells[i] < 0) continue;
          const j = this.idx(x, dst);
          if (j !== i) {
            this.cells[j] = this.cells[i];
            this.cells[i] = -1;
            moves.push([i, j]);
          }
          dst--;
        }
      }
    } else if (this.gravity === 'left') {
      for (let y = 0; y < this.h; y++) {
        let dst = 0;
        for (let x = 0; x < this.w; x++) {
          const i = this.idx(x, y);
          if (this.cells[i] < 0) continue;
          const j = this.idx(dst, y);
          if (j !== i) {
            this.cells[j] = this.cells[i];
            this.cells[i] = -1;
            moves.push([i, j]);
          }
          dst++;
        }
      }
    }
    return moves;
  }

  /** Mix the remaining tiles among the cells they fill until a move exists. */
  shuffle(rng: Rng): boolean {
    const filled = this.cells.map((k, i) => (k >= 0 ? i : -1)).filter((i) => i >= 0);
    if (filled.length < 2) return false;
    const before = [...this.cells];
    for (let tries = 0; tries < 60; tries++) {
      const kinds = rng.shuffle(filled.map((i) => before[i]));
      filled.forEach((i, n) => (this.cells[i] = kinds[n]));
      if (this.pairs(1).length) {
        this.history.push({ a: -1, b: -1, ka: -1, kb: -1, before });
        return true;
      }
    }
    this.cells = before;
    return false;
  }
}

/**
 * Breadth-first search over the padded grid by number of turns. `empty(x, y)`
 * says whether a cell inside the board is free; the ring outside always is.
 */
export function findPath(w: number, h: number, empty: (x: number, y: number) => boolean, a: number, b: number, maxTurns = 2): Cell[] | null {
  const ax = a % w,
    ay = Math.floor(a / w),
    bx = b % w,
    by = Math.floor(b / w);
  const W = w + 2,
    H = h + 2;
  const free = (x: number, y: number) => {
    if (x === bx && y === by) return true;
    if (x < -1 || y < -1 || x > w || y > h) return false;
    if (x < 0 || y < 0 || x >= w || y >= h) return true;
    return empty(x, y);
  };
  const DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  // best[(cell, dir)] = fewest turns to reach it heading that way.
  const best = new Int8Array(W * H * 4).fill(99);
  const prev = new Int32Array(W * H * 4).fill(-1);
  const key = (x: number, y: number, d: number) => ((y + 1) * W + (x + 1)) * 4 + d;
  type Node = { x: number; y: number; d: number; t: number };
  let frontier: Node[] = [];
  for (let d = 0; d < 4; d++) {
    const nx = ax + DIRS[d][0],
      ny = ay + DIRS[d][1];
    if (!free(nx, ny)) continue;
    const k = key(nx, ny, d);
    best[k] = 0;
    prev[k] = -2;
    frontier.push({ x: nx, y: ny, d, t: 0 });
  }
  let end = -1;
  // Expand straight runs first (0-1 BFS by turns).
  for (let turn = 0; turn <= maxTurns && end < 0; turn++) {
    const next: Node[] = [];
    const queue = frontier.filter((n) => n.t === turn);
    while (queue.length) {
      const n = queue.shift()!;
      if (n.x === bx && n.y === by) {
        end = key(n.x, n.y, n.d);
        break;
      }
      for (let d = 0; d < 4; d++) {
        if (DIRS[d][0] === -DIRS[n.d][0] && DIRS[d][1] === -DIRS[n.d][1]) continue;
        const t = n.t + (d === n.d ? 0 : 1);
        if (t > maxTurns) continue;
        const nx = n.x + DIRS[d][0],
          ny = n.y + DIRS[d][1];
        if (!free(nx, ny)) continue;
        const k = key(nx, ny, d);
        if (best[k] <= t) continue;
        best[k] = t;
        prev[k] = key(n.x, n.y, n.d);
        const node = { x: nx, y: ny, d, t };
        if (t === turn) queue.push(node);
        else next.push(node);
      }
    }
    frontier = next;
  }
  if (end < 0) return null;
  const pts: Cell[] = [];
  for (let k = end; k >= 0; k = prev[k]) {
    const c = Math.floor(k / 4);
    pts.push({ x: (c % W) - 1, y: Math.floor(c / W) - 1 });
    if (prev[k] === -2) break;
  }
  pts.push({ x: ax, y: ay });
  pts.reverse();
  // Keep only the corners.
  const out: Cell[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = out[out.length - 1],
      c = pts[i],
      n = pts[i + 1];
    if ((c.x - p.x) * (n.y - c.y) !== (c.y - p.y) * (n.x - c.x)) out.push(c);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** A board that can be cleared: pairs placed backwards, each joinable when it lands. */
export function dealConnect(w: number, h: number, rng: Rng, gravity: Gravity = 'none'): number[] {
  const n = w * h;
  const pairs = pairsFromSet(n / 2, rng);
  if (gravity === 'none') {
    for (let attempt = 0; attempt < 40; attempt++) {
      const cells = Array(n).fill(-1);
      let ok = true;
      for (const [ka, kb] of pairs) {
        const empty = cells.map((k, i) => (k < 0 ? i : -1)).filter((i) => i >= 0);
        rng.shuffle(empty);
        let placed = false;
        for (const a of empty.slice(0, 12)) {
          const bs = rng.shuffle(empty.filter((b) => b !== a));
          for (const b of bs) {
            // Removing this pair later happens with the tiles placed so far still there.
            if (findPath(w, h, (x, y) => cells[y * w + x] < 0, a, b)) {
              cells[a] = ka;
              cells[b] = kb;
              placed = true;
              break;
            }
          }
          if (placed) break;
        }
        if (!placed) {
          ok = false;
          break;
        }
      }
      if (ok) return cells;
    }
  }
  // Gravity boards (or a rare failure): a random deal; the game shuffles when stuck.
  const flat: number[] = [];
  for (const [a, b] of pairs) flat.push(a, b);
  return rng.shuffle(flat);
}
