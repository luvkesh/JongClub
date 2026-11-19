import { describe, expect, it } from 'vitest';
import { classicProfile, classicScore } from '../src/engine/rules/classic';
import { getProfile, withHouseRules } from '../src/engine/rules';
import { SPECIAL_SUIT, specialSuitOf } from '../src/engine/rules/specialSuit';
import { winningDecompositions } from '../src/engine/hand';
import { parseKinds } from '../src/engine/tiles';
import type { Meld } from '../src/engine/state';
import { guideFor } from '../src/ui/scoringGuideData';
import { houseRuleTip } from '../src/ui/houseRuleTips';
import { simulateMatch } from '../src/club/sim';

const tiles = (spec: string) => parseKinds(spec).map((kind, id) => ({ id: 100 + id, kind }));
const score = (concealed: string, melds: Meld[], win: string, house?: Record<string, string>) => {
  const counts = new Array(34).fill(0);
  for (const k of parseKinds(concealed)) counts[k]++;
  const [decomposition] = winningDecompositions(counts, melds.length, { sevenPairs: true, thirteenOrphans: true });
  expect(decomposition).toBeDefined();
  return classicScore({ decomposition, melds, concealedCounts: counts, winKind: parseKinds(win)[0], selfDrawn: false, seatWind: 'S', prevailingWind: 'E', isDealer: false, lastTileOfWall: false, afterKong: false, dealerRepeat: 0, house });
};
const names = (s: ReturnType<typeof classicScore>) => s.items.map((i) => i.name);

describe('Special suit (Classic house rule)', () => {
  it('is a Classic house rule, off by default, with Characters, Dots and Bamboo', () => {
    const r = classicProfile.houseRules.find((x) => x.id === SPECIAL_SUIT)!;
    expect(r.default).toBe('off');
    expect(r.options.map((o) => o.value)).toEqual(['off', 'man', 'pin', 'sou']);
    expect(houseRuleTip(SPECIAL_SUIT)).toBeTruthy();
  });

  it('is not offered at India Rules or other tables', () => {
    for (const id of ['india', 'hongkong', 'riichi', 'uae']) expect(getProfile(id)?.houseRules.some((x) => x.id === SPECIAL_SUIT) ?? false).toBe(false);
  });

  it('scores 1 faan for each pung or kong in the special suit', () => {
    const hand = '555s 777s 123p 345m 99p';
    const off = score(hand, [], '9p');
    const on = score(hand, [], '9p', { specialSuit: 'sou' });
    expect(names(off)).not.toContain('Special suit pung');
    expect(on.items.filter((i) => i.name === 'Special suit pung')).toHaveLength(2);
    expect(on.value).toBe(off.value + 2);
    // Another suit chosen: nothing extra.
    expect(score(hand, [], '9p', { specialSuit: 'man' }).value).toBe(off.value);
  });

  it('counts a declared kong in the special suit', () => {
    const kong: Meld = { type: 'kong', tiles: tiles('4444m'), concealed: false, from: 2 };
    const s = score('123p 345p 678s 99s', [kong], '9s', { specialSuit: 'man' });
    expect(s.items.filter((i) => i.name === 'Special suit pung')).toHaveLength(1);
  });

  it('adds 1 faan to a one-suit hand made in the special suit, not to chows alone', () => {
    const flush = '123s 456s 789s 234s 55s';
    const s = score(flush, [], '5s', { specialSuit: 'sou' });
    expect(names(s)).toContain('Pure One Suit');
    expect(names(s)).toContain('Special suit hand');
    expect(names(s)).not.toContain('Special suit pung');
    expect(names(score(flush, [], '5s', { specialSuit: 'pin' }))).not.toContain('Special suit hand');
  });

  it('never goes past the limit', () => {
    const s = score('111s 333s 555s 777s 99s', [], '9s', { specialSuit: 'sou' });
    expect(s.value).toBeLessThanOrEqual(8);
  });

  it('shows on the scoring guide only when chosen', () => {
    const on = withHouseRules(classicProfile, { specialSuit: 'pin' });
    expect(specialSuitOf(on.houseChoices)).toBe('pin');
    expect(guideFor(on).sections.some((x) => x.title.includes('Dots'))).toBe(true);
    expect(guideFor(withHouseRules(classicProfile, {})).sections.some((x) => x.title.startsWith('Special suit'))).toBe(false);
  });

  it('a Classic match with a special suit plays out and conserves points', () => {
    const r = simulateMatch({
      variation: 'classic',
      length: 'oneHand',
      seed: 4242,
      houseRules: { specialSuit: 'man' },
      difficulties: ['casual', 'expert', 'beginner', 'strategic'],
      personalities: ['shark', 'zen', 'wall', 'gambler'],
      names: ['A', 'B', 'C', 'D'],
    });
    expect(r.capped).toBe(false);
    expect(r.standings.reduce((a, s) => a + s.score, 0)).toBe(classicProfile.startingScore * 4);
  }, 20_000);
});
