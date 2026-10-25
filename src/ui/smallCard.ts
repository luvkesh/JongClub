// India Rules Small Cards as the player sees them: the card's name, what it pays, the hand it
// names and a picture of one way to make it. Used by the card choice at the start of a South
// hand and by "Your card" during play.

import { h, tileImg } from './dom';
import { tr } from '../i18n';
import { LIMIT_PAY, type SmallCard } from '../engine/rules/indiaCards';
import { BIG_PAY, type BigCard } from '../engine/rules/indiaBig';
import { parseKinds } from '../engine/tiles';
import './smallCard.css';

const LIMIT_LABEL = { half: 'Half limit', limit: 'Limit', double: 'Double limit' } as const;

/** What the card pays, as the book names it ("Half limit · 500"); cards whose value depends on the hand say so. */
export function cardValueLine(card: SmallCard): string {
  if (typeof card.value !== 'string') return tr('Value depends on the hand');
  return `${tr(LIMIT_LABEL[card.value])} · ${LIMIT_PAY[card.value].toLocaleString('en-US')}`;
}

export function smallCardView(card: SmallCard, opts: { distance?: number; recommended?: boolean } = {}): HTMLElement {
  const picture = h('div', { class: 'sc-picture', 'aria-label': tr('One way to make it') }, ...parseKinds(card.picture).map((k) => tileImg(k, 'sc-tile')));
  return h(
    'div',
    { class: `small-card${opts.recommended ? ' recommended' : ''}` },
    h('div', { class: 'sc-head' }, h('span', { class: 'sc-num' }, String(card.n)), h('span', { class: 'sc-name' }, card.name)),
    h('div', { class: 'sc-value' }, cardValueLine(card), card.wall ? h('span', { class: 'sc-wall' }, tr('All from the wall')) : null),
    h('p', { class: 'sc-how' }, card.how),
    picture,
    opts.distance !== undefined ? h('div', { class: 'sc-distance' }, opts.distance >= 99 ? tr('no win possible with these sets') : opts.distance <= 0 ? tr('Ready or nearly ready') : tr('{n} tiles from ready', { n: opts.distance })) : null,
    opts.recommended ? h('div', { class: 'sc-pick' }, tr('JongBot suggests this card')) : null,
  );
}

/** A Big Card (North round): one card for the whole table, its jokers, and one way to make it. */
export function bigCardView(card: BigCard, opts: { onPick?: () => void; recommended?: boolean } = {}): HTMLElement {
  const picture = h('div', { class: 'sc-picture', 'aria-label': tr('One way to make it') }, ...parseKinds(card.picture).map((k) => tileImg(k, 'sc-tile')));
  const extras = card.extras.kong === 1 && card.extras.qwong === 2 ? null : h('div', { class: 'sc-wall' }, tr('Extra tiles: a qwong {q}, a kong {k}', { q: card.extras.qwong, k: card.extras.kong }));
  return h(
    'div',
    { class: `small-card big-card${opts.recommended ? ' recommended' : ''}` },
    h('div', { class: 'sc-head' }, h('span', { class: 'sc-num' }, String(card.n)), h('span', { class: 'sc-name' }, card.name)),
    h('div', { class: 'sc-value' }, tr('{a} · concealed {b}', { a: BIG_PAY.normal.toLocaleString('en-US'), b: BIG_PAY.concealed.toLocaleString('en-US') }), extras),
    h('p', { class: 'sc-how' }, card.how),
    picture,
    h('p', { class: 'sc-jokers' }, h('b', {}, tr('Jokers')), ' ', card.jokersText),
    opts.onPick ? h('button', { class: `btn${opts.recommended ? ' primary' : ''}`, onclick: opts.onPick }, tr('Play this card')) : null,
  );
}
