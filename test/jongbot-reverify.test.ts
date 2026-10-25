// Re-verification of JongBot after the audit fixes. Each test asserts the CORRECT advice.
import { describe, expect, it } from 'vitest';
import { onTurn } from './audit-helpers';
import { turnHint } from '../src/ai/jongbot';

// Seven pairs with a value-honour pung: throwing one of the three makes the hand ready (seven pairs,
// single wait), and being ready dominates staying 1 away (any later draw can still switch the single).
// JongBot keeps the pung and says "Go for seven pairs ... 1 tile from ready, 111 tiles improve".
// Suspected: src/ai/strategy.ts planDiscard: the 1-away candidate gets roughValue (~40, from the
// honour pung) as +15*log2(value), while the ready candidate gets only live(3) + 12*min(value,3)
// + 2*shapeBonus(-4), so the slower discard wins. The value counted is for a pung seven pairs must break.
describe('seven pairs: break the honour pung to be ready', () => {
  const allHonours = 'E Rd S Gd Wd S E Gd Wd Rd 7s 8m 7s Rd';
  for (const [variation, house, windIndex] of [
    ['classic', {}, 0],
    ['hongkong', {}, 0],
    ['uae', {}, 0],
    ['uae', { specialRounds: 'on' }, 2],
    ['riichi', {}, 0],
  ] as const) {
    it(`${variation} ${JSON.stringify(house)}: EE SS GdGd WdWd RdRdRd 7s7s 8m -> discard the Red Dragon`, () => {
      const g = onTurn({ variation, house: house as Record<string, string>, windIndex, hand: allHonours });
      expect(turnHint(g, 0, 'advanced').headline).toMatch(/[Dd]iscard the Red Dragon\.$/); // JongBot: "Discard the 8 Character."
    });
  }
  it('riichi dealer: 11m 33m 55p 77p 99s EEE 2m -> throw an East (seven-pairs ready)', () => {
    const g = onTurn({ variation: 'riichi', hand: '1m 1m 3m 3m 5p 5p 7p 7p 9s 9s E E E 2m' });
    expect(turnHint(g, 0, 'advanced').focusKind).toBe(27); // JongBot: "Discard the 2 Character", 1 tile from ready
  });
  it('uae goulash round: 11m 33m 55p 77p 99s EEE 2m -> throw an East', () => {
    const g = onTurn({ variation: 'uae', house: { specialRounds: 'on' }, windIndex: 2, hand: '1m 1m 3m 3m 5p 5p 7p 7p 9s 9s E E E 2m' });
    expect(turnHint(g, 0, 'advanced').focusKind).toBe(27); // JongBot: 2 Character
  });
});
