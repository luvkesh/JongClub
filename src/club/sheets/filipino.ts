// Rule sheet: Filipino Mahjong (src/engine/rules/filipino.ts).

import { tr } from '../../i18n';
import type { VariationSheet } from '../variationSheets';

export const filipinoSheet: VariationSheet = {
  id: 'filipino',
  lesson: 'filipino',
  hook: tr('Sixteen tiles, flowers, and points that simply add up.'),
  club: true,
  who: tr('Family tables and phone apps across the Philippines. A house-rule tradition with no formal rulebook.'),
  facts: [
    [tr('Hand'), tr('16 tiles; win with 17')],
    [tr('Tiles'), tr('144, with eight flowers and seasons')],
    [tr('Special tiles'), tr('Each flower or season for your seat: 1 point. No flowers at all (sin flores): 1 point')],
    [tr('Scoring'), tr('Points add up, 10 to the point: win 1, bunot 1, Escalera 2, todo pong 2, one suit 3, agaw 1. No minimum')],
    [tr('Calls'), tr('Chow (from your left), Pong, Kang, Mahjong, Bunot')],
    [tr('Special rule'), tr('Siete Pares: seven pairs and a pung, concealed, 3 points')],
  ],
  win: tr('Five sets and a pair, or Siete Pares. Any complete hand wins. On a self-draw (bunot) everyone pays; on a discard the discarder alone pays.'),
  mei: 'Filipino Mahjong is the family game of the Philippines. You hold sixteen tiles and build five sets and a pair. The points simply add up: one for the win, one for bunot, one for each flower of your seat, two for the Escalera straight, and three for Siete Pares. Each point is worth ten, and on a discard only the discarder pays. It’s quick, friendly and full of chatter.',
  level: { t: tr('Filipino Mahjong'), d: tr('Sixteen tiles, flowers, and points that add up.') },
  notes: [
    tr('There is no formal rulebook. JongClub plays what Filipino tables and apps share: 16-tile hands, flowers, and points that add up, ten to the point.'),
    tr('Many tables add a jackpot for the first player to five wins. It is not played here.'),
  ],
};
