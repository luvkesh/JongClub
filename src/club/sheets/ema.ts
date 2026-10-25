// Rule sheet: EMA tournament rules (src/engine/rules/ema.ts).

import { tr } from '../../i18n';
import type { VariationSheet } from '../variationSheets';

export const emaSheet: VariationSheet = {
  id: 'ema',
  lesson: 'ema',
  hook: tr('Europe’s Chinese Official: no flowers, sixteen hands.'),
  club: false,
  who: tr('Players at European Mahjong Association championships, and the national clubs that rank for them.'),
  facts: [
    [tr('Hand'), tr('13 tiles; win with 14')],
    [tr('Tiles'), tr('136: no flowers')],
    [tr('Scoring'), tr('Fan from the Chinese Official list, with exclusions')],
    [tr('Special rule'), tr('The deal always passes: sixteen hands, four in each wind')],
    [tr('Calls'), tr('Chi, Peng, Gang, Hu')],
  ],
  win: tr('Four sets and a pair (or seven pairs, thirteen orphans or a knitted hand) worth at least eight fan. Everyone pays an eight-point base; the discarder adds the hand’s fan, and on a self-draw everyone does.'),
  mei: 'This is Chinese Official Mahjong the way Europe plays it at championships. The fan list is exactly the one you know, and you still need eight to win. But there are no flowers, so every fan comes from your hand, and the deal always passes on. A game is sixteen hands, four in each wind, and everyone deals four times. Neat, fair, and made for a tournament timetable.',
  level: { t: tr('EMA tournament rules'), d: tr('Chinese Official without flowers, over sixteen hands.') },
  notes: [
    tr('The European Mahjong Association plays two rulesets, MCR and Riichi. This table is EMA MCR; EMA Riichi is played at the Riichi tournament table.'),
    tr('Tournament standings across tables (table points and rankings) are not modelled: each game uses the usual MCR payments.'),
  ],
};
