import { afterEach, describe, expect, it } from 'vitest';
import { shownName, tr, useLang } from '../src/i18n';
import { CATALOGUE } from '../src/club/catalogue';
import { VARIATIONS, variationTitle } from '../src/engine/rules';
import { MahjongGame, charlestonDirName } from '../src/engine/game';
import { WEST } from './helpers-india';
import { charlestonHint } from '../src/ai/jongbot';
import { seatNames } from '../src/ai/players';
import { matchTitle } from '../src/ui/screens/results';

// Bug round 2026-10-24: names that showed in English inside translated pages.
describe('bug round 2026-10-24', () => {
  afterEach(() => useLang('en'));

  it('every ruleset and variation name has a translation', () => {
    useLang('zh-Hans');
    const names = new Set<string>();
    for (const e of CATALOGUE) names.add(e.name);
    for (const v of VARIATIONS) for (const n of [v.name, v.short, v.ruleset]) if (n) names.add(n);
    // Codes like EMA and proper names read the same in every language; everything else must change.
    const same = new Set(['EMA', 'Zung Jung', 'Wright-Patterson']);
    const missing = [...names].filter((n) => !same.has(n) && tr(n) === n);
    expect(missing).toEqual([]);
    expect(variationTitle(VARIATIONS.find((v) => v.id === 'classic')!)).not.toMatch(/Classic/);
  });

  it('the default name "Guest" reads in the player’s language, typed names stay as typed', () => {
    useLang('ar');
    expect(shownName('Guest')).not.toBe('Guest');
    expect(tr('{name} (you)', { name: 'Guest' })).toContain(shownName('Guest'));
    expect(shownName('Priya')).toBe('Priya');
    useLang('en');
    expect(shownName('Guest')).toBe('Guest');
  });

  it('JongBot names the same pass direction as the action bar in India swaps', () => {
    const g = new MahjongGame(WEST, ['A', 'B', 'C', 'D'], 11);
    g.startHand(11);
    for (let seat = 0; seat < 4; seat++) {
      const ph = g.state.phase as { kind: string; stage: number };
      expect(ph.kind).toBe('charleston');
      const dir = charlestonDirName((g.passTarget(seat, ph.stage) - seat + 4) % 4);
      expect(charlestonHint(g, seat, 'beginner').headline).toContain(`to the ${dir}.`);
    }
  });

  it('three AI players of one personality get three different names', () => {
    const names = seatNames(['zen', 'zen', 'zen'], ['Guest']);
    expect(new Set(names).size).toBe(3);
    expect(names.slice(0, 2)).toEqual(['Sora', 'Amara']);
  });

  it('the results title follows the format and the winds played', () => {
    expect(matchTitle({ length: 'fullNews', lengthLabel: 'Full E-S-W-N', winds: ['E', 'S', 'W', 'N'] })).toBe('NEWS MATCH COMPLETE');
    expect(matchTitle({ lengthLabel: 'Full E-S-W-N' })).toBe('NEWS MATCH COMPLETE');
    expect(matchTitle({ length: 'eastRound', lengthLabel: 'East round', winds: ['E', 'S', 'W'] })).toBe('MATCH COMPLETE');
    expect(matchTitle({ length: 'eastRound', lengthLabel: 'East round', winds: ['W'] })).toBe('WEST ROUND COMPLETE');
    expect(matchTitle({ length: 'timed', lengthLabel: 'Timed match', winds: ['E'] })).toBe('MATCH COMPLETE');
    expect(matchTitle({ length: 'eastSouth', lengthLabel: 'East + South', winds: ['E', 'S'] })).toBe('SOUTH ROUND COMPLETE');
  });
});

import { flowerLines } from '../src/engine/rules/india';
import { FLOWER_BASE } from '../src/engine/tiles';
describe('India flowers (rulebook p.8: pair of own or pair of round flowers/seasons = 500)', () => {
  const eastPair = [FLOWER_BASE, FLOWER_BASE + 4];
  it('a pair that is both your own and the round’s is paid once', () => {
    expect(flowerLines(eastPair, 'E', 'E')).toEqual([['Own flower and season', 500]]);
  });
  it('the round’s pair still pays a player of another seat', () => {
    expect(flowerLines(eastPair, 'S', 'E')).toEqual([['Round flower and season', 500]]);
  });
});
