// Malaysian three-player Mahjong ("sam kaki"): a club profile, not an
// official ruleset. Three-handed tables in Malaysia play the Malaysian game
// (flowers, the four animals, tai, bites and kong money) with one suit taken
// out. The most widely described version removes the whole Characters suit,
// leaving Dots, Bamboo, winds and dragons: 100 tiles, plus the eight flowers
// and four animals, 112 in all. Some tables keep the 1 and 9 of Characters, as
// in Japanese sanma and Korean three-player (120 tiles); that is a house rule.
//
// Everything else follows JongClub's Malaysian table (malaysian.ts): tai
// capped at five, one tai to win, the discarder pays double and the other
// player single, a self-draw is paid double by both, animal bites and kong
// money on the spot. Seats are East, South and West: North is a plain honour,
// and the fourth flower and season (Bamboo, Winter) belong to no seat.

import { KIND_COUNT } from '../tiles';
import { malaysianProfile } from './malaysian';
import type { RuleProfile } from './types';

/** Dots, Bamboo, winds and dragons (no Characters). */
export const MY3_KINDS = Array.from({ length: KIND_COUNT }, (_, k) => k).filter((k) => k >= 9);
/** House rule: keep the 1 and 9 of Characters. */
export const MY3_KINDS_TERMINALS = [0, 8, ...MY3_KINDS];

export const malaysian3Profile: RuleProfile = {
  ...malaysianProfile,
  id: 'malaysian3',
  base: 'singapore',
  name: 'Malaysian three-player',
  region: 'Malaysia',
  flag: '🇲🇾',
  summary: 'The Malaysian game for three: the Characters suit taken out, flowers and four animals in (112 tiles), tai capped at five, bites and kong money on the spot. Tables vary, so the host sets the house rules.',
  players: 3,
  tileKinds: MY3_KINDS,
  rounds: {
    prevailingWinds: ['E', 'S', 'W'],
    seatWindOrder: ['E', 'S', 'W'],
    handsPerWind: 3,
    dealerRetention: 'onDealerWin',
    maxHands: 0,
  },
  felt: '#1d3d33',
  tableName: 'Kuala Lumpur Jade',
  configure(c) {
    return { ...malaysianProfile.configure!(c), tileKinds: c.characters === 'terminals' ? MY3_KINDS_TERMINALS : MY3_KINDS };
  },
  houseRules: [
    {
      id: 'characters',
      label: 'Characters',
      options: [
        { value: 'none', label: 'Taken out (112 tiles)' },
        { value: 'terminals', label: 'Keep the 1 and 9 (120 tiles)' },
      ],
      default: 'none',
    },
    ...malaysianProfile.houseRules,
  ],
};
