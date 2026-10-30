// Home screen: the hero, then five premium cards (Quick Start, Host a New Game, Join a Friend,
// Learn Mahjong, Mini Games), the club strip and the season.

import './home.css';
import { levelOf } from '../../progression/profile';
import { seasonHomeCard } from '../seasons';
import { seasonAt } from '../../club/seasons';
import { seasonArt } from '../seasonArt';
import { fmt, h } from '../dom';
import { icon } from '../icons';
import { brandSvg, brandWordmark } from '../../brand';
import { isGuest, openSignIn } from '../../auth/prompt';
import { placementTable } from '../placement';
import { lastTable, tableSummary } from '../lastTable';
import { joinTable } from '../live';
import { focusActions } from './play';
import { dailyPrompt } from '../economySheets';
import { luxCard, luxRow } from '../luxCard';
import { tr } from '../../i18n';
import type { App } from '../app';

export function homeScreen(app: App) {
  const p = app.profile;
  const lv = levelOf(p.xp);
  const first = p.games === 0;
  const hero = h(
    'section',
    { class: 'hero' },
    h('div', { class: 'hero-mark', 'aria-hidden': 'true', html: brandSvg('mark') }),
    h('h1', { class: 'wordmark' }, brandWordmark()),
    h('p', { class: 'tagline' }, tr('The Table Awaits.')),
    h('p', { class: 'subline' }, h('span', {}, tr('Learn.')), h('span', {}, tr('Play.')), h('span', {}, tr('Master.'))),
  );

  // ---- Five cards: Quick Start (your last AI table; Mei's guided hand the first time), Host, Join, Learn, Mini Games.
  const last = lastTable();
  const sum = tableSummary(last);
  const quickLine = first ? tr('Your first hand, guided by Mei.') : h('span', {}, tr('Jump back into your last game.'), h('span', { class: 'hx-last' }, `${sum.flag} ${sum.rules} · ${sum.format}`));
  const info = h('button', { type: 'button', class: 'hx-info', 'aria-label': tr('Change the game'), title: tr('Change the game'), onclick: () => goSetup(app), html: icon('info') });
  const quick = luxCard({ art: 'quick', title: tr('Quick Start'), line: quickLine, run: () => sitDown(app), featured: true, corner: first ? undefined : info });
  const host = luxCard({ art: 'host', title: tr('Host a New Game'), line: app.club ? tr('Create a table and invite your friends.') : tr('Set up a table with AI players.'), run: () => goSetup(app) });

  const code = h('input', { placeholder: tr('Table code'), maxlength: '5', 'aria-label': tr('Table code'), autocapitalize: 'off', spellcheck: 'false', disabled: !app.club }) as HTMLInputElement;
  code.oninput = () => code.setCustomValidity('');
  const joinFoot = h(
    'form',
    {
      class: 'lux-foot',
      onsubmit: (e: Event) => {
        e.preventDefault();
        const c = code.value.trim();
        if (!/^[a-z0-9]{5}$/i.test(c)) {
          code.setCustomValidity(tr('Codes are five letters or numbers.'));
          code.reportValidity();
          return;
        }
        code.setCustomValidity('');
        void joinTable(app.liveHost(), c.toLowerCase(), false);
      },
    },
    code,
    h('button', { type: 'submit', class: 'lux-go-btn', 'aria-label': tr('Join'), disabled: !app.club, html: icon('arrowRight') }),
  );
  const join = luxCard({ art: 'join', title: tr('Join a Friend'), line: tr('Enter their code and go to their table.'), run: app.club ? () => code.focus() : null, foot: joinFoot });
  const learn = luxCard({ art: 'learn', title: tr('Learn Mahjong'), line: tr('Basics, rules and handy tips to get you started.'), run: () => app.go('learn') });
  const mini = luxCard({ art: 'mini', title: tr('Mini-games'), line: tr('Relax with a quick game or try Solitaire.'), run: () => app.go('minigames') });

  const actions = h('section', { class: 'hx-actions', 'aria-label': tr('Play') }, luxRow([quick, host, join, learn, mini], 'hx-lux'));

  const stat = (ico: string, k: string, v: Node | string, cls = '') => h('div', { class: `stat ${cls}` }, h('span', { class: 'stat-ico', html: icon(ico) }), h('span', { class: 'stat-body' }, h('span', { class: 'k' }, k), typeof v === 'string' ? h('span', { class: 'v' }, v) : v));
  const playedToday = app.profile.daily[new Date().toISOString().slice(0, 10)]?.hand !== undefined;
  const strip = h(
    'section',
    { class: 'home-strip hx-strip' },
    stat('trophy', tr('Club Level'), String(lv.level)),
    stat('coins', tr('Jong Points'), h('button', { class: 'link v sm', onclick: () => app.go('store') }, fmt(p.jongPoints), h('span', { class: 'hx-chev', html: icon('chevronRight') }))),
    stat('gamepad', tr('Games'), fmt(p.games)),
    stat('calendar', tr('Daily Hand'), h('button', { class: 'link v sm', onclick: () => app.go('daily') }, playedToday ? tr('Played today ✓') : tr('Play today’s hand'), h('span', { class: 'hx-chev', html: icon('chevronRight') })), 'daily'),
  );

  // Once a day, the daily login reward (src/economy).
  if (!first) window.setTimeout(() => app.screen === 'home' && !app.match && dailyPrompt(app.ctx(), () => app.go('store')), 900);
  return h(
    'div',
    { class: 'home' },
    hero,
    actions,
    first ? null : strip,
    first && isGuest() ? h('button', { class: 'link', onclick: () => void openSignIn() }, tr('Have an account? Sign in')) : null,
    first ? null : seasonCard(app),
  );
}

/** The season card with a small night scene of its city. */
function seasonCard(app: App): HTMLElement {
  const card = seasonHomeCard(app.ctx());
  const theme = seasonAt().theme;
  card.classList.add('hx-season');
  card.prepend(h('span', { class: 'hx-season-art', html: seasonArt(theme.id, theme.colors) }));
  const body = h('span', { class: 'hx-season-body' });
  body.append(...[...card.children].filter((c) => !c.classList.contains('hx-season-art')));
  card.append(body);
  return card;
}

/** The Play screen's game set-up, with its Play with AI and Host buttons in view. */
function goSetup(app: App) {
  app.go('play');
  focusActions(app);
}

/** Quick Start: a first visit plays the guided game with Mei (or the placement's table); after that, your last AI table. */
function sitDown(app: App) {
  if (app.profile.games > 0) return app.startMatch(lastTable());
  const t = placementTable(app.ctx());
  if (t) app.startMatch(t);
  else app.startGuided();
}
