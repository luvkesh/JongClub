// Fujian (Fuzhou) Mahjong: sixteen-tile hands and a golden wild tile, the
// game of Fuzhou and much of Fujian. Local rules vary; JongClub's table:
//   - 144 tiles with flowers and seasons; 16-tile hands, five sets and a pair.
//     Chow (from your left), pung and kong may be claimed.
//   - Gold: after the deal a tile is turned up from the back of the wall
//     (a flower is set aside and another turned up). The other copies of that
//     tile are gold, wild for any tile in your hand (never in a claimed set).
//     Gold may be thrown, but nobody can claim it.
//   - Three Golds Fall (san jin dao): hold three golds and you win at once on
//     your own draw, whatever the rest of your hand.
//   - Points: a base of 5, plus 1 for each flower and season, 1 for each gold
//     in hand, 1 for an exposed kong and 2 for a concealed kong. Then: a
//     self-draw doubles; a Clean Hand (no gold used as a wild) doubles; Three
//     Golds Fall scores 30 before doubling; a Full Flush doubles.
//   - Self-draw: everyone pays. Discard: the discarder pays double, alone.

import { handFacts } from './handFacts';
import { taiwaneseProfile } from './taiwanese';
import type { HandScore, Payment, RuleProfile, ScoreItem, ScoringContext } from './types';

const SHAPES = { sevenPairs: false, thirteenOrphans: false, sets: 5 };

export function fujianScore(ctx: ScoringContext): HandScore {
  const items: ScoreItem[] = [];
  const pts = (name: string, value: number) => items.push({ name, value, note: 'points' });
  const dbl = (name: string) => items.push({ name, value: 1, note: 'double' });
  const d = ctx.decomposition;
  const golds = ctx.wildsHeld ?? 0;
  if (d.shape === 'special' && d.special === 'Three Golds') {
    pts('Three Golds Fall', 30);
  } else {
    const f = handFacts(ctx);
    pts('Base', 5);
    for (const k of f.kongs) pts(k.concealed ? 'Concealed kong' : 'Exposed kong', k.concealed ? 2 : 1);
    if (!ctx.wildsUsed) dbl('Clean Hand (no gold)');
    if (f.suits.size === 1 && !f.hasHonour) dbl('Full Flush');
  }
  const flowers = ctx.flowers?.length ?? 0;
  if (flowers) pts('Flowers and seasons', flowers);
  if (golds) pts('Gold in hand', golds);
  if (ctx.selfDrawn) dbl('Self-drawn');
  const base = items.filter((i) => i.note === 'points').reduce((a, b) => a + b.value, 0);
  const doubles = items.filter((i) => i.note === 'double').length;
  const points = base * 2 ** doubles;
  return { value: points, unit: 'points', items, points, limit: false };
}

/** Self-draw: everyone pays. Discard: the discarder alone pays double. */
export function fujianPayments(winner: number, discarder: number | null, s: HandScore, _d: number, players: number): Payment[] {
  if (discarder !== null) return [{ from: discarder, to: winner, amount: s.points * 2 }];
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: s.points });
  return out;
}

export const fujianProfile: RuleProfile = {
  ...taiwaneseProfile,
  id: 'fujian',
  base: 'fujian',
  name: 'Fujian Mahjong',
  region: 'Fujian, China',
  flag: '🇨🇳',
  summary: 'Fuzhou’s sixteen-tile game: 144 tiles with flowers, five sets and a pair. A tile is turned up each hand and its other copies are gold, wild in your hand. Hold three golds and you win at once on your own draw. A clean win without gold doubles.',
  shapes: SHAPES,
  minValue: 0,
  score: fujianScore,
  payments: fujianPayments,
  startingScore: 1000,
  flowers: true,
  wilds: { inPair: true, inChow: true, inCalls: false, discard: true },
  naturalWild: { name: 'Gold', pick: 'same' },
  threeWildsWin: true,
  scoreUnit: 'points',
  callNames: { chow: 'Chi', pung: 'Peng', kong: 'Gang', win: 'Hu', selfDraw: 'Zimo' },
  felt: '#3a2a12',
  tableName: 'Fuzhou Gold Hall',
  configure() {
    return {};
  },
  houseRules: [],
  guide: {
    win: ['Five sets and a pair from sixteen tiles plus the winning tile.', 'Gold is wild for any tile in your hand, never in a claimed set. Three golds win at once on your own draw.'],
    pay: 'Add the points, then double for each double. On a self-draw everyone pays; on a discard the discarder alone pays double.',
    sections: [
      {
        title: 'Points',
        lines: [
          ['Base', 5, 'Every win'],
          ['Flowers and seasons', 1, 'Each one you hold'],
          ['Gold in hand', 1, 'Each gold in your hand'],
          ['Exposed kong', 1, 'Each kong you claimed'],
          ['Concealed kong', 2, 'Each kong you declared from your hand'],
          ['Three Golds Fall', 30, 'Three golds in hand: an instant win on your own draw'],
        ],
      },
      {
        title: 'Doubles',
        lines: [
          ['Self-drawn', 1, 'You drew the winning tile yourself'],
          ['Clean Hand (no gold)', 1, 'Your winning hand uses no gold as a wild'],
          ['Full Flush', 1, 'One suit only'],
        ],
      },
    ],
  },
};
