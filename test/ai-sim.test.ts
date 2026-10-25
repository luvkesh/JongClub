// Expert vs casual: duplicate-style simulation on fixed seeds.
// Each wall is played twice with the seat assignments swapped, so seat
// and wall luck cancel out and only the difference in play remains.
// Set SIM_N to play more walls per variation (the default keeps the test fast).

import { describe, expect, it } from 'vitest';
import { applyAction, decisionAction } from '../src/net/actions';
import { AiPlayer, type Difficulty, type Personality } from '../src/ai/players';
import { MahjongGame } from '../src/engine/game';
import { classicProfile } from '../src/engine/rules/classic';
import { riichiProfile } from '../src/engine/rules/riichi';
import { taiwaneseProfile } from '../src/engine/rules/taiwanese';
import type { RuleProfile } from '../src/engine/rules/types';

interface Tally {
  hands: number;
  delta: number;
  dealIns: number;
  wins: number;
}

const blank = (): Tally => ({ hands: 0, delta: 0, dealIns: 0, wins: 0 });

/** Play one hand with AI on every seat. Returns per-seat deltas, winner and discarder. */
export function playHand(profile: RuleProfile, levels: Difficulty[], personalities: Personality[], seed: number) {
  const g = new MahjongGame(profile, ['A', 'B', 'C', 'D'], seed);
  const ais = levels.map((d, s) => new AiPlayer(s, d, personalities[s], seed * 7 + s));
  g.startHand(seed);
  let steps = 0;
  while (g.state.phase.kind !== 'handOver' && steps++ < 3000) {
    const ph = g.state.phase;
    if (ph.kind === 'charleston') {
      for (let s = 0; s < 4; s++) if (g.state.phase.kind === 'charleston') g.charlestonPass(s, ais[s].charlestonPass(g).map((t) => t.id));
    } else if (ph.kind === 'charlestonVote') {
      for (let s = 0; s < 4; s++) if (g.state.phase.kind === 'charlestonVote') g.charlestonVote(s, ais[s].charlestonVote(g));
    } else if (ph.kind === 'turn') {
      const d = ais[ph.seat].decideTurn(g);
      if (d.action === 'abort' || d.action === 'kita') applyAction(g, decisionAction(ph.seat, d));
      else if (d.action === 'win') g.declareSelfDrawWin(ph.seat);
      else if (d.action === 'kong') g.declareKong(ph.seat, d.kind!);
      else if (d.action === 'swap') g.exchangeJoker(ph.seat, d.swap!);
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
  if (ph.kind !== 'handOver') throw new Error('hand did not finish');
  const r = ph.result;
  // Riichi deposits still on the table count as lost by whoever paid them.
  return { deltas: g.players.map((p) => p.score - profile.startingScore), winner: r.winner ?? null, discarder: r.discarder ?? null };
}

export function simulate(profile: RuleProfile, walls: number, a: Difficulty, b: Difficulty, personality: Personality = 'teacher', base = 1) {
  const t: Record<string, Tally> = { [a]: blank(), [b]: blank() };
  const pers: Personality[] = [personality, personality, personality, personality];
  for (let w = 0; w < walls; w++) {
    const seed = base + w * 9973;
    for (const flip of [false, true]) {
      const levels: Difficulty[] = [0, 1, 2, 3].map((s) => ((s % 2 === 0) !== flip ? a : b));
      const res = playHand(profile, levels, pers, seed);
      levels.forEach((lv, s) => {
        const x = t[lv];
        x.hands++;
        x.delta += res.deltas[s];
        if (res.discarder === s) x.dealIns++;
        if (res.winner === s) x.wins++;
      });
    }
  }
  const summary = (x: Tally) => ({ avgDelta: Math.round(x.delta / x.hands), dealInRate: +(x.dealIns / x.hands).toFixed(3), winRate: +(x.wins / x.hands).toFixed(3), seatHands: x.hands });
  return { [a]: summary(t[a]), [b]: summary(t[b]) } as Record<Difficulty, ReturnType<typeof summary>>;
}

declare const process: { env: Record<string, string | undefined> };
const N = Number(process.env.SIM_N ?? 0);

describe('advanced AI simulation', () => {
  it('expert beats casual at Riichi: scores more and deals in less', () => {
    const r = simulate(riichiProfile, N || 120, 'expert', 'casual');
    console.log('riichi', r);
    expect(r.expert.avgDelta).toBeGreaterThan(r.casual.avgDelta);
    expect(r.expert.dealInRate).toBeLessThan(r.casual.dealInRate);
  }, 60_000);

  it('expert beats casual at Classic: scores more and deals in less', () => {
    const r = simulate(classicProfile, N || 160, 'expert', 'casual');
    console.log('classic', r);
    expect(r.expert.avgDelta).toBeGreaterThan(r.casual.avgDelta);
    expect(r.expert.dealInRate).toBeLessThan(r.casual.dealInRate);
  }, 60_000);

  it('expert beats casual at Taiwanese: scores more and deals in less', () => {
    // Taiwanese hands swing a lot (a self-draw is paid three times), so 60 walls
    // is only a smoke test on fixed seeds; SIM_N=2000 gives a standard error of
    // about 5 points per seat-hand against an edge of about 28.
    const r = simulate(taiwaneseProfile, N || 60, 'expert', 'casual', 'teacher', 4);
    console.log('taiwanese', r);
    expect(r.expert.avgDelta).toBeGreaterThan(r.casual.avgDelta);
    expect(r.expert.dealInRate).toBeLessThan(r.casual.dealInRate);
  }, 60_000);
});
