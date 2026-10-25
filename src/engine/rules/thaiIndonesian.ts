// Thai and Indonesian home tables. Neither country has a written rulebook:
// both mostly play Cantonese, Hong Kong-style Mahjong with family customs
// on top. Each table here is the Hong Kong engine (faan that double, flowers,
// chow, pung and kong) with the defaults those families most often use, so a
// host can tune the rest. JongClub's readings:
//
//   Thai: one faan to win; flowers in; on a discard the discarder pays for
//   the whole table ("full gun"); a self-draw is paid by everyone.
//
//   Indonesian: no minimum (any complete hand wins); flowers in; on a discard
//   the discarder pays in full and the others half ("half gun").

import { hkFullGun, hkHalfGun, hongKongProfile } from './hongkong';
import type { RuleProfile } from './types';

const withDefault = (rules: RuleProfile['houseRules'], id: string, value: string) => rules.map((r) => (r.id === id ? { ...r, default: value } : r));

export const thaiProfile: RuleProfile = {
  ...hongKongProfile,
  id: 'thai',
  base: 'hongkong',
  name: 'Thai Mahjong',
  region: 'Thailand',
  flag: '🇹🇭',
  summary: 'Thai home and club play: Hong Kong-style hands and faan with flowers, one faan to win, and the discarder pays for the whole table. Thai families keep their own customs; these are JongClub’s table defaults.',
  minValue: 1,
  payments: hkFullGun,
  felt: '#2a1f3d',
  tableName: 'Bangkok Teak House',
  houseRules: withDefault(withDefault(hongKongProfile.houseRules, 'minValue', '1'), 'payout', 'fullGun'),
};

export const indonesianProfile: RuleProfile = {
  ...hongKongProfile,
  id: 'indonesian',
  base: 'hongkong',
  name: 'Indonesian Mahjong',
  region: 'Indonesia',
  flag: '🇮🇩',
  summary: 'Indonesian family play: Hong Kong-style hands and faan with flowers, no minimum (any complete hand wins), and half gun on a discard. Families keep their own customs; these are JongClub’s table defaults.',
  minValue: 0,
  payments: hkHalfGun,
  felt: '#3a1e1e',
  tableName: 'Jakarta Pendopo',
  houseRules: withDefault(hongKongProfile.houseRules, 'minValue', '0'),
};
