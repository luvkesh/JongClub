// Club Season cosmetics: each season is themed on a World Tour destination and
// has its own tile set, table cloth and avatar frame, earned on the season's
// reward track by playing (see club/seasons.ts). Never sold, never random,
// never read by the engine, the AI or the rating system.
//
// Only type imports from catalog.ts, so catalog.ts can spread these lists into
// its own without an import cycle at run time.

import type { Cosmetic, TableStyle, TileSetStyle } from './catalog';
import { tr } from '../i18n';

export interface SeasonTheme {
  /** Theme id, also the suffix of its cosmetic ids. */
  id: string;
  /** The World Tour destination (a variation id). */
  destination: string;
  city: string;
  /** The season's name. */
  name: string;
  /** One line under the name. */
  line: string;
  /** Accent colours for the season screen: [deep, accent, light]. */
  colors: [string, string, string];
}

/** Seasons cycle through these in order (season 1 is the first). */
export const SEASON_THEMES: SeasonTheme[] = [
  { id: 'hongkong', destination: 'hongkong', city: tr('Hong Kong'), name: tr('Harbour Lights'), line: tr('Tea-house afternoons and the harbour after dark.'), colors: ['#0d2b2e', '#d9b45c', '#e9f2ee'] },
  { id: 'tokyo', destination: 'riichi', city: tr('Tokyo'), name: tr('Maple Night'), line: tr('Autumn in the jansō: indigo, maple red and quiet concentration.'), colors: ['#141a33', '#c8452c', '#efe7da'] },
  { id: 'dubai', destination: 'uae', city: tr('Dubai'), name: tr('Desert Rose'), line: tr('Cardamom coffee, rose-coloured sand and long evenings in the majlis.'), colors: ['#2e1a14', '#d8a25a', '#f6e6d2'] },
  { id: 'taipei', destination: 'taiwanese', city: tr('Taipei'), name: tr('Lantern Market'), line: tr('Sixteen tiles, a thousand lanterns and the night market’s glow.'), colors: ['#2a0c08', '#e2683a', '#f8e2c4'] },
  { id: 'singapore', destination: 'singapore', city: tr('Singapore'), name: tr('Garden City'), line: tr('Orchids, shophouses and a warm evening breeze off the marina.'), colors: ['#1d1630', '#b98ad6', '#efe6f6'] },
  { id: 'hanoi', destination: 'vietnamese', city: tr('Hanoi'), name: tr('Lotus Lacquer'), line: tr('Black lacquer, gold leaf and lotus ponds in the Old Quarter.'), colors: ['#120d0a', '#d6a23e', '#f4ead6'] },
];

export const seasonTileSetId = (themeId: string) => `season-${themeId}`;
export const seasonTableId = (themeId: string) => `season-${themeId}`;
export const seasonFrameId = (themeId: string) => `frame-season-${themeId}`;

// ---------------------------------------------------------------- tile sets

const T = (theme: string, s: Omit<TileSetStyle, 'id'>): TileSetStyle => ({ id: seasonTileSetId(theme), ...s });

export const SEASON_TILE_SETS: TileSetStyle[] = [
  T('hongkong', { face: ['#f7f4ea', '#e2dccb'], back: '#0f3b3c', ink: ['#13253a', '#b8322a', '#1d6b55', '#1f4f8a'], gloss: 0.7, material: 'ivory', body: '#efe8d6', bodyFinish: 'ivory', backFinish: 'lacquer', ground: 'ivory', font: 'song', inkStyle: 'flat', frame: 'double', trim: '#d9b45c', motif: 'waves' }),
  T('tokyo', { face: ['#fbf9f4', '#e8e2d6'], back: '#1d2546', ink: ['#1b2142', '#c8452c', '#2b6a4f', '#25407a'], gloss: 0.8, material: 'crystal', body: '#f4f1ea', bodyFinish: 'porcelain', backFinish: 'lacquer', ground: 'porcelain', font: 'brush', inkStyle: 'flat', frame: 'line', trim: '#c8452c', motif: 'fan' }),
  T('dubai', { face: ['#fbf1e4', '#ecd2b4'], back: '#a8613a', ink: ['#3a1e12', '#a8322a', '#2f6a4a', '#2a4a78'], gloss: 0.65, material: 'pearl', body: '#f1dcc4', bodyFinish: 'pearl', backFinish: 'rosegold', ground: 'pearl', font: 'serif', inkStyle: 'inlay', frame: 'corners', trim: '#d8a25a', motif: 'medallion' }),
  T('taipei', { face: ['#f3e6c8', '#dcc69a'], back: '#8a1c12', ink: ['#2a1206', '#b0281a', '#2f5e34', '#2a3f6a'], gloss: 0.55, material: 'bamboo', body: '#e9d8b4', bodyFinish: 'bone', backFinish: 'lacquer', ground: 'bone', font: 'brush', inkStyle: 'carved', frame: 'band', trim: '#e2b75a', motif: 'cloud' }),
  T('singapore', { face: ['#fbf8fd', '#e6def0'], back: '#5a3474', ink: ['#2c1a44', '#c4386a', '#2a8a6a', '#4a5ab8'], gloss: 0.8, material: 'pearl', body: '#f3eef7', bodyFinish: 'pearl', backFinish: 'pearl', ground: 'pearl', font: 'sans', inkStyle: 'flat', frame: 'deco', trim: '#b98ad6', motif: 'shell' }),
  T('hanoi', { face: ['#f6efe0', '#e4d6b8'], back: '#16100c', ink: ['#1a120a', '#b02a1e', '#25603e', '#1f3f6e'], gloss: 0.85, material: 'stone', body: '#1c1410', bodyFinish: 'lacquer', backFinish: 'lacquer', ground: 'ivory', font: 'serif', inkStyle: 'gilded', frame: 'double', trim: '#d6a23e', motif: 'lattice' }),
];

// ---------------------------------------------------------------- table cloths

export const SEASON_TABLES: TableStyle[] = [
  { id: seasonTableId('hongkong'), felt: '#123a3a', rim: '#4a2a18', rimGloss: 0.6 },
  { id: seasonTableId('tokyo'), felt: '#232a4a', rim: '#5a1a14', rimGloss: 0.75 },
  { id: seasonTableId('dubai'), felt: '#6a3a2a', rim: '#c9a24a', rimGloss: 0.85 },
  { id: seasonTableId('taipei'), felt: '#5a1610', rim: '#1a0e08', rimGloss: 0.7 },
  { id: seasonTableId('singapore'), felt: '#2e2245', rim: '#e3dccb', rimGloss: 0.8 },
  { id: seasonTableId('hanoi'), felt: '#1f2a22', rim: '#120c08', rimGloss: 0.9 },
];

// ---------------------------------------------------------------- frames

/** Ring colours for each season frame: [outer, inner highlight, deep] (see avatar.ts). */
export const SEASON_FRAME_RINGS: Record<string, [string, string, string]> = Object.fromEntries(SEASON_THEMES.map((t) => [seasonFrameId(t.id), [t.colors[1], t.colors[2], t.colors[0]]]));

// ---------------------------------------------------------------- catalogue entries

const earned = (t: SeasonTheme) => tr('{name} season ({city}) reward track', { name: t.name, city: t.city });

/** Catalogue entries: earned-only (price 0 with earnedBy), so The Atelier never sells them. */
export const SEASON_CATALOG: Cosmetic[] = SEASON_THEMES.flatMap((t, i): Cosmetic[] => {
  const ts = SEASON_TILE_SETS[i];
  const tb = SEASON_TABLES[i];
  const by = earned(t);
  return [
    { id: ts.id, category: 'tileSet', name: tr('{name} Tiles', { name: t.name }), blurb: tr('The {city} season’s own set. Earned on the reward track, never sold.', { city: t.city }), price: 0, earnedBy: by, swatch: [ts.face[0], ts.back, ts.trim] },
    { id: tb.id, category: 'table', name: tr('{name} Cloth', { name: t.name }), blurb: tr('A table cloth from the {city} season.', { city: t.city }), price: 0, earnedBy: by, swatch: [tb.felt, tb.rim, t.colors[1]] },
    { id: seasonFrameId(t.id), category: 'frame', name: tr('{name} Frame', { name: t.name }), blurb: tr('Worn by those who played the {city} season.', { city: t.city }), price: 0, earnedBy: by, swatch: [t.colors[1], t.colors[2], t.colors[0]] },
  ];
});

/** True for any season cosmetic id (tile set, cloth or frame). */
export const isSeasonCosmetic = (id: string) => id.startsWith('season-') || id.startsWith('frame-season-');
