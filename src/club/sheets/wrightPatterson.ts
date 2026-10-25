// Rule sheet: Wright-Patterson (src/engine/rules/wrightPatterson.ts).

import { tr } from '../../i18n';
import type { VariationSheet } from '../variationSheets';

export const wrightPattersonSheet: VariationSheet = {
  id: 'wright-patterson',
  lesson: 'wright-patterson',
  hook: tr('The US air base club game: a Charleston, then points and doubles. No jokers.'),
  club: true,
  who: tr('Officers’ wives’ clubs on US air bases, from Wright-Patterson in Ohio to bases around the world. A house-rule tradition: copies of the rulebook differ.'),
  facts: [
    [tr('Hand'), tr('13 tiles; win with 14')],
    [tr('Tiles'), tr('144, with four flowers and four seasons. No jokers')],
    [tr('Special tiles'), tr('Flowers and seasons: four points each, and a double for your own')],
    [tr('Special rule'), tr('A Charleston before each hand: three tiles right, across, left; a second (left, across, right) if all agree')],
    [tr('Scoring'), tr('Points, then doubles, up to a 500-point limit. Special hands score half the limit or the limit')],
    [tr('Calls'), tr('Chow, Pung, Kong, Mah Jongg')],
  ],
  win: tr('Four sets and a pair, or a concealed special hand: Heavenly Twins and Knitting score half the limit; Triple Knitting and Wriggling Snake score the limit. Everyone pays the winner; East pays and receives double.'),
  mei: 'Wright-Patterson is the club game of an American air base, carried by service families to bases around the world. It isn’t the card game, and there are no jokers. You build four sets and a pair, after a Charleston of three passes. Score points, then doubles, up to the limit, or chase a named special hand like the Wriggling Snake. Copies of the rulebook differ, so this is our reading.',
  level: { t: tr('Wright-Patterson'), d: tr('A Charleston, then points, doubles and named special hands.') },
  notes: [
    tr('Copies of the Wright-Patterson rulebook differ from base to base. This is JongClub’s reading: European Classical points and doubles with a 500-point limit, plus four special hands.'),
    tr('A Western game, not the American card game: no jokers and no yearly card. Only the Charleston is borrowed from American play.'),
    tr('Simplified, as at our European Classical table: only the winner is paid; the losers do not settle among themselves.'),
  ],
};
