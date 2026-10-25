// Plays hands in every variation (and each special round) and asks the target help at each turn and
// claim of seat 0: no throws, and how long it takes. `npx vite-node perf/targets-smoke.ts [id]`
import { MahjongGame } from '../src/engine/game';
import { VARIATIONS, withHouseRules } from '../src/engine/rules';
import { buildProfile, playHandHeadless } from '../src/club/sim';
import { AiPlayer } from '../src/ai/players';
import { targetKit, targetReads, riskyTargetKinds } from '../src/ai/targets';
import { turnHint, claimHint } from '../src/ai/jongbot';
import { indiaProfile } from '../src/engine/rules/india';

const only = process.argv[2];
const cases: { name: string; profile: ReturnType<typeof buildProfile>; wind?: number }[] = [];
for (const v of VARIATIONS) if (!only || v.id === only) cases.push({ name: v.id, profile: buildProfile(v.id, 'fullNews') });
if (!only || only === 'india') for (const r of ['S', 'W', 'N']) cases.push({ name: `india-${r}`, profile: withHouseRules(indiaProfile, { indiaRounds: r }) });
if (!only || only === 'classic') [1, 2, 3].forEach((w) => cases.push({ name: `classic-round${w}`, profile: withHouseRules(buildProfile('classic', 'fullNews'), { specialRounds: 'on' }), wind: w }));

for (const c of cases) {
  let max = 0, total = 0, n = 0, kitId = '-', plans = 0, reads = 0, err = '';
  const sample: string[] = [];
  for (let seed = 1; seed <= 3 && !err; seed++) {
    const g = new MahjongGame(c.profile, ['A', 'B', 'C', 'D'], seed);
    if (c.wind !== undefined) g.state.round.windIndex = c.wind;
    g.startHand(seed);
    const ais = Array.from({ length: c.profile.players }, (_, s) => new AiPlayer(s, 'expert', 'zen', seed + s));
    for (let step = 0; step < 800; step++) {
      const ph = g.state.phase;
      if (ph.kind === 'handOver') break;
      try {
        const claim = ph.kind === 'claims' && ph.options?.[0]?.length;
        if ((ph.kind === 'turn' && ph.seat === 0) || claim) {
          const t0 = performance.now();
          const kit = targetKit(g);
          kitId = kit?.id ?? '-';
          if (kit) {
            const ps = kit.plans(g, 0, undefined, 4);
            plans = Math.max(plans, ps.length);
            if (sample.length < 1 && ps.length) sample.push(ps.map((p) => `${p.names.join('+')}${p.note ? ` (${p.note})` : ''} m${p.missing}`).join(' / '));
          }
          const rs = targetReads(g, 0);
          reads = Math.max(reads, rs.length);
          if (rs.length && sample.length < 2) sample.push('READ ' + rs[0].line);
          riskyTargetKinds(g, 0);
          if (ph.kind === 'turn') turnHint(g, 0, 'advanced');
          else if (ph.kind === 'claims') {
            const h = claimHint(g, 0, ph.options[0], ph.tile.kind, 'advanced');
            if (h.callCheck && sample.length < 3) sample.push('CALL ' + h.callCheck);
          }
          const dt = performance.now() - t0;
          max = Math.max(max, dt); total += dt; n++;
        }
      } catch (e) { err = String((e as Error).stack).split('\n').slice(0, 5).join(' | '); break; }
      playHandHeadless(g, ais, 1);
    }
  }
  console.log(`${c.name.padEnd(20)} kit=${kitId.padEnd(9)} plans=${plans} reads=${reads} n=${n} avg=${(total / Math.max(1, n)).toFixed(1)}ms max=${max.toFixed(0)}ms ${err}`);
  for (const s of sample) console.log('    ' + s);
}
