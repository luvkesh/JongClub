// Vietnamese, Indian club and Singapore profiles: tile sets, joker hands,
// animal bonus tiles, scoring, payments and full AI-vs-AI hands.

import { describe, expect, it } from 'vitest';
import { applyAction, decisionAction } from '../src/net/actions';
import { AiPlayer } from '../src/ai/players';
import { turnHint } from '../src/ai/jongbot';
import { reviewDiscard } from '../src/ai/review';
import { MahjongGame } from '../src/engine/game';
import { wildDecompositions, wildShanten, winningDecompositions } from '../src/engine/hand';
import { VARIATIONS, getProfile, withHouseRules } from '../src/engine/rules';
import { americanProfile } from '../src/engine/rules/american';
import { indianProfile } from '../src/engine/rules/indian';
import { SG_UNIT, singaporeInstant, singaporeProfile } from '../src/engine/rules/singapore';
import type { RuleProfile, ScoringContext } from '../src/engine/rules/types';
import { VN_STAKE, vietnameseProfile } from '../src/engine/rules/vietnamese';
import type { Tile } from '../src/engine/tiles';
import { CAT, CENTIPEDE, FLOWER_BASE, JOKER_KIND, MOUSE, ROOSTER, TILE_ID_COUNT, WIND_JOKER, isAnimal, isJoker, kindOfTileId, parseKinds, tileName, toCounts } from '../src/engine/tiles';

/** Give seat 0 exactly these tiles (the last one as the drawn tile), as dealer on its turn. */
function handFor(profile: RuleProfile, spec: string, flowers: number[] = []) {
  const g = new MahjongGame(profile, ['A', 'B', 'C', 'D'], 1);
  g.startHand(1);
  const kinds = parseKinds(spec);
  let id = 1000;
  const tiles: Tile[] = kinds.map((kind) => ({ id: id++, kind }));
  const pl = g.players[0];
  pl.hand = tiles;
  pl.melds = [];
  pl.flowers = flowers.map((kind) => ({ id: id++, kind }));
  g.state.phase = { kind: 'turn', seat: 0, drawn: tiles[tiles.length - 1], afterKong: false, mustDiscardOnly: false };
  return g;
}

function playHand(g: MahjongGame, ais: AiPlayer[], seed: number) {
  g.startHand(seed);
  let steps = 0;
  while (g.state.phase.kind !== 'handOver' && steps++ < 3000) {
    const ph = g.state.phase;
    if (ph.kind === 'turn') {
      // JongBot hints and replay review must never crash on jokers or animals.
      if (ph.seat === 0) {
        turnHint(g, 0, 'advanced');
        const d = ais[0].decideTurn(g);
        if (d.action === 'discard') reviewDiscard(g, 0, d.tileId!);
      }
      const d = ais[ph.seat].decideTurn(g);
      if (d.action === 'abort' || d.action === 'kita') applyAction(g, decisionAction(ph.seat, d));
      else if (d.action === 'win') g.declareSelfDrawWin(ph.seat);
      else if (d.action === 'kong') g.declareKong(ph.seat, d.kind!);
      else g.discard(ph.seat, d.tileId!, { riichi: d.riichi });
    } else if (ph.kind === 'claims') {
      for (const s of g.pendingClaimSeats()) {
        const cur = g.state.phase;
        if (cur.kind !== 'claims') break;
        g.respond(s, ais[s].decideClaim(g, cur.options[s], cur.tile.kind));
      }
    }
  }
  expect(g.state.phase.kind).toBe('handOver');
}

function playMatch(profile: RuleProfile, seeds: number[], level: 'strategic' | 'casual' = 'strategic') {
  let wins = 0,
    hands = 0,
    wildWins = 0,
    instant = 0,
    jokerMelds = 0;
  for (const seed of seeds) {
    const g = new MahjongGame(profile, ['A', 'B', 'C', 'D'], seed);
    const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, s % 2 ? 'casual' : level, (['shark', 'wall', 'gambler', 'teacher'] as const)[s], seed * 31 + s));
    let n = 0;
    do {
      playHand(g, ais, seed * 1000 + n++);
      hands++;
      const ph = g.state.phase;
      if (ph.kind !== 'handOver') throw new Error('unfinished');
      if (ph.result.type === 'win') {
        wins++;
        if (ph.result.score!.items.every((i) => i.name !== 'No jokers used')) wildWins++;
      }
      instant += ph.result.instant?.length ?? 0;
      jokerMelds += g.players.reduce((a, p) => a + p.melds.filter((m) => m.wild?.length).length, 0);
      // Every payment, instant ones included, is zero-sum.
      expect(g.players.reduce((a, p) => a + p.score, 0)).toBe(4 * profile.startingScore);
    } while (!g.advance() && n < 8);
  }
  return { wins, hands, wildWins, instant, jokerMelds };
}

const ctxBase = (counts: number[], over: Partial<ScoringContext> = {}): ScoringContext => ({
  decomposition: winningDecompositions(counts, 0, { sevenPairs: false, thirteenOrphans: true })[0],
  melds: [],
  concealedCounts: counts,
  winKind: 0,
  selfDrawn: false,
  seatWind: 'S',
  prevailingWind: 'E',
  isDealer: false,
  lastTileOfWall: false,
  afterKong: false,
  dealerRepeat: 0,
  flowers: [],
  ...over,
});

describe('tile set and registry', () => {
  it('registers the new variations with tables', () => {
    for (const id of ['vietnamese', 'indian', 'singapore']) {
      const v = VARIATIONS.find((x) => x.id === id)!;
      expect(v.profile).toBe(getProfile(id));
      expect(v.blurb).toMatch(/club profile/i);
      expect(v.profile!.houseRules.length).toBeGreaterThan(2);
    }
  });

  it('every tile id shows one fixed kind, and new kinds have names', () => {
    for (let id = 0; id < TILE_ID_COUNT; id++) expect(kindOfTileId(id)).toBeGreaterThanOrEqual(0);
    expect(tileName(CAT)).toBe('Cat');
    expect(tileName(WIND_JOKER)).toBe('Wind Joker');
    expect(tileName(parseKinds('JN')[0])).toBe('Number Joker');
  });

  for (const [profile, total] of [
    [vietnameseProfile, 152],
    [indianProfile, 152],
    [singaporeProfile, 148],
  ] as const) {
    it(`${profile.id}: ${total} tiles, 13-tile hands, bonus tiles set aside`, () => {
      const g = new MahjongGame(profile, ['A', 'B', 'C', 'D'], 7);
      g.startHand(7);
      expect(g.state.wall.length).toBe(total);
      expect(new Set(g.state.wall.map((t) => t.id)).size).toBe(total);
      for (const t of g.state.wall) expect(kindOfTileId(t.id)).toBe(t.kind);
      g.players.forEach((p, s) => {
        expect(p.hand.length).toBe(s === g.dealer ? 14 : 13);
        expect(p.hand.some((t) => g.isBonus(t.kind))).toBe(false);
      });
    });
  }

  it('house rules can take the jokers out', () => {
    const vn = withHouseRules(vietnameseProfile, { jokers: 'off' });
    const g = new MahjongGame(vn, ['A', 'B', 'C', 'D'], 3);
    g.startHand(3);
    expect(g.state.wall.length).toBe(144);
    expect(vn.wilds).toBeUndefined();
    const ind = withHouseRules(indianProfile, { jokers: 'off', flowers: 'off' });
    const h = new MahjongGame(ind, ['A', 'B', 'C', 'D'], 3);
    h.startHand(3);
    expect(h.state.wall.length).toBe(136);
  });
});

describe('jokers in standard hands', () => {
  it('reads wilds as the tiles they stand for', () => {
    const c = toCounts(parseKinds('123m 456m 789m EE 55p'));
    const r = wildDecompositions(c, [WIND_JOKER], 0, { sevenPairs: false, thirteenOrphans: false }, { inPair: true, inChow: true });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].counts[27]).toBe(3);
    // A wind joker can't be a dot.
    const bad = toCounts(parseKinds('123m 456m 789m EE 5p 6p'));
    expect(wildDecompositions(bad, [WIND_JOKER], 0, { sevenPairs: false, thirteenOrphans: false }, { inPair: true, inChow: true })).toEqual([]);
    // Shanten counts a joker as a tile: 4 sets + a joker is ready.
    expect(wildShanten(toCounts(parseKinds('123m 456m 789m 123p')), [JOKER_KIND], 0, { sevenPairs: false, thirteenOrphans: false })).toBe(0);
  });

  it('Vietnamese: a wind joker pung scores, and self-draw is paid by all', () => {
    const g = handFor(vietnameseProfile, '123m 456m 789m 55p EE JW');
    const ev = g.evaluateWin(0, WIND_JOKER, true, false)!;
    expect(ev).toBeTruthy();
    const names = ev.score.items.map((i) => i.name);
    expect(names).toContain('Self-drawn (Tự bốc)');
    expect(names).toContain('Concealed hand (Bất cầu)');
    expect(names).toContain('Seat wind pung');
    expect(names).toContain('Round wind pung');
    expect(names).toContain('No flowers (Không hoa)');
    expect(names).not.toContain('No jokers used');
    expect(ev.score.value).toBe(5);
    expect(ev.score.points).toBe(VN_STAKE * 6);
    expect(vietnameseProfile.payments(0, null, ev.score, 0, 4, 0).map((p) => p.amount)).toEqual([120, 120, 120]);
    expect(vietnameseProfile.payments(0, 2, ev.score, 0, 4, 0)).toEqual([{ from: 2, to: 0, amount: 360 }]);
  });

  it('Vietnamese: a clean hand earns the no-jokers phán; flower jokers score', () => {
    const g = handFor(vietnameseProfile, '123m 456m 789m 55p EEE', [parseKinds('JF')[0]]);
    const ev = g.evaluateWin(0, 27, true, false)!;
    const names = ev.score.items.map((i) => i.name);
    expect(names).toContain('No jokers used');
    expect(names).toContain('Flower Joker × 1');
    expect(names).not.toContain('No flowers (Không hoa)');
  });

  it('Indian: jokers fill sets, but not the pair unless the host allows it', () => {
    expect(handFor(indianProfile, '123m 456m 789m 55p EE J').evaluateWin(0, JOKER_KIND, true, false)).toBeTruthy();
    expect(handFor(indianProfile, '123m 456m 789m 123p 5p J').evaluateWin(0, JOKER_KIND, true, false)).toBeNull();
    const loose = withHouseRules(indianProfile, { jokerPair: 'on' });
    expect(handFor(loose, '123m 456m 789m 123p 5p J').evaluateWin(0, JOKER_KIND, true, false)).toBeTruthy();
    // Joker in a concealed chow.
    const ev = handFor(indianProfile, '123m 456m 789m 1p 3p 55p J').evaluateWin(0, JOKER_KIND, true, false)!;
    expect(ev.score.items.map((i) => i.name)).not.toContain('No jokers used');
  });

  it('a discarded joker is dead and a joker can help call a pung', () => {
    const g = new MahjongGame(indianProfile, ['A', 'B', 'C', 'D'], 5);
    g.startHand(5);
    const pl = g.players[1];
    pl.hand = [...parseKinds('5p J 123m 456m 789m 1s'), 0].map((kind, i) => ({ id: 2000 + i, kind }));
    const me = g.players[0];
    const drawn = me.hand[me.hand.length - 1];
    me.hand.push({ id: 3000, kind: 13 }); // a 5p to throw
    g.state.phase = { kind: 'turn', seat: 0, drawn, afterKong: false, mustDiscardOnly: false };
    g.discard(0, 3000);
    const ph = g.state.phase as MahjongGame['state']['phase'];
    expect(ph.kind).toBe('claims');
    if (ph.kind !== 'claims') return;
    const pung = ph.options[1].find((o) => o.type === 'pung')!;
    expect(pung.using).toEqual([13, JOKER_KIND]);
    for (const s of g.pendingClaimSeats()) g.respond(s, s === 1 ? pung : { type: 'pass' });
    const meld = g.players[1].melds[0];
    expect(meld.type).toBe('pung');
    expect(meld.wild).toEqual([{ id: 2001, as: 13 }]);
    expect(g.scoringMelds(1)[0].tiles.map((t) => t.kind)).toEqual([13, 13, 13]);
    // Now a joker discard: nobody may claim it.
    const p1 = g.players[1];
    p1.hand.push({ id: 2100, kind: JOKER_KIND });
    g.discard(1, 2100);
    expect(g.state.phase.kind).toBe('turn');
  });
});

describe('Singapore animals and tai', () => {
  it('animals and seat flowers score a tai each; shooter pays for the table', () => {
    const counts = toCounts(parseKinds('123m 456m 789p 234s 99s'));
    const s = singaporeProfile.score(ctxBase(counts, { winKind: 0, flowers: [CAT, ROOSTER, FLOWER_BASE + 1] }));
    const names = s.items.map((i) => i.name);
    expect(names).toEqual(expect.arrayContaining(['Cat', 'Rooster', 'Seat flower']));
    expect(names).not.toContain('Ping Hu'); // bonus tiles spoil Ping Hu
    expect(s.value).toBe(3);
    expect(s.points).toBe(SG_UNIT * 4);
    expect(singaporeProfile.payments(0, 2, s, 1, 4, 0)).toEqual([{ from: 2, to: 0, amount: SG_UNIT * 16 }]);
    expect(singaporeProfile.payments(0, null, s, 1, 4, 0).map((p) => p.amount)).toEqual([256, 256, 256]);
  });

  it('Ping Hu needs no bonus tiles and an open wait; tai cap at 5', () => {
    const open = toCounts(parseKinds('234m 456m 789p 234s 99s'));
    expect(singaporeProfile.score(ctxBase(open, { winKind: 1 })).items.map((i) => i.name)).toContain('Ping Hu');
    const flush = toCounts(parseKinds('111m 234m 456m 789m 99m'));
    const s = singaporeProfile.score(ctxBase(flush, { winKind: 8, flowers: [CAT, MOUSE] }));
    expect(s.value).toBe(5);
    expect(s.limit).toBe(true);
    expect(s.points).toBe(SG_UNIT * 16);
  });

  it('a hand with no tai cannot win (1 tai minimum)', () => {
    const g = handFor(singaporeProfile, '123m 456m 789p 234s 9s 9s');
    // Not all chows, no honours, no bonus tiles: no tai.
    expect(g.evaluateWin(0, 26, true, false)).toBeNull();
    g.players[0].flowers = [{ id: 9999, kind: CENTIPEDE }];
    expect(g.evaluateWin(0, 26, true, false)?.score.value).toBe(1);
  });

  it('animal pairs bite, doubled in the deal; kongs pay on the spot', () => {
    const f = singaporeInstant(true, true);
    expect(f({ type: 'bonus', seat: 1, kind: MOUSE, held: [MOUSE], dealing: false }, 4)).toEqual([]);
    expect(f({ type: 'bonus', seat: 1, kind: MOUSE, held: [CAT, MOUSE], dealing: false }, 4).map((p) => p.amount)).toEqual([SG_UNIT, SG_UNIT, SG_UNIT]);
    expect(f({ type: 'bonus', seat: 1, kind: MOUSE, held: [CAT, MOUSE], dealing: true }, 4)[0].amount).toBe(2 * SG_UNIT);
    expect(f({ type: 'bonus', seat: 0, kind: CAT, held: [ROOSTER, CENTIPEDE, MOUSE, CAT], dealing: false }, 4).length).toBe(6);
    expect(f({ type: 'kong', seat: 2, concealed: true }, 4).every((p) => p.to === 2 && p.amount === 2 * SG_UNIT)).toBe(true);
    const off = singaporeInstant(false, false);
    expect(off({ type: 'bonus', seat: 1, kind: MOUSE, held: [CAT, MOUSE], dealing: false }, 4)).toEqual([]);
  });
});

describe('AI plays every new variation to the end', () => {
  it('Vietnamese: full hands with Khung jokers', () => {
    const r = playMatch(vietnameseProfile, [1, 2, 3]);
    console.log('vietnamese', r);
    expect(r.wins).toBeGreaterThan(5);
    expect(r.wildWins).toBeGreaterThan(0);
  }, 60_000);

  it('Indian club: full hands with jokers', () => {
    const r = playMatch(indianProfile, [1, 2, 3]);
    console.log('indian', r);
    expect(r.wins).toBeGreaterThan(5);
    expect(r.wildWins).toBeGreaterThan(0);
  }, 60_000);

  it('Singapore: full hands with animals and instant payments', () => {
    const r = playMatch(singaporeProfile, [1, 2, 3]);
    console.log('singapore', r);
    expect(r.wins).toBeGreaterThan(5);
    expect(r.instant).toBeGreaterThan(0);
  }, 60_000);

  it('house-rule variants play too', () => {
    playMatch(withHouseRules(vietnameseProfile, { jokers: 'off', payout: 'shared', minValue: '1' }), [4]);
    playMatch(withHouseRules(indianProfile, { jokerPair: 'on', jokerCalls: 'off', payout: 'fullGun' }), [4], 'casual');
    playMatch(withHouseRules(singaporeProfile, { payout: 'shared', bites: 'off', kongMoney: 'off', minValue: '2' }), [4]);
  }, 60_000);
});

describe('American goulash house rule', () => {
  it('after a wall game East stays and jokers may be passed', () => {
    const P = withHouseRules(americanProfile, { goulash: 'on' });
    expect(P.goulash).toBe(true);
    expect(withHouseRules(americanProfile, {}).goulash).toBe(false);
    const g = new MahjongGame(P, ['A', 'B', 'C', 'D'], 11);
    g.startHand(11);
    // Force a wall game.
    g.state.phase = { kind: 'handOver', result: { type: 'draw', payments: [], deltas: [0, 0, 0, 0] } };
    const dealer = g.dealer;
    g.advance();
    expect(g.state.goulash).toBe(true);
    expect(g.dealer).toBe(dealer);
    g.startHand(12);
    const ph = g.state.phase;
    expect(ph.kind).toBe('charleston');
    // Every seat passes a joker if it has one.
    for (let s = 0; s < 4; s++) {
      const hand = g.players[s].hand;
      const j = hand.find((t) => isJoker(t.kind));
      const picks = [...(j ? [j] : []), ...hand.filter((t) => !isJoker(t.kind))].slice(0, 3).map((t) => t.id);
      g.charlestonPass(s, picks);
    }
    // After the goulash the deal passes as usual.
    g.state.phase = { kind: 'handOver', result: { type: 'win', winner: dealer, payments: [], deltas: [0, 0, 0, 0] } };
    g.advance();
    expect(g.state.goulash).toBeUndefined();
    expect(g.dealer).toBe((dealer + 1) % 4);
    // Without the house rule jokers still can't be passed.
    const plain = new MahjongGame(americanProfile, ['A', 'B', 'C', 'D'], 11);
    plain.startHand(13);
    const seat = plain.players.findIndex((p) => p.hand.some((t) => isJoker(t.kind)));
    if (seat >= 0) {
      const hand = plain.players[seat].hand;
      const ids = [hand.find((t) => isJoker(t.kind))!, ...hand.filter((t) => !isJoker(t.kind))].slice(0, 3).map((t) => t.id);
      expect(() => plain.charlestonPass(seat, ids)).toThrow();
    }
  });
});

describe('bonus kinds are not counted as hand tiles', () => {
  it('toCounts ignores animals and jokers', () => {
    const c = toCounts([CAT, JOKER_KIND, 0]);
    expect(c.length).toBe(34);
    expect(c[0]).toBe(1);
    expect(isAnimal(CAT)).toBe(true);
  });
});
