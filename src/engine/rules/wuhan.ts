// Wuhan Mahjong, in the "red dragon laizi" style (hongzhong laizi gang) that
// fills Wuhan's tea rooms and phone apps. Hubei tables differ a great deal;
// this is JongClub's table:
//   - 112 tiles: the three suits and the four Red Dragons. No winds, no other
//     dragons, no flowers.
//   - Laizi: after the deal a tile is turned up from the back of the wall; the
//     next tile in order is the laizi, wild for any tile in your hand (never in
//     a claimed set). A laizi may be thrown, but nobody can claim it.
//   - Red Dragons are "kong" tiles: drawn, they are set aside at once and
//     replaced, and each doubles your hand if you win.
//   - Chow, pung and kong may be claimed.
//   - The pair must be twos, fives or eights (the "general", jiang), except in
//     All Pungs, Full Flush and Seven Pairs.
//   - A hand is worth 1 point, doubled by each double: Self-drawn, Hard win
//     (no laizi used), All Pungs, Full Flush (2 doubles), Seven Pairs, a win on
//     a kong replacement, and each Red Dragon. Capped at 5 doubles ("gold top").
//   - Everyone pays; on a discard the discarder pays double.

import { RED_DRAGON } from './regionalKit';
import { handFacts } from './handFacts';
import { classicProfile } from './classic';
import type { HandScore, Payment, RuleProfile, ScoreItem, ScoringContext } from './types';

export const WUHAN_CAP = 5;
const SUITS = Array.from({ length: 27 }, (_, k) => k);

const pair258 = (k: number) => k < 27 && [1, 4, 7].includes(k % 9);

export function wuhanScore(ctx: ScoringContext): HandScore {
  const items: ScoreItem[] = [];
  const add = (name: string, value: number, note?: string) => items.push({ name, value, note });
  const d = ctx.decomposition;
  const f = handFacts(ctx);
  const allPungs = d.shape === 'standard' && f.chows.length === 0;
  const fullFlush = f.suits.size === 1 && !f.hasHonour;
  const sevenPairs = d.shape === 'sevenPairs';
  if (d.shape === 'standard' && !pair258(d.pair) && !allPungs && !fullFlush) {
    return { value: 0, unit: 'doubles', items: [{ name: '2-5-8 pair', value: 0, note: 'The pair must be twos, fives or eights' }], points: 0, limit: false, qualifies: false };
  }
  if (ctx.selfDrawn) add('Self-drawn', 1);
  if (!ctx.wildsUsed) add('Hard win (no laizi)', 1);
  if (allPungs) add('All Pungs', 1);
  if (fullFlush) add('Full Flush', 2);
  if (sevenPairs) add('Seven Pairs', 1);
  if (ctx.afterKong) add('Win on a kong replacement', 1);
  const reds = (ctx.flowers ?? []).filter((k) => k === RED_DRAGON).length;
  if (reds) add('Red Dragon kong', reds, 'Each Red Dragon set aside');
  if (!items.length) add('Soft win', 0, 'A laizi helped');
  const cap = Number(ctx.house?.cap ?? WUHAN_CAP);
  const raw = items.reduce((a, b) => a + b.value, 0);
  const value = Math.min(raw, cap);
  return { value, unit: 'doubles', items, points: 2 ** value, limit: raw >= cap };
}

/** Everyone pays the hand; on a discard the discarder pays double. */
export function wuhanPayments(winner: number, discarder: number | null, s: HandScore, _d: number, players: number): Payment[] {
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: s.points * (p === discarder ? 2 : 1) });
  return out;
}

export const wuhanProfile: RuleProfile = {
  ...classicProfile,
  id: 'wuhan',
  base: 'wuhan',
  name: 'Wuhan Mahjong',
  region: 'Wuhan, China',
  flag: '🇨🇳',
  summary: 'Wuhan’s red dragon laizi game: 112 tiles (the three suits and four Red Dragons). A tile is turned up each hand and the next one is the laizi, wild in your hand. Red Dragons are set aside as kongs that double your win, and the pair must be twos, fives or eights.',
  tileKinds: [...SUITS, RED_DRAGON],
  shapes: { sevenPairs: true, thirteenOrphans: false },
  minValue: 0,
  rounds: { ...classicProfile.rounds },
  score: wuhanScore,
  payments: wuhanPayments,
  startingScore: 200,
  flowers: false,
  bonusKinds: [RED_DRAGON],
  wilds: { inPair: true, inChow: true, inCalls: false, discard: true },
  naturalWild: { name: 'Laizi', pick: 'next' },
  windRounds: undefined,
  robKong: true,
  scoreUnit: 'doubles',
  callNames: { chow: 'Chi', pung: 'Peng', kong: 'Gang', win: 'Hu', selfDraw: 'Zimo' },
  felt: '#3b2416',
  tableName: 'Hankou Tea Room',
  configure() {
    return {};
  },
  houseRules: [
    {
      id: 'cap',
      label: 'Cap (gold top)',
      options: [
        { value: '4', label: '4 doubles' },
        { value: '5', label: '5 doubles' },
        { value: '6', label: '6 doubles' },
      ],
      default: '5',
    },
  ],
  guide: {
    win: ['Four sets and a pair, or seven pairs. The pair must be twos, fives or eights, except in All Pungs, Full Flush and Seven Pairs.', 'The laizi is wild for any tile in your hand, never in a claimed set. Red Dragons are set aside when drawn.'],
    pay: 'A hand is worth 1 point, doubled by each double, up to the cap. Everyone pays, and on a discard the discarder pays double.',
    sections: [
      {
        title: 'Doubles',
        lines: [
          ['Self-drawn', 1, 'You drew the winning tile yourself'],
          ['Hard win (no laizi)', 1, 'Your winning hand uses no laizi as a wild'],
          ['All Pungs', 1, 'Four pungs or kongs and a pair'],
          ['Full Flush', 2, 'One suit only'],
          ['Seven Pairs', 1, 'Seven pairs'],
          ['Win on a kong replacement', 1, 'Your winning tile is the replacement for a kong'],
          ['Red Dragon kong', 1, 'Each Red Dragon you set aside'],
        ],
      },
    ],
  },
};
