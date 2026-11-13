// QA helper: arrange a dealt hand so chosen seats hold chosen tiles, with every
// physical tile still accounted for (the rest go back to the wall in order).

import { MahjongGame } from '../../src/engine/game';
import type { Meld } from '../../src/engine/state';
import { kindOfTileId, parseKinds, type Tile } from '../../src/engine/tiles';

export interface RigSeat {
  hand: string;
  /** Exposed pungs / chows / kongs by spec, e.g. ['5p 5p 5p']. */
  melds?: { spec: string; type: Meld['type']; from?: number; concealed?: boolean }[];
}

/**
 * Re-deal the current hand: each listed seat gets exactly these tiles; seats not
 * listed get filler from the wall. `wallFront` puts these kinds at the front of
 * the live wall (next draws), `liveLeft` trims the live wall to that many tiles
 * (by moving the rest into the drawn-from-front region as if already drawn and
 * discarded by `discardSink`).
 */
export function rig(g: MahjongGame, seats: (RigSeat | null)[], opts: { wallFront?: string; liveLeft?: number; turn?: number; discardSink?: number } = {}) {
  const s = g.state;
  const p = g.profile;
  const pool: Tile[] = s.wallOrder.map((id) => ({ id, kind: kindOfTileId(id) }));
  // Prefer the last copies of a kind (ids kind*4+3 first) so red fives stay in the wall.
  const take = (kind: number): Tile => {
    let best = -1;
    for (let i = 0; i < pool.length; i++) if (pool[i].kind === kind && (best < 0 || pool[i].id > pool[best].id)) best = i;
    if (best < 0) throw new Error(`no tile of kind ${kind} left`);
    return pool.splice(best, 1)[0];
  };
  for (const pl of s.players) {
    pl.hand = [];
    pl.melds = [];
    pl.discards = [];
    pl.claimedDiscards = [];
    pl.called = [];
    pl.discardKinds = [];
    pl.flowers = [];
    pl.riichi = false;
    pl.riichiPaid = false;
    pl.riichiDiscard = null;
    pl.furitenTemp = false;
    pl.furitenLocked = false;
    pl.ippatsu = false;
  }
  seats.forEach((spec, seat) => {
    if (!spec) return;
    const pl = s.players[seat];
    for (const m of spec.melds ?? []) {
      const tiles = parseKinds(m.spec).map(take);
      pl.melds.push({ type: m.type, tiles, concealed: !!m.concealed, from: m.concealed ? undefined : (m.from ?? (seat + 3) % p.players) });
    }
    pl.hand = parseKinds(spec.hand).map(take);
  });
  const front = opts.wallFront ? parseKinds(opts.wallFront).map(take) : [];
  // Filler for seats not listed: plain suited / honour tiles.
  seats.forEach((spec, seat) => {
    if (spec) return;
    const pl = s.players[seat];
    while (pl.hand.length < p.handSize) {
      const i = pool.findIndex((t) => t.kind < 34);
      pl.hand.push(pool.splice(i, 1)[0]);
    }
  });
  for (let seat = seats.length; seat < p.players; seat++) {
    const pl = s.players[seat];
    while (pl.hand.length < p.handSize) {
      const i = pool.findIndex((t) => t.kind < 34);
      pl.hand.push(pool.splice(i, 1)[0]);
    }
  }
  const sink = opts.discardSink ?? -1;
  let rest = [...front, ...pool];
  s.drawnFromFront = 0;
  s.drawnFromBack = 0;
  if (opts.liveLeft !== undefined) {
    // Everything before the last liveLeft live tiles is "already played": put it in the sink seat's discards.
    const live = rest.length - p.deadWall;
    const drop = live - opts.liveLeft;
    if (drop < 0) throw new Error('not enough tiles');
    const gone = rest.slice(front.length, front.length + drop);
    rest = [...rest.slice(0, front.length), ...rest.slice(front.length + drop)];
    if (sink >= 0) s.players[sink].discards.push(...gone);
    else (s.outOfPlay ??= []).push(...gone);
  }
  s.wall = rest;
  s.wallOrder = [...rest.map((t) => t.id), ...s.players.flatMap((pl) => [...pl.hand, ...pl.melds.flatMap((m) => m.tiles), ...pl.discards].map((t) => t.id)), ...(s.outOfPlay ?? []).map((t) => t.id)];
  s.callsMade = 1;
  s.turnCount = 8;
  delete s.instant;
  if (p.instantPayments) s.instant = [];
  s.doraRevealed = p.doraFromIndicator ? 1 : 0;
  const turn = opts.turn ?? 0;
  const pl = s.players[turn];
  const drawn = pl.hand[pl.hand.length - 1] ?? null;
  s.phase = { kind: 'turn', seat: turn, drawn, afterKong: false, mustDiscardOnly: false };
  return { tile: (seat: number, kind: string) => s.players[seat].hand.find((t) => t.kind === parseKinds(kind)[0])! };
}

/** Sum of scores plus the pot (zero-sum check). */
export const total = (g: MahjongGame) => g.players.reduce((a, p) => a + p.score, 0) + g.state.riichiPot;
