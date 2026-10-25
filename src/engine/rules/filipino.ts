// Filipino Mahjong (Pinoy): sixteen-tile hands with flowers, played at family
// tables across the Philippines. There is no formal rulebook; the features
// below are the ones Filipino tables and apps share, in JongClub's reading:
//   - 144 tiles with eight flowers; 16-tile hands, five sets and a pair.
//     Chow (from your left), pung and kong may be claimed.
//   - Points add up, 10 to the point: a win 1; self-drawn (bunot) 1; each of
//     your own flowers 1; no flowers at all (sin flores) 1; Escalera (1 to 9 of
//     one suit) 2; all pungs (todo pong) 2; one suit 3; Siete Pares (seven
//     pairs and a pung, concealed) 3; robbing a kong (agaw) 1.
//   - Self-draw: everyone pays. Discard: the discarder alone pays.
// Many tables add a jackpot for the first to five wins; it is not played here.

import { WINDS, flowerNumber } from '../tiles';
import { handFacts } from './handFacts';
import { LI_GU, taiwaneseProfile } from './taiwanese';
import type { HandScore, Payment, RuleProfile, ScoreItem, ScoringContext } from './types';

export const PH_POINT = 10;
const SHAPES = { sevenPairs: false, thirteenOrphans: false, sets: 5, special: [{ ...LI_GU, name: 'Siete Pares' }] };

export function filipinoScore(ctx: ScoringContext): HandScore {
  const items: ScoreItem[] = [];
  const add = (name: string, value: number) => items.push({ name, value });
  const d = ctx.decomposition;
  const f = handFacts(ctx);
  add('Win', 1);
  if (ctx.selfDrawn) add('Self-drawn (bunot)', 1);
  const seat = WINDS.indexOf(ctx.seatWind) + 1;
  const flowers = ctx.flowers ?? [];
  const own = flowers.filter((k) => flowerNumber(k) === seat).length;
  if (own) add('Own flowers', own);
  if (!flowers.length) add('No flowers (sin flores)', 1);
  if (d.shape === 'special') add('Siete Pares', 3);
  else {
    for (let s = 0; s < 3; s++) if ([0, 3, 6].every((r) => f.chows.some((c) => c.kind === s * 9 + r))) add('Escalera (1 to 9)', 2);
    if (f.chows.length === 0) add('All pungs (todo pong)', 2);
  }
  if (f.suits.size === 1) add('One suit', 3);
  if (ctx.robbedKong) add('Robbing a kong (agaw)', 1);
  const value = items.reduce((a, b) => a + b.value, 0);
  return { value, unit: 'points', items, points: value * PH_POINT, limit: false };
}

/** Self-draw: everyone pays. Discard: the discarder alone pays. */
export function filipinoPayments(winner: number, discarder: number | null, s: HandScore, _d: number, players: number): Payment[] {
  if (discarder !== null) return [{ from: discarder, to: winner, amount: s.points }];
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: s.points });
  return out;
}

export const filipinoProfile: RuleProfile = {
  ...taiwaneseProfile,
  id: 'filipino',
  base: 'filipino',
  name: 'Filipino Mahjong',
  region: 'Philippines',
  flag: '🇵🇭',
  summary: 'Pinoy family play: sixteen-tile hands with flowers, five sets and a pair. Points simply add up: a self-draw, your own flowers, no flowers at all, the Escalera straight, all pungs and Siete Pares. Ten to the point; the discarder alone pays.',
  shapes: SHAPES,
  minValue: 0,
  score: filipinoScore,
  payments: filipinoPayments,
  startingScore: 1000,
  scoreUnit: 'points',
  callNames: { chow: 'Chow', pung: 'Pong', kong: 'Kang', win: 'Mahjong', selfDraw: 'Bunot' },
  felt: '#123a5a',
  tableName: 'Manila Veranda',
  configure() {
    return {};
  },
  houseRules: [],
  guide: {
    win: ['Five sets and a pair from sixteen tiles plus the winning tile, or Siete Pares: seven pairs and a pung, concealed.', 'Any complete hand wins. There is no minimum.'],
    pay: 'Points add up, ten to the point. On a self-draw everyone pays; on a discard the discarder alone pays.',
    sections: [
      {
        title: 'Points',
        lines: [
          ['Win', 1, 'Every win'],
          ['Self-drawn (bunot)', 1, 'You drew the winning tile yourself'],
          ['Own flowers', 1, 'Each flower or season numbered for your seat'],
          ['No flowers (sin flores)', 1, 'You won without drawing any flower'],
          ['Escalera (1 to 9)', 2, '1 to 9 of one suit as three runs'],
          ['All pungs (todo pong)', 2, 'Five pungs or kongs and a pair'],
          ['One suit', 3, 'One suit, with or without honours'],
          ['Siete Pares', 3, 'Seven pairs and a pung, concealed'],
          ['Robbing a kong (agaw)', 1, 'Win on the tile someone adds to a pung'],
        ],
      },
    ],
  },
};
