// Rule sheet: Wuhan red dragon laizi (src/engine/rules/wuhan.ts).

import { tr } from '../../i18n';
import type { VariationSheet } from '../variationSheets';

export const wuhanSheet: VariationSheet = {
  id: 'wuhan',
  lesson: 'wuhan',
  hook: tr('Wuhan’s red dragon laizi game: a new wild every hand, and a pair of twos, fives or eights.'),
  club: false,
  who: tr('Tea rooms and phone apps across Wuhan and Hubei. A regional family; tables differ a great deal from town to town.'),
  facts: [
    [tr('Hand'), tr('13 tiles; win with 14')],
    [tr('Tiles'), tr('112: three suits and four Red Dragons. No winds, other dragons or flowers')],
    [tr('Special tiles'), tr('The laizi: the tile after the one turned up is wild in your hand. Red Dragons are set aside, and each doubles the win')],
    [tr('Special rule'), tr('The pair must be twos, fives or eights, except in All Pungs, Full Flush and Seven Pairs')],
    [tr('Scoring'), tr('One point, doubled for each double, up to five (the gold top)')],
    [tr('Calls'), tr('Chi, Peng, Gang, Hu, Zimo')],
  ],
  win: tr('Four sets and a pair, or seven pairs. Everyone pays the winner, and on a discard the discarder pays double. A discarded laizi is dead: nobody can claim it.'),
  mei: 'Wuhan Mahjong is the great tea room game of Hubei, and ours is the red dragon laizi style. After the deal a tile is turned up, and the next one in order becomes the laizi, wild in your hand. Red Dragons are set aside as you draw them, and each one doubles your win. Just remember the pair: twos, fives or eights. Everyone pays, and the discarder pays double.',
  level: { t: tr('Wuhan Mahjong'), d: tr('A laizi wild each hand, Red Dragon doubles, and a pair of twos, fives or eights.') },
  notes: [
    tr('Hubei rules vary widely. JongClub plays the red dragon laizi style (hongzhong laizi gang): 112 tiles and a five-double cap, which the host can set at four or six.'),
    tr('A laizi standing for itself, as its own tile, still counts as a hard win.'),
    tr('Kong payments during the hand, which some Wuhan tables add, are not played here.'),
  ],
};
