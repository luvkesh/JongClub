// Decision review for replays: compares a player's discard or call with
// what JongBot would have done, and says why in a sentence or two.
//
// Call these BEFORE the decision is applied. They only read the game.

import type { MahjongGame } from '../engine/game';
import { distance as cardDistance } from '../engine/rules/american';
import type { ClaimOption, ClaimResponse } from '../engine/state';
import { FLOWER_BASE, isFlower, isJoker, tileName } from '../engine/tiles';
import { americanPlan, exposureDanger, missingAfterCall } from './american';
import { safetySentence, threatSentence, type TileDanger } from './danger';
import { isValueHonor, shantenAfterCall } from './evaluate';
import { ADVISOR, ADVISOR_CLAIMS, planClaim, planDiscard, type Candidate, type DiscardPlan } from './strategy';

export type Verdict = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface DecisionReview {
  verdict: Verdict;
  /** Kind JongBot would have discarded (or null for non-discard decisions). */
  bestKind: number | null;
  chosenKind: number | null;
  /** One or two plain-English sentences: what was chosen, what was better and why (efficiency, waits, danger). */
  explanation: string;
  /** 0..1 how much it mattered, for highlighting key moments on a timeline. */
  weight: number;
}

const BASE_WEIGHT: Record<Verdict, number> = { best: 0.05, good: 0.15, inaccuracy: 0.4, mistake: 0.7, blunder: 0.95 };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const away = (s: number) => (s >= 99 ? 'no win possible with these sets' : s <= 0 ? 'ready' : s === 1 ? '1 tile from ready' : `${s} tiles from ready`);
const cardAway = (n: number) => (!Number.isFinite(n) ? 'with no card hand left that fits' : n <= 0 ? 'complete' : n === 1 ? 'one tile from Mah Jongg' : `${n} tiles from a card hand`);
const the = (k: number) => `the ${tileName(k)}`;
const The = (k: number) => `The ${tileName(k)}`;
const helpful = (n: number) => `${n} tile${n === 1 ? '' : 's'} that help`;

/** Map a gap onto a verdict: up to steps[0] good, steps[1] inaccuracy, steps[2] mistake, beyond that a blunder. */
function verdictFromGap(gap: number, steps: [number, number, number]): Verdict {
  if (gap <= steps[0]) return 'good';
  if (gap <= steps[1]) return 'inaccuracy';
  return gap <= steps[2] ? 'mistake' : 'blunder';
}

const worse = (a: Verdict, b: Verdict): Verdict => {
  const order: Verdict[] = ['best', 'good', 'inaccuracy', 'mistake', 'blunder'];
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
};

// ------------------------------------------------------------------ discards

export function reviewDiscard(game: MahjongGame, seat: number, tileId: number): DecisionReview {
  const pl = game.players[seat];
  const tile = pl.hand.find((t) => t.id === tileId);
  if (!tile) return { verdict: 'good', bestKind: null, chosenKind: null, explanation: "That tile wasn't in the hand, so there's nothing to review.", weight: 0 };
  const chosenKind = tile.kind;
  if (game.profile.card) return reviewAmericanDiscard(game, seat, chosenKind);
  if (pl.riichi) {
    return { verdict: 'best', bestKind: chosenKind, chosenKind, explanation: `The hand was locked after ${game.profile.callNames.riichi ?? 'riichi'}, so the drawn tile went straight out.`, weight: 0 };
  }

  const plan = planDiscard(game, seat, ADVISOR);
  const best = plan.ranked[0];
  if (game.isWild(chosenKind) && best) {
    return { verdict: 'blunder', bestKind: best.kind, chosenKind, explanation: `You threw away a ${tileName(chosenKind)}. A joker can stand in for a tile you need, and a discarded joker is dead, so ${the(best.kind)} was the one to let go.`, weight: 0.95 };
  }
  const chosen = plan.ranked.find((c) => c.kind === chosenKind) ?? best;
  const threat = plan.threat;
  // Stakes: close to ready or facing a threat makes a decision matter more.
  const stakes = (threat ? 0.15 : 0) + (best.shanten <= 0 ? 0.1 : best.shanten === 1 ? 0.05 : 0);

  if (chosen.kind === best.kind) {
    return { verdict: 'best', bestKind: best.kind, chosenKind, explanation: praise(game, plan, best), weight: clamp01(BASE_WEIGHT.best + stakes / 2) };
  }

  // How much worse, in two currencies: speed (efficiency points, 100 = one
  // tile further from ready) and danger (share of an ordinary hand lost).
  const effGap = best.attack - chosen.attack;
  const dangerGap = chosen.loss - best.loss;
  let verdict: Verdict;
  if (plan.mode === 'fold') {
    verdict = verdictFromGap(dangerGap, [0.01, 0.04, 0.1]);
    if (dangerGap <= 0.01 && effGap > 60) verdict = 'inaccuracy';
  } else {
    verdict = verdictFromGap(effGap, [6, 25, 140]);
    if (best.shanten === 0 && chosen.shanten > 0) verdict = worse(verdict, 'mistake');
    if (dangerGap >= 0.1) verdict = worse(verdict, 'mistake');
    else if (dangerGap >= 0.04) verdict = worse(verdict, 'inaccuracy');
  }

  const explanation = critique(game, seat, plan, best, chosen, verdict);
  const severity = plan.mode === 'fold' ? clamp01(dangerGap / 0.12) : clamp01(effGap / 150);
  const weight = clamp01(BASE_WEIGHT[verdict] * 0.7 + severity * 0.2 + stakes);
  return { verdict, bestKind: best.kind, chosenKind, explanation, weight };
}

function waitText(game: MahjongGame, c: Candidate): string {
  const names = c.improvers.map(tileName);
  if (!names.length) return 'ready';
  const list = names.length <= 1 ? names[0] : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
  return `ready, waiting on the ${list} (${c.ukeire} left)${game.profile.furiten && c.furiten ? ', though only by self-draw' : ''}`;
}

/** The opponent who makes the difference between two discards most dangerous. */
function keyOpponent(plan: DiscardPlan, chosen: Candidate, best: Candidate): number {
  let idx = -1;
  let most = 0;
  plan.danger.reads.forEach((r, i) => {
    const diff = r.threat * (plan.danger.detail[chosen.kind][i].hit - plan.danger.detail[best.kind][i].hit);
    if (diff > most) {
      most = diff;
      idx = i;
    }
  });
  if (idx < 0 && plan.threat) idx = plan.danger.reads.indexOf(plan.threat);
  return idx;
}

function praise(game: MahjongGame, plan: DiscardPlan, best: Candidate): string {
  const threat = plan.threat;
  if (plan.mode === 'fold' && threat) {
    const d = plan.danger.detail[best.kind][plan.danger.reads.indexOf(threat)];
    return `Well judged. ${threatSentence(game, threat, true)} ${foldPraiseSafety(best.kind, d)}`;
  }
  if (best.shanten === 0) return `Spot on. Letting go of ${the(best.kind)} left you ${waitText(game, best)}.`;
  return `Nice. ${The(best.kind)} was the right tile: it kept you ${away(best.shanten)} with ${helpful(best.ukeire)}.`;
}

/**
 * The safety note under a best-move verdict while folding. When the tile had
 * no specific safety reason, say it was the best balance rather than echo
 * "not a sure safe tile", which reads as if the move were a mistake.
 */
export function foldPraiseSafety(kind: number, d: TileDanger): string {
  if (d.reason === 'none') return `${The(kind)} wasn't a sure safe tile, but it was the best balance of speed and safety.`;
  return safetySentence(kind, d, true);
}

/** Why the discarded tile was worth keeping for the hand's score. */
function valueReason(game: MahjongGame, seat: number, kind: number): string {
  const counts = game.players[seat].hand.filter((t) => t.kind === kind).length;
  if (game.doraKinds().includes(kind)) return `${the(kind)} is a dora, a bonus tile that adds to your score`;
  if (counts >= 2 && isValueHonor(game, seat, kind)) return `your pair of ${tileName(kind)}s could become a scoring set`;
  const suit = (k: number) => (k < 27 ? Math.floor(k / 9) : -1);
  const mine = game.players[seat].hand.map((t) => suit(t.kind)).filter((x) => x >= 0);
  const main = [0, 1, 2].sort((a, b) => mine.filter((x) => x === b).length - mine.filter((x) => x === a).length)[0];
  if (suit(kind) === main) return `${the(kind)} fit the one-suit hand you were building`;
  return `${the(kind)} helped your hand score more`;
}

function critique(game: MahjongGame, seat: number, plan: DiscardPlan, best: Candidate, chosen: Candidate, verdict: Verdict): string {
  const lead = verdict === 'good' ? `Fine choice. ${The(best.kind)} was a touch better:` : `You let go of ${the(chosen.kind)}. ${The(best.kind)} was better:`;
  // Danger first when it was the deciding factor.
  if (plan.mode === 'fold' || chosen.loss - best.loss >= 0.04) {
    const i = keyOpponent(plan, chosen, best);
    if (i >= 0) {
      const read = plan.danger.reads[i];
      const dBest = plan.danger.detail[best.kind][i];
      const dChosen = plan.danger.detail[chosen.kind][i];
      // A "good" verdict is praise: name the safer tile without calling the choice risky.
      if (verdict === 'good') return `${threatSentence(game, read, true)} Fine choice, though ${the(best.kind)} was a touch safer.`;
      const risky = dChosen.hit >= 0.06 ? `${The(chosen.kind)} was risky against them.` : `${The(chosen.kind)} wasn't a sure safe tile.`;
      const speed = plan.mode === 'fold' ? ` You were ${away(best.shanten)}, so playing safe mattered more than speed.` : '';
      const safer = dBest.reason === 'none' ? `${The(best.kind)} was the safer choice.` : safetySentence(best.kind, dBest, true);
      return `${threatSentence(game, read, true)} ${risky} ${safer}${speed}`;
    }
  }
  if (best.shanten < chosen.shanten) {
    if (best.shanten === 0) return `${lead} it left you ${waitText(game, best)}, while ${the(chosen.kind)} left you ${away(chosen.shanten)}.`;
    return `${lead} it kept you ${away(best.shanten)}, while ${the(chosen.kind)} left you ${away(chosen.shanten)}.`;
  }
  if (best.shanten === 0 && chosen.shanten === 0) {
    if (chosen.furiten && !best.furiten) return `${lead} without ${the(chosen.kind)} you'd have been waiting on a tile you had already discarded, so you could only win by self-draw.`;
    if (best.ukeire > chosen.ukeire) return `${lead} you'd have been waiting on ${best.ukeire} live tiles instead of ${chosen.ukeire}.`;
    if (best.value > chosen.value * 1.15) return `${lead} the same kind of wait, but the hand would have scored more.`;
  }
  if (best.ukeire > chosen.ukeire) return `${lead} both kept you ${away(best.shanten)}, but it left ${helpful(best.ukeire)} against ${chosen.ukeire}.`;
  if (best.value > chosen.value * 1.15) return `${lead} ${valueReason(game, seat, chosen.kind)}.`;
  if (best.shapeBonus > chosen.shapeBonus) return `${lead} it was a loose tile, while ${the(chosen.kind)} still had partners in your hand.`;
  return `${lead} it kept the hand a little more flexible.`;
}

function reviewAmericanDiscard(game: MahjongGame, seat: number, chosenKind: number): DecisionReview {
  const ranked = americanPlan(game, seat, 0.3, true);
  const best = ranked[0];
  const norm = (k: number) => (isFlower(k) ? FLOWER_BASE : k);
  const chosen = ranked.find((r) => norm(r.tile.kind) === norm(chosenKind));
  const bestKind = best.tile.kind;
  if (norm(bestKind) === norm(chosenKind)) {
    return { verdict: 'best', bestKind, chosenKind, explanation: `Nice. ${The(bestKind)} didn't fit your closest card hands, and it kept you ${cardAway(best.missing)}.`, weight: 0.05 };
  }
  if (isJoker(chosenKind)) {
    return { verdict: 'blunder', bestKind, chosenKind, explanation: `You threw away a joker. Jokers can stand in for any tile in a set of three or more, so ${the(bestKind)} was the one to let go.`, weight: 0.95 };
  }
  const missChosen = chosen?.missing ?? cardDistance(game.players[seat].hand.filter((t) => t.kind !== chosenKind), game.players[seat].melds);
  const gap = missChosen - best.missing;
  let verdict: Verdict = gap <= 0 ? 'good' : gap === 1 ? 'mistake' : 'blunder';
  if (gap <= 0 && chosen && chosen.keep - best.keep > 6) verdict = 'inaccuracy';
  const lead = verdict === 'good' ? `Fine choice. ${The(bestKind)} was a touch better:` : `You let go of ${the(chosenKind)}. ${The(bestKind)} was better:`;
  const exposed = exposureDanger(game, seat)(norm(chosenKind)) > 0;
  const why =
    gap > 0
      ? ` it kept you ${cardAway(best.missing)}, while ${the(chosenKind)} left you ${cardAway(missChosen)}.`
      : exposed
        ? ` both left you ${cardAway(best.missing)}, but ${the(chosenKind)} matched a set another player has exposed, so it could have handed them Mah Jongg.`
        : ` both left you ${cardAway(best.missing)}, but your nearest card hands use ${the(chosenKind)} more.`;
  const close = best.missing <= 2 ? 0.15 : 0;
  return { verdict, bestKind, chosenKind, explanation: lead + why, weight: clamp01(BASE_WEIGHT[verdict] * 0.8 + close) };
}

// ------------------------------------------------------------------ claims

const sameClaim = (a: ClaimResponse, b: ClaimResponse) => a.type === b.type && (a.type !== 'chow' || (a as ClaimOption).using?.join() === (b as ClaimOption).using?.join());

export function reviewClaim(game: MahjongGame, seat: number, chosen: ClaimResponse, options: ClaimOption[], kind: number): DecisionReview {
  const names = game.profile.callNames;
  const verb = (t: ClaimResponse['type']) => (t === 'chow' ? names.chow : t === 'kong' ? names.kong : t === 'pung' ? names.pung : t === 'win' ? names.win : 'pass');
  const out = (verdict: Verdict, explanation: string, extra = 0): DecisionReview => ({ verdict, bestKind: null, chosenKind: null, explanation, weight: clamp01(BASE_WEIGHT[verdict] + extra) });
  const name = tileName(kind);

  const win = options.find((o) => o.type === 'win');
  if (win) {
    if (chosen.type === 'win') return out('best', `Well spotted: the ${name} completed your hand.`, 0.3);
    return out('blunder', `You passed on a winning tile! The ${name} completed your hand${game.profile.furiten ? ', and passing it also stops you winning on a discard until your next turn' : ''}.`, 0.05);
  }
  if (game.profile.card) return reviewAmericanClaim(game, seat, chosen, options, kind, out);

  const plan = planClaim(game, seat, options, kind, ADVISOR_CLAIMS);
  const best = plan.best;
  if (sameClaim(best, chosen)) {
    if (chosen.type === 'pass') {
      const why: Record<string, string> = {
        noYaku: 'calling would have left your hand open with no yaku, so it could never win',
        noValue: `an open hand couldn't have reached the ${game.profile.minValue} needed to win`,
        defend: 'someone looked ready, and keeping safe tiles mattered more than speed',
        staysClosed: 'your concealed hand was worth more than the small speed-up',
      };
      return out('best', `Good patience. Passing on the ${name} was right: ${why[plan.reason] ?? "it wouldn't have brought you closer to winning"}.`);
    }
    return out('best', `Good call. ${verb(chosen.type)} on the ${name} ${plan.after < plan.before ? `took you from ${away(plan.before)} to ${away(plan.after)}` : 'added value to your hand'}.`, 0.05);
  }

  if (best.type === 'pass') {
    // Called when JongBot would have passed.
    if (plan.reason === 'noYaku') return out('blunder', `Calling the ${name} left your hand open with no yaku, so it can't win. Passing and staying concealed was the way.`);
    if (plan.reason === 'noValue') return out('mistake', `Calling the ${name} opened a hand that can't reach the minimum score to win. Passing was better.`);
    const after = chosen.type === 'kong' ? plan.before : shantenAfterCall(game, seat, (chosen as ClaimOption).using ?? [kind, kind], kind);
    if (plan.reason === 'defend') return out('inaccuracy', `Someone looked ready, and you were ${away(plan.before)}. Calling the ${name} used up tiles you could have discarded safely.`, 0.1);
    if (after > plan.before) return out('mistake', `Calling the ${name} set your hand back to ${away(after)}. Passing kept you ${away(plan.before)}.`);
    return out('inaccuracy', `Calling the ${name} ${after < plan.before ? 'sped you up a little, but' : "didn't speed you up, and"} your hand ${game.isConcealed(seat) ? 'was worth more concealed' : 'was better off waiting for a stronger call'}.`);
  }
  // JongBot would have called.
  const bestVerb = verb(best.type);
  const reason = plan.reason === 'value' ? `the set would have scored and ${plan.after < plan.before ? `moved you to ${away(plan.after)}` : `kept you ${away(plan.after)}`}` : `it would have moved you from ${away(plan.before)} to ${away(plan.after)}`;
  if (chosen.type === 'pass') return out(plan.reason === 'value' && plan.after < plan.before ? 'mistake' : 'inaccuracy', `You passed on the ${name}. ${bestVerb} was better: ${reason}.`);
  return out('inaccuracy', `${verb(chosen.type)} worked, but ${bestVerb} with the ${name} was better: ${reason}.`);
}

function reviewAmericanClaim(game: MahjongGame, seat: number, chosen: ClaimResponse, options: ClaimOption[], kind: number, out: (v: Verdict, e: string, extra?: number) => DecisionReview): DecisionReview {
  const pl = game.players[seat];
  const now = cardDistance(pl.hand, pl.melds);
  let best: { o: ClaimOption; after: number } | null = null;
  for (const o of options) {
    if (o.type !== 'pung' && o.type !== 'kong') continue;
    const after = missingAfterCall(game, seat, kind, o.type === 'kong' ? 4 : 3);
    if (!best || after < best.after) best = { o, after };
  }
  const name = tileName(kind);
  const shouldCall = best && best.after < now;
  if (chosen.type === 'pass') {
    if (!shouldCall) return out('best', `Good patience. The ${name} didn't bring your nearest card hand closer.`);
    return out('inaccuracy', `You passed on the ${name}. Calling it would have left you ${cardAway(best!.after)} instead of ${cardAway(now)}.`);
  }
  const after = chosen.type === 'pung' || chosen.type === 'kong' ? missingAfterCall(game, seat, kind, chosen.type === 'kong' ? 4 : 3) : Infinity;
  if (!shouldCall) {
    if (!Number.isFinite(after)) return out('blunder', `Calling the ${name} left no hand on the card that fits your exposures.`);
    return out(after > now ? 'mistake' : 'inaccuracy', `Calling the ${name} didn't bring you closer: you stayed ${cardAway(after)}. Exposures also give others jokers to swap for.`);
  }
  if (after <= best!.after) return out('best', `Good call. The ${name} fits a hand on the card and leaves you ${cardAway(after)}.`, 0.05);
  return out('inaccuracy', `Calling worked, but a different exposure would have left you ${cardAway(best!.after)}.`);
}
