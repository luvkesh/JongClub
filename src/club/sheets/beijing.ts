// Rule sheet: Beijing Mahjong (src/engine/rules/beijing.ts).

import { tr } from '../../i18n';
import type { VariationSheet } from '../variationSheets';

export const beijingSheet: VariationSheet = {
  id: 'beijing',
  lesson: 'beijing',
  hook: tr('Beijing’s courtyard game: a hun’er turns wild every hand.'),
  club: false,
  who: tr('Courtyards, parks and homes across Beijing and the north. A home game with many local extras.'),
  facts: [
    [tr('Hand'), tr('13 tiles; win with 14')],
    [tr('Tiles'), tr('136: three suits, winds and dragons. No flowers')],
    [tr('Special tiles'), tr('The hun’er: a tile is turned up after the deal, and the next tile in order is wild in your concealed hand')],
    [tr('Scoring'), tr('Doubles on a one-point base, capped at five')],
    [tr('Calls'), tr('Chi, Peng, Gang, Hu, Zimo. A discarded hun’er is dead: nobody may claim it')],
  ],
  win: tr('Four sets and a pair, or seven pairs. Self-draw, a plain win with no hun’er, all pungs, flushes, seven pairs and dragon pungs each double. On a self-draw everyone pays; on a discard the discarder pays for the whole table.'),
  mei: 'Beijing Mahjong is the game of the city’s courtyards and parks. After the deal, a tile is turned up, and the next tile in order becomes the hun’er, wild for anything in your concealed hand. Win without one for a plain win double. Each double doubles a single point, up to five. On a self-draw everyone pays, but throw the winning tile and you pay for the whole table. So mind your discards!',
  level: { t: tr('Beijing Mahjong'), d: tr('The hun’er wild tile, doubles on a small base, and the discarder pays for the table.') },
  notes: [
    tr('Beijing rules vary from courtyard to courtyard. JongClub plays its own reading: no flowers, one hun’er each hand, and a five-double cap the host can set at four, five or six.'),
    tr('The hun’er works only in your concealed hand, never in a claimed set. A hun’er standing for itself, as its own tile, still counts as a plain win.'),
  ],
};
