// Settings: the dialog, Mei's voice and the stored settings.

import { applyVolumes, setMusicOff } from '../musicToggle';
import { callers } from '../../audio/callers';
import { RECORDED, narrator } from '../../audio/voice';
import { clearFaceCache } from '../../render/tileFaces';
import { clear, h } from '../dom';
import type { Settings } from '../match';
import { etiquetteField } from '../etiquette';
import { remindersField } from '../reminders';
import { settingsExtras, type DevHost } from '../../dev/panel';
import './settings.css';
import { dev, saveDev } from '../../dev/devMode';
import { DEFAULT_TABLE } from './tables';
import { accessibilityRows } from '../accessibility';
import { installField } from '../../pwa/installField';
import { tr } from '../../i18n';
import { icon } from '../icons';
import { languageField } from '../../i18n/languageField';
import type { App } from '../app';

const SETTINGS_KEY = 'jongclub.settings.v1';

export interface StoredSettings extends Settings {
  volumes: { effects: number; music: number; ambient: number };
  /** The music button (musicToggle.ts) switched the background music off. */
  musicOff?: boolean;
}

export function loadSettings(): StoredSettings {
  const d: StoredSettings = { speed: 'classic', hintDepth: 'beginner', labels: true, sort: 'suit', groupSets: false, volumes: { effects: 0.8, music: 0.25, ambient: 0.35 } };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...d, ...JSON.parse(raw) };
  } catch {
    /* defaults */
  }
  return d;
}

export function showSettings(app: App) {
  const s = app.settings;
  const o = app.modal;
  clear(o).hidden = false;
  // `tips`: what each option changes, shown on hover (or a tap on touch screens).
  const seg = <T extends string>(id: string, label: string, opts: [T, string][], value: T, set: (v: T) => void, tips?: Partial<Record<T, string>>) => {
    const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    for (const [v, l] of opts) {
      const b = h('button', { class: v === value ? 'on' : '', role: 'radio', 'aria-checked': String(v === value), id: `${id}-${v}`, title: tips?.[v] ?? null }, l);
      b.onclick = () => {
        set(v);
        wrap.querySelectorAll('button').forEach((x) => {
          x.classList.toggle('on', x === b);
          x.setAttribute('aria-checked', String(x === b));
        });
        persistSettings(app);
      };
      wrap.append(b);
    }
    return h('div', { class: 'field' }, h('span', {}, label), wrap);
  };
  const tip = (el: HTMLElement, text: string) => {
    el.querySelector('span')?.setAttribute('title', text);
    return el;
  };
  const slider = (key: 'effects' | 'music' | 'ambient', label: string) => {
    const r = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(s.volumes[key]), id: `vol-${key}` }) as HTMLInputElement;
    r.oninput = () => {
      s.volumes[key] = Number(r.value);
      // Raising the music or ambient slider while the music button has them off turns them back on.
      if ((key === 'music' || key === 'ambient') && s.musicOff && s.volumes[key] > 0) setMusicOff(s, false, () => {});
      applyVolumes(s);
      persistSettings(app);
    };
    return h('label', { class: 'field', for: `vol-${key}` }, h('span', { title: SLIDER_TIPS[key]() }, label), r);
  };
  const labels = tip(
    seg(
      'labels',
      tr('Tile corner labels'),
      [['on', tr('Show')], ['off', tr('Hide')]],
      s.labels ? 'on' : 'off',
      (v) => {
        s.labels = v === 'on';
        app.table.labels = s.labels;
        clearFaceCache();
        app.table.refreshFaces();
      },
      { on: tr('A small number or letter in each tile’s corner, in the suit’s colour: 1 to 9, E S W N for the winds, R G W for the dragons.'), off: tr('Plain traditional faces with no corner label. Suit-marked tiles, under Accessibility, still add their own corner index.') },
    ),
    tr('The small index in the top corner of every tile face, on the table and in your hand.'),
  );
  const a11y = accessibilityRows(seg, { refreshFaces: () => app.table.refreshFaces(), relayout: () => app.table.relayout() }).filter((el) => el.tagName !== 'H4');
  const sub = (title: string, ...rows: (HTMLElement | string | null)[]) => h('section', { class: 'set-sub' }, title ? h('h4', { class: 'set-sub-h' }, title) : '', ...rows);
  const cats: Category[] = [
    {
      id: 'general',
      icon: 'sliders',
      name: tr('General'),
      note: tr('Language and animations'),
      body: () => [
        sub(
          '',
          tip(languageField(() => !!app.match || !!app.replay), tr('Changes every menu, button and message. Lessons and Mei’s voice stay in English. The club reloads to switch; at a table, the change waits until you leave.')),
          tip(
            seg('anim', tr('Animations'), [['minimal', tr('Minimal')], ['classic', tr('Classic')], ['cinematic', tr('Cinematic')]], s.speed, (v) => ((s.speed = v), (app.table.speed = v)), {
              minimal: tr('Fastest. Tiles snap into place, players barely pause, and the shuffle machine, rolling dice, win sparkle and camera moves are left out.'),
              classic: tr('The standard pace. Tiles glide, the table shuffles and rolls the dice, and a win gets a gold sweep and a camera push.'),
              cinematic: tr('Slowest and most dramatic. Tiles glide almost twice as slowly, players and the table take their time, and a win stays on screen longer with a longer camera shot.'),
            }),
            tr('How lively the table is: how tiles move, how long players pause, and the shuffle, dice and win effects.'),
          ),
        ),
      ],
    },
    {
      id: 'table',
      icon: 'tile',
      name: tr('Table and tiles'),
      note: tr('Your hand and the tile faces'),
      body: () => [
        sub(
          tr('Your hand'),
          tip(
            seg(
              'sort',
              tr('Sort my hand'),
              [['suit', tr('By suit')], ['number', tr('By number')]],
              s.sort,
              (v) => {
                s.sort = v;
                app.table.sortMode = v;
              },
              { suit: tr('Characters, then Dots, then Bamboo, each from 1 to 9, then the winds and dragons.'), number: tr('All the 1s together, then all the 2s and so on, with the winds and dragons after.') },
            ),
            tr('The order of the tiles in your hand. Flowers and jokers always sit at the end.'),
          ),
          tip(
            seg('autodraw', tr('Drawing tiles'), [['off', tr('I tap Draw')], ['on', tr('Auto-draw')]], s.autoDraw ? 'on' : 'off', (v) => (s.autoDraw = v === 'on'), {
              off: tr('A Draw button waits on your turn, and you take the tile yourself.'),
              on: tr('Your tile is drawn for you as soon as your turn starts.'),
            }),
            tr('Take each tile from the wall yourself on your turn, or let the table draw it for you. You can also switch this at the table.'),
          ),
          tip(
            seg('groupsets', tr('Group complete sets'), [['on', tr('Group')], ['off', tr('Off')]], s.groupSets ? 'on' : 'off', (v) => (s.groupSets = v === 'on'), {
              on: tr('Finished sets move to the left of your hand, with a gap after each.'),
              off: tr('Your hand stays in one sorted line.'),
            }),
            tr('Pull finished sets to the left of your hand, spaced apart, so the loose tiles stand out.'),
          ),
        ),
        sub(
          tr('Discards'),
          tip(
            seg('discards', tr('Discard layout'), [['auto', tr('By variation')], ['rows', tr('Rows')], ['pond', tr('Pond')], ['centre', tr('Centre board')]], s.discardLayout ?? 'auto', (v) => {
              s.discardLayout = v;
              app.table.discardSetting = v;
            }, {
              auto: tr('Each game’s own layout: Pond for Riichi, Rows for Chinese and other Asian games, the Centre board for American.'),
              rows: tr('Each player’s discards in rows in front of them. A claimed tile leaves the rows.'),
              pond: tr('Riichi style: discards stay in order in front of each player, and a claimed tile stays as a faded print with an arrow to who took it.'),
              centre: tr('One shared board in the middle, with a place and a count for every tile, and the latest discard in a spotlight.'),
            }),
            tr('By variation lays discards out the way each game is really played: a Pond for Riichi, Rows for Chinese and Asian games, one Centre board for American tables.'),
          ),
        ),
        sub(tr('Tile faces'), labels),
      ],
    },
    {
      id: 'help',
      icon: 'robot',
      name: tr('Help and hints'),
      note: tr('JongBot, waits and matching tiles'),
      body: () => [
        sub(
          '',
          tip(
            seg('depth', tr('JongBot help'), [['beginner', tr('What should I do?')], ['learning', tr('Why?')], ['advanced', tr('Analyse my hand')]], s.hintDepth, (v) => (s.hintDepth = v), {
              beginner: tr('Just the advice, in one line. Tap Show me why for the reason.'),
              learning: tr('The advice and the reasoning behind it.'),
              advanced: tr('The advice, the reasoning and a table of your best discards: how close each leaves you, how many tiles help, and the risk.'),
            }),
            tr('How much JongBot says when it gives advice. You can also switch this in JongBot’s panel at the table.'),
          ),
        ),
        sub(
          tr('At the table'),
          tip(
            seg('matchhl', tr('Mark tiles matching a discard'), [['on', tr('On')], ['off', tr('Off')]], s.matchHighlight !== false ? 'on' : 'off', (v) => (s.matchHighlight = v === 'on')),
            tr('When someone discards, the same tiles in your hand get a soft jade glow, so a Pung or Kong is easy to spot.'),
          ),
          tip(
            seg('waits', tr('Show the tiles I am waiting on'), [['on', tr('On')], ['off', tr('Off')]], s.showWaits !== false ? 'on' : 'off', (v) => (s.showWaits = v === 'on')),
            tr('When you are one tile from winning, list the tiles that complete your hand and how many are still unseen. Hidden at tables with JongBot off.'),
          ),
        ),
      ],
    },
    {
      id: 'sound',
      icon: 'speaker',
      name: tr('Sound and voice'),
      note: tr('Volume, tile calls and spoken help'),
      body: () => [
        sub(
          tr('Volume'),
          tip(
            seg('music-on', tr('Background music'), [['on', tr('On')], ['off', tr('Off')]], s.musicOff ? 'off' : 'on', (v) => setMusicOff(s, v === 'off', () => {})),
            tr('Switches the music and the room’s ambient sound together. Tile sounds, player calls and Mei are not affected.'),
          ),
          slider('music', tr('Music')),
          slider('effects', tr('Effects')),
          slider('ambient', tr('Ambient')),
        ),
        sub(
          tr('Voices'),
          tip(
            seg('tilecalls', tr('Tile calls (players announce discards)'), [['on', tr('On')], ['off', tr('Off')]], callers.enabled ? 'on' : 'off', (v) => {
              callers.setEnabled(v === 'on');
              if (v === 'on') callers.say(0, 'Mahjong');
            }),
            tr('Each player has their own voice and calls out every tile they discard, and every claim.'),
          ),
          tip(
            seg('speakall', tr('Speak all content'), [['on', tr('On')], ['off', tr('Off')]], narrator.speakAll ? 'on' : 'off', (v) => {
              narrator.setSpeakAll(v === 'on');
              if (v === 'on') {
                if (!narrator.enabled) narrator.setEnabled(true);
                void narrator.say('I will read out hints, prompts and results.');
              }
            }),
            tr('Reads JongBot hints, what to do on your turn and each hand result aloud.'),
          ),
          voiceField(),
        ),
      ],
    },
    {
      id: 'social',
      icon: 'people',
      name: tr('Social and reminders'),
      note: tr('Table phrases and notifications'),
      // Table phrases and reminders (src/ui/etiquette.ts, src/ui/reminders.ts).
      body: () => [sub(tr('At the table'), etiquetteField()), sub(tr('Reminders'), remindersField())],
    },
    {
      id: 'access',
      icon: 'eye',
      name: tr('Accessibility'),
      note: tr('Tile marks, contrast, size and motion'),
      body: () => [sub(tr('Tiles'), ...a11y.slice(0, 4)), sub(tr('Comfort'), ...a11y.slice(4))],
    },
    {
      id: 'account',
      icon: 'person',
      name: tr('Account and app'),
      note: tr('Sign-in, install and version'),
      // Account, Labs, and the version line that brings Labs back (src/dev).
      body: () => {
        const [account, ...rest] = settingsExtras(labsHost(app));
        return [sub('', account), sub(tr('App'), installField(), ...rest)];
      },
    },
  ];
  o.append(settingsShell(cats, () => (o.hidden = true)));
}

/** What each volume slider governs (the three mixer buses in sound.ts; callers and Mei play outside them). */
const SLIDER_TIPS: Record<'effects' | 'music' | 'ambient', () => string> = {
  music: () => tr('The background music.'),
  effects: () => tr('Tile clacks, dice and the other table and button sounds. Player calls and Mei are not on this slider.'),
  ambient: () => tr('The room around the table: its quiet room tone, and the teahouse, jansō and majlis soundscapes.'),
};

interface Category {
  id: string;
  icon: string;
  name: string;
  note: string;
  body(): (HTMLElement | string)[];
}

const CAT_KEY = 'jongclub.settings.cat';

/**
 * Settings in categories. Wide screens (tablets, desktops): the categories on
 * the left and the chosen one's options on the right. Phones: the list of
 * categories first; tapping one opens it, with a way back.
 */
function settingsShell(cats: Category[], close: () => void): HTMLElement {
  let current = cats[0].id;
  try {
    current = sessionStorage.getItem(CAT_KEY) ?? current;
  } catch {
    /* first category */
  }
  if (!cats.some((c) => c.id === current)) current = cats[0].id;
  const card = h('div', { class: 'card settings set-shell', 'data-view': 'list', 'data-tap-tips': '' });
  const nav = h('nav', { class: 'set-nav', 'aria-label': tr('Settings') });
  const panel = h('div', { class: 'set-panel', role: 'region', 'aria-live': 'polite' });
  const built = new Map<string, HTMLElement>();
  const show = (id: string, openPanel: boolean) => {
    current = id;
    try {
      sessionStorage.setItem(CAT_KEY, id);
    } catch {
      /* not remembered */
    }
    const c = cats.find((x) => x.id === id)!;
    for (const b of nav.querySelectorAll<HTMLButtonElement>('button')) {
      const on = b.dataset.cat === id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-current', on ? 'true' : 'false');
    }
    let page = built.get(id);
    if (!page) {
      page = h(
        'div',
        { class: 'set-page', 'data-cat': id },
        h('div', { class: 'set-page-head' }, h('button', { type: 'button', class: 'link set-back', onclick: () => (card.dataset.view = 'list') }, tr('‹ All settings')), h('h4', { class: 'set-title' }, c.name)),
        ...c.body(),
      );
      built.set(id, page);
    }
    panel.replaceChildren(page);
    panel.scrollTop = 0;
    if (openPanel) card.dataset.view = 'panel';
  };
  for (const c of cats)
    nav.append(
      h(
        'button',
        { type: 'button', class: 'set-cat', 'data-cat': c.id, onclick: () => show(c.id, true) },
        h('span', { class: 'set-ic', 'aria-hidden': 'true', html: icon(c.icon) }),
        h('span', { class: 'set-cat-t' }, h('b', {}, c.name), h('small', {}, c.note)),
        h('span', { class: 'set-chev', 'aria-hidden': 'true', html: icon('chevronRight') }),
      ),
    );
  card.append(
    h('div', { class: 'set-head' }, h('h3', {}, tr('Settings')), h('button', { class: 'icon-btn', 'aria-label': tr('Close settings'), title: tr('Close'), onclick: close, html: icon('close') })),
    h('div', { class: 'set-body' }, nav, panel),
    h('div', { class: 'btn-row set-foot' }, h('button', { class: 'btn primary', onclick: close }, tr('Done'))),
  );
  show(current, false);
  return card;
}

/** Pick Mei's voice from the device's voices, most natural first. */
function voiceField() {
  const vs = narrator.voices().slice(0, 12);
  if (!vs.length && !narrator.hasClips) return '';
  const sel = h(
    'select',
    { id: 'narrator-voice', class: 'region-select' },
    narrator.hasClips ? h('option', { value: RECORDED, selected: narrator.voiceName === RECORDED }, tr('Mei (recorded)')) : '',
    ...vs.map((v) => h('option', { value: v.name, selected: v.name === narrator.voiceName }, `${v.name.replace(/^(Microsoft|Google) /, '')} (${v.lang})`)),
  ) as HTMLSelectElement;
  sel.onchange = () => {
    narrator.setVoice(sel.value);
    void narrator.say('Hello! This is how I will sound at the table.');
  };
  return h('label', { class: 'field', for: 'narrator-voice' }, h('span', { title: tr('Who reads lessons and spoken help aloud: Mei’s recorded voice, or one of this device’s own voices.') }, tr('Tutorial voice')), sel);
}

export function persistSettings(app: App) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(app.settings));
  } catch {
    /* ignore */
  }
  app.match?.applySettings(app.settings);
}

/** What Labs needs from the app: the profile, the modal, and a quick test hand. */
export function labsHost(app: App): DevHost {
  return {
    profile: app.profile,
    modal: app.modal,
    openSettings: () => app.openSettings(),
    refresh: () => !app.match && !app.replay && app.go(app.screen),
    relayout: () => app.table.relayout(),
    quickGame: app.match || app.replay
      ? undefined
      : () => {
          Object.assign(dev, { showHands: true, aiSpeed: 20, animSpeed: 8 });
          saveDev();
          app.startMatch({ ...DEFAULT_TABLE, name: 'Labs test hand', length: 'oneHand', timer: 0, pace: 'untimed' });
        },
  };
}
