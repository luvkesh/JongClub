// Walk a saved match once, hand by hand and action by action, re-running the
// deterministic engine. Analyses (key moments, skill ratings) read the game
// at each step; the walker is a generator so the caller can pause between
// steps and keep the page responsive.

import { MahjongGame } from '../engine/game';
import type { GameEvent, HandResult } from '../engine/state';
import { applyAction, handSeed, type Action } from '../net/actions';
import { profileFor, resumeAt, type ReplayRecord } from '../net/replay';

export type WalkEvent =
  | { type: 'start'; hand: number; game: MahjongGame }
  /** Before `action` is applied: `game` is the position the decision was made in. Do not change it. */
  | { type: 'action'; hand: number; index: number; action: Action; game: MahjongGame }
  /** Just after `action` was applied, with what it caused. */
  | { type: 'applied'; hand: number; index: number; action: Action; game: MahjongGame; events: GameEvent[] }
  | { type: 'end'; hand: number; game: MahjongGame; result: HandResult | null };

/**
 * Every hand and action of a replay in order. `index` is the action's place in
 * its hand; the replay viewer shows the position after it at step `index + 1`.
 * A record that no longer replays cleanly stops at the bad action.
 */
export function* walkMatch(rec: ReplayRecord): Generator<WalkEvent, void, void> {
  const game = new MahjongGame(profileFor(rec.config), rec.names, rec.matchSeed);
  let events: GameEvent[] = [];
  game.on((e) => events.push(e));
  const first = rec.start?.hand ?? 0;
  if (rec.start) resumeAt(game, rec.start);
  for (let hand = 0; hand < rec.hands.length; hand++) {
    game.startHand(handSeed(rec.matchSeed, first + hand));
    yield { type: 'start', hand, game };
    const actions = rec.hands[hand] ?? [];
    for (let index = 0; index < actions.length; index++) {
      const action = actions[index];
      yield { type: 'action', hand, index, action, game };
      events = [];
      try {
        applyAction(game, action);
      } catch {
        return;
      }
      yield { type: 'applied', hand, index, action, game, events };
    }
    const ph = game.state.phase;
    yield { type: 'end', hand, game, result: ph.kind === 'handOver' ? ph.result : null };
    if (ph.kind !== 'handOver') return;
    game.advance();
  }
}

/** A copy of the game at its current position, safe to analyse (some analyses build on it). */
export function snapshot(game: MahjongGame): MahjongGame {
  const g = new MahjongGame(game.baseProfile, game.players.map((p) => p.name), game.state.handSeed);
  g.state = structuredClone(game.state);
  return g;
}

/**
 * Run a generator in small slices between frames, so long analyses never
 * freeze the page. Resolves with its result, or null when `alive()` turns false.
 */
export function runSliced<T>(gen: Generator<unknown, T, void>, alive: () => boolean = () => true, sliceMs = 12): Promise<T | null> {
  return new Promise((resolve) => {
    const tick = () => {
      if (!alive()) return resolve(null);
      const end = performance.now() + sliceMs;
      try {
        while (performance.now() < end) {
          const r = gen.next();
          if (r.done) return resolve(r.value);
        }
      } catch {
        return resolve(null);
      }
      setTimeout(tick, 0);
    };
    setTimeout(tick, 0);
  });
}

/** Run a generator to the end at once (tests, small jobs). */
export function runAll<T>(gen: Generator<unknown, T, void>): T {
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
  }
}
