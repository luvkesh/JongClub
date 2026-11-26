// Plays hands with bots and gathers every piece of JongBot advice a player at the
// table could see along the way: the turn, claim and Charleston hints at each depth,
// the hand status, the target hands (names and notes as the planner shows them),
// the call checks and the reads on the other players.
import { MahjongGame } from '../src/engine/game';
import { withHouseRules, getProfile } from '../src/engine/rules';
import { AiPlayer } from '../src/ai/players';
import { charlestonHint, claimHint, handStatus, turnHint, type Hint, type HintDepth } from '../src/ai/jongbot';
import { targetKit, targetReads } from '../src/ai/targets';
import { planName, planNote } from '../src/ai/adviceText';
import { applyAction, decisionAction } from '../src/net/actions';
import type { RuleProfile } from '../src/engine/rules/types';

export const NAMES = ['Ana', 'Bo', 'Cai', 'Dev'];
const DEPTHS: HintDepth[] = ['beginner', 'learning', 'advanced'];

function hintTexts(h: Hint): string[] {
  const out = [h.headline, h.why ?? '', h.warning ?? '', h.callCheck ?? '', ...(h.keepBack ?? [])];
  for (const r of h.table ?? []) out.push(r.tile, r.away, r.risk);
  for (const p of h.targets?.plans ?? []) out.push(...p.names.map(planName), p.note ? planNote(p.note) : '');
  return out.filter(Boolean);
}

export interface AdviceCase {
  label: string;
  profile: RuleProfile;
  seed: number;
}

export function profileOf(id: string, house: Record<string, string> = {}): RuleProfile {
  return withHouseRules(getProfile(id)!, house);
}

/** Every advice text seen while bots play one hand of `c`, tagged by where it came from. */
export function adviceFor(c: AdviceCase, maxSteps = 400): string[] {
  const n = c.profile.players;
  const g = new MahjongGame(c.profile, NAMES.slice(0, n), c.seed);
  g.startHand(c.seed);
  const ais = Array.from({ length: n }, (_, s) => new AiPlayer(s, 'strategic', 'zen', c.seed + s));
  const out: string[] = [];
  const add = (tag: string, xs: string[]) => xs.forEach((x) => out.push(`${c.label}|${tag}|${x}`));
  const kit = targetKit(g);
  for (let step = 0; step < maxSteps; step++) {
    const ph = g.state.phase;
    if (ph.kind === 'handOver') break;
    if (ph.kind === 'charleston') {
      for (const d of DEPTHS) add('charleston', hintTexts(charlestonHint(g, 0, d)));
      const picks = ais.map((ai) => ai.charlestonPass(g).map((t) => t.id));
      picks.forEach((ids, s) => g.charlestonPass(s, ids));
    } else if (ph.kind === 'exchangeChoice') {
      const x = ais[ph.seat].exchangeChoice(g);
      g.chooseExchanges(ph.seat, x.passes, x.wall);
    } else if (ph.kind === 'cardPick') ais.forEach((ai, s) => g.pickCard(s, ai.cardPick(g)));
    else if (ph.kind === 'roundChoice') g.chooseRound(ph.seat, ais[ph.seat].roundChoice(g));
    else if (ph.kind === 'ticTacToe') ais.map((ai) => ai.ticTacToePick(g).map((t) => t.id)).forEach((ids, s) => g.ticTacToe(s, ids));
    else if (ph.kind === 'wallExchange') ais.map((ai) => ai.wallExchangePick(g).map((t) => t.id)).forEach((ids, s) => g.wallExchange(s, ids));
    else if (ph.kind === 'charlestonVote') ais.forEach((ai, s) => g.state.phase.kind === 'charlestonVote' && g.charlestonVote(s, ai.charlestonVote(g)));
    else if (ph.kind === 'turn') {
      const seat = ph.seat;
      for (const d of DEPTHS) add('turn', hintTexts(turnHint(g, seat, d)));
      add('status', [handStatus(g, seat)]);
      add('reads', targetReads(g, seat).map((r) => r.line));
      applyAction(g, decisionAction(seat, ais[seat].decideTurn(g)));
    } else if (ph.kind === 'claims') {
      for (const s of g.pendingClaimSeats()) {
        const cur = g.state.phase;
        if (cur.kind !== 'claims') break;
        const opts = cur.options[s];
        if (opts?.length) {
          for (const d of DEPTHS) add('claim', hintTexts(claimHint(g, s, opts, cur.tile.kind, d)));
          if (kit?.call) for (const o of opts) add('call', [kit.call(g, s, o, cur.tile.kind) ?? '']);
        }
        g.respond(s, ais[s].decideClaim(g, opts, cur.tile.kind));
      }
    }
  }
  return out.filter((x) => !x.endsWith('|'));
}

export const CASES: AdviceCase[] = [
  ...[3, 8].map((seed) => ({ label: 'india-E', profile: profileOf('india', { indiaRounds: 'E' }), seed })),
  ...[3, 8].map((seed) => ({ label: 'india-S', profile: profileOf('india', { indiaRounds: 'S' }), seed })),
  ...[3, 8].map((seed) => ({ label: 'india-W', profile: profileOf('india', { indiaRounds: 'W' }), seed })),
  ...[3, 8].map((seed) => ({ label: 'riichi', profile: profileOf('riichi'), seed })),
  ...[3, 8].map((seed) => ({ label: 'american', profile: profileOf('american'), seed })),
  ...[3, 8].map((seed) => ({ label: 'classic', profile: profileOf('classic'), seed })),
  { label: 'hongkong', profile: profileOf('hongkong'), seed: 5 },
  { label: 'taiwanese', profile: profileOf('taiwanese'), seed: 5 },
  { label: 'sanma', profile: profileOf('sanma'), seed: 5 },
  { label: 'sichuan', profile: profileOf('sichuan'), seed: 5 },
  { label: 'indian', profile: profileOf('indian'), seed: 5 },
];
