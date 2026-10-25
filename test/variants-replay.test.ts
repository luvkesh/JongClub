// Deterministic replay for the joker and animal variations: a recorded match
// replays to exactly the same positions, jokers, bites and scores included.

import { describe, expect, it } from 'vitest';
import { AiPlayer } from '../src/ai/players';
import { MahjongGame } from '../src/engine/game';
import type { GameState } from '../src/engine/state';
import { decisionAction, applyAction, handSeed, type Action } from '../src/net/actions';
import { profileFor, replayHand, type ReplayRecord } from '../src/net/replay';
import type { TableConfig } from '../src/ui/match';

function playMatch(config: TableConfig, seed: number, n: number) {
  const g = new MahjongGame(profileFor(config), ['A', 'B', 'C', 'D'], seed);
  const hands: Action[][] = [];
  const finals: GameState[] = [];
  for (let h = 0; h < n; h++) {
    const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, 'strategic', 'shark', handSeed(seed + s * 101, h)));
    g.startHand(handSeed(seed, h));
    const log: Action[] = [];
    const act = (a: Action) => (log.push(a), applyAction(g, a));
    for (let steps = 0; g.state.phase.kind !== 'handOver' && steps < 3000; steps++) {
      const ph = g.state.phase;
      if (ph.kind === 'turn') {
        const d = ais[ph.seat].decideTurn(g);
        if (d.action === 'abort' || d.action === 'kita') act(decisionAction(ph.seat, d));
        else if (d.action === 'win') act({ t: 'w', s: ph.seat });
        else if (d.action === 'kong') act({ t: 'k', s: ph.seat, k: d.kind! });
        else act({ t: 'd', s: ph.seat, id: d.tileId! });
      } else if (ph.kind === 'claims') {
        for (const s of g.pendingClaimSeats()) {
          const cur = g.state.phase;
          if (cur.kind !== 'claims') break;
          act({ t: 'c', s, r: ais[s].decideClaim(g, cur.options[s], cur.tile.kind) });
        }
      }
    }
    hands.push(log);
    finals.push(structuredClone(g.state));
    if (g.advance()) break;
  }
  return { hands, finals };
}

describe('replays of joker and animal games', () => {
  for (const [variation, houseRules] of [
    ['vietnamese', {}],
    ['singapore', { payout: 'shared' }],
  ] as const) {
    it(`${variation}: every hand replays to the same final position`, () => {
      const config = { variation, length: 'eastRound', houseRules } as unknown as TableConfig;
      const seed = 777;
      const { hands, finals } = playMatch(config, seed, 4);
      const rec: ReplayRecord = { id: 'x', date: '', config, names: ['A', 'B', 'C', 'D'], me: -1, matchSeed: seed, finalScores: [], placement: 1, mode: 'multiplayer', hands } as ReplayRecord;
      hands.forEach((_, i) => {
        const end = replayHand(rec, i).steps.slice(-1)[0].state;
        expect(end.phase.kind).toBe('handOver');
        expect(end).toEqual(finals[i]);
      });
    });
  }
});
