// Mixed hands: patterns built from the same numbers across the three suits.
//   Mixed Triple Chow    123 Characters + 123 Dots + 123 Bamboo
//   Mixed Shifted Chows  123 + 234 + 345, one run in each suit
//   Mixed Triple Pung    555 in all three suits
//   Mixed Shifted Pungs  444 + 555 + 666, one pung in each suit
//   Mixed Triple Pair    the same number paired in all three suits (an all-pairs hand)
// These exist in formal rulesets (MCR's Mixed Triple Chow, Mixed Shifted Chows,
// Triple Pung, Mixed Shifted Pungs; Riichi's sanshoku doujun and doukou; the
// Dubai club card's sister pongs and sheungs). Faan and tai games that do not
// list them offer them as a house rule ("Mixed hands"), scored by the values
// passed in. Each family (chows, pungs) counts once: the bigger pattern wins.

import { isSuited } from '../tiles';
import type { ScoreItem } from './types';

export interface MixedSet {
  type: 'pung' | 'chow' | 'kong';
  /** Lowest kind of a chow, the kind of a pung or kong. */
  kind: number;
}

export interface MixedValues {
  tripleChow: number;
  shiftedChows: number;
  triplePung: number;
  shiftedPungs: number;
  triplePair: number;
}

/** Faan values used by Classic, Hong Kong, Dubai Asian and Indian tables. */
export const MIXED_FAAN: MixedValues = { tripleChow: 1, shiftedChows: 1, triplePung: 2, shiftedPungs: 1, triplePair: 1 };
/** Tai values used by Taiwanese (tai scoring). */
export const MIXED_TAI: MixedValues = { tripleChow: 2, shiftedChows: 1, triplePung: 2, shiftedPungs: 1, triplePair: 1 };

export const MIXED_NAMES = {
  tripleChow: 'Mixed Triple Chow',
  shiftedChows: 'Mixed Shifted Chows',
  triplePung: 'Mixed Triple Pung',
  shiftedPungs: 'Mixed Shifted Pungs',
  triplePair: 'Mixed Triple Pair',
} as const;

const suit = (k: number) => Math.floor(k / 9);
const rank = (k: number) => k % 9;

/** Is there one item per suit with ranks r, r+step, r+2*step (step 0 = same rank) in some suit order? */
function acrossSuits(bySuit: number[][], step: number): boolean {
  const orders = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
  for (const r of bySuit[0].concat(bySuit[1], bySuit[2])) {
    for (const o of orders) if ([0, 1, 2].every((i) => bySuit[o[i]].includes(r + i * step))) return true;
  }
  return false;
}

/** Mixed chow and pung patterns among a hand's sets (declared and concealed). */
export function mixedSetItems(sets: MixedSet[], v: MixedValues): ScoreItem[] {
  const out: ScoreItem[] = [];
  const chows: number[][] = [[], [], []];
  const pungs: number[][] = [[], [], []];
  for (const s of sets) {
    if (!isSuited(s.kind)) continue;
    (s.type === 'chow' ? chows : pungs)[suit(s.kind)].push(rank(s.kind));
  }
  if (acrossSuits(chows, 0)) out.push({ name: MIXED_NAMES.tripleChow, value: v.tripleChow, note: 'The same run in all three suits' });
  else if (acrossSuits(chows, 1)) out.push({ name: MIXED_NAMES.shiftedChows, value: v.shiftedChows, note: 'Runs one step apart, one in each suit' });
  if (acrossSuits(pungs, 0)) out.push({ name: MIXED_NAMES.triplePung, value: v.triplePung, note: 'The same number in all three suits' });
  else if (acrossSuits(pungs, 1)) out.push({ name: MIXED_NAMES.shiftedPungs, value: v.shiftedPungs, note: 'Numbers one step apart, one in each suit' });
  return out;
}

/** Mixed Triple Pair in an all-pairs hand: once for each number paired in all three suits. */
export function mixedPairItems(counts: number[], v: MixedValues): ScoreItem[] {
  let times = 0;
  for (let r = 0; r < 9; r++) if ([0, 1, 2].every((s) => counts[s * 9 + r] >= 2)) times++;
  if (!times) return [];
  return [{ name: times > 1 ? `${MIXED_NAMES.triplePair} × ${times}` : MIXED_NAMES.triplePair, value: v.triplePair * times, note: 'The same number paired in all three suits' }];
}

/** The house rule that turns mixed hands on or off, with the profile's default. */
export function mixedHandsRule(def: 'on' | 'off') {
  return {
    id: 'mixedHands',
    label: 'Mixed hands',
    options: [
      { value: 'on', label: 'Scored: matching or stepped sets across the three suits' },
      { value: 'off', label: 'Not scored' },
    ],
    default: def,
  };
}
