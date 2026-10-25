// World Tour: every playable variation as a destination, grouped by region,
// with search, region, play-style and sort, and a short list that grows with
// "More destinations". Driven by the variation registry, so new rulesets
// appear as they join the club.

import './worldTour.css';
import { CATALOGUE, REGIONS, STANDARDISATION, type RegionId, type Standardisation } from '../club/catalogue';
import { VARIATIONS, type VariationInfo } from '../engine/rules';
import type { AppCtx } from './ctx';
import { clear, h } from './dom';
import { icon } from './icons';
import { lessonFor, openVariationRules } from './versions';
import { tr, trn } from '../i18n';

const SHOWN = 8;
const LEVEL = { Beginner: 1, Intermediate: 2, Advanced: 3 } as const;
const tour = { q: '', region: '', style: '', sort: 'az' as 'az' | 'most' | 'least' | 'level', more: false };

/** A UAE ruleset belongs to the UAE profile's catalogue entry. */
const entryOf = (v: VariationInfo) => CATALOGUE.find((e) => e.variationId === (v.parent ?? v.id));
const regionOf = (v: VariationInfo): RegionId => entryOf(v)?.region ?? 'chinese';
const styleOf = (v: VariationInfo): Standardisation => entryOf(v)?.standardisation ?? 'regional';

export function worldTourScreen(ctx: AppCtx, explored: (id: string) => number, visit: (id: string) => void): HTMLElement {
  const places = VARIATIONS.filter((v) => v.profile);
  const p = ctx.profile;
  const visited = places.filter((v) => (p.variationGames[v.id] ?? 0) > 0).length;
  const title = (v: VariationInfo) => tr(v.ruleset && v.parent ? v.ruleset : v.name);

  const card = (v: VariationInfo) => {
    const pct = explored(v.id);
    const link = (label: string, run: () => void) => h('button', { type: 'button', class: 'wt-link', onclick: run }, label, h('span', { html: icon('arrowRight') }));
    return h(
      'article',
      { class: `wt-card ${pct >= 100 ? 'complete' : ''}` },
      h('p', { class: 'wt-place' }, h('span', { class: 'wt-flag', 'aria-hidden': 'true' }, v.flag), tr(v.region)),
      h('h4', { class: 'wt-name' }, title(v)),
      v.ruleset && !v.parent ? h('p', { class: 'wt-ruleset' }, tr(v.ruleset)) : null,
      h('p', { class: 'wt-blurb', title: tr(v.blurb) }, tr(v.blurb)),
      h('div', { class: 'wt-explored' }, h('span', {}, tr('{n}% explored', { n: pct })), h('div', { class: 'bar' }, h('i', { style: { width: `${pct}%` } }))),
      h(
        'div',
        { class: 'wt-actions' },
        h('button', { class: 'btn primary sm', onclick: () => visit(v.id) }, tr('Explore')),
        h('button', { class: 'btn sm', onclick: () => ctx.startMatch(ctx.tableFor(v.id)) }, h('span', { html: icon('play') }), tr('Play')),
      ),
      h('div', { class: 'wt-links' }, link(tr('Rules'), () => openVariationRules(ctx, v.id)), link(tr('Lessons'), () => ctx.openLesson(lessonFor(v.id)))),
    );
  };

  const results = h('div', { class: 'wt-results' });
  const moreRow = h('div', { class: 'wt-more' });
  const draw = () => {
    const q = tour.q.trim().toLowerCase();
    let list = places.filter(
      (v) =>
        (!tour.region || regionOf(v) === tour.region) &&
        (!tour.style || styleOf(v) === tour.style) &&
        (!q || `${title(v)} ${v.name} ${tr(v.region)} ${tr(v.blurb)}`.toLowerCase().includes(q)),
    );
    const cmp = {
      az: (a: VariationInfo, b: VariationInfo) => title(a).localeCompare(title(b)),
      most: (a: VariationInfo, b: VariationInfo) => explored(b.id) - explored(a.id),
      least: (a: VariationInfo, b: VariationInfo) => explored(a.id) - explored(b.id),
      level: (a: VariationInfo, b: VariationInfo) => LEVEL[a.level] - LEVEL[b.level],
    }[tour.sort];
    list = [...list].sort(cmp);
    const filtered = !!(q || tour.region || tour.style);
    const limit = tour.more || filtered ? list.length : SHOWN;
    // Regions in their usual order, the chosen sort inside each; the first `limit` destinations show.
    const order = REGIONS.map((r) => r.id);
    const keep = new Set([...list].sort((a, b) => order.indexOf(regionOf(a)) - order.indexOf(regionOf(b))).slice(0, limit));
    clear(results);
    for (const r of REGIONS) {
      const mine = list.filter((v) => keep.has(v) && regionOf(v) === r.id);
      if (!mine.length) continue;
      results.append(
        h(
          'section',
          { class: 'wt-region', 'aria-labelledby': `wt-r-${r.id}` },
          h('div', { class: 'wt-region-head' }, h('h3', { id: `wt-r-${r.id}` }, r.name), h('span', { class: 'wt-count' }, `(${list.filter((v) => regionOf(v) === r.id).length})`), h('span', { class: 'wt-rule', 'aria-hidden': 'true' })),
          h('div', { class: 'wt-grid' }, ...mine.map(card)),
        ),
      );
    }
    if (!list.length) results.append(h('p', { class: 'wt-empty' }, tr('No destinations match.')));
    clear(moreRow);
    if (list.length > limit) moreRow.append(h('button', { type: 'button', class: 'btn sm ghost', onclick: () => ((tour.more = true), draw()) }, tr('More destinations'), h('span', { class: 'tf-left' }, `(${list.length - limit})`), h('span', { html: icon('chevronDown') })));
  };

  const search = h('input', { type: 'search', class: 'wt-search-in', placeholder: tr('Search destinations…'), 'aria-label': tr('Search destinations'), value: tour.q, autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  search.oninput = () => ((tour.q = search.value), draw());
  const select = (ico: string, label: string, options: [string, string][], value: string, set: (v: string) => void) => {
    const s = h('select', { 'aria-label': label }, ...options.map(([v, l]) => h('option', { value: v, selected: v === value }, l))) as HTMLSelectElement;
    s.onchange = () => (set(s.value), draw());
    return h('label', { class: 'wt-select' }, h('span', { html: icon(ico) }), s);
  };
  const usedRegions = REGIONS.filter((r) => places.some((v) => regionOf(v) === r.id));
  const bar = h(
    'div',
    { class: 'wt-bar' },
    h('label', { class: 'wt-search' }, h('span', { html: icon('search') }), search),
    select('globe', tr('Region'), [['', tr('All regions')], ...usedRegions.map((r): [string, string] => [r.id, r.name])], tour.region, (v) => (tour.region = v)),
    select('tile', tr('Play style'), [['', tr('All play styles')], ...(['formal', 'regional', 'house'] as const).map((k): [string, string] => [k, STANDARDISATION[k].label])], tour.style, (v) => (tour.style = v)),
    select('sort', tr('Sort'), [['az', tr('Sort: A–Z')], ['most', tr('Most explored')], ['least', tr('Least explored')], ['level', tr('Easiest first')]], tour.sort, (v) => (tour.sort = v as typeof tour.sort)),
  );
  draw();

  return h(
    'div',
    { class: 'page wt' },
    h(
      'header',
      { class: 'page-head wt-head' },
      h(
        'div',
        { class: 'wt-head-text' },
        h('p', { class: 'eyebrow' }, tr('World Tour')),
        h('h2', {}, tr('Mahjong around the world')),
        h('p', { class: 'lede' }, trn(places.length, 'Explore {n} destination, each with its own rules, lesson, table, challenges and stamps.', 'Explore {n} destinations, each with its own rules, lesson, table, challenges and stamps.')),
      ),
      h('div', { class: 'wt-progress' }, h('span', {}, tr('{visited} / {total} explored', { visited, total: places.length })), h('div', { class: 'bar' }, h('i', { style: { width: `${(visited / Math.max(1, places.length)) * 100}%` } }))),
    ),
    bar,
    results,
    moreRow,
  );
}
