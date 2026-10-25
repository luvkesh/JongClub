// Smoke: play hands in every variation and check the hand-score read at every step.
import { MahjongGame } from '../src/engine/game';
import { VARIATIONS } from '../src/engine/rules';
import { buildProfile } from '../src/club/sim';
import { AiPlayer } from '../src/ai/players';
import { applyAction, decisionAction } from '../src/net/actions';
import { handNow } from '../src/ai/handScore';

const only = process.argv[2];
let worst = 0;
for (const v of VARIATIONS) {
  if (only && v.id !== only) continue;
  const p = buildProfile(v.id, 'fullNews', {});
  const g = new MahjongGame(p, ['A', 'B', 'C', 'D'], 11);
  g.startHand(11);
  const ais = [0, 1, 2, 3].slice(0, p.players).map((s) => new AiPlayer(s, 'expert', 'zen', 3 + s));
  const tally: Record<string, number> = {};
  let maxMs = 0, wins = 0, mismatch = 0;
  for (let step = 0; step < 3000; step++) {
    const ph = g.state.phase;
    for (let s = 0; s < p.players; s++) {
      const before = JSON.stringify(g.state);
      const t0 = performance.now();
      const r = handNow(g, s);
      const dt = performance.now() - t0;
      maxMs = Math.max(maxMs, dt);
      tally[r.state] = (tally[r.state] ?? 0) + 1;
      if (JSON.stringify(g.state) !== before) throw new Error(`${v.id}: handNow changed the game`);
      if (ph.kind === 'turn' && ph.seat === s) {
        const o = g.turnOptions(s);
        if (o.canWin !== (r.state === 'win')) mismatch++;
        if (o.canWin && r.state === 'win' && o.winScore!.points !== r.win.score.points) mismatch++;
      }
    }
    if (ph.kind === 'handOver') {
      const w = ph.result.winner;
      if (w !== undefined && w !== null) { wins++; const r = handNow(g, w); if (r.state !== 'won') mismatch++; }
      break;
    }
    if (ph.kind === 'turn') applyAction(g, decisionAction(ph.seat, ais[ph.seat].decideTurn(g)));
    else if (ph.kind === 'claims') { for (const s of g.pendingClaimSeats()) { const c = g.state.phase; if (c.kind !== 'claims') break; g.respond(s, ais[s].decideClaim(g, c.options[s], c.tile.kind)); } }
    else if (ph.kind === 'charleston') ais.map((a) => a.charlestonPass(g).map((t) => t.id)).forEach((ids, s) => g.charlestonPass(s, ids));
    else if (ph.kind === 'exchangeChoice') { const c = ais[ph.seat].exchangeChoice(g); g.chooseExchanges(ph.seat, c.passes, c.wall); }
    else if (ph.kind === 'cardPick') ais.forEach((a, s) => g.pickCard(s, a.cardPick(g)));
    else if (ph.kind === 'roundChoice') g.chooseRound(ph.seat, ais[ph.seat].roundChoice(g));
    else if (ph.kind === 'ticTacToe') ais.map((a) => a.ticTacToePick(g).map((t) => t.id)).forEach((ids, s) => g.ticTacToe(s, ids));
    else if (ph.kind === 'wallExchange') ais.map((a) => a.wallExchangePick(g).map((t) => t.id)).forEach((ids, s) => g.wallExchange(s, ids));
    else if (ph.kind === 'charlestonVote') ais.forEach((a, s) => g.state.phase.kind === 'charlestonVote' && g.charlestonVote(s, a.charlestonVote(g)));
  }
  worst = Math.max(worst, maxMs);
  console.log(v.id.padEnd(18), `max ${maxMs.toFixed(0)}ms`, wins ? 'win' : 'draw', mismatch ? `MISMATCH ${mismatch}` : 'ok', JSON.stringify(tally));
}
console.log('worst', worst.toFixed(0), 'ms');
