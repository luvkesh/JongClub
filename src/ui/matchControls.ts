// The match screen's control layout (src/ui/matchControls.css):
// - 'console' (landscape tablets and desktops): the table narrows and a side console on the right holds the
//   round, the last discard, your hand's status and tools, the possible passports, JongBot and Mei.
// - 'phone' (upright screens): one header plate, a row of hand tools under your tiles and a dock bar
//   (Your hand, JongBot, Tutor, More) at the foot, all within thumb reach.
// - 'classic' (landscape phones and small windows): the earlier floating layout.
// JongBot's card and Mei's guide can be dragged anywhere by their grip; the place is remembered per layout.
import { tr } from '../i18n';
import { h } from './dom';
import { icon } from './icons';

export type HudMode = 'phone' | 'console' | 'classic';

/** The console's width for a W x H window (0 when the window has no room for one). */
export function consoleWidth(W: number, H: number): number {
  if (W / H < 0.85 || H <= 500 || W < 900) return 0;
  const w = Math.round(Math.min(380, Math.max(280, W * 0.25)));
  // The table keeps a landscape shape (the 3D view switches to its upright framing below 0.85).
  return (W - w) / H >= 0.95 ? w : 0;
}

export function hudMode(W = window.innerWidth, H = window.innerHeight): HudMode {
  if (W / H < 0.85) return 'phone';
  return consoleWidth(W, H) ? 'console' : 'classic';
}

// ------------------------------------------------------------ draggable cards

const STORE = 'jongclub.cards.v1';
type Spot = { x: number; y: number };

function readSpots(): Record<string, Spot> {
  try {
    return JSON.parse(localStorage.getItem(STORE) || '{}') as Record<string, Spot>;
  } catch {
    return {};
  }
}
function writeSpot(key: string, spot: Spot | null) {
  try {
    const all = readSpots();
    if (spot) all[key] = spot;
    else delete all[key];
    localStorage.setItem(STORE, JSON.stringify(all));
  } catch {
    /* private window: the card just goes back to its place next time */
  }
}

/** Put a moved card back inside the window (after a resize, or as it is dragged). */
function placeAt(card: HTMLElement, x: number, y: number) {
  const r = card.getBoundingClientRect();
  const W = window.innerWidth;
  const H = window.innerHeight;
  const left = Math.round(Math.min(Math.max(4, x), Math.max(4, W - r.width - 4)));
  const top = Math.round(Math.min(Math.max(4, y), Math.max(4, H - Math.min(r.height, 60) - 4)));
  card.style.setProperty('--fx', `${left}px`);
  card.style.setProperty('--fy', `${top}px`);
  return { left, top };
}

/** Restore (or clear) a card's moved place for this layout. */
export function restoreCard(card: HTMLElement, key: string) {
  const spot = readSpots()[key];
  card.classList.toggle('floating', !!spot);
  if (!spot) {
    card.style.removeProperty('--fx');
    card.style.removeProperty('--fy');
    return;
  }
  placeAt(card, spot.x * window.innerWidth, spot.y * window.innerHeight);
}

const GRIP = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>';

/**
 * A grip that moves `card` anywhere on screen. A double tap (or Enter) on the grip puts it back in its place.
 * `key()` names the layout, so a card moved on a phone doesn't move on the desktop.
 */
export function cardGrip(card: HTMLElement, key: () => string, onMove?: () => void): HTMLElement {
  const g = h('button', { type: 'button', class: 'card-grip', title: tr('Drag to move this card. Double-tap to put it back.'), 'aria-label': tr('Move this card'), html: GRIP });
  let start: { px: number; py: number; x: number; y: number; id: number } | null = null;
  let moved = false;
  g.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const r = card.getBoundingClientRect();
    start = { px: e.clientX, py: e.clientY, x: r.left, y: r.top, id: e.pointerId };
    moved = false;
    g.setPointerCapture(e.pointerId);
  });
  g.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.px;
    const dy = e.clientY - start.py;
    if (!moved && Math.hypot(dx, dy) < 4) return;
    if (!moved) {
      // Pin the card where it is now, then follow the pointer.
      placeAt(card, start.x, start.y);
      card.classList.add('floating', 'dragging');
      moved = true;
    }
    placeAt(card, start.x + dx, start.y + dy);
  });
  const end = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.id) return;
    start = null;
    card.classList.remove('dragging');
    if (!moved) return;
    const r = card.getBoundingClientRect();
    writeSpot(key(), { x: r.left / window.innerWidth, y: r.top / window.innerHeight });
    onMove?.();
  };
  g.addEventListener('pointerup', end);
  g.addEventListener('pointercancel', end);
  const reset = () => {
    writeSpot(key(), null);
    restoreCard(card, key());
    onMove?.();
  };
  g.addEventListener('dblclick', (e) => (e.stopPropagation(), reset()));
  g.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), reset()));
  g.addEventListener('click', (e) => e.stopPropagation());
  return g;
}

// ------------------------------------------------------------ More options grid

export interface GridItem {
  label: string;
  icon: string;
  act: () => void;
  on?: boolean;
  /** Keep the sheet open after the tap (toggles). */
  stay?: boolean;
}

/** The More options sheet: round icon buttons in a three-column grid, with an optional row on top (the view controls). */
export function moreSheet(items: GridItem[], top: HTMLElement | null, close: () => void): HTMLElement {
  const grid = h('div', { class: 'more-grid', role: 'menu' });
  for (const it of items) {
    const b = h(
      'button',
      { type: 'button', class: `more-item${it.on ? ' on' : ''}`, role: 'menuitem', 'aria-pressed': it.on === undefined ? null : String(it.on) },
      h('span', { class: 'more-ico', html: it.icon.startsWith('<') ? it.icon : icon(it.icon) }),
      h('span', { class: 'more-lbl' }, it.label),
    );
    b.onclick = () => {
      it.act();
      if (!it.stay) close();
    };
    grid.append(b);
  }
  return h(
    'div',
    { class: 'more-sheet', role: 'dialog', 'aria-label': tr('More options') },
    h('div', { class: 'more-head' }, h('span', { class: 'more-title' }, tr('More options')), h('button', { type: 'button', class: 'more-close', 'aria-label': tr('Close'), onclick: close, html: icon('close') })),
    top,
    grid,
  );
}

/** One button of the phone dock bar: a round icon, a title and a live second line. */
export function dockButton(cls: string, ico: string, title: string, onclick: () => void) {
  const sub = h('span', { class: 'db-sub' });
  const el = h('button', { type: 'button', class: `dock-btn ${cls}`, onclick }, h('span', { class: 'db-ico', html: ico.startsWith('<') ? ico : icon(ico) }), h('span', { class: 'db-text' }, h('span', { class: 'db-title' }, title), sub));
  return { el, sub };
}
