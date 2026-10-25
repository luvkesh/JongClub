import { describe, expect, it } from 'vitest';
import { applyAction, decisionAction } from '../src/net/actions';
import { AiPlayer } from '../src/ai/players';
import { MahjongGame } from '../src/engine/game';
import { withHouseRules } from '../src/engine/rules';
import { uaeProfile } from '../src/engine/rules/uae';

function play(choices: Record<string, string>, seeds = 3) {
  const P = withHouseRules(uaeProfile, choices);
  let wins = 0, flowers = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const g = new MahjongGame(P, ['A', 'B', 'C', 'D'], seed);
    const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, 'strategic', (['shark', 'wall', 'gambler', 'teacher'] as const)[s], seed * 31 + s));
    let hands = 0;
    do {
      g.startHand(seed * 1000 + hands++);
      let steps = 0;
      while (g.state.phase.kind !== 'handOver' && steps++ < 3000) {
        const ph = g.state.phase;
        if (ph.kind === 'turn') {
          const d = ais[ph.seat].decideTurn(g);
          if (d.action === 'abort' || d.action === 'kita') applyAction(g, decisionAction(ph.seat, d));
          else if (d.action === 'win') g.declareSelfDrawWin(ph.seat);
          else if (d.action === 'kong') g.declareKong(ph.seat, d.kind!);
          else g.discard(ph.seat, d.tileId!);
        } else if (ph.kind === 'charleston') {
          // Goulash exchange after a wall game (on by default at the Dubai table).
          const picks = ais.map((a) => a.charlestonPass(g).map((t) => t.id));
          picks.forEach((ids, s) => g.charlestonPass(s, ids));
        } else if (ph.kind === 'claims') {
          for (const s of g.pendingClaimSeats()) {
            const cur = g.state.phase;
            if (cur.kind !== 'claims') break;
            const r = ais[s].decideClaim(g, cur.options[s], cur.tile.kind);
            if (r.type === 'chow') expect(P.calls.chow).toBe(true);
            g.respond(s, r);
          }
        }
      }
      const ph = g.state.phase;
      if (ph.kind === 'handOver' && ph.result.type === 'win') wins++;
      flowers += g.players.reduce((a, p) => a + p.flowers.length, 0);
      expect(g.players.reduce((a, p) => a + p.score, 0)).toBe(4 * P.startingScore);
    } while (!g.advance() && hands < 16);
  }
  return { P, wins, flowers };
}

describe('dubai club profile', () => {
  it('defaults: flowers in play, 1 faan minimum', () => {
    const { P, wins, flowers } = play({});
    expect(P.flowers).toBe(true);
    expect(P.minValue).toBe(1);
    expect(wins).toBeGreaterThan(5);
    expect(flowers).toBeGreaterThan(10);
  });
  it('host can switch off flowers and chow and change who pays', () => {
    const { P, flowers } = play({ flowers: 'off', chow: 'off', payout: 'fullGun', minValue: '0' }, 2);
    expect(P.flowers).toBe(false);
    expect(P.calls.chow).toBe(false);
    expect(flowers).toBe(0);
    const s = { value: 2, unit: 'faan', items: [], points: 64, limit: false };
    expect(P.payments(0, 2, s, 1, 4, 0)).toEqual([{ from: 2, to: 0, amount: 192 }]);
  });
});
