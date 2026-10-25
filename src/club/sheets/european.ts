// Rule sheet: European Classical (src/engine/rules/european.ts).

import { tr } from '../../i18n';
import type { VariationSheet } from '../variationSheets';

export const europeanSheet: VariationSheet = {
  id: 'european',
  lesson: 'european',
  hook: tr('Points for every set, then doubles. The old British club game.'),
  club: false,
  who: tr('Clubs and family tables in Britain and across Europe, played from long-standing club rule books. A regional family with no single authority.'),
  facts: [
    [tr('Hand'), tr('13 tiles; win with 14')],
    [tr('Tiles'), tr('144, with four flowers and four seasons')],
    [tr('Special tiles'), tr('Flowers and seasons: four points each, and a double for your own')],
    [tr('Scoring'), tr('Points, then doubles, up to a 1,000-point limit')],
    [tr('Calls'), tr('Chow, Pung, Kong, Mah-Jong')],
  ],
  win: tr('Four sets and a pair, or thirteen orphans. Everyone pays the winner the score; East pays and receives double. Simplified: the losers do not settle among themselves.'),
  mei: 'European Classical is the old points and doubles game, played in British clubs and family homes for a hundred years. Every pung and kong earns points, and flowers and seasons add more. Then each double, like a dragon pung or your own flower, doubles the whole total, up to a limit of one thousand. Everyone pays the winner, and East pays and receives double.',
  level: { t: tr('European Classical'), d: tr('Points for every set, then doubles, up to the limit.') },
  notes: [
    tr('There is no single authority. JongClub follows the long-standing British club rule books, with a 1,000-point limit and no seven pairs by default.'),
    tr('Simplified: in the old game the losers also settle their hands with each other; here only the winner is paid.'),
  ],
};
