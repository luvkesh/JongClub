// How a hand with no winner ended, in a line for the result card and the
// replay: Riichi abortive draws and nagashi mangan.

import type { AbortiveKind } from '../engine/rules/types';
import type { HandResult } from '../engine/state';
import { andList, tr } from '../i18n';

export const ABORTIVE_NAMES: Record<AbortiveKind, string> = {
  nineTerminals: tr('Nine terminals (kyuushu kyuuhai)'),
  fourWinds: tr('Four winds (suufon renda)'),
  fourKongs: tr('Four kongs (suukaikan)'),
  fourRiichi: tr('Four riichi (suucha riichi)'),
  tripleRon: tr('Triple ron (sanchahou)'),
};

const WHY: Record<AbortiveKind, string> = {
  nineTerminals: 'held nine different terminals and honours on the first turn and called off the hand',
  fourWinds: tr('Everyone discarded the same wind on the first go-round'),
  fourKongs: tr('Four kongs were declared by more than one player'),
  fourRiichi: tr('All four players declared riichi'),
  tripleRon: tr('Three players claimed the same winning tile'),
};

/** One sentence on an abortive draw or nagashi mangan, or null for an ordinary wall game. */
export function drawnHandNote(r: HandResult, nameOf: (seat: number) => string, abortSeat?: number): string | null {
  if (r.abortive) {
    const why = r.abortive === 'nineTerminals' ? `${abortSeat !== undefined ? nameOf(abortSeat) : tr('A player')} ${WHY.nineTerminals}` : WHY[r.abortive];
    return tr('{name}: {why}. The hand is replayed with the same dealer and one more counter; riichi sticks stay on the table.', { name: ABORTIVE_NAMES[r.abortive], why });
  }
  if (r.nagashi?.length) {
    const who = andList(r.nagashi.map(nameOf));
    return tr('Nagashi mangan for {who}: every discard a terminal or honour, and none of them called. Paid as a mangan by self-draw, in place of the ready-hand payments.', { who });
  }
  return null;
}
