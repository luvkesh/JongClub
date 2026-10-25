// Tiny DOM helpers. The UI is plain TypeScript; no framework needed for Phase 1.

import { tileLabel } from '../i18n/tiles';
import { faceUrl } from '../render/tileFaces';
import { devWaitScale } from '../dev/devMode';
import { tr } from '../i18n';

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'html') el.innerHTML = String(v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

/** A tile face as an image, in the equipped tile set. `red` draws a red (aka) five. */
export function tileImg(kind: number, cls = '', labels = true, red = false): HTMLImageElement {
  const name = tileLabel(kind, red);
  return h('img', { class: `tile2d ${cls}`, src: faceUrl(kind, labels, red), alt: name, title: name, 'data-tile': String(kind), 'data-red': red ? '' : null, draggable: 'false' });
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms * devWaitScale()));

export function clear(el: HTMLElement) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function fmt(n: number) {
  return Math.round(n).toLocaleString('en-US');
}

/** Copy text, falling back to a hidden textarea where the clipboard API is blocked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { readonly: true, style: { position: 'fixed', top: '-1000px', opacity: '0' } });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

let noteTimer = 0;
/** A short confirmation at the bottom of the screen ("Copied to clipboard"). */
export function flashNote(text: string, bad = false) {
  let el = document.querySelector<HTMLElement>('.flash-note');
  if (!el) document.body.append((el = h('div', { class: 'flash-note', role: 'status', 'aria-live': 'polite' })));
  el.textContent = text;
  el.classList.toggle('bad', bad);
  el.classList.add('on');
  clearTimeout(noteTimer);
  noteTimer = window.setTimeout(() => el!.classList.remove('on'), 2200);
}

/** Copy, then confirm on the button and with a note. */
export async function copyWithNote(btn: HTMLButtonElement | null, text: string, label = tr('Copy')) {
  const ok = await copyText(text);
  flashNote(ok ? tr('Copied to clipboard') : text.length < 12 ? tr('Couldn’t copy. The code is {code}', { code: text }) : tr('Couldn’t copy. Your browser blocked the clipboard.'), !ok);
  if (!btn) return ok;
  btn.textContent = ok ? tr('Copied ✓') : tr('Copy failed');
  btn.classList.toggle('done', ok);
  setTimeout(() => ((btn.textContent = label), btn.classList.remove('done')), 2000);
  return ok;
}
