// Rule sheet: Guangdong push-down (src/engine/rules/guangdong.ts).

import { tr } from '../../i18n';
import type { VariationSheet } from '../variationSheets';

export const guangdongSheet: VariationSheet = {
  id: 'guangdong',
  lesson: 'guangdong',
  hook: tr('The everyday Cantonese game: any hand wins, and no chow calls.'),
  club: false,
  who: tr('Homes, teahouses and phone apps across Guangzhou and the Pearl River Delta. A regional family with many local extras.'),
  facts: [
    [tr('Hand'), tr('13 tiles; win with 14')],
    [tr('Tiles'), tr('136: three suits, winds and dragons. No flowers')],
    [tr('Special rule'), tr('No minimum: any complete hand may be pushed down')],
    [tr('Scoring'), tr('Fan that double a two-point base, capped at five')],
    [tr('Calls'), tr('Pung, Gong, Wu, Zi Mo. No chow calls; runs in your own hand still count')],
  ],
  win: tr('Four sets and a pair, seven pairs or thirteen orphans, with no minimum. Only the discarder pays; a self-draw is paid double by all three. Rob a kong, and its owner pays for everyone.'),
  mei: 'Guangdong push-down is the everyday game of Guangzhou, and the one on every Cantonese phone app. There’s no minimum, so any complete hand can be pushed down to win. You can’t call a chow, though runs you draw yourself still count. Each fan doubles a small base, only the discarder pays, and a self-draw is paid double by everyone. It’s fast, and wonderfully simple.',
  level: { t: tr('Guangdong push-down'), d: tr('No minimum, no chow calls, and fan that double a small base.') },
  notes: [
    tr('Push-down rules vary from town to town. JongClub plays the common core: no flowers, no chow calls and a five-fan cap.'),
    tr('Ghost tiles and buying horses, popular local extras, are not played here.'),
  ],
};
