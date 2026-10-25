// The camera is moved on the table itself, like most 3D games: drag up or down
// to tilt, left or right to slide the view (up to a tenth of the screen either
// way), and pinch or scroll to zoom. All that stays on screen is a Split view
// toggle (where the hand is on the 3D rack), a small reset button shown only
// once the view has been moved, and a one-time hint.

import type { TableRenderer } from '../render/table3d';
import './viewControls.css';
import { tr } from '../i18n';

const RESET_ICON = '<path d="M5.5 12a6.5 6.5 0 1 0 2-4.7"/><path d="M5 4.5v3.5h3.5"/>';
const SPLIT_ICON = '<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M3.5 13.5h17"/><path d="M7 16.8h2.2M10.9 16.8h2.2M14.8 16.8h2.2"/>';
const HINT_KEY = 'jongclub.viewHint.v1';

/** The view control for a table: a reset button that appears once the camera has moved. */
export function viewControls(table: TableRenderer): HTMLElement {
  const root = document.createElement('div');
  root.className = 'view-controls';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', tr('Table view'));

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'vc-btn vc-reset';
  reset.setAttribute('aria-label', tr('Reset view'));
  reset.title = `${tr('Reset the view')}. ${tr('Drag the table to tilt and look around. Pinch or scroll to zoom.')}`;
  reset.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${RESET_ICON}</svg>`;
  reset.addEventListener('click', () => table.resetView());
  // Split view: the board above, your hand close up in a strip below (tablets and desktops).
  const split = document.createElement('button');
  split.type = 'button';
  split.className = 'vc-btn vc-split';
  split.setAttribute('aria-label', tr('Split view'));
  split.title = tr('Show your hand up close below the table');
  split.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${SPLIT_ICON}</svg>`;
  split.addEventListener('click', () => table.setSplitPref(table.splitView ? 'off' : 'on'));
  root.append(split, reset);

  const update = () => {
    const changed = table.viewChanged;
    reset.disabled = !changed;
    root.classList.toggle('adjusted', changed);
    const canSplit = !table.tray;
    split.hidden = !canSplit;
    root.classList.toggle('can-split', canSplit);
    split.setAttribute('aria-pressed', String(table.splitView));
    split.classList.toggle('on', table.splitView);
  };
  update();
  let seen = false;
  const off = table.addViewListener(() => {
    // Unsubscribe once the control has been mounted and then removed.
    if (root.isConnected) seen = true;
    else if (seen) return off();
    update();
    if (table.viewChanged) markHintSeen();
  });
  showHintOnce(root);
  keepLabelsClearOfHand(table, root);
  return root;
}

function hintSeen() {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return true;
  }
}

function markHintSeen() {
  try {
    localStorage.setItem(HINT_KEY, '1');
  } catch {
    /* storage unavailable */
  }
  document.querySelectorAll('.vc-hint').forEach((n) => n.classList.add('gone'));
}

/** The first time a table is shown, say once how to move the camera. */
function showHintOnce(root: HTMLElement) {
  if (hintSeen()) return;
  window.setTimeout(() => {
    // Only the cluster on the table (not the copy in the phone drawer) shows it.
    if (!root.isConnected || root.closest('.hud-drawer') || hintSeen()) return;
    const hud = root.closest('.hud') ?? document.body;
    if (hud.querySelector('.vc-hint')) return;
    const hint = document.createElement('div');
    hint.className = 'vc-hint';
    hint.setAttribute('role', 'status');
    hint.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg><span></span>`;
    hint.querySelector('span')!.textContent = tr('Drag the table to tilt and look around. Pinch or scroll to zoom.');
    hud.append(hint);
    const done = () => {
      markHintSeen();
      window.setTimeout(() => hint.remove(), 600);
    };
    hint.addEventListener('click', done);
    window.setTimeout(done, 6500);
  }, 2500);
}

/**
 * Keep the hand's status line and chips above your rack whatever the zoom,
 * tilt or pan: the table reports the rack's top edge on screen and the HUD gets
 * --hand-clear, the distance from the HUD's bottom edge to just above the rack.
 */
function keepLabelsClearOfHand(table: TableRenderer, root: HTMLElement) {
  let last: number | null = null;
  let mounted = false;
  const apply = () => {
    const hud = root.closest<HTMLElement>('.hud');
    // Only the copy on the table itself steers the labels (not the one in the phone drawer).
    if (!hud || root.closest('.hud-drawer')) return;
    if (last === null) {
      hud.removeAttribute('data-hand-clear');
      return;
    }
    const bottom = hud.getBoundingClientRect().bottom;
    hud.style.setProperty('--hand-clear', `${Math.max(0, Math.round(bottom - last + 8))}px`);
    hud.setAttribute('data-hand-clear', '');
  };
  const off = table.addHandTopListener((top) => {
    last = top;
    if (root.isConnected) {
      mounted = true;
      apply();
    } else if (mounted) off();
  });
  // The first report can arrive before the control is on the page.
  requestAnimationFrame(apply);
}
