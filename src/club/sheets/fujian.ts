// Rule sheet: Fujian (Fuzhou) gold (src/engine/rules/fujian.ts).

import { tr } from '../../i18n';
import type { VariationSheet } from '../variationSheets';

export const fujianSheet: VariationSheet = {
  id: 'fujian',
  lesson: 'fujian',
  hook: tr('Fuzhou’s sixteen-tile game: a gold wild each hand, and three golds win on the spot.'),
  club: false,
  who: tr('Homes and halls across Fuzhou and much of Fujian province. Local rules change from town to town.'),
  facts: [
    [tr('Hand'), tr('16 tiles; win with 17 (five sets and a pair)')],
    [tr('Tiles'), tr('144, with four flowers and four seasons')],
    [tr('Special tiles'), tr('Gold: the other copies of the tile turned up are wild in your hand')],
    [tr('Special rule'), tr('Three Golds Fall: hold three golds and win at once on your own draw')],
    [tr('Scoring'), tr('A base of five plus flowers, golds and kongs; doubled for a self-draw, a clean hand and a full flush')],
    [tr('Calls'), tr('Chi (from your left only), Peng, Gang, Hu, Zimo')],
  ],
  win: tr('Five sets and a pair; no seven pairs. On a self-draw everyone pays; on a discard the discarder alone pays double. A discarded gold is dead: nobody can claim it.'),
  mei: 'Fujian Mahjong is the sixteen-tile game of Fuzhou, so you win with five sets and a pair. After the deal a tile is turned up, and its other copies are gold, wild in your hand. Each gold you hold is worth a point, and if you hold three, you win at once on your own draw. A clean hand with no gold doubles, and so does a self-draw.',
  level: { t: tr('Fujian Mahjong'), d: tr('Sixteen tiles, a gold wild, and three golds that win on the spot.') },
  notes: [
    tr('Fujian rules vary from town to town. JongClub plays a Fuzhou reading: a base of five, a point for each flower and gold, and no cap.'),
    tr('Three Golds Fall scores thirty, plus flowers and golds, doubled for the self-draw.'),
    tr('A gold standing for itself, as its own tile, still leaves the hand clean.'),
  ],
};
