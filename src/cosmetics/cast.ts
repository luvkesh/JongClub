// The named table characters' own looks. Every AI seat called Mei, Rex, Hiro,
// Lucky, Amara (or one of their alternates) wears the same signature look in
// every game, in the seat portraits and on the website: the cute, stylised
// cast from the user's "At the table" design (2026-11-06). Other bot names
// keep a random look (withBotAccessories in avatar.ts).

import { DEFAULT_AVATAR, type AvatarSpec } from './catalog';

const look = (x: Partial<AvatarSpec>): AvatarSpec => ({ ...DEFAULT_AVATAR, face: 'round', eyes: 'round', nose: 'button', brows: 'soft', lips: 'medium', ...x });

export const CAST: Record<string, AvatarSpec> = {
  // The Teacher: long hair with a bun, round gold glasses, an indigo cape with a gold frog over a white blouse.
  Mei: look({ skin: 7, hair: 'long', hairColor: '#3b2a20', hairPart: 'centre', hairBun: 'side', eyewear: 'round', outfit: 'blazer', outfitColor: '#3c3768', garment: 'cape', eyeColor: '#4a2c1a' }),
  // The Shark: a silver bob with a swept quiff, black round shades, a dark mandarin jacket with tan straps and a knight badge.
  Rex: look({ skin: 2, hair: 'bob', hairColor: '#c4c1bb', hairPart: 'left', eyewear: 'sunglasses', outfit: 'qipao', outfitColor: '#1d1e24', garment: 'straps', badge: 'knight', brows: 'straight', eyeColor: '#2a1a12' }),
  // The Wall: a dark bob under an orange beret, round gold glasses, a cream turtleneck and leather braces.
  Hiro: look({ skin: 7, hair: 'bob', hairColor: '#2a1d17', hairPart: 'centre', eyewear: 'round', headwear: 'beret', wearColor: '#e07a32', outfit: 'sweater', outfitColor: '#ece2d0', turtleneck: true, garment: 'suspenders', eyeColor: '#3a2416' }),
  // The Gambler: a dark bob under a wide-brimmed hat, a red blazer, a cream scarf and a spade pin.
  Lucky: look({ skin: 3, hair: 'bob', hairColor: '#1b1715', hairPart: 'centre', headwear: 'fedora', wearColor: '#c46a2a', outfit: 'blazer', outfitColor: '#9c1f26', garment: 'scarf', badge: 'spade', eyeColor: '#3a2416' }),
  // The Zen Player: silver hair in a top bun, a sand robe with a draped shawl and a lotus.
  Amara: look({ skin: 1, hair: 'bun', hairColor: '#b9b4ab', hairPart: 'centre', outfit: 'qipao', outfitColor: '#b78a52', garment: 'shawl', badge: 'lotus', eyes: 'upturned', eyeColor: '#4a2c1a' }),
  // Alternates for the same personalities.
  'Professor Lau': look({ skin: 0, hair: 'sidepart', hairColor: '#a8a49c', eyewear: 'glasses', outfit: 'suit', outfitColor: '#4a3c2c', brows: 'thick', eyeColor: '#3a2416' }),
  Vanessa: look({ skin: 7, hair: 'ponytail', hairColor: '#8a3a1c', eyewear: 'sunglasses', outfit: 'blazer', outfitColor: '#18181c', badge: 'knight', eyes: 'upturned', eyeColor: '#3d6a5a' }),
  Greta: look({ skin: 0, hair: 'braids', hairColor: '#d6b98a', eyewear: 'glasses', outfit: 'sweater', outfitColor: '#2f5a46', turtleneck: true, eyeColor: '#3a5a8a' }),
  Dominic: look({ skin: 4, hair: 'short', hairColor: '#1b1715', headwear: 'fedora', wearColor: '#c8a46a', outfit: 'suit', outfitColor: '#1a2440', badge: 'spade', brows: 'thick', eyeColor: '#2a1a12' }),
  Sora: look({ skin: 6, hair: 'topknot', hairColor: '#1b1715', outfit: 'kimono', outfitColor: '#3d6a5a', badge: 'lotus', eyes: 'almond', eyeColor: '#2a1a12' }),
};

/** A named character's own look, or null for any other name. */
export function castLook(name: string): AvatarSpec | null {
  const c = CAST[name];
  return c ? { ...c } : null;
}
