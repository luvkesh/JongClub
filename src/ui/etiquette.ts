// Table etiquette at the table: the phrase and reaction bar, the bubbles shown
// beside a seat, and the Settings switch (src/net/etiquette.ts has the phrases).

import { EMOJI_REACTIONS, PHRASES, SignalLimiter, etiquetteHidden, phraseCode, phraseOf, setEtiquetteHidden } from '../net/etiquette';
import { h } from './dom';
import './etiquette.css';
import { tr } from '../i18n';

const sendLimit = new SignalLimiter();
const seatLimits = new Map<number, SignalLimiter>();

/** Fill the reaction bar: emoji first, then the preset phrases and gestures. */
export function fillEtiquetteBar(bar: HTMLElement, send: (code: string) => void) {
  bar.classList.add('etiquette-bar');
  const note = h('span', { class: 'etq-note', 'aria-live': 'polite' });
  const go = (code: string) => {
    if (!sendLimit.allow()) {
      note.textContent = tr('A moment, please');
      window.setTimeout(() => (note.textContent = ''), 1600);
      return;
    }
    send(code);
  };
  bar.append(
    h('div', { class: 'etq-emoji' }, ...EMOJI_REACTIONS.map((e) => h('button', { class: 'react-btn', 'aria-label': tr('React {emoji}', { emoji: e }), onclick: () => go(e) }, e))),
    h(
      'div',
      { class: 'etq-phrases' },
      ...PHRASES.map((p) => h('button', { class: `etq-phrase${p.glyph ? ' gesture' : ''}`, 'aria-label': p.text, title: p.text, onclick: () => go(phraseCode(p.id)) }, p.glyph ?? p.text)),
    ),
    note,
  );
}

/**
 * Show a signal beside a seat. Returns false when it isn't a phrase (the caller shows
 * emoji as before) or true when handled (shown, hidden by Settings, or rate-limited).
 */
export function showSignal(seatEl: HTMLElement, seat: number, code: string, mine: boolean): boolean {
  if (!mine) {
    if (etiquetteHidden()) return true;
    let lim = seatLimits.get(seat);
    if (!lim) seatLimits.set(seat, (lim = new SignalLimiter(6, 60_000, 1000)));
    if (!lim.allow()) return true;
  }
  const p = phraseOf(code);
  if (!p) return false;
  seatEl.querySelector('.phrase-bubble')?.remove();
  const b = h('div', { class: `phrase-bubble${p.glyph ? ' gesture' : ''}`, role: 'status' }, p.glyph ? h('span', { class: 'pb-glyph', 'aria-hidden': 'true' }, p.glyph) : '', h('span', { class: 'pb-text' }, p.text));
  seatEl.append(b);
  window.setTimeout(() => b.remove(), 3400);
  return true;
}

/** Settings: show or hide other players' phrases and reactions. */
export function etiquetteField(): HTMLElement {
  const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': tr('Table phrases and reactions') });
  const hidden = etiquetteHidden();
  for (const [v, label, tip] of [
    ['show', tr('Show'), tr('Other players’ phrases and reactions appear in a bubble by their seat.')],
    ['hide', tr('Hide'), tr('Other players’ phrases and reactions are not shown to you.')],
  ] as const) {
    const b = h('button', { class: (v === 'hide') === hidden ? 'on' : '', role: 'radio', 'aria-checked': String((v === 'hide') === hidden), title: tip }, label);
    b.onclick = () => {
      setEtiquetteHidden(v === 'hide');
      wrap.querySelectorAll('button').forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-checked', String(x === b));
      });
    };
    wrap.append(b);
  }
  return h('div', { class: 'field' }, h('span', { title: tr('Preset phrases such as “Good game” and reactions from other players at live tables.') }, tr('Table phrases and reactions')), wrap);
}
