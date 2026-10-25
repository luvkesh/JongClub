// Labs: a frame-rate meter for checking smoothness on your own device. The
// cloud test machines draw with software GL, so only a real screen and GPU can
// say whether the table holds 60 fps. Reads the table's per-second numbers
// (TableRenderer.perf), so it costs nothing while hidden.

import { dev } from './devMode';

const QUALITY_KEY = 'jongclub.quality.v1';

interface Perf {
  fps: number;
  avgMs: number;
  worstMs: number;
  level: number;
  pixelRatio: number;
  calls: number;
  triangles: number;
  tier: string;
  moving: boolean;
}

let box: HTMLElement | null = null;
let timer = 0;

function perf(): Perf | undefined {
  return (window as unknown as { jongclub?: { table?: { perf?: Perf } } }).jongclub?.table?.perf;
}

/** Show or hide the meter (top left, above everything, ignores the pointer). */
export function fpsMeter(on: boolean) {
  if (!on) {
    window.clearInterval(timer);
    box?.remove();
    box = null;
    return;
  }
  if (box) return;
  box = document.createElement('div');
  box.setAttribute('aria-hidden', 'true');
  Object.assign(box.style, {
    position: 'fixed', left: '6px', top: 'calc(env(safe-area-inset-top, 0px) + 6px)', zIndex: '2147483000', pointerEvents: 'none',
    font: '500 11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace', color: '#f4efe4', background: 'rgba(0,0,0,0.62)',
    padding: '4px 7px', borderRadius: '6px', whiteSpace: 'pre',
  });
  document.body.append(box);
  const paint = () => {
    const p = perf();
    if (!box) return;
    if (!p || !p.fps) {
      box.textContent = 'fps —';
      return;
    }
    // Moving: the full-rate cap is 60. Still: the table deliberately draws about 30 a second.
    const cap = p.moving ? 60 : 30;
    box.style.color = p.fps >= cap * 0.92 ? '#9fe0b4' : p.fps >= cap * 0.75 ? '#f2cf86' : '#ff9a8a';
    box.textContent =
      `${p.fps.toFixed(0)} fps ${p.moving ? '(moving)' : '(still, 30 cap)'}\n` +
      `${p.avgMs.toFixed(1)} ms avg · ${p.worstMs.toFixed(0)} ms worst\n` +
      `${p.tier} · step ${p.level} · ${p.pixelRatio.toFixed(2)}x\n` +
      `${p.calls} draws · ${(p.triangles / 1000).toFixed(0)}k tris`;
  };
  paint();
  timer = window.setInterval(paint, 500);
}

/** The render quality forced in Labs ('auto' when the device picks). */
export function forcedQuality(): string {
  try {
    return localStorage.getItem(QUALITY_KEY) ?? 'auto';
  } catch {
    return 'auto';
  }
}

export function setForcedQuality(v: string) {
  try {
    if (v === 'auto') localStorage.removeItem(QUALITY_KEY);
    else localStorage.setItem(QUALITY_KEY, v);
  } catch {
    /* storage unavailable */
  }
  location.reload();
}

// Restore the meter after a reload.
if (typeof window !== 'undefined' && dev.fps) window.setTimeout(() => fpsMeter(true), 1500);
