import { describe, expect, it } from 'vitest';
import { AiPlayer } from '../src/ai/players';
import { decisionAction, applyAction, handSeed, type Action } from '../src/net/actions';
import { loadReplays, profileFor, replayHand, saveReplay, type ReplayRecord } from '../src/net/replay';
import { MahjongGame } from '../src/engine/game';
import type { TableConfig } from '../src/ui/match';

const config = { variation: 'classic', length: 'eastRound', houseRules: {} } as unknown as TableConfig;

/** Play `n` hands with AI on every seat, recording every action like a live table does. */
function playMatch(seed: number, n: number) {
  const g = new MahjongGame(profileFor(config), ['A', 'B', 'C', 'D'], seed);
  const hands: Action[][] = [];
  const starts: { round: unknown; scores: number[]; pot: number }[] = [];
  for (let h = 0; h < n; h++) {
    starts.push({ round: structuredClone(g.state.round), scores: g.players.map((p) => p.score), pot: g.state.riichiPot });
    const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, 'strategic', 'zen', handSeed(seed + s * 101, h)));
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
    g.advance();
  }
  return { hands, starts };
}

describe('replays of live games', () => {
  it('a record that starts mid-match (late spectator) replays the same hands', () => {
    const seed = 4242;
    const { hands, starts } = playMatch(seed, 3);
    const base = { id: 'x', date: '', config, names: ['A', 'B', 'C', 'D'], me: -1, matchSeed: seed, finalScores: [], placement: 1, mode: 'multiplayer' };
    const full: ReplayRecord = { ...base, hands };
    const late: ReplayRecord = { ...base, hands: hands.slice(1), start: { hand: 1, ...(starts[1] as { round: never; scores: number[]; pot: number }) } };
    for (const [i, j] of [
      [1, 0],
      [2, 1],
    ]) {
      const a = replayHand(full, i).steps.slice(-1)[0].state;
      const b = replayHand(late, j).steps.slice(-1)[0].state;
      expect(b.phase.kind).toBe('handOver');
      expect(b).toEqual(a);
    }
  });

  it('ignores corrupt saved replays', () => {
    const store = new Map<string, string>();
    const g = globalThis as { localStorage?: unknown };
    const prev = g.localStorage;
    g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    try {
      store.set('jongclub.replays.v1', '{"not":"a list"}');
      expect(loadReplays()).toEqual([]);
      saveReplay({ id: 'r1' } as ReplayRecord);
      expect(loadReplays().map((r) => r.id)).toEqual(['r1']);
    } finally {
      g.localStorage = prev;
    }
  });
});
