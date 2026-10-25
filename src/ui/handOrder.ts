// How your own hand is laid out, shared by the 3D rack and the 2D tray.
// Tiles are sorted by suit or by number, with a small gap between suits.
// The freshly drawn tile is sorted in with the rest (the caller highlights it).
// Players can drag tiles into their own order after sorting; new tiles then
// slot in where sorting would put them. Optionally, complete sets (pungs and
// runs) are pulled to the left and spaced apart.

import { compareTiles, isFlower, isJoker, isTypedJoker, suitOf, type HandSort, type Tile } from '../engine/tiles';

export interface HandLayout {
  mode: HandSort;
  /** Tile ids in the player's own order, or null for plain sorting. */
  custom: number[] | null;
  /** Pull complete sets to the left. */
  groupSets: boolean;
  /** Runs count as sets (false for American, where only like tiles group). */
  chows?: boolean;
  /** Only these sets are pulled out (India Rules Small Cards: the sets your card uses). Kinds are
   *  a pung's tile and a chow's lowest tile. */
  only?: { pungs: Set<number>; chows: Set<number> };
  /** India Rules East round: crochets and mixed chows are sets too. */
  indiaSets?: boolean;
  /** Groups pulled out first, as kinds, each spaced apart (India Rules: the passport you chose,
   *  piece by piece). Kinds not in the hand are skipped. */
  groups?: number[][];
}

export interface HandSlot {
  tile: Tile;
  /** Extra space before this tile: 0 none, 1 between suits, 2 between sets. */
  gap: 0 | 1 | 2;
  /** Index of the complete set this tile belongs to, or -1. */
  set: number;
}

const group = (k: number) => (isJoker(k) || isTypedJoker(k) ? 'joker' : isFlower(k) ? 'flower' : suitOf(k));

/** The most complete sets that can be cut from these tiles (largest first). */
/** India Rules sets beyond pungs and chows, by their lowest kind: crochets (one number in all three
 *  suits) and mixed chows (a run across the three suits). */
const INDIA_SETS: number[][][] = (() => {
  const out: number[][][] = Array.from({ length: 34 }, () => []);
  for (let n = 0; n < 9; n++) out[n].push([n, n + 9, n + 18]);
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (let n = 0; n < 7; n++)
    for (const p of perms) {
      const ks = p.map((suit, i) => suit * 9 + n + i);
      out[Math.min(...ks)].push(ks);
    }
  return out;
})();

export function completeSets(tiles: Tile[], chows = true, only?: HandLayout['only'], india = false): Tile[][] {
  const kinds = new Map<number, Tile[]>();
  for (const t of tiles) if (t.kind < 34) (kinds.get(t.kind) ?? kinds.set(t.kind, []).get(t.kind)!).push(t);
  const counts = Array.from({ length: 34 }, (_, k) => kinds.get(k)?.length ?? 0);
  let best: number[][] = [];
  const cur: number[][] = [];
  const walk = (i: number) => {
    while (i < 34 && counts[i] === 0) i++;
    if (i === 34) {
      if (cur.length > best.length) best = cur.slice();
      return;
    }
    // Upper bound: even taking every remaining tile we cannot beat the best.
    let left = 0;
    for (let j = i; j < 34; j++) left += counts[j];
    if (cur.length + Math.floor(left / 3) <= best.length) return;
    if (counts[i] >= 3 && (!only || only.pungs.has(i))) {
      counts[i] -= 3;
      cur.push([i, i, i]);
      walk(i);
      cur.pop();
      counts[i] += 3;
    }
    if (chows && i < 27 && i % 9 <= 6 && counts[i + 1] > 0 && counts[i + 2] > 0 && (!only || only.chows.has(i))) {
      counts[i]--, counts[i + 1]--, counts[i + 2]--;
      cur.push([i, i + 1, i + 2]);
      walk(i);
      cur.pop();
      counts[i]++, counts[i + 1]++, counts[i + 2]++;
    }
    if (india)
      for (const ks of INDIA_SETS[i]) {
        if (!ks.every((k) => counts[k] > 0)) continue;
        for (const k of ks) counts[k]--;
        cur.push(ks);
        walk(i);
        cur.pop();
        for (const k of ks) counts[k]++;
      }
    // Or leave one tile of this kind out of any set.
    counts[i]--;
    walk(i);
    counts[i]++;
  };
  walk(0);
  const pool = new Map([...kinds].map(([k, ts]) => [k, ts.slice()]));
  return best.map((ks) => ks.map((kk) => pool.get(kk)!.shift()!));
}

/** Put any tiles missing from a custom order where plain sorting would. */
function withCustom(sorted: Tile[], custom: number[], cmp: (a: Tile, b: Tile) => number): Tile[] {
  const byId = new Map(sorted.map((t) => [t.id, t]));
  const out = custom.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
  const have = new Set(out.map((t) => t.id));
  for (const t of sorted) {
    if (have.has(t.id)) continue;
    const at = out.findIndex((o) => cmp(o, t) > 0);
    if (at < 0) out.push(t);
    else out.splice(at, 0, t);
  }
  return out;
}

/** Lay out a hand: order, gaps and set membership for each tile. */
export function arrangeHand(hand: Tile[], layout: HandLayout): HandSlot[] {
  const cmp = compareTiles(layout.mode);
  let tiles = [...hand].sort(cmp);
  const custom = !!layout.custom?.length;
  if (custom) tiles = withCustom(tiles, layout.custom!, cmp);
  const slots: HandSlot[] = [];
  if (layout.groupSets) {
    // Set-aside groups first (the passport you chose), then the usual complete sets from what is left.
    const groups: Tile[][] = [];
    for (const g of layout.groups ?? []) {
      const got: Tile[] = [];
      for (const k of g) {
        const i = tiles.findIndex((t) => t.kind === k);
        if (i >= 0) got.push(tiles.splice(i, 1)[0]);
      }
      if (got.length) groups.push(got);
    }
    const sets = completeSets(tiles, layout.chows ?? true, layout.only, layout.indiaSets);
    const inSet = new Set(sets.flat().map((t) => t.id));
    // Keep sets in the order their first tile appears in the current order.
    const pos = new Map(tiles.map((t, i) => [t.id, i]));
    sets.sort((a, b) => Math.min(...a.map((t) => pos.get(t.id)!)) - Math.min(...b.map((t) => pos.get(t.id)!)));
    [...groups, ...sets].forEach((s, si) => s.forEach((tile, j) => slots.push({ tile, gap: j === 0 && si > 0 ? 2 : 0, set: si })));
    tiles = tiles.filter((t) => !inSet.has(t.id));
    if (slots.length && tiles.length) slots.push(...tiles.splice(0, 1).map((tile) => ({ tile, gap: 2 as const, set: -1 })));
  }
  for (const tile of tiles) {
    const prev = slots[slots.length - 1];
    const suitGap = !custom && layout.mode === 'suit' && prev && prev.set < 0 && group(prev.tile.kind) !== group(tile.kind);
    slots.push({ tile, gap: suitGap ? 1 : 0, set: -1 });
  }
  return slots;
}

/** Move one tile to a new index in the current layout; returns the new custom order. */
export function moveTile(slots: HandSlot[], id: number, to: number): number[] {
  const ids = slots.map((s) => s.tile.id);
  const from = ids.indexOf(id);
  if (from < 0) return ids;
  ids.splice(from, 1);
  ids.splice(Math.max(0, Math.min(ids.length, to)), 0, id);
  return ids;
}
