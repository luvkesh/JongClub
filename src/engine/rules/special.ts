// Special hands of Indian and Dubai home tables: mixed sets (crochet), knits,
// passports, and the Small and Big cards of the special wind rounds.
//
//   Mixed pung   the same number once in each suit: 5 Characters, 5 Dots, 5 Bamboo
//   Mixed chow   three numbers in a row, one in each suit: 3 Characters, 4 Dots, 5 Bamboo
//   Knit         a mixed pair: the same number in two suits, 7 Dots + 7 Bamboo
//   Crochet      four mixed pungs and a knit, all concealed
//   Knitting     seven knits from two suits, all concealed
//   Passport     different honours side by side: 5 or 6 of the 7 winds and
//                dragons, or a 9-tile passport (1 to 9 of one suit by default)
//
// No rulebook fixes these; Mumbai, Kolkata and Dubai clubs each keep their
// own. The readings here are JongClub's defaults (docs/variants/special-rounds.md).
// Shapes are SpecialShapes over concealed counts, so the engine, the AI's
// shanten and the waits all see them. Card-round hands are concealed: those
// rounds allow no calls except the winning one, so meldCount is always 0.

import { KIND_COUNT, isTerminalOrHonor } from '../tiles';
import { isSevenPairs, isThirteenOrphans, setsShanten, sevenPairsShanten, thirteenOrphansShanten, type SpecialShape } from '../hand';

const HONOURS = [27, 28, 29, 30, 31, 32, 33];
const DRAGONS = [31, 32, 33];
const WINDS4 = [27, 28, 29, 30];
const ORPHANS = Array.from({ length: KIND_COUNT }, (_, k) => k).filter(isTerminalOrHonor);
const sum = (c: number[]) => c.reduce((a, b) => a + b, 0);
const kind = (suit: number, rank: number) => suit * 9 + rank;
const SUIT_PAIRS: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 2],
];
const PERMS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

/** Can these counts split into exactly `sets` sets plus (optionally) one pair? */
export function splits(c: number[], sets: number, pair: boolean, chows = true): boolean {
  let i = 0;
  while (i < KIND_COUNT && !c[i]) i++;
  if (i === KIND_COUNT) return sets === 0 && !pair;
  if (pair && c[i] >= 2) {
    c[i] -= 2;
    const ok = splits(c, sets, false, chows);
    c[i] += 2;
    if (ok) return true;
  }
  if (sets > 0 && c[i] >= 3) {
    c[i] -= 3;
    const ok = splits(c, sets - 1, pair, chows);
    c[i] += 3;
    if (ok) return true;
  }
  if (sets > 0 && chows && i < 27 && i % 9 <= 6 && c[i + 1] && c[i + 2]) {
    c[i]--, c[i + 1]--, c[i + 2]--;
    const ok = splits(c, sets - 1, pair, chows);
    c[i]++, c[i + 1]++, c[i + 2]++;
    if (ok) return true;
  }
  return false;
}

/** Remove one of each kind in `fixed` (a multiset). False (counts untouched) if one is missing. */
function take(c: number[], fixed: number[]): boolean {
  const done: number[] = [];
  for (const k of fixed) {
    if (!c[k]) {
      for (const d of done) c[d]++;
      return false;
    }
    c[k]--;
    done.push(k);
  }
  return true;
}

/** Remove what is held of `fixed`; returns how many were missing. */
function takeSome(c: number[], fixed: number[]): number {
  let missing = 0;
  for (const k of fixed) {
    if (c[k]) c[k]--;
    else missing++;
  }
  return missing;
}

// ---------------------------------------------------------------- passports

export type NinePassport = 'straight' | 'knitted' | 'orphans';
export type PassportSize = 5 | 6 | 9;

/** Every combination that fits a 14-tile hand: the rest is sets, with a pair when 2 tiles are left over. */
export const PASSPORT_COMBOS: PassportSize[][] = [[5], [6], [9], [5, 6], [6, 6], [9, 5]];
export const SINGLE_PASSPORTS: PassportSize[][] = [[5], [6], [9]];
export const DOUBLE_PASSPORTS: PassportSize[][] = [[5, 6], [6, 6], [9, 5]];

export const passportName = (combo: PassportSize[]) => (combo.length === 1 ? `Passport (${combo[0]})` : `Double Passport (${combo.join(' + ')})`);

/** The tile lists a 9-tile passport may be. */
function nineOptions(mode: NinePassport): number[][] {
  if (mode === 'straight') return [0, 1, 2].map((s) => Array.from({ length: 9 }, (_, r) => kind(s, r)));
  if (mode === 'knitted') return PERMS.map((p) => p.flatMap((s, i) => [i, i + 3, i + 6].map((r) => kind(s, r))));
  return []; // orphans: chosen from what is held (see below)
}

/** Every k-subset of `from`. */
function subsets(from: number[], k: number): number[][] {
  const out: number[][] = [];
  const pick = (i: number, cur: number[]) => {
    if (cur.length === k) return void out.push(cur.slice());
    for (let j = i; j <= from.length - (k - cur.length); j++) {
      cur.push(from[j]);
      pick(j + 1, cur);
      cur.pop();
    }
  };
  pick(0, []);
  return out;
}

/** Ways to lay down one passport from counts `c`. */
function passportChoices(c: number[], size: PassportSize, nine: NinePassport): number[][] {
  if (size === 9 && nine !== 'orphans') return nineOptions(nine).filter((f) => f.every((k) => c[k] > 0));
  const pool = size === 9 ? ORPHANS : HONOURS;
  const held = pool.filter((k) => c[k] > 0);
  return held.length < size ? [] : subsets(held, size);
}

function passportsFit(c: number[], combo: PassportSize[], nine: NinePassport, rest: (c: number[]) => boolean): boolean {
  if (!combo.length) return rest(c);
  const [first, ...more] = combo;
  for (const f of passportChoices(c, first, nine)) {
    take(c, f);
    const ok = passportsFit(c, more, nine, rest);
    for (const k of f) c[k]++;
    if (ok) return true;
  }
  return false;
}

/** Tiles still missing for a passport, taking the most useful ones out of `c` (singles first). */
function passportGreedy(c: number[], size: PassportSize, nine: NinePassport): number {
  if (size === 9 && nine !== 'orphans') {
    let best: number[] = [];
    let bestHeld = -1;
    for (const f of nineOptions(nine)) {
      const held = f.filter((k) => c[k] > 0).length;
      if (held > bestHeld) {
        bestHeld = held;
        best = f;
      }
    }
    return takeSome(c, best);
  }
  const pool = (size === 9 ? ORPHANS : HONOURS).filter((k) => c[k] > 0).sort((a, b) => c[a] - c[b]);
  const use = pool.slice(0, size);
  for (const k of use) c[k]--;
  return size - use.length;
}

/** A hand of passports plus sets (and a pair when two tiles are left over). Sets may be called. */
export function passportShape(name: string, combos: PassportSize[][], nine: NinePassport): SpecialShape {
  const layout = (combo: PassportSize[]) => {
    const r = 14 - combo.reduce((a, b) => a + b, 0);
    return { sets: Math.floor(r / 3), pair: r % 3 === 2 };
  };
  return {
    name,
    ai: true,
    complete(counts, meldCount) {
      const c = counts.slice();
      return combos.some((combo) => {
        const { sets, pair } = layout(combo);
        if (sets < meldCount) return false;
        return passportsFit(c, combo, nine, (rest) => splits(rest, sets - meldCount, pair));
      });
    },
    shanten(counts, meldCount) {
      let best = 99;
      for (const combo of combos) {
        const { sets, pair } = layout(combo);
        if (sets < meldCount) continue;
        const c = counts.slice();
        let missing = 0;
        for (const size of [...combo].sort((a, b) => b - a)) missing += passportGreedy(c, size, nine);
        best = Math.min(best, missing + setsShanten(c, meldCount, sets, pair));
      }
      return best;
    },
  };
}

/** Which passport combination a complete hand uses (the biggest that fits), for scoring. */
export function passportUsed(counts: number[], meldCount: number, combos: PassportSize[][], nine: NinePassport): PassportSize[] | null {
  const ordered = [...combos].sort((a, b) => b.length - a.length || sum(b) - sum(a));
  for (const combo of ordered) if (passportShape('', [combo], nine).complete(counts, meldCount)) return combo;
  return null;
}

// ---------------------------------------------------------------- knits and crochet

/** Seven knits (the same number in two suits), using only two suits. Concealed. */
export const KNITTING: SpecialShape = {
  name: 'Knitting',
  ai: true,
  pairs: true,
  complete(c, meldCount) {
    if (meldCount || sum(c) !== 14 || HONOURS.some((k) => c[k])) return false;
    return SUIT_PAIRS.some(([a, b]) => {
      const other = 3 - a - b;
      for (let r = 0; r < 9; r++) if (c[kind(other, r)] || c[kind(a, r)] !== c[kind(b, r)]) return false;
      return true;
    });
  },
  shanten(c, meldCount) {
    if (meldCount) return 99;
    let best = 99;
    for (const [a, b] of SUIT_PAIRS) {
      let pairs = 0;
      let singles = 0;
      for (let r = 0; r < 9; r++) {
        const x = c[kind(a, r)];
        const y = c[kind(b, r)];
        pairs += Math.min(x, y);
        singles += Math.abs(x - y);
      }
      pairs = Math.min(pairs, 7);
      best = Math.min(best, 6 - pairs + Math.max(0, 7 - pairs - singles));
    }
    return best;
  },
};

/** Four mixed pungs and a knit, concealed (Triple Knitting). */
export const CROCHET: SpecialShape = {
  name: 'Crochet',
  ai: true,
  complete(c, meldCount) {
    if (meldCount || sum(c) !== 14 || HONOURS.some((k) => c[k])) return false;
    for (let r = 0; r < 9; r++)
      for (const [a, b] of SUIT_PAIRS) {
        if (!c[kind(a, r)] || !c[kind(b, r)]) continue;
        const x = c.slice();
        x[kind(a, r)]--, x[kind(b, r)]--;
        let pungs = 0;
        let ok = true;
        for (let q = 0; q < 9 && ok; q++) {
          if (x[q] !== x[9 + q] || x[q] !== x[18 + q]) ok = false;
          pungs += x[q];
        }
        if (ok && pungs === 4) return true;
      }
    return false;
  },
  shanten(c, meldCount) {
    if (meldCount) return 99;
    // Per number: how many of the three suits are held. Best four numbers make the pungs, the next the knit.
    const have = Array.from({ length: 9 }, (_, r) => [0, 1, 2].filter((s) => c[kind(s, r)] > 0).length).sort((a, b) => b - a);
    let need = 0;
    for (let i = 0; i < 4; i++) need += 3 - have[i];
    need += 2 - Math.min(2, have[4]);
    return need - 1;
  },
};

// ---------------------------------------------------------------- mixed sets

export type MixedPiece = { type: 'pung' | 'chow' | 'mixedPung' | 'mixedChow'; kinds: number[] };
export interface MixedReading {
  sets: MixedPiece[];
  /** The pair's two kinds (equal for a plain pair, a knit otherwise). */
  pair: [number, number];
}

// Rank-major order: 1 Characters, 1 Dots, 1 Bamboo, 2 Characters... then the honours.
const ORDER = [...Array.from({ length: 27 }, (_, i) => kind(i % 3, Math.floor(i / 3))), ...HONOURS];

/** Every reading of concealed counts as `need` sets (plain or mixed) and a pair (plain or knit). */
export function mixedReadings(counts: number[], need: number, limit = 64): MixedReading[] {
  const out: MixedReading[] = [];
  const c = counts.slice();
  const sets: MixedPiece[] = [];
  let pair: [number, number] | null = null;
  const walk = (pos: number) => {
    if (out.length >= limit) return;
    while (pos < ORDER.length && !c[ORDER[pos]]) pos++;
    if (pos === ORDER.length) {
      if (sets.length === need && pair) out.push({ sets: sets.slice(), pair });
      return;
    }
    const i = ORDER[pos];
    const use = (kinds: number[], piece: MixedPiece | 'pair') => {
      if (kinds.some((k, j) => c[k] < kinds.filter((x, y) => x === k && y <= j).length)) return;
      for (const k of kinds) c[k]--;
      if (piece === 'pair') pair = [kinds[0], kinds[1]];
      else sets.push(piece);
      walk(pos);
      if (piece === 'pair') pair = null;
      else sets.pop();
      for (const k of kinds) c[k]++;
    };
    if (!pair) {
      use([i, i], 'pair');
      if (i < 27) for (let s2 = Math.floor(i / 9) + 1; s2 < 3; s2++) use([i, kind(s2, i % 9)], 'pair');
    }
    if (sets.length < need) {
      use([i, i, i], { type: 'pung', kinds: [i, i, i] });
      if (i < 27) {
        const s = Math.floor(i / 9);
        const r = i % 9;
        if (r <= 6) use([i, i + 1, i + 2], { type: 'chow', kinds: [i, i + 1, i + 2] });
        if (s === 0) use([i, kind(1, r), kind(2, r)], { type: 'mixedPung', kinds: [i, kind(1, r), kind(2, r)] });
        if (r <= 6)
          for (const p of PERMS) if (p[0] === s) use([i, kind(p[1], r + 1), kind(p[2], r + 2)], { type: 'mixedChow', kinds: [i, kind(p[1], r + 1), kind(p[2], r + 2)] });
      }
    }
  };
  walk(0);
  return out;
}

const isMixed = (r: MixedReading) => r.pair[0] !== r.pair[1] || r.sets.some((s) => s.type === 'mixedPung' || s.type === 'mixedChow');

/** Mixed-set candidates held in `c`: mixed pungs, and mixed chows starting at each number. */
function mixedCandidates(c: number[]): number[][] {
  const out: number[][] = [];
  for (let r = 0; r < 9; r++) {
    if (c[kind(0, r)] && c[kind(1, r)] && c[kind(2, r)]) out.push([kind(0, r), kind(1, r), kind(2, r)]);
    if (r <= 6) for (const p of PERMS) if (c[kind(p[0], r)] && c[kind(p[1], r + 1)] && c[kind(p[2], r + 2)]) out.push([kind(p[0], r), kind(p[1], r + 1), kind(p[2], r + 2)]);
  }
  return out;
}

/**
 * Four sets and a pair where concealed sets may be mixed pungs or mixed chows
 * and the pair may be a knit. Only counts as this shape when something mixed
 * is used (a plain hand is the standard shape). Declared melds are plain sets.
 */
export const MIXED_SETS: SpecialShape = {
  name: 'Mixed sets',
  ai: true,
  complete(counts, meldCount) {
    const need = 4 - meldCount;
    if (need < 0 || sum(counts) !== need * 3 + 2) return false;
    return mixedReadings(counts, need).some(isMixed);
  },
  shanten(counts, meldCount) {
    const key = meldCount + counts.join('');
    const hit = mixedMemo.get(key);
    if (hit !== undefined) return hit;
    // Take out one mixed set (this is the AI's inner loop; deeper searches cost
    // more than they help), then read the rest as plain sets and a pair, also trying a knit as
    // the pair at the top (only when that could beat the best so far).
    let best = 99;
    const c = counts.slice();
    const walk = (from: number, taken: number, list: number[][]) => {
      best = Math.min(best, setsShanten(c, meldCount + taken, 4, true));
      if (taken === 0 && setsShanten(c, meldCount, 4, false) < best)
        for (let r = 0; r < 9; r++)
          for (const [a, b] of SUIT_PAIRS)
            if (c[kind(a, r)] && c[kind(b, r)]) {
              c[kind(a, r)]--, c[kind(b, r)]--;
              best = Math.min(best, setsShanten(c, meldCount + taken, 4, false));
              c[kind(a, r)]++, c[kind(b, r)]++;
            }
      if (meldCount + taken >= 4 || taken >= 1) return;
      for (let i = from; i < list.length; i++) {
        if (!take(c, list[i])) continue;
        walk(i, taken + 1, list);
        for (const k of list[i]) c[k]++;
      }
    };
    walk(0, 0, mixedCandidates(c));
    if (mixedMemo.size > 50_000) mixedMemo.clear();
    mixedMemo.set(key, best);
    return best;
  },
};

const mixedMemo = new Map<string, number>();

/** The best mixed reading of a winning hand for scoring: the most mixed pungs. */
export function bestMixedReading(counts: number[], meldCount: number): MixedReading | null {
  const all = mixedReadings(counts, 4 - meldCount).filter(isMixed);
  const mp = (r: MixedReading) => r.sets.filter((s) => s.type === 'mixedPung').length;
  return all.sort((a, b) => mp(b) - mp(a))[0] ?? null;
}

// ---------------------------------------------------------------- card hands

/** A card hand made of fixed tiles plus free sets (and maybe a pair). */
interface Pattern {
  /** Alternatives: each a multiset of kinds the hand must hold. */
  fixed: number[][];
  sets: number;
  pair: boolean;
  chows?: boolean;
  /** Only these kinds may appear anywhere in the hand. */
  allowed?: (k: number) => boolean;
}

function patternShape(name: string, p: Pattern): SpecialShape {
  const chows = p.chows !== false;
  return {
    name,
    ai: true,
    complete(counts, meldCount) {
      if (meldCount) return false;
      if (p.allowed && counts.some((n, k) => n && !p.allowed!(k))) return false;
      const c = counts.slice();
      for (const f of p.fixed.length ? p.fixed : [[]]) {
        if (!take(c, f)) continue;
        const ok = splits(c, p.sets, p.pair, chows);
        for (const k of f) c[k]++;
        if (ok) return true;
      }
      return false;
    },
    shanten(counts, meldCount) {
      if (meldCount) return 99;
      const base = p.allowed ? counts.map((n, k) => (p.allowed!(k) ? n : 0)) : counts;
      let best = 99;
      for (const f of p.fixed.length ? p.fixed : [[]]) {
        const c = base.slice();
        const missing = takeSome(c, f);
        best = Math.min(best, missing + setsShanten(c, 0, p.sets, p.pair, chows));
      }
      return best;
    },
  };
}

const wrap = (name: string, s: SpecialShape): SpecialShape => ({ ...s, name });
const flushOf = (honours: boolean) => [0, 1, 2].map((s) => (k: number) => Math.floor(k / 9) === s && k < 27 || (honours && k >= 27));

export interface CardHand {
  /** Score line name (also the shape name). */
  name: string;
  value: number;
  /** One line on how to build it (translated by the guide). */
  how: string;
  /** Tiles for the guide's picture, sets split by '|'. */
  picture: string;
  shape(nine: NinePassport): SpecialShape[];
}

function anyOf(name: string, shapes: SpecialShape[]): SpecialShape {
  return {
    name,
    ai: true,
    complete: (c, m) => shapes.some((s) => s.complete(c, m)),
    shanten: (c, m) => Math.min(...shapes.map((s) => s.shanten(c, m))),
  };
}

/** South round: the Small Card. Modest special hands, 3 doubles each. */
export const SMALL_CARD: CardHand[] = [
  { name: 'Passport Hand', value: 3, how: 'One passport (5, 6 or 9 tiles) with sets and a pair', picture: 'ESWNRd|111m|234p|789s', shape: (n) => [passportShape('Passport Hand', SINGLE_PASSPORTS, n)] },
  { name: 'Knitting', value: 3, how: 'Seven knits: the same number in two suits, two suits only', picture: '1m 1p|3m 3p|4m 4p|5m 5p|6m 6p|8m 8p|9m 9p', shape: () => [KNITTING] },
  { name: 'Seven Pairs', value: 3, how: 'Seven different pairs', picture: '11m|55m|22p|88p|33s|EE|RdRd', shape: () => [{ name: 'Seven Pairs', ai: true, pairs: true, complete: (c, m) => !m && isSevenPairs(c), shanten: (c, m) => (m ? 99 : sevenPairsShanten(c)) }] },
  {
    name: 'Two Dragons',
    value: 3,
    how: 'Pungs of two dragons, plus two sets and a pair',
    picture: 'RdRdRd|GdGdGd|123m|456p|99s',
    shape: () => [patternShape('Two Dragons', { fixed: DRAGONS.map((d) => DRAGONS.filter((x) => x !== d).flatMap((x) => [x, x, x])), sets: 2, pair: true })],
  },
  {
    name: 'Three Families',
    value: 3,
    how: 'The same run in all three suits, plus a set and a pair',
    picture: '345m|345p|345s|WWW|77m',
    shape: () => [patternShape('Three Families', { fixed: Array.from({ length: 7 }, (_, r) => [0, 1, 2].flatMap((s) => [kind(s, r), kind(s, r + 1), kind(s, r + 2)])), sets: 1, pair: true })],
  },
  { name: 'Half Flush', value: 3, how: 'One suit plus winds and dragons', picture: '123s|567s|999s|NNN|GdGd', shape: () => [anyOf('Half Flush', flushOf(true).map((allowed) => patternShape('Half Flush', { fixed: [], sets: 4, pair: true, allowed })))] },
];

/** North round: the Big Card. Hard special hands, 5 doubles to the limit. */
export const BIG_CARD: CardHand[] = [
  { name: 'Crochet', value: 6, how: 'Four mixed pungs and a knit', picture: '2m 2p 2s|4m 4p 4s|6m 6p 6s|8m 8p 8s|9m 9s', shape: () => [CROCHET] },
  { name: 'Double Passport', value: 6, how: 'Two passports in one hand: 9 + 5, or 6 + 6 and a pair', picture: '123456789m|ESWNRd', shape: (n) => [passportShape('Double Passport', [[9, 5], [6, 6]], n)] },
  { name: 'Full Flush', value: 6, how: 'One suit only, no honours', picture: '111p|234p|567p|888p|99p', shape: () => [anyOf('Full Flush', flushOf(false).map((allowed) => patternShape('Full Flush', { fixed: [], sets: 4, pair: true, allowed })))] },
  {
    name: 'Small Three Dragons',
    value: 5,
    how: 'Two dragon pungs and a dragon pair, plus two sets',
    picture: 'RdRdRd|GdGdGd|WdWd|123m|456m',
    shape: () => [patternShape('Small Three Dragons', { fixed: DRAGONS.map((d) => [...DRAGONS.filter((x) => x !== d).flatMap((x) => [x, x, x]), d, d]), sets: 2, pair: false })],
  },
  {
    name: 'Small Four Winds',
    value: 6,
    how: 'Three wind pungs and a wind pair, plus a set',
    picture: 'EEE|SSS|WWW|NN|789p',
    shape: () => [patternShape('Small Four Winds', { fixed: WINDS4.map((w) => [...WINDS4.filter((x) => x !== w).flatMap((x) => [x, x, x]), w, w]), sets: 1, pair: false })],
  },
  { name: 'Heads and Tails', value: 7, how: 'Pungs of ones, nines and honours only, and a pair of them', picture: '111m|999p|111s|EEE|RdRd', shape: () => [patternShape('Heads and Tails', { fixed: [], sets: 4, pair: true, chows: false, allowed: isTerminalOrHonor })] },
  { name: 'Four Concealed Pungs', value: 8, how: 'Four pungs and a pair, all from your own draws', picture: '222m|555p|888s|SSS|WdWd', shape: () => [patternShape('Four Concealed Pungs', { fixed: [], sets: 4, pair: true, chows: false })] },
  { name: 'Thirteen Orphans', value: 8, how: 'One of every one, nine, wind and dragon, and one more of any', picture: '19m|19p|19s|ESWN|RdGdWd|Rd', shape: () => [{ name: 'Thirteen Orphans', ai: true, complete: (c, m) => !m && isThirteenOrphans(c), shanten: (c, m) => (m ? 99 : thirteenOrphansShanten(c)) }] },
];

/** The shapes of a card (one per hand, named as the hand). */
export function cardShapes(card: CardHand[], nine: NinePassport): SpecialShape[] {
  return card.map((h) => {
    const parts = h.shape(nine);
    return parts.length === 1 ? wrap(h.name, parts[0]) : anyOf(h.name, parts);
  });
}
