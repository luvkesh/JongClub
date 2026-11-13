// The named table characters' own looks. Every AI seat called Mei, Rex, Hiro,
// Lucky, Amara (or one of their alternates) wears the same signature look in
// every game, in the seat portraits and on the website: the cute, stylised
// cast from the user's "At the table" design (2026-11-06). Other bot names
// keep a random look (withBotAccessories in avatar.ts).

import { DEFAULT_AVATAR, type AvatarSpec } from './catalog';

const look = (x: Partial<AvatarSpec>): AvatarSpec => ({ ...DEFAULT_AVATAR, face: 'oval', eyes: 'round', nose: 'button', brows: 'soft', lips: 'medium', ...x });

export const CAST: Record<string, AvatarSpec> = {
  // The Teacher: long chestnut hair with a blunt fringe and a side bun, round gold wire glasses, a navy blazer over a white top.
  Mei: look({ face: 'oval', skin: 7, hair: 'long', hairColor: '#3e2619', hairPart: 'centre', hairBun: 'side', eyewear: 'round', outfit: 'blazer', outfitColor: '#2c3550', eyeColor: '#4a2c1a' }),
  // The Shark: a silver bob with a swept fringe, small black round shades, a charcoal blazer over a white tee.
  Rex: look({ skin: 8, hair: 'bob', hairColor: '#cfccc6', hairPart: 'left', eyewear: 'sunglasses', outfit: 'blazer', outfitColor: '#2e2d2b', brows: 'straight', eyeColor: '#2a1a12' }),
  // The Wall: a black bob with a blunt fringe under an orange beret, round gold glasses, a cream turtleneck.
  Hiro: look({ skin: 6, hair: 'bob', hairColor: '#211a16', hairPart: 'centre', eyewear: 'round', headwear: 'beret', wearColor: '#e0762e', outfit: 'sweater', outfitColor: '#ece4d4', turtleneck: true, eyeColor: '#3a2416' }),
  // The Gambler: a dark bob with a fringe under a brown fedora, a rust-red blazer over a white top.
  Lucky: look({ face: 'oval', skin: 9, hair: 'bob', hairColor: '#21160f', hairPart: 'centre', headwear: 'fedora', wearColor: '#4d3527', outfit: 'blazer', outfitColor: '#9a3a30', eyeColor: '#3a2416' }),
  // The Zen Player: grey hair swept up into a top bun, eyes closed, an olive mock-neck sweater.
  Amara: look({ skin: 1, hair: 'bun', hairColor: '#8f8b85', hairPart: 'centre', outfit: 'sweater', outfitColor: '#6e5f34', turtleneck: true, eyes: 'closed', eyeColor: '#4a2c1a' }),
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

/** Which regular a look belongs to, when it is exactly their own cast look; else null. */
export function castNameFor(spec: AvatarSpec): string | null {
  const key = JSON.stringify(spec);
  for (const [name, look] of Object.entries(CAST)) if (JSON.stringify(look) === key) return name;
  return null;
}
