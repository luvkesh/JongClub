// Tournament placement scoring (uma): the way Riichi leagues and many club
// tournaments turn a table's final scores into points that add up across
// rounds. Each player gets the placement bonus for their place plus their
// score difference in thousands:
//   points = (final score - starting score) / 1000 + uma[place]
// Four seats: +15, +5, -5, -15 by default. Three seats: +15, 0, -15.
// Tied players share the bonuses of the places they tie for. Every table's
// points add up to zero (the score differences do, and so does the uma).
// Leagues also add an "oka" (a bonus for first from a higher return score);
// that is left out by default and can be set with `oka`.

export interface PlacementRule {
  /** Bonus for each place, first to last. */
  uma: number[];
  /** Points per one bonus point (1000: score difference in thousands). */
  per: number;
  /** Extra bonus for first place (league oka). 0 = none. */
  oka: number;
}


/** Uma choices a host can pick (four seats; three seats drop the middle pair to 0). */
export const UMA_PRESETS: { value: string; label: string; uma: number[] }[] = [
  { value: '15', label: '+15 / +5 / −5 / −15', uma: [15, 5, -5, -15] },
  { value: '20', label: '+20 / +10 / −10 / −20', uma: [20, 10, -10, -20] },
  { value: '30', label: '+30 / +10 / −10 / −30', uma: [30, 10, -10, -30] },
];

/** Uma for a table: a preset value, fitted to three or four seats. */
export function umaFor(players: number, preset = '15'): number[] {
  const u = (UMA_PRESETS.find((p) => p.value === preset) ?? UMA_PRESETS[0]).uma;
  return players === 3 ? [u[0], 0, u[3]] : u.slice();
}

/**
 * The rule for a table. Score differences count in thousands at tables that
 * start from 20,000 or more (Riichi), in hundreds at smaller-stake tables, so
 * the score still matters next to the uma.
 */
export const placementRule = (players: number, overrides: Partial<PlacementRule> = {}, startingScore = 25000): PlacementRule => ({
  uma: umaFor(players),
  per: startingScore >= 20000 ? 1000 : 100,
  oka: 0,
  ...overrides,
});

/** Placement points per seat, one decimal place, from final scores. */
export function placementPoints(scores: number[], start: number, rule: PlacementRule = placementRule(scores.length, {}, start)): number[] {
  const order = scores.map((s, seat) => ({ s, seat })).sort((a, b) => b.s - a.s);
  const bonus = new Array(scores.length).fill(0);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].s === order[i].s) j++;
    // Ties share the places they cover.
    let share = 0;
    for (let k = i; k <= j; k++) share += (rule.uma[k] ?? 0) + (k === 0 ? rule.oka : 0);
    for (let k = i; k <= j; k++) bonus[order[k].seat] = share / (j - i + 1);
    i = j + 1;
  }
  return scores.map((s, seat) => round1((s - start) / rule.per + bonus[seat]));
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** "+23.4", "−5.0", "0.0". */
export function formatPlacement(p: number): string {
  const v = Math.abs(p).toFixed(1);
  return p > 0 ? `+${v}` : p < 0 ? `−${v}` : v;
}

/** The table option key (kept with the house rules, so replays and live tables carry it). */
export const TOURNAMENT_SCORING = 'tournamentScoring';
export const UMA_KEY = 'uma';
export const usesPlacement = (houseRules: Record<string, string> | undefined) => houseRules?.[TOURNAMENT_SCORING] === 'on';

/** A table's placement points from its house rules (null when the table doesn't use them). */
export function tablePlacement(houseRules: Record<string, string> | undefined, scores: number[], start: number): number[] | null {
  if (!usesPlacement(houseRules)) return null;
  return placementPoints(scores, start, placementRule(scores.length, { uma: umaFor(scores.length, houseRules?.[UMA_KEY]) }, start));
}
