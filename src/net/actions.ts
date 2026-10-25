// Every decision a seat can make, as small plain data. A match is fully
// described by its seed, its table config and the ordered list of actions,
// which is what replays store and what multiplayer tables exchange.

import { MahjongGame } from '../engine/game';
import type { ClaimResponse } from '../engine/state';
import type { AiDecision } from '../ai/players';

export type Action =
  /** Discard a tile (optionally declaring riichi). */
  | { t: 'd'; s: number; id: number; r?: 1 }
  /** Declare a self-drawn win. */
  | { t: 'w'; s: number }
  /** Declare a concealed or added kong of `k`. */
  | { t: 'k'; s: number; k: number }
  /** India Rules Big Cards: lay down a kong, qwong or run (tile ids), or grow your meld `m` into one. */
  | { t: 'g'; s: number; ids: number[]; m?: number }
  /** American: swap a natural tile for a joker in an exposure. */
  | { t: 'j'; s: number; o: number; m: number; id: number }
  /** Respond to a claim window. */
  | { t: 'c'; s: number; r: ClaimResponse }
  /** Charleston pass. */
  | { t: 'cp'; s: number; ids: number[] }
  /** Charleston vote. */
  | { t: 'cv'; s: number; v: 0 | 1 }
  /** Goulash round: East's choice of player and wall exchanges. */
  | { t: 'gx'; s: number; p: 0 | 1 | 3; w: 0 | 1 | 3 }
  /** India Rules Tic-Tac-Toe: one tile each to the right, across and left. */
  | { t: 'tt'; s: number; ids: number[] }
  /** India Rules Small Cards: the card kept of those offered. */
  | { t: 'sc'; s: number; c: number }
  /** India Rules North round: the game East chose (a code from profile.roundChoices). */
  | { t: 'rc'; s: number; c: number }
  /** Goulash round: three tiles swapped with the wall. */
  | { t: 'wx'; s: number; ids: number[] }
  /** Riichi: abandon the hand with nine terminals (kyuushu kyuuhai). */
  | { t: 'a'; s: number }
  /** Sanma: set a North aside (kita). */
  | { t: 'n'; s: number };

export function applyAction(g: MahjongGame, a: Action) {
  switch (a.t) {
    case 'd':
      return g.discard(a.s, a.id, { riichi: !!a.r });
    case 'w':
      return g.declareSelfDrawWin(a.s);
    case 'k':
      return g.declareKong(a.s, a.k);
    case 'g':
      return g.declareGroup(a.s, a.ids, a.m);
    case 'j':
      return g.exchangeJoker(a.s, { owner: a.o, meld: a.m, tileId: a.id });
    case 'c':
      return g.respond(a.s, a.r);
    case 'cp':
      return g.charlestonPass(a.s, a.ids);
    case 'cv':
      return g.charlestonVote(a.s, !!a.v);
    case 'gx':
      return g.chooseExchanges(a.s, a.p, a.w);
    case 'wx':
      return g.wallExchange(a.s, a.ids);
    case 'tt':
      return g.ticTacToe(a.s, a.ids);
    case 'sc':
      return g.pickCard(a.s, a.c);
    case 'rc':
      return g.chooseRound(a.s, a.c);
    case 'a':
      return g.declareNineTerminals(a.s);
    case 'n':
      return g.declareKita(a.s);
  }
}

/** The action for an AI player's turn decision. */
export function decisionAction(seat: number, d: AiDecision): Action {
  switch (d.action) {
    case 'win':
      return { t: 'w', s: seat };
    case 'kong':
      return { t: 'k', s: seat, k: d.kind! };
    case 'group':
      return { t: 'g', s: seat, ids: d.group!.ids, m: d.group!.extend };
    case 'swap':
      return { t: 'j', s: seat, o: d.swap!.owner, m: d.swap!.meld, id: d.swap!.tileId };
    case 'abort':
      return { t: 'a', s: seat };
    case 'kita':
      return { t: 'n', s: seat };
    default:
      return d.riichi ? { t: 'd', s: seat, id: d.tileId!, r: 1 } : { t: 'd', s: seat, id: d.tileId! };
  }
}

/**
 * Would `a` be accepted in this position? Tries it on a copy, so the game is
 * untouched. Use it before committing a decision that came over the network:
 * a stale or malformed action must not throw inside the table loop.
 */
export function isLegalAction(g: MahjongGame, a: Action): boolean {
  if (!a || typeof a !== 'object' || !(a.s >= 0 && a.s < g.profile.players)) return false;
  const copy = new MahjongGame(g.baseProfile, g.players.map((p) => p.name), g.state.handSeed);
  copy.state = structuredClone(g.state);
  try {
    applyAction(copy, a);
    return true;
  } catch {
    return false;
  }
}

/** Seed for hand `n` of a match: every client derives the same one. */
export function handSeed(matchSeed: number, n: number) {
  let x = (matchSeed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0 || 1;
}

/** A cheap fingerprint of the table, so lockstep clients can spot a divergence. */
export function stateHash(g: MahjongGame): number {
  let h = 2166136261;
  const mix = (n: number) => {
    h ^= n & 0xffff;
    h = Math.imul(h, 16777619) >>> 0;
  };
  for (const p of g.players) {
    mix(p.score);
    for (const t of p.hand) mix(t.id);
    for (const t of p.discards) mix(t.id);
    mix(p.melds.length);
  }
  mix(g.state.wall.length);
  return h >>> 0;
}
