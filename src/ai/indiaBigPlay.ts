// India Rules North round Big Cards: how a bot plays the card East picked. Everything is
// measured in tiles still missing for the nearest reading of the card (bigDistance).

import type { MahjongGame, TurnOptions } from '../engine/game';
import type { ClaimOption, ClaimResponse } from '../engine/state';
import { FL, bigDistance, bigUses, type BigGroup, type MInfo } from '../engine/rules/indiaBig';
import { isFlower } from '../engine/tiles';
import type { AiDecision } from './players';

const bucket = (k: number) => (isFlower(k) ? FL : k);

/** The laid-down groups after laying down `g`. */
export function meldsAfterGroup(melds: MInfo[], g: BigGroup, jokerKinds: Map<number, number>): MInfo[] {
  const jokers = g.wild.map((w) => ({ kind: jokerKinds.get(w.id)!, as: w.as }));
  if (g.extend === undefined) return [...melds, { type: g.type, as: g.as, jokers }];
  return melds.map((m, i) => (i === g.extend ? { type: g.type, as: g.as, jokers: [...m.jokers, ...jokers] } : m));
}

/** Tiles missing with these hand kinds and groups. */
function dist(game: MahjongGame, seat: number, kinds: number[], melds: MInfo[]) {
  return bigDistance(game.profile.big!, kinds, melds, game.bigCtx(seat));
}

/** The best discard from these hand kinds: [kind, tiles missing after it]. */
function bestDiscard(game: MahjongGame, seat: number, kinds: number[], melds: MInfo[], noise = 0, rnd = Math.random): { kind: number; d: number }[] {
  const uses = bigUses(game.profile.big!, game.bigCtx(seat));
  const out: { kind: number; d: number; v: number }[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < kinds.length; i++) {
    const k = kinds[i];
    if (seen.has(k)) continue;
    seen.add(k);
    const rest = kinds.slice(0, i).concat(kinds.slice(i + 1));
    const d = dist(game, seat, rest, melds);
    // Ties: throw what the card never uses first.
    out.push({ kind: k, d, v: d * 10 + (uses.has(bucket(k)) ? 1 : 0) + (rnd() < noise ? rnd() * 15 : 0) });
  }
  return out.sort((a, b) => a.v - b.v);
}

export function bigTurn(game: MahjongGame, seat: number, opts: TurnOptions, noise: number, rnd: () => number): AiDecision {
  const pl = game.players[seat];
  const kinds = pl.hand.map((t) => t.kind);
  const melds = game.bigMelds(seat);
  const now = dist(game, seat, kinds, melds);
  const kindOf = new Map(pl.hand.map((t) => [t.id, bucket(t.kind)]));
  // Lay down a group whenever it keeps the hand as near: its extra tiles can only help.
  for (const g of opts.groups ?? []) {
    const rest = pl.hand.filter((t) => !g.ids.includes(t.id)).map((t) => t.kind);
    if (dist(game, seat, rest, meldsAfterGroup(melds, g, kindOf)) <= now) return { action: 'group', group: g };
  }
  // A joker back in the hand for a natural tile: take it when it brings the hand nearer.
  for (const sw of opts.jokerSwaps) {
    const meld = game.players[sw.owner].melds[sw.meld];
    const mine = pl.hand.find((t) => t.id === sw.tileId)!;
    const w = meld.wild!.find((x) => x.as === bucket(mine.kind))!;
    const jokerKind = meld.tiles.find((t) => t.id === w.id)!.kind;
    const hand = kinds.slice();
    hand.splice(hand.indexOf(mine.kind), 1, jokerKind);
    const drop = (js: MInfo['jokers']) => {
      const i = js.findIndex((j) => j.as === w.as);
      return js.filter((_, x) => x !== i);
    };
    const ms = sw.owner === seat ? melds.map((m, i) => (i === sw.meld ? { ...m, jokers: drop(m.jokers) } : m)) : melds;
    if (dist(game, seat, hand, ms) < now) return { action: 'swap', swap: sw };
  }
  const allowed = new Set(opts.discards.map((t) => t.kind));
  const ranked = bestDiscard(game, seat, kinds, melds, noise, rnd).filter((x) => allowed.has(x.kind));
  const kind = ranked[0]?.kind ?? opts.discards[0].kind;
  const tile = opts.discards.find((t) => t.kind === kind)!;
  return { action: 'discard', tileId: tile.id, kind };
}

/** Call a discard (or buy it) only when the hand ends up nearer the card after the best discard. */
export function bigClaim(game: MahjongGame, seat: number, options: ClaimOption[], discardKind: number): ClaimResponse {
  const pl = game.players[seat];
  const kinds = pl.hand.map((t) => t.kind);
  const melds = game.bigMelds(seat);
  const now = dist(game, seat, kinds, melds);
  let best: { o: ClaimOption; d: number } | null = null;
  for (const o of options) {
    let hand = kinds.slice();
    let ms = melds;
    if (o.type === 'buy') hand.push(discardKind);
    else if (o.type === 'pung' || o.type === 'kong' || o.type === 'chow') {
      const using = o.using ?? new Array(o.type === 'kong' ? 3 : 2).fill(discardKind);
      for (const k of using) hand.splice(hand.indexOf(k), 1);
      const as = [...using, discardKind].sort((a, b) => a - b);
      ms = [...melds, { type: o.type, as, jokers: [] }];
    } else continue;
    const d = bestDiscard(game, seat, hand, ms)[0]?.d ?? 99;
    // A call costs the concealed bonus, so it has to win a tile; a buy costs 100.
    if (d < now && (!best || d < best.d)) best = { o, d };
  }
  return best ? best.o : { type: 'pass' };
}
