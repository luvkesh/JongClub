import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { winningDecompositions } from '../src/engine/hand';
import { withHouseRules } from '../src/engine/rules';
import { classicProfile } from '../src/engine/rules/classic';
import { BIG_CARD, CROCHET, KNITTING, MIXED_SETS, SMALL_CARD, cardShapes, passportShape, PASSPORT_COMBOS } from '../src/engine/rules/special';
import { CARD_FAAN, roundOverlay } from '../src/engine/rules/windRounds';
import { SMALL_CARDS } from '../src/engine/rules/indiaCards';
import { BIG_CARDS } from '../src/engine/rules/indiaBig';
import { northBig } from '../src/engine/rules/india';
import type { RuleProfile, ScoringContext } from '../src/engine/rules/types';
import { parseKinds, toCounts } from '../src/engine/tiles';
import { AiPlayer } from '../src/ai/players';
import { playHandHeadless } from '../src/club/sim';

const c = (s: string) => toCounts(parseKinds(s));
const k = (s: string) => parseKinds(s)[0];

function best(P: RuleProfile, hand: string, win: string, opts: Partial<ScoringContext> = {}) {
  const counts = c(hand);
  const decomps = winningDecompositions(counts, 0, P.shapes);
  if (!decomps.length) return null;
  const scores = decomps.map((d) =>
    P.score({ decomposition: d, melds: [], concealedCounts: counts, winKind: k(win), selfDrawn: false, seatWind: 'S', prevailingWind: 'E', isDealer: false, lastTileOfWall: false, afterKong: false, dealerRepeat: 0, house: P.houseChoices, ...opts }),
  );
  return scores.filter((s) => s.qualifies !== false).sort((a, b) => b.points - a.points)[0] ?? null;
}
const names = (s: { items: { name: string }[] } | null) => s?.items.map((i) => i.name) ?? [];

describe('mixed sets, knits, crochet (Classic)', () => {
  const C = withHouseRules(classicProfile, {});
  it('is on by default with flowers and seasons in play', () => {
    expect(C.flowers).toBe(true);
    expect(C.shapes.special?.map((s) => s.name)).toEqual(['Mixed sets', 'Knitting']);
  });
  it('accepts a mixed pung, a mixed chow and a knit pair', () => {
    expect(MIXED_SETS.complete(c('5m 5p 5s 123m 456p 789s 11m'), 0)).toBe(true);
    expect(MIXED_SETS.complete(c('3m 4p 5s 123m 456p 789s 11m'), 0)).toBe(true);
    expect(MIXED_SETS.complete(c('123m 456p 789s 234m 7p 7s'), 0)).toBe(true);
    // A plain hand is not this shape, and two of one suit in a run is not a mixed chow.
    expect(MIXED_SETS.complete(c('123m 456p 789s 234m 77s'), 0)).toBe(false);
    expect(MIXED_SETS.complete(c('3m 4m 5s 123m 456p 789s 11m'), 0)).toBe(false);
    const s = best(C, '5m 5p 5s 123m 456p 789s 11m', '1m')!;
    expect(names(s)).toContain('Mixed pung');
    expect(s.value).toBeGreaterThanOrEqual(2); // concealed + mixed pung
  });
  it('crochet: four mixed pungs and a knit; knitting: seven knits', () => {
    const cro = c('2m 2p 2s 4m 4p 4s 6m 6p 6s 8m 8p 8s 9m 9s');
    expect(CROCHET.complete(cro, 0)).toBe(true);
    expect(names(best(C, '2m 2p 2s 4m 4p 4s 6m 6p 6s 8m 8p 8s 9m 9s', '9s'))).toContain('Crochet');
    const kn = c('1m 1p 3m 3p 4m 4p 5m 5p 6m 6p 8m 8p 9m 9p');
    expect(KNITTING.complete(kn, 0)).toBe(true);
    expect(KNITTING.complete(c('1m 1p 3m 3p 4m 4p 5m 5p 6m 6p 8m 8p 9m 9s'), 0)).toBe(false);
    expect(names(best(C, '1m 1p 3m 3p 4m 4p 5m 5p 6m 6p 8m 8p 9m 9p', '9p'))).toContain('Knitting');
    // One away from each.
    expect(KNITTING.shanten(c('1m 1p 3m 3p 4m 4p 5m 5p 6m 6p 8m 8p 9m'), 0)).toBe(0);
    expect(CROCHET.shanten(c('2m 2p 2s 4m 4p 4s 6m 6p 6s 8m 8p 8s 9m'), 0)).toBe(0);
  });
  it('can be switched off', () => {
    const off = withHouseRules(classicProfile, { mixedSets: 'off' });
    expect(best(off, '5m 5p 5s 123m 456p 789s 11m', '1m')).toBeNull();
  });
});

describe('passports', () => {
  const P = passportShape('Passport', PASSPORT_COMBOS, 'straight');
  it('fits every combination', () => {
    expect(P.complete(c('E S W N Rd 123m 456p 789s'), 0)).toBe(true); // 5 + three sets
    expect(P.complete(c('E S W N Rd Gd 123m 456p 99s'), 0)).toBe(true); // 6 + two sets + pair
    expect(P.complete(c('123456789m 555p 11s'), 0)).toBe(true); // 9 + set + pair
    expect(P.complete(c('E S W N Rd E S W N Rd Gd 222p'), 0)).toBe(true); // 5 + 6 + set
    expect(P.complete(c('E S W N Rd Gd S W N Rd Gd Wd 55p'), 0)).toBe(true); // 6 + 6 + pair
    expect(P.complete(c('123456789m E S W N Rd'), 0)).toBe(true); // 9 + 5
    expect(P.complete(c('E S W N 123m 456p 789s 55m'), 0)).toBe(false); // only four honours
    expect(P.shanten(c('E S W N 123m 456p 789s'), 0)).toBe(0);
    // Sets may be called: one declared set and a five-passport.
    expect(P.complete(c('E S W N Rd 123m 456p'), 1)).toBe(true);
  });
  it('the knitted nine-passport is a house option', () => {
    const K = passportShape('Passport', PASSPORT_COMBOS, 'knitted');
    expect(K.complete(c('147m 258p 369s 555p 11s'), 0)).toBe(true);
    expect(K.complete(c('123456789m 555p 11s'), 0)).toBe(false);
  });
});

describe('special wind rounds', () => {
  const S = withHouseRules(classicProfile, { specialRounds: 'on' });
  it('East plays passports, South and North the cards, West the goulash', () => {
    const e = roundOverlay(S, 'passport');
    expect(best(e, '123m 456p 789s 234m 55p', '5p')).toBeNull();
    expect(names(best(e, 'E S W N Rd 123m 456p 789s', '9s'))).toContain('Passport (5)');
    expect(names(best(e, '123456789m E S W N Rd', 'Rd'))).toContain('Double Passport (9 + 5)');
    // South and North play the club's cards (the Mahjong Calling rulebook), scored in faan.
    const south = roundOverlay(S, 'smallCard');
    expect(south.specialRound).toBe('smallCard');
    expect(south.dealCards).toBe(SMALL_CARDS.length);
    expect(south.cardChoice).toBe(3);
    const lily = SMALL_CARDS.findIndex((x) => x.name === 'Lily of the Valley');
    const lilyCtx = { decomposition: { shape: 'special' as const, special: 'Lily of the Valley', sets: [], pair: -1 }, card: lily, melds: [], concealedCounts: c('GdGdGd WdWdWd 222s 666s 88s'), winKind: k('8s'), selfDrawn: true, seatWind: 'S' as const, prevailingWind: 'S' as const, isDealer: false, lastTileOfWall: false, afterKong: false, dealerRepeat: 0, house: S.houseChoices, flowers: [] };
    const lilyScore = south.score(lilyCtx);
    expect(lilyScore.qualifies).not.toBe(false);
    expect(names(lilyScore)).toEqual(['Lily of the Valley', 'Self-drawn']);
    expect(lilyScore.value).toBe(CARD_FAAN.double + 1);
    expect(south.score({ ...lilyCtx, card: lily + 1 }).qualifies).toBe(false);
    const north = roundOverlay(S, 'bigCard');
    expect(north.roundChoices?.length).toBe(BIG_CARDS.length);
    const news = roundOverlay(S, `bigCard:${northBig(1)}`);
    expect(news.big?.name).toBe('Breaking News');
    expect(news.specialRound).toBe('bigCard');
    expect(news.bigWinScore!({ concealed: true, selfDrawn: false, seatWind: 'S', flowers: [] }).value).toBe(CARD_FAAN.double);
    expect(news.bigWinScore!({ concealed: false, selfDrawn: true, seatWind: 'S', flowers: [] }).value).toBe(CARD_FAAN.limit + 1);
    const west = roundOverlay(S, 'goulash');
    expect(west.calls.chow).toBe(false);
    expect(west.minValue).toBe(3);
    expect(winningDecompositions(c('123m 456p 789s 234m 55p'), 0, west.shapes)).toEqual([]);
  });
  it('every card hand has a picture and a working shape', () => {
    for (const h of [...SMALL_CARD, ...BIG_CARD]) {
      expect(h.picture.length).toBeGreaterThan(3);
      const [shape] = cardShapes([h], 'straight');
      const counts = c(h.picture.replace(/\|/g, ' '));
      expect(shape.complete(counts, 0), h.name).toBe(true);
      expect(shape.shanten(counts, 0), h.name).toBe(-1);
    }
  });
  it('the game switches rules with the wind and plays the West exchanges', () => {
    const g = new MahjongGame(S, ['A', 'B', 'C', 'D'], 7);
    g.startHand(7);
    expect(g.profile.specialRound).toBe('passport');
    g.state.round = { ...g.state.round, windIndex: 2 };
    g.startHand(8);
    expect(g.profile.specialRound).toBe('goulash');
    expect(g.state.phase.kind).toBe('exchangeChoice');
    const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, 'strategic', 'teacher', 3 + s));
    g.chooseExchanges(g.dealer, 3, 3);
    expect(g.state.phase.kind).toBe('charleston');
    expect(playHandHeadless(g, ais)).toBe(true);
    expect(g.state.outOfPlay?.length).toBe(36);
    for (const e of ['exchangeChosen', 'wallExchanged']) expect(g.state.log.some((x) => x.type === e)).toBe(true);
  });
  it('South deals each seat three club Small Cards; North asks East for a Big Card first', () => {
    const g = new MahjongGame(S, ['A', 'B', 'C', 'D'], 3);
    g.state.round = { ...g.state.round, windIndex: 1 };
    g.startHand(3);
    expect(g.state.phase.kind).toBe('cardPick');
    expect(g.state.cardOffers?.every((o) => o.length === 3)).toBe(true);
    g.state.round = { ...g.state.round, windIndex: 3 };
    g.startHand(4);
    expect(g.state.phase.kind).toBe('roundChoice');
    const ai = new AiPlayer(g.dealer, 'strategic', 'teacher', 9);
    const code = ai.roundChoice(g);
    expect(code).toBeGreaterThan(100);
    g.chooseRound(g.dealer, code);
    expect(g.profile.big?.n).toBe(code - 100);
    expect(g.state.phase.kind).not.toBe('roundChoice');
  });
  it('AI tables finish every round', () => {
    let wins = 0;
    for (const wind of [0, 1, 2, 3]) {
      for (let seed = 1; seed <= 6; seed++) {
        const g = new MahjongGame(S, ['A', 'B', 'C', 'D'], seed);
        g.state.round = { ...g.state.round, windIndex: wind };
        g.startHand(seed * 31 + wind);
        const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, 'strategic', 'teacher', seed + s));
        expect(playHandHeadless(g, ais)).toBe(true);
        const ph = g.state.phase;
        if (ph.kind === 'handOver' && ph.result.type === 'win') wins++;
      }
    }
    expect(wins).toBeGreaterThan(4);
  });
});
