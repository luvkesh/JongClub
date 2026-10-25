// The Dubai club card for Taiwanese Mahjong: 16-tile hands scored line by
// line from a printed cheat sheet (hands, pongs, sheungs, flowers, winning
// tile, specials and penalties), points added up rather than tai.
// The card is one club's sheet, not an official ruleset. Where it is terse,
// `how` says how JongClub reads the line.
// Card words: Sheung = chow, Gong = kong, NEWS = the four winds,
// GRW = the three dragons, Craks = characters, Circles = dots.

import { waits, type SpecialShape } from '../hand';
import { FLOWER_BASE, KIND_COUNT, WINDS, flowerNumber, isDragon, isHonor, isSuited, isTerminal, isWind, suitOf, windKind } from '../tiles';
import type { Wind } from '../tiles';
import type { HandScore, InstantEvent, Payment, ScoreItem, ScoringContext } from './types';

export interface CardLine {
  id: string;
  /** Points, or a bonus such as "+10". */
  pts: number;
  plus?: boolean;
  label: string;
  detail?: string;
  /** How JongClub reads a terse line. */
  how?: string;
}
export interface CardSection {
  title: string;
  lines: CardLine[];
  /** Sub-headings inside a section (Winds, Dragons...), keyed by the first line id under them. */
  heads?: Record<string, string>;
}

const L = (id: string, pts: number, label: string, detail?: string, how?: string, plus = false): CardLine => ({ id, pts, label, detail, how, plus });

export const DUBAI_CARD: CardSection[] = [
  {
    title: 'Hands',
    lines: [
      L('allHonours', 140, 'All Honours', '5 Pongs/Gongs + 1 Pair, all of Winds/Dragons'),
      L('oneSuit', 90, 'One Suit', '5 Sets + 1 Pair; one suit only'),
      L('orphans13', 90, '13 Orphans', 'NEWS + GRW + 1 & 9 (each suit) + 1 tile (to pair) + 1 Pong/Sheung', 'The Pong or Sheung may be called.'),
      L('neighbours', 80, 'Neighbours/Uncles', '5 Pongs/Gongs + 1 Pair, consecutive + 1 suit'),
      L('orphans16', 50, '16 Orphans', 'NEWS + GRW + 258 + 147 + 369 + 1 tile (to pair)', 'Concealed. The three number groups are in three different suits (the printed card says 158; 147 is the usual knitted group).'),
      L('terminalsOnly', 40, 'Terminals Only', '5 Sets + 1 Pair; Terminals only'),
      L('nicoNico', 40, 'Nico Nico', '7 Pairs (any) + 1 concealed Pong', 'Concealed.'),
      L('nicoGong1', 10, 'Nico Nico with 1 Gong', 'concealed, not declared', 'Four of a tile held as two pairs.', true),
      L('nicoGong2', 25, 'Nico Nico with 2 Gongs', 'concealed, not declared', undefined, true),
      L('sisterBrother', 35, 'Sister-Brother', '5 Sheungs of same sequence in diff suits + 1 Pair (any)', 'All five Sheungs on the same numbers, in at least two suits.'),
      L('semiPure', 30, 'Semi Pure', '5 Sets + 1 Pair; Honours + One Suit'),
      L('allPong', 25, 'All Pong', '5 Pongs (any) + 1 Pair'),
      L('terminalsHonours', 20, 'Terminals + Honours', '5 Sets + 1 Pair'),
      L('allStepUp', 20, 'All Step Up', '5 Sheungs + 1 Pair (any)', 'Five Sheungs in one suit, each one step up (123 234 345 456 567).'),
      L('chicken', 20, 'Chicken', 'Hand adds up to only 1 point before Mahjong'),
      L('jade', 20, 'Jade', '5 Sets + 1 Pair, Green Dragon + Bamboos only'),
      L('ruby', 20, 'Ruby', '5 Sets + 1 Pair, Red Dragon + Craks only'),
      L('diamond', 20, 'Diamond', '5 Sets + 1 Pair, White Dragon + Circles only'),
      L('sapphire', 20, 'Sapphire', '5 Sets + 1 Pair, White Dragon + Craks only'),
      L('allSheungClean', 15, 'All Sheung with No Flowers/Honours', '5 Sheungs + 1 Pair'),
      L('allFiveSuits', 10, 'All 5 Suits', '5 Sets + 1 Pair, with all 5 suits', 'Craks, Bamboos, Circles, Winds and Dragons.'),
      L('twoSuits', 5, '2 Suits', '5 Sets + 1 Pair, with only 2 suits; no Honours'),
      L('allSheung', 5, 'All Sheung with Flowers/Honours', '5 Sheungs + 1 Pair'),
      L('goodEyes', 2, 'Good Eyes', "Pair of 2's / 5's / 8's of any suit"),
    ],
  },
  {
    title: 'General',
    lines: [
      L('mahjong', 5, 'Mahjong'),
      L('noFlowers', 1, 'No Flowers'),
      L('noHonours', 1, 'No Honours'),
      L('noFlowersNoHonours', 5, 'No Flowers + No Honours', undefined, 'Replaces the two lines above.'),
      L('noTerminalsNoHonours', 5, 'No Terminals + No Honours'),
    ],
  },
  {
    title: 'Flowers',
    lines: [
      L('eachFlower', 1, 'Each Flower'),
      L('seatFlower', 1, 'Flower of Player’s seat', undefined, 'Each flower numbered for your seat (East 1, South 2, West 3, North 4).', true),
      L('mixedBouquet', 5, 'Mixed Bouquet', undefined, 'Flowers numbered 1, 2, 3 and 4, mixing plants and seasons.'),
      L('pureBouquet', 10, 'Pure Bouquet', undefined, 'All four plants, or all four seasons.'),
      L('sevenFlowers', 20, '7 Flowers (instant win)', undefined, 'Holding seven, you take the eighth from whoever draws it; they pay.'),
      L('eightFlowers', 40, '8 Flowers (instant win)', undefined, 'Everyone pays.'),
    ],
  },
  {
    title: 'Winning Tile',
    lines: [
      L('eastWins', 1, 'East wins'),
      L('eastGives', 1, 'East gives winning tile'),
      L('selfWall', 2, 'Self Draw: Wall'),
      L('selfFlowerWall', 5, 'Self Draw: Flower Wall', undefined, 'Self-drawn on a replacement tile, after a flower or a Gong.'),
      L('selfConcealed', 10, 'Self Draw: Concealed Hand', undefined, 'Nothing called (concealed Gongs are fine).'),
      L('selfExposed', 10, 'Self Draw: Fully Exposed', undefined, 'All five sets called.'),
      L('discardConcealed', 5, 'Discard: Concealed Hand'),
      L('discardExposed', 15, 'Discard: Fully Exposed'),
      L('robGong', 10, 'Discard: Robbing a Gong'),
      L('callingPairs', 2, 'Calling by Pairs', undefined, 'Waiting on either of two pairs.'),
      L('trueSingle', 2, 'True Single Wait', undefined, 'Only one tile could complete the hand.'),
      L('falseSingle', 2, 'False Single Wait', undefined, 'Won on the pair tile while other tiles would also have won.'),
    ],
  },
  {
    title: 'Pongs',
    heads: { windPong: 'Winds', dragonPong: 'Dragons', concealed2: 'Concealed Pongs', sisterPongs2: 'Sister Pongs', terminalPong1: 'Terminal Pongs', neighbour2: 'Neighbours/Uncle Pongs', concealedGong: 'Gongs' },
    lines: [
      L('windPong', 1, 'Pong of Winds'),
      L('seatWindPong', 1, 'Pong of Player’s Seat Wind', undefined, undefined, true),
      L('roundWindPong', 1, 'Pong of Round Wind', undefined, undefined, true),
      L('little3Winds', 15, 'Little 3 Winds', '2 Pongs + 1 Pair'),
      L('big3Winds', 30, 'Big 3 Winds', '3 Pongs of Winds'),
      L('little4Winds', 50, 'Little 4 Winds', '3 Pongs + 1 Pair'),
      L('big4Winds', 60, 'Big 4 Winds', '4 Pongs of Winds'),
      L('dragonPong', 2, 'Pong of Dragons'),
      L('littleDragons', 20, 'Little Dragons', '2 Pongs + 1 Pair'),
      L('bigDragons', 40, 'Big Dragons', '3 Pongs'),
      L('concealed2', 5, '2 Concealed Pongs', undefined, 'Concealed Gongs count; a Pong finished on a discard does not.'),
      L('concealed3', 10, '3 Concealed Pongs'),
      L('concealed4', 15, '4 Concealed Pongs'),
      L('concealed5', 80, '5 Concealed Pongs'),
      L('sisterPongs2', 3, '2 Sister Pongs', undefined, 'Same number in different suits (111 Craks + 111 Circles).'),
      L('sisterPongs3', 10, '3 Sister Pongs'),
      L('terminalPong1', 3, '1 Terminal Pong Set', undefined, 'A Pong of 1s and a Pong of 9s in one suit.'),
      L('terminalPong2', 15, '2 Terminal Pong Sets'),
      L('neighbour2', 5, '2 Sets', '111 + 222', 'Consecutive Pongs in one suit.'),
      L('neighbour3', 15, '3 Sets', '111 + 222 + 333'),
      L('neighbour4', 30, '4 Sets', '111 + 222 + 333 + 444'),
      L('neighbour5', 60, '5 Sets', '111 + 222 + 333 + 444 + 555', 'Scored as the Neighbours/Uncles hand instead.'),
      L('concealedGong', 2, 'Concealed Gong'),
      L('gongPaid', 5, 'immediately from other players', undefined, 'Each other player pays 5 the moment the concealed Gong is declared.', true),
      L('exposedGong', 1, 'Exposed Gong'),
    ],
  },
  {
    title: 'Sheungs',
    heads: { terminalSheung1: 'Terminal Sheungs', sisterSheung2: 'Sister Sheungs', brotherSheung2: 'Brother Sheungs', mixedDragonExposed: 'Dragon Sequence', stepUp: 'Step up Sheung' },
    lines: [
      L('terminalSheung1', 3, '1 Terminal Sheung Set', undefined, '123 and 789 in one suit.'),
      L('terminalSheungMixed', 15, '2 Terminal Mixed Sheung Sets', undefined, 'Two such sets in different suits.'),
      L('terminalSheungPure', 20, '2 Terminal Pure Sheung Sets', undefined, 'Two such sets in the same suit.'),
      L('sisterSheung2', 3, '2 Sister Sheungs', undefined, 'The same numbers in different suits (123 Craks + 123 Bamboos).'),
      L('sisterSheung3', 10, '3 Sister Sheungs'),
      L('brotherSheung2', 5, '2 Brother Sheungs', undefined, 'Identical Sheungs in the same suit.'),
      L('brotherSheung3', 15, '3 Brother Sheungs'),
      L('brotherSheung4', 30, '4 Brother Sheungs'),
      L('mixedDragonExposed', 5, 'Mixed Dragon (exposed)', undefined, '123, 456 and 789 in three different suits; exposed if any of them was called.'),
      L('mixedDragonConcealed', 10, 'Mixed Dragon (concealed)'),
      L('pureDragonExposed', 10, 'Pure Dragon (exposed)', undefined, '123, 456 and 789 in one suit.'),
      L('pureDragonConcealed', 20, 'Pure Dragon (concealed)'),
      L('stepUp', 5, '3 Sheungs', '123 + 234 + 345', 'In one suit, each one step up.'),
    ],
  },
  {
    title: 'General (more)',
    lines: [
      L('four2', 5, 'Four in 2 ways', undefined, 'All four of a tile used across two sets, without declaring a Gong.'),
      L('four3', 10, 'Four in 3 ways'),
      L('four4', 20, 'Four in 4 ways'),
      L('calling', 5, 'Closing/Calling', undefined, 'Press Call with a ready, concealed hand: it locks, and you win with the next tile that completes it.'),
      L('dice15', 5, 'Triple on dice (Nos 1 - 5)', undefined, 'Three of a kind on this hand’s dice; the winner scores it.'),
      L('dice6', 10, 'Triple on dice (No 6)'),
    ],
  },
  {
    title: 'Special',
    lines: [
      L('eastDealt', 100, 'East is dealt Mahjong'),
      L('earthly', 90, 'Earthly Hand', 'Win by East’s first discard'),
      L('within4', 80, 'Win within 4 tiles', undefined, 'Counts the tiles you take this hand: draws, calls and the winning tile.'),
      L('within7', 20, 'Win within 7 tiles'),
      L('within10', 10, 'Win within 10 tiles'),
      L('lastTile', 10, 'Win on last tile of wall (self)'),
    ],
  },
  {
    title: 'Penalty',
    lines: [
      L('drawGame', 5, 'Draw Game (in bank)', undefined, 'Each player puts 5 in the bank; the next winner collects it.'),
      L('chaseHonour', 5, 'Chasing Tiles (Wind/Dragon tile)', undefined, 'Everyone follows East’s first discard with the same tile: East pays each player.'),
      L('chaseSuit', 10, 'Chasing Tiles (Suit tile)'),
      L('falseMahjong', 25, 'False Mahjong', undefined, 'Can’t happen here: the table only lets you declare a real win.'),
    ],
  },
];

const LINES = new Map(DUBAI_CARD.flatMap((s) => s.lines.map((l) => [l.id, l] as const)));
export const cardLine = (id: string) => LINES.get(id)!;

/** Starting points at a Dubai card table; one card point is one point at the table. */
export const DUBAI_START = 1000;

// ------------------------------------------------------------ special shapes

const sum = (c: number[]) => c.reduce((a, b) => a + b, 0);
const ORPHANS = Array.from({ length: KIND_COUNT }, (_, k) => k).filter((k) => isHonor(k) || isTerminal(k));
const HONOURS = [27, 28, 29, 30, 31, 32, 33];
/** 147 / 258 / 369 in three different suits. */
const KNITTED = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
].map((perm) => [...HONOURS, ...perm.flatMap((start, suit) => [0, 3, 6].map((r) => suit * 9 + start + r))]);

const isSet3 = (c: number[]) => {
  const ks = c.flatMap((n, k) => Array(n).fill(k) as number[]);
  if (ks.length !== 3) return false;
  if (ks[0] === ks[2]) return true;
  return isSuited(ks[0]) && suitOf(ks[0]) === suitOf(ks[2]) && ks[1] === ks[0] + 1 && ks[2] === ks[0] + 2;
};

/** Full tile count for a 16-tile game: 17 with the winning tile, 3 fewer per declared meld. */
const fullCount = (m: number) => 17 - 3 * m;

/** Make an approximate shanten exact where it matters (complete or ready). */
function exact(approx: number, complete: (c: number[], m: number) => boolean, counts: number[], m: number): number {
  const total = sum(counts);
  if (total === fullCount(m)) return complete(counts, m) ? -1 : Math.max(0, approx);
  if (total === fullCount(m) - 1 && approx <= 0) {
    for (let k = 0; k < KIND_COUNT; k++) {
      if (counts[k] >= 4) continue;
      counts[k]++;
      const ok = complete(counts, m);
      counts[k]--;
      if (ok) return 0;
    }
    return 1;
  }
  return approx;
}

function orphans13(counts: number[], m: number): boolean {
  if (m > 1 || sum(counts) !== fullCount(m)) return false;
  const c = counts.slice();
  for (const k of ORPHANS) {
    if (!c[k]) return false;
    c[k]--;
  }
  for (const p of ORPHANS) {
    if (!c[p]) continue;
    c[p]--;
    const ok = m === 1 ? sum(c) === 0 : isSet3(c);
    c[p]++;
    if (ok) return true;
  }
  return false;
}

function orphans13Shanten(counts: number[], m: number): number {
  if (m > 1) return 99;
  const c = counts.slice();
  let kinds = 0;
  for (const k of ORPHANS)
    if (c[k]) {
      kinds++;
      c[k]--;
    }
  const pairKind = ORPHANS.find((k) => c[k] > 0);
  if (pairKind !== undefined) c[pairKind]--;
  let set = m === 1 ? 3 : 0;
  for (let k = 0; k < KIND_COUNT && set < 3; k++) {
    set = Math.max(set, Math.min(3, c[k]));
    if (isSuited(k) && k % 9 <= 6) set = Math.max(set, [k, k + 1, k + 2].filter((x) => c[x] > 0).length);
  }
  const approx = 13 - kinds + (pairKind === undefined ? 1 : 0) + (3 - set) - 1;
  return exact(approx, orphans13, counts, m);
}

function orphans16(counts: number[], m: number): boolean {
  if (m > 0 || sum(counts) !== 17) return false;
  return KNITTED.some((ks) => ks.every((k) => counts[k] >= 1) && ks.reduce((a, k) => a + counts[k], 0) === 17 && ks.filter((k) => counts[k] === 2).length === 1);
}

function orphans16Shanten(counts: number[], m: number): number {
  if (m > 0) return 99;
  let best = 99;
  for (const ks of KNITTED) {
    const present = ks.filter((k) => counts[k] >= 1).length;
    const pair = ks.some((k) => counts[k] >= 2) ? 0 : 1;
    best = Math.min(best, 16 - present + pair - 1);
  }
  return exact(best, orphans16, counts, m);
}

export function nicoNico(counts: number[], m: number): boolean {
  if (m > 0 || sum(counts) !== 17) return false;
  return counts.every((n) => n === 0 || n === 2 || n === 3 || n === 4) && counts.filter((n) => n === 3).length === 1;
}

export function nicoShanten(counts: number[], m: number): number {
  if (m > 0) return 99;
  let best = 99;
  for (let t = 0; t < KIND_COUNT; t++) {
    const tp = Math.min(3, counts[t]);
    let pairs = 0;
    let singles = 0;
    for (let k = 0; k < KIND_COUNT; k++) {
      const n = k === t ? counts[k] - tp : counts[k];
      pairs += Math.floor(n / 2);
      singles += n % 2;
    }
    const need = 7 - Math.min(7, pairs);
    const fromSingles = Math.min(need, singles);
    best = Math.min(best, 3 - tp + fromSingles + 2 * (need - fromSingles) - 1);
  }
  return exact(best, nicoNico, counts, m);
}

export const DUBAI_SPECIAL: SpecialShape[] = [
  { name: 'orphans13', complete: orphans13, shanten: orphans13Shanten },
  { name: 'orphans16', complete: orphans16, shanten: orphans16Shanten },
  { name: 'nicoNico', complete: nicoNico, shanten: nicoShanten },
];
export const DUBAI_SHAPES = { sevenPairs: false, thirteenOrphans: false, sets: 5, special: DUBAI_SPECIAL };

// ------------------------------------------------------------ scoring

type Adder = (id: string, times?: number, note?: string) => void;

/** Flower lines: each flower, seat flowers, bouquets. */
function flowerLines(flowers: number[], seatWind: Wind, add: Adder) {
  if (!flowers.length) return;
  add('eachFlower', flowers.length);
  const seatNo = WINDS.indexOf(seatWind) + 1;
  const seat = flowers.filter((f) => flowerNumber(f) === seatNo).length;
  if (seat) add('seatFlower', seat);
  let pure = 0;
  for (const from of [FLOWER_BASE, FLOWER_BASE + 4]) if ([0, 1, 2, 3].every((i) => flowers.includes(from + i))) pure++;
  if (pure) add('pureBouquet', pure);
  else if ([1, 2, 3, 4].every((n) => flowers.some((f) => flowerNumber(f) === n))) add('mixedBouquet');
}

function scoreOf(items: ScoreItem[]): HandScore {
  const value = items.reduce((a, b) => a + b.value, 0);
  return { value, unit: 'pt', items, points: value, limit: false };
}

function adder(items: ScoreItem[]): Adder {
  return (id, times = 1, note) => {
    const l = cardLine(id);
    items.push({ name: times > 1 ? `${l.label} × ${times}` : l.label, value: l.pts * times, note: note ?? l.detail });
  };
}

export function dubaiScore(ctx: ScoringContext): HandScore {
  const items: ScoreItem[] = [];
  const add = adder(items);
  const d = ctx.decomposition;
  const flowers = ctx.flowers ?? [];

  type S = { type: 'pung' | 'chow' | 'kong'; kind: number; concealed: boolean; declared: boolean };
  const sets: S[] = ctx.melds.map((m) => ({ type: m.type, kind: Math.min(...m.tiles.map((t) => t.kind)), concealed: m.concealed, declared: true }));
  // On a discard win the set the tile completes is not concealed, unless this
  // reading can place the tile in the pair or a chow instead.
  const winElsewhere = d.pair === ctx.winKind || d.sets.some((s) => s.type === 'chow' && ctx.winKind >= s.kind && ctx.winKind <= s.kind + 2);
  let claimed = false;
  for (const s of d.sets) {
    if (s.type === 'pair') continue;
    const byDiscard = !ctx.selfDrawn && !winElsewhere && !claimed && s.type === 'pung' && s.kind === ctx.winKind;
    if (byDiscard) claimed = true;
    sets.push({ type: s.type, kind: s.kind, concealed: !byDiscard, declared: false });
  }

  const allKinds: number[] = [];
  for (let k = 0; k < KIND_COUNT; k++) for (let i = 0; i < ctx.concealedCounts[k]; i++) allKinds.push(k);
  for (const m of ctx.melds) for (const t of m.tiles) allKinds.push(t.kind);
  const suits = new Set(allKinds.filter(isSuited).map(suitOf));
  const hasHonor = allKinds.some(isHonor);
  const hasTerminal = allKinds.some(isTerminal);
  const exposedMelds = ctx.melds.filter((m) => !m.concealed).length;
  const concealedHand = exposedMelds === 0;
  const special = d.shape === 'special' ? d.special : undefined;

  // ---- hands
  if (special === 'orphans13') add('orphans13');
  else if (special === 'orphans16') add('orphans16');
  else if (special === 'nicoNico') {
    add('nicoNico');
    const gongs = ctx.concealedCounts.filter((n) => n === 4).length;
    if (gongs >= 2) add('nicoGong2');
    else if (gongs === 1) add('nicoGong1');
  }
  const orphan = special === 'orphans13' || special === 'orphans16';

  const pongs = sets.filter((s) => s.type !== 'chow');
  const chows = sets.filter((s) => s.type === 'chow');
  const standard = d.shape === 'standard';
  const pairKind = standard ? d.pair : -1;
  /** Full sets-and-pair hand (or Nico Nico, for the colour lines). */
  const colourHand = !orphan;

  if (colourHand) {
    if (allKinds.every(isHonor)) add('allHonours');
    else if (suits.size === 1 && !hasHonor) add('oneSuit');
    else if (suits.size === 1) add('semiPure');
    if (!allKinds.every(isHonor)) {
      if (allKinds.every(isTerminal)) add('terminalsOnly');
      else if (allKinds.every((k) => isTerminal(k) || isHonor(k)) && hasHonor) add('terminalsHonours');
    }
    const only = (suit: string, dragon: number) => allKinds.every((k) => k === dragon || (isSuited(k) && suitOf(k) === suit)) && allKinds.includes(dragon);
    if (only('sou', 32)) add('jade');
    if (only('man', 31)) add('ruby');
    if (only('pin', 33)) add('diamond');
    if (only('man', 33)) add('sapphire');
  }

  // Runs of consecutive pongs in one suit (Neighbours).
  const pongKinds = new Set(pongs.map((p) => p.kind));
  const runs: number[] = [];
  for (const k of [...pongKinds].sort((a, b) => a - b)) {
    if (!isSuited(k) || (k % 9 > 0 && pongKinds.has(k - 1))) continue;
    let n = 1;
    while (k % 9 + n <= 8 && pongKinds.has(k + n)) n++;
    if (n >= 2) runs.push(n);
  }
  const neighboursHand = standard && runs.includes(5);
  if (neighboursHand) add('neighbours');

  // Sheung families.
  const chowStarts = chows.map((c) => c.kind);
  const sameNumbers = chows.length === 5 && new Set(chowStarts.map((k) => k % 9)).size === 1 && new Set(chowStarts.map(suitOf)).size >= 2;
  if (sameNumbers) add('sisterBrother');
  const sorted = [...chowStarts].sort((a, b) => a - b);
  const allStepUp = chows.length === 5 && new Set(sorted.map(suitOf)).size === 1 && sorted.every((k, i) => k === sorted[0] + i);
  if (allStepUp) add('allStepUp');

  if (standard && pongs.length === 5) add('allPong');
  if (standard && chows.length === 5) {
    if (!hasHonor && !flowers.length) add('allSheungClean');
    else add('allSheung');
  }
  if (colourHand && ['man', 'pin', 'sou', 'wind', 'dragon'].every((s) => allKinds.some((k) => suitOf(k) === s))) add('allFiveSuits');
  if (colourHand && suits.size === 2 && !hasHonor) add('twoSuits');
  if (standard && isSuited(pairKind) && [1, 4, 7].includes(pairKind % 9)) add('goodEyes');

  // ---- general
  add('mahjong');
  if (!flowers.length && !hasHonor) add('noFlowersNoHonours');
  else if (!flowers.length) add('noFlowers');
  else if (!hasHonor && hasTerminal) add('noHonours');
  if (!hasHonor && !hasTerminal) add('noTerminalsNoHonours');

  // ---- flowers
  flowerLines(flowers, ctx.seatWind, add);

  // ---- winning tile
  if (ctx.isDealer) add('eastWins');
  if (!ctx.selfDrawn && ctx.discarderIsDealer) add('eastGives');
  const fullyExposed = exposedMelds === 5;
  if (ctx.selfDrawn) {
    add(ctx.afterFlower || ctx.afterKong ? 'selfFlowerWall' : 'selfWall');
    if (concealedHand) add('selfConcealed');
    else if (fullyExposed) add('selfExposed');
  } else {
    if (concealedHand) add('discardConcealed');
    else if (fullyExposed) add('discardExposed');
    if (ctx.robbedKong) add('robGong');
  }
  const before = ctx.concealedCounts.slice();
  before[ctx.winKind]--;
  const w = waits(before, ctx.melds.length, DUBAI_SHAPES);
  const pairWait = standard && d.pair === ctx.winKind && before[ctx.winKind] === 1;
  if (w.length === 2 && w.every((k) => before[k] === 2)) add('callingPairs');
  else if (w.length === 1) add('trueSingle');
  else if (pairWait) add('falseSingle');

  // ---- pongs
  const windPongs = pongs.filter((p) => isWind(p.kind));
  const dragonPongs = pongs.filter((p) => isDragon(p.kind));
  const windPair = isWind(pairKind);
  if (windPongs.length === 4) add('big4Winds');
  else if (windPongs.length === 3 && windPair) add('little4Winds');
  else if (windPongs.length === 3) add('big3Winds');
  else if (windPongs.length === 2 && windPair) add('little3Winds');
  else if (windPongs.length) add('windPong', windPongs.length);
  if (windPongs.some((p) => p.kind === windKind(ctx.seatWind))) add('seatWindPong');
  if (windPongs.some((p) => p.kind === windKind(ctx.prevailingWind))) add('roundWindPong');
  if (dragonPongs.length === 3) add('bigDragons');
  else if (dragonPongs.length === 2 && isDragon(pairKind)) add('littleDragons');
  else if (dragonPongs.length) add('dragonPong', dragonPongs.length);

  const hidden = pongs.filter((p) => p.concealed).length;
  if (hidden >= 5) add('concealed5');
  else if (hidden >= 2) add(`concealed${hidden}`);

  const suitedPongs = pongs.filter((p) => isSuited(p.kind));
  for (let r = 0; r < 9; r++) {
    const n = new Set(suitedPongs.filter((p) => p.kind % 9 === r).map((p) => suitOf(p.kind))).size;
    if (n >= 2) add(n === 3 ? 'sisterPongs3' : 'sisterPongs2');
  }
  const termPongSets = (['man', 'pin', 'sou'] as const).filter((s) => {
    const base = { man: 0, pin: 9, sou: 18 }[s];
    return pongKinds.has(base) && pongKinds.has(base + 8);
  }).length;
  if (termPongSets >= 2) add('terminalPong2');
  else if (termPongSets === 1) add('terminalPong1');
  if (!neighboursHand) for (const n of runs) add(`neighbour${Math.min(n, 5)}`);

  const kongs = sets.filter((s) => s.type === 'kong');
  const cGongs = kongs.filter((s) => s.concealed).length;
  const eGongs = kongs.length - cGongs;
  if (cGongs) add('concealedGong', cGongs);
  if (eGongs) add('exposedGong', eGongs);

  // ---- sheungs
  const perSuit = (['man', 'pin', 'sou'] as const).map((s) => {
    const base = { man: 0, pin: 9, sou: 18 }[s];
    return Math.min(chowStarts.filter((k) => k === base).length, chowStarts.filter((k) => k === base + 6).length);
  });
  const termSheung = perSuit.reduce((a, b) => a + b, 0);
  if (termSheung >= 2) add(perSuit.some((n) => n >= 2) ? 'terminalSheungPure' : 'terminalSheungMixed');
  else if (termSheung === 1) add('terminalSheung1');
  if (!sameNumbers) {
    for (let r = 0; r < 7; r++) {
      const n = new Set(chowStarts.filter((k) => k % 9 === r).map(suitOf)).size;
      if (n >= 2) add(n === 3 ? 'sisterSheung3' : 'sisterSheung2');
    }
    for (const k of new Set(chowStarts)) {
      const n = chowStarts.filter((x) => x === k).length;
      if (n >= 2) add(`brotherSheung${Math.min(n, 4)}`);
    }
  }
  // Dragon sequence: 123 456 789.
  const straight = (pick: (r: number) => S | undefined) => [0, 3, 6].map(pick);
  let dragonDone = false;
  for (const base of [0, 9, 18]) {
    const run = straight((r) => chows.find((c) => c.kind === base + r));
    if (run.every(Boolean)) {
      add(run.every((c) => !c!.declared) ? 'pureDragonConcealed' : 'pureDragonExposed');
      dragonDone = true;
      break;
    }
  }
  if (!dragonDone) {
    // One chow per number group, all three suits different.
    const options = [0, 3, 6].map((r) => chows.filter((c) => c.kind % 9 === r));
    outer: for (const a of options[0])
      for (const b of options[1])
        for (const c of options[2]) {
          if (new Set([a, b, c].map((x) => suitOf(x.kind))).size !== 3) continue;
          add([a, b, c].every((x) => !x.declared) ? 'mixedDragonConcealed' : 'mixedDragonExposed');
          break outer;
        }
  }
  if (!allStepUp)
    for (const base of [0, 9, 18]) {
      const starts = new Set(chowStarts.filter((k) => k >= base && k < base + 9));
      if ([...starts].some((k) => starts.has(k + 1) && starts.has(k + 2))) add('stepUp');
    }

  // ---- general (more)
  if (standard) {
    const groups: number[][] = sets.map((s) => (s.type === 'chow' ? [s.kind, s.kind + 1, s.kind + 2] : [s.kind]));
    groups.push([d.pair]);
    for (let k = 0; k < KIND_COUNT; k++) {
      if (kongs.some((g) => g.kind === k)) continue;
      if (allKinds.filter((x) => x === k).length !== 4) continue;
      const ways = groups.filter((g) => g.includes(k)).length;
      if (ways >= 2) add(`four${Math.min(ways, 4)}`);
    }
  }
  if (ctx.riichi) add('calling');
  const dice = ctx.dice ?? [];
  if (dice.length === 3 && dice[0] === dice[1] && dice[1] === dice[2]) add(dice[0] === 6 ? 'dice6' : 'dice15', 1, `${dice.join('-')} this hand`);

  // ---- special
  if (ctx.heavenly) add('eastDealt');
  else if (ctx.earthly) add('earthly');
  else if (ctx.tilesTaken !== undefined && ctx.tilesTaken <= 10) add(ctx.tilesTaken <= 4 ? 'within4' : ctx.tilesTaken <= 7 ? 'within7' : 'within10', 1, `${ctx.tilesTaken} tiles taken`);
  if (ctx.lastTileOfWall && ctx.selfDrawn) add('lastTile');

  // Chicken: everything except Mahjong comes to 1 point or less.
  const rest = items.reduce((a, b) => a + b.value, 0) - cardLine('mahjong').pts;
  if (rest <= 1) add('chicken');
  return scoreOf(items);
}

/** Seven or eight flowers win on the spot. */
export function dubaiFlowerWin(flowers: number[][], seatWinds: Wind[], dealer: number): { winner: number; payer: number | null; score: HandScore } | null {
  const score = (seat: number, held: number[], id: 'sevenFlowers' | 'eightFlowers') => {
    const items: ScoreItem[] = [];
    const add = adder(items);
    add(id);
    flowerLines(held, seatWinds[seat], add);
    if (seat === dealer) add('eastWins');
    return scoreOf(items);
  };
  const eight = flowers.findIndex((f) => f.length === 8);
  if (eight >= 0) return { winner: eight, payer: null, score: score(eight, flowers[eight], 'eightFlowers') };
  const seven = flowers.findIndex((f) => f.length === 7);
  const other = flowers.findIndex((f, i) => i !== seven && f.length === 1);
  if (seven >= 0 && other >= 0) {
    const held = [...flowers[seven], ...flowers[other]];
    const s = score(seven, held, 'sevenFlowers');
    if (other === dealer) s.items.push({ name: cardLine('eastGives').label, value: 1 }), (s.value += 1), (s.points += 1);
    return { winner: seven, payer: other, score: s };
  }
  return null;
}

/** Self-draw: everyone pays the card total. Discard: the discarder pays it alone,
 *  or for the whole table under the "pays for all" house rule. */
export function dubaiPayments(full: boolean) {
  return (winner: number, discarder: number | null, s: HandScore, _dealer: number, players: number): Payment[] => {
    if (discarder === null) {
      const out: Payment[] = [];
      for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: s.points });
      return out;
    }
    return [{ from: discarder, to: winner, amount: s.points * (full ? players - 1 : 1) }];
  };
}

/** A concealed Gong collects 5 from each other player on the spot. */
export function dubaiInstant(e: InstantEvent, players: number): Payment[] {
  if (e.type !== 'kong' || !e.concealed) return [];
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) if (p !== e.seat) out.push({ from: p, to: e.seat, amount: cardLine('gongPaid').pts });
  return out;
}

/** Chasing: East pays each player 5 (honour) or 10 (suit tile). */
export function dubaiChase(dealer: number, kind: number, players: number): Payment[] {
  const amount = cardLine(isHonor(kind) ? 'chaseHonour' : 'chaseSuit').pts;
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) if (p !== dealer) out.push({ from: dealer, to: p, amount });
  return out;
}
