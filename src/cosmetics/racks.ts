// Tile racks: the wooden holders every seat's hand stands on. A ladder of
// club and jewellery-box racks, from the table's own wood up to a gilded
// imperial rack. Purely visual, like every cosmetic: never read by the
// engine, the AI or the rating system.

import { tr } from '../i18n';
import type { Cosmetic } from './catalog';

/** What a rack's main body is made of. 'table' borrows the table rim's own finish. */
export type RackWood = 'table' | 'walnut' | 'rosewood' | 'beech' | 'lacquer' | 'zitan' | 'ebony' | 'gilt';

export interface RackStyle {
  id: string;
  body: RackWood;
  /** Main colour of the body (tints the grain). */
  bodyColor: string;
  /** Second material for the rail and the hand step's cap, for two-tone racks. */
  accent?: RackWood;
  accentColor?: string;
  /** 0 = oiled satin … 1 = mirror lacquer. */
  gloss: number;
  /** Metal of the stringing, end caps, studs and bezels. */
  trim: string;
  /** Lining laid into the ledges, and its cloth. */
  lining: string;
  cloth: 'baize' | 'suede' | 'velvet' | 'leather';
  /** Lines of metal stringing along the lip and rail (1 or 2). */
  stringing: 1 | 2;
  /** Cast metal end caps on both ends of every rack. */
  caps: boolean;
  /** A row of round brass rivets along the front, as on a trunk. */
  studs: boolean;
  /** Stone cartouches set into the front face (jade, pearl). */
  cartouche?: string;
  /** Cabochons on the end caps. */
  gem?: string;
  /** Engraved scrollwork in the body (gilt) or the trim. */
  engraved?: boolean;
  /** The ornament carved along your rail and into the panels on every rack's front. */
  carve: 'fret' | 'cloud' | 'coin' | 'wave' | 'vine';
  /** Metal laid into the carving (gold, silver); plain cuts when absent. */
  inlay?: string;
}

export const RACK_STYLES: RackStyle[] = [
  { id: 'rack-table', body: 'table', bodyColor: '#3b2416', gloss: 0.5, trim: '#c9a46a', lining: '', cloth: 'baize', stringing: 1, caps: false, studs: false, carve: 'fret' },
  { id: 'rack-walnut', body: 'walnut', bodyColor: '#74492a', gloss: 0.45, trim: '#c9a46a', lining: '#1d4a36', cloth: 'baize', stringing: 1, caps: true, studs: false, carve: 'coin' },
  { id: 'rack-rosewood', body: 'rosewood', bodyColor: '#7e2e1e', gloss: 0.7, trim: '#d4ad62', lining: '#5a1a1c', cloth: 'leather', stringing: 2, caps: true, studs: false, carve: 'cloud' },
  { id: 'rack-trunk', body: 'walnut', bodyColor: '#6a4426', accent: 'beech', accentColor: '#e2c49a', gloss: 0.5, trim: '#c8a258', lining: '#14473a', cloth: 'suede', stringing: 1, caps: true, studs: true, carve: 'fret' },
  { id: 'rack-lacquer', body: 'lacquer', bodyColor: '#0c0b0b', gloss: 1, trim: '#e3bd6a', lining: '#5e1410', cloth: 'velvet', stringing: 2, caps: true, studs: false, engraved: true, carve: 'wave', inlay: '#e3bd6a' },
  { id: 'rack-pearl', body: 'ebony', bodyColor: '#1e1814', gloss: 0.85, trim: '#d8d2c6', lining: '#2a2440', cloth: 'velvet', stringing: 2, caps: true, studs: false, cartouche: '#efe9f2', carve: 'vine', inlay: '#e4e0d8' },
  { id: 'rack-jade', body: 'zitan', bodyColor: '#43221a', gloss: 0.8, trim: '#d9b25f', lining: '#0f4a3a', cloth: 'velvet', stringing: 2, caps: true, studs: false, cartouche: '#5fae86', gem: '#2f8a5c', carve: 'fret', inlay: '#d9b25f' },
  { id: 'rack-gilt', body: 'gilt', bodyColor: '#f0c860', gloss: 0.9, trim: '#f0d48a', lining: '#5a0c12', cloth: 'velvet', stringing: 2, caps: true, studs: false, cartouche: '#3f9a6c', gem: '#b0122a', engraved: true, carve: 'vine' },
];

export const rackStyle = (id: string) => RACK_STYLES.find((r) => r.id === id) ?? RACK_STYLES[0];

const R = (id: string, name: string, blurb: string, price: number, swatch: [string, string, string]): Cosmetic => ({ id, category: 'rack', name, blurb, price, swatch });

export const RACK_CATALOG: Cosmetic[] = [
  R('rack-table', tr('Matched to the Table'), tr('Racks cut from the table’s own wood, with a brass line along the lip.'), 0, ['#3b2416', '#c9a46a', '#17402f']),
  R('rack-walnut', tr('Club Walnut'), tr('Oiled walnut with chamfered edges, green baize ledges and brass end caps.'), 1800, ['#5a3a22', '#1d4a36', '#c9a46a']),
  R('rack-rosewood', tr('Rosewood & Brass'), tr('Polished rosewood strung with twin brass lines, its ledges lined in oxblood leather.'), 2800, ['#5e1f16', '#d4ad62', '#5a1a1c']),
  R('rack-trunk', tr('Trunk Maker'), tr('Walnut and pale beech, forest-green suede and a row of brass rivets, like a travelling games trunk.'), 3600, ['#4f321d', '#e2c49a', '#14473a']),
  R('rack-lacquer', tr('Black Lacquer & Gold'), tr('Mirror-black lacquer edged in engraved gold, with cinnabar velvet ledges.'), 4200, ['#0c0b0b', '#e3bd6a', '#8a1a16']),
  R('rack-pearl', tr('Ebony & Mother of Pearl'), tr('Gloss ebony inlaid with mother-of-pearl panels, set in silver on midnight velvet.'), 4800, ['#17110e', '#efe9f2', '#d8d2c6']),
  R('rack-jade', tr('Zitan & Jade'), tr('Dark zitan wood with carved jade cartouches framed in gold, and jade cabochons on the caps.'), 5600, ['#2a1410', '#5fae86', '#d9b25f']),
  R('rack-gilt', tr('Imperial Gilt'), tr('Solid gilt engraved with clouds, jade inlays, ruby cabochons and crimson velvet. The emperor’s own.'), 7500, ['#cfa448', '#7a0e14', '#3f9a6c']),
];
