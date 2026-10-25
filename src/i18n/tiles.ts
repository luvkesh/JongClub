// Tile names in the chosen language, for tooltips, alt text and messages.
// engine/tiles.ts keeps the English names (logs, tests, saved games).

import { rankOf, suitOf, tileName } from '../engine/tiles';
import { lang, tr } from './index';

const CN = '一二三四五六七八九';

/** Every named tile, so each name is a literal the string tables cover. */
const NAMED = (): Record<string, string> => ({
  'East Wind': tr('East Wind'),
  'South Wind': tr('South Wind'),
  'West Wind': tr('West Wind'),
  'North Wind': tr('North Wind'),
  'Red Dragon': tr('Red Dragon'),
  'Green Dragon': tr('Green Dragon'),
  'White Dragon': tr('White Dragon'),
  'Plum flower': tr('Plum flower'),
  'Orchid flower': tr('Orchid flower'),
  'Chrysanthemum flower': tr('Chrysanthemum flower'),
  'Bamboo flower': tr('Bamboo flower'),
  'Spring flower': tr('Spring flower'),
  'Summer flower': tr('Summer flower'),
  'Autumn flower': tr('Autumn flower'),
  'Winter flower': tr('Winter flower'),
  Joker: tr('Joker'),
  'Flower Joker': tr('Flower Joker'),
  'Wind Joker': tr('Wind Joker'),
  'Dragon Joker': tr('Dragon Joker'),
  'Number Joker': tr('Number Joker'),
  Cat: tr('Cat'),
  Mouse: tr('Mouse'),
  Rooster: tr('Rooster'),
  Centipede: tr('Centipede'),
});
let named: Record<string, string> | null = null;

/** A tile's name, e.g. "7 Bamboo", 七条, 七索, "East Wind". `red` names a red (aka) five. */
export function tileLabel(kind: number, red = false): string {
  const en = tileName(kind);
  if (lang() === 'en') return red ? `Red ${en}` : en;
  let name = (named ??= NAMED())[en];
  if (!name) {
    const n = rankOf(kind);
    const p = { n, cn: CN[n - 1] ?? String(n) };
    const s = suitOf(kind);
    name = s === 'man' ? tr('{n} Character', p) : s === 'pin' ? tr('{n} Dot', p) : s === 'sou' ? tr('{n} Bamboo', p) : en;
  }
  return red ? tr('Red {tile}', { tile: name }) : name;
}
