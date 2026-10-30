// The club's Small and Big Cards as printed playing cards (2.5 x 3.5, poker size): lacquered stock
// in the card's own colours with a gold foil frame and Art Deco corners, corner numbers with the
// card's emblem, a guilloché medallion, the name under a single gold rule, what it pays, and an
// ivory panel with the tiles of one way to make it and the hand it names (art in cardArt.ts).
// Used by the card choice at the start of a South hand, "Your card", the Big Card picker and the
// lessons. Anything that is not printed on the card (JongBot's advice, a Play button) sits below it.

import { h, tileImg } from './dom';
import { tr } from '../i18n';
import { LIMIT_PAY, type SmallCard } from '../engine/rules/indiaCards';
import { BIG_PAY, type BigCard } from '../engine/rules/indiaBig';
import { parseKinds } from '../engine/tiles';
import { cardStockSvg, emblemOf, medallionSvg, paletteOf, pipSvg } from './cardArt';
import './smallCard.css';

const LIMIT_LABEL = { half: 'Half limit', limit: 'Limit', double: 'Double limit' } as const;
/** A card's value in faan at a table that plays the club's cards in its special wind rounds (windRounds.ts CARD_FAAN). */
const LIMIT_FAAN = { half: 3, limit: 4, double: 5 } as const;

/** What the card pays, as the book names it ("Half limit · 500"), or in faan at a faan table; cards whose value depends on the hand say so. */
export function cardValueLine(card: SmallCard, faan = false): string {
  if (typeof card.value !== 'string') return tr('Value depends on the hand');
  return `${tr(LIMIT_LABEL[card.value])} · ${faan ? tr('{n} faan', { n: LIMIT_FAAN[card.value] }) : LIMIT_PAY[card.value].toLocaleString('en-US')}`;
}

/** Text steps down (to 70%) until the printed face fits its card, as a printer would set a long card. */
function fitWhenShown(card: HTMLElement) {
  if (typeof ResizeObserver === 'undefined') return;
  const face = card.querySelector<HTMLElement>('.cc-face')!;
  const fit = () => {
    let s = 1;
    card.style.setProperty('--cc-fit', '1');
    while (s > 0.7 && face.scrollHeight > face.clientHeight + 1) {
      s -= 0.05;
      card.style.setProperty('--cc-fit', s.toFixed(2));
    }
  };
  let w = 0;
  new ResizeObserver((entries) => {
    const nw = Math.round(entries[0].contentRect.width);
    if (nw && nw !== w) (w = nw), fit();
  }).observe(card);
}

const corner = (cls: string, n: number, name: string) =>
  h('span', { class: `cc-index ${cls}`, 'aria-hidden': 'true' }, h('b', {}, String(n)), h('span', { class: 'cc-pip', html: emblemOf(name) === 'number' ? '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 8 38 24 24 40 10 24z" fill="currentColor"/></svg>' : pipSvg(name, n) }));

/** The printed card. */
function printedCard(kind: 'small' | 'big', n: number, name: string, picture: string, recommended: boolean, value: (HTMLElement | string | null)[], panel: (HTMLElement | null)[]): HTMLElement {
  const pal = paletteOf(name, picture);
  const card = h('div', {
    class: `small-card cc cc-${pal.id} cc-${pal.metal} cc-e-${emblemOf(name)}${kind === 'big' ? ' big-card' : ''}${recommended ? ' recommended' : ''}`,
    style: `--cc-ink:${pal.ink};--cc-deep:${pal.deep};--cc-deep2:${pal.deep2}`,
    role: 'group',
    'aria-label': `${kind === 'big' ? tr('Big Card') : tr('Small Card')} ${n}: ${name}`,
  });
  card.insertAdjacentHTML('afterbegin', cardStockSvg(pal, n, kind === 'big'));
  card.append(
    corner('cc-tl', n, name),
    corner('cc-br', n, name),
    h(
      'div',
      { class: 'cc-face' },
      h('div', { class: 'cc-kind' }, kind === 'big' ? tr('Big Card') : tr('Small Card')),
      h('div', { class: 'cc-medal', html: medallionSvg(name, n, pal) }),
      h('div', { class: 'sc-head' }, h('span', { class: 'sc-name' }, name)),
      h('div', { class: 'sc-value' }, ...value.filter((x) => x !== null)),
      h('div', { class: 'cc-panel' }, h('div', { class: 'sc-picture', 'aria-label': tr('One way to make it') }, ...parseKinds(picture).map((k) => tileImg(k, 'sc-tile'))), ...panel.filter((x): x is HTMLElement => !!x)),
      h('div', { class: 'cc-foot', 'aria-hidden': 'true' }, 'JongClub'),
    ),
  );
  fitWhenShown(card);
  return card;
}

/** The card with what isn't printed on it (JongBot's advice, a button) underneath. */
const withCaption = (card: HTMLElement, below: (HTMLElement | null)[]) => {
  const extra = below.filter((x): x is HTMLElement => !!x);
  return extra.length ? h('div', { class: 'cc-wrap' }, card, ...extra) : card;
};

export function smallCardView(card: SmallCard, opts: { distance?: number; recommended?: boolean; faan?: boolean } = {}): HTMLElement {
  const face = printedCard('small', card.n, card.name, card.picture, !!opts.recommended, [cardValueLine(card, opts.faan), card.wall ? h('span', { class: 'sc-wall' }, tr('All from the wall')) : null], [h('p', { class: 'sc-how' }, card.how)]);
  return withCaption(face, [
    opts.distance !== undefined ? h('div', { class: 'sc-distance' }, opts.distance >= 99 ? tr('no win possible with these sets') : opts.distance <= 0 ? tr('Ready or nearly ready') : tr('{n} tiles from ready', { n: opts.distance })) : null,
    opts.recommended ? h('div', { class: 'sc-pick' }, tr('JongBot suggests this card')) : null,
  ]);
}

/** A Big Card (North round): one card for the whole table, its jokers, and one way to make it. */
export function bigCardView(card: BigCard, opts: { onPick?: () => void; recommended?: boolean; faan?: boolean } = {}): HTMLElement {
  const extras = card.extras.kong === 1 && card.extras.qwong === 2 ? null : h('span', { class: 'sc-wall' }, tr('Extra tiles: a qwong {q}, a kong {k}', { q: card.extras.qwong, k: card.extras.kong }));
  const value = opts.faan ? tr('{a} faan · concealed {b} faan', { a: LIMIT_FAAN.limit, b: LIMIT_FAAN.double }) : tr('{a} · concealed {b}', { a: BIG_PAY.normal.toLocaleString('en-US'), b: BIG_PAY.concealed.toLocaleString('en-US') });
  const face = printedCard('big', card.n, card.name, card.picture, !!opts.recommended, [value, extras], [h('p', { class: 'sc-how' }, card.how), h('p', { class: 'sc-jokers' }, h('b', {}, tr('Jokers')), ' ', card.jokersText)]);
  return withCaption(face, [opts.onPick ? h('button', { class: `btn${opts.recommended ? ' primary' : ''}`, onclick: opts.onPick }, tr('Play this card')) : null]);
}
