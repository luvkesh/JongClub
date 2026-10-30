// The club's Small and Big Cards as the player sees them: a printed card with its own face
// (cardArt.ts: palette, emblem, engraved pattern), the card's name, what it pays, the hand it
// names and a picture of one way to make it. Used by the card choice at the start of a South
// hand, "Your card" during play, the Big Card picker, the lessons and the card gallery.

import { h, tileImg } from './dom';
import { tr } from '../i18n';
import { LIMIT_PAY, type SmallCard } from '../engine/rules/indiaCards';
import { BIG_PAY, type BigCard } from '../engine/rules/indiaBig';
import { parseKinds } from '../engine/tiles';
import { emblemOf, emblemSvg, paletteOf, patternSvg } from './cardArt';
import './smallCard.css';

const LIMIT_LABEL = { half: 'Half limit', limit: 'Limit', double: 'Double limit' } as const;
/** A card's value in faan at a table that plays the club's cards in its special wind rounds (windRounds.ts CARD_FAAN). */
const LIMIT_FAAN = { half: 3, limit: 4, double: 5 } as const;

/** What the card pays, as the book names it ("Half limit · 500"), or in faan at a faan table; cards whose value depends on the hand say so. */
export function cardValueLine(card: SmallCard, faan = false): string {
  if (typeof card.value !== 'string') return tr('Value depends on the hand');
  return `${tr(LIMIT_LABEL[card.value])} · ${faan ? tr('{n} faan', { n: LIMIT_FAAN[card.value] }) : LIMIT_PAY[card.value].toLocaleString('en-US')}`;
}

/** The printed card: stock, engraved pattern, foil frame, corner numbers, emblem medallion and title. */
function cardFace(kind: 'small' | 'big', n: number, name: string, picture: string, recommended: boolean, body: (HTMLElement | null)[]): HTMLElement {
  const pal = paletteOf(name, picture);
  const card = h('div', {
    class: `small-card cc cc-${pal.id} cc-e-${emblemOf(name)}${kind === 'big' ? ' big-card' : ''}${recommended ? ' recommended' : ''}`,
    style: `--cc-ink:${pal.ink};--cc-foil:${pal.foil};--cc-foil2:${pal.foil2};--cc-wash:${pal.wash}`,
  });
  card.insertAdjacentHTML('afterbegin', patternSvg(n, kind === 'big'));
  card.append(
    h('span', { class: 'cc-frame', 'aria-hidden': 'true' }),
    h('span', { class: 'cc-corner cc-tl', 'aria-hidden': 'true' }, String(n)),
    h('span', { class: 'cc-corner cc-br', 'aria-hidden': 'true' }, String(n)),
    h(
      'div',
      { class: 'sc-head' },
      h('span', { class: 'cc-medal', html: emblemSvg(name, n) }),
      h('span', { class: 'cc-title' }, h('span', { class: 'cc-kind' }, kind === 'big' ? tr('Big Card') : tr('Small Card'), h('span', { class: 'sc-num' }, ` · ${n}`)), h('span', { class: 'sc-name' }, name)),
    ),
    ...body.filter((x): x is HTMLElement => !!x),
  );
  return card;
}

const pictureOf = (picture: string) => h('div', { class: 'sc-picture', 'aria-label': tr('One way to make it') }, ...parseKinds(picture).map((k) => tileImg(k, 'sc-tile')));

export function smallCardView(card: SmallCard, opts: { distance?: number; recommended?: boolean; faan?: boolean } = {}): HTMLElement {
  return cardFace('small', card.n, card.name, card.picture, !!opts.recommended, [
    h('div', { class: 'sc-value' }, cardValueLine(card, opts.faan), card.wall ? h('span', { class: 'sc-wall' }, tr('All from the wall')) : null),
    pictureOf(card.picture),
    h('p', { class: 'sc-how' }, card.how),
    opts.distance !== undefined ? h('div', { class: 'sc-distance' }, opts.distance >= 99 ? tr('no win possible with these sets') : opts.distance <= 0 ? tr('Ready or nearly ready') : tr('{n} tiles from ready', { n: opts.distance })) : null,
    opts.recommended ? h('div', { class: 'sc-pick' }, tr('JongBot suggests this card')) : null,
  ]);
}

/** A Big Card (North round): one card for the whole table, its jokers, and one way to make it. */
export function bigCardView(card: BigCard, opts: { onPick?: () => void; recommended?: boolean; faan?: boolean } = {}): HTMLElement {
  const extras = card.extras.kong === 1 && card.extras.qwong === 2 ? null : h('span', { class: 'sc-wall' }, tr('Extra tiles: a qwong {q}, a kong {k}', { q: card.extras.qwong, k: card.extras.kong }));
  const value = opts.faan ? tr('{a} faan · concealed {b} faan', { a: LIMIT_FAAN.limit, b: LIMIT_FAAN.double }) : tr('{a} · concealed {b}', { a: BIG_PAY.normal.toLocaleString('en-US'), b: BIG_PAY.concealed.toLocaleString('en-US') });
  return cardFace('big', card.n, card.name, card.picture, !!opts.recommended, [
    h('div', { class: 'sc-value' }, value, extras),
    pictureOf(card.picture),
    h('p', { class: 'sc-how' }, card.how),
    h('p', { class: 'sc-jokers' }, h('b', {}, tr('Jokers')), ' ', card.jokersText),
    opts.onPick ? h('button', { class: `btn${opts.recommended ? ' primary' : ''}`, onclick: opts.onPick }, tr('Play this card')) : null,
  ]);
}
