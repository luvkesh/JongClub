// Malaysian Mahjong: a club profile for four-player tables in Malaysia.
// Close cousin of the Singapore game: 148 tiles with the eight flowers and the
// four animals (cat, mouse, rooster, centipede), hands scored in tai, animal
// bites and kong money paid on the spot. Tables in Kuala Lumpur, Penang and
// Johor Bahru keep their own customs, so this is not an official ruleset.
// JongClub's Malaysian defaults differ from its Singapore table: the discarder
// pays double and the others single (rather than the shooter paying for the
// table), seven pairs is a 3-tai hand, and the host may raise the tai cap.
// Three-player Malaysian has its own profile (malaysian3.ts).

import { sevenPairsTai, singaporeProfile, singaporeScore, SG_UNIT } from './singapore';
import type { HandScore, Payment, RuleProfile, ScoringContext } from './types';

export const MY_CAP = 5;

export function malaysianScore(ctx: ScoringContext): HandScore {
  const cap = Number(ctx.house?.cap ?? MY_CAP);
  // Singapore scoring has no seven pairs line; score it with the bonus tiles.
  if (ctx.decomposition.shape === 'sevenPairs') return sevenPairsTai(ctx, cap);
  const s = singaporeScore(ctx);
  const isLimitHand = s.items.length === 1 && s.items[0].note === 'Limit hand';
  const raw = isLimitHand ? cap : s.items.reduce((a, b) => a + b.value, 0);
  const value = Math.min(raw, cap);
  const items = isLimitHand ? [{ ...s.items[0], value: cap }] : s.items;
  return { ...s, items, value, points: SG_UNIT * 2 ** Math.max(0, value - 1), limit: raw >= cap };
}

/** Discard: the discarder pays double, the others single. Self-draw: everyone pays double. */
function shared(winner: number, discarder: number | null, s: HandScore, _d: number, players: number): Payment[] {
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: discarder === null || p === discarder ? s.points * 2 : s.points });
  return out;
}

export const malaysianProfile: RuleProfile = {
  ...singaporeProfile,
  id: 'malaysian',
  base: 'singapore',
  name: 'Malaysian Mahjong',
  region: 'Malaysia',
  flag: '🇲🇾',
  summary: 'A club profile for Malaysian four-player tables: 148 tiles with flowers and four animals, tai scoring, bites and kong money on the spot. Our defaults: the discarder pays double, seven pairs scores three tai. Tables vary, so the host sets the house rules.',
  shapes: { sevenPairs: true, thirteenOrphans: true },
  score: malaysianScore,
  payments: shared,
  felt: '#173a2a',
  tableName: 'Penang Jade',
  configure(c) {
    const sg = singaporeProfile.configure!(c);
    return {
      ...sg,
      payments: c.payout === 'shooter' ? sg.payments : shared,
      shapes: { sevenPairs: c.sevenPairs !== 'off', thirteenOrphans: true },
    };
  },
  houseRules: [
    singaporeProfile.houseRules.find((r) => r.id === 'minValue')!,
    {
      id: 'cap',
      label: 'Tai cap',
      options: [
        { value: '5', label: '5 tai' },
        { value: '8', label: '8 tai' },
        { value: '10', label: '10 tai' },
      ],
      default: '5',
    },
    {
      id: 'payout',
      label: 'On a discard win',
      options: [
        { value: 'shared', label: 'Discarder pays double, others single' },
        { value: 'shooter', label: 'Shooter pays for everyone' },
      ],
      default: 'shared',
    },
    {
      id: 'sevenPairs',
      label: 'Seven pairs',
      options: [
        { value: 'on', label: 'Allowed (3 tai)' },
        { value: 'off', label: 'Not allowed' },
      ],
      default: 'on',
    },
    ...singaporeProfile.houseRules.filter((r) => r.id === 'bites' || r.id === 'kongMoney' || r.id === 'dealerRetention'),
  ],
};
