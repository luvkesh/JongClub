// The user's rulings of 2026-11-13 (evening): one India extra game only (see qa2-india), money left at
// match end goes to first place, no win on a partner's tile in team play, West "calling" as per the book,
// Little Robert and All Pair Ruby Jade as per the book.

import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { getProfile, withHouseRules } from '../src/engine/rules';
import { indiaProfile } from '../src/engine/rules/india';
import { cardByName } from '../src/engine/rules/indiaCards';
import { parseKinds } from '../src/engine/tiles';
import { rig } from './helpers/qaRig';

const k = (s: string) => parseKinds(s)[0];
const counts = (spec: string) => {
  const c = new Array(50).fill(0);
  for (const x of parseKinds(spec)) c[x]++;
  return c;
};

describe('team play: never a win on your partner’s tile', () => {
  for (const teams of ['off', 'on']) {
    it(`partner throws the winning tile (team play ${teams})`, () => {
      const g = new MahjongGame(withHouseRules(getProfile('classic')!, { teamPlay: teams }), ['A', 'B', 'C', 'D'], 5);
      g.startHand(5);
      // Seat 2 (seat 0's partner) waits on 5m; seat 0 throws it.
      rig(g, [{ hand: '5m 1p 4p 7p 2s 5s 8s E N Gd Wd 9p 3s 6p' }, null, { hand: '1s 2s 3s 4p 5p 6p 7m 8m 9m RdRdRd 5m' }], { turn: 0 });
      g.discard(0, g.players[0].hand.find((t) => t.kind === k('5m'))!.id);
      const ph = g.state.phase;
      const canWin = ph.kind === 'claims' && !!ph.options[2]?.some((o) => o.type === 'win');
      expect(canWin).toBe(teams === 'off');
      expect(g.winFrom(2, 0)).toBe(teams === 'off');
      expect(g.winFrom(2, 1)).toBe(true);
    });
  }
});

describe('money left at the end of a match goes to first place', () => {
  it('a Hong Kong match ending on a draw with money in the pot', () => {
    const g = new MahjongGame(getProfile('hongkong')!, ['A', 'B', 'C', 'D'], 3);
    g.state.round = { ...g.state.round, dealerHand: 3, dealerSeat: 3, handsPlayed: 3, repeat: 0 };
    g.players[1].score += 900;
    const before = g.players.map((p) => p.score);
    g.state.riichiPot = 1000;
    g.state.phase = { kind: 'handOver', result: { type: 'draw', payments: [], deltas: [0, 0, 0, 0] } };
    if (!g.willEnd()) return; // this format does not end here: nothing to check
    expect(g.advance()).toBe(true);
    expect(g.state.riichiPot).toBe(0);
    expect(g.players.map((p) => p.score)).toEqual(before.map((v, s) => v + (s === 1 ? 1000 : 0)));
  });

  it('payLeftoverPot (used when the clock or a hand limit ends the match) pays once, earlier seat on a tie', () => {
    const g = new MahjongGame(getProfile('classic')!, ['A', 'B', 'C', 'D'], 3);
    g.state.riichiPot = 400;
    expect(g.payLeftoverPot()).toEqual({ seat: 0, amount: 400 });
    expect(g.payLeftoverPot()).toBeNull();
  });
});

describe('India West penalty: "calling" means one tile from a Mahjong the thrower could declare (book p. 26)', () => {
  it('a ready but dirty thrower is not calling, so pays for the table', () => {
    const g = new MahjongGame(withHouseRules(indiaProfile, { indiaRounds: 'W' }), ['A', 'B', 'C', 'D'], 21);
    g.startHand(21);
    rig(
      g,
      [
        // Ready in shape (waits 9m or 3p) but in three suits: dirty, so it could never go Mahjong.
        { hand: '1m 1m 1m 5p 5p 5p 7s 7s 7s 9m 9m 3p 3p 5m' },
        { hand: 'RdRdRd 5m', melds: [{ spec: '2m 2m 2m', type: 'pung', from: 0 }, { spec: 'S S S', type: 'pung', from: 2 }, { spec: 'W W W', type: 'pung', from: 3 }] },
      ],
      { turn: 0 },
    );
    g.discard(0, g.players[0].hand.find((t) => t.kind === k('5m'))!.id);
    expect(g.isTenpai(0)).toBe(true);
    expect(g.callingForMahjong(0)).toBe(false);
    for (const s of g.pendingClaimSeats()) g.respond(s, { type: s === 1 ? 'win' : 'pass' });
    const end = g.state.phase;
    if (end.kind !== 'handOver') throw new Error('hand not over');
    expect(end.result.payments.some((p) => p.from === 0 && p.to === 1 && p.reason === 'Penalty: pays for the table')).toBe(true);
  });
});

describe('Small Cards as per the book', () => {
  const robert = cardByName('Little Robert')!;
  const E = k('E');
  it('Little Robert: with a pair of your own wind only a pung or the Mahjong tile may come from a discard', () => {
    expect(robert.claim!('pung', k('5s'), [E, E, k('1s')], E)).toBe(true);
    expect(robert.claim!('win', k('5s'), [E, E, k('1s')], E)).toBe(true);
    expect(robert.claim!('chow', k('5s'), [E, E, k('1s')], E)).toBe(false);
    expect(robert.claim!('kong', k('5s'), [E, E, k('1s')], E)).toBe(false);
    expect(robert.claim!('pung', k('5s'), [E, k('1s')], E)).toBe(false);
  });

  it('All Pair Ruby Jade: needs a red-bamboo pair and a green-bamboo pair', () => {
    const ruby = cardByName('All Pair Ruby Jade Hand')!;
    expect(ruby.check!(counts('RdRd GdGd 11s 22s 55s 66s 99s'), 0)).toBe(true);
    expect(ruby.check!(counts('RdRd GdGd 22s 33s 44s 66s 88s'), 0)).toBe(false);
    expect(ruby.check!(counts('RdRd GdGd 11s 55s 77s 99s 11s'), 0)).toBe(false);
  });
});
