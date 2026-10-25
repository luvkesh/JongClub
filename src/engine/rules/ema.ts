// EMA tournament rules: the European Mahjong Association runs its
// championships on two rulesets, MCR and Riichi. This table is EMA MCR: the
// Chinese Official fan list exactly as at our MCR table, with the EMA
// changes:
//   - No flower tiles (136 tiles).
//   - Sixteen hands: four in each wind, the deal always passes.
//   - Eight fan to win; on a discard the discarder pays 8 plus the hand and the
//     others 8; on a self-draw everyone pays 8 plus the hand.
// EMA Riichi is our Riichi tournament table (riichiTournament.ts).

import { mcrProfile } from './mcr';
import type { RuleProfile } from './types';

export const emaProfile: RuleProfile = {
  ...mcrProfile,
  id: 'ema',
  base: 'mcr',
  name: 'EMA tournament rules',
  summary: 'European Mahjong Association MCR: the Chinese Official fan list with no flower tiles, sixteen hands (four in each wind, the deal always passes) and eight fan to win. EMA Riichi is played at our Riichi tournament table.',
  flowers: false,
  rounds: { ...mcrProfile.rounds, dealerRetention: 'never' },
  felt: '#1d2c4c',
  tableName: 'European Championship',
  houseRules: [
    {
      id: 'minFan',
      label: 'Minimum to win',
      options: [
        { value: '8', label: '8 fan (official)' },
        { value: '0', label: 'No minimum (practice)' },
      ],
      default: '8',
    },
  ],
  guide: {
    extend: true,
    win: ['EMA plays without flowers, and the deal passes after every hand: sixteen hands in all.'],
    pay: '',
    sections: [],
  },
};
