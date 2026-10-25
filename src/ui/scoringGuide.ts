// The rule book (the scoring guide): an expandable panel at the table that shows how to win
// and how to score in the variation being played. It opens from the HUD (the
// book icon), sits over the middle of the table so it never covers your hand
// or the other players' sets, and keeps a live "your hand" read: how far you
// are from sets and a pair, from an all-pairs hand, and which lines your last
// win scored. The Dubai club card and the American card show their own lines.
// Sets and hands are drawn with the player's own tile set, so the pictures
// match the tiles on the table.

import { sevenPairsShanten, standardShanten, thirteenOrphansShanten } from '../engine/hand';
import { DUBAI_CARD } from '../engine/rules/taiwaneseDubai';
import type { RuleProfile } from '../engine/rules/types';
import { parseKinds, toCounts } from '../engine/tiles';
import { tr } from '../i18n';
import { clear, h, tileImg } from './dom';
import { anatomy, guideFor, pictureFor, specialShapes, type GuideLine } from './scoringGuideData';
import './scoringGuide.css';

/** The rule book icon on the HUD button: an open book with ruled pages. */
const ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5C10.2 5 7.6 4.5 3.5 4.8v13.4c4.1-.3 6.7.2 8.5 1.8 1.8-1.6 4.4-2.1 8.5-1.8V4.8C16.4 4.5 13.8 5 12 6.5z"/><path d="M12 6.5V20"/><path d="M6 8.6c1.6-.1 2.9.1 3.9.6M6 11.6c1.6-.1 2.9.1 3.9.6M14.1 9.2c1-.5 2.3-.7 3.9-.6M14.1 12.2c1-.5 2.3-.7 3.9-.6"/></svg>';

export interface GuideState {
  profile: RuleProfile;
  /** Your concealed tile kinds, or null when spectating. */
  hand: number[] | null;
  melds: number;
  /** Your seat's shapes from the game (they can read your declared sets, as the passports do); the profile's otherwise. */
  shapes?: RuleProfile['shapes'];
  /** Score line names from your latest win. */
  scored: string[];
  /** Draw the corner numbers on tile faces (the player's setting). */
  labels?: boolean;
}

const away = (s: number) => (s < 0 ? tr('complete') : s === 0 ? tr('ready: one tile from a win') : tr('{n} tiles from ready', { n: s }));

export class ScoringGuide {
  readonly button: HTMLButtonElement;
  readonly panel: HTMLElement;
  private live = h('div', { class: 'sg-live' });
  private built = false;
  /** Opening the rule book closes the score calculator. */
  onOpen?: () => void;

  constructor(private state: () => GuideState) {
    this.panel = h('aside', { class: 'sg-panel', hidden: true, role: 'dialog', 'aria-label': tr('Rule book') });
    this.button = h('button', { class: 'icon-btn guide-btn', 'aria-label': tr('Rule book'), 'aria-expanded': 'false', title: tr('Rule book: how to win and how every hand scores in this variation'), onclick: () => this.toggle() }) as HTMLButtonElement;
    this.button.innerHTML = ICON;
    this.panel.addEventListener('keydown', (e) => e.key === 'Escape' && this.toggle(false));
    // The table calls place() on resize (a window listener here would outlive the match).
  }

  get open() {
    return !this.panel.hidden;
  }

  toggle(force?: boolean) {
    const show = force ?? this.panel.hidden;
    if (show && !this.built) this.build();
    this.panel.hidden = !show;
    this.button.setAttribute('aria-expanded', String(show));
    this.button.classList.toggle('on', show);
    if (show) {
      this.onOpen?.();
      this.place();
      this.refresh();
      this.panel.querySelector<HTMLElement>('.sg-close')?.focus({ preventScroll: true });
    }
  }

  /** Fit between the HUD bar and your hand (both vary with screen size and the hand's layout). */
  place() {
    const root = this.panel.parentElement;
    if (!root || this.panel.hidden) return;
    const box = root.getBoundingClientRect();
    const top = root.querySelector('.hud-top')?.getBoundingClientRect().bottom ?? box.top + 56;
    let bottom = root.querySelector('.bottom')?.getBoundingClientRect().top ?? box.bottom - 200;
    // On wide screens your hand is drawn on the table above the bottom bar: stop at your name plate.
    const plate = root.querySelector<HTMLElement>('.seat-0:not([hidden])')?.getBoundingClientRect();
    if (plate && plate.height && plate.top > top + 200) bottom = Math.min(bottom, plate.top);
    const y = top - box.top + 8;
    this.panel.style.top = `${y}px`;
    this.panel.style.maxHeight = `${Math.max(160, bottom - box.top - y - 8)}px`;
  }

  /** Rebuild after the table's rules change (a new match). */
  reset() {
    this.built = false;
    if (this.open) this.build(), this.refresh();
  }

  /** Update the live read of your hand and the marks from your last win. Cheap when closed. */
  refresh() {
    if (!this.open) return;
    this.place();
    const s = this.state();
    const marks = new Set(s.scored.map((n) => n.replace(/ × \d+$/, '')));
    for (const el of this.panel.querySelectorAll<HTMLElement>('[data-line]')) el.classList.toggle('hit', marks.has(el.dataset.line!));
    clear(this.live);
    if (!s.hand || s.profile.card) return;
    const c = toCounts(s.hand);
    const r = s.shapes ?? s.profile.shapes;
    const rows: [string, number][] = r.standard === false ? [] : [[tr('Sets and a pair'), standardShanten(c, s.melds, r.sets ?? 4, r.chows !== false)]];
    // Special rounds: each card hand (or the passports) is a road of its own.
    if (s.profile.specialRound) for (const sp of r.special ?? []) rows.push([tr(sp.name), sp.shanten(c, s.melds)]);
    if (!s.melds) {
      if (r.sevenPairs) rows.push([tr('Seven pairs'), sevenPairsShanten(c)]);
      if (r.thirteenOrphans) rows.push([tr('Thirteen orphans'), thirteenOrphansShanten(c)]);
      for (const sp of r.special ?? []) if (sp.name === 'liGu' || sp.name === 'nicoNico') rows.push([sp.name === 'liGu' ? 'Lì Gǔ Lì Gǔ' : 'Nico Nico', sp.shanten(c, 0)]);
    }
    // A road the reader can't measure (99) is left out rather than shown as "99 tiles from ready".
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i][1] >= 99) rows.splice(i, 1);
    if (!rows.length) return;
    const best = Math.min(...rows.map((x) => x[1]));
    this.live.append(
      h('h4', { class: 'sg-sub' }, tr('Your hand now')),
      ...rows.map(([name, n]) => h('div', { class: `sg-road${n === best ? ' best' : ''}` }, h('span', {}, name), h('span', { class: 'sg-away' }, away(n)))),
    );
    if (marks.size) this.live.append(h('p', { class: 'sg-note' }, tr('Lines your last win scored are marked.')));
  }

  /** Sets of tiles in a row, drawn in the equipped tile set (always left to right, like the table). */
  private tiles(groups: string[], cls = '') {
    const labels = this.state().labels ?? true;
    return h('div', { class: `sg-tiles ${cls}`, dir: 'ltr', 'aria-hidden': 'true' }, ...groups.map((g) => h('span', { class: 'sg-set' }, ...parseKinds(g).map((k) => tileImg(k, 'mini', labels)))));
  }

  private build() {
    this.built = true;
    const p = this.state().profile;
    const g = guideFor(p);
    const line = (l: GuideLine) => {
      const pic = pictureFor(l.name);
      const num = typeof l.value === 'number';
      return h(
        'div',
        { class: `sg-line${pic ? ' has-pic' : ''}`, 'data-line': l.name },
        h('span', { class: `sg-val${num ? '' : ' word'}` }, h('b', {}, String(l.value)), num ? h('small', {}, g.unit) : null),
        h('div', { class: 'sg-name' }, h('strong', {}, l.name), h('span', { class: 'sg-how' }, l.how), pic ? this.tiles(pic) : null),
      );
    };
    const sec = (title: string, open: boolean, count: number | null, ...body: (Node | null)[]) => {
      const d = h('details', { class: 'sg-sec' }, h('summary', {}, h('span', { class: 'sg-title' }, title), count ? h('span', { class: 'sg-count' }, String(count)) : null), h('div', { class: 'sg-cards' }, ...body));
      (d as HTMLDetailsElement).open = open;
      return d;
    };
    const parts = { chow: tr('Chow'), pung: tr('Pung'), kong: tr('Kong'), pair: tr('Pair') };
    const hero = p.card
      ? null
      : h(
          'figure',
          { class: 'sg-hero' },
          h('figcaption', {}, tr('A winning hand')),
          h('div', { class: 'sg-parts', dir: 'ltr' }, ...anatomy(p).map((a) => h('div', { class: `sg-part ${a.kind}` }, this.tiles([a.tiles]), h('span', {}, parts[a.kind])))),
        );
    const specials = p.card ? [] : specialShapes(p);
    const special = specials.length
      ? h('div', { class: 'sg-specials' }, h('h4', { class: 'sg-sub' }, tr('Special hands')), ...specials.map((s) => h('div', { class: 'sg-special' }, h('strong', {}, s.name), this.tiles(s.tiles))))
      : null;
    const body = h('div', { class: 'sg-body' });
    body.append(sec(tr('How to win'), true, null, hero, h('ul', { class: 'sg-win' }, ...g.win.map((w) => h('li', {}, w))), this.live, special));
    body.append(sec(tr('How the score is paid'), false, null, h('p', { class: 'sg-pay' }, g.pay)));
    for (const s of g.sections) body.append(sec(s.title, !s.closed, s.lines.length, ...s.lines.map(line)));
    if (g.card === 'dubai')
      for (const s of DUBAI_CARD)
        body.append(sec(s.title, false, s.lines.length, ...s.lines.map((l) => line({ name: l.label, value: `${l.plus ? '+' : ''}${l.pts}`, how: [l.detail, l.how].filter(Boolean).join(' · ') }))));
    clear(this.panel).append(
      h(
        'header',
        { class: 'sg-head' },
        h('div', {}, h('p', { class: 'eyebrow' }, `${tr(p.name)} · ${tr(g.unit)}`), h('h3', {}, tr('Rule book'))),
        h('button', { class: 'icon-btn sg-close', 'aria-label': tr('Close the rule book'), onclick: () => this.toggle(false) }, '✕'),
      ),
      body,
    );
  }
}
