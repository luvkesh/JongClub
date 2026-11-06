// Owning, wearing and acquiring cosmetics, and their previews. The Collection
// and Atelier screens live in screens/collection.ts. Cosmetics never affect
// gameplay or rating; they are acquired with Jong Points only.

import { avatarSvg } from '../cosmetics/avatar';
import { tileSetPreview } from '../render/tileFaces';
import { environmentPreview } from '../render/backdrop';
import { rackPreview } from '../render/rackPreview';
import { tablePreview } from '../render/tablePreview';
import { avatarPortraitUrl } from '../render/avatar3d';
import { effectPreview } from '../render/effectArt';
import { CATALOG, VARIATION_TABLE, type Cosmetic, type CosmeticCategory, type Loadout } from '../cosmetics/catalog';
import { VARIATIONS } from '../engine/rules';
import { saveProfile, unlock, type Profile } from '../progression/profile';
import { venueStampEarned } from '../cosmetics/venues';
import type { AppCtx } from './ctx';
import { clear, fmt, h } from './dom';
import { glyph } from './glyphs';
import { tr } from '../i18n';

export const key = (c: Cosmetic) => `${c.category}:${c.id}`;

/** Owned: free starters, bought or won items, and tables earned by playing their variation. */
export function owns(p: Profile, c: Cosmetic): boolean {
  if (c.price === 0 && !c.earnedBy) return true;
  if (p.owned.includes(key(c))) return true;
  if (c.category === 'table') {
    const v = Object.entries(VARIATION_TABLE).find(([, t]) => t === c.id)?.[0];
    if (v && (p.variationGames[v] ?? 0) > 0) return true;
  }
  if (c.id === 'frame-master') return p.rating >= 2100;
  if (c.category === 'environment' && venueStampEarned(p, c.id)) return true;
  return false;
}

/** Which loadout slot a category fills (avatar parts live on the avatar). */
const SLOT: Partial<Record<CosmeticCategory, keyof Loadout>> = {
  tileSet: 'tileSet',
  rack: 'rack',
  table: 'table',
  environment: 'environment',
  winAnimation: 'winAnimation',
  tableEffect: 'tableEffect',
  sound: 'sound',
};

export function equipped(p: Profile, c: Cosmetic) {
  const slot = SLOT[c.category];
  if (slot) return p.loadout[slot] === c.id;
  if (c.category === 'avatar') return `outfit-${p.avatar.outfit}` === c.id;
  if (c.category === 'accessory') return p.avatar.accessory === c.id;
  if (c.category === 'frame') return p.avatar.frame === c.id;
  return false;
}

export function equip(ctx: AppCtx, c: Cosmetic) {
  const p = ctx.profile;
  const slot = SLOT[c.category];
  if (slot) p.loadout = { ...p.loadout, [slot]: c.id };
  else if (c.category === 'avatar') p.avatar = { ...p.avatar, outfit: c.id.replace('outfit-', '') as Profile['avatar']['outfit'] };
  else if (c.category === 'accessory') p.avatar = { ...p.avatar, accessory: c.id as Profile['avatar']['accessory'] };
  else if (c.category === 'frame') p.avatar = { ...p.avatar, frame: c.id };
  saveProfile(p);
  ctx.applyLoadout();
  ctx.club?.setWho(ctx.who());
}

/**
 * Rendered pictures (racks, tables) are made one at a time between frames, so a screen full of
 * cards opens at once and fills in; each shows its colours until its picture is ready.
 */
const queue: (() => void)[] = [];
function later(job: () => void) {
  queue.push(job);
  if (queue.length === 1) setTimeout(next, 30);
}
function next() {
  const job = queue.shift();
  job?.();
  if (queue.length) setTimeout(next, 0);
}
export function picture(cls: string, make: () => string | Promise<string>, fallback: string, bg = '#0a0d0b', ...kids: HTMLElement[]) {
  const el = h('div', { class: `item-prev ${cls} real-prev`, style: { height: 'auto', aspectRatio: '480 / 264', background: fallback } }, ...kids);
  later(() => {
    if (!el.isConnected) return;
    void Promise.resolve(make())
      .then((url) => {
        if (!url) return;
        el.style.background = `${bg} url(${url}) center / cover no-repeat`;
        el.replaceChildren();
      })
      .catch(() => undefined);
  });
  return el;
}

/** A small visual preview for an item. */
export function preview(ctx: AppCtx, c: Cosmetic): HTMLElement {
  const [a, b] = c.swatch;
  switch (c.category) {
    case 'tileSet':
      // The real set: faces, body layers and back, drawn by the tile renderer.
      return h('div', { class: 'item-prev tiles-prev real-prev', style: { height: 'auto', aspectRatio: '480 / 264', background: `#0b0f0d url(${tileSetPreview(c.id)}) center / cover no-repeat` } });
    case 'rack': {
      // The real rack, holding a few of your tiles.
      return picture('tiles-prev', () => rackPreview(c.id), `linear-gradient(160deg, ${a}, ${b})`);
    }
    case 'table':
      // The real table in miniature, laid for a game with your tiles.
      return picture('table-prev', () => tablePreview(c.id), `radial-gradient(60% 50% at 50% 55%, color-mix(in srgb, ${a} 80%, black), #0a0d0b)`);
    case 'environment':
      // The real room: its view, walls, floor, rug and lamp.
      return h('div', { class: 'item-prev env real-prev', style: { height: 'auto', aspectRatio: '480 / 264', background: `#0b0f0d url(${environmentPreview(c.id, 960, 528)}) center / cover no-repeat` } });
    case 'avatar':
    case 'accessory':
    case 'frame': {
      const p = ctx.profile.avatar;
      const spec = c.category === 'avatar' ? { ...p, outfit: c.id.replace('outfit-', '') as typeof p.outfit } : c.category === 'accessory' ? { ...p, accessory: c.id as typeof p.accessory } : { ...p, frame: c.id };
      // The drawn bust at once, then the 3D portrait (with its jewelled frame) when it is ready.
      // The fan is held low, below the 3D bust's crop, so it keeps the drawing.
      const el = h('div', { class: 'item-prev av-prev', html: avatarSvg(spec, 72) });
      if (c.id !== 'fan')
        later(() => {
          if (!el.isConnected) return;
          const url = avatarPortraitUrl(spec, 180);
          if (url) clear(el).append(h('img', { src: url, alt: '', width: 180, height: 180 }));
        });
      return el;
    }
    default:
      // The effect painted over the table as it plays (effectArt.ts); its glyph until that is ready.
      return picture('fx-prev', () => effectPreview(c.id), `radial-gradient(circle at 50% 60%, ${a}66, transparent 55%), radial-gradient(circle at 30% 30%, ${b}55, transparent 40%), #101411`, '#0a0d0b', h('span', { class: 'fx-glyph', html: glyph(c.category === 'sound' ? 'note' : c.category === 'winAnimation' ? 'sparkle' : 'wand') }));
  }
}

/** The acquire sheet: price, what is left, and Acquire and equip. `done` runs after a purchase. */
export function buy(ctx: AppCtx, c: Cosmetic, done: () => void = () => ctx.go('atelier')) {
  const p = ctx.profile;
  const o = ctx.modal;
  clear(o).hidden = false;
  const can = p.jongPoints >= c.price;
  o.append(
    h(
      'div',
      { class: 'card buy-card' },
      preview(ctx, c),
      h('h3', {}, c.name),
      h('p', { class: 'muted' }, c.blurb),
      h('p', {}, can ? tr('{n} Jong Points. You will have {left} left.', { n: fmt(c.price), left: fmt(p.jongPoints - c.price) }) : tr('{n} Jong Points. You have {have}: play games and daily challenges to earn more.', { n: fmt(c.price), have: fmt(p.jongPoints) })),
      h(
        'div',
        { class: 'btn-row' },
        h('button', { class: 'btn ghost', onclick: () => (o.hidden = true) }, tr('Not now')),
        can
          ? h(
              'button',
              {
                class: 'btn primary',
                onclick: () => {
                  p.jongPoints -= c.price;
                  p.owned.push(key(c));
                  if (CATALOG.filter((x) => x.category === 'tileSet' && owns(p, x)).length >= 10) unlock(p, 'collector');
                  saveProfile(p);
                  equip(ctx, c);
                  o.hidden = true;
                  done();
                },
              },
              tr('Acquire and equip'),
            )
          : '',
      ),
    ),
  );
}

export const variationList = () => VARIATIONS;
