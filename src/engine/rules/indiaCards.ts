// India Rules, Round 2 (South): the 55 Small Cards, as the club rulebook lists
// them (pp. 15-25; docs/variants/india-rules.md). Each player draws one card in
// secret and can win only with the hand it names.
//
// A card is written as one or more alternatives, each a list of components
// (pungs, pairs, chows, mixed chows, crochets, knits, single tiles). Suit letters
// A, B and C stand for the three suits, all different; a card is tried with every
// way of giving them suits. Declared melds must each match a pung or chow component.
//
// Readings where the book is silent are marked [reading] and listed in the spec.

import type { MeldShape, SpecialShape } from '../hand';
import type { Wind } from '../tiles';
import { WINDS } from '../tiles';

export type Limit = 'half' | 'limit' | 'double';
export const LIMIT_PAY: Record<Limit, number> = { half: 500, limit: 1000, double: 2000 };

/** One concrete way to fill a component: the tiles, and the meld that may stand for it. */
interface Opt {
  tiles: number[];
  meld?: { type: 'pung' | 'chow'; kind: number };
}
/** A component: `id` marks identical components, which are filled in non-decreasing order. */
export interface Comp {
  id: string;
  opts: Opt[];
}
export interface Env {
  A: number;
  B: number;
  C: number;
  seat: number;
  round: number;
}

/** What the payment depends on, besides the card. */
export interface CardWin {
  /** No exposed (claimed) set. */
  concealed: boolean;
  counts: number[];
  melds: MeldShape[];
  seat: number;
  round: number;
}

export interface SmallCard {
  n: number;
  name: string;
  how: string;
  /** Tiles to picture the card, as parseKinds strings. */
  picture: string;
  value: Limit | ((w: CardWin) => Limit);
  /** "All cards from wall": no discard may be taken, not even to Mahjong. */
  wall?: boolean;
  /** Claims the card allows when it isn't all from the wall. */
  claim?: (type: 'pung' | 'kong' | 'chow' | 'win', kind: number, hand: number[], seat: number) => boolean;
  /** Pairs must be different kinds (all-pair hands). [reading] */
  distinct?: boolean;
  /** Kongs not allowed. */
  noKong?: boolean;
  /** Extra test on a complete hand (the counts include declared melds' tiles). */
  check?: (all: number[], seat: number) => boolean;
  alts: (e: Env) => Comp[][];
  /** Which suit letters the card uses (fewer letters, fewer tries). */
  suits: number;
}

// ------------------------------------------------------------ tiles

const t = (suit: number, n: number) => suit * 9 + n - 1;
const BM = 2; // Bamboos
const E = 27, S = 28, W = 29, N = 30, RD = 31, GD = 32, WD = 33;
export const WINDS_K = [E, S, W, N];
const DRAGONS = [RD, GD, WD];
export const HONOURS = [...WINDS_K, ...DRAGONS];
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
export const suitTiles = (s: number, from = 1, to = 9) => range(from, to).map((n) => t(s, n));
const ALL_SUITS = [0, 1, 2].flatMap((s) => suitTiles(s));
export const ALL = [...ALL_SUITS, ...HONOURS];
const GREEN_B = [2, 3, 4, 6, 8].map((n) => t(BM, n));
const RED_B = [1, 5, 7, 9].map((n) => t(BM, n));
const TERMINALS = [0, 1, 2].flatMap((s) => [t(s, 1), t(s, 9)]);
const MAJORS = [...TERMINALS, ...HONOURS];
const MINORS = [0, 1, 2].flatMap((s) => suitTiles(s, 2, 8));

// ------------------------------------------------------------ components

export const P = (kinds: number[], id = `P${kinds.join('.')}`): Comp => ({ id, opts: kinds.map((k) => ({ tiles: [k, k, k], meld: { type: 'pung', kind: k } })) });
export const Pr = (kinds: number[], id = `R${kinds.join('.')}`): Comp => ({ id, opts: kinds.map((k) => ({ tiles: [k, k] })) });
export const F = (...kinds: number[]): Comp => ({ id: `F${kinds.join('.')}`, opts: [{ tiles: kinds }] });
export const One = (kinds: number[]): Comp => ({ id: `S${kinds.join('.')}`, opts: kinds.map((k) => ({ tiles: [k] })) });
export const Ch = (suits: number[], starts = range(1, 7), id = `C${suits.join('.')}/${starts.join('.')}`): Comp => ({
  id,
  opts: suits.flatMap((s) => starts.map((n) => ({ tiles: [t(s, n), t(s, n + 1), t(s, n + 2)], meld: { type: 'chow' as const, kind: t(s, n) } }))),
});
const PERMS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];
export const Mx = (): Comp => ({ id: 'M', opts: range(1, 7).flatMap((n) => PERMS.map((p) => ({ tiles: [t(p[0], n), t(p[1], n + 1), t(p[2], n + 2)] }))) });
export const Cr = (): Comp => ({ id: 'X', opts: range(1, 9).map((n) => ({ tiles: [t(0, n), t(1, n), t(2, n)] })) });
export const Kn = (pairs: [number, number][] = [[0, 1], [0, 2], [1, 2]]): Comp => ({ id: `K${pairs.join('.')}`, opts: pairs.flatMap(([a, b]) => range(1, 9).map((n) => ({ tiles: [t(a, n), t(b, n)] }))) });
/** A pung of `pungs` or a chow in `suits`. */
const PC = (pungs: number[], suits: number[], id = `T${pungs.join('.')}/${suits.join('.')}`): Comp => ({ id, opts: [...P(pungs).opts, ...Ch(suits).opts] });
const rep = (n: number, c: Comp) => Array.from({ length: n }, () => c);
const NEWS = [E, S, W, N];
const GRW = [GD, RD, WD];
const run = (s: number, a: number, b: number) => suitTiles(s, a, b);
const conc = (w: CardWin) => w.concealed;
/** The wind pair of a hand (the wind held twice or more beyond NEWS), for "own wind" values. */
const extraWind = (w: CardWin, base: number) => WINDS_K.find((k) => w.counts[k] + w.melds.filter((m) => m.kind === k).length * 3 >= base + 1);

// ------------------------------------------------------------ the 55 cards

export const SMALL_CARDS: SmallCard[] = [
  { n: 1, name: 'Lily of the Valley', how: 'Pungs of Green and White Dragons, two pungs and a pair of green bamboos (2, 3, 4, 6, 8 of Bamboos)', picture: 'GdGdGd WdWdWd 222s 666s 88s', value: 'double', suits: 0, alts: () => [[P([GD]), P([WD]), ...rep(2, P(GREEN_B)), Pr(GREEN_B)]] },
  { n: 2, name: 'Red Lily', how: 'Pungs of Red and White Dragons, two pungs and a pair of red bamboos (1, 5, 7, 9 of Bamboos)', picture: 'RdRdRd WdWdWd 111s 555s 99s', value: 'double', suits: 0, alts: () => [[P([RD]), P([WD]), ...rep(2, P(RED_B)), Pr(RED_B)]] },
  { n: 3, name: 'Unique Wonders', how: '1 and 9 of each suit, NEWS and GRW, plus one more of any of them', picture: '19m 19p 19s ESWN GdRdWd E', value: 'double', suits: 0, alts: () => [[F(...TERMINALS, ...HONOURS), One(MAJORS)]] },
  { n: 4, name: 'Royal Ruby', how: 'A pung of Red Dragons, three pungs and a pair of red bamboos', picture: 'RdRdRd 111s 555s 777s 99s', value: 'double', suits: 0, alts: () => [[P([RD]), ...rep(3, P(RED_B)), Pr(RED_B)]] },
  { n: 5, name: 'Imperial Jade', how: 'A pung of Green Dragons, three pungs and a pair of green bamboos', picture: 'GdGdGd 222s 333s 666s 88s', value: 'double', suits: 0, alts: () => [[P([GD]), ...rep(3, P(GREEN_B)), Pr(GREEN_B)]] },
  { n: 6, name: 'Four Blessings', how: 'Pungs or kongs of East, South, West and North, and any pair of a suit or a dragon', picture: 'EEE SSS WWW NNN 55p', value: 'double', suits: 0, alts: () => [[P([E]), P([S]), P([W]), P([N]), Pr([...ALL_SUITS, ...DRAGONS])]] },
  { n: 7, name: 'Hitler’s Blunder', how: 'A pung of any dragon, NEWS, and 1 to 7 in one suit', picture: 'RdRdRd ESWN 1234567m', value: 'limit', suits: 1, alts: (e) => [[P(DRAGONS), F(...NEWS), F(...run(e.A, 1, 7))]] },
  { n: 8, name: 'Heavenly Twins', how: 'Seven pairs, all in one suit', picture: '11s 33s 44s 55s 66s 88s 99s', value: 'limit', suits: 1, distinct: true, alts: (e) => [rep(7, Pr(suitTiles(e.A)))] },
  { n: 9, name: 'Silly Bee', how: 'A chow in each suit, one mixed chow, and a pair of 2 to 8, a wind or a dragon. All from the wall', picture: '123m 456p 789s 2m 3p 4s EE', value: 'limit', wall: true, suits: 3, alts: (e) => [[Ch([e.A]), Ch([e.B]), Ch([e.C]), Mx(), Pr([...MINORS, ...HONOURS])]] },
  { n: 10, name: 'Western Command', how: 'Any three pungs, a chow and a pair of a suit', picture: 'EEE RdRdRd 555p 123m 99s', value: 'limit', suits: 0, alts: () => [[...rep(3, P(ALL)), Ch([0, 1, 2]), Pr(ALL_SUITS)]] },
  { n: 11, name: 'Gertie’s Garter', how: '1 to 7 in two suits', picture: '1234567m 1234567s', value: 'limit', suits: 2, alts: (e) => [[F(...run(e.A, 1, 7), ...run(e.B, 1, 7))]] },
  { n: 12, name: 'Sparrows Sanctuary', how: 'Two pairs of 1 Bamboo and a pair of each green bamboo (2, 3, 4, 6, 8)', picture: '11s 11s 22s 33s 44s 66s 88s', value: 'limit', suits: 0, alts: () => [[F(t(BM, 1), t(BM, 1), t(BM, 1), t(BM, 1), ...GREEN_B.flatMap((k) => [k, k]))]] },
  {
    n: 13,
    name: 'Mixed Pung',
    how: 'Four pungs and a pair in one suit with winds and dragons, or three pungs in three suits, a pung of anything and any pair. All from the wall',
    picture: '222m 555p 777s EEE RdRd',
    value: 'limit',
    wall: true,
    suits: 3,
    alts: (e) => [
      [...rep(4, P([...suitTiles(e.A), ...HONOURS], 'PA')), Pr([...suitTiles(e.A), ...HONOURS])],
      [P(suitTiles(e.A)), P(suitTiles(e.B)), P(suitTiles(e.C)), P(ALL), Pr(ALL)],
    ],
  },
  { n: 14, name: 'Roberts', how: 'Red and Green Dragons (one each) or two White Dragons, and four mixed chows. All from the wall', picture: 'RdGd 1m 2p 3s 4p 5s 6m 7s 8m 9p 2s 3m 4p', value: 'limit', wall: true, suits: 0, alts: () => [[F(RD, GD), ...rep(4, Mx())], [F(WD, WD), ...rep(4, Mx())]] },
  { n: 15, name: 'Eternal Triangle', how: 'NEWS and GRW, one more wind or dragon, and a pair in each suit', picture: 'ESWN GdRdWd E 55m 22p 99s', value: 'limit', suits: 3, alts: (e) => [[F(...NEWS, ...GRW), One(HONOURS), Pr(suitTiles(e.A)), Pr(suitTiles(e.B)), Pr(suitTiles(e.C))]] },
  {
    n: 16,
    name: 'Three Philosophers',
    how: 'GRW, a pair of winds, and a chow in each suit. Limit if the pair is your own wind, half limit otherwise',
    picture: 'GdRdWd SS 123m 456p 789s',
    value: (w) => (w.counts[w.seat] >= 2 ? 'limit' : 'half'),
    suits: 3,
    alts: (e) => [[F(...GRW), Pr(WINDS_K), Ch([e.A]), Ch([e.B]), Ch([e.C])]],
  },
  {
    n: 17,
    name: 'Red Lantern',
    how: 'A pung of Red Dragons, a pung of your own wind, and 1 to 7 in one suit with one of them paired. Limit if punged, double limit if concealed',
    picture: 'RdRdRd SSS 1234567p 4p',
    value: (w) => (conc(w) ? 'double' : 'limit'),
    suits: 1,
    alts: (e) => [[P([RD]), P([e.seat]), F(...run(e.A, 1, 7)), One(run(e.A, 1, 7))]],
  },
  { n: 18, name: 'Mixed Blossom', how: 'A pung of Red Dragons and a pair of Green (or the other way round), and three mixed chows', picture: 'RdRdRd GdGd 1m 2p 3s 4p 5s 6m 7s 8m 9p', value: 'limit', suits: 0, alts: () => [[P([RD]), Pr([GD]), ...rep(3, Mx())], [P([GD]), Pr([RD]), ...rep(3, Mx())]] },
  { n: 19, name: 'Apple Blossom', how: 'A pung of White Dragons, a pair of Green Dragons, and three mixed chows', picture: 'WdWdWd GdGd 1m 2p 3s 4p 5s 6m 7s 8m 9p', value: 'limit', suits: 0, alts: () => [[P([WD]), Pr([GD]), ...rep(3, Mx())]] },
  {
    n: 20,
    name: 'Windy Chows',
    how: 'A chow in each suit, NEWS and one more wind. Limit if the extra wind is your own, half limit otherwise',
    picture: '123m 456p 789s ESWN S',
    value: (w) => (extraWind(w, 1) === w.seat ? 'limit' : 'half'),
    suits: 3,
    alts: (e) => [[Ch([e.A]), Ch([e.B]), Ch([e.C]), F(...NEWS), One(WINDS_K)]],
  },
  { n: 21, name: 'All Pair Ruby Jade Hand', how: 'Seven pairs: red and green bamboos, with a pair of Red and a pair of Green Dragons', picture: 'RdRd GdGd 11s 22s 55s 66s 99s', value: 'limit', suits: 0, distinct: true, alts: () => [[Pr([RD]), Pr([GD]), ...rep(5, Pr([...RED_B, ...GREEN_B]))]] },
  { n: 22, name: 'Ringlet', how: 'A pung (winds and dragons allowed), a chow, a mixed chow, a crochet and a knit. All from the wall', picture: 'EEE 123m 4m 5p 6s 7m 7p 7s 2s 2p', value: 'limit', wall: true, suits: 0, alts: () => [[P(ALL), Ch([0, 1, 2]), Mx(), Cr(), Kn()]] },
  { n: 23, name: 'All Winds and Dragons', how: 'Four pungs or kongs and a pair, all winds and dragons', picture: 'EEE SSS RdRdRd GdGdGd WdWd', value: 'limit', suits: 0, alts: () => [[...rep(4, P(HONOURS)), Pr(HONOURS)]] },
  {
    n: 24,
    name: 'Golden Staircase',
    how: '1 to 9 in one suit, a concealed pung of a dragon or wind (never from a discard, even to Mahjong), and a pair of winds or dragons',
    picture: '123456789s RdRdRd EE',
    value: 'limit',
    suits: 1,
    claim: (type, kind) => !((type === 'pung' || type === 'kong' || type === 'win') && kind >= 27),
    alts: (e) => [[Ch([e.A], [1]), Ch([e.A], [4]), Ch([e.A], [7]), P(HONOURS), Pr(HONOURS)]],
  },
  { n: 25, name: 'Buried Treasure', how: 'Chows and pungs all in one suit with winds and dragons, no kongs. All from the wall', picture: '123p 555p 789p EEE RdRd', value: 'limit', wall: true, noKong: true, suits: 1, alts: (e) => [[...rep(4, PC([...suitTiles(e.A), ...HONOURS], [e.A], 'TA')), Pr([...suitTiles(e.A), ...HONOURS])]] },
  { n: 26, name: 'All Pair Jade Hand', how: 'A pair of Green Dragons, a pair of each green bamboo, and one of those pairs again. All from the wall', picture: 'GdGd 22s 33s 44s 66s 88s 88s', value: 'limit', wall: true, suits: 0, alts: () => [[F(GD, GD, ...GREEN_B.flatMap((k) => [k, k])), Pr([GD, ...GREEN_B])]] },
  { n: 27, name: 'A Run, A Pung and A Pair', how: '1 to 9, a pung and a pair, all in one suit', picture: '123456789m 555m 99m', value: 'limit', suits: 1, alts: (e) => [[Ch([e.A], [1]), Ch([e.A], [4]), Ch([e.A], [7]), P(suitTiles(e.A)), Pr(suitTiles(e.A))]] },
  {
    n: 28,
    name: 'Dragon Fly',
    how: 'GRW, a pung in each suit and a pair of a suit. Limit if concealed, half limit if punged from a discard',
    picture: 'GdRdWd 222m 555p 777s 99m',
    value: (w) => (conc(w) ? 'limit' : 'half'),
    suits: 3,
    alts: (e) => [[F(...GRW), P(suitTiles(e.A)), P(suitTiles(e.B)), P(suitTiles(e.C)), Pr(ALL_SUITS)]],
  },
  { n: 29, name: 'Buried Treasure (all hidden)', how: 'All hidden pungs and a pair, anything mixed. All from the wall', picture: '222m 555p EEE RdRdRd 99s', value: 'double', wall: true, suits: 0, alts: () => [[...rep(4, P(ALL)), Pr(ALL)]] },
  { n: 30, name: 'Greta’s Garden', how: 'NEWS, GRW, and 1 to 7 in one suit', picture: 'ESWN GdRdWd 1234567s', value: 'limit', suits: 1, alts: (e) => [[F(...NEWS, ...GRW, ...run(e.A, 1, 7))]] },
  { n: 31, name: 'Three Scholars', how: 'Pungs or kongs of all three dragons, a pung, kong or chow, and a pair of a suit or a wind', picture: 'RdRdRd GdGdGd WdWdWd 456m EE', value: 'limit', suits: 0, alts: () => [[P([RD]), P([GD]), P([WD]), PC(ALL, [0, 1, 2]), Pr([...ALL_SUITS, ...WINDS_K])]] },
  { n: 32, name: 'Wriggly Snake', how: 'NEWS, 1 to 9 in one suit, and one of them paired', picture: 'ESWN 123456789p 5p', value: 'limit', suits: 1, alts: (e) => [[F(...NEWS, ...run(e.A, 1, 9)), One([...NEWS, ...run(e.A, 1, 9)])]] },
  { n: 33, name: 'Seventh Heaven', how: 'NEWS, GRW, and 1 to 7 in one suit', picture: 'ESWN GdRdWd 1234567m', value: 'limit', suits: 1, alts: (e) => [[F(...NEWS, ...GRW, ...run(e.A, 1, 7))]] },
  { n: 34, name: 'Windy Chee', how: 'A chow in each suit, NEWS, and one more of your own wind or the round wind', picture: '123m 456p 789s ESWN S', value: 'limit', suits: 3, alts: (e) => [[Ch([e.A]), Ch([e.B]), Ch([e.C]), F(...NEWS), One([...new Set([e.seat, e.round])])]] },
  { n: 35, name: 'Knitting', how: 'Seven knits in the same two suits (numbers may repeat)', picture: '1m 1s 3m 3s 4m 4s 5m 5s 5m 5s 8m 8s 9m 9s', value: 'limit', suits: 2, alts: (e) => [rep(7, Kn([[Math.min(e.A, e.B), Math.max(e.A, e.B)]]))] },
  { n: 36, name: 'Dragon Fly (mixed)', how: 'A pung of a dragon, one each of the other two dragons, and three mixed chows', picture: 'RdRdRd GdWd 1m 2p 3s 4p 5s 6m 7s 8m 9p', value: 'limit', suits: 0, alts: () => DRAGONS.map((d) => [P([d]), F(...DRAGONS.filter((x) => x !== d)), ...rep(3, Mx())]) },
  { n: 37, name: 'Hovering Angels', how: 'A pung of your own wind or the round wind, a pair of dragons, and a chow in each suit', picture: 'SSS RdRd 123m 456p 789s', value: 'limit', suits: 3, alts: (e) => [[P([...new Set([e.seat, e.round])]), Pr(DRAGONS), Ch([e.A]), Ch([e.B]), Ch([e.C])]] },
  { n: 38, name: 'Windy Wonders', how: 'A pung of winds, a pair of winds, and three mixed chows', picture: 'EEE NN 1m 2p 3s 4p 5s 6m 7s 8m 9p', value: 'limit', suits: 0, alts: () => [[P(WINDS_K), Pr(WINDS_K), ...rep(3, Mx())]] },
  {
    n: 39,
    name: 'Windy Dragons',
    how: 'Two pungs of dragons and a pair of each wind. Only dragons may be punged; the pairs come from the wall, even to Mahjong',
    picture: 'RdRdRd GdGdGd EE SS WW NN',
    value: 'limit',
    suits: 0,
    claim: (type, kind) => type !== 'chow' && DRAGONS.includes(kind),
    alts: () => [[...rep(2, P(DRAGONS)), F(E, E, S, S, W, W, N, N)]],
  },
  { n: 40, name: 'Gates of Heaven', how: 'One suit: a pung of 1s, a pung of 9s, 2 to 8, and one more of 2 to 8', picture: '111p 2345678p 999p 5p', value: 'limit', suits: 1, alts: (e) => [[P([t(e.A, 1)]), P([t(e.A, 9)]), F(...run(e.A, 2, 8)), One(run(e.A, 2, 8))]] },
  { n: 41, name: 'All Pair Major Hand', how: 'Seven pairs of 1s, 9s, winds and dragons', picture: '11m 99p 11s EE NN RdRd WdWd', value: 'limit', suits: 0, distinct: true, alts: () => [rep(7, Pr(MAJORS))] },
  { n: 42, name: 'Chinese Odds', how: 'Four pungs and a pair of odd numbers (1, 3, 5, 7, 9), all in one suit', picture: '111s 333s 555s 777s 99s', value: 'limit', suits: 1, alts: (e) => [[...rep(4, P([1, 3, 5, 7, 9].map((n) => t(e.A, n)))), Pr([1, 3, 5, 7, 9].map((n) => t(e.A, n)))]] },
  { n: 43, name: 'Heads and Tails', how: 'Four pungs of 1s and 9s in any suits, and a pair of winds', picture: '111m 999m 111p 999s EE', value: 'limit', suits: 0, alts: () => [[...rep(4, P(TERMINALS)), Pr(WINDS_K)]] },
  { n: 44, name: 'Purity Hand', how: 'Four pungs and a pair in one suit, no winds or dragons', picture: '222m 444m 666m 888m 99m', value: 'limit', suits: 1, alts: (e) => [[...rep(4, P(suitTiles(e.A))), Pr(suitTiles(e.A))]] },
  {
    n: 45,
    name: 'A Joker Hand',
    how: 'Any hand: another Small Card pays its own value; otherwise any 3+3+3+3+2 pays half limit. All from the wall',
    picture: '123m 555p 4m 5p 6s EEE RdRd',
    value: 'half',
    wall: true,
    suits: 0,
    // Any sets (pung, chow, mixed chow or crochet) and a pair, or any other card (see jokerShape).
    alts: () => [[...rep(4, { id: 'J', opts: [...P(ALL).opts, ...Ch([0, 1, 2]).opts, ...Mx().opts, ...Cr().opts] }), Pr(ALL)]],
  },
  { n: 46, name: 'All Honour Hand', how: 'Four pungs and a pair of 1s, 9s, winds and dragons, with the 1s and 9s in one suit', picture: '111m 999m EEE RdRdRd NN', value: 'limit', suits: 1, alts: (e) => [[...rep(4, P([t(e.A, 1), t(e.A, 9), ...HONOURS])), Pr([t(e.A, 1), t(e.A, 9), ...HONOURS])]] },
  {
    n: 47,
    name: 'Ordinary Suit Hand',
    how: 'Four pungs or kongs in one suit with winds or dragons, and a pair; one chow in that suit is allowed',
    picture: '222p 555p 789p EEE RdRd',
    value: 'limit',
    suits: 1,
    check: (all) => HONOURS.some((k) => all[k] > 0),
    alts: (e) => [
      [...rep(4, P([...suitTiles(e.A), ...HONOURS], 'PA')), Pr([...suitTiles(e.A), ...HONOURS])],
      [...rep(3, P([...suitTiles(e.A), ...HONOURS], 'PA')), Ch([e.A]), Pr([...suitTiles(e.A), ...HONOURS])],
    ],
  },
  { n: 48, name: 'Windy Ones', how: 'NEWS and one more wind, and pungs of 1s in all three suits. Half limit if punged, limit if concealed', picture: 'ESWN E 111m 111p 111s', value: (w) => (conc(w) ? 'limit' : 'half'), suits: 0, alts: () => [[F(...NEWS), One(WINDS_K), P([t(0, 1)]), P([t(1, 1)]), P([t(2, 1)])]] },
  { n: 49, name: 'Windy Nines', how: 'NEWS and one more wind, and pungs of 9s in all three suits. Half limit if punged, limit if concealed', picture: 'ESWN N 999m 999p 999s', value: (w) => (conc(w) ? 'limit' : 'half'), suits: 0, alts: () => [[F(...NEWS), One(WINDS_K), P([t(0, 9)]), P([t(1, 9)]), P([t(2, 9)])]] },
  { n: 50, name: 'All Pair Hand', how: 'Seven pairs in one suit with winds or dragons', picture: '22p 44p 66p 88p 99p EE RdRd', value: 'half', suits: 1, distinct: true, check: (all) => HONOURS.some((k) => all[k] > 0), alts: (e) => [rep(7, Pr([...suitTiles(e.A), ...HONOURS]))] },
  { n: 51, name: 'Triple Knitting', how: 'Four crochets and a knit (the same number in two suits)', picture: '2m 2p 2s 4m 4p 4s 6m 6p 6s 8m 8p 8s 9m 9s', value: 'half', suits: 0, alts: () => [[...rep(4, Cr()), Kn()]] },
  { n: 52, name: 'Little Bastard', how: 'A chow in each suit, a mixed chow, and a pair of 1s or 9s', picture: '123m 456p 789s 3m 4p 5s 99m', value: 'half', suits: 3, alts: (e) => [[Ch([e.A]), Ch([e.B]), Ch([e.C]), Mx(), Pr(TERMINALS)]] },
  { n: 53, name: 'Bomb Shell', how: 'Chows of the same numbers in the three suits, GRW, and a pair of winds', picture: '345m 345p 345s GdRdWd EE', value: 'half', suits: 0, alts: () => range(1, 7).map((n) => [Ch([0], [n]), Ch([1], [n]), Ch([2], [n]), F(...GRW), Pr(WINDS_K)]) },
  {
    n: 54,
    name: 'Little Robert',
    how: 'Three chows, a pung and a pair in one suit; the pair may be your own wind, and then a discard may be punged. Otherwise all from the wall',
    picture: '123s 456s 789s 555s 11s',
    value: 'half',
    suits: 1,
    claim: (_type, _kind, hand, seat) => hand.filter((k) => k === seat).length >= 2,
    alts: (e) => [[...rep(3, Ch([e.A])), P(suitTiles(e.A)), Pr([...suitTiles(e.A), e.seat])]],
  },
  { n: 55, name: 'Dirty Pairs', how: 'Any seven pairs: suits, winds and dragons', picture: '11m 55p 77s 99s EE NN RdRd', value: 'half', suits: 0, distinct: true, alts: () => [rep(7, Pr(ALL))] },
];

// ------------------------------------------------------------ matching

function envs(card: SmallCard, seat: number, round: number): Env[] {
  const out: Env[] = [];
  const seen = new Set<string>();
  for (const p of PERMS) {
    const key = p.slice(0, card.suits).join();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ A: p[0], B: p[1], C: p[2], seat, round });
  }
  return out;
}

/** Does a hand (concealed counts, declared melds) fill these components exactly? */
function fits(comps: Comp[], counts: number[], melds: MeldShape[], card: SmallCard): boolean {
  const used = melds.map(() => false);
  const pairs: number[] = [];
  const go = (i: number, minOpt: number): boolean => {
    if (i === comps.length) return used.every(Boolean) && counts.every((n) => n === 0);
    const c = comps[i];
    const start = i > 0 && comps[i - 1].id === c.id ? minOpt : 0;
    for (let o = start; o < c.opts.length; o++) {
      const opt = c.opts[o];
      // A declared meld may stand for a pung or chow component.
      if (opt.meld) {
        for (let m = 0; m < melds.length; m++) {
          if (used[m] || melds[m].kind !== opt.meld.kind) continue;
          const ok = opt.meld.type === 'chow' ? melds[m].type === 'chow' : melds[m].type === 'pung' || (melds[m].type === 'kong' && !card.noKong);
          if (!ok) continue;
          used[m] = true;
          if (go(i + 1, o)) return true;
          used[m] = false;
        }
      }
      let ok = true;
      let k = 0;
      for (; k < opt.tiles.length; k++) {
        if (counts[opt.tiles[k]] <= 0) {
          ok = false;
          break;
        }
        counts[opt.tiles[k]]--;
      }
      if (ok) {
        const isPair = opt.tiles.length === 2 && opt.tiles[0] === opt.tiles[1];
        const clash = card.distinct && isPair && pairs.includes(opt.tiles[0]);
        if (!clash) {
          if (isPair) pairs.push(opt.tiles[0]);
          const r = go(i + 1, o);
          if (isPair) pairs.pop();
          if (r) {
            for (let j = 0; j < opt.tiles.length; j++) counts[opt.tiles[j]]++;
            return true;
          }
        }
      }
      for (let j = 0; j < k; j++) counts[opt.tiles[j]]++;
    }
    return false;
  };
  return go(0, 0);
}

/** Tiles still missing for these components (a quick search: the best few fillings of each). */
/** `rest`, when given, prices the tiles and melds left over once the components are filled (it returns
 *  the tiles still missing for them); without it every tile must sit in a component. */
export function missing(comps: Comp[], counts: number[], melds: MeldShape[], card: Pick<SmallCard, 'noKong' | 'distinct'>, budget: number, rest?: (left: number[], meldsLeft: number) => number, beam = 3): number {
  const c = counts.slice();
  const used = melds.map(() => false);
  let best = budget;
  const pairs: number[] = [];
  // With no beam (exact search), a lower bound prunes: each remaining component's cheapest
  // option on the tiles left (sharing tiles can only cost more; a declared meld may cost 0).
  const exact = !Number.isFinite(beam);
  const cheapest = (comp: Comp) => {
    let lo = 99;
    for (const opt of comp.opts) {
      if (opt.meld && melds.length) return 0;
      let m = 0;
      const ts = opt.tiles;
      for (let j = 0; j < ts.length && m < lo; j++) {
        let n = 0;
        for (let i = 0; i <= j; i++) if (ts[i] === ts[j]) n++;
        if (n > c[ts[j]]) m++;
      }
      if (m < lo) lo = m;
      if (!lo) break;
    }
    return lo;
  };
  const go = (i: number, minOpt: number, miss: number) => {
    if (miss >= best) return;
    if (exact && i < comps.length) {
      let lb = miss;
      for (let j = i; j < comps.length && lb < best; j++) lb += cheapest(comps[j]);
      if (lb >= best) return;
    }
    if (i === comps.length) {
      if (rest) best = Math.min(best, miss + rest(c, used.filter((u) => !u).length));
      // Declared melds that fit nowhere make the card impossible.
      else if (used.every(Boolean)) best = miss;
      return;
    }
    const comp = comps[i];
    const start = i > 0 && comps[i - 1].id === comp.id ? minOpt : 0;
    const scored: { o: number; m: number; meld: number }[] = [];
    // A run of identical components (seven pairs, seven knits) is filled in option order, so the
    // later ones need options the first few would never keep: widen the beam to cover the run.
    let same = 1;
    while (i + same < comps.length && comps[i + same].id === comp.id) same++;
    const width = Math.max(beam, same > 1 ? same + 2 : beam);
    // Keep the best few, earlier options first on ties.
    const keep = (e: { o: number; m: number; meld: number }) => {
      if (scored.length === width && e.m >= scored[width - 1].m) return;
      let at = scored.length;
      while (at > 0 && scored[at - 1].m > e.m) at--;
      scored.splice(at, 0, e);
      if (scored.length > width) scored.pop();
    };
    for (let o = start; o < comp.opts.length; o++) {
      const opt = comp.opts[o];
      if (opt.meld) {
        const m = melds.findIndex((x, j) => !used[j] && x.kind === opt.meld!.kind && (opt.meld!.type === 'chow' ? x.type === 'chow' : x.type === 'pung' || (x.type === 'kong' && !card.noKong)));
        if (m >= 0) {
          keep({ o, m: 0, meld: m });
          continue;
        }
      }
      if (card.distinct && opt.tiles.length === 2 && opt.tiles[0] === opt.tiles[1] && pairs.includes(opt.tiles[0])) continue;
      // A tile is missing when the hand holds fewer of its kind than the option uses so far.
      let m = 0;
      const ts = opt.tiles;
      for (let j = 0; j < ts.length; j++) {
        let used = 0;
        for (let i = 0; i <= j; i++) if (ts[i] === ts[j]) used++;
        if (used > c[ts[j]]) m++;
      }
      keep({ o, m, meld: -1 });
    }
    for (const s of scored) {
      const opt = comp.opts[s.o];
      if (s.meld >= 0) {
        used[s.meld] = true;
        go(i + 1, s.o, miss);
        used[s.meld] = false;
        continue;
      }
      const took: number[] = [];
      for (const k of opt.tiles)
        if (c[k] > 0) {
          c[k]--;
          took.push(k);
        }
      const isPair = opt.tiles.length === 2 && opt.tiles[0] === opt.tiles[1];
      if (isPair) pairs.push(opt.tiles[0]);
      go(i + 1, s.o, miss + s.m);
      if (isPair) pairs.pop();
      for (const k of took) c[k]++;
    }
  };
  go(0, 0, 0);
  return best;
}

const allTiles = (counts: number[], melds: MeldShape[]) => {
  const all = counts.slice();
  for (const m of melds) {
    if (m.type === 'chow') for (let i = 0; i < 3; i++) all[m.kind + i]++;
    else all[m.kind] += m.type === 'kong' ? 4 : 3;
  }
  return all;
};

/** Is this a complete hand for the card? */
export function cardComplete(card: SmallCard, counts: number[], melds: MeldShape[], seat: number, round: number, jokers = 0): boolean {
  if (counts.reduce((a, b) => a + b, 0) + melds.length * 3 + jokers !== 14) return false;
  // Jokers may be the tile a check asks for (an honour), so a hand with jokers passes it.
  if (card.check && !jokers && !card.check(allTiles(counts, melds), seat)) return false;
  const c = counts.slice(0, 34);
  if (jokers) return envs(card, seat, round).some((e) => card.alts(e).some((comps) => missing(comps, c, melds, card, jokers + 1, undefined, Infinity) <= jokers));
  return envs(card, seat, round).some((e) => card.alts(e).some((comps) => fits(comps, c, melds, card)));
}

/** Tiles away from ready, as shanten counts it (-1 complete). */
export function cardShanten(card: SmallCard, counts: number[], melds: MeldShape[], seat: number, round: number): number {
  const c = counts.slice(0, 34);
  const held = c.reduce((a, b) => a + b, 0) + melds.length * 3;
  let best = 99;
  for (const e of envs(card, seat, round)) for (const comps of card.alts(e)) best = Math.min(best, missing(comps, c, melds, card, best, undefined, Infinity));
  if (best >= 99) return 99;
  // With 14 tiles held, 0 missing is a win; with 13, 1 missing is ready.
  void held;
  return best - 1;
}

/** The card as a hand shape the engine and the AI can use. `meldsOf` gives the seat's declared melds
 *  (shanten has no melds of its own; a hypothetical call it can't see reads as off the card). */
export function cardShape(card: SmallCard, seat: Wind, round: Wind, meldsOf: () => MeldShape[], wilds = false): SpecialShape {
  const sk = 27 + WINDS.indexOf(seat);
  const rk = 27 + WINDS.indexOf(round);
  const memo = new Map<string, number>();
  let used: boolean[] | undefined;
  return {
    name: card.name,
    how: card.how,
    ai: true,
    wilds,
    uses: (kind) => {
      if (!used) {
        used = new Array(34).fill(false);
        for (const e of envs(card, sk, rk)) for (const comps of card.alts(e)) for (const c of comps) for (const o of c.opts) for (const k of o.tiles) used[k] = true;
      }
      return !!used[kind];
    },
    complete: (counts, meldCount, melds, jokers = 0) => {
      const ms = melds ?? meldsOf();
      if (ms.length !== meldCount) return false;
      return cardComplete(card, counts, ms, sk, rk, wilds ? jokers : 0);
    },
    shanten: (counts, meldCount) => {
      const ms = meldsOf();
      if (ms.length !== meldCount) return 99;
      const key = counts.slice(0, 34).join('') + '|' + ms.map((m) => m.type[0] + m.kind).join(',');
      let v = memo.get(key);
      if (v === undefined) {
        v = cardShanten(card, counts, ms, sk, rk);
        if (memo.size > 5000) memo.clear();
        memo.set(key, v);
      }
      return v;
    },
  };
}

/** The pungs and chows a card can use (any of its hands, any way of giving suits): hand sorting
 *  pulls out only these as sets. Kinds are a pung's tile and a chow's lowest tile. */
export function cardSets(card: SmallCard, seat: Wind, round: Wind): { pungs: Set<number>; chows: Set<number> } {
  const pungs = new Set<number>();
  const chows = new Set<number>();
  for (const e of envs(card, 27 + WINDS.indexOf(seat), 27 + WINDS.indexOf(round)))
    for (const comps of card.alts(e))
      for (const c of comps)
        for (const o of c.opts) {
          if (o.meld?.type === 'pung') pungs.add(o.meld.kind);
          else if (o.meld?.type === 'chow') chows.add(o.meld.kind);
        }
  return { pungs, chows };
}

/** What a winning hand on this card pays. */
export function cardValue(card: SmallCard, w: CardWin): Limit {
  return typeof card.value === 'function' ? card.value(w) : card.value;
}

export const cardByName = (name: string) => SMALL_CARDS.find((c) => c.name === name);
