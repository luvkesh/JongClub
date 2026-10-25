// Rule sheet: Indonesian Mahjong (src/engine/rules/thaiIndonesian.ts, `indonesianProfile`).

import { tr } from '../../i18n';
import type { VariationSheet } from '../variationSheets';

export const indonesianSheet: VariationSheet = {
  id: 'indonesian',
  lesson: 'indonesian',
  hook: tr('Hong Kong-style faan with flowers: any complete hand wins, and half gun on a discard.'),
  club: true,
  who: tr('Chinese Indonesian families in Jakarta, Medan, Surabaya and beyond, at Imlek and at family gatherings. There is no written Indonesian rulebook; most families play Cantonese, Hong Kong-style Mahjong with their own customs.'),
  facts: [
    [tr('Hand'), tr('13 tiles; win with 14')],
    [tr('Tiles'), tr('144, with four flowers and four seasons')],
    [tr('Special tiles'), tr('Flowers: your seat flower is one faan, no flowers at all is one, and a full set of four is two')],
    [tr('Scoring'), tr('Hong Kong faan on the half-spicy table, no minimum, capped at ten')],
    [tr('Calls'), tr('Sheung, Pung, Gong, Sik Wu, Zi Mo')],
  ],
  win: tr('Four sets and a pair, seven pairs or thirteen orphans, with no minimum: a hand with no faan is worth eight. On a discard the discarder pays the points and the others half (half gun); a self-draw is paid by all three.'),
  mei: 'In Indonesia, Mahjong comes out at family gatherings and at Imlek, the Chinese New Year. There’s no written Indonesian rulebook, so most families play Hong Kong-style Mahjong with their own customs. Our table keeps the Hong Kong faan and the flowers, with no minimum at all, so any complete hand wins. On a discard, the discarder pays the points and everyone else pays half. That’s half gun.',
  level: { t: tr('Indonesian Mahjong'), d: tr('Hong Kong faan with flowers, no minimum, and half gun on a discard.') },
  notes: [
    tr('Indonesia has no written rulebook. Families mostly play Cantonese, Hong Kong-style Mahjong with their own customs, so this is JongClub’s reading, built on the Hong Kong table.'),
    tr('Our defaults: flowers in, no minimum, and half gun on a discard. The host can change the minimum, flowers, seven pairs and who pays.'),
  ],
};
