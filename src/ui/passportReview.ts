// The after-hand passport review on the hand summary (India Rules East round):
// which passport you came closest to, the discard that let it slip, and where
// another tile would have got you there faster. JongBot measures the hand in
// the background (ai/passportReview.ts) so the summary shows at once.

import { passportReviewScan, type PassportReview } from '../ai/passportReview';
import { runSliced } from '../ai/matchWalk';
import type { ReplayRecord } from '../net/replay';
import { tileLabel } from '../i18n/tiles';
import { tr } from '../i18n';
import { h, tileImg } from './dom';
import './passportReview.css';

/** "3 Knits in the same 2 suits twice" for a plan's names. */
const namesText = (names: string[]) => names.filter((n, i) => names.indexOf(n) === i).map((n) => (names.filter((x) => x === n).length > 1 ? tr('{name} twice', { name: tr(n) }) : tr(n))).join(' + ');
const fromReady = (n: number) => (n >= 99 ? tr('shut out') : n <= 0 ? tr('ready') : n === 1 ? tr('1 from ready') : tr('{n} from ready', { n }));
const beside = (sets: number, pair: boolean) => (sets === 1 && pair ? tr('a set and a pair') : sets === 1 ? tr('a set') : sets && pair ? tr('{n} sets and a pair', { n: sets }) : sets ? tr('{n} sets', { n: sets }) : pair ? tr('a pair') : '');

/**
 * A section for the hand summary: a quiet line while JongBot looks back over
 * the hand, then the review; it removes itself when there is nothing to say
 * (a hand with no discards of yours).
 */
export function passportReviewSection(rec: ReplayRecord, me: number, labels: boolean): HTMLElement {
  const body = h('div', { class: 'ppr-body' });
  const sec = h(
    'section',
    { class: 'pp-review loading', 'aria-busy': 'true', 'aria-live': 'polite' },
    h('p', { class: 'eyebrow' }, tr('Passport review')),
    h('p', { class: 'ppr-wait muted' }, h('i', { class: 'km-dots', 'aria-hidden': 'true' }, h('b'), h('b'), h('b')), tr('JongBot is looking back over your passports…')),
    body,
  );
  window.setTimeout(() => {
    if (!sec.isConnected) return;
    void runSliced(passportReviewScan(rec, me), () => sec.isConnected).then((r) => {
      if (!sec.isConnected) return;
      if (!r || !r.turns.length || !r.closest) return sec.remove();
      sec.classList.remove('loading');
      sec.removeAttribute('aria-busy');
      sec.querySelector('.ppr-wait')?.remove();
      body.append(...render(r, labels));
    });
  }, 500);
  return sec;
}

function render(r: PassportReview, labels: boolean): HTMLElement[] {
  const out: HTMLElement[] = [];
  const c = r.closest!;
  const name = h('strong', {}, namesText(c.names));
  const with_ = beside(c.sets, c.pair);
  if (r.won) out.push(h('p', { class: 'ppr-line' }, ...tr('You went for {passport} and completed it.', { passport: '\u0000' }).split('\u0000').flatMap((s, i) => (i ? [name, s] : [s]))));
  else
    out.push(
      h(
        'p',
        { class: 'ppr-line' },
        ...tr('You came closest to {passport}{with}: {state} after discard {n}.', { passport: '\u0000', with: with_ ? ` (${tr('with {sets}', { sets: with_ })})` : '', state: fromReady(c.fromReady), n: c.turn })
          .split('\u0000')
          .flatMap((s, i) => (i ? [name, s] : [s])),
      ),
    );
  // The strip: one cell per discard, how far from ready it left you; the closest point and the slip marked.
  const strip = h('div', { class: 'ppr-strip', role: 'list', 'aria-label': tr('Tiles from ready after each discard') });
  for (const t of r.turns) {
    const cls = ['ppr-cell'];
    if (t.turn === c.turn) cls.push('closest');
    if (t.turn === r.leftBehind?.turn) cls.push('left');
    else if (t.turn === r.slip?.turn) cls.push('slip');
    strip.append(h('span', { class: cls.join(' '), role: 'listitem', title: `${tr('Discard {n}', { n: t.turn })}: ${tileLabel(t.tile)}, ${fromReady(t.after)}` }, h('b', {}, String(t.turn)), h('i', {}, t.after >= 99 ? '×' : String(t.after))));
  }
  out.push(strip);
  const pair = (tile: number, better: number) => h('span', { class: 'ppr-tiles' }, tileImg(tile, 'mini', labels), h('span', { class: 'ppr-arrow', 'aria-hidden': 'true' }, '→'), tileImg(better, 'mini', labels));
  if (r.leftBehind) {
    const l = r.leftBehind;
    out.push(
      h(
        'div',
        { class: 'ppr-moment left' },
        h('span', { class: 'ppr-k' }, tr('Left behind')),
        pair(l.tile, l.better),
        h('p', {}, tr('Discard {n}: throwing the {tile} took that passport from {before} to {after}. The {better} would have kept it {kept}.', { n: l.turn, tile: tileLabel(l.tile), before: fromReady(l.before), after: fromReady(l.after), better: tileLabel(l.better), kept: fromReady(l.betterAfter) })),
      ),
    );
  }
  if (r.slip) {
    const s = r.slip;
    out.push(
      h(
        'div',
        { class: 'ppr-moment slip' },
        h('span', { class: 'ppr-k' }, tr('Faster route')),
        pair(s.tile, s.better),
        h('p', {}, tr('Discard {n}: the {better} instead of the {tile} would have left you {state} towards {passport}, not {was}.', { n: s.turn, better: tileLabel(s.better), tile: tileLabel(s.tile), state: fromReady(s.betterAfter), passport: namesText(s.names), was: fromReady(s.after) })),
      ),
    );
  }
  if (!r.won && !r.leftBehind && !r.slip) out.push(h('p', { class: 'muted small' }, tr('Every discard kept you as close to a passport as any tile could. The wall didn’t bring the tiles.')));
  return out;
}
