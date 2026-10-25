// India Rules, Round 4 (North): the 29 Big Cards, as the club rulebook lists them
// (pp. 31-40; docs/variants/india-rules.md). East picks one card for the whole table
// and everyone plays to it.
//
// A card is a list of alternatives, each a list of components: kongs, qwongs (five of
// a kind, made with a joker), runs, pungs, chows, pairs and fixed sets (NEWS, GRW, the
// corresponding dragons). Each card names its own jokers, how many of each kind a
// player may use (1 each, or all), and where they may go: never in a clean component,
// and never as a terminal the card keeps clean.
//
// Kongs, qwongs and runs are laid down on the table and earn extra tiles from the
// flower wall (a kong 1, a qwong 2, a run 1, unless the card says otherwise), so a
// finished hand holds 14 tiles plus those extras. Flowers are bonus tiles, jokers or,
// on three cards, the "0" that makes 6-7-8-9-1-0.
//
// Readings where the book is silent are marked [reading] and listed in the spec.

import type { HandScore } from './types';

export type GroupType = 'kong' | 'qwong' | 'run' | 'pung' | 'chow' | 'pair' | 'set';
/** All flowers and seasons count as one kind here. */
export const FL = 34;
export const BUCKETS = 35;

export interface BComp {
  id: string;
  type: GroupType;
  /** Each option's kinds, sorted. */
  opts: number[][];
  /** Jokers may fill it. */
  jok: boolean;
  /** Kinds that must be natural even when jokers may fill the rest (terminals in runs). */
  nat?: number[];
}
export interface JokerRule {
  kinds: number[];
  /** How many of each kind one player may use as jokers (4 = all). */
  cap: number;
}
export interface BEnv {
  A: number;
  B: number;
  C: number;
  /** Your own wind (a kind). */
  seat: number;
  /** The joker number you chose (cards that let each player pick one). */
  n: number;
  /** Numbers a pair may not be (Same Number Kongs: another player's exposed kong). */
  ban: number[];
}
export interface BigCard {
  n: number;
  name: string;
  how: string;
  jokersText: string;
  picture: string;
  flowers: 'bonus' | 'joker' | 'tile';
  extras: { kong: number; qwong: number; run: number };
  /** Suit letters used: their permutations are tried. */
  suits: number;
  /** The joker numbers a player may choose (secretly). */
  numbers?: number[];
  alts(e: BEnv): BComp[][];
  jokers(e: BEnv): JokerRule[];
}

/** A laid-down group as the checker sees it: what each tile stands for, and its jokers. */
export interface MInfo {
  type: GroupType;
  as: number[];
  jokers: { kind: number; as: number }[];
}

// ------------------------------------------------------------ tiles

const t = (s: number, n: number) => s * 9 + n - 1;
const E = 27, S = 28, W = 29, N = 30, RD = 31, GD = 32, WD = 33;
const NEWS = [E, S, W, N];
const GRW = [GD, RD, WD];
/** Corresponding dragons: Cracks Red, Rings White, Bamboos Green. */
export const CD = [RD, WD, GD];
const nums = (s: number, ns: number[]) => ns.map((n) => t(s, n));
const minors = (s: number) => nums(s, [2, 3, 4, 5, 6, 7, 8]);
const terms = (s: number) => nums(s, [1, 9]);
const odds = (s: number) => nums(s, [1, 3, 5, 7, 9]);
const odd357 = (s: number) => nums(s, [3, 5, 7]);
const evens = (s: number) => nums(s, [2, 4, 6, 8]);
const SUITS = [0, 1, 2];
const allOf = (f: (s: number) => number[]) => SUITS.flatMap(f);
const SUITED = allOf((s) => nums(s, [1, 2, 3, 4, 5, 6, 7, 8, 9]));
const ALL = [...SUITED, ...NEWS, ...GRW];
const MAJORS = [...allOf(terms), ...NEWS, ...GRW];
const ALL_TERMS = allOf(terms);
const UPB = nums(2, [2, 4, 5, 6, 8, 9]);
const UPR = nums(1, [1, 2, 3, 4, 5, 8, 9]);
const UP = [...UPB, ...UPR];
const seq = (s: number, ns: number[]) => ns.map((n) => (n === 0 ? FL : t(s, n)));

// ------------------------------------------------------------ components

const C = (type: GroupType, opts: number[][], jok: boolean, nat?: number[]): BComp => {
  const o = opts.map((x) => x.slice().sort((a, b) => a - b));
  return { id: `${type}:${jok ? 1 : 0}:${o.map((x) => x.join('.')).join('|')}`, type, opts: o, jok, nat };
};
const kong = (kinds: number[], jok = true) => C('kong', kinds.map((k) => [k, k, k, k]), jok);
const qwong = (kinds: number[], jok = true) => C('qwong', kinds.map((k) => [k, k, k, k, k]), jok);
const pair = (kinds: number[]) => C('pair', kinds.map((k) => [k, k]), false);
const pung = (kinds: number[]) => C('pung', kinds.map((k) => [k, k, k]), false);
const set = (tiles: number[], jok: boolean, nat?: number[]) => C('set', [tiles], jok, nat);
const one = (kinds: number[], jok = false) => C('set', kinds.map((k) => [k]), jok);
const run = (tiles: number[], jok: boolean) => C('run', [tiles], jok, jok ? ALL_TERMS : undefined);
const CHOWS = SUITS.flatMap((s) => [1, 2, 3, 4, 5, 6, 7].map((n) => nums(s, [n, n + 1, n + 2])));
const rep = <T>(n: number, x: T) => Array.from({ length: n }, () => x);
const each = (kinds: number[], cap = 1): JokerRule => ({ kinds, cap });
const FLOWER_JOKERS: JokerRule = { kinds: [FL], cap: 99 };
const STD = { kong: 1, qwong: 2, run: 1 };

// ------------------------------------------------------------ the 29 cards

export const BIG_CARDS: BigCard[] = [
  {
    n: 1,
    name: 'Breaking News',
    how: 'Kongs of minors (2 to 8) in two different suits, a clean minor pair of the third suit, the two clean corresponding dragons, and NEWS',
    jokersText: 'All 1s and 9s of the third suit, in the kongs and NEWS',
    picture: '5555p 8888s 33m Wd Gd ESWN',
    flowers: 'bonus',
    extras: STD,
    suits: 3,
    alts: (e) => [[kong(minors(e.A)), kong(minors(e.B)), pair(minors(e.C)), set([CD[e.A], CD[e.B]], false), set(NEWS, true)]],
    jokers: (e) => [each(terms(e.C), 4)],
  },
  {
    n: 2,
    name: 'Terminal Chows',
    how: 'Three runs of 1 to 4, or three of 6 to 9, in any suits, a corresponding dragon for each run, and a clean pair of the other terminal in any suit',
    jokersText: 'One of your own wind and one 5 of each suit',
    picture: '6789s 6789s 6789m Gd Gd Rd 11p',
    flowers: 'bonus',
    extras: STD,
    suits: 0,
    alts: () => {
      const out: BComp[][] = [];
      for (const [lo, other] of [
        [1, 9],
        [6, 1],
      ])
        for (let a = 0; a < 3; a++)
          for (let b = a; b < 3; b++)
            for (let c = b; c < 3; c++) {
              const r = (s: number) => C('run', [seq(s, [lo, lo + 1, lo + 2, lo + 3])], true);
              out.push([r(a), r(b), r(c), set([CD[a], CD[b], CD[c]], true), pair(nums(0, [other]).concat(nums(1, [other]), nums(2, [other])))]);
            }
      return out;
    },
    jokers: (e) => [each([e.seat, t(0, 5), t(1, 5), t(2, 5)])],
  },
  {
    n: 3,
    name: 'Ulta Pulta 3 Kongs',
    how: 'Three Ulta Pulta kongs (Bamboos 2, 4, 5, 6, 8, 9 and Rings 1, 2, 3, 4, 5, 8, 9), a corresponding dragon for each kong, and a clean Ulta Pulta pair',
    jokersText: '1 and 9 of Cracks, Red dragon, 1 of Bamboos and NEWS, one each, in the kongs and dragons',
    picture: '2222s 5555s 8888p Gd Gd Wd 99s',
    flowers: 'bonus',
    extras: STD,
    suits: 0,
    alts: () => [0, 1, 2, 3].map((b) => [...rep(b, kong(UPB)), ...rep(3 - b, kong(UPR)), set([...rep(b, GD), ...rep(3 - b, WD)], true), pair(UP)]),
    jokers: () => [each([t(0, 1), t(0, 9), RD, t(2, 1), ...NEWS])],
  },
  {
    n: 4,
    name: 'Same Number Kongs',
    how: 'Kongs of the same number in all three suits, GRW, and a clean pair. The pair may not be the number of another player’s exposed kong',
    jokersText: 'NEWS, one each, in the kongs and dragons, never the pair',
    picture: '6666m 6666p 6666s GdRdWd 22p',
    flowers: 'bonus',
    extras: STD,
    suits: 0,
    alts: (e) => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [kong([t(0, n)]), kong([t(1, n)]), kong([t(2, n)]), set(GRW, true), pair(ALL.filter((k) => k >= 27 || !e.ban.includes((k % 9) + 1)))]),
    jokers: () => [each(NEWS)],
  },
  {
    n: 5,
    name: 'Odd / Even Kongs',
    how: 'Three odd kongs or three even kongs in three different suits, GRW, and a clean pair, odd or even to match',
    jokersText: 'NEWS, one each, in the kongs and dragons, never the pair',
    picture: '2222m 6666p 8888s GdRdWd 44m',
    flowers: 'bonus',
    extras: STD,
    suits: 0,
    alts: () => [odds, evens].map((f) => [kong(f(0)), kong(f(1)), kong(f(2)), set(GRW, true), pair(allOf(f))]),
    jokers: () => [each(NEWS)],
  },
  {
    n: 6,
    name: 'T.O.E. 2',
    how: 'A terminal kong, an odd kong (3, 5 or 7) and an even kong in three different suits, GRW, and a clean minor pair',
    jokersText: 'NEWS, one each, in the kongs and dragons, never the pair',
    picture: '1111m 5555p 8888s GdRdWd 33s',
    flowers: 'bonus',
    extras: STD,
    suits: 3,
    alts: (e) => [[kong(terms(e.A)), kong(odd357(e.B)), kong(evens(e.C)), set(GRW, true), pair(allOf(minors))]],
    jokers: () => [each(NEWS)],
  },
  {
    n: 7,
    name: 'Sequential Kongs',
    how: 'Kongs of three numbers in a row, each in a different suit, GRW, and a clean pair',
    jokersText: 'NEWS, one each, in the kongs and dragons, never the pair',
    picture: '3333m 4444p 5555s GdRdWd 99m',
    flowers: 'bonus',
    extras: STD,
    suits: 3,
    alts: (e) => [1, 2, 3, 4, 5, 6, 7].map((n) => [kong([t(e.A, n)]), kong([t(e.B, n + 1)]), kong([t(e.C, n + 2)]), set(GRW, true), pair(ALL)]),
    jokers: () => [each(NEWS)],
  },
  {
    n: 8,
    name: 'Major Konging',
    how: 'Four kongs of terminals and honours, and a clean pair of a terminal or honour',
    jokersText: 'A minor number you choose in secret: all of it, in all suits, in the kongs only',
    picture: '1111m 9999s EEEE RdRdRdRd 11p',
    flowers: 'bonus',
    extras: STD,
    suits: 0,
    numbers: [2, 3, 4, 5, 6, 7, 8],
    alts: () => [[...rep(4, kong(MAJORS)), pair(MAJORS)]],
    jokers: (e) => [each([t(0, e.n), t(1, e.n), t(2, e.n)], 4)],
  },
  {
    n: 9,
    name: 'E&W / N&S',
    how: 'Kongs of the 1s and the 9s of one suit, a clean pair of its corresponding dragon, and kongs of East and West, or North and South',
    jokersText: 'A minor number you choose in secret (all of it, in all suits) and the flowers and seasons, in the kongs only',
    picture: '1111p 9999p WdWd EEEE WWWW',
    flowers: 'joker',
    extras: STD,
    suits: 1,
    numbers: [2, 3, 4, 5, 6, 7, 8],
    alts: (e) => [
      [kong([t(e.A, 1)]), kong([t(e.A, 9)]), pair([CD[e.A]]), kong([E]), kong([W])],
      [kong([t(e.A, 1)]), kong([t(e.A, 9)]), pair([CD[e.A]]), kong([N]), kong([S])],
    ],
    jokers: (e) => [each([t(0, e.n), t(1, e.n), t(2, e.n)], 4), FLOWER_JOKERS],
  },
  {
    n: 10,
    name: 'Quad Kongs',
    how: 'Four kongs and a clean pair, suits only',
    jokersText: 'One of your own wind, and Green, Red and White, one each',
    picture: '2222m 5555p 7777s 9999s 44m',
    flowers: 'bonus',
    extras: STD,
    suits: 0,
    alts: () => [[...rep(4, kong(SUITED)), pair(SUITED)]],
    jokers: (e) => [each([e.seat, ...GRW])],
  },
  {
    n: 11,
    name: 'Twin Kongs',
    how: 'Two minor kongs in each of two suits, and a clean knit of their corresponding dragons',
    jokersText: '1 and 9 of the third suit and NEWS, one each, in the kongs',
    picture: '2222s 6666s 3333p 7777p Gd Wd',
    flowers: 'bonus',
    extras: STD,
    suits: 3,
    alts: (e) => [[...rep(2, kong(minors(e.A))), ...rep(2, kong(minors(e.B))), set([CD[e.A], CD[e.B]], false)]],
    jokers: (e) => [each([...terms(e.C), ...NEWS])],
  },
  {
    n: 12,
    name: 'Triple Kongs',
    how: 'Three minor kongs in one suit, a kong of its corresponding dragon, and a clean pair of any wind',
    jokersText: 'The 1s and 9s of the other two suits, one each, in the kongs',
    picture: '2222m 5555m 8888m RdRdRdRd EE',
    flowers: 'bonus',
    extras: STD,
    suits: 3,
    alts: (e) => [[...rep(3, kong(minors(e.A))), kong([CD[e.A]]), pair(NEWS)]],
    jokers: (e) => [each([...terms(e.B), ...terms(e.C)])],
  },
  {
    n: 13,
    name: 'King Kong',
    how: 'Two minor kongs and a clean minor pair in one suit, a kong of its corresponding dragon, and a kong of any wind',
    jokersText: 'The 1s and 9s of the other two suits, one each, in the kongs',
    picture: '3333s 6666s 88s GdGdGdGd NNNN',
    flowers: 'bonus',
    extras: STD,
    suits: 3,
    alts: (e) => [[...rep(2, kong(minors(e.A))), pair(minors(e.A)), kong([CD[e.A]]), kong(NEWS)]],
    jokers: (e) => [each([...terms(e.B), ...terms(e.C)])],
  },
  {
    n: 14,
    name: 'Royal Odds',
    how: 'A terminal kong, an odd kong and a clean odd pair (a terminal pair too) in one suit, a kong of its corresponding dragon, and a kong of any wind',
    jokersText: '2, 4, 6 and 8 of the other two suits, one each, in the kongs',
    picture: '1111p 5555p 77p WdWdWdWd SSSS',
    flowers: 'bonus',
    extras: STD,
    suits: 3,
    alts: (e) => [[kong(terms(e.A)), kong(odd357(e.A)), pair(odds(e.A)), kong([CD[e.A]]), kong(NEWS)]],
    jokers: (e) => [each([...evens(e.B), ...evens(e.C)])],
  },
  {
    n: 15,
    name: 'Royal Odd Kongs',
    how: 'Three odd kongs in one suit, a kong of its corresponding dragon, and a clean pair of any wind',
    jokersText: '2, 4, 6 and 8 of the other two suits, one each, in the kongs',
    picture: '1111m 5555m 9999m RdRdRdRd WW',
    flowers: 'bonus',
    extras: STD,
    suits: 3,
    alts: (e) => [[...rep(3, kong(odds(e.A))), kong([CD[e.A]]), pair(NEWS)]],
    jokers: (e) => [each([...evens(e.B), ...evens(e.C)])],
  },
  {
    n: 16,
    name: 'Royal Even Kongs',
    how: 'Two even kongs and a clean even pair in one suit, a kong of its corresponding dragon, and a kong of any wind',
    jokersText: '1, 3, 5, 7 and 9 of the other two suits, one each, in the kongs',
    picture: '2222s 6666s 88s GdGdGdGd EEEE',
    flowers: 'bonus',
    extras: STD,
    suits: 3,
    alts: (e) => [[...rep(2, kong(evens(e.A))), pair(evens(e.A)), kong([CD[e.A]]), kong(NEWS)]],
    jokers: (e) => [each([...odds(e.B), ...odds(e.C)])],
  },
  {
    n: 17,
    name: 'Royal Konging',
    how: 'A minor kong in each of two suits, kongs of their two corresponding dragons, and a clean minor pair in the third suit',
    jokersText: 'All 1s and 9s of the third suit, and NEWS one each, in the kongs',
    picture: '4444s 7777p GdGdGdGd WdWdWdWd 55m',
    flowers: 'bonus',
    extras: STD,
    suits: 3,
    alts: (e) => [[kong(minors(e.A)), kong(minors(e.B)), kong([CD[e.A]]), kong([CD[e.B]]), pair(minors(e.C))]],
    jokers: (e) => [each(terms(e.C), 4), each(NEWS)],
  },
  {
    n: 18,
    name: 'T.O.E.',
    how: 'A terminal kong, an odd kong (3, 5 or 7), an even kong and a clean minor pair, all in one suit, and a kong of its corresponding dragon',
    jokersText: 'NEWS one each, and the flowers and seasons, in the kongs',
    picture: '9999m 3333m 6666m 22m RdRdRdRd',
    flowers: 'joker',
    extras: STD,
    suits: 1,
    alts: (e) => [[kong(terms(e.A)), kong(odd357(e.A)), kong(evens(e.A)), pair(minors(e.A)), kong([CD[e.A]])]],
    jokers: () => [each(NEWS), FLOWER_JOKERS],
  },
  {
    n: 19,
    name: 'Ulta Pulta',
    how: 'Four kongs and a clean pair, all Ulta Pulta tiles (Bamboos 2, 4, 5, 6, 8, 9, Rings 1, 2, 3, 4, 5, 8, 9 and the White dragon)',
    jokersText: '1 and 9 of Cracks, Red dragon, 1 of Bamboos and NEWS, one each, in the kongs',
    picture: '4444s 8888s 3333p WdWdWdWd 55p',
    flowers: 'bonus',
    extras: STD,
    suits: 0,
    alts: () => [[...rep(4, kong([...UP, WD])), pair([...UP, WD])]],
    jokers: () => [each([t(0, 1), t(0, 9), RD, t(2, 1), ...NEWS])],
  },
  {
    n: 20,
    name: 'Kong Types',
    how: 'An Ulta Pulta kong, a terminal kong, a kong of the corresponding dragon of either, a kong of any wind, and a clean pair of 3 or 7 of Bamboos or 6 or 7 of Rings',
    jokersText: '2 to 8 of Cracks, one each, in the kongs',
    picture: '5555p 9999m RdRdRdRd NNNN 77s',
    flowers: 'bonus',
    extras: STD,
    suits: 0,
    alts: () => {
      const out: BComp[][] = [];
      for (const u of [2, 1])
        for (const s of SUITS)
          for (const d of new Set([CD[u], CD[s]])) out.push([kong(u === 2 ? UPB : UPR), kong(terms(s)), kong([d]), kong(NEWS), pair([t(2, 3), t(2, 7), t(1, 6), t(1, 7)])]);
      return out;
    },
    jokers: () => [each(nums(0, [2, 3, 4, 5, 6, 7, 8]))],
  },
  {
    n: 21,
    name: 'Spiraling Sequences',
    how: '1 to 6 in one suit, 6-7-8-9-1 and a flower or season (the 0) in a second suit, their two corresponding dragons, and a clean pair of 1s or 9s in the third suit',
    jokersText: 'NEWS, one each, in the runs (never a 1 or 9) and the dragons',
    picture: '123456m 67891p F1 Rd Wd 99s',
    flowers: 'tile',
    extras: STD,
    suits: 3,
    alts: (e) => [[run(seq(e.A, [1, 2, 3, 4, 5, 6]), true), run(seq(e.B, [6, 7, 8, 9, 1, 0]), true), set([CD[e.A], CD[e.B]], true), pair(terms(e.C))]],
    jokers: () => [each(NEWS)],
  },
  {
    n: 22,
    name: 'Terminal Kong',
    how: '1 to 5 in one suit, 5 to 9 in another, a terminal kong in the third suit, and a clean GRW',
    jokersText: 'NEWS, one each, in the runs (never a 1 or 9) and the kong',
    picture: '12345p 56789s 1111m GdRdWd',
    flowers: 'bonus',
    extras: STD,
    suits: 3,
    alts: (e) => [[run(seq(e.A, [1, 2, 3, 4, 5]), true), run(seq(e.B, [5, 6, 7, 8, 9]), true), kong(terms(e.C)), set(GRW, false)]],
    jokers: () => [each(NEWS)],
  },
  {
    n: 23,
    name: '56',
    how: '1-1-2-3-4-5, a clean 5-6 and 6-7-8-9-1 with a flower or season (the 0), in three different suits or all in one suit, and the two clean corresponding dragons of the runs',
    jokersText: 'NEWS, one each, in the runs (never a 1 or 9)',
    picture: '112345m 56s 67891p F1 Rd Wd',
    flowers: 'tile',
    extras: STD,
    suits: 3,
    alts: (e) => [
      [run(seq(e.A, [1, 1, 2, 3, 4, 5]), true), set(seq(e.B, [5, 6]), false), run(seq(e.C, [6, 7, 8, 9, 1, 0]), true), set([CD[e.A], CD[e.C]], false)],
      [run(seq(e.A, [1, 1, 2, 3, 4, 5]), true), set(seq(e.A, [5, 6]), false), run(seq(e.A, [6, 7, 8, 9, 1, 0]), true), set([CD[e.A], CD[e.A]], false)],
    ],
    jokers: () => [each(NEWS)],
  },
  {
    n: 24,
    name: 'Snakemix',
    how: '1-1-4-7 of Bamboos, 2-5-8 of Cracks, 3-6-9 of Rings, a 1 of any suit, a flower or season, and a clean GRW',
    jokersText: 'NEWS, one each, in the sequences (never a 1 or 9, never GRW)',
    picture: '1147s 258m 369p 1m F1 GdRdWd',
    flowers: 'tile',
    extras: STD,
    suits: 0,
    alts: () => [[run(nums(2, [1, 1, 4, 7]), true), set(nums(0, [2, 5, 8]), true, ALL_TERMS), set(nums(1, [3, 6, 9]), true, ALL_TERMS), one(nums(0, [1]).concat(nums(1, [1]), nums(2, [1]))), one([FL]), set(GRW, false)]],
    jokers: () => [each(NEWS)],
  },
  {
    n: 25,
    name: 'Royal Snake',
    how: 'A clean 1-1-2-3-4-5-6-7-8-9 in one suit, a kong of its corresponding dragon and a clean pair of any wind, or a kong of any wind and a clean pair of the dragon',
    jokersText: 'Flowers and seasons, in the kong only',
    picture: '1123456789s GdGdGdGd EE',
    flowers: 'joker',
    extras: STD,
    suits: 1,
    alts: (e) => [
      [run(seq(e.A, [1, 1, 2, 3, 4, 5, 6, 7, 8, 9]), false), kong([CD[e.A]]), pair(NEWS)],
      [run(seq(e.A, [1, 1, 2, 3, 4, 5, 6, 7, 8, 9]), false), kong(NEWS), pair([CD[e.A]])],
    ],
    jokers: () => [FLOWER_JOKERS],
  },
  {
    n: 26,
    name: 'Qwong Kong',
    how: 'A qwong, a kong, a clean pung, a clean chow and a clean pair, of any suits, winds or dragons',
    jokersText: 'Flowers and seasons, in the qwong and the kong',
    picture: '33333s RdRdRdRd 777p 456m EE',
    flowers: 'joker',
    extras: STD,
    suits: 0,
    alts: () => [[qwong(ALL), kong(ALL), pung(ALL), C('chow', CHOWS, false), pair(ALL)]],
    jokers: () => [FLOWER_JOKERS],
  },
  {
    n: 27,
    name: 'Qwongitty Kong',
    how: 'Two qwongs, a clean kong and a clean pair, of any suits, winds or dragons. A qwong takes 1 extra tile, the kong none',
    jokersText: 'Flowers and seasons, in the qwongs only',
    picture: '55555m WWWWW 2222p 99s',
    flowers: 'joker',
    extras: { kong: 0, qwong: 1, run: 1 },
    suits: 0,
    alts: () => [[...rep(2, qwong(ALL)), kong(ALL, false), pair(ALL)]],
    jokers: () => [FLOWER_JOKERS],
  },
  {
    n: 28,
    name: 'Royal Qwongs',
    how: 'A terminal qwong, a qwong of the corresponding dragon or your own wind, a clean even kong and a clean even pair, all in one suit. A qwong takes 1 extra tile, the kong none',
    jokersText: 'Your choice of 3, 5 or 7, one of each suit, and the flowers and seasons, in the qwongs only',
    picture: '99999s GdGdGdGdGd 4444s 88s',
    flowers: 'joker',
    extras: { kong: 0, qwong: 1, run: 1 },
    suits: 1,
    numbers: [3, 5, 7],
    alts: (e) => [[qwong(terms(e.A)), qwong([CD[e.A], e.seat]), kong(evens(e.A), false), pair(evens(e.A))]],
    jokers: (e) => [each([t(0, e.n), t(1, e.n), t(2, e.n)]), FLOWER_JOKERS],
  },
  {
    n: 29,
    name: 'Ulta Pulta Qwongs',
    how: 'Two Ulta Pulta qwongs, a kong of a corresponding dragon of their suits, a kong of any wind, and a clean Ulta Pulta pair',
    jokersText: '1 of Bamboos, Red dragon, 1 and 9 of Cracks (one each), and the flowers and seasons, in the qwongs and kongs',
    picture: '44444s 22222p GdGdGdGd SSSS 88s',
    flowers: 'joker',
    extras: STD,
    suits: 0,
    alts: () =>
      [2, 1, 0].map((b) => [...rep(b, qwong(UPB)), ...rep(2 - b, qwong(UPR)), kong(b === 2 ? [GD] : b === 0 ? [WD] : [GD, WD]), kong(NEWS), pair(UP)]),
    jokers: () => [each([t(2, 1), RD, t(0, 1), t(0, 9)]), FLOWER_JOKERS],
  },
];

export const bigCardByNumber = (n: number) => BIG_CARDS.find((c) => c.n === n);

// ------------------------------------------------------------ envs

const PERMS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

export interface BigCtx {
  /** Your seat wind as a kind (27..30). */
  seat: number;
  /** Numbers of other players' exposed kongs. */
  ban?: number[];
}

/** Every way of reading the card's letters and numbers for this player. */
export function bigEnvs(card: BigCard, ctx: BigCtx): BEnv[] {
  const perms = card.suits === 0 ? [PERMS[0]] : card.suits === 1 ? [PERMS[0], PERMS[2], PERMS[4]] : PERMS;
  const ns = card.numbers ?? [0];
  const out: BEnv[] = [];
  for (const p of perms) for (const n of ns) out.push({ A: p[0], B: p[1], C: p[2], seat: ctx.seat, n, ban: ctx.ban ?? [] });
  return out;
}

const capsOf = (rules: JokerRule[]) => {
  const m = new Map<number, number>();
  for (const r of rules) for (const k of r.kinds) m.set(k, Math.max(m.get(k) ?? 0, r.cap));
  return m;
};

const sameKinds = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Does a laid-down group fill this component exactly? */
function meldFits(m: MInfo, c: BComp): boolean {
  if (m.type !== c.type) return false;
  if (m.jokers.length && !c.jok) return false;
  if (c.nat && m.jokers.some((j) => c.nat!.includes(j.as))) return false;
  return c.opts.some((o) => sameKinds(o, m.as));
}

/** Kinds this group needs from the declaration types that earn extras. */
const needsMeld = (c: BComp, card: BigCard) => (c.type === 'kong' || c.type === 'qwong' || c.type === 'run') && card.extras[c.type] > 0;

const sizeOf = (comps: BComp[]) => comps.reduce((a, c) => a + c.opts[0].length, 0);

/** Exact cover: the hand (counts by bucket) and the laid-down groups make this alternative. */
function exact(card: BigCard, comps: BComp[], counts: number[], melds: MInfo[], caps: Map<number, number>): boolean {
  const capRem = new Map(caps);
  for (const m of melds)
    for (const j of m.jokers) {
      const c = capRem.get(j.kind);
      if (c === undefined || c <= 0) return false;
      capRem.set(j.kind, c - 1);
    }
  const total = counts.reduce((a, b) => a + b, 0) + melds.reduce((a, m) => a + m.as.length, 0);
  if (total !== sizeOf(comps)) return false;
  const used = comps.map(() => false);
  const H = counts.slice();
  const fill = (i: number, prevOpt: number): boolean => {
    while (i < comps.length && used[i]) i++;
    if (i === comps.length) return H.every((x) => x === 0);
    const c = comps[i];
    if (needsMeld(c, card)) return false;
    let p = i - 1;
    while (p >= 0 && used[p]) p--;
    const start = p >= 0 && comps[p].id === c.id ? prevOpt : 0;
    for (let o = start; o < c.opts.length; o++) {
      const opt = c.opts[o];
      if (take(c, opt, 0, () => fill(i + 1, o))) return true;
    }
    return false;
  };
  const take = (c: BComp, opt: number[], p: number, cont: () => boolean): boolean => {
    if (p === opt.length) return cont();
    const k = opt[p];
    if (H[k] > 0) {
      H[k]--;
      const r = take(c, opt, p + 1, cont);
      H[k]++;
      if (r) return true;
      // A natural of a joker kind may still be wanted as a joker elsewhere; other naturals are spent first.
      if (!capRem.has(k)) return false;
    }
    if (!c.jok || c.nat?.includes(k)) return false;
    for (const [j, left] of capRem) {
      if (left <= 0 || H[j] <= 0 || j === k) continue;
      H[j]--;
      capRem.set(j, left - 1);
      const r = take(c, opt, p + 1, cont);
      H[j]++;
      capRem.set(j, left);
      if (r) return true;
    }
    return false;
  };
  const assign = (mi: number): boolean => {
    if (mi === melds.length) return fill(0, 0);
    for (let i = 0; i < comps.length; i++) {
      if (used[i] || !meldFits(melds[mi], comps[i])) continue;
      used[i] = true;
      if (assign(mi + 1)) return true;
      used[i] = false;
    }
    return false;
  };
  return assign(0);
}

/** Counts by bucket (flowers together) of these kinds. */
export function bucketCounts(kinds: number[]): number[] {
  const c = new Array(BUCKETS).fill(0);
  for (const k of kinds) c[k >= 34 ? FL : k]++;
  return c;
}

/** Is this a finished hand for the card? */
export function bigComplete(card: BigCard, handKinds: number[], melds: MInfo[], ctx: BigCtx): boolean {
  const counts = bucketCounts(handKinds);
  for (const e of bigEnvs(card, ctx)) {
    const caps = capsOf(card.jokers(e));
    for (const comps of card.alts(e)) if (exact(card, comps, counts, melds, caps)) return true;
  }
  return false;
}

/** A finished hand, also when a tile from the hand takes a joker's place in a laid-down group
 *  and the joker comes back to play (the club lets a drawn or bought tile swap for a joker,
 *  and a discard do so to go Mahjong). */
export function bigWins(card: BigCard, handKinds: number[], melds: MInfo[], ctx: BigCtx): boolean {
  if (bigComplete(card, handKinds, melds, ctx)) return true;
  for (let i = 0; i < melds.length; i++)
    for (let j = 0; j < melds[i].jokers.length; j++) {
      const jk = melds[i].jokers[j];
      const at = handKinds.findIndex((k) => (k >= 34 ? FL : k) === jk.as);
      if (at < 0) continue;
      const hand = handKinds.slice();
      hand.splice(at, 1, jk.kind);
      const ms = melds.slice();
      ms[i] = { ...melds[i], jokers: melds[i].jokers.filter((_, x) => x !== j) };
      if (bigComplete(card, hand, ms, ctx)) return true;
    }
  return false;
}

// ------------------------------------------------------------ distance (the AI's measure)

/** Tiles still missing for the nearest reading of the card (0 = finished). */
export function bigDistance(card: BigCard, handKinds: number[], melds: MInfo[], ctx: BigCtx, beam = 3): number {
  const counts = bucketCounts(handKinds);
  let best = 99;
  for (const e of bigEnvs(card, ctx)) {
    const caps = capsOf(card.jokers(e));
    for (const comps of card.alts(e)) best = Math.min(best, need(comps, counts, melds, caps, best, beam));
  }
  return best;
}

function need(comps: BComp[], counts: number[], melds: MInfo[], caps: Map<number, number>, budget: number, beam: number): number {
  const capRem = new Map(caps);
  for (const m of melds)
    for (const j of m.jokers) {
      const c = capRem.get(j.kind);
      if (c === undefined || c <= 0) return 99;
      capRem.set(j.kind, c - 1);
    }
  // Joker kinds the alternative never uses as themselves count as jokers; others stay natural.
  const H = counts.slice();
  const usedKinds = new Set<number>();
  for (const c of comps) for (const o of c.opts) for (const k of o) usedKinds.add(k);
  let J = 0;
  for (const [j, cap] of capRem)
    if (!usedKinds.has(j)) {
      const n = Math.min(H[j], cap);
      J += n;
      H[j] -= n;
    }
  let best = budget;
  const used = comps.map(() => false);
  // Melds: each sits in a component it fits or can grow into (a pung into a kong or qwong).
  const assign = (mi: number, strict: number, soft: number) => {
    if (mi === melds.length) return fill(0, 0, strict, soft);
    const m = melds[mi];
    for (let i = 0; i < comps.length; i++) {
      if (used[i]) continue;
      const c = comps[i];
      const grow = c.type === m.type || (m.type === 'pung' && (c.type === 'kong' || c.type === 'qwong')) || (m.type === 'kong' && c.type === 'qwong');
      if (!grow || (m.jokers.length && !c.jok)) continue;
      for (const o of c.opts) {
        // The meld's tiles must all be in the option.
        const rest = o.slice();
        let ok = true;
        for (const k of m.as) {
          const x = rest.indexOf(k);
          if (x < 0) {
            ok = false;
            break;
          }
          rest.splice(x, 1);
        }
        if (!ok) continue;
        const [s, f, took] = cost(c, rest);
        used[i] = true;
        assign(mi + 1, strict + s, soft + f);
        used[i] = false;
        for (const k of took) H[k]++;
        break;
      }
    }
  };
  /** Missing tiles for these kinds: [must be natural, may be jokers, tiles taken]. Takes them from H. */
  const cost = (c: BComp, kinds: number[]): [number, number, number[]] => {
    let s = 0;
    let f = 0;
    const took: number[] = [];
    for (const k of kinds) {
      if (H[k] > 0) {
        H[k]--;
        took.push(k);
      } else if (c.jok && !c.nat?.includes(k)) f++;
      else s++;
    }
    return [s, f, took];
  };
  const total = (strict: number, soft: number) => strict + Math.max(0, soft - J);
  const fill = (i: number, prevOpt: number, strict: number, soft: number) => {
    while (i < comps.length && used[i]) i++;
    if (total(strict, soft) >= best) return;
    if (i === comps.length) {
      best = total(strict, soft);
      return;
    }
    const c = comps[i];
    let p = i - 1;
    while (p >= 0 && used[p]) p--;
    const start = p >= 0 && comps[p].id === c.id ? prevOpt : 0;
    let same = 1;
    while (i + same < comps.length && comps[i + same].id === c.id) same++;
    const width = Math.max(beam, same > 1 ? same + 2 : beam);
    const scored: { o: number; m: number }[] = [];
    for (let o = start; o < c.opts.length; o++) {
      let m = 0;
      const opt = c.opts[o];
      for (let j = 0; j < opt.length; j++) {
        let n = 0;
        for (let x = 0; x <= j; x++) if (opt[x] === opt[j]) n++;
        if (n > H[opt[j]]) m++;
      }
      let at = scored.length;
      if (at === width && m >= scored[width - 1].m) continue;
      while (at > 0 && scored[at - 1].m > m) at--;
      scored.splice(at, 0, { o, m });
      if (scored.length > width) scored.pop();
    }
    for (const sc of scored) {
      const [s, f, took] = cost(c, c.opts[sc.o]);
      fill(i + 1, sc.o, strict + s, soft + f);
      for (const k of took) H[k]++;
    }
  };
  assign(0, 0, 0);
  return best;
}

// ------------------------------------------------------------ laying down

export interface BigGroup {
  type: 'kong' | 'qwong' | 'run';
  /** Tile ids taken from the hand. */
  ids: number[];
  /** The jokers among them and what each stands for. */
  wild: { id: number; as: number }[];
  /** Grows this laid-down group of yours (a pung or kong) instead of making a new one. */
  extend?: number;
  /** Every tile of the finished group, as the kinds they stand for (sorted). */
  as: number[];
  /** Extra tiles drawn from the flower wall. */
  extras: number;
}

/** The kongs, qwongs and runs a player can lay down now from the hand, for any reading of the card. */
export function bigGroups(card: BigCard, hand: { id: number; kind: number }[], melds: (MInfo & { extras?: number })[], ctx: BigCtx): BigGroup[] {
  const out: BigGroup[] = [];
  const seen = new Set<string>();
  const bucket = (k: number) => (k >= 34 ? FL : k);
  for (const e of bigEnvs(card, ctx)) {
    const caps = capsOf(card.jokers(e));
    const capRem = new Map(caps);
    for (const m of melds) for (const j of m.jokers) capRem.set(j.kind, (capRem.get(j.kind) ?? 0) - 1);
    for (const comps of card.alts(e))
      for (const c of comps) {
        if (c.type !== 'kong' && c.type !== 'qwong' && c.type !== 'run') continue;
        for (const opt of c.opts) {
          // A new group from the hand, or one of your pungs or kongs grown into it.
          const bases: (number | undefined)[] = [undefined];
          melds.forEach((m, i) => {
            if (c.type !== 'run' && (m.type === 'pung' || (m.type === 'kong' && c.type === 'qwong')) && m.as[0] === opt[0] && (!m.jokers.length || c.jok)) bases.push(i);
          });
          for (const base of bases) {
            const need = opt.slice();
            if (base !== undefined) for (const k of melds[base].as) need.splice(need.indexOf(k), 1);
            const g = pick(c, need, hand, capRem, bucket);
            if (!g) continue;
            const type = c.type;
            const extras = Math.max(0, card.extras[type] - (base === undefined ? 0 : (melds[base].extras ?? 0)));
            const key = `${type}|${base ?? '-'}|${opt.join('.')}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ type, ids: g.ids, wild: g.wild, extend: base, as: opt.slice(), extras });
          }
        }
      }
  }
  return out;
}

/** Tiles from the hand for these kinds: naturals first, then jokers where the component allows. */
function pick(c: BComp, kinds: number[], hand: { id: number; kind: number }[], capRem: Map<number, number>, bucket: (k: number) => number) {
  const free = hand.slice();
  const ids: number[] = [];
  const wild: { id: number; as: number }[] = [];
  const later: number[] = [];
  for (const k of kinds) {
    const i = free.findIndex((x) => bucket(x.kind) === k);
    if (i >= 0) ids.push(free.splice(i, 1)[0].id);
    else later.push(k);
  }
  const left = new Map(capRem);
  for (const k of later) {
    if (!c.jok || c.nat?.includes(k)) return null;
    const i = free.findIndex((x) => (left.get(bucket(x.kind)) ?? 0) > 0);
    if (i < 0) return null;
    const j = free.splice(i, 1)[0];
    left.set(bucket(j.kind), left.get(bucket(j.kind))! - 1);
    ids.push(j.id);
    wild.push({ id: j.id, as: k });
  }
  return { ids, wild };
}

/** Kinds a card can use at all (for passing tiles in the exchanges). */
export function bigUses(card: BigCard, ctx: BigCtx): Set<number> {
  const s = new Set<number>();
  for (const e of bigEnvs(card, ctx)) {
    for (const r of card.jokers(e)) for (const k of r.kinds) s.add(k);
    for (const comps of card.alts(e)) for (const c of comps) for (const o of c.opts) for (const k of o) s.add(k);
  }
  return s;
}

/** The size of a finished hand on this card (14 and the extras), for checks and lessons. */
export function bigHandSize(comps: BComp[]): number {
  return sizeOf(comps);
}
export function bigExtrasOf(card: BigCard, comps: BComp[]): number {
  return comps.reduce((a, c) => a + (c.type === 'kong' || c.type === 'qwong' || c.type === 'run' ? card.extras[c.type] : 0), 0);
}

/** Kinds a discard may be called for: pungs (and kongs) of kinds a kong, qwong or pung of the card
 *  uses, and chows only where the card has a chow. */
export function bigCallKinds(card: BigCard, ctx: BigCtx): { pung: Set<number>; chow: Set<number> } {
  const pung = new Set<number>();
  const chow = new Set<number>();
  for (const e of bigEnvs(card, ctx))
    for (const comps of card.alts(e))
      for (const c of comps)
        for (const o of c.opts) {
          if (c.type === 'kong' || c.type === 'qwong' || c.type === 'pung') pung.add(o[0]);
          else if (c.type === 'chow') chow.add(o[0]);
        }
  return { pung, chow };
}

/** What a Big Card win pays (p. 32): 1000, or 2000 concealed; East pays and receives double. */
export const BIG_PAY = { normal: 1000, concealed: 2000 };
export function bigScore(card: BigCard, concealed: boolean): HandScore {
  const value = concealed ? BIG_PAY.concealed : BIG_PAY.normal;
  return { value, unit: 'pts', items: [{ name: card.name, value, note: concealed ? 'Concealed: nothing claimed' : 'Normal hand' }], points: value, limit: false };
}
