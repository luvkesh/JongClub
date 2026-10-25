// Shared hand evaluation used by AI opponents and JongBot.
// Reads the engine's state; never mutates it.

import type { MahjongGame } from '../engine/game';
import { wildShanten, wildWaits, type MeldShape, type ShapeRules } from '../engine/hand';
import { fastShanten } from './fastShanten';
import { KIND_COUNT, isDragon, isHonor, isTerminal, isTerminalOrHonor, suitOf, toCounts, windKind } from '../engine/tiles';

/** Jokers in a seat's concealed hand (Asian wild profiles only). */
export function handWilds(game: MahjongGame, seat: number): number[] {
  return game.wildsIn(game.players[seat].hand);
}

/** Fast shanten that also counts jokers in hand (each one a tile closer). */
export function shantenWith(counts: number[], melds: number, rules: ShapeRules, wilds: number[] = []): number {
  return wilds.length ? wildShanten(counts, wilds, melds, rules, fastShanten) : fastShanten(counts, melds, rules);
}

export interface DiscardEval {
  kind: number;
  shanten: number;
  /** Count of unseen tiles that would lower shanten after this discard. */
  ukeire: number;
  /** Kinds that improve the hand after this discard. */
  improvers: number[];
  danger: number;
  /** Isolated-tile and value adjustments (higher = better to discard). */
  shapeBonus: number;
}

/** Copies of each kind not visible to `seat`. */
export function unseenCounts(game: MahjongGame, seat: number): number[] {
  const seen = new Array(KIND_COUNT).fill(0);
  const see = (k: number) => k < KIND_COUNT && seen[k]++;
  for (const t of game.players[seat].hand) see(t.kind);
  for (const p of game.players) {
    for (const t of p.discards) see(t.kind);
    for (const m of p.melds) for (const t of m.tiles) see(t.kind);
  }
  // Kinds missing from a reduced set (three-player Korean's Characters 2–8) are never unseen.
  const set = game.profile.tileKinds;
  return seen.map((n, k) => (set.length < KIND_COUNT && !set.includes(k) ? 0 : Math.max(0, game.profile.copiesPerKind - n)));
}

export function isValueHonor(game: MahjongGame, seat: number, kind: number) {
  return isDragon(kind) || kind === windKind(game.state.seatWinds[seat]) || kind === windKind(game.prevailing);
}

/** How threatening each opponent looks, 0..1. */
export function threatLevels(game: MahjongGame, seat: number): number[] {
  const late = game.liveRemaining < 30;
  return game.players.map((p, s) => {
    if (s === seat) return 0;
    if (p.riichi) return 1;
    const m = p.melds.filter((x) => !x.concealed).length;
    if (m >= 3) return 1;
    if (m === 2) return late ? 0.8 : 0.5;
    if (m === 1) return late ? 0.4 : 0.2;
    return late ? 0.3 : 0.05;
  });
}

/** Rough chance a discard feeds someone's win, weighted by threat. */
export function dangerOf(game: MahjongGame, seat: number, kind: number, threats = threatLevels(game, seat), unseen = unseenCounts(game, seat)): number {
  let d = 0;
  for (let o = 0; o < game.players.length; o++) {
    const t = threats[o];
    if (!t) continue;
    let base: number;
    if (game.players[o].discardKinds.includes(kind)) base = game.profile.furiten ? 0.02 : 0.1;
    else if (isHonor(kind)) base = unseen[kind] <= 1 ? 0.05 : unseen[kind] === 2 ? 0.35 : 0.6;
    else if (isTerminal(kind)) base = 0.55;
    else base = 1;
    d += t * base;
  }
  return d;
}

export function evaluateDiscards(game: MahjongGame, seat: number): DiscardEval[] {
  const pl = game.players[seat];
  const rules = game.shapesFor(seat);
  const counts = game.naturalCounts(pl.hand);
  const melds = pl.melds.length;
  const wilds = handWilds(game, seat);
  const shanten = (c: number[], m: number, r: ShapeRules) => shantenWith(c, m, r, wilds);
  const unseen = unseenCounts(game, seat);
  const threats = threatLevels(game, seat);
  const out: DiscardEval[] = [];
  // Only kinds that touch the hand can improve a standard shape: the same
  // kind or a suited neighbour within two. Seven pairs (while short of seven
  // kinds) and thirteen orphans can use any new kind, so widen for those.
  const touches = new Array<boolean>(KIND_COUNT).fill(false);
  let kinds = 0;
  for (let k = 0; k < KIND_COUNT; k++) {
    if (!counts[k]) continue;
    kinds++;
    touches[k] = true;
    if (k < 27) for (let d = -2; d <= 2; d++) if (k + d >= 0 && Math.floor((k + d) / 9) === Math.floor(k / 9)) touches[k + d] = true;
  }
  const open = melds > 0;
  // A card hand (special shapes only, e.g. an India Rules Small Card): any kind the card uses can help,
  // and tiles it can't use at all go first, whatever they would be worth in an ordinary hand.
  const card = cardUses(rules);
  const anyKind = !!card || (!open && ((rules.sevenPairs && kinds <= 8) || (!!rules.special?.some((sp) => sp.ai && sp.pairs) && kinds <= 9)));
  const chows = rules.chows !== false;
  const orphans = !open && rules.thirteenOrphans;
  const voidKind = voidSuit(game, seat);
  for (let k = 0; k < KIND_COUNT; k++) {
    if (!counts[k]) continue;
    counts[k]--;
    const s = shanten(counts, melds, rules);
    let uke = 0;
    const improvers: number[] = [];
    for (let j = 0; j < KIND_COUNT; j++) {
      if (!unseen[j] || counts[j] >= 4) continue;
      if (!touches[j] && !anyKind && !(orphans && isTerminalOrHonor(j))) continue;
      counts[j]++;
      if (shanten(counts, melds, rules) < s) {
        uke += unseen[j];
        improvers.push(j);
      }
      counts[j]--;
    }
    counts[k]++;
    // Ready in shape only: keep the waits the rules would really pay out on (a minimum value,
    // a 2-5-8 pair, a compulsory passport, a clean hand...). None at all is as good as a tile short.
    let ready = s;
    let readyUke = uke;
    let readyImp = improvers;
    if (s === 0) {
      const ws = winningWaits(game, seat, k);
      if (!ws.length) (ready = 1), (readyUke = 0), (readyImp = []);
      else (readyImp = ws.filter((w) => unseen[w] > 0)), (readyUke = readyImp.reduce((a, w) => a + unseen[w], 0));
    }
    let shapeBonus = 0;
    const near = (d: number) => {
      const j = k + d;
      return chows && j >= 0 && j < 27 && Math.floor(j / 9) === Math.floor(k / 9) && counts[j] > 0;
    };
    const isolated = counts[k] === 1 && (isHonor(k) || (!near(-2) && !near(-1) && !near(1) && !near(2)));
    if (card) shapeBonus += card(k) ? 0 : CARD_DEAD;
    else {
      if (isolated) shapeBonus += isHonor(k) ? (isValueHonor(game, seat, k) ? 1 : 3) : isTerminal(k) ? 2 : 1;
      if (counts[k] >= 2 && isValueHonor(game, seat, k)) shapeBonus -= 4;
    }
    // Sichuan missing suit: tiles of the suit being cleared out go first.
    if (k < 27 && Math.floor(k / 9) === voidKind) shapeBonus += 60;
    out.push({ kind: k, shanten: ready, ukeire: readyUke, improvers: readyImp, danger: dangerOf(game, seat, k, threats, unseen), shapeBonus });
  }
  return out;
}

/** Discard bonus for a tile the seat's card can't use (outweighs any ordinary shape habit). */
export const CARD_DEAD = 12;

/**
 * For a seat that can only win with card hands (special shapes and nothing else):
 * whether one of the shapes the AI chases can use a kind. Null for ordinary hands,
 * or when a shape doesn't say.
 */
export function cardUses(rules: ShapeRules): ((kind: number) => boolean) | null {
  if (rules.standard !== false || rules.sevenPairs || rules.thirteenOrphans) return null;
  const chased = (rules.special ?? []).filter((sp) => sp.ai);
  if (!chased.length || chased.some((sp) => !sp.uses)) return null;
  return (kind) => chased.some((sp) => sp.uses!(kind));
}

/**
 * The kinds a seat would really win on (by discard or self-draw) after letting a tile of
 * `discardKind` go (-1: the hand as it is). Shape waits are checked against the engine's own
 * win test, so minimum values and every ruleset's win conditions count.
 */
export function winningWaits(game: MahjongGame, seat: number, discardKind = -1): number[] {
  const pl = game.players[seat];
  if (game.profile.card) return [];
  const i = discardKind < 0 ? -1 : pl.hand.findIndex((t) => t.kind === discardKind);
  if (discardKind >= 0 && i < 0) return [];
  const [gone] = i >= 0 ? pl.hand.splice(i, 1) : [];
  try {
    const counts = game.naturalCounts(pl.hand);
    const shapes = wildWaits(counts, handWilds(game, seat), pl.melds.length, game.shapesFor(seat), game.profile.wilds ?? { inPair: false, inChow: false });
    return shapes.filter((w) => game.evaluateWin(seat, w, false, true) || game.evaluateWin(seat, w, true, true));
  } finally {
    if (gone) pl.hand.splice(i, 0, gone);
  }
}

/** Suit with the most tiles; used for flush-chasing personalities. */
export function dominantSuit(game: MahjongGame, seat: number) {
  const tally: Record<string, number> = { man: 0, pin: 0, sou: 0 };
  const pl = game.players[seat];
  for (const t of [...pl.hand, ...pl.melds.flatMap((m) => m.tiles)]) if (t.kind < 27) tally[suitOf(t.kind)]++;
  return Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
}

/** Shanten of the hand now (13-tile view: without the drawn tile if 14). */
export function currentShanten(game: MahjongGame, seat: number) {
  const pl = game.players[seat];
  const s = shantenWith(game.naturalCounts(pl.hand), pl.melds.length, game.shapesFor(seat), handWilds(game, seat));
  // Ready in shape with no wait the rules accept is a tile short (13-tile view only).
  if (s === 0 && pl.hand.length % 3 === 1 && !game.profile.card && !winningWaits(game, seat).length) return 1;
  return s;
}

/** Tiles the hand (13-tile view) would really win on. */
export function currentWaits(game: MahjongGame, seat: number) {
  return winningWaits(game, seat);
}

/** Shanten after making a call and then discarding optimally. */
export function shantenAfterCall(game: MahjongGame, seat: number, removeKinds: number[], called?: number): number {
  // Shapes that read declared melds see the set this call would make.
  if (called !== undefined) {
    const s = game.withPendingMeld(seat, callMeld(called, removeKinds), () => shantenAfterCall(game, seat, removeKinds));
    // Ready after the call only counts if some discard leaves a wait the rules really pay out on.
    if (s === 0 && !game.profile.card && !withCall(game, seat, called, removeKinds, () => readyDiscards(game, seat).some((d) => winningWaits(game, seat, d).length))) return 1;
    return s;
  }
  const pl = game.players[seat];
  const counts = game.naturalCounts(pl.hand);
  const wilds = handWilds(game, seat);
  for (const k of removeKinds) {
    if (k < KIND_COUNT) counts[k]--;
    else if (wilds.includes(k)) wilds.splice(wilds.indexOf(k), 1);
  }
  let best = 99;
  for (let k = 0; k < KIND_COUNT; k++) {
    if (!counts[k]) continue;
    counts[k]--;
    best = Math.min(best, shantenWith(counts, pl.melds.length + 1, game.shapesFor(seat), wilds));
    counts[k]++;
  }
  return best;
}

/** Shanten after buying `kind` into the concealed hand (India Rules) and then discarding optimally. */
export function shantenAfterBuy(game: MahjongGame, seat: number, kind: number): number {
  const pl = game.players[seat];
  const counts = game.naturalCounts(pl.hand);
  const wilds = handWilds(game, seat);
  const rules = game.shapesFor(seat);
  counts[kind]++;
  let best = 99;
  for (let k = 0; k < KIND_COUNT; k++) {
    if (!counts[k]) continue;
    counts[k]--;
    best = Math.min(best, shantenWith(counts, pl.melds.length, rules, wilds));
    counts[k]++;
  }
  return best;
}

/** Discards (by kind) that leave the 14-tile hand ready in shape. */
function readyDiscards(game: MahjongGame, seat: number): number[] {
  const pl = game.players[seat];
  const counts = game.naturalCounts(pl.hand);
  const out: number[] = [];
  for (let k = 0; k < KIND_COUNT; k++) {
    if (!counts[k]) continue;
    counts[k]--;
    if (shantenWith(counts, pl.melds.length, game.shapesFor(seat), handWilds(game, seat)) === 0) out.push(k);
    counts[k]++;
  }
  return out;
}

/**
 * Run `fn` with the call really made on the seat's hand (tiles from hand plus the discard,
 * as an exposed set), then put everything back. For checks only the engine can make.
 */
export function withCall<T>(game: MahjongGame, seat: number, called: number, using: number[], fn: () => T): T {
  const pl = game.players[seat];
  const hand = pl.hand.slice();
  const taken: import('../engine/tiles').Tile[] = [];
  for (const k of using) {
    const i = pl.hand.findIndex((t) => t.kind === k);
    if (i >= 0) taken.push(pl.hand.splice(i, 1)[0]);
  }
  const m = callMeld(called, using);
  const tiles = [...taken, { id: -7, kind: called }].sort((a, b) => a.kind - b.kind);
  pl.melds.push({ type: m.type, tiles, concealed: false, from: (seat + 3) % game.players.length, claimedId: -7 });
  try {
    return fn();
  } finally {
    pl.melds.pop();
    pl.hand.splice(0, pl.hand.length, ...hand);
  }
}

/** The set a pung, kong or chow call makes, as hand analysis names it. */
export function callMeld(called: number, using: number[]): MeldShape {
  if (using.length >= 3) return { type: 'kong', kind: called };
  if (using.every((k) => k === called)) return { type: 'pung', kind: called };
  return { type: 'chow', kind: Math.min(called, ...using.filter((k) => k < KIND_COUNT)) };
}

/** With yaku-required rules, would this open hand still have a way to win? */
export function openHandHasYakuPath(game: MahjongGame, seat: number, calledKind: number, using: number[]): boolean {
  const pl = game.players[seat];
  const value = (k: number) => isValueHonor(game, seat, k);
  // Already holding (or calling) a value-honour set.
  if (using.length >= 2 && using.every((k) => k === calledKind) && value(calledKind)) return true;
  if (pl.melds.some((m) => m.type !== 'chow' && value(m.tiles[0].kind))) return true;
  // A concealed value-honour pair or pung can still become a set.
  const c = game.naturalCounts(pl.hand);
  if (c.some((n, k) => n >= 2 && value(k) && k !== calledKind)) return true;
  const tiles = [...pl.hand.map((t) => t.kind), ...(calledKind >= 0 ? [calledKind] : []), ...pl.melds.flatMap((m) => m.tiles.map((t) => t.kind))];
  // Half or full flush: one suit (with honours), allowing a stray tile or two still to go.
  const suits = [0, 0, 0];
  for (const k of tiles) if (k < 27) suits[Math.floor(k / 9)]++;
  const main = suits.indexOf(Math.max(...suits));
  const stray = tiles.filter((k) => k < 27 && Math.floor(k / 9) !== main).length;
  const meldsInSuit = pl.melds.every((m) => m.tiles[0].kind >= 27 || Math.floor(m.tiles[0].kind / 9) === main);
  const callInSuit = calledKind < 0 || calledKind >= 27 || Math.floor(calledKind / 9) === main;
  if (stray <= 1 && meldsInSuit && callInSuit) return true;
  // All pungs (toitoi): no chows, and the concealed tiles are mostly pairs and pungs already.
  const pungCall = calledKind < 0 || (using.length >= 2 && using.every((k) => k === calledKind));
  if (pungCall && pl.melds.every((m) => m.type !== 'chow')) {
    if (calledKind >= 0) c[calledKind] -= using.length;
    const sets = 4 - pl.melds.length - (calledKind >= 0 ? 1 : 0);
    const singles = c.filter((n) => n === 1).length;
    const pairs = c.filter((n) => n >= 2).length;
    if (calledKind >= 0) c[calledKind] += using.length;
    if (pairs >= sets && singles <= 2) return true;
  }
  // All simples (open tanyao).
  if (game.profile.houseChoices?.openTanyao === 'off') return false;
  const simple = (k: number) => k < 27 && k % 9 !== 0 && k % 9 !== 8;
  return tiles.filter((k) => !simple(k)).length <= 1 && (calledKind < 0 || simple(calledKind));
}

/**
 * Sichuan "missing suit": the suit this seat is clearing out (fewest tiles,
 * locked suits from melds kept). -1 when the profile has no such rule or the
 * hand already holds two suits or fewer.
 */
export function voidSuit(game: MahjongGame, seat: number): number {
  if (!game.profile.missingSuit) return -1;
  const pl = game.players[seat];
  const n = [0, 0, 0];
  const locked = [false, false, false];
  for (const t of pl.hand) if (t.kind < 27) n[Math.floor(t.kind / 9)]++;
  for (const m of pl.melds) {
    const s = Math.floor(m.tiles[0].kind / 9);
    if (s < 3) locked[s] = true;
  }
  const open = [0, 1, 2].filter((s) => !locked[s]);
  if (!open.length) return -1;
  return open.reduce((a, b) => (n[b] < n[a] ? b : a), open[0]);
}

/**
 * Three tiles to pass in an Asian goulash exchange: the ones the hand needs
 * least (keeps shanten lowest, then drops isolated tiles first). Jokers are kept.
 */
export function exchangePick(game: MahjongGame, seat: number): import('../engine/tiles').Tile[] {
  const pl = game.players[seat];
  const rules = game.shapesFor(seat);
  const pool = pl.hand.filter((t) => t.kind < KIND_COUNT);
  const counts = toCounts(pool.map((t) => t.kind));
  const out: import('../engine/tiles').Tile[] = [];
  const dom = game.profile.cleanHand ? dominantSuit(game, seat) : null;
  const clean = dom === null ? null : dom === 'man' ? 0 : dom === 'pin' ? 1 : 2;
  // A card hand (South Small Cards): tiles the card can't use go first.
  const uses = cardUses(rules);
  while (out.length < 3 && out.length < pool.length) {
    let best = -1;
    let bestV = Infinity;
    for (let k = 0; k < KIND_COUNT; k++) {
      if (!counts[k]) continue;
      counts[k]--;
      const s = shantenWith(counts, pl.melds.length, rules);
      counts[k]++;
      const near = (d: number) => k < 27 && k + d >= 0 && Math.floor((k + d) / 9) === Math.floor(k / 9) && counts[k + d] > 0;
      const isolated = counts[k] === 1 && !near(-2) && !near(-1) && !near(1) && !near(2);
      // A clean-hand table (India Rules Goulash): pass the other suits first.
      const off = (clean !== null && k < 27 && Math.floor(k / 9) !== clean) || (uses && !uses(k)) ? 15 : 0;
      const v = s * 10 - (isolated ? 3 : 0) - (isTerminalOrHonor(k) ? 1 : 0) - off;
      if (v < bestV) {
        bestV = v;
        best = k;
      }
    }
    if (best < 0) break;
    counts[best]--;
    const t = pool.find((x) => x.kind === best && !out.includes(x))!;
    out.push(t);
  }
  // A hand of only jokers still has to pass three tiles.
  for (const t of pl.hand) if (out.length < 3 && !out.includes(t)) out.push(t);
  return out;
}
