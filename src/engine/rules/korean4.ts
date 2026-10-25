// Korean Mahjong for four players. Most Korean tables today play three-handed
// (korean.ts); the four-player game uses the whole set and the same simple
// additive points. JongClub's table defaults, as for the three-player game:
//   - 136 tiles plus the eight flowers (144). Flowers pay 1 point each but
//     never count toward the minimum.
//   - Pung and kong may be claimed; chow may not (house rule: from the left).
//   - Riichi locks a concealed ready hand for 1 point. Two points to win,
//     limit 10, 100 a point; self-draw: everyone pays; discard: the discarder
//     pays every share (house rule: discarder double, others one share).

import { KIND_COUNT } from '../tiles';
import { koreanProfile } from './korean';
import type { RuleProfile } from './types';

export const korean4Profile: RuleProfile = {
  ...koreanProfile,
  id: 'korean',
  base: 'korean3',
  name: 'Korean Mahjong (four players)',
  summary: 'Four players and the whole set with flowers (144 tiles), no chow claims, and simple points: two to win, flowers pay but never count toward the minimum. Korean tables vary; these are JongClub’s table defaults.',
  players: 4,
  tileKinds: Array.from({ length: KIND_COUNT }, (_, k) => k),
  rounds: { ...koreanProfile.rounds, seatWindOrder: ['E', 'S', 'W', 'N'], handsPerWind: 4 },
  riichi: { cost: 0, minLiveTiles: 4 },
  felt: '#1c2b45',
  tableName: 'Busan Harbour',
  configure(c) {
    return { ...koreanProfile.configure!(c), riichi: c.riichi === 'off' ? undefined : { cost: 0, minLiveTiles: 4 } };
  },
  houseRules: koreanProfile.houseRules.map((r) =>
    r.id === 'flowers'
      ? { ...r, options: [
          { value: 'all', label: 'Every flower pays 1 point (144 tiles)' },
          { value: 'seat', label: 'Only your seat’s flowers pay (144 tiles)' },
          { value: 'off', label: 'No flowers (136 tiles)' },
        ] }
      : r.id === 'payout'
        ? { ...r, options: [
            { value: 'discarder', label: 'Discarder pays every share' },
            { value: 'split', label: 'Discarder pays double, the others one share' },
          ] }
        : r,
  ),
};
