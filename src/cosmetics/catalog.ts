// Cosmetics catalogue: everything that can be collected or bought in The
// Atelier. Cosmetics are purely visual (and audible): nothing here is ever
// read by the engine, the AI or the rating system.

import { tr } from '../i18n';
import { SEASON_CATALOG, SEASON_TABLES, SEASON_TILE_SETS } from './seasonal';
import { VENUE_CATALOG, VENUE_ENVIRONMENTS } from './venues';
import { RACK_CATALOG } from './racks';

export type CosmeticCategory = 'tileSet' | 'rack' | 'table' | 'environment' | 'avatar' | 'accessory' | 'winAnimation' | 'tableEffect' | 'sound' | 'frame';

export const CATEGORY_LABELS: Record<CosmeticCategory, string> = {
  tileSet: tr('Tile Sets'),
  rack: tr('Tile Racks'),
  table: tr('Tables'),
  environment: tr('Environments'),
  avatar: tr('Avatars'),
  accessory: tr('Avatar accessories'),
  winAnimation: tr('Win animations'),
  tableEffect: tr('Table effects'),
  sound: tr('Sounds'),
  frame: tr('Frames'),
};

export interface Cosmetic {
  id: string;
  category: CosmeticCategory;
  name: string;
  /** One line shown in The Atelier. */
  blurb: string;
  /** Price in Jong Points; 0 = owned from the start. */
  price: number;
  /** Earned, not bought (an achievement, a tournament, a passport stamp). */
  earnedBy?: string;
  /** Swatch colours for previews: [primary, secondary, accent]. */
  swatch: [string, string, string];
}

// ---------------------------------------------------------------- tile sets
// Every set is a different object, not a recolour: its own body material,
// back finish and engraving, face ground, calligraphy and ink treatment.
// Material ids also choose the tile click sound (see audio/sound.ts).

/** A finish for the tile's body and back slabs (and the face ground's texture). */
export type TileFinish = 'ivory' | 'bone' | 'lacquer' | 'jade' | 'malachite' | 'marble' | 'obsidian' | 'pearl' | 'glass' | 'gold' | 'rosegold' | 'porcelain' | 'wood' | 'bamboo' | 'amethyst';

/**
 * Metal foil struck into the face of a premium set: the frame and a border
 * pattern in the margin (never under the symbols), optional gems, and on gilt
 * sets the ink itself. In 3D the foil is real metal (render/tileMaterials.ts).
 */
export interface TileFoil {
  metal: 'gold' | 'silver' | 'rosegold' | 'copper' | 'brass';
  border: 'none' | 'beads' | 'guilloche' | 'fret' | 'lattice' | 'scroll';
  /** The ink is gilt too (gilded and inlaid sets). */
  ink?: boolean;
  /** Colour of cabochon gems set in the margin. */
  gems?: string;
}

export interface TileSetStyle {
  id: string;
  /** Face ground (centre, edge). */
  face: [string, string];
  /** Back slab colour. */
  back: string;
  /** Ink colours: [characters/winds, red, green, blue]. */
  ink: [string, string, string, string];
  /** Red-five (aka dora) ink, when the set's own red is not red. */
  aka?: string;
  /** 0 = matte, 1 = glossy. */
  gloss: number;
  /** Slight see-through for crystal/glass sets. */
  translucent?: boolean;
  material: 'ivory' | 'jade' | 'stone' | 'pearl' | 'crystal' | 'metal' | 'bamboo' | 'glass';
  /** Body slab colour (the thick layer between face and back). */
  body: string;
  /** Material of the body slab, the back slab and the face ground. */
  bodyFinish: TileFinish;
  backFinish: TileFinish;
  ground: TileFinish;
  /** Calligraphy for the characters. */
  font: 'serif' | 'brush' | 'sans' | 'song';
  /** How the ink sits in the face: printed, carved, gilded, glowing or inlaid. */
  inkStyle: 'flat' | 'carved' | 'gilded' | 'glow' | 'inlay';
  /** Border engraved round the face. */
  frame: 'none' | 'line' | 'double' | 'corners' | 'deco' | 'band';
  /** Colour of the frame and the back's engraving. */
  trim: string;
  /** Engraving on the back of every tile. */
  motif: 'none' | 'cloud' | 'kintsugi' | 'shell' | 'facets' | 'dragon' | 'fan' | 'waves' | 'bands' | 'lattice' | 'bamboo' | 'medallion' | 'seal';
  /** Metal foil on the face (premium sets). */
  foil?: TileFoil;
  /** Circle-suit pip: the classic ring (default) or the Noyer chrysanthemum medallion. */
  pip?: 'ring' | 'rosette';
  /** Layered resin edge: colours from the back to the face side of the body. */
  stripes?: string[];
  /** Shop preview stage: the set's own case lining instead of the dark stage. */
  stage?: 'suede';
}

export const TILE_SETS: TileSetStyle[] = [
  { id: 'classic-ivory', face: ['#f8f1e1', '#e6d8ba'], back: '#1f5a46', ink: ['#1b2430', '#b3352a', '#1f7a4f', '#1f4f8a'], gloss: 0.35, material: 'ivory', body: '#efe4cc', bodyFinish: 'ivory', backFinish: 'lacquer', ground: 'ivory', font: 'serif', inkStyle: 'flat', frame: 'none', trim: '#c9a46a', motif: 'none' },
  { id: 'jade', face: ['#d9eedd', '#9cc9a9'], back: '#1b5a3e', ink: ['#0f3b26', '#9a2a1e', '#0f5a36', '#8a6418'], gloss: 0.7, material: 'jade', body: '#7fb592', bodyFinish: 'jade', backFinish: 'jade', ground: 'jade', font: 'brush', inkStyle: 'carved', frame: 'line', trim: '#d8c07a', motif: 'cloud', foil: { metal: 'gold', border: 'none' } },
  { id: 'obsidian', face: ['#26262b', '#0d0d10'], back: '#0b0b0d', ink: ['#e9c77e', '#f0a07a', '#cfd98e', '#c8d4e6'], aka: '#ff7a5c', gloss: 0.9, material: 'stone', body: '#121214', bodyFinish: 'obsidian', backFinish: 'obsidian', ground: 'obsidian', font: 'sans', inkStyle: 'gilded', frame: 'line', trim: '#d9b25f', motif: 'kintsugi', foil: { metal: 'gold', border: 'guilloche', ink: true } },
  { id: 'pearl', face: ['#fbfaff', '#dedcf0'], back: '#c7b3da', ink: ['#5b3a7a', '#d0507a', '#2f9a8c', '#6a70c8'], gloss: 0.75, material: 'pearl', body: '#f4eef1', bodyFinish: 'pearl', backFinish: 'pearl', ground: 'pearl', font: 'song', inkStyle: 'flat', frame: 'corners', trim: '#b9a2cf', motif: 'shell', foil: { metal: 'silver', border: 'beads' } },
  { id: 'crystal', face: ['#f3fbff', '#cfe6f4'], back: '#8cc8ea', ink: ['#11314f', '#d42c4c', '#12a05c', '#1f63c8'], gloss: 0.97, translucent: true, material: 'glass', body: '#d6eef9', bodyFinish: 'glass', backFinish: 'glass', ground: 'glass', font: 'sans', inkStyle: 'glow', frame: 'line', trim: '#9fd6f2', motif: 'facets', foil: { metal: 'silver', border: 'none' } },
  { id: 'black-marble', face: ['#f7f7f6', '#d6d7da'], back: '#18181a', ink: ['#141414', '#a5282a', '#2b6b4a', '#2b4f7a'], gloss: 0.65, material: 'stone', body: '#ece9e3', bodyFinish: 'marble', backFinish: 'obsidian', ground: 'marble', font: 'serif', inkStyle: 'carved', frame: 'line', trim: '#8f8a82', motif: 'medallion', foil: { metal: 'silver', border: 'fret' } },
  { id: 'royal-gold', face: ['#fcf4de', '#efdcaa'], back: '#c39a3e', ink: ['#2a1606', '#a01d16', '#1f5c36', '#1c3c74'], gloss: 0.8, material: 'metal', body: '#d6ad4f', bodyFinish: 'gold', backFinish: 'gold', ground: 'ivory', font: 'serif', inkStyle: 'inlay', frame: 'corners', trim: '#c49a3c', motif: 'dragon', foil: { metal: 'gold', border: 'scroll', gems: '#a3162a' } },
  { id: 'champagne', face: ['#fce6df', '#efbfb2'], back: '#c98f7a', ink: ['#5a1c2c', '#c0445a', '#5f8a6a', '#5a6f9a'], gloss: 0.6, material: 'pearl', body: '#efc9bc', bodyFinish: 'ivory', backFinish: 'rosegold', ground: 'ivory', font: 'song', inkStyle: 'flat', frame: 'deco', trim: '#c98f7a', motif: 'fan', foil: { metal: 'rosegold', border: 'lattice' } },
  { id: 'sapphire', face: ['#fbfcfe', '#e3e9f3'], back: '#1d3f8a', ink: ['#183577', '#24479a', '#3566b8', '#14336f'], aka: '#c0392b', gloss: 0.85, material: 'crystal', body: '#f6f8fc', bodyFinish: 'porcelain', backFinish: 'porcelain', ground: 'porcelain', font: 'brush', inkStyle: 'flat', frame: 'double', trim: '#24479a', motif: 'waves', foil: { metal: 'gold', border: 'beads' } },
  { id: 'emerald', face: ['#f9f6ee', '#e9e2d0'], back: '#0f5c3c', ink: ['#132519', '#b13a2c', '#0f6b44', '#7a5a18'], gloss: 0.8, material: 'jade', body: '#1a7a50', bodyFinish: 'malachite', backFinish: 'malachite', ground: 'ivory', font: 'serif', inkStyle: 'inlay', frame: 'band', trim: '#c9a24a', motif: 'bands', foil: { metal: 'gold', border: 'guilloche', gems: '#0f7a4c' } },
  { id: 'cinnabar', face: ['#a3231a', '#6e120c'], back: '#a01e15', ink: ['#f0cf7c', '#ffd9a0', '#e7c25e', '#f6e2b0'], aka: '#ffffff', gloss: 0.85, material: 'stone', body: '#141010', bodyFinish: 'lacquer', backFinish: 'lacquer', ground: 'lacquer', font: 'brush', inkStyle: 'gilded', frame: 'double', trim: '#e2b75a', motif: 'cloud', foil: { metal: 'gold', border: 'fret', ink: true } },
  { id: 'walnut', face: ['#6e4a2e', '#4a2f1b'], back: '#3a2414', ink: ['#f1e4c6', '#f08a6c', '#b7d48e', '#a9c4e6'], aka: '#ff8f6b', gloss: 0.45, material: 'bamboo', body: '#5a3b22', bodyFinish: 'wood', backFinish: 'wood', ground: 'wood', font: 'serif', inkStyle: 'inlay', frame: 'line', trim: '#d6b06a', motif: 'lattice', foil: { metal: 'brass', border: 'none', ink: true } },
  { id: 'bone-bamboo', face: ['#f0e2bf', '#d2b986'], back: '#b8873f', ink: ['#2a1d12', '#9a2e20', '#2f5e34', '#2c4466'], gloss: 0.3, material: 'bamboo', body: '#e6d6b0', bodyFinish: 'bone', backFinish: 'bamboo', ground: 'bone', font: 'brush', inkStyle: 'carved', frame: 'none', trim: '#7a5428', motif: 'bamboo' },
  // The luxury sets. Noyer: a two-tone ivory and walnut set in the grand-maison
  // manner, with JongClub's own sparrow seal and chrysanthemum pips.
  { id: 'noyer', face: ['#fdfcf8', '#efebe3'], back: '#5e3d24', ink: ['#1c2440', '#b3222c', '#16673f', '#1d3a8f'], gloss: 0.85, material: 'ivory', body: '#fbfaf5', bodyFinish: 'porcelain', backFinish: 'wood', ground: 'porcelain', font: 'serif', inkStyle: 'flat', frame: 'none', trim: '#d4ad55', motif: 'seal', pip: 'rosette', stage: 'suede' },
  // Amethyst Regalia: purple stone in a gold bezel, gilt symbols and ruby cabochons.
  { id: 'amethyst', face: ['#6a3a86', '#3e1d55'], back: '#c9a14a', ink: ['#f2d488', '#ffb4c2', '#d8eaa0', '#c4d2ff'], aka: '#ff6b81', gloss: 0.75, material: 'stone', body: '#d4ad55', bodyFinish: 'gold', backFinish: 'gold', ground: 'amethyst', font: 'serif', inkStyle: 'gilded', frame: 'band', trim: '#d9b25a', motif: 'cloud', foil: { metal: 'gold', border: 'beads', ink: true, gems: '#c2183f' } },
  // Gilded Porcelain: white glaze, a beaded gilt frame, and a layered resin edge on blush backs.
  { id: 'gilt-porcelain', face: ['#fefdfb', '#f1eee8'], back: '#efc3a4', ink: ['#26302c', '#b8492e', '#2f6650', '#2e4c72'], gloss: 0.8, material: 'crystal', body: '#fbfaf7', bodyFinish: 'porcelain', backFinish: 'porcelain', ground: 'porcelain', font: 'song', inkStyle: 'flat', frame: 'line', trim: '#c9a35a', motif: 'lattice', stripes: ['#efc3a4', '#f7f4ee', '#1f3a30', '#a9c2b4', '#f7f4ee'], foil: { metal: 'gold', border: 'beads' } },
  ...SEASON_TILE_SETS,
];

// ---------------------------------------------------------------- tables

export interface TableStyle {
  id: string;
  felt: string;
  /** Wooden or stone rim around the felt. */
  rim: string;
  /** Rim finish: 0 matte wood … 1 polished stone/metal. */
  rimGloss: number;
}

export const TABLES: TableStyle[] = [
  { id: 'classic-green', felt: '#17402f', rim: '#3b2416', rimGloss: 0.3 },
  { id: 'black-marble', felt: '#1d1f22', rim: '#d9d6cf', rimGloss: 0.85 },
  { id: 'jade-palace', felt: '#0f4a46', rim: '#7a1f1b', rimGloss: 0.5 },
  { id: 'tokyo-night', felt: '#1a2440', rim: '#141414', rimGloss: 0.6 },
  { id: 'dubai-gold', felt: '#5a4321', rim: '#c9a24a', rimGloss: 0.9 },
  { id: 'manhattan', felt: '#3a2a1c', rim: '#1a1410', rimGloss: 0.45 },
  { id: 'ocean', felt: '#0f3d55', rim: '#d8cbb0', rimGloss: 0.4 },
  { id: 'art-deco', felt: '#202a26', rim: '#b8954a', rimGloss: 0.8 },
  { id: 'midnight-club', felt: '#2a1530', rim: '#0e0e10', rimGloss: 0.7 },
  { id: 'saigon-lacquer', felt: '#7a2a1e', rim: '#1c1410', rimGloss: 0.8 },
  { id: 'calcutta-club', felt: '#4f1d2c', rim: '#b08a4a', rimGloss: 0.78 },
  { id: 'marina-teal', felt: '#0d3b4f', rim: '#e3dccb', rimGloss: 0.85 },
  ...SEASON_TABLES,
];

/** The table a variation sits at unless the player equips another one. */
export const VARIATION_TABLE: Record<string, string> = {
  classic: 'classic-green',
  riichi: 'tokyo-night',
  taiwanese: 'jade-palace',
  american: 'manhattan',
  uae: 'dubai-gold',
  vietnamese: 'saigon-lacquer',
  indian: 'calcutta-club',
  singapore: 'marina-teal',
};

// ---------------------------------------------------------------- environments
// Each environment is a different room: its own walls, floor, rug, pendant
// lamp, chairs, light and view. Night, dusk and daylight rooms sit side by side.

export interface EnvironmentStyle {
  id: string;
  /** Background / fog colour: the air of the room. */
  sky: string;
  /** Key light colour and intensity multiplier. */
  key: string;
  keyPower: number;
  /** Rim light colour. */
  rim: string;
  /** Colours of the lights seen out of focus (city, lanterns, sconces). */
  bokeh: string[];
  /** The view beyond the windows ('none' for a closed room). */
  backdrop: 'none' | 'skyline' | 'neon' | 'lanterns' | 'desert' | 'harbour' | 'daysea' | 'garden' | 'hkstreet';
  /** The room's own walls. */
  room: 'club' | 'shoji' | 'lantern' | 'arches' | 'loft' | 'lounge' | 'marble' | 'pavilion' | 'palace' | 'teahouse' | 'janso' | 'majlis';
  floor: 'parquet' | 'tatami' | 'terracotta' | 'zellige' | 'planks' | 'checker' | 'whitemarble' | 'goldbrick' | 'mosaic' | 'carpet' | 'limestone';
  /** Rug under the table: field colour and pattern ('none' leaves the floor bare). */
  rug: string;
  rugStyle: 'fret' | 'persian' | 'cloud' | 'deco' | 'waves' | 'dragon' | 'sadu' | 'none';
  /** The pendant over the table. */
  lamp: 'drum' | 'paper' | 'lantern' | 'brass' | 'industrial' | 'deco' | 'halo' | 'palace' | 'fan' | 'fluoro' | 'majlis';
  /** Chair frame and cushion colours. */
  chair: [frame: string, cushion: string];
  /** Daylight fill: 0 = a lamp-lit night room, 1 = bright day. */
  ambient: number;
}

export const ENVIRONMENTS: EnvironmentStyle[] = [
  { id: 'private-club', sky: '#0b0f0d', key: '#ffe2b8', keyPower: 1, rim: '#9fc7ff', bokeh: ['#e8cb92'], backdrop: 'none', room: 'club', floor: 'parquet', rug: '#3a1716', rugStyle: 'fret', lamp: 'drum', chair: ['#16100c', '#3a1a1a'], ambient: 0.05 },
  { id: 'tokyo', sky: '#070a1c', key: '#c4d2ff', keyPower: 0.9, rim: '#ff4fa0', bokeh: ['#ff4fa0', '#38d6ff', '#ffe36e', '#9b6bff'], backdrop: 'neon', room: 'shoji', floor: 'tatami', rug: '#1a2038', rugStyle: 'none', lamp: 'paper', chair: ['#141418', '#1d2440'], ambient: 0.2 },
  { id: 'taipei', sky: '#1a0806', key: '#ffb27a', keyPower: 1.05, rim: '#ff5a3a', bokeh: ['#ff3a24', '#ffb04a'], backdrop: 'lanterns', room: 'lantern', floor: 'terracotta', rug: '#7a1810', rugStyle: 'cloud', lamp: 'lantern', chair: ['#3a0e08', '#8a1c12'], ambient: 0.2 },
  { id: 'dubai', sky: '#2a160a', key: '#ffc070', keyPower: 1.1, rim: '#ffb050', bokeh: ['#ffc06a', '#fff1c9'], backdrop: 'desert', room: 'arches', floor: 'zellige', rug: '#7a1f1a', rugStyle: 'persian', lamp: 'brass', chair: ['#2a1a0e', '#1f3f5a'], ambient: 0.35 },
  { id: 'new-york', sky: '#0b0d12', key: '#fff0d8', keyPower: 1, rim: '#8fb4ff', bokeh: ['#ffd27a', '#ffffff', '#8fb4ff'], backdrop: 'skyline', room: 'loft', floor: 'planks', rug: '#2b2b30', rugStyle: 'deco', lamp: 'industrial', chair: ['#101010', '#5a3a26'], ambient: 0.12 },
  { id: 'shanghai', sky: '#0d0814', key: '#ffd0c4', keyPower: 1, rim: '#ff6b8a', bokeh: ['#ff6b8a', '#6be1ff', '#ffe36e'], backdrop: 'harbour', room: 'lounge', floor: 'checker', rug: '#0f4a4a', rugStyle: 'deco', lamp: 'deco', chair: ['#0e0c0c', '#0f5a5a'], ambient: 0.12 },
  { id: 'modern-luxury', sky: '#b4c2cc', key: '#ffffff', keyPower: 0.85, rim: '#cfe4ff', bokeh: ['#ffffff'], backdrop: 'daysea', room: 'marble', floor: 'whitemarble', rug: '#d9d4cc', rugStyle: 'waves', lamp: 'halo', chair: ['#e8e4dc', '#bfb6a8'], ambient: 1 },
  { id: 'kyoto', sky: '#b9c8b0', key: '#fff2d6', keyPower: 0.9, rim: '#ffd9a0', bokeh: ['#fff2c8'], backdrop: 'garden', room: 'pavilion', floor: 'tatami', rug: '#3a4a30', rugStyle: 'none', lamp: 'paper', chair: ['#3a2616', '#6a7a4a'], ambient: 0.8 },
  { id: 'imperial', sky: '#140806', key: '#ffc878', keyPower: 1.05, rim: '#ffcf6a', bokeh: ['#ffcf6a', '#ff6a3a'], backdrop: 'none', room: 'palace', floor: 'goldbrick', rug: '#c8961e', rugStyle: 'dragon', lamp: 'palace', chair: ['#5a0e08', '#c8961e'], ambient: 0.25 },
  ...VENUE_ENVIRONMENTS,
];

// ---------------------------------------------------------------- avatars

export type HairStyle = 'short' | 'long' | 'bun' | 'bob' | 'shaved' | 'wavy' | 'sidepart' | 'slicked' | 'buzz' | 'curly' | 'afro' | 'ponytail' | 'braids' | 'topknot';
export type FaceShape = 'oval' | 'round' | 'long' | 'square' | 'heart';
export type EyeShape = 'almond' | 'round' | 'narrow' | 'hooded' | 'upturned';
export type BrowStyle = 'soft' | 'straight' | 'arched' | 'thick';
export type NoseShape = 'button' | 'straight' | 'broad' | 'aquiline';
export type LipShape = 'thin' | 'medium' | 'full';
export type FacialHair = 'none' | 'stubble' | 'moustache' | 'goatee' | 'beard';

export interface AvatarSpec {
  /** Index into SKIN_TONES. */
  skin: number;
  hair: HairStyle;
  hairColor: string;
  /** Where the hair parts (styles with a parting or a fringe). */
  hairPart?: 'left' | 'centre' | 'right';
  outfit: 'qipao' | 'suit' | 'kimono' | 'blazer' | 'kandura' | 'sweater';
  outfitColor: string;
  accessory: 'none' | 'glasses' | 'earrings' | 'hat' | 'fan' | 'pearls' | 'aviators' | 'pixel';
  /** A frame cosmetic id (or 'none'). */
  frame: string;
  /** Facial features; missing ones read as the first option (the original look). */
  face?: FaceShape;
  eyes?: EyeShape;
  eyeColor?: string;
  brows?: BrowStyle;
  nose?: NoseShape;
  lips?: LipShape;
  facialHair?: FacialHair;
  /** Extra pieces worn by table bots (chosen at random per bot; not sold in the shop). */
  eyewear?: 'glasses' | 'sunglasses' | 'round';
  headwear?: 'cap' | 'beanie' | 'beret' | 'fedora' | 'visor';
  /** Colour of the bot's cap, beanie, beret or visor. */
  wearColor?: string;
}

/** Skin tones. New tones are appended so saved indices keep their colour; SKIN_ORDER lists them light to deep. */
export const SKIN_TONES = ['#f6dcc4', '#eac3a1', '#d6a47c', '#b47d55', '#8d5a3b', '#5e3b26', '#fbe6d6', '#e8c8a8', '#c99a6b', '#a8754a', '#6f4429', '#3f271a'];
export const SKIN_ORDER = [6, 0, 7, 1, 2, 8, 3, 9, 4, 10, 5, 11];
export const HAIR_COLORS = ['#1b1715', '#3b2a20', '#6b4a2f', '#a37b4c', '#d6b98a', '#9a9a9a', '#8a3a1c', '#c46a2a', '#e8dcc6', '#f2f0ec'];
export const EYE_COLORS = ['#2a1a12', '#4a2c1a', '#6b4a24', '#5a6b3a', '#3d6a5a', '#3a5a8a', '#6a7480'];

export const DEFAULT_AVATAR: AvatarSpec = { skin: 1, hair: 'short', hairColor: '#1b1715', outfit: 'blazer', outfitColor: '#1f3b33', accessory: 'none', frame: 'none' };

// ---------------------------------------------------------------- the catalogue

const C = (category: CosmeticCategory, id: string, name: string, blurb: string, price: number, swatch: [string, string, string], earnedBy?: string): Cosmetic => ({ id, category, name, blurb, price, swatch, earnedBy });

export const CATALOG: Cosmetic[] = [
  C('tileSet', 'classic-ivory', tr('Classic Ivory'), tr('Warm ivory on a jade-green lacquer back. The set every club starts with.'), 0, ['#f3ead6', '#1f5a46', '#b3352a']),
  C('tileSet', 'jade', tr('Imperial Jade'), tr('Solid mottled jade, glyphs carved by brush and a cloud engraved on every back.'), 2400, ['#a9d3b5', '#1b5a3e', '#0f3b26']),
  C('tileSet', 'obsidian', tr('Obsidian & Gold'), tr('Black volcanic glass with gold-leaf glyphs and kintsugi veins across the backs.'), 3200, ['#141416', '#0b0b0d', '#e9c77e']),
  C('tileSet', 'pearl', tr('Mother of Pearl'), tr('Iridescent shell faces that shift colour as they turn, on lilac scallop backs.'), 3000, ['#f6eef4', '#c7b3da', '#c4456a']),
  C('tileSet', 'crystal', tr('Ice Crystal'), tr('Clear faceted glass. Gem-coloured glyphs glow from inside. A bright glass click.'), 4800, ['#e2f3fc', '#8cc8ea', '#d42c4c']),
  C('tileSet', 'black-marble', tr('Carrara & Nero'), tr('White Carrara faces carved like a monument, backed in veined black stone.'), 3600, ['#f1efea', '#18181a', '#a5282a']),
  C('tileSet', 'royal-gold', tr('Imperial Gold'), tr('Solid gilded tiles, filigree corners and an embossed dragon seal on every back.'), 6000, ['#fbf0d0', '#c39a3e', '#a01d16']),
  C('tileSet', 'champagne', tr('Rose Champagne'), tr('Blush faces, rose-gold backs with an Art Deco fan, and fine Song calligraphy.'), 2800, ['#fbe5de', '#c98f7a', '#5a1c2c']),
  C('tileSet', 'sapphire', tr('Blue & White Porcelain'), tr('Ming porcelain: cobalt brushwork on white glaze, with waves painted on the backs.'), 4000, ['#f7f9fd', '#1d3f8a', '#24479a']),
  C('tileSet', 'emerald', tr('Malachite & Gold'), tr('Banded malachite bodies with white faces framed in gold.'), 4000, ['#f6f2e6', '#0f5c3c', '#c9a24a']),
  C('tileSet', 'cinnabar', tr('Cinnabar Lacquer'), tr('Carved red lacquer faces with gold brushwork, on black lacquer bodies.'), 4400, ['#9e1d15', '#141010', '#f0cf7c']),
  C('tileSet', 'walnut', tr('Walnut & Brass'), tr('Oiled walnut faces inlaid with bone and brass. A hollow wooden click.'), 3800, ['#6a472b', '#3a2414', '#f1e4c6']),
  C('tileSet', 'noyer', tr('Noyer & Ivoire'), tr('The grand-maison set: ivory resin faces fused to solid walnut backs, each stamped with a gilt sparrow seal.'), 8000, ['#fbfaf5', '#5e3d24', '#d4ad55']),
  C('tileSet', 'amethyst', tr('Amethyst Regalia'), tr('Polished amethyst in a gold bezel, gilt symbols and ruby cabochons set into every face.'), 7200, ['#5a2e74', '#c9a14a', '#c2183f']),
  C('tileSet', 'gilt-porcelain', tr('Gilded Porcelain'), tr('White porcelain with a beaded gilt frame, on blush backs with a layered resin edge.'), 5400, ['#fefdfb', '#efc3a4', '#1f3a30']),
  C('tileSet', 'bone-bamboo', tr('Bone & Bamboo'), tr('The antique way: hand-carved bone faces dovetailed into bamboo backs.'), 3400, ['#ecdfc0', '#b8873f', '#2a1d12']),

  C('table', 'classic-green', tr('Classic Green'), tr('Green baize and dark walnut.'), 0, ['#17402f', '#3b2416', '#e8cb92']),
  C('table', 'black-marble', tr('Black Marble'), tr('Charcoal felt in a marble frame.'), 3000, ['#1d1f22', '#d9d6cf', '#c8a46a']),
  C('table', 'jade-palace', tr('Jade Palace'), tr('Taipei teal with lacquered red.'), 0, ['#0f4a46', '#7a1f1b', '#e8cb92'], tr('Play a Taiwanese game')),
  C('table', 'tokyo-night', tr('Tokyo Night'), tr('Indigo felt, black lacquer.'), 0, ['#1a2440', '#141414', '#ff5fa2'], tr('Play a Riichi game')),
  C('table', 'dubai-gold', tr('Dubai Gold'), tr('Sand-gold felt in a gilded rim.'), 0, ['#5a4321', '#c9a24a', '#fff1c9'], tr('Play a Dubai club game')),
  C('table', 'manhattan', tr('Manhattan'), tr('Card-room brown and leather.'), 0, ['#3a2a1c', '#1a1410', '#ffd27a'], tr('Play an American game')),
  C('table', 'ocean', tr('Ocean'), tr('Deep sea blue and driftwood.'), 2600, ['#0f3d55', '#d8cbb0', '#7fd0e8']),
  C('table', 'art-deco', tr('Art Deco'), tr('Dark green with brass inlay.'), 3400, ['#202a26', '#b8954a', '#f0dca8']),
  C('table', 'midnight-club', tr('Midnight Club'), tr('Plum velvet, black rim.'), 3400, ['#2a1530', '#0e0e10', '#d8a6ff']),
  C('table', 'saigon-lacquer', tr('Saigon Lacquer'), tr('Cinnabar felt in black lacquer.'), 0, ['#7a2a1e', '#1c1410', '#f2c46b'], tr('Play a Vietnamese game')),
  C('table', 'calcutta-club', tr('Calcutta Club'), tr('Maroon baize and old brass.'), 0, ['#4f1d2c', '#b08a4a', '#f4dca0'], tr('Play an Indian club game')),
  C('table', 'marina-teal', tr('Marina Teal'), tr('Harbour teal in a white stone rim.'), 0, ['#0d3b4f', '#e3dccb', '#7fd8e0'], tr('Play a Singapore game')),

  C('environment', 'private-club', tr('The Private Club'), tr('Walnut panelling, porcelain shelves and a lacquer pendant. Low light, leather and brass.'), 0, ['#0b0f0d', '#e8cb92', '#3a1716']),
  C('environment', 'tokyo', tr('Tokyo Neon'), tr('A tatami room behind shoji screens, neon and rain beyond the glass.'), 3500, ['#070a1c', '#ff4fa0', '#38d6ff']),
  C('environment', 'taipei', tr('Taipei Night Market'), tr('Red lacquer columns, a moon gate and strings of lanterns over the street.'), 3500, ['#1a0806', '#ff3a24', '#ffb04a']),
  C('environment', 'dubai', tr('Dubai Majlis'), tr('Mashrabiya arches, zellige floor and a pierced brass lantern at desert sunset.'), 3500, ['#2a160a', '#ffc06a', '#1f3f5a']),
  C('environment', 'new-york', tr('Manhattan Loft'), tr('Brick, steel-framed windows and Edison bulbs above a midnight skyline.'), 3500, ['#0b0d12', '#ffd27a', '#8fb4ff']),
  C('environment', 'shanghai', tr('Shanghai 1930s'), tr('A jazz-age lounge in black lacquer and gold, the Bund lit up across the river.'), 3500, ['#0d0814', '#ff6b8a', '#6be1ff']),
  C('environment', 'modern-luxury', tr('Sky Penthouse'), tr('Daylight, white marble and glass, high over a calm sea.'), 5000, ['#c9d6df', '#ffffff', '#bfb6a8']),
  C('environment', 'kyoto', tr('Kyoto Garden'), tr('An open tea pavilion over a bamboo grove and maple garden, in soft afternoon light.'), 4500, ['#b9c8b0', '#c0392b', '#3a4a30']),
  C('environment', 'imperial', tr('Forbidden City'), tr('Vermilion columns, painted beams and gold. The emperor’s own hall.'), 6000, ['#140806', '#c8961e', '#8a1c12']),

  C('avatar', 'outfit-blazer', tr('Club Blazer'), tr('The house look.'), 0, ['#1f3b33', '#e8cb92', '#111']),
  C('avatar', 'outfit-suit', tr('Evening Suit'), tr('Black tie for the big table.'), 1200, ['#141414', '#f3ead6', '#c8a46a']),
  C('avatar', 'outfit-qipao', tr('Silk Qipao'), tr('Embroidered silk.'), 1600, ['#7a1f1b', '#e8cb92', '#2f7a5c']),
  C('avatar', 'outfit-kimono', tr('Kimono'), tr('Indigo with a gold obi.'), 1600, ['#1a2440', '#c9a24a', '#f3ead6']),
  C('avatar', 'outfit-kandura', tr('Kandura'), tr('Crisp and white.'), 1600, ['#f5f3ee', '#c9a24a', '#5a4321']),
  C('avatar', 'outfit-sweater', tr('Cashmere Sweater'), tr('Relaxed Sunday games.'), 800, ['#8a6a4a', '#f3ead6', '#3b2416']),

  C('accessory', 'none', tr('No accessory'), '', 0, ['#333', '#333', '#333']),
  C('accessory', 'glasses', tr('Gold Glasses'), tr('For reading the table.'), 600, ['#c8a46a', '#111', '#fff']),
  C('accessory', 'earrings', tr('Jade Earrings'), tr('A quiet flourish.'), 900, ['#2f7a5c', '#c8a46a', '#fff']),
  C('accessory', 'hat', tr('Fedora'), tr('Manhattan card-room classic.'), 900, ['#2a2520', '#c8a46a', '#111']),
  C('accessory', 'fan', tr('Silk Fan'), tr('Cool under pressure.'), 1100, ['#b3352a', '#e8cb92', '#111']),
  C('accessory', 'pearls', tr('Pearl Necklace'), tr('Elegant and timeless.'), 1400, ['#f6f2ee', '#d9cfe0', '#c8a46a']),
  C('accessory', 'aviators', tr('Gold Aviators'), tr('Gold-framed sunglasses for a poker face.'), 1200, ['#d9b45c', '#2a2420', '#fff1c9']),
  C('accessory', 'pixel', tr('Pixel Shades'), tr('Deal with it.'), 1500, ['#0b0b0b', '#3a3a3a', '#ffffff']),

  C('winAnimation', 'win-classic', tr('Classic Reveal'), tr('Tiles rise, the camera leans in.'), 0, ['#e8cb92', '#17402f', '#fff']),
  C('winAnimation', 'win-lanterns', tr('Lanterns'), tr('Paper lanterns drift up from the table.'), 2200, ['#ff4d3a', '#ffb45f', '#120c0a']),
  C('winAnimation', 'win-gold-dust', tr('Gold Dust'), tr('A shimmer of gold across the felt.'), 2600, ['#ffd27a', '#fff1c9', '#140f08']),
  C('winAnimation', 'win-sakura', tr('Sakura'), tr('Petals fall over the winning hand.'), 2600, ['#ffb7c5', '#fff', '#1a2440']),

  C('tableEffect', 'fx-none', tr('No effect'), tr('Just the table.'), 0, ['#333', '#333', '#333']),
  C('tableEffect', 'fx-candle', tr('Candlelight'), tr('A warm flicker at the table edge.'), 1500, ['#ffb45f', '#3b2416', '#fff']),
  C('tableEffect', 'fx-mist', tr('Evening Mist'), tr('A low haze over the felt.'), 1500, ['#cfd8dc', '#17402f', '#fff']),
  C('tableEffect', 'fx-fireflies', tr('Fireflies'), tr('Tiny lights drifting around the room.'), 2000, ['#e6ff8a', '#0b0f0d', '#fff']),

  C('sound', 'sound-auto', tr('Matched to tiles'), tr('Each tile set has its own click.'), 0, ['#e8cb92', '#17402f', '#fff']),
  C('sound', 'sound-bamboo', tr('Bamboo Hall'), tr('Hollow wooden clicks.'), 1000, ['#b08a4a', '#3b2416', '#fff']),
  C('sound', 'sound-glass', tr('Glass House'), tr('Bright glass on stone.'), 1200, ['#9fd0ea', '#fff', '#1c2c3a']),

  C('frame', 'none', tr('No frame'), '', 0, ['#333', '#333', '#333']),
  C('frame', 'frame-brass', tr('Brass Ring'), tr('A polished brass ring.'), 500, ['#c8a46a', '#e8cb92', '#3b2416']),
  C('frame', 'frame-jade', tr('Jade Ring'), tr('Carved jade.'), 900, ['#2f7a5c', '#bfe3cf', '#173126']),
  C('frame', 'frame-lacquer', tr('Red Lacquer'), tr('Lacquered red with gold.'), 900, ['#7a1f1b', '#c9a24a', '#2a0e0c']),
  C('frame', 'frame-master', tr('Master’s Crown'), tr('For players who reach Master.'), 0, ['#ffd27a', '#7a1f1b', '#111'], tr('Reach Master league')),
  C('frame', 'frame-champion', tr('Champion’s Laurel'), tr('Win a tournament.'), 0, ['#e8cb92', '#2f7a5c', '#111'], tr('Win a tournament')),
  ...RACK_CATALOG,
  ...VENUE_CATALOG,
  ...SEASON_CATALOG,
];

export const byId = (category: CosmeticCategory, id: string) => CATALOG.find((c) => c.category === category && c.id === id);

/** What a player has equipped. Every field is a catalogue id of its category. */
export interface Loadout {
  tileSet: string;
  /** Tile racks at every seat (cosmetics/racks.ts). */
  rack: string;
  /** 'auto' = each variation's own table. */
  table: string;
  environment: string;
  winAnimation: string;
  tableEffect: string;
  sound: string;
}

export const DEFAULT_LOADOUT: Loadout = { tileSet: 'classic-ivory', rack: 'rack-table', table: 'auto', environment: 'private-club', winAnimation: 'win-classic', tableEffect: 'fx-none', sound: 'sound-auto' };

export const tileSetStyle = (id: string) => TILE_SETS.find((t) => t.id === id) ?? TILE_SETS[0];
export const tableStyle = (id: string) => TABLES.find((t) => t.id === id) ?? TABLES[0];
export const environmentStyle = (id: string) => ENVIRONMENTS.find((e) => e.id === id) ?? ENVIRONMENTS[0];
