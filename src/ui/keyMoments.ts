// "Three key moments" on the match results: reviewed in the background once
// the results are on screen, so the card appears at once and the moments
// fade in a moment later. Each has a button that opens the replay there.

import { keyMomentScan, type KeyMoment } from '../ai/keyMoments';
import { runSliced } from '../ai/matchWalk';
import type { ReplayRecord } from '../net/replay';
import { h, tileImg } from './dom';
import './keyMoments.css';
import { tr } from '../i18n';

const MARK: Record<KeyMoment['kind'], string> = { costly: '−', missedWin: '!', missedClaim: '?', dealIn: '!', good: '✓' };

/**
 * A section for the results card. It shows a quiet "looking back" line while
 * JongBot reviews the game, then the moments; it removes itself if there is
 * nothing to show (a variation review doesn't cover, or no decisions).
 */
export function keyMomentsSection(rec: ReplayRecord, labels: boolean, onReplay: (hand: number, step: number) => void): HTMLElement {
  const list = h('div', { class: 'km-list' });
  const sec = h(
    'section',
    { class: 'key-moments loading', 'aria-busy': 'true', 'aria-live': 'polite' },
    h('p', { class: 'eyebrow' }, tr('Three key moments')),
    h('p', { class: 'km-wait' }, h('i', { class: 'km-dots', 'aria-hidden': 'true' }, h('b'), h('b'), h('b')), tr('JongBot is looking back over your game…')),
    list,
  );
  // Let the results paint first, then review a little at a time.
  window.setTimeout(() => {
    if (!sec.isConnected) return;
    void runSliced(keyMomentScan(rec), () => sec.isConnected).then((ms) => {
      if (!sec.isConnected) return;
      if (!ms?.length) return sec.remove();
      sec.classList.remove('loading');
      sec.removeAttribute('aria-busy');
      sec.querySelector('.km-wait')?.remove();
      list.append(...ms.map((m) => card(m, labels, onReplay)));
    });
  }, 450);
  return sec;
}

function card(m: KeyMoment, labels: boolean, onReplay: (hand: number, step: number) => void): HTMLElement {
  const tone = m.kind === 'good' ? 'good' : m.verdict === 'inaccuracy' ? 'soft' : 'bad';
  return h(
    'article',
    { class: `km-card km-${tone}` },
    h(
      'div',
      { class: 'km-head' },
      h('span', { class: 'km-mark', 'aria-hidden': 'true' }, MARK[m.kind]),
      h('h4', {}, m.title),
      h('span', { class: 'km-where' }, tr('Hand {n}', { n: m.hand + 1 })),
    ),
    h(
      'div',
      { class: 'km-body' },
      m.tile !== undefined ? tileImg(m.tile, 'mini', labels) : null,
      m.better !== undefined && m.better !== m.tile ? h('span', { class: 'km-better' }, '→', tileImg(m.better, 'mini', labels)) : null,
      h('p', {}, m.line),
    ),
    h('button', { class: 'btn sm ghost km-go', onclick: () => onReplay(m.hand, m.step) }, tr('Replay this moment')),
  );
}
