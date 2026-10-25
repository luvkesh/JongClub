import { describe, expect, it } from 'vitest';
import { pairsRoute } from '../src/ai/jongbot';
import { MahjongGame } from '../src/engine/game';
import { shanten, winningDecompositions } from '../src/engine/hand';
import { getProfile, withHouseRules } from '../src/engine/rules';
import { classicProfile } from '../src/engine/rules/classic';
import { hongKongProfile } from '../src/engine/rules/hongkong';
import { MIXED_NAMES } from '../src/engine/rules/mixed';
import { singaporeProfile } from '../src/engine/rules/singapore';
import { LI_GU_NAME, taiwaneseProfile } from '../src/engine/rules/taiwanese';
import { vietnameseProfile } from '../src/engine/rules/vietnamese';
import type { RuleProfile, ScoringContext } from '../src/engine/rules/types';
import type { Meld } from '../src/engine/state';
import { parseKinds, toCounts } from '../src/engine/tiles';

const k = (s: string) => parseKinds(s)[0];

function best(P: RuleProfile, hand: string, win: string, opts: Partial<ScoringContext> = {}, melds: Meld[] = []) {
  const counts = toCounts(parseKinds(hand));
  const decomps = winningDecompositions(counts, melds.length, P.shapes);
  expect(decomps.length, hand).toBeGreaterThan(0);
  const house = P.houseChoices;
  const scores = decomps.map((d) =>
    P.score({ decomposition: d, melds, concealedCounts: counts, winKind: k(win), selfDrawn: false, seatWind: 'S', prevailingWind: 'E', isDealer: false, lastTileOfWall: false, afterKong: false, dealerRepeat: 0, house, ...opts }),
  );
  return scores.sort((a, b) => b.points - a.points)[0];
}
const names = (s: { items: { name: string }[] }) => s.items.map((i) => i.name);

describe('mixed hands', () => {
  const C = classicProfile;
  it('Classic scores the mixed triple chow and pung patterns by default', () => {
    expect(names(best(C, '123m 123p 123s 789m 55p', '5p'))).toContain(MIXED_NAMES.tripleChow);
    expect(names(best(C, '123m 234p 345s 789m 55p', '5p'))).toContain(MIXED_NAMES.shiftedChows);
    expect(names(best(C, '555m 555p 555s 789m 11p', '1p'))).toContain(MIXED_NAMES.triplePung);
    expect(names(best(C, '444m 555s 666p 789m 11p', '1p'))).toContain(MIXED_NAMES.shiftedPungs);
    // Two suits only, or a gap of two, is not a mixed pattern.
    expect(names(best(C, '123m 123p 456s 789m 55p', '5p')).filter((n) => n.startsWith('Mixed'))).toEqual([]);
    expect(names(best(C, '123m 345p 567s 789m 55p', '5p')).filter((n) => n.startsWith('Mixed'))).toEqual([]);
  });

  it('counts declared sets too, and the bigger pattern of a family once', () => {
    const chow = (spec: string): Meld => ({ type: 'chow', tiles: parseKinds(spec).map((kind, i) => ({ id: 600 + i + kind * 4, kind })), concealed: false, from: 3 });
    const s = best(C, '123p 123s 234s 55p', '5p', {}, [chow('123m')]);
    expect(names(s)).toContain(MIXED_NAMES.tripleChow);
    expect(names(s)).not.toContain(MIXED_NAMES.shiftedChows);
  });

  it('Mixed Triple Pair in an all-pairs hand', () => {
    const s = best(C, '22m 22p 22s 55m 77p 99s EE', 'E');
    expect(names(s)).toContain('Seven Pairs');
    expect(names(s)).toContain(MIXED_NAMES.triplePair);
    const twice = best(C, '22m 22p 22s 55m 55p 55s EE', 'E');
    expect(names(twice)).toContain(`${MIXED_NAMES.triplePair} × 2`);
  });

  it('the host can turn mixed hands off, and Hong Kong has them off unless chosen', () => {
    const off = withHouseRules(C, { mixedHands: 'off' });
    expect(names(best(off, '123m 123p 123s 789m 55p', '5p'))).not.toContain(MIXED_NAMES.tripleChow);
    expect(names(best(hongKongProfile, '123m 123p 123s 789m 55p', '5p'))).not.toContain(MIXED_NAMES.tripleChow);
    expect(names(best(withHouseRules(hongKongProfile, { mixedHands: 'on' }), '123m 123p 123s 789m 55p', '5p'))).toContain(MIXED_NAMES.tripleChow);
  });

  it('every Dubai Asian and Indian table offers the rule, on by default', () => {
    for (const id of ['uae', 'uae-custom', 'indian', 'classic']) {
      const p = getProfile(id)!;
      expect(p.houseRules.find((r) => r.id === 'mixedHands')?.default, id).toBe('on');
      expect(names(best(p, '555m 555p 555s 789m 11p', '1p')), id).toContain(MIXED_NAMES.triplePung);
    }
  });

  it('Taiwanese offers mixed hands in tai as a choice', () => {
    const on = withHouseRules(taiwaneseProfile, { mixedHands: 'on' });
    expect(names(best(on, '123m 123p 123s 456m 789m 55p', '5p'))).toContain(MIXED_NAMES.tripleChow);
    expect(names(best(taiwaneseProfile, '123m 123p 123s 456m 789m 55p', '5p'))).not.toContain(MIXED_NAMES.tripleChow);
  });
});

describe('all-pairs hands', () => {
  it('Taiwanese wins on Lì Gǔ Lì Gǔ: seven pairs and a pung, concealed', () => {
    const hand = '11m 22m 33p 44p 55s 66s EE 999p';
    const s = best(taiwaneseProfile, hand, '9p');
    expect(names(s)).toContain(LI_GU_NAME);
    expect(s.items.find((i) => i.name === LI_GU_NAME)!.value).toBe(8);
    expect(names(s)).not.toContain('Concealed hand');
    // Ready one tile away, and the house can turn it off.
    const ready = toCounts(parseKinds('11m 22m 33p 44p 55s 66s EE 99p'));
    expect(shanten(ready, 0, taiwaneseProfile.shapes)).toBe(0);
    const off = withHouseRules(taiwaneseProfile, { liGu: 'off' });
    expect(winningDecompositions(toCounts(parseKinds(hand)), 0, off.shapes).some((d) => d.special === 'liGu')).toBe(false);
  });

  it('Singapore and Vietnamese allow seven pairs when the host turns it on', () => {
    const hand = '11m 22m 33p 44p 55s 66s EE';
    expect(winningDecompositions(toCounts(parseKinds(hand)), 0, singaporeProfile.shapes).length).toBe(0);
    const sg = withHouseRules(singaporeProfile, { sevenPairs: 'on' });
    const s = best(sg, hand, 'E');
    expect(names(s)).toContain('Seven Pairs');
    expect(names(s)).not.toContain('Ping Hu');
    const vn = withHouseRules(vietnameseProfile, { sevenPairs: 'on' });
    const v = best(vn, hand, 'E');
    expect(names(v)).toContain('Seven Pairs');
    expect(names(v)).not.toContain('All chows (Ù phình)');
  });

  it('JongBot names the pairs road when it is shorter', () => {
    const g = new MahjongGame(classicProfile, ['A', 'B', 'C', 'D'], 7);
    const pl = g.players[0];
    const kinds = parseKinds('11m 22m 33p 44p 55s 66s 9m N');
    pl.hand = kinds.map((kind, i) => ({ id: 1000 + i, kind }));
    pl.melds = [];
    expect(pairsRoute(g, 0, k('N'))).toBe('seven pairs');
  });

  it('the AI chases Lì Gǔ Lì Gǔ (its shanten counts the pairs hand)', () => {
    const counts = toCounts(parseKinds('11m 22m 33p 44p 55s 66s EE 9p 1s'));
    expect(shanten(counts, 0, taiwaneseProfile.shapes)).toBeLessThanOrEqual(1);
  });
});

describe('scoring guide', () => {
  it('has a guide for every variation, matching its house rules', async () => {
    const { guideFor } = await import('../src/ui/scoringGuideData');
    const { VARIATIONS } = await import('../src/engine/rules');
    for (const v of VARIATIONS) {
      const g = guideFor(v.profile!);
      expect(g.win.length, v.id).toBeGreaterThan(1);
      expect(g.sections.length || g.card, v.id).toBeTruthy();
    }
    const titles = (p: RuleProfile) => guideFor(p).sections.map((s) => s.title);
    expect(titles(classicProfile)).toContain('Mixed hands');
    expect(titles(withHouseRules(classicProfile, { mixedHands: 'off' }))).not.toContain('Mixed hands');
    expect(titles(taiwaneseProfile)).toContain('All-pairs hands');
    expect(guideFor(withHouseRules(taiwaneseProfile, { scoring: 'dubai' })).card).toBe('dubai');
    // The guide's values agree with the scorer for the mixed lines.
    const mixed = guideFor(classicProfile).sections.find((s) => s.title === 'Mixed hands')!;
    const s = best(classicProfile, '555m 555p 555s 789m 11p', '1p');
    expect(s.items.find((i) => i.name === MIXED_NAMES.triplePung)!.value).toBe(mixed.lines.find((l) => l.name === MIXED_NAMES.triplePung)!.value);
  });

  it('draws real tiles for the sets, pairs and special hands', async () => {
    const { anatomy, pictureFor, specialShapes } = await import('../src/ui/scoringGuideData');
    expect(anatomy(classicProfile).map((a) => a.kind)).toEqual(['chow', 'pung', 'kong', 'chow', 'pair']);
    expect(pictureFor('Seven Pairs')!.flatMap(parseKinds)).toHaveLength(14);
    expect(pictureFor('Thirteen Orphans')!.flatMap(parseKinds)).toHaveLength(14);
    expect(pictureFor(LI_GU_NAME)!.flatMap(parseKinds)).toHaveLength(17);
    expect(pictureFor(MIXED_NAMES.shiftedChows)).toEqual(['123m', '234p', '345s']);
    expect(specialShapes(taiwaneseProfile).map((s) => s.name)).toContain('Lì Gǔ Lì Gǔ');
  });
});
