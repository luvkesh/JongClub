// Rule sheet: Shanghai baida (src/engine/rules/shanghai.ts).

import { tr } from '../../i18n';
import type { VariationSheet } from '../variationSheets';

export const shanghaiSheet: VariationSheet = {
  id: 'shanghai',
  lesson: 'shanghai',
  hook: tr('Shanghai’s baida game: a wild tile every hand, flowers for the base, and doubles on top.'),
  club: false,
  who: tr('Homes and parlours across Shanghai. There are several local styles, and families play them all a little differently.'),
  facts: [
    [tr('Hand'), tr('13 tiles; win with 14')],
    [tr('Tiles'), tr('144, with four flowers and four seasons')],
    [tr('Special tiles'), tr('Baida: the other copies of the tile turned up are wild in your hand')],
    [tr('Scoring'), tr('Flowers (hua) make the base, and each double doubles it, up to five')],
    [tr('Calls'), tr('Chi, Peng, Gang, Hu, Zimo')],
  ],
  win: tr('Four sets and a pair, or seven pairs. On a self-draw everyone pays; on a discard the discarder alone pays. A discarded baida is dead: nobody can claim it.'),
  mei: 'Shanghai Mahjong is played in homes and parlours all over the city, and ours is the baida game. After the deal a tile is turned up, and its other three copies are baida, wild in your hand. Your base starts at two, and flowers, honour pungs and kongs build it up. Then each double doubles it. A self-draw is paid by everyone, and a discard by the discarder alone.',
  level: { t: tr('Shanghai Mahjong'), d: tr('Baida wilds, flowers for the base, and doubles up to five.') },
  notes: [
    tr('Shanghai styles differ (qiao ma, la ma, baida). JongClub plays the baida game: a base of two, plus one for each flower, one or two for each honour pung and one for each kong.'),
    tr('A baida standing for itself, as its own tile, still counts as a clean win.'),
    tr('The host may ask for a minimum of flowers to win (two or four); honour pungs and kongs count toward it.'),
  ],
};
