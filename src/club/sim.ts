// Headless match simulation: four AI seats play a full match with the same
// sequencing as ui/match.ts (Charleston, joker swaps, kongs, claims) but no
// timers, rendering or randomness beyond the seed. Used by tournaments for
// tables the human is not sitting at.

import { AiPlayer, type Difficulty, type Personality } from '../ai/players';
import { MahjongGame } from '../engine/game';
import { Rng } from '../engine/rng';
import { roundProfileFor, type GameLength } from '../engine/rounds';
import { getProfile, withHouseRules } from '../engine/rules';
import { classicProfile } from '../engine/rules/classic';
import type { RuleProfile } from '../engine/rules/types';
import type { HandResult } from '../engine/state';
import { applyAction, decisionAction } from '../net/actions';

export interface SimConfig {
  variation: string;
  length: GameLength;
  houseRules?: Record<string, string>;
  /** One per seat (4). */
  difficulties: Difficulty[];
  /** One per seat (4). */
  personalities: Personality[];
  /** One per seat (4). */
  names: string[];
  seed: number;
}

export interface SimStanding {
  seat: number;
  name: string;
  score: number;
}

export interface SimResult {
  /** Best score first; ties keep seat order. */
  standings: SimStanding[];
  hands: number;
  handResults: HandResult[];
  /** Riichi deposits still on the table when the match ended (0 elsewhere). */
  leftoverPot: number;
  /** True if a safety cap stopped a hand or the match early. */
  capped: boolean;
}

/** Most engine actions a single hand may take before it is called a draw. */
const MAX_STEPS_PER_HAND = 2000;
/** Most hands in one match (Full NEWS with long dealer runs stays well under). */
const MAX_HANDS = 64;

export function buildProfile(variation: string, length: GameLength, houseRules: Record<string, string> = {}): RuleProfile {
  const rp = withHouseRules(getProfile(variation) ?? classicProfile, houseRules);
  rp.rounds = roundProfileFor(length, rp.rounds);
  return rp;
}

/**
 * Play one hand to completion with AI players in every seat. The game must
 * have had startHand() called. Returns false if the step cap was hit.
 */
export function playHandHeadless(game: MahjongGame, ais: AiPlayer[], maxSteps = MAX_STEPS_PER_HAND): boolean {
  for (let step = 0; step < maxSteps; step++) {
    const ph = game.state.phase;
    if (ph.kind === 'handOver') return true;
    if (ph.kind === 'charleston') {
      // Everyone picks from the same pre-pass hands, as in match.ts.
      const picks = ais.map((ai) => ai.charlestonPass(game).map((t) => t.id));
      picks.forEach((ids, s) => game.charlestonPass(s, ids));
    } else if (ph.kind === 'exchangeChoice') {
      const c = ais[ph.seat].exchangeChoice(game);
      game.chooseExchanges(ph.seat, c.passes, c.wall);
    } else if (ph.kind === 'cardPick') {
      ais.forEach((ai, s) => game.pickCard(s, ai.cardPick(game)));
    } else if (ph.kind === 'roundChoice') {
      game.chooseRound(ph.seat, ais[ph.seat].roundChoice(game));
    } else if (ph.kind === 'ticTacToe') {
      const picks = ais.map((ai) => ai.ticTacToePick(game).map((t) => t.id));
      picks.forEach((ids, s) => game.ticTacToe(s, ids));
    } else if (ph.kind === 'wallExchange') {
      const picks = ais.map((ai) => ai.wallExchangePick(game).map((t) => t.id));
      picks.forEach((ids, s) => game.wallExchange(s, ids));
    } else if (ph.kind === 'charlestonVote') {
      ais.forEach((ai, s) => {
        if (game.state.phase.kind === 'charlestonVote') game.charlestonVote(s, ai.charlestonVote(game));
      });
    } else if (ph.kind === 'turn') {
      const seat = ph.seat;
      const d = ais[seat].decideTurn(game);
      applyAction(game, decisionAction(seat, d));
    } else if (ph.kind === 'claims') {
      for (const s of game.pendingClaimSeats()) {
        const cur = game.state.phase;
        if (cur.kind !== 'claims') break;
        game.respond(s, ais[s].decideClaim(game, cur.options[s], cur.tile.kind));
      }
    }
  }
  return game.state.phase.kind === 'handOver';
}

export function simulateMatch(cfg: SimConfig): SimResult {
  const rp = buildProfile(cfg.variation, cfg.length, cfg.houseRules);
  const n = rp.players;
  const rng = new Rng(cfg.seed);
  const names = Array.from({ length: n }, (_, i) => cfg.names[i] ?? `Player ${i + 1}`);
  const game = new MahjongGame(rp, names, cfg.seed);
  const ais = Array.from(
    { length: n },
    (_, s) => new AiPlayer(s, cfg.difficulties[s] ?? 'casual', cfg.personalities[s] ?? 'zen', (cfg.seed + s * 101) >>> 0),
  );
  const handResults: HandResult[] = [];
  let capped = false;
  for (let h = 0; h < MAX_HANDS; h++) {
    game.startHand(Math.floor(rng.next() * 2 ** 31));
    if (!playHandHeadless(game, ais)) {
      capped = true;
      break;
    }
    const ph = game.state.phase;
    if (ph.kind !== 'handOver') break;
    handResults.push(ph.result);
    if (game.advance()) break;
    if (h === MAX_HANDS - 1) capped = true;
  }
  const standings = game.players
    .map((p) => ({ seat: p.seat, name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score || a.seat - b.seat);
  return { standings, hands: handResults.length, handResults, leftoverPot: game.state.riichiPot, capped };
}
