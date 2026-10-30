// Table presets shared by the shell and the screens: the default table,
// a starting table for each variation, and the Academy's lesson ids.

import { VARIATIONS, getProfile } from '../../engine/rules';
import { classicProfile } from '../../engine/rules/classic';
import type { TableConfig } from '../match';
import { tr } from '../../i18n';

export const DEFAULT_TABLE: TableConfig = {
  name: tr('Jade Room'),
  variation: 'classic',
  length: 'eastRound',
  difficulty: 'casual',
  personalities: ['teacher', 'zen', 'shark'],
  houseRules: { minValue: '0', dealerRetention: 'onDealerWin' },
  timer: 25,
  hints: true,
  pace: 'standard',
};

/** House-rule defaults for a variation, so choices never leak between rule sets. */
function houseDefaults(variation: string): Record<string, string> {
  const p = getProfile(variation) ?? classicProfile;
  return Object.fromEntries(p.houseRules.map((r) => [r.id, r.default]));
}

/** A sensible starting table for any playable variation. */
export function tableFor(variation: string): TableConfig {
  if (variation === 'classic') return DEFAULT_TABLE;
  const p = getProfile(variation)!;
  return { ...DEFAULT_TABLE, name: tr('{name} Table', { name: p.tableName }), variation, length: variation === 'riichi' || variation === 'sanma' ? 'eastSouth' : 'eastRound', houseRules: houseDefaults(variation) };
}

export type Lesson = 'basics' | 'words' | 'scoring' | 'classic' | 'shapes' | 'tradition' | 'rounds' | 'riichi' | 'taiwanese' | 'american' | 'uae' | 'vietnamese' | 'india' | 'india-east' | 'india-south' | 'india-west' | 'india-west-doubles' | 'india-west-big' | 'india-north' | 'indian' | 'singapore' | 'hongkong' | 'mcr' | 'sichuan' | 'malaysian' | 'korean3' | 'sanma' | 'malaysian3' | 'uae-taiwanese' | 'uae-american' | 'uae-custom' | 'strategy' | 'efficiency' | 'waits' | 'defence' | 'value';

export const variationInfo = (id: string) => VARIATIONS.find((v) => v.id === id) ?? VARIATIONS[0];
