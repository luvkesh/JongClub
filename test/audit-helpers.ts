import { MahjongGame } from '../src/engine/game';
import { buildProfile } from '../src/club/sim';
import { parseKinds, FLOWER_BASE } from '../src/engine/tiles';
import type { ClaimOption } from '../src/engine/state';
import { AiPlayer } from '../src/ai/players';

/** Play through any exchange phases (goulash round) with bots. */
function toPlay(g: MahjongGame) {
  const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, 'expert', 'zen', 5 + s));
  for (let i = 0; i < 20; i++) {
    const ph = g.state.phase;
    if (ph.kind === 'exchangeChoice') g.chooseExchanges(ph.seat, 1, 1);
    else if (ph.kind === 'charleston') ais.map((a) => a.charlestonPass(g).map((t) => t.id)).forEach((ids, s) => g.charlestonPass(s, ids));
    else if (ph.kind === 'wallExchange') ais.map((a) => a.wallExchangePick(g).map((t) => t.id)).forEach((ids, s) => g.wallExchange(s, ids));
    else return;
  }
}

export interface Setup { variation: string; house?: Record<string, string>; windIndex?: number; hand: string; melds?: { type: 'pung' | 'chow' | 'kong'; kinds: string }[]; wild?: number[]; flowers?: number[]; seed?: number }

/** Seat 0 is the dealer (East) on turn holding `hand` (14 tiles minus 3 per meld). */
export function onTurn(s: Setup): MahjongGame {
  const g = new MahjongGame(buildProfile(s.variation, 'fullNews', s.house ?? {}), ['A', 'B', 'C', 'D'], s.seed ?? 7);
  if (s.windIndex !== undefined) g.state.round.windIndex = s.windIndex;
  g.startHand(s.seed ?? 7);
  toPlay(g);
  if (g.state.phase.kind !== 'turn') throw new Error('not on turn: ' + g.state.phase.kind);
  const pl = g.players[0];
  pl.melds = [];
  for (const m of s.melds ?? []) {
    const tiles = pl.hand.splice(0, 3);
    parseKinds(m.kinds).forEach((k, i) => (tiles[i].kind = k));
    pl.melds.push({ type: m.type, tiles, concealed: false, from: 3 });
  }
  const kinds = parseKinds(s.hand);
  if (kinds.length !== pl.hand.length) throw new Error(`hand needs ${pl.hand.length} tiles, got ${kinds.length}`);
  pl.hand.forEach((t, i) => (t.kind = kinds[i]));
  (g.state.phase as { drawn: unknown }).drawn = pl.hand[pl.hand.length - 1];
  if (g.state.wildKinds || s.wild) g.state.wildKinds = s.wild ?? [];
  pl.flowers = (s.flowers ?? []).map((f, i) => ({ id: 136 + i, kind: FLOWER_BASE + f }));
  (g as unknown as { seatShapeCache: unknown[] }).seatShapeCache = [];
  return g;
}

/** Seat 0 holds the 13-tile `hand`; seat 3 (on seat 0's left) discards `tile`. Returns seat 0's options. */
export function onClaim(s: Setup & { tile: string }): { g: MahjongGame; options: ClaimOption[]; kind: number } {
  const g = new MahjongGame(buildProfile(s.variation, 'fullNews', s.house ?? {}), ['A', 'B', 'C', 'D'], s.seed ?? 7);
  if (s.windIndex !== undefined) g.state.round.windIndex = s.windIndex;
  g.state.round.dealerSeat = 3;
  g.startHand(s.seed ?? 7);
  toPlay(g);
  if (g.state.phase.kind !== 'turn' || g.state.phase.seat !== 3) throw new Error('seat 3 not on turn: ' + JSON.stringify(g.state.phase.kind));
  if (g.state.wildKinds || s.wild) g.state.wildKinds = s.wild ?? [];
  const pl = g.players[0];
  pl.melds = [];
  for (const m of s.melds ?? []) {
    const tiles = pl.hand.splice(0, 3);
    parseKinds(m.kinds).forEach((k, i) => (tiles[i].kind = k));
    pl.melds.push({ type: m.type, tiles, concealed: false, from: 2 });
  }
  const kinds = parseKinds(s.hand);
  if (kinds.length !== pl.hand.length) throw new Error(`hand needs ${pl.hand.length} tiles, got ${kinds.length}`);
  pl.hand.forEach((t, i) => (t.kind = kinds[i]));
  pl.flowers = (s.flowers ?? []).map((f, i) => ({ id: 136 + i, kind: FLOWER_BASE + f }));
  const kind = parseKinds(s.tile)[0];
  const d = g.players[3];
  // A plain tile for seat 3 to throw (never a natural wild).
  const t = d.hand[0];
  t.kind = kind;
  (g as unknown as { seatShapeCache: unknown[] }).seatShapeCache = [];
  g.discard(3, t.id);
  const ph = g.state.phase as import('../src/engine/state').Phase;
  if (ph.kind !== 'claims') throw new Error('no claims phase: ' + ph.kind);
  return { g, options: ph.options[0] ?? [], kind };
}

/** Kinds that would legally win after seat 0 discards `kind` (14-tile turn state). */
export function legalWaitsAfter(g: MahjongGame, kind: number): number[] {
  const pl = g.players[0];
  const i = pl.hand.findIndex((t) => t.kind === kind);
  const [r] = pl.hand.splice(i, 1);
  const out: number[] = [];
  for (let w = 0; w < 34; w++) if (g.evaluateWin(0, w, true, true) || g.evaluateWin(0, w, false, true)) out.push(w);
  pl.hand.splice(i, 0, r);
  return out;
}

/** After seat 0 makes `call` (from onClaim), the discards that leave it ready, each with its legal winning tiles. */
export function readyAfterCall(g: MahjongGame, call: ClaimOption): { discard: number; legal: number[] }[] {
  g.respond(0, call);
  for (const s of g.pendingClaimSeats()) if (g.state.phase.kind === 'claims') g.respond(s, { type: 'pass' });
  const ph = g.state.phase;
  if (ph.kind !== 'turn' || ph.seat !== 0) throw new Error('seat 0 did not get the call: ' + ph.kind);
  const out: { discard: number; legal: number[] }[] = [];
  const kinds = [...new Set(g.players[0].hand.map((t) => t.kind))];
  for (const k of kinds) {
    const pl = g.players[0];
    const i = pl.hand.findIndex((t) => t.kind === k);
    const [r] = pl.hand.splice(i, 1);
    const waits = g.waitsOf(0);
    pl.hand.splice(i, 0, r);
    if (waits.length) out.push({ discard: k, legal: legalWaitsAfter(g, k) });
  }
  return out;
}
