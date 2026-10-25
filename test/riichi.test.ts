import { describe, expect, it } from 'vitest';
import { applyAction, decisionAction } from '../src/net/actions';
import { AiPlayer } from '../src/ai/players';
import { turnHint } from '../src/ai/jongbot';
import { MahjongGame } from '../src/engine/game';
import { winningDecompositions } from '../src/engine/hand';
import { doraFromIndicator, riichiProfile } from '../src/engine/rules/riichi';
import type { ScoringContext } from '../src/engine/rules/types';
import type { Meld } from '../src/engine/state';
import { parseKinds, toCounts } from '../src/engine/tiles';

const P = riichiProfile;
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

describe('riichi scoring', () => {
  it('riichi + menzen tsumo + pinfu, 20 fu', () => {
    const s = best('234m 567m 345p 678s 99p', '4m', { selfDrawn: true, riichi: true });
    expect(s.items.map((i) => i.name)).toEqual(expect.arrayContaining(['Riichi', 'Menzen Tsumo', 'Pinfu']));
    expect(s.fu).toBe(20);
    expect(s.value).toBe(3);
    const pay = P.payments(0, null, s, 1, 4, 0);
    expect(pay.find((p) => p.from === 1)!.amount).toBe(1300);
    expect(pay.find((p) => p.from === 2)!.amount).toBe(700);
  });
  it('riichi ron on a closed wait is 40 fu 1 han = 1,300', () => {
    const s = best('123m 456p 789s 345s NN', '4s', { riichi: true });
    expect(s.fu).toBe(40);
    expect(s.value).toBe(1);
    expect(s.points).toBe(1300);
  });
  it('open hand without yaku does not qualify', () => {
    const s = best('123m 456p 345s NN', '4s', {}, [meld('789s', 'chow')]);
    expect(s.qualifies).toBe(false);
  });
  it('open yakuhai pon qualifies at 1 han 30 fu = 1,000', () => {
    const s = best('123m 456p 345s NN', '4s', {}, [meld('RdRdRd')]);
    expect(s.qualifies).toBe(true);
    expect(s.points).toBe(1000);
  });
  it('chiitoitsu with riichi is 25 fu 3 han = 3,200', () => {
    const s = best('11m 33m 55p 77p 99s EE WdWd', 'EE', { riichi: true });
    expect(s.fu).toBe(25);
    expect(s.points).toBe(3200);
  });
  it('dora count and mangan cap', () => {
    const s = best('234m 567m 345p 678s 99p', '4m', { selfDrawn: true, riichi: true, doraKinds: [k('9p'), k('5m')] });
    expect(s.items.find((i) => i.name === 'Dora')!.value).toBe(3);
    expect(s.tier).toBe('Haneman');
  });
  it('maps dora indicators', () => {
    expect(doraFromIndicator(k('9m'))).toBe(k('1m'));
    expect(doraFromIndicator(k('N'))).toBe(k('E'));
    expect(doraFromIndicator(k('Wd'))).toBe(k('Gd'));
    expect(doraFromIndicator(k('Rd'))).toBe(k('Wd'));
  });
  it('kokushi is yakuman', () => {
    const s = best('19m 19p 19s ESWN RdGdWd 1m', '5m'.replace('5m', '9m'));
    expect(s.tier).toContain('Yakuman');
  });
});

describe('riichi AI games', () => {
  it('plays full hanchan-length runs conserving points', () => {
    let wins = 0, draws = 0, riichis = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const g = new MahjongGame(P, ['A', 'B', 'C', 'D'], seed);
      const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, (['beginner', 'casual', 'strategic', 'expert'] as const)[s], (['shark', 'wall', 'gambler', 'teacher'] as const)[s], seed * 31 + s));
      let hands = 0;
      do {
        g.startHand(seed * 1000 + hands++);
        let steps = 0;
        while (g.state.phase.kind !== 'handOver' && steps++ < 2000) {
          const ph = g.state.phase;
          if (ph.kind === 'turn') {
            if (ph.seat === 0) turnHint(g, 0, 'advanced');
            const d = ais[ph.seat].decideTurn(g);
            if (d.action === 'abort' || d.action === 'kita') applyAction(g, decisionAction(ph.seat, d));
            else if (d.action === 'win') g.declareSelfDrawWin(ph.seat);
            else if (d.action === 'kong') g.declareKong(ph.seat, d.kind!);
            else {
              if (d.riichi) riichis++;
              g.discard(ph.seat, d.tileId!, { riichi: d.riichi });
            }
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
        const total = g.players.reduce((a, p) => a + p.score, 0) + g.state.riichiPot;
        expect(total).toBe(100000);
      } while (!g.advance() && hands < 30);
    }
    console.log({ wins, draws, riichis });
    expect(wins).toBeGreaterThan(10);
    expect(riichis).toBeGreaterThan(5);
  });
});
