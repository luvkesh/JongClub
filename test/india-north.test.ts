import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { withHouseRules } from '../src/engine/rules';
import { DOUBLE_LIMIT_CARDS, INDIA_ROUND_CHOICES, NORTH, NORTH_CHOICES, indiaProfile, northGoulash } from '../src/engine/rules/india';
import { SMALL_CARDS, cardComplete } from '../src/engine/rules/indiaCards';
import { FLOWER_BASE, parseKinds, toCounts } from '../src/engine/tiles';
import { wildDecompositions } from '../src/engine/hand';
import { playHandHeadless, simulateMatch } from '../src/club/sim';
import { AiPlayer } from '../src/ai/players';
import { decodeAction, encodeAction } from '../src/net/lockstep';
import { setHand, toTurn } from './helpers-india';

const NORTH_ONLY = withHouseRules(indiaProfile, { indiaRounds: 'N' });
const ais = () => [0, 1, 2, 3].map((s) => new AiPlayer(s, 'casual', 'zen', s + 7));

function northGame(code: number, seed = 5, profile = NORTH_ONLY) {
  const g = new MahjongGame(profile, ['A', 'B', 'C', 'D'], seed);
  g.startHand(seed);
  g.chooseRound(g.dealer, code);
  return g;
}

describe('India Rules North round: East chooses the game (pp. 30-32)', () => {
  it('is offered in the round picker, alone and in every mix', () => {
    expect(INDIA_ROUND_CHOICES.find((c) => c.value === 'N')?.label).toBe('North round: East’s choice');
    expect(INDIA_ROUND_CHOICES.find((c) => c.value === 'ESWN')?.label).toBe('East, South, West and North');
    expect(INDIA_ROUND_CHOICES).toHaveLength(16);
  });

  it('asks East before the deal, and only East may answer', () => {
    const g = new MahjongGame(NORTH_ONLY, ['A', 'B', 'C', 'D'], 3);
    g.startHand(3);
    expect(g.state.phase).toEqual({ kind: 'roundChoice', seat: g.dealer });
    expect(g.players.every((p) => p.hand.length === 0)).toBe(true);
    expect(g.profile.roundChoices?.map((c) => c.code)).toEqual(NORTH_CHOICES.map((c) => c.code));
    expect(() => g.chooseRound((g.dealer + 1) % 4, NORTH.east)).toThrow();
    expect(() => g.chooseRound(g.dealer, 99)).toThrow();
    g.chooseRound(g.dealer, NORTH.east);
    expect(g.state.phase.kind).toBe('turn');
    expect(g.players[g.dealer].hand.length).toBe(14);
    expect(g.profile.specialRound).toBe('indiaEast');
    expect(g.profile.chosenGame).toBe('East round: passport compulsory');
  });

  it('the East round: compulsory or optional passport as East says, no exchange', () => {
    expect(northGame(NORTH.east).profile.shapes.special?.[0].name).toBeDefined();
    const open = northGame(NORTH.eastOpen);
    expect(open.profile.chosenGame).toBe('East round: passport optional');
    expect(open.state.exchange).toBeUndefined();
    // A plain 3+3+3+3+2 wins only when the passport is optional.
    const hand = parseKinds('123m 456m 789p 111s EE');
    for (const [code, wins] of [
      [NORTH.east, false],
      [NORTH.eastOpen, true],
    ] as const) {
      const g = northGame(code);
      setHand(g, g.dealer, hand);
      expect(!!g.evaluateWin(g.dealer, hand[13], true, false), String(code)).toBe(wins);
    }
  });

  it('the next hand asks again, and its game can differ', () => {
    const g = northGame(NORTH.small, 9);
    expect(playHandHeadless(g, ais())).toBe(true);
    g.advance();
    g.startHand(10);
    expect(g.state.phase.kind).toBe('roundChoice');
    expect(g.state.roundVariant).toBeUndefined();
    g.chooseRound(g.dealer, northGoulash(5));
    expect(g.profile.specialRound).toBe('indiaWest');
  });

  it('travels in the lockstep log', () => {
    const a = { t: 'rc' as const, s: 2, c: northGoulash(7) };
    expect(decodeAction(encodeAction(a))).toEqual(a);
  });
});

describe('North: Small Cards with jokers', () => {
  it('deals one double-limit card each; flowers stay in the hand as jokers, unpaid', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const g = northGame(NORTH.small, seed);
      expect(g.state.cardOffers).toBeUndefined();
      expect(g.state.cards).toHaveLength(4);
      for (const c of g.state.cards!) expect(DOUBLE_LIMIT_CARDS).toContain(c);
      expect(g.players.every((p) => p.flowers.length === 0)).toBe(true);
      expect(g.isBonus(FLOWER_BASE)).toBe(false);
      expect(g.isWild(FLOWER_BASE + 3)).toBe(true);
      expect(g.profile.handPayments?.({} as never)).toEqual([]);
    }
    const all = withHouseRules(indiaProfile, { indiaRounds: 'N', northCards: 'all' });
    const seen = new Set<number>();
    for (let seed = 1; seed < 30; seed++) for (const c of northGame(NORTH.small, seed, all).state.cards!) seen.add(c);
    expect([...seen].some((c) => !DOUBLE_LIMIT_CARDS.includes(c))).toBe(true);
  });

  it('a flower or season stands in for any tile of the card', () => {
    const g = northGame(NORTH.small, 4);
    toTurn(g);
    const seat = g.dealer;
    const idx = DOUBLE_LIMIT_CARDS.find((i) => cardComplete(SMALL_CARDS[i], toCounts(parseKinds(SMALL_CARDS[i].picture)), [], 27, 30))!;
    expect(idx).toBeDefined();
    g.state.cards![seat] = idx;
    const kinds = parseKinds(SMALL_CARDS[idx].picture);
    g.players[seat].melds = [];
    while (g.players[seat].hand.length > 14) g.players[seat].hand.pop();
    // Two tiles of the picture become a flower and a season.
    const withJokers = [...kinds.slice(0, 12), FLOWER_BASE, FLOWER_BASE + 4];
    setHand(g, seat, withJokers);
    expect(g.evaluateWin(seat, kinds[11], true, false), SMALL_CARDS[idx].name).not.toBeNull();
    // Without the jokers, two odd tiles don't make the card.
    setHand(g, seat, [...kinds.slice(0, 12), 27, 27].map((k, i) => (i >= 12 && kinds.includes(27) ? 33 : k)));
    expect(g.evaluateWin(seat, kinds[11], true, false)).toBeNull();
  });
});

describe('North: Goulash with jokers', () => {
  it('the number East names is a joker in each suit, one of each per player', () => {
    const g = northGame(northGoulash(5), 6);
    expect(g.state.wildKinds).toEqual([4, 13, 22]);
    expect(g.profile.wildCap).toBe(1);
    // One 5 of bamboos is a joker; the second is a natural tile.
    const two = [{ id: 1, kind: 22 }, { id: 2, kind: 22 }, { id: 3, kind: 0 }];
    expect(g.wildsIn(two)).toHaveLength(1);
    expect(g.naturalCounts(two)[22]).toBe(1);
    // Three different 5s are three jokers.
    expect(g.wildsIn([{ id: 1, kind: 4 }, { id: 2, kind: 13 }, { id: 3, kind: 22 }])).toHaveLength(3);
  });

  it('a joker completes a pung for a clean hand', () => {
    const g = northGame(northGoulash(5), 6);
    toTurn(g);
    const seat = g.dealer;
    g.players[seat].melds = [];
    while (g.players[seat].hand.length > 14) g.players[seat].hand.pop();
    // Bamboos and dragons: 111s 999s 22s RdRdRd GdGd + a 5 of rings as the third 2 of bamboos.
    const hand = [...parseKinds('111s 999s 22s RdRdRd GdGd'), 13];
    setHand(g, seat, hand);
    expect(g.evaluateWin(seat, 13, true, false)).not.toBeNull();
  });

  it('a discarded 5 is a natural tile: a natural pair may pung it', () => {
    const g = northGame(northGoulash(5), 8);
    toTurn(g);
    const d = g.state.phase.kind === 'turn' ? g.state.phase.seat : 0;
    const next = (d + 1) % 4;
    const pl = g.players[next];
    setHand(g, next, [22, 22, ...pl.hand.slice(2).map((t) => (t.kind === 22 ? 0 : t.kind))]);
    const hand = g.players[d].hand;
    hand[0].kind = 22;
    g.discard(d, hand[0].id);
    const ph = g.state.phase;
    expect(ph.kind).toBe('claims');
    if (ph.kind === 'claims') expect(ph.options[next]?.some((o) => o.type === 'pung')).toBe(true);
  });
});

describe('North Goulash: every set keeps a natural tile (user, 2026-10-25)', () => {
  it('two jokers may top up a pung, but jokers alone make no set or pair', () => {
    const g = northGame(northGoulash(5), 6);
    const P = g.profile.wilds!;
    expect(P.natural).toBe(true);
    const seat = g.dealer;
    g.players[seat].melds = [];
    const two = g.wildsIn([{ id: 1, kind: 4 }, { id: 2, kind: 13 }]);
    expect(two).toHaveLength(2);
    const read = (hand: string, spec = P) => wildDecompositions(toCounts(parseKinds(hand)), two, 0, g.shapesFor(seat), spec);
    // Four sets in hand and two jokers: the pair must hold a natural tile, so it is one of the hand's own kinds.
    const own = parseKinds('1s 9s 2s Rd');
    const pairs = (spec = P) => read('111s 999s 222s RdRdRd', spec).map((r) => r.decomposition.pair);
    expect(pairs().length).toBeGreaterThan(0);
    expect(pairs().every((k) => own.includes(k))).toBe(true);
    // Without the ruling, two jokers could pair on their own (a pair of some other tile).
    expect(pairs({ ...P, natural: false }).some((k) => !own.includes(k))).toBe(true);
    // Two jokers and one natural 2 of Bamboos make a pung.
    expect(read('111s 999s 2s RdRdRd GdGd').length).toBeGreaterThan(0);
  });
});

describe('North: whole matches', () => {
  it('a North round plays out with bots choosing every game', () => {
    const r = simulateMatch({ variation: 'india', length: 'fullNews', houseRules: { indiaRounds: 'N' }, seed: 42, names: [], difficulties: [], personalities: [] } as never);
    expect(r.capped).toBe(false);
    expect(r.hands).toBeGreaterThanOrEqual(4);
  }, 60_000);
});
