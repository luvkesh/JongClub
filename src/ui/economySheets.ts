// Pop-overs for the Jong Points economy: unlock a lesson (Jong Points, money
// or a bundle), the demo payment and the demo advert. Real payments and real
// adverts plug in through src/economy/providers.ts; until then both are
// clearly marked demos and no money is ever taken.

import { ACADEMY_ORDER } from './academy';
import { BUNDLES, LOGIN_LADDER, buyBundleJp, canOpen, claimLogin, econOf, loginStatus, grantPurchase, lessonPrice, payAd, rupees, unlockLessonJp, AD_REWARD, type Bundle } from '../economy/economy';
import { adProvider, paymentProvider } from '../economy/providers';
import { profileSaveHooks, saveProfile, type Profile } from '../progression/profile';
import type { AppCtx } from './ctx';
import { clear, fmt, h } from './dom';
import { glyph } from './glyphs';
import { tr } from '../i18n';
import './economy.css';

/** Every lesson id the Academy lists, plus Level 2's guided game. */
export const allLessons = () => [...ACADEMY_ORDER, 'guided'];

const X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

/** A sheet in the app's modal: a title block and whatever goes below. */
function sheet(ctx: AppCtx, cls: string, label: string, ...kids: (Node | null)[]) {
  const o = ctx.modal;
  clear(o).hidden = false;
  const close = () => (o.hidden = true);
  const card = h('div', { class: `card ec-sheet ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': label }, h('button', { class: 'ec-x', 'aria-label': tr('Close'), title: tr('Close'), onclick: close, html: X }), ...kids);
  o.append(card);
  return { card, close };
}

/** A small toast that says what was earned. */
export function toastPoints(n: number, what: string) {
  const t = h('div', { class: 'ec-toast', role: 'status' }, h('span', { class: 'ec-coin', html: glyph('coin') }), h('b', {}, `+${fmt(n)} JP`), h('span', {}, what));
  document.body.append(t);
  window.setTimeout(() => t.classList.add('out'), 2400);
  window.setTimeout(() => t.remove(), 2900);
}

const demoNote = () => h('p', { class: 'ec-demo' }, h('span', { html: glyph('lock') }), tr('Demo: payments are not connected yet, so no money is taken.'));

/** Pay real money for something. In the demo the player confirms and it is granted without charge. */
export function payMoney(ctx: AppCtx, sku: string, title: string, inr: number, done: () => void) {
  const pay = paymentProvider();
  const run = async () => {
    const ok = await pay.purchase(sku, inr);
    if (!ok) return;
    grantPurchase(ctx.profile, sku, pay.demo);
    saveProfile(ctx.profile);
    s.close();
    done();
  };
  const s = sheet(
    ctx,
    'ec-pay',
    title,
    h('p', { class: 'eyebrow' }, pay.demo ? tr('Demo purchase') : tr('Purchase')),
    h('h3', { class: 'ec-title' }, title),
    h('p', { class: 'ec-price-big' }, rupees(inr)),
    pay.demo ? demoNote() : null,
    h('div', { class: 'ec-actions' }, h('button', { class: 'btn primary', onclick: () => void run() }, pay.demo ? tr('Complete demo purchase') : tr('Pay {price}', { price: rupees(inr) })), h('button', { class: 'btn ghost', onclick: () => s.close() }, tr('Cancel'))),
    h('p', { class: 'ec-fine' }, tr('Nothing you buy changes your rating or how the game plays.')),
  );
}

/** Watch a rewarded advert. The demo shows a placeholder with a short countdown. */
export function watchAd(ctx: AppCtx, done: () => void) {
  const ads = adProvider();
  if (!ads.demo) {
    void ads.showRewarded().then((ok) => {
      if (ok && payAd(ctx.profile)) (saveProfile(ctx.profile), toastPoints(AD_REWARD, tr('for watching an advert')), done());
    });
    return;
  }
  const SECS = 5;
  const count = h('b', { class: 'ec-ad-count' }, String(SECS));
  const ring = h('span', { class: 'ec-ad-ring', style: `--secs:${SECS}s` }, count);
  const collect = h('button', { class: 'btn primary', disabled: true }, tr('Collect {n} JP', { n: fmt(AD_REWARD) })) as HTMLButtonElement;
  const s = sheet(ctx, 'ec-ad', tr('Advert'), h('p', { class: 'eyebrow' }, tr('Advert placeholder')), h('div', { class: 'ec-ad-stage' }, ring), h('p', { class: 'ec-ad-line' }, tr('No ad network is connected yet. A short advert would play here.')), h('div', { class: 'ec-actions' }, collect));
  let left = SECS;
  const tick = window.setInterval(() => {
    if (!s.card.isConnected || ctx.modal.hidden) return window.clearInterval(tick);
    left--;
    count.textContent = String(Math.max(0, left));
    if (left <= 0) {
      window.clearInterval(tick);
      collect.disabled = false;
      collect.focus();
    }
  }, 1000);
  collect.onclick = () => {
    const n = payAd(ctx.profile);
    saveProfile(ctx.profile);
    s.close();
    if (n) toastPoints(n, tr('for watching an advert'));
    done();
  };
}

/** How much of a bundle the player already has open. */
export function bundleState(ctx: AppCtx, b: Bundle) {
  const all = allLessons();
  const list = b.lessons(all);
  const owned = econOf(ctx.profile).bundles.includes(b.id);
  const open = list.filter((l) => canOpen(ctx.profile, l, all)).length;
  return { owned: owned || open === list.length, open, total: list.length };
}

/** Buy a bundle with Jong Points. */
export function bundleJp(ctx: AppCtx, b: Bundle, done: () => void) {
  if (!buyBundleJp(ctx.profile, b.id)) return;
  saveProfile(ctx.profile);
  done();
}

/** The unlock pop-over for a locked lesson: Jong Points, money, or a bundle that holds it. */
export function unlockLesson(ctx: AppCtx, id: string, title: string, done: () => void, freeNext?: () => void) {
  const p = ctx.profile;
  const all = allLessons();
  const price = lessonPrice(id);
  const short = p.jongPoints < price.jp;
  const finish = () => (ctx.modal.hidden = true, done());
  const jp = h('button', { class: 'btn primary', disabled: short, onclick: () => unlockLessonJp(p, id, all) && (saveProfile(p), finish()) }, h('span', { class: 'ec-coin', html: glyph('coin') }), tr('Unlock for {n} JP', { n: fmt(price.jp) }));
  const money = h('button', { class: 'btn ghost', onclick: () => payMoney(ctx, `lesson:${id}`, title, price.inr, done) }, tr('Buy for {price}', { price: rupees(price.inr) }));
  const bundles = BUNDLES.filter((b) => b.lessons(all).includes(id) && !bundleState(ctx, b).owned);
  sheet(
    ctx,
    'ec-unlock',
    title,
    h('span', { class: 'ec-lock', html: glyph('lock') }),
    h('p', { class: 'eyebrow' }, tr('Advanced lesson')),
    h('h3', { class: 'ec-title' }, title),
    h('p', { class: 'ec-line' }, tr('Levels 1 to 3 and every India Rules lesson are free. Unlock this lesson to keep learning.')),
    h('div', { class: 'ec-actions' }, jp, money),
    short ? h('p', { class: 'ec-short' }, tr('You have {n} JP.', { n: fmt(p.jongPoints) }), ' ', h('button', { class: 'link', onclick: () => ((ctx.modal.hidden = true), ctx.go('store')) }, tr('Earn more Jong Points'))) : null,
    bundles.length
      ? h(
          'div',
          { class: 'ec-bundles' },
          h('p', { class: 'ec-sub' }, tr('Or save with a bundle')),
          ...bundles.map((b) => bundleRow(ctx, b, finish)),
        )
      : null,
    freeNext ? h('button', { class: 'link ec-free', onclick: () => ((ctx.modal.hidden = true), freeNext()) }, tr('Carry on free with the India Rules course'), h('span', { html: glyph('chevron') })) : null,
  );
}

/** One bundle as a compact row: name, what it holds, and both prices. */
export function bundleRow(ctx: AppCtx, b: Bundle, done: () => void) {
  const st = bundleState(ctx, b);
  const short = ctx.profile.jongPoints < b.price.jp;
  return h(
    'div',
    { class: `ec-bundle ${st.owned ? 'owned' : ''}` },
    h('div', { class: 'ec-bundle-text' }, h('p', { class: 'ec-bundle-t' }, b.name), h('p', { class: 'ec-bundle-d' }, tr('{n} lessons', { n: st.total }), st.open && !st.owned ? ` · ${tr('{n} already open', { n: st.open })}` : '')),
    st.owned
      ? h('span', { class: 'ec-owned' }, h('span', { html: glyph('check') }), tr('Owned'))
      : h(
          'div',
          { class: 'ec-bundle-buy' },
          h('button', { class: 'btn sm primary', disabled: short, onclick: () => bundleJp(ctx, b, done) }, `${fmt(b.price.jp)} JP`),
          h('button', { class: 'btn sm ghost', onclick: () => payMoney(ctx, `bundle:${b.id}`, b.name, b.price.inr, done) }, rupees(b.price.inr)),
        ),
  );
}

/** The balance in the top bar: opens the Jong Points page, with a dot while today's login reward waits. */
export function pointsPill(profile: () => Profile, open: () => void): HTMLElement {
  const n = h('b', {});
  const b = h('button', { class: 'ec-pill-top', onclick: open, title: tr('Jong Points') }, h('span', { class: 'ec-coin', html: glyph('coin') }), n, h('i', { class: 'ec-dot', 'aria-hidden': 'true' }));
  const paint = (p = profile()) => {
    n.textContent = fmt(p.jongPoints);
    const ready = !loginStatus(p).claimed;
    b.classList.toggle('ready', ready);
    b.setAttribute('aria-label', ready ? tr('{n} Jong Points. Your daily reward is ready.', { n: fmt(p.jongPoints) }) : tr('{n} Jong Points', { n: fmt(p.jongPoints) }));
  };
  profileSaveHooks.push((p) => paint(p));
  // The profile slot changes on sign-in, and the day can turn while the app is open.
  window.setInterval(() => paint(), 30_000);
  queueMicrotask(() => paint());
  return b;
}

const PROMPT_KEY = 'jongclub.dailyPrompt.v1';

/** Once a day, on Home, offer the daily login reward (never on a first visit). */
export function dailyPrompt(ctx: AppCtx, more: () => void) {
  const p = ctx.profile;
  const st = loginStatus(p);
  const today = new Date().toDateString();
  let seen = '';
  try {
    seen = localStorage.getItem(PROMPT_KEY) ?? '';
  } catch {
    /* private mode */
  }
  if (st.claimed || seen === today || !ctx.modal.hidden) return;
  try {
    localStorage.setItem(PROMPT_KEY, today);
  } catch {
    /* private mode */
  }
  const strip = h('ol', { class: 'ec-ladder mini' }, ...LOGIN_LADDER.map((n, i) => h('li', { class: `ec-day ${i + 1 < st.day ? 'got' : ''} ${i + 1 === st.day ? 'today' : ''}` }, h('span', { class: 'ec-day-n' }, tr('Day {n}', { n: i + 1 })), h('b', {}, fmt(n)))));
  const s = sheet(
    ctx,
    'ec-prompt',
    tr('Daily reward'),
    h('span', { class: 'ec-lock gift', html: glyph('coin') }),
    h('p', { class: 'eyebrow' }, tr('Daily reward')),
    h('h3', { class: 'ec-title' }, tr('Day {n} of 7', { n: st.day })),
    strip,
    h(
      'div',
      { class: 'ec-actions' },
      h('button', { class: 'btn primary', onclick: () => (toastPoints(claimLogin(p), tr('daily reward')), saveProfile(p), s.close()) }, tr('Collect {n} JP', { n: fmt(st.points) })),
      h('button', { class: 'btn ghost', onclick: () => (s.close(), more()) }, tr('More ways to earn')),
    ),
  );
}

/** In place of a locked lesson's player: what it is, and how to open it. */
export function lockedLesson(ctx: AppCtx, id: string, title: string, done: () => void, freeNext?: () => void): HTMLElement {
  const price = lessonPrice(id);
  return h(
    'div',
    { class: 'card ec-locked' },
    h('span', { class: 'ec-lock', html: glyph('lock') }),
    h('p', { class: 'eyebrow' }, tr('Advanced lesson')),
    h('h3', { class: 'ec-title' }, title),
    h('p', { class: 'ec-line' }, tr('Levels 1 to 3 and every India Rules lesson are free. Unlock this lesson to keep learning.')),
    h(
      'div',
      { class: 'ec-actions' },
      h('button', { class: 'btn primary', onclick: () => unlockLesson(ctx, id, title, done, freeNext) }, h('span', { class: 'ec-coin', html: glyph('coin') }), tr('Unlock from {n} JP', { n: fmt(price.jp) })),
      h('button', { class: 'btn ghost', onclick: () => ctx.go('store') }, tr('Earn Jong Points')),
    ),
    freeNext ? h('button', { class: 'link ec-free', onclick: freeNext }, tr('Carry on free with the India Rules course'), h('span', { html: glyph('chevron') })) : null,
  );
}
