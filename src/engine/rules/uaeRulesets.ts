// The UAE / Dubai regional profile's other rulesets. Each one is an existing
// rule engine with house rules commonly seen at UAE tables. None is "the"
// official UAE ruleset; there isn't one.
//
//   Dubai Asian · Goulash & Hands  -> uae.ts (Hong Kong-style, Goulash on)
//   Dubai Taiwanese                -> Taiwanese 16-tile engine + UAE house rules
//   Dubai American                 -> JongClub's American card + goulash on
//   Custom UAE table               -> every UAE house rule open, Goulash off

import { americanProfile } from './american';
import { goulashRules } from './goulash';
import { taiwaneseProfile } from './taiwanese';
import { uaeProfile } from './uae';
import type { RuleProfile } from './types';

const DUBAI = { region: 'UAE', flag: '🇦🇪' };

export const uaeTaiwaneseProfile: RuleProfile = {
  ...taiwaneseProfile,
  ...DUBAI,
  id: 'uae-taiwanese',
  base: 'taiwanese',
  name: 'Dubai Taiwanese',
  summary: 'The Taiwanese 16-tile game as Dubai tables often play it: flowers and tai, a one-tai minimum, and an optional goulash after a wall game. A house style, not an official ruleset.',
  minValue: 1,
  rounds: { ...taiwaneseProfile.rounds },
  felt: '#2e3f2a',
  tableName: 'Jumeirah Jade',
  houseRules: [
    ...taiwaneseProfile.houseRules.map((r) => (r.id === 'minValue' ? { ...r, default: '1' } : r)),
    ...goulashRules(true),
  ],
};

export const uaeAmericanProfile: RuleProfile = {
  ...americanProfile,
  ...DUBAI,
  id: 'uae-american',
  base: 'american',
  name: 'Dubai American',
  summary: 'American-style card play as UAE groups enjoy it: JongClub’s own card (not the NMJL card), the Charleston, and a goulash after every wall game where jokers may be passed.',
  felt: '#4a3420',
  tableName: 'Creek Card Room',
  houseRules: americanProfile.houseRules.map((r) => (r.id === 'goulash' ? { ...r, default: 'on' } : r)),
};

export const uaeCustomProfile: RuleProfile = {
  ...uaeProfile,
  id: 'uae-custom',
  base: 'uae',
  name: 'Custom UAE table',
  summary: 'Build your own UAE table: flowers, chow, seven pairs, minimum, who pays, dealer rules, and Goulash with its options. Every choice is the host’s.',
  rounds: { ...uaeProfile.rounds },
  felt: '#3d3a2a',
  tableName: 'Majlis',
  houseRules: [...uaeProfile.houseRules.filter((r) => !r.id.startsWith('goulash')), ...goulashRules(true, { goulash: 'off' })],
};
