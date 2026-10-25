// Find a table: the club's AI tables with search, filters and a short list
// that grows with "Show more". Filters live for the session, so coming back
// to Play keeps what you were looking for.

import './tableFinder.css';
import { CATALOGUE, REGIONS, type RegionId } from '../club/catalogue';
import { GAME_LENGTHS, type GameLength } from '../engine/rounds';
import { seatsForVariation, variationTitle, VARIATIONS } from '../engine/rules';
import { clear, h } from './dom';
import { icon } from './icons';
import type { TableConfig } from './match';
import { PACES, PACE_ORDER, paceOf, type TablePace } from './pace';
import { tr } from '../i18n';

export type AiTable = TableConfig & { seated: number; level: string; minutes: number };

const PAGE = 5;
const LEVELS = ['Beginner', 'Casual', 'Intermediate', 'Advanced', 'Expert'];

interface Filters {
  q: string;
  game: string;
  region: string;
  level: string;
  pace: string;
  length: string;
  hints: string;
  seats: string;
}
const EMPTY: Filters = { q: '', game: '', region: '', level: '', pace: '', length: '', hints: '', seats: '' };
let filters: Filters = { ...EMPTY };
let shown = PAGE;
let moreOpen = false;

const info = (id: string) => VARIATIONS.find((v) => v.id === id) ?? VARIATIONS[0];

/** A UAE ruleset belongs to the UAE profile's region. */
function regionOf(variation: string): RegionId | undefined {
  const v = info(variation);
  return CATALOGUE.find((e) => e.variationId === (v.parent ?? variation))?.region;
}

function matches(t: AiTable, f: Filters): boolean {
  if (f.game && t.variation !== f.game) return false;
  if (f.region && regionOf(t.variation) !== f.region) return false;
  if (f.level && t.level !== f.level) return false;
  if (f.pace && paceOf(t) !== f.pace) return false;
  if (f.length && t.length !== f.length) return false;
  if (f.hints && (t.hints ? 'on' : 'off') !== f.hints) return false;
  if (f.seats && String(seatsForVariation(t.variation)) !== f.seats) return false;
  const q = f.q.trim().toLowerCase();
  if (q) {
    const v = info(t.variation);
    const hay = [t.name, variationTitle(v), v.short, tr(v.region), tr(t.level), tr(GAME_LENGTHS[t.length].label)].join(' ').toLowerCase();
    if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

/** The AI tables, searchable and filterable. */
export function tableFinder(tables: AiTable[], join: (t: AiTable) => void): HTMLElement {
  const games = [...new Set(tables.map((t) => t.variation))];
  const regions = REGIONS.filter((r) => tables.some((t) => regionOf(t.variation) === r.id));
  const lengths = (Object.keys(GAME_LENGTHS) as GameLength[]).filter((l) => tables.some((t) => t.length === l));
  const paces = PACE_ORDER.filter((p) => tables.some((t) => paceOf(t) === p));

  const count = h('span', { class: 'tf-count' });
  const list = h('div', { class: 'tables tf-list', role: 'list' });
  const chips = h('div', { class: 'tf-chips' });
  const selects: Partial<Record<keyof Filters, HTMLSelectElement>> = {};

  const select = (key: keyof Filters, label: string, all: string, options: [string, string][]) => {
    const s = h('select', { 'aria-label': label, class: 'tf-select' }, h('option', { value: '' }, all), ...options.map(([v, l]) => h('option', { value: v }, l))) as HTMLSelectElement;
    s.value = filters[key];
    s.onchange = () => set(key, s.value);
    selects[key] = s;
    return s;
  };

  const search = h('input', { type: 'search', class: 'tf-search-in', placeholder: tr('Search rooms…'), 'aria-label': tr('Search rooms'), value: filters.q, autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  search.oninput = () => set('q', search.value);

  const labelFor: Record<keyof Filters, (v: string) => string> = {
    q: (v) => `“${v}”`,
    game: (v) => info(v).short,
    region: (v) => REGIONS.find((r) => r.id === v)?.name ?? v,
    level: (v) => tr(v),
    pace: (v) => PACES[v as TablePace].label,
    length: (v) => tr(GAME_LENGTHS[v as GameLength].label),
    hints: (v) => (v === 'on' ? tr('JongBot on') : tr('JongBot off')),
    seats: (v) => (v === '3' ? tr('Three players') : tr('Four players')),
  };

  const set = (key: keyof Filters, value: string) => {
    filters = { ...filters, [key]: value };
    shown = PAGE;
    draw();
  };
  const clearAll = () => {
    filters = { ...EMPTY };
    search.value = '';
    for (const s of Object.values(selects)) s!.value = '';
    shown = PAGE;
    draw();
  };

  const row = (t: AiTable) => {
    const v = info(t.variation);
    const seats = seatsForVariation(t.variation);
    const pace = PACES[paceOf(t)].label;
    return h(
      'div',
      { class: 'table-row tf-row', role: 'listitem' },
      h('div', { class: 'tr-flag', 'aria-hidden': 'true' }, v.flag),
      h(
        'div',
        { class: 'tr-main' },
        h('div', { class: 'tr-name' }, t.name),
        h('div', { class: 'tr-meta' }, `${variationTitle(v)} · ${tr(GAME_LENGTHS[t.length].label)}`),
        h('div', { class: 'tr-sub' }, `${t.seated} / ${seats} · ${tr(t.level)} · ${pace} · ${tr('{n} min', { n: t.minutes })}`),
      ),
      h('div', { class: 'tr-seats', title: tr('AI players seated') }, h('span', { class: 'pips' }, ...Array.from({ length: seats }, (_, i) => h('i', { class: i < t.seated ? 'on' : '' }))), `${t.seated} / ${seats}`),
      h('div', { class: 'tr-level' }, tr(t.level)),
      h('div', { class: 'tr-time' }, h('span', {}, pace), h('span', { class: 'tf-min' }, tr('{n} min', { n: t.minutes }))),
      h('button', { class: 'btn sm', onclick: () => join(t) }, tr('Join')),
    );
  };

  const draw = () => {
    const hits = tables.filter((t) => matches(t, filters));
    count.textContent = tr('{n} available', { n: hits.length });
    clear(list).append(
      h('div', { class: 'tf-headrow', 'aria-hidden': 'true' }, h('span', {}), h('span', {}, tr('Room')), h('span', {}, tr('Players')), h('span', {}, tr('Level')), h('span', {}, tr('Pace / time')), h('span', { class: 'tf-join-h' }, tr('Join'))),
      ...hits.slice(0, shown).map(row),
    );
    if (!hits.length) list.append(h('div', { class: 'table-row empty' }, h('p', { class: 'muted' }, tr('No tables match these filters.'), ' ', h('button', { class: 'link', type: 'button', onclick: clearAll }, tr('Clear filters')))));
    if (hits.length > shown) {
      list.append(
        h(
          'div',
          { class: 'tf-more-row' },
          h('button', { class: 'btn sm ghost tf-more', type: 'button', onclick: () => ((shown += PAGE), draw()) }, tr('Show more tables'), h('span', { class: 'tf-left' }, `(${hits.length - shown})`), h('span', { html: icon('chevronDown') })),
        ),
      );
    }
    const active = (Object.keys(filters) as (keyof Filters)[]).filter((k) => filters[k]);
    clear(chips).append(
      ...active.map((k) =>
        h(
          'button',
          {
            type: 'button',
            class: 'tf-chip',
            'aria-label': tr('Remove filter {name}', { name: labelFor[k](filters[k]) }),
            onclick: () => {
              if (k === 'q') search.value = '';
              else selects[k]!.value = '';
              set(k, '');
            },
          },
          labelFor[k](filters[k]),
          h('span', { html: icon('close') }),
        ),
      ),
      active.length ? h('button', { type: 'button', class: 'link tf-clear', onclick: clearAll }, tr('Clear filters')) : '',
    );
    chips.hidden = !active.length;
    moreBtn.classList.toggle('on', ['length', 'hints', 'seats'].some((k) => filters[k as keyof Filters]));
  };

  const more = h(
    'div',
    { class: 'tf-more-filters', hidden: !moreOpen },
    select('length', tr('Match format'), tr('Any format'), lengths.map((l) => [l, tr(GAME_LENGTHS[l].label)])),
    select('hints', tr('JongBot hints'), tr('JongBot on or off'), [['on', tr('JongBot on')], ['off', tr('JongBot off')]]),
    select('seats', tr('Players'), tr('Three or four players'), [['4', tr('Four players')], ['3', tr('Three players')]]),
  );
  const moreBtn = h('button', { type: 'button', class: 'tf-more-btn', 'aria-expanded': String(moreOpen) }, h('span', { html: icon('sliders') }), tr('More filters'));
  moreBtn.onclick = () => {
    moreOpen = !moreOpen;
    more.hidden = !moreOpen;
    moreBtn.setAttribute('aria-expanded', String(moreOpen));
  };

  const bar = h(
    'div',
    { class: 'tf-bar' },
    h('label', { class: 'tf-search' }, h('span', { html: icon('search') }), search),
    select(
      'game',
      tr('Game'),
      tr('All games'),
      games.map((g) => [g, info(g).short]),
    ),
    select('region', tr('Region'), tr('All regions'), regions.map((r) => [r.id, r.name])),
    select('level', tr('Skill'), tr('Any skill'), LEVELS.filter((l) => tables.some((t) => t.level === l)).map((l) => [l, tr(l)])),
    select('pace', tr('Pace'), tr('Any pace'), paces.map((p) => [p, PACES[p].label])),
    moreBtn,
  );

  const sec = h(
    'section',
    { class: 'section tf', id: 'tables' },
    h('div', { class: 'section-head tf-head' }, h('h3', {}, tr('Find a table')), h('span', { class: 'tf-sub' }, tr('AI tables')), count),
    bar,
    more,
    chips,
    list,
  );
  draw();
  return sec;
}
