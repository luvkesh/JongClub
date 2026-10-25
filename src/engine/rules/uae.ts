// UAE / Dubai Rules: a regional profile, not an official ruleset.
// Mahjong in the UAE is played with many house rules, so there is no single
// "UAE rules". This file is the Dubai Asian table (Goulash & Hands): 13-tile
// Hong Kong-style club play where the host decides flowers, chow, seven pairs,
// minimum faan, payments and dealer rotation, and Goulash is on by default.
// The other UAE rulesets (Dubai Taiwanese, Dubai American, Custom UAE table)
// live in uaeRulesets.ts.

import { FLOWER_BASE, WINDS } from '../tiles';
import { classicPayments, classicProfile, classicScore } from './classic';
import { goulashRules } from './goulash';
import { mixedHandsRule } from './mixed';
import { SPECIAL_ROUND_ORDER, SPECIAL_ROUND_RULES } from './windRounds';
import type { HandScore, Payment, RuleProfile, ScoringContext } from './types';

const LIMIT = 8;
const BASE = 16;

/** Classic faan plus flower faan: your seat flowers, full sets, or no flowers at all. */
export function scoreWithFlowers(ctx: ScoringContext): HandScore {
  const s = classicScore(ctx);
  if (ctx.house?.flowers === 'off' || s.limit) return s;
  const items = s.items.filter((i) => i.name !== 'Chicken hand');
  const flowers = ctx.flowers ?? [];
  const seatNo = WINDS.indexOf(ctx.seatWind) + 1;
  if (!flowers.length) items.push({ name: 'No flowers', value: 1 });
  for (const [from, name] of [
    [FLOWER_BASE, 'All four plants'],
    [FLOWER_BASE + 4, 'All four seasons'],
  ] as const) {
    if ([0, 1, 2, 3].every((i) => flowers.includes(from + i))) items.push({ name, value: 2 });
    else if (flowers.includes(from + seatNo - 1)) items.push({ name: 'Seat flower', value: 1 });
  }
  if (!items.length) items.push({ name: 'Chicken hand', value: 0, note: 'A plain winning hand' });
  const value = Math.min(items.reduce((a, b) => a + b.value, 0), LIMIT);
  return { ...s, items, value, points: BASE * 2 ** value, limit: value >= LIMIT };
}

/** Discarder pays for the whole table (3x), the common "full gun" club rule. */
export function fullGun(winner: number, discarder: number | null, s: HandScore, dealer: number, players: number, bonus: number): Payment[] {
  if (discarder === null) return classicPayments(winner, discarder, s, dealer, players, bonus);
  return [{ from: discarder, to: winner, amount: s.points * (players - 1) }];
}

/** Everyone pays the same, whoever discarded. */
export function equalShare(winner: number, _d: number | null, s: HandScore, _dealer: number, players: number): Payment[] {
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: s.points });
  return out;
}

export const uaeProfile: RuleProfile = {
  ...classicProfile,
  id: 'uae',
  name: 'Dubai Asian · Goulash & Hands',
  region: 'UAE',
  flag: '🇦🇪',
  summary: 'Dubai Asian club play: 13 tiles, flexible house rules, and a goulash after every wall game. One UAE table style among several, not an official ruleset.',
  rounds: { ...classicProfile.rounds },
  score: scoreWithFlowers,
  payments: classicPayments,
  flowers: true,
  minValue: 1,
  felt: '#5a4321',
  tableName: 'Dubai Gold',
  configure(c) {
    return {
      flowers: c.flowers !== 'off',
      calls: { ...classicProfile.calls, chow: c.chow !== 'off' },
      shapes: { ...classicProfile.shapes, sevenPairs: c.sevenPairs !== 'off' },
      payments: c.payout === 'fullGun' ? fullGun : c.payout === 'equal' ? equalShare : classicPayments,
      windRounds: c.specialRounds === 'on' ? { ...SPECIAL_ROUND_ORDER } : undefined,
    };
  },
  houseRules: [
    {
      id: 'flowers',
      label: 'Flowers',
      options: [
        { value: 'on', label: 'With flowers (144 tiles)' },
        { value: 'off', label: 'No flowers (136 tiles)' },
      ],
      default: 'on',
    },
    {
      id: 'minValue',
      label: 'Minimum to win',
      options: [
        { value: '0', label: 'No minimum' },
        { value: '1', label: '1 faan' },
        { value: '3', label: '3 faan' },
      ],
      default: '1',
    },
    {
      id: 'chow',
      label: 'Chow',
      options: [
        { value: 'on', label: 'Allowed (from your left)' },
        { value: 'off', label: 'Not allowed' },
      ],
      default: 'on',
    },
    {
      id: 'sevenPairs',
      label: 'Seven pairs',
      options: [
        { value: 'on', label: 'Allowed' },
        { value: 'off', label: 'Not allowed' },
      ],
      default: 'on',
    },
    mixedHandsRule('on'),
    {
      id: 'payout',
      label: 'On a discard win',
      options: [
        { value: 'halfGun', label: 'Discarder pays double, others half' },
        { value: 'fullGun', label: 'Discarder pays for everyone' },
        { value: 'equal', label: 'Everyone pays the same' },
      ],
      default: 'halfGun',
    },
    {
      id: 'dealerRetention',
      label: 'Dealer keeps the deal',
      options: [
        { value: 'onDealerWin', label: 'When dealer wins' },
        { value: 'onDealerWinOrDraw', label: 'On win or draw' },
        { value: 'never', label: 'Never' },
      ],
      default: 'onDealerWin',
    },
    ...SPECIAL_ROUND_RULES,
    ...goulashRules(true, { goulash: 'on' }),
  ],
};
