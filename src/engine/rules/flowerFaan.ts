// Classic's flower faan (house rule `flowers`): your own flower and your own
// season 1 faan each, all four flowers or all four seasons 2 faan for that set.

import { FLOWER_BASE, WINDS } from '../tiles';
import type { ScoreItem, ScoringContext } from './types';

export function flowerItems(ctx: ScoringContext): ScoreItem[] {
  // Absent means the default (on); with flowers off there are none to score anyway.
  if (ctx.house?.flowers === 'off') return [];
  const flowers = ctx.flowers ?? [];
  const seatNo = WINDS.indexOf(ctx.seatWind) + 1;
  const out: ScoreItem[] = [];
  for (const [from, set, own] of [
    [FLOWER_BASE, 'All four flowers', 'Seat flower'],
    [FLOWER_BASE + 4, 'All four seasons', 'Seat season'],
  ] as const) {
    if ([0, 1, 2, 3].every((i) => flowers.includes(from + i))) out.push({ name: set, value: 2 });
    else if (flowers.includes(from + seatNo - 1)) out.push({ name: own, value: 1 });
  }
  return out;
}
