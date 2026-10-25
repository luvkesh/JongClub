// Small pieces every mini-game shares: which tiles match, building decks,
// an undo stack, a game clock and time formatting.

import { FLOWER_BASE, KIND_COUNT } from '../engine/tiles';
import type { Rng } from '../engine/rng';
import type { TileLook } from './board';
import { highlightFree } from './progress';

/** Kinds 34..37 are the four flowers, 38..41 the four seasons (engine/tiles.ts). */
export const FLOWER_KINDS = [FLOWER_BASE, FLOWER_BASE + 1, FLOWER_BASE + 2, FLOWER_BASE + 3];
export const SEASON_KINDS = [FLOWER_BASE + 4, FLOWER_BASE + 5, FLOWER_BASE + 6, FLOWER_BASE + 7];

/**
 * The matching group of a kind. As in classic Mahjong Solitaire, any flower
 * matches any flower and any season any season; every other tile matches its twin.
 */
export function matchGroup(kind: number): number {
  if (kind >= FLOWER_BASE && kind < FLOWER_BASE + 4) return 100;
  if (kind >= FLOWER_BASE + 4 && kind < FLOWER_BASE + 8) return 101;
  return kind;
}
export const tilesMatch = (a: number, b: number) => matchGroup(a) === matchGroup(b);

/** The full 144-tile set: four of each of the 34 kinds plus the eight flowers and seasons. */
export function fullSet(): number[] {
  const out: number[] = [];
  for (let k = 0; k < KIND_COUNT; k++) out.push(k, k, k, k);
  out.push(...FLOWER_KINDS, ...SEASON_KINDS);
  return out;
}

/**
 * `n` matching pairs drawn from the set, as [a, b] kind pairs. Boards smaller
 * than 144 use whole kinds first (two pairs of each), so each kind still
 * appears four times where it can, and the bonus tiles come last.
 */
export function pairsFromSet(n: number, rng: Rng): [number, number][] {
  const kinds = rng.shuffle(Array.from({ length: KIND_COUNT }, (_, k) => k));
  const pairs: [number, number][] = [];
  for (const k of kinds) pairs.push([k, k], [k, k]);
  const f = rng.shuffle([...FLOWER_KINDS]),
    s = rng.shuffle([...SEASON_KINDS]);
  pairs.push([f[0], f[1]], [f[2], f[3]], [s[0], s[1]], [s[2], s[3]]);
  if (n <= pairs.length) {
    // Keep whole kinds together: take pairs two at a time where possible.
    const chosen = pairs.slice(0, n);
    return rng.shuffle(chosen);
  }
  // Bigger boards repeat the set.
  const out = [...pairs];
  while (out.length < n) out.push(...pairsFromSet(Math.min(72, n - out.length), rng));
  return rng.shuffle(out.slice(0, n));
}

/** `n` groups of `size` identical tiles (Triple Match, Match-3), kinds spread across the set. */
export function groupsOf(n: number, size: number, rng: Rng, pool = KIND_COUNT): number[][] {
  const kinds = rng.shuffle(Array.from({ length: pool }, (_, k) => k));
  const out: number[][] = [];
  for (let i = 0; i < n; i++) out.push(Array(size).fill(kinds[i % kinds.length]));
  return out;
}

/** A plain undo stack of moves. */
export class UndoStack<T> {
  private items: T[] = [];
  constructor(private limit = 500) {}
  push(m: T) {
    this.items.push(m);
    if (this.items.length > this.limit) this.items.shift();
  }
  pop(): T | undefined {
    return this.items.pop();
  }
  get size() {
    return this.items.length;
  }
  clear() {
    this.items = [];
  }
}

/** Counts up, or down from a limit. Paused while the game is paused or a sheet is open. */
export class GameClock {
  elapsed = 0;
  paused = false;
  constructor(public limit = 0) {}
  tick(dt: number) {
    if (!this.paused) this.elapsed += dt;
  }
  get left() {
    return this.limit ? Math.max(0, this.limit - this.elapsed) : Infinity;
  }
  get over() {
    return !!this.limit && this.elapsed >= this.limit;
  }
  add(sec: number) {
    if (this.limit) this.limit += sec;
  }
  text() {
    return fmtClock(this.limit ? this.left : this.elapsed);
  }
}

/** 75 -> "1:15". */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec - 1e-6));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A tile's resting look in a layered game: free tiles gold-edged, blocked ones shaded (when the setting is on). */
export function freeLook(isFree: boolean, on = highlightFree()): TileLook {
  return on ? (isFree ? 'free' : 'blocked') : 'normal';
}
