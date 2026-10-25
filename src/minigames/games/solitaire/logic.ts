// Mahjong Solitaire rules, free of any drawing: which tiles are free, which
// pairs can go, solvable deals, the no-moves shuffle and undo. Mahjong Tower
// and the timed modes reuse it with other layouts and clocks.
//
// A tile is free when nothing lies on it and its left or right side is open.
// Tile ids never change; a shuffle moves tiles to other slots.

import type { Rng } from '../../../engine/rng';
import { matchGroup, pairsFromSet } from '../../helpers';
import type { Slot } from './layouts';

const EPS = 1e-6;

/** For each slot: the slots on top of it, and those touching its left and right sides. */
export interface Topology {
  slots: Slot[];
  above: number[][];
  left: number[][];
  right: number[][];
}

export function topology(slots: Slot[]): Topology {
  const n = slots.length;
  const above: number[][] = Array.from({ length: n }, () => []);
  const left: number[][] = Array.from({ length: n }, () => []);
  const right: number[][] = Array.from({ length: n }, () => []);
  for (let a = 0; a < n; a++) {
    const A = slots[a];
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      const B = slots[b];
      const dx = B.x - A.x,
        dy = B.y - A.y;
      if (Math.abs(dy) >= 1 - EPS) continue;
      if (B.z === A.z + 1 && Math.abs(dx) < 1 - EPS) above[a].push(b);
      // Higher layers also hold a tile in when they overhang its side? No: only its own layer does.
      else if (B.z === A.z && Math.abs(dx - -1) < 0.5 + EPS) left[a].push(b);
      else if (B.z === A.z && Math.abs(dx - 1) < 0.5 + EPS) right[a].push(b);
    }
  }
  // Tiles further up (two layers or more) also cover a tile when they overlap it.
  for (let a = 0; a < n; a++) {
    const A = slots[a];
    for (let b = 0; b < n; b++) {
      const B = slots[b];
      if (B.z > A.z + 1 && Math.abs(B.x - A.x) < 1 - EPS && Math.abs(B.y - A.y) < 1 - EPS) above[a].push(b);
    }
  }
  return { slots, above, left, right };
}

/** Problems with a layout: overlapping slots on one layer, or an odd count. */
export function layoutProblems(slots: Slot[]): string[] {
  const out: string[] = [];
  if (slots.length % 2) out.push(`odd tile count ${slots.length}`);
  for (let a = 0; a < slots.length; a++)
    for (let b = a + 1; b < slots.length; b++) {
      const A = slots[a],
        B = slots[b];
      if (A.z === B.z && Math.abs(A.x - B.x) < 1 - EPS && Math.abs(A.y - B.y) < 1 - EPS) out.push(`overlap ${JSON.stringify(A)} ${JSON.stringify(B)}`);
    }
  return out;
}

/** Free slots given which slots are occupied. */
export function freeSlots(t: Topology, occ: boolean[]): number[] {
  const out: number[] = [];
  for (let s = 0; s < t.slots.length; s++) if (occ[s] && slotFree(t, occ, s)) out.push(s);
  return out;
}

export function slotFree(t: Topology, occ: boolean[], s: number): boolean {
  if (t.above[s].some((b) => occ[b])) return false;
  const l = t.left[s].some((b) => occ[b]);
  const r = t.right[s].some((b) => occ[b]);
  return !l || !r;
}

/**
 * A removal order that clears the given slots, as slot pairs: pairs are taken
 * two free slots at a time, so the order is always playable. `near` makes a
 * gentler deal by pairing slots close to each other. Null if it dead-ends
 * (the caller retries).
 */
export function removalOrder(t: Topology, occ0: boolean[], rng: Rng, near = 0): [number, number][] | null {
  const occ = [...occ0];
  const out: [number, number][] = [];
  let left = occ.filter(Boolean).length;
  while (left > 0) {
    const free = freeSlots(t, occ);
    if (free.length < 2) return null;
    // Prefer the highest free tiles: taking from the top first keeps lower layers open, avoiding dead ends.
    free.sort((a, b) => t.slots[b].z - t.slots[a].z || rng.next() - 0.5);
    const topZ = t.slots[free[0]].z;
    const pool = rng.next() < 0.7 ? free.filter((s) => t.slots[s].z >= topZ - 1) : free;
    const a = pool.length >= 2 ? pool[rng.int(pool.length)] : free[rng.int(free.length)];
    let cands = free.filter((s) => s !== a);
    if (near > 0 && rng.next() < near) {
      const A = t.slots[a];
      cands.sort((x, y) => dist(t.slots[x], A) - dist(t.slots[y], A));
      cands = cands.slice(0, 3);
    }
    const b = cands[rng.int(cands.length)];
    occ[a] = occ[b] = false;
    out.push([a, b]);
    left -= 2;
  }
  return out;
}

const dist = (a: Slot, b: Slot) => Math.hypot(a.x - b.x, a.y - b.y) + Math.abs(a.z - b.z) * 0.5;

export interface Deal {
  /** Kind of each tile id; tile id i starts in slot i. */
  kinds: number[];
  /** One way to clear it (tile id pairs). */
  solution: [number, number][];
}

/** A solvable deal for a layout. */
export function deal(slots: Slot[], rng: Rng, near = 0): Deal {
  const t = topology(slots);
  const n = slots.length;
  let order: [number, number][] | null = null;
  for (let i = 0; i < 400 && !order; i++) order = removalOrder(t, Array(n).fill(true), rng, near);
  if (!order) throw new Error('layout cannot be dealt');
  const pairs = pairsFromSet(n / 2, rng);
  const kinds = Array(n).fill(-1);
  order.forEach(([a, b], i) => {
    kinds[a] = pairs[i][0];
    kinds[b] = pairs[i][1];
  });
  return { kinds, solution: order };
}

export type Move = { kind: 'pair'; a: number; b: number } | { kind: 'shuffle'; before: number[] };

/** A game in progress. */
export class Solitaire {
  readonly t: Topology;
  /** Slot of each tile id. */
  slotOf: number[];
  /** Tile id in each slot, or -1. */
  inSlot: number[];
  alive: boolean[];
  readonly kinds: number[];
  history: Move[] = [];

  constructor(slots: Slot[], kinds: number[]) {
    this.t = topology(slots);
    this.kinds = kinds;
    this.slotOf = kinds.map((_, i) => i);
    this.inSlot = kinds.map((_, i) => i);
    this.alive = kinds.map(() => true);
  }

  get left() {
    return this.alive.filter(Boolean).length;
  }
  get total() {
    return this.kinds.length;
  }
  private occ(): boolean[] {
    return this.inSlot.map((id) => id >= 0 && this.alive[id]);
  }
  isFree(id: number): boolean {
    return this.alive[id] && slotFree(this.t, this.occ(), this.slotOf[id]);
  }
  freeTiles(): number[] {
    const occ = this.occ();
    return freeSlots(this.t, occ).map((s) => this.inSlot[s]);
  }
  canMatch(a: number, b: number) {
    return a !== b && this.alive[a] && this.alive[b] && matchGroup(this.kinds[a]) === matchGroup(this.kinds[b]) && this.isFree(a) && this.isFree(b);
  }
  /** Every pair that can go now. */
  pairs(): [number, number][] {
    const free = this.freeTiles();
    const by = new Map<number, number[]>();
    for (const id of free) {
      const g = matchGroup(this.kinds[id]);
      by.set(g, [...(by.get(g) ?? []), id]);
    }
    const out: [number, number][] = [];
    for (const ids of by.values()) for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) out.push([ids[i], ids[j]]);
    return out;
  }
  remove(a: number, b: number): boolean {
    if (!this.canMatch(a, b)) return false;
    this.alive[a] = this.alive[b] = false;
    this.history.push({ kind: 'pair', a, b });
    return true;
  }
  undo(): Move | null {
    const m = this.history.pop();
    if (!m) return null;
    if (m.kind === 'pair') this.alive[m.a] = this.alive[m.b] = true;
    else this.setSlots(m.before);
    return m;
  }
  private setSlots(slotOf: number[]) {
    this.slotOf = [...slotOf];
    this.inSlot = this.inSlot.map(() => -1);
    slotOf.forEach((s, id) => {
      if (s >= 0) this.inSlot[s] = id;
    });
  }

  /**
   * Move the remaining tiles to new slots (among the occupied ones) so the
   * rest of the board is solvable again. Returns the new slot per tile id.
   */
  shuffle(rng: Rng): boolean {
    const occ = this.occ();
    const ids = this.alive.map((a, i) => (a ? i : -1)).filter((i) => i >= 0);
    if (ids.length < 2) return false;
    // Pair up the remaining tiles by matching group.
    const byGroup = new Map<number, number[]>();
    for (const id of ids) byGroup.set(matchGroup(this.kinds[id]), [...(byGroup.get(matchGroup(this.kinds[id])) ?? []), id]);
    const tilePairs: [number, number][] = [];
    for (const g of byGroup.values()) {
      rng.shuffle(g);
      for (let i = 0; i + 1 < g.length; i += 2) tilePairs.push([g[i], g[i + 1]]);
    }
    let order: [number, number][] | null = null;
    for (let i = 0; i < 400 && !order; i++) order = removalOrder(this.t, occ, rng);
    if (!order || order.length !== tilePairs.length) return false;
    rng.shuffle(tilePairs);
    const before = [...this.slotOf];
    const next = [...this.slotOf];
    order.forEach(([sa, sb], i) => {
      next[tilePairs[i][0]] = sa;
      next[tilePairs[i][1]] = sb;
    });
    this.setSlots(next);
    this.history.push({ kind: 'shuffle', before });
    return true;
  }
}
