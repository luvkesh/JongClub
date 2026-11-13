// QA pass on India Rules South, West and North (repros for the audit's findings and the checks that passed).
import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { withHouseRules } from '../src/engine/rules';
import { BUY_PRICE, NORTH, NORTH_CHOICES, indiaProfile, northBig, northGoulash } from '../src/engine/rules/india';
import { SMALL_CARDS, cardByName, cardComplete } from '../src/engine/rules/indiaCards';
import { BIG_CARDS, bigComplete, bigGroups, type MInfo } from '../src/engine/rules/indiaBig';
import { FLOWER_BASE, parseKinds, toCounts } from '../src/engine/tiles';
import { AiPlayer } from '../src/ai/players';
import { playHandHeadless } from '../src/club/sim';
import { SOUTH, WEST, setHand, southAt, toTurn } from './helpers-india';

const k = (s: string) => parseKinds(s);
const k1 = (s: string) => parseKinds(s)[0];
const NORTH_ONLY = withHouseRules(indiaProfile, { indiaRounds: 'N' });
const ais = (seed = 1) => [0, 1, 2, 3].map((s) => new AiPlayer(s, 'casual', 'zen', seed * 10 + s));
const card = (name: string) => SMALL_CARDS.indexOf(cardByName(name)!);

function northGame(code: number, seed = 6) {
  const g = new MahjongGame(NORTH_ONLY, ['A', 'B', 'C', 'D'], seed);
  g.startHand(seed);
  g.chooseRound(g.dealer, code);
  return g;
}

/** Answer every pending claim: `want` for the named seat, pass for the rest. */
function answer(g: MahjongGame, seat: number, want: 'buy' | 'pung' | 'win' | 'pass') {
  const ph = g.state.phase;
  if (ph.kind !== 'claims') return;
  for (const s of g.pendingClaimSeats()) g.respond(s, s === seat ? { type: want } : { type: 'pass' });
}

describe('QA South: Small Card shapes, near misses', () => {
  const ok = (name: string, hand: string, seat = 28, round = 28) => cardComplete(cardByName(name)!, toCounts(k(hand)), [], seat, round);
  it('accepts the card and rejects wrong suits, numbers and honours', () => {
    expect(ok('Silly Bee', '123m 456p 789s 2m 3p 4s 55m')).toBe(true);
    expect(ok('Silly Bee', '123m 456p 789s 2m 3p 4s 11m')).toBe(false); // pair of a terminal
    expect(ok('Silly Bee', '123m 456m 789s 2m 3p 4s 55m')).toBe(false); // two chows in one suit
    expect(ok('Unique Wonders', '19m 19p 19s ESWN GdRdWd 9s')).toBe(true);
    expect(ok('Unique Wonders', '19m 19p 19s ESWN GdRdRd 9s')).toBe(false); // White missing
    expect(ok('Hitler’s Blunder', 'RdRdRd ESWN 1234567m')).toBe(true);
    expect(ok('Hitler’s Blunder', 'RdRdRd ESWN 1234568m')).toBe(false);
    expect(ok('Hitler’s Blunder', 'RdRdRd ESWN 123456m 7p')).toBe(false); // the run crosses suits
    expect(ok('Heavenly Twins', '11s 33s 44s 55s 66s 88s 99s')).toBe(true);
    expect(ok('Heavenly Twins', '11s 33s 44s 55s 66s 88s 99p')).toBe(false);
    expect(ok('Four Blessings', 'EEE SSS WWW NNN RdRd')).toBe(true);
    expect(ok('Four Blessings', 'EEE SSS WWW RdRdRd NN')).toBe(false);
    expect(ok('Red Lantern', 'RdRdRd SSS 1234567p 4p', 28)).toBe(true);
    expect(ok('Red Lantern', 'RdRdRd SSS 1234567p 4p', 29)).toBe(false); // not your own wind
    expect(ok('Gates of Heaven', '111p 2345678p 999p 5p')).toBe(true);
    expect(ok('Gates of Heaven', '111p 2345678p 999p 9p')).toBe(false);
  });
});

describe('QA South: Golden Staircase', () => {
  it('a discard may finish the honour PAIR (only the pung must come from the wall)', () => {
    const { g, seat } = southAt('Golden Staircase', '123456789s RdRdRd E 5m');
    const nxt = (seat + 1) % 4;
    g.state.cards![nxt] = card('Golden Staircase');
    setHand(g, nxt, '123456789s RdRdRd E');
    g.discard(seat, g.players[seat].hand.find((t) => t.kind === k1('E'))!.id);
    const ph = g.state.phase;
    expect(ph.kind).toBe('claims');
    if (ph.kind === 'claims') expect(ph.options[nxt]?.some((o) => o.type === 'win')).toBe(true);
  });
  it('a discard never finishes the honour pung, not even to Mahjong', () => {
    const { g, seat } = southAt('Golden Staircase', '123456789s RdRd EE 5m');
    const nxt = (seat + 1) % 4;
    g.state.cards![nxt] = card('Golden Staircase');
    setHand(g, nxt, '123456789s RdRd EE');
    g.discard(seat, g.players[seat].hand.find((t) => t.kind === k1('Rd'))!.id);
    const ph = g.state.phase;
    if (ph.kind === 'claims') expect(ph.options[nxt]?.some((o) => o.type === 'win' || o.type === 'pung')).toBe(false);
  });
});

describe('QA South: buying from the left', () => {
  it('only the next player may buy; it costs 100 once, into the bank; the tile stays concealed', () => {
    const { g, seat } = southAt('Silly Bee', '123m 456p 789s 2m 3p 4s E 9m');
    const nxt = (seat + 1) % 4;
    const before = g.players.map((p) => p.score);
    g.discard(seat, g.players[seat].hand.find((t) => t.kind === k1('9m'))!.id);
    const ph = g.state.phase;
    expect(ph.kind).toBe('claims');
    if (ph.kind !== 'claims') return;
    for (const s of [0, 1, 2, 3]) expect(!!ph.options[s]?.some((o) => o.type === 'buy'), `seat ${s}`).toBe(s === nxt);
    answer(g, nxt, 'buy');
    expect(g.players.map((p, i) => p.score - before[i])).toEqual([0, 1, 2, 3].map((s) => (s === nxt ? -BUY_PRICE : 0)));
    expect(g.state.riichiPot).toBe(BUY_PRICE);
    expect(g.players[nxt].melds).toHaveLength(0);
    expect(g.players[nxt].hand).toHaveLength(14);
    expect(g.state.phase).toMatchObject({ kind: 'turn', seat: nxt });
  });
  it('a pung beats a buy, and the would-be buyer pays nothing', () => {
    const { g, seat } = southAt('Western Command', '123m 456p 789s 2m 3p 4s E 9m');
    const nxt = (seat + 1) % 4;
    const far = (seat + 2) % 4;
    g.state.cards![far] = card('Western Command');
    const farHand = g.players[far].hand.map((t) => t.kind);
    farHand[0] = k1('9m');
    farHand[1] = k1('9m');
    setHand(g, far, farHand.map((x, i) => (i > 1 && x === k1('9m') ? k1('E') : x)));
    const before = g.players[nxt].score;
    g.discard(seat, g.players[seat].hand.find((t) => t.kind === k1('9m'))!.id);
    const ph = g.state.phase;
    if (ph.kind !== 'claims') throw new Error('no claims');
    for (const s of g.pendingClaimSeats()) g.respond(s, s === nxt ? { type: 'buy' } : s === far && ph.options[s].some((o) => o.type === 'pung') ? { type: 'pung' } : { type: 'pass' });
    expect(g.players[far].melds).toHaveLength(1);
    expect(g.players[nxt].score).toBe(before);
    expect(g.state.riichiPot).toBe(0);
  });
  it('no buying once the wall is empty; the bank waits for the next winner after a draw', () => {
    const { g, seat } = southAt('Silly Bee', '123m 456p 789s 2m 3p 4s E 9m');
    g.state.riichiPot = 300; // three earlier buys
    g.state.drawnFromFront = g.state.wall.length - g.state.drawnFromBack; // last tile drawn
    const nxt = (seat + 1) % 4;
    g.discard(seat, g.players[seat].hand.find((t) => t.kind === k1('9m'))!.id);
    const ph = g.state.phase;
    if (ph.kind === 'claims') expect(ph.options[nxt]?.some((o) => o.type === 'buy') ?? false).toBe(false);
    for (let i = 0; i < 4 && g.state.phase.kind === 'claims'; i++) answer(g, -1, 'pass');
    expect(g.state.phase.kind).toBe('handOver');
    expect(g.state.riichiPot).toBe(300);
    const dealer = g.dealer;
    g.advance();
    expect(g.dealer).toBe((dealer + 1) % 4); // the deal always passes
  });
});

describe('QA South: a call that fits no card', () => {
  it('is allowed by the engine and the hand still ends', () => {
    for (const seed of [3, 4, 5]) {
      const { g, seat } = southAt('Heavenly Twins', '11s 33s 44s 55s 66s 88s 99s', seed);
      const nxt = (seat + 1) % 4;
      g.state.cards![nxt] = card('Heavenly Twins');
      setHand(g, nxt, '22m 55p 7s 8s 1p 2p 3p EE Rd Wd');
      const d = g.players[seat].hand.find((t) => t.kind === k1('99s'))!;
      d.kind = k1('E');
      g.discard(seat, d.id);
      const ph = g.state.phase;
      expect(ph.kind).toBe('claims');
      if (ph.kind === 'claims') expect(ph.options[nxt]?.some((o) => o.type === 'pung')).toBe(true);
      answer(g, nxt, 'pung');
      expect(g.players[nxt].melds).toHaveLength(1);
      expect(playHandHeadless(g, ais(seed))).toBe(true);
    }
  });
});

describe('QA West / North Goulash with jokers', () => {
  it('a discarded joker-number tile is natural: it never wins as a joker', () => {
    const g = northGame(northGoulash(5));
    toTurn(g);
    const d = g.dealer;
    const nxt = (d + 1) % 4;
    g.players[nxt].melds = [];
    setHand(g, nxt, '111s 999s 222s RdRd GdGd');
    expect(g.evaluateWin(nxt, k1('Rd'), false, true)).not.toBeNull();
    // 5m, 5p, 5s thrown by others are natural tiles this hand can't use.
    for (const w of ['5m', '5p', '5s']) expect(g.evaluateWin(nxt, k1(w), false, true), w).toBeNull();
    const t = g.players[d].hand[0];
    t.kind = k1('5m');
    g.discard(d, t.id);
    const ph = g.state.phase;
    if (ph.kind === 'claims') expect(ph.options[nxt]?.some((o) => o.type === 'win') ?? false).toBe(false);
  });
  it('a joker drawn from the wall still finishes the hand', () => {
    const g = northGame(northGoulash(5));
    toTurn(g);
    const seat = g.dealer;
    g.players[seat].melds = [];
    setHand(g, seat, '111s 999s 222s RdRd GdGd 5m');
    expect(g.evaluateWin(seat, k1('5m'), true, false)).not.toBeNull();
  });
  it('never pungs a discard with a joker', () => {
    const g = northGame(northGoulash(5));
    toTurn(g);
    const d = g.dealer;
    const nxt = (d + 1) % 4;
    setHand(g, nxt, '111s 999s 2s 5m RdRdRd Gd E');
    const t = g.players[d].hand[0];
    t.kind = k1('2s');
    g.discard(d, t.id);
    const ph = g.state.phase;
    if (ph.kind === 'claims') expect(ph.options[nxt]?.some((o) => o.type === 'pung') ?? false).toBe(false);
  });
  it('a wall exchange never hands a player back a tile they just put down', () => {
    let returned = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const g = new MahjongGame(WEST, ['A', 'B', 'C', 'D'], seed);
      g.startHand(seed);
      const a = ais(seed);
      while (g.state.phase.kind === 'charleston') {
        const picks = a.map((ai) => ai.charlestonPass(g).map((t) => t.id));
        picks.forEach((ids, s) => g.charlestonPass(s, ids));
      }
      g.chooseExchanges(g.dealer, 0, 0);
      g.chooseExchanges(g.dealer, 0, 3);
      for (let r = 0; r < 3; r++) {
        const picks = a.map((ai) => ai.wallExchangePick(g).map((t) => t.id));
        picks.forEach((ids, s) => g.wallExchange(s, ids));
        g.players.forEach((p, s) => (returned += p.hand.filter((t) => picks[s].includes(t.id)).length));
        g.players.forEach((p, s) => expect(p.hand.length, `seat ${s}`).toBe(s === g.dealer ? 14 : 13));
      }
    }
    expect(returned).toBe(0);
  });
});

describe('QA North: Big Cards', () => {
  const meld = (tiles: string, jokers: { kind: number; as: number }[] = []): MInfo => ({ type: 'kong', as: [...k(tiles), ...jokers.map((j) => j.as)].sort((a, b) => a - b), jokers });
  it('Same Number Kongs: a joker may be a dragon in GRW while a natural dragon makes the clean pair', () => {
    const c4 = BIG_CARDS[3];
    const kongs = [meld('6666m'), meld('6666p'), meld('6666s')];
    expect(bigComplete(c4, k('Rd GdGd Gd Wd'), kongs, { seat: 27 })).toBe(true);
    expect(bigComplete(c4, k('RdRd Gd Wd E'), kongs, { seat: 27 })).toBe(true);
  });
  it('Major Konging: once a kong uses a 3 as a joker, no group may use a 5 (one secret number)', () => {
    const c8 = BIG_CARDS[7];
    const melds: MInfo[] = [meld('111m', [{ kind: k1('3m'), as: k1('1m') }])];
    const hand = k('999s 5s EEE 11p').map((kind, id) => ({ id, kind }));
    const gs = bigGroups(c8, hand, melds, { seat: 27 });
    expect(gs.some((g) => g.wild.some((w) => hand.find((t) => t.id === w.id)!.kind === k1('5s')))).toBe(false);
  });
});

describe('QA North: every choice code', () => {
  it('maps to the right game', () => {
    for (const { code } of NORTH_CHOICES) {
      const g = northGame(code, 3);
      const p = g.profile;
      if (code === NORTH.east || code === NORTH.eastOpen) {
        expect(p.specialRound).toBe('indiaEast');
        expect(p.passportOptional).toBe(code === NORTH.eastOpen);
        expect(g.state.exchange).toBeUndefined();
      } else if (code === NORTH.small) {
        expect(p.flowersWild).toBe(true);
        expect(g.state.cards).toHaveLength(4);
      } else if (code > NORTH.goulash && code < NORTH.goulash + 10) {
        const n = code - NORTH.goulash;
        expect(g.state.wildKinds).toEqual([n - 1, 8 + n, 17 + n]);
        expect(p.buyFromLeft).toBeUndefined();
      } else {
        expect(p.big?.n).toBe(code - NORTH.big);
        expect(code).toBe(northBig(p.big!.n));
        expect(p.buyFromLeft).toBe(BUY_PRICE);
      }
      expect(p.chosenGame).toBe(NORTH_CHOICES.find((c) => c.code === code)!.label);
    }
    expect(NORTH_CHOICES).toHaveLength(2 + 1 + 9 + 29);
  });
});

describe('QA: flowers on a drawn South hand are still paid', () => {
  it('pays own flower and season on a draw', () => {
    const g = new MahjongGame(SOUTH, ['A', 'B', 'C', 'D'], 21);
    g.startHand(21);
    toTurn(g);
    const s = (g.dealer + 1) % 4;
    for (const p of g.players) p.flowers = [];
    const sw = ['E', 'S', 'W', 'N'].indexOf(g.state.seatWinds[s]);
    g.players[s].flowers = [{ id: 900, kind: FLOWER_BASE + sw }, { id: 901, kind: FLOWER_BASE + 4 + sw }];
    const before = g.players.map((p) => p.score);
    g.state.drawnFromFront = g.state.wall.length - g.state.drawnFromBack;
    const d = g.dealer;
    g.discard(d, g.players[d].hand[0].id);
    for (let i = 0; i < 4 && g.state.phase.kind === 'claims'; i++) answer(g, -1, 'pass');
    expect(g.state.phase.kind).toBe('handOver');
    expect(g.players[s].score - before[s]).toBe(1500);
  });
});
