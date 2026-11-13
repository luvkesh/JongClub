// India Rules, East round: the after-hand passport review. Walks one finished
// hand again and, at each of your discards, measures how far the hand was from
// every passport hand (indiaPassport.ts). From that it tells which passport you
// came closest to, the turn you left it behind, and the discard where another
// tile would have got you there faster. Shown on the hand summary
// (ui/passportReview.ts).

import type { MahjongGame } from '../engine/game';
import { passportMissing, passportNamedMissing, passportPlans, type PassportPlan } from '../engine/rules/indiaPassport';
import type { ReplayRecord } from '../net/replay';
import { walkMatch } from './matchWalk';

/** One of your discards, measured against every other tile you could have thrown. */
export interface PassportTurn {
  /** Your discard number this hand, from 1. */
  turn: number;
  /** The tile you threw. */
  tile: number;
  /** Tiles from ready after your discard (0 = ready), and the nearest passport then. */
  after: number;
  plan: PassportPlan | null;
  /** The best discard was worth: fewest tiles from ready over every tile you held, with its tile and passport. */
  best: number;
  bestTile: number;
  bestPlan: PassportPlan | null;
  /** Tiles from ready for the passport you were closest to overall, after this discard (99 = shut). */
  tracked?: number;
}

export interface PassportReview {
  /** Your discards this hand, in order. */
  turns: PassportTurn[];
  /** The passport hand you came closest to: its names, and the turn and distance where you were nearest. */
  closest: { names: string[]; sets: number; pair: boolean; turn: number; fromReady: number } | null;
  /** The discard that let that passport slip: the turn, the tile, and where it left you against where you were. */
  leftBehind: { turn: number; tile: number; before: number; after: number; better: number; betterAfter: number } | null;
  /** The discard where a different tile would have got you there faster (the biggest gap, taken once). */
  slip: { turn: number; tile: number; after: number; better: number; betterAfter: number; names: string[] } | null;
  /** You won the hand with a passport. */
  won: boolean;
}


/** Tiles from ready: a 13-tile hand with `missing` tiles to go is missing - 1 from ready (99 = shut out). */
const fromReady = (missing: number) => (missing >= 99 ? 99 : Math.max(0, missing - 1));

type Melds = ReturnType<MahjongGame['meldShapes']>;

/**
 * Measure one position: how far from ready every tile you could discard would leave you, by the
 * nearest passport, and, when
 * `track` names a passport, how far that passport would be after each.
 */
function measure(counts: number[], melds: Melds, track: string): Map<number, { after: number; tracked: number }> {
  const out = new Map<number, { after: number; tracked: number }>();
  for (let k = 0; k < 34; k++) {
    if (counts[k] <= 0) continue;
    const c = counts.slice();
    c[k]--;
    // A fresh search each time: the meter's reuse across nearby hands is a bound the bots live with, but a review should not misjudge a tile by it.
    out.set(k, { after: fromReady(passportMissing(c, melds)), tracked: track ? fromReady(passportNamedMissing(track, c, melds)) : 99 });
  }
  return out;
}

/** The nearest passport plan after discarding `k`. */
function planAfter(counts: number[], melds: Melds, k: number): PassportPlan | null {
  const c = counts.slice();
  if (c[k] > 0) c[k]--;
  return passportPlans(c, melds, 1, 0)[0] ?? null;
}

/**
 * Review `me`'s discards in one finished hand. `rec` holds that hand alone (hands[0]), with `start`
 * set so the walk begins at the right round and scores. A generator, so the summary can spread the
 * work over frames (matchWalk.runSliced); null when there is nothing to review.
 */
export function* passportReviewScan(rec: ReplayRecord, me: number): Generator<void, PassportReview | null, void> {
  if (me < 0 || !rec.hands.length) return null;
  const turns: PassportTurn[] = [];
  const positions: { counts: number[]; melds: Melds; tile: number }[] = [];
  let won = false;
  for (const ev of walkMatch(rec)) {
    if (ev.type === 'action' && ev.action.s === me && ev.action.t === 'd') {
      const g = ev.game;
      const t = g.players[me].hand.find((x) => x.id === (ev.action as { id: number }).id);
      if (!t || t.kind >= 34) continue;
      positions.push({ counts: g.concealedCounts(me), melds: g.meldShapes(me), tile: t.kind });
      yield;
    }
    if (ev.type === 'end') {
      const r = ev.result;
      won = !!r && r.type === 'win' && r.winner === me && !!ev.game.profile.passportView?.(r.revealedHand ?? ev.game.players[me].hand, r.revealedMelds ?? ev.game.players[me].melds)?.passports?.length;
    }
  }
  if (!positions.length) return null;
  // First pass: the nearest passport after each discard, and the best tile each time.
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    const m = measure(p.counts, p.melds, '');
    const mine = m.get(p.tile) ?? { after: 99, tracked: 99 };
    let best = mine.after;
    let bestTile = p.tile;
    for (const [k, v] of m) {
      if (v.after < best) {
        best = v.after;
        bestTile = k;
      }
    }
    const plan = mine.after < 99 ? planAfter(p.counts, p.melds, p.tile) : null;
    const bestPlan = bestTile === p.tile ? plan : best < 99 ? planAfter(p.counts, p.melds, bestTile) : null;
    turns.push({ turn: i + 1, tile: p.tile, after: mine.after, plan, best, bestTile, bestPlan });
    yield;
  }
  // The passport you came closest to: the nearest point, earliest when tied, taken from where your own discard left you.
  let closestTurn = -1;
  for (const t of turns) if (t.plan && t.after < 99 && (closestTurn < 0 || t.after < turns[closestTurn].after)) closestTurn = turns.indexOf(t);
  const closest = closestTurn >= 0 ? { names: turns[closestTurn].plan!.names, sets: turns[closestTurn].plan!.sets, pair: turns[closestTurn].plan!.pair, turn: closestTurn + 1, fromReady: turns[closestTurn].after } : null;
  // Second pass, after the closest point: track that passport and find the discard that let it slip.
  let leftBehind: PassportReview['leftBehind'] = null;
  if (closest && !won) {
    const key = closest.names.join('+');
    let before = closest.fromReady;
    for (let i = closestTurn + 1; i < positions.length; i++) {
      const p = positions[i];
      const m = measure(p.counts, p.melds, key);
      const mine = m.get(p.tile);
      if (!mine) continue;
      turns[i].tracked = mine.tracked;
      if (mine.tracked > before) {
        let better = p.tile;
        let betterAfter = mine.tracked;
        for (const [k, v] of m) if (v.tracked < betterAfter) (better = k), (betterAfter = v.tracked);
        if (betterAfter < mine.tracked) {
          leftBehind = { turn: i + 1, tile: p.tile, before, after: mine.tracked, better, betterAfter };
          break;
        }
      }
      before = Math.min(before, mine.tracked);
      yield;
    }
  }
  // The biggest slip against the nearest passport of the moment (not the same turn as leftBehind).
  let slip: PassportReview['slip'] = null;
  for (const t of turns) {
    const gain = t.after - t.best;
    if (gain <= 0 || t.turn === leftBehind?.turn || !t.bestPlan) continue;
    if (!slip || gain > slip.after - slip.betterAfter) slip = { turn: t.turn, tile: t.tile, after: t.after, better: t.bestTile, betterAfter: t.best, names: t.bestPlan.names };
  }
  return { turns, closest, leftBehind, slip, won };
}
