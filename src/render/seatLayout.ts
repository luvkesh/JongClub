// Where each seat sits around the table, for three- and four-seat games.
// Pure helpers with no Three.js, so the match UI, table renderer and HUD can
// share one answer (and tests can check it).
//
// Four seats use the quadrants table3d.ts already uses: relative seat 0 at the
// bottom (the viewer), 1 on the right (next in turn), 2 at the top, 3 on the
// left. A three-seat table (Korean) leaves the top empty: the next player sits
// on the right and the one before you on the left, so "from the left" still
// means the player whose discards you may chow.

export type SeatPosition = 'bottom' | 'right' | 'top' | 'left';

/** Quadrant index used by table3d.ts: 0 bottom, 1 right, 2 top, 3 left. */
export type Quadrant = 0 | 1 | 2 | 3;

const POSITIONS: SeatPosition[] = ['bottom', 'right', 'top', 'left'];

export interface SeatPlace {
  seat: number;
  /** Turn-order offset from the viewer: 0 = you, 1 = next, players-1 = previous. */
  rel: number;
  /** The visual quadrant (table3d's old `rel`). */
  quadrant: Quadrant;
  position: SeatPosition;
  /** Rotation about the vertical axis for this seat's tiles (table3d seatQuat). */
  angle: number;
}

/** Turn-order offset of `seat` from the viewer. */
export const relSeat = (seat: number, viewer: number, players: number) => (((seat - viewer) % players) + players) % players;

/** Quadrant for a turn-order offset: 3 seats skip the top. */
export function quadrantForRel(rel: number, players: number): Quadrant {
  if (players === 3) return ([0, 1, 3] as const)[rel];
  return (rel % 4) as Quadrant;
}

/** Quadrant a seat is drawn in, seen from `viewer`. Replaces `(seat - viewer + 4) % 4`. */
export const quadrantOf = (seat: number, viewer: number, players: number): Quadrant => quadrantForRel(relSeat(seat, viewer, players), players);

/** The seat drawn in a quadrant, or null (the empty top at a three-seat table). */
export function seatAtQuadrant(q: Quadrant, viewer: number, players: number): number | null {
  for (let rel = 0; rel < players; rel++) if (quadrantForRel(rel, players) === q) return (viewer + rel) % players;
  return null;
}

/** Every seat at the table, seat order, with where it sits. */
export function seatLayout(players: number, viewer: number): SeatPlace[] {
  return Array.from({ length: players }, (_, seat) => {
    const rel = relSeat(seat, viewer, players);
    const quadrant = quadrantForRel(rel, players);
    return { seat, rel, quadrant, position: POSITIONS[quadrant], angle: (quadrant * Math.PI) / 2 };
  });
}

/** Seats in a fixed array of length `players` ([0, 1, 2] or [0, 1, 2, 3]): use instead of literal [0, 1, 2, 3]. */
export const seatList = (players: number) => Array.from({ length: players }, (_, s) => s);

/**
 * Wall stacks per side. Tables keep four walls of two-high stacks however
 * many play: 17 a side for 136 tiles, 18 for 144, 15 for Korean's 116
 * (14.5 rounded up; the last side is one stack short).
 */
export const wallStacksPerSide = (totalTiles: number) => Math.ceil(totalTiles / 8);

/** Who a seat is to you, in words: "next", "across", "previous" (for claim prompts and toasts). */
export function relationName(seat: number, viewer: number, players: number): 'you' | 'next' | 'across' | 'previous' {
  const rel = relSeat(seat, viewer, players);
  if (rel === 0) return 'you';
  if (rel === 1) return 'next';
  if (rel === players - 1) return 'previous';
  return 'across';
}
