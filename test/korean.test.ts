// Korean Mahjong (three players): the reduced set, three-seat flow, scoring
// examples, and many full AI matches played to the end.

import { describe, expect, it } from 'vitest';
import { AiPlayer, type Difficulty, type Personality } from '../src/ai/players';
import { buildProfile, playHandHeadless, simulateMatch } from '../src/club/sim';
import { CATALOGUE } from '../src/club/catalogue';
import { MahjongGame } from '../src/engine/game';
import type { Decomposition } from '../src/engine/hand';
import { winningDecompositions } from '../src/engine/hand';
import { Rng } from '../src/engine/rng';
import { roundProfileFor } from '../src/engine/rounds';
import { getProfile, seatsOf, UPCOMING_VARIATIONS, VARIATIONS, withHouseRules } from '../src/engine/rules';
import { KOREAN_KINDS, koreanPayments, koreanProfile, koreanScore } from '../src/engine/rules/korean';
import type { ScoringContext } from '../src/engine/rules/types';
import type { Meld } from '../src/engine/state';
import { FLOWER_BASE, kindOfTileId, parseKinds, toCounts } from '../src/engine/tiles';
import { seatLayout } from '../src/render/seatLayout';

const DIFFS: Difficulty[] = ['beginner', 'casual', 'strategic', 'expert'];
const PERS: Personality[] = ['teacher', 'shark', 'wall', 'gambler', 'zen'];

/** Every physical tile is in exactly one place: wall, hand, meld, discards or flowers. */
function checkConservation(g: MahjongGame) {
  const s = g.state;
  const ids: number[] = s.wall.slice(s.drawnFromFront, s.wall.length - s.drawnFromBack).map((t) => t.id);
  for (const p of s.players) {
    ids.push(...p.hand.map((t) => t.id), ...p.discards.map((t) => t.id), ...p.flowers.map((t) => t.id));
    for (const m of p.melds) ids.push(...m.tiles.map((t) => t.id));
  }
  expect(ids.length).toBe(s.wall.length);
  expect(new Set(ids).size).toBe(s.wall.length);
}

function ctx(spec: string, over: Partial<ScoringContext> = {}, melds: Meld[] = []): ScoringContext {
  const counts = toCounts(parseKinds(spec));
  const decs = winningDecompositions(counts, melds.length, koreanProfile.shapes);
  expect(decs.length, spec).toBeGreaterThan(0);
  return {
    decomposition: decs[0] as Decomposition,
    melds,
    concealedCounts: counts,
    winKind: parseKinds(spec)[0],
    selfDrawn: false,
    seatWind: 'S',
    prevailingWind: 'E',
    isDealer: false,
    lastTileOfWall: false,
    afterKong: false,
    dealerRepeat: 0,
    ...over,
  };
}

const pung = (spec: string): Meld => ({ type: 'pung', tiles: parseKinds(spec).map((kind, i) => ({ id: 1000 + kind * 4 + i, kind })), concealed: false, from: 0 });

describe('Korean three-player: the set and the table', () => {
  it('uses 108 tiles plus eight flowers, without Characters 2–8', () => {
    expect(KOREAN_KINDS.length).toBe(27);
    for (let k = 1; k <= 7; k++) expect(KOREAN_KINDS).not.toContain(k);
    const g = new MahjongGame(koreanProfile, ['A', 'B', 'C', 'D'], 1);
    g.startHand(42);
    expect(g.players.length).toBe(3);
    expect(g.state.wall.length).toBe(116);
    // Fixed ids: every tile shows the face kindOfTileId says.
    for (const t of g.state.wall) expect(kindOfTileId(t.id)).toBe(t.kind);
    expect(g.state.seatWinds).toEqual(['E', 'S', 'W']);
    const sizes = g.players.map((p) => p.hand.length + p.flowers.length * 0);
    expect(sizes).toEqual([14, 13, 13]);
    checkConservation(g);
  });

  it('never offers a chow by default, and from the left only with the house rule', () => {
    const p = withHouseRules(koreanProfile, { chow: 'left' });
    expect(p.calls.chow).toBe(true);
    expect(koreanProfile.calls.chow).toBe(false);
    for (let seed = 0; seed < 20; seed++) {
      const g = new MahjongGame(koreanProfile, ['A', 'B', 'C'], seed);
      g.startHand(seed * 7 + 1);
      const ais = [0, 1, 2].map((s) => new AiPlayer(s, 'casual', 'shark', seed + s));
      let guard = 0;
      while (g.state.phase.kind !== 'handOver' && guard++ < 500) {
        const ph = g.state.phase;
        if (ph.kind === 'claims') for (const o of Object.values(ph.options)) expect(o.some((x) => x.type === 'chow')).toBe(false);
        playHandHeadless(g, ais, 1);
      }
    }
  });

  it('plays East and South with three hands each, and E–S–W for the longest format', () => {
    expect(koreanProfile.rounds.prevailingWinds).toEqual(['E', 'S']);
    expect(roundProfileFor('fullNews', koreanProfile.rounds).prevailingWinds).toEqual(['E', 'S', 'W']);
    expect(roundProfileFor('timed', koreanProfile.rounds).prevailingWinds).toEqual(['E', 'S', 'W']);
    // Four-seat profiles keep all four winds.
    expect(roundProfileFor('fullNews', getProfile('classic')!.rounds).prevailingWinds).toEqual(['E', 'S', 'W', 'N']);
    const r = simulateMatch({ variation: 'korean3', length: 'eastSouth', houseRules: { dealerRetention: 'never' }, difficulties: DIFFS, personalities: PERS, names: ['A', 'B', 'C'], seed: 9 });
    // Six hands unless someone busts first.
    if (!r.standings.some((s) => s.score < 0)) expect(r.hands).toBe(6);
  });

  it('is released: playable in the catalogue as a regional family, three seats', () => {
    expect(getProfile('korean3')).toBe(koreanProfile);
    const v = VARIATIONS.find((x) => x.id === 'korean3')!;
    expect(seatsOf(v)).toBe(3);
    expect(seatsOf(VARIATIONS[0])).toBe(4);
    expect(UPCOMING_VARIATIONS.some((x) => x.id === 'korean3')).toBe(false);
    const e = CATALOGUE.find((x) => x.id === 'korean3')!;
    expect(e.standardisation).toBe('regional');
    expect(e.status).toBe('playable');
    expect(e.blurb).toMatch(/JongClub’s table defaults/);
  });
});

describe('Korean scoring', () => {
  it('a concealed self-draw meets the two-point minimum', () => {
    const s = koreanScore(ctx('123p 456p 789s 234s 11p', { selfDrawn: true }));
    expect(s.items.map((i) => i.name)).toEqual(['Self-drawn', 'Concealed hand']);
    expect(s.value).toBe(2);
    expect(s.qualifies).toBe(true);
    expect(s.points).toBe(200);
  });

  it('a concealed discard win needs something more: the ready declaration', () => {
    const plain = koreanScore(ctx('123p 456p 789s 234s 11p'));
    expect(plain.value).toBe(1);
    expect(plain.qualifies).toBe(false);
    const ready = koreanScore(ctx('123p 456p 789s 234s 11p', { riichi: true }));
    expect(ready.value).toBe(2);
    expect(ready.qualifies).toBe(true);
  });

  it('flowers pay but never count toward the minimum', () => {
    const fl = [FLOWER_BASE, FLOWER_BASE + 1, FLOWER_BASE + 5];
    const s = koreanScore(ctx('123p 456p 789s 234s 11p', { flowers: fl }));
    expect(s.value).toBe(4);
    expect(s.qualifies).toBe(false);
    // Seat flowers only: South is seat 2, so only flower 2 (Orchid) and 6 (Summer) pay.
    const seat = koreanScore(ctx('123p 456p 789s 234s 11p', { flowers: fl, riichi: true, house: { flowers: 'seat' } }));
    expect(seat.items.find((i) => i.name === 'Seat flowers')!.value).toBe(2);
    expect(seat.value).toBe(4);
  });

  it('open hands score from value pungs, all pungs and flushes', () => {
    // Red dragon pung called, white dragon pung concealed: 2 points.
    const s = koreanScore(ctx('WdWdWd 234p 678p 99s', {}, [pung('RdRdRd')]));
    expect(s.items.map((i) => i.name).sort()).toEqual(['Red Dragon pung', 'White Dragon pung']);
    expect(s.qualifies).toBe(true);
    // Mixed one suit (2) + seat wind pung (South, 1) + all pungs (2).
    const m = koreanScore(ctx('111p 555p 99p', { seatWind: 'S' }, [pung('SSS'), pung('777p')]));
    expect(m.items.map((i) => i.name).sort()).toEqual(['All Pungs', 'Mixed One Suit', 'Seat wind pung'].sort());
    expect(m.value).toBe(5);
  });

  it('seven pairs, pure suit and limits', () => {
    expect(koreanScore(ctx('11p 22p 55s 66s 99s EE RdRd')).items.map((i) => i.name)).toContain('Seven Pairs');
    const pure = koreanScore(ctx('123p 234p 456p 789p 99p', { selfDrawn: true }));
    expect(pure.value).toBe(1 + 1 + 5);
    const orphans = koreanScore(ctx('19m 19p 19s ESWN RdGdWd 1m'));
    expect(orphans.limit).toBe(true);
    expect(orphans.value).toBe(10);
    expect(orphans.points).toBe(1000);
  });

  it('pays: self-draw from both, discard from the discarder alone, plus counters', () => {
    const s = { value: 3, unit: 'pt', items: [], points: 300, limit: false };
    expect(koreanPayments(0, null, s, 0, 3, 0)).toEqual([
      { from: 1, to: 0, amount: 300 },
      { from: 2, to: 0, amount: 300 },
    ]);
    expect(koreanPayments(0, 2, s, 0, 3, 1)).toEqual([{ from: 2, to: 0, amount: 800 }]);
  });
});

describe('Korean lesson examples match the engine', () => {
  it('Red Dragons, concealed, self-drawn, two flowers: five points, five hundred from each player', () => {
    const s = koreanScore(ctx('99s RdRdRd 234p 678p 345s', { selfDrawn: true, flowers: [FLOWER_BASE, FLOWER_BASE + 4] }));
    expect(s.items.map((i) => i.name)).toEqual(['Self-drawn', 'Concealed hand', 'Red Dragon pung', 'Flowers']);
    expect([s.value, s.points, s.qualifies]).toEqual([5, 500, true]);
    expect(koreanPayments(0, null, s, 1, 3, 0).map((p) => p.amount)).toEqual([500, 500]);
    // Without the self-draw the hand still has two points from its sets: concealed and Red Dragons.
    const ron = koreanScore(ctx('99s RdRdRd 234p 678p 345s', { flowers: [FLOWER_BASE, FLOWER_BASE + 4] }));
    expect([ron.value, ron.qualifies]).toEqual([4, true]);
    expect(koreanPayments(0, 2, ron, 1, 3, 0)).toEqual([{ from: 2, to: 0, amount: 800 }]);
  });
});

describe('Korean three-player: full AI matches', () => {
  it('plays many matches to the end: no crashes, tiles conserved, scores balance', () => {
    let wins = 0;
    let draws = 0;
    let selfDraws = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const rng = new Rng(seed);
      const house: Record<string, string> = seed % 5 === 0 ? { flowers: 'off', riichi: 'off' } : seed % 7 === 0 ? { chow: 'left', payout: 'split' } : {};
      const rp = buildProfile('korean3', seed % 3 === 0 ? 'eastSouth' : 'eastRound', house);
      const g = new MahjongGame(rp, ['A', 'B', 'C'], seed);
      const ais = [0, 1, 2].map((s) => new AiPlayer(s, DIFFS[(seed + s) % 4], PERS[(seed * 3 + s) % 5], seed * 31 + s));
      const total = () => g.players.reduce((a, p) => a + p.score, 0) + g.state.riichiPot;
      const start = total();
      for (let h = 0; h < 40; h++) {
        g.startHand(Math.floor(rng.next() * 2 ** 31));
        checkConservation(g);
        let steps = 0;
        while (g.state.phase.kind !== 'handOver') {
          playHandHeadless(g, ais, 1);
          if (++steps % 7 === 0) checkConservation(g);
          expect(steps).toBeLessThan(2000);
        }
        checkConservation(g);
        const r = (g.state.phase as { kind: 'handOver'; result: import('../src/engine/state').HandResult }).result;
        expect(r.deltas.length).toBe(3);
        if (r.type === 'win') {
          wins++;
          if (r.discarder === null) selfDraws++;
          expect(r.score!.qualifies).not.toBe(false);
          expect(r.score!.value).toBeGreaterThanOrEqual(rp.minValue);
          expect(r.deltas[r.winner!]).toBeGreaterThan(0);
        } else draws++;
        expect(r.deltas.reduce((a, b) => a + b, 0) + (r.potAnte ?? 0) * 0).toBe(0);
        expect(total()).toBe(start);
        if (g.advance()) break;
      }
      expect(g.matchOver).toBe(true);
    }
    expect(wins).toBeGreaterThan(draws / 3);
    expect(selfDraws).toBeGreaterThan(0);
  }, 120_000);

  it('simulateMatch handles three seats and is deterministic', () => {
    const cfg = { variation: 'korean3', length: 'eastSouth' as const, difficulties: DIFFS, personalities: PERS, names: ['A', 'B', 'C'], seed: 77 };
    const a = simulateMatch(cfg);
    const b = simulateMatch(cfg);
    expect(a.standings.length).toBe(3);
    expect(a.capped).toBe(false);
    expect(a).toEqual(b);
    expect(a.standings.reduce((x, s) => x + s.score, 0) + a.leftoverPot).toBe(30000);
  });

  it('seat layout helper places three seats without the across position', () => {
    expect(seatLayout(3, 0).map((s) => s.position)).toEqual(['bottom', 'right', 'left']);
    expect(seatLayout(4, 0).map((s) => s.position)).toEqual(['bottom', 'right', 'top', 'left']);
    expect(seatLayout(3, 1).map((s) => s.position)).toEqual(['left', 'bottom', 'right']);
  });
});
