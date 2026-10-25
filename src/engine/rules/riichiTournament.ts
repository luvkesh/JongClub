// Riichi tournament rules: the settings leagues and tournaments share
// (World Riichi Championship and EMA Riichi rules are the models). The hand
// play is our Riichi table; what changes is the table setup and the end of
// the match:
//   - No red fives, no abortive draws, no nagashi mangan.
//   - 30,000 points each; the match is East and South, and it does not end on
//     a bust (tournaments play every hand).
//   - Uma at the end: +15,000 for first, +5,000 second, −5,000 third,
//     −15,000 fourth. Tied places share their uma. No oka (start = return).
// Clubs and leagues tune these (uma 10/30 or 5/15, oka on), so the uma and
// the red fives stay house rules.

import { abortiveFrom } from './riichi';
import { riichiProfile } from './riichi';
import type { RuleProfile } from './types';

const UMA: Record<string, number[]> = {
  '15-5': [15000, 5000, -5000, -15000],
  '20-10': [20000, 10000, -10000, -20000],
  '30-10': [30000, 10000, -10000, -30000],
  off: [0, 0, 0, 0],
};

/** Placement bonus for each seat, tied places sharing their uma equally. */
export function umaFor(scores: number[], uma: number[]): number[] {
  const order = scores.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s);
  const out = new Array(scores.length).fill(0);
  for (let a = 0; a < order.length; ) {
    let b = a;
    while (b + 1 < order.length && order[b + 1].s === order[a].s) b++;
    const share = uma.slice(a, b + 1).reduce((x, y) => x + y, 0) / (b - a + 1);
    for (let k = a; k <= b; k++) out[order[k].i] = share;
    a = b + 1;
  }
  return out;
}

const NO_ABORTIVE = { abortive: 'off', tripleRon: 'headBump', nagashi: 'off' };

export const riichiTournamentProfile: RuleProfile = {
  ...riichiProfile,
  id: 'riichi-tournament',
  base: 'riichi',
  name: 'Riichi tournament rules',
  summary: 'Tournament Riichi: no red fives, no abortive draws and no nagashi mangan. Everyone starts on 30,000, every hand is played, and uma is paid at the end: +15,000, +5,000, −5,000 and −15,000 by place.',
  startingScore: 30000,
  redFives: 0,
  abortiveDraws: abortiveFrom(NO_ABORTIVE),
  nagashiMangan: false,
  endOnBust: false,
  felt: '#16233a',
  tableName: 'League Hall',
  matchEnd: (scores) => umaFor(scores, UMA['15-5']),
  configure(c) {
    return {
      redFives: Number(c.redFives ?? 0),
      matchEnd: (scores: number[]) => umaFor(scores, UMA[c.uma ?? '15-5'] ?? UMA['15-5']),
    };
  },
  houseRules: [
    {
      id: 'uma',
      label: 'Uma (placement bonus)',
      options: [
        { value: '15-5', label: '+15,000 / +5,000 / −5,000 / −15,000' },
        { value: '20-10', label: '+20,000 / +10,000 / −10,000 / −20,000' },
        { value: '30-10', label: '+30,000 / +10,000 / −10,000 / −30,000' },
        { value: 'off', label: 'No uma' },
      ],
      default: '15-5',
    },
    {
      id: 'redFives',
      label: 'Red fives (aka dora)',
      options: [
        { value: '0', label: 'None' },
        { value: '3', label: 'Three (5m, 5p, 5s)' },
      ],
      default: '0',
    },
    {
      id: 'openTanyao',
      label: 'Open tanyao (kuitan)',
      options: [
        { value: 'on', label: 'Allowed' },
        { value: 'off', label: 'Closed hands only' },
      ],
      default: 'on',
    },
  ],
  guide: {
    extend: true,
    win: ['No red fives, no abortive draws and no nagashi mangan.'],
    pay: 'At the end of the match, uma is paid by place: +15,000, +5,000, −5,000 and −15,000. Tied places share it.',
    sections: [
      {
        title: 'Uma at the end',
        lines: [
          ['First place', '+15,000', 'Added to your final score'],
          ['Second place', '+5,000', 'Added to your final score'],
          ['Third place', '−5,000', 'Taken from your final score'],
          ['Fourth place', '−15,000', 'Taken from your final score'],
        ],
      },
    ],
  },
};
