// Rule sheet: Zung Jung (src/engine/rules/zungJung.ts).

import { tr } from '../../i18n';
import type { VariationSheet } from '../variationSheets';

export const zungJungSheet: VariationSheet = {
  id: 'zung-jung',
  lesson: 'zung-jung',
  hook: tr('A modern system: points that add up, capped at 320.'),
  club: false,
  who: tr('Players who want fair, skill-based scoring. A formal system, designed in Hong Kong by Alan Kwan in 2006.'),
  facts: [
    [tr('Hand'), tr('13 tiles; win with 14')],
    [tr('Tiles'), tr('136: three suits, winds and dragons. No flowers')],
    [tr('Special rule'), tr('A bigger pattern replaces the smaller one inside it')],
    [tr('Scoring'), tr('Points from a pattern list, added up and capped at 320')],
    [tr('Calls'), tr('Chow, Pung, Kong, Mahjong')],
  ],
  win: tr('Any complete hand wins: four sets and a pair, seven pairs or thirteen terminals. A Chicken Hand is worth 1. A self-draw is paid by each other player; on a discard, the discarder pays three times the points (our reading).'),
  mei: 'Zung Jung is a modern scoring system, designed in Hong Kong for fair and skilful play. The tiles and calls are just like Classic, without flowers. Every pattern is worth points, and the points simply add up, never doubling, to a limit of three hundred and twenty. Any complete hand wins, even a one-point chicken hand. Look for flushes, dragons and lovely shapes like the nine-tile straight.',
  level: { t: tr('Zung Jung'), d: tr('Points that add up, from a short list of patterns.') },
  notes: [
    tr('Patterns and points follow Alan Kwan’s published Zung Jung rules (2006).'),
    tr('Settlement is our reading: each other player pays a self-draw, and the discarder pays for the whole table.'),
    tr('Official play has no minimum; the host may ask for five points.'),
  ],
};
