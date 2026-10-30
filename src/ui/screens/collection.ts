// Collection and The Atelier, one page with two main tabs: what you own and
// wear, and where cosmetics are acquired with Jong Points. Cosmetics never
// affect gameplay or rating.

import { CATALOG, CATEGORY_LABELS, type Cosmetic, type CosmeticCategory } from '../../cosmetics/catalog';
import { saveProfile } from '../../progression/profile';
import { buy, equip, equipped, owns, picture, preview } from '../atelier';
import { tablePreview } from '../../render/tablePreview';
import type { AppCtx } from '../ctx';
import { fmt, h } from '../dom';
import { glyph } from '../glyphs';
import { viewItem } from '../itemView';
import { tr } from '../../i18n';
import './collection.css';

type Mode = 'collection' | 'atelier';
type Show = 'all' | 'owned' | 'missing' | 'afford';

const CATS = Object.keys(CATEGORY_LABELS) as CosmeticCategory[];
const CAT_ICON: Record<CosmeticCategory, string> = {
  tileSet: 'tiles',
  rack: 'rack',
  table: 'table',
  environment: 'room',
  avatar: 'shirt',
  accessory: 'glasses',
  winAnimation: 'sparkle',
  tableEffect: 'wand',
  sound: 'note',
  frame: 'frame',
};

const state: Record<Mode, { cat: CosmeticCategory; show: Show; q: string }> = {
  collection: { cat: 'tileSet', show: 'all', q: '' },
  atelier: { cat: 'tileSet', show: 'all', q: '' },
};

/** The items each grid shows right now, in order: the pop-over's arrows step through them. */
const shown: Record<Mode, Cosmetic[]> = { collection: [], atelier: [] };

/** Real items only: the "none" placeholders are not things to collect. */
const real = (c: Cosmetic) => c.id !== 'none' && c.id !== 'fx-none';

export const collectionScreen = (ctx: AppCtx) => page(ctx, 'collection');
export const atelierScreen = (ctx: AppCtx) => page(ctx, 'atelier');

function page(ctx: AppCtx, mode: Mode) {
  const p = ctx.profile;
  const st = state[mode];
  const go = () => ctx.go(mode);
  const all = CATALOG.filter(real);
  const ownedCount = all.filter((c) => owns(p, c)).length;

  // ------------------------------------------------ main tabs
  const mainTabs = h(
    'div',
    { class: 'cc-main-tabs', role: 'tablist', 'aria-label': tr('Collection') },
    ...(
      [
        ['collection', tr('Collection'), 'diamond'],
        ['atelier', tr('The Atelier'), 'brush'],
      ] as const
    ).map(([id, label, ico]) => h('button', { class: id === mode ? 'on' : '', role: 'tab', 'aria-selected': String(id === mode), 'data-tab': id, onclick: () => id !== mode && (state[id].cat = st.cat, ctx.go(id)) }, h('span', { class: 'cc-tab-ico', html: glyph(ico) }), label)),
  );

  // ------------------------------------------------ summary
  const pct = Math.round((ownedCount / Math.max(1, all.length)) * 100);
  // A small pill beside the main tabs, so the items lead and the numbers stay quiet.
  const summary =
    mode === 'collection'
      ? h(
          'div',
          { class: 'cc-summary cc-strip' },
          h('span', { class: 'cc-strip-ico', html: glyph('diamond') }),
          h('p', { class: 'cc-count' }, h('b', {}, `${fmt(ownedCount)} / ${fmt(all.length)}`), ' ', tr('collected')),
          h('div', { class: 'cc-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': tr('Collected'), title: tr('Cosmetics never affect gameplay or rating.') }, h('i', { style: { width: `${Math.max(2, pct)}%` } })),
        )
      : h('div', { class: 'cc-summary cc-strip', title: tr('Earned by playing. Never changes gameplay.') }, h('span', { class: 'cc-strip-ico coin', html: glyph('coin') }), h('p', { class: 'cc-count' }, h('b', {}, fmt(p.jongPoints)), ' ', tr('Jong Points')));
  const top = h('div', { class: 'cc-top' }, summary, mainTabs, mode === 'atelier' ? h('p', { class: 'cc-top-note' }, tr('Earned by playing. Never changes gameplay.')) : h('span', { class: 'cc-top-note' }));

  // ------------------------------------------------ categories
  const strip = h(
    'div',
    { class: 'cc-cats', role: 'tablist', 'aria-label': tr('Category') },
    ...CATS.map((c) => h('button', { class: c === st.cat ? 'on' : '', role: 'tab', 'aria-selected': String(c === st.cat), onclick: () => ((st.cat = c), go()) }, h('span', { class: 'cc-cat-ico', html: glyph(CAT_ICON[c]) }), CATEGORY_LABELS[c])),
  );
  // Arrows show only where there is more to see: none at the start on the left, none at the end on the right.
  const nudge = (dir: 1 | -1) => strip.scrollBy({ left: strip.clientWidth * 0.7 * dir * (document.dir === 'rtl' ? -1 : 1), behavior: 'smooth' });
  const less = h('button', { class: 'cc-cat-more cc-cat-less', 'aria-label': tr('Previous'), html: glyph('chevron'), onclick: () => nudge(-1) });
  const more = h('button', { class: 'cc-cat-more', 'aria-label': tr('More'), html: glyph('chevron'), onclick: () => nudge(1) });
  const edges = () => {
    const x = Math.abs(strip.scrollLeft), room = strip.scrollWidth - strip.clientWidth;
    less.hidden = x < 4;
    more.hidden = x > room - 4;
    strip.classList.toggle('cc-fade-s', !less.hidden);
    strip.classList.toggle('cc-fade-e', !more.hidden);
  };
  strip.addEventListener('scroll', edges, { passive: true });
  new ResizeObserver(edges).observe(strip);
  const cats = h('div', { class: 'cc-cat-wrap' }, less, strip, more);
  // Keep the chosen category in view after a re-render.
  requestAnimationFrame(() => strip.querySelector<HTMLElement>('.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));

  // ------------------------------------------------ search and filter
  const search = h('input', { type: 'search', class: 'cc-search-input', placeholder: mode === 'collection' ? tr('Search collection…') : tr('Search The Atelier…'), value: st.q, 'aria-label': tr('Search') }) as HTMLInputElement;
  const shows: [Show, string][] =
    mode === 'collection'
      ? [
          ['all', tr('All items')],
          ['owned', tr('Collected')],
          ['missing', tr('Still to collect')],
        ]
      : [
          ['all', tr('All items')],
          ['afford', tr('Within your points')],
          ['owned', tr('In your collection')],
        ];
  const filter = h('select', { class: 'cc-filter-select', 'aria-label': tr('Show') }, ...shows.map(([id, label]) => h('option', { value: id, selected: id === st.show }, label))) as HTMLSelectElement;
  filter.onchange = () => ((st.show = filter.value as Show), go());
  const tools = h('div', { class: 'cc-tools' }, h('label', { class: 'cc-search' }, h('span', { class: 'cc-tool-ico', html: glyph('search') }), search), h('label', { class: 'cc-filter' }, h('span', { class: 'cc-tool-ico', html: glyph('filter') }), filter, h('span', { class: 'cc-tool-caret', html: glyph('chevronDown') })));

  // ------------------------------------------------ grid
  const grid = h('div', { class: 'cc-grid' });
  const fill = () => {
    const q = st.q.trim().toLowerCase();
    let items = CATALOG.filter((c) => c.category === st.cat && real(c) && (mode === 'collection' || c.price > 0 || !!c.earnedBy));
    if (q) items = items.filter((c) => `${c.name} ${c.blurb}`.toLowerCase().includes(q));
    if (st.show === 'owned') items = items.filter((c) => owns(p, c));
    if (st.show === 'missing') items = items.filter((c) => !owns(p, c));
    if (st.show === 'afford') items = items.filter((c) => !owns(p, c) && !c.earnedBy && c.price <= p.jongPoints);
    shown[mode] = items;
    const cards: HTMLElement[] = [];
    if (mode === 'collection' && st.cat === 'table' && !q && st.show !== 'missing') cards.push(autoTableCard(ctx));
    cards.push(...items.map((c) => card(ctx, c, mode)));
    grid.replaceChildren(...(cards.length ? cards : [h('div', { class: 'cc-empty' }, h('span', { class: 'cc-empty-ico', html: glyph(q ? 'search' : CAT_ICON[st.cat]) }), h('p', {}, q ? tr('Nothing matches “{q}”.', { q: st.q.trim() }) : st.show === 'afford' ? tr('Play games and daily challenges to earn more Jong Points.') : tr('Nothing here yet.')))]));
  };
  search.oninput = () => ((st.q = search.value), fill());
  fill();

  return h('div', { class: `page cc-page cc-${mode}` }, top, cats, tools, grid);
}

/** One item: its real preview, name, a line about it, and what you can do with it. */
function card(ctx: AppCtx, c: Cosmetic, mode: Mode): HTMLElement {
  const p = ctx.profile;
  const own = owns(p, c);
  const on = own && equipped(p, c);
  // Tapping the card, or its eye, opens the item's pop-over with Mei's pitch; the arrows there step through this list.
  const open = () => viewItem(ctx, c, mode, () => ctx.go(mode), (it) => ((state.atelier.cat = it.category), ctx.go('atelier')), shown[mode]);
  // Round icon buttons, so the foot fits on every card width; each names itself for screen readers and on hover.
  const icon = (ico: string, label: string, act: () => void, cls = '') => h('button', { class: `cc-ibtn ${cls}`, 'aria-label': label, title: label, html: glyph(ico), onclick: (e: Event) => (e.stopPropagation(), act()) });
  const view = () => icon('eye', tr('View {name}', { name: c.name }), open, 'cc-view');
  const row = (lead: HTMLElement, ...acts: (HTMLElement | null)[]) => h('div', { class: 'cc-foot-row' }, lead, h('div', { class: 'cc-acts' }, ...acts));
  let foot: HTMLElement;
  if (own) {
    foot = on
      ? row(h('div', { class: 'cc-state owned' }, h('span', { class: 'cc-state-ico', html: glyph('check') }), tr('Equipped')), view())
      : row(h('span', { class: 'cc-state owned' }, h('span', { class: 'cc-state-ico', html: glyph('diamond') }), tr('Owned')), view(), icon('check', tr('Equip'), () => (equip(ctx, c), ctx.go(mode)), 'cc-equip'));
  } else if (c.earnedBy) {
    foot = row(h('div', { class: 'cc-state earn' }, h('span', { class: 'cc-state-ico', html: glyph('trophy') }), h('span', {}, tr('Earn: {how}', { how: c.earnedBy }))), view());
  } else if (mode === 'atelier') {
    const can = p.jongPoints >= c.price;
    foot = row(h('span', { class: 'cc-price' }, h('span', { class: 'cc-state-ico', html: glyph('coin') }), `${fmt(c.price)} JP`), view(), icon('bag', tr('Acquire'), () => buy(ctx, c, () => ctx.go('atelier')), `cc-buy ${can ? 'can' : ''}`));
  } else {
    // Its pop-over leads on to The Atelier, so the card keeps just the price and View.
    foot = row(h('span', { class: 'cc-price' }, h('span', { class: 'cc-state-ico', html: glyph('coin') }), `${fmt(c.price)} JP`), view());
  }
  return h(
    'article',
    { class: `cc-card ${own ? 'owned' : 'locked'} ${on ? 'equipped' : ''}`, tabindex: '0', 'aria-label': tr('View {name}', { name: c.name }), onclick: open, onkeydown: (e: KeyboardEvent) => e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open()) },
    h('div', { class: 'cc-prev' }, preview(ctx, c), on ? h('span', { class: 'cc-badge' }, h('span', { class: 'cc-state-ico', html: glyph('check') }), tr('Equipped')) : null),
    h('div', { class: 'cc-body' }, h('h3', { class: 'cc-name' }, c.name), h('p', { class: 'cc-blurb' }, c.blurb), foot),
  );
}

/** The table that follows each variation: always owned. */
function autoTableCard(ctx: AppCtx) {
  const p = ctx.profile;
  const on = p.loadout.table === 'auto';
  return h(
    'article',
    { class: `cc-card owned ${on ? 'equipped' : ''}` },
    h('div', { class: 'cc-prev' }, picture('table-prev auto', () => tablePreview('classic-green'), 'conic-gradient(#17402f, #1a2440, #0f4a46, #3a2a1c, #5a4321, #17402f)'), on ? h('span', { class: 'cc-badge' }, h('span', { class: 'cc-state-ico', html: glyph('check') }), tr('Equipped')) : null),
    h(
      'div',
      { class: 'cc-body' },
      h('h3', { class: 'cc-name' }, tr('Each variation’s own')),
      h('p', { class: 'cc-blurb' }, tr('Every variation sits at its own table.')),
      on
        ? h('div', { class: 'cc-state owned' }, h('span', { class: 'cc-state-ico', html: glyph('check') }), tr('Equipped'))
        : h('div', { class: 'cc-foot-row' }, h('span', { class: 'cc-state owned' }, h('span', { class: 'cc-state-ico', html: glyph('diamond') }), tr('Owned')), h('button', { class: 'btn sm cc-equip', onclick: () => ((p.loadout = { ...p.loadout, table: 'auto' }), saveProfile(p), ctx.applyLoadout(), ctx.go('collection')) }, tr('Equip'))),
    ),
  );
}
