// Small shared pieces for the regional Chinese tables (Wuhan, Shanghai,
// Fujian, Beijing, Northeast): tile constants and the doubling count most of
// them use.

import type { HandScore, ScoreItem } from './types';

export const RED_DRAGON = 31;
export const GREEN_DRAGON = 32;
export const WHITE_DRAGON = 33;

/** A hand worth `base`, doubled once per unit of its items, capped. */
export function doubled(items: ScoreItem[], base: number, cap: number, unit = 'doubles'): HandScore {
  const raw = items.reduce((a, b) => a + b.value, 0);
  const value = Math.min(raw, cap);
  return { value, unit, items, points: base * 2 ** value, limit: raw >= cap };
}
