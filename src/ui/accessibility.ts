// Accessibility settings: suit-marked tiles, colour-blind-safe and high-contrast
// faces, large tiles for your hand, haptic taps and reduced motion. Kept per
// device (like the voice and view settings), under their own storage key, and
// shown as the Accessibility group in Settings.

import { setFaceAccess } from '../render/tileFaces';
import { setHandTileScale, setReduceMotionSetting } from '../render/tileAccess';
import { h } from './dom';
import './accessibility.css';
import { tr } from '../i18n';

const KEY = 'jongclub.a11y.v1';

export interface A11ySettings {
  /** Corner index with number and suit mark on every face. */
  suitMarks: boolean;
  /** Colour-blind-safe suit inks. */
  colourSafe: boolean;
  /** Plain bright faces with dark ink. */
  highContrast: boolean;
  /** Bigger tiles in your own hand (phone tray and 3D rack). */
  largeTiles: boolean;
  /** A short buzz when it is your turn or you can claim (phones that support it). */
  haptics: boolean;
  /** Less movement everywhere, even if the device does not ask for it. */
  reduceMotion: boolean;
}

export const A11Y_DEFAULTS: A11ySettings = { suitMarks: false, colourSafe: false, highContrast: false, largeTiles: false, haptics: true, reduceMotion: false };

/** Scale of your hand in large-tile mode: the phone tray (CSS) and the 3D rack. */
export const LARGE_TRAY_SCALE = 1.25;
export const LARGE_RACK_SCALE = 1.15;

/** Read stored settings, keeping only known boolean fields (anything else falls back to defaults). */
export function parseA11y(raw: string | null | undefined): A11ySettings {
  const out = { ...A11Y_DEFAULTS };
  if (!raw) return out;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (!v || typeof v !== 'object') return out;
    for (const k of Object.keys(out) as (keyof A11ySettings)[]) if (typeof v[k] === 'boolean') out[k] = v[k] as boolean;
  } catch {
    /* defaults */
  }
  return out;
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const storage = (): Store | null => {
  try {
    return localStorage;
  } catch {
    return null;
  }
};

export function loadA11y(store: Store | null = storage()): A11ySettings {
  try {
    return parseA11y(store?.getItem(KEY));
  } catch {
    return { ...A11Y_DEFAULTS };
  }
}

export function saveA11y(s: A11ySettings, store: Store | null = storage()) {
  try {
    store?.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** The settings in force on this device. */
export const a11y: A11ySettings = loadA11y();

/** Whether the device itself asks for less motion. */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Put the settings into effect: tile faces, hand scale, page classes. Returns whether faces changed. */
export function applyA11y(s: A11ySettings = a11y): boolean {
  const faces = { suitMarks: s.suitMarks, colourSafe: s.colourSafe, highContrast: s.highContrast };
  const key = JSON.stringify(faces);
  const changed = key !== appliedFaces;
  if (changed) {
    appliedFaces = key;
    setFaceAccess(faces);
  }
  setHandTileScale(s.largeTiles ? LARGE_RACK_SCALE : 1);
  setReduceMotionSetting(s.reduceMotion);
  const root = document.documentElement;
  root.classList.toggle('a11y-large-tiles', s.largeTiles);
  root.classList.toggle('a11y-reduce-motion', s.reduceMotion);
  root.style.setProperty('--hand-tile-scale', String(s.largeTiles ? LARGE_TRAY_SCALE : 1));
  return changed;
}
let appliedFaces = JSON.stringify({ suitMarks: false, colourSafe: false, highContrast: false });

if (typeof document !== 'undefined') applyA11y();

// ------------------------------------------------------------ haptics

/** Vibration patterns (ms): a single short tap for your turn, a double tap for a claim. */
export const HAPTIC_PATTERNS = { turn: [18], claim: [14, 70, 14] } as const;

export const hapticsSupported = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

/** A short tap on phones that support it, when haptics are on. Never throws. */
export function haptic(kind: keyof typeof HAPTIC_PATTERNS) {
  if (!a11y.haptics || !hapticsSupported()) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  try {
    navigator.vibrate([...HAPTIC_PATTERNS[kind]]);
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------ Settings

/** Settings' segmented control, passed in so the rows look and behave like the rest. */
type Seg = <T extends string>(id: string, label: string, opts: [T, string][], value: T, set: (v: T) => void) => HTMLElement;

export interface A11yHost {
  /** Redraw tile faces on the table (after a face option changes). */
  refreshFaces(): void;
  /** Lay the table out again (after the hand scale changes). */
  relayout(): void;
}

/** The Accessibility group for Settings. */
export function accessibilityRows(seg: Seg, host: A11yHost): HTMLElement[] {
  const set = (k: keyof A11ySettings, on: boolean) => {
    a11y[k] = on;
    saveA11y(a11y);
    if (applyA11y()) host.refreshFaces();
    if (k === 'largeTiles') host.relayout();
  };
  const toggle = (k: keyof A11ySettings, id: string, label: string, tip: string) => {
    const row = seg(id, label, [['on', tr('On')], ['off', tr('Off')]], a11y[k] ? 'on' : 'off', (v) => set(k, v === 'on'));
    row.querySelector('span')?.setAttribute('title', tip);
    return row;
  };
  const rows: HTMLElement[] = [
    h('h4', { class: 'settings-group' }, tr('Accessibility')),
    toggle('suitMarks', 'a11y-marks', tr('Suit-marked tiles'), tr('A small corner index on every tile: the number and a suit sign, such as 5● for dots, 3║ for bamboo and 7万 for characters.')),
    toggle('colourSafe', 'a11y-colour', tr('Colour-blind-safe suits'), tr('Suit colours that stay distinct with red-green colour blindness. Pair with suit-marked tiles so shape tells suits apart too.')),
    toggle('highContrast', 'a11y-contrast', tr('High-contrast tiles'), tr('Plain bright tile faces with bold, dark ink.')),
    toggle('largeTiles', 'a11y-large', tr('Large tiles in my hand'), tr('Bigger tiles in your own hand, on the phone tray and on the table rack.')),
  ];
  if (hapticsSupported()) rows.push(toggle('haptics', 'a11y-haptics', tr('Haptic taps'), tr('A short buzz when it is your turn, and a double tap when you can claim a discard.')));
  rows.push(
    toggle(
      'reduceMotion',
      'a11y-motion',
      tr('Reduce motion'),
      prefersReducedMotion() ? tr('Your device already asks for less motion, so the club keeps movement to a minimum.') : tr('Fewer moving effects: no camera sweeps, particles or sliding panels.'),
    ),
  );
  return rows;
}
