import { describe, expect, it } from 'vitest';
import { AiPlayer } from '../src/ai/players';
import { turnHint } from '../src/ai/jongbot';
import { MahjongGame } from '../src/engine/game';
import { shanten, winningDecompositions } from '../src/engine/hand';
import { TW_BASE, TW_PER_TAI, taiwaneseProfile } from '../src/engine/rules/taiwanese';
import { DUBAI_CARD, DUBAI_START, dubaiChase, dubaiFlowerWin } from '../src/engine/rules/taiwaneseDubai';
import { withHouseRules } from '../src/engine/rules';
import type { ScoringContext } from '../src/engine/rules/types';
import type { Meld } from '../src/engine/state';
import { isFlower, parseKinds, toCounts } from '../src/engine/tiles';

const P = taiwaneseProfile;
const k = (s: string) => parseKinds(s)[0];

function best(hand: string, win: string, opts: Partial<ScoringContext> = {}, melds: Meld[] = []) {
  const counts = toCounts(parseKinds(hand));
  const decomps = winningDecompositions(counts, melds.length, P.shapes);
  expect(decomps.length).toBeGreaterThan(0);
  const scores = decomps.map((d) =>
    P.score({ decomposition: d, melds, concealedCounts: counts, winKind: k(win), selfDrawn: false, seatWind: 'S', prevailingWind: 'E', isDealer: false, lastTileOfWall: false, afterKong: false, dealerRepeat: 0, ...opts }),
  );
  return scores.sort((a, b) => b.points - a.points)[0];
}
const meld = (spec: string, type: Meld['type'] = 'pung'): Meld => ({ type, tiles: parseKinds(spec).map((kind, i) => ({ id: 500 + i + kind * 4, kind })), concealed: false, from: 1 });
const names = (s: { items: { name: string }[] }) => s.items.map((i) => i.name);

describe('taiwanese hands', () => {
  it('needs five sets and a pair', () => {
    expect(winningDecompositions(toCounts(parseKinds('123m 456m 789m 234p 567p 99s')), 0, P.shapes).length).toBeGreaterThan(0);
    expect(winningDecompositions(toCounts(parseKinds('123m 456m 789m 234p 99s')), 0, P.shapes).length).toBe(0);
    // 16 tiles one away from a 17-tile win is ready.
    expect(shanten(toCounts(parseKinds('123m 456m 789m 234p 56p 99s')), 0, P.shapes)).toBe(0);
  });

  it('concealed self-draw replaces concealed + self-draw and pays from everyone', () => {
    const s = best('123m 456m 789m 234p 567p 99s', '5p', { selfDrawn: true });
    expect(names(s)).toContain('Concealed self-draw');
    expect(names(s)).not.toContain('Self-draw');
    expect(s.value).toBe(3);
    expect(s.points).toBe(TW_BASE + 3 * TW_PER_TAI);
    // Dealer is seat 1 and pays the dealer tai on top.
    const pay = P.payments(0, null, s, 1, 4, 0);
    expect(pay).toHaveLength(3);
    expect(pay.find((p) => p.from === 1)!.amount).toBe(s.points + TW_PER_TAI);
    expect(pay.find((p) => p.from === 2)!.amount).toBe(s.points);
  });

  it('only the discarder pays on a discard win', () => {
    const s = best('123m 456m 789m 234p 567p 99s', '5p');
    const pay = P.payments(0, 3, s, 1, 4, 0);
    expect(pay).toEqual([{ from: 3, to: 0, amount: s.points }]);
  });

  it('ping hu: all chows, no honours or flowers, open wait, discard win', () => {
    const s = best('123m 456m 789m 234p 567p 99s', '5p');
    expect(names(s)).toContain('Ping Hu');
    expect(best('123m 456m 789m 234p 567p 99s', '5p', { flowers: [k('F1')] }).items.map((i) => i.name)).not.toContain('Ping Hu');
  });

  it('dealer streak adds two tai per kept deal', () => {
    const s = best('123m 456m 789m 234p 567p 99s', '5p', { isDealer: true, dealerRepeat: 2 });
    expect(s.items.find((i) => i.name === 'Dealer')!.value).toBe(1);
    expect(s.items.find((i) => i.name.startsWith('Dealer streak'))!.value).toBe(4);
  });

  it('honours, flushes and flowers', () => {
    const dragons = best('RdRdRd GdGdGd WdWd 123s 456s', '6s', { selfDrawn: false }, [meld('EEE')]);
    expect(names(dragons)).toContain('Small three dragons');
    expect(names(dragons)).not.toContain('Red Dragon pung');
    const flush = best('111s 234s 456s 789s 22s 333s', '2s', { selfDrawn: true });
    expect(names(flush)).toContain('Full flush');
    const seat = best('123m 456m 789m 234p 567p 99s', '5p', { seatWind: 'S', flowers: [k('F2'), k('F3')] });
    expect(seat.items.filter((i) => i.name === 'Seat flower')).toHaveLength(1);
    const plants = best('123m 456m 789m 234p 567p 99s', '5p', { flowers: [k('F1'), k('F2'), k('F3'), k('F4')] });
    expect(names(plants)).toContain('All four plants');
  });

  it('single wait earns a tai', () => {
    const s = best('123m 456m 789m 234p 567p 99s', '9s');
    expect(names(s)).toContain('Single wait');
  });

  it('deals 16-tile hands with flowers set aside and plays full games conserving points', () => {
    let wins = 0, draws = 0, flowers = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const g = new MahjongGame(P, ['A', 'B', 'C', 'D'], seed);
      const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, (['beginner', 'casual', 'strategic', 'expert'] as const)[s], (['shark', 'wall', 'gambler', 'teacher'] as const)[s], seed * 31 + s));
      let hands = 0;
      do {
        g.startHand(seed * 1000 + hands++);
        expect(g.state.wall).toHaveLength(144);
        g.players.forEach((p, s) => {
          expect(p.hand.some((t) => isFlower(t.kind))).toBe(false);
          expect(p.hand).toHaveLength(s === g.dealer ? 17 : 16);
        });
        let steps = 0;
        while (g.state.phase.kind !== 'handOver' && steps++ < 3000) {
          const ph = g.state.phase;
          if (ph.kind === 'turn') {
            if (ph.seat === 0) turnHint(g, 0, 'advanced');
            const d = ais[ph.seat].decideTurn(g);
            if (d.action === 'win') g.declareSelfDrawWin(ph.seat);
            else if (d.action === 'kong') g.declareKong(ph.seat, d.kind!);
            else g.discard(ph.seat, d.tileId!);
          } else if (ph.kind === 'claims') {
            for (const s of g.pendingClaimSeats()) {
              const cur = g.state.phase;
              if (cur.kind !== 'claims') break;
              g.respond(s, ais[s].decideClaim(g, cur.options[s], cur.tile.kind));
            }
          }
        }
        const ph = g.state.phase;
        expect(ph.kind).toBe('handOver');
        if (ph.kind === 'handOver') ph.result.type === 'win' ? wins++ : draws++;
        flowers += g.players.reduce((a, p) => a + p.flowers.length, 0);
        expect(g.players.reduce((a, p) => a + p.score, 0)).toBe(40000);
      } while (!g.advance() && hands < 24);
    }
    console.log({ wins, draws, flowers });
    expect(wins).toBeGreaterThan(10);
    expect(flowers).toBeGreaterThan(20);
  });
});

// ---------------------------------------------------------------- Dubai club card

describe('taiwanese: Dubai club card scoring', () => {
  const D = withHouseRules(P, { scoring: 'dubai' });
  function card(hand: string, win: string, opts: Partial<ScoringContext> = {}, melds: Meld[] = []) {
    const counts = toCounts(parseKinds(hand));
    const decomps = winningDecompositions(counts, melds.length, D.shapes);
    expect(decomps.length).toBeGreaterThan(0);
    const scores = decomps.map((d) =>
      D.score({ decomposition: d, melds, concealedCounts: counts, winKind: k(win), selfDrawn: false, seatWind: 'S', prevailingWind: 'E', isDealer: false, lastTileOfWall: false, afterKong: false, dealerRepeat: 0, ...opts }),
    );
    return scores.sort((a, b) => b.points - a.points)[0];
  }
  const sum = (s: { items: { value: number }[] }) => s.items.reduce((a, b) => a + b.value, 0);

  it('is a house rule that switches tai for card points', () => {
    expect(P.houseRules.find((r) => r.id === 'scoring')!.default).toBe('tai');
    expect(D.startingScore).toBe(1000);
    expect(D.riichi).toEqual({ cost: 0, minLiveTiles: 4 });
    expect(D.callNames.riichi).toBe('Call');
    expect(P.riichi).toBeUndefined();
  });

  it('every line on the card has a unique id and points', () => {
    const ids = DUBAI_CARD.flatMap((s) => s.lines.map((l) => l.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(101);
    for (const s of DUBAI_CARD) for (const l of s.lines) expect(l.pts).toBeGreaterThan(0);
  });

  it('one suit with brother and terminal sheungs, pure dragon and good eyes', () => {
    const s = card('123m 123m 456m 789m 789m 55m', '5m');
    expect(names(s)).toEqual(expect.arrayContaining(['One Suit', 'Mahjong', 'No Flowers + No Honours', 'Discard: Concealed Hand', 'Good Eyes', '2 Terminal Pure Sheung Sets', 'Pure Dragon (concealed)']));
    expect(names(s).filter((n) => n === '2 Brother Sheungs')).toHaveLength(2);
    expect(s.value).toBe(sum(s));
    expect(s.points).toBe(s.value);
    expect(s.unit).toBe('pt');
  });

  it('all honours with big four winds, seat and round wind, five concealed pongs', () => {
    const s = card('EEE SSS WWW NNN RdRdRd GdGd', 'Gd', { selfDrawn: true });
    expect(names(s)).toEqual(expect.arrayContaining(['All Honours', 'Big 4 Winds', 'Pong of Player’s Seat Wind', 'Pong of Round Wind', 'Pong of Dragons', '5 Concealed Pongs', 'All Pong', 'Self Draw: Wall', 'Self Draw: Concealed Hand']));
    expect(names(s)).not.toContain('Pong of Winds');
  });

  it('13 orphans, 16 orphans and Nico Nico are special hands', () => {
    expect(names(card('19m 19p 19s ESWN RdGdWd 1m 234p', '4p'))).toContain('13 Orphans');
    expect(names(card('19m 19p 19s ESWN RdGdWd 1m', 'Wd', {}, [meld('234p', 'chow')]))).toContain('13 Orphans');
    expect(names(card('ESWN RdGdWd 147m 258p 369s E', 'E'))).toContain('16 Orphans');
    const nico = card('11m 22m 33p 44p 55s 66s EE RdRdRd', 'Rd', { selfDrawn: true });
    expect(names(nico)).toContain('Nico Nico');
    expect(names(nico)).not.toContain('Nico Nico with 1 Gong');
    expect(names(card('11m 11m 22m 33p 44p 55s 66s RdRdRd', 'Rd'))).toEqual(expect.arrayContaining(['Nico Nico', 'Nico Nico with 1 Gong']));
    expect(names(card('11m 11m 22m 22m 44p 55s 66s RdRdRd', 'Rd'))).toContain('Nico Nico with 2 Gongs');
    // Ready for each special shape.
    expect(shanten(toCounts(parseKinds('ESWN RdGdWd 147m 258p 369s')), 0, D.shapes)).toBe(0);
    expect(shanten(toCounts(parseKinds('11m 22m 33p 44p 55s 66s EE RdRd')), 0, D.shapes)).toBe(0);
  });

  it('neighbours replaces the five-pong run line; sister-brother and all step up', () => {
    const n = card('111m 222m 333m 444m 555m 99p', '9p', { selfDrawn: true });
    expect(names(n)).toEqual(expect.arrayContaining(['Neighbours/Uncles', 'All Pong', '5 Concealed Pongs']));
    expect(names(n)).not.toContain('5 Sets');
    const sb = card('123m 123p 123s 123m 123p 55s', '5s');
    expect(names(sb)).toContain('Sister-Brother');
    expect(names(sb)).not.toContain('2 Brother Sheungs');
    const up = card('123m 234m 345m 456m 567m 99p', '9p');
    expect(names(up)).toEqual(expect.arrayContaining(['All Step Up', 'All Sheung with No Flowers/Honours']));
    expect(names(up)).not.toContain('3 Sheungs');
  });

  it('colour hands: jade, ruby, diamond, sapphire on top of semi pure', () => {
    expect(names(card('234s 456s 678s GdGdGd 999s 11s', '1s'))).toEqual(expect.arrayContaining(['Semi Pure', 'Jade']));
    expect(names(card('234m 456m 678m RdRdRd 999m 11m', '1m'))).toContain('Ruby');
    expect(names(card('234p 456p 678p WdWdWd 999p 11p', '1p'))).toContain('Diamond');
    expect(names(card('234m 456m 678m WdWdWd 999m 11m', '1m'))).toContain('Sapphire');
    expect(names(card('123m 456m 789p 234p 567m EE', 'E'))).not.toContain('2 Suits');
    expect(names(card('123m 456m 789p 234p 567m 99p', '9p'))).toContain('2 Suits');
    expect(names(card('123m 456p 789s EEE RdRdRd 55m', '5m'))).toContain('All 5 Suits');
    expect(names(card('111m 999p 111s 999s 999m 11p', '1p'))).toContain('Terminals Only');
    expect(names(card('111m 999p EEE 999s RdRdRd 11p', '1p'))).toContain('Terminals + Honours');
  });

  it('chicken: a hand worth 1 point before Mahjong', () => {
    const s = card('456p 678s 555s 789m NN', '8s', { flowers: [k('F1')] }, [meld('234m', 'chow')]);
    expect(names(s)).toEqual(['Mahjong', 'Each Flower', 'Chicken']);
    expect(s.value).toBe(26);
  });

  it('winning tile lines', () => {
    const base = '123m 456m 789p 234p 567s 99s';
    expect(names(card(base, '5s', { isDealer: true }))).toContain('East wins');
    expect(names(card(base, '5s', { discarderIsDealer: true }))).toContain('East gives winning tile');
    expect(names(card(base, '5s', { selfDrawn: true, afterFlower: true }))).toContain('Self Draw: Flower Wall');
    expect(names(card(base, '5s', { selfDrawn: true, afterKong: true }))).toContain('Self Draw: Flower Wall');
    expect(names(card(base, '5s', { robbedKong: true }))).toContain('Discard: Robbing a Gong');
    expect(names(card('123m 456m 789p 234p 11s 999s', '9s'))).toContain('Calling by Pairs');
    expect(names(card('123m 456m 789p 234p 567s 99s', '6s'))).toContain('True Single Wait');
    expect(names(card('123m 456m 789p 234p 123s 44s', '4s'))).toContain('False Single Wait');
    const exposed = card('99s', '9s', { selfDrawn: true }, [meld('123m', 'chow'), meld('456m', 'chow'), meld('789p', 'chow'), meld('234p', 'chow'), meld('567s', 'chow')]);
    expect(names(exposed)).toEqual(expect.arrayContaining(['Self Draw: Fully Exposed', 'True Single Wait']));
    expect(names(card('99s', '9s', {}, [meld('123m', 'chow'), meld('456m', 'chow'), meld('789p', 'chow'), meld('234p', 'chow'), meld('567s', 'chow')]))).toContain('Discard: Fully Exposed');
  });

  it('pong lines: dragons, winds, sister, terminal, neighbours, concealed, gongs', () => {
    expect(names(card('RdRdRd GdGdGd WdWd 123m 456p 789s', '7s'))).toContain('Little Dragons');
    expect(names(card('RdRdRd GdGdGd WdWdWd 123m 456p 99s', '9s'))).toContain('Big Dragons');
    expect(names(card('EEE SSS WW 123m 456p 789s', '7s'))).toContain('Little 3 Winds');
    expect(names(card('EEE SSS WWW 123m 456p 99s', '9s'))).toContain('Big 3 Winds');
    expect(names(card('EEE SSS WWW NN 123m 456p', '6p'))).toContain('Little 4 Winds');
    expect(names(card('111m 111p 111s 456m 789p 22s', '2s'))).toContain('3 Sister Pongs');
    expect(names(card('111m 999m 456p 789s 234p 22s', '2s'))).toContain('1 Terminal Pong Set');
    expect(names(card('111m 999m 111p 999p 456s 22s', '2s'))).toContain('2 Terminal Pong Sets');
    expect(names(card('555m 123p 789s 22s', '2s', {}, [meld('333m'), meld('444m')]))).toContain('3 Sets');
    const c3 = card('111m 999m 555p 777s 234p 22s', '7s');
    expect(names(c3)).toContain('3 Concealed Pongs');
    const kongs = card('123m 456p 789s 22s', '2s', { selfDrawn: true }, [
      { type: 'kong', tiles: parseKinds('EEEE').map((kind, i) => ({ id: 700 + i, kind })), concealed: true },
      { type: 'kong', tiles: parseKinds('5555s').map((kind, i) => ({ id: 710 + i, kind })), concealed: false, from: 2 },
    ]);
    expect(names(kongs)).toEqual(expect.arrayContaining(['Concealed Gong', 'Exposed Gong', 'Pong of Winds', 'Pong of Round Wind']));
  });

  it('sheung lines: terminal sets, sister, mixed and pure dragon, step up', () => {
    const t = card('123m 789m 123p 789p 456s 22s', '2s');
    expect(names(t)).toEqual(expect.arrayContaining(['2 Terminal Mixed Sheung Sets', '2 Sister Sheungs']));
    expect(names(card('123m 789m 345p 666s EEE 22s', '2s'))).toContain('1 Terminal Sheung Set');
    expect(names(card('123m 123p 123s 456m 789p 22s', '2s'))).toContain('3 Sister Sheungs');
    expect(names(card('123m 123m 123m 456p 789s 22s', '2s'))).toContain('3 Brother Sheungs');
    expect(names(card('123m 456p 789s EEE 555m 22s', '2s'))).toContain('Mixed Dragon (concealed)');
    expect(names(card('456p 789s EEE 555m 22s', '2s', {}, [meld('123m', 'chow')]))).toContain('Mixed Dragon (exposed)');
    expect(names(card('456p 789p EEE 555m 22s', '2s', {}, [meld('123p', 'chow')]))).toContain('Pure Dragon (exposed)');
    expect(names(card('123m 234m 345m 789p 555s 22s', '2s'))).toContain('3 Sheungs');
  });

  it('general, flowers, dice and special lines', () => {
    const base = '123m 456m 789p 234p 567s 99s';
    expect(names(card('555m 456m 123p 789s 345p EE', 'E'))).toContain('Four in 2 ways');
    expect(names(card(base, '5s', { riichi: true }))).toContain('Closing/Calling');
    expect(names(card(base, '5s', { dice: [3, 3, 3] }))).toContain('Triple on dice (Nos 1 - 5)');
    expect(names(card(base, '5s', { dice: [6, 6, 6] }))).toContain('Triple on dice (No 6)');
    expect(names(card(base, '5s', { dice: [6, 6, 5] })).some((n) => n.startsWith('Triple'))).toBe(false);
    expect(names(card(base, '5s', { selfDrawn: true, isDealer: true, heavenly: true }))).toContain('East is dealt Mahjong');
    expect(names(card(base, '5s', { earthly: true }))).toContain('Earthly Hand');
    expect(names(card(base, '5s', { tilesTaken: 4 }))).toContain('Win within 4 tiles');
    expect(names(card(base, '5s', { tilesTaken: 7 }))).toContain('Win within 7 tiles');
    expect(names(card(base, '5s', { tilesTaken: 10 }))).toContain('Win within 10 tiles');
    expect(names(card(base, '5s', { tilesTaken: 11 })).some((n) => n.startsWith('Win within'))).toBe(false);
    expect(names(card(base, '5s', { selfDrawn: true, lastTileOfWall: true }))).toContain('Win on last tile of wall (self)');
    const fl = card(base, '5s', { flowers: [k('F1'), k('F2'), k('F3'), k('F4')], seatWind: 'S' });
    expect(names(fl)).toEqual(expect.arrayContaining(['Each Flower × 4', 'Flower of Player’s seat', 'Pure Bouquet', 'No Honours']));
    expect(names(card(base, '5s', { flowers: [k('F1'), k('F6'), k('F3'), k('F8')] }))).toContain('Mixed Bouquet');
    expect(names(card(base, '5s'))).toContain('No Flowers + No Honours');
  });

  it('flower instant wins, chasing, concealed gong money and payments', () => {
    const eight = dubaiFlowerWin([[34, 35, 36, 37, 38, 39, 40, 41], [], [], []], ['E', 'S', 'W', 'N'], 1)!;
    expect(eight.winner).toBe(0);
    expect(eight.payer).toBeNull();
    expect(names(eight.score)).toEqual(expect.arrayContaining(['8 Flowers (instant win)', 'Pure Bouquet × 2']));
    const seven = dubaiFlowerWin([[34, 35, 36, 37, 38, 39, 40], [], [41], []], ['E', 'S', 'W', 'N'], 2)!;
    expect(seven).toMatchObject({ winner: 0, payer: 2 });
    expect(names(seven.score)).toEqual(expect.arrayContaining(['7 Flowers (instant win)', 'East gives winning tile']));
    expect(dubaiFlowerWin([[34, 35, 36, 37, 38, 39, 40], [], [], []], ['E', 'S', 'W', 'N'], 0)).toBeNull();
    expect(dubaiChase(1, k('E'), 4)).toEqual([0, 2, 3].map((to) => ({ from: 1, to, amount: 5 })));
    expect(dubaiChase(1, k('5m'), 4).every((p) => p.amount === 10)).toBe(true);
    expect(D.instantPayments!({ type: 'kong', seat: 2, concealed: true }, 4)).toEqual([0, 1, 3].map((from) => ({ from, to: 2, amount: 5 })));
    expect(D.instantPayments!({ type: 'kong', seat: 2, concealed: false }, 4)).toEqual([]);
    const s = card('123m 456m 789p 234p 567s 99s', '5s');
    expect(D.payments(0, 3, s, 1, 4, 0)).toEqual([{ from: 3, to: 0, amount: s.points }]);
    expect(D.payments(0, null, s, 1, 4, 0).map((p) => p.amount)).toEqual([s.points, s.points, s.points]);
  });

  it('the engine pays a seven-flower rob and chasing', () => {
    const g = new MahjongGame(D, ['A', 'B', 'C', 'D'], 5);
    g.startHand(77);
    expect(g.state.dice).toHaveLength(3);
    // Rig the flowers: seat 1 holds seven, seat 2 holds the eighth.
    const all = g.players.flatMap((p) => p.flowers);
    g.players.forEach((p) => (p.flowers = []));
    const byKind = [...all].sort((a, b) => a.kind - b.kind);
    expect(byKind).toHaveLength(Math.min(8, byKind.length));
    if (byKind.length === 8) {
      g.players[1].flowers = byKind.slice(0, 7);
      g.players[2].flowers = byKind.slice(7);
      (g as unknown as { flowerWinCheck(): boolean }).flowerWinCheck();
      const ph = g.state.phase;
      expect(ph.kind).toBe('handOver');
      if (ph.kind === 'handOver') {
        expect(ph.result.winner).toBe(1);
        expect(ph.result.discarder).toBe(2);
        expect(g.players[1].flowers).toHaveLength(8);
        expect(ph.result.payments.slice(-1)[0]).toMatchObject({ from: 2, to: 1 });
      }
    }
    // Chasing: every seat throws the same tile on the first go-round.
    const c = new MahjongGame(D, ['A', 'B', 'C', 'D'], 6);
    c.startHand(91);
    const live = (j: number) => j >= c.state.drawnFromFront + 8 && j < c.state.wall.length - D.deadWall;
    const kind = [...Array(27).keys()].find((kk) => c.state.wall.filter((x, j) => x.kind === kk && live(j)).length + c.players.reduce((a, p) => a + p.hand.filter((x) => x.kind === kk).length, 0) === 4)!;
    let seat = c.dealer;
    for (let i = 0; i < 4; i++) {
      const ph = c.state.phase;
      expect(ph.kind).toBe('turn');
      const pl = c.players[seat];
      let t = pl.hand.find((x) => x.kind === kind);
      if (!t) {
        // Swap one in from the wall so the test controls the discard.
        const wi = c.state.wall.findIndex((x, j) => x.kind === kind && live(j));
        const mine = pl.hand.findIndex((x) => x.id !== (ph.kind === 'turn' ? ph.drawn?.id : -1));
        [pl.hand[mine], c.state.wall[wi]] = [c.state.wall[wi], pl.hand[mine]];
        t = pl.hand[mine];
      }
      c.discard(seat, t.id);
      while (c.state.phase.kind === 'claims') for (const s of c.pendingClaimSeats()) c.respond(s, { type: 'pass' });
      seat = (seat + 1) % 4;
    }
    expect(c.state.instant).toEqual(dubaiChase(c.dealer, kind, 4));
  });

  it('plays full Dubai-card games with AI, conserving points with the bank', () => {
    let wins = 0;
    const seen = new Set<string>();
    for (let seed = 1; seed <= 3; seed++) {
      const g = new MahjongGame(D, ['A', 'B', 'C', 'D'], seed);
      const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, 'strategic', (['shark', 'wall', 'gambler', 'teacher'] as const)[s], seed * 31 + s));
      let hands = 0;
      do {
        g.startHand(seed * 1000 + hands++);
        let steps = 0;
        while (g.state.phase.kind !== 'handOver' && steps++ < 3000) {
          const ph = g.state.phase;
          if (ph.kind === 'turn') {
            const d = ais[ph.seat].decideTurn(g);
            if (d.action === 'win') g.declareSelfDrawWin(ph.seat);
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
        const ph = g.state.phase;
        expect(ph.kind).toBe('handOver');
        if (ph.kind === 'handOver' && ph.result.type === 'win') {
          wins++;
          for (const it of ph.result.score!.items) seen.add(it.name.replace(/ × \d+$/, ''));
          expect(ph.result.score!.items.some((i) => i.name === 'Mahjong' || i.name.includes('Flowers (instant'))).toBe(true);
        }
        expect(g.players.reduce((a, p) => a + p.score, 0) + g.state.riichiPot).toBe(4 * DUBAI_START);
      } while (!g.advance() && hands < 16);
    }
    expect(wins).toBeGreaterThan(8);
    expect(seen.size).toBeGreaterThan(12);
  });
});
