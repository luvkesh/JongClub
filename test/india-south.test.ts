import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { withHouseRules } from '../src/engine/rules';
import { indiaProfile, southScore } from '../src/engine/rules/india';
import { cardByName, cardComplete, LIMIT_PAY, SMALL_CARDS } from '../src/engine/rules/indiaCards';
import type { ScoringContext } from '../src/engine/rules/types';
import { parseKinds, toCounts } from '../src/engine/tiles';
import { playHandHeadless } from '../src/club/sim';
import { AiPlayer } from '../src/ai/players';
import { cardDistances } from '../src/ai/indiaCardPick';
import { decodeAction, encodeAction } from '../src/net/lockstep';
import { arrangeHand } from '../src/ui/handOrder';
import { cardSets } from '../src/engine/rules/indiaCards';

const SOUTH = withHouseRules(indiaProfile, { indiaRounds: 'S' });
const counts = (s: string) => toCounts(parseKinds(s));
const southGame = (seed: number) => {
  const g = new MahjongGame(SOUTH, ['A', 'B', 'C', 'D'], seed);
  g.startHand(seed);
  return g;
};

function ctx(card: string, hand: string, over: Partial<ScoringContext> = {}): ScoringContext {
  const kinds = parseKinds(hand);
  return {
    decomposition: { shape: 'special', special: card, sets: [], pair: -1 } as unknown as ScoringContext['decomposition'],
    melds: [],
    concealedCounts: toCounts(kinds),
    winKind: kinds[0],
    selfDrawn: true,
    seatWind: 'S',
    prevailingWind: 'S',
    isDealer: false,
    lastTileOfWall: false,
    afterKong: false,
    dealerRepeat: 0,
    flowers: [],
    card: SMALL_CARDS.indexOf(cardByName(card)!),
    ...over,
  };
}

describe('India Rules South round: the Small Cards (pp. 12-25)', () => {
  it('has all 55 cards, numbered 1 to 55', () => {
    expect(SMALL_CARDS.map((c) => c.n)).toEqual(Array.from({ length: 55 }, (_, i) => i + 1));
  });
  it('every card picture is a winning hand for that card', () => {
    const winds = [27, 28, 29, 30];
    for (const card of SMALL_CARDS) {
      const c = counts(card.picture);
      const ok = winds.some((seat) => winds.some((round) => cardComplete(card, c, [], seat, round)));
      expect(ok, card.name).toBe(true);
    }
  });
  it('a plain hand is not a card win', () => {
    const silly = cardByName('Silly Bee')!;
    expect(cardComplete(silly, counts('123m 456p 789s 111s EE'), [], 28, 28)).toBe(false);
  });
});

describe('India Rules South round: dealing and claims', () => {
  it('offers each seat three different cards, keeps one each, then starts the exchanges', () => {
    const g = southGame(7);
    expect(g.state.phase.kind).toBe('cardPick');
    const offers = g.state.cardOffers!;
    expect(offers).toHaveLength(4);
    expect(new Set(offers.flat()).size).toBe(12);
    expect(southGame(7).state.cardOffers).toEqual(offers);
    expect(g.state.cards).toBeUndefined();
    expect(() => g.pickCard(0, offers[1][0])).toThrow();
    offers.forEach((o, s) => g.pickCard(s, o[s % 3]));
    expect(g.state.cards).toEqual(offers.map((o, s) => o[s % 3]));
    expect(g.state.phase).toMatchObject({ kind: 'charleston', stage: 0 });
  });
  it('a bot keeps the card nearest its tiles', () => {
    const g = southGame(9);
    const offers = g.state.cardOffers![1];
    const d = cardDistances(g, 1, offers);
    const kept = new AiPlayer(1, 'strategic', 'zen', 1).cardPick(g);
    expect(d[offers.indexOf(kept)]).toBe(Math.min(...d));
  });
  it('the card choice travels between devices', () => {
    expect(decodeAction(encodeAction({ t: 'sc', s: 2, c: 41 }))).toEqual({ t: 'sc', s: 2, c: 41 });
  });
  it('an all-from-the-wall card takes no discard, not even to Mahjong', () => {
    const g = southGame(3);
    const p = g.profile;
    const info = (card: string) => ({ card: SMALL_CARDS.indexOf(cardByName(card)!), seatWind: 'S' as const, prevailing: 'S' as const, hand: [], melds: () => [] });
    for (const type of ['pung', 'kong', 'chow', 'win'] as const) expect(p.claimAllowed!(1, type, 0, info('Silly Bee'))).toBe(false);
  });
});

describe('India Rules South round: what a card pays', () => {
  it('pays the card value, and nothing for a hand that is not your card', () => {
    const s = southScore(ctx('Silly Bee', SMALL_CARDS[8].picture));
    expect(s.value).toBe(LIMIT_PAY.limit);
    expect(s.items[0].name).toBe('Silly Bee');
    const other = southScore(ctx('Silly Bee', SMALL_CARDS[8].picture, { card: 0 }));
    expect(other.value).toBe(0);
  });
  it('Golden Staircase: the honour pung never comes from a discard', () => {
    const pic = cardByName('Golden Staircase')!.picture;
    expect(southScore(ctx('Golden Staircase', pic)).value).toBeGreaterThan(0);
    expect(southScore(ctx('Golden Staircase', pic, { selfDrawn: false, winKind: parseKinds('Rd')[0] })).value).toBe(0);
  });
  it('a Joker Hand pays at least half limit', () => {
    const joker = SMALL_CARDS.indexOf(cardByName('A Joker Hand')!);
    const s = southScore(ctx('Silly Bee', SMALL_CARDS[8].picture, { card: joker }));
    expect(s.value).toBe(LIMIT_PAY.limit); // Silly Bee's own value
  });
});

describe('India Rules South round: bots play whole hands', () => {
  it('finishes hands, with wins scored and points kept whole', () => {
    let wins = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const g = southGame(seed);
      // Bought tiles' money sits in the bank until someone wins it.
      const before = g.players.reduce((a, p) => a + p.score, 0) + g.state.riichiPot;
      expect(playHandHeadless(g, [0, 1, 2, 3].map((s) => new AiPlayer(s, 'strategic', 'zen', seed * 10 + s)))).toBe(true);
      const ph = g.state.phase;
      if (ph.kind === 'handOver' && ph.result.type === 'win') {
        wins++;
        expect(ph.result.score!.value).toBeGreaterThanOrEqual(LIMIT_PAY.half);
      }
      expect(g.players.reduce((a, p) => a + p.score, 0) + g.state.riichiPot).toBe(before);
    }
    expect(wins).toBeGreaterThan(2);
  }, 120_000);
});

describe('India Rules South round: sorting your hand to your card', () => {
  it('pulls out only the sets your card uses', () => {
    // Silly Bee: a chow in each suit, a mixed chow and a pair; no pungs.
    const only = cardSets(cardByName('Silly Bee')!, 'S', 'S');
    expect(only.pungs.size).toBe(0);
    const hand = parseKinds('123m 555p 789s E').map((kind, id) => ({ id, kind }));
    const sets = (o?: typeof only) => new Set(arrangeHand(hand, { mode: 'suit', custom: null, groupSets: true, only: o }).filter((x) => x.set >= 0).map((x) => x.tile.kind));
    expect(sets()).toEqual(new Set(parseKinds('123m 5p 789s')));
    expect(sets(only)).toEqual(new Set(parseKinds('123m 789s')));
  });
});
