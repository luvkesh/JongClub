// The winning hand, shown properly: its concealed tiles split into the sets
// they make, its revealed (called) sets kept apart, and a way to hide the
// hand summary and look at the hand on the table.

import { standardDecompositions } from '../engine/hand';
import { mixedReadings } from '../engine/rules/special';
import type { Meld } from '../engine/state';
import type { PassportLayout } from '../engine/rules/indiaLayout';
import { KIND_COUNT, isSuited, type Tile } from '../engine/tiles';
import { tr } from '../i18n';
import { h, tileImg } from './dom';
import './winReveal.css';

/**
 * Split the concealed part of a winning hand into its sets: the standard
 * reading (sets, then the pair), else seven pairs, else one group per suit
 * (thirteen orphans, jokers, card hands and other special shapes).
 */
export function concealedSets(hand: Tile[]): Tile[][] {
  const tiles = [...hand].sort((a, b) => a.kind - b.kind || a.id - b.id);
  if (!tiles.length) return [];
  const pool = new Map<number, Tile[]>();
  for (const t of tiles) pool.set(t.kind, [...(pool.get(t.kind) ?? []), t]);
  const take = (k: number, n: number) => pool.get(k)!.splice(0, n);
  if (tiles.every((t) => t.kind < KIND_COUNT) && tiles.length % 3 === 2) {
    const counts = new Array(KIND_COUNT).fill(0);
    for (const t of tiles) counts[t.kind]++;
    const reading = standardDecompositions(counts, (tiles.length - 2) / 3)
      // Prefer pungs where both readings work (three of a kind reads as a pung).
      .sort((a, b) => b.sets.filter((s) => s.type === 'pung').length - a.sets.filter((s) => s.type === 'pung').length)[0];
    if (reading) {
      const sets = [...reading.sets].sort((a, b) => a.kind - b.kind).map((s) => (s.type === 'pung' ? take(s.kind, 3) : [...take(s.kind, 1), ...take(s.kind + 1, 1), ...take(s.kind + 2, 1)]));
      return [...sets, take(reading.pair, 2)];
    }
    if (tiles.length === 14 && [...pool.values()].every((g) => g.length === 2)) return [...pool.values()];
    // Mixed sets (Classic): a pung or run across the three suits, and a knit pair.
    const mixed = mixedReadings(counts, (tiles.length - 2) / 3, 8)[0];
    if (mixed) return [...mixed.sets.map((s) => s.kinds.map((k) => take(k, 1)[0])), [take(mixed.pair[0], 1)[0], take(mixed.pair[1], 1)[0]]];
  }
  // No set reading: one group per suit, honours last, bonus and wild tiles on their own.
  const groups = new Map<number, Tile[]>();
  for (const t of tiles) {
    const g = t.kind < KIND_COUNT ? (isSuited(t.kind) ? Math.floor(t.kind / 9) : 3) : 4;
    groups.set(g, [...(groups.get(g) ?? []), t]);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
}

/** Tile ids of the winner's concealed sets, for the table to lay out with gaps. */
export function concealedSetIds(hand: Tile[]): number[][] {
  return concealedSets(hand).map((g) => g.map((t) => t.id));
}

export interface WinHandParts {
  hand: Tile[];
  melds: Meld[];
  flowers: Tile[];
  winTileId?: number;
  labels: Parameters<typeof tileImg>[2];
  red: (id: number) => boolean;
  /** India Rules East round: the hand read as passports and the rest. */
  passports?: PassportLayout;
}

/**
 * The winning hand for the summary card: revealed sets on one labelled line,
 * concealed sets on another (a concealed kong counts as concealed), bonus
 * tiles last. The winning tile is ringed.
 */
export function winHandSection(p: WinHandParts): HTMLElement {
  const img = (t: Tile, cls = '') => tileImg(t.kind, `${cls}${t.id === p.winTileId ? ' win-tile' : ''}`.trim(), p.labels, p.red(t.id));
  const set = (tiles: Tile[], cls = '') => h('div', { class: `meld ${cls}`.trim() }, ...tiles.map((t) => img(t)));
  const open = p.melds.filter((m) => !m.concealed);
  const closedKongs = p.melds.filter((m) => m.concealed);
  const row = (label: string, cls: string, sets: HTMLElement[]) => h('div', { class: `wh-row ${cls}` }, h('span', { class: 'wh-label' }, label), h('div', { class: 'wh-sets' }, ...sets));
  const box = h('div', { class: 'win-hand' });
  const pl = p.passports;
  if (pl) return passportHand(p, pl, row);
  if (open.length) box.append(row(tr('Revealed sets'), 'revealed', open.map((m) => set(m.tiles))));
  box.append(row(tr('Concealed sets'), 'concealed', [...closedKongs.map((m) => set(m.tiles, 'kong')), ...concealedSets(p.hand).map((g) => set(g))]));
  if (p.flowers.length) box.append(row(tr('Bonus tiles'), 'flowers', [set(p.flowers)]));
  return box;
}

const PIECE_NAMES: Record<string, string> = { pung: 'Pung', kong: 'Kong', chow: 'Chow', mchow: 'Mixed chow', crochet: 'Crochet', pair: 'Pair', knit: 'Knit', news5: 'Winds', grw: 'Dragons' };
const CHECK_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>';

/** India Rules East round: the passport first and framed, each piece named under it, then the
 *  other sets, any loose tiles and the bonus tiles. The winning tile lies sideways. */
function passportHand(p: WinHandParts, pl: PassportLayout, row: (label: string, cls: string, sets: HTMLElement[]) => HTMLElement): HTMLElement {
  const img = (t: Tile) => tileImg(t.kind, t.id === p.winTileId ? 'win-tile sideways' : '', p.labels, p.red(t.id));
  const piece = (tiles: Tile[], type: string, cls = '') => {
    const won = tiles.some((t) => t.id === p.winTileId);
    return h('div', { class: `wh-piece ${cls}`.trim() }, h('div', { class: 'meld' }, ...tiles.map(img)), h('span', { class: 'wh-piece-label' }, tr(PIECE_NAMES[type] ?? type), won ? h('span', { class: 'wh-won' }, ` · ${tr('Won')}`) : null));
  };
  const meldPiece = (m: Meld) => piece(m.tiles, m.type, m.concealed ? 'kong' : 'called');
  const box = h('div', { class: 'win-hand passport-hand' });
  for (const pp of pl.passports) box.append(row(tr('Passport'), 'passport', [...pp.melds.map(meldPiece), ...pp.sets.map((x) => piece(x.tiles, x.t))]));
  const others = [...pl.melds.map(meldPiece), ...pl.sets.map((x) => piece(x.tiles, x.t))];
  if (others.length) box.append(row(pl.passports.length ? tr('With the passport') : tr('Sets'), 'concealed', others));
  if (pl.loose.length) box.append(row(tr('Other tiles'), 'loose', concealedSets(pl.loose).map((g) => h('div', { class: 'meld' }, ...g.map(img)))));
  box.append(
    pl.passports.length
      ? h('div', { class: 'passport-badge' }, h('span', { class: 'pb-ic', 'aria-hidden': 'true', html: CHECK_ICON }), tr('Passport: {name}', { name: pl.passports.map((x) => tr(x.name)).join(' + ') }))
      : h('div', { class: 'passport-badge none' }, tr('No passport')),
  );
  if (p.flowers.length) box.append(row(tr('Bonus tiles'), 'flowers', [h('div', { class: 'meld' }, ...p.flowers.map(img))]));
  return box;
}

/**
 * The Hide summary control. Hidden, the summary folds into a small bar at the
 * bottom (Show summary, and the card's own continue button; on phones the hand
 * in its sets too) and the scrim lifts, so the hand on the table shows clearly.
 */
export function summaryToggle(overlay: HTMLElement, cont: HTMLButtonElement, o: { onHide?: () => void; onShow?: () => void; strip?: HTMLElement }) {
  const peekBar = h('div', { class: 'peek-bar', role: 'group', 'aria-label': tr('Hand summary') });
  // On phones the table is too small to read a whole hand from, so the hidden summary keeps the hand itself, in its sets.
  if (o.strip) peekBar.append(h('div', { class: 'peek-strip' }, o.strip));
  const showBtn = h('button', { class: 'btn ghost', onclick: () => set(false) }, h('span', { class: 'peek-ic', 'aria-hidden': 'true', html: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10l4-4 4 4"/></svg>' }), tr('Show summary')) as HTMLButtonElement;
  const hideBtn = h('button', { class: 'btn ghost hide-summary', 'aria-expanded': 'true', onclick: () => set(true) }, h('span', { class: 'peek-ic', 'aria-hidden': 'true', html: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>' }), tr('Hide summary')) as HTMLButtonElement;
  const nextBtn = h('button', { class: 'btn primary', onclick: () => cont.click() }, cont.textContent ?? '') as HTMLButtonElement;
  peekBar.append(h('div', { class: 'peek-btns' }, showBtn, nextBtn));
  overlay.append(peekBar);
  const onKey = (e: KeyboardEvent) => {
    if (!overlay.isConnected || overlay.hidden) return document.removeEventListener('keydown', onKey);
    if (e.key === 'h' || e.key === 'H') set(!overlay.classList.contains('peek'));
  };
  document.addEventListener('keydown', onKey);
  function set(hide: boolean) {
    overlay.classList.toggle('peek', hide);
    hideBtn.setAttribute('aria-expanded', String(!hide));
    if (hide) {
      o.onHide?.();
      showBtn.focus({ preventScroll: true });
    } else {
      o.onShow?.();
      hideBtn.focus({ preventScroll: true });
    }
  }
  return hideBtn;
}

/**
 * The part of the screen left open for the table beside or above the summary
 * (client px): left of a panel docked at the right, or above the bar when the
 * summary is hidden, below the top HUD row either way.
 */
export function openArea(overlay: HTMLElement, card: HTMLElement): { left: number; top: number; right: number; bottom: number } {
  const w = window.innerWidth,
    hgt = window.innerHeight;
  const box = (sel: string) => {
    const el = document.querySelector<HTMLElement>(sel);
    return el && !el.hidden && el.offsetParent ? el.getBoundingClientRect() : null;
  };
  // Keep the hand clear of the side seat plates, your own plate and tray below, and the top row.
  const leftPlate = box('.hud .seat-3'),
    rightPlate = box('.hud .seat-1'),
    myPlate = box('.hud .seat-0'),
    tray = box('.hud .tray');
  const portrait = hgt > w;
  const top = Math.min(hgt * 0.2, 84);
  // Side plates matter only where they stand beside the hand (not on a portrait phone, where they sit mid-table).
  let left = !portrait && leftPlate && leftPlate.right < w * 0.4 ? leftPlate.right + 8 : 12;
  let right = !portrait && rightPlate && rightPlate.left > w * 0.6 ? rightPlate.left - 8 : w - 12;
  let bottom = Math.min(tray?.top ?? hgt, myPlate && myPlate.top > hgt * 0.55 ? myPlate.top : hgt) - 8;
  // A landscape phone keeps your hand along the bottom of the screen.
  if (hgt <= 500) bottom = Math.min(bottom, hgt * 0.7);
  if (overlay.classList.contains('peek')) {
    const bar = overlay.querySelector<HTMLElement>('.peek-bar')?.getBoundingClientRect();
    if (bar) bottom = Math.min(bottom, bar.top - 8);
  } else {
    const r = card.getBoundingClientRect();
    if (r.width && r.left > w * 0.35) right = Math.min(right, r.left - 16);
  }
  // A plate on a narrow screen can leave too little room: then let the hand pass behind it.
  if (right - left < w * 0.3) left = 12;
  return { left, top, right, bottom: Math.max(bottom, top + 120) };
}
