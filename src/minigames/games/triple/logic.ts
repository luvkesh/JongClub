// Mahjong Triple Match rules: tiles lie in overlapping layers; tap a tile with
// nothing on it to move it into the tray. Three of a kind in the tray clear.
// The tray holds seven: fill it without a set and the game is lost. Deals
// are built from a removal order three at a time, so they can be cleared.

import type { Rng } from '../../../engine/rng';
import { KIND_COUNT } from '../../../engine/tiles';

export const TRAY = 7;

export interface Spot {
  x: number;
  y: number;
  z: number;
}

/** Overlapping layers, each half a tile off the one below, with gaps so the count is a multiple of three. */
export function tripleLayout(layers: number, w: number, h: number, rng: Rng): Spot[] {
  const out: Spot[] = [];
  for (let z = 0; z < layers; z++) {
    const lw = w - z,
      lh = h - z;
    for (let y = 0; y < lh; y++)
      for (let x = 0; x < lw; x++) {
        // Thin the upper layers so the ones below show through.
        if (z > 0 && rng.next() < 0.18 + z * 0.06) continue;
        out.push({ x: x + z * 0.5, y: y + z * 0.5, z });
      }
  }
  while (out.length % 3) out.splice(rng.int(out.length), 1);
  return out;
}

/** Spots lying on spot i (higher and overlapping it). */
export function coverMap(spots: Spot[]): number[][] {
  return spots.map((a) => spots.map((b, j) => (b.z > a.z && Math.abs(b.x - a.x) < 1 && Math.abs(b.y - a.y) < 1 ? j : -1)).filter((j) => j >= 0));
}

export class Triple {
  readonly cover: number[][];
  onBoard: boolean[];
  /** Tile ids in the tray, in order. */
  tray: number[] = [];
  cleared: number[] = [];
  history: { id: number; trayBefore: number[]; clearedBefore: number }[] = [];

  constructor(
    readonly spots: Spot[],
    readonly kinds: number[],
  ) {
    this.cover = coverMap(spots);
    this.onBoard = spots.map(() => true);
  }

  isFree(i: number) {
    return this.onBoard[i] && this.cover[i].every((j) => !this.onBoard[j]);
  }
  free(): number[] {
    return this.spots.map((_, i) => i).filter((i) => this.isFree(i));
  }
  get boardLeft() {
    return this.onBoard.filter(Boolean).length;
  }
  get lost() {
    return this.tray.length >= TRAY;
  }
  get won() {
    return this.boardLeft === 0 && this.tray.length === 0;
  }

  /**
   * Move a free tile to the tray, next to others of its kind. Returns the ids
   * that clear as a set (empty if none).
   */
  take(i: number): number[] {
    if (!this.isFree(i) || this.lost) return [];
    this.history.push({ id: i, trayBefore: [...this.tray], clearedBefore: this.cleared.length });
    this.onBoard[i] = false;
    const k = this.kinds[i];
    const last = this.tray.map((t) => this.kinds[t]).lastIndexOf(k);
    if (last >= 0) this.tray.splice(last + 1, 0, i);
    else this.tray.push(i);
    const same = this.tray.filter((t) => this.kinds[t] === k);
    if (same.length >= 3) {
      const set = same.slice(0, 3);
      this.tray = this.tray.filter((t) => !set.includes(t));
      this.cleared.push(...set);
      return set;
    }
    return [];
  }

  /** Put the last tile taken back on the board. */
  undo(): number | null {
    const m = this.history.pop();
    if (!m) return null;
    this.tray = m.trayBefore;
    this.cleared.length = m.clearedBefore;
    this.onBoard[m.id] = true;
    return m.id;
  }

  /** A tile worth taking: one that completes or builds on a kind in the tray, else any free tile. */
  hint(): number | null {
    const free = this.free();
    if (!free.length) return null;
    const count = (k: number) => this.tray.filter((t) => this.kinds[t] === k).length;
    free.sort((a, b) => count(this.kinds[b]) - count(this.kinds[a]));
    return free[0];
  }

  /** Mix the kinds of the tiles still on the board. */
  shuffle(rng: Rng) {
    const ids = this.spots.map((_, i) => i).filter((i) => this.onBoard[i]);
    const ks = rng.shuffle(ids.map((i) => this.kinds[i]));
    ids.forEach((i, n) => ((this.kinds as number[])[i] = ks[n]));
    this.history = [];
  }
}

/**
 * Kinds for a layout, assigned three at a time along a top-down removal
 * order, so taking tiles in that order never holds more than `spread` + 2
 * tiles in the tray. `kinds` is how many different tiles appear.
 */
export function dealTriple(spots: Spot[], rng: Rng, kinds: number, spread = 1): number[] {
  const cover = coverMap(spots);
  const on = spots.map(() => true);
  const order: number[] = [];
  for (let left = spots.length; left > 0; left--) {
    const free = spots.map((_, i) => i).filter((i) => on[i] && cover[i].every((j) => !on[j]));
    const i = free[rng.int(free.length)];
    on[i] = false;
    order.push(i);
  }
  const pool = rng.shuffle(Array.from({ length: KIND_COUNT }, (_, k) => k)).slice(0, Math.max(3, kinds));
  const out = spots.map(() => -1);
  // Groups of three along the order; `spread` interleaves neighbouring groups for harder deals.
  const groups = order.length / 3;
  const kindOf = Array.from({ length: groups }, (_, g) => pool[g % pool.length]);
  rng.shuffle(kindOf);
  const slots: number[] = [];
  for (let g = 0; g < groups; g++) slots.push(g, g, g);
  if (spread > 1) {
    for (let i = 0; i + 1 < slots.length; i++) {
      const j = Math.min(slots.length - 1, i + rng.int(spread + 1));
      // Only swap within a short window so a careful player still needs at most spread + 2 tray places.
      if (Math.abs(slots[i] - slots[j]) <= 1) [slots[i], slots[j]] = [slots[j], slots[i]];
    }
  }
  order.forEach((spot, n) => (out[spot] = kindOf[slots[n]]));
  return out;
}
