// India Rules: the club game in the Mahjong Calling rulebook (the user's
// guide, docs/variants/india-rules.md). A full game is sixteen games, four
// rounds of four with each player East once:
//
//   East   Passport round     3+3+3+3+2 with mixed chows and crochets, or a
//                             passport combination; flat payments
//   South  Small Cards        (stage 3)
//   West   Goulash            (stage 2)
//   North  East's choice      before each deal: the East round (passport compulsory
//                             or not), Small Cards with flowers as jokers, Goulash
//                             with a number as joker, or a Big Card (indiaBig.ts)
//
// A table plays all four rounds, any one or any mix of them, or Classic: the East round's game
// without passports in all four (house rule indiaRounds).
// The deal passes after every game, won or drawn: East never keeps it (the user,
// 2026-10-25, over the book's extra game after a draw). East always pays and receives double. Flowers and seasons are
// paid by everyone at the end of every game, drawn games included.
//
// Pieces (the book's words): pung, kong, chow (a pure run), mixed chow (a
// run across the three suits), crochet (the same number in all three suits),
// pair, knit (the same number in two suits). A knit may only be the pair when
// the hand holds a crochet.

import { setsShanten, standardShanten, type MeldShape, type SpecialShape } from '../hand';
import { FLOWER_BASE, FLOWER_COUNT, KIND_COUNT, WINDS, isHonor, type Wind } from '../tiles';
import type { Meld } from '../state';
import { MIXED_SETS } from './special';
import type { HandScore, Payment, RuleProfile, ScoreItem, ScoringContext, SettleInfo } from './types';
import { WEST_MIN_DOUBLES, westPayments, westScore } from './indiaWest';
import { PassportMeter } from './indiaPassport';
import { passportLayout } from './indiaLayout';
import { LIMIT_PAY, SMALL_CARDS, cardByName, cardShape, cardValue, type Limit } from './indiaCards';
import { BIG_CARDS, bigCardByNumber, bigDistance, bigUses, type MInfo } from './indiaBig';

// ------------------------------------------------------------------ pieces

export type PieceType = 'pung' | 'kong' | 'chow' | 'mchow' | 'crochet' | 'pair' | 'knit' | 'news5' | 'grw';
export interface Piece {
  t: PieceType;
  /** The kinds it is made of (a kong lists its kind four times). */
  k: number[];
  /** Came from a declared meld. */
  meld?: boolean;
}

const kindOf = (suit: number, rank: number) => suit * 9 + rank;
const suit = (k: number) => Math.floor(k / 9);
const rank = (k: number) => k % 9;
const HONOURS = [27, 28, 29, 30, 31, 32, 33];
const WIND_KINDS = [27, 28, 29, 30];
const DRAGON_KINDS = [31, 32, 33];
const PERMS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];
// Rank-major order: every piece starts at its first kind in this order, so a walk over it meets each piece once.
const ORDER = [...Array.from({ length: 27 }, (_, i) => kindOf(i % 3, Math.floor(i / 3))), ...HONOURS];

/** Which pieces a reading may use. */
export interface PieceRules {
  chows: boolean;
  mixed: boolean;
  passports: boolean;
}

/** Every way to split concealed counts into pieces (capped). */
export function pieceReadings(counts: number[], rules: PieceRules, limit = 400): Piece[][] {
  const out: Piece[][] = [];
  const c = counts.slice();
  const cur: Piece[] = [];
  const seen = new Set<string>();
  const walk = (pos: number) => {
    if (out.length >= limit) return;
    while (pos < ORDER.length && !c[ORDER[pos]]) pos++;
    if (pos === ORDER.length) {
      const key = cur.map((p) => p.t + p.k.join('.')).sort().join('|');
      if (!seen.has(key)) {
        seen.add(key);
        out.push(cur.slice());
      }
      return;
    }
    const i = ORDER[pos];
    const use = (t: PieceType, kinds: number[]) => {
      const need = new Map<number, number>();
      for (const k of kinds) need.set(k, (need.get(k) ?? 0) + 1);
      for (const [k, n] of need) if (c[k] < n) return;
      for (const k of kinds) c[k]--;
      cur.push({ t, k: kinds });
      walk(pos);
      cur.pop();
      for (const k of kinds) c[k]++;
    };
    use('pung', [i, i, i]);
    use('pair', [i, i]);
    if (i < 27) {
      const s = suit(i);
      const r = rank(i);
      if (rules.chows && r <= 6) use('chow', [i, i + 1, i + 2]);
      if (rules.mixed) {
        if (s === 0) use('crochet', [i, kindOf(1, r), kindOf(2, r)]);
        for (let s2 = s + 1; s2 < 3; s2++) use('knit', [i, kindOf(s2, r)]);
        if (rules.chows && r <= 6) for (const p of PERMS) if (p[0] === s) use('mchow', [i, kindOf(p[1], r + 1), kindOf(p[2], r + 2)]);
      }
    } else if (rules.passports) {
      if (i === 27) for (const w of WIND_KINDS) use('news5', [...WIND_KINDS, w]);
      if (i === 31) use('grw', DRAGON_KINDS);
    }
  };
  walk(0);
  return out;
}

export const meldPiece = (m: MeldShape): Piece => ({ t: m.type, k: m.type === 'chow' ? [m.kind, m.kind + 1, m.kind + 2] : Array(m.type === 'kong' ? 4 : 3).fill(m.kind), meld: true });

const THREES: PieceType[] = ['pung', 'kong', 'chow', 'mchow', 'crochet'];
const isThree = (p: Piece) => THREES.includes(p.t);
const isPung = (p: Piece) => p.t === 'pung' || p.t === 'kong';

// ------------------------------------------------------------------ passports

export type PassportSize = 5 | 6 | 9;
/** The book's combinations: passports, then how many 3-tile sets and pairs complete the hand. */
export const PASSPORT_COMBOS: { pp: PassportSize[]; threes: number; twos: number }[] = [
  { pp: [5], threes: 3, twos: 0 },
  { pp: [6], threes: 2, twos: 1 },
  { pp: [9], threes: 1, twos: 1 },
  { pp: [5, 6], threes: 1, twos: 0 },
  { pp: [6, 6], threes: 0, twos: 1 },
  { pp: [9, 5], threes: 0, twos: 0 },
];

const allSame = <T,>(xs: T[]) => xs.every((x) => x === xs[0]);
const allDifferent = (xs: number[]) => new Set(xs).size === xs.length;

/** Name of the passport these pieces make, or null. */
export function passportOf(ps: Piece[]): string | null {
  // A declared meld whose kind the caller didn't give can't be judged as part of a passport.
  if (ps.some((p) => p.k[0] < 0)) return null;
  const t = ps.map((p) => p.t);
  if (ps.length === 3 && ps.every(isThree)) {
    if (ps.every(isPung) && ps.every((p) => p.k[0] < 27)) {
      const s = ps.map((p) => suit(p.k[0]));
      if (allDifferent(s)) return '3 Pungs in 3 different suits';
      if (allSame(s)) return '3 Pungs in the same suit';
    }
    if (t.every((x) => x === 'chow')) {
      const s = ps.map((p) => suit(p.k[0]));
      if (allDifferent(s)) return '3 Chows in 3 different suits';
      if (allSame(s)) return '3 Chows in the same suit';
    }
    if (t.every((x) => x === 'crochet')) return '3 Crochets';
    if (t.every((x) => x === 'mchow')) return '3 Mixed Chows';
    return null;
  }
  if (ps.length === 3) {
    if (t.every((x) => x === 'pair') && ps.every((p) => p.k[0] < 27)) {
      const s = ps.map((p) => suit(p.k[0]));
      if (allSame(s)) return '3 Pairs in the same suit';
      if (allDifferent(s)) return '3 Pairs in 3 different suits';
    }
    if (t.every((x) => x === 'knit')) {
      const key = (p: Piece) => `${suit(p.k[0])}${suit(p.k[1])}`;
      if (allSame(ps.map(key))) return '3 Knits in the same 2 suits';
    }
    return null;
  }
  if (ps.length === 1 && t[0] === 'news5') return 'NEWS + another Wind';
  if (ps.length === 2) {
    const [a, b] = ps;
    const one = (x: PieceType, y: PieceType) => (a.t === x && b.t === y ? [a, b] : b.t === x && a.t === y ? [b, a] : null);
    const hp = ps.find(isPung) && ps.find((p) => p.t === 'pair') ? [ps.find(isPung)!, ps.find((p) => p.t === 'pair')!] : null;
    if (hp && isHonor(hp[0].k[0]) && isHonor(hp[1].k[0])) return 'Honour Pung + Honour Pair';
    const gp = one('grw', 'pair');
    if (gp && isHonor(gp[1].k[0])) return 'GRW + Honour Pair';
    if (one('crochet', 'knit')) return 'Crochet + Knit';
  }
  return null;
}

/** All subsets of `ids` of size n. */
function choose(ids: number[], n: number): number[][] {
  const out: number[][] = [];
  const pick = (from: number, cur: number[]) => {
    if (cur.length === n) return void out.push(cur.slice());
    for (let j = from; j < ids.length; j++) {
      cur.push(ids[j]);
      pick(j + 1, cur);
      cur.pop();
    }
  };
  pick(0, []);
  return out;
}

/** Pieces a passport of this size can be made of: [count, filter]. */
const SHAPES_OF: Record<PassportSize, number[]> = { 9: [3], 6: [3], 5: [1, 2] };

export interface IndiaReading {
  pieces: Piece[];
  /** Passports used, by name (empty for a plain 3+3+3+3+2). */
  passports: string[];
  /** For each passport, the indices of its pieces in `pieces`. */
  groups: number[][];
}

/** The pair (or knit) closing a hand: a knit only when the hand holds a crochet. */
const twoOk = (p: Piece, all: Piece[]) => p.t === 'pair' || (p.t === 'knit' && all.some((x) => x.t === 'crochet'));

/** A complete East-round hand from these pieces: plain sets, or a passport combination. */
export function readHand(pieces: Piece[], passportOnly: boolean): IndiaReading | null {
  const threes = pieces.filter(isThree);
  const twos = pieces.filter((p) => p.t === 'pair' || p.t === 'knit');
  const odd = pieces.some((p) => p.t === 'news5' || p.t === 'grw');
  const ids = pieces.map((_, i) => i);
  for (const combo of PASSPORT_COMBOS) {
    const found = fit(pieces, ids, combo.pp, [], [], combo);
    if (found) return { pieces, ...found };
  }
  if (!passportOnly && !odd && threes.length === 4 && twos.length === 1 && twoOk(twos[0], pieces)) return { pieces, passports: [], groups: [] };
  return null;
}

function fit(pieces: Piece[], free: number[], todo: PassportSize[], names: string[], groups: number[][], combo: (typeof PASSPORT_COMBOS)[number]): { passports: string[]; groups: number[][] } | null {
  if (!todo.length) {
    const rest = free.map((i) => pieces[i]);
    if (rest.some((p) => p.t === 'news5' || p.t === 'grw')) return null;
    const threes = rest.filter(isThree);
    const twos = rest.filter((p) => p.t === 'pair' || p.t === 'knit');
    if (threes.length !== combo.threes || twos.length !== combo.twos) return null;
    return twos.every((p) => twoOk(p, pieces)) ? { passports: names, groups } : null;
  }
  const [size, ...more] = todo;
  for (const n of SHAPES_OF[size])
    for (const sub of choose(free, n)) {
      const name = passportOf(sub.map((i) => pieces[i]));
      if (!name) continue;
      const tiles = sub.reduce((a, i) => a + (pieces[i].t === 'kong' ? 3 : pieces[i].k.length), 0);
      if (tiles !== size) continue;
      const got = fit(
        pieces,
        free.filter((i) => !sub.includes(i)),
        more,
        [...names, name],
        [...groups, sub],
        combo,
      );
      if (got) return got;
    }
  return null;
}

/** The best reading of a complete hand (concealed counts + declared melds), or null. */
export function eastReading(counts: number[], melds: MeldShape[], passportOnly: boolean): IndiaReading | null {
  const fixed = melds.map(meldPiece);
  let best: IndiaReading | null = null;
  for (const r of pieceReadings(counts, { chows: true, mixed: true, passports: true })) {
    const got = readHand([...fixed, ...r], passportOnly);
    if (got && (!best || got.passports.length > best.passports.length)) best = got;
  }
  return best;
}

/** The East-round hand as one shape: 3+3+3+3+2 with mixed pieces, or passports. `meldsOf` gives
 *  the seat's declared melds (a call the AI is weighing included), so the distance to a passport can
 *  count them; without it only plain sets are measured. */
export function eastShape(passportOnly: boolean, meldsOf?: () => MeldShape[]): SpecialShape {
  const memo = new Map<string, number>();
  const meter = new PassportMeter();
  return {
    name: passportOnly ? 'Passport' : 'India hand',
    ai: true,
    complete(counts, meldCount, melds) {
      const total = counts.reduce((a, b) => a + b, 0);
      if (total + 3 * meldCount !== 14) return false;
      // Without the melds' kinds, declared melds read as pungs of nothing in particular.
      const known = melds ?? meldsOf?.();
      const ms: MeldShape[] = known && known.length === meldCount ? known : Array.from({ length: meldCount }, () => ({ type: 'pung', kind: -1 }));
      return eastReading(counts, ms, passportOnly) !== null;
    },
    shanten(counts, meldCount) {
      // Plain sets and a pair, plain or mixed (when no passport is needed), or the nearest passport hand.
      const plain = passportOnly ? 99 : Math.min(standardShanten(counts, meldCount), MIXED_SETS.shanten(counts, meldCount), setsShanten(counts, meldCount, 4, true));
      const ms = meldsOf?.();
      if (!ms || ms.length !== meldCount) return plain;
      const key = counts.slice(0, 34).join('') + '|' + ms.map((m) => m.type[0] + m.kind).join(',');
      let v = memo.get(key);
      if (v === undefined) {
        const miss = meter.measure(counts, ms, plain + 1);
        v = Math.min(plain, miss >= 99 ? 99 : miss - 1);
        if (memo.size > 5000) memo.clear();
        memo.set(key, v);
      }
      return v;
    },
  };
}

// ------------------------------------------------------------------ scoring and payments

/** The East round's flat payments: what each player pays the winner, before East doubles it. */
export const EAST_PAY = { normal: 500, concealed: 1000, fully: 2000 };

const meldShapesOf = (melds: Meld[]): MeldShape[] => melds.map((m) => ({ type: m.type, kind: Math.min(...m.tiles.map((t) => t.kind)) }));

export function eastScore(passportOnly: boolean, listPassports = true) {
  return (ctx: ScoringContext): HandScore => {
    const exposed = ctx.melds.some((m) => !m.concealed);
    const items: ScoreItem[] = [];
    if (exposed) items.push({ name: 'Normal hand', value: EAST_PAY.normal, note: 'Each player pays 500; East pays and receives 1000' });
    else if (!ctx.selfDrawn) items.push({ name: 'Concealed hand', value: EAST_PAY.concealed, note: 'Nothing exposed; the winning tile may be a discard' });
    else items.push({ name: 'Fully concealed hand', value: EAST_PAY.fully, note: 'All from the wall, the last tile too' });
    const reading = eastReading(ctx.concealedCounts, meldShapesOf(ctx.melds), passportOnly);
    if (listPassports) for (const p of reading?.passports ?? []) items.push({ name: `Passport: ${p}`, value: 0 });
    const value = items.reduce((a, b) => a + b.value, 0);
    return { value, unit: 'pts', items, points: value, limit: false };
  };
}

/** East always pays and receives double. */
export function indiaPayments(winner: number, _discarder: number | null, s: HandScore, dealer: number, players: number): Payment[] {
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: s.points * (p === dealer || winner === dealer ? 2 : 1) });
  return out;
}

/** Flower and season payments (pp. 8, 14, 32). */
export const FLOWER_PAY = { ownPair: 500, roundPair: 500, mixedBouquet: 500, pureBouquet: 1000 };

/** What one player's flowers and seasons are worth: [reason, amount] lines. */
export function flowerLines(kinds: number[], seat: Wind, prevailing: Wind): [string, number][] {
  const has = (k: number) => kinds.includes(k);
  const pair = (n: number) => has(FLOWER_BASE + n - 1) && has(FLOWER_BASE + 4 + n - 1);
  const out: [string, number][] = [];
  if (pair(WINDS.indexOf(seat) + 1)) out.push(['Own flower and season', FLOWER_PAY.ownPair]);
  // The rulebook's one line, "pair of own or pair of round flowers/seasons": the same pair is paid once.
  if (prevailing !== seat && pair(WINDS.indexOf(prevailing) + 1)) out.push(['Round flower and season', FLOWER_PAY.roundPair]);
  const pure = [0, 4].filter((b) => [0, 1, 2, 3].every((i) => has(FLOWER_BASE + b + i))).length;
  for (let i = 0; i < pure; i++) out.push(['Pure bouquet', FLOWER_PAY.pureBouquet]);
  if (!pure && [0, 1, 2, 3].every((i) => has(FLOWER_BASE + i) || has(FLOWER_BASE + 4 + i))) out.push(['Mixed bouquet', FLOWER_PAY.mixedBouquet]);
  return out;
}

/** Everyone pays each player's flowers and seasons, win or draw; East pays the same as the others. */
export function flowerPayments(info: SettleInfo): Payment[] {
  const out: Payment[] = [];
  for (let s = 0; s < info.players; s++)
    for (const [reason, amount] of flowerLines(info.flowers[s] ?? [], info.seatWinds[s], info.prevailing))
      for (let p = 0; p < info.players; p++) if (p !== s) out.push({ from: p, to: s, amount, reason });
  return out;
}

// ------------------------------------------------------------------ profile

export type IndiaRoundId = 'indiaEast' | 'indiaSouth' | 'indiaWest' | 'indiaNorth';
export const INDIA_ROUND_OF: Partial<Record<Wind, IndiaRoundId>> = { E: 'indiaEast', S: 'indiaSouth', W: 'indiaWest', N: 'indiaNorth' };

/** The rounds a table can play: all four, or one. Only rounds that are built are offered. */
/** Classic (the user, 2026-10-25): the East round's game in every round, without passports. Sets
 *  may be pungs, kongs, chows, mixed chows and crochets; pairs, mixed chows, knits and crochets never
 *  come from a discard, except the tile that makes Mahjong (as in every India Rules round). */
export const CLASSIC = 'C';
/** The rounds built so far, and their names. */
const INDIA_ROUNDS: { wind: Wind; name: string; short: string }[] = [
  { wind: 'E', name: 'East round: Passport', short: 'East' },
  { wind: 'S', name: 'South round: Small Cards', short: 'South' },
  { wind: 'W', name: 'West round: Goulash', short: 'West' },
  { wind: 'N', name: 'North round: East’s choice', short: 'North' },
];
/** Any mix of rounds, always played in wind order: one round alone keeps its full name, a mix
 *  lists the winds ("East, South and West"). Values are the winds' letters, e.g. 'EW'. */
export const INDIA_ROUND_CHOICES: { value: string; label: string; winds: Wind[] }[] = (() => {
  const out: { value: string; label: string; winds: Wind[] }[] = [];
  const n = INDIA_ROUNDS.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const rs = INDIA_ROUNDS.filter((_, i) => mask & (1 << i));
    const names = rs.map((r) => r.short);
    const label = rs.length === 1 ? rs[0].name : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    out.push({ value: rs.map((r) => r.wind).join(''), label, winds: rs.map((r) => r.wind) });
  }
  // Single rounds first, then Classic, then the mixes, longest last.
  out.sort((a, b) => a.winds.length - b.winds.length);
  out.splice(INDIA_ROUNDS.length, 0, { value: CLASSIC, label: 'Classic: the East round’s game without passports, all four rounds', winds: ['E', 'S', 'W', 'N'] });
  return out;
})();

function eastRound(base: RuleProfile, passportOnly: boolean): RuleProfile {
  return {
    ...base,
    windRounds: undefined,
    specialRound: 'indiaEast',
    shapes: { sevenPairs: false, thirteenOrphans: false, standard: false, special: [eastShape(passportOnly)] },
    seatShapes: (_seat, info) => ({ sevenPairs: false, thirteenOrphans: false, standard: false, special: [eastShape(passportOnly, info.melds)] }),
    passportView: (hand, melds) => passportLayout(hand, melds, passportOnly),
    mixedSets: true,
    passportOptional: !passportOnly,
    score: eastScore(passportOnly),
    payments: indiaPayments,
    handPayments: flowerPayments,
    guide: EAST_GUIDE,
  };
}

const EAST_GUIDE: RuleProfile['guide'] = {
  win: ['Four sets and a pair, where a set may be a mixed chow or a crochet, or a passport with sets and a pair.', 'A knit may be the pair only when the hand also holds a crochet.'],
  pay: 'Everyone else pays the winner. East pays and receives double.',
  sections: [
    { title: 'What a win pays', lines: [['Normal hand', 500, 'Something exposed'], ['Concealed hand', 1000, 'Nothing exposed: a Mahjong on a discard still counts as concealed'], ['Fully concealed hand', 2000, 'All from the wall, the last tile too']] },
    {
      title: 'Passports',
      lines: [
        ['9 tiles', '', '3 pungs or 3 chows in 3 suits or one suit, 3 crochets, or 3 mixed chows'],
        ['6 tiles', '', '3 pairs in one suit or 3 suits, or 3 knits in the same 2 suits'],
        ['5 tiles', '', 'An honour pung and honour pair, NEWS and one more wind, Green Red White and an honour pair, or a crochet and a knit'],
      ],
    },
    { title: 'Flowers and seasons', lines: [['Own flower and season', 500, 'Paid by everyone, win or draw'], ['Round flower and season', 500, 'Paid by everyone, win or draw'], ['Mixed bouquet', 500, 'Flowers and seasons numbered 1 to 4'], ['Pure bouquet', 1000, 'All four flowers or all four seasons']] },
  ],
};

const CLASSIC_GUIDE: RuleProfile['guide'] = {
  win: [
    'Four sets and a pair. A set may be a pung, a kong, a chow, a mixed chow or a crochet. No passports.',
    'A knit may be the pair only when the hand also holds a crochet.',
    'Pairs, mixed chows, knits and crochets are never called from a discard: they come from the hand or the wall, except the tile that makes Mahjong.',
  ],
  pay: 'Everyone else pays the winner. East pays and receives double.',
  sections: EAST_GUIDE.sections.filter((x) => x.title !== 'Passports'),
};

const WEST_GUIDE: RuleProfile['guide'] = {
  win: ['Pungs, kongs and one pair only. A clean hand with at least 3 doubles wins: its points are doubled once for each double.', 'Clean: one suit with an honour pung, one suit alone, all honours, honours with terminal pungs of one suit, or 1s and 9s only.'],
  pay: 'Everyone pays the winner, East double. Other clean hands score too, paid by the other losers.',
  sections: [
    { title: 'Points', lines: [['Pung of 2 to 8', '2 / 4', 'Exposed / concealed'], ['Pung of 1s, 9s or honours', '4 / 8', 'Exposed / concealed'], ['Kong of 2 to 8', '8 / 16', 'Exposed / concealed'], ['Kong of 1s, 9s or honours', '16 / 32', 'Exposed / concealed'], ['Flower or season', 4, 'Each'], ['Pair of 1s, 9s or honours', 2, ''], ['Mahjong', 20, 'The winner only']] },
    {
      title: 'Doubles',
      lines: [
        ['Clean suit, all honours, terminal hand', 3, 'Each'],
        ['Dragon pung, own wind, round wind', 1, 'Each'],
        ['Own or round flower and season', 1, 'Each tile'],
        ['Concealed Mahjong', 3, 'Nothing exposed, even when a discard finishes the hand'],
        ['Bouquet', 3, 'All four flowers or all four seasons'],
        ['Heaven’s Blessing', 9, 'East is dealt Mahjong'],
      ],
    },
    { title: 'Penalty', lines: [['Three exposed sets', '', 'If you throw the winning tile to a player with three exposed sets while not calling yourself, you pay for the whole table.']] },
  ],
};

const LIMIT_NAME: Record<Limit, string> = { half: 'Half limit', limit: 'Limit', double: 'Double limit' };

/** A Small Card win: the card's limit, East double (pp. 14-25). */
export function southScore(ctx: ScoringContext): HandScore {
  const own = ctx.card === undefined ? undefined : SMALL_CARDS[ctx.card];
  const none: HandScore = { value: 0, unit: 'pts', items: [], points: 0, limit: false, qualifies: false };
  if (!own || ctx.decomposition.shape !== 'special') return none;
  // A Joker Hand pays another card's value when it makes one (p. 23).
  const made = ctx.decomposition.special === own.name ? own : own.n === 45 ? cardByName(ctx.decomposition.special ?? '') : undefined;
  if (!made) return none;
  const seat = 27 + WINDS.indexOf(ctx.seatWind);
  const round = 27 + WINDS.indexOf(ctx.prevailingWind);
  const melds = meldShapesOf(ctx.melds);
  // Golden Staircase: the honour pung is never taken from a discard, even to Mahjong.
  if (made.n === 24 && !ctx.selfDrawn && ctx.winKind >= 27 && ctx.concealedCounts[ctx.winKind] >= 3) return none;
  const lim = cardValue(made, { concealed: !ctx.melds.some((m) => !m.concealed), counts: ctx.concealedCounts, melds, seat, round });
  const value = Math.max(LIMIT_PAY[lim], own.n === 45 ? LIMIT_PAY.half : 0);
  const items: ScoreItem[] = [{ name: made.name, value, note: `${LIMIT_NAME[lim]}: ${made.how}` }];
  return { value, unit: 'pts', items, points: value, limit: lim !== 'half' };
}

/** Buying the left player's discard costs 100, paid to the next winner (South round rules). */
export const BUY_PRICE = 100;

/** Round 2, South: Small Cards (pp. 12-25). Each seat plays to its own secret card. */
function southRound(base: RuleProfile): RuleProfile {
  return {
    ...base,
    windRounds: undefined,
    specialRound: 'indiaSouth',
    shapes: { sevenPairs: false, thirteenOrphans: false, standard: false, special: [] },
    dealCards: SMALL_CARDS.length,
    cardChoice: 3,
    seatShapes(_seat, info) {
      const card = info.card === undefined ? undefined : SMALL_CARDS[info.card];
      if (!card) return null;
      const own = cardShape(card, info.seatWind, info.prevailing, info.melds);
      // A Joker Hand may also be any other card (checked for the win, not chased by the AI).
      const others = card.n === 45 ? SMALL_CARDS.filter((c) => c !== card).map((c) => ({ ...cardShape(c, info.seatWind, info.prevailing, info.melds), ai: false })) : [];
      return { sevenPairs: false, thirteenOrphans: false, standard: false, special: [own, ...others] };
    },
    claimAllowed(_seat, type, kind, info) {
      const card = info.card === undefined ? undefined : SMALL_CARDS[info.card];
      if (!card) return true;
      if (card.wall) return false;
      return card.claim ? card.claim(type, kind, info.hand, 27 + WINDS.indexOf(info.seatWind)) : true;
    },
    minValue: 0,
    score: southScore,
    payments: indiaPayments,
    handPayments: flowerPayments,
    indiaExchange: true,
    buyFromLeft: BUY_PRICE,
    guide: SOUTH_GUIDE,
  };
}

const SOUTH_GUIDE: RuleProfile['guide'] = {
  win: ['Each player draws a secret Small Card and wins only with the hand it names.', 'Some cards are all from the wall: no discard may be taken, not even to Mahjong.', 'Concealed means nothing exposed: a Mahjong on a discard still counts as concealed.'],
  pay: 'Everyone else pays the winner. East pays and receives double. Flowers and seasons are paid as in the East round.',
  sections: [
    { title: 'What a card pays', lines: [['Half limit', 500, 'East 1000'], ['Limit', 1000, 'East 2000'], ['Double limit', 2000, 'East 4000']] },
    { title: 'The Small Cards', closed: true, lines: SMALL_CARDS.map((c) => [c.name, typeof c.value === 'string' ? LIMIT_NAME[c.value] : '', c.how] as [string, string, string]) },
  ],
};

/** Round 3, West: Goulash (pp. 26-29). Settlement is all hand-end: see indiaWest.ts. */
function westRound(base: RuleProfile): RuleProfile {
  return {
    ...base,
    windRounds: undefined,
    specialRound: 'indiaWest',
    shapes: { sevenPairs: false, thirteenOrphans: false, standard: true, chows: false, special: [] },
    calls: { ...base.calls, chow: false },
    minValue: WEST_MIN_DOUBLES,
    score: westScore,
    payments: () => [],
    handPayments: westPayments,
    indiaExchange: true,
    flowersHidden: true,
    cleanHand: true,
    scoreUnit: 'doubles',
    guide: WEST_GUIDE,
  };
}

// ------------------------------------------------------------------ North

/** The games East may choose in the North round, as codes (they travel in the lockstep log). */
export const NORTH = { east: 0, eastOpen: 1, small: 2, goulash: 10, big: 100 } as const;
/** Goulash with `n`s as jokers (n = 1..9). */
export const northGoulash = (n: number) => NORTH.goulash + n;
export const NUMBER_NAMES = ['1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s'];
/** Big Card `n` (1..29) for the whole table. */
export const northBig = (n: number) => NORTH.big + n;

export const NORTH_CHOICES: { code: number; label: string }[] = [
  { code: NORTH.east, label: 'East round: passport compulsory' },
  { code: NORTH.eastOpen, label: 'East round: passport optional' },
  { code: NORTH.small, label: 'Small Cards with jokers' },
  ...NUMBER_NAMES.map((n, i) => ({ code: northGoulash(i + 1), label: `Goulash with ${n} as jokers` })),
  ...BIG_CARDS.map((c) => ({ code: northBig(c.n), label: `Big Card: ${c.name}` })),
];

/** The Small Cards a North table deals: the double-limit cards (the club's usual way), or all. */
export const DOUBLE_LIMIT_CARDS = SMALL_CARDS.map((c, i) => (c.value === 'double' ? i : -1)).filter((i) => i >= 0);

const FLOWER_KINDS = Array.from({ length: FLOWER_COUNT }, (_, i) => FLOWER_BASE + i);

/** Small Cards with jokers (p. 30): one card each, flowers and seasons are jokers for anything
 *  (kept in hand, not replaced, not paid), the same exchanges and buying as the South round. */
function northSmall(base: RuleProfile): RuleProfile {
  const south = southRound(base);
  return {
    ...south,
    cardChoice: 1,
    dealDeck: base.houseChoices?.northCards === 'all' ? undefined : DOUBLE_LIMIT_CARDS,
    flowersWild: true,
    fixedWilds: FLOWER_KINDS,
    wilds: { inPair: true, inChow: true, inCalls: true, discard: true },
    seatShapes(_seat, info) {
      const card = info.card === undefined ? undefined : SMALL_CARDS[info.card];
      if (!card) return null;
      const own = cardShape(card, info.seatWind, info.prevailing, info.melds, true);
      const others = card.n === 45 ? SMALL_CARDS.filter((c) => c !== card).map((c) => ({ ...cardShape(c, info.seatWind, info.prevailing, info.melds, true), ai: false })) : [];
      return { sevenPairs: false, thirteenOrphans: false, standard: false, special: [own, ...others] };
    },
    // Flowers are jokers this game, so nobody is paid for them.
    handPayments: () => [],
  };
}

/** Goulash with jokers (p. 31): East names a number; that number in each suit is a joker, one of
 *  each per player (a second copy is a natural tile). West round rules and scoring, no buying.
 *  A joker may complete a pung, kong or the pair, but a discard is punged only with a natural pair. */
function northGoulashRound(base: RuleProfile, n: number): RuleProfile {
  return {
    ...westRound(base),
    fixedWilds: [n - 1, 9 + n - 1, 18 + n - 1],
    wildCap: 1,
    // Every set and the pair keep at least one natural tile (the user's ruling, 2026-10-25).
    wilds: { inPair: true, inChow: false, inCalls: false, discard: true, natural: true },
  };
}

/** A Big Card (pp. 31-40): East picks one card and everyone plays to it. Exchanges and buying as
 *  in the South round; calls with natural tiles; kongs, qwongs and runs are laid down with their
 *  extra tiles (game.declareGroup). Flowers are paid only when the card doesn't use them. */
function northBigRound(base: RuleProfile, n: number): RuleProfile {
  const card = bigCardByNumber(n)!;
  const south = southRound(base);
  return {
    ...south,
    specialRound: 'indiaNorth',
    dealCards: undefined,
    cardChoice: undefined,
    dealDeck: undefined,
    claimAllowed: undefined,
    big: card,
    calls: { ...base.calls, chow: true, chowFromLeftOnly: true },
    seatShapes(_seat, info) {
      // For the AI's exchanges and hints: tiles away from the card. Wins go through the card itself.
      const ctx = { seat: 27 + WINDS.indexOf(info.seatWind) };
      const uses = bigUses(card, ctx);
      const memo = new Map<string, number>();
      const shape: SpecialShape = {
        name: card.name,
        how: card.how,
        ai: true,
        uses: (k) => uses.has(k),
        complete: () => false,
        shanten: (counts) => {
          const melds: MInfo[] = info.bigMelds?.() ?? [];
          const kinds: number[] = [];
          counts.forEach((c, k) => {
            for (let i = 0; i < c; i++) kinds.push(k);
          });
          for (let i = info.flowersHeld?.() ?? 0; i > 0; i--) kinds.push(FLOWER_BASE);
          const key = kinds.join(',') + '|' + melds.map((m) => m.type + m.as.join('.')).join(',');
          let v = memo.get(key);
          if (v === undefined) {
            v = bigDistance(card, kinds, melds, ctx) - 1;
            if (memo.size > 3000) memo.clear();
            memo.set(key, v);
          }
          return v;
        },
      };
      return { sevenPairs: false, thirteenOrphans: false, standard: false, special: [shape] };
    },
    handPayments: card.flowers === 'bonus' ? flowerPayments : () => [],
    guide: bigGuide(card),
  };
}

function bigGuide(card: (typeof BIG_CARDS)[number]): RuleProfile['guide'] {
  const flowers = card.flowers === 'joker' ? 'Flowers and seasons are jokers on this card: kept in the hand, not replaced, not paid.' : card.flowers === 'tile' ? 'A flower or season is the 0 on this card: kept in the hand, not replaced, not paid.' : 'Flowers and seasons are set aside, replaced and paid as usual.';
  return {
    win: [`Everyone plays East’s Big Card: ${card.name}. ${card.how}.`, `Jokers: ${card.jokersText}.`, flowers],
    pay: 'Everyone else pays the winner. East pays and receives double.',
    sections: [
      { title: 'What a Big Card pays', lines: [['Normal hand', 1000, 'East 2000'], ['Concealed hand', 2000, 'East 4000: nothing claimed, the last tile may be a discard']] },
      {
        title: 'Laying down',
        lines: [
          ['Kong', card.extras.kong, card.extras.kong ? 'Extra tile from the flower wall' : 'No extra tile on this card'],
          ['Qwong', card.extras.qwong, 'Five of a kind, made with a joker: extra tiles'],
          ['Run', card.extras.run, 'A run of four or more: extra tile'],
          ['Calls', '', 'Pung or kong a discard with natural tiles. A tile you draw or buy can take a joker’s place in a laid-down group; a discard only to go Mahjong.'],
          ['Clean', '', 'A clean set or pair uses no jokers.'],
        ],
      },
      { title: 'The Big Cards', closed: true, lines: BIG_CARDS.map((c) => [`${c.n}. ${c.name}`, '', c.how] as [string, string, string]) },
    ],
  };
}

/** Round 4, North: East's choice (pp. 30-32). Before the choice, the round's own profile (it only
 *  asks East); after it, the profile of the game chosen. */
function northRound(base: RuleProfile, code?: number): RuleProfile {
  if (code === undefined) return { ...eastRound(base, true), specialRound: 'indiaNorth', roundChoices: NORTH_CHOICES, guide: NORTH_GUIDE };
  const chosen = NORTH_CHOICES.find((c) => c.code === code);
  let out: RuleProfile;
  if (code === NORTH.east || code === NORTH.eastOpen) out = eastRound(base, code === NORTH.east);
  else if (code === NORTH.small) out = northSmall(base);
  else if (code > NORTH.goulash && code < NORTH.goulash + 10) out = northGoulashRound(base, code - NORTH.goulash);
  else if (code > NORTH.big && bigCardByNumber(code - NORTH.big)) out = northBigRound(base, code - NORTH.big);
  else out = eastRound(base, true);
  return { ...out, chosenGame: chosen?.label };
}

const NORTH_GUIDE: RuleProfile['guide'] = {
  win: ['Before each deal East chooses the game: the East round, Small Cards with jokers, Goulash with jokers, or a Big Card.', 'Each game is played and paid as in its own round.'],
  pay: 'As in the round East chose. East pays and receives double.',
  sections: [
    {
      title: 'East’s choices',
      lines: [
        ['East round', '', 'Passports, compulsory or optional as East says. No exchange.'],
        ['Small Cards with jokers', '', 'One card each, double-limit cards. Flowers and seasons are jokers, not paid. Exchanges and buying as in the South round.'],
        ['Goulash with jokers', '', 'East names a number before the deal, before seeing any tiles: that number in each suit is a joker, one of each per player. A set or pair may use two jokers but keeps at least one real tile. West round rules and scoring.'],
        ['Big Card', '', 'One card for the whole table. Kongs, qwongs and runs are laid down for extra tiles. Normal hand 1000, concealed 2000. Exchanges and buying as in the South round.'],
      ],
    },
    {
      title: 'What a joker can do',
      lines: [
        ['Goulash: call a pung', '', 'Never with a joker: you need a natural pair in hand.'],
        ['Goulash: other sets', '', 'A joker may finish a pung from the wall, make a kong, the pair, or the pung that wins on a discard.'],
        ['Small Cards', '', 'A joker can be used for anything the card needs, in hand or in a called set.'],
        ['Big Cards', '', 'Only the jokers the card names, where it allows them, never in a clean set or pair. A tile you draw or buy can take a joker’s place in a laid-down group.'],
      ],
    },
  ],
};

export const indiaProfile: RuleProfile = {
  id: 'india',
  name: 'India Rules',
  region: 'India',
  flag: '🇮🇳',
  summary: 'The Indian club game from the club rulebook: 35,000 points each, East pays and receives double, and the East round is played with passports, flowers and seasons.',
  players: 4,
  tileKinds: Array.from({ length: KIND_COUNT }, (_, k) => k),
  copiesPerKind: 4,
  handSize: 13,
  flowers: true,
  calls: { chow: true, pung: true, exposedKong: true, concealedKong: true, addedKong: true, chowFromLeftOnly: true },
  shapes: { sevenPairs: false, thirteenOrphans: false, standard: false, special: [eastShape(true)] },
  minValue: 0,
  rounds: { prevailingWinds: ['E'], seatWindOrder: ['E', 'S', 'W', 'N'], handsPerWind: 4, dealerRetention: 'never', maxHands: 0, lockWinds: true },
  score: eastScore(true),
  payments: indiaPayments,
  handPayments: flowerPayments,
  startingScore: 35000,
  deadWall: 0,
  furiten: false,
  robKong: false,
  endOnBust: false,
  callNames: { chow: 'Chow', pung: 'Pung', kong: 'Kong', win: 'Mahjong', selfDraw: 'Mahjong' },
  yakuRequired: false,
  scoreUnit: 'points',
  felt: '#1f3d5a',
  tableName: 'Bombay Gymkhana',
  windRounds: { E: 'indiaEast' },
  guide: EAST_GUIDE,
  roundRules(id) {
    if (id === 'indiaEast') return eastRound(this, this.houseChoices?.passport !== 'optional');
    if (id === 'indiaSouth') return southRound(this);
    if (id === 'indiaWest') return westRound(this);
    if (id === 'indiaNorth') return northRound(this);
    if (id.startsWith('indiaNorth:')) return northRound(this, Number(id.slice('indiaNorth:'.length)));
    return null;
  },
  houseRules: [
    { id: 'indiaRounds', label: 'Rounds', options: INDIA_ROUND_CHOICES.map((r) => ({ value: r.value, label: r.label })), default: INDIA_ROUND_CHOICES[0].value },
    {
      id: 'passport',
      label: 'Passport in the East round',
      options: [
        { value: 'required', label: 'Compulsory: every win needs a passport' },
        { value: 'optional', label: 'Optional: any 3+3+3+3+2 hand wins' },
      ],
      // The club plays it compulsory (the user, 2026-10-24). New values, so tables saved with the
      // old optional default ('off') start compulsory too.
      default: 'required',
    },
    {
      id: 'northCards',
      label: 'Small Cards in the North round',
      options: [
        { value: 'double', label: 'Double-limit cards only (the usual way)' },
        { value: 'all', label: 'All 55 cards' },
      ],
      default: 'double',
    },
  ],
  configure(c) {
    const pick = INDIA_ROUND_CHOICES.find((r) => r.value === c.indiaRounds) ?? INDIA_ROUND_CHOICES[0];
    if (pick.value === CLASSIC)
      return {
        rounds: { ...indiaProfile.rounds, prevailingWinds: pick.winds },
        windRounds: undefined,
        shapes: { sevenPairs: false, thirteenOrphans: false, standard: false, special: [eastShape(false)] },
        seatShapes: (_seat, info) => ({ sevenPairs: false, thirteenOrphans: false, standard: false, special: [eastShape(false, info.melds)] }),
        score: eastScore(false, false),
        mixedSets: true,
        tableName: 'Bombay Gymkhana',
        guide: CLASSIC_GUIDE,
      };
    const passportOnly = c.passport !== 'optional';
    return {
      rounds: { ...indiaProfile.rounds, prevailingWinds: pick.winds },
      windRounds: Object.fromEntries(pick.winds.map((w) => [w, INDIA_ROUND_OF[w]])),
      shapes: { sevenPairs: false, thirteenOrphans: false, standard: false, special: [eastShape(passportOnly)] },
      score: eastScore(passportOnly),
    };
  },
};

/** Tiles still missing for a hand of 14 (used by tests). */
export const tilesIn = (counts: number[]) => counts.reduce((a, b) => a + b, 0);
