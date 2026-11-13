// Mini-games: the hub (a card per game, the daily puzzle, what you have
// earned today), the set-up sheet, and the hand-off to the play shell
// (src/minigames/play.ts) on your own table.

import { tr } from '../../i18n';
import { clear, fmt, h } from '../dom';
import { icon } from '../icons';
import { luxCard } from '../luxCard';
import '../cards.css';
import './minigames.css';
import '../../minigames/games';
import { miniGame, miniGames } from '../../minigames/registry';
import { cancelMiniIcons, requestMiniIcon } from '../../minigames/icons';
import { MiniPlay, levelName, type MiniApp } from '../../minigames/play';
import { Rng } from '../../engine/rng';
import { DAILY_PUZZLE_BONUS, MINI_DAILY_CAP, bestForGame, dailyResult, dailyStreak, earnedToday, highlightFree, loadMini, setSuggestAfter, suggestAfter, markSeen, miniDailySeed, seenHowTo, setHighlightFree } from '../../minigames/progress';
import type { MiniGameDef, MiniLevel } from '../../minigames/types';
import { fmtClock } from '../../minigames/helpers';
import { dayNumber, isoDay } from '../../club/util';

const PREFS_KEY = 'jongclub.minigames.prefs.v1';
type Prefs = Record<string, { level: MiniLevel; options: Record<string, string> }>;
const loadPrefs = (): Prefs => {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
};
const savePrefs = (p: Prefs) => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
};

/** The game behind today's daily puzzle: the daily games take turns, one per UTC day. */
export function dailyGame(date = new Date()): MiniGameDef | null {
  const pool = miniGames().filter((g) => g.daily);
  if (!pool.length) return null;
  return pool[dayNumber(isoDay(date)) % pool.length];
}

/** Today's daily puzzle settings: medium, with options picked from the day's seed. */
function dailyStart(def: MiniGameDef) {
  const seed = miniDailySeed(def.id);
  const rng = new Rng(seed ^ 0x5bd1e995);
  const options: Record<string, string> = {};
  for (const o of def.options ?? []) {
    const choices = o.choices.filter((c) => c.id !== 'random');
    options[o.id] = choices[rng.int(choices.length)].id;
  }
  const level: MiniLevel = def.levels.includes('medium') ? 'medium' : def.levels[0];
  return { level, options, seed, daily: true };
}

/** Small line icons for the hub (the shared set in ui/icons.ts has no coin, crown or clock). */
const GLYPH = {
  coin: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><path d="M12 9.5v5"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  crown: '<path d="M4 17.5h16M5 17.5 3.5 8l5 4 3.5-6.5 3.5 6.5 5-4-1.5 9.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  next: '<path d="m9.5 6 6 6-6 6"/>',
  shield: '<path d="M12 3.5 5 6v5.5c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
};
const glyph = (k: keyof typeof GLYPH, cls = '') => svgIco(GLYPH[k], cls);
const svgIco = (d: string, cls = '') =>
  `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;

/** A drawn icon for each hub filter, level and set-up choice, in the same line style as ui/icons.ts. */
const PICK: Record<string, string> = {
  // Hub filters.
  'filter:all': '<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>',
  'filter:solo': '<rect x="8" y="3.5" width="10.5" height="14" rx="1.6"/><path d="M5.5 7v11.5a2 2 0 0 0 2 2H15"/>',
  'filter:connect': '<circle cx="5.5" cy="18" r="2"/><circle cx="18.5" cy="6" r="2"/><path d="M5.5 16v-6.5h13V8"/>',
  'filter:3d': '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  'filter:match': '<rect x="3" y="5" width="7.5" height="11" rx="1.3"/><rect x="13.5" y="5" width="7.5" height="11" rx="1.3"/><path d="M6.75 19.5h10.5"/>',
  'filter:quest': '<path d="M5.5 21V3.5M5.5 4.5h12l-2.5 4 2.5 4h-12"/>',
  // Layouts.
  'layout:turtle': '<path d="M4 16a8 7 0 0 1 16 0z"/><path d="M9 16c0-3 1.3-5.6 3-7 1.7 1.4 3 4 3 7M20 14.5h1a1.6 1.6 0 0 0 0-3.2h-1.3M6.5 16l-1 3M17.5 16l1 3"/>',
  'layout:pyramid': '<path d="M3.5 20h17M5.5 20v-4h13v4M8 16v-4h8v4M10.5 12V8h3v4"/>',
  'layout:fortress': '<path d="M3.5 20.5V9h3v2.5h3V9h5v2.5h3V9h3v11.5z"/><path d="M10 20.5V16a2 2 0 0 1 4 0v4.5"/>',
  'layout:butterfly': '<path d="M12 7.5v11"/><path d="M12 10C10 5.5 4 3.5 4 8.5c0 2.5 2.5 4 8 4.5M12 10c2-4.5 8-6.5 8-1.5 0 2.5-2.5 4-8 4.5M12 13c-3.5.5-6 2-5.5 4.5S11 17.5 12 15M12 13c3.5.5 6 2 5.5 4.5S13 17.5 12 15"/>',
  'layout:peaks': '<path d="M2.5 19.5 8 9.5l3 5 3.5-7 7 12z"/>',
  'layout:garden': '<path d="M12 21v-9"/><path d="M12 12c0-4 3-6.5 7-6.5 0 4-3 6.5-7 6.5zM12 15c0-3-2.5-5-6-5 0 3 2.5 5 6 5z"/><path d="M7 21h10"/>',
  'layout:tower': '<path d="M12 2.5v2.5M8.5 7.5h7L18 10H6zM8.5 10v3h7v-3M7.5 13h9L19 15.5H5zM8 15.5v5h8v-5M6 20.5h12"/>',
  'layout:twin-towers': '<path d="M5 21V5h5v16M14 21V5h5v16M3.5 21h17M10 11h4M7.5 8.5v.01M7.5 12v.01M16.5 8.5v.01M16.5 12v.01"/>',
  'layout:random': '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.2"/><circle cx="15.5" cy="8.5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="8.5" cy="15.5" r="1.2"/><circle cx="15.5" cy="15.5" r="1.2"/>',
  // Cascade's fall (the board's own directions: never mirrored).
  'gravity:down': '<path d="M12 3.5v13M7 11.5l5 5 5-5M5 20.5h14"/>',
  'gravity:left': '<path d="M20.5 12h-13M12.5 7l-5 5 5 5M3.5 5v14"/>',
  // Dimensions' shapes.
  'shape:cube': '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  'shape:tower': '<path d="M7.5 21V6.5L12 4l4.5 2.5V21zM7.5 11h9M7.5 16h9"/>',
  'shape:steps': '<path d="M3.5 20.5h17v-16h-5.5v5.5H9.5v5.5h-6z"/>',
  // Highlight free tiles.
  'free:on': '<rect x="7" y="6" width="10" height="14" rx="1.6"/><path d="M12 1.8v1.7M4.2 5.2l1.2 1.2M19.8 5.2l-1.2 1.2M2.8 12h1.7M19.5 12h1.7"/>',
  'free:off': '<rect x="7" y="5" width="10" height="14" rx="1.6"/><path d="M4 20 20 4"/>',
  'off': '<circle cx="12" cy="12" r="8.5"/><path d="M6 18 18 6"/>',
};
/** A clock face with the share `f` of an hour-glass turn swept in. */
const pie = (f: number) => {
  const a = Math.min(f, 0.999) * 2 * Math.PI;
  const x = (12 + 8.5 * Math.sin(a)).toFixed(2),
    y = (12 - 8.5 * Math.cos(a)).toFixed(2);
  return `<circle cx="12" cy="12" r="8.5"/><path d="M12 12V3.5A8.5 8.5 0 ${f > 0.5 ? 1 : 0} 1 ${x} ${y}z" fill="currentColor" fill-opacity="0.32"/>`;
};
/** Rising bars: one, two or three lit for Easy, Medium and Hard. */
const bars = (n: number) => [6, 12, 18].map((x, i) => `<path d="M${x} 19.5V${16 - i * 4.5}" stroke-width="2.6"${i < n ? '' : ' stroke-opacity="0.3"'}/>`).join('');
const levelIcon = (l: MiniLevel) => svgIco(bars({ easy: 1, medium: 2, hard: 3 }[l]), 'pick-ico');
/** The icon for a set-up choice: by option and choice, a clock for times, else none. */
function choiceIcon(opt: string, id: string): string {
  const d = PICK[`${opt}:${id}`] ?? (opt === 'clock' && /^\d+$/.test(id) ? pie(Number(id) / 180) : '');
  return d ? svgIco(d, 'pick-ico') : '';
}


/** Hub filters: what kind of puzzle each game is. */
type MiniFilter = 'all' | 'solo' | 'connect' | '3d' | 'match' | 'quest';
const KIND: Record<string, MiniFilter[]> = {
  solitaire: ['solo'],
  tower: ['solo'],
  shuffle: ['solo'],
  timed: ['solo'],
  blitz: ['solo'],
  connect: ['connect'],
  cascade: ['connect'],
  slide: ['connect'],
  dimensions: ['3d'],
  triple: ['match'],
  match3: ['match'],
  memory: ['match'],
  colour: ['match'],
  chain: ['match'],
  rush: ['match'],
  hex: ['solo'],
  survival: ['solo'],
  treasure: ['quest'],
  boss: ['quest', 'connect'],
  dungeon: ['quest'],
};
type MiniSort = 'recommended' | 'az' | 'quick' | 'played';
/** The hub's search, filter and sort, kept while the app is open. */
const view: { q: string; filter: MiniFilter; sort: MiniSort } = { q: '', filter: 'all', sort: 'recommended' };
const minutesOf = (def: MiniGameDef) => Number(/\d+/.exec(def.minutes)?.[0] ?? 99);

export function minigamesScreen(app: MiniApp & { go(s: 'minigames'): void }): HTMLElement {
  const store = loadMini();
  const today = isoDay(new Date());
  const earned = Object.values(store.earned[today] ?? {}).reduce((a, b) => a + b, 0);
  const daily = dailyGame();
  const dres = dailyResult();
  const streak = dailyStreak();

  // The daily puzzle first, so its icon is drawn before the cards'.
  let dailyCard: HTMLElement | null = null;
  if (daily) {
    const dIcon = h('span', { class: 'mode-icon mini-daily-icon', 'aria-hidden': 'true' });
    requestMiniIcon(daily, (url) => {
      if (url) dIcon.style.backgroundImage = `url(${url})`;
    });
    const line = dres ? (dres.won ? tr('Solved in {time} with {n} points.', { time: fmtClock(dres.seconds), n: fmt(dres.score) }) : tr('Not solved yet. You can try again.')) : tr('Today: {game}. Everyone in the club gets the same board.', { game: daily.title });
    dailyCard = h(
      'section',
      // The whole card starts the puzzle, not just its button.
      { class: `mini-daily ${dres?.won ? 'done' : ''}`, onclick: (e: MouseEvent) => !(e.target as HTMLElement).closest('button') && play(app, daily, dailyStart(daily)) },
      h('span', { class: 'mini-medal mini-daily-medal' }, dIcon),
      h('div', { class: 'mini-daily-text' }, h('h3', {}, tr('Daily puzzle')), h('p', {}, line), streak ? h('p', { class: 'muted small' }, tr('Daily streak: {n}', { n: streak })) : null),
      h('span', { class: 'mini-daily-bonus' }, dres?.won ? tr('Solved') : tr('+{n} JP bonus', { n: DAILY_PUZZLE_BONUS })),
      h('button', { class: 'btn primary mini-daily-go', onclick: () => play(app, daily, dailyStart(daily)), html: `<span>${dres ? tr('Play again') : tr('Play today’s puzzle')}</span>${glyph('next')}` }),
    );
  }

  // One card per game; the grid shows those the search and filter let through, in the chosen order.
  const cardOf = new Map<string, HTMLElement>();
  for (const def of miniGames()) {
    const best = bestForGame(def.id);
    const got = earnedToday(def.id);
    const iconEl = h('span', { class: 'mode-icon', 'aria-hidden': 'true' });
    // The shared premium card (luxCard), with the game's own animated 3D model as its picture,
    // and a foot with the time, today's Jong Points and the arrow.
    const card = luxCard({
      art: 'mini',
      title: def.title,
      line: def.blurb,
      label: def.title,
      run: () => openSetup(app, def),
      foot: h(
        'span',
        { class: 'mini-lux-foot' },
        h(
          'span',
          { class: 'mini-meta' },
          h(
            'span',
            { html: glyph('clock') + `<span>${def.minutes}</span>` },
            best?.score ? h('span', { class: 'mini-best-n' }, tr('Best {n}', { n: fmt(best.score) })) : best?.wins ? h('span', { class: 'mini-best-n' }, tr('Won {n}', { n: best.wins })) : null,
          ),
          h('span', { class: got >= MINI_DAILY_CAP ? 'full' : '', html: `<span class="mini-coin" aria-hidden="true"></span><span>${fmt(got)} / ${fmt(MINI_DAILY_CAP)} JP</span>` }),
        ),
        h('span', { class: 'lux-go', 'aria-hidden': 'true', html: icon('arrowRight') }),
      ),
    });
    card.classList.add('mini-card');
    card.querySelector('.lux-art')?.replaceChildren(h('span', { class: 'mini-medal' }, iconEl));
    cardOf.set(def.id, card);
    // Icons are drawn one by one in idle time after the page shows, so the hub opens at once.
    requestMiniIcon(def, (url) => {
      if (url) iconEl.style.backgroundImage = `url(${url})`;
    });
  }

  const cards = h('div', { class: 'mini-cards' });
  const empty = h('p', { class: 'muted mini-empty', hidden: true }, tr('No game matches that search.'));
  const draw = () => {
    const q = view.q.trim().toLowerCase();
    let list = miniGames().filter((d) => (view.filter === 'all' || KIND[d.id]?.includes(view.filter)) && (!q || `${d.title} ${d.blurb}`.toLowerCase().includes(q)));
    if (view.sort === 'az') list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    else if (view.sort === 'quick') list = [...list].sort((a, b) => minutesOf(a) - minutesOf(b));
    else if (view.sort === 'played') list = [...list].sort((a, b) => (bestForGame(b.id)?.plays ?? 0) - (bestForGame(a.id)?.plays ?? 0));
    cards.replaceChildren(...list.map((d) => cardOf.get(d.id)!));
    empty.hidden = list.length > 0;
  };

  const search = h('input', { type: 'search', class: 'mini-search-input', placeholder: tr('Find a game'), 'aria-label': tr('Find a game'), value: view.q }) as HTMLInputElement;
  search.oninput = () => ((view.q = search.value), draw());
  const filters: { id: MiniFilter; label: string }[] = [
    { id: 'all', label: tr('All games') },
    { id: 'solo', label: tr('Solo') },
    { id: 'connect', label: tr('Connect') },
    { id: '3d', label: tr('3D') },
    { id: 'match', label: tr('Match') },
    { id: 'quest', label: tr('Quests') },
  ];
  const chips = h('div', { class: 'mini-chips', role: 'group', 'aria-label': tr('Filter') });
  const drawChips = () =>
    chips.replaceChildren(
      ...filters.map((f) =>
        h(
          'button',
          { type: 'button', class: `mini-chip ${view.filter === f.id ? 'on' : ''}`, 'aria-pressed': String(view.filter === f.id), onclick: () => ((view.filter = f.id), drawChips(), draw()) },
          h('span', { class: 'mini-chip-ico', html: svgIco(PICK[`filter:${f.id}`]) }),
          h('span', {}, f.label),
        ),
      ),
    );
  drawChips();
  const sort = h('select', { class: 'mini-sort-select', 'aria-label': tr('Sort by') }) as HTMLSelectElement;
  for (const [id, label] of [
    ['recommended', tr('Recommended')],
    ['az', tr('A to Z')],
    ['quick', tr('Quickest')],
    ['played', tr('Most played')],
  ] as const)
    sort.append(h('option', { value: id, selected: view.sort === id }, label));
  sort.onchange = () => ((view.sort = sort.value as MiniSort), draw());
  draw();

  const stat = (g: keyof typeof GLYPH, k: string, v: string) => h('div', { class: 'mini-stat-cell' }, h('span', { class: `mini-stat-ico ico-${g}`, html: g === 'coin' ? glyph('star') : glyph(g) }), h('span', { class: 'mini-stat-txt' }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, v)));

  return h(
    'div',
    { class: 'page mini-hub' },
    h('header', { class: 'page-head mini-head' }, h('p', { class: 'eyebrow' }, tr('Mini-games')), h('h2', {}, tr('Puzzles at your own table')), h('p', { class: 'lede' }, tr('Solo games with your tiles, table and room. They earn Jong Points for the Atelier and never touch your rating.'))),
    h('div', { class: 'mini-summary' }, stat('coin', tr('Jong Points'), fmt(app.profile.jongPoints)), stat('crown', tr('Earned today'), fmt(earned)), stat('crown', tr('Earned in all'), fmt(store.totalEarned))),
    dailyCard,
    h(
      'section',
      { class: 'section mini-games' },
      h(
        'div',
        { class: 'mini-bar' },
        h('h3', {}, tr('Games')),
        h('label', { class: 'mini-search', html: icon('search') }, search),
        chips,
        h('label', { class: 'mini-sort', html: glyph('star') }, sort),
      ),
      cards,
      empty,
      h('p', { class: 'muted small mini-cap', html: glyph('shield') }, tr('Each game pays up to {n} Jong Points a day.', { n: fmt(MINI_DAILY_CAP) })),
    ),
  );
}

/** The set-up sheet: level, the game's options, how to play, and Play. */
export function openSetup(app: MiniApp, def: MiniGameDef) {
  const prefs = loadPrefs();
  const pref = prefs[def.id];
  let level: MiniLevel = pref && def.levels.includes(pref.level) ? pref.level : def.levels.includes('medium') ? 'medium' : def.levels[0];
  const options: Record<string, string> = {};
  for (const o of def.options ?? []) options[o.id] = pref?.options[o.id] && o.choices.some((c) => c.id === pref.options[o.id]) ? pref.options[o.id] : o.initial;
  const o = app.modal;
  // Each choice is a button with a drawn icon over (or before) its name; many choices make a grid.
  const seg = (label: string, items: { id: string; label: string; icon: string }[], value: () => string, set: (v: string) => void) => {
    const el = h('div', { class: `seg mini-seg${items.length > 4 ? ' mini-seg-grid' : ''}`, role: 'group', 'aria-label': label });
    const draw = () => {
      clear(el);
      for (const it of items)
        el.append(
          h(
            'button',
            { type: 'button', class: it.id === value() ? 'on' : '', 'aria-pressed': it.id === value() ? 'true' : 'false', onclick: () => (set(it.id), draw()) },
            it.icon ? h('span', { class: 'mini-seg-ico', html: it.icon }) : null,
            h('span', { class: 'mini-seg-t' }, it.label),
          ),
        );
    };
    draw();
    return el;
  };
  const fields: HTMLElement[] = [];
  if (def.levels.length > 1)
    fields.push(
      h(
        'div',
        { class: 'field' },
        h('span', {}, tr('Level')),
        seg(tr('Level'), def.levels.map((l) => ({ id: l, label: levelName(l), icon: levelIcon(l) })), () => level, (v) => (level = v as MiniLevel)),
      ),
    );
  for (const opt of def.options ?? [])
    fields.push(
      h(
        'div',
        { class: 'field' },
        h('span', {}, opt.label),
        seg(opt.label, opt.choices.map((c) => ({ ...c, icon: choiceIcon(opt.id, c.id) })), () => options[opt.id], (v) => (options[opt.id] = v)),
      ),
    );
  if (def.layered) {
    let hl = highlightFree();
    fields.push(
      h(
        'div',
        { class: 'field' },
        h('span', { title: tr('Free tiles get a gold edge; blocked tiles are shaded.') }, tr('Highlight free tiles')),
        seg(
          tr('Highlight free tiles'),
          [
            { id: 'on', label: tr('On'), icon: choiceIcon('free', 'on') },
            { id: 'off', label: tr('Off'), icon: choiceIcon('free', 'off') },
          ],
          () => (hl ? 'on' : 'off'),
          (v) => setHighlightFree((hl = v === 'on')),
        ),
      ),
    );
  }
  if (def.pauseHints !== false) {
    let after = suggestAfter();
    fields.push(
      h(
        'div',
        { class: 'field' },
        h('span', {}, tr('Suggest a move when I pause')),
        seg(
          tr('Suggest a move when I pause'),
          [
            { id: '0', label: tr('Off'), icon: svgIco(PICK.off, 'pick-ico') },
            { id: '5', label: tr('{n} s', { n: 5 }), icon: svgIco(pie(0.5), 'pick-ico') },
            { id: '10', label: tr('{n} s', { n: 10 }), icon: svgIco(pie(1), 'pick-ico') },
          ],
          () => String(after),
          (v) => setSuggestAfter((after = Number(v))),
        ),
      ),
    );
  }
  const best = bestForGame(def.id);
  o.replaceChildren(
    h(
      'div',
      { class: 'card mini-sheet' },
      h('p', { class: 'eyebrow' }, tr('Mini-game')),
      h('h3', {}, def.title),
      h('p', { class: 'muted' }, def.blurb),
      h('ol', { class: 'mini-howto' }, ...def.howTo.map((l) => h('li', {}, l))),
      ...fields,
      best?.plays ? h('p', { class: 'muted small' }, tr('Played {n} · Won {w}', { n: best.plays, w: best.wins }) + (best.seconds ? ` · ${tr('Fastest {time}', { time: fmtClock(best.seconds) })}` : '')) : null,
      h('p', { class: 'muted small' }, tr('{n} of {cap} Jong Points earned from this game today.', { n: fmt(earnedToday(def.id)), cap: fmt(MINI_DAILY_CAP) })),
      h(
        'div',
        { class: 'btn-row' },
        h('button', { class: 'btn ghost', onclick: () => (o.hidden = true) }, tr('Cancel')),
        h(
          'button',
          {
            class: 'btn primary',
            onclick: () => {
              prefs[def.id] = { level, options };
              savePrefs(prefs);
              o.hidden = true;
              play(app, def, { level, options });
            },
          },
          tr('Play'),
        ),
      ),
    ),
  );
  o.hidden = false;
}

let current: MiniPlay | null = null;

/** Start a mini-game on the table. */
export function play(app: MiniApp, def: MiniGameDef, start: { level: MiniLevel; options: Record<string, string>; seed?: number; daily?: boolean }) {
  current?.dispose();
  // The hub's icons wait: the game gets the device to itself.
  cancelMiniIcons();
  app.modal.hidden = true;
  current = new MiniPlay(app, def, start);
  const run = current;
  const back = app.backToHub;
  app.backToHub = () => {
    if (current === run) current = null;
    app.backToHub = back;
    back();
  };
  run.run();
  // Headless tests drive the game in play through this.
  (window as unknown as { jongMini?: MiniPlay }).jongMini = run;
  if (!seenHowTo(def.id)) {
    markSeen(def.id);
    window.setTimeout(() => current === run && run.showHelp(), 600);
  }
}

/** Open a game by id (links and tests). */
export function playById(app: MiniApp, id: string) {
  const def = miniGame(id);
  if (def) openSetup(app, def);
}

/** The game in play, if any (tests and the app shell). */
export const currentMini = () => current;
