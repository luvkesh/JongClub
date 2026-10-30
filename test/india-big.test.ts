import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { withHouseRules } from '../src/engine/rules';
import { advanceRound } from '../src/engine/rounds';
import { NORTH_CHOICES, indiaProfile, northBig } from '../src/engine/rules/india';
import { BIG_CARDS, FL, bigComplete, bigEnvs, bigExtrasOf, bigGroups, bigHandSize, bigWins, type BigCard, type MInfo } from '../src/engine/rules/indiaBig';
import { FLOWER_BASE, parseKinds } from '../src/engine/tiles';
import { AiPlayer } from '../src/ai/players';
import { playHandHeadless } from '../src/club/sim';
import { decodeAction, encodeAction } from '../src/net/lockstep';
import { setHand, toTurn } from './helpers-india';

const NORTH_ONLY = withHouseRules(indiaProfile, { indiaRounds: 'N' });
const card = (n: number) => BIG_CARDS[n - 1];
const E = 27;
const k = (s: string) => parseKinds(s);
const meld = (type: MInfo['type'], tiles: string, jokers: { kind: number; as: number }[] = []): MInfo => ({ type, as: [...k(tiles), ...jokers.map((j) => j.as)].sort((a, b) => a - b), jokers });

/** Lay down the card's kongs, qwongs and runs from a picture hand (no jokers), longest first. */
function layDown(c: BigCard, kinds: number[], seat = E) {
  let hand = kinds.map((kind, id) => ({ id, kind }));
  const melds: MInfo[] = [];
  for (let i = 0; i < 8; i++) {
    const g = bigGroups(c, hand, melds, { seat })
      .filter((x) => x.extend === undefined && !x.wild.length)
      .sort((a, b) => b.as.length - a.as.length)[0];
    if (!g) break;
    melds.push({ type: g.type, as: g.as, jokers: [] });
    hand = hand.filter((t) => !g.ids.includes(t.id));
  }
  return { hand: hand.map((t) => t.kind), melds };
}

function bigGame(n: number, seed = 5) {
  const g = new MahjongGame(NORTH_ONLY, ['A', 'B', 'C', 'D'], seed);
  g.startHand(seed);
  g.chooseRound(g.dealer, northBig(n));
  return g;
}

describe('India Rules Big Cards: the 29 cards (pp. 31-40)', () => {
  it('lists all 29, each offered to East', () => {
    expect(BIG_CARDS.map((c) => c.n)).toEqual(Array.from({ length: 29 }, (_, i) => i + 1));
    for (const c of BIG_CARDS) expect(NORTH_CHOICES.some((x) => x.code === northBig(c.n))).toBe(true);
  });

  it('every reading of every card holds 14 tiles plus its extra tiles', () => {
    for (const c of BIG_CARDS) for (const e of bigEnvs(c, { seat: E })) for (const comps of c.alts(e)) expect(bigHandSize(comps), c.name).toBe(14 + bigExtrasOf(c, comps));
  });

  it('every card’s picture is a finished hand once its groups are laid down', () => {
    for (const c of BIG_CARDS) {
      // Royal Qwongs' picture uses the dragon, so any seat will do; its own-wind qwong is tested below.
      const { hand, melds } = layDown(c, k(c.picture));
      expect(bigComplete(c, hand, melds, { seat: E }), c.name).toBe(true);
    }
  });

  it('a kong, qwong or run that earns extra tiles must be laid down', () => {
    const c = card(1);
    expect(bigComplete(c, k('5555p 8888s 33m Wd Gd ESWN'), [], { seat: E })).toBe(false);
  });

  it('keeps jokers out of clean sets and pairs', () => {
    const c = card(4); // Same Number Kongs: NEWS are jokers, never in the pair
    const kongs = [meld('kong', '666m'), meld('kong', '6666p'), meld('kong', '6666s')];
    kongs[0] = meld('kong', '666m', [{ kind: 28, as: k('6m')[0] }]);
    expect(bigComplete(c, k('GdRdWd 22p'), kongs, { seat: E })).toBe(true);
    // A joker (East) in the pair: not allowed.
    expect(bigComplete(c, k('GdRdWd 2p E'), kongs, { seat: E })).toBe(false);
    // A joker for a dragon is fine.
    expect(bigComplete(c, k('GdRd E 22p'), [meld('kong', '6666m'), meld('kong', '6666p'), meld('kong', '6666s')], { seat: E })).toBe(true);
  });

  it('uses only one joker of each kind when the card says one each', () => {
    const c = card(12); // Triple Kongs in Cracks: 1 and 9 of Rings and Bamboos, one each
    const one = [meld('kong', '222m'.replace('222m', '222m'), [{ kind: k('1p')[0], as: k('2m')[0] }]), meld('kong', '5555m'), meld('kong', '8888m')];
    expect(bigComplete(c, k('RdRdRdRd EE'), one, { seat: E })).toBe(false); // the Red kong is in hand, not laid down
    expect(bigComplete(c, k('EE'), [...one, meld('kong', 'RdRdRdRd')], { seat: E })).toBe(true);
    // A second 1 of Rings as a joker: over the cap.
    const two = [meld('kong', '22m', [{ kind: k('1p')[0], as: k('2m')[0] }, { kind: k('1p')[0], as: k('2m')[0] }]), meld('kong', '5555m'), meld('kong', '8888m'), meld('kong', 'RdRdRdRd')];
    expect(bigComplete(c, k('EE'), two, { seat: E })).toBe(false);
  });

  it('keeps the 1s and 9s of a run natural', () => {
    const c = card(22); // Terminal Kong: 1-5, 5-9, a terminal kong, clean GRW
    const good = [meld('run', '1234p', [{ kind: E, as: k('5p')[0] }]), meld('run', '56789s'), meld('kong', '1111m')];
    expect(bigComplete(c, k('GdRdWd'), good, { seat: E })).toBe(true);
    const bad = [meld('run', '2345p', [{ kind: E, as: k('1p')[0] }]), meld('run', '56789s'), meld('kong', '1111m')];
    expect(bigComplete(c, k('GdRdWd'), bad, { seat: E })).toBe(false);
  });

  it('a flower or season is the 0 of 6-7-8-9-1-0', () => {
    const c = card(21);
    const melds = [meld('run', '123456m'), { type: 'run' as const, as: [...k('67891p'), FL].sort((a, b) => a - b), jokers: [] }];
    expect(bigComplete(c, [...k('Rd Wd 99s')], melds, { seat: E })).toBe(true);
  });

  it('a qwong is made with a joker: flowers on Qwong Kong', () => {
    const c = card(26);
    const melds = [meld('qwong', '3333s', [{ kind: FL, as: k('3s')[0] }]), meld('kong', 'RdRdRdRd')];
    expect(bigComplete(c, [...k('777p 456m EE')], melds, { seat: E })).toBe(true);
  });

  it('Royal Qwongs takes your own wind', () => {
    const c = card(28);
    const melds = [meld('qwong', '9999s', [{ kind: FL, as: k('9s')[0] }]), meld('qwong', 'WWWW', [{ kind: FL, as: 29 }])];
    expect(bigComplete(c, k('4444s 88s'), melds, { seat: 29 })).toBe(true);
    expect(bigComplete(c, k('4444s 88s'), melds, { seat: E })).toBe(false);
  });

  it('Same Number Kongs: the pair may not be the number of another player’s exposed kong', () => {
    const c = card(4);
    const melds = [meld('kong', '6666m'), meld('kong', '6666p'), meld('kong', '6666s')];
    expect(bigComplete(c, k('GdRdWd 33p'), melds, { seat: E })).toBe(true);
    expect(bigComplete(c, k('GdRdWd 33p'), melds, { seat: E, ban: [3] })).toBe(false);
  });

  it('a tile from the hand may take a joker’s place to go Mahjong', () => {
    const c = card(1); // Breaking News in Rings and Bamboos: the 1s and 9s of Cracks are jokers
    const melds = [meld('kong', '555p', [{ kind: k('9m')[0], as: k('5p')[0] }]), meld('kong', '8888s')];
    // The 5 of Rings swaps for the joker, which then finishes NEWS.
    expect(bigComplete(c, k('33m Wd Gd E S W 5p'), melds, { seat: E })).toBe(false);
    expect(bigWins(c, k('33m Wd Gd E S W 5p'), melds, { seat: E })).toBe(true);
  });
});

describe('India Rules Big Cards at the table', () => {
  it('East picks a Big Card for everyone; flowers follow the card', () => {
    const g = bigGame(18); // T.O.E.: flowers are jokers
    expect(g.profile.big?.name).toBe('T.O.E.');
    expect(g.profile.chosenGame).toBe('Big Card: T.O.E.');
    expect(g.isBonus(FLOWER_BASE)).toBe(false);
    expect(bigGame(1).isBonus(FLOWER_BASE)).toBe(true);
  });

  it('laying down a kong draws its extra tile; Qwongitty Kong’s clean kong draws none', () => {
    const g = bigGame(1);
    toTurn(g);
    const seat = g.dealer;
    setHand(g, seat, '5555p 8888s 33m Wd Gd E S');
    const opts = g.turnOptions(seat);
    const kong = opts.groups!.find((x) => x.as.join() === k('5555p').join() && x.extend === undefined)!;
    expect(kong.extras).toBe(1);
    const before = g.players[seat].hand.length;
    g.declareGroup(seat, kong.ids);
    expect(g.players[seat].melds).toHaveLength(1);
    expect(g.players[seat].hand.length).toBe(before - 4 + 1);
    expect(g.state.phase).toMatchObject({ kind: 'turn', seat, afterKong: true });
    expect(() => g.declareGroup(seat, [1, 2, 3, 4])).toThrow();

    const q = bigGame(27);
    toTurn(q);
    const s2 = q.dealer;
    setHand(q, s2, '2222p 5555m 9s 1m 3m 4m E S');
    const clean = q.turnOptions(s2).groups!.find((x) => x.type === 'kong' && x.as[0] === k('2p')[0])!;
    expect(clean.extras).toBe(0);
    const n = q.players[s2].hand.length;
    q.declareGroup(s2, clean.ids);
    expect(q.players[s2].hand.length).toBe(n - 4);
  });

  it('a concealed win pays 2,000 and a claimed set makes it a normal 1,000', () => {
    const g = bigGame(1);
    toTurn(g);
    const seat = g.dealer;
    const pl = g.players[seat];
    pl.melds = [
      { type: 'kong', tiles: k('5555p').map((kind, i) => ({ id: 900 + i, kind })), concealed: false, extras: 1 },
      { type: 'kong', tiles: k('8888s').map((kind, i) => ({ id: 910 + i, kind })), concealed: false, extras: 1 },
    ];
    pl.hand = pl.hand.slice(0, 8);
    setHand(g, seat, '33m Wd Gd ESWN');
    const ev = g.evaluateWin(seat, k('N')[0], true, false);
    expect(ev?.score.value).toBe(2000);
    pl.melds[0].from = (seat + 1) % 4;
    expect(g.evaluateWin(seat, k('N')[0], true, false)?.score.value).toBe(1000);
  });

  it('a drawn tile can swap for a joker in a laid-down group', () => {
    const g = bigGame(10);
    toTurn(g);
    const seat = g.dealer;
    const pl = g.players[seat];
    pl.melds = [{ type: 'kong', tiles: [...k('222m'), k('Rd')[0]].map((kind, i) => ({ id: 900 + i, kind })), concealed: false, wild: [{ id: 903, as: k('2m')[0] }], extras: 1 }];
    setHand(g, seat, '2m 5555p 7777s 999s 4m 4m');
    const sw = g.turnOptions(seat).jokerSwaps.find((x) => x.owner === seat)!;
    expect(sw).toBeTruthy();
    g.exchangeJoker(seat, sw);
    expect(pl.melds[0].wild).toBeUndefined();
    expect(pl.melds[0].tiles.every((t) => t.kind === k('2m')[0])).toBe(true);
    expect(pl.hand.some((t) => t.kind === k('Rd')[0])).toBe(true);
  });

  it('a laid-down group travels in the lockstep log', () => {
    for (const a of [{ t: 'g' as const, s: 2, ids: [4, 5, 6, 7] }, { t: 'g' as const, s: 1, ids: [9], m: 0 }]) expect(decodeAction(encodeAction(a))).toEqual(a);
  });

  it('bots finish a hand on every card', { timeout: 120000 }, () => {
    let wins = 0;
    for (const c of BIG_CARDS) {
      const g = bigGame(c.n, 3);
      const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, 'strategic', 'teacher', 30 + s));
      expect(playHandHeadless(g, ais, 4000), c.name).toBe(true);
      const ph = g.state.phase;
      if (ph.kind === 'handOver' && ph.result.type === 'win') wins++;
    }
    expect(wins).toBeGreaterThan(12);
  });
});

describe('India Rules deal (the user, 2026-10-25)', () => {
  it('always passes the deal, after East wins and after a draw, in every style', () => {
    for (const indiaRounds of ['E', 'S', 'W', 'N', 'C', 'ESWN']) {
      const p = withHouseRules(indiaProfile, { indiaRounds });
      expect(p.rounds.dealerRetention).toBe('never');
      const r = { windIndex: 0, dealerSeat: 0, dealerHand: 0, handsPlayed: 0, repeat: 0, finished: false };
      expect(advanceRound(p.rounds, r, 4, { dealerWon: true, drawn: false }).dealerSeat).toBe(1);
      expect(advanceRound(p.rounds, r, 4, { dealerWon: false, drawn: true }).dealerSeat).toBe(1);
    }
  });
});

describe('India Rules Classic (the user, 2026-10-25)', () => {
  const CLASSIC_P = withHouseRules(indiaProfile, { indiaRounds: 'C' });

  it('is offered as a style: the East round’s game in all four rounds, no passports', () => {
    expect(CLASSIC_P.rounds.prevailingWinds).toEqual(['E', 'S', 'W', 'N']);
    expect(CLASSIC_P.windRounds).toBeUndefined();
    expect(CLASSIC_P.passportView).toBeUndefined();
    const g = new MahjongGame(CLASSIC_P, ['A', 'B', 'C', 'D'], 4);
    g.startHand(4);
    expect(g.state.phase.kind).toBe('turn');
    // A mixed chow, a crochet, a chow, a pung and a pair, without a passport, wins.
    const seat = g.dealer;
    setHand(g, seat, '1m 2p 3s 5m 5p 5s 789m EEE Rd 9p');
    expect(g.evaluateWin(seat, k('9p')[0], true, false)).toBeNull();
    setHand(g, seat, '1m 2p 3s 5m 5p 5s 789m EEE RdRd');
    const ev = g.evaluateWin(seat, k('Rd')[0], true, false);
    expect(ev?.score.items.map((i) => i.name)).toEqual(['Fully concealed hand']);
  });

  it('never offers a call that makes a pair, mixed chow, knit or crochet', () => {
    const g = new MahjongGame(CLASSIC_P, ['A', 'B', 'C', 'D'], 4);
    g.startHand(4);
    const seat = g.dealer;
    const next = (seat + 1) % 4;
    // The next player holds 1m 2p (a mixed chow wants 3s), 5m 5p (a crochet wants 5s), a single E (a pair wants E).
    setHand(g, next, '1m 2p 5m 5p E 9m 9m 2s 4s 6s 8s 7p 8p'.split(' ').slice(0, 13).join(' '));
    for (const kind of k('3s 5s E 9p')) {
      const opts = (g as unknown as { claimOptionsFor(s: number, d: number, t: { id: number; kind: number }): { type: string; using?: number[] }[] }).claimOptionsFor(next, seat, { id: 999, kind });
      for (const o of opts) {
        expect(['pung', 'kong', 'chow', 'buy'].includes(o.type)).toBe(true);
        if (o.type === 'chow') {
          const run = [...o.using!, kind].sort((a, b) => a - b);
          expect(run[1] - run[0]).toBe(1);
          expect(run[2] - run[1]).toBe(1);
          expect(Math.floor(run[0] / 9)).toBe(Math.floor(run[2] / 9));
        }
      }
    }
  });
});
