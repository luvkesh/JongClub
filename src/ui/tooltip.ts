// The club's own tooltip: a small lacquered plaque with a brass rim, used for
// every hint in the game instead of the browser's plain title boxes.
// installTooltips() takes over every element with a title (or data-tip): the
// native title is moved to data-tip so the browser box never appears.
// Tiles can show a plaque with the tile's face and name (showTile), which the
// 3D table uses for tiles under the pointer.

import { tileLabel } from '../i18n/tiles';
import { faceUrl } from '../render/tileFaces';
import './tooltip.css';

let el: HTMLDivElement | null = null;
let owner: Element | null = null;
let timer = 0;

function plaque() {
  if (!el) {
    el = document.createElement('div');
    el.className = 'mj-tip';
    el.setAttribute('role', 'tooltip');
    el.hidden = true;
    document.body.append(el);
  }
  return el;
}

function place(x: number, y: number, below = false) {
  const p = plaque();
  const r = p.getBoundingClientRect();
  const pad = 8;
  let left = x - r.width / 2;
  let top = below ? y + 14 : y - r.height - 14;
  if (top < pad) top = y + 18;
  left = Math.max(pad, Math.min(window.innerWidth - r.width - pad, left));
  top = Math.max(pad, Math.min(window.innerHeight - r.height - pad, top));
  p.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}

/** Show a text plaque at a screen point (above it unless there is no room). */
export function showTip(text: string, x: number, y: number) {
  const p = plaque();
  p.className = 'mj-tip';
  p.textContent = text;
  p.hidden = false;
  place(x, y);
  p.classList.add('on');
}

/** Show a tile's face and name at a screen point. */
export function showTile(kind: number, x: number, y: number, opts: { red?: boolean; note?: string; labels?: boolean } = {}) {
  const p = plaque();
  p.className = 'mj-tip tile';
  p.replaceChildren();
  const img = document.createElement('img');
  img.src = faceUrl(kind, opts.labels ?? true, opts.red);
  img.alt = '';
  const name = document.createElement('b');
  name.textContent = tileLabel(kind, opts.red);
  p.append(img, name);
  if (opts.note) {
    const n = document.createElement('small');
    n.textContent = opts.note;
    p.append(n);
  }
  p.hidden = false;
  place(x, y);
  p.classList.add('on');
}

export function hideTip() {
  window.clearTimeout(timer);
  owner = null;
  if (el) {
    el.classList.remove('on');
    el.hidden = true;
  }
}

function tipOf(t: Element | null): Element | null {
  // Tests and quizzes (data-no-tips): a tile's name would give the answer away.
  const quiet = t?.closest?.('[data-no-tips]');
  if (quiet) {
    // Drop the native title too, or the browser shows its own name box.
    for (let n: Element | null = t; n && n !== quiet.parentElement; n = n.parentElement) n.removeAttribute('title');
    return null;
  }
  for (let n = t; n && n !== document.body; n = n.parentElement) {
    if (n.hasAttribute('title')) {
      const v = n.getAttribute('title')!;
      n.removeAttribute('title');
      if (v) {
        n.setAttribute('data-tip', v);
        if (!n.hasAttribute('aria-label') && !n.textContent?.trim()) n.setAttribute('aria-label', v);
      }
    }
    if (n.hasAttribute('data-tip')) return n;
  }
  return null;
}

function showFor(n: Element) {
  const text = n.getAttribute('data-tip');
  if (!text) return;
  const r = n.getBoundingClientRect();
  const kind = n.getAttribute('data-tile');
  if (kind !== null) showTile(Number(kind), r.left + r.width / 2, r.top, { red: n.hasAttribute('data-red') });
  else showTip(text, r.left + r.width / 2, r.top);
  // Near the top of the screen, sit below instead.
  if (r.top < 60) place(r.left + r.width / 2, r.bottom, true);
}

/** Replace native title tooltips everywhere with the club's plaque. */
export function installTooltips() {
  document.addEventListener('pointerover', (e) => {
    const n = tipOf(e.target as Element);
    if (n === owner) return;
    hideTip();
    if (!n) return;
    owner = n;
    // Touch shows on a long press; mouse after a short pause.
    timer = window.setTimeout(() => owner === n && n.isConnected && showFor(n), e.pointerType === 'touch' ? 450 : 260);
  });
  document.addEventListener('pointerout', (e) => {
    if (owner && !owner.contains(e.relatedTarget as Node)) hideTip();
  });
  document.addEventListener('focusin', (e) => {
    const n = tipOf(e.target as Element);
    if (n && (e.target as HTMLElement).matches(':focus-visible')) {
      owner = n;
      showFor(n);
    }
  });
  document.addEventListener('focusout', hideTip);
  document.addEventListener('pointerdown', hideTip, true);
  // Touch has no hover: in settings-like panels ([data-tap-tips]) a tap shows the
  // option's plaque for a few seconds, so choosing it also says what it changes.
  document.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch' || !(e.target as Element)?.closest?.('[data-tap-tips]')) return;
    const n = tipOf(e.target as Element);
    if (!n) return;
    window.clearTimeout(timer);
    owner = n;
    showFor(n);
    timer = window.setTimeout(() => owner === n && hideTip(), 3600);
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && hideTip());
  window.addEventListener('scroll', hideTip, true);
  // Titles added later (screens are rebuilt often) are converted lazily on hover.
}
