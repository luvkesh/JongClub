// Special suit (Classic house rule `specialSuit`, off by default): the host
// names one of the three suits for the match. Each pung or kong in that suit
// scores 1 faan, like a dragon pung, and a one-suit hand (Mixed or Pure One
// Suit) made in that suit scores 1 faan more. Asked for by the user
// (2026-11-17: "an option where the user can select a Special suit"); the
// scoring is the reading recommended to them while the decision was open.

import { isSuited, suitOf, type Suit } from '../tiles';
import type { RuleProfile, ScoreItem } from './types';

type HouseRule = RuleProfile['houseRules'][number];

export const SPECIAL_SUIT = 'specialSuit';
export type SpecialSuit = Extract<Suit, 'man' | 'pin' | 'sou'>;

/** Classic's suit names, as the lessons and scoring guide use them. */
export const SPECIAL_SUIT_NAMES: Record<SpecialSuit, string> = { man: 'Characters', pin: 'Dots', sou: 'Bamboo' };

export const SPECIAL_SUIT_RULE: HouseRule = {
  id: SPECIAL_SUIT,
  label: 'Special suit',
  options: [
    { value: 'off', label: 'None' },
    { value: 'man', label: 'Characters' },
    { value: 'pin', label: 'Dots' },
    { value: 'sou', label: 'Bamboo' },
  ],
  default: 'off',
};

/** The table's special suit, or null when the house rule is off. */
export function specialSuitOf(house?: Record<string, string>): SpecialSuit | null {
  const v = house?.[SPECIAL_SUIT];
  return v === 'man' || v === 'pin' || v === 'sou' ? v : null;
}

/** True when `kind` is a tile of the table's special suit. */
export function inSpecialSuit(house: Record<string, string> | undefined, kind: number): boolean {
  const s = specialSuitOf(house);
  return !!s && isSuited(kind) && suitOf(kind) === s;
}

/**
 * The special suit's score lines for a winning hand.
 * @param pungKinds the kind of every pung and kong in the hand (declared and concealed)
 * @param oneSuit the hand's only suit when it is a one-suit hand, else null
 */
export function specialSuitItems(house: Record<string, string> | undefined, pungKinds: number[], oneSuit: Suit | null): ScoreItem[] {
  const s = specialSuitOf(house);
  if (!s) return [];
  const items: ScoreItem[] = [];
  for (const k of pungKinds) if (isSuited(k) && suitOf(k) === s) items.push({ name: 'Special suit pung', value: 1, note: 'A pung or kong in the special suit' });
  if (oneSuit === s) items.push({ name: 'Special suit hand', value: 1, note: 'A one-suit hand in the special suit' });
  return items;
}
