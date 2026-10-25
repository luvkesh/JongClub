// An item's View pop-over, from the Collection or The Atelier: a large
// picture, a line about it, and Mei's recorded pitch (the same voice and
// style as the website's Atelier tour). She never says prices; the price or
// how to earn it sits in the text below her.

import { pitchClip } from '../audio/audioPack';
import { playClip, type PlayingClip } from '../audio/clipPlayer';
import { clipKey } from '../audio/clipKey';
import { narrator } from '../audio/voice';
import { CATEGORY_LABELS, type Cosmetic } from '../cosmetics/catalog';
import { PITCH } from '../cosmetics/pitch';
import { avatarSvg } from '../cosmetics/avatar';
import { avatarPortraitUrl } from '../render/avatar3d';
import { buy, equip, equipped, owns, preview } from './atelier';
import type { AppCtx } from './ctx';
import { clear, fmt, h } from './dom';
import { glyph } from './glyphs';
import { tr } from '../i18n';
import './itemView.css';

/** Mei's pitch for an item, if she has one. */
export const pitchFor = (c: Cosmetic) => PITCH[`${c.category}:${c.id}`];

/** The picture: the real tiles, rack or room, the 3D portrait for avatar items, else the card's preview. */
function picture(ctx: AppCtx, c: Cosmetic): HTMLElement {
  if (c.category === 'avatar' || c.category === 'accessory' || c.category === 'frame') {
    const a = ctx.profile.avatar;
    const spec = c.category === 'avatar' ? { ...a, outfit: c.id.replace('outfit-', '') as typeof a.outfit } : c.category === 'accessory' ? { ...a, accessory: c.id as typeof a.accessory } : { ...a, frame: c.id };
    // The 3D bust is cropped at the shoulders, so the fan (held low) shows in the drawn portrait instead.
    if (c.id === 'fan') return h('div', { class: 'iv-pic iv-portrait', html: avatarSvg(spec, 240) });
    const url = avatarPortraitUrl(spec, 360);
    if (url) return h('div', { class: 'iv-pic iv-portrait' }, h('img', { src: url, alt: c.name, width: 240, height: 240 }));
  }
  return h('div', { class: `iv-pic iv-${c.category}` }, preview(ctx, c));
}

export function viewItem(ctx: AppCtx, c: Cosmetic, mode: 'collection' | 'atelier', after: () => void, openAtelier: (c: Cosmetic) => void = () => ctx.go('atelier'), list: Cosmetic[] = []) {
  const p = ctx.profile;
  const o = ctx.modal;
  clear(o).hidden = false;
  const own = owns(p, c);
  const on = own && equipped(p, c);
  const say = pitchFor(c);

  // ------------------------------------------------ Mei
  let playing: PlayingClip | null = null;
  let run = 0;
  // A small round button beside the close icon: the voice mark at rest, pause (with a soft pulse) while she speaks.
  const btn = h('button', { class: 'iv-mei' }) as HTMLButtonElement;
  const paint = (state: 'idle' | 'loading' | 'playing' | 'missing') => {
    btn.dataset.state = state;
    btn.innerHTML = glyph(state === 'playing' ? 'pause' : 'voice');
    const words = state === 'playing' ? tr('Pause') : state === 'loading' ? tr('Getting ready…') : state === 'missing' ? tr('Her voice isn’t available right now.') : tr('Listen to Mei');
    btn.setAttribute('aria-label', words);
    btn.title = words;
    btn.disabled = state === 'loading' || state === 'missing';
  };
  const stop = () => {
    run++;
    playing?.stop();
    playing = null;
    paint('idle');
  };
  const play = async () => {
    if (!say) return;
    const mine = ++run;
    narrator.stop();
    paint('loading');
    const url = await pitchClip(clipKey(say));
    if (mine !== run) return;
    if (!url) return paint('missing');
    playing = playClip(url);
    paint('playing');
    await playing.done;
    if (mine === run) (playing = null), paint('idle');
  };
  btn.onclick = () => (playing ? stop() : void play());
  paint('idle');

  // ------------------------------------------------ what you can do
  const close = () => {
    stop();
    o.hidden = true;
  };
  // Left and right step through the items the grid shows, wrapping at the ends (arrow keys too).
  const at = list.findIndex((it) => it.id === c.id && it.category === c.category);
  const step = (d: 1 | -1) => {
    stop();
    watch.disconnect();
    document.removeEventListener('keydown', keys);
    viewItem(ctx, list[(at + d + list.length) % list.length], mode, after, openAtelier, list);
  };
  const rtl = document.dir === 'rtl';
  const keys = (e: KeyboardEvent) => {
    if (o.hidden || !card.isConnected || (e.target as HTMLElement)?.closest?.('input, select, textarea')) return;
    if (e.key === 'ArrowLeft') step(rtl ? 1 : -1);
    else if (e.key === 'ArrowRight') step(rtl ? -1 : 1);
  };
  const nav = list.length > 1 && at >= 0;
  const arrow = (d: 1 | -1) => h('button', { class: `iv-nav ${d < 0 ? 'prev' : 'next'}`, 'aria-label': d < 0 ? tr('Previous item') : tr('Next item'), title: d < 0 ? tr('Previous item') : tr('Next item'), html: glyph('chevron'), onclick: () => step(d) });
  let status: HTMLElement;
  let action: HTMLElement | null = null;
  if (own) {
    status = h('span', { class: 'iv-status owned' }, h('span', { html: glyph(on ? 'check' : 'diamond') }), on ? tr('Equipped') : tr('Owned'));
    if (!on) action = h('button', { class: 'btn primary', onclick: () => (stop(), equip(ctx, c), (o.hidden = true), after()) }, tr('Equip'));
  } else if (c.earnedBy) {
    status = h('span', { class: 'iv-status earn' }, h('span', { html: glyph('trophy') }), tr('Earn: {how}', { how: c.earnedBy }));
  } else {
    status = h('span', { class: 'iv-status price' }, h('span', { html: glyph('coin') }), `${fmt(c.price)} JP`);
    action =
      mode === 'atelier'
        ? h('button', { class: 'btn primary', onclick: () => (stop(), buy(ctx, c, after)) }, tr('Acquire'))
        : h('button', { class: 'btn primary', onclick: () => (stop(), (o.hidden = true), openAtelier(c)) }, tr('Visit The Atelier'));
  }

  const card = h(
    'div',
    { class: 'card iv-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': c.name },
    h('div', { class: 'iv-tools' }, say ? btn : null, h('button', { class: 'iv-x', 'aria-label': tr('Close'), title: tr('Close'), onclick: close, html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' })),
    nav ? h('div', { class: 'iv-stage' }, picture(ctx, c), arrow(-1), arrow(1), h('span', { class: 'iv-count' }, `${fmt(at + 1)} / ${fmt(list.length)}`)) : picture(ctx, c),
    h(
      'div',
      { class: 'iv-body' },
      h('p', { class: 'iv-eyebrow' }, CATEGORY_LABELS[c.category]),
      h('h3', { class: 'iv-name' }, c.name),
      c.blurb ? h('p', { class: 'iv-blurb' }, c.blurb) : null,
      h('div', { class: 'iv-foot' }, status, action ? h('div', { class: 'iv-actions' }, action) : null),
    ),
  );
  o.append(card);

  // Closing the pop-over any other way (backdrop, Escape, another screen) silences her too.
  const watch = new MutationObserver(() => {
    if (o.hidden || !card.isConnected) {
      stop();
      watch.disconnect();
      document.removeEventListener('keydown', keys);
    }
  });
  if (nav) document.addEventListener('keydown', keys);
  watch.observe(o, { attributes: true, attributeFilter: ['hidden'], childList: true });

  // She starts as the pop-over opens (a tap, so audio may play), unless voice is switched off in Settings.
  if (say && narrator.enabled) void play();
}
