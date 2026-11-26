// Chinese Classical: the hand you are going for, chosen above your rack (user, 2026-11-20: "the
// grouping of sets can also be selected by the user if he is going for a special set like orphan
// hand or 7 pairs"). Sets and a pair is the default and groups as before; Seven Pairs pulls your
// pairs to the left; Thirteen Orphans pulls out your ones, nines, winds and dragons. Only hands the
// table allows are offered, and the special hands only while nothing is claimed.

import type { MahjongGame } from '../engine/game';
import { sevenPairsShanten, standardShanten, thirteenOrphansShanten } from '../engine/hand';
import { KIND_COUNT, isTerminalOrHonor } from '../engine/tiles';
import type { TargetKit, TargetPlan } from './targets';

export const SHAPE_SETS = 'sets';
export const SHAPE_PAIRS = 'sevenPairs';
export const SHAPE_ORPHANS = 'thirteenOrphans';

/** Chinese Classical tables (not a special wind round, which has its own kit). */
export const shapeKitOn = (g: MahjongGame) => (g.profile.base ?? g.profile.id) === 'classic' && !g.profile.specialRound && !g.profile.card && !g.profile.dealCards;

const ORPHAN_GROUPS: number[][] = [
  [0, 8],
  [9, 17],
  [18, 26],
  [27, 28, 29, 30],
  [31, 32, 33],
];

function counts(g: MahjongGame, seat: number, without?: number): number[] {
  const c = g.concealedCounts(seat).slice(0, KIND_COUNT);
  if (without !== undefined && c[without] > 0) c[without]--;
  return c;
}

/** Seven Pairs: the pairs you hold, each set aside; the singles that could pair up next are what it needs. */
export function pairsPlan(c: number[]): TargetPlan {
  const pairs: number[] = [];
  for (let k = 0; k < KIND_COUNT && pairs.length < 7; k++) if (c[k] >= 2) pairs.push(k);
  const singles: number[] = [];
  for (let k = 0; k < KIND_COUNT && pairs.length + singles.length < 7; k++) if (c[k] === 1) singles.push(k);
  const pieces = pairs.map((k) => [k, k]);
  return {
    key: SHAPE_PAIRS,
    names: ['Seven Pairs'],
    how: 'Seven different pairs, nothing claimed',
    missing: sevenPairsShanten(c) + 1,
    pieces,
    gaps: pieces.map(() => 0),
    fromMeld: pieces.map(() => false),
    need: singles,
  };
}

/** Thirteen Orphans: ones and nines by suit, then winds, then dragons; the first doubled one is the pair. */
export function orphansPlan(c: number[]): TargetPlan {
  const pairKind = ORPHAN_GROUPS.flat().find((k) => c[k] >= 2);
  const pieces: number[][] = [];
  const gaps: number[] = [];
  const need: number[] = [];
  for (const grp of ORPHAN_GROUPS) {
    const held = grp.filter((k) => c[k] > 0);
    const miss = grp.filter((k) => c[k] === 0);
    if (pairKind !== undefined && grp.includes(pairKind)) held.splice(held.indexOf(pairKind) + 1, 0, pairKind);
    pieces.push([...held, ...miss]);
    gaps.push(miss.length);
    need.push(...miss);
  }
  return {
    key: SHAPE_ORPHANS,
    names: ['Thirteen Orphans'],
    how: 'One of each one, nine, wind and dragon, plus any one of them again',
    missing: thirteenOrphansShanten(c) + 1,
    pieces,
    gaps,
    fromMeld: pieces.map(() => false),
    need,
  };
}

export const shapeKit: TargetKit = {
  id: 'shape',
  chip: 'Group for',
  list: 'Hands you can group for',
  groupOff: 'Group sets',
  groupOn: 'Sets grouped ✓',
  tipOff: 'Pull complete sets (three of a kind or a run of three) to the left, spaced apart, so you can see what is still loose.',
  tipOn: 'Complete sets are pulled to the left and spaced apart. Tap to stop grouping.',
  chipTip: 'Group your rack for this hand',
  plans(g, s, without) {
    const c = counts(g, s, without);
    const melds = g.players[s].melds.length;
    const shapes = g.shapesFor(s);
    // Sets and a pair first: it is the default and groups your rack as before.
    const out: TargetPlan[] = [{ key: SHAPE_SETS, names: ['Sets and a pair'], missing: standardShanten(c, melds) + 1, pieces: [], gaps: [], fromMeld: [], need: [] }];
    if (melds === 0 && shapes.sevenPairs) out.push(pairsPlan(c));
    // Worth showing once you hold a few ones, nines, winds and dragons.
    if (melds === 0 && shapes.thirteenOrphans && c.filter((n, k) => n > 0 && isTerminalOrHonor(k)).length >= 5) out.push(orphansPlan(c));
    return out;
  },
};
