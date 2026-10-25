import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { getProfile, withHouseRules } from '../src/engine/rules';
import { EAST_PAY, eastReading, eastShape, flowerLines, flowerPayments, indiaPayments, indiaProfile, passportOf, pieceReadings } from '../src/engine/rules/india';
import { roundOverlay } from '../src/engine/rules/windRounds';
import type { ScoringContext } from '../src/engine/rules/types';
import { FLOWER_BASE, parseKinds, toCounts } from '../src/engine/tiles';
import type { Meld } from '../src/engine/state';
import { playHandHeadless } from '../src/club/sim';
import { AiPlayer } from '../src/ai/players';

const c = (s: string) => toCounts(parseKinds(s));
const k = (s: string) => parseKinds(s)[0];
const open = eastShape(false);
const strict = eastShape(true);
const win = (s: string, melds: { type: 'pung' | 'chow' | 'kong'; kind: number }[] = [], passportOnly = false) => (passportOnly ? strict : open).complete(c(s), melds.length, melds);

describe('India Rules: the East round hand (pp. 3, 7, 9-11)', () => {
  it('accepts 3+3+3+3+2 with pungs, chows, mixed chows and crochets', () => {
    expect(win('123m 456p 789s 111s EE')).toBe(true);
    expect(win('2m 3s 4p 456p 789s 111s EE')).toBe(true); // a mixed chow
    expect(win('4m 4s 4p 456p 789s 111s EE')).toBe(true); // a crochet
  });
  it('rejects two tiles of one suit in a mixed chow, and seven pairs', () => {
    expect(win('2m 3m 4p 456p 789s 111s EE')).toBe(false);
    expect(win('11m 55p EE SS WW NN RdRd')).toBe(false);
    // Many seven-pair hands are two 6-tile passports and a pair (p. 11).
    expect(win('11m 22m 33p 44p 55s 66s EE')).toBe(true);
  });
  it('allows a knit as the pair only with a crochet', () => {
    expect(win('123m 456p 789s 111s 7m 7s')).toBe(false);
    expect(win('5m 5p 5s 456p 789s 111s 7m 7s')).toBe(true);
  });
  it('counts declared melds as sets', () => {
    expect(win('123m 456p 11s EE', [{ type: 'pung', kind: k('9s') }])).toBe(false); // 13 tiles
    expect(win('123m 111s EE', [{ type: 'pung', kind: k('9s') }, { type: 'chow', kind: k('1p') }])).toBe(true);
  });
});

describe('India Rules: passports (pp. 9-11)', () => {
  const pieces = (s: string) => pieceReadings(c(s), { chows: true, mixed: true, passports: true });
  it('names each passport', () => {
    expect(passportOf(pieces('444m 777s 222p')[0])).toBe('3 Pungs in 3 different suits');
    expect(passportOf(pieces('444p 222p 777p')[0])).toBe('3 Pungs in the same suit');
    expect(passportOf(pieces('66p 44p 11p').find((r) => r.length === 3)!)).toBe('3 Pairs in the same suit');
    expect(passportOf(pieces('1m 1s 4m 4s 9m 9s').find((r) => r.every((p) => p.t === 'knit'))!)).toBe('3 Knits in the same 2 suits');
    expect(passportOf(pieces('ESWN S')[0])).toBe('NEWS + another Wind');
    expect(passportOf(pieces('RdGdWd EE').find((r) => r.some((p) => p.t === 'grw'))!)).toBe('GRW + Honour Pair');
    expect(passportOf(pieces('NNN RdRd')[0])).toBe('Honour Pung + Honour Pair');
  });
  it('wins with each combination the book lists', () => {
    expect(win('ESWN S 123m 456p 789s', [], true)).toBe(true); // 5 + 3 + 3 + 3
    expect(win('11p 44p 66p 123m 456s 99m', [], true)).toBe(true); // 6 + 3 + 3 + 2
    expect(win('444m 777s 222p 123m 99s', [], true)).toBe(true); // 9 + 3 + 2
    expect(win('RdGdWd EE 1m 1s 4m 4s 9m 9s 123p', [], true)).toBe(true); // 5 + 6 + 3
    expect(win('11p 44p 66p 1m 1s 4m 4s 9m 9s 22s', [], true)).toBe(true); // 6 + 6 + 2
    expect(win('123m 123p 123s NNN RdRd', [], true)).toBe(true); // 9 + 5
  });
  it('compulsory passport turns away a plain hand', () => {
    // (123m 456p 789s would itself be a passport: three chows in three suits.)
    expect(win('123m 234m 789s 111s EE', [], true)).toBe(false);
    expect(win('123m 234m 789s 111s EE', [], false)).toBe(true);
  });
  it('a declared pung can be part of a passport', () => {
    expect(win('777s 222p 123m 99s', [{ type: 'pung', kind: k('4m') }], true)).toBe(true);
    expect(eastReading(c('777s 222p 123m 99s'), [{ type: 'pung', kind: k('4m') }], true)?.passports).toEqual(['3 Pungs in 3 different suits']);
  });
});

function ctx(over: Partial<ScoringContext>): ScoringContext {
  return { decomposition: { shape: 'special', special: 'India hand', sets: [], pair: -1 }, melds: [], concealedCounts: c('123m 456p 789s 111s EE'), winKind: k('E'), selfDrawn: false, seatWind: 'S', prevailingWind: 'E', isDealer: false, lastTileOfWall: false, afterKong: false, dealerRepeat: 0, ...over };
}
const pung = (kind: number, concealed = false): Meld => ({ type: 'pung', tiles: [0, 1, 2].map((i) => ({ id: kind * 4 + i, kind })), concealed });

describe('India Rules: East-round payments (p. 8)', () => {
  const P = withHouseRules(indiaProfile, {});
  it('pays 500, 1000 concealed, 2000 fully concealed', () => {
    expect(P.score(ctx({ melds: [pung(k('9s'))], concealedCounts: c('123m 456p 789s EE') })).points).toBe(EAST_PAY.normal);
    expect(P.score(ctx({})).points).toBe(EAST_PAY.concealed);
    expect(P.score(ctx({ selfDrawn: true })).points).toBe(EAST_PAY.fully);
    // A concealed kong keeps the hand concealed.
    expect(P.score(ctx({ melds: [{ ...pung(k('9s'), true), type: 'kong' }], concealedCounts: c('123m 456p 789s EE') })).points).toBe(EAST_PAY.concealed);
  });
  it('East pays and receives double', () => {
    const s = { value: 500, unit: 'pts', items: [], points: 500, limit: false };
    expect(indiaPayments(1, 2, s, 0, 4)).toEqual([
      { from: 0, to: 1, amount: 1000 },
      { from: 2, to: 1, amount: 500 },
      { from: 3, to: 1, amount: 500 },
    ]);
    expect(indiaPayments(0, null, s, 0, 4).map((p) => p.amount)).toEqual([1000, 1000, 1000]);
  });
});

describe('India Rules: flowers and seasons (p. 8)', () => {
  const F = (...n: number[]) => n.map((i) => FLOWER_BASE + i);
  it('scores pairs and bouquets', () => {
    expect(flowerLines(F(1, 5), 'S', 'E')).toEqual([['Own flower and season', 500]]);
    expect(flowerLines(F(0, 4), 'S', 'E')).toEqual([['Round flower and season', 500]]);
    expect(flowerLines(F(0, 5, 2, 7), 'W', 'E')).toEqual([['Mixed bouquet', 500]]);
    expect(flowerLines(F(4, 5, 6, 7), 'W', 'E')).toEqual([['Pure bouquet', 1000]]);
    expect(flowerLines(F(1), 'S', 'E')).toEqual([]);
  });
  it('everyone pays them, East the same, on a draw too', () => {
    const pays = flowerPayments({ winner: null, discarder: null, dealer: 0, players: 4, flowers: [[], F(1, 5), [], []], seatWinds: ['E', 'S', 'W', 'N'], prevailing: 'E' });
    expect(pays.map((p) => [p.from, p.to, p.amount])).toEqual([
      [0, 1, 500],
      [2, 1, 500],
      [3, 1, 500],
    ]);
  });
});

describe('India Rules: the table', () => {
  it('is registered, starts at 35,000 and plays the East round', () => {
    const P = withHouseRules(getProfile('india')!, {});
    expect(P.startingScore).toBe(35000);
    expect(P.flowers).toBe(true);
    expect(roundOverlay(P, 'indiaEast').specialRound).toBe('indiaEast');
  });
  it('passes the deal after every game, and keeps it after a draw', async () => {
    const { advanceRound } = await import('../src/engine/rounds');
    const r0 = { windIndex: 0, dealerHand: 0, repeat: 0, dealerSeat: 0, handsPlayed: 0, finished: false };
    expect(advanceRound(indiaProfile.rounds, r0, 4, { dealerWon: true, drawn: false }).dealerSeat).toBe(1);
    expect(advanceRound(indiaProfile.rounds, r0, 4, { dealerWon: false, drawn: true }).dealerSeat).toBe(0);
  });
  it('AI players finish East-round games and the ledger balances', () => {
    const P = withHouseRules(indiaProfile, {});
    let wins = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const g = new MahjongGame(P, ['A', 'B', 'C', 'D'], seed);
      const before = g.players.reduce((a, p) => a + p.score, 0);
      g.startHand(seed);
      expect(playHandHeadless(g, [0, 1, 2, 3].map((s) => new AiPlayer(s, 'casual', 'zen', seed * 10 + s)))).toBe(true);
      const ph = g.state.phase;
      if (ph.kind === 'handOver' && ph.result.type === 'win') wins++;
      expect(g.players.reduce((a, p) => a + p.score, 0)).toBe(before);
    }
    expect(wins).toBeGreaterThan(3);
  });
});
