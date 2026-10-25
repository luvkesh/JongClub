// Rule sheet: Thai Mahjong (src/engine/rules/thaiIndonesian.ts, `thaiProfile`).

import { tr } from '../../i18n';
import type { VariationSheet } from '../variationSheets';

export const thaiSheet: VariationSheet = {
  id: 'thai',
  lesson: 'thai',
  hook: tr('Hong Kong-style faan with flowers: one faan wins, and the discarder pays for the table.'),
  club: true,
  who: tr('Thai Chinese families in Bangkok and beyond, at home, at Chinese New Year and at family gatherings. There is no written Thai rulebook; most tables play Cantonese, Hong Kong-style Mahjong with their own customs.'),
  facts: [
    [tr('Hand'), tr('13 tiles; win with 14')],
    [tr('Tiles'), tr('144, with four flowers and four seasons')],
    [tr('Special tiles'), tr('Flowers: your seat flower is one faan, no flowers at all is one, and a full set of four is two')],
    [tr('Scoring'), tr('Hong Kong faan on the half-spicy table, one faan to win, capped at ten')],
    [tr('Calls'), tr('Sheung, Pung, Gong, Sik Wu, Zi Mo')],
  ],
  win: tr('Four sets and a pair, seven pairs or thirteen orphans, worth at least one faan. On a discard the discarder pays for the whole table, double the points (full gun); a self-draw is paid by all three.'),
  mei: 'In Thailand, Mahjong lives at family tables, at Chinese New Year and big gatherings. There’s no written Thai rulebook, so most families play Hong Kong-style Mahjong in their own way. Our table keeps the Hong Kong faan and the flowers, but you need only one faan to win. And watch your discards: on a discard win, the discarder pays for the whole table. That’s full gun.',
  level: { t: tr('Thai Mahjong'), d: tr('Hong Kong faan with flowers, one faan to win, and full gun on a discard.') },
  notes: [
    tr('Thailand has no written rulebook. Families mostly play Cantonese, Hong Kong-style Mahjong with their own customs, so this is JongClub’s reading, built on the Hong Kong table.'),
    tr('Our defaults: flowers in, a one-faan minimum, and full gun on a discard. The host can change the minimum, flowers, seven pairs and who pays.'),
  ],
};
