// Joker readings against brute force: assign every wild each tile it may
// stand for and look for an ordinary sets-and-a-pair reading.

import { describe, expect, it } from 'vitest';
import { standardDecompositions, wildDecompositions } from '../src/engine/hand';
import { Rng } from '../src/engine/rng';
import { DRAGON_JOKER, JOKER_KIND, NUMBER_JOKER, WIND_JOKER, wildTargets } from '../src/engine/tiles';

function brute(counts: number[], wilds: number[], inPair: boolean): boolean {
  const c = counts.slice();
  const rec = (i: number): boolean => {
    if (i === wilds.length) {
      return standardDecompositions(c, 4).some((d) => inPair || counts[d.pair] >= 2);
    }
    for (const t of wildTargets(wilds[i])) {
      c[t]++;
      const ok = rec(i + 1);
      c[t]--;
      if (ok) return true;
    }
    return false;
  };
  return rec(0);
}

/** A random winning hand, then a few tiles swapped for wilds (and sometimes one tile changed). */
function randomHand(rng: Rng, wildKinds: number[]) {
  const counts = new Array(34).fill(0);
  const add = (k: number) => counts[k]++;
  for (let s = 0; s < 4; s++) {
    if (rng.next() < 0.5) {
      const suit = rng.int(3);
      const r = rng.int(7);
      for (let j = 0; j < 3; j++) add(suit * 9 + r + j);
    } else {
      const k = rng.int(34);
      for (let j = 0; j < 3; j++) add(k);
    }
  }
  const p = rng.int(34);
  add(p);
  add(p);
  const tiles: number[] = [];
  counts.forEach((n, k) => {
    for (let i = 0; i < n; i++) tiles.push(k);
  });
  const wilds: number[] = [];
  const n = 1 + rng.int(wildKinds.includes(JOKER_KIND) ? 2 : 3);
  for (let i = 0; i < n; i++) {
    const at = rng.int(tiles.length);
    tiles.splice(at, 1);
    wilds.push(wildKinds[rng.int(wildKinds.length)]);
  }
  if (rng.next() < 0.3) tiles[rng.int(tiles.length)] = rng.int(34);
  const c = new Array(34).fill(0);
  for (const k of tiles) c[k]++;
  return { counts: c, wilds };
}

describe('wild readings match brute force', () => {
  const cases: [string, number[], boolean][] = [
    ['Vietnamese (typed jokers, joker pair allowed)', [WIND_JOKER, DRAGON_JOKER, NUMBER_JOKER], true],
    ['Indian (any-tile jokers, no joker pair)', [JOKER_KIND], false],
    ['Indian (any-tile jokers, joker pair allowed)', [JOKER_KIND], true],
  ];
  for (const [name, kinds, inPair] of cases) {
    it(name, () => {
      const rng = new Rng(name.length * 977);
      for (let i = 0; i < 500; i++) {
        const { counts, wilds } = randomHand(rng, kinds);
        if (counts.some((n) => n > 4)) continue;
        const fast = wildDecompositions(counts, wilds, 0, { sevenPairs: false, thirteenOrphans: false }, { inPair, inChow: true }).length > 0;
        const slow = brute(counts, wilds, inPair);
        if (fast !== slow) throw new Error(`mismatch on ${JSON.stringify({ counts: counts.map((n, k) => (n ? `${k}x${n}` : '')).filter(Boolean), wilds })}: fast ${fast} brute ${slow}`);
      }
      expect(true).toBe(true);
    }, 120_000);
  }
});
