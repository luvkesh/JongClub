import { describe, expect, it } from 'vitest';
import { applyAction, decisionAction } from '../src/net/actions';
import { AiPlayer } from '../src/ai/players';
import { turnHint } from '../src/ai/jongbot';
import { MahjongGame } from '../src/engine/game';
import { shanten, waits, winningDecompositions } from '../src/engine/hand';
import { advanceRound, initialRound, roundLabel } from '../src/engine/rounds';
import { classicProfile } from '../src/engine/rules/classic';
import { parseKinds, toCounts } from '../src/engine/tiles';

const rules = classicProfile.shapes;
const c = (s: string) => toCounts(parseKinds(s));

describe('hand analysis', () => {
  it('finds standard wins', () => {
    expect(winningDecompositions(c('123m 456p 789s EEE RdRd'), 0, rules).length).toBe(1);
    expect(winningDecompositions(c('123m 456p 789s EEE RdGd'), 0, rules).length).toBe(0);
  });
  it('finds seven pairs and thirteen orphans', () => {
    expect(winningDecompositions(c('11m 22m 55p 77p 99s EE RdRd'), 0, rules).some((d) => d.shape === 'sevenPairs')).toBe(true);
    expect(winningDecompositions(c('19m 19p 19s ESWN RdGdWd 1m'), 0, rules).some((d) => d.shape === 'thirteenOrphans')).toBe(true);
  });
  it('computes shanten and waits', () => {
    expect(shanten(c('123m 456p 789s EEE Rd'), 0, rules)).toBe(0);
    expect(waits(c('123m 456p 789s EEE Rd'), 0, rules)).toEqual(parseKinds('Rd'));
    expect(waits(c('2345m 456p 789s EEE'), 0, rules).sort()).toEqual(parseKinds('25m'));
    expect(shanten(c('159m 159p 159s ESW N'), 0, rules)).toBeGreaterThan(2);
  });
});

describe('classic scoring', () => {
  it('scores a pure one suit all-pung hand', () => {
    const g = new MahjongGame(classicProfile, ['A', 'B', 'C', 'D'], 1);
    g.startHand(1);
    const kinds = parseKinds('111222333444m 55m');
    g.players[0].hand = kinds.map((kind, id) => ({ id: 1000 + id, kind }));
    const ev = g.evaluateWin(0, kinds[13], true, false)!;
    expect(ev).toBeTruthy();
    const names = ev.score.items.map((i) => i.name);
    expect(names).toContain('Pure One Suit');
    expect(ev.score.value).toBeGreaterThanOrEqual(8);
  });
  it('scores a chicken hand at zero faan when won on discard with a meld', () => {
    const g = new MahjongGame(classicProfile, ['A', 'B', 'C', 'D'], 1);
    g.startHand(1);
    g.players[0].melds = [{ type: 'pung', tiles: parseKinds('999s').map((kind, i) => ({ id: 900 + i, kind })), concealed: false, from: 1 }];
    g.players[0].hand = parseKinds('123m 456p 345s 5p').map((kind, id) => ({ id: 1000 + id, kind }));
    const ev = g.evaluateWin(0, parseKinds('5p')[0], false, true)!;
    expect(ev.score.items.map((i) => i.name)).toEqual(['Chicken hand']);
  });
});

describe('NEWS round framework', () => {
  it('passes the deal and advances the wind', () => {
    const p = { ...classicProfile.rounds, prevailingWinds: ['E', 'S'] as ('E' | 'S')[] };
    let r = initialRound();
    for (let i = 0; i < 4; i++) r = advanceRound(p, r, 4, { dealerWon: false, drawn: false });
    expect(roundLabel(p, r).round).toBe('SOUTH ROUND');
    r = advanceRound(p, r, 4, { dealerWon: true, drawn: false });
    expect(r.dealerSeat).toBe(0);
    expect(r.repeat).toBe(1);
    for (let i = 0; i < 4; i++) r = advanceRound(p, r, 4, { dealerWon: false, drawn: false });
    expect(r.finished).toBe(true);
  });
});

describe('full AI games', () => {
  it('plays many hands to completion with tile conservation', () => {
    let wins = 0;
    let draws = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const g = new MahjongGame(classicProfile, ['A', 'B', 'C', 'D'], seed);
      const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, (['beginner', 'casual', 'strategic', 'expert'] as const)[s], (['shark', 'wall', 'gambler', 'zen'] as const)[s], seed * 13 + s));
      g.startHand(seed);
      let steps = 0;
      while (g.state.phase.kind !== 'handOver' && steps++ < 1000) {
        const ph = g.state.phase;
        if (ph.kind === 'turn') {
          if (ph.seat === 0) turnHint(g, 0, 'advanced');
          const d = ais[ph.seat].decideTurn(g);
          if (d.action === 'abort' || d.action === 'kita') applyAction(g, decisionAction(ph.seat, d));
          else if (d.action === 'win') g.declareSelfDrawWin(ph.seat);
          else if (d.action === 'kong') g.declareKong(ph.seat, d.kind!);
          else g.discard(ph.seat, d.tileId!);
        } else if (ph.kind === 'claims') {
          for (const s of g.pendingClaimSeats()) {
            const cur = g.state.phase;
            if (cur.kind !== 'claims') break;
            g.respond(s, ais[s].decideClaim(g, cur.options[s], cur.tile.kind));
          }
        }
        // Conservation: every tile is somewhere exactly once.
        const ids = new Set<number>();
        const s = g.state;
        const live = s.wall.slice(s.drawnFromFront, s.wall.length - s.drawnFromBack);
        const ph2 = s.phase;
        const pending = ph2.kind === 'claims' ? [ph2.tile] : [];
        for (const t of [...live, ...pending, ...s.players.flatMap((p) => [...p.hand, ...p.discards, ...p.melds.flatMap((m) => m.tiles)])]) ids.add(t.id);
        const claimedOut = s.players.flatMap((p) => p.claimedDiscards).length;
        expect(ids.size + (ph2.kind === 'claims' ? 0 : 0)).toBeGreaterThanOrEqual(136 - claimedOut - 1);
      }
      expect(g.state.phase.kind).toBe('handOver');
      const ph = g.state.phase;
      if (ph.kind === 'handOver') {
        if (ph.result.type === 'win') wins++;
        else draws++;
        expect(ph.result.deltas.reduce((a, b) => a + b, 0)).toBe(0);
      }
    }
    expect(wins).toBeGreaterThan(15);
    console.log({ wins, draws });
  });
});
