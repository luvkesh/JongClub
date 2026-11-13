// QA round 2: engine and table-option regressions found by scripts/qa/fuzz2.ts.

import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { getProfile, VARIATIONS, withHouseRules } from '../src/engine/rules';
import { indiaProfile } from '../src/engine/rules/india';
import { parseKinds } from '../src/engine/tiles';
import { rig, total } from './helpers/qaRig';
import { fuzz2Match, newStats } from '../scripts/qa/fuzz2';
import { initialRound } from '../src/engine/rounds';
import { profileFor, resumeAt } from '../src/net/replay';
import type { TableConfig } from '../src/ui/match';

const k = (s: string) => parseKinds(s)[0];

describe('a call must leave a tile to discard', () => {
  for (const id of ['american', 'uae-american']) {
    it(`${id}: with every other tile exposed, two jokers in hand may not pung the discard (only Mahjong could take it)`, () => {
      const g = new MahjongGame(getProfile(id)!, ['A', 'B', 'C', 'D'], 3);
      g.startHand(3);
      // Seat 1: 11 exposed tiles and two jokers. Seat 0 throws a 7 dot.
      rig(
        g,
        [
          { hand: '7p 2p 3p 4p 5p 6p 8p 9p 2s 4s 5s 7s 8s 9s' },
          {
            hand: 'J J',
            melds: [
              { spec: '1m 1m 1m 1m', type: 'kong', from: 0 },
              { spec: '3m 3m 3m 3m', type: 'kong', from: 0 },
              { spec: '6s 6s 6s', type: 'pung', from: 0 },
            ],
          },
        ],
        { turn: 0 },
      );
      expect(g.players[1].hand).toHaveLength(2);
      g.discard(0, g.players[0].hand.find((t) => t.kind === k('7p'))!.id);
      const ph = g.state.phase;
      const opts = ph.kind === 'claims' ? (ph.options[1] ?? []) : [];
      expect(opts.some((o) => o.type === 'pung' || o.type === 'kong')).toBe(false);
      // Before the fix the pung went through and seat 1 had to discard from an empty hand: the hand hung.
    });
  }

  it('a pung is still offered when a tile stays in hand to throw', () => {
    const g = new MahjongGame(getProfile('american')!, ['A', 'B', 'C', 'D'], 4);
    g.startHand(4);
    rig(
      g,
      [
        { hand: '7p 2p 3p 4p 5p 6p 8p 9p 2s 4s 5s 7s 8s 9s' },
        { hand: 'J J 9p', melds: [{ spec: '1m 1m 1m 1m', type: 'kong', from: 0 }, { spec: '3m 3m 3m', type: 'pung', from: 0 }, { spec: '6s 6s 6s', type: 'pung', from: 0 }] },
      ],
      { turn: 0 },
    );
    g.discard(0, g.players[0].hand.find((t) => t.kind === k('7p'))!.id);
    const ph = g.state.phase;
    expect(ph.kind === 'claims' && ph.options[1]?.some((o) => o.type === 'pung')).toBe(true);
  });
});

describe('winner takes all at an India Rules West (Goulash) table', () => {
  it('a discard win is paid by every other player: the thrower does not "pay for the table" as well', () => {
    for (const wta of ['off', 'on']) {
      const profile = withHouseRules(indiaProfile, { indiaRounds: 'W', winnerTakesAll: wta });
      const g = new MahjongGame(profile, ['A', 'B', 'C', 'D'], 21);
      g.startHand(21);
      // Seat 1 (South, West round) has three exposed pungs and waits on 5m; seat 0 (not calling) throws it.
      rig(
        g,
        [
          { hand: '5m 1p 4p 7p 2s 5s 8s E N Gd Wd 9p 3s 6p' },
          { hand: 'RdRdRd 5m', melds: [{ spec: '2m 2m 2m', type: 'pung', from: 0 }, { spec: 'S S S', type: 'pung', from: 2 }, { spec: 'W W W', type: 'pung', from: 3 }] },
        ],
        { turn: 0 },
      );
      g.discard(0, g.players[0].hand.find((t) => t.kind === k('5m'))!.id);
      const ph = g.state.phase;
      expect(ph.kind === 'claims' && ph.options[1]?.some((o) => o.type === 'win'), `winnerTakesAll ${wta}`).toBe(true);
      for (const s of g.pendingClaimSeats()) g.respond(s, { type: s === 1 ? 'win' : 'pass' });
      const end = g.state.phase;
      if (end.kind !== 'handOver') throw new Error('hand not over');
      const toWinner = end.result.payments.filter((p) => p.to === 1 && !p.reason?.startsWith('Count'));
      if (wta === 'off') expect(toWinner.map((p) => [p.from, p.reason])).toEqual([[0, 'Penalty: pays for the table']]);
      else expect(new Set(toWinner.map((p) => p.from))).toEqual(new Set([0, 2, 3]));
    }
  });
});

/** Every physical tile exactly once (hands, melds, discards, flowers, wall, a tile held in a claim window). */
function conserved(g: MahjongGame) {
  const s = g.state;
  const ids: number[] = [];
  for (const p of s.players) for (const t of [...p.hand, ...p.discards, ...p.flowers, ...p.melds.flatMap((m) => m.tiles)]) ids.push(t.id);
  for (let i = s.drawnFromFront; i < s.wall.length - s.drawnFromBack; i++) ids.push(s.wall[i].id);
  if (s.phase.kind === 'claims' && s.phase.robKong) ids.push(s.phase.tile.id);
  for (const t of s.outOfPlay ?? []) ids.push(t.id);
  return ids.sort((a, b) => a - b).join() === s.wallOrder.slice().sort((a, b) => a - b).join();
}

// Seat 0 holds an exposed pung of 5p and draws the fourth; seat 1 waits on 5p with a full flush.
const ROB_SEATS = [
  { hand: '1s 2s 3s 4s 5s 6s 7s 8s 9s 9s 5p', melds: [{ spec: '5p 5p 5p', type: 'pung' as const, from: 2 }] },
  { hand: '1p 1p 1p 2p 2p 2p 3p 3p 3p 9p 9p 4p 6p' },
];
const ROB_SETS = VARIATIONS.filter((v) => !v.profile!.card && !v.profile!.big && v.profile!.players === 4 && !v.id.startsWith('india'));

describe('robbing the kong and the kong replacement, every four-seat rule set', () => {
  for (const v of ROB_SETS) {
    it(`${v.id}: an added kong opens a robbing window only where the rule set robs kongs; the tiles and the money add up`, () => {
      for (const selfDrawOnly of ['off', 'on']) {
        const profile = withHouseRules(v.profile!, { selfDrawOnly });
        const g = new MahjongGame(profile, ['A', 'B', 'C', 'D'], 9);
        g.startHand(9);
        try {
          rig(g, ROB_SEATS, { turn: 0 });
        } catch {
          continue; // a rule set without these tiles
        }
        const before = total(g);
        expect(g.turnOptions(0).kongs).toContain(k('5p'));
        const robber = g.evaluateWin(1, k('5p'), false, true, false, { robbedKong: true, discarder: 0 });
        g.declareKong(0, k('5p'));
        expect(conserved(g)).toBe(true);
        const ph = g.state.phase;
        if (profile.robKong && robber && selfDrawOnly === 'off') {
          expect(ph.kind).toBe('claims');
          if (ph.kind !== 'claims') return;
          expect(ph.robKong).toBe(true);
          expect(Object.keys(ph.options)).toEqual(['1']);
          g.respond(1, { type: 'win' });
          const end = g.state.phase;
          if (end.kind !== 'handOver') throw new Error('no win');
          expect(end.result.winner).toBe(1);
          expect(end.result.robbedKong).toBe(true);
          expect(g.players[0].melds[0].type).toBe('pung');
          expect(g.players[0].melds[0].tiles).toHaveLength(3);
          expect(g.players[1].hand.filter((t) => t.kind === k('5p'))).toHaveLength(1);
        } else {
          // No window: the kong stands and its owner draws the replacement from the back.
          expect(ph.kind === 'turn' || ph.kind === 'handOver').toBe(true);
          expect(g.players[0].melds[0].type).toBe('kong');
          if (ph.kind === 'turn') {
            expect(ph.seat).toBe(0);
            expect(ph.afterKong).toBe(true);
            expect(g.state.drawnFromBack).toBeGreaterThan(0);
          }
        }
        expect(conserved(g)).toBe(true);
        expect(total(g)).toBeCloseTo(before, 6);
      }
    });
  }
});

describe('a kong on the last live tile', () => {
  for (const v of ROB_SETS) {
    it(`${v.id}: the replacement is the last live tile; its discard ends the hand as a wall game`, () => {
      const g = new MahjongGame(v.profile!, ['A', 'B', 'C', 'D'], 12);
      g.startHand(12);
      try {
        rig(g, ROB_SEATS, { turn: 0, liveLeft: 1, discardSink: 3 });
      } catch {
        return;
      }
      // Nobody may rob it: seat 1 waits on something else.
      g.players[1].hand.find((t) => t.kind === k('4p'))!.kind = k('9s');
      const before = total(g);
      expect(g.liveRemaining).toBe(1);
      expect(g.turnOptions(0).kongs).toContain(k('5p'));
      g.declareKong(0, k('5p'));
      expect(conserved(g)).toBe(true);
      // A wild in seat 1's hand may still rob it (Shanghai, Beijing): let it go.
      if (g.state.phase.kind === 'claims') for (const s of g.pendingClaimSeats()) g.respond(s, { type: 'pass' });
      let ph = g.state.phase;
      if (ph.kind === 'handOver') return; // a flower as the last tile, or an instant win
      expect(ph.kind).toBe('turn');
      expect(g.liveRemaining).toBe(0);
      // No further kong with nothing left to replace it.
      expect(g.turnOptions(0).kongs).toEqual([]);
      if (ph.kind === 'turn' && !g.turnOptions(0).canWin) {
        g.discard(0, g.turnOptions(0).discards[0].id);
        ph = g.state.phase;
        if (ph.kind === 'claims') {
          // Only wins on the last discard.
          for (const o of Object.values(ph.options)) expect(o.every((x) => x.type === 'win')).toBe(true);
          for (const s of g.pendingClaimSeats()) g.respond(s, { type: 'pass' });
        }
        expect(g.state.phase.kind).toBe('handOver');
        const end = g.state.phase;
        if (end.kind === 'handOver') expect(end.result.type).toBe('draw');
      }
      expect(conserved(g)).toBe(true);
      expect(total(g)).toBeCloseTo(before, 6);
    });
  }
});

describe('fuzz2 smoke run (rare moves, probes, JSON round trip, resume, replay)', () => {
  it('one single-hand match per rule set plays clean', () => {
    const st = newStats();
    for (const v of VARIATIONS) fuzz2Match(v.id, 4242, st, { length: 'oneHand', timeBudgetMs: 60_000 });
    expect(st.hands).toBeGreaterThanOrEqual(VARIATIONS.length);
    expect(st.probes).toBeGreaterThan(0);
  }, 60_000);

  it('the same seed plays the same match (lockstep tables)', () => {
    for (const id of ['classic', 'riichi', 'sanma', 'india']) {
      const a = fuzz2Match(id, 99, newStats(), { length: 'eastRound', timeBudgetMs: 60_000 });
      const b = fuzz2Match(id, 99, newStats(), { length: 'eastRound', timeBudgetMs: 60_000 });
      expect(b, id).toEqual(a);
    }
  }, 60_000);
});

describe('joining a live table at a goulash hand (spectators resume at the hand start)', () => {
  it('the goulash flag is part of the resume point: without it the hand deals differently', () => {
    const config = { variation: 'classic', length: 'eastRound', houseRules: { goulash: 'on', goulashExchange: 'on' } } as unknown as TableConfig;
    const profile = profileFor(config);
    const at = { round: { ...initialRound(), handsPlayed: 1, repeat: 1 }, scores: [0, 0, 0, 0], pot: 0 };
    const withFlag = new MahjongGame(profile, ['A', 'B', 'C', 'D'], 5);
    resumeAt(withFlag, { ...at, goulash: true });
    withFlag.startHand(77);
    const without = new MahjongGame(profile, ['A', 'B', 'C', 'D'], 5);
    resumeAt(without, at);
    without.startHand(77);
    // The hand after a wall game opens with the exchange; a client that missed the flag would
    // start play at once and refuse every exchange action the table sends (src/ui/live.ts now forwards it).
    expect(withFlag.state.phase.kind).toBe('charleston');
    expect(without.state.phase.kind).toBe('turn');
  });
});
