// Wright-Patterson: the written club rules of the Wright-Patterson Air Force
// Base Officers' Wives' Club, carried by US service families to bases around
// the world. A Western game: Chinese-style hands of four sets and a pair,
// scored in points and doubles, with a Charleston borrowed from American play
// and a list of named special hands. Copies of the rulebook differ; this is
// JongClub's reading:
//   - 144 tiles with flowers and seasons; no jokers. Chow, pung and kong.
//   - Before each hand, a Charleston: three tiles right, across, then left. A
//     second Charleston (left, across, right) if everyone agrees.
//   - Points and doubles as at our European Classical table (Mahjong 20, sets
//     by type, doubles multiply), limit 500.
//   - Special hands, all concealed: Heavenly Twins (seven pairs) half limit;
//     Knitting (seven knits: the same number in two suits) half limit;
//     Triple Knitting (four mixed pungs of one number in all three suits and
//     a knit pair) limit; Wriggling Snake (1 to 9 of one suit, one of each
//     wind, and one tile paired) limit; and the classic limit hands.
//   - Everyone pays the winner; East pays and receives double.

import { isSevenPairs, sevenPairsShanten, type SpecialShape } from '../hand';
import { CROCHET, KNITTING } from './special';
import { europeanPayments, europeanProfile, europeanScore } from './european';
import type { HandScore, RuleProfile, ScoringContext } from './types';

export const WP_LIMIT = 500;

const WINDS = [27, 28, 29, 30];

/** Wriggling Snake: 1 to 9 of one suit, one of each wind, and any one of those tiles again. */
export const WRIGGLING_SNAKE: SpecialShape = {
  name: 'Wriggling Snake',
  complete(c, m) {
    if (m) return false;
    for (let s = 0; s < 3; s++) {
      const need = [...Array.from({ length: 9 }, (_, r) => s * 9 + r), ...WINDS];
      if (need.some((k) => c[k] < 1)) continue;
      const extra = need.reduce((a, k) => a + c[k] - 1, 0);
      const other = c.reduce((a, n, k) => a + (need.includes(k) ? 0 : n), 0);
      if (extra === 1 && other === 0) return true;
    }
    return false;
  },
  shanten(c, m) {
    if (m) return 99;
    let best = 99;
    for (let s = 0; s < 3; s++) {
      const need = [...Array.from({ length: 9 }, (_, r) => s * 9 + r), ...WINDS];
      const present = need.filter((k) => c[k] > 0).length;
      const dup = need.some((k) => c[k] > 1) ? 1 : 0;
      best = Math.min(best, 13 - present - dup);
    }
    return best;
  },
  ai: true,
};

const TWINS: SpecialShape = { name: 'Heavenly Twins', complete: (c, m) => !m && isSevenPairs(c), shanten: (c, m) => (m ? 99 : sevenPairsShanten(c)), ai: true, pairs: true };
const TRIPLE_KNITTING: SpecialShape = { ...CROCHET, name: 'Triple Knitting' };

const SPECIAL_VALUE: Record<string, number> = { 'Heavenly Twins': 0.5, Knitting: 0.5, 'Triple Knitting': 1, 'Wriggling Snake': 1 };

export function wrightPattersonScore(ctx: ScoringContext): HandScore {
  const limit = Number(ctx.house?.limit ?? WP_LIMIT);
  const d = ctx.decomposition;
  if (d.shape === 'special' && d.special && SPECIAL_VALUE[d.special]) {
    const pts = Math.round(limit * SPECIAL_VALUE[d.special]);
    return { value: pts, unit: 'points', items: [{ name: d.special, value: pts, note: SPECIAL_VALUE[d.special] === 1 ? 'Limit hand' : 'Half limit' }], points: pts, limit: SPECIAL_VALUE[d.special] === 1 };
  }
  return europeanScore({ ...ctx, house: { ...ctx.house, limit: String(limit) } });
}

export const wrightPattersonProfile: RuleProfile = {
  discards: 'centre',
  ...europeanProfile,
  id: 'wright-patterson',
  base: 'wright-patterson',
  name: 'Wright-Patterson',
  region: 'USA',
  flag: '🇺🇸',
  summary: 'The US air base club game: Chinese-style hands of four sets and a pair, 144 tiles with flowers and no jokers, a Charleston before each hand, points and doubles to a 500 limit, and named special hands such as Wriggling Snake and Triple Knitting.',
  shapes: { sevenPairs: false, thirteenOrphans: true, special: [TWINS, KNITTING, TRIPLE_KNITTING, WRIGGLING_SNAKE] },
  score: wrightPattersonScore,
  payments: europeanPayments,
  charleston: true,
  startingScore: 2000,
  callNames: { chow: 'Chow', pung: 'Pung', kong: 'Kong', win: 'Mah Jongg', selfDraw: 'Mah Jongg' },
  felt: '#22324a',
  tableName: 'Officers’ Club',
  configure() {
    return {};
  },
  houseRules: [
    {
      id: 'limit',
      label: 'Limit',
      options: [
        { value: '300', label: '300 points' },
        { value: '500', label: '500 points' },
        { value: '1000', label: '1,000 points' },
      ],
      default: '500',
    },
  ],
  guide: {
    win: ['Four sets and a pair, or one of the special hands. Special hands are concealed.', 'Add up the points first, then double the total once for every double. Before each hand comes a Charleston.'],
    pay: 'Everyone pays the winner the score, up to the limit. East pays double, and when East wins everyone pays East double.',
    sections: [
      {
        title: 'Special hands',
        lines: [
          ['Heavenly Twins', 'Half limit', 'Seven pairs, concealed'],
          ['Knitting', 'Half limit', 'Seven knits: the same number in two suits, two suits only'],
          ['Triple Knitting', 'Limit', 'Four mixed pungs (one number in all three suits) and a knit pair'],
          ['Wriggling Snake', 'Limit', '1 to 9 of one suit, one of each wind, and one of them paired'],
        ],
      },
      ...europeanProfile.guide!.sections,
    ],
  },
};
