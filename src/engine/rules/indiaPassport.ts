// India Rules, East round: how far a hand is from a passport win, for the AI and
// JongBot (docs/variants/india-rules.md, pp. 9-11). The win test itself is
// eastReading in india.ts; this only measures distance, so the AI and the hints
// can tell which sets keep a passport within reach and which shut every one out.
//
// Each passport combination is written as components, as the Small Cards are
// (indiaCards.ts), and the distance is the fewest tiles still missing.

import { setsShanten, type MeldShape } from '../hand';
import { Ch, Cr, F, HONOURS, Kn, Mx, One, P, Pr, WINDS_K, missing, suitTiles, type Comp } from './indiaCards';

const SUITS = [0, 1, 2];
const GD = 32, RD = 31, WD = 33;

const x3 = (c: Comp) => [c, c, c];

/** A passport: its name (as india.ts passportOf names it) and its components. */
interface Pass {
  name: string;
  comps: Comp[];
}
const pass = (name: string, comps: Comp[]): Pass => ({ name, comps });

const NINES: Pass[] = [
  pass('3 Pungs in 3 different suits', SUITS.map((s) => P(suitTiles(s)))),
  ...SUITS.map((s) => pass('3 Pungs in the same suit', x3(P(suitTiles(s))))),
  pass('3 Chows in 3 different suits', SUITS.map((s) => Ch([s]))),
  ...SUITS.map((s) => pass('3 Chows in the same suit', x3(Ch([s])))),
  pass('3 Crochets', x3(Cr())),
  pass('3 Mixed Chows', x3(Mx())),
];
const SIXES: Pass[] = [
  ...SUITS.map((s) => pass('3 Pairs in the same suit', x3(Pr(suitTiles(s))))),
  pass('3 Pairs in 3 different suits', SUITS.map((s) => Pr(suitTiles(s)))),
  ...([[0, 1], [0, 2], [1, 2]] as [number, number][]).map((p) => pass('3 Knits in the same 2 suits', x3(Kn([p])))),
];
const FIVES: Pass[] = [
  pass('Honour Pung + Honour Pair', [P(HONOURS), Pr(HONOURS)]),
  pass('NEWS + another Wind', [F(...WINDS_K), One(WINDS_K)]),
  pass('GRW + Honour Pair', [F(GD, RD, WD), Pr(HONOURS)]),
  pass('Crochet + Knit', [Cr(), Kn()]),
];

/** A passport hand: the passports, then how many sets (pung, chow, mixed chow, crochet) and pairs. */
export interface PassportHand {
  pass: Comp[];
  /** The passports' names, in order. */
  names: string[];
  sets: number;
  pair: boolean;
}
const hand = (ps: Pass[], sets: number, pair: boolean): PassportHand => ({ pass: ps.flatMap((p) => p.comps), names: ps.map((p) => p.name), sets, pair });
/** Every passport hand in the book's combinations (5+3+3+3, 6+3+3+2, 9+3+2, 5+6+3, 6+6+2, 9+5). */
export const PASSPORT_HANDS: PassportHand[] = [
  ...FIVES.map((f) => hand([f], 3, false)),
  ...SIXES.map((s) => hand([s], 2, true)),
  ...NINES.map((n) => hand([n], 1, true)),
  ...FIVES.flatMap((f) => SIXES.map((s) => hand([f, s], 1, false))),
  ...SIXES.flatMap((a, i) => SIXES.slice(i).map((b) => hand([a, b], 0, true))),
  ...NINES.flatMap((n) => FIVES.map((f) => hand([n, f], 0, false))),
];

const PLAIN = { noKong: false, distinct: false };

/** Fewest tiles missing for any passport hand (99 when none can be made with these melds). */
export function passportMissing(counts: number[], melds: MeldShape[], budget = 99): number {
  return new PassportMeter().measure(counts, melds, budget);
}

/** passportMissing for a run of nearby hands, as the AI asks while it weighs discards and draws.
 *  Taking tiles away never brings a hand closer, and each tile added brings it at most one closer, so
 *  exact answers for one reference hand bound every hand within two tiles of it, and most passport
 *  hands are skipped without a search. */
export class PassportMeter {
  private ref: { counts: number[]; melds: string; miss: number[]; min: number } | null = null;

  measure(counts: number[], melds: MeldShape[], budget = 99): number {
    const c = counts.slice(0, 34);
    const key = melds.map((m) => m.type[0] + m.kind).join(',');
    let d = 99;
    let added = 0;
    if (this.ref && this.ref.melds === key) {
      d = 0;
      added = 0;
      for (let k = 0; k < 34 && d <= 2; k++) {
        const x = c[k] - this.ref.counts[k];
        d += Math.abs(x);
        if (x > 0) added += x;
      }
    }
    if (d > 2) {
      // Hands within two tiles are asked with about the same budget: past budget + 2 a hand never
      // gets searched again, so a search cut off there is bound enough. The nearest are searched
      // first so the cut-off tightens.
      let cap = budget >= 99 ? 99 : budget + 2;
      const miss = PASSPORT_HANDS.map(() => cap);
      for (let i = 0; i < PASSPORT_HANDS.length; i++) {
        miss[i] = price(PASSPORT_HANDS[i], c, melds, cap);
        if (budget >= 99 && miss[i] < 99) cap = Math.min(cap, miss[i] + 4);
      }
      this.ref = { counts: c, melds: key, miss, min: Math.min(...miss) };
      return Math.min(budget, this.ref.min);
    }
    const ref = this.ref!;
    let best = budget;
    if (ref.min - added >= best) return best;
    for (let i = 0; i < PASSPORT_HANDS.length; i++) if (ref.miss[i] - added < best) best = price(PASSPORT_HANDS[i], c, melds, best);
    return best;
  }
}

/** Tiles missing for one passport hand: its passports filled from the tiles held, and the sets and
 *  pair beside them priced as plain sets (melds not in a passport count as sets). */
function price(h: PassportHand, c: number[], melds: MeldShape[], budget: number): number {
  const rest = (left: number[], meldsLeft: number) => (meldsLeft > h.sets ? 99 : setsShanten(left, meldsLeft, h.sets, h.pair) + 1);
  return missing(h.pass, c, melds, PLAIN, budget, rest, 2);
}


// ------------------------------------------------------------------ planner (JongBot)

/** One passport hand the player can still make, for JongBot's planner and the passport sort. */
export interface PassportPlan {
  /** The passports, by name ('3 Pungs in 3 different suits'). */
  names: string[];
  /** Sets (pung, chow, mixed chow, crochet) and pair needed beside the passports. */
  sets: number;
  pair: boolean;
  /** Fewest tiles still missing for the whole hand (0 = complete with the last tile). */
  missing: number;
  /** The passport tiles: one list per piece, each as kinds; held tiles first. */
  pieces: number[][];
  /** For each piece, how many of its tiles (the last ones) are still missing. */
  gaps: number[];
  /** For each piece, whether a declared meld makes it (its tiles are on the table, not in the hand). */
  fromMeld: boolean[];
  /** Tiles the passports still need, as kinds (one entry per tile). */
  need: number[];
  /** Declared melds this plan uses for its passports (indices into the melds). */
  meldsUsed: number[];
}

/** The passport hands nearest to these tiles, best first, one plan per distinct passport set-up.
 *  `limit` plans at most; hands more than `slack` tiles behind the best are left out. */
export function passportPlans(counts: number[], melds: MeldShape[], limit = 5, slack = 3): PassportPlan[] {
  const c = counts.slice(0, 34);
  const out: PassportPlan[] = [];
  for (const h of PASSPORT_HANDS) {
    const p = planFor(h, c, melds);
    if (p) out.push(p);
  }
  out.sort((a, b) => a.missing - b.missing || a.need.length - b.need.length);
  const best = out[0]?.missing ?? 99;
  const seen = new Set<string>();
  const kept: PassportPlan[] = [];
  for (const p of out) {
    if (p.missing > best + slack || p.missing >= 99) break;
    const key = p.names.join('+') + '|' + p.pieces.map((x) => x.join('.')).join('/');
    const nameKey = p.names.join('+');
    // One plan per passport name set: the nearest way of making it.
    if (seen.has(nameKey) || seen.has(key)) continue;
    seen.add(nameKey);
    kept.push(p);
    if (kept.length >= limit) break;
  }
  return kept;
}

/** The nearest concrete fill of one passport hand: the passport pieces chosen (a few options per
 *  piece, nearest first), then the sets and pair beside them priced as plain sets. */
function planFor(h: PassportHand, c: number[], melds: MeldShape[]): PassportPlan | null {
  const left = c.slice();
  const usedMeld = melds.map(() => false);
  const pieces: number[][] = [];
  const gaps: number[] = [];
  const fromMeld: boolean[] = [];
  const need: number[] = [];
  const wanted = new Array(34).fill(0);
  let best: PassportPlan | null = null;
  const go = (i: number, minOpt: number, miss: number) => {
    if (best && miss >= best.missing) return;
    if (i === h.pass.length) {
      const meldsLeft = usedMeld.filter((u) => !u).length;
      if (meldsLeft > h.sets) return;
      const rest = setsShanten(left, meldsLeft, h.sets, h.pair) + 1;
      const total = miss + rest;
      if (!best || total < best.missing) best = { names: h.names, sets: h.sets, pair: h.pair, missing: total, pieces: pieces.map((x) => x.slice()), gaps: gaps.slice(), fromMeld: fromMeld.slice(), need: need.slice(), meldsUsed: usedMeld.flatMap((u, j) => (u ? [j] : [])) };
      return;
    }
    const comp = h.pass[i];
    const start = i > 0 && h.pass[i - 1].id === comp.id ? minOpt : 0;
    const scored: { o: number; m: number; meld: number }[] = [];
    for (let o = start; o < comp.opts.length; o++) {
      const opt = comp.opts[o];
      if (opt.meld) {
        const j = melds.findIndex((m, x) => !usedMeld[x] && m.type === opt.meld!.type && m.kind === opt.meld!.kind);
        if (j >= 0) {
          scored.push({ o, m: 0, meld: j });
          continue;
        }
      }
      let m = 0;
      let bad = false;
      const tally = new Map<number, number>();
      for (const k of opt.tiles) tally.set(k, (tally.get(k) ?? 0) + 1);
      for (const [k, n] of tally) {
        if (wanted[k] + n > 4) bad = true;
        m += Math.max(0, n - left[k]);
      }
      if (!bad) scored.push({ o, m, meld: -1 });
    }
    scored.sort((a, b) => a.m - b.m);
    for (const s of scored.slice(0, 4)) {
      const opt = comp.opts[s.o];
      if (s.meld >= 0) {
        usedMeld[s.meld] = true;
        pieces.push(opt.tiles.slice());
        gaps.push(0);
        fromMeld.push(true);
        go(i + 1, s.o, miss);
        fromMeld.pop();
        gaps.pop();
        pieces.pop();
        usedMeld[s.meld] = false;
        continue;
      }
      const took: number[] = [];
      const short: number[] = [];
      for (const k of opt.tiles) {
        wanted[k]++;
        if (left[k] > 0) {
          left[k]--;
          took.push(k);
        } else short.push(k);
      }
      pieces.push([...took, ...short]);
      gaps.push(short.length);
      fromMeld.push(false);
      need.push(...short);
      go(i + 1, s.o, miss + s.m);
      need.length -= short.length;
      fromMeld.pop();
      gaps.pop();
      pieces.pop();
      for (const k of opt.tiles) wanted[k]--;
      for (const k of took) left[k]++;
    }
  };
  go(0, 0, 0);
  return best;
}
