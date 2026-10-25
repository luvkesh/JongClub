// Northeast China (Dongbei) Mahjong: the brisk game of Harbin, Changchun and
// Shenyang. Its signature is a checklist every winning hand must pass. Local
// rules vary (the "treasure" tile, extra doubles); JongClub's table:
//   - 136 tiles, no flowers. Chow, pung and kong may be claimed.
//   - A winning hand must: hold all three suits (san se quan); hold a one, a
//     nine or an honour (you jiu); hold a pung or kong (you ke); hold a chow
//     (you shun); and be open, with at least one claimed set (kai men).
//     House rule: a concealed hand may win by self-draw.
//   - No seven pairs.
//   - A hand is worth 1 point, doubled by each double: Self-drawn, Clamp (won
//     on the middle tile of a run, jia hu), Dealer (winning or paying), a win
//     on a kong replacement. Capped at 4.
//   - Everyone pays; the discarder pays double.

import { doubled } from './regionalKit';
import { handFacts, setHasTerminalOrHonour } from './handFacts';
import { classicProfile } from './classic';
import { KIND_COUNT, isTerminalOrHonor } from '../tiles';
import { waits } from '../hand';
import type { HandScore, Payment, RuleProfile, ScoreItem, ScoringContext } from './types';

export const NE_CAP = 4;

/** Why a hand fails the Northeast checklist, or null when it passes. */
export function northeastMissing(ctx: ScoringContext): string | null {
  const f = handFacts(ctx);
  if (f.suits.size < 3) return 'All three suits';
  if (!f.sets.some(setHasTerminalOrHonour) && !isTerminalOrHonor(f.pair)) return 'A one, nine or honour';
  if (!f.pungs.length) return 'A pung or kong';
  if (!f.chows.length) return 'A chow';
  const open = ctx.melds.some((m) => !m.concealed);
  if (!open && !(ctx.selfDrawn && ctx.house?.closed === 'selfDraw')) return 'An open hand';
  return null;
}

/** The hand before the winning tile could win on one tile only. */
function singleWait(ctx: ScoringContext): boolean {
  if (ctx.winKind >= KIND_COUNT || !ctx.concealedCounts[ctx.winKind]) return false;
  const before = ctx.concealedCounts.slice();
  before[ctx.winKind]--;
  return waits(before, ctx.melds.length, { sevenPairs: false, thirteenOrphans: false }).length === 1;
}

export function northeastScore(ctx: ScoringContext): HandScore {
  const missing = northeastMissing(ctx);
  if (missing) return { value: 0, unit: 'doubles', items: [{ name: missing, value: 0, note: 'Every winning hand needs it' }], points: 0, limit: false, qualifies: false };
  const items: ScoreItem[] = [];
  const add = (name: string, value: number) => items.push({ name, value });
  const d = ctx.decomposition;
  if (ctx.selfDrawn) add('Self-drawn', 1);
  // Clamp: the hand waited on this one tile only, and it is the middle of a run.
  if (singleWait(ctx) && d.sets.some((s) => s.type === 'chow' && s.kind + 1 === ctx.winKind) && !d.sets.some((s) => (s.type === 'chow' && (s.kind === ctx.winKind || s.kind + 2 === ctx.winKind)) || (s.type === 'pung' && s.kind === ctx.winKind)) && d.pair !== ctx.winKind) add('Clamp (middle tile)', 1);
  if (ctx.isDealer) add('Dealer', 1);
  if (ctx.afterKong) add('Win on a kong replacement', 1);
  if (!items.length) add('Basic win', 0);
  return doubled(items, 1, NE_CAP);
}

/** Everyone pays; the discarder pays double, and the dealer pays double when someone else wins. */
export function northeastPayments(winner: number, discarder: number | null, s: HandScore, dealer: number, players: number): Payment[] {
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: s.points * (p === discarder ? 2 : 1) * (p === dealer ? 2 : 1) });
  return out;
}

export const northeastProfile: RuleProfile = {
  ...classicProfile,
  id: 'northeast',
  base: 'northeast',
  name: 'Northeast China (Dongbei)',
  region: 'Northeast China',
  flag: '🇨🇳',
  summary: 'The brisk Dongbei game: 136 tiles, no flowers, and a checklist every win must pass. All three suits, a one, nine or honour, a pung, a chow, and at least one claimed set. Clamp wins and self-draws double; the discarder pays double.',
  shapes: { sevenPairs: false, thirteenOrphans: false },
  minValue: 0,
  rounds: { ...classicProfile.rounds },
  score: northeastScore,
  payments: northeastPayments,
  startingScore: 200,
  flowers: false,
  windRounds: undefined,
  robKong: true,
  scoreUnit: 'doubles',
  callNames: { chow: 'Chi', pung: 'Peng', kong: 'Gang', win: 'Hu', selfDraw: 'Zimo' },
  felt: '#2e2a22',
  tableName: 'Harbin Winter Hall',
  configure() {
    return {};
  },
  houseRules: [
    {
      id: 'closed',
      label: 'Concealed hands',
      options: [
        { value: 'off', label: 'Must be open to win' },
        { value: 'selfDraw', label: 'May win concealed by self-draw' },
      ],
      default: 'off',
    },
  ],
  guide: {
    win: ['Four sets and a pair that pass the checklist: all three suits, a one, nine or honour, a pung or kong, a chow, and at least one claimed set.', 'There is no seven pairs.'],
    pay: 'A hand is worth 1 point, doubled by each double, up to 4. Everyone pays; the discarder pays double, and so does the dealer.',
    sections: [
      {
        title: 'The checklist',
        lines: [
          ['All three suits', '✓', 'At least one tile of each suit'],
          ['A one, nine or honour', '✓', 'Somewhere in your sets or pair'],
          ['A pung or kong', '✓', 'At least one'],
          ['A chow', '✓', 'At least one run'],
          ['An open hand', '✓', 'At least one claimed set'],
        ],
      },
      {
        title: 'Doubles',
        lines: [
          ['Self-drawn', 1, 'You drew the winning tile yourself'],
          ['Clamp (middle tile)', 1, 'You won on the middle tile of a run'],
          ['Dealer', 1, 'The dealer wins, or pays'],
          ['Win on a kong replacement', 1, 'Your winning tile is the replacement for a kong'],
        ],
      },
    ],
  },
};
