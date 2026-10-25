// Three key moments from a finished match, for the results screen: the
// discard that cost the most, a win or claim you missed (or a dangerous
// deal-in), and one thing you did well. Built on the game review that powers
// the replay viewer (review.ts), so the words match what Review Game says.

import { tileLabel } from '../i18n/tiles';
import type { ReplayRecord } from '../net/replay';
import { readOpponent, threatSentence } from './danger';
import { runAll, snapshot, walkMatch } from './matchWalk';
import { reviewClaim, reviewDiscard, type DecisionReview, type Verdict } from './review';
import { tr } from '../i18n';

export type MomentKind = 'costly' | 'missedWin' | 'missedClaim' | 'dealIn' | 'good';

export interface KeyMoment {
  kind: MomentKind;
  /** Card heading, e.g. "The discard that cost the most". */
  title: string;
  /** One or two plain sentences. */
  line: string;
  verdict: Verdict;
  /** Hand (0-based) and replay step that shows the moment. */
  hand: number;
  step: number;
  /** The tile at the heart of it, when there is one. */
  tile?: number;
  /** JongBot's better tile, for discards. */
  better?: number;
}

const BAD: Verdict[] = ['inaccuracy', 'mistake', 'blunder'];

interface Seen {
  hand: number;
  step: number;
  review: DecisionReview;
  tile?: number;
}

/** Keep only the first two sentences, so a card stays short. */
export function shortLine(text: string, max = 2): string {
  let parts: string[] | null = text.match(/[^.!?]+[.!?]+["”’)]*\s*/g);
  if (!parts) return text.trim();
  // "Nice." or "Well judged." on its own adds nothing on a card.
  if (parts.length > 1 && parts[0].trim().split(/\s+/).length <= 2) parts = parts.slice(1);
  if (parts.length <= max) return parts.join('').trim();
  return parts.slice(0, max).join('').trim();
}

/**
 * Review every decision you made and pick the moments. A generator, so the
 * caller can spread the work over frames (runSliced); null when you weren't
 * playing or the variation can't be reviewed.
 */
export function* keyMomentScan(rec: ReplayRecord): Generator<void, KeyMoment[] | null, void> {
  const me = rec.me;
  if (me < 0 || !rec.hands.length) return null;
  const discards: Seen[] = [];
  const claims: Seen[] = [];
  const dealIns: { hand: number; step: number; tile: number; winner: number; points: number; threat: string }[] = [];
  /** Your latest discard this hand, with how each opponent looked when it went out. */
  let lastMine: { step: number; tile: number; threats: string[] } | null = null;
  let reviewed = 0;
  let failed = 0;
  for (const ev of walkMatch(rec)) {
    if (ev.type === 'start') lastMine = null;
    if (ev.type === 'action' && ev.action.s === me) {
      const a = ev.action;
      const g = ev.game;
      const step = ev.index + 1;
      try {
        if (a.t === 'd') {
          const tile = g.players[me].hand.find((t) => t.id === a.id)?.kind;
          const copy = snapshot(g);
          discards.push({ hand: ev.hand, step, review: reviewDiscard(copy, me, a.id), tile });
          // How each opponent looked when it went out, for a deal-in card.
          const threats = g.players.map((_, s) => {
            if (s === me || g.profile.card) return '';
            const r = readOpponent(g, s);
            return r.tenpai >= 0.35 ? threatSentence(g, r, true) : '';
          });
          if (tile !== undefined) lastMine = { step, tile, threats };
          reviewed++;
        } else if (a.t === 'c' && g.state.phase.kind === 'claims') {
          const opts = g.state.phase.options[me] ?? [];
          if (opts.length) {
            claims.push({ hand: ev.hand, step, review: reviewClaim(snapshot(g), me, a.r, opts, g.state.phase.tile.kind), tile: g.state.phase.tile.kind });
            reviewed++;
          }
        }
      } catch {
        failed++;
      }
      yield;
    }
    if (ev.type === 'end' && ev.result?.type === 'win' && ev.result.discarder === me && ev.result.winner !== undefined && ev.result.winner !== me && lastMine) {
      dealIns.push({ hand: ev.hand, step: lastMine.step, tile: ev.result.winTile?.kind ?? lastMine.tile, winner: ev.result.winner, points: ev.result.score?.points ?? 0, threat: lastMine.threats[ev.result.winner] ?? '' });
    }
  }
  if (!reviewed || failed > reviewed) return null;
  const out: KeyMoment[] = [];

  // 1. The discard that cost the most.
  const costly = discards.filter((d) => BAD.includes(d.review.verdict)).sort((a, b) => b.review.weight - a.review.weight)[0];
  if (costly) {
    out.push({ kind: 'costly', title: tr('The discard that cost the most'), line: shortLine(costly.review.explanation), verdict: costly.review.verdict, hand: costly.hand, step: costly.step, tile: costly.tile, better: costly.review.bestKind ?? undefined });
  }

  // 2. A win you passed, else a deal-in, else a claim you let go.
  const missedWin = claims.find((c) => c.review.verdict === 'blunder' && /winning tile/.test(c.review.explanation));
  const dealIn = dealIns.sort((a, b) => b.points - a.points)[0];
  const missedClaim = claims.filter((c) => BAD.includes(c.review.verdict) && /^You passed/.test(c.review.explanation)).sort((a, b) => b.review.weight - a.review.weight)[0];
  if (missedWin) {
    out.push({ kind: 'missedWin', title: tr('A win you let pass'), line: shortLine(missedWin.review.explanation), verdict: 'blunder', hand: missedWin.hand, step: missedWin.step, tile: missedWin.tile });
  } else if (dealIn) {
    const who = rec.names[dealIn.winner] ?? tr('An opponent');
    const why = dealIn.threat ? ` ${dealIn.threat} ${tr('A tile they had already thrown would have been safer.')}` : ` ${tr('{name} didn’t look close yet, so that one was hard to see coming.', { name: who })}`;
    out.push({ kind: 'dealIn', title: dealIn.threat ? tr('A dangerous deal-in') : tr('The tile that was won on'), line: `${tr('{name} won on your {tile}.', { name: who, tile: tileLabel(dealIn.tile) })}${why}`, verdict: dealIn.threat ? 'mistake' : 'inaccuracy', hand: dealIn.hand, step: dealIn.step, tile: dealIn.tile });
  } else if (missedClaim) {
    out.push({ kind: 'missedClaim', title: tr('A call you missed'), line: shortLine(missedClaim.review.explanation), verdict: missedClaim.review.verdict, hand: missedClaim.hand, step: missedClaim.step, tile: missedClaim.tile });
  }

  // 3. One thing you did well: the best move that mattered most.
  const good = [...discards, ...claims].filter((d) => d.review.verdict === 'best' && d.review.weight > 0).sort((a, b) => b.review.weight - a.review.weight || b.hand - a.hand || b.step - a.step)[0];
  if (good) out.push({ kind: 'good', title: tr('Something you did well'), line: shortLine(good.review.explanation), verdict: 'best', hand: good.hand, step: good.step, tile: good.tile });
  return out.length ? out : null;
}

/** All at once (tests and short matches). */
export const keyMoments = (rec: ReplayRecord) => runAll(keyMomentScan(rec));
