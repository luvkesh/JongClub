import { applyAction, decisionAction } from '../src/net/actions';
import { AiPlayer, type Difficulty } from '../src/ai/players';
import { MahjongGame } from '../src/engine/game';
import { turnHint, claimHint } from '../src/ai/jongbot';
import { evaluateDiscards, currentShanten } from '../src/ai/evaluate';
import { VARIATIONS } from '../src/engine/rules';
const only = process.env.ONLY?.split(',');
const profiles: Record<string, any> = Object.fromEntries(VARIATIONS.filter((v) => v.profile && (!only || only.includes(v.id))).map((v) => [v.id, v.profile]));
const stats: Record<string, number[]> = {};
function t<T>(k: string, f: () => T): T { const s = performance.now(); const r = f(); (stats[k] ??= []).push(performance.now() - s); return r; }
const diff = (process.env.DIFF ?? 'expert') as Difficulty;
for (const [pn, prof] of Object.entries(profiles)) {
  for (let seed = 1; seed <= Number(process.env.N ?? 4); seed++) {
    const g = new MahjongGame(prof, ['A', 'B', 'C', 'D'].slice(0, prof.players ?? 4), seed);
    const ais = [0, 1, 2, 3].slice(0, prof.players ?? 4).map((s) => new AiPlayer(s, diff, 'teacher', seed * 7 + s));
    g.startHand(seed);
    let steps = 0;
    while (g.state.phase.kind !== 'handOver' && steps++ < 3000) {
      const ph = g.state.phase;
      if (ph.kind === 'turn') {
        if (ph.seat === 0) { t(pn + ' turnHint', () => turnHint(g, 0, 'learning')); t(pn + ' evaluateDiscards', () => evaluateDiscards(g, 0)); }
        t(pn + ' aiPause.shanten', () => currentShanten(g, ph.seat));
        const d = t(pn + ' decideTurn', () => ais[ph.seat].decideTurn(g));
        if (d.action === 'abort' || d.action === 'kita') applyAction(g, decisionAction(ph.seat, d));
        else if (d.action === 'win') g.declareSelfDrawWin(ph.seat);
        else if (d.action === 'kong') g.declareKong(ph.seat, d.kind!);
        else if (d.action === 'swap') g.exchangeJoker(ph.seat, d.swap!);
        else t(pn + ' engine.discard', () => g.discard(ph.seat, d.tileId!, { riichi: d.riichi }));
      } else if (ph.kind === 'charleston') {
        for (let s = 0; s < 4; s++) if (g.state.phase.kind === 'charleston') g.charlestonPass(s, t(pn + ' charleston', () => ais[s].charlestonPass(g)).map((x: any) => x.id));
      } else if (ph.kind === 'charlestonVote') {
        for (let s = 0; s < 4; s++) if (g.state.phase.kind === 'charlestonVote') g.charlestonVote(s, ais[s].charlestonVote(g));
      } else if (ph.kind === 'claims') {
        for (const s of g.pendingClaimSeats()) {
          const cur = g.state.phase; if (cur.kind !== 'claims') break;
          if (s === 0) t(pn + ' claimHint', () => claimHint(g, 0, cur.options[0], cur.tile.kind, 'learning'));
          const r = t(pn + ' decideClaim', () => ais[s].decideClaim(g, cur.options[s], cur.tile.kind));
          g.respond(s, r);
        }
      } else break;
    }
  }
}
const pct = (a: number[], p: number) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];
for (const [k, a] of Object.entries(stats).filter(([k, a]) => Math.max(...a) > 8)) console.log(k.padEnd(28), 'n', String(a.length).padStart(4), 'avg', (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1).padStart(7), 'p95', pct(a, 0.95).toFixed(1).padStart(7), 'max', Math.max(...a).toFixed(1).padStart(7));
