// QA round 2: Chinese-family scoring (MCR, Sichuan, Taiwanese, Zung Jung).
// Each test pins a bug found in the retest; positions are forced by kind.
import { describe, expect, it } from 'vitest';
import { sevenPairsShanten } from '../src/engine/hand';
import { buildProfile } from '../src/club/sim';
import { parseKinds, toCounts } from '../src/engine/tiles';
import { guideFor } from '../src/ui/scoringGuideData';
import { onTurn, type Setup } from './audit-helpers';

const k = (s: string) => parseKinds(s)[0];

/** Seat 0's best reading of its 14 (or 17) tiles, won on `win` by self-draw or on a discard. */
function win(s: Setup, tile: string, self: boolean, prep?: (g: ReturnType<typeof onTurn>) => void) {
  const g = onTurn(s);
  prep?.(g);
  return g.evaluateWin(0, k(tile), self, false)?.score ?? null;
}
const names = (sc: { items: { name: string }[] } | null) => sc?.items.map((i) => i.name) ?? [];

describe('MCR', () => {
  it('Nine Gates needs the pure 1112345678999 wait: an extra 5 with a 1 won is a Full Flush, not 88', () => {
    const impure = win({ variation: 'mcr', hand: '111m 2345m 5m 678m 999m' }, '1m', true);
    expect(names(impure)).not.toContain('Nine Gates');
    expect(names(impure)).toContain('Full Flush');
    const pure = win({ variation: 'mcr', hand: '111m 2345678m 999m 5m' }, '5m', true);
    expect(names(pure)).toContain('Nine Gates');
  });

  it('Seven Pairs may hold four of a kind (two pairs), scored with Tile Hog', () => {
    const sc = win({ variation: 'mcr', hand: '1111m 22p 33p 44s 55s EE' }, 'E', false);
    expect(sc).not.toBeNull();
    expect(names(sc)).toEqual(expect.arrayContaining(['Seven Pairs', 'Tile Hog']));
    expect(sevenPairsShanten(toCounts(parseKinds('1111m 22p 33p 44s 55s E')), true)).toBe(0);
  });

  it('self-drawn Seven Pairs, Thirteen Orphans and knitted honours score Self-Drawn, not Fully Concealed Hand', () => {
    for (const [hand, tile] of [
      ['11m 22p 33p 44s 55s EE NN', 'N'],
      ['19m 19p 19s ESWN RdGd Wd Wd', 'Wd'],
      ['147m 258p 369s ESW Rd Gd', 'Gd'],
    ]) {
      const sc = win({ variation: 'mcr', hand }, tile, true);
      expect(names(sc), hand).toContain('Self-Drawn');
      expect(names(sc), hand).not.toContain('Fully Concealed Hand');
      expect(names(sc), hand).not.toContain('Concealed Hand');
    }
  });

  it('scores Upper Four (6-9 only) and Lower Four (1-4 only), 12 fan each', () => {
    const up = win({ variation: 'mcr', hand: '678m 789p 666s 99s 789s' }, '9s', false);
    expect(up?.items.find((i) => i.name === 'Upper Four')?.value).toBe(12);
    expect(names(up)).not.toContain('No Honours');
    const low = win({ variation: 'mcr', hand: '123m 234p 444s 11s 234s' }, '1s', false);
    expect(low?.items.find((i) => i.name === 'Lower Four')?.value).toBe(12);
    // Upper Tiles (7-9) replaces Upper Four.
    const upper = win({ variation: 'mcr', hand: '789m 789p 777s 99s 789s' }, '9s', false);
    expect(names(upper)).toContain('Upper Tiles');
    expect(names(upper)).not.toContain('Upper Four');
  });

  it('a discard that could finish a chow leaves the pung concealed (Two Concealed Pungs)', () => {
    const sc = win({ variation: 'mcr', house: { minFan: '0' }, hand: '345m 555m 777p 22p 789s' }, '5m', false);
    expect(names(sc)).toContain('Two Concealed Pungs');
  });
});

describe('Sichuan', () => {
  it('dragon seven pairs (a four of a kind as two pairs) wins: Seven Pairs plus a Root', () => {
    const sc = win({ variation: 'sichuan', hand: '1111m 33m 44m 55p 66p 77p' }, '7p', false);
    expect(sc?.value).toBe(3);
    expect(names(sc)).toEqual(expect.arrayContaining(['Seven Pairs', 'Root (four of a kind)']));
  });

  it('the rule book lists Self-drawn as a fan only when the house rule makes it one', () => {
    const lines = (house: Record<string, string>) => guideFor(buildProfile('sichuan', 'fullNews', house)).sections.flatMap((s) => s.lines.map((l) => l.name));
    expect(lines({})).not.toContain('Self-drawn');
    expect(guideFor(buildProfile('sichuan', 'fullNews', {})).pay).toMatch(/one base/);
    expect(lines({ selfDraw: 'fan' })).toContain('Self-drawn');
  });
});

describe('Taiwanese', () => {
  it('a self-draw on a flower replacement scores Win on replacement, as the rule book says', () => {
    const hand = '123m 456m 789p 234s 567s 99s';
    const plain = win({ variation: 'taiwanese', hand }, '9s', true);
    const flower = win({ variation: 'taiwanese', hand }, '9s', true, (g) => (g.state.afterFlower = true));
    expect(names(plain)).not.toContain('Win on replacement');
    expect(names(flower)).toContain('Win on replacement');
    expect(flower!.value).toBe(plain!.value + 1);
  });
});

describe('Zung Jung', () => {
  it('Seven Pairs of ones, nines and honours adds Mixed Greater Terminals (130)', () => {
    const sc = win({ variation: 'zung-jung', hand: '11m 99m 11p 99p 11s EE NN' }, 'N', false);
    expect(sc?.value).toBe(130);
    expect(names(sc)).toEqual(['Seven Pairs', 'Mixed Greater Terminals']);
  });
});
