// Rule sheet: Northeast China (Dongbei) Mahjong (src/engine/rules/northeast.ts).

import { tr } from '../../i18n';
import type { VariationSheet } from '../variationSheets';

export const northeastSheet: VariationSheet = {
  id: 'northeast',
  lesson: 'northeast',
  hook: tr('The brisk Dongbei game: every win must pass a five-point checklist.'),
  club: false,
  who: tr('Homes and halls across Harbin, Changchun and Shenyang. A regional family with many local extras.'),
  facts: [
    [tr('Hand'), tr('13 tiles; win with 14')],
    [tr('Tiles'), tr('136: three suits, winds and dragons. No flowers')],
    [tr('Special rule'), tr('Every win needs all three suits, a one, nine or honour, a pung, a chow and a claimed set')],
    [tr('Scoring'), tr('Doubles on a one-point base: self-draw, clamp, dealer, kong replacement. Capped at four')],
    [tr('Calls'), tr('Chi, Peng, Gang, Hu, Zimo')],
  ],
  win: tr('Four sets and a pair that pass the checklist. No seven pairs. Everyone pays; the discarder pays double, and so does the dealer.'),
  mei: 'Northeast Mahjong is the brisk winter game of Harbin and Shenyang. Every winning hand must pass a checklist: all three suits, a one, a nine or an honour, a pung, a run, and at least one set claimed from a discard. Miss one, and you can’t win. Win on the middle tile of a run for a clamp double. Everyone pays, and the discarder pays double. Keep that checklist handy!',
  level: { t: tr('Northeast China'), d: tr('A five-point checklist for every win, clamp doubles, and everyone pays.') },
  notes: [
    tr('Dongbei rules vary from city to city. JongClub plays its own reading: the five-point checklist, four doubles and a cap of four.'),
    tr('The treasure tile and other local extras are not played. The host may let a concealed hand win by self-draw.'),
  ],
};
