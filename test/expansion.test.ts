// The Expansion tables: every game the catalogue once listed as coming soon,
// now playable. Engine rules, scoring examples and AI tables for each.

import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { winningDecompositions } from '../src/engine/hand';
import { VARIATIONS, getProfile, withHouseRules } from '../src/engine/rules';
import { CATALOGUE } from '../src/club/catalogue';
import { VARIATION_SHEETS } from '../src/club/variationSheets';
import { LESSONS } from '../src/ui/academy';
import { guideFor } from '../src/ui/scoringGuideData';
import type { RuleProfile, ScoringContext } from '../src/engine/rules/types';
import { parseKinds, toCounts } from '../src/engine/tiles';
import { AiPlayer } from '../src/ai/players';
import { playHandHeadless } from '../src/club/sim';
import { umaFor } from '../src/engine/rules/riichiTournament';
import { guangdongPayments } from '../src/engine/rules/guangdong';
import { nextKind } from '../src/engine/game';
import { europeanPayments } from '../src/engine/rules/european';

const c = (s: string) => toCounts(parseKinds(s));
const k = (s: string) => parseKinds(s)[0];
const P = (id: string) => withHouseRules(getProfile(id)!, {});

function best(p: RuleProfile, hand: string, win: string, opts: Partial<ScoringContext> = {}) {
  const counts = c(hand);
  const scores = winningDecompositions(counts, 0, p.shapes).map((d) =>
    p.score({ decomposition: d, melds: [], concealedCounts: counts, winKind: k(win), selfDrawn: false, seatWind: 'S', prevailingWind: 'E', isDealer: false, lastTileOfWall: false, afterKong: false, dealerRepeat: 0, house: p.houseChoices, ...opts }),
  );
  return scores.filter((s) => s.qualifies !== false).sort((a, b) => b.points - a.points)[0] ?? null;
}
const names = (s: { items: { name: string }[] } | null) => s?.items.map((i) => i.name) ?? [];

/** Ids of the variations in this release. */
const EXPANSION = VARIATIONS.filter((v) => v.expansion).map((v) => v.id);

function playHands(id: string, hands: number) {
  let wins = 0;
  const p = P(id);
  const seats = p.players;
  for (let seed = 1; seed <= hands; seed++) {
    const g = new MahjongGame(p, Array.from({ length: seats }, (_, i) => `P${i}`), seed);
    g.startHand(seed * 17);
    const ais = Array.from({ length: seats }, (_, s) => new AiPlayer(s, 'strategic', 'teacher', seed + s));
    expect(playHandHeadless(g, ais), `${id} hand ${seed}`).toBe(true);
    const ph = g.state.phase;
    if (ph.kind === 'handOver' && ph.result.type === 'win') wins++;
  }
  return wins;
}

describe('the Expansion release', () => {
  it('every catalogue entry is playable, with a lesson and a rule sheet', () => {
    for (const e of CATALOGUE.filter((x) => x.tier === 'expansion' && x.status === 'playable')) {
      const id = e.variationId!;
      expect(getProfile(id), id).toBeTruthy();
      expect(LESSONS[VARIATIONS.find((v) => v.id === id)?.lesson ?? id], id).toBeDefined();
      const sheet = VARIATION_SHEETS.find((s) => s.id === id);
      expect(sheet, id).toBeDefined();
      expect(sheet!.mei, id).not.toMatch(/\d/);
      expect(sheet!.facts.length, id).toBeGreaterThan(2);
      expect(guideFor(P(id)).sections.length + guideFor(P(id)).win.length, id).toBeGreaterThan(0);
    }
    for (const id of EXPANSION) expect(CATALOGUE.find((e) => e.variationId === id)?.tier, id).toBe('expansion');
  });

  for (const id of ['riichi-tournament', 'ema', 'korean', 'guangdong', 'zung-jung', 'european', 'wuhan', 'shanghai', 'fujian', 'beijing', 'northeast', 'wright-patterson', 'thai', 'filipino', 'indonesian']) {
    it(`${id}: AI tables finish their hands and someone wins`, () => {
      const wins = playHands(id, 12);
      console.log(`${id}: ${wins}/12 hands won`);
      expect(wins).toBeGreaterThan(1);
    });
  }
});

describe('Riichi tournament rules', () => {
  const p = P('riichi-tournament');
  it('starts on 30,000 without red fives or abortive draws, and pays uma', () => {
    expect(p.startingScore).toBe(30000);
    expect(p.redFives).toBe(0);
    expect(p.abortiveDraws).toEqual({ nineTerminals: false, fourWinds: false, fourKongs: false, fourRiichi: false, tripleRon: false });
    expect(p.nagashiMangan).toBe(false);
    expect(p.endOnBust).toBe(false);
    expect(p.matchEnd!([40000, 30000, 20000, 30000])).toEqual([15000, 0, -15000, 0]);
    expect(umaFor([10, 20, 30, 40], [15000, 5000, -5000, -15000])).toEqual([-15000, -5000, 5000, 15000]);
    expect(withHouseRules(getProfile('riichi-tournament')!, { uma: '30-10' }).matchEnd!([4, 3, 2, 1])).toEqual([30000, 10000, -10000, -30000]);
  });
  it('the match end pays uma into the final scores', () => {
    const g = new MahjongGame(p, ['A', 'B', 'C', 'D'], 3);
    g.startHand(3);
    g.players.forEach((pl, i) => (pl.score = [42000, 31000, 27000, 20000][i]));
    g.state.round = { ...g.state.round, windIndex: 1, dealerHand: 3, dealerSeat: 3 };
    g.state.phase = { kind: 'handOver', result: { type: 'draw', tenpai: [false, false, false, false] } } as never;
    expect(g.advance()).toBe(true);
    expect(g.players.map((pl) => pl.score)).toEqual([57000, 36000, 22000, 5000]);
  });
});

describe('EMA tournament rules', () => {
  it('plays MCR without flowers and the deal always passes', () => {
    const p = P('ema');
    expect(p.flowers).toBe(false);
    expect(p.rounds.dealerRetention).toBe('never');
    expect(p.minValue === 0 || p.houseChoices?.minFan === undefined).toBe(true);
    expect(best(p, '123m 456m 789m 234p 55s', '5s')?.items.some((i) => i.name === 'Pure Straight')).toBe(true);
  });
});

describe('Korean four-player', () => {
  it('uses the whole set with flowers and four seats', () => {
    const p = P('korean');
    expect(p.players).toBe(4);
    expect(p.tileKinds.length).toBe(34);
    expect(p.calls.chow).toBe(false);
    const g = new MahjongGame(p, ['A', 'B', 'C', 'D'], 1);
    g.startHand(1);
    expect(g.state.wall.length).toBe(144);
  });
});

describe('Guangdong push-down', () => {
  const p = P('guangdong');
  it('any hand wins; fan double a two-point base', () => {
    expect(p.calls.chow).toBe(false);
    expect(best(p, '123m 456p 789s 234s 55m', '5m')).toMatchObject({ value: 0, points: 2 });
    expect(best(p, '111m 444m 777m EEE 99m', '9m')).toMatchObject({ value: 2, points: 8 }); // all pungs 1 + half flush 1
    expect(names(best(p, '11m 22m 33m 44m 55m 66m 77m', '7m'))).toEqual(expect.arrayContaining(['Seven Pairs', 'Full Flush']));
    expect(best(p, '19m 19p 19s ESWN RdGdWd 1m', '1m')?.limit).toBe(true);
  });
  it('the discarder alone pays; a self-draw is paid double by all', () => {
    const s = best(p, '123m 456p 789s 234s 55m', '5m')!;
    expect(guangdongPayments(0, 2, s, 0, 4)).toEqual([{ from: 2, to: 0, amount: 2 }]);
    expect(guangdongPayments(0, null, s, 0, 4).map((x) => x.amount)).toEqual([4, 4, 4]);
  });
});

describe('Zung Jung', () => {
  const p = P('zung-jung');
  it('scores the published patterns', () => {
    expect(best(p, '123m 456p 789s 234s 55m', '2s')).toMatchObject({ points: 10 }); // all sequences 5 + concealed 5
    expect(best(p, '234m 456p 678s 345s 55m', '2m')).toMatchObject({ points: 15 }); // + no terminals 5
    expect(names(best(p, 'RdRdRd GdGdGd WdWdWd 123m 55p', '5p'))).toContain('Big Three Dragons');
    expect(names(best(p, '123m 123p 123s 456m 99p', '9p'))).toContain('Three Similar Sequences');
    expect(names(best(p, '123m 456m 789m 234p 55s', '5s'))).toContain('Nine-Tile Straight');
    // Read as two runs twice (60) + all sequences 5 + pure one-suit 80 + concealed 5, which beats seven pairs.
    expect(best(p, '11m 22m 33m 44m 55m 66m 77m', '7m')!.points).toBe(150);
    expect(best(p, '11m 22m 55m 66m 99m EE NN', 'N')!.points).toBe(30 + 40);
    expect(best(p, 'EEE SSS WWW NNN RdRd', 'Rd')!.points).toBe(320);
  });
});

describe('European Classical', () => {
  const p = P('european');
  it('adds points, then doubles them', () => {
    // Mahjong 20 + concealed pung of honours 8 (red dragons) = 28; dragon pung + concealed hand = 2 doubles: 112.
    const s = best(p, 'RdRdRd 123m 456p 789s 55m', '5m')!;
    expect(s.points).toBe(112);
    expect(best(p, '19m 19p 19s ESWN RdGdWd 1m', '1m')).toMatchObject({ points: 1000, limit: true });
  });
  it('East pays and receives double', () => {
    const s = { value: 100, unit: 'points', items: [], points: 100, limit: false };
    expect(europeanPayments(1, 2, s, 0, 4).map((x) => [x.from, x.amount])).toEqual([[0, 200], [2, 100], [3, 100]]);
    expect(europeanPayments(0, null, s, 0, 4).map((x) => x.amount)).toEqual([200, 200, 200]);
  });
});

describe('natural wild tiles (laizi, baida, gold, hun’er)', () => {
  it('turns up a tile after the deal and makes the right kind wild', () => {
    for (const [id, pick] of [['wuhan', 'next'], ['beijing', 'next'], ['shanghai', 'same'], ['fujian', 'same']] as const) {
      const g = new MahjongGame(P(id), ['A', 'B', 'C', 'D'], 5);
      g.startHand(11);
      const ind = g.state.wildIndicator!;
      expect(ind, id).toBeTruthy();
      expect(g.state.outOfPlay?.some((t) => t.id === ind.id), id).toBe(true);
      const want = pick === 'same' ? ind.kind : nextKind(ind.kind);
      expect(g.state.wildKinds, id).toEqual([want]);
      expect(g.isWild(want)).toBe(true);
      expect(g.state.log.some((e) => e.type === 'wildTile')).toBe(true);
    }
  });
  it('counts a wild as any tile in the concealed hand', () => {
    const g = new MahjongGame(P('beijing'), ['A', 'B', 'C', 'D'], 5);
    g.startHand(11);
    const w = g.state.wildKinds![0];
    const seat = 1;
    // 123m 456m 789m 234p + a single 5s and one wild: wins on 5s... or rather, the wild makes the pair.
    const kinds = parseKinds('123m 456m 789m 234p 5s').filter((x) => x !== w);
    g.players[seat].hand = [...kinds.map((kind, i) => ({ id: 1000 + i, kind })), ...Array.from({ length: 14 - kinds.length - 1 }, (_, i) => ({ id: 2000 + i, kind: w }))];
    expect(g.isTenpai(seat)).toBe(true);
  });
  it('Wuhan: the pair must be twos, fives or eights', () => {
    const p = P('wuhan');
    expect(best(p, '123m 456m 789p 234s 55p', '5p')).not.toBeNull();
    expect(best(p, '123m 456m 789p 234s 33p', '3p')).toBeNull();
    // ...except in All Pungs.
    expect(best(p, '111m 444p 777s 999m 33p', '3p')).not.toBeNull();
  });
  it('Fujian: three golds win at once on your own draw', () => {
    const g = new MahjongGame(P('fujian'), ['A', 'B', 'C', 'D'], 5);
    g.startHand(11);
    const w = g.state.wildKinds![0];
    const ids = [0, 1, 2, 3].map((c) => w * 4 + c).filter((id) => id !== g.state.wildIndicator!.id);
    const pl = g.players[g.dealer];
    const junk = parseKinds('1m 4m 7m 2p 5p 8p 3s 6s 9s E S W N Rd').filter((k) => k !== w);
    pl.hand = [...junk.map((kind, i) => ({ id: 900 + i, kind })), ...ids.map((id) => ({ id, kind: w }))];
    const ev = g.evaluateWin(g.dealer, w, true, false);
    expect(ev?.score.items.some((i) => i.name === 'Three Golds Fall')).toBe(true);
  });
  it('Northeast: a win must pass the checklist', () => {
    const p = P('northeast');
    const open = [{ type: 'pung' as const, tiles: parseKinds('EEE').map((kind, id) => ({ id, kind })), concealed: false }];
    const ctx = (hand: string, win: string) => {
      const counts = c(hand);
      const d = winningDecompositions(counts, 1, p.shapes)[0];
      return p.score({ decomposition: d, melds: open, concealedCounts: counts, winKind: k(win), selfDrawn: false, seatWind: 'S', prevailingWind: 'E', isDealer: false, lastTileOfWall: false, afterKong: false, dealerRepeat: 0, house: {} });
    };
    expect(ctx('123m 456p 789s 55s', '5s').qualifies).not.toBe(false);
    expect(ctx('123m 456p 789p 55p', '5p').qualifies).toBe(false); // two suits only
    expect(names(best(p, '123m 456p 789s 111s 55s', '5s'))).toEqual([]); // concealed: not open
  });
  it('Northeast: a clamp needs a single wait', () => {
    const p = P('northeast');
    const open = [{ type: 'pung' as const, tiles: parseKinds('EEE').map((kind, id) => ({ id, kind })), concealed: false }];
    const clamp = (hand: string, win: string) => {
      const counts = c(hand);
      return winningDecompositions(counts, 1, p.shapes).some((d) => names(p.score({ decomposition: d, melds: open, concealedCounts: counts, winKind: k(win), selfDrawn: false, seatWind: 'S', prevailingWind: 'E', isDealer: false, lastTileOfWall: false, afterKong: false, dealerRepeat: 0, house: {} })).includes('Clamp (middle tile)'));
    };
    expect(clamp('123m 777p 456s 22p', '5s')).toBe(true); // 4s 6s waits on 5s only
    expect(clamp('123m 456p 567s 77s', '6s')).toBe(false); // 5s 777s waits on 5s or 6s
  });
  it('a wild standing as itself still makes a hard win, and seven pairs works with one', () => {
    const g = new MahjongGame(P('wuhan'), ['A', 'B', 'C', 'D'], 5);
    g.startHand(11);
    const w = g.state.wildKinds![0];
    const suit = Math.floor(w / 9);
    const [s1, s2] = [0, 1, 2].filter((x) => x !== suit);
    const lo = w % 9 <= 6 ? w : w - 2;
    const kinds = [lo, lo + 1, lo + 2, s1 * 9, s1 * 9 + 1, s1 * 9 + 2, s1 * 9 + 3, s1 * 9 + 4, s1 * 9 + 5, s2 * 9 + 6, s2 * 9 + 7, s2 * 9 + 4, s2 * 9 + 4];
    const seat = 1;
    g.players[seat].hand = kinds.map((kind, i) => ({ id: 3000 + i, kind }));
    const ev = g.evaluateWin(seat, s2 * 9 + 8, false, true);
    expect(names(ev?.score ?? null)).toContain('Hard win (no laizi)');
    // Seven pairs with a pair of laizi standing as themselves.
    const pairs = [w, s1 * 9, s1 * 9 + 2, s1 * 9 + 4, s2 * 9, s2 * 9 + 2, s2 * 9 + 6];
    g.players[seat].hand = pairs.flatMap((kind, i) => [{ id: 4000 + i * 2, kind }, { id: 4001 + i * 2, kind }]).slice(0, 13);
    const sp = g.evaluateWin(seat, s2 * 9 + 6, false, true);
    expect(names(sp?.score ?? null)).toContain('Seven Pairs');
  });
});

describe('Wright-Patterson', () => {
  const p = P('wright-patterson');
  it('has a Charleston and scores its special hands', () => {
    expect(p.charleston).toBeTruthy();
    expect(best(p, '123456789m ESWN 5m', '5m')?.items[0].name).toBe('Wriggling Snake');
    expect(best(p, '123456789m ESWN 5m', '5m')?.points).toBe(500);
    expect(best(p, '11m 33m 55p 77p 99s 22s EE', 'E')?.items[0].name).toBe('Heavenly Twins');
    expect(best(p, '11m 33m 55p 77p 99s 22s EE', 'E')?.points).toBe(250);
  });
});
