// Render quality tiers. Picked once from the device (screen, pixel density,
// cores, GPU string) and stepped down at run time if frames run long, so
// phones and integrated GPUs stay smooth while desktops get the full room.
//
// For any new 3D view (mini-game boards and the like), to hold 60 fps:
// - Read the tier from the table (TableRenderer.quality) instead of detecting again,
//   and size textures, shadow maps and particle counts from QualitySpec.
// - Draw at most ~60 frames a second while something moves and ~30 while still,
//   and feed full-rate frame times to a FrameGovernor (below) so resolution,
//   shadow refresh and effects step down on slow devices and come back up.
// - Many identical pieces (tiles, stones, cards): share one geometry and material
//   and use InstancedMesh, or a few materials, rather than one material per piece.
//   Every mesh that casts a shadow is drawn again in the shadow pass.
// - Compile shaders and upload textures before play (renderer.compileAsync,
//   renderer.initTexture), and never draw canvases or encode images mid-animation.
// - No backdrop-filter blur over a live canvas; it is recomputed every frame.

import * as THREE from 'three';

export type QualityTier = 'low' | 'medium' | 'high';

export interface QualitySpec {
  tier: QualityTier;
  /** Upper bound for renderer pixel ratio. */
  maxPixelRatio: number;
  shadowMap: number;
  shadowType: THREE.ShadowMapType;
  /** Room set pieces beyond the essentials (props, lamp beam, extra bokeh). */
  props: boolean;
  /** Canvas resolution of painted room textures. */
  paint: 1 | 2;
  dust: number;
  /**
   * Tile face detail in pixels per face unit (faces are 192x256 units): 4.5
   * gives 864x1152 faces, three times the old 1.5; phones draw less to save
   * memory (about 1 MB per face kind at 2.25, 4 MB at 4.5).
   */
  faceScale: number;
  /** Anisotropic filtering for tile faces seen at a slant (capped by the GPU). */
  anisotropy: number;
}

const SPECS: Record<QualityTier, Omit<QualitySpec, 'tier'>> = {
  high: { maxPixelRatio: 2, shadowMap: 2048, shadowType: THREE.PCFSoftShadowMap, props: true, paint: 2, dust: 260, faceScale: 4.5, anisotropy: 16 },
  medium: { maxPixelRatio: 1.5, shadowMap: 1024, shadowType: THREE.PCFSoftShadowMap, props: true, paint: 2, dust: 160, faceScale: 3, anisotropy: 16 },
  low: { maxPixelRatio: 1.25, shadowMap: 1024, shadowType: THREE.PCFShadowMap, props: false, paint: 1, dust: 90, faceScale: 2.25, anisotropy: 8 },
};

export const qualitySpec = (tier: QualityTier): QualitySpec => ({ tier, ...SPECS[tier] });

const QUALITY_KEY = 'jongclub.quality.v1';

/** How long a dropped graphics context keeps the game drawing lean. */
const GPU_LOST_DAYS = 3;

/**
 * Whether the browser dropped the graphics context (out of memory) in the last few days (table3d
 * stores the time). The old '1' flag was set for good, mostly by the face-texture freeze fixed long
 * ago, and left iPads drawing soft tiles for ever after; it no longer counts.
 */
export function gpuLostRecently(): boolean {
  try {
    const v = localStorage.getItem('jongclub.gpuLost');
    if (!v) return false;
    const at = Number(v);
    if (v === '1' || !(at > 0) || Date.now() - at > GPU_LOST_DAYS * 86_400_000) {
      localStorage.removeItem('jongclub.gpuLost');
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Lean graphics: devices with 4 GB or less, or after the browser recently dropped the graphics context (table3d). */
export function leanGraphics(): boolean {
  try {
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    return mem <= 4 || gpuLostRecently();
  } catch {
    return false;
  }
}

/**
 * The detail every tile face is drawn at for this tier. Lean devices keep faces at 2.25 (still 1.5x
 * the original faces): about 1.3 MB of graphics memory per face instead of 2.4 MB (medium) or 5.3 MB (high).
 */
export const tierFaceDetail = (q: QualitySpec) => (leanGraphics() ? Math.min(q.faceScale, 2.25) : q.faceScale);

/** Guess a tier from the device. `gl` is the live context when there is one. */
export function detectQuality(gl?: WebGLRenderingContext | WebGL2RenderingContext | null): QualityTier {
  try {
    const forced = localStorage.getItem(QUALITY_KEY);
    if (forced === 'low' || forced === 'medium' || forced === 'high') return forced;
  } catch {
    /* storage unavailable */
  }
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const ua = nav?.userAgent ?? '';
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820);
  const cores = nav?.hardwareConcurrency ?? 4;
  const mem = (nav as Navigator & { deviceMemory?: number } | undefined)?.deviceMemory ?? 8;
  let gpu = '';
  if (gl) {
    try {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      // Firefox hides the real GPU behind a generic bucket in both strings, so read both.
      gpu = `${ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''} ${gl.getParameter(gl.RENDERER)}`;
    } catch {
      /* not exposed */
    }
  }
  if (/SwiftShader|llvmpipe|Software|Basic Render/i.test(gpu)) return 'low';
  // Apple's phone and tablet GPUs are strong, but Safari reports few cores and no memory figure.
  if (mobile && /Apple/i.test(gpu)) return 'medium';
  if (mobile) return cores >= 8 && mem >= 6 && !/Mali-G[57]|Adreno \(TM\) [3-5]|PowerVR/i.test(gpu) ? 'medium' : 'low';
  if (cores <= 4 || mem <= 4) return 'medium';
  if (/Intel|UHD|Iris|Radeon\(TM\) Graphics|Vega \d/i.test(gpu)) return 'medium';
  // Firefox's masked names ("Radeon R9 200 Series, or similar", "Intel(R) HD Graphics 400, or similar")
  // cover integrated laptop GPUs too, so they get the medium tier rather than full shadows.
  if (/Radeon R9 200|HD Graphics 400|, or similar/i.test(gpu)) return 'medium';
  return 'high';
}

/**
 * Watches frame times and asks for a lower pixel ratio when the device cannot
 * keep up. It only ever steps down (never oscillates) and ignores hidden-tab gaps.
 */
export class FrameBudget {
  private acc = 0;
  private n = 0;
  private last = 0;
  /** Average frame time of the last window, in ms (0 until measured). */
  avgMs = 0;

  constructor(private onSlow: () => boolean) {}

  /** Forget the last tick: the caller skipped frames on purpose (an idle table draws at a lower rate). */
  pause() {
    this.last = 0;
  }

  tick(nowMs: number) {
    const d = this.last ? nowMs - this.last : 0;
    this.last = nowMs;
    if (d <= 0 || d > 250) return;
    this.acc += d;
    this.n++;
    if (this.acc < 2500) return;
    this.avgMs = this.acc / this.n;
    this.acc = 0;
    this.n = 0;
    // Slower than ~40 fps on average: shed pixels.
    if (this.avgMs > 25) this.onSlow();
  }
}

/**
 * One rung of the frame-rate governor's ladder. `scale` multiplies the view's
 * pixel ratio; `staticShadows` redraws the shadow map only every few frames;
 * `effects` off hides ambient extras (dust, steam, sparkle) like the Minimal setting.
 */
export interface GovernorStep {
  scale: number;
  staticShadows: boolean;
  effects: boolean;
}

/** Resolution goes first (least visible), then shadow refresh, then ambient effects. */
export const GOVERNOR_STEPS: GovernorStep[] = [
  { scale: 1, staticShadows: false, effects: true },
  { scale: 0.85, staticShadows: false, effects: true },
  { scale: 0.72, staticShadows: false, effects: true },
  { scale: 0.72, staticShadows: true, effects: true },
  { scale: 0.6, staticShadows: true, effects: false },
  { scale: 0.5, staticShadows: true, effects: false },
];

/** Frames slower than this on average (about 52 fps) count as the device falling behind. */
const SLOW_MS = 19;
/** Averages under this (60 fps with a little jitter) count as comfortable. */
const SMOOTH_MS = 17.6;

/**
 * Frame-rate governor for any 3D view (the table, mini-game boards). Feed it
 * the time of each full-rate frame; it steps quality down after about 1.5 s
 * of slow frames and back up after 8 s of smooth ones. A rung that proved too
 * slow is not retried for a while, longer each time it fails (20 s, 40 s,
 * 80 s... up to 10 minutes), so quality settles instead of flickering.
 */
export class FrameGovernor {
  level = 0;
  /** Average frame time and rate over the last measuring window (0 until measured). */
  avgMs = 0;
  fps = 0;
  /** Slowest single frame in the last window. */
  worstMs = 0;
  private last = 0;
  private acc = 0;
  private n = 0;
  private worst = 0;
  private times: number[] = [];
  private slowWindows = 0;
  private goodSince = 0;
  private changedAt = 0;
  private retryAt = new Map<number, number>();
  private fails = new Map<number, number>();

  constructor(
    private apply: (step: GovernorStep, level: number) => void,
    private steps: GovernorStep[] = GOVERNOR_STEPS,
  ) {}

  get step(): GovernorStep {
    return this.steps[this.level];
  }

  /** Forget the last frame: the caller skipped frames on purpose (an idle view draws at a lower rate). */
  pause() {
    this.last = 0;
  }

  tick(nowMs: number) {
    const d = this.last ? nowMs - this.last : 0;
    this.last = nowMs;
    // Hidden tabs and deliberate pauses are not the device being slow.
    if (d <= 0 || d > 250) return;
    this.acc += d;
    this.n++;
    this.worst = Math.max(this.worst, d);
    this.times.push(d);
    if (this.acc < 750) return;
    const avg = this.acc / this.n;
    this.avgMs = avg;
    this.fps = 1000 / avg;
    this.worstMs = this.worst;
    // Decide on the window's median frame, so one long hitch (a garbage collection, a resize) never costs quality.
    const typical = this.times.sort((a, b) => a - b)[this.times.length >> 1];
    this.acc = this.n = this.worst = 0;
    this.times.length = 0;
    if (typical > SLOW_MS) {
      this.goodSince = 0;
      // Two slow windows in a row, and not straight after a change (the new size needs a moment).
      if (++this.slowWindows >= 2 && nowMs - this.changedAt > 1500 && this.level < this.steps.length - 1) {
        const f = (this.fails.get(this.level) ?? 0) + 1;
        this.fails.set(this.level, f);
        this.retryAt.set(this.level, nowMs + Math.min(600_000, 20_000 * 2 ** (f - 1)));
        this.set(this.level + 1, nowMs);
      }
      return;
    }
    this.slowWindows = 0;
    if (typical > SMOOTH_MS || this.level === 0) {
      this.goodSince = 0;
      return;
    }
    this.goodSince ||= nowMs;
    const up = this.level - 1;
    if (nowMs - this.goodSince > 8000 && nowMs - this.changedAt > 8000 && (this.retryAt.get(up) ?? 0) <= nowMs) this.set(up, nowMs);
  }

  private set(level: number, nowMs: number) {
    this.level = level;
    this.changedAt = nowMs;
    // Start the next window fresh: frames from before the change say nothing about the new rung.
    this.acc = this.n = this.worst = 0;
    this.times.length = 0;
    this.goodSince = 0;
    this.slowWindows = 0;
    this.apply(this.steps[level], level);
  }
}
