// Special wind rounds, as Indian and Dubai home tables play them: each
// prevailing wind brings its own kind of hand.
//
//   East   Passport round    every win holds a passport (5, 6 or 9 different
//                            tiles), or two: 5 + 6, 6 + 6 or 9 + 5
//   South  Small Card round  win with one hand from the Small Card
//   West   Goulash round     East chooses 1 or 3 exchanges between players and
//                            1 or 3 exchanges with the wall (three tiles each);
//                            no chows; at least 3 doubles to win
//   North  Big Card round    win with one hand from the Big Card
//
// Mumbai and Kolkata clubs give each round its own rules ("special hands",
// "goulash", drawn cards of hands); the exact cards differ from club to club.
// The Small and Big cards here are JongClub's own, built from hands those
// tables use. Card hands are concealed: no calls except the winning one.
// The round framework stays configurable: a profile names the round per wind
// in `windRounds`, and the game swaps in roundOverlay() for that wind.

import type { Wind } from '../tiles';
import { BIG_CARD, SMALL_CARD, cardShapes, passportName, passportShape, passportUsed, PASSPORT_COMBOS, type CardHand, type NinePassport } from './special';
import { flowerItems } from './flowerFaan';
import type { HandScore, RuleProfile, ScoreItem, ScoringContext } from './types';

export type SpecialRoundId = 'passport' | 'smallCard' | 'goulash' | 'bigCard' | 'indiaEast' | 'indiaSouth' | 'indiaWest' | 'indiaNorth';

/** The usual order: East passports, South small card, West goulash, North big card. */
export const SPECIAL_ROUND_ORDER: Record<Wind, SpecialRoundId> = { E: 'passport', S: 'smallCard', W: 'goulash', N: 'bigCard' };

export const SPECIAL_ROUNDS: Record<SpecialRoundId, { name: string; rule: string }> = {
  passport: { name: 'Passport round', rule: 'Every win needs a passport: 5 or 6 different winds and dragons, or 1 to 9 of one suit. Two passports (5 + 6, 6 + 6, 9 + 5) score more.' },
  smallCard: { name: 'Small Card round', rule: 'Win only with a hand from the Small Card. Card hands are concealed: you may claim a tile only to win.' },
  goulash: { name: 'Goulash round', rule: 'East chooses 1 or 3 exchanges between players, then 1 or 3 exchanges with the wall. No chows, and you need at least 3 doubles to win.' },
  bigCard: { name: 'Big Card round', rule: 'Win only with a hand from the Big Card. Card hands are concealed: you may claim a tile only to win.' },
  // India Rules' own rounds (india.ts builds them; these are their names and one-line rules).
  indiaEast: { name: 'East round: Passport', rule: 'Four sets and a pair, where a set may be a mixed chow or a crochet, or a passport with sets and a pair.' },
  indiaSouth: { name: 'South round: Small Cards', rule: 'Each player draws a secret Small Card and wins only with the hand it names. East pays and receives double.' },
  indiaWest: { name: 'West round: Goulash', rule: 'Pungs, kongs and one pair only. A clean hand with at least 3 doubles wins: its points are doubled once for each double.' },
  indiaNorth: { name: 'North round: East’s choice', rule: 'Before each deal East chooses the game: the East round, Small Cards with jokers, Goulash with jokers, or a Big Card.' },
};

/** Doubles needed to win a goulash round hand. */
export const GOULASH_ROUND_MIN = 3;

const LIMIT = 8;
const BASE = 16;

function total(items: ScoreItem[], unit = 'faan'): HandScore {
  const value = Math.min(items.reduce((a, b) => a + b.value, 0), LIMIT);
  return { value, unit, items, points: BASE * 2 ** value, limit: value >= LIMIT };
}

const nineOf = (p: RuleProfile) => (p.houseChoices?.passportNine ?? 'straight') as NinePassport;

function passportScore(nine: NinePassport) {
  return (ctx: ScoringContext): HandScore => {
    const combo = passportUsed(ctx.concealedCounts, ctx.melds.length, PASSPORT_COMBOS, nine) ?? [5];
    const value = combo.length > 1 ? 3 : combo[0] === 9 ? 2 : 1;
    const items: ScoreItem[] = [{ name: passportName(combo), value }];
    if (ctx.selfDrawn) items.push({ name: 'Self-drawn', value: 1 });
    if (!ctx.melds.some((m) => !m.concealed)) items.push({ name: 'Concealed hand', value: 1 });
    items.push(...flowerItems(ctx));
    return total(items);
  };
}

function cardScore(card: CardHand[]) {
  return (ctx: ScoringContext): HandScore => {
    const hand = card.find((h) => h.name === ctx.decomposition.special);
    if (!hand) return { ...total([]), qualifies: false };
    const items: ScoreItem[] = [{ name: hand.name, value: hand.value }];
    if (ctx.selfDrawn) items.push({ name: 'Self-drawn', value: 1 });
    items.push(...flowerItems(ctx));
    return total(items);
  };
}

const NO_CALLS = { chow: false, pung: false, exposedKong: false, concealedKong: false, addedKong: false };

/** The profile a table plays under a special round. */
export function roundOverlay(base: RuleProfile, id: string): RuleProfile {
  const own = base.roundRules?.(id);
  if (own) return own;
  const nine = nineOf(base);
  const out: RuleProfile = { ...base, windRounds: undefined, specialRound: id };
  switch (id as SpecialRoundId) {
    case 'passport':
      out.shapes = { ...base.shapes, standard: false, sevenPairs: false, thirteenOrphans: false, special: [passportShape('Passport', PASSPORT_COMBOS, nine)] };
      out.score = passportScore(nine);
      break;
    case 'smallCard':
    case 'bigCard': {
      const card = id === 'smallCard' ? SMALL_CARD : BIG_CARD;
      out.shapes = { ...base.shapes, standard: false, sevenPairs: false, thirteenOrphans: false, special: cardShapes(card, nine) };
      out.calls = { ...base.calls, ...NO_CALLS };
      out.score = cardScore(card);
      break;
    }
    case 'goulash':
      out.shapes = { ...base.shapes, chows: false, special: (base.shapes.special ?? []).filter((s) => s.name !== 'Mixed sets') };
      out.calls = { ...base.calls, chow: false };
      out.minValue = Math.max(base.minValue, GOULASH_ROUND_MIN);
      out.roundExchange = true;
      break;
  }
  return out;
}

/** The card a card round plays from (null for other rounds). */
export const cardOf = (p: RuleProfile): CardHand[] | null => (p.specialRound === 'smallCard' ? SMALL_CARD : p.specialRound === 'bigCard' ? BIG_CARD : null);

/** House rules for a profile that offers the special wind rounds. */
export const SPECIAL_ROUND_RULES: RuleProfile['houseRules'] = [
  {
    id: 'specialRounds',
    label: 'Special wind rounds',
    options: [
      { value: 'off', label: 'Off: every round plays the same' },
      { value: 'on', label: 'On: East passports, South small card, West goulash, North big card' },
    ],
    default: 'off',
  },
  {
    id: 'passportNine',
    label: '9-tile passport',
    options: [
      { value: 'straight', label: '1 to 9 of one suit' },
      { value: 'knitted', label: 'Knitted: 1-4-7, 2-5-8, 3-6-9 in three suits' },
      { value: 'orphans', label: 'Nine different ones, nines, winds and dragons' },
    ],
    default: 'straight',
  },
];
