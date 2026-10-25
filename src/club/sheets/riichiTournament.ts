// Rule sheet: Riichi tournament rules (src/engine/rules/riichiTournament.ts).

import { tr } from '../../i18n';
import type { VariationSheet } from '../variationSheets';

export const riichiTournamentSheet: VariationSheet = {
  id: 'riichi-tournament',
  lesson: 'riichi-tournament',
  hook: tr('Riichi as leagues play it: no red fives, uma at the end.'),
  club: false,
  who: tr('Riichi leagues and tournaments, from the World Riichi Championship to European events and online leagues.'),
  facts: [
    [tr('Hand'), tr('13 tiles; win with 14')],
    [tr('Tiles'), tr('136, no red fives')],
    [tr('Scoring'), tr('Han and fu; 30,000 to start, then uma by place')],
    [tr('Special rule'), tr('No abortive draws or nagashi mangan; the match never ends on a bust')],
    [tr('Calls'), tr('Chi, Pon, Kan, Ron, Tsumo, Riichi')],
  ],
  win: tr('As in Riichi: four sets and a pair (or seven pairs, or thirteen orphans) with at least one yaku. Every hand of the East and South rounds is played, then uma is added: +15,000, +5,000, −5,000 and −15,000 by place, tied places sharing.'),
  mei: 'This is Riichi the way leagues and tournaments play it. The red fives are gone, and so are the abortive draws and nagashi mangan. Everyone starts on thirty thousand, and the match never stops early. At the end, places pay off: fifteen thousand extra for first and five thousand for second, with the same taken from third and fourth. Every hand counts, right to the last.',
  level: { t: tr('Riichi tournament rules'), d: tr('No red fives, no abortive draws, and uma by place.') },
  notes: [
    tr('Modelled on the World Riichi Championship and EMA Riichi rules: 30,000 to start, no red fives, and a 15,000 / 5,000 uma with no oka.'),
    tr('Leagues tune the uma and the red fives, so both are house rules here. Two winners on one discard are settled by head bump.'),
  ],
};
