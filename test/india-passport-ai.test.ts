import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { withHouseRules } from '../src/engine/rules';
import { eastShape, indiaProfile } from '../src/engine/rules/india';
import { passportMissing } from '../src/engine/rules/indiaPassport';
import { currentShanten, shantenAfterCall } from '../src/ai/evaluate';
import { parseKinds, toCounts } from '../src/engine/tiles';
import type { MeldShape } from '../src/engine/hand';
import { playHandHeadless } from '../src/club/sim';
import { AiPlayer } from '../src/ai/players';

const c = (s: string) => toCounts(parseKinds(s));
const k = (s: string) => parseKinds(s)[0];
const east = (passport: 'required' | 'optional') => withHouseRules(indiaProfile, { indiaRounds: 'E', passport });

function seated(passport: 'required' | 'optional', hand: string) {
  const g = new MahjongGame(east(passport), ['A', 'B', 'C', 'D'], 5);
  g.startHand(5);
  g.players[1].hand = parseKinds(hand).map((kind, id) => ({ id: 1000 + id, kind }));
  g.players[1].melds = [];
  return g;
}

describe('India Rules East round: how far a passport is (pp. 9-11)', () => {
  it('finds nothing missing in each combination of the book', () => {
    for (const h of ['ESWN S 123m 456p 789s', '11p 44p 66p 123m 456s 99m', '444m 777s 222p 123m 99s', 'RdGdWd EE 1m 1s 4m 4s 9m 9s 123p', '11p 44p 66p 1m 1s 4m 4s 9m 9s 22s', '123m 123p 123s NNN RdRd'])
      expect(passportMissing(c(h), []), h).toBe(0);
  });
  it('counts the tiles a passport still needs', () => {
    expect(passportMissing(c('444m 777s 22p 123m 99s'), [])).toBe(1); // one 2p
    expect(passportMissing(c('ESW 123m 456p 789s 11m'), [])).toBe(2); // N and another wind
  });
  it('reads declared melds as part of a passport, or as a set beside it', () => {
    const pungs: MeldShape[] = [{ type: 'pung', kind: k('4m') }, { type: 'pung', kind: k('7s') }];
    expect(passportMissing(c('222p 123m 99s'), pungs)).toBe(0);
    expect(passportMissing(c('222p 123m 9s'), pungs)).toBe(1);
  });
});

describe('India Rules East round: JongBot and the bots aim for passports', () => {
  it('with a compulsory passport a plain ready hand is not ready', () => {
    const plain = c('123m 234m 789s 111s E');
    expect(eastShape(false, () => []).shanten(plain, 0)).toBe(0);
    expect(eastShape(true, () => []).shanten(plain, 0)).toBeGreaterThan(0);
  });
  it('sees a passport the plain sets miss', () => {
    // NEWS + a wind, 3 chows: ready on any wind for the passport.
    const h = c('ESWN 123m 456p 789s 9m');
    expect(eastShape(true, () => []).shanten(h, 0)).toBe(0);
    expect(eastShape(false, () => []).shanten(h, 0)).toBe(0);
  });
  it('weighs a call with the set it would make', () => {
    // Ready for 3 Pungs in 3 suits on a 2p. After punging the 9s the hand still has a passport
    // (3 pairs in 3 suits, 123m, the 9s pung and a pair), and the shapes see that pung.
    const g = seated('required', '444m 777s 22p 99s 123m');
    expect(currentShanten(g, 1)).toBe(0);
    expect(g.withPendingMeld(1, { type: 'pung', kind: k('9s') }, () => g.meldShapes(1))).toEqual([{ type: 'pung', kind: k('9s') }]);
    expect(g.meldShapes(1)).toEqual([]);
    expect(shantenAfterCall(g, 1, [k('9s'), k('9s')], k('9s'))).toBe(0);
  });
  it('bots win with a compulsory passport', () => {
    let wins = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const g = new MahjongGame(east('required'), ['A', 'B', 'C', 'D'], seed);
      g.startHand(seed);
      expect(playHandHeadless(g, [0, 1, 2, 3].map((s) => new AiPlayer(s, 'strategic', 'zen', seed * 10 + s)))).toBe(true);
      const ph = g.state.phase;
      if (ph.kind === 'handOver' && ph.result.type === 'win') {
        wins++;
        expect(ph.result.score!.items.some((i) => i.name.startsWith('Passport'))).toBe(true);
      }
    }
    expect(wins).toBeGreaterThanOrEqual(4);
  }, 120_000);
});
