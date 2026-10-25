// The catalogue's new rule sets (Hong Kong, MCR, Sichuan, Malaysian, the UAE
// rulesets), Goulash as a mode, and the new match formats.

import { describe, expect, it } from 'vitest';
import { AiPlayer } from '../src/ai/players';
import { MahjongGame } from '../src/engine/game';
import { AI_ONLY_LENGTHS, GAME_LENGTHS, advanceRound, initialRound, liveSafeLength, roundProfileFor, timedMatchOver, type GameLength } from '../src/engine/rounds';
import { getProfile, withHouseRules } from '../src/engine/rules';
import { classicProfile } from '../src/engine/rules/classic';
import { HK_UNIT, hongKongProfile } from '../src/engine/rules/hongkong';
import { malaysianProfile } from '../src/engine/rules/malaysian';
import { MCR_BASE, mcrPayments, mcrProfile } from '../src/engine/rules/mcr';
import { SC_UNIT, sichuanKongs, sichuanProfile } from '../src/engine/rules/sichuan';
import type { RuleProfile } from '../src/engine/rules/types';
import { uaeProfile } from '../src/engine/rules/uae';
import { CAT, FLOWER_BASE, JOKER_KIND, isAnimal, parseKinds, type Tile } from '../src/engine/tiles';

/** Seat 0 (East, dealer) holds exactly these tiles, the last one just drawn. */
function handFor(profile: RuleProfile, spec: string, flowers: number[] = []) {
  const g = new MahjongGame(profile, ['A', 'B', 'C', 'D'], 1);
  g.startHand(1);
  let id = 1000;
  const tiles: Tile[] = parseKinds(spec).map((kind) => ({ id: id++, kind }));
  const pl = g.players[0];
  pl.hand = tiles;
  pl.melds = [];
  pl.flowers = flowers.map((kind) => ({ id: id++, kind }));
  g.state.phase = { kind: 'turn', seat: 0, drawn: tiles[tiles.length - 1], afterKong: false, mustDiscardOnly: false };
  return g;
}
/** Score a self-drawn win of the full 14-tile spec. */
const selfDraw = (p: RuleProfile, spec: string, flowers: number[] = []) => {
  const kinds = parseKinds(spec);
  return handFor(p, spec, flowers).evaluateWin(0, kinds[kinds.length - 1], true, false)?.score ?? null;
};
/** Score a discard win: the 13-tile spec plus `win` claimed from a discard. */
const ron = (p: RuleProfile, spec: string, win: string, flowers: number[] = []) => handFor(p, spec, flowers).evaluateWin(0, parseKinds(win)[0], false, true)?.score ?? null;
const names = (s: { items: { name: string }[] } | null) => s?.items.map((i) => i.name) ?? [];

const HK = withHouseRules(hongKongProfile, {});

describe('Hong Kong', () => {
  it('needs three faan by default: a two-faan hand cannot win', () => {
    // Concealed + All Chows = 2 (a non-seat flower removes "No flowers").
    expect(ron(HK, '123m 345p 789s 234s 6p', '6p', [FLOWER_BASE + 2])).toBeNull();
    const open = withHouseRules(hongKongProfile, { minValue: '0' });
    const s = ron(open, '123m 345p 789s 234s 6p', '6p', [FLOWER_BASE + 2])!;
    expect(s.value).toBe(2);
    expect(names(s)).toEqual(expect.arrayContaining(['Concealed hand', 'All Chows']));
  });
  it('scores on the half-spicy table and caps at ten faan', () => {
    // Self-drawn 1 + Concealed 1 + All Chows 1 + No flowers 1 = 4 faan.
    const four = selfDraw(HK, '123m 345p 789s 234s 66p')!;
    expect(four.value).toBe(4);
    expect(four.points).toBe(HK_UNIT * 16);
    const flush = selfDraw(HK, '123m 456m 789m 234m 55m')!;
    expect(names(flush)).toContain('Full Flush');
    expect(flush.value).toBe(10);
    expect(flush.limit).toBe(true);
    expect(flush.points).toBe(HK_UNIT * 128);
  });
  it('limit hands and seven pairs', () => {
    expect(selfDraw(HK, 'EEE SSS WWW NNN 11m')!.items[0].name).toBe('Great Four Winds');
    expect(names(selfDraw(HK, '11m 33m 55p 77p 99s 22s RdRd'))).toContain('Seven Pairs');
    const noPairs = withHouseRules(hongKongProfile, { sevenPairs: 'off', minValue: '0' });
    expect(selfDraw(noPairs, '11m 33m 55p 77p 99s 22s RdRd')).toBeNull();
  });
  it('half gun and full gun', () => {
    const s = { value: 3, unit: 'faan', items: [], points: 64, limit: false };
    expect(HK.payments(0, 2, s, 0, 4, 0).map((p) => p.amount)).toEqual([32, 64, 32]);
    const full = withHouseRules(hongKongProfile, { payout: 'fullGun' });
    expect(full.payments(0, 2, s, 0, 4, 0)).toEqual([{ from: 2, to: 0, amount: 128 }]);
  });
});

describe('Chinese Official (MCR)', () => {
  const M = withHouseRules(mcrProfile, {});
  it('scores Mixed Triple Chow with the smaller fans it allows', () => {
    const s = ron(M, '123m 123p 123s 789m 5p', '5p')!;
    const n = names(s);
    expect(n).toContain('Mixed Triple Chow');
    expect(n).toContain('All Chows');
    expect(n).toContain('Concealed Hand');
    expect(n).toContain('Single Wait');
    expect(n).toContain('Two Terminal Chows');
    expect(n).not.toContain('Mixed Double Chow');
    expect(s.value).toBe(8 + 2 + 2 + 1 + 1 + 1);
  });
  it('scores Mixed Shifted Chows', () => {
    expect(names(ron(withHouseRules(mcrProfile, { minFan: '0' }), '123m 234p 345s 678s 9m', '9m'))).toContain('Mixed Shifted Chows');
  });
  it('seven pairs is 24 fan and excludes Concealed Hand', () => {
    const s = selfDraw(M, '11m 33m 55p 77p 99s 22s EE')!;
    expect(names(s)).toContain('Seven Pairs');
    expect(names(s)).not.toContain('Concealed Hand');
    expect(s.value).toBeGreaterThanOrEqual(24);
  });
  it('needs eight fan, not counting flowers', () => {
    // All Chows 2 + Concealed Hand 2 + No Honours 1 + Single Wait 1 = 6.
    expect(ron(M, '123m 567p 789s 234s 6p', '6p', [FLOWER_BASE, FLOWER_BASE + 1, FLOWER_BASE + 2])).toBeNull();
    const practice = withHouseRules(mcrProfile, { minFan: '0' });
    const s = ron(practice, '123m 567p 789s 234s 6p', '6p', [FLOWER_BASE])!;
    expect(s.value).toBe(6);
    expect(s.points).toBe(7);
    expect(names(s)).toContain('Flower Tiles');
  });
  it('full flush, pure straight and its exclusions', () => {
    const s = selfDraw(M, '123m 456m 789m 234m 55m')!;
    const n = names(s);
    expect(n).toContain('Full Flush');
    expect(n).toContain('Pure Straight');
    expect(n).toContain('Fully Concealed Hand');
    expect(n).not.toContain('No Honours');
    expect(n).not.toContain('Self-Drawn');
  });
  it('pays an eight-point base plus the fan', () => {
    const s = { value: 10, unit: 'fan', items: [], points: 10, limit: false };
    expect(mcrPayments(0, 2, s, 0, 4).map((p) => p.amount)).toEqual([MCR_BASE, MCR_BASE + 10, MCR_BASE]);
    expect(mcrPayments(0, null, s, 0, 4).map((p) => p.amount)).toEqual([18, 18, 18]);
  });
});

describe('Sichuan Blood Battle', () => {
  const S = withHouseRules(sichuanProfile, {});
  it('plays with 108 suited tiles and no chow calls', () => {
    const g = new MahjongGame(S, ['A', 'B', 'C', 'D'], 3);
    g.startHand(3);
    expect(g.state.wall.length).toBe(108);
    expect(g.state.wall.every((t) => t.kind < 27)).toBe(true);
    expect(S.calls.chow).toBe(false);
  });
  it('a winning hand must miss a suit', () => {
    expect(selfDraw(S, '111m 222p 333s 44m 555m')).toBeNull();
    expect(selfDraw(S, '111m 222p 333p 44m 555m')).not.toBeNull();
  });
  it('scores pure suit, all pungs, seven pairs and roots in doubling fan', () => {
    const pungs = selfDraw(S, '111m 333m 555m 777m 99m')!;
    expect(names(pungs)).toEqual(expect.arrayContaining(['All Pungs', 'Pure Suit']));
    expect(pungs.value).toBe(3);
    expect(pungs.points).toBe(SC_UNIT * 8 + SC_UNIT); // self-draw adds a base
    const pairs = selfDraw(S, '11m 33m 55m 77m 99m 22p 44p')!;
    expect(names(pairs)).toContain('Seven Pairs');
    expect(pairs.value).toBe(2);
    const root = selfDraw(S, '111m 123m 456m 789m 99m')!;
    expect(names(root)).toEqual(expect.arrayContaining(['Root (four of a kind)', 'Pure Suit']));
  });
  it('caps fan at the house limit', () => {
    const three = withHouseRules(sichuanProfile, { cap: '3' });
    const s = selfDraw(three, '111m 333m 555m 777m 99m')!;
    expect(s.value).toBe(3);
    expect(s.limit).toBe(true);
  });
  it('kongs pay wind and rain', () => {
    expect(sichuanKongs({ type: 'kong', seat: 1, concealed: true }, 4).map((p) => p.amount)).toEqual([20, 20, 20]);
    expect(sichuanKongs({ type: 'kong', seat: 1, concealed: false }, 4).map((p) => p.amount)).toEqual([10, 10, 10]);
  });
});

describe('Malaysian', () => {
  const MY = withHouseRules(malaysianProfile, {});
  it('plays 148 tiles with flowers and four animals', () => {
    const g = new MahjongGame(MY, ['A', 'B', 'C', 'D'], 5);
    g.startHand(5);
    const all = [...g.state.wall];
    expect(all.length).toBe(148);
    expect(all.filter((t) => isAnimal(t.kind)).length).toBe(4);
  });
  it('seven pairs is three tai; the discarder pays double, others single', () => {
    const s = selfDraw(MY, '11m 33m 55p 77p 99s 22s EE')!;
    expect(s.items[0]).toMatchObject({ name: 'Seven Pairs', value: 3 });
    const pay = MY.payments(0, 2, { value: 1, unit: 'tai', items: [], points: 32, limit: false }, 0, 4, 0);
    expect(pay.map((p) => p.amount)).toEqual([32, 64, 32]);
  });
  it('the host may raise the tai cap', () => {
    const ten = withHouseRules(malaysianProfile, { cap: '10' });
    expect(selfDraw(MY, 'EEE SSS WWW NNN 11m')!.value).toBe(5);
    expect(selfDraw(ten, 'EEE SSS WWW NNN 11m')!.value).toBe(10);
  });
  it('animals score as bonus tiles', () => {
    expect(names(selfDraw(MY, '123m 345p 789s 234s 66p', [CAT]))).toContain('Cat');
  });
});

describe('UAE / Dubai Rules', () => {
  it('each ruleset maps to an engine with UAE house rules', () => {
    expect(getProfile('uae-taiwanese')!.handSize).toBe(16);
    expect(getProfile('uae-taiwanese')!.base).toBe('taiwanese');
    expect(withHouseRules(getProfile('uae-american')!, {}).goulash).toBe(true);
    expect(getProfile('uae-american')!.card).toBeDefined();
    expect(withHouseRules(getProfile('uae-custom')!, {}).goulash).toBe(false);
    expect(withHouseRules(uaeProfile, {}).goulash).toBe(true);
  });
});

describe('Goulash as a mode', () => {
  /** Play a hand to a wall game by hand: everyone discards their drawn tile. */
  function wallGame(g: MahjongGame) {
    let guard = 0;
    while (g.state.phase.kind !== 'handOver' && guard++ < 500) {
      const ph = g.state.phase;
      if (ph.kind === 'turn') g.discard(ph.seat, (ph.drawn ?? g.players[ph.seat].hand[0]).id);
      else if (ph.kind === 'claims') for (const s of g.pendingClaimSeats()) if (g.state.phase.kind === 'claims') g.respond(s, { type: 'pass' });
    }
    return g.state.phase;
  }
  it('Asian goulash: East stays, three tiles are exchanged, the pot carries over', () => {
    const P = withHouseRules(classicProfile, { goulash: 'on', goulashPot: '20', minValue: '0' });
    expect(P.goulashExchange).toBe(true);
    // Find a seed whose "discard what you drew" hand reaches the wall.
    for (let seed = 1; seed < 40; seed++) {
      const g = new MahjongGame(P, ['A', 'B', 'C', 'D'], seed);
      g.startHand(seed);
      const ph = wallGame(g);
      if (ph.kind !== 'handOver' || ph.result.type !== 'draw') continue;
      expect(ph.result.potAnte).toBe(20);
      expect(g.state.riichiPot).toBe(80);
      const dealer = g.dealer;
      g.advance();
      expect(g.state.goulash).toBe(true);
      expect(g.dealer).toBe(dealer);
      g.startHand(seed + 1);
      expect(g.state.phase.kind).toBe('charleston');
      const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, 'strategic', 'teacher', s));
      for (let stage = 0; stage < 3; stage++) {
        const picks = ais.map((a) => a.charlestonPass(g).map((t) => t.id));
        picks.forEach((ids, s) => g.charlestonPass(s, ids));
      }
      expect(g.state.phase.kind).toBe('turn');
      expect(g.players.map((p) => p.hand.length)).toEqual(g.players.map((_, s) => (s === g.dealer ? 14 : 13)));
      return;
    }
    throw new Error('no wall game found');
  });
  it('Goulash with jokers adds eight wild jokers', () => {
    const P = withHouseRules(uaeProfile, { goulashJokers: 'on' });
    expect(P.jokers).toBe(8);
    const g = new MahjongGame(P, ['A', 'B', 'C', 'D'], 2);
    g.startHand(2);
    expect(g.state.wall.filter((t) => t.kind === JOKER_KIND).length).toBe(8);
  });
  it('goulash off: no exchange and no pot', () => {
    const P = withHouseRules(classicProfile, {});
    expect(P.goulash).toBe(false);
    expect(P.goulashPot).toBe(0);
  });
});

describe('match formats', () => {
  it('sudden death ends at the first win; draws are replayed', () => {
    const rp = roundProfileFor('suddenDeath', classicProfile.rounds);
    let r = advanceRound(rp, initialRound(), 4, { dealerWon: false, drawn: true });
    expect(r.finished).toBe(false);
    r = advanceRound(rp, r, 4, { dealerWon: false, drawn: false });
    expect(r.finished).toBe(true);
  });
  it('a timed match ends after the clock, at the end of the round', () => {
    const rp = roundProfileFor('timed', classicProfile.rounds);
    const r0 = initialRound();
    const r1 = advanceRound(rp, r0, 4, { dealerWon: false, drawn: false });
    const late = 31 * 60_000;
    expect(timedMatchOver('timed', 0, 10 * 60_000, r0, r1)).toBe(false);
    expect(timedMatchOver('timed', 0, late, r0, r1)).toBe(false); // mid-round: play on
    const end = { ...r1, windIndex: 1, dealerHand: 0 };
    expect(timedMatchOver('timed', 0, late, { ...r1, dealerHand: 3 }, end)).toBe(true);
    expect(timedMatchOver('eastRound', 0, late, r0, end)).toBe(false);
  });
  it('live tables never play a clock-dependent format', () => {
    expect(AI_ONLY_LENGTHS).toContain('timed');
    expect(liveSafeLength('timed')).toBe('fullNews');
    for (const len of Object.keys(GAME_LENGTHS) as GameLength[]) {
      const live = liveSafeLength(len);
      expect(AI_ONLY_LENGTHS.includes(live), len).toBe(false);
      if (!AI_ONLY_LENGTHS.includes(len)) expect(live).toBe(len);
    }
  });
});
