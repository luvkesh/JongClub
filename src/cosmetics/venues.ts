// Signature venues: three rooms tied to World Tour stops, each with its own
// walls, floor, pendant, set pieces and ambient sound (render/venueProps.ts,
// audio/ambience.ts). Bought in The Atelier with Jong Points, or opened free
// by the matching World Tour stamp. Purely cosmetic.
//
// Only type imports from catalog.ts, so catalog.ts can spread these lists into
// its own without an import cycle at run time.

import type { Cosmetic, EnvironmentStyle } from './catalog';
import { lang, tr } from '../i18n';

export const VENUE_ENVIRONMENTS: EnvironmentStyle[] = [
  { id: 'hk-teahouse', sky: '#22170f', key: '#ffe2b4', keyPower: 1, rim: '#7fd0c8', bokeh: ['#ff5a6a', '#6ae0ff', '#ffd27a'], backdrop: 'hkstreet', room: 'teahouse', floor: 'mosaic', rug: '#3a1a14', rugStyle: 'none', lamp: 'fan', chair: ['#3a2212', '#5a1c18'], ambient: 0.3 },
  { id: 'tokyo-janso', sky: '#0b0c12', key: '#eef2ff', keyPower: 0.95, rim: '#7aa8ff', bokeh: ['#ff4f6a', '#38d6ff', '#ffe36e', '#9b6bff'], backdrop: 'neon', room: 'janso', floor: 'carpet', rug: '#16302a', rugStyle: 'none', lamp: 'fluoro', chair: ['#1a1a1c', '#2a3654'], ambient: 0.14 },
  { id: 'al-fahidi-majlis', sky: '#1d120b', key: '#ffc888', keyPower: 1.05, rim: '#ffb070', bokeh: ['#ffc06a', '#ff9a4a', '#fff1c9'], backdrop: 'desert', room: 'majlis', floor: 'limestone', rug: '#7a1414', rugStyle: 'sadu', lamp: 'majlis', chair: ['#3a2414', '#7a1a1a'], ambient: 0.22 },
];

/** The World Tour stamp that opens each venue: win a game at that destination. */
export const VENUE_STAMPS: Record<string, { destinations: string[]; place: string; label: string }> = {
  'hk-teahouse': { destinations: ['hongkong'], place: 'Hong Kong', label: tr('Win a game of Hong Kong Mahjong') },
  'tokyo-janso': { destinations: ['riichi'], place: 'Japan', label: tr('Win a game of Japanese Riichi') },
  'al-fahidi-majlis': { destinations: ['uae', 'uae-taiwanese', 'uae-american', 'uae-custom'], place: 'the UAE', label: tr('Win a game at a Dubai club table') },
};

const V = (id: string, name: string, blurb: string, swatch: [string, string, string]): Cosmetic => ({ id, category: 'environment', name, blurb: tr('{blurb} Or open it free with the World Tour stamp: {stamp}.', { blurb, stamp: lang() === 'en' ? VENUE_STAMPS[id].label.toLowerCase() : VENUE_STAMPS[id].label }), price: 4000, swatch });

export const VENUE_CATALOG: Cosmetic[] = [
  V('hk-teahouse', 'Hong Kong Tea House', tr('Teak booths, green-tiled walls, birdcages and a slow ceiling fan above a busy street.'), ['#22170f', '#2f6a5a', '#d9b45c']),
  V('tokyo-janso', 'Tokyo Jansō', tr('A Shōwa-era mahjong parlour: square table lamps, rule boards, quiet tables and rain on the window.'), ['#0b0c12', '#eef2ff', '#2a3654']),
  V('al-fahidi-majlis', 'Al Fahidi Majlis', tr('Coral-stone walls, a palm-frond ceiling, sadu cushions and the scent of cardamom coffee.'), ['#1d120b', '#ffc888', '#7a1414']),
];

/** True when the player has the World Tour stamp that opens this venue. */
export function venueStampEarned(p: { variationWins: Record<string, number> }, id: string): boolean {
  const s = VENUE_STAMPS[id];
  return !!s && s.destinations.some((d) => (p.variationWins[d] ?? 0) > 0);
}
