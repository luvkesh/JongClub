// Shanghai Mahjong with the baida, the "hundred-match" wild tile, as played
// in Shanghai homes and parlours. Shanghai styles differ (qiao ma, la ma,
// baida); JongClub's table:
//   - 144 tiles with flowers and seasons. Chow, pung and kong may be claimed.
//   - Baida: after the deal a tile is turned up from the back of the wall (a
//     flower is set aside and another turned up). The other copies of that
//     tile are baida, wild for any tile in your hand (never in a claimed set).
//     Baida may be thrown, but nobody can claim it.
//   - Flowers (hua) make the hand's base: 2, plus 1 for each flower or
//     season, 1 for each pung of winds or dragons (2 if concealed), and 1 more
//     for each kong.
//   - Doubles: Self-drawn, Clean win (no baida used), All Pungs, Half Flush,
//     Full Flush (2), Seven Pairs, a win on a kong replacement. Capped at 5.
//   - Self-draw: everyone pays. Discard: the discarder alone pays.
//   - House rule: a minimum of flowers to win (none by default).

import { isHonor } from '../tiles';
import { handFacts } from './handFacts';
import { classicProfile } from './classic';
import type { HandScore, Payment, RuleProfile, ScoreItem, ScoringContext } from './types';

export const SH_CAP = 5;

export function shanghaiScore(ctx: ScoringContext): HandScore {
  const items: ScoreItem[] = [];
  const hua = (name: string, value: number) => items.push({ name, value, note: 'flowers' });
  const dbl = (name: string, value = 1) => items.push({ name, value, note: 'double' });
  const d = ctx.decomposition;
  const f = handFacts(ctx);
  hua('Base', 2);
  const flowers = ctx.flowers?.length ?? 0;
  if (flowers) hua('Flowers and seasons', flowers);
  for (const s of f.pungs) if (isHonor(s.kind)) hua('Honour pung', s.concealed ? 2 : 1);
  if (f.kongs.length) hua('Kongs', f.kongs.length);
  const counted = items.reduce((a, b) => a + b.value, 0) - 2;
  if (ctx.selfDrawn) dbl('Self-drawn');
  if (!ctx.wildsUsed) dbl('Clean win (no baida)');
  if (d.shape === 'standard' && f.chows.length === 0) dbl('All Pungs');
  if (f.suits.size === 1 && !f.hasHonour) dbl('Full Flush', 2);
  else if (f.suits.size === 1) dbl('Half Flush');
  if (d.shape === 'sevenPairs') dbl('Seven Pairs');
  if (ctx.afterKong) dbl('Win on a kong replacement');
  const base = items.filter((i) => i.note === 'flowers').reduce((a, b) => a + b.value, 0);
  const raw = items.filter((i) => i.note === 'double').reduce((a, b) => a + b.value, 0);
  const doubles = Math.min(raw, SH_CAP);
  const points = base * 2 ** doubles;
  const min = Number(ctx.house?.minFlowers ?? 0);
  return { value: points, unit: 'points', items, points, limit: raw >= SH_CAP, qualifies: counted >= min };
}

/** Self-draw: everyone pays. Discard: the discarder alone pays. */
export function shanghaiPayments(winner: number, discarder: number | null, s: HandScore, _d: number, players: number): Payment[] {
  if (discarder !== null) return [{ from: discarder, to: winner, amount: s.points }];
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: s.points });
  return out;
}

export const shanghaiProfile: RuleProfile = {
  ...classicProfile,
  id: 'shanghai',
  base: 'shanghai',
  name: 'Shanghai Mahjong',
  region: 'Shanghai, China',
  flag: '🇨🇳',
  summary: 'Shanghai’s baida game: 144 tiles with flowers. A tile is turned up each hand and its other copies are baida, wild in your hand. Flowers and honour pungs build the base, and doubles for a self-draw, a clean win, pungs and flushes multiply it.',
  shapes: { sevenPairs: true, thirteenOrphans: false },
  minValue: 0,
  rounds: { ...classicProfile.rounds },
  score: shanghaiScore,
  payments: shanghaiPayments,
  startingScore: 1000,
  flowers: true,
  wilds: { inPair: true, inChow: true, inCalls: false, discard: true },
  naturalWild: { name: 'Baida', pick: 'same' },
  windRounds: undefined,
  robKong: true,
  scoreUnit: 'points',
  callNames: { chow: 'Chi', pung: 'Peng', kong: 'Gang', win: 'Hu', selfDraw: 'Zimo' },
  felt: '#1e2f3d',
  tableName: 'Bund Parlour',
  configure() {
    return {};
  },
  houseRules: [
    {
      id: 'minFlowers',
      label: 'Flowers needed to win',
      options: [
        { value: '0', label: 'None' },
        { value: '2', label: 'At least 2' },
        { value: '4', label: 'At least 4' },
      ],
      default: '0',
    },
  ],
  guide: {
    win: ['Four sets and a pair, or seven pairs.', 'The baida is wild for any tile in your hand, never in a claimed set.'],
    pay: 'The flowers make the base; each double doubles it, up to 5 doubles. On a self-draw everyone pays; on a discard the discarder alone pays.',
    sections: [
      {
        title: 'Flowers (the base)',
        lines: [
          ['Base', 2, 'Every win'],
          ['Flowers and seasons', 1, 'Each one you hold'],
          ['Honour pung', '1 / 2', 'A pung of winds or dragons, claimed / concealed'],
          ['Kongs', 1, 'Each kong, on top of its pung'],
        ],
      },
      {
        title: 'Doubles',
        lines: [
          ['Self-drawn', 1, 'You drew the winning tile yourself'],
          ['Clean win (no baida)', 1, 'Your winning hand uses no baida as a wild'],
          ['All Pungs', 1, 'Four pungs or kongs and a pair'],
          ['Half Flush', 1, 'One suit plus honours'],
          ['Full Flush', 2, 'One suit only'],
          ['Seven Pairs', 1, 'Seven pairs'],
          ['Win on a kong replacement', 1, 'Your winning tile is the replacement for a kong'],
        ],
      },
    ],
  },
};
