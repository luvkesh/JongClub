// The club's Small and Big Cards as printed cards: each card gets its own face from what it is.
// The palette comes from the card's name and tiles (ruby for Red Dragons, jade for Green, sapphire
// for Rings, vermilion for Cracks, bamboo green, indigo winds, pearl for White), the emblem from
// its name (a lily, a crown, a lantern, a snake, a tower of kongs...), and the background from a
// set of engraved patterns. Pure strings: no images to load, crisp at any size.

import { parseKinds } from '../engine/tiles';

export interface CardPalette {
  id: string;
  /** Dark accent on ivory: the rule text's headings, the felt under the tiles. */
  ink: string;
  /** Foil: light and dark ends of the metallic gradient (kept for the older views). */
  foil: string;
  foil2: string;
  /** A wash over ivory. */
  wash: string;
  /** The lacquered card stock: top and bottom of its gradient. */
  deep: string;
  deep2: string;
  /** Gold foil, or platinum on the pearl cards. */
  metal: 'gold' | 'platinum';
}

export const PALETTES: Record<string, CardPalette> = {
  ruby: { id: 'ruby', ink: '#7a1522', foil: '#f0c38a', foil2: '#9c5a2a', wash: 'rgba(176, 38, 52, 0.13)', deep: '#6e1320', deep2: '#2a050b', metal: 'gold' },
  jade: { id: 'jade', ink: '#1d5a43', foil: '#e5d9a0', foil2: '#7a7a3a', wash: 'rgba(46, 140, 100, 0.13)', deep: '#145240', deep2: '#04190f', metal: 'gold' },
  pearl: { id: 'pearl', ink: '#34465c', foil: '#eef1f4', foil2: '#8b97a6', wash: 'rgba(120, 150, 190, 0.12)', deep: '#33465e', deep2: '#0e1520', metal: 'platinum' },
  sapphire: { id: 'sapphire', ink: '#1f3b73', foil: '#e8d29a', foil2: '#8a6a32', wash: 'rgba(48, 92, 176, 0.12)', deep: '#1a3770', deep2: '#060f26', metal: 'gold' },
  vermilion: { id: 'vermilion', ink: '#8a2c16', foil: '#f2cf8f', foil2: '#a2622a', wash: 'rgba(206, 84, 40, 0.12)', deep: '#7a2a12', deep2: '#2a0b04', metal: 'gold' },
  bamboo: { id: 'bamboo', ink: '#3d5a1c', foil: '#ead9a0', foil2: '#86743a', wash: 'rgba(110, 150, 50, 0.13)', deep: '#3a5418', deep2: '#111c05', metal: 'gold' },
  indigo: { id: 'indigo', ink: '#2c2a66', foil: '#e6d4a4', foil2: '#7c6a3e', wash: 'rgba(80, 76, 170, 0.12)', deep: '#2c2a6e', deep2: '#0b0a26', metal: 'gold' },
  gold: { id: 'gold', ink: '#6b4a12', foil: '#fbe7a6', foil2: '#a8782a', wash: 'rgba(214, 170, 60, 0.16)', deep: '#5a3d0e', deep2: '#1e1203', metal: 'gold' },
  rose: { id: 'rose', ink: '#7a2a52', foil: '#f3d2c0', foil2: '#a2645a', wash: 'rgba(200, 90, 140, 0.12)', deep: '#6a1f46', deep2: '#230717', metal: 'gold' },
  onyx: { id: 'onyx', ink: '#2a2622', foil: '#e9d6a6', foil2: '#8a6e3a', wash: 'rgba(40, 36, 30, 0.1)', deep: '#2e2a26', deep2: '#0a0908', metal: 'gold' },
};

/** Foil gradient stops: gold, or platinum for the pearl cards. */
export const METAL: Record<CardPalette['metal'], string[]> = {
  gold: ['#fff4cf', '#e9c877', '#b8892e', '#f7e2a3', '#9c6f22'],
  platinum: ['#ffffff', '#dfe6ee', '#9aa7b6', '#f2f5f8', '#7d8a99'],
};

const NAME_PALETTE: [RegExp, string][] = [
  [/ruby|red/i, 'ruby'],
  [/jade/i, 'jade'],
  [/golden|treasure|\bking\b/i, 'gold'],
  [/blossom|apple|garden|angels/i, 'rose'],
  [/wind|news|e&w/i, 'indigo'],
  [/bomb|blunder|bastard|dirty/i, 'onyx'],
];

/** The card's colours: its name first (Royal Ruby is ruby), else the tiles it is made of. */
export function paletteOf(name: string, picture: string): CardPalette {
  for (const [re, id] of NAME_PALETTE) if (re.test(name)) return PALETTES[id];
  const score: Record<string, number> = {};
  const add = (id: string, v: number) => (score[id] = (score[id] ?? 0) + v);
  for (const k of parseKinds(picture)) {
    if (k === 31) add('pearl', 2);
    else if (k === 32) add('jade', 2);
    else if (k === 33) add('ruby', 2);
    else if (k >= 27 && k <= 30) add('indigo', 1.2);
    else if (k >= 34) add('rose', 1);
    else add(['vermilion', 'sapphire', 'bamboo'][Math.floor(k / 9)], 1);
  }
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return PALETTES[best?.[0] ?? 'gold'];
}

// ------------------------------------------------------------------ emblems (48 x 48, ink strokes)

const E: Record<string, string> = {
  flower: '<path d="M24 38c0-7 0-12 0-16"/><path d="M24 22c-5-2-8-7-7-13 4 1 7 5 7 9 0-4 3-8 7-9 1 6-2 11-7 13z"/><path d="M24 30c-4-3-9-3-12-1 3 3 8 4 12 1zM24 30c4-3 9-3 12-1-3 3-8 4-12 1z"/>',
  gem: '<path d="M14 18 19 11h10l5 7-10 19z"/><path d="M14 18h20M19 11l5 7 5-7M24 18v19"/>',
  crown: '<path d="M11 33 9 16l8 7 7-11 7 11 8-7-2 17z"/><path d="M12 37h24"/><circle cx="24" cy="10" r="1.6"/><circle cx="9" cy="14.5" r="1.4"/><circle cx="39" cy="14.5" r="1.4"/>',
  dragon: '<path d="M10 30c3-9 12-12 18-8 5 3 4 10-2 10-4 0-5-5-1-6"/><path d="M28 22c3-6 9-8 12-6-2 1-3 3-3 5"/><circle cx="34.5" cy="17.8" r="1"/><path d="M10 30c-1 4 1 7 5 8M17 35c2 2 6 3 9 2"/>',
  wind: '<path d="M8 18h20a5 5 0 1 0-5-5"/><path d="M8 25h28a5 5 0 1 1-5 5"/><path d="M12 32h10"/>',
  compass: '<circle cx="24" cy="24" r="14"/><path d="M24 8v6M24 34v6M8 24h6M34 24h6"/><path d="m24 15 4 9-4 9-4-9z"/>',
  cloud: '<path d="M10 30a6 6 0 0 1 4-11 8 8 0 0 1 15-2 6 6 0 0 1 9 6 4 4 0 0 1-1 7z"/><path d="M15 36h18M19 40h10"/>',
  gate: '<path d="M8 13h32M10 18h28"/><path d="M14 18v20M34 18v20"/><path d="M6 10c6 2 30 2 36 0"/><path d="M24 18v6"/>',
  snake: '<path d="M8 32c4-8 8-8 10 0s6 8 10 0 6-8 10 0"/><path d="M38 32c2-3 3-3 4-2"/><circle cx="40.5" cy="29.5" r=".8"/><path d="M8 32c-1 2-1 4 1 5"/>',
  steps: '<path d="M8 38h8v-7h8v-7h8v-7h8V9"/><path d="M8 38h32"/>',
  triangle: '<path d="M24 9 39 36H9z"/><path d="M24 18 31 31H17z"/>',
  scroll: '<path d="M14 12h20v24H14z"/><path d="M11 12a3 3 0 0 1 6 0M31 36a3 3 0 0 0 6 0"/><path d="M18 18h12M18 23h12M18 28h8"/>',
  lantern: '<path d="M24 6v4M19 10h10M19 38h10M24 38v4"/>' + '<path d="M16 15c0-3 16-3 16 0v18c0 3-16 3-16 0z"/><path d="M24 12v28M16 24h16"/>',
  wings: '<ellipse cx="24" cy="25" rx="3" ry="9"/><path d="M21 21c-6-8-14-6-12 0 2 5 8 5 12 2M27 21c6-8 14-6 12 0-2 5-8 5-12 2M22 29c-4 4-9 5-9 1M26 29c4 4 9 5 9 1"/><path d="M22 16l-3-5M26 16l3-5"/>',
  twin: '<circle cx="18" cy="24" r="8"/><circle cx="30" cy="24" r="8"/>',
  tower: '<rect x="15" y="8" width="18" height="7" rx="1.5"/><rect x="15" y="16.5" width="18" height="7" rx="1.5"/><rect x="15" y="25" width="18" height="7" rx="1.5"/><rect x="15" y="33.5" width="18" height="7" rx="1.5"/>',
  knot: '<path d="M14 16c8 0 12 16 20 16M14 32c8 0 12-16 20-16"/><circle cx="12" cy="16" r="3"/><circle cx="12" cy="32" r="3"/><circle cx="36" cy="16" r="3"/><circle cx="36" cy="32" r="3"/>',
  trefoil: '<circle cx="24" cy="16" r="7"/><circle cx="16.5" cy="29" r="7"/><circle cx="31.5" cy="29" r="7"/>',
  coin: '<circle cx="24" cy="24" r="14"/><rect x="19" y="19" width="10" height="10"/><path d="M24 10v4M24 34v4"/>',
  burst: '<path d="M24 7l3 10 10-5-5 10 10 3-10 3 5 10-10-5-3 10-3-10-10 5 5-10-10-3 10-3-5-10 10 5z"/>',
  mask: '<path d="M10 16c6-4 22-4 28 0 0 12-6 20-14 20s-14-8-14-20z"/><path d="M15 21c2-2 5-2 7 0M26 21c2-2 5-2 7 0M18 29c4 3 8 3 12 0"/>',
  fan: '<path d="M24 36 9 18c9-7 21-7 30 0z"/><path d="M24 36 16 14M24 36V12M24 36l8-22"/>',
  heart: '<path d="M24 37s-13-8-13-17a7 7 0 0 1 13-4 7 7 0 0 1 13 4c0 9-13 17-13 17z"/>',
  number: '',
};

const NAME_EMBLEM: [RegExp, string][] = [
  [/lily|blossom|garden|apple/i, 'flower'],
  [/\broyal|\bimperial|\bking\b/i, 'crown'],
  [/ruby|jade|treasure|purity/i, 'gem'],
  [/news/i, 'compass'],
  [/dragon fly|bee|sparrow/i, 'wings'],
  [/dragon/i, 'dragon'],
  [/wind|e&w/i, 'wind'],
  [/gates/i, 'gate'],
  [/twin|pair/i, 'twin'],
  [/heaven|angel|blessing/i, 'cloud'],
  [/snake|spiral/i, 'snake'],
  [/staircase|sequen|\brun\b|chows/i, 'steps'],
  [/triangle/i, 'triangle'],
  [/scholar|philosoph|chinese/i, 'scroll'],
  [/lantern/i, 'lantern'],
  [/knit|garter|ringlet/i, 'knot'],
  [/mixed|crochet|triple/i, 'trefoil'],
  [/heads|terminal|unique|major|ones|nines|honour/i, 'coin'],
  [/bomb|blunder/i, 'burst'],
  [/joker|bastard|silly|dirty|ulta/i, 'mask'],
  [/robert|seventh|odd|even|t\.o\.e|56|same number/i, 'number'],
  [/qwong|kong/i, 'tower'],
];

export function emblemOf(name: string): string {
  for (const [re, id] of NAME_EMBLEM) if (re.test(name)) return id;
  return 'fan';
}

/** The emblem's drawing in a 48 x 48 box: strokes, or the card's number set large for the number cards. */
export function emblemBody(name: string, n: number, fill = 'currentColor'): string {
  const id = emblemOf(name);
  return id === 'number' ? `<text x="24" y="31.5" text-anchor="middle" font-family="Cinzel, serif" font-size="${n > 9 ? 17 : 20}" font-weight="700" fill="${fill}" stroke="none">${n}</text>` : E[id];
}

/** The emblem as SVG: drawn strokes, or the card's number set large for the number cards. */
export function emblemSvg(name: string, n: number): string {
  const body = emblemBody(name, n);
  return `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

// ------------------------------------------------------------------ engraved background patterns

const PATTERNS = [
  // fret
  '<path d="M0 6h6V0M6 12V6h6M12 6h6V0M18 12V6h6" />',
  // waves
  '<path d="M0 8c3-4 6-4 9 0s6 4 9 0 6-4 9 0"/><path d="M0 16c3-4 6-4 9 0s6 4 9 0 6-4 9 0"/>',
  // coins
  '<circle cx="6" cy="6" r="4.5"/><rect x="4" y="4" width="4" height="4"/><circle cx="18" cy="18" r="4.5"/><rect x="16" y="16" width="4" height="4"/>',
  // lattice
  '<path d="M0 0l24 24M24 0 0 24"/>',
  // clouds
  '<path d="M2 14a4 4 0 0 1 7-3 4 4 0 0 1 7 1 3 3 0 0 1 0 6H4a3 3 0 0 1-2-4z"/>',
  // scales
  '<path d="M0 12a6 6 0 0 1 12 0M12 12a6 6 0 0 1 12 0M-6 24a6 6 0 0 1 12 0M6 24a6 6 0 0 1 12 0M18 24a6 6 0 0 1 12 0"/>',
];

export function patternSvg(n: number, big: boolean): string {
  const i = (n * (big ? 5 : 7) + (big ? 3 : 0)) % PATTERNS.length;
  const id = `ccp-${big ? 'b' : 's'}${n}`;
  return `<svg class="cc-pattern" aria-hidden="true" width="100%" height="100%"><defs><pattern id="${id}" width="24" height="24" patternUnits="userSpaceOnUse"><g fill="none" stroke="currentColor" stroke-width="0.8">${PATTERNS[i]}</g></pattern></defs><rect width="100%" height="100%" fill="url(#${id})"/></svg>`;
}

// ------------------------------------------------------------------ the printed playing card

let uidSeq = 0;
const stops = (c: string[]) => c.map((x, i) => `<stop offset="${(i / (c.length - 1)).toFixed(2)}" stop-color="${x}"/>`).join('');

/** A guilloché rosette (the engraving on banknotes): rotated ellipses round a centre. */
function rosette(cx: number, cy: number, r: number, petals: number, squash: number, stroke: string, width: number, opacity: number): string {
  let out = `<g fill="none" stroke="${stroke}" stroke-width="${width}" opacity="${opacity}">`;
  for (let i = 0; i < petals; i++) out += `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${(r * squash).toFixed(2)}" transform="rotate(${((180 / petals) * i).toFixed(2)} ${cx} ${cy})"/>`;
  return out + '</g>';
}

/** Art Deco corner: two nested foil brackets that hold the corner index, drawn for the top-left corner of a 500 x 700 card. */
const DECO_CORNER = '<path d="M30 132V46a16 16 0 0 1 16-16h86"/><path d="M39 118V56a17 17 0 0 1 17-17h62"/><path d="M30 146v10M146 30h10" stroke-width="1.4"/>';

/**
 * The card stock and everything printed behind the text: lacquer in the card's colours, an engraved
 * pattern and guilloché wash, the double foil frame with Art Deco corners. A 500 x 700 drawing
 * (2.5 x 3.5 in), scaled whole with the card, so the print keeps its proportions at any size.
 */
export function cardStockSvg(pal: CardPalette, n: number, big: boolean): string {
  const u = `cc${++uidSeq}`;
  const m = METAL[pal.metal];
  const pi = (n * (big ? 5 : 7) + (big ? 3 : 0)) % PATTERNS.length;
  const corner = (t: string) => `<g transform="${t}">${DECO_CORNER}</g>`;
  return `<svg class="cc-stock" viewBox="0 0 500 700" preserveAspectRatio="none" aria-hidden="true">
<defs>
<linearGradient id="${u}b" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${pal.deep}"/><stop offset="1" stop-color="${pal.deep2}"/></linearGradient>
<radialGradient id="${u}g" cx="0.5" cy="0.22" r="0.65"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="${u}f" x1="0" y1="0" x2="1" y2="1">${stops(m)}</linearGradient>
<pattern id="${u}p" width="24" height="24" patternUnits="userSpaceOnUse"><g fill="none" stroke="${m[1]}" stroke-width="0.7">${PATTERNS[pi]}</g></pattern>
</defs>
<rect width="500" height="700" fill="url(#${u}b)"/>
<rect width="500" height="700" fill="url(#${u}p)" opacity="0.13"/>
${rosette(250, 158, 150, 36, 0.32, m[1], 0.6, 0.12)}
<rect width="500" height="700" fill="url(#${u}g)"/>
<g fill="none" stroke="url(#${u}f)">
<rect x="18" y="18" width="464" height="664" rx="22" stroke-width="3"/>
<rect x="27" y="27" width="446" height="646" rx="16" stroke-width="1.1"/>
<g stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${corner('')}${corner('translate(500 0) scale(-1 1)')}${corner('translate(0 700) scale(1 -1)')}${corner('translate(500 700) scale(-1 -1)')}</g>
</g>
</svg>`;
}

/** The medallion at the head of the card: foil rings, a guilloché rosette and the card's emblem. */
export function medallionSvg(name: string, n: number, pal: CardPalette): string {
  const u = `cm${++uidSeq}`;
  const m = METAL[pal.metal];
  return `<svg class="cc-medallion" viewBox="0 0 120 120" aria-hidden="true">
<defs><linearGradient id="${u}f" x1="0" y1="0" x2="1" y2="1">${stops(m)}</linearGradient>
<radialGradient id="${u}d" cx="0.45" cy="0.38" r="0.7"><stop offset="0" stop-color="${pal.deep}"/><stop offset="1" stop-color="${pal.deep2}"/></radialGradient></defs>
<circle cx="60" cy="60" r="56" fill="url(#${u}d)" stroke="url(#${u}f)" stroke-width="3"/>
${rosette(60, 60, 48, 24, 0.38, `url(#${u}f)`, 0.55, 0.55)}
<circle cx="60" cy="60" r="50" fill="none" stroke="url(#${u}f)" stroke-width="0.9"/>
<circle cx="60" cy="60" r="31" fill="url(#${u}d)" stroke="url(#${u}f)" stroke-width="1.6"/>
<g transform="translate(36 36)" fill="none" stroke="url(#${u}f)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${emblemBody(name, n, `url(#${u}f)`)}</g>
</svg>`;
}

/** The small emblem under a corner number (the card's "pip"). */
export function pipSvg(name: string, n: number): string {
  return `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${emblemBody(name, n)}</svg>`;
}
