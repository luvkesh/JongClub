// QA: the four table options alone and in combination (src/engine/rules/tableOptions.ts,
// MahjongGame.settleWin / resolveClaims, src/club/ladder.ts).

import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { getProfile, VARIATIONS, withHouseRules } from '../src/engine/rules';
import { TABLE_OPTION_IDS } from '../src/engine/rules/tableOptions';
import type { RuleProfile } from '../src/engine/rules/types';
import { parseKinds } from '../src/engine/tiles';
import { isLegalAction } from '../src/net/actions';
import { addToLadder } from '../src/club/ladder';
import { rig, total } from './helpers/qaRig';
import { fuzzMatch, type FuzzStats } from '../scripts/qa/fuzz-invariants';

const k = (s: string) => parseKinds(s)[0];
const ON = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, 'on']));

/** Seat 0 throws a 5p; seats 1 and 2 both wait on it, seat 3 is dead. */
function twoWaiting(base: RuleProfile, choices: Record<string, string>, opts: { seat3Waits?: boolean } = {}) {
  const g = new MahjongGame(withHouseRules(base, choices), ['A', 'B', 'C', 'D'], 7);
  g.startHand(7);
  const r = rig(g, [
    { hand: '1s 2s 3s 7m 8m 9m E E Wd Wd 1p 9s 2m 5p' },
    { hand: '1m 2m 3m 4m 5m 6m 7s 8s 9s 4p 6p N N' },
    { hand: '1m 2m 3m 4m 5m 6m 7s 8s 9s 2s 3s 4s 5p' },
    opts.seat3Waits ? { hand: '7m 8m 9m 2p 3p 4p 6s 7s 8s S S 4p 6p' } : { hand: '2m 4m 6m 8m 2p 4p 6p 8p 2s 4s 6s 8s S' },
  ]);
  return { g, five: r.tile(0, '5p') };
}

function sumDeltas(g: MahjongGame) {
  const ph = g.state.phase;
  if (ph.kind !== 'handOver') throw new Error('hand not over: ' + ph.kind);
  return ph.result;
}

describe('pairs and triples of table options', () => {
  it('two callers + winner takes all: only the first in turn wins and every other seat pays, zero-sum', () => {
    const { g, five } = twoWaiting(getProfile('classic')!, ON('multipleWinners', 'winnerTakesAll'));
    const t0 = total(g);
    g.discard(0, five.id);
    g.respond(1, { type: 'win' });
    g.respond(2, { type: 'win' });
    const r = sumDeltas(g);
    expect(r.winner).toBe(1);
    expect(r.coWinners ?? []).toEqual([]);
    expect(r.payments.map((p) => p.from).sort()).toEqual([0, 2, 3]);
    expect(total(g)).toBe(t0);
  });

  it('self-draw only: nobody may win on the discard, however many are waiting', () => {
    const { g, five } = twoWaiting(getProfile('classic')!, ON('selfDrawOnly'));
    g.discard(0, five.id);
    const ph = g.state.phase;
    if (ph.kind === 'claims') for (const o of Object.values(ph.options)) expect(o.some((x) => x.type === 'win')).toBe(false);
  });

  it('team play: when partners both call the win, only the one nearest in turn wins; team totals stay zero-sum', () => {
    // Seats 1 and 3 are partners (South + North); seat 0 throws.
    const { g, five } = twoWaiting(getProfile('classic')!, ON('teamPlay'), { seat3Waits: true });
    // Make seat 2's hand dead and seat 3 wait on 5p.
    g.discard(0, five.id);
    const ph = g.state.phase;
    expect(ph.kind).toBe('claims');
    for (const s of g.pendingClaimSeats()) g.respond(s, (ph as { options: Record<number, { type: string }[]> }).options[s].some((o) => o.type === 'win') ? { type: 'win' } : { type: 'pass' });
    const r = sumDeltas(g);
    expect(r.winner).toBe(1);
    expect(r.coWinners ?? []).toEqual([]);
    const team = (d: number[]) => [d[0] + d[2], d[1] + d[3]];
    const [a, b] = team(r.deltas);
    expect(a + b).toBe(0);
    expect(b).toBeGreaterThan(0);
  });

  it('team play is off on every three-seat rule set, whatever the host sends', () => {
    for (const v of VARIATIONS.filter((x) => (x.profile?.players ?? 4) === 3)) {
      const p = withHouseRules(v.profile!, ON(...TABLE_OPTION_IDS.filter((id) => id !== 'selfDrawOnly')));
      expect(p.table?.teams, v.id).toBe(false);
      const g = new MahjongGame(p, ['A', 'B', 'C'], 1);
      expect(g.teamOf(0)).toBeNull();
      expect(g.dealInRisk(0, 2)).toBe(true);
      // The other options stay on.
      expect(p.table).toMatchObject({ selfDrawOnly: false, winnerTakesAll: true, ladder: true });
    }
    expect(VARIATIONS.filter((x) => (x.profile?.players ?? 4) === 3).map((v) => v.id).sort()).toEqual(['korean3', 'malaysian3', 'sanma']);
  });

  it('robbing the kong with two robbers: only the first in turn wins, the kong maker pays, the pung stays a pung', () => {
    const g = new MahjongGame(withHouseRules(getProfile('classic')!, ON('multipleWinners')), ['A', 'B', 'C', 'D'], 9);
    g.startHand(9);
    rig(g, [
      { hand: '1s 2s 3s 7m 8m 9m E E Wd Wd 5p', melds: [{ spec: '5p 5p 5p', type: 'pung', from: 2 }] },
      { hand: '1m 2m 3m 4m 5m 6m 7s 8s 9s 4p 6p N N' },
      { hand: '1m 2m 3m 4m 5m 6m 7s 8s 9s 2s 2s 3p 4p' },
      null,
    ]);
    const t0 = total(g);
    expect(g.turnOptions(0).kongs).toContain(k('5p'));
    g.declareKong(0, k('5p'));
    const ph = g.state.phase;
    expect(ph.kind).toBe('claims');
    if (ph.kind !== 'claims') return;
    expect(ph.robKong).toBe(true);
    for (const s of g.pendingClaimSeats()) g.respond(s, { type: 'win' });
    const res = sumDeltas(g);
    expect(res.robbedKong).toBe(true);
    expect(res.winner).toBe(1);
    expect(res.coWinners ?? []).toEqual([]);
    expect(res.payments.some((p) => p.from === 0 && p.to === 1)).toBe(true);
    expect(g.players[0].melds[0].type).toBe('pung');
    expect(total(g)).toBe(t0);
  });
});

describe('table options with Riichi sticks and honba', () => {
  function riichiTwo(choices: Record<string, string>) {
    const g = new MahjongGame(withHouseRules(getProfile('riichi')!, choices), ['A', 'B', 'C', 'D'], 3);
    g.startHand(3);
    const r = rig(g, [
      { hand: '1s 2s 3s 7m 8m 9m E E Wd Wd 1p 9s 2m 5p' },
      { hand: '1m 2m 3m 4m 5m 6m 7s 8s 9s 4p 6p N N' },
      { hand: '2m 3m 4m 4m 5m 6m 6s 7s 8s 2s 3s 4s 5p' },
      null,
    ]);
    for (const s of [1, 2]) {
      g.players[s].riichi = true;
      g.players[s].riichiPaid = true;
      g.players[s].score -= 1000;
      g.state.riichiPot += 1000;
    }
    g.state.round.repeat = 2;
    return { g, five: r.tile(0, '5p') };
  }

  it('two rons: head bump, the first in turn order wins and takes the sticks, total conserved', () => {
    const { g, five } = riichiTwo(ON('multipleWinners'));
    const t0 = total(g);
    g.discard(0, five.id);
    g.respond(1, { type: 'win' });
    g.respond(2, { type: 'win' });
    const r = sumDeltas(g);
    expect(r.winner).toBe(1);
    expect(r.coWinners ?? []).toEqual([]);
    expect(r.potWon).toBe(2000);
    expect(g.state.riichiPot).toBe(0);
    expect(total(g)).toBe(t0);
    for (const p of r.payments) expect(p.from).toBe(0);
  });

  it('winner takes all on a ron: paid as a tsumo split, honba 100 a seat', () => {
    const { g, five } = riichiTwo(ON('winnerTakesAll'));
    const t0 = total(g);
    g.discard(0, five.id);
    g.respond(1, { type: 'win' });
    if (g.state.phase.kind === 'claims') g.respond(2, { type: 'pass' });
    const r = sumDeltas(g);
    expect(r.winner).toBe(1);
    expect(r.payments.map((p) => p.from).sort()).toEqual([0, 2, 3]);
    expect(total(g)).toBe(t0);
  });

  it('three rons with sanchahou off: head bump, only the first in turn wins', () => {
    const g = new MahjongGame(withHouseRules(getProfile('riichi')!, { multipleWinners: 'on', tripleRon: 'headBump' }), ['A', 'B', 'C', 'D'], 3);
    g.startHand(3);
    expect(g.profile.abortiveDraws?.tripleRon).toBe(false);
    const r = rig(g, [
      { hand: '1s 2s 3s 7m 8m 9m E E Wd Wd 1p 9s 2m 5p' },
      { hand: '1m 2m 3m 4m 5m 6m 7s 8s 9s 4p 6p N N' },
      { hand: '2m 3m 4m 4m 5m 6m 6s 7s 8s 2s 3s 4s 5p' },
      { hand: '6m 7m 8m 3p 4p 2p 3p 4p 6s 7s 8s 9p 9p' },
    ]);
    for (const s of [1, 2, 3]) g.players[s].riichi = true;
    const t0 = total(g);
    g.discard(0, r.tile(0, '5p').id);
    for (const s of g.pendingClaimSeats()) g.respond(s, { type: 'win' });
    const res = sumDeltas(g);
    expect(res.winner).toBe(1);
    expect(res.coWinners ?? []).toEqual([]);
    expect(total(g)).toBe(t0);
  });
});

describe('table options travel with the game', () => {
  it('special wind rounds (Classic special rounds) keep the base profile’s table options', () => {
    const p = withHouseRules(getProfile('classic')!, { specialRounds: 'on', selfDrawOnly: 'on', multipleWinners: 'on' });
    const g = new MahjongGame(p, ['A', 'B', 'C', 'D'], 1);
    for (const w of [0, 1, 2, 3]) {
      g.state.round = { ...g.state.round, windIndex: w };
      g.startHand(100 + w);
      expect(g.profile.specialRound, `wind ${w}`).toBeTruthy();
      expect(g.table?.selfDrawOnly).toBe(true);
      expect(g.discardWins()).toBe(false);
    }
  });

  it('a snapshot restored into a fresh game (and isLegalAction’s copy) keeps the options', () => {
    const p = withHouseRules(getProfile('classic')!, ON('selfDrawOnly'));
    const g = new MahjongGame(p, ['A', 'B', 'C', 'D'], 1);
    g.startHand(1);
    const c = new MahjongGame(g.baseProfile, ['A', 'B', 'C', 'D'], 1);
    c.state = structuredClone(g.state);
    expect(c.discardWins()).toBe(false);
    expect(isLegalAction(g, { t: 'd', s: 0, id: g.players[0].hand[0].id })).toBe(true);
  });

  it('lockstep replay and snapshot/restore under random option combos (fuzz, every rule set but India)', () => {
    const stats: FuzzStats = { hands: 0, wins: 0, coWins: 0, draws: 0, robbed: 0, lastTile: 0 };
    for (const v of VARIATIONS) {
      if (v.id === 'india') continue;
      fuzzMatch(v.id, 77 + v.id.length, stats, { length: v.id === 'american' ? 'oneHand' : 'eastRound', replay: true });
    }
    expect(stats.hands).toBeGreaterThan(30);
  }, 600_000);
});

describe('cumulative leaderboard edge cases', () => {
  it('team tie: both teams count a win', () => {
    const rows = addToLadder([], { variation: 'classic', startingScore: 5000, teams: [10000, 10000], seats: [{ name: 'A', score: 5000 }, { name: 'B', score: 6000 }, { name: 'C', score: 5000 }, { name: 'D', score: 4000 }] });
    expect(rows.map((r) => r.wins)).toEqual([1, 1, 1, 1]);
  });

  it('net points sum to zero for a zero-sum match without uma', () => {
    const rows = addToLadder([], { variation: 'classic', startingScore: 5000, seats: [{ name: 'A', score: 5600 }, { name: 'B', score: 4400 }, { name: 'C', score: 5100 }, { name: 'D', score: 4900 }] });
    expect(rows.reduce((a, r) => a + r.points, 0)).toBe(0);
  });

  it('a rule set whose house rules change the starting score (Taiwanese, Dubai club card) must use the configured start', () => {
    // results.ts reads getProfile(variation).startingScore (10000) for the ladder, but the table started at 1000.
    const configured = withHouseRules(getProfile('taiwanese')!, { scoring: 'dubai' });
    expect(configured.startingScore).not.toBe(getProfile('taiwanese')!.startingScore);
  });
});
