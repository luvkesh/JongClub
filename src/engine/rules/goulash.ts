// Goulash: a game mode, not a rule set. After a wall game (nobody won),
// the next hand is a goulash: East keeps the deal, and the table plays it
// with special rules. American tables pass jokers in that hand's Charleston;
// Asian tables (Dubai Goulash & Hands, Hong Kong-style clubs) exchange three
// tiles before play, may add jokers, raise the stakes, and build a pot that
// carries over until somebody wins.
//
// A profile that supports Goulash lists GOULASH_RULES among its house rules;
// withHouseRules turns the choices into profile fields via applyGoulash.

import type { RuleProfile } from './types';

type HouseRule = RuleProfile['houseRules'][number];

/** The mode switch itself. Shown as "Mode" in the lobby, not as a house rule. */
export const GOULASH_SWITCH: HouseRule = {
  id: 'goulash',
  label: 'Goulash after a wall game',
  options: [
    { value: 'off', label: 'Off: the deal passes as usual' },
    { value: 'on', label: 'On: East stays and a goulash is played' },
  ],
  default: 'off',
};

/** Asian goulash mechanics, shown in the house-rules panel when the mode is on. */
export const GOULASH_MECHANICS: HouseRule[] = [
  {
    id: 'goulashExchange',
    label: 'Goulash tile exchange',
    options: [
      { value: 'on', label: 'Pass three tiles right, across, left' },
      { value: 'off', label: 'No exchange (drawn hand is simply replayed)' },
    ],
    default: 'on',
  },
  {
    id: 'goulashJokers',
    label: 'Goulash with jokers',
    options: [
      { value: 'off', label: 'No jokers' },
      { value: 'on', label: 'Eight jokers in the set (wild in sets, not the pair)' },
    ],
    default: 'off',
  },
  {
    id: 'goulashStakes',
    label: 'Goulash stakes',
    options: [
      { value: '1', label: 'Normal' },
      { value: '2', label: 'Double for a goulash win' },
    ],
    default: '2',
  },
  {
    id: 'goulashPot',
    label: 'Cumulative pot',
    options: [
      { value: '0', label: 'None' },
      { value: '20', label: 'Everyone adds 20 at each wall game' },
      { value: '50', label: 'Everyone adds 50 at each wall game' },
    ],
    default: '0',
  },
];

/** Ids of every goulash-related house rule (the lobby groups them). */
export const GOULASH_IDS = [GOULASH_SWITCH.id, ...GOULASH_MECHANICS.map((r) => r.id)];

/** House rules for a profile that supports Goulash, with optional different defaults. */
export function goulashRules(asian: boolean, defaults: Record<string, string> = {}): HouseRule[] {
  const rules = asian ? [GOULASH_SWITCH, ...GOULASH_MECHANICS] : [GOULASH_SWITCH];
  return rules.map((r) => (defaults[r.id] ? { ...r, default: defaults[r.id] } : r));
}

/** Does this profile offer Goulash as a mode? */
export const supportsGoulash = (p: RuleProfile) => p.houseRules.some((r) => r.id === 'goulash');

/** Profile overrides for the chosen goulash settings (choices include defaults). */
export function applyGoulash(p: RuleProfile, c: Record<string, string>): Partial<RuleProfile> {
  if (!supportsGoulash(p)) return {};
  if (c.goulash !== 'on') return { goulash: false, goulashExchange: false, goulashPot: 0, goulashStakes: 1 };
  if (p.card) return { goulash: true };
  const out: Partial<RuleProfile> = {
    goulash: true,
    goulashExchange: c.goulashExchange !== 'off',
    goulashPot: Number(c.goulashPot ?? 0) || 0,
    goulashStakes: Number(c.goulashStakes ?? 1) || 1,
  };
  if (c.goulashJokers === 'on' && !p.jokers) {
    out.jokers = 8;
    out.wilds = { inPair: false, inChow: true, inCalls: true, discard: true };
  }
  return out;
}
