// Every player's hand at the end of a hand: yours, the winner's and the
// others', each laid out in its sets with how close it came (ready and its
// waits, or how many tiles from ready). Opened from the hand summary.

import { handStatus } from '../ai/jongbot';
import type { MahjongGame } from '../engine/game';
import type { HandResult } from '../engine/state';
import { tr } from '../i18n';
import { h } from './dom';
import { winHandSection, type WinHandParts } from './winReveal';
import './allHands.css';

export interface AllHandsOpts {
  game: MahjongGame;
  result: HandResult;
  /** Your seat, or -1 when watching. */
  me: number;
  labels: WinHandParts['labels'];
  red: (id: number) => boolean;
  /** Show this seat's whole hand in 3D on the table (the View button by each player). */
  onView?: (seat: number) => void;
}

/** Seats in the order the user reads them: you, the winner, then the rest round the table. */
function order(n: number, me: number, winner: number | undefined): number[] {
  const out: number[] = [];
  const add = (s: number | undefined) => s !== undefined && s >= 0 && s < n && !out.includes(s) && out.push(s);
  add(me);
  add(winner);
  for (let k = 1; k <= n; k++) add(((me < 0 ? 0 : me) + k) % n);
  return out;
}

/** How the winning tile came: self-drawn, or whose discard. */
function winFrom(g: MahjongGame, r: HandResult, me: number): WinHandParts['winFrom'] {
  if (r.discarder === null || r.discarder === undefined) return { selfDrawn: true };
  return { selfDrawn: false, from: r.discarder === me ? undefined : g.players[r.discarder].name, yours: r.discarder === me };
}

/** The list of every hand, one row per seat. */
export function allHandsList(o: AllHandsOpts): HTMLElement {
  const g = o.game;
  const r = o.result;
  const winner = r.type === 'win' ? r.winner : undefined;
  const list = h('div', { class: 'all-hands-list' });
  for (const s of order(g.players.length, o.me, winner)) {
    const p = g.players[s];
    const won = s === winner;
    const name = s === o.me ? tr('{name} (you)', { name: p.name }) : p.name;
    const status = won ? tr('Mahjong') : handStatus(g, s);
    const notes: string[] = [];
    if (!won && r.type === 'win' && r.discarder === s) notes.push(tr('Discarded the winning tile'));
    const parts: WinHandParts = won
      ? { hand: r.revealedHand ?? p.hand, melds: r.revealedMelds ?? p.melds, flowers: p.flowers ?? [], winTileId: r.winTile?.id, labels: o.labels, red: o.red, winFrom: winFrom(g, r, o.me) }
      : { hand: p.hand, melds: p.melds, flowers: p.flowers ?? [], labels: o.labels, red: o.red };
    // India Rules East round: passports apart from the other sets.
    if (g.profile.passportView) parts.passports = g.profile.passportView(parts.hand, parts.melds);
    list.append(
      h(
        'section',
        { class: `ah-seat${won ? ' won' : ''}${s === o.me ? ' mine' : ''}` },
        h(
          'header',
          { class: 'ah-head' },
          h(
            'div',
            { class: 'ah-who' },
            h('span', { class: 'ah-name' }, name),
            status ? h('span', { class: `ah-status${won ? ' win' : /^ready/i.test(status) || status === tr('Ready') ? ' ready' : ''}` }, status) : '',
          ),
          o.onView ? viewButton(() => o.onView!(s), name, s) : '',
          notes.length ? h('span', { class: 'ah-note' }, notes.join(' · ')) : '',
        ),
        winHandSection(parts),
      ),
    );
  }
  return list;
}

/** An eye, drawn (never a text glyph). */
const EYE_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>';

function viewButton(onclick: () => void, name: string, seat: number): HTMLElement {
  return h(
    'button',
    { type: 'button', class: 'btn ghost sm ah-view', 'data-seat': String(seat), onclick, 'aria-label': tr('View {name}’s hand on the table', { name }) },
    h('span', { class: 'peek-ic', 'aria-hidden': 'true', html: EYE_ICON }),
    tr('View hand'),
  );
}

/** The icon for the All hands button: four hands of tiles, one per seat (drawn, never a text glyph). */
export const ALL_HANDS_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>';
