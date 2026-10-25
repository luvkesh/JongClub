// The rules that were "coming": Riichi abortive draws, nagashi mangan and
// thirteen orphans robbing a concealed kong; Sanma (three-player Riichi);
// Malaysian three-player; MCR knitted hands; Classic flowers and seasons;
// tournament placement scoring.

import { describe, expect, it } from 'vitest';
import { AiPlayer } from '../src/ai/players';
import { createTournament, nextRound, playRound, standings } from '../src/club/tournament';
import { formatPlacement, placementPoints, placementRule, tablePlacement, umaFor } from '../src/club/placement';
import { CATALOGUE, FORMATS } from '../src/club/catalogue';
import { MahjongGame } from '../src/engine/game';
import { shanten, waits } from '../src/engine/hand';
import { getProfile, withHouseRules } from '../src/engine/rules';
import { classicProfile } from '../src/engine/rules/classic';
import { malaysian3Profile } from '../src/engine/rules/malaysian3';
import { mcrProfile } from '../src/engine/rules/mcr';
import { riichiProfile } from '../src/engine/rules/riichi';
import { SANMA_KINDS, sanmaDora, sanmaDrawPayments, sanmaPayments, sanmaProfile } from '../src/engine/rules/sanma';
import type { HandScore, RuleProfile } from '../src/engine/rules/types';
import type { Meld } from '../src/engine/state';
import { FLOWER_BASE, parseKinds, toCounts, type Tile } from '../src/engine/tiles';
import { applyAction } from '../src/net/actions';
import { decodeAction, encodeAction } from '../src/net/lockstep';

const k = (s: string) => parseKinds(s)[0];
let nextId = 2000;
const tiles = (spec: string): Tile[] => parseKinds(spec).map((kind) => ({ id: nextId++, kind }));
const names = (s: { items: { name: string }[] } | null | undefined) => s?.items.map((i) => i.name) ?? [];
const DEAD = ['1357m 1357p 1357s E', '2468m 2468p 2468s S', '1357m 2468p 1357s W', '2468m 1357p 2468s N'];

/** A table where every seat holds a given hand (13 tiles; the turn seat gets `drawn` too). */
function table(profile: RuleProfile, hands: string[], turn = 0, drawn = '9p') {
  const g = new MahjongGame(profile, ['A', 'B', 'C', 'D'].slice(0, profile.players), 5);
  g.startHand(5);
  g.players.forEach((pl, s) => {
    pl.hand = tiles(hands[s] ?? DEAD[s]);
    pl.melds = [];
    pl.flowers = [];
    pl.discards = [];
    pl.discardKinds = [];
  });
  const d = tiles(drawn)[0];
  g.players[turn].hand.push(d);
  g.state.turnCount = 0;
  g.state.callsMade = 0;
  g.state.phase = { kind: 'turn', seat: turn, drawn: d, afterKong: false, mustDiscardOnly: false };
  return g;
}
const discardKind = (g: MahjongGame, seat: number, kind: string, riichi = false) => g.discard(seat, g.players[seat].hand.find((t) => t.kind === k(kind))!.id, { riichi });
/** After a draw, swap the drawn tile for a chosen one. */
function forceDraw(g: MahjongGame, kind: string) {
  const ph = g.state.phase;
  if (ph.kind !== 'turn' || !ph.drawn) throw new Error('not a draw');
  const pl = g.players[ph.seat];
  const t = tiles(kind)[0];
  pl.hand[pl.hand.findIndex((x) => x.id === ph.drawn!.id)] = t;
  ph.drawn = t;
}
const result = (g: MahjongGame) => {
  const ph = g.state.phase;
  if (ph.kind !== 'handOver') throw new Error(`hand not over: ${ph.kind}`);
  return ph.result;
};

describe('Riichi: abortive draws', () => {
  const R = withHouseRules(riichiProfile, {});

  it('nine terminals on the first uninterrupted turn: the player may call off the hand, same dealer, one more honba', () => {
    const g = table(R, ['19m 19p 19s ESW 234p 5', '', '', ''], 0, 'Rd');
    g.players[0].hand = tiles('19m 19p 19s ESW 2345p Rd');
    expect(g.turnOptions(0).nineTerminals).toBe(true);
    applyAction(g, { t: 'a', s: 0 });
    const r = result(g);
    expect(r.type).toBe('draw');
    expect(r.abortive).toBe('nineTerminals');
    expect(r.payments).toEqual([]);
    g.advance();
    expect(g.state.round.dealerSeat).toBe(0);
    expect(g.state.round.repeat).toBe(1);
  });

  it('nine terminals needs nine different kinds, the first turn, and no calls', () => {
    const eight = table(R, ['', '', '', ''], 0);
    eight.players[0].hand = tiles('19m 19p 19s ES 23456p');
    expect(eight.turnOptions(0).nineTerminals).toBeFalsy();
    const called = table(R, ['', '', '', ''], 0);
    called.players[0].hand = tiles('19m 19p 19s ESW 2345p Rd');
    called.state.callsMade = 1;
    expect(called.turnOptions(0).nineTerminals).toBeFalsy();
    const off = table(withHouseRules(riichiProfile, { abortive: 'off' }), ['', '', '', ''], 0);
    off.players[0].hand = tiles('19m 19p 19s ESW 2345p Rd');
    expect(off.turnOptions(0).nineTerminals).toBeFalsy();
  });

  it('the AI calls off a poor hand but plays on toward thirteen orphans', () => {
    const poor = table(R, ['', '', '', ''], 0);
    poor.players[0].hand = tiles('19m 19p 19s ESW 2345p Rd');
    expect(new AiPlayer(0, 'expert', 'zen', 1).decideTurn(poor).action).toBe('abort');
    const close = table(R, ['', '', '', ''], 0);
    close.players[0].hand = tiles('19m 19p 19s ESWN RdGd 45p');
    expect(new AiPlayer(0, 'expert', 'zen', 1).decideTurn(close).action).not.toBe('abort');
  });

  it('four winds: everyone throws the same wind on the first go-round', () => {
    const g = table(R, ['E 2468m 2468p 246s', 'E 1357m 1357p 135s', 'E 2468m 1357p 246s', 'E 1357m 2468p 135s'], 0);
    for (let s = 0; s < 4; s++) {
      if (s) forceDraw(g, '9s');
      discardKind(g, s, 'E');
    }
    expect(result(g).abortive).toBe('fourWinds');
  });

  it('four riichi: abandoned once the fourth riichi discard passes; the sticks stay on the table', () => {
    const waits = ['E', 'S', 'W', 'N'];
    const g = table(R, waits.map((w) => `123m 456m 789m 123s ${w}`), 0, '9p');
    for (let s = 0; s < 4; s++) {
      if (s) forceDraw(g, '9p');
      discardKind(g, s, '9p', true);
    }
    const r = result(g);
    expect(r.abortive).toBe('fourRiichi');
    expect(g.state.riichiPot).toBe(4000);
    g.advance();
    expect(g.state.riichiPot).toBe(4000);
    expect(g.state.round.dealerSeat).toBe(0);
  });

  it('four kongs by more than one player abandon the hand after the next discard; one player’s four do not', () => {
    const kong = (spec: string, concealed = true): Meld => ({ type: 'kong', tiles: tiles(spec), concealed });
    const g = table(R, ['', '', '', ''], 0);
    g.players[0].melds = [kong('1111m')];
    g.players[0].hand = tiles('2468p 246s 9p');
    g.players[1].melds = [kong('2222p'), kong('3333p')];
    g.players[2].melds = [kong('4444s')];
    g.discard(0, g.players[0].hand[0].id);
    expect(result(g).abortive).toBe('fourKongs');

    const one = table(R, ['', '', '', ''], 0);
    one.players[1].melds = [kong('1111m'), kong('2222p'), kong('3333p'), kong('4444s')];
    one.discard(0, one.players[0].hand[0].id);
    expect(one.state.phase.kind).not.toBe('handOver');
  });

  it('triple ron: abortive by default, head bump as a house rule', () => {
    const hands = ['', '123m 456m 789m 123s 5p', '123m 456m 789m 123s 5p', '123m 456m 789m 123s 5p'];
    const g = table(R, hands, 0, '5p');
    discardKind(g, 0, '5p');
    for (const s of [1, 2, 3]) g.respond(s, { type: 'win' });
    expect(result(g).abortive).toBe('tripleRon');

    const hb = table(withHouseRules(riichiProfile, { tripleRon: 'headBump' }), hands, 0, '5p');
    discardKind(hb, 0, '5p');
    for (const s of [1, 2, 3]) hb.respond(s, { type: 'win' });
    expect(result(hb).winner).toBe(1);
  });
});

describe('Riichi: nagashi mangan', () => {
  /** Seat 1's discards are all terminals and honours; the wall is empty after seat 0 discards. */
  function exhaust(profile: RuleProfile, claimed = false) {
    const g = table(profile, ['', '', '', ''], 0);
    g.players[1].discardKinds = parseKinds('1m 9p E Rd');
    g.players[1].discards = tiles('1m 9p E Rd');
    if (claimed) g.players[1].claimedDiscards = [1];
    g.players[2].discardKinds = parseKinds('1m 5p');
    g.players[3].discardKinds = parseKinds('9s 2m');
    g.players[0].discardKinds = parseKinds('E 5m');
    const s = g.state;
    s.drawnFromFront = s.wall.length - profile.deadWall - s.drawnFromBack;
    g.discard(0, g.players[0].hand[0].id);
    return result(g);
  }

  it('is paid as a self-drawn mangan, in place of the ready-hand payments', () => {
    const r = exhaust(withHouseRules(riichiProfile, {}));
    expect(r.nagashi).toEqual([1]);
    expect(r.payments.map((p) => [p.from, p.to, p.amount])).toEqual([
      [0, 1, 4000],
      [2, 1, 2000],
      [3, 1, 2000],
    ]);
  });

  it('not when a discard was called, nor when the house turns it off', () => {
    expect(exhaust(withHouseRules(riichiProfile, {}), true).nagashi).toBeUndefined();
    expect(exhaust(withHouseRules(riichiProfile, { nagashi: 'off' })).nagashi).toBeUndefined();
  });
});

describe('Riichi: thirteen orphans robs a concealed kong', () => {
  const kokushi = '9m 1p 9p 1s 9s ESWN RdGd WdWd';
  it('opens a win-only window for thirteen orphans', () => {
    const g = table(withHouseRules(riichiProfile, {}), ['1111m 2345p 678s 9s', kokushi, '', ''], 0, 'E');
    g.declareKong(0, k('1m'));
    const ph = g.state.phase;
    expect(ph.kind === 'claims' && ph.robKong && ph.concealedKong).toBe(true);
    g.respond(1, { type: 'win' });
    const r = result(g);
    expect(r.winner).toBe(1);
    expect(r.robbedKong).toBe(true);
    expect(r.score!.tier).toMatch(/Yakuman/);
  });

  it('passing lets the kong stand; any other hand never robs a concealed kong', () => {
    const g = table(withHouseRules(riichiProfile, {}), ['1111m 2345p 678s 9s', kokushi, '', ''], 0, 'E');
    g.declareKong(0, k('1m'));
    g.respond(1, { type: 'pass' });
    expect(g.players[0].melds[0]).toMatchObject({ type: 'kong', concealed: true });
    expect(g.players[0].melds[0].tiles).toHaveLength(4);
    const plain = table(withHouseRules(riichiProfile, {}), ['1111m 2345p 678s 9s', '23m 456m 789m 123s EE', '', ''], 0, 'E');
    plain.declareKong(0, k('1m'));
    expect(plain.state.phase.kind).toBe('turn');
  });
});

describe('Sanma (three-player Riichi)', () => {
  const S = withHouseRules(sanmaProfile, {});

  it('108 tiles without Characters 2–8, three seats, no chi, and 1m points to 9m', () => {
    expect(S.players).toBe(3);
    expect(SANMA_KINDS).toHaveLength(27);
    expect(SANMA_KINDS.some((x) => x >= 1 && x <= 7)).toBe(false);
    const g = new MahjongGame(S, ['A', 'B', 'C'], 1);
    g.startHand(1);
    expect(g.state.wall).toHaveLength(108);
    expect(S.calls.chow).toBe(false);
    expect(sanmaDora(k('1m'))).toBe(k('9m'));
    expect(sanmaDora(k('9m'))).toBe(k('1m'));
    expect(sanmaDora(k('W'))).toBe(k('N'));
    expect(getProfile('sanma')).toBe(sanmaProfile);
    expect(CATALOGUE.find((e) => e.id === 'sanma')).toMatchObject({ status: 'playable', variationId: 'sanma' });
  });

  it('kita: a North goes aside as dora and a replacement comes without a new dora', () => {
    const g = table(S, ['123p 456p 789p 12s NN', '', ''], 0, '3s');
    const live = g.liveRemaining;
    const dora = g.state.doraRevealed;
    expect(g.turnOptions(0).kita).toBe(true);
    applyAction(g, { t: 'n', s: 0 });
    expect(g.players[0].flowers.map((t) => t.kind)).toEqual([k('N')]);
    expect(g.players[0].hand).toHaveLength(14);
    expect(g.liveRemaining).toBe(live - 1);
    expect(g.state.doraRevealed).toBe(dora);
    const ph = g.state.phase;
    expect(ph.kind === 'turn' && ph.afterKong).toBe(true);
  });

  it('each North set aside scores a dora, never a yaku', () => {
    const g = table(S, ['123p 456p 789p 234s 5s', '', ''], 0, '5s');
    g.players[0].flowers = tiles('N N');
    g.players[0].riichi = true;
    const s = g.evaluateWin(0, k('5s'), true, false)!.score;
    expect(s.items.find((i) => i.name === 'Kita')?.value).toBe(2);
    // Kita alone is no yaku: an open hand with nothing else can't win.
    const open = table(S, ['456p 789p 234s 5s', '', ''], 0, '5s');
    open.players[0].melds = [{ type: 'pung', tiles: tiles('222p'), concealed: false, from: 1 }];
    open.players[0].flowers = tiles('N');
    expect(open.evaluateWin(0, k('5s'), false, true)).toBeNull();
  });

  it('another player may win on a North set aside (not as robbing a kong)', () => {
    const g = table(S, ['123p 456p 789p 12s NN', '123p 456p 789p 999s N', ''], 0, '3s');
    g.players[1].riichi = true;
    applyAction(g, { t: 'n', s: 0 });
    const ph = g.state.phase;
    expect(ph.kind === 'claims' && ph.kita).toBe(true);
    g.respond(1, { type: 'win' });
    const r = result(g);
    expect(r.winner).toBe(1);
    expect(names(r.score)).not.toContain('Chankan');
  });

  it('tsumo loss by default, point split as a house rule; ready-hand payments total 2,000', () => {
    const mangan: HandScore = { value: 5, unit: 'han', items: [], points: 8000, limit: true, base: 2000 };
    const amounts = (p: ReturnType<ReturnType<typeof sanmaPayments>>) => p.map((x) => x.amount);
    // Non-dealer (seat 1) self-draw, dealer seat 0.
    expect(amounts(sanmaPayments(false)(1, null, mangan, 0, 3, 0))).toEqual([4000, 2000]);
    expect(amounts(sanmaPayments(true)(1, null, mangan, 0, 3, 0))).toEqual([5000, 3000]);
    // Dealer self-draw.
    expect(amounts(sanmaPayments(false)(0, null, mangan, 0, 3, 0))).toEqual([4000, 4000]);
    expect(amounts(sanmaPayments(true)(0, null, mangan, 0, 3, 0))).toEqual([6000, 6000]);
    // Ron, with one honba.
    expect(amounts(sanmaPayments(false)(1, 2, mangan, 0, 3, 1))).toEqual([8200]);
    expect(withHouseRules(sanmaProfile, { payout: 'split' }).payments(1, null, mangan, 0, 3, 0).map((x) => x.amount)).toEqual([5000, 3000]);
    const one = sanmaDrawPayments([true, false, false]);
    expect(one.reduce((a, p) => a + p.amount, 0)).toBe(2000);
    expect(sanmaDrawPayments([true, true, false]).map((p) => p.amount)).toEqual([1000, 1000]);
  });

  it('has no four-player abortive draws', () => {
    const g = table(S, ['E 2468p 246s 13579p', 'E 1357p 135s 2468p', 'E 2468p 135s 1357p'], 0);
    for (let s = 0; s < 3; s++) {
      if (s) forceDraw(g, '9s');
      discardKind(g, s, 'E');
    }
    expect(g.state.phase.kind).not.toBe('handOver');
  });
});

describe('Malaysian three-player', () => {
  it('takes the Characters out (112 tiles); keeping the 1 and 9 is a house rule (120)', () => {
    const count = (house: Record<string, string>) => {
      const g = new MahjongGame(withHouseRules(malaysian3Profile, house), ['A', 'B', 'C'], 3);
      g.startHand(3);
      return g.state.wall.length;
    };
    expect(malaysian3Profile.players).toBe(3);
    expect(count({})).toBe(112);
    expect(count({ characters: 'terminals' })).toBe(120);
    expect(CATALOGUE.find((e) => e.id === 'malaysian3')).toMatchObject({ status: 'playable', variationId: 'malaysian3' });
  });

  it('the lesson example: Pong Pong with a cat on a discard is 3 tai, 128; the discarder pays 256', () => {
    const M = withHouseRules(malaysian3Profile, {});
    const g = table(M, ['222p 444p 555s 888s 6p', '', ''], 1, '9s');
    g.players[0].flowers = tiles('Cat');
    const s = g.evaluateWin(0, k('6p'), false, true)!.score;
    expect([s.value, s.points]).toEqual([3, 128]);
    expect(M.payments(0, 1, s, 1, 3, 0).map((p) => [p.from, p.amount])).toEqual([
      [1, 256],
      [2, 128],
    ]);
  });
});

describe('MCR knitted hands', () => {
  const M = withHouseRules(mcrProfile, {});
  const score = (spec: string, win: string, selfDrawn: boolean, melds: Meld[] = []) => {
    const g = table(M, ['', '', '', ''], 1);
    g.players[0].hand = tiles(spec);
    if (selfDrawn) g.players[0].hand.push(tiles(win)[0]);
    g.players[0].melds = melds;
    return g.evaluateWin(0, k(win), selfDrawn, !selfDrawn)?.score ?? null;
  };

  it('Knitted Straight with a chow and a pair: 12 fan, scored with the usual fans', () => {
    const s = score('147m 258p 369s 456m 1p', '1p', true)!;
    expect(s).not.toBeNull();
    const n = names(s);
    expect(n).toEqual(expect.arrayContaining(['Knitted Straight', 'Fully Concealed Hand', 'All Chows', 'No Honours']));
    expect(n).not.toContain('Outside Hand');
    expect(s.items.find((i) => i.name === 'Knitted Straight')!.value).toBe(12);
  });

  it('Knitted Straight with a melded set', () => {
    const s = score('147m 258p 369s 1p', '1p', false, [{ type: 'pung', tiles: tiles('RdRdRd'), concealed: false, from: 2 }])!;
    expect(names(s)).toEqual(expect.arrayContaining(['Knitted Straight', 'Dragon Pung']));
    expect(s.qualifies).toBe(true);
  });

  it('Lesser Honours and Knitted Tiles: 12, plus Knitted Straight with all nine knitted tiles', () => {
    const full = score('147m 258p 369s E S W Rd', 'Gd', false)!;
    expect(names(full).sort()).toEqual(['Knitted Straight', 'Lesser Honours and Knitted Tiles']);
    expect(full.value).toBe(24);
    const part = score('14m 258p 369s E S W N Rd', 'Gd', false)!;
    expect(names(part)).toEqual(['Lesser Honours and Knitted Tiles']);
    expect(part.value).toBe(12);
  });

  it('Greater Honours and Knitted Tiles: 24, excluding Lesser, All Types and Concealed Hand', () => {
    const s = score('147m 25p 36s E S W N Rd Gd', 'Wd', false)!;
    expect(names(s)).toEqual(['Greater Honours and Knitted Tiles']);
    expect(s.value).toBe(24);
  });

  it('a knitted hand is ready, and its waits are found', () => {
    const c = toCounts(parseKinds('147m 258p 369s E S W Rd'));
    expect(shanten(c, 0, M.shapes)).toBe(0);
    expect(waits(c, 0, M.shapes)).toEqual(expect.arrayContaining(parseKinds('N Gd Wd')));
    // Not knitted: two orders mixed.
    expect(score('147m 258p 369p E S W Rd', 'Gd', false)).toBeNull();
  });
});

describe('Classic: flowers and seasons (house rule)', () => {
  it('on by default (144 tiles: the eight bonus tiles join the wall); off, 136', () => {
    const size = (house: Record<string, string>) => {
      const g = new MahjongGame(withHouseRules(classicProfile, house), ['A', 'B', 'C', 'D'], 2);
      g.startHand(2);
      return g.state.wall.length;
    };
    expect(size({})).toBe(144);
    expect(size({ flowers: 'off' })).toBe(136);
    // MCR builds on Classic but always plays its flowers.
    expect(withHouseRules(mcrProfile, {}).flowers).toBe(true);
  });

  it('own flower and own season score a faan each; a full set scores two', () => {
    const C = withHouseRules(classicProfile, { flowers: 'on' });
    const at = (flowers: number[]) => {
      const g = table(C, ['123m 456p 789s 234s 5s', '', '', ''], 1, '9s');
      g.players[0].flowers = flowers.map((kind) => ({ id: nextId++, kind }));
      return g.evaluateWin(0, k('5s'), false, true)!.score;
    };
    // Seat 0 is East: flower 1 and season 1 are its own.
    const plain = at([]);
    const own = at([FLOWER_BASE, FLOWER_BASE + 4, FLOWER_BASE + 2]);
    expect(names(own)).toEqual(expect.arrayContaining(['Seat flower', 'Seat season']));
    expect(own.value - plain.value).toBe(2);
    const set = at([FLOWER_BASE, FLOWER_BASE + 1, FLOWER_BASE + 2, FLOWER_BASE + 3]);
    expect(names(set)).toContain('All four flowers');
    expect(set.value - plain.value).toBe(2);
    // With the house rule off, flowers never score.
    const off = withHouseRules(classicProfile, {});
    expect(off.score === C.score && names(at([])).includes('Seat flower')).toBe(false);
  });
});

describe('tournament placement scoring', () => {
  it('uma by place plus the score difference; ties share; three seats', () => {
    expect(placementPoints([32000, 25000, 25000, 18000], 25000)).toEqual([22, 0, 0, -22]);
    expect(placementPoints([40000, 35000, 30000], 35000)).toEqual([20, 0, -20]);
    expect(placementPoints([6000, 5000, 4500, 4500], 5000)).toEqual([25, 5, -15, -15]);
    expect(umaFor(4, '20')).toEqual([20, 10, -10, -20]);
    expect(placementRule(4, {}, 5000).per).toBe(100);
    expect(formatPlacement(-5)).toBe('−5.0');
    expect(tablePlacement({}, [1, 2, 3, 4], 0)).toBeNull();
    expect(tablePlacement({ tournamentScoring: 'on', uma: '30' }, [26000, 25000, 25000, 24000], 25000)).toEqual([31, 0, 0, -31]);
    expect(FORMATS.find((f) => f.id === 'tournamentScoring')!.status).toBe('playable');
  });

  it('club tournaments can rank by placement points across rounds', () => {
    let s = createTournament('quick', new Date('2026-10-16T12:00:00Z'), { name: 'You', rating: 1500 }, 42, { scoring: 'placement', length: 'oneHand' });
    expect(s.scoring).toBe('placement');
    s = nextRound(s);
    s = playRound(s, [
      { seat: 0, score: 6000 },
      { seat: 1, score: 5000 },
      { seat: 2, score: 4800 },
      { seat: 3, score: 4200 },
    ]);
    const rows = standings(s);
    const me = rows.find((r) => r.human)!;
    expect(me.points).toBe(25);
    expect(rows.reduce((a, r) => a + r.points, 0)).toBeCloseTo(0, 5);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].points).toBeGreaterThanOrEqual(rows[i].points);
  });
});

describe('new actions travel over the wire', () => {
  it('nine terminals and kita survive lockstep encoding', () => {
    for (const a of [{ t: 'a', s: 2 }, { t: 'n', s: 1 }] as const) expect(decodeAction(encodeAction(a))).toEqual(a);
  });
});
