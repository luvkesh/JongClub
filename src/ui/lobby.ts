// Table setup in the Play lobby, compact, in the order a host decides things:
//   Rules          - the six core rule sets, a search, and "More rulesets" for
//                    the rest. Each card opens its Rules and Lessons. UAE / Dubai
//                    Rules shows its rulesets once chosen.
//   Settings bar   - game format, play style (Standard or Goulash) and AI level;
//                    scoring, table speed, coach mode, house rules and each seat's
//                    player wait under "More settings".
//   Your table     - a one-line summary of what will be played, then Play with AI,
//                    Host live table and Private table: hosting always uses the
//                    rules and settings above it.
// Rule set, format and mode are separate on purpose: any format goes with any
// rule set, and Goulash is a mode, never a rule set or a format.

import './lobby.css';
import { CATALOGUE, STANDARDISATION, UAE_PROFILE, entryFor, houseRuleGroup, HOUSE_RULE_GROUPS, isUaeRuleset, type CatalogueEntry } from '../club/catalogue';
import { AI_ONLY_LENGTHS, GAME_LENGTHS, type GameLength } from '../engine/rounds';
import { getProfile, VARIATIONS } from '../engine/rules';
import { GOULASH_SWITCH, supportsGoulash } from '../engine/rules/goulash';
import type { RuleProfile } from '../engine/rules/types';
import { clear, h } from './dom';
import { icon } from './icons';
import type { TableConfig } from './match';
import { placementField } from './placementUi';
import { tr } from '../i18n';
import { houseRuleTip } from './houseRuleTips';

export interface SetupDeps {
  cfg: TableConfig;
  /** A fresh table for a variation (its house-rule defaults and natural length). */
  tableFor(variation: string): TableConfig;
  /** Redraw with this config (after a rule set or mode change). */
  rerender(next: TableConfig): void;
  /** The AI level picker, shown in the settings bar. */
  aiLevel: HTMLElement;
  /** The app's other table fields, under More settings: table speed, coach mode. */
  tableFields: HTMLElement[];
  /** Fields behind "Advanced seat settings": each AI seat's player, JongBot hints. */
  seatFields: HTMLElement[];
  /** A variation's rules and its Academy lessons. */
  openRules(variation: string): void;
  openLesson(variation: string): void;
  onSubmit(): void;
  /** Open a live table with these settings (public, or private by code). */
  hostLive?: (isPrivate: boolean) => void;
}

const FORMAT_ORDER: GameLength[] = ['eastRound', 'eastSouth', 'fullNews', 'oneHand', 'timed', 'suddenDeath'];
const MAIN_FORMATS: GameLength[] = ['eastRound', 'eastSouth', 'fullNews', 'oneHand'];
const FORMAT_NAME: Partial<Record<GameLength, string>> = { eastRound: tr('East only'), eastSouth: tr('East–South'), fullNews: tr('E–S–W–N') };
/** The first rule sets on show; the rest sit under "More rulesets". */
// India first, then Chinese, Taiwanese and Riichi; everything after follows how widely each is played.
const FEATURED = ['india', 'classic', 'taiwanese', 'riichi', 'hongkong', 'american'];
const POPULARITY = ['mcr', 'sichuan', 'singapore', 'malaysian', 'sanma', 'riichi-tournament', 'korean', 'vietnamese', 'ema', 'uae', 'indian', 'filipino', 'guangdong', 'zung-jung', 'shanghai', 'beijing', 'wuhan', 'fujian', 'northeast', 'european', 'wright-patterson', 'thai', 'indonesian', 'malaysian3', 'korean3'];
const rank = (id: string) => (POPULARITY.includes(id) ? POPULARITY.indexOf(id) : POPULARITY.length);

/** Remember open panels and the search across redraws. */
let moreOpen = false;
let seatsOpen = false;
let settingsOpen = false;
let query = '';

/** The table setup form. */
export function tableSetup(d: SetupDeps): HTMLElement {
  const cfg = d.cfg;
  const profile = getProfile(cfg.variation)!;
  const current = entryFor(cfg.variation);
  const form = h('form', { class: 'table-setup', 'aria-label': tr('Set up a table'), 'data-tap-tips': '' });
  form.onsubmit = (e) => {
    e.preventDefault();
    d.onSubmit();
  };

  // Switching rule set brings that set's house rules and natural length, but keeps your table.
  const pick = (variation: string) => {
    if (variation === cfg.variation) return;
    const next = d.tableFor(variation);
    d.rerender({ ...cfg, variation, length: next.length, houseRules: next.houseRules });
  };

  // ---- 1. Choose your rules
  const playable = CATALOGUE.filter((e) => e.status === 'playable' && e.variationId);
  const featured = FEATURED.map((id) => playable.find((e) => e.id === id)!).filter(Boolean);
  const others = playable.filter((e) => !FEATURED.includes(e.id)).sort((a, b) => rank(a.id) - rank(b.id));

  const card = (e: CatalogueEntry) => {
    const on = current?.id === e.id;
    const isUae = e.id === UAE_PROFILE.id;
    const variation = isUae && on ? cfg.variation : e.variationId!;
    const ruleset = isUae && on ? UAE_PROFILE.rulesets.find((r) => r.variationId === cfg.variation) : null;
    const link = (cls: string, ico: string, label: string, run: () => void) =>
      h('button', { type: 'button', class: `ts-link ${cls}`, onclick: (ev: Event) => (ev.stopPropagation(), run()) }, h('span', { html: icon(ico) }), label);
    const el = h(
      'div',
      {
        class: `ts-rule ${on ? 'on' : ''}`,
        role: 'radio',
        tabindex: on ? '0' : '-1',
        'aria-checked': String(on),
        'aria-label': tr(e.name),
        title: STANDARDISATION[e.standardisation].label,
        'data-rule': e.id,
      },
      h('span', { class: 'ts-flag', 'aria-hidden': 'true' }, e.flag),
      h(
        'span',
        { class: 'ts-rule-body' },
        h('span', { class: 'ts-rule-name' }, tr(e.name)),
        ruleset ? h('span', { class: 'ts-ruleset' }, tr(ruleset.name)) : null,
        h('span', { class: 'ts-links' }, link('rules', 'book', tr('Rules'), () => d.openRules(variation)), link('lessons', 'lesson', tr('Lessons'), () => d.openLesson(variation))),
      ),
      h('span', { class: 'ts-radio', 'aria-hidden': 'true' }),
    );
    el.onclick = () => pick(variation);
    el.onkeydown = (ev: KeyboardEvent) => {
      if (ev.target !== el) return;
      if (ev.key === ' ' || ev.key === 'Enter') (ev.preventDefault(), pick(variation));
      const dir = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
      if (dir) {
        ev.preventDefault();
        const all = [...form.querySelectorAll<HTMLElement>('.ts-rule')].filter((x) => x.offsetParent);
        all[(all.indexOf(el) + dir + all.length) % all.length]?.focus();
      }
    };
    return el;
  };
  const grid = (entries: CatalogueEntry[]) => h('div', { class: 'ts-rules', role: 'radiogroup', 'aria-label': tr('Rule set') }, ...entries.map(card));

  const featuredGrid = grid(featured);
  const more = h('details', { class: 'ts-more ts-fold', open: moreOpen || others.some((e) => e.id === current?.id) }) as HTMLDetailsElement;
  more.ontoggle = () => (moreOpen = more.open);
  more.append(h('summary', {}, h('span', { html: icon('sliders') }), h('span', { class: 'ts-fold-t' }, tr('More rulesets')), h('span', { class: 'ts-fold-n' }, String(others.length)), h('span', { class: 'ts-chev', html: icon('chevronDown') })), grid(others));
  const results = h('div', { class: 'ts-results' });
  const search = h('input', { type: 'search', class: 'ts-search-in', placeholder: tr('Search rulesets…'), 'aria-label': tr('Search rulesets'), value: query, autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  const applySearch = () => {
    query = search.value;
    const q = query.trim().toLowerCase();
    const searching = !!q;
    featuredGrid.hidden = searching;
    more.hidden = searching;
    results.hidden = !searching;
    if (!searching) return;
    const hits = playable.filter((e) => {
      const v = VARIATIONS.find((x) => x.id === e.variationId);
      const hay = [e.name, tr(e.name), v?.short, v?.short && tr(v.short), v?.region && tr(v.region), v?.name, ...(e.id === 'uae' ? UAE_PROFILE.rulesets.map((r) => r.name) : [])].join(' ').toLowerCase();
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
    clear(results).append(hits.length ? grid(hits) : h('p', { class: 'ts-note' }, tr('No rule set matches “{q}”.', { q: query.trim() })));
  };
  search.oninput = applySearch;
  const searchBox = h('label', { class: 'ts-search' }, h('span', { html: icon('search') }), search);

  // UAE: the profile's rulesets, shown under the grid when UAE is chosen.
  const uaePanel = isUaeRuleset(cfg.variation)
    ? h(
        'div',
        { class: 'ts-uae', role: 'group', 'aria-label': tr('UAE / Dubai ruleset') },
        h('p', { class: 'ts-uae-note' }, h('strong', {}, `${UAE_PROFILE.name}. `), UAE_PROFILE.note),
        h(
          'div',
          { class: 'ts-uae-list' },
          ...UAE_PROFILE.rulesets.map((r) =>
            h(
              'button',
              { type: 'button', class: `ts-uae-opt ${r.variationId === cfg.variation ? 'on' : ''}`, 'aria-pressed': String(r.variationId === cfg.variation), title: r.detail, onclick: () => pick(r.variationId) },
              h('span', { class: 'ts-uae-name' }, r.name),
              h('span', { class: 'ts-uae-engine' }, r.engine),
            ),
          ),
        ),
      )
    : null;

  const step1 = h('section', { class: 'ts-step' }, h('div', { class: 'ts-step-head' }, h('h4', {}, tr('Rules')), searchBox), featuredGrid, results, more, uaePanel);
  applySearch();

  // ---- 2. One bar: format, play style and AI level; the rest under "More settings"
  // The four everyday formats as buttons; the AI-only ones (timed, sudden death) in a "More" picker beside them.
  const setLength = (len: GameLength) => {
    cfg.length = len;
    for (const x of fmtButtons) {
      const on = x.dataset.len === len;
      x.classList.toggle('on', on);
      x.setAttribute('aria-pressed', String(on));
    }
    fmtMore.value = MAIN_FORMATS.includes(len) ? '' : len;
    fmtMore.classList.toggle('on', !MAIN_FORMATS.includes(len));
    fmtNote.textContent = formatNote(len);
    liveOk();
    summarise();
  };
  const fmtButtons = MAIN_FORMATS.map((len) =>
    h('button', { type: 'button', 'data-len': len, class: len === cfg.length ? 'on' : '', 'aria-pressed': String(len === cfg.length), title: GAME_LENGTHS[len].detail, onclick: () => setLength(len) }, FORMAT_NAME[len] ?? tr(GAME_LENGTHS[len].label)),
  );
  const fmtMore = h(
    'select',
    { class: `ts-fmt-more ${MAIN_FORMATS.includes(cfg.length) ? '' : 'on'}`, 'aria-label': tr('More formats') },
    h('option', { value: '' }, tr('More…')),
    ...FORMAT_ORDER.filter((len) => !MAIN_FORMATS.includes(len)).map((len) => h('option', { value: len, selected: len === cfg.length }, tr(GAME_LENGTHS[len].label))),
  ) as HTMLSelectElement;
  fmtMore.onchange = () => fmtMore.value && setLength(fmtMore.value as GameLength);
  const players = profile.players === 3 ? ` ${tr('Three players')}: ${tr('East, South and West')}.` : '';
  const formatNote = (len: GameLength) =>
    (AI_ONLY_LENGTHS.includes(len) ? `${GAME_LENGTHS[len].detail}. ${tr('For AI tables only: live players can’t share one clock yet.')}` : GAME_LENGTHS[len].detail) + players;
  const fmtNote = h('p', { class: 'ts-note' }, formatNote(cfg.length));

  const goulashOk = supportsGoulash(profile);
  const goulashOn = goulashOk && (cfg.houseRules.goulash ?? profile.houseRules.find((r) => r.id === 'goulash')?.default) === 'on';
  const setMode = (on: boolean) => d.rerender({ ...cfg, houseRules: { ...cfg.houseRules, goulash: on ? 'on' : 'off' } });
  const modeNote = !goulashOk
    ? tr('Goulash is played with Chinese Classical, Hong Kong, the UAE / Dubai rulesets and American.')
    : goulashOn
      ? profile.card
        ? tr('After a wall game East stays, and jokers may be passed in the Charleston.')
        : tr('After a wall game East stays and a goulash is played. Its exchange, jokers, stakes and pot are under House rules.')
      : tr('A wall game passes the deal, or keeps it, as the house rules say.');
  const modeSeg = h(
    'div',
    { class: 'seg ts-modes', role: 'group', 'aria-label': tr('Mode'), title: modeNote },
    h('button', { type: 'button', class: goulashOn ? '' : 'on', 'aria-pressed': String(!goulashOn), onclick: () => goulashOn && setMode(false) }, tr('Standard')),
    h('button', { type: 'button', class: goulashOn ? 'on' : '', 'aria-pressed': String(goulashOn), disabled: !goulashOk, onclick: () => !goulashOn && setMode(true) }, tr('Goulash')),
  );

  const group = (ico: string, label: string, tip: string | null, ...body: (HTMLElement | null)[]) =>
    h('div', { class: 'ts-bar-g' }, h('span', { class: 'ts-bar-k', title: tip }, h('span', { html: icon(ico) }), label), ...body);
  const moreBody = h('div', { class: 'ts-more-body', id: 'ts-more-settings', hidden: !settingsOpen });
  const moreBtn = h(
    'button',
    { type: 'button', class: 'ts-bar-more', 'aria-expanded': String(settingsOpen), 'aria-controls': 'ts-more-settings' },
    h('span', { html: icon('sliders') }),
    h('span', { class: 'ts-bar-more-t' }, tr('More settings')),
    h('span', { class: 'ts-bar-more-d' }, tr('Scoring, table speed, coach mode, house rules and seats')),
    h('span', { class: 'ts-chev', html: icon('chevronDown') }),
  );
  moreBtn.onclick = () => {
    settingsOpen = !settingsOpen;
    moreBody.hidden = !settingsOpen;
    moreBtn.setAttribute('aria-expanded', String(settingsOpen));
  };
  const bar = h(
    'div',
    { class: 'ts-bar' },
    group('clock', tr('Game format'), tr('How long the match runs. Point at a format to see what it plays.'), h('div', { class: 'seg ts-formats', role: 'group', 'aria-label': tr('Match format') }, ...fmtButtons, fmtMore)),
    group('sliders', tr('Play style'), modeNote, modeSeg),
    // The AI level's own label is hidden in the bar, so its tip moves to the bar's label.
    group('robot', tr('AI level'), d.aiLevel.querySelector('span')?.getAttribute('title') ?? null, d.aiLevel),
  );

  const seats = h('details', { class: 'ts-seats ts-fold', open: seatsOpen }) as HTMLDetailsElement;
  seats.ontoggle = () => (seatsOpen = seats.open);
  seats.append(h('summary', {}, h('span', { html: icon('person') }), h('span', { class: 'ts-fold-t' }, tr('Advanced seat settings')), h('span', { class: 'ts-chev', html: icon('chevronDown') })), h('div', { class: 'ts-fields ts-seat-fields' }, ...d.seatFields));
  moreBody.append(
    h('div', { class: 'ts-fields ts-main-fields' }, h('div', { class: 'field ts-scoring-field' }, h('span', {}, tr('Scoring')), placementField(cfg.houseRules, profile.players)), ...d.tableFields),
    h('p', { class: 'ts-note' }, modeNote),
    houseRules(profile, cfg, goulashOn),
    seats,
  );
  const step2 = h('section', { class: 'ts-step ts-settings' }, bar, fmtNote, moreBtn, moreBody);

  // ---- The table you are about to play, and where to play it
  const summary = h('p', { class: 'ts-summary-t' });
  const summarise = () => {
    const v = VARIATIONS.find((x) => x.id === cfg.variation);
    const name = v?.parent && v.ruleset ? v.ruleset : (current?.name ?? v?.name ?? profile.name);
    const fmt = FORMAT_NAME[cfg.length] ?? tr(GAME_LENGTHS[cfg.length].label);
    clear(summary).append(h('span', { class: 'ts-sum-flag', 'aria-hidden': 'true' }, v?.flag ?? ''), h('strong', {}, name), ` · ${fmt} · ${goulashOn ? tr('Goulash') : tr('Standard')}`);
  };
  summarise();
  const liveBtns = d.hostLive
    ? [
        h('button', { class: 'btn', type: 'button', onclick: () => d.hostLive!(false) }, h('span', { html: icon('people') }), tr('Host live table')) as HTMLButtonElement,
        h('button', { class: 'btn ghost', type: 'button', onclick: () => d.hostLive!(true) }, h('span', { html: icon('lock') }), tr('Private table')) as HTMLButtonElement,
      ]
    : [];
  const liveOk = () => {
    const off = AI_ONLY_LENGTHS.includes(cfg.length);
    for (const b of liveBtns) {
      b.disabled = off;
      b.title = off ? tr('Timed matches are for AI tables only') : tr('Opens a live table with these rules and settings.');
    }
  };
  liveOk();
  form.addEventListener('change', summarise);
  const actions = h(
    'div',
    { class: 'ts-actions', id: 'ts-actions' },
    h('div', { class: 'ts-summary' }, h('span', { class: 'ts-k' }, d.hostLive ? tr('Your table, with AI players or live') : tr('Your table')), summary),
    h('div', { class: 'ts-act-btns' }, h('button', { class: 'btn primary', type: 'submit' }, h('span', { html: icon('robot') }), tr('Play with AI'), h('span', { html: icon('arrowRight') })), ...liveBtns),
  );

  form.append(step1, step2, actions);
  return form;
}

/** Keep the panel open across redraws once the host has opened it. */
let houseOpen = false;

/** The collapsed House rules panel: the rule set's own options, grouped by what they change. */
function houseRules(profile: RuleProfile, cfg: TableConfig, goulashOn: boolean): HTMLElement {
  const rules = profile.houseRules.filter((r) => r.id !== GOULASH_SWITCH.id && (goulashOn || !r.id.startsWith('goulash')));
  const changed = rules.filter((r) => cfg.houseRules[r.id] !== undefined && cfg.houseRules[r.id] !== r.default).length;
  const panel = h('details', { class: 'ts-house ts-fold', open: houseOpen }) as HTMLDetailsElement;
  panel.ontoggle = () => (houseOpen = panel.open);
  panel.append(
    h(
      'summary',
      {},
      h('span', { html: icon('sliders') }),
      h('span', { class: 'ts-fold-t' }, tr('House rules')),
      h('span', { class: 'ts-fold-n' }, rules.length ? (changed ? tr('{n} options, {changed} changed', { n: rules.length, changed }) : tr('{n} options', { n: rules.length })) : tr('none for this rule set')),
      h('span', { class: 'ts-chev', html: icon('chevronDown') }),
    ),
  );
  const body = h('div', { class: 'ts-house-body' });
  for (const g of HOUSE_RULE_GROUPS) {
    const mine = rules.filter((r) => houseRuleGroup(r.id) === g.id);
    if (!mine.length) continue;
    body.append(
      h(
        'fieldset',
        { class: 'ts-house-group' },
        h('legend', {}, g.name),
        ...mine.map((r) => {
          const id = `f-${r.id}`;
          const s = h('select', { id }) as HTMLSelectElement;
          const value = cfg.houseRules[r.id] ?? r.default;
          for (const o of r.options) s.append(h('option', { value: o.value, selected: o.value === value }, tr(o.label)));
          s.onchange = () => (cfg.houseRules[r.id] = s.value);
          return h('label', { class: 'field', for: id }, h('span', { title: houseRuleTip(r.id) }, tr(r.label)), s);
        }),
      ),
    );
  }
  if (!rules.length) body.append(h('p', { class: 'ts-note' }, tr('This rule set is played as written.')));
  panel.append(body);
  return panel;
}
