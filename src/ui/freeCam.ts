// After a hand, the camera is the player's: they can circle the table and look
// at every revealed hand (TableRenderer.setFreeCamera). This is the hint that
// says how, shown over the open table until the player has moved the camera once.

import type { TableRenderer } from '../render/table3d';
import { tr } from '../i18n';
import './freeCam.css';

const HINT_KEY = 'jongclub.freeCamHint.v1';
const MOVE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>';

function seen() {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return true;
  }
}

/** Turn the free camera on for a hand's result, with a one-time hint in the overlay. Returns the switch-off. */
export function startFreeCamera(table: TableRenderer, overlay: HTMLElement): () => void {
  table.setFreeCamera(true);
  let hints: HTMLElement[] = [];
  const drop = () => {
    const els = hints;
    hints = [];
    for (const el of els) {
      el.classList.add('gone');
      window.setTimeout(() => el.remove(), 500);
    }
  };
  // The keys steer the camera only while the table is in view: the summary hidden, or docked beside it.
  const docked = window.matchMedia?.('(min-width: 900px) and (min-height: 501px)');
  table.freeKeysAllowed = () => overlay.classList.contains('peek') || (overlay.classList.contains('win-sheet') && !!docked?.matches);
  table.onFreeMove = () => {
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      /* storage unavailable */
    }
    drop();
  };
  if (!seen()) {
    const keys = window.matchMedia?.('(pointer: fine)').matches ?? true;
    const text = keys
      ? tr('Look around the table: drag to circle it, scroll to zoom. W A S D or the arrow keys move, Q and E turn, R goes back.')
      : tr('Look around the table: drag to circle it, two fingers to slide, pinch to zoom.');
    const make = (where: string) => {
      const el = document.createElement('div');
      el.className = `free-cam-hint ${where}`;
      el.innerHTML = `${MOVE_ICON}<span></span>`;
      el.querySelector('span')!.textContent = text;
      return el;
    };
    // One copy over the open table beside a docked summary, one in the bar the summary folds into.
    // The bar is built right after this, in the same task.
    window.setTimeout(() => {
      if (!overlay.classList.contains('free-cam')) return;
      const table = make('on-table');
      table.setAttribute('role', 'status');
      overlay.append(table);
      hints.push(table);
      const bar = overlay.querySelector('.peek-bar');
      if (bar) {
        const inBar = make('in-bar');
        bar.prepend(inBar);
        hints.push(inBar);
      }
    });
    window.setTimeout(drop, 12000);
  }
  return () => {
    drop();
    table.onFreeMove = undefined;
    table.freeKeysAllowed = undefined;
    table.setFreeCamera(false);
  };
}
