// Jong Points: the balance, every way to earn them (daily login, winning,
// adverts, weekly challenges, achievements, buying) and every way to spend
// them (Academy lessons and bundles, The Atelier, tournaments). Real money and
// adverts are demos until a payment provider and an ad network are connected.

import { ACHIEVEMENTS, saveProfile } from '../../progression/profile';
import {
  ACHIEVEMENT_JP, AD_REWARD, ADS_PER_DAY, BUNDLES, FIRST_WIN_BONUS, JP_PACKS, LOGIN_LADDER,
  achievementsToClaim, adsLeft, claimAchievement, claimChallenge, claimLogin, firstWinToday, loginStatus, rupees, weekChallenges,
} from '../../economy/economy';
import { MINI_DAILY_CAP } from '../../minigames/progress';
import { adProvider, paymentProvider } from '../../economy/providers';
import type { AppCtx } from '../ctx';
import { fmt, h } from '../dom';
import { glyph } from '../glyphs';
import { bundleRow, payMoney, toastPoints, watchAd } from '../economySheets';
import { tr } from '../../i18n';
import '../economy.css';

/** Drawn icons this page needs beyond the shared glyphs. */
const ICON = {
  gift: '<rect x="3.5" y="9" width="17" height="11.5" rx="1.5"/><path d="M2.5 9h19v-3h-19zM12 6v14.5"/><path d="M12 6c-1.5-3-5.5-3.5-5.5-1S10 6 12 6c1.5-3 5.5-3.5 5.5-1S14 6 12 6"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9.2 5 2.8-5 2.8z"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4.5h11.5l-2 3.5 2 3.5H5"/>',
  bag: '<path d="M5 8h14l-1.2 12.5H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
};
const draw = (k: keyof typeof ICON) => `<svg class="gl" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

export function storeScreen(ctx: AppCtx) {
  const p = ctx.profile;
  const again = () => ctx.go('store');
  const save = () => saveProfile(p);

  // ------------------------------------------------ daily login
  const login = loginStatus(p);
  const ladder = h(
    'ol',
    { class: 'ec-ladder', 'aria-label': tr('Daily login rewards') },
    ...LOGIN_LADDER.map((n, i) => {
      const day = i + 1;
      const past = day < login.day || (login.claimed && day === login.day);
      const today = day === login.day;
      return h('li', { class: `ec-day ${past ? 'got' : ''} ${today ? 'today' : ''} ${day === 7 ? 'big' : ''}` }, h('span', { class: 'ec-day-n' }, tr('Day {n}', { n: day })), h('span', { class: 'ec-day-ico', html: past ? glyph('check') : day === 7 ? draw('gift') : glyph('coin') }), h('b', {}, fmt(n)));
    }),
  );
  const claim = login.claimed
    ? h('p', { class: 'ec-note' }, h('span', { html: glyph('check') }), tr('Collected today. Come back tomorrow for Day {n}.', { n: (login.day % 7) + 1 }))
    : h('button', { class: 'btn primary', onclick: () => (toastPoints(claimLogin(p), tr('daily reward')), save(), again()) }, tr('Collect {n} JP', { n: fmt(login.points) }));

  // ------------------------------------------------ ways to earn
  const card = (ico: string, title: string, line: string, ...foot: (Node | null)[]) => h('article', { class: 'ec-card' }, h('span', { class: 'ec-card-ico', html: ico }), h('h4', { class: 'ec-card-t' }, title), h('p', { class: 'ec-card-d' }, line), h('div', { class: 'ec-card-foot' }, ...foot));
  const left = adsLeft(p);
  const ads = adProvider();
  const earn = [
    card(glyph('trophy'), tr('Win games'), tr('Every game pays 50 JP, each hand you win 40, first place 200 and a limit hand 300. Your first win each day adds {n}.', { n: FIRST_WIN_BONUS }), h('span', { class: `ec-pill ${firstWinToday(p) ? 'done' : ''}` }, firstWinToday(p) ? tr('First win bonus collected') : tr('First win bonus ready')), h('button', { class: 'btn sm ghost', onclick: () => ctx.go('play') }, tr('Play'))),
    card(draw('film'), tr('Watch an advert'), tr('{n} JP for each short advert, up to {max} a day.', { n: AD_REWARD, max: ADS_PER_DAY }), ads.demo ? h('span', { class: 'ec-pill demo' }, tr('Demo')) : null, h('button', { class: 'btn sm ghost', disabled: !left, onclick: () => watchAd(ctx, again) }, left ? tr('Watch ({n} left)', { n: left }) : tr('Back tomorrow'))),
    card(glyph('gamepad'), tr('Mini-games'), tr('Up to {n} JP a day from each mini-game, plus a bonus for the daily puzzle.', { n: fmt(MINI_DAILY_CAP) }), h('button', { class: 'btn sm ghost', onclick: () => ctx.go('minigames') }, tr('Play'))),
    card(glyph('calendar'), tr('Daily challenges'), tr('The Daily page’s hand, puzzles and goals pay Jong Points every day.'), h('button', { class: 'btn sm ghost', onclick: () => ctx.go('daily') }, tr('Open'))),
  ];

  // ------------------------------------------------ weekly challenges
  const weekly = h(
    'div',
    { class: 'ec-list' },
    ...weekChallenges(p).map((c) =>
      h(
        'div',
        { class: `ec-item ${c.claimed ? 'claimed' : ''}` },
        h('span', { class: 'ec-item-ico', html: draw('flag') }),
        h('div', { class: 'ec-item-text' }, h('p', { class: 'ec-item-t' }, c.label), h('div', { class: 'ec-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(c.goal), 'aria-valuenow': String(c.done) }, h('i', { style: { width: `${(c.done / c.goal) * 100}%` } })), h('p', { class: 'ec-item-d' }, `${fmt(c.done)} / ${fmt(c.goal)}`)),
        c.claimed
          ? h('span', { class: 'ec-owned' }, h('span', { html: glyph('check') }), tr('Collected'))
          : h('button', { class: `btn sm ${c.ready ? 'primary' : 'ghost'}`, disabled: !c.ready, onclick: () => (toastPoints(claimChallenge(p, c.id), c.label), save(), again()) }, `${fmt(c.points)} JP`),
      ),
    ),
  );

  // ------------------------------------------------ achievements
  const ready = achievementsToClaim(p);
  const waiting = ACHIEVEMENTS.filter((a) => ACHIEVEMENT_JP[a.id] && !p.achievements[a.id]);
  const achList = h(
    'div',
    { class: 'ec-list' },
    ...ready.map((id) => {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      return h('div', { class: 'ec-item' }, h('span', { class: 'ec-item-ico gold', html: glyph('medal') }), h('div', { class: 'ec-item-text' }, h('p', { class: 'ec-item-t' }, a?.name ?? id), a ? h('p', { class: 'ec-item-d' }, a.detail) : null), h('button', { class: 'btn sm primary', onclick: () => (toastPoints(claimAchievement(p, id), a?.name ?? ''), save(), again()) }, tr('Collect {n} JP', { n: fmt(ACHIEVEMENT_JP[id]) })));
    }),
    ...waiting.slice(0, ready.length ? 2 : 4).map((a) => h('div', { class: 'ec-item later' }, h('span', { class: 'ec-item-ico', html: glyph('medal') }), h('div', { class: 'ec-item-text' }, h('p', { class: 'ec-item-t' }, a.name), h('p', { class: 'ec-item-d' }, a.detail)), h('span', { class: 'ec-pill' }, `${fmt(ACHIEVEMENT_JP[a.id])} JP`))),
  );

  // ------------------------------------------------ spend
  const spend = [
    card(glyph('star'), tr('Advanced lessons'), tr('Levels 1 to 5 and every India Rules lesson are free. Unlock the rest one at a time or in a bundle.'), h('button', { class: 'btn sm ghost', onclick: () => ctx.go('learn') }, tr('Learn'))),
    card(glyph('brush'), tr('Cosmetics and rooms'), tr('Tile sets, racks, tables, rooms, outfits and win effects in The Atelier. They never change how the game plays.'), h('button', { class: 'btn sm ghost', onclick: () => ctx.go('atelier') }, tr('The Atelier'))),
    card(glyph('crown'), tr('Tournaments'), tr('Daily, weekend and global tournaments take an entry in Jong Points and pay out bigger prizes.'), h('button', { class: 'btn sm ghost', onclick: () => ctx.go('tournaments') }, tr('Tournaments'))),
  ];

  // ------------------------------------------------ buy
  const pay = paymentProvider();
  const packs = h(
    'div',
    { class: 'ec-packs' },
    ...JP_PACKS.map((k, i) =>
      h(
        'button',
        { class: `ec-pack ${i === 2 ? 'best' : ''}`, onclick: () => payMoney(ctx, k.sku, tr('{n} Jong Points', { n: fmt(k.jp) }), k.inr, () => (toastPoints(k.jp, tr('added to your balance')), again())) },
        i === 2 ? h('span', { class: 'ec-pack-tag' }, tr('Best value')) : null,
        h('span', { class: 'ec-pack-coins', 'aria-hidden': 'true' }, ...Array.from({ length: i + 1 }, () => h('span', { class: 'ec-coin', html: glyph('coin') }))),
        h('b', { class: 'ec-pack-n' }, fmt(k.jp)),
        h('span', { class: 'ec-pack-u' }, tr('Jong Points')),
        k.extra ? h('span', { class: 'ec-pack-extra' }, tr('{n}% extra', { n: k.extra })) : h('span', { class: 'ec-pack-extra none' }, ' '),
        h('span', { class: 'ec-pack-price' }, rupees(k.inr)),
      ),
    ),
  );

  const section = (id: string, ico: string, title: string, sub: string, ...body: Node[]) => h('section', { class: 'section ec-section', id, 'aria-label': title }, h('header', { class: 'section-head' }, h('h3', {}, h('span', { class: 'ec-h-ico', html: ico }), title), sub ? h('p', { class: 'muted' }, sub) : null), ...body);

  return h(
    'div',
    { class: 'page ec-page' },
    h(
      'header',
      { class: 'page-head ec-head' },
      h('div', {}, h('p', { class: 'eyebrow' }, tr('Jong Points')), h('h2', {}, tr('Earn and spend')), h('p', { class: 'lede' }, tr('Jong Points are the club’s currency. Earn them by playing and learning, and spend them on lessons, cosmetics and tournaments. They never change your rating.'))),
      h('div', { class: 'ec-balance', 'aria-label': tr('Your balance') }, h('span', { class: 'ec-coin big', html: glyph('coin') }), h('b', {}, fmt(p.jongPoints)), h('span', {}, 'JP')),
    ),
    section('ec-daily', draw('gift'), tr('Daily login rewards'), tr('Come back every day: the reward grows for seven days. Miss a day and it starts again at Day 1.'), h('div', { class: 'ec-daily' }, ladder, claim)),
    section('ec-earn', glyph('coin'), tr('Ways to earn'), '', h('div', { class: 'ec-grid' }, ...earn)),
    section('ec-week', draw('flag'), tr('This week’s challenges'), tr('Three new challenges every Monday.'), weekly),
    section('ec-ach', glyph('medal'), tr('Achievements'), tr('Each achievement pays once.'), achList),
    section('ec-lessons', glyph('star'), tr('Lesson bundles'), tr('Unlock a set of lessons for less than buying them one at a time.'), h('div', { class: 'ec-list' }, ...BUNDLES.map((b) => h('div', { class: 'ec-bundle-wrap' }, bundleRow(ctx, b, again), h('p', { class: 'ec-bundle-blurb' }, b.blurb))))),
    section('ec-buy', draw('bag'), tr('Buy Jong Points'), pay.demo ? tr('Demo: payments are not connected yet, so no money is taken.') : '', packs),
    section('ec-spend', glyph('diamond'), tr('Ways to spend'), '', h('div', { class: 'ec-grid three' }, ...spend)),
    h('p', { class: 'ec-fine' }, tr('Nothing you buy changes your rating or how the game plays.')),
  );
}
