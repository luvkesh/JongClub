// The table you last sat at with AI players: Quick Start on Home and Quick Play
// replay it, and the Play screen's set-up opens on it. Kept on this device.

import { getProfile, VARIATIONS } from '../engine/rules';
import { GAME_LENGTHS } from '../engine/rounds';
import type { TableConfig } from './match';
import { DEFAULT_TABLE, tableFor } from './screens/tables';
import { tr } from '../i18n';

const KEY = 'jongclub.lastTable.v1';

export function rememberTable(cfg: TableConfig) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  } catch {
    /* storage unavailable */
  }
}

/** Your last AI table, or the club's default one (India Rules, the user's choice); a rule set that has gone falls back to it too. */
export function lastTable(): TableConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const cfg = { ...DEFAULT_TABLE, ...(JSON.parse(raw) as Partial<TableConfig>) };
      if (getProfile(cfg.variation) && GAME_LENGTHS[cfg.length]) return cfg;
    }
  } catch {
    /* storage unavailable or old data */
  }
  return structuredClone(tableFor('india'));
}

const FORMAT: Record<string, string> = { eastRound: tr('East only'), eastSouth: tr('East–South'), fullNews: tr('E–S–W–N') };

/** "Classic · East only": the rule set and format, for a card's second line. */
export function tableSummary(cfg: TableConfig): { rules: string; format: string; flag: string } {
  const v = VARIATIONS.find((x) => x.id === cfg.variation);
  return { rules: v ? tr(v.parent ? v.ruleset ?? v.short : v.short) : tr('Classic'), format: FORMAT[cfg.length] ?? tr(GAME_LENGTHS[cfg.length]?.label ?? ''), flag: v?.flag ?? '' };
}
