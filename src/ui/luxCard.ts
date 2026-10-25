// The premium card used for main choices across the game (Home's five cards, Play's ways to play):
// a rendered illustration, a Cinzel title over a single gold rule, one short line and a round arrow.
// The whole card is one button; extra controls (a code box, an info button) sit above it.

import './luxCard.css';
import { h } from './dom';
import { icon } from './icons';
import { luxArt, type LuxArtId } from './luxArt';

export interface LuxCardOpts {
  art: LuxArtId;
  title: string;
  line: string | Node;
  run: (() => void) | null;
  /** The gold, glowing card (one per row at most). */
  featured?: boolean;
  /** Replaces the arrow at the foot (Join's code box). */
  foot?: HTMLElement;
  /** A small control in the top-right corner (Quick Start's info button). */
  corner?: HTMLElement;
  label?: string;
}

export function luxCard(o: LuxCardOpts): HTMLElement {
  const hit = h('button', { type: 'button', class: 'lux-hit', 'aria-label': o.label ?? o.title, disabled: !o.run, onclick: o.run ?? undefined });
  return h(
    'div',
    { class: `lux-card${o.featured ? ' featured' : ''}${o.run ? '' : ' off'}` },
    hit,
    h('span', { class: 'lux-art', html: luxArt(o.art) }),
    h('span', { class: 'lux-body' }, h('span', { class: 'lux-t' }, o.title), h('span', { class: 'lux-rule', 'aria-hidden': 'true' }), h('span', { class: 'lux-d' }, o.line)),
    o.foot ?? h('span', { class: 'lux-go', 'aria-hidden': 'true', html: icon('arrowRight') }),
    o.corner ? h('span', { class: 'lux-corner' }, o.corner) : null,
  );
}

/** A row of premium cards that wraps neatly at every width. */
export function luxRow(cards: HTMLElement[], cls = ''): HTMLElement {
  return h('div', { class: `lux-row ${cls}`.trim() }, ...cards);
}
