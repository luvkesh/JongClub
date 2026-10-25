// American Mahjong decisions, shared by AI opponents and JongBot.
// Everything is measured against the card: how many tiles away the
// nearest card hands are, and which tiles those hands use.

import type { JokerSwap, MahjongGame } from '../engine/game';
import { FLOWER, distance, meldKind, progress, type Progress } from '../engine/rules/american';
import type { Meld } from '../engine/state';
import { FLOWER_BASE, JOKER_KIND, Tile, isFlower, isJoker, tileName } from '../engine/tiles';

const norm = (k: number) => (isFlower(k) ? FLOWER : k);
export const kindLabel = (k: number) => (k === FLOWER ? 'Flower' : tileName(k));

/** How much the closest few card hands want each kind (higher = keep). */
function keepWeights(targets: Progress[]): Map<number, number> {
  const w = new Map<number, number>();
  const best = targets[0]?.missing ?? 0;
  for (const t of targets) {
    const weight = t.missing === best ? 3 : t.missing === best + 1 ? 1 : 0.3;
    for (const g of t.instance.groups) w.set(g.kind, (w.get(g.kind) ?? 0) + weight * g.size);
  }
  return w;
}

export interface DiscardChoice {
  tile: Tile;
  /** Tiles still needed after this discard. */
  missing: number;
  keep: number;
}

/** Discards ranked best first. Jokers are never offered while anything else can go. */
export function rankDiscards(hand: Tile[], melds: Meld[], dangerOf?: (kind: number) => number): DiscardChoice[] {
  const targets = progress(hand, melds, 12);
  const weights = keepWeights(targets);
  const seen = new Set<number>();
  const out: DiscardChoice[] = [];
  for (const t of hand) {
    const k = norm(t.kind);
    if (seen.has(k) || isJoker(t.kind)) continue;
    seen.add(k);
    const rest = hand.filter((x) => x !== t);
    out.push({ tile: t, missing: distance(rest, melds), keep: (weights.get(k) ?? 0) + (dangerOf?.(k) ?? 0) });
  }
  if (!out.length) out.push({ tile: hand[hand.length - 1], missing: distance(hand.slice(0, -1), melds), keep: 99 });
  out.sort((a, b) => a.missing - b.missing || a.keep - b.keep);
  return out;
}

/** Tiles from hand that an exposure of `size` would use: naturals first, then jokers. */
export function tilesForCall(hand: Tile[], kind: number, need: number): Tile[] {
  const naturals = hand.filter((t) => norm(t.kind) === norm(kind));
  const jokers = hand.filter((t) => isJoker(t.kind));
  return [...naturals, ...jokers].slice(0, need);
}

/** Tiles needed after calling a discard into an exposure and making the best discard. */
export function missingAfterCall(game: MahjongGame, seat: number, kind: number, size: 3 | 4): number {
  const pl = game.players[seat];
  const used = tilesForCall(pl.hand, kind, size - 1);
  if (used.length < size - 1) return Infinity;
  const meld: Meld = { type: size === 4 ? 'kong' : 'pung', tiles: [...used, { id: -1, kind }], concealed: false };
  const rest = pl.hand.filter((t) => !used.includes(t));
  const melds = [...pl.melds, meld];
  let best = Infinity;
  for (const t of rest) best = Math.min(best, distance(rest.filter((x) => x !== t), melds));
  return best;
}

/** Three tiles to pass in the Charleston: the ones the card wants least. */
export function charlestonPick(hand: Tile[], noise = 0, rnd: () => number = () => 0.5): Tile[] {
  let rest = hand.slice();
  const out: Tile[] = [];
  while (out.length < 3) {
    const ranked = rankDiscards(rest, []).filter((c) => !isJoker(c.tile.kind));
    const pick = noise && rnd() < noise && ranked.length > 1 ? ranked[1] : ranked[0];
    out.push(pick.tile);
    rest = rest.filter((t) => t !== pick.tile);
  }
  return out;
}

/** Danger of a discard: someone exposing that kind may be one tile from Mah Jongg. */
export function exposureDanger(game: MahjongGame, seat: number) {
  const exposed = new Map<number, number>();
  game.players.forEach((p, s) => {
    if (s === seat) return;
    const urgency = p.melds.length >= 3 ? 3 : p.melds.length;
    for (const m of p.melds) exposed.set(meldKind(m), (exposed.get(meldKind(m)) ?? 0) + urgency);
  });
  return (kind: number) => exposed.get(kind) ?? 0;
}

/**
 * Discards ranked best first, with defence against exposures.
 * `strong` play reads the table: it defends harder when an opponent has
 * three or more exposures and its own hand is far from the card, and it
 * knows a tile with every copy visible can't complete anyone's set.
 */
export function americanPlan(game: MahjongGame, seat: number, defenseWeight: number, strong = false): DiscardChoice[] {
  const pl = game.players[seat];
  const danger = exposureDanger(game, seat);
  if (!strong) return rankDiscards(pl.hand, pl.melds, (k) => danger(k) * defenseWeight);
  const hottest = Math.max(0, ...game.players.map((p, s) => (s === seat ? 0 : p.melds.length)));
  const myDistance = distance(pl.hand, pl.melds);
  let w = Math.max(defenseWeight, 0.15);
  if (hottest >= 3) w *= 3;
  else if (hottest === 2) w *= 1.5;
  if (myDistance >= 4) w *= 2;
  else if (myDistance <= 1) w *= 0.5;
  const seen = new Map<number, number>();
  const see = (k: number) => seen.set(norm(k), (seen.get(norm(k)) ?? 0) + 1);
  for (const t of pl.hand) see(t.kind);
  for (const p of game.players) {
    for (const t of p.discards) see(t.kind);
    for (const m of p.melds) for (const t of m.tiles) see(t.kind);
  }
  const copies = (k: number) => (k === FLOWER ? 8 : 4);
  const hotDiscards = new Set(game.players.filter((p, s) => s !== seat && p.melds.length >= 2).flatMap((p) => p.discardKinds.map(norm)));
  return rankDiscards(pl.hand, pl.melds, (k) => {
    if ((seen.get(k) ?? 0) >= copies(k)) return 0;
    return danger(k) * w * (hotDiscards.has(k) ? 0.5 : 1);
  });
}

export function bestSwap(swaps: JokerSwap[], hand?: Tile[], melds?: Meld[]): JokerSwap | undefined {
  if (!hand || !melds) return swaps[0];
  return swaps.find((s) => swapHelps(hand, melds, s.tileId));
}

/** Does trading this natural tile for a joker keep the hand at least as close to the card?
 *  (A joker can't fill a pair or a single, so giving up a pair tile can cost a step.) */
export function swapHelps(hand: Tile[], melds: Meld[], tileId: number): boolean {
  const best = (h: Tile[]) => Math.min(...h.filter((t) => !isJoker(t.kind)).map((t) => distance(h.filter((x) => x !== t), melds)), distance(h.slice(0, -1), melds));
  const now = best(hand);
  const swapped = [...hand.filter((t) => t.id !== tileId), { id: -9, kind: JOKER_KIND }];
  return best(swapped) <= now;
}

/** Plain-language description of a target hand. */
export function describeTarget(p: Progress) {
  const h = p.instance.hand;
  return `${h.section} · ${h.pattern} (${h.value}${h.concealed ? ', concealed' : ''})`;
}

export const flowerKind = FLOWER_BASE;
