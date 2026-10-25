// Indian Club Mahjong: a configurable club profile, not an official ruleset.
// Mahjong came to India with the Chinese communities of Kolkata, and is
// played in Kolkata, Mumbai and the Darjeeling hills with a Hong Kong-style
// base and many local house rules. Sets usually carry eight jokers and the
// eight flowers. Here a joker may stand for any tile in a pung, kong or
// concealed chow; whether it may make up the pair is the host's choice.
// A discarded joker is dead. Scored in faan like Classic, with flower faan
// and a bonus for a hand won without jokers.

import { classicPayments, classicProfile } from './classic';
import { equalShare, fullGun, scoreWithFlowers } from './uae';
import { mixedHandsRule } from './mixed';
import type { HandScore, RuleProfile, ScoringContext } from './types';

const LIMIT = 8;
const BASE = 16;

export function indianScore(ctx: ScoringContext): HandScore {
  const s = scoreWithFlowers(ctx);
  if (s.limit || ctx.house?.jokers === 'off' || ctx.house?.cleanBonus === 'off' || ctx.wildsUsed) return s;
  const items = s.items.filter((i) => i.name !== 'Chicken hand');
  items.push({ name: 'No jokers used', value: 1 });
  const value = Math.min(items.reduce((a, b) => a + b.value, 0), LIMIT);
  return { ...s, items, value, points: BASE * 2 ** value, limit: value >= LIMIT };
}

export const indianProfile: RuleProfile = {
  ...classicProfile,
  id: 'indian',
  name: 'Kolkata Joker Club',
  region: 'India',
  flag: '🇮🇳',
  summary: 'A club profile for Indian tables (Kolkata, Mumbai, Darjeeling): jokers and flowers, faan scoring, and house rules the host sets. Clubs vary; not an official ruleset.',
  shapes: { sevenPairs: true, thirteenOrphans: true },
  minValue: 1,
  rounds: { ...classicProfile.rounds },
  score: indianScore,
  payments: classicPayments,
  flowers: true,
  jokers: 8,
  wilds: { inPair: false, inChow: true, inCalls: true, discard: true },
  felt: '#4f1d2c',
  tableName: 'Calcutta Club',
  configure(c) {
    const jokers = c.jokers !== 'off';
    return {
      jokers: jokers ? 8 : 0,
      wilds: jokers ? { inPair: c.jokerPair === 'on', inChow: true, inCalls: c.jokerCalls !== 'off', discard: true } : undefined,
      flowers: c.flowers !== 'off',
      payments: c.payout === 'fullGun' ? fullGun : c.payout === 'equal' ? equalShare : classicPayments,
    };
  },
  houseRules: [
    {
      id: 'jokers',
      label: 'Jokers',
      options: [
        { value: 'on', label: 'Eight jokers (152 tiles)' },
        { value: 'off', label: 'No jokers (144 tiles)' },
      ],
      default: 'on',
    },
    {
      id: 'jokerPair',
      label: 'Joker in the pair',
      options: [
        { value: 'off', label: 'Not allowed' },
        { value: 'on', label: 'Allowed' },
      ],
      default: 'off',
    },
    {
      id: 'jokerCalls',
      label: 'Jokers in a called pung',
      options: [
        { value: 'on', label: 'Allowed (one joker)' },
        { value: 'off', label: 'Naturals only' },
      ],
      default: 'on',
    },
    {
      id: 'cleanBonus',
      label: 'Win without jokers',
      options: [
        { value: 'on', label: '+1 faan' },
        { value: 'off', label: 'No bonus' },
      ],
      default: 'on',
    },
    mixedHandsRule('on'),
    {
      id: 'flowers',
      label: 'Flowers',
      options: [
        { value: 'on', label: 'With flowers' },
        { value: 'off', label: 'No flowers' },
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
  ],
};
