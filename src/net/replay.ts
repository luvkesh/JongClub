// Saved games. A replay is the table config, the match seed, the names and
// every action in order; the viewer rebuilds each position by re-running
// the deterministic engine, so nothing about the board needs storing.

import { MahjongGame } from '../engine/game';
import { roundProfileFor, type RoundState } from '../engine/rounds';
import { getProfile, withHouseRules } from '../engine/rules';
import { classicProfile } from '../engine/rules/classic';
import type { GameEvent, GameState } from '../engine/state';
import type { TableConfig } from '../ui/match';
import { applyAction, handSeed, type Action } from './actions';

export interface ReplayRecord {
  id: string;
  date: string;
  config: TableConfig;
  names: string[];
  /** The seat that was you (spectated games: -1). */
  me: number;
  matchSeed: number;
  hands: Action[][];
  /** Set when the record starts mid-match (a spectator who arrived late): hands[0] is hand `start.hand`. */
  start?: { hand: number } & ResumePoint;
  finalScores: number[];
  placement: number;
  mode: string;
}

/** The table at the start of a hand, enough to pick up a match there (late spectators). */
export interface ResumePoint {
  round: RoundState;
  scores: number[];
  pot: number;
  /** American goulash: this hand follows a wall game, so jokers may be passed. */
  goulash?: boolean | 1;
}

/** Put a fresh game at a resume point, before startHand for that hand. */
export function resumeAt(game: MahjongGame, at: ResumePoint) {
  game.state.round = structuredClone(at.round);
  game.players.forEach((p, i) => (p.score = at.scores[i] ?? p.score));
  game.state.riichiPot = at.pot;
  if (at.goulash) game.state.goulash = true;
  else delete game.state.goulash;
}

const KEY = 'jongclub.replays.v1';
const MAX = 25;

export function loadReplays(): ReplayRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const all: unknown = JSON.parse(raw);
      return Array.isArray(all) ? (all as ReplayRecord[]) : [];
    }
  } catch {
    /* none */
  }
  return [];
}

/** After a guest signs in: their saved games show the account's name in their own seat. */
export function renameMe(from: string, to: string) {
  const all = loadReplays();
  let changed = false;
  for (const r of all) if (r.me >= 0 && r.names[r.me] === from) (r.names[r.me] = to), (changed = true);
  if (changed) {
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      /* keep the old names */
    }
  }
}

export function saveReplay(r: ReplayRecord) {
  const all = [r, ...loadReplays().filter((x) => x.id !== r.id)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage full: keep fewer.
    try {
      localStorage.setItem(KEY, JSON.stringify(all.slice(0, 8)));
    } catch {
      /* give up quietly */
    }
  }
}

export function profileFor(config: TableConfig) {
  const rp = withHouseRules(getProfile(config.variation) ?? classicProfile, config.houseRules);
  rp.rounds = roundProfileFor(config.length, rp.rounds);
  return rp;
}

/** One step of a replay: the position after `action` (or the deal, when action is null). */
export interface ReplayStep {
  hand: number;
  index: number;
  action: Action | null;
  /** The position BEFORE this action, for reviewing the decision. */
  before: GameState | null;
  state: GameState;
  events: GameEvent[];
}

/** Rebuild one hand of a replay, step by step. */
export function replayHand(rec: ReplayRecord, hand: number): { steps: ReplayStep[]; game: MahjongGame } {
  const game = new MahjongGame(profileFor(rec.config), rec.names, rec.matchSeed);
  let events: GameEvent[] = [];
  game.on((e) => events.push(e));
  const first = rec.start?.hand ?? 0;
  if (rec.start) resumeAt(game, rec.start);
  for (let n = 0; n < hand; n++) {
    game.startHand(handSeed(rec.matchSeed, first + n));
    for (const a of rec.hands[n] ?? []) applyAction(game, a);
    game.advance();
  }
  events = [];
  game.startHand(handSeed(rec.matchSeed, first + hand));
  const steps: ReplayStep[] = [{ hand, index: 0, action: null, before: null, state: structuredClone(game.state), events }];
  (rec.hands[hand] ?? []).forEach((a, i) => {
    const before = structuredClone(game.state);
    events = [];
    applyAction(game, a);
    steps.push({ hand, index: i + 1, action: a, before, state: structuredClone(game.state), events });
  });
  return { steps, game };
}

/** A game positioned at `before` so analysis functions can be run on it. */
export function gameAt(rec: ReplayRecord, state: GameState) {
  const g = new MahjongGame(profileFor(rec.config), rec.names, rec.matchSeed);
  g.state = structuredClone(state);
  return g;
}
