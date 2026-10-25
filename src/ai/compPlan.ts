// The nearest concrete fill of a hand written as components (the India Rules
// Small Cards, indiaCards.ts): which tiles make each piece, which are still
// missing, and which declared melds stand for a piece. JongBot's planner and the
// set-aside sort read it, the same way the passport planner (indiaPassport.ts)
// fills a passport hand.

import type { MeldShape } from '../engine/hand';
import type { Comp } from '../engine/rules/indiaCards';

export interface CompFill {
  /** Fewest tiles still missing (jokers not yet counted). */
  missing: number;
  /** One list per component, as kinds: held tiles first, then the missing ones. */
  pieces: number[][];
  /** For each piece, how many of its tiles (the last ones) are still missing. */
  gaps: number[];
  /** For each piece, whether a declared meld makes it. */
  fromMeld: boolean[];
  /** Missing tiles, as kinds (one entry per tile). */
  need: number[];
}

export interface CompRules {
  /** Pairs must be different kinds. */
  distinct?: boolean;
  /** Kongs can't stand for a pung. */
  noKong?: boolean;
}

/** Fill `comps` from the tiles held, trying the few cheapest options for each component. Every
 *  declared meld must stand for a component; returns null when they can't. */
export function fillComps(comps: Comp[], counts: number[], melds: MeldShape[], rules: CompRules = {}, beam = 4): CompFill | null {
  const left = counts.slice(0, 34);
  const usedMeld = melds.map(() => false);
  const wanted = new Array(34).fill(0);
  const pieces: number[][] = [];
  const gaps: number[] = [];
  const fromMeld: boolean[] = [];
  const need: number[] = [];
  const pairs: number[] = [];
  let best: CompFill | null = null;
  const go = (i: number, minOpt: number, miss: number) => {
    if (best && miss >= best.missing) return;
    if (i === comps.length) {
      if (!usedMeld.every(Boolean)) return;
      best = { missing: miss, pieces: pieces.map((x) => x.slice()), gaps: gaps.slice(), fromMeld: fromMeld.slice(), need: need.slice() };
      return;
    }
    const comp = comps[i];
    const start = i > 0 && comps[i - 1].id === comp.id ? minOpt : 0;
    let same = 1;
    while (i + same < comps.length && comps[i + same].id === comp.id) same++;
    const scored: { o: number; m: number; meld: number }[] = [];
    for (let o = start; o < comp.opts.length; o++) {
      const opt = comp.opts[o];
      if (opt.meld) {
        const j = melds.findIndex((x, n) => !usedMeld[n] && x.kind === opt.meld!.kind && (opt.meld!.type === 'chow' ? x.type === 'chow' : x.type === 'pung' || (x.type === 'kong' && !rules.noKong)));
        if (j >= 0) {
          scored.push({ o, m: 0, meld: j });
          continue;
        }
      }
      const isPair = opt.tiles.length === 2 && opt.tiles[0] === opt.tiles[1];
      if (rules.distinct && isPair && pairs.includes(opt.tiles[0])) continue;
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
    // A run of identical components (seven pairs) takes options in order: widen the beam to cover it.
    for (const s of scored.slice(0, Math.max(beam, same > 1 ? same + 2 : beam))) {
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
      const isPair = opt.tiles.length === 2 && opt.tiles[0] === opt.tiles[1];
      if (isPair) pairs.push(opt.tiles[0]);
      pieces.push([...took, ...short]);
      gaps.push(short.length);
      fromMeld.push(false);
      need.push(...short);
      go(i + 1, s.o, miss + short.length);
      need.length -= short.length;
      fromMeld.pop();
      gaps.pop();
      pieces.pop();
      if (isPair) pairs.pop();
      for (const k of opt.tiles) wanted[k]--;
      for (const k of took) left[k]++;
    }
  };
  go(0, 0, 0);
  return best;
}
