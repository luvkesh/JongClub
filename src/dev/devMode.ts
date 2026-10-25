// Labs (developer mode): testing aids behind the flask button beside Settings.
// In this preview build the button shows by default; LABS_PREVIEW = false hides
// it before a public launch, and seven taps on the version line in Settings
// still bring it back. The switches here are read by the table (show every
// hand) and by the match loop (AI thinking time, animation speed). Saved per device.

/** Preview builds show the Labs button until someone hides it. Set false for a public launch. */
export const LABS_PREVIEW = true;

export interface DevState {
  /** The Labs button is showing. */
  enabled: boolean;
  /** Show every player's hand face up at the table. */
  showHands: boolean;
  /** How much faster AI players think: 1 normal, 4 fast, 20 instant. */
  aiSpeed: number;
  /** How much faster tiles move: 1 normal, 3 fast, 8 instant. */
  animSpeed: number;
  /** Frame rate and frame time overlay (dev/fps.ts). */
  fps?: boolean;
}

const KEY = 'jongclub.dev.v1';
const DEFAULTS: DevState = { enabled: LABS_PREVIEW, showHands: false, aiSpeed: 1, animSpeed: 1 };

function load(): DevState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* defaults */
  }
  return { ...DEFAULTS };
}

export const dev: DevState = load();

export function saveDev() {
  try {
    localStorage.setItem(KEY, JSON.stringify(dev));
  } catch {
    /* ignore */
  }
}

const listeners = new Set<() => void>();
/** Hear when the Labs button is shown or hidden. */
export function onDevChange(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** Hiding Labs also turns its table aids off. */
export function setDevEnabled(on: boolean) {
  Object.assign(dev, on ? { enabled: true } : { ...DEFAULTS, enabled: false });
  saveDev();
  for (const fn of listeners) fn();
}

/** Multiplier for waits in the match loop (AI thinking, pauses). */
export const devWaitScale = () => (dev.enabled && dev.aiSpeed > 1 ? 1 / dev.aiSpeed : 1);
/** Multiplier for tile animation durations. */
export const devAnimScale = () => (dev.enabled && dev.animSpeed > 1 ? 1 / dev.animSpeed : 1);
/** Seats to show face up because developer mode asks for every hand. */
export const devRevealAll = (seats: number): number[] => (dev.enabled && dev.showHands ? Array.from({ length: seats }, (_, i) => i) : []);
