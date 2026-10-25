// Rule sheet: Korean Mahjong for four players (src/engine/rules/korean4.ts).

import { tr } from '../../i18n';
import type { VariationSheet } from '../variationSheets';

export const korean4Sheet: VariationSheet = {
  id: 'korean',
  lesson: 'korean',
  hook: tr('Four players, the whole set, and simple points.'),
  club: false,
  who: tr('Homes and clubs across South Korea when four friends sit down. A regional family with many local versions; ours uses JongClub’s table defaults.'),
  facts: [
    [tr('Hand'), tr('13 tiles; win with 14')],
    [tr('Tiles'), tr('144, with eight flowers')],
    [tr('Players'), tr('Four: East, South, West and North')],
    [tr('Scoring'), tr('Points that add up, two to win (flowers pay but don’t count)')],
    [tr('Calls'), tr('Pung, Kong, Riichi. No chow calls; runs in your own hand still count')],
  ],
  win: tr('Four sets and a pair, seven pairs or thirteen orphans, worth at least two points. Self-draw: all three others pay. Discard: the discarder pays all three shares.'),
  mei: 'When four friends play in Korea, they use the whole set, flowers and all. There’s still no chow call, riichi is free and worth a point, and the points simply add up, to a limit of ten. You need two to win, and flowers pay but don’t count toward them. Win on a discard, and the discarder pays for the whole table. Korean tables vary, so these are our club’s defaults.',
  level: { t: tr('Korean four-player'), d: tr('The whole set, no chow calls, and two points to win.') },
  notes: [
    tr('Korean Mahjong is a regional family, most often played three-handed; the four-player game keeps the same simple points.'),
    tr('These are JongClub’s table defaults: the minimum, flowers, riichi, chow from the left and the discard payment are house rules.'),
  ],
};
