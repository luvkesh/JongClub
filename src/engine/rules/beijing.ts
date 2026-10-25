// Beijing Mahjong, as played in Beijing's courtyards and parks, with its
// signature wild tile, the hun'er. Northern tables differ; JongClub's table:
//   - 136 tiles, no flowers. Chow, pung and kong may be claimed.
//   - Hun'er: after the deal a tile is turned up from the back of the wall,
//     and the next tile in order is the hun'er, wild for any tile in your
//     hand (never in a claimed set). It may be thrown, but nobody can claim it.
//   - Four sets and a pair, or seven pairs.
//   - A hand is worth 1 point, doubled by each double: Self-drawn, Plain win
//     (su hu: no hun'er used), All Pungs, Half Flush, Full Flush (2 doubles),
//     Seven Pairs, each Dragon pung, a win on a kong replacement. Capped at 5.
//   - Self-draw: everyone pays. Discard: the discarder pays for the table
//     (dian pao bao).

import { doubled } from './regionalKit';
import { handFacts } from './handFacts';
import { classicProfile } from './classic';
import type { HandScore, Payment, RuleProfile, ScoreItem, ScoringContext } from './types';

export const BEIJING_CAP = 5;

export function beijingScore(ctx: ScoringContext): HandScore {
  const items: ScoreItem[] = [];
  const add = (name: string, value: number, note?: string) => items.push({ name, value, note });
  const d = ctx.decomposition;
  const f = handFacts(ctx);
  if (ctx.selfDrawn) add('Self-drawn', 1);
  if (!ctx.wildsUsed) add('Plain win (no hun’er)', 1);
  if (d.shape === 'standard' && f.chows.length === 0) add('All Pungs', 1);
  if (f.suits.size === 1 && !f.hasHonour) add('Full Flush', 2);
  else if (f.suits.size === 1) add('Half Flush', 1);
  if (d.shape === 'sevenPairs') add('Seven Pairs', 1);
  f.dragonPungs.forEach(() => add('Dragon pung', 1));
  if (ctx.afterKong) add('Win on a kong replacement', 1);
  if (!items.length) add('Basic win', 0);
  return doubled(items, 1, Number(ctx.house?.cap ?? BEIJING_CAP));
}

/** Self-draw: everyone pays. Discard: the discarder pays for the whole table. */
export function beijingPayments(winner: number, discarder: number | null, s: HandScore, _d: number, players: number): Payment[] {
  if (discarder !== null) return [{ from: discarder, to: winner, amount: s.points * (players - 1) }];
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: s.points });
  return out;
}

export const beijingProfile: RuleProfile = {
  ...classicProfile,
  id: 'beijing',
  base: 'beijing',
  name: 'Beijing Mahjong',
  region: 'Beijing, China',
  flag: '🇨🇳',
  summary: 'Beijing’s hun’er game: 136 tiles, no flowers. A tile is turned up each hand and the next one is the hun’er, wild in your hand. Doubles for a self-draw, a plain win without the hun’er, pungs and flushes; the discarder pays for the whole table.',
  shapes: { sevenPairs: true, thirteenOrphans: false },
  minValue: 0,
  rounds: { ...classicProfile.rounds },
  score: beijingScore,
  payments: beijingPayments,
  startingScore: 200,
  flowers: false,
  wilds: { inPair: true, inChow: true, inCalls: false, discard: true },
  naturalWild: { name: 'Hun’er', pick: 'next' },
  windRounds: undefined,
  robKong: true,
  scoreUnit: 'doubles',
  callNames: { chow: 'Chi', pung: 'Peng', kong: 'Gang', win: 'Hu', selfDraw: 'Zimo' },
  felt: '#2a2f45',
  tableName: 'Hutong Courtyard',
  configure() {
    return {};
  },
  houseRules: [
    {
      id: 'cap',
      label: 'Cap',
      options: [
        { value: '4', label: '4 doubles' },
        { value: '5', label: '5 doubles' },
        { value: '6', label: '6 doubles' },
      ],
      default: '5',
    },
  ],
  guide: {
    win: ['Four sets and a pair, or seven pairs.', 'The hun’er is wild for any tile in your hand, never in a claimed set.'],
    pay: 'A hand is worth 1 point, doubled by each double, up to the cap. On a self-draw everyone pays; on a discard the discarder pays for the whole table.',
    sections: [
      {
        title: 'Doubles',
        lines: [
          ['Self-drawn', 1, 'You drew the winning tile yourself'],
          ['Plain win (no hun’er)', 1, 'Your winning hand uses no hun’er as a wild'],
          ['All Pungs', 1, 'Four pungs or kongs and a pair'],
          ['Half Flush', 1, 'One suit plus honours'],
          ['Full Flush', 2, 'One suit only'],
          ['Seven Pairs', 1, 'Seven pairs'],
          ['Dragon pung', 1, 'Each pung or kong of dragons'],
          ['Win on a kong replacement', 1, 'Your winning tile is the replacement for a kong'],
        ],
      },
    ],
  },
};
