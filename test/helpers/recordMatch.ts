// Record a whole AI match as a replay (every seat played by AiPlayer), for
// tests of analyses that read replays.

import { AiPlayer, type Difficulty } from '../../src/ai/players';
import { MahjongGame } from '../../src/engine/game';
import type { GameLength } from '../../src/engine/rounds';
import { applyAction, handSeed, type Action } from '../../src/net/actions';
import { profileFor, type ReplayRecord } from '../../src/net/replay';
import type { TableConfig } from '../../src/ui/match';

export function recordMatch(variation: string, seed: number, length: GameLength = 'oneHand', meLevel: Difficulty = 'beginner'): ReplayRecord {
  const config: TableConfig = { name: 'Test', variation, length, difficulty: 'strategic', personalities: ['zen', 'shark', 'wall'], houseRules: {}, timer: 0, hints: true };
  const rp = profileFor(config);
  const names = ['You', 'Mei', 'Rex', 'Hiro'].slice(0, rp.players);
  const game = new MahjongGame(rp, names, seed);
  const ais = names.map((_, s) => new AiPlayer(s, s === 0 ? meLevel : 'strategic', s === 0 ? 'gambler' : 'zen', seed + s * 101));
  const hands: Action[][] = [];
  for (let hand = 0; hand < 12; hand++) {
    game.startHand(handSeed(seed, hand));
    const log: Action[] = [];
    const act = (a: Action) => {
      log.push(a);
      applyAction(game, a);
    };
    for (let step = 0; step < 3000 && game.state.phase.kind !== 'handOver'; step++) {
      const ph = game.state.phase;
      if (ph.kind === 'charleston') {
        const picks = ais.map((ai) => ai.charlestonPass(game).map((t) => t.id));
        picks.forEach((ids, s) => act({ t: 'cp', s, ids }));
      } else if (ph.kind === 'charlestonVote') {
        ais.forEach((ai, s) => game.state.phase.kind === 'charlestonVote' && act({ t: 'cv', s, v: ai.charlestonVote(game) ? 1 : 0 }));
      } else if (ph.kind === 'exchangeChoice') {
        const c = ais[ph.seat].exchangeChoice(game);
        act({ t: 'gx', s: ph.seat, p: c.passes, w: c.wall });
      } else if (ph.kind === 'wallExchange') {
        const picks = ais.map((ai) => ai.wallExchangePick(game).map((t) => t.id));
        picks.forEach((ids, s) => act({ t: 'wx', s, ids }));
      } else if (ph.kind === 'turn') {
        const s = ph.seat;
        const d = ais[s].decideTurn(game);
        if (d.action === 'win') act({ t: 'w', s });
        else if (d.action === 'kong') act({ t: 'k', s, k: d.kind! });
        else if (d.action === 'swap') act({ t: 'j', s, o: d.swap!.owner, m: d.swap!.meld, id: d.swap!.tileId });
        else act({ t: 'd', s, id: d.tileId!, ...(d.riichi ? { r: 1 as const } : {}) });
      } else if (ph.kind === 'claims') {
        for (const s of game.pendingClaimSeats()) {
          const cur = game.state.phase;
          if (cur.kind !== 'claims') break;
          act({ t: 'c', s, r: ais[s].decideClaim(game, cur.options[s], cur.tile.kind) });
        }
      }
    }
    hands.push(log);
    if (game.state.phase.kind !== 'handOver') break;
    if (game.advance()) break;
  }
  return { id: `t-${seed}`, date: new Date('2026-10-01T10:00:00Z').toISOString(), config, names, me: 0, matchSeed: seed, hands, finalScores: game.players.map((p) => p.score), placement: 1, mode: 'ai' };
}
