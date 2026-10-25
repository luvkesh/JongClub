// Player avatars: an elegant flat-illustration bust in a round frame, drawn
// as an SVG string so it works in the DOM, as a data URL, and as a 3D sprite.
// Purely cosmetic.

import { SKIN_TONES, type AvatarSpec } from './catalog';
import { SEASON_FRAME_RINGS } from './seasonal';

let uid = 0;

function rgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Blend two hex colours; t = 0 gives a, 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const A = rgb(a),
    B = rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

export const shade = (c: string, t: number) => mix(c, '#000000', t);
export const tint = (c: string, t: number) => mix(c, '#ffffff', t);
export const luma = (c: string) => {
  const [r, g, b] = rgb(c);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

/** Ring colours per frame cosmetic: [outer, inner highlight, deep]. */
export const FRAMES: Record<string, [string, string, string]> = {
  'frame-brass': ['#c8a46a', '#f1dcae', '#7a5a2c'],
  'frame-jade': ['#2f7a5c', '#bfe3cf', '#173126'],
  'frame-lacquer': ['#7a1f1b', '#c9a24a', '#2a0e0c'],
  'frame-master': ['#d9b45c', '#fff1c9', '#7a5a2c'],
  'frame-champion': ['#c8a46a', '#f1dcae', '#5a4321'],
  ...SEASON_FRAME_RINGS,
};

/**
 * An avatar bust as an SVG string: head and shoulders inside a circle, with
 * the chosen skin, hair, outfit, accessory and frame.
 */
export function avatarSvg(spec: AvatarSpec, size = 64): string {
  const id = `av${++uid}`;
  const skin = SKIN_TONES[Math.max(0, Math.min(SKIN_TONES.length - 1, spec.skin | 0))] ?? '#eac3a1';
  const skinShade = shade(skin, 0.14);
  const hair = spec.hairColor || '#1b1715';
  const hairHi = tint(hair, 0.18);
  const outfit = spec.outfitColor || '#1f3b33';
  const frame = FRAMES[spec.frame];
  const ring = !!frame;
  // Leave room for the ring when there is one.
  const R = ring ? 42 : 47;
  const bgA = mix(outfit, '#1a1c1b', 0.82);
  const bgB = mix(outfit, '#0b0c0c', 0.9);

  const defs: string[] = [
    `<radialGradient id="${id}bg" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${tint(bgA, 0.1)}"/><stop offset="1" stop-color="${bgB}"/></radialGradient>`,
    `<clipPath id="${id}c"><circle cx="50" cy="50" r="${R}"/></clipPath>`,
    `<linearGradient id="${id}o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tint(outfit, 0.08)}"/><stop offset="1" stop-color="${shade(outfit, 0.25)}"/></linearGradient>`,
    `<linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tint(skin, 0.06)}"/><stop offset="1" stop-color="${shade(skin, 0.06)}"/></linearGradient>`,
  ];
  if (frame) {
    defs.push(
      `<linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${frame[1]}"/><stop offset="0.45" stop-color="${frame[0]}"/><stop offset="1" stop-color="${frame[2]}"/></linearGradient>`,
    );
  }

  const inner: string[] = [];
  inner.push(`<rect x="0" y="0" width="100" height="100" fill="url(#${id}bg)"/>`);
  // A soft halo of light behind the head.
  inner.push(`<circle cx="50" cy="40" r="26" fill="#ffffff" opacity="0.04"/>`);

  inner.push(hairBack(spec.hair, hair));
  inner.push(body(spec.outfit, outfit, skin, id));
  inner.push(head(skin, skinShade, id, spec.face));
  inner.push(face(skin, hair, spec));
  inner.push(facialHair(spec.facialHair, hair, skin));
  const front = hairFront(spec.hair, hair, hairHi, spec.hairPart);
  // A right parting mirrors the swept styles.
  inner.push(spec.hairPart === 'right' && SWEPT.has(spec.hair) ? `<g transform="translate(100 0) scale(-1 1)">${front}</g>` : front);
  inner.push(accessory(spec.accessory, hair));
  inner.push(extras(spec, hair));

  const out: string[] = [];
  out.push(`<g clip-path="url(#${id}c)">${inner.join('')}</g>`);
  if (frame) out.push(frameRing(spec.frame, frame, id, R));
  else out.push(`<circle cx="50" cy="50" r="${R - 0.4}" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="0.8"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="Avatar"><defs>${defs.join('')}</defs>${out.join('')}</svg>`;
}

/** Picked once per page load, so a bot's look is random but holds for the whole session. */
const SESSION_SALT = (Math.random() * 2 ** 32) >>> 0;

const WEAR_COLORS = ['#7a1f1b', '#1a2440', '#2f5a46', '#c8a46a', '#3b3b3b', '#efe6d2', '#5a2d5c', '#a8552b'];

/**
 * A table bot's look with random extras: glasses or sunglasses, a cap, visor,
 * beanie, beret or fedora, sometimes earrings or pearls. Random per bot (by
 * name) but the same for that bot for the rest of the session.
 */
export function withBotAccessories(spec: AvatarSpec, name: string): AvatarSpec {
  let n = SESSION_SALT ^ 0x9e3779b9;
  for (const c of name) n = Math.imul(n ^ c.charCodeAt(0), 0x5bd1e995) >>> 0;
  const rnd = () => {
    n = (Math.imul(n ^ (n >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
    return ((n ^ (n >>> 13)) >>> 0) / 2 ** 32;
  };
  const out: AvatarSpec = { ...spec };
  const e = rnd();
  if (!out.eyewear && out.accessory !== 'glasses') out.eyewear = e < 0.3 ? 'glasses' : e < 0.5 ? 'sunglasses' : e < 0.6 ? 'round' : undefined;
  const h = rnd();
  if (!out.headwear && out.accessory !== 'hat') out.headwear = h < 0.2 ? 'cap' : h < 0.32 ? 'fedora' : h < 0.44 ? 'beanie' : h < 0.54 ? 'beret' : h < 0.62 ? 'visor' : undefined;
  if (out.accessory === 'none') {
    const j = rnd();
    out.accessory = j < 0.14 ? 'earrings' : j < 0.24 ? 'pearls' : j < 0.3 ? 'fan' : 'none';
  }
  // Everyone wears something.
  if (!out.eyewear && !out.headwear && out.accessory === 'none') out.eyewear = rnd() < 0.5 ? 'glasses' : 'sunglasses';
  out.wearColor = WEAR_COLORS[Math.floor(rnd() * WEAR_COLORS.length)];
  return out;
}

/** The same bust as a data URL (for <img> and canvas textures). */
export function avatarDataUrl(spec: AvatarSpec, size = 64): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(avatarSvg(spec, size));
}

// ------------------------------------------------------------ parts

/** Styles whose fringe sweeps to one side, so a right parting mirrors them. */
const SWEPT = new Set<AvatarSpec['hair']>(['short', 'sidepart', 'slicked', 'wavy']);

/** Head outlines per face shape: forehead, cheeks and chin. */
const HEADS: Record<NonNullable<AvatarSpec['face']>, string> = {
  oval: 'M35 38 C35 26 42 21 50 21 C58 21 65 26 65 38 C65 48 60 56 50 57.5 C40 56 35 48 35 38 Z',
  round: 'M34.4 39 C34.4 26 42 21 50 21 C58 21 65.6 26 65.6 39 C65.6 49 59.5 55.6 50 56.4 C40.5 55.6 34.4 49 34.4 39 Z',
  long: 'M35.6 37 C35.6 25 42 20.4 50 20.4 C58 20.4 64.4 25 64.4 37 C64.4 49 60 57.6 50 59 C40 57.6 35.6 49 35.6 37 Z',
  square: 'M34.8 38 C34.8 26 42 21 50 21 C58 21 65.2 26 65.2 38 C65.2 46 64 51 60 54.6 Q55 57.4 50 57.4 Q45 57.4 40 54.6 C36 51 34.8 46 34.8 38 Z',
  heart: 'M34.6 36.6 C34.6 25 42 21 50 21 C58 21 65.4 25 65.4 36.6 C65.4 46 59 54 50 58 C41 54 34.6 46 34.6 36.6 Z',
};

function head(skin: string, skinShade: string, id: string, shape: AvatarSpec['face']) {
  return [
    // Neck with a soft shadow under the jaw.
    `<path d="M43 52 L43 66 Q50 70 57 66 L57 52 Z" fill="${skinShade}"/>`,
    `<path d="M43 58 Q50 63 57 58 L57 54 L43 54 Z" fill="${shade(skin, 0.24)}" opacity="0.55"/>`,
    // Ears
    `<ellipse cx="34.6" cy="42" rx="2.6" ry="4" fill="${skinShade}"/>`,
    `<ellipse cx="65.4" cy="42" rx="2.6" ry="4" fill="${skinShade}"/>`,
    // Head: a gentle oval narrowing to the chin.
    `<path d="${HEADS[shape ?? 'oval'] ?? HEADS.oval}" fill="url(#${id}s)"/>`,
  ].join('');
}

function face(skin: string, hair: string, spec: AvatarSpec) {
  const brow = luma(hair) > 0.55 ? shade(hair, 0.45) : hair;
  const ink = spec.eyeColor ? shade(spec.eyeColor, 0.15) : shade(skin, 0.72);
  const lip = mix(skin, '#9c4a43', 0.45);
  const out: string[] = [];
  // Brows.
  const bw = spec.brows === 'thick' ? 1.7 : spec.brows === 'straight' ? 1.2 : 1.15;
  const B: Record<string, [string, string]> = {
    soft: ['M40.5 37.2 Q43.5 35.6 46.5 36.8', 'M53.5 36.8 Q56.5 35.6 59.5 37.2'],
    straight: ['M40.6 36.8 L46.6 36.4', 'M53.4 36.4 L59.4 36.8'],
    arched: ['M40.4 37.6 Q42.6 34.4 46.6 36.6', 'M53.4 36.6 Q57.4 34.4 59.6 37.6'],
    thick: ['M40.5 37.2 Q43.5 35.4 46.6 36.6', 'M53.4 36.6 Q56.5 35.4 59.5 37.2'],
  };
  for (const d of B[spec.brows ?? 'soft'] ?? B.soft) out.push(`<path d="${d}" stroke="${brow}" stroke-width="${bw}" fill="none" stroke-linecap="round"/>`);
  // Eyes.
  const E: Record<string, [number, number, number]> = { almond: [1.45, 1.2, 0], round: [1.35, 1.45, 0], narrow: [1.55, 0.8, 0], hooded: [1.4, 1.1, 0], upturned: [1.45, 1.15, 12] };
  const [rx, ry, rot] = E[spec.eyes ?? 'almond'] ?? E.almond;
  for (const [cx, side] of [[43.6, -1], [56.4, 1]] as const) {
    out.push(`<ellipse cx="${cx}" cy="41" rx="${rx}" ry="${ry}" fill="${ink}" transform="rotate(${-side * rot} ${cx} 41)"/>`);
    if (spec.eyeColor) out.push(`<circle cx="${cx - 0.4}" cy="40.5" r="0.38" fill="#ffffff" opacity="0.7"/>`);
    if (spec.eyes === 'hooded' || spec.eyes === 'narrow') out.push(`<path d="M${cx - 2.2} 39.9 Q${cx} 38.6 ${cx + 2.2} 39.9" stroke="${shade(skin, 0.3)}" stroke-width="0.6" fill="none" stroke-linecap="round"/>`);
  }
  // Nose.
  const nose = shade(skin, 0.28);
  switch (spec.nose) {
    case 'button':
      out.push(`<path d="M48.6 46.4 Q50 47.6 51.4 46.4" stroke="${nose}" stroke-width="0.9" fill="none" stroke-linecap="round"/>`);
      break;
    case 'broad':
      out.push(`<path d="M50 42.4 L49.6 45.2 M47 46.4 Q48 47.8 50 47.4 Q52 47.8 53 46.4" stroke="${nose}" stroke-width="0.9" fill="none" stroke-linecap="round"/>`);
      break;
    case 'aquiline':
      out.push(`<path d="M50.2 41.6 Q51.4 44 49.6 46.8 Q49.4 47.6 50.8 47.6" stroke="${nose}" stroke-width="0.9" fill="none" stroke-linecap="round"/>`);
      break;
    default:
      out.push(`<path d="M50 42 Q48.6 46.5 50.6 47.2" stroke="${nose}" stroke-width="0.9" fill="none" stroke-linecap="round"/>`);
  }
  // Lips.
  if (spec.lips === 'full') out.push(`<path d="M46.4 50.4 Q50 49.4 53.6 50.4 Q50 54 46.4 50.4 Z" fill="${lip}"/><path d="M46.6 50.6 Q50 51.6 53.4 50.6" stroke="${shade(lip, 0.3)}" stroke-width="0.5" fill="none"/>`);
  else out.push(`<path d="M46.6 50.6 Q50 52.4 53.4 50.6" stroke="${lip}" stroke-width="${spec.lips === 'thin' ? 0.9 : 1.3}" fill="none" stroke-linecap="round"/>`);
  out.push(`<ellipse cx="41" cy="46.5" rx="2.6" ry="1.5" fill="#e07a6a" opacity="0.12"/>`, `<ellipse cx="59" cy="46.5" rx="2.6" ry="1.5" fill="#e07a6a" opacity="0.12"/>`);
  return out.join('');
}

function facialHair(kind: AvatarSpec['facialHair'], c: string, skin: string) {
  const moustache = `<path d="M45.4 49.4 Q48 47.6 50 48.8 Q52 47.6 54.6 49.4 Q52 50.4 50 49.6 Q48 50.4 45.4 49.4 Z" fill="${c}"/>`;
  switch (kind) {
    case 'stubble':
      return `<path d="M36.6 44 C37 51 42 56.6 50 57.4 C58 56.6 63 51 63.4 44 C61 50 56 52.4 50 52.4 C44 52.4 39 50 36.6 44 Z" fill="${mix(skin, c, 0.45)}" opacity="0.45"/>`;
    case 'moustache':
      return moustache;
    case 'goatee':
      return moustache + `<path d="M47 53 Q50 52.2 53 53 Q52.6 57.4 50 57.8 Q47.4 57.4 47 53 Z" fill="${c}"/>`;
    case 'beard':
      return `<path d="M35.6 42 C35.8 52 41 59.6 50 60.4 C59 59.6 64.2 52 64.4 42 C62.6 49 58 51.6 54 51.2 Q50 53.6 46 51.2 C42 51.6 37.4 49 35.6 42 Z" fill="${c}"/>` + moustache;
    default:
      return '';
  }
}

function hairBack(style: AvatarSpec['hair'], c: string) {
  switch (style) {
    case 'long':
      return `<path d="M33 36 C32 22 41 16 50 16 C59 16 68 22 67 36 L69 72 Q50 78 31 72 Z" fill="${shade(c, 0.12)}"/>`;
    case 'wavy':
      return `<path d="M31 38 C29 20 41 14 50 14 C59 14 71 20 69 38 C72 46 68 52 71 60 C66 66 62 64 60 60 L40 60 C38 64 34 66 29 60 C32 52 28 46 31 38 Z" fill="${shade(c, 0.12)}"/>`;
    case 'bob':
      return `<path d="M32.5 37 C32 23 41 17.5 50 17.5 C59 17.5 68 23 67.5 37 L68 55 Q60 58 56 54 L44 54 Q40 58 32 55 Z" fill="${shade(c, 0.12)}"/>`;
    case 'afro':
      return `<circle cx="50" cy="32" r="21" fill="${shade(c, 0.06)}"/><circle cx="50" cy="32" r="21" fill="none" stroke="${shade(c, 0.2)}" stroke-width="1.2" stroke-dasharray="1.5 2"/>`;
    case 'curly':
      return `<path d="M32 40 C30 22 41 15 50 15 C59 15 70 22 68 40 C70 46 67 50 66 54 L34 54 C33 50 30 46 32 40 Z" fill="${shade(c, 0.12)}"/>`;
    case 'ponytail':
      return `<path d="M60 26 C70 28 72 40 68 54 C66 60 63 60 63 54 C64 44 63 34 58 30 Z" fill="${shade(c, 0.1)}"/>`;
    case 'braids':
      return [-1, 1].map((sd) => [0, 1, 2, 3, 4, 5].map((i) => `<ellipse cx="${50 + sd * 16.4}" cy="${46 + i * 4.4}" rx="2.4" ry="2.6" fill="${i % 2 ? c : shade(c, 0.14)}"/>`).join('')).join('');
    case 'topknot':
      return `<circle cx="50" cy="13.5" r="5.2" fill="${c}"/><rect x="47" y="17.2" width="6" height="2" rx="1" fill="${shade(c, 0.3)}"/>`;
    case 'bun':
      return `<circle cx="50" cy="15.5" r="6.8" fill="${c}"/><path d="M45 16 Q50 13 55 16" stroke="${tint(c, 0.2)}" stroke-width="0.8" fill="none"/>`;
    default:
      return '';
  }
}

function hairFront(style: AvatarSpec['hair'], c: string, hi: string, part: AvatarSpec['hairPart']) {
  // A centre parting splits the swept styles down the middle.
  if (part === 'centre' && SWEPT.has(style) && style !== 'wavy')
    return `<path d="M34.6 40 C33 25 41 19.5 50 19.5 C59 19.5 67 25 65.4 40 C64 33 60 28.5 50.5 27 L50 26.4 L49.5 27 C40 28.5 36 33 34.6 40 Z" fill="${c}"/><path d="M50 20 L50 26.4" stroke="${shade(c, 0.35)}" stroke-width="0.6"/>`;
  switch (style) {
    case 'sidepart':
      return `<path d="M34.6 40 C33 25 41 19.5 50 19.5 C59.5 19.5 67 24.5 65.4 40 C64.4 33 62 29.5 58 28.6 C50 27.6 44 31 38.6 31.6 C36.6 33.6 35.2 36.4 34.6 40 Z" fill="${c}"/><path d="M41 21.6 L40 30" stroke="${shade(c, 0.35)}" stroke-width="0.6"/><path d="M45 23.4 Q53 21.4 60 25" stroke="${hi}" stroke-width="0.6" fill="none" opacity="0.5"/>`;
    case 'slicked':
      return `<path d="M35 37 C34 24 41 19 50 19 C59 19 66 24 65 37 C63.6 31 60 27 50 26.4 C40 27 36.4 31 35 37 Z" fill="${c}"/><path d="M40 25 Q50 20.4 60 25 M42 27 Q50 23 58 27" stroke="${shade(c, 0.3)}" stroke-width="0.5" fill="none"/>`;
    case 'buzz':
      return `<path d="M35 37 C35.4 25 42 20.6 50 20.6 C58 20.6 64.6 25 65 37 C62.4 30 57 27.4 50 27.4 C43 27.4 37.6 30 35 37 Z" fill="${c}" opacity="0.82"/>`;
    case 'curly':
    case 'afro': {
      const r = style === 'afro' ? 3.2 : 2.6;
      const curls: string[] = [];
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * (1.08 + 0.84 * (i / 8));
        curls.push(`<circle cx="${(50 + Math.cos(a) * 14.6).toFixed(2)}" cy="${(36 + Math.sin(a) * 12.4).toFixed(2)}" r="${r}" fill="${i % 2 ? c : shade(c, 0.1)}"/>`);
      }
      return `<path d="M35 36 C35 24 42 20 50 20 C58 20 65 24 65 36 C62 30 57 27.4 50 27.4 C43 27.4 38 30 35 36 Z" fill="${c}"/>` + curls.join('');
    }
    case 'ponytail':
    case 'topknot':
      return `<path d="M34.8 38 C33.6 25 41 19.8 50 19.8 C59 19.8 66.4 25 65.2 38 C63.4 30.6 58 27.2 50 27.2 C42 27.2 36.6 30.6 34.8 38 Z" fill="${c}"/><path d="M42 23 Q50 20.6 58 23" stroke="${hi}" stroke-width="0.6" fill="none" opacity="0.45"/>`;
    case 'braids':
      return `<path d="M34.6 40 C33.5 25 41 19.8 50 19.8 C59 19.8 66.5 25 65.4 40 C63.5 31 58 27.2 50.4 27 L50 26.6 L49.6 27 C42 27.2 36.5 31 34.6 40 Z" fill="${c}"/><path d="M50 20 L50 26.6" stroke="${shade(c, 0.35)}" stroke-width="0.6"/>`;
    case 'short':
      // Side part, swept across.
      return `<path d="M34.6 39 C33 25 41 19.5 50 19.5 C59.5 19.5 67 24.5 65.4 39 C64 33 61 29 57 28 C51 27 44 30 38 29.5 C36.2 31.5 35.2 35 34.6 39 Z" fill="${c}"/><path d="M42 24 Q50 21.5 59 24.5" stroke="${hi}" stroke-width="0.8" fill="none" opacity="0.6"/>`;
    case 'shaved':
      return `<path d="M35 36 C35.5 25 42 20.5 50 20.5 C58 20.5 64.5 25 65 36 C62 29 57 26.5 50 26.5 C43 26.5 38 29 35 36 Z" fill="${c}" opacity="0.55"/>`;
    case 'bun':
      return `<path d="M34.6 38 C33.5 25 41 19.8 50 19.8 C59 19.8 66.5 25 65.4 38 C63.5 30.5 58 27 50 27 C42 27 36.5 30.5 34.6 38 Z" fill="${c}"/><path d="M50 20 L50 27" stroke="${shade(c, 0.3)}" stroke-width="0.6"/>`;
    case 'bob':
      return `<path d="M34 42 C32 24 41 19 50 19 C59 19 68 24 66 42 C64 34 63 31 60 30 C54 32 46 32 40 30 C37 31 36 34 34 42 Z" fill="${c}"/><path d="M41 24 Q50 21.5 59 24" stroke="${hi}" stroke-width="0.8" fill="none" opacity="0.5"/>`;
    case 'long':
      // Centre part, falling to the shoulders either side of the face.
      return `<path d="M34.4 46 C32.5 26 40 19.5 50 19.5 C60 19.5 67.5 26 65.6 46 C64.5 36 61 29 50.5 26.5 L50 26 C40 28.5 35.5 36 34.4 46 Z" fill="${c}"/><path d="M35 46 Q34 58 37 66" stroke="${c}" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M65 46 Q66 58 63 66" stroke="${c}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
    case 'wavy':
      return `<path d="M33.5 44 C30.5 24 40.5 18 50 18 C59.5 18 69.5 24 66.5 44 C65 36 63 31 59 29.5 C56 32 52 31 50 29 C47 31.5 43 32 40.5 29.5 C37 31 35 36 33.5 44 Z" fill="${c}"/><path d="M40 23.5 Q45 21 50 22.5 Q55 21 60 23.5" stroke="${hi}" stroke-width="0.8" fill="none" opacity="0.55"/>`;
  }
}

function body(outfit: AvatarSpec['outfit'], c: string, skin: string, id: string) {
  // Shoulders: a calm, broad curve.
  const shoulders = `<path d="M12 100 L12 86 C12 74 26 67 40 64.5 L60 64.5 C74 67 88 74 88 86 L88 100 Z" fill="url(#${id}o)"/>`;
  const gold = '#c8a46a';
  switch (outfit) {
    case 'suit':
      return [
        shoulders,
        // White shirt, black tie.
        `<path d="M42 64.5 L50 80 L58 64.5 Z" fill="#f3efe6"/>`,
        `<path d="M47.6 66.5 L50 64.8 L52.4 66.5 L50 68.4 Z M47.6 70.6 L50 68.4 L52.4 70.6 L50 72.4 Z" fill="#111"/>`,
        `<path d="M40 64.5 L50 84 L44 100 L30 100 L33 72 Z" fill="${shade(c, 0.12)}"/>`,
        `<path d="M60 64.5 L50 84 L56 100 L70 100 L67 72 Z" fill="${shade(c, 0.12)}"/>`,
        `<path d="M40 64.5 L50 84 M60 64.5 L50 84" stroke="${tint(c, 0.18)}" stroke-width="0.6" fill="none"/>`,
        `<rect x="66" y="78" width="6" height="1.6" rx="0.6" fill="#f3efe6" opacity="0.85"/>`,
      ].join('');
    case 'blazer':
      return [
        shoulders,
        `<path d="M42.5 64.5 L50 79 L57.5 64.5 Z" fill="#efe9dc"/>`,
        `<path d="M44 64.5 L47.5 70 L50 66.5 L52.5 70 L56 64.5 Z" fill="#ffffff" opacity="0.8"/>`,
        `<path d="M40 64.5 L50 86 L45 100 L32 100 L34 72 Z" fill="${shade(c, 0.1)}"/>`,
        `<path d="M60 64.5 L50 86 L55 100 L68 100 L66 72 Z" fill="${shade(c, 0.1)}"/>`,
        `<path d="M64.5 77 L71 76 L71.5 79 L65 80 Z" fill="${gold}" opacity="0.9"/>`,
        `<circle cx="50.6" cy="91" r="0.9" fill="${gold}"/>`,
      ].join('');
    case 'qipao':
      return [
        shoulders,
        // High mandarin collar with gold piping and a diagonal closure.
        `<path d="M41 61.5 L59 61.5 L59.5 67 Q50 69.5 40.5 67 Z" fill="${shade(c, 0.08)}"/>`,
        `<path d="M41 61.5 L59 61.5 M40.5 67 Q50 69.5 59.5 67" stroke="${gold}" stroke-width="0.8" fill="none"/>`,
        `<path d="M50 68.8 Q58 72 64 80" stroke="${gold}" stroke-width="0.9" fill="none"/>`,
        `<path d="M55.5 72.5 l3 0 M59.5 75.5 l3 0" stroke="${gold}" stroke-width="1.1" stroke-linecap="round"/>`,
        `<path d="M28 88 Q34 84 36 92 Q30 92 28 88 Z M70 90 Q74 85 77 89 Q73 93 70 90 Z" fill="${tint(c, 0.25)}" opacity="0.35"/>`,
      ].join('');
    case 'kimono':
      return [
        shoulders,
        // A deep V of white under-collar, left side over right, then the obi.
        `<path d="M44 64.5 L56 64.5 L50 77 Z" fill="${skin}"/>`,
        `<path d="M58.5 64.5 L55 64.5 L49 78.5 L51.2 80.5 Z" fill="#f3efe6"/>`,
        `<path d="M41.5 64.5 L45 64.5 L54.5 86 L50.5 88 Z" fill="#f3efe6"/>`,
        `<path d="M41.5 64.5 L50.5 88 L44 88 L37 70 Z" fill="${shade(c, 0.14)}"/>`,
        `<path d="M45 64.5 L54.5 86" stroke="${shade('#f3efe6', 0.18)}" stroke-width="0.5"/>`,
        `<rect x="12" y="88" width="76" height="9" fill="${gold}" opacity="0.92"/>`,
        `<rect x="12" y="91.6" width="76" height="1.4" fill="${shade(gold, 0.35)}" opacity="0.7"/>`,
      ].join('');
    case 'kandura':
      return [
        // Crisp white robe with a round collar and a short tassel (tarboosh).
        `<path d="M12 100 L12 86 C12 74 26 67 40 64.5 L60 64.5 C74 67 88 74 88 86 L88 100 Z" fill="${luma(c) > 0.7 ? c : '#f5f3ee'}"/>`,
        `<path d="M12 100 L12 86 C12 74 26 67 40 64.5 L60 64.5 C74 67 88 74 88 86 L88 100 Z" fill="url(#${id}o)" opacity="0.22"/>`,
        `<path d="M42 64.8 Q50 70 58 64.8" stroke="${shade('#f5f3ee', 0.2)}" stroke-width="1" fill="none"/>`,
        `<path d="M50 68 L50 82" stroke="${shade('#f5f3ee', 0.16)}" stroke-width="0.8"/>`,
        `<path d="M50 68 Q48.5 76 49 84" stroke="${luma(c) > 0.7 ? '#c9a24a' : c}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
        `<circle cx="49" cy="85" r="1.4" fill="${luma(c) > 0.7 ? '#c9a24a' : c}"/>`,
      ].join('');
    case 'sweater':
      return [
        shoulders,
        // Ribbed crew neck with a shirt collar peeking out.
        `<path d="M41 64 Q50 72 59 64 L60.5 65.5 Q50 75.5 39.5 65.5 Z" fill="${shade(c, 0.18)}"/>`,
        `<path d="M43 64.5 L47 69 L50 66 L53 69 L57 64.5 Z" fill="#efe9dc"/>`,
        `<path d="M28 76 L30 100 M72 76 L70 100" stroke="${shade(c, 0.12)}" stroke-width="0.8" opacity="0.6"/>`,
      ].join('');
  }
}

function accessory(a: AvatarSpec['accessory'], hair: string) {
  const gold = '#c8a46a';
  switch (a) {
    case 'glasses':
      return [
        `<circle cx="43.6" cy="41" r="3.9" fill="#ffffff" fill-opacity="0.06" stroke="${gold}" stroke-width="0.8"/>`,
        `<circle cx="56.4" cy="41" r="3.9" fill="#ffffff" fill-opacity="0.06" stroke="${gold}" stroke-width="0.8"/>`,
        `<path d="M47.5 40.6 Q50 39.4 52.5 40.6 M39.7 40.4 L35.4 39.6 M60.3 40.4 L64.6 39.6" stroke="${gold}" stroke-width="0.7" fill="none"/>`,
      ].join('');
    case 'aviators':
      return [
        ...[[43.4, -1], [56.6, 1]].map(([cx, sd]) => `<path d="M${cx - sd * 4.6} 38.6 Q${cx} 37.6 ${cx + sd * 4.6} 38.6 Q${cx + sd * 4.4} 44.6 ${cx + sd * 0.6} 45.2 Q${cx - sd * 4.4} 44.6 ${cx - sd * 4.6} 38.6 Z" fill="#2a2a26" fill-opacity="0.88" stroke="${gold}" stroke-width="0.75"/>`),
        `<path d="M47.8 38.8 Q50 38 52.2 38.8 M48 40.6 L52 40.6 M38.8 38.8 L35.2 38.4 M61.2 38.8 L64.8 38.4" stroke="${gold}" stroke-width="0.6" fill="none"/>`,
        `<path d="M40.4 39.6 L42.8 39.4 M53.6 39.4 L56 39.6" stroke="#ffffff" stroke-opacity="0.4" stroke-width="0.6"/>`,
      ].join('');
    case 'pixel': {
      // A stepped black bar of square pixels with two white glints.
      const px = 1.6;
      const cells: string[] = [];
      for (let x = 38.4; x < 61.6; x += px) cells.push(`<rect x="${x.toFixed(1)}" y="38" width="${px + 0.05}" height="${px + 0.05}" fill="#0b0b0c"/>`);
      for (const base of [38.4, 51.2])
        for (let r = 1; r <= 3; r++)
          for (let k = 0; k < 7; k++) {
            if (r === 3 && (k === 0 || k === 6)) continue;
            const white = r === 1 && (k === 1 || k === 2);
            cells.push(`<rect x="${(base + k * px).toFixed(1)}" y="${(38 + r * px).toFixed(1)}" width="${px + 0.05}" height="${px + 0.05}" fill="${white ? '#f4f4f4' : '#0b0b0c'}"/>`);
          }
      cells.push(`<path d="M38.4 38.6 L35.2 38.2 M61.6 38.6 L64.8 38.2" stroke="#0b0b0c" stroke-width="0.9"/>`);
      return cells.join('');
    }
    case 'earrings':
      return [
        `<path d="M34.6 45.5 L34.6 48" stroke="${gold}" stroke-width="0.6"/><ellipse cx="34.6" cy="50" rx="1.5" ry="2.1" fill="#2f7a5c"/><ellipse cx="34.2" cy="49.4" rx="0.5" ry="0.7" fill="#bfe3cf" opacity="0.7"/>`,
        `<path d="M65.4 45.5 L65.4 48" stroke="${gold}" stroke-width="0.6"/><ellipse cx="65.4" cy="50" rx="1.5" ry="2.1" fill="#2f7a5c"/><ellipse cx="65" cy="49.4" rx="0.5" ry="0.7" fill="#bfe3cf" opacity="0.7"/>`,
      ].join('');
    case 'hat': {
      const felt = luma(hair) < 0.25 ? '#2e2823' : '#2a2520';
      return [
        // Fedora: a wide brim and a pinched crown with a ribbon.
        `<ellipse cx="50" cy="29" rx="22" ry="4.6" fill="${shade(felt, 0.2)}"/>`,
        `<path d="M37 29 C37 18 42 12.5 50 12.5 C58 12.5 63 18 63 29 Z" fill="${felt}"/>`,
        `<path d="M44 14.5 Q50 19 56 14.5" stroke="${shade(felt, 0.35)}" stroke-width="0.9" fill="none"/>`,
        `<rect x="37" y="24.2" width="26" height="3.4" fill="${shade(gold, 0.3)}"/>`,
        `<ellipse cx="50" cy="28.4" rx="21" ry="3" fill="none" stroke="#ffffff" stroke-opacity="0.07" stroke-width="0.6"/>`,
      ].join('');
    }
    case 'fan':
      // A folded silk fan held low across the chest.
      return [
        `<g transform="translate(66 86) rotate(-28)">`,
        `<path d="M0 0 L-15 -14 A20.5 20.5 0 0 1 15 -14 Z" fill="#b3352a"/>`,
        `<path d="M0 0 L-15 -14 A20.5 20.5 0 0 1 15 -14 Z" fill="none" stroke="${gold}" stroke-width="0.7"/>`,
        ...[-11, -5.5, 0, 5.5, 11].map((x) => `<path d="M0 0 L${x} -18.5" stroke="${shade('#b3352a', 0.3)}" stroke-width="0.5"/>`),
        `<path d="M-9 -13 Q0 -17 9 -13" stroke="#e8cb92" stroke-width="0.6" fill="none" opacity="0.8"/>`,
        `<circle cx="0" cy="0" r="1.2" fill="${gold}"/>`,
        `</g>`,
      ].join('');
    case 'pearls': {
      const beads: string[] = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const a = Math.PI * (0.12 + 0.76 * t);
        const x = 50 - Math.cos(a) * 11;
        const y = 63 + Math.sin(a) * 7.5;
        beads.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="1.25" fill="#f6f2ee"/><circle cx="${(x - 0.4).toFixed(2)}" cy="${(y - 0.4).toFixed(2)}" r="0.45" fill="#ffffff"/>`);
      }
      return beads.join('');
    }
    default:
      return '';
  }
}

/** Bot extras (eyewear and headwear) in the flat bust. */
function extras(spec: AvatarSpec, hair: string) {
  const out: string[] = [];
  const gold = '#c8a46a';
  const wear = spec.wearColor || '#7a1f1b';
  if (spec.eyewear === 'sunglasses') {
    out.push(
      `<rect x="38.6" y="37.6" width="9.6" height="6.6" rx="2.6" fill="#0b0d10" stroke="#111" stroke-width="0.7"/>`,
      `<rect x="51.8" y="37.6" width="9.6" height="6.6" rx="2.6" fill="#0b0d10" stroke="#111" stroke-width="0.7"/>`,
      `<path d="M48.2 39.8 Q50 38.8 51.8 39.8 M38.6 39.6 L35.2 38.8 M61.4 39.6 L64.8 38.8" stroke="#111" stroke-width="0.8" fill="none"/>`,
      `<path d="M40 39 L43 39" stroke="#ffffff" stroke-opacity="0.35" stroke-width="0.6"/>`,
    );
  } else if (spec.eyewear === 'glasses' || spec.eyewear === 'round') {
    const r = spec.eyewear === 'round' ? 4.2 : 3.9;
    out.push(
      `<circle cx="43.6" cy="41" r="${r}" fill="#ffffff" fill-opacity="0.06" stroke="${gold}" stroke-width="0.8"/>`,
      `<circle cx="56.4" cy="41" r="${r}" fill="#ffffff" fill-opacity="0.06" stroke="${gold}" stroke-width="0.8"/>`,
      `<path d="M47.5 40.6 Q50 39.4 52.5 40.6 M39.7 40.4 L35.4 39.6 M60.3 40.4 L64.6 39.6" stroke="${gold}" stroke-width="0.7" fill="none"/>`,
    );
  }
  switch (spec.headwear) {
    case 'cap':
      out.push(
        `<path d="M34 31 C34 19 41 15 50 15 C59 15 66 19 66 31 Z" fill="${wear}"/>`,
        `<path d="M34 31 Q50 28 66 31 Q62 35.5 50 35 Q38 35.5 34 31 Z" fill="${shade(wear, 0.25)}"/>`,
        `<path d="M50 15 L50 30" stroke="${shade(wear, 0.3)}" stroke-width="0.6"/><circle cx="50" cy="15.4" r="1.3" fill="${shade(wear, 0.2)}"/>`,
      );
      break;
    case 'visor':
      out.push(`<path d="M34.5 27 Q50 22 65.5 27 L65.5 30.5 Q50 26 34.5 30.5 Z" fill="${wear}"/>`, `<path d="M36 30 Q50 26.5 64 30 Q60 34.5 50 34 Q40 34.5 36 30 Z" fill="${shade(wear, 0.25)}"/>`);
      break;
    case 'beanie':
      out.push(
        `<path d="M34 32 C33 18 41 13 50 13 C59 13 67 18 66 32 Z" fill="${wear}"/>`,
        `<rect x="33.5" y="27.5" width="33" height="5.5" rx="2.4" fill="${shade(wear, 0.18)}"/>`,
        `<circle cx="50" cy="12" r="3.4" fill="${tint(wear, 0.15)}"/>`,
      );
      break;
    case 'beret':
      out.push(`<ellipse cx="52" cy="23" rx="18" ry="6.5" transform="rotate(-8 52 23)" fill="${wear}"/>`, `<path d="M53 16.6 l0.4 -2.4" stroke="${wear}" stroke-width="1.4" stroke-linecap="round"/>`);
      break;
    case 'fedora':
      if (spec.accessory !== 'hat') out.push(accessory('hat', hair));
      break;
  }
  return out.join('');
}

function frameRing(fid: string, f: [string, string, string], id: string, R: number) {
  const out: string[] = [];
  const mid = R + 3.4;
  out.push(`<circle cx="50" cy="50" r="${mid}" fill="none" stroke="url(#${id}r)" stroke-width="5.4"/>`);
  out.push(`<circle cx="50" cy="50" r="${R + 0.6}" fill="none" stroke="${f[1]}" stroke-opacity="0.65" stroke-width="0.6"/>`);
  out.push(`<circle cx="50" cy="50" r="${mid + 2.6}" fill="none" stroke="${f[2]}" stroke-opacity="0.7" stroke-width="0.5"/>`);
  if (fid === 'frame-jade') {
    // Carved notches around the jade ring.
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const x1 = 50 + Math.cos(a) * (mid - 1.8),
        y1 = 50 + Math.sin(a) * (mid - 1.8);
      const x2 = 50 + Math.cos(a) * (mid + 1.8),
        y2 = 50 + Math.sin(a) * (mid + 1.8);
      out.push(`<path d="M${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)}" stroke="${f[2]}" stroke-opacity="0.35" stroke-width="0.5"/>`);
    }
  } else if (fid === 'frame-lacquer') {
    out.push(`<circle cx="50" cy="50" r="${mid}" fill="none" stroke="${f[1]}" stroke-width="0.5" stroke-dasharray="1.2 2.4" opacity="0.8"/>`);
  } else if (fid === 'frame-master') {
    // A small crown at the top of the ring.
    out.push(
      `<path d="M42.5 6.2 L44.5 0.8 L47.4 4.4 L50 0 L52.6 4.4 L55.5 0.8 L57.5 6.2 Z" fill="url(#${id}r)" stroke="${f[2]}" stroke-width="0.4"/>`,
      `<circle cx="50" cy="3.6" r="0.9" fill="#b3352a"/>`,
    );
  } else if (fid.startsWith('frame-season-')) {
    // A season frame: a fine inner band and a small lozenge at the top, in the season's colours.
    out.push(
      `<circle cx="50" cy="50" r="${mid}" fill="none" stroke="${f[2]}" stroke-opacity="0.55" stroke-width="0.7" stroke-dasharray="0.6 1.8"/>`,
      `<path d="M50 0.6 L53.4 4.6 L50 8.6 L46.6 4.6 Z" fill="url(#${id}r)" stroke="${f[2]}" stroke-width="0.5"/>`,
      `<circle cx="50" cy="4.6" r="1.1" fill="${f[1]}"/>`,
    );
  } else if (fid === 'frame-champion') {
    // Laurel sprays rising from the foot of the ring on either side: paired leaves along a gold stem.
    for (const side of [-1, 1]) {
      const a0 = Math.PI / 2 + side * 0.28,
        a1 = Math.PI / 2 + side * 1.75;
      const p = (a: number, r: number) => [50 + Math.cos(a) * r, 50 + Math.sin(a) * r];
      const [sx, sy] = p(a0, mid),
        [ex, ey] = p(a1, mid);
      out.push(`<path d="M${sx.toFixed(2)} ${sy.toFixed(2)} A${mid} ${mid} 0 0 ${side > 0 ? 1 : 0} ${ex.toFixed(2)} ${ey.toFixed(2)}" stroke="${f[1]}" stroke-width="0.6" fill="none"/>`);
      for (let i = 0; i < 7; i++) {
        const a = a0 + (a1 - a0) * (i / 6);
        const tang = (a * 180) / Math.PI + 90;
        for (const off of [-1, 1]) {
          const [x, y] = p(a, mid + off * 2.1);
          const rot = tang + off * side * 32;
          out.push(`<ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx="2.5" ry="1" transform="rotate(${rot.toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})" fill="${off > 0 ? '#3f8a62' : '#2f7a5c'}"/>`);
        }
      }
    }
  }
  return out.join('');
}
