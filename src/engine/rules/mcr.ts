// Chinese Official Mahjong (Mahjong Competition Rules, MCR), the formal
// tournament ruleset used in China and by world championship events.
// 144 tiles with flowers, four sets and a pair, scored from a fixed fan list;
// a win needs at least eight fan, not counting flowers. Every player pays the
// winner a base of eight; a discarder also pays the hand's fan, and on a
// self-draw everyone does.
//
// Implemented: the main fan list for standard hands, seven pairs, seven
// shifted pairs and thirteen orphans, and the knitted hands: Knitted Straight
// (12, alone or as three of the four sets beside one set and a pair, and that
// set may be melded), Lesser Honours and Knitted Tiles (12, with Knitted
// Straight on top when all nine knitted tiles are held) and Greater Honours
// and Knitted Tiles (24), with the common exclusion rules.
// Simplified: Last Tile (the fourth copy of a tile) is not scored; the
// "account once" principle for the one-fan chow pairs is applied greedily, so
// a few rare chains score one fan less.

import { standardDecompositions, standardShanten, waits, type Decomposition, type ShapeRules, type SpecialShape } from '../hand';
import { KIND_COUNT, isDragon, isHonor, isSuited, isTerminal, isTerminalOrHonor, isWind, windKind } from '../tiles';
import { classicProfile } from './classic';
import type { HandScore, Payment, RuleProfile, ScoreItem, ScoringContext } from './types';

export const MCR_MIN = 8;
/** Every loser pays the winner this base. */
export const MCR_BASE = 8;
// ------------------------------------------------------------------ knitted hands

/** Knitted tiles: 1-4-7 in one suit, 2-5-8 in another, 3-6-9 in the third (six ways). */
export const KNITS: number[][] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
].map((suits) => suits.flatMap((s, i) => [0, 3, 6].map((r) => s * 9 + r + i)).sort((a, b) => a - b));

export const HONOURS_KNITTED = 'Honours and Knitted Tiles';
export const KNITTED_STRAIGHT = 'Knitted Straight';

/** Fourteen different tiles: knitted tiles of one order plus honours (Quan Bu Kao, Qi Xing Bu Kao). */
const honoursKnitted: SpecialShape = {
  name: HONOURS_KNITTED,
  ai: true,
  complete(counts, meldCount) {
    if (meldCount || counts.reduce((a, b) => a + b, 0) !== 14 || counts.some((n) => n > 1)) return false;
    return KNITS.some((set) => counts.every((n, k) => !n || k >= 27 || set.includes(k)));
  },
  shanten(counts, meldCount) {
    if (meldCount) return 13;
    let honours = 0;
    for (let k = 27; k < 34; k++) if (counts[k]) honours++;
    return 13 - honours - knitBest(counts);
  },
};

/** The most knitted tiles held for any one order. */
function knitBest(counts: number[]): number {
  let best = 0;
  for (let i = 0; i < KNITS.length; i++) {
    const set = KNITS[i];
    let n = 0;
    for (let j = 0; j < 9; j++) if (counts[set[j]]) n++;
    if (n > best) best = n;
  }
  return best;
}

/** The nine knitted tiles of one order, with the rest of the hand as one set and a pair. */
function knittedRest(counts: number[], meldCount: number): Decomposition | null {
  if (meldCount > 1) return null;
  for (const set of KNITS) {
    if (set.some((k) => !counts[k])) continue;
    const c = counts.slice();
    for (const k of set) c[k]--;
    const d = standardDecompositions(c, 1 - meldCount)[0];
    if (d) return d;
  }
  return null;
}


const knittedStraight: SpecialShape = {
  name: KNITTED_STRAIGHT,
  ai: true,
  complete: (counts, meldCount) => !!knittedRest(counts, meldCount),
  // The other set and pair are at best already complete.
  bound: (counts, meldCount) => (meldCount > 1 ? 13 : 8 - knitBest(counts)),
  shanten(counts, meldCount) {
    if (meldCount > 1) return 13;
    let best = 13;
    for (const set of KNITS) {
      if (set.reduce((a, k) => a + (counts[k] ? 0 : 1), 0) - 1 >= best) continue;
      const c = counts.slice();
      let missing = 0;
      for (const k of set) {
        if (c[k]) c[k]--;
        else missing++;
      }
      // The knitted tiles count as three of the four sets.
      best = Math.min(best, missing + standardShanten(c, meldCount + 3));
    }
    return Math.max(-1, best);
  },
};

const SHAPES: ShapeRules = { sevenPairs: true, thirteenOrphans: true, special: [honoursKnitted, knittedStraight] };

/** Fans that a higher fan already includes (MCR's non-repeat principle). */
const EXCLUDES: Record<string, string[]> = {
  'Greater Honours and Knitted Tiles': ['Lesser Honours and Knitted Tiles', 'All Types', 'Concealed Hand', 'Single Wait'],
  'Lesser Honours and Knitted Tiles': ['All Types', 'Concealed Hand', 'Single Wait'],
  'Big Four Winds': ['Big Three Winds', 'All Pungs', 'Seat Wind', 'Prevalent Wind', 'Pung of Terminals or Honours', 'Little Four Winds'],
  'Big Three Dragons': ['Dragon Pung', 'Two Dragon Pungs', 'Little Three Dragons'],
  'All Green': ['Half Flush', 'Full Flush'],
  'Nine Gates': ['Full Flush', 'Concealed Hand', 'Pung of Terminals or Honours', 'No Honours', 'One Voided Suit'],
  'Four Kongs': ['Single Wait', 'Three Kongs', 'Two Melded Kongs', 'Two Concealed Kongs', 'Melded Kong', 'Concealed Kong', 'All Pungs'],
  'Seven Shifted Pairs': ['Full Flush', 'Seven Pairs', 'Concealed Hand', 'Single Wait', 'No Honours', 'One Voided Suit'],
  'Thirteen Orphans': ['All Types', 'Concealed Hand', 'Fully Concealed Hand', 'Single Wait', 'All Terminals and Honours'],
  'All Terminals': ['All Pungs', 'Outside Hand', 'Pung of Terminals or Honours', 'No Honours', 'All Terminals and Honours', 'Double Pung'],
  'Little Four Winds': ['Big Three Winds', 'Pung of Terminals or Honours'],
  'Little Three Dragons': ['Two Dragon Pungs', 'Dragon Pung'],
  'All Honours': ['All Pungs', 'Outside Hand', 'Pung of Terminals or Honours', 'All Terminals and Honours'],
  'Four Concealed Pungs': ['All Pungs', 'Three Concealed Pungs', 'Two Concealed Pungs', 'Concealed Hand'],
  'Pure Terminal Chows': ['Full Flush', 'Pure Double Chow', 'Two Terminal Chows', 'All Chows'],
  'Quadruple Chow': ['Pure Triple Chow', 'Pure Double Chow', 'Tile Hog', 'Pure Shifted Pungs'],
  'Four Pure Shifted Pungs': ['Pure Shifted Pungs', 'All Pungs'],
  'Four Pure Shifted Chows': ['Pure Shifted Chows', 'Short Straight', 'Two Terminal Chows'],
  'Three Kongs': ['Two Melded Kongs', 'Two Concealed Kongs', 'Melded Kong', 'Concealed Kong'],
  'All Terminals and Honours': ['All Pungs', 'Outside Hand', 'Pung of Terminals or Honours'],
  'Seven Pairs': ['Concealed Hand', 'Single Wait'],
  'All Even Pungs': ['All Pungs', 'All Simples', 'No Honours'],
  'Full Flush': ['No Honours', 'One Voided Suit'],
  'Pure Triple Chow': ['Pure Double Chow'],
  'Upper Tiles': ['No Honours'],
  'Middle Tiles': ['No Honours', 'All Simples'],
  'Lower Tiles': ['No Honours'],
  'Three-Suited Terminal Chows': ['All Chows', 'Two Terminal Chows', 'Mixed Double Chow', 'No Honours'],
  'All Fives': ['All Simples'],
  'Reversible Tiles': ['One Voided Suit'],
  'Last Tile Draw': ['Self-Drawn'],
  'Out with Replacement Tile': ['Self-Drawn'],
  'Melded Hand': ['Single Wait'],
  'Two Dragon Pungs': ['Dragon Pung'],
  'Fully Concealed Hand': ['Self-Drawn', 'Concealed Hand'],
  'Two Melded Kongs': ['Melded Kong'],
  'Two Concealed Kongs': ['Concealed Kong'],
  'Triple Pung': ['Double Pung'],
  'Big Three Winds': ['Pung of Terminals or Honours'],
};

type Set = { type: 'pung' | 'chow' | 'kong'; kind: number; concealed: boolean; exposed: boolean };

const suit = (k: number) => Math.floor(k / 9);
const rank = (k: number) => k % 9; // 0-based

/** Three-chow patterns, highest first: [name, fan, test on three chow kinds]. */
const TRIPLE_CHOWS: [string, number, (a: number[]) => boolean][] = [
  ['Pure Triple Chow', 24, (a) => a[0] === a[1] && a[1] === a[2]],
  ['Pure Straight', 16, (a) => suit(a[0]) === suit(a[2]) && suit(a[1]) === suit(a[0]) && rank(a[0]) === 0 && rank(a[1]) === 3 && rank(a[2]) === 6],
  ['Pure Shifted Chows', 16, (a) => suit(a[0]) === suit(a[1]) && suit(a[1]) === suit(a[2]) && ((a[1] - a[0] === 1 && a[2] - a[1] === 1) || (a[1] - a[0] === 2 && a[2] - a[1] === 2))],
  ['Mixed Straight', 8, (a) => new globalThis.Set(a.map(suit)).size === 3 && [...a].map(rank).sort().join() === '0,3,6'],
  ['Mixed Triple Chow', 8, (a) => new globalThis.Set(a.map(suit)).size === 3 && rank(a[0]) === rank(a[1]) && rank(a[1]) === rank(a[2])],
  ['Mixed Shifted Chows', 6, (a) => {
    if (new globalThis.Set(a.map(suit)).size !== 3) return false;
    const r = a.map(rank).sort((x, y) => x - y);
    return r[1] - r[0] === 1 && r[2] - r[1] === 1;
  }],
];

/** One-fan chow pairs: [name, test on two chow kinds]. */
const PAIR_CHOWS: [string, (a: number, b: number) => boolean][] = [
  ['Pure Double Chow', (a, b) => a === b],
  ['Mixed Double Chow', (a, b) => suit(a) !== suit(b) && rank(a) === rank(b)],
  ['Short Straight', (a, b) => suit(a) === suit(b) && Math.abs(a - b) === 3],
  ['Two Terminal Chows', (a, b) => suit(a) === suit(b) && ((rank(a) === 0 && rank(b) === 6) || (rank(a) === 6 && rank(b) === 0))],
];

function combos<T>(a: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (a.length < k) return [];
  const [x, ...rest] = a;
  return [...combos(rest, k - 1).map((c) => [x, ...c]), ...combos(rest, k)];
}

/** Fans from how the chows combine, choosing the best arrangement. */
function chowFans(chows: number[]): ScoreItem[] {
  let best: ScoreItem[] = [];
  const total = (xs: ScoreItem[]) => xs.reduce((a, b) => a + b.value, 0);
  const sorted = chows.slice().sort((a, b) => a - b);
  const pairUp = (free: number[], used: number[]): ScoreItem[] => {
    // Greedy "account once": each free chow pairs at most once.
    const out: ScoreItem[] = [];
    const left = free.slice();
    const partners = [...used];
    while (left.length) {
      const a = left.shift()!;
      let hit = false;
      for (const pool of [left, partners]) {
        for (let i = 0; i < pool.length && !hit; i++) {
          const f = PAIR_CHOWS.find(([, t]) => t(a, pool[i]));
          if (f) {
            out.push({ name: f[0], value: 1 });
            if (pool === left) left.splice(i, 1);
            else partners.splice(i, 1);
            hit = true;
          }
        }
        if (hit) break;
      }
    }
    return out;
  };
  // Four chows: Pure Terminal Chows, Quadruple Chow, Four Pure Shifted Chows, Three-Suited Terminal Chows.
  if (sorted.length === 4) {
    const [a, b, c, d] = sorted;
    if (a === b && b === c && c === d) return [{ name: 'Quadruple Chow', value: 48 }];
    if (suit(a) === suit(d)) {
      const s1 = b - a, s2 = c - b, s3 = d - c;
      if (s1 === s2 && s2 === s3 && (s1 === 1 || s1 === 2)) return [{ name: 'Four Pure Shifted Chows', value: 32 }];
    }
  }
  for (const k of [3, 0] as const) {
    const choices = k ? combos(sorted, 3) : [[]];
    for (const tri of choices) {
      const items: ScoreItem[] = [];
      if (k) {
        const f = TRIPLE_CHOWS.find(([, , t]) => t(tri));
        if (!f) continue;
        items.push({ name: f[0], value: f[1] });
      }
      const rest = sorted.slice();
      for (const x of tri) rest.splice(rest.indexOf(x), 1);
      items.push(...pairUp(rest, tri));
      if (total(items) > total(best)) best = items;
    }
  }
  return best;
}

/** Fans from how pungs combine across suits. */
function pungFans(pungKinds: number[]): ScoreItem[] {
  const suited = pungKinds.filter(isSuited).sort((a, b) => a - b);
  const out: ScoreItem[] = [];
  const bySuit = [0, 1, 2].map((s) => suited.filter((k) => suit(k) === s).map(rank));
  // Shifted pungs in one suit.
  for (const r of bySuit) {
    if (r.length === 4 && r[1] - r[0] === 1 && r[2] - r[1] === 1 && r[3] - r[2] === 1) out.push({ name: 'Four Pure Shifted Pungs', value: 48 });
    else if (r.length >= 3 && combos(r, 3).some((t) => t[1] - t[0] === 1 && t[2] - t[1] === 1)) out.push({ name: 'Pure Shifted Pungs', value: 24 });
  }
  // Same number in three suits, or two.
  const ranks = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const triple = ranks.find((r) => bySuit.every((s) => s.includes(r)));
  if (triple !== undefined) out.push({ name: 'Triple Pung', value: 16 });
  else {
    const doubles = ranks.filter((r) => bySuit.filter((s) => s.includes(r)).length === 2).length;
    for (let i = 0; i < doubles; i++) out.push({ name: 'Double Pung', value: 2 });
  }
  // One pung per suit, shifted.
  if (bySuit.every((s) => s.length)) {
    const found = bySuit[0].some((x) => bySuit[1].some((y) => bySuit[2].some((z) => {
      const r = [x, y, z].sort((p, q) => p - q);
      return r[1] - r[0] === 1 && r[2] - r[1] === 1;
    })));
    if (found) out.push({ name: 'Mixed Shifted Pungs', value: 8 });
  }
  return out;
}

const GREEN = new globalThis.Set([19, 20, 21, 23, 25, 32]);
const REVERSIBLE = new globalThis.Set([9, 10, 11, 12, 13, 16, 17, 19, 21, 22, 23, 25, 26, 33]);

export function mcrScore(ctx: ScoringContext): HandScore {
  const items: ScoreItem[] = [];
  const add = (name: string, value: number, note?: string) => items.push({ name, value, note });
  const d = ctx.decomposition;
  const allKinds: number[] = [];
  for (let k = 0; k < KIND_COUNT; k++) for (let i = 0; i < ctx.concealedCounts[k]; i++) allKinds.push(k);
  for (const m of ctx.melds) for (const t of m.tiles) allKinds.push(t.kind);
  const tally = new Array(KIND_COUNT).fill(0);
  for (const k of allKinds) tally[k]++;
  const suitsUsed = new globalThis.Set(allKinds.filter(isSuited).map(suit));
  const hasHonor = allKinds.some(isHonor);
  const exposed = ctx.melds.some((m) => !m.concealed);

  // Whole-hand fans (any shape)
  if (allKinds.every((k) => GREEN.has(k))) add('All Green', 88);
  if (allKinds.every(isHonor)) add('All Honours', 64);
  else if (allKinds.every(isTerminal)) add('All Terminals', 64);
  else if (allKinds.every(isTerminalOrHonor)) add('All Terminals and Honours', 32);
  if (suitsUsed.size === 1 && !hasHonor) add('Full Flush', 24);
  else if (suitsUsed.size === 1) add('Half Flush', 6);
  if (!hasHonor) {
    const r = allKinds.map(rank);
    if (r.every((x) => x >= 6)) add('Upper Tiles', 24);
    else if (r.every((x) => x >= 3 && x <= 5)) add('Middle Tiles', 24);
    else if (r.every((x) => x <= 2)) add('Lower Tiles', 24);
  }
  if (allKinds.every((k) => REVERSIBLE.has(k))) add('Reversible Tiles', 8);
  if (suitsUsed.size === 3 && allKinds.some(isWind) && allKinds.some(isDragon)) add('All Types', 6);
  if (allKinds.every((k) => !isTerminalOrHonor(k))) add('All Simples', 2);
  if (suitsUsed.size === 2) add('One Voided Suit', 1);
  if (!hasHonor) add('No Honours', 1);

  // A knitted straight hand is scored like a standard one on its other set and pair.
  const knitted = d.shape === 'special' && d.special === KNITTED_STRAIGHT ? knittedRest(ctx.concealedCounts, ctx.melds.length) : null;
  const std = d.shape === 'standard' ? d : knitted;
  if (d.shape === 'thirteenOrphans') add('Thirteen Orphans', 88);
  else if (d.shape === 'special' && d.special === HONOURS_KNITTED) {
    const honours = allKinds.filter(isHonor).length;
    if (honours === 7) add('Greater Honours and Knitted Tiles', 24);
    else add('Lesser Honours and Knitted Tiles', 12);
    if (KNITS.some((set) => set.every((k) => tally[k]))) add('Knitted Straight', 12);
  } else if (d.shape === 'sevenPairs') {
    const pairs = Array.from({ length: KIND_COUNT }, (_, k) => k).filter((k) => tally[k] >= 2);
    const shifted = pairs.length === 7 && pairs.every((k) => isSuited(k) && suit(k) === suit(pairs[0])) && pairs[6] - pairs[0] === 6;
    if (shifted) add('Seven Shifted Pairs', 88);
    else add('Seven Pairs', 24);
    for (let k = 0; k < KIND_COUNT; k++) if (tally[k] === 4) add('Tile Hog', 2);
  } else if (std) {
    if (knitted) add('Knitted Straight', 12);
    const sets: Set[] = ctx.melds.map((m) => ({ type: m.type, kind: Math.min(...m.tiles.map((t) => t.kind)), concealed: m.concealed, exposed: !m.concealed }));
    for (const s of std.sets) {
      if (s.type === 'pair') continue;
      const byDiscard = !ctx.selfDrawn && s.type === 'pung' && s.kind === ctx.winKind;
      sets.push({ type: s.type, kind: s.kind, concealed: !byDiscard, exposed: false });
    }
    const pair = std.pair;
    const pungs = sets.filter((s) => s.type !== 'chow');
    const chows = sets.filter((s) => s.type === 'chow').map((s) => s.kind);
    const kongs = sets.filter((s) => s.type === 'kong');
    const dragonP = pungs.filter((s) => isDragon(s.kind));
    const windP = pungs.filter((s) => isWind(s.kind));
    const concealedP = pungs.filter((s) => s.concealed).length;
    const meldedK = kongs.filter((s) => !s.concealed).length;
    const concealedK = kongs.filter((s) => s.concealed).length;

    // Honours
    if (windP.length === 4) add('Big Four Winds', 88);
    else if (windP.length === 3 && isWind(pair)) add('Little Four Winds', 64);
    else if (windP.length === 3) add('Big Three Winds', 12);
    if (dragonP.length === 3) add('Big Three Dragons', 88);
    else if (dragonP.length === 2 && isDragon(pair)) add('Little Three Dragons', 64);
    else if (dragonP.length === 2) add('Two Dragon Pungs', 6);
    else for (let i = 0; i < dragonP.length; i++) add('Dragon Pung', 2);
    if (pungs.some((p) => p.kind === windKind(ctx.prevailingWind))) add('Prevalent Wind', 2);
    if (pungs.some((p) => p.kind === windKind(ctx.seatWind))) add('Seat Wind', 2);
    for (const p of pungs) {
      const valueWind = p.kind === windKind(ctx.prevailingWind) || p.kind === windKind(ctx.seatWind);
      if ((isTerminal(p.kind) || isWind(p.kind)) && !valueWind) add('Pung of Terminals or Honours', 1);
    }

    // Shapes
    if (ctx.melds.length === 0 && suitsUsed.size === 1 && !hasHonor) {
      const base = [...suitsUsed][0] * 9;
      const c = ctx.concealedCounts.slice(base, base + 9);
      const need = [3, 1, 1, 1, 1, 1, 1, 1, 3];
      if (c.every((n, i) => n >= need[i])) add('Nine Gates', 88);
    }
    if (kongs.length === 4) add('Four Kongs', 88);
    else if (kongs.length === 3) add('Three Kongs', 32);
    if (concealedP === 4) add('Four Concealed Pungs', 64);
    else if (concealedP === 3) add('Three Concealed Pungs', 16);
    else if (concealedP === 2) add('Two Concealed Pungs', 2);
    if (meldedK === 2) add('Two Melded Kongs', 4);
    else if (meldedK === 1) add('Melded Kong', 1);
    if (concealedK === 2) add('Two Concealed Kongs', 8);
    else if (concealedK === 1) add('Concealed Kong', 2);
    if (pungs.length === 4) {
      if (pungs.every((p) => isSuited(p.kind) && rank(p.kind) % 2 === 1) && isSuited(pair) && rank(pair) % 2 === 1) add('All Even Pungs', 24);
      else add('All Pungs', 6);
    }
    // The knitted straight counts as three chows here.
    if (chows.length + (knitted ? 3 : 0) === 4 && isSuited(pair)) add('All Chows', 2);
    // Pure Terminal Chows: 123 123 789 789 and 55, one suit.
    const cs = chows.slice().sort((a, b) => a - b);
    if (cs.length === 4 && suit(cs[0]) === suit(cs[3]) && rank(cs[0]) === 0 && cs[1] === cs[0] && rank(cs[2]) === 6 && cs[3] === cs[2] && pair === suit(cs[0]) * 9 + 4) add('Pure Terminal Chows', 64);
    // Three-Suited Terminal Chows: 123+789 in two suits, 55 in the third.
    else if (cs.length === 4 && isSuited(pair) && rank(pair) === 4) {
      const ss = [0, 1, 2].filter((s) => s !== suit(pair));
      if (ss.every((s) => cs.includes(s * 9) && cs.includes(s * 9 + 6))) add('Three-Suited Terminal Chows', 16);
    }
    items.push(...chowFans(chows));
    items.push(...pungFans(pungs.map((p) => p.kind)));
    // Every set and the pair hold a five / a terminal or honour.
    const hasFive = (s: Set) => isSuited(s.kind) && (s.type === 'chow' ? rank(s.kind) >= 2 && rank(s.kind) <= 4 : rank(s.kind) === 4);
    if (!knitted && sets.every(hasFive) && isSuited(pair) && rank(pair) === 4) add('All Fives', 16);
    const outside = (s: Set) => (s.type === 'chow' ? rank(s.kind) === 0 || rank(s.kind) === 6 : isTerminalOrHonor(s.kind));
    if (!knitted && sets.every(outside) && isTerminalOrHonor(pair)) add('Outside Hand', 4);
    // Tile hog: all four of a kind without a kong.
    for (let k = 0; k < KIND_COUNT; k++) if (tally[k] === 4 && !kongs.some((s) => s.kind === k)) add('Tile Hog', 2);
    // Melded hand: four melded sets, won on a discard to the pair.
    if (ctx.melds.length === 4 && ctx.melds.every((m) => !m.concealed) && !ctx.selfDrawn) add('Melded Hand', 6);

    // The wait (only one tile could have won)
    const before = ctx.concealedCounts.slice();
    before[ctx.winKind]--;
    // A tile that fills the knitted straight is no edge, closed or single wait.
    const inSets = !knitted || std.pair === ctx.winKind || std.sets.some((s) => (s.type === 'chow' ? ctx.winKind >= s.kind && ctx.winKind <= s.kind + 2 : s.kind === ctx.winKind));
    if (inSets && before[ctx.winKind] >= 0 && waits(before, ctx.melds.length, SHAPES).length === 1) {
      const w = ctx.winKind;
      const inChow = std.sets.filter((s) => s.type === 'chow' && w >= s.kind && w <= s.kind + 2);
      if (pair === w) add('Single Wait', 1);
      else if (inChow.some((s) => w === s.kind + 1)) add('Closed Wait', 1);
      else if (inChow.some((s) => (rank(s.kind) === 0 && w === s.kind + 2) || (rank(s.kind) === 6 && w === s.kind))) add('Edge Wait', 1);
    }
  }

  // How the hand was won
  if (!exposed && ctx.selfDrawn) add('Fully Concealed Hand', 4);
  else if (!exposed) add('Concealed Hand', 2);
  if (ctx.lastTileOfWall) add(ctx.selfDrawn ? 'Last Tile Draw' : 'Last Tile Claim', 8);
  if (ctx.afterKong && ctx.selfDrawn) add('Out with Replacement Tile', 8);
  if (ctx.robbedKong) add('Robbing the Kong', 8);
  if (ctx.selfDrawn) add('Self-Drawn', 1);

  // Exclusions: a fan never also scores the fans it implies.
  const present = new globalThis.Set(items.map((i) => i.name));
  const dropped = new globalThis.Set<string>();
  for (const name of present) for (const x of EXCLUDES[name] ?? []) dropped.add(x);
  const kept = items.filter((i) => !dropped.has(i.name));

  let base = kept.reduce((a, b) => a + b.value, 0);
  if (base === 0) {
    kept.push({ name: 'Chicken Hand', value: 8, note: 'No other fan' });
    base = 8;
  }
  const flowers = (ctx.flowers ?? []).length;
  if (flowers) kept.push({ name: 'Flower Tiles', value: flowers, note: 'Not counted toward the minimum' });
  const min = Number(ctx.house?.minFan ?? MCR_MIN);
  return { value: base, unit: 'fan', items: kept, points: base + flowers, limit: base >= 88, qualifies: base >= min };
}

/** Everyone pays the base; a discarder (or everyone, on a self-draw) adds the hand's fan. */
export function mcrPayments(winner: number, discarder: number | null, s: HandScore, _d: number, players: number): Payment[] {
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) {
    if (p === winner) continue;
    out.push({ from: p, to: winner, amount: MCR_BASE + (discarder === null || p === discarder ? s.points : 0) });
  }
  return out;
}

export const mcrProfile: RuleProfile = {
  ...classicProfile,
  id: 'mcr',
  name: 'Chinese Official (MCR)',
  region: 'China',
  flag: '🇨🇳',
  summary: 'The formal tournament ruleset: 144 tiles, a fixed list of fan (knitted hands included), and at least eight fan to win (flowers not counted). Everyone pays an eight-point base, and the discarder adds the hand’s fan.',
  shapes: SHAPES,
  minValue: 0,
  rounds: { ...classicProfile.rounds, dealerRetention: 'never' },
  score: mcrScore,
  payments: mcrPayments,
  startingScore: 0,
  flowers: true,
  scoreUnit: 'fan',
  callNames: { chow: 'Chi', pung: 'Peng', kong: 'Gang', win: 'Hu', selfDraw: 'Zimo' },
  felt: '#3a1f1f',
  tableName: 'Beijing Lacquer',
  // Classic's flower house rule is not MCR's: MCR always plays its flowers.
  configure: undefined,
  houseRules: [
    {
      id: 'minFan',
      label: 'Minimum to win',
      options: [
        { value: '8', label: '8 fan (official)' },
        { value: '0', label: 'No minimum (practice)' },
      ],
      default: '8',
    },
    {
      id: 'dealerRetention',
      label: 'Dealer keeps the deal',
      options: [
        { value: 'never', label: 'Never (official)' },
        { value: 'onDealerWin', label: 'When dealer wins' },
      ],
      default: 'never',
    },
  ],
};
