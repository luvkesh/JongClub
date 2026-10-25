// Tile vocabulary shared by every rule profile.
// A tile "kind" is an index into the 34 standard faces; profiles that need
// more (flowers, jokers) extend the kind space beyond KIND_COUNT.

export type Suit = 'man' | 'pin' | 'sou' | 'wind' | 'dragon';

export const KIND_COUNT = 34;

/** Wind order inside the kind space. Display order is a round-profile concern. */
export const WINDS = ['E', 'S', 'W', 'N'] as const;
export type Wind = (typeof WINDS)[number];

export const WIND_NAMES: Record<Wind, string> = { E: 'East', S: 'South', W: 'West', N: 'North' };

export interface Tile {
  /** Unique physical tile id within a set (0..n-1). */
  id: number;
  kind: number;
}

export function suitOf(kind: number): Suit {
  // Flowers are not a suit; callers check isFlower first.
  if (kind < 9) return 'man';
  if (kind < 18) return 'pin';
  if (kind < 27) return 'sou';
  if (kind < 31) return 'wind';
  return 'dragon';
}

export const isHonor = (kind: number) => kind >= 27;
export const isSuited = (kind: number) => kind < 27;
export const rankOf = (kind: number) => (kind < 27 ? (kind % 9) + 1 : 0);
export const isTerminal = (kind: number) => kind < 27 && (kind % 9 === 0 || kind % 9 === 8);
export const isTerminalOrHonor = (kind: number) => isHonor(kind) || isTerminal(kind);
export const windKind = (w: Wind) => 27 + WINDS.indexOf(w);
export const isDragon = (kind: number) => kind >= 31 && kind <= 33;
export const isWind = (kind: number) => kind >= 27 && kind <= 30;

// Bonus tiles (Taiwanese and other flower games): eight unique tiles that
// never stay in a hand. Kinds 34..37 are the plants, 38..41 the seasons.
export const FLOWER_BASE = KIND_COUNT;
export const FLOWER_COUNT = 8;
export const isFlower = (kind: number) => kind >= FLOWER_BASE && kind < FLOWER_BASE + FLOWER_COUNT;
export const FLOWER_NAMES = ['Plum', 'Orchid', 'Chrysanthemum', 'Bamboo', 'Spring', 'Summer', 'Autumn', 'Winter'];
/** Seat number a flower belongs to: 1 = East, 2 = South, 3 = West, 4 = North. */
export const flowerNumber = (kind: number) => ((kind - FLOWER_BASE) % 4) + 1;

/** American Mahjong joker: wild in sets of three or more, never in pairs or singles. */
export const JOKER_KIND = FLOWER_BASE + FLOWER_COUNT;
export const isJoker = (kind: number) => kind === JOKER_KIND;

// Vietnamese "Khung" jokers: four kinds, two copies each in a Vietnamese set.
// The Flower Joker is a bonus tile (set aside like a flower); the other three
// are wild only inside their own group. Indian club play uses the plain
// JOKER_KIND as an Asian wild (any tile); American keeps its card rules.
export const FLOWER_JOKER = JOKER_KIND + 1;
export const WIND_JOKER = JOKER_KIND + 2;
export const DRAGON_JOKER = JOKER_KIND + 3;
export const NUMBER_JOKER = JOKER_KIND + 4;
export const isTypedJoker = (kind: number) => kind >= FLOWER_JOKER && kind <= NUMBER_JOKER;

// Animal bonus tiles (Singapore / Malaysia): cat, mouse, rooster, centipede.
// Like flowers they never stay in a hand. Cat catches mouse, rooster eats centipede.
export const ANIMAL_BASE = NUMBER_JOKER + 1;
export const ANIMAL_COUNT = 4;
export const CAT = ANIMAL_BASE;
export const MOUSE = ANIMAL_BASE + 1;
export const ROOSTER = ANIMAL_BASE + 2;
export const CENTIPEDE = ANIMAL_BASE + 3;
export const isAnimal = (kind: number) => kind >= ANIMAL_BASE && kind < ANIMAL_BASE + ANIMAL_COUNT;
export const ANIMAL_NAMES = ['Cat', 'Mouse', 'Rooster', 'Centipede'];

/** Every tile kind any profile uses (34 standard, 8 flowers, joker, 4 typed jokers, 4 animals). */
export const TILE_KIND_COUNT = ANIMAL_BASE + ANIMAL_COUNT;

/**
 * Tiles that may stand in for others inside a standard (sets and a pair)
 * hand: the kinds each can represent. Empty for non-wild kinds. The American
 * joker follows its card instead and never comes through here.
 */
export function wildTargets(kind: number): number[] {
  if (kind === JOKER_KIND) return STANDARD_KINDS;
  if (kind === WIND_JOKER) return [27, 28, 29, 30];
  if (kind === DRAGON_JOKER) return [31, 32, 33];
  if (kind === NUMBER_JOKER) return SUITED_KINDS;
  return [];
}
const STANDARD_KINDS = Array.from({ length: 34 }, (_, k) => k);
const SUITED_KINDS = STANDARD_KINDS.slice(0, 27);
/** Can this (wild) kind stand for `target`? */
export const wildCovers = (wild: number, target: number) =>
  wild === JOKER_KIND ? target < 34 : wild === WIND_JOKER ? target >= 27 && target <= 30 : wild === DRAGON_JOKER ? target >= 31 && target <= 33 : wild === NUMBER_JOKER ? target < 27 : false;

// Physical tile ids are fixed per kind across every profile, so the renderer
// and every client agree on which face an id shows:
//   0..135 standard (kind * 4 + copy), 136..143 flowers, 144..151 jokers,
//   152..159 typed jokers (two each: flower, wind, dragon, number), 160..163 animals.
export const EXTRA_ID_BASE = 152;
export const TILE_ID_COUNT = EXTRA_ID_BASE + 8 + ANIMAL_COUNT;

/** The fixed ids a kind's extra copies use (typed jokers and animals). */
export function extraTileIds(kind: number): number[] {
  if (isTypedJoker(kind)) {
    const i = (kind - FLOWER_JOKER) * 2;
    return [EXTRA_ID_BASE + i, EXTRA_ID_BASE + i + 1];
  }
  if (isAnimal(kind)) return [EXTRA_ID_BASE + 8 + kind - ANIMAL_BASE];
  return [];
}

/** The kind a physical tile id always shows (any profile). */
export function kindOfTileId(id: number): number {
  if (id < 136) return Math.floor(id / 4);
  if (id < 136 + FLOWER_COUNT) return FLOWER_BASE + id - 136;
  if (id < EXTRA_ID_BASE) return JOKER_KIND;
  if (id < EXTRA_ID_BASE + 8) return FLOWER_JOKER + Math.floor((id - EXTRA_ID_BASE) / 2);
  return ANIMAL_BASE + id - EXTRA_ID_BASE - 8;
}

const SUIT_NAMES: Record<Suit, string> = {
  man: 'Characters',
  pin: 'Dots',
  sou: 'Bamboo',
  wind: 'Wind',
  dragon: 'Dragon',
};
const DRAGON_NAMES = ['Red Dragon', 'Green Dragon', 'White Dragon'];
const TYPED_JOKER_NAMES = ['Flower Joker', 'Wind Joker', 'Dragon Joker', 'Number Joker'];

/** Human readable name, e.g. "7 Bamboo", "East Wind", "Red Dragon". */
export function tileName(kind: number): string {
  if (isFlower(kind)) return `${FLOWER_NAMES[kind - FLOWER_BASE]} flower`;
  if (isJoker(kind)) return 'Joker';
  if (isTypedJoker(kind)) return TYPED_JOKER_NAMES[kind - FLOWER_JOKER];
  if (isAnimal(kind)) return ANIMAL_NAMES[kind - ANIMAL_BASE];
  const s = suitOf(kind);
  if (s === 'wind') return `${WIND_NAMES[WINDS[kind - 27]]} Wind`;
  if (s === 'dragon') return DRAGON_NAMES[kind - 31];
  const plural = SUIT_NAMES[s];
  return `${rankOf(kind)} ${plural === 'Bamboo' ? 'Bamboo' : plural.replace(/s$/, '')}`;
}

/** Short code, e.g. "7s", "E", "Rd". Handy for logs and tests. */
export function tileCode(kind: number): string {
  if (isFlower(kind)) return `F${kind - FLOWER_BASE + 1}`;
  if (isJoker(kind)) return 'J';
  if (isTypedJoker(kind)) return ['JF', 'JW', 'JD', 'JN'][kind - FLOWER_JOKER];
  if (isAnimal(kind)) return ['Cat', 'Mse', 'Rst', 'Cpd'][kind - ANIMAL_BASE];
  const s = suitOf(kind);
  if (s === 'wind') return WINDS[kind - 27];
  if (s === 'dragon') return ['Rd', 'Gd', 'Wd'][kind - 31];
  return `${rankOf(kind)}${s[0]}`;
}

/** Parse "123m 456p 789s EE Rd" style strings into kinds (tests and puzzles). */
export function parseKinds(spec: string): number[] {
  const out: number[] = [];
  for (const token of spec.trim().split(/\s+/)) {
    if (!token) continue;
    if (token === 'J') {
      out.push(JOKER_KIND);
      continue;
    }
    const typed = ['JF', 'JW', 'JD', 'JN'].indexOf(token);
    if (typed >= 0) {
      out.push(FLOWER_JOKER + typed);
      continue;
    }
    const animal = ['Cat', 'Mse', 'Rst', 'Cpd'].indexOf(token);
    if (animal >= 0) {
      out.push(ANIMAL_BASE + animal);
      continue;
    }
    const flower = token.match(/^F([1-8])$/);
    if (flower) {
      out.push(FLOWER_BASE + Number(flower[1]) - 1);
      continue;
    }
    const suitMatch = token.match(/^(\d+)([mps])$/);
    if (suitMatch) {
      const base = { m: 0, p: 9, s: 18 }[suitMatch[2] as 'm' | 'p' | 's'];
      for (const d of suitMatch[1]) out.push(base + Number(d) - 1);
      continue;
    }
    for (const ch of token.match(/Rd|Gd|Wd|[ESWN]/g) ?? []) {
      if (ch === 'Rd') out.push(31);
      else if (ch === 'Gd') out.push(32);
      else if (ch === 'Wd') out.push(33);
      else out.push(windKind(ch as Wind));
    }
  }
  return out;
}

/** Counts of the 34 standard kinds. Flowers, jokers and animals are not counted. */
export function toCounts(kinds: Iterable<number>): number[] {
  const c = new Array(KIND_COUNT).fill(0);
  for (const k of kinds) if (k < KIND_COUNT) c[k]++;
  return c;
}

export type HandSort = 'suit' | 'number';

/**
 * Hand order. "suit": Characters, Dots, Bamboo, then winds and dragons, each 1 to 9.
 * "number": all the 1s together, then the 2s, and so on, honours after.
 * Flowers and jokers always sit at the end.
 */
export function compareTiles(mode: HandSort) {
  const key = (k: number) => {
    if (mode === 'number' && k < 27) return (k % 9) * 3 + Math.floor(k / 9);
    return k < 27 ? 100 + k : 200 + k;
  };
  return (a: Tile, b: Tile) => (mode === 'number' ? key(a.kind) - key(b.kind) : a.kind - b.kind) || a.id - b.id;
}

export function sortTiles<T extends Tile>(tiles: T[]): T[] {
  return [...tiles].sort((a, b) => a.kind - b.kind || a.id - b.id);
}

// Red fives (Riichi aka dora). The red copies are fixed by tile id so every
// client agrees: the copy with id % 4 === 0 of 5m, 5p and 5s, plus the
// id % 4 === 1 copy of 5p when the table plays four reds.
export const FIVE_KINDS = [4, 13, 22] as const;

/** Tile ids that are red for a red-five count of 0, 3 or 4. */
export function redFiveIds(count: number): number[] {
  if (count <= 0) return [];
  const ids = FIVE_KINDS.map((k) => k * 4);
  if (count >= 4) ids.push(13 * 4 + 1);
  return ids.sort((a, b) => a - b);
}

/** Is this physical tile a red five this hand? Reads `state.red`. */
export const isRed = (state: { red?: number[] }, tileId: number) => !!state.red?.includes(tileId);
