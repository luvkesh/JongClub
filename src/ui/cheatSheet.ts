// The Dubai club card for Taiwanese Mahjong, opened from the table HUD.
// It lists every line of the printed cheat sheet with its points, how
// JongClub reads the terse ones, and marks the lines your last win scored.

import { DUBAI_CARD } from '../engine/rules/taiwaneseDubai';
import type { RuleProfile } from '../engine/rules/types';
import { clear, h } from './dom';
import './cheatSheet.css';
import { tr } from '../i18n';

/** True when this table scores with the Dubai card. */
export const usesDubaiCard = (p: RuleProfile) => p.id === 'taiwanese' && p.houseChoices?.scoring === 'dubai';

export interface CheatSheetOpts {
  /** Score item names from the latest win, to mark on the card. */
  scored?: string[];
  dice?: number[];
}

export function showCheatSheet(overlay: HTMLElement, opts: CheatSheetOpts = {}) {
  clear(overlay).hidden = false;
  const scored = new Set((opts.scored ?? []).map((n) => n.replace(/ × \d+$/, '')));
  const grid = h('div', { class: 'cs-grid' });
  for (const sec of DUBAI_CARD) {
    const box = h('section', { class: 'cs-sec' }, h('h4', { class: 'cs-title' }, h('span', { class: 'cs-pts' }, tr('Pts')), sec.title));
    for (const l of sec.lines) {
      const head = sec.heads?.[l.id];
      if (head) box.append(h('div', { class: 'cs-head' }, head));
      box.append(
        h(
          'div',
          { class: `cs-line${l.plus ? ' plus' : ''}${scored.has(l.label) ? ' hit' : ''}`, title: l.how ?? null },
          h('span', { class: 'cs-pts' }, `${l.plus ? '+' : ''}${l.pts}`),
          h('span', { class: 'cs-label' }, l.label, l.detail ? h('span', { class: 'cs-detail' }, ` (${l.detail})`) : null, l.how ? h('span', { class: 'cs-how' }, l.how) : null),
        ),
      );
    }
    grid.append(box);
  }
  const close = h('button', { class: 'btn primary', onclick: () => (overlay.hidden = true) }, tr('Back to the table'));
  overlay.append(
    h(
      'div',
      { class: 'card cs-sheet' },
      h('p', { class: 'eyebrow' }, tr('Taiwanese Mahjong · Dubai club card')),
      h('h3', {}, tr('Cheat sheet')),
      h(
        'p',
        { class: 'muted small' },
        tr('Every line you make is added up. Self-drawn wins are paid by everyone, a discard by the player who threw it. '),
        scored.size ? tr('Lines from the last win are marked. ') : '',
        opts.dice?.length ? tr('This hand’s dice: {dice}.', { dice: opts.dice.join(' · ') }) : '',
      ),
      grid,
      h('div', { class: 'btn-row' }, close),
    ),
  );
  close.focus({ preventScroll: true });
}
