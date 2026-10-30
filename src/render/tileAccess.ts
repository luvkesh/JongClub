// Accessibility for tile faces: the suit-marked corner index, colour-blind-safe
// and high-contrast inks, and the large-hand scale. Pure data and functions, so
// the rules are testable without a canvas; tileFaces.ts draws with them and
// ui/accessibility.ts owns the settings that switch them.

import type { TileSetStyle } from '../cosmetics/catalog';
import { ANIMAL_BASE, FLOWER_BASE, FLOWER_JOKER, WINDS, flowerNumber, isAnimal, isFlower, isJoker, isTypedJoker, rankOf, suitOf } from '../engine/tiles';

/** How faces are drawn for players who need more than colour to tell tiles apart. */
export const FACE_ACCESS = {
  /** A corner index on every face: number plus a suit mark ("5●", "3║", "7万"). */
  suitMarks: false,
  /** Inks that stay distinct with red-green colour blindness. */
  colourSafe: false,
  /** A plain bright face with dark, saturated ink. */
  highContrast: false,
};
export type FaceAccess = typeof FACE_ACCESS;

/** The suit mark drawn after the number; each is a distinct shape, not just a colour. */
export type SuitMark = 'dot' | 'bamboo' | 'char' | 'dragon' | 'plant' | 'season' | 'none';

const MARK_TEXT: Record<SuitMark, string> = { dot: '●', bamboo: '║', char: '万', dragon: '◆', plant: '✿', season: '☀', none: '' };

export interface TileIndex {
  /** The number or letter. */
  text: string;
  mark: SuitMark;
  /** Which of the set's inks the index uses. */
  ink: 'ink' | 'red' | 'green' | 'blue';
}

/**
 * The suit-marked corner index for a tile kind: suited tiles show their number
 * and suit ("5●" dots, "3║" bamboo, "7万" characters), winds their letter
 * (E S W N), dragons R G W with a diamond (so the White Dragon never reads as
 * West), flowers their seat number with a blossom (plants) or sun (seasons),
 * jokers J (Vietnamese jokers name their group: JF JW JD JN) and animals a
 * short name.
 */
/** Dragon corner names, written in full so White never reads as West's "W". */
export const DRAGON_INDEX = ['RED', 'GREEN', 'WHITE'] as const;

export function tileIndex(kind: number): TileIndex {
  if (isJoker(kind)) return { text: 'J', mark: 'none', ink: 'red' };
  if (isFlower(kind)) {
    const i = kind - FLOWER_BASE;
    return { text: String(flowerNumber(kind)), mark: i < 4 ? 'plant' : 'season', ink: i < 4 ? (i % 2 ? 'green' : 'red') : 'blue' };
  }
  if (isTypedJoker(kind)) {
    const i = kind - FLOWER_JOKER;
    return { text: 'J' + 'FWDN'[i], mark: 'none', ink: (['red', 'blue', 'green', 'ink'] as const)[i] };
  }
  if (isAnimal(kind)) {
    const i = kind - ANIMAL_BASE;
    return { text: ['Cat', 'Mou', 'Roo', 'Cen'][i], mark: 'none', ink: 'ink' };
  }
  const s = suitOf(kind);
  if (s === 'wind') return { text: WINDS[kind - 27], mark: 'none', ink: 'ink' };
  if (s === 'dragon') return { text: DRAGON_INDEX[kind - 31], mark: 'dragon', ink: (['red', 'green', 'blue'] as const)[kind - 31] };
  const n = String(rankOf(kind));
  if (s === 'pin') return { text: n, mark: 'dot', ink: 'blue' };
  if (s === 'sou') return { text: n, mark: 'bamboo', ink: 'green' };
  return { text: n, mark: 'char', ink: 'red' };
}

/** The index as plain text, e.g. "5●", "3║", "7万", "E", "R◆", "2✿", "JW". */
export const tileIndexLabel = (kind: number) => {
  const t = tileIndex(kind);
  return t.text + MARK_TEXT[t.mark];
};

// Inks chosen from Paul Tol's colour-blind-safe schemes: red, green and blue
// suits become rose, ochre and deep blue, which differ in lightness and on the
// blue-yellow axis that red-green colour blindness keeps.
const SAFE_LIGHT = { red: '#b2435a', green: '#9a6700', blue: '#00428a' };
const SAFE_DARK = { red: '#ff8fa3', green: '#f0c040', blue: '#8ec5ff' };

/**
 * A tile set's style adjusted for the accessibility options. High contrast
 * gives every set a plain bright porcelain face and near-black ink (the set's
 * back, body and trim stay, so it still feels like the chosen set).
 */
export function accessibleStyle(st: TileSetStyle, o: FaceAccess = FACE_ACCESS): TileSetStyle {
  if (!o.colourSafe && !o.highContrast) return st;
  const next: TileSetStyle = { ...st, ink: [...st.ink] as TileSetStyle['ink'] };
  const dark = luma(st.face[0]) < 0.4;
  if (o.highContrast) {
    next.face = ['#ffffff', '#f2f0ea'];
    next.ground = 'porcelain';
    next.inkStyle = 'flat';
    next.gloss = 0;
    next.font = 'sans';
    next.ink = o.colourSafe ? ['#000000', '#a3243f', '#7a5200', '#00306b'] : ['#000000', '#c00000', '#006b2e', '#0033a0'];
    next.aka = o.colourSafe ? '#a3243f' : '#c00000';
    return next;
  }
  const safe = dark ? SAFE_DARK : SAFE_LIGHT;
  next.ink = [st.ink[0], safe.red, safe.green, safe.blue];
  next.aka = safe.red;
  return next;
}

/** Relative brightness 0..1 of a #rrggbb colour. */
function luma(hex: string) {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

// ------------------------------------------------------------ large tiles and motion

let handScale = 1;
let reduceMotion = false;

/** Extra scale for the player's own hand (3D rack): 1, or larger in large-tile mode. */
export const handTileScale = () => handScale;
export function setHandTileScale(s: number) {
  handScale = s;
}

/** The player turned on Reduce motion in Settings (the device setting is checked separately). */
export const reduceMotionSetting = () => reduceMotion;
export function setReduceMotionSetting(on: boolean) {
  reduceMotion = on;
}
