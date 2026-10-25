// India Rules Small Cards: which of the cards offered to keep ("draw 3, keep 1").

import type { MahjongGame } from '../engine/game';
import { LIMIT_PAY, SMALL_CARDS, cardShanten } from '../engine/rules/indiaCards';
import { WINDS } from '../engine/tiles';

/** How far each offered card is from the tiles held (shanten, 99 when out of reach). */
export function cardDistances(game: MahjongGame, seat: number, offers: number[]): number[] {
  const counts = game.concealedCounts(seat);
  const sk = 27 + WINDS.indexOf(game.state.seatWinds[seat]);
  const rk = 27 + WINDS.indexOf(game.state.prevailingWind);
  return offers.map((c) => cardShanten(SMALL_CARDS[c], counts, [], sk, rk));
}

/** The nearest card; on a tie the one that pays more. */
export function pickNearestCard(game: MahjongGame, seat: number, offers: number[]): number {
  const d = cardDistances(game, seat, offers);
  const pays = (c: number) => {
    const v = SMALL_CARDS[c].value;
    return typeof v === 'string' ? LIMIT_PAY[v] : LIMIT_PAY.half;
  };
  let best = 0;
  for (let i = 1; i < offers.length; i++) if (d[i] < d[best] || (d[i] === d[best] && pays(offers[i]) > pays(offers[best]))) best = i;
  return offers[best];
}
