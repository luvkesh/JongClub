// The opening ceremony: dice for East at the start of a match, and East's throw
// that breaks the wall at the start of every hand. Pure rules, no rendering.
// Readings and sources per variation: docs/variants/dice-and-wall-break.md.
//
// Ring positions count wall stacks from the right-hand end of the dealer's wall
// (seen by the dealer), going clockwise round the table: along the dealer's wall to
// its left end, then the wall of the player on the dealer's left (North), and so on.
// The live wall starts at the break and runs clockwise from it; the back of the
// wall (index wall.length - 1, where replacements come from) ends just before it.

import { Rng } from './rng';

/** How a variation breaks the wall. */
export interface OpeningRules {
  /** Dice on the table. */
  dice: 2 | 3;
  /**
   * 'count': East's total counts the walls counter-clockwise (East = 1) and the
   * stacks from the right of that wall. 'twice': as 'count', then that wall's owner
   * throws too and both totals count the stacks. 'own': East always breaks East's own wall.
   */
  method: 'count' | 'twice' | 'own';
  /** The marked section at the back of the wall, if any. */
  segment: 'flower' | 'dead' | 'last16' | 'loose' | 'none';
}

const RIICHI = /^(riichi|sanma)/;
const AMERICAN = /american|wright-patterson/;
const TAIWAN = /taiwanese|fujian|filipino/;
/** The mainland Chinese family: two throws, the break's two stacks are the loose tiles. */
const TWO_THROWS = /^(classic|mcr|ema|european|beijing|northeast|shanghai|guangdong|wuhan|sichuan|zung-jung)$/;

export function openingRules(profileId: string, deadWall = 0): OpeningRules {
  const id = profileId.split(':')[0];
  if (id.startsWith('india') && id !== 'indian') return { dice: 2, method: 'count', segment: 'flower' };
  if (RIICHI.test(id)) return { dice: 2, method: 'count', segment: deadWall ? 'dead' : 'none' };
  if (AMERICAN.test(id)) return { dice: 2, method: 'own', segment: 'none' };
  if (TAIWAN.test(id)) return { dice: 3, method: 'count', segment: deadWall ? 'last16' : 'loose' };
  if (TWO_THROWS.test(id)) return { dice: 2, method: 'twice', segment: 'loose' };
  // Hong Kong and the South-East Asian, Korean and UAE tables: three dice, one throw.
  return { dice: 3, method: 'count', segment: 'loose' };
}

export interface SeatThrow {
  seat: number;
  values: number[];
}

/** One round of the throw for East: who threw and what each rolled. */
export type EastRound = SeatThrow[];

const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);

/**
 * Everyone throws, the highest total is East; players tied on the highest throw
 * again (only they do) until one is ahead. Fixed by the match seed so every client agrees.
 */
export function eastRoll(matchSeed: number, players: number, dice: number): { rounds: EastRound[]; east: number } {
  const rng = new Rng((matchSeed ^ 0x0ea57d1c) >>> 0);
  let seats = Array.from({ length: players }, (_, i) => i);
  const rounds: EastRound[] = [];
  for (let guard = 0; guard < 20; guard++) {
    const round = seats.map((seat) => ({ seat, values: Array.from({ length: dice }, () => 1 + rng.int(6)) }));
    rounds.push(round);
    const best = Math.max(...round.map((t) => sum(t.values)));
    seats = round.filter((t) => sum(t.values) === best).map((t) => t.seat);
    if (seats.length === 1) return { rounds, east: seats[0] };
  }
  return { rounds, east: seats[0] };
}

export interface WallBreak {
  /** East's throw, and the wall owner's throw under 'twice'. */
  throws: SeatThrow[];
  /** The seat whose wall is broken. */
  wallSeat: number;
  /** Stacks counted from the right end of that wall. */
  count: number;
  /** Ring position (stacks, see the header) of the first live tile. */
  start: number;
  /** Tiles at the back of the wall in the marked section (0 for none). */
  segTiles: number;
  segment: OpeningRules['segment'];
}

/**
 * Where this hand's wall breaks, from the hand's dice (state.dice: up to six values,
 * East's throw first, then the wall owner's). `walls` is always four; `perSide` stacks each.
 */
export function wallBreak(rules: OpeningRules, dice: number[], dealer: number, players: number, perSide: number, deadWall: number): WallBreak {
  const n = rules.dice;
  const first = dice.slice(0, n).map((v) => v || 1);
  const total = sum(first);
  // Walls in front of each seat counted counter-clockwise from East = 1 (four walls even at a three-seat table).
  const wallsAway = rules.method === 'own' ? 0 : (total - 1) % 4;
  const wallSeat = (dealer + wallsAway) % Math.max(1, players);
  const throws: SeatThrow[] = [{ seat: dealer, values: first }];
  let count = total;
  if (rules.method === 'twice') {
    const second = dice.slice(3, 3 + n).map((v) => v || 1);
    throws.push({ seat: wallSeat, values: second });
    count += sum(second);
  }
  // Counter-clockwise from East is ring wall 0, 3, 2, 1 (the ring runs clockwise).
  const ringWall = (4 - wallsAway) % 4;
  const ring = perSide * 4;
  const start = (ringWall * perSide + count) % ring;
  const segTiles =
    rules.segment === 'flower' ? count * 2 : rules.segment === 'dead' || rules.segment === 'last16' ? deadWall : rules.segment === 'loose' ? 4 : 0;
  return { throws, wallSeat, count, start, segTiles, segment: rules.segment };
}
