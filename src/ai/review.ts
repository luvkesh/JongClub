// Decision review for replays: compares a player's discard or call with
// what JongBot would have done, and says why in a sentence or two.
//
// Call these BEFORE the decision is applied. They only read the game.

import type { MahjongGame } from '../engine/game';
import { distance as cardDistance } from '../engine/rules/american';
import type { ClaimOption, ClaimResponse } from '../engine/state';
import { FLOWER_BASE, isFlower, isJoker } from '../engine/tiles';
import { americanPlan, exposureDanger, missingAfterCall } from './american';
import { safetySentence, threatSentence, type TileDanger } from './danger';
import { isValueHonor, shantenAfterCall } from './evaluate';
import { ADVISOR, ADVISOR_CLAIMS, planClaim, planDiscard, type Candidate, type DiscardPlan } from './strategy';
import { tr, trn } from '../i18n';
import { tileLabel } from '../i18n/tiles';
import { callWord, fromReady, orJoin, sentences } from './adviceText';

export type Verdict = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface DecisionReview {
  verdict: Verdict;
  /** Kind JongBot would have discarded (or null for non-discard decisions). */
  bestKind: number | null;
  chosenKind: number | null;
  /** One or two plain sentences in the player's language: what was chosen, what was better and why (efficiency, waits, danger). */
  explanation: string;
  /** A word of praise the explanation opens with ("Nice."), which a short card leaves out. */
  opener?: string;
  /** A win let pass, or a call let pass, for the key moments. */
  tag?: 'missedWin' | 'passed';
  /** 0..1 how much it mattered, for highlighting key moments on a timeline. */
  weight: number;
}

const BASE_WEIGHT: Record<Verdict, number> = { best: 0.05, good: 0.15, inaccuracy: 0.4, mistake: 0.7, blunder: 0.95 };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const away = fromReady;
const cardAway = (n: number) => (!Number.isFinite(n) ? tr('with no card hand left that fits') : n <= 0 ? tr('complete') : n === 1 ? tr('one tile from Mah Jongg') : tr('{n} tiles from a card hand', { n }));
const T = (k: number) => tileLabel(k);
/** A word of praise, then what earned it. */
const praised = (opener: string, body: string) => ({ opener, explanation: sentences(opener, body) });
/** "The 3 Dot was better:" and the reason after the colon. */
const lead = (good: boolean, chosen: number, best: number) => (good ? tr('Fine choice. The {best} was a touch better:', { best: T(best) }) : tr('You let go of the {tile}. The {best} was better:', { tile: T(chosen), best: T(best) }));

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
  if (!tile) return { verdict: 'good', bestKind: null, chosenKind: null, explanation: tr("That tile wasn't in the hand, so there's nothing to review."), weight: 0 };
  const chosenKind = tile.kind;
  if (game.profile.card) return reviewAmericanDiscard(game, seat, chosenKind);
  if (pl.riichi) {
    return { verdict: 'best', bestKind: chosenKind, chosenKind, explanation: tr('The hand was locked after {riichi}, so the drawn tile went straight out.', { riichi: callWord(game.profile.callNames.riichi ?? 'riichi') }), weight: 0 };
  }

  const plan = planDiscard(game, seat, ADVISOR);
  const best = plan.ranked[0];
  if (game.isWild(chosenKind) && best) {
    return { verdict: 'blunder', bestKind: best.kind, chosenKind, explanation: tr('You threw away a {tile}. A joker can stand in for a tile you need, and a discarded joker is dead, so the {best} was the one to let go.', { tile: T(chosenKind), best: T(best.kind) }), weight: 0.95 };
  }
  const chosen = plan.ranked.find((c) => c.kind === chosenKind) ?? best;
  const threat = plan.threat;
  // Stakes: close to ready or facing a threat makes a decision matter more.
  const stakes = (threat ? 0.15 : 0) + (best.shanten <= 0 ? 0.1 : best.shanten === 1 ? 0.05 : 0);

  if (chosen.kind === best.kind) {
    return { verdict: 'best', bestKind: best.kind, chosenKind, ...praise(game, plan, best), weight: clamp01(BASE_WEIGHT.best + stakes / 2) };
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
  if (!c.improvers.length) return tr('ready');
  const p = { tiles: orJoin(c.improvers.map(T)), n: c.ukeire };
  return game.profile.furiten && c.furiten ? tr('ready, waiting on the {tiles} ({n} left), though only by self-draw', p) : tr('ready, waiting on the {tiles} ({n} left)', p);
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

function praise(game: MahjongGame, plan: DiscardPlan, best: Candidate): { opener: string; explanation: string } {
  const threat = plan.threat;
  if (plan.mode === 'fold' && threat) {
    const d = plan.danger.detail[best.kind][plan.danger.reads.indexOf(threat)];
    return praised(tr('Well judged.'), sentences(threatSentence(game, threat, true), foldPraiseSafety(best.kind, d)));
  }
  if (best.shanten === 0) return praised(tr('Spot on.'), tr('Letting go of the {tile} left you {wait}.', { tile: T(best.kind), wait: waitText(game, best) }));
  return praised(tr('Nice.'), trn(best.ukeire, 'The {tile} was the right tile: it kept you {away} with {n} tile that helps.', 'The {tile} was the right tile: it kept you {away} with {n} tiles that help.', { tile: T(best.kind), away: away(best.shanten) }));
}

/**
 * The safety note under a best-move verdict while folding. When the tile had
 * no specific safety reason, say it was the best balance rather than echo
 * "not a sure safe tile", which reads as if the move were a mistake.
 */
export function foldPraiseSafety(kind: number, d: TileDanger): string {
  if (d.reason === 'none') return tr("The {tile} wasn't a sure safe tile, but it was the best balance of speed and safety.", { tile: T(kind) });
  return safetySentence(kind, d, true);
}

/** Why the discarded tile was worth keeping for the hand's score. */
function valueReason(game: MahjongGame, seat: number, kind: number): string {
  const counts = game.players[seat].hand.filter((t) => t.kind === kind).length;
  const p = { tile: T(kind) };
  if (game.doraKinds().includes(kind)) return tr('the {tile} is a dora, a bonus tile that adds to your score.', p);
  if (counts >= 2 && isValueHonor(game, seat, kind)) return tr('your pair of {tile}s could become a scoring set.', p);
  const suit = (k: number) => (k < 27 ? Math.floor(k / 9) : -1);
  const mine = game.players[seat].hand.map((t) => suit(t.kind)).filter((x) => x >= 0);
  const main = [0, 1, 2].sort((a, b) => mine.filter((x) => x === b).length - mine.filter((x) => x === a).length)[0];
  if (suit(kind) === main) return tr('the {tile} fit the one-suit hand you were building.', p);
  return tr('the {tile} helped your hand score more.', p);
}

function critique(game: MahjongGame, seat: number, plan: DiscardPlan, best: Candidate, chosen: Candidate, verdict: Verdict): string {
  const tile = T(chosen.kind);
  const why = (reason: string) => sentences(lead(verdict === 'good', chosen.kind, best.kind), reason);
  // Danger first when it was the deciding factor.
  if (plan.mode === 'fold' || chosen.loss - best.loss >= 0.04) {
    const i = keyOpponent(plan, chosen, best);
    if (i >= 0) {
      const read = plan.danger.reads[i];
      const dBest = plan.danger.detail[best.kind][i];
      const dChosen = plan.danger.detail[chosen.kind][i];
      // A "good" verdict is praise: name the safer tile without calling the choice risky.
      if (verdict === 'good') return sentences(threatSentence(game, read, true), tr('Fine choice, though the {best} was a touch safer.', { best: T(best.kind) }));
      const risky = dChosen.hit >= 0.06 ? tr('The {tile} was risky against them.', { tile }) : tr("The {tile} wasn't a sure safe tile.", { tile });
      const speed = plan.mode === 'fold' ? tr('You were {away}, so playing safe mattered more than speed.', { away: away(best.shanten) }) : '';
      const safer = dBest.reason === 'none' ? tr('The {best} was the safer choice.', { best: T(best.kind) }) : safetySentence(best.kind, dBest, true);
      return sentences(threatSentence(game, read, true), risky, safer, speed);
    }
  }
  if (best.shanten < chosen.shanten) {
    if (best.shanten === 0) return why(tr('it left you {wait}, while the {tile} left you {after}.', { wait: waitText(game, best), tile, after: away(chosen.shanten) }));
    return why(tr('it kept you {away}, while the {tile} left you {after}.', { away: away(best.shanten), tile, after: away(chosen.shanten) }));
  }
  if (best.shanten === 0 && chosen.shanten === 0) {
    if (chosen.furiten && !best.furiten) return why(tr("without the {tile} you'd have been waiting on a tile you had already discarded, so you could only win by self-draw.", { tile }));
    if (best.ukeire > chosen.ukeire) return why(tr("you'd have been waiting on {a} live tiles instead of {b}.", { a: best.ukeire, b: chosen.ukeire }));
    if (best.value > chosen.value * 1.15) return why(tr('the same kind of wait, but the hand would have scored more.'));
  }
  if (best.ukeire > chosen.ukeire) return why(trn(best.ukeire, 'both kept you {away}, but it left {n} tile that helps against {m}.', 'both kept you {away}, but it left {n} tiles that help against {m}.', { away: away(best.shanten), m: chosen.ukeire }));
  if (best.value > chosen.value * 1.15) return why(valueReason(game, seat, chosen.kind));
  if (best.shapeBonus > chosen.shapeBonus) return why(tr('it was a loose tile, while the {tile} still had partners in your hand.', { tile }));
  return why(tr('it kept the hand a little more flexible.'));
}

function reviewAmericanDiscard(game: MahjongGame, seat: number, chosenKind: number): DecisionReview {
  const ranked = americanPlan(game, seat, 0.3, true);
  const best = ranked[0];
  const norm = (k: number) => (isFlower(k) ? FLOWER_BASE : k);
  const chosen = ranked.find((r) => norm(r.tile.kind) === norm(chosenKind));
  const bestKind = best.tile.kind;
  if (norm(bestKind) === norm(chosenKind)) {
    return { verdict: 'best', bestKind, chosenKind, ...praised(tr('Nice.'), tr("The {tile} didn't fit your closest card hands, and it kept you {away}.", { tile: T(bestKind), away: cardAway(best.missing) })), weight: 0.05 };
  }
  if (isJoker(chosenKind)) {
    return { verdict: 'blunder', bestKind, chosenKind, explanation: tr('You threw away a joker. Jokers can stand in for any tile in a set of three or more, so the {best} was the one to let go.', { best: T(bestKind) }), weight: 0.95 };
  }
  const missChosen = chosen?.missing ?? cardDistance(game.players[seat].hand.filter((t) => t.kind !== chosenKind), game.players[seat].melds);
  const gap = missChosen - best.missing;
  let verdict: Verdict = gap <= 0 ? 'good' : gap === 1 ? 'mistake' : 'blunder';
  if (gap <= 0 && chosen && chosen.keep - best.keep > 6) verdict = 'inaccuracy';
  const exposed = exposureDanger(game, seat)(norm(chosenKind)) > 0;
  const tile = T(chosenKind);
  const why =
    gap > 0
      ? tr('it kept you {away}, while the {tile} left you {after}.', { away: cardAway(best.missing), tile, after: cardAway(missChosen) })
      : exposed
        ? tr('both left you {away}, but the {tile} matched a set another player has exposed, so it could have handed them Mah Jongg.', { away: cardAway(best.missing), tile })
        : tr('both left you {away}, but your nearest card hands use the {tile} more.', { away: cardAway(best.missing), tile });
  const close = best.missing <= 2 ? 0.15 : 0;
  return { verdict, bestKind, chosenKind, explanation: sentences(lead(verdict === 'good', chosenKind, bestKind), why), weight: clamp01(BASE_WEIGHT[verdict] * 0.8 + close) };
}

// ------------------------------------------------------------------ claims

const sameClaim = (a: ClaimResponse, b: ClaimResponse) => a.type === b.type && (a.type !== 'chow' || (a as ClaimOption).using?.join() === (b as ClaimOption).using?.join());

type Out = (verdict: Verdict, text: string | { opener: string; explanation: string }, extra?: number, tag?: DecisionReview['tag']) => DecisionReview;

export function reviewClaim(game: MahjongGame, seat: number, chosen: ClaimResponse, options: ClaimOption[], kind: number): DecisionReview {
  const names = game.profile.callNames;
  const verb = (t: ClaimResponse['type']) => callWord(t === 'chow' ? names.chow : t === 'kong' ? names.kong : t === 'pung' ? names.pung : t === 'win' ? names.win : 'pass');
  const out: Out = (verdict, text, extra = 0, tag) => ({ verdict, bestKind: null, chosenKind: null, ...(typeof text === 'string' ? { explanation: text } : text), weight: clamp01(BASE_WEIGHT[verdict] + extra), ...(tag ? { tag } : {}) });
  const tile = T(kind);

  const win = options.find((o) => o.type === 'win');
  if (win) {
    if (chosen.type === 'win') return out('best', tr('Well spotted: the {tile} completed your hand.', { tile }), 0.3);
    return out('blunder', game.profile.furiten ? tr('You passed on a winning tile! The {tile} completed your hand, and passing it also stops you winning on a discard until your next turn.', { tile }) : tr('You passed on a winning tile! The {tile} completed your hand.', { tile }), 0.05, 'missedWin');
  }
  if (game.profile.card) return reviewAmericanClaim(game, seat, chosen, options, kind, out);

  const plan = planClaim(game, seat, options, kind, ADVISOR_CLAIMS);
  const best = plan.best;
  if (sameClaim(best, chosen)) {
    if (chosen.type === 'pass') {
      const why =
        plan.reason === 'noYaku'
          ? tr('Passing on the {tile} was right: calling would have left your hand open with no yaku, so it could never win.', { tile })
          : plan.reason === 'noValue'
            ? tr("Passing on the {tile} was right: an open hand couldn't have reached the {n} needed to win.", { tile, n: game.profile.minValue })
            : plan.reason === 'defend'
              ? tr('Passing on the {tile} was right: someone looked ready, and keeping safe tiles mattered more than speed.', { tile })
              : plan.reason === 'staysClosed'
                ? tr('Passing on the {tile} was right: your concealed hand was worth more than the small speed-up.', { tile })
                : tr("Passing on the {tile} was right: it wouldn't have brought you closer to winning.", { tile });
      return out('best', praised(tr('Good patience.'), why));
    }
    const call = verb(chosen.type);
    return out('best', praised(tr('Good call.'), plan.after < plan.before ? tr('{call} on the {tile} took you from {before} to {after}.', { call, tile, before: away(plan.before), after: away(plan.after) }) : tr('{call} on the {tile} added value to your hand.', { call, tile })), 0.05);
  }

  if (best.type === 'pass') {
    // Called when JongBot would have passed.
    if (plan.reason === 'noYaku') return out('blunder', tr("Calling the {tile} left your hand open with no yaku, so it can't win. Passing and staying concealed was the way.", { tile }));
    if (plan.reason === 'noValue') return out('mistake', tr("Calling the {tile} opened a hand that can't reach the minimum score to win. Passing was better.", { tile }));
    const after = chosen.type === 'kong' ? plan.before : shantenAfterCall(game, seat, (chosen as ClaimOption).using ?? [kind, kind], kind);
    if (plan.reason === 'defend') return out('inaccuracy', tr('Someone looked ready, and you were {away}. Calling the {tile} used up tiles you could have discarded safely.', { away: away(plan.before), tile }), 0.1);
    if (after > plan.before) return out('mistake', tr('Calling the {tile} set your hand back to {after}. Passing kept you {before}.', { tile, after: away(after), before: away(plan.before) }));
    const closed = game.isConcealed(seat);
    if (after < plan.before) return out('inaccuracy', closed ? tr('Calling the {tile} sped you up a little, but your hand was worth more concealed.', { tile }) : tr('Calling the {tile} sped you up a little, but your hand was better off waiting for a stronger call.', { tile }));
    return out('inaccuracy', closed ? tr("Calling the {tile} didn't speed you up, and your hand was worth more concealed.", { tile }) : tr("Calling the {tile} didn't speed you up, and your hand was better off waiting for a stronger call.", { tile }));
  }
  // JongBot would have called.
  const bestVerb = verb(best.type);
  const reason =
    plan.reason === 'value'
      ? plan.after < plan.before
        ? tr('the set would have scored and moved you to {after}.', { after: away(plan.after) })
        : tr('the set would have scored and kept you {after}.', { after: away(plan.after) })
      : tr('it would have moved you from {before} to {after}.', { before: away(plan.before), after: away(plan.after) });
  if (chosen.type === 'pass') return out(plan.reason === 'value' && plan.after < plan.before ? 'mistake' : 'inaccuracy', sentences(tr('You passed on the {tile}. {call} was better:', { tile, call: bestVerb }), reason), 0, 'passed');
  return out('inaccuracy', sentences(tr('{call} worked, but {best} with the {tile} was better:', { call: verb(chosen.type), best: bestVerb, tile }), reason));
}

function reviewAmericanClaim(game: MahjongGame, seat: number, chosen: ClaimResponse, options: ClaimOption[], kind: number, out: Out): DecisionReview {
  const pl = game.players[seat];
  const now = cardDistance(pl.hand, pl.melds);
  let best: { o: ClaimOption; after: number } | null = null;
  for (const o of options) {
    if (o.type !== 'pung' && o.type !== 'kong') continue;
    const after = missingAfterCall(game, seat, kind, o.type === 'kong' ? 4 : 3);
    if (!best || after < best.after) best = { o, after };
  }
  const tile = T(kind);
  const shouldCall = best && best.after < now;
  if (chosen.type === 'pass') {
    if (!shouldCall) return out('best', praised(tr('Good patience.'), tr("The {tile} didn't bring your nearest card hand closer.", { tile })));
    return out('inaccuracy', tr('You passed on the {tile}. Calling it would have left you {after} instead of {before}.', { tile, after: cardAway(best!.after), before: cardAway(now) }), 0, 'passed');
  }
  const after = chosen.type === 'pung' || chosen.type === 'kong' ? missingAfterCall(game, seat, kind, chosen.type === 'kong' ? 4 : 3) : Infinity;
  if (!shouldCall) {
    if (!Number.isFinite(after)) return out('blunder', tr('Calling the {tile} left no hand on the card that fits your exposures.', { tile }));
    return out(after > now ? 'mistake' : 'inaccuracy', tr("Calling the {tile} didn't bring you closer: you stayed {away}. Exposures also give others jokers to swap for.", { tile, away: cardAway(after) }));
  }
  if (after <= best!.after) return out('best', praised(tr('Good call.'), tr('The {tile} fits a hand on the card and leaves you {away}.', { tile, away: cardAway(after) })), 0.05);
  return out('inaccuracy', tr('Calling worked, but a different exposure would have left you {away}.', { away: cardAway(best!.after) }));
}
