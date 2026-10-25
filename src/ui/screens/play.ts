// Play screen: start playing (Quick Play, Play with Friends, Join a Table), then
// choose your game (the set-up, whose action bar plays it with AI or hosts it
// live), the live and AI tables, and more ways to play.

import { DIFFICULTIES, PERSONALITIES, type Difficulty, type Personality } from '../../ai/players';
import { getProfile, seatsForVariation } from '../../engine/rules';
import { leagueOf } from '../../progression/profile';
import { loadTournament, openRanked } from '../compete';
import { clear, fmt, h } from '../dom';
import type { TableConfig } from '../match';
import { PACES, PACE_ORDER, paceOf, type TablePace } from '../pace';
import { hostTable, joinTable, liveSection } from '../live';
import { lastTable, tableSummary } from '../lastTable';
import './play.css';
import { luxCard, luxRow } from '../luxCard';
import { tableSetup } from '../lobby';
import { coachField } from '../coachMode';
import { tr } from '../../i18n';
import type { App } from '../app';
import { DEFAULT_TABLE, tableFor } from './tables';
import { tableFinder, type AiTable } from '../tableFinder';
import { icon } from '../icons';
import { lessonFor, openVariationRules } from '../versions';
import '../cards.css';
import '../../minigames/games';

const RIICHI_TABLE = tableFor('riichi');
const TAIWAN_TABLE = tableFor('taiwanese');
const AMERICAN_TABLE = tableFor('american');
const DUBAI_TABLE = tableFor('uae');

const OPEN_TABLES: AiTable[] = [
  { ...tableFor('india'), name: 'Bombay Gymkhana', seated: 3, level: 'Intermediate', minutes: 20 },
  { ...DEFAULT_TABLE, name: 'Jade Room', seated: 3, level: 'Casual', minutes: 12 },
  { ...RIICHI_TABLE, name: 'Tokyo Night Parlour', seated: 3, level: 'Intermediate', minutes: 35 },
  { ...TAIWAN_TABLE, name: 'Jade Palace Taipei', seated: 3, level: 'Advanced', minutes: 30 },
  { ...AMERICAN_TABLE, name: 'Manhattan Card Room', seated: 3, level: 'Intermediate', minutes: 25 },
  { ...DUBAI_TABLE, name: 'Marina Club', seated: 3, level: 'Casual', minutes: 15 },
  { ...TAIWAN_TABLE, name: 'Dubai Taiwanese Club', houseRules: { ...TAIWAN_TABLE.houseRules, scoring: 'dubai' }, seated: 3, level: 'Intermediate', minutes: 30 },
  { ...tableFor('vietnamese'), name: 'Saigon Lacquer Room', seated: 3, level: 'Intermediate', minutes: 20 },
  { ...tableFor('indian'), name: 'Calcutta Club', seated: 3, level: 'Intermediate', minutes: 22 },
  { ...tableFor('singapore'), name: 'Marina Bay Teahouse', seated: 3, level: 'Intermediate', minutes: 20 },
  { ...tableFor('hongkong'), name: 'Kowloon Harbour Room', seated: 3, level: 'Intermediate', minutes: 18 },
  { ...tableFor('mcr'), name: 'Beijing Championship Table', seated: 3, level: 'Advanced', minutes: 30 },
  { ...tableFor('sichuan'), name: 'Chengdu Teahouse', seated: 3, level: 'Intermediate', minutes: 14 },
  { ...tableFor('malaysian'), name: 'Penang Shophouse', seated: 3, level: 'Intermediate', minutes: 20 },
  { ...tableFor('uae-taiwanese'), name: 'Jumeirah Jade Room', seated: 3, level: 'Advanced', minutes: 30 },
  { ...tableFor('korean3'), name: 'Seoul Indigo Room', length: 'eastSouth', seated: 2, level: 'Intermediate', minutes: 16 },
  { ...RIICHI_TABLE, name: 'Shibuya Express', length: 'eastRound', difficulty: 'beginner', personalities: ['teacher', 'zen', 'wall'], seated: 3, level: 'Beginner', minutes: 18 },
  { ...DEFAULT_TABLE, name: 'The Lantern', difficulty: 'beginner', personalities: ['teacher', 'zen', 'wall'], length: 'oneHand', seated: 3, level: 'Beginner', minutes: 4 },
  { ...DEFAULT_TABLE, name: 'Night Owls', difficulty: 'strategic', personalities: ['shark', 'gambler', 'wall'], length: 'eastSouth', timer: 12, pace: 'competitive', seated: 3, level: 'Advanced', minutes: 28 },
  { ...DEFAULT_TABLE, name: 'Four Winds Salon', difficulty: 'expert', personalities: ['wall', 'shark', 'zen'], length: 'fullNews', hints: false, timer: 25, pace: 'standard', seated: 3, level: 'Expert', minutes: 55 },
];

export function playScreen(app: App) {
  const p = app.profile;
  const league = leagueOf(p.rating);
  const t = loadTournament();
  const host = app.liveHost();

  // ---- Start playing: the three things people come here for, as the game's premium cards.
  const last = lastTable();
  const sum = tableSummary(last);
  const quick = luxCard({ art: 'quick', title: tr('Quick Play'), line: tr('Your last table against AI: {flag} {rules} · {format}', { flag: sum.flag, rules: sum.rules, format: sum.format }), run: () => app.startMatch(lastTable()), featured: true });
  const friends = luxCard({ art: 'host', title: tr('Play with Friends'), line: app.club ? tr('Host the game you choose below, in public or by private code.') : tr('Opens on claude.ai, where friends can join.'), run: app.club ? () => focusActions(app) : null });
  const join = joinCard(app);

  // ---- More ways to play
  const ways = luxRow([
    luxCard({ art: 'daily', title: tr('Daily Hand'), line: tr('The same hand for everyone today, plus four more challenges.'), run: () => app.go('daily') }),
    luxCard({ art: 'mini', title: tr('Mini-games'), line: tr('Solitaire and more solo puzzles on your own table. Earn Jong Points.'), run: () => app.go('minigames') }),
    luxCard({ art: 'casual', title: tr('Casual'), line: app.club ? tr('Relaxed live tables with club members.') : tr('Relaxed games, no rating at stake.'), run: () => (app.club ? app.scrollToId('live') : app.startMatch({ ...tableFor('india'), name: tr('Casual Table'), difficulty: 'casual' }, { mode: 'casual' })) }),
    luxCard({ art: 'ranked', title: tr('Ranked'), line: `${league.icon} ${league.name} · ${fmt(p.rating)}. ${tr('Climb from Bronze to Master.')}`, run: () => openRanked(app.ctx()) }),
    luxCard({ art: 'tournament', title: tr('Tournaments'), line: t && !t.finished ? tr('{name} in progress.', { name: t.name }) : tr('Quick, daily and weekend events.'), run: () => app.go('tournaments') }),
  ]);

  const live = h('div', { id: 'live' });
  const renderLive = () => clear(live).append(liveSection(host, () => app.lastConfig, renderLive, { actions: false }));
  renderLive();

  const head = (ico: string, title: string, extra?: HTMLElement | null) => h('div', { class: 'pl-head' }, h('span', { class: 'pl-head-ico', html: icon(ico) }), h('h3', {}, title), extra ?? null);
  return h(
    'div',
    { class: 'page pl' },
    h('header', { class: 'page-head' }, h('p', { class: 'eyebrow' }, tr('Play')), h('h2', {}, tr('Play Mahjong')), h('p', { class: 'lede' }, tr('Choose your game once, then play it with AI players or host it for friends.'))),
    h('section', { class: 'pl-sec' }, head('play', tr('Start playing')), luxRow([quick, friends, join], 'pl-starts')),
    h('section', { class: 'pl-sec', id: 'create' }, head('tile', tr('Choose your game')), createForm(app)),
    live,
    tableFinder(OPEN_TABLES, (t) => app.startMatch(t)),
    h('section', { class: 'pl-sec' }, head('star', tr('More ways to play')), ways),
  );
}

/** Bring the set-up's action bar into view and give it a brief glow, so it's clear hosting uses those settings. */
export function focusActions(app: App) {
  app.scrollToId('create');
  const bar = document.getElementById('ts-actions');
  bar?.classList.remove('flash');
  void bar?.offsetWidth;
  bar?.classList.add('flash');
}

/** Join a Table: a table code and a go button in the card's foot. */
function joinCard(app: App): HTMLElement {
  const host = app.liveHost();
  const on = !!app.club;
  const input = h('input', { placeholder: on ? tr('Table code') : tr('Opens on claude.ai'), maxlength: '5', 'aria-label': tr('Table code'), autocapitalize: 'off', spellcheck: 'false', disabled: !on }) as HTMLInputElement;
  input.oninput = () => input.setCustomValidity('');
  const foot = h(
    'form',
    {
      class: 'lux-foot',
      onsubmit: (e: Event) => {
        e.preventDefault();
        const c = input.value.trim();
        if (!/^[a-z0-9]{5}$/i.test(c)) {
          input.setCustomValidity(tr('Codes are five letters or numbers.'));
          input.reportValidity();
          return;
        }
        input.setCustomValidity('');
        void joinTable(host, c.toLowerCase(), false);
      },
    },
    input,
    h('button', { type: 'submit', class: 'lux-go-btn', 'aria-label': tr('Join'), disabled: !on, html: icon('arrowRight') }),
  );
  return luxCard({ art: 'join', title: tr('Join a Table'), line: on ? tr('Enter their code and go to their table.') : tr('Opens on claude.ai, where friends can join.'), run: on ? () => input.focus() : null, foot });
}

function createForm(app: App): HTMLElement {
  const cfg: TableConfig = structuredClone(app.lastConfig);
  if (!getProfile(cfg.variation)) cfg.variation = 'classic';
  // `tip`: what the choice changes, on the label (hover, or a tap on touch screens).
  const sel = (id: string, label: string, options: [string, string][], value: string, onChange: (v: string) => void, tip?: string) => {
    const s = h('select', { id }) as HTMLSelectElement;
    for (const [v, l] of options) s.append(h('option', { value: v, selected: v === value }, l));
    s.onchange = () => onChange(s.value);
    return h('label', { class: 'field', for: id }, h('span', { title: tip ?? null }, label), s);
  };
  const listTip = (rows: { label: string; detail: string }[]) => rows.map((r) => `${r.label}: ${r.detail}`).join('\n');
  app.lastConfig = cfg;
  // Rule set, then format, then mode and house rules (lobby.ts); the table's own fields come last.
  const form = tableSetup({
    cfg,
    tableFor,
    rerender: (next) => {
      app.lastConfig = next;
      form.replaceWith(createForm(app));
    },
    aiLevel: sel('f-difficulty', tr('AI level'), Object.entries(DIFFICULTIES).map(([k, v]) => [k, v.label]), cfg.difficulty, (v) => (cfg.difficulty = v as Difficulty), listTip(Object.values(DIFFICULTIES))),
    tableFields: [paceField(cfg), coachField(cfg)],
    // One picker per AI seat: three at a four-seat table, two (right and left) at a three-seat one.
    seatFields: [
      ...(seatsForVariation(cfg.variation) === 3 ? [tr('Right seat'), tr('Left seat')] : [tr('Right seat'), tr('Across'), tr('Left seat')]).map((label, i) =>
        sel(`f-opp${i}`, label, Object.entries(PERSONALITIES).map(([k, v]) => [k, v.label]), cfg.personalities[i], (v) => (cfg.personalities[i] = v as Personality), listTip(Object.values(PERSONALITIES))),
      ),
      sel('f-hints', tr('JongBot hints'), [['on', tr('Allowed')], ['off', tr('Off')]], cfg.hints ? 'on' : 'off', (v) => (cfg.hints = v === 'on'), tr('Allowed: you can ask JongBot for advice at this table. Off: no JongBot, and the list of tiles you are waiting on is hidden too.')),
    ],
    openRules: (variation) => openVariationRules(app.ctx(), variation),
    openLesson: (variation) => app.ctx().openLesson(lessonFor(variation)),
    onSubmit: () => app.startMatch(cfg),
    hostLive: app.club ? (isPrivate) => void hostTable(app.liveHost(), cfg, isPrivate, false) : undefined,
  });
  return form;
}

/** Table speed for the create form: claim and turn time limits (pace.ts). */
function paceField(cfg: TableConfig): HTMLElement {
  const id = 'f-pace';
  const s = h('select', { id }) as HTMLSelectElement;
  const cur = paceOf(cfg);
  for (const p of PACE_ORDER) s.append(h('option', { value: p, selected: p === cur }, PACES[p].label));
  const note = h('small', { class: 'muted pace-note' }, PACES[cur].blurb);
  const set = (p: TablePace) => {
    cfg.pace = p;
    // The lobby and older clients read the turn time from `timer`.
    cfg.timer = PACES[p].turn;
    note.textContent = PACES[p].blurb;
  };
  set(cur);
  s.onchange = () => set(s.value as TablePace);
  return h('label', { class: 'field', for: id, title: tr('How long each player has to claim a discard and to play a turn. Untimed has no clock.') }, h('span', {}, tr('Table speed')), s, note);
}
