import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { passportPlans } from '../src/engine/rules/indiaPassport';
import { parseKinds, toCounts } from '../src/engine/tiles';
import { turnHint } from '../src/ai/jongbot';
import { passportThreats } from '../src/ai/passportAdvice';
import type { Meld } from '../src/engine/state';
import { EAST, setHand, toTurn } from './helpers-india';

const counts = (s: string) => toCounts(parseKinds(s));

describe('JongBot passport planner (East round)', () => {
  it('names the passports a hand can make, nearest first', () => {
    const plans = passportPlans(counts('111m 222p 33s 456m 78p E'), []);
    expect(plans.length).toBeGreaterThan(1);
    expect(plans.map((p) => p.names.join('+'))).toContain('3 Pungs in 3 different suits');
    for (let i = 1; i < plans.length; i++) expect(plans[i].missing).toBeGreaterThanOrEqual(plans[i - 1].missing);
    const pungs = plans.find((p) => p.names[0] === '3 Pungs in 3 different suits')!;
    expect(pungs.need).toEqual(parseKinds('3s'));
    expect(pungs.gaps).toEqual([0, 0, 1]);
  });

  it('a complete passport hand plans as complete', () => {
    const [best] = passportPlans(counts('111m 222p 333s 456m EE'), []);
    expect(best.missing).toBe(0);
    expect(best.need).toEqual([]);
  });

  it('never plans more than four of a tile', () => {
    for (const p of passportPlans(counts('111m 1p 1s 2m 2p 3m 3p 3s 9m 9p 9s E'), [])) {
      const used = new Array(34).fill(0);
      for (const piece of p.pieces) for (const k of piece) used[k]++;
      expect(Math.max(...used)).toBeLessThanOrEqual(4);
    }
  });
});

const pung = (kind: number, id: number): Meld => ({ type: 'pung', tiles: [0, 1, 2].map((i) => ({ id: id + i, kind })), concealed: false, from: 0 });

describe('JongBot hold-back warnings (East round)', () => {
  it('reads 3 Pungs in 3 different suits from two exposed pungs', () => {
    const g = new MahjongGame(EAST, ['A', 'B', 'C', 'D'], 21);
    g.startHand(21);
    toTurn(g);
    const o = (g.dealer + 2) % 4;
    g.players[o].melds = [pung(0, 1000), pung(9, 1010)];
    const t = passportThreats(g, g.dealer).find((x) => x.seat === o)!;
    expect(t.name).toBe('3 Pungs in 3 different suits');
    expect(t.kinds).toEqual(Array.from({ length: 9 }, (_, i) => 18 + i));
  });

  it('the turn hint shows the planner and avoids feeding a shown passport when it costs nothing', () => {
    const g = new MahjongGame(EAST, ['A', 'B', 'C', 'D'], 21);
    g.startHand(21);
    toTurn(g);
    const me = g.dealer;
    setHand(g, me, parseKinds('111m 222p 333s 45m 7p 9s N'));
    const o = (me + 2) % 4;
    g.players[o].melds = [pung(3, 1000), pung(13, 1010)];
    const hint = turnHint(g, me, 'advanced');
    expect(hint.targets?.plans.length).toBeGreaterThan(0);
    expect(hint.keepBack?.[0]).toMatch(/3 Pungs in 3 different suits/);
    // The 9 of Bamboos, the 7 of Dots and the North Wind are all spare; the Bamboo would feed the shown passport.
    expect(hint.focusKind).not.toBe(parseKinds('9s')[0]);
    expect(hint.why).toMatch(/^Aim for 3 Pungs in 3 different suits/);
  });
});

import { arrangeHand, completeSets } from '../src/ui/handOrder';

describe('Passport sorting on your rack', () => {
  const tiles = (s: string) => parseKinds(s).map((kind, id) => ({ id, kind }));
  it('crochets and mixed chows group as sets in the East round', () => {
    expect(completeSets(tiles('5m 5p 5s 1m 2p 3s E'), true, undefined, true)).toHaveLength(2);
    expect(completeSets(tiles('5m 5p 5s 1m 2p 3s E'), true)).toHaveLength(0);
  });
  it('the chosen passport is set aside first, then the other sets, then loose tiles', () => {
    const hand = tiles('111m 222p 33s 456m 78p E');
    const plan = passportPlans(counts('111m 222p 33s 456m 78p E'), []).find((p) => p.names[0] === '3 Pungs in 3 different suits')!;
    const groups = plan.pieces.map((piece, i) => piece.slice(0, piece.length - plan.gaps[i]));
    const slots = arrangeHand(hand, { mode: 'suit', custom: null, groupSets: true, indiaSets: true, groups });
    expect(slots.slice(0, 8).map((s) => s.tile.kind)).toEqual(parseKinds('111m 222p 33s'));
    expect(slots.slice(0, 8).map((s) => s.set)).toEqual([0, 0, 0, 1, 1, 1, 2, 2]);
    expect(slots.slice(8, 11).map((s) => s.tile.kind)).toEqual(parseKinds('456m'));
    expect(slots[8].set).toBe(3);
  });
});

import { claimHint } from '../src/ai/jongbot';
import { likelyPassports, passportCall, riskyKinds } from '../src/ai/passportAdvice';

describe('Passport call check and opponent reads (East round)', () => {
  const game = (hand: string) => {
    const g = new MahjongGame(EAST, ['A', 'B', 'C', 'D'], 21);
    g.startHand(21);
    toTurn(g);
    const me = (g.dealer + 1) % 4;
    setHand(g, me, parseKinds(hand));
    return { g, me };
  };

  it('a pung that makes a passport piece says so, and brings the hand closer', () => {
    // 13 tiles: two pungs in two suits and a pair of 3 Bamboos; a 3 of Bamboos pung completes the passport.
    const { g, me } = game('111m 222p 33s 456m 78p');
    const c = passportCall(g, me, { type: 'pung' }, parseKinds('3s')[0])!;
    expect(c.after).toBeLessThan(c.before);
    expect(c.inPassport).toBe(true);
    expect(c.line).toMatch(/makes part of 3 Pungs in 3 different suits/);
    const hint = claimHint(g, me, [{ type: 'pung' }], parseKinds('3s')[0], 'learning');
    expect(hint.callCheck).toMatch(/^Passport check/);
  });

  it('a call that breaks the passport is flagged', () => {
    const { g, me } = game('111m 222p 333s 12s 7p 9s');
    // A 1-2-3 of Bamboos chow out of 2-3 would break the Bamboo pung of the passport.
    const c = passportCall(g, me, { type: 'chow', using: parseKinds('23s') }, parseKinds('1s')[0])!;
    expect(c.after).toBeGreaterThanOrEqual(c.before);
    expect(c.line).toMatch(/doesn't bring|blocks/);
  });

  it('nameplate reads and the risk tint come from exposed sets', () => {
    const { g, me } = game('111m 222p 33s 456m 78p');
    const o = (me + 2) % 4;
    g.players[o].melds = [pung(0, 1000), pung(9, 1010)];
    expect(likelyPassports(g, me).get(o)?.name).toBe('3 Pungs in 3 different suits');
    const risk = riskyKinds(g, me);
    expect(risk.has(18)).toBe(true);
    expect(risk.has(0)).toBe(false);
  });
});

describe('A Mahjong on a discard is still concealed (India Rules)', () => {
  it('East round: nothing exposed, won on a discard, pays as a concealed hand', () => {
    const g = new MahjongGame(EAST, ['A', 'B', 'C', 'D'], 21);
    g.startHand(21);
    toTurn(g);
    const me = (g.dealer + 1) % 4;
    setHand(g, me, parseKinds('111m 222p 333s 456m W'));
    const w = g.evaluateWin(me, parseKinds('W')[0], false, true)!;
    expect(w).not.toBeNull();
    expect(w.score.items.map((i) => i.name)).toContain('Concealed hand');
  });
});
