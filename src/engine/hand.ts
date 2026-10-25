// Variant-neutral hand analysis over 34-kind count arrays:
// standard (sets + pair) decomposition, seven pairs, thirteen orphans,
// shanten (tiles away from ready) and waits. Rule profiles decide which
// shapes are legal; this module only answers structural questions.

import { JOKER_KIND, KIND_COUNT, NUMBER_JOKER, isHonor, isSuited, isTerminalOrHonor, wildCovers, wildTargets } from './tiles';

export type SetShape =
  | { type: 'pung'; kind: number }
  | { type: 'chow'; kind: number } // lowest kind of the run
  | { type: 'pair'; kind: number };

export interface Decomposition {
  shape: 'standard' | 'sevenPairs' | 'thirteenOrphans' | 'special';
  /** Name of the profile's special shape when shape is 'special'. */
  special?: string;
  /** Sets formed from concealed tiles (excludes declared melds). */
  sets: SetShape[];
  pair: number;
}

const TERMINALS_HONORS = Array.from({ length: KIND_COUNT }, (_, k) => k).filter(isTerminalOrHonor);

/** Every way to split concealed counts into `need` sets + one pair. */
export function standardDecompositions(counts: number[], need: number, chows = true): Decomposition[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total !== need * 3 + 2) return [];
  const out: Decomposition[] = [];
  const c = counts.slice();
  for (let p = 0; p < KIND_COUNT; p++) {
    if (c[p] < 2) continue;
    c[p] -= 2;
    const sets: SetShape[] = [];
    const walk = (i: number) => {
      while (i < KIND_COUNT && c[i] === 0) i++;
      if (i === KIND_COUNT) {
        out.push({ shape: 'standard', sets: sets.slice(), pair: p });
        return;
      }
      if (c[i] >= 3) {
        c[i] -= 3;
        sets.push({ type: 'pung', kind: i });
        walk(i);
        sets.pop();
        c[i] += 3;
      }
      if (chows && isSuited(i) && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
        c[i]--, c[i + 1]--, c[i + 2]--;
        sets.push({ type: 'chow', kind: i });
        walk(i);
        sets.pop();
        c[i]++, c[i + 1]++, c[i + 2]++;
      }
    };
    walk(0);
    c[p] += 2;
  }
  return out;
}

export function isSevenPairs(counts: number[]): boolean {
  let pairs = 0;
  for (const n of counts) {
    if (n === 2) pairs++;
    else if (n !== 0) return false;
  }
  return pairs === 7;
}

export function isThirteenOrphans(counts: number[]): boolean {
  let pair = false;
  for (let k = 0; k < KIND_COUNT; k++) {
    const n = counts[k];
    if (isTerminalOrHonor(k)) {
      if (n === 0 || n > 2) return false;
      if (n === 2) {
        if (pair) return false;
        pair = true;
      }
    } else if (n !== 0) return false;
  }
  return pair;
}

export interface ShapeRules {
  sevenPairs: boolean;
  thirteenOrphans: boolean;
  /** Sets needed besides the pair: 4 for 13-tile games, 5 for 16-tile Taiwanese. Default 4. */
  sets?: number;
  /** Profile-specific whole-hand shapes (e.g. a club card's sixteen orphans). */
  special?: SpecialShape[];
  /** False: sets and a pair is not a winning shape here, only the special shapes are (a card round). Default true. */
  standard?: boolean;
  /** False: no chows anywhere, concealed ones included (a goulash round). Default true. */
  chows?: boolean;
}

/** A declared meld as hand analysis sees it (lowest kind for a chow). */
export interface MeldShape {
  type: 'pung' | 'chow' | 'kong';
  kind: number;
}

export interface SpecialShape {
  name: string;
  /** A complete hand: concealed counts (winning tile included) with this many declared melds.
   *  `melds` names them when the caller knows them (shapes whose patterns span melds use it). */
  complete(counts: number[], meldCount: number, melds?: MeldShape[], jokers?: number): boolean;
  /** Tiles away from ready, as shanten counts it (-1 complete, 0 ready). */
  shanten(counts: number[], meldCount: number): number;
  /** The AI's fast shanten tracks this shape too (cheap shapes only). */
  ai?: boolean;
  /** An all-pairs shape: while short of kinds, any new tile can help it (the AI widens its search). */
  pairs?: boolean;
  /** A cheap lower bound on shanten(): the shape is skipped when it can't beat the best so far. */
  bound?(counts: number[], meldCount: number): number;
  /** Kinds this shape can use at all (a card hand): the AI lets the others go first. */
  uses?(kind: number): boolean;
  /** One line describing the hand, for advice ("Four pungs of 1s and 9s ..."). */
  how?: string;
  /** Jokers may stand in anywhere (India Rules North cards): complete() gets the natural tiles and
   *  the number of jokers, shanten() the naturals (wildShanten takes a tile off for each joker). */
  wilds?: boolean;
}

/** All winning readings of a concealed portion given the number of declared melds. */
export function winningDecompositions(counts: number[], meldCount: number, rules: ShapeRules, melds?: MeldShape[]): Decomposition[] {
  const out = rules.standard === false ? [] : standardDecompositions(counts, (rules.sets ?? 4) - meldCount, rules.chows !== false);
  if (meldCount === 0) {
    if (rules.sevenPairs && isSevenPairs(counts)) out.push({ shape: 'sevenPairs', sets: [], pair: -1 });
    if (rules.thirteenOrphans && isThirteenOrphans(counts)) out.push({ shape: 'thirteenOrphans', sets: [], pair: -1 });
  }
  for (const sp of rules.special ?? []) if (sp.complete(counts, meldCount, melds)) out.push({ shape: 'special', special: sp.name, sets: [], pair: -1 });
  return out;
}

// ---------------------------------------------------------------- shanten

// Each suit (and the honours) is analysed on its own: we list every
// reachable (sets, partials, pair) combination for that group, memoised
// by the group's count pattern, then combine the four groups.
type GroupOpt = [sets: number, partials: number, pair: number];
// Memo per table: honours (7), suits, suits read without chows; numeric keys.
const groupMemo = [new Map<number, GroupOpt[]>(), new Map<number, GroupOpt[]>(), new Map<number, GroupOpt[]>()];

/** Options for counts[from .. from + n). */
function groupAt(counts: number[], from: number, n: number, suited: boolean): GroupOpt[] {
  let key = 0;
  for (let i = 0; i < n; i++) key = key * 9 + Math.min(8, counts[from + i]);
  const m = groupMemo[suited ? 1 : n === 9 ? 2 : 0];
  const hit = m.get(key);
  if (hit) return hit;
  const opts = groupOptions(counts.slice(from, from + n), suited);
  if (m.size > 50_000) m.clear();
  m.set(key, opts);
  return opts;
}

function groupOptions(c: number[], suited: boolean): GroupOpt[] {
  const found = new Set<number>();
  const n = c.length;
  const walk = (i: number, sets: number, partials: number, pair: number) => {
    while (i < n && c[i] === 0) i++;
    if (i === n) {
      found.add(sets * 100 + Math.min(partials, 8) * 10 + pair);
      return;
    }
    if (c[i] >= 3) {
      c[i] -= 3;
      walk(i, sets + 1, partials, pair);
      c[i] += 3;
    }
    if (suited && i <= n - 3 && c[i + 1] && c[i + 2]) {
      c[i]--, c[i + 1]--, c[i + 2]--;
      walk(i, sets + 1, partials, pair);
      c[i]++, c[i + 1]++, c[i + 2]++;
    }
    if (c[i] >= 2) {
      c[i] -= 2;
      if (!pair) walk(i, sets, partials, 1);
      walk(i, sets, partials + 1, pair);
      c[i] += 2;
    }
    if (suited && i <= n - 2 && c[i + 1]) {
      c[i]--, c[i + 1]--;
      walk(i, sets, partials + 1, pair);
      c[i]++, c[i + 1]++;
    }
    if (suited && i <= n - 3 && c[i + 2]) {
      c[i]--, c[i + 2]--;
      walk(i, sets, partials + 1, pair);
      c[i]++, c[i + 2]++;
    }
    const keep = c[i];
    c[i] = 0;
    walk(i + 1, sets, partials, pair);
    c[i] = keep;
  };
  walk(0, 0, 0, 0);
  // Keep only options not dominated by another with the same pair flag.
  const all = [...found].map((v) => [Math.floor(v / 100), Math.floor(v / 10) % 10, v % 10] as GroupOpt);
  const opts = all.filter((a) => !all.some((b) => b !== a && b[2] === a[2] && b[0] >= a[0] && b[0] + b[1] >= a[0] + a[1] && (b[0] > a[0] || b[0] + b[1] > a[0] + a[1])));
  return opts;
}

/**
 * Standard-hand shanten: -1 = complete, 0 = ready (tenpai), n = n tiles away.
 * Works for 13- or 14-tile concealed portions (minus 3 per declared meld).
 */
export function standardShanten(counts: number[], meldCount: number, need = 4, chows = true): number {
  const groups = [
    groupAt(counts, 0, 9, chows),
    groupAt(counts, 9, 9, chows),
    groupAt(counts, 18, 9, chows),
    groupAt(counts, 27, 7, false),
  ];
  let best = 2 * need;
  const combine = (g: number, sets: number, partials: number, pair: number) => {
    if (g === 4) {
      const usable = Math.min(partials, need - sets);
      const s = 2 * need - 2 * sets - Math.max(0, usable) - pair;
      if (s < best) best = s;
      return;
    }
    for (const [gs, gp, gpair] of groups[g]) {
      if (gpair && pair) continue;
      combine(g + 1, sets + gs, partials + gp, pair | gpair);
    }
  };
  combine(0, meldCount, 0, 0);
  return best;
}

export function sevenPairsShanten(counts: number[]): number {
  let pairs = 0;
  let kinds = 0;
  for (const n of counts) {
    if (n >= 2) pairs++;
    if (n >= 1) kinds++;
  }
  return 6 - pairs + Math.max(0, 7 - kinds);
}

export function thirteenOrphansShanten(counts: number[]): number {
  let kinds = 0;
  let pair = 0;
  for (const k of TERMINALS_HONORS) {
    if (counts[k] >= 1) kinds++;
    if (counts[k] >= 2) pair = 1;
  }
  return 13 - kinds - pair;
}

/**
 * Shanten towards `need` sets (declared melds included) with or without a pair,
 * for a hand that also holds other fixed tiles (a passport, a card hand's
 * required sets). Never below what the tiles held allow.
 */
export function setsShanten(counts: number[], meldCount: number, need: number, pair = true, chows = true): number {
  const groups = [
    groupAt(counts, 0, 9, chows),
    groupAt(counts, 9, 9, chows),
    groupAt(counts, 18, 9, chows),
    groupAt(counts, 27, 7, false),
  ];
  let best = 2 * need + 1;
  const combine = (g: number, sets: number, partials: number, pr: number) => {
    if (g === 4) {
      const usable = Math.min(partials, need - sets);
      const s = 2 * need - 2 * sets - Math.max(0, usable) - (pair ? pr : 1);
      if (s < best) best = s;
      return;
    }
    for (const [gs, gp, gpair] of groups[g]) {
      if (gpair && (pr || !pair)) continue;
      combine(g + 1, sets + gs, partials + gp, pr | gpair);
    }
  };
  combine(0, meldCount, 0, 0);
  const held = counts.reduce((a, b) => a + b, 0);
  const required = 3 * (need - meldCount) + (pair ? 2 : 0);
  return Math.max(best, required - held - 1);
}

export function shanten(counts: number[], meldCount: number, rules: ShapeRules): number {
  let s = rules.standard === false ? 99 : standardShanten(counts, meldCount, rules.sets ?? 4, rules.chows !== false);
  if (meldCount === 0) {
    if (rules.sevenPairs) s = Math.min(s, sevenPairsShanten(counts));
    if (rules.thirteenOrphans) s = Math.min(s, thirteenOrphansShanten(counts));
  }
  for (const sp of rules.special ?? []) if (!sp.bound || sp.bound(counts, meldCount) < s) s = Math.min(s, sp.shanten(counts, meldCount));
  return s;
}

/** Kinds that would complete a ready (13-tile) concealed portion. */
export function waits(counts: number[], meldCount: number, rules: ShapeRules, melds?: MeldShape[]): number[] {
  const out: number[] = [];
  for (let k = 0; k < KIND_COUNT; k++) {
    if (counts[k] >= 4) continue;
    counts[k]++;
    if (winningDecompositions(counts, meldCount, rules, melds).length) out.push(k);
    counts[k]--;
  }
  return out;
}

// ---------------------------------------------------------------- wilds
//
// Asian jokers (Vietnamese Khung, Indian club jokers) stand in for tiles in a
// sets-and-a-pair hand. A reading says which tile each wild stands for, so the
// profile's ordinary scoring sees a plain hand. Wilds are never part of seven
// pairs or thirteen orphans here.

export interface WildShape {
  /** A wild may complete the pair. */
  inPair: boolean;
  /** A wild may stand in a chow. */
  inChow: boolean;
  /** Every set and the pair hold at least one natural tile (no group of wilds alone). */
  natural?: boolean;
}

export interface WildReading {
  decomposition: Decomposition;
  /** Concealed counts with every wild counted as the tile it stands for. */
  counts: number[];
  /** [wild kind, kind it stands for] for each wild in the concealed part. */
  assigned: [number, number][];
}

/** Every winning reading of naturals plus wilds (concealed part only). */
export function wildDecompositions(counts: number[], wilds: number[], meldCount: number, rules: ShapeRules, spec: WildShape, melds?: MeldShape[]): WildReading[] {
  if (!wilds.length) return winningDecompositions(counts, meldCount, rules, melds).map((d) => ({ decomposition: d, counts, assigned: [] }));
  // Shapes that take jokers anywhere read the naturals alone; each joker stands for itself.
  const special: WildReading[] = [];
  for (const sp of rules.special ?? [])
    if (sp.wilds && sp.complete(counts, meldCount, melds, wilds.length)) special.push({ decomposition: { shape: 'special', special: sp.name, sets: [], pair: -1 }, counts, assigned: wilds.map((w) => [w, w]) });
  if (rules.standard === false) return special;
  const need = (rules.sets ?? 4) - meldCount;
  const total = counts.reduce((a, b) => a + b, 0) + wilds.length;
  if (need < 0 || total !== need * 3 + 2) return special;
  const c = counts.slice();
  const pool = wilds.slice().sort((a, b) => a - b);
  const used = pool.map(() => false);
  const sets: SetShape[] = [];
  const assigned: [number, number][] = [];
  const out: WildReading[] = [];
  const seen = new Set<string>();
  let pair = -1;
  // Kinds worth trying for a set or pair made of wilds alone: honours, plus one
  // kind from the hand's main suit (the natural tiles decide what is useful).
  const suitTally = [0, 0, 0];
  for (let k = 0; k < 27; k++) suitTally[Math.floor(k / 9)] += counts[k];
  const mainSuit = suitTally.indexOf(Math.max(...suitTally));
  const candidates = (targets: number[]) => targets.filter((t) => isHonor(t) || t === mainSuit * 9 + 4 || (t < 27 && !targets.includes(mainSuit * 9 + 4) && t % 9 === 4));

  const emit = () => {
    const eff = counts.slice();
    for (const [, as] of assigned) eff[as]++;
    if (eff.some((n) => n > 4 + wilds.length)) return;
    const key = sets.map((x) => x.type[1] + x.kind).sort().join() + '|' + pair + '|' + assigned.map((a) => a.join(':')).sort().join();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ decomposition: { shape: 'standard', sets: sets.slice(), pair }, counts: eff, assigned: assigned.slice() });
  };

  /** Choose `n` unused wilds covering `target`, as distinct kind combinations. */
  const pick = (target: number, n: number, from: number, cb: () => void) => {
    if (n === 0) return cb();
    let last = -1;
    for (let i = from; i < pool.length; i++) {
      if (used[i] || pool[i] === last || !wildCovers(pool[i], target)) continue;
      last = pool[i];
      used[i] = true;
      assigned.push([pool[i], target]);
      pick(target, n - 1, i + 1, cb);
      assigned.pop();
      used[i] = false;
    }
  };

  /** Groups made only of wilds, once every natural tile is placed. */
  const wildOnly = (setsLeft: number, pairLeft: boolean) => {
    const i = used.indexOf(false);
    if (i < 0) {
      if (setsLeft === 0 && !pairLeft) emit();
      return;
    }
    if (spec.natural) return;
    const tryGroup = (size: number, then: () => void, kind: 'pung' | 'pair') => {
      used[i] = true;
      for (const t of candidates(wildTargets(pool[i]))) {
        assigned.push([pool[i], t]);
        pick(t, size - 1, i + 1, () => {
          if (kind === 'pung') sets.push({ type: 'pung', kind: t });
          else pair = t;
          then();
          if (kind === 'pung') sets.pop();
          else pair = -1;
        });
        assigned.pop();
      }
      used[i] = false;
    };
    if (setsLeft > 0) tryGroup(3, () => wildOnly(setsLeft - 1, pairLeft), 'pung');
    if (pairLeft && spec.inPair) tryGroup(2, () => wildOnly(setsLeft, false), 'pair');
  };

  const walk = (i: number, setsLeft: number, pairLeft: boolean) => {
    while (i < KIND_COUNT && c[i] === 0) i++;
    if (i === KIND_COUNT) return wildOnly(setsLeft, pairLeft);
    // Pung: three naturals, or naturals topped up with wilds.
    if (setsLeft > 0)
      for (let nat = Math.min(3, c[i]); nat >= 1; nat--) {
        c[i] -= nat;
        pick(i, 3 - nat, 0, () => {
          sets.push({ type: 'pung', kind: i });
          walk(i, setsLeft - 1, pairLeft);
          sets.pop();
        });
        c[i] += nat;
      }
    // Chow with `i` as its lowest natural; wilds fill missing places.
    if (setsLeft > 0 && isSuited(i) && rules.chows !== false) {
      const base = i - (i % 9);
      for (let start = Math.max(base, i - 2); start <= Math.min(i, base + 6); start++) {
        const members = [start, start + 1, start + 2];
        const forced = members.filter((m) => m !== i && (m < i || c[m] === 0));
        // A higher member held as a natural may still be filled by a wild, keeping
        // the natural for another group (e.g. the pair when wilds can't pair).
        const optional = spec.inChow ? members.filter((m) => m > i && c[m] > 0) : [];
        for (let mask = 0; mask < 1 << optional.length; mask++) {
          const wildAt = [...forced, ...optional.filter((_, b) => mask & (1 << b))];
          if (wildAt.length && !spec.inChow) continue;
          const naturals = members.filter((m) => !wildAt.includes(m));
          for (const m of naturals) c[m]--;
          const fill = (j: number) => {
            if (j === wildAt.length) {
              sets.push({ type: 'chow', kind: start });
              walk(i, setsLeft - 1, pairLeft);
              sets.pop();
              return;
            }
            pick(wildAt[j], 1, 0, () => fill(j + 1));
          };
          if (naturals.every((m) => c[m] >= 0)) fill(0);
          for (const m of naturals) c[m]++;
        }
      }
    }
    // Pair: two naturals, or one natural and a wild.
    if (pairLeft) {
      if (c[i] >= 2) {
        c[i] -= 2;
        pair = i;
        walk(i, setsLeft, false);
        pair = -1;
        c[i] += 2;
      }
      if (spec.inPair) {
        c[i]--;
        pick(i, 1, 0, () => {
          pair = i;
          walk(i, setsLeft, false);
          pair = -1;
        });
        c[i]++;
      }
    }
  };
  walk(0, need, true);
  return special.length ? [...out, ...special] : out;
}

/**
 * Shanten with wilds in hand. A joker that may be any tile (or any suited
 * tile) is one tile closer for free; a wind or dragon joker is tried as each
 * tile it may be. Never below what the tile count allows (0 for a 13-tile
 * hand, -1 for 14). `base` lets the AI pass its faster shanten.
 */
export function wildShanten(counts: number[], wilds: number[], meldCount: number, rules: ShapeRules, base: (c: number[], m: number, r: ShapeRules) => number = shanten): number {
  if (!wilds.length) return base(counts, meldCount, rules);
  let free = 0;
  const c = counts.slice();
  for (const w of wilds) {
    if (w === JOKER_KIND || w === NUMBER_JOKER) {
      free++;
      continue;
    }
    let bestK = -1;
    let bestS = Infinity;
    for (const t of wildTargets(w)) {
      if (c[t] >= 4) continue;
      c[t]++;
      const s = base(c, meldCount, rules);
      c[t]--;
      if (s < bestS) {
        bestS = s;
        bestK = t;
      }
    }
    if (bestK >= 0) c[bestK]++;
  }
  const total = counts.reduce((a, b) => a + b, 0) + wilds.length;
  const floor = total % 3 === 2 ? -1 : 0;
  // 99 means no shape can be reached at all; a free joker doesn't change that.
  const s = base(c, meldCount, rules);
  return s >= 99 ? s : Math.max(floor, s - free);
}

/** Natural kinds that complete a ready hand holding wilds. */
export function wildWaits(counts: number[], wilds: number[], meldCount: number, rules: ShapeRules, spec: WildShape, melds?: MeldShape[]): number[] {
  if (!wilds.length) return waits(counts, meldCount, rules, melds);
  const out: number[] = [];
  for (let k = 0; k < KIND_COUNT; k++) {
    if (counts[k] >= 4) continue;
    counts[k]++;
    if (wildDecompositions(counts, wilds, meldCount, rules, spec).length) out.push(k);
    counts[k]--;
  }
  return out;
}
