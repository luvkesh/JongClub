// The club room itself: a painted band of walls just beyond the table
// (panelling, lattice screens, shelves of porcelain, silk drapes, windows cut
// through to the city panorama behind). Painted once per environment onto a
// canvas, softened slightly so it reads as out of focus behind the table.

import type { EnvironmentStyle } from '../cosmetics/catalog';
import { mix } from './tileFaces';
import { jansoRoom, majlisRoom, teahouseRoom } from './venueRooms';

/** World extent of the interior band. */
export const IN_FLOOR = -1.6;
export const IN_TOP = 12.4;
export const IN_RADIUS = 17;
/** The painting repeats this many times around the room. */
export const IN_REPEAT = 3;

export type G = CanvasRenderingContext2D;

export const rgba = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Ctx {
  g: G;
  W: number;
  H: number;
  /** Pixels per world unit, horizontally and vertically. */
  ux: number;
  /** World y to canvas row. */
  y: (wy: number) => number;
  /** World units to px (vertical scale). */
  u: (w: number) => number;
  r: () => number;
  e: EnvironmentStyle;
  brass: string;
}

export function glow(g: G, x: number, y: number, r: number, color: string, a: number) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(color, a));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

/** A vertical wash of light from a fitting, fanning down a wall (sconce or picture light). */
export function wash(c: Ctx, x: number, top: number, bottom: number, w: number, color: string, a: number) {
  const { g } = c;
  const gr = g.createLinearGradient(0, top, 0, bottom);
  gr.addColorStop(0, rgba(color, a));
  gr.addColorStop(1, rgba(color, 0));
  g.save();
  g.beginPath();
  g.moveTo(x - w * 0.15, top);
  g.lineTo(x + w * 0.15, top);
  g.lineTo(x + w * 0.5, bottom);
  g.lineTo(x - w * 0.5, bottom);
  g.closePath();
  g.fillStyle = gr;
  g.fill();
  g.restore();
}

/** Dark wood with a fine vertical grain. */
export function woodFill(c: Ctx, x: number, y: number, w: number, h: number, base: string) {
  const { g, r } = c;
  g.fillStyle = base;
  g.fillRect(x, y, w, h);
  for (let i = 0; i < w / 3; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${r() * 0.12})` : `rgba(255,214,170,${r() * 0.035})`;
    g.fillRect(x + r() * w, y, 1 + r() * 2, h);
  }
}

/** A raised panel: bevel highlight top-left, shadow bottom-right. */
export function panel(c: Ctx, x: number, y: number, w: number, h: number, base: string, bevel = 4) {
  const { g } = c;
  g.fillStyle = mix(base, '#000000', 0.18);
  g.fillRect(x, y, w, h);
  g.fillStyle = base;
  g.fillRect(x + bevel, y + bevel, w - bevel * 2, h - bevel * 2);
  g.fillStyle = 'rgba(255,224,180,0.06)';
  g.fillRect(x, y, w, 1.5);
  g.fillRect(x, y, 1.5, h);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(x, y + h - 1.5, w, 1.5);
  g.fillRect(x + w - 1.5, y, 1.5, h);
}

export function brassLine(c: Ctx, wy: number, thick = 2, a = 0.55) {
  const { g, W, brass } = c;
  g.fillStyle = rgba(brass, a);
  g.fillRect(0, c.y(wy), W, thick);
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.fillRect(0, c.y(wy) + thick, W, 1);
}

/** Chinese fretwork lattice, back-lit: the classic screen of a mahjong salon. */
export function lattice(c: Ctx, x: number, y: number, w: number, h: number, frame: string, light: string, glowA = 0.5) {
  const { g } = c;
  // Warm paper behind the lattice, brightest in the middle.
  const bg = g.createRadialGradient(x + w / 2, y + h * 0.55, 4, x + w / 2, y + h * 0.55, Math.max(w, h) * 0.75);
  bg.addColorStop(0, rgba(light, glowA));
  bg.addColorStop(1, rgba(mix(light, '#000000', 0.7), glowA * 0.6));
  g.fillStyle = bg;
  g.fillRect(x, y, w, h);
  const cell = Math.max(8, Math.min(w / 9, h / 12));
  const bar = Math.max(1.5, cell * 0.1);
  g.fillStyle = frame;
  // Grid of interlocking frets: a square with a smaller inner square, alternating.
  for (let cy = y; cy < y + h; cy += cell) {
    g.fillRect(x, cy, w, bar);
    for (let cx = x; cx < x + w; cx += cell) {
      g.fillRect(cx, cy, bar, cell);
      const i = Math.round((cx - x) / cell) + Math.round((cy - y) / cell);
      if (i % 2 === 0) {
        const m = cell * 0.3;
        g.fillRect(cx + m, cy + m, cell - m * 2 + bar, bar);
        g.fillRect(cx + m, cy + m, bar, cell * 0.42);
      } else {
        const m = cell * 0.3;
        g.fillRect(cx + m, cy + cell - m, cell - m * 2 + bar, bar);
        g.fillRect(cx + cell - m, cy + cell * 0.3, bar, cell * 0.42);
      }
    }
  }
  // Frame.
  g.strokeStyle = frame;
  g.lineWidth = bar * 2.2;
  g.strokeRect(x, y, w, h);
}

/** Porcelain and bronze on a shelf, with a little light from above. */
export function vase(c: Ctx, x: number, base: number, hgt: number, kind: number) {
  const { g, r } = c;
  const palettes = [
    ['#d9e4dc', '#7fa596'], // celadon
    ['#e9edf2', '#2f4f8a'], // blue and white
    ['#b4462f', '#5a1d14'], // ox-blood
    ['#c9a24a', '#5a4321'], // bronze
    ['#1d1d1f', '#000000'], // black lacquer
  ];
  const [hi, lo] = palettes[kind % palettes.length];
  const w = hgt * (0.42 + r() * 0.18);
  const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  gr.addColorStop(0, lo);
  gr.addColorStop(0.35, hi);
  gr.addColorStop(1, mix(lo, '#000000', 0.5));
  g.fillStyle = gr;
  g.beginPath();
  const neck = w * 0.22;
  g.moveTo(x - neck, base - hgt);
  g.bezierCurveTo(x - neck, base - hgt * 0.75, x - w / 2, base - hgt * 0.7, x - w / 2, base - hgt * 0.38);
  g.bezierCurveTo(x - w / 2, base - hgt * 0.1, x - w * 0.3, base, x - w * 0.25, base);
  g.lineTo(x + w * 0.25, base);
  g.bezierCurveTo(x + w * 0.3, base, x + w / 2, base - hgt * 0.1, x + w / 2, base - hgt * 0.38);
  g.bezierCurveTo(x + w / 2, base - hgt * 0.7, x + neck, base - hgt * 0.75, x + neck, base - hgt);
  g.closePath();
  g.fill();
  // Specular stripe.
  g.fillStyle = 'rgba(255,248,235,0.25)';
  g.fillRect(x - w * 0.22, base - hgt * 0.62, Math.max(1, w * 0.06), hgt * 0.4);
  if (kind % palettes.length === 1) {
    // Blue-and-white band.
    g.strokeStyle = rgba('#2f4f8a', 0.6);
    g.lineWidth = Math.max(1, hgt * 0.03);
    g.beginPath();
    g.moveTo(x - w * 0.46, base - hgt * 0.45);
    g.lineTo(x + w * 0.46, base - hgt * 0.45);
    g.stroke();
  }
}

/** A silk lantern hanging on a cord from the top of the band. */
export function silkLantern(c: Ctx, x: number, cy: number, s: number, silk: string, a = 1) {
  const { g } = c;
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = Math.max(1, s * 0.04);
  g.beginPath();
  g.moveTo(x, 0);
  g.lineTo(x, cy - s * 0.62);
  g.stroke();
  glow(g, x, cy, s * 2.4, silk, 0.18 * a);
  const body = g.createRadialGradient(x - s * 0.15, cy - s * 0.2, s * 0.05, x, cy, s * 0.6);
  body.addColorStop(0, rgba(mix(silk, '#fff3d6', 0.7), a));
  body.addColorStop(0.55, rgba(silk, a));
  body.addColorStop(1, rgba(mix(silk, '#000000', 0.55), a));
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(x, cy, s * 0.46, s * 0.56, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = rgba('#000000', 0.18 * a);
  g.lineWidth = Math.max(1, s * 0.025);
  for (const k of [0.16, 0.32]) {
    g.beginPath();
    g.ellipse(x, cy, s * k, s * 0.55, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = rgba(c.brass, 0.9 * a);
  g.fillRect(x - s * 0.22, cy - s * 0.62, s * 0.44, s * 0.08);
  g.fillRect(x - s * 0.22, cy + s * 0.54, s * 0.44, s * 0.08);
  // Tassel.
  g.fillStyle = rgba(mix(silk, '#000000', 0.3), a);
  g.fillRect(x - s * 0.03, cy + s * 0.62, s * 0.06, s * 0.4);
}

/** Heavy silk drape with soft vertical folds. */
function drape(c: Ctx, x: number, top: number, bottom: number, w: number, silk: string) {
  const { g } = c;
  const gr = g.createLinearGradient(x, 0, x + w, 0);
  const folds = 5;
  for (let i = 0; i <= folds * 2; i++) {
    const t = i / (folds * 2);
    gr.addColorStop(t, i % 2 ? mix(silk, '#000000', 0.55) : mix(silk, '#ffe8c8', 0.08));
  }
  g.fillStyle = gr;
  g.fillRect(x, top, w, bottom - top);
  // Tie-back sash.
  g.fillStyle = rgba(c.brass, 0.6);
  g.fillRect(x, c.y(1.6), w, Math.max(2, c.u(0.08)));
}

/** A window opening: cut out so the city panorama behind shows through, with mullions and a whisper of reflection. */
export function windowCut(c: Ctx, x: number, top: number, bottom: number, w: number, arch = false, frame = '#14100c') {
  const { g } = c;
  const path = () => {
    g.beginPath();
    if (arch) {
      g.moveTo(x, bottom);
      g.lineTo(x, top + w / 2);
      g.arc(x + w / 2, top + w / 2, w / 2, Math.PI, 0);
      g.lineTo(x + w, bottom);
      g.closePath();
    } else g.rect(x, top, w, bottom - top);
  };
  g.save();
  g.globalCompositeOperation = 'destination-out';
  path();
  g.fill();
  g.restore();
  // Glass: barely there, a cool sheen and one diagonal reflection.
  g.save();
  path();
  g.clip();
  g.fillStyle = 'rgba(30,34,44,0.12)';
  g.fillRect(x, top, w, bottom - top);
  g.fillStyle = 'rgba(255,240,220,0.035)';
  g.beginPath();
  g.moveTo(x + w * 0.1, bottom);
  g.lineTo(x + w * 0.35, bottom);
  g.lineTo(x + w * 0.9, top);
  g.lineTo(x + w * 0.65, top);
  g.fill();
  g.restore();
  // Mullions and transom in dark bronze with a brass edge.
  const m = Math.max(2, w * 0.018);
  g.fillStyle = frame;
  g.fillRect(x + w / 2 - m / 2, top, m, bottom - top);
  const tr = top + (bottom - top) * 0.22;
  g.fillRect(x, tr, w, m);
  g.fillStyle = rgba(c.brass, 0.4);
  g.fillRect(x + w / 2 + m / 2, top, 1, bottom - top);
  g.lineWidth = m * 2;
  g.strokeStyle = frame;
  path();
  g.stroke();
  g.lineWidth = 1;
  g.strokeStyle = rgba(c.brass, 0.45);
  path();
  g.stroke();
}

/** A long lacquer credenza with brass handles and a lamp. */
function credenza(c: Ctx, x: number, w: number, lacquer: string, lampC: string) {
  const { g } = c;
  const top = c.y(0.6),
    bottom = c.y(-1.25);
  g.fillStyle = lacquer;
  g.fillRect(x, top, w, bottom - top);
  g.fillStyle = 'rgba(255,230,190,0.12)';
  g.fillRect(x, top, w, 2);
  const doors = 3;
  for (let i = 0; i < doors; i++) {
    const dx = x + 6 + (i * (w - 12)) / doors;
    const dw = (w - 12) / doors - 6;
    g.strokeStyle = rgba(c.brass, 0.3);
    g.lineWidth = 1;
    g.strokeRect(dx, top + 8, dw, bottom - top - 14);
    g.fillStyle = rgba(c.brass, 0.7);
    g.fillRect(dx + dw / 2 - 1, top + (bottom - top) * 0.45, 2, 8);
  }
  // Table lamp: a pleated silk shade glowing warm.
  const lx = x + w * 0.22;
  const sb = c.y(1.4),
    st = c.y(2.1);
  glow(g, lx, (sb + st) / 2, c.u(1.6), lampC, 0.3);
  g.fillStyle = rgba(c.brass, 0.8);
  g.fillRect(lx - 2, sb, 4, top - sb);
  const sw = c.u(0.55);
  const sg = g.createLinearGradient(0, st, 0, sb);
  sg.addColorStop(0, mix(lampC, '#fff6e0', 0.5));
  sg.addColorStop(1, lampC);
  g.fillStyle = sg;
  g.beginPath();
  g.moveTo(lx - sw * 0.35, st);
  g.lineTo(lx + sw * 0.35, st);
  g.lineTo(lx + sw * 0.5, sb);
  g.lineTo(lx - sw * 0.5, sb);
  g.fill();
  // A pool of light on the credenza top, and a vase.
  glow(g, lx, top, c.u(1.2), lampC, 0.25);
  vase(c, x + w * 0.7, top, c.u(0.9), 1 + Math.floor(c.r() * 3));
}

function pilaster(c: Ctx, x: number, w: number, lacquer: string, top = c.y(10.5)) {
  const { g } = c;
  const gr = g.createLinearGradient(x, 0, x + w, 0);
  gr.addColorStop(0, mix(lacquer, '#000000', 0.4));
  gr.addColorStop(0.3, mix(lacquer, '#ffe2bd', 0.06));
  gr.addColorStop(1, mix(lacquer, '#000000', 0.5));
  g.fillStyle = gr;
  g.fillRect(x, top, w, c.H - top);
  g.fillStyle = rgba(c.brass, 0.5);
  g.fillRect(x + w * 0.2, top, 1.5, c.H - top);
  g.fillRect(x + w * 0.8, top, 1.5, c.H - top);
}

/** A brass wall sconce with its upward and downward wash. */
export function sconce(c: Ctx, x: number, wy: number, light: string) {
  const { g } = c;
  const y = c.y(wy);
  wash(c, x, y, y - c.u(2.4), c.u(1.6), light, 0.16);
  wash(c, x, y, y + c.u(2.6), c.u(1.8), light, 0.12);
  glow(g, x, y, c.u(0.7), light, 0.55);
  g.fillStyle = rgba(c.brass, 0.9);
  g.fillRect(x - c.u(0.08), y - c.u(0.05), c.u(0.16), c.u(0.34));
  g.fillStyle = rgba('#fff3d6', 0.9);
  g.beginPath();
  g.ellipse(x, y - c.u(0.08), c.u(0.12), c.u(0.18), 0, 0, Math.PI * 2);
  g.fill();
}

/** Floor-to-ceiling fade into darkness and a soft skirting glow, shared by all rooms. */
export function finish(c: Ctx, darkTop = 8.2) {
  const { g, W, H } = c;
  const fade = g.createLinearGradient(0, 0, 0, c.y(darkTop));
  fade.addColorStop(0, rgba(c.e.sky, 1));
  fade.addColorStop(0.55, rgba(c.e.sky, 0.65));
  fade.addColorStop(1, rgba(c.e.sky, 0));
  g.save();
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = fade;
  g.fillRect(0, 0, W, c.y(darkTop));
  // The floor line sinks into shadow.
  const foot = g.createLinearGradient(0, c.y(-0.4), 0, H);
  foot.addColorStop(0, rgba(c.e.sky, 0));
  foot.addColorStop(1, rgba(c.e.sky, 0.85));
  g.fillStyle = foot;
  g.fillRect(0, c.y(-0.4), W, H - c.y(-0.4));
  g.restore();
}

// ------------------------------------------------------------ rooms

function clubRoom(c: Ctx) {
  const { g, W, H, r, e } = c;
  const wood = mix('#2a170d', e.sky, 0.25);
  woodFill(c, 0, 0, W, H, wood);
  const bays = 4;
  const bw = W / bays;
  const pil = bw * 0.1;
  const paper = mix(e.key, '#ffb060', 0.35);
  for (let b = 0; b < bays; b++) {
    const x0 = b * bw;
    // Wainscot panels.
    const wtop = c.y(1.1),
      wbot = c.y(-1.3);
    for (let k = 0; k < 3; k++) {
      const pw = (bw - pil - 24) / 3;
      const px = x0 + pil + 6 + k * (pw + 6);
      panel(c, px, wtop + 6, pw, wbot - wtop - 12, mix(wood, '#000000', 0.12));
      // A gilt inlay line inside each panel.
      const m = c.u(0.22);
      g.strokeStyle = rgba(c.brass, 0.55);
      g.lineWidth = 1.2;
      g.strokeRect(px + m, wtop + 6 + m, pw - m * 2, wbot - wtop - 12 - m * 2);
    }
    const ix = x0 + pil + 8,
      iw = bw - pil - 16;
    if (b % 2 === 0) {
      // Back-lit lattice screen in a carved frame.
      // Back-lit lattice in a carved frame with a brass bead.
      const lx = ix + iw * 0.12,
        lw = iw * 0.76,
        ly = c.y(7.0),
        lh = c.y(2.2) - c.y(7.0);
      g.fillStyle = mix(wood, '#000000', 0.4);
      g.fillRect(lx - c.u(0.22), ly - c.u(0.22), lw + c.u(0.44), lh + c.u(0.44));
      lattice(c, lx, ly, lw, lh, mix(wood, '#000000', 0.3), paper, 0.36);
      // A gilded double frame with corner bosses.
      g.strokeStyle = rgba(c.brass, 0.9);
      g.lineWidth = Math.max(2, c.u(0.07));
      g.strokeRect(lx - c.u(0.1), ly - c.u(0.1), lw + c.u(0.2), lh + c.u(0.2));
      g.strokeStyle = rgba(c.brass, 0.5);
      g.lineWidth = 1.2;
      g.strokeRect(lx - c.u(0.2), ly - c.u(0.2), lw + c.u(0.4), lh + c.u(0.4));
      g.fillStyle = rgba(c.brass, 0.95);
      for (const [cx, cy] of [[lx, ly], [lx + lw, ly], [lx, ly + lh], [lx + lw, ly + lh]]) {
        g.beginPath();
        g.arc(cx, cy, c.u(0.14), 0, Math.PI * 2);
        g.fill();
      }
      glow(g, lx + lw / 2, ly + lh / 2, lw * 0.7, '#ffb868', 0.08);
    } else {
      // Display shelves with porcelain, each piece picked out by a little light.
      const sx = ix + iw * 0.06,
        sw = iw * 0.88;
      g.fillStyle = mix(wood, '#000000', 0.45);
      g.fillRect(sx, c.y(7.4), sw, c.y(1.8) - c.y(7.4));
      const shelves = [2.0, 3.9, 5.8];
      for (const sy of shelves) {
        const y = c.y(sy);
        // Warm backlight in each niche, and a gilded shelf edge.
        wash(c, sx + sw / 2, c.y(sy + 1.75), y, sw * 0.9, mix(e.key, '#ffb060', 0.4), 0.2);
        g.fillStyle = mix(wood, '#ffe0b0', 0.08);
        g.fillRect(sx, y, sw, c.u(0.09));
        g.fillStyle = rgba(c.brass, 0.9);
        g.fillRect(sx, y, sw, Math.max(2, c.u(0.04)));
        const n = 2 + Math.floor(r() * 2);
        for (let k = 0; k < n; k++) {
          const vx = sx + sw * ((k + 0.5) / n) + (r() - 0.5) * sw * 0.08;
          glow(g, vx, y - c.u(0.6), c.u(0.8), e.key, 0.12);
          vase(c, vx, y, c.u(0.8 + r() * 0.7), Math.floor(r() * 5));
        }
      }
      g.strokeStyle = mix(wood, '#000000', 0.2);
      g.lineWidth = c.u(0.12);
      g.strokeRect(sx, c.y(7.4), sw, c.y(1.8) - c.y(7.4));
      g.strokeStyle = rgba(c.brass, 0.8);
      g.lineWidth = Math.max(1.5, c.u(0.04));
      g.strokeRect(sx - c.u(0.08), c.y(7.4) - c.u(0.08), sw + c.u(0.16), c.y(1.8) - c.y(7.4) + c.u(0.16));
    }
    pilaster(c, x0, pil, mix(wood, '#000000', 0.1), c.y(9.2));
    sconce(c, x0 + pil / 2, 4.6, e.key);
  }
  brassLine(c, 1.15, 2, 0.6);
  brassLine(c, 7.75, 2, 0.45);
  // Cornice.
  g.fillStyle = mix(wood, '#000000', 0.35);
  g.fillRect(0, c.y(8.3), W, c.y(7.8) - c.y(8.3));
  g.fillStyle = rgba(c.brass, 0.75);
  g.fillRect(0, c.y(7.8), W, Math.max(2, c.u(0.05)));
  // Two silk lanterns per repeat, hung in front of the screens.
  for (const lx of [bw * 0.55, bw * 2.55]) silkLantern(c, lx, c.y(8.9), c.u(0.9), e.bokeh[0] === '#e8cb92' ? '#b8402e' : e.bokeh[0], 0.85);
  finish(c, 9.4);
}

function windowRoom(c: Ctx, opts: { arch?: boolean; silk: string; lacquer: string; deco?: boolean }) {
  const { g, W, H, e } = c;
  const wall = opts.deco ? mix('#1d1b18', e.sky, 0.3) : mix(opts.lacquer, e.sky, 0.25);
  if (opts.deco) {
    g.fillStyle = wall;
    g.fillRect(0, 0, W, H);
    // Fluted stone.
    for (let x = 0; x < W; x += Math.max(8, c.u(0.25))) {
      g.fillStyle = 'rgba(255,240,220,0.035)';
      g.fillRect(x, 0, 2, H);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(x + 4, 0, 2, H);
    }
  } else woodFill(c, 0, 0, W, H, wall);
  const bays = 4;
  const bw = W / bays;
  for (let b = 0; b < bays; b++) {
    const x0 = b * bw;
    const ww = bw * 0.5;
    const wx = x0 + (bw - ww) / 2;
    const top = c.y(opts.arch ? 9.4 : 9.0),
      bottom = c.y(0.7);
    windowCut(c, wx, top, bottom, ww, opts.arch, mix(wall, '#000000', 0.5));
    if (opts.arch) {
      // A mashrabiya screen fills the arch head.
      g.save();
      g.beginPath();
      g.moveTo(wx, top + ww / 2);
      g.arc(wx + ww / 2, top + ww / 2, ww / 2, Math.PI, 0);
      g.closePath();
      g.clip();
      lattice(c, wx, top, ww, ww / 2 + 2, mix(c.brass, '#000000', 0.45), e.key, 0.12);
      g.restore();
    }
    // Drapes either side, and a credenza beneath.
    const dw = bw * 0.1;
    drape(c, wx - dw * 0.8, c.y(9.6), c.y(-1.3), dw, opts.silk);
    drape(c, wx + ww - dw * 0.2, c.y(9.6), c.y(-1.3), dw, opts.silk);
    g.fillStyle = rgba(c.brass, 0.6);
    g.fillRect(wx - dw, c.y(9.65), ww + dw * 2, Math.max(2, c.u(0.06)));
    if (b % 2 === 1) credenza(c, wx + ww * 0.08, ww * 0.84, mix(opts.lacquer, '#000000', 0.3), e.key);
    // Between windows: a scroll painting under a picture light.
    const pw = bw * 0.12;
    const sy0 = c.y(6.4),
      sy1 = c.y(2.4);
    for (const cx of b === 0 ? [x0, W] : [x0]) {
      const sx = cx - pw / 2;
      wash(c, cx, sy0 - c.u(0.4), sy1, pw * 1.6, e.key, 0.12);
      g.fillStyle = mix('#d8ccb4', e.sky, 0.6);
      g.fillRect(sx, sy0, pw, sy1 - sy0);
      // Ink: a mountain and a column of characters.
      g.fillStyle = 'rgba(30,24,18,0.4)';
      g.beginPath();
      g.moveTo(sx + pw * 0.1, sy0 + (sy1 - sy0) * 0.7);
      g.quadraticCurveTo(sx + pw * 0.4, sy0 + (sy1 - sy0) * 0.3, sx + pw * 0.9, sy0 + (sy1 - sy0) * 0.75);
      g.fill();
      for (let k = 0; k < 3; k++) g.fillRect(sx + pw * 0.75, sy0 + (sy1 - sy0) * (0.1 + k * 0.08), pw * 0.08, pw * 0.08);
      g.fillStyle = rgba(c.brass, 0.6);
      g.fillRect(sx - 2, sy0 - 3, pw + 4, 3);
      g.fillRect(sx - 2, sy1, pw + 4, 3);
    }
  }
  // Ceiling cornice and a brass picture rail.
  g.fillStyle = mix(wall, '#000000', 0.4);
  g.fillRect(0, 0, W, c.y(10.2));
  brassLine(c, 10.2, 2, 0.5);
  brassLine(c, 0.65, 2, 0.4);
  if (opts.deco) {
    // Brass sunbursts above the windows.
    for (let b = 0; b < bays; b++) {
      const cx = b * bw + bw / 2,
        cy = c.y(9.9);
      g.strokeStyle = rgba(c.brass, 0.35);
      g.lineWidth = 1.5;
      for (let k = 0; k <= 10; k++) {
        const a = Math.PI + (k / 10) * Math.PI;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(a) * c.u(1.2), cy + Math.sin(a) * c.u(1.2));
        g.stroke();
      }
    }
  }
  finish(c, 11);
}

function lanternRoom(c: Ctx) {
  const { g, W, H, e } = c;
  const red = '#5e1610';
  const wall = mix('#24140d', e.sky, 0.3);
  woodFill(c, 0, 0, W, H, wall);
  const bays = 4;
  const bw = W / bays;
  for (let b = 0; b < bays; b++) {
    const x0 = b * bw;
    const cx = x0 + bw / 2;
    const rad = bw * 0.3;
    const cy = c.y(4.2);
    if (b % 2 === 0) {
      // Moon gate open to the lantern-lit street.
      g.save();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath();
      g.arc(cx, cy, rad, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.strokeStyle = mix(red, '#000000', 0.2);
      g.lineWidth = c.u(0.35);
      g.beginPath();
      g.arc(cx, cy, rad + c.u(0.17), 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = rgba(c.brass, 0.5);
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(cx, cy, rad + c.u(0.36), 0, Math.PI * 2);
      g.stroke();
    } else {
      lattice(c, cx - rad, c.y(7.2), rad * 2, c.y(1.4) - c.y(7.2), mix(red, '#000000', 0.45), '#ff9a50', 0.38);
    }
    // Red lacquer columns.
    const pw = bw * 0.07;
    const gr = g.createLinearGradient(x0, 0, x0 + pw, 0);
    gr.addColorStop(0, mix(red, '#000000', 0.5));
    gr.addColorStop(0.35, mix(red, '#ff8a60', 0.12));
    gr.addColorStop(1, mix(red, '#000000', 0.6));
    g.fillStyle = gr;
    g.fillRect(x0, c.y(9.6), pw, H - c.y(9.6));
    g.fillStyle = rgba(c.brass, 0.6);
    g.fillRect(x0, c.y(8.9), pw, 3);
    g.fillRect(x0, c.y(0.0), pw, 3);
  }
  // A carved beam across the top.
  g.fillStyle = mix(red, '#000000', 0.35);
  g.fillRect(0, c.y(9.9), W, c.y(8.9) - c.y(9.9));
  brassLine(c, 9.0, 2, 0.5);
  brassLine(c, 9.8, 1, 0.4);
  for (let k = 0; k < 6; k++) silkLantern(c, (k + 0.5) * (W / 6), c.y(8.2 - (k % 2) * 0.6), c.u(0.85), k % 3 === 2 ? '#e8902c' : '#c0301e', 0.95);
  finish(c, 10.4);
}

/** A rectangular (or round) opening through to the view, with no glazing bars. */
export function opening(c: Ctx, x: number, top: number, bottom: number, w: number, round = false) {
  const { g } = c;
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  if (round) g.ellipse(x + w / 2, (top + bottom) / 2, w / 2, (bottom - top) / 2, 0, 0, Math.PI * 2);
  else g.rect(x, top, w, bottom - top);
  g.fill();
  g.restore();
}

/** A post or column with a lit edge, in any colour. */
export function post(c: Ctx, x: number, w: number, top: number, bottom: number, color: string, lit = 0.1) {
  const { g } = c;
  const gr = g.createLinearGradient(x, 0, x + w, 0);
  gr.addColorStop(0, mix(color, '#000000', 0.45));
  gr.addColorStop(0.3, mix(color, '#fff0d8', lit));
  gr.addColorStop(0.7, color);
  gr.addColorStop(1, mix(color, '#000000', 0.55));
  g.fillStyle = gr;
  g.fillRect(x, top, w, bottom - top);
}

/** Tokyo: dark timber and paper shoji, some slid open onto the neon city. */
function shojiRoom(c: Ctx) {
  const { g, W, H, e, r } = c;
  const wood = '#21160f';
  const paperLit = mix('#efe6d2', e.key, 0.2);
  woodFill(c, 0, 0, W, H, wood);
  const bays = 6;
  const bw = W / bays;
  const top = c.y(8.4),
    bottom = c.y(-0.2);
  for (let b = 0; b < bays; b++) {
    const x0 = b * bw;
    const open = b % 3 === 1;
    const ix = x0 + bw * 0.06,
      iw = bw * 0.88;
    if (open) {
      opening(c, ix, top, bottom, iw);
      // The far edge of the slid-back screen.
      g.fillStyle = rgba(paperLit, 0.12);
      g.fillRect(ix + iw * 0.78, top, iw * 0.22, bottom - top);
    } else {
      // Paper glowing softly from the room's lamp, with a hint of neon behind it.
      const pg = g.createLinearGradient(0, top, 0, bottom);
      pg.addColorStop(0, rgba(mix(paperLit, e.bokeh[b % e.bokeh.length], 0.25), 0.55));
      pg.addColorStop(1, rgba(paperLit, 0.38));
      g.fillStyle = pg;
      g.fillRect(ix, top, iw, bottom - top);
      // A neon blur behind the paper.
      glow(g, ix + iw * (0.3 + r() * 0.4), c.y(4 + r() * 3), c.u(1.6), e.bokeh[(b + 1) % e.bokeh.length], 0.22);
      // Kumiko grid.
      g.fillStyle = wood;
      const cols = 4,
        rows = 9;
      for (let k = 1; k < cols; k++) g.fillRect(ix + (iw * k) / cols - 1.5, top, 3, bottom - top);
      for (let k = 1; k < rows; k++) g.fillRect(ix, top + ((bottom - top) * k) / rows - 1.5, iw, 3);
    }
    // Frame.
    g.strokeStyle = mix(wood, '#000000', 0.3);
    g.lineWidth = c.u(0.18);
    g.strokeRect(ix, top, iw, bottom - top);
    post(c, x0 - c.u(0.12), c.u(0.24), 0, H, '#2c1e14', 0.12);
  }
  // Ranma: a carved transom of waves above the screens, then the ceiling beam.
  const rt = c.y(10.2);
  g.fillStyle = mix(wood, '#000000', 0.2);
  g.fillRect(0, rt, W, top - rt);
  g.strokeStyle = rgba(paperLit, 0.22);
  g.lineWidth = 2;
  for (let x = 0; x < W; x += c.u(0.9)) {
    for (const k of [1, 0.66, 0.33]) {
      g.beginPath();
      g.arc(x, top - 2, c.u(0.45) * k, Math.PI, Math.PI * 2);
      g.stroke();
    }
  }
  g.fillStyle = '#120c08';
  g.fillRect(0, c.y(10.6), W, c.y(10.2) - c.y(10.6));
  g.fillRect(0, top - 4, W, 8);
  // Tokonoma alcove with a hanging scroll and ikebana, once per repeat.
  const ax = bw * 3 + bw * 0.18,
    aw = bw * 0.64;
  g.fillStyle = mix(wood, '#000000', 0.35);
  g.fillRect(ax, c.y(7.6), aw, c.y(0.4) - c.y(7.6));
  wash(c, ax + aw / 2, c.y(7.6), c.y(0.4), aw, e.key, 0.12);
  g.fillStyle = mix('#e8dfc8', e.sky, 0.25);
  g.fillRect(ax + aw * 0.32, c.y(6.8), aw * 0.36, c.y(2.2) - c.y(6.8));
  g.fillStyle = 'rgba(20,16,12,0.6)';
  g.font = `${Math.round(c.u(0.5))}px serif`;
  g.textAlign = 'center';
  for (let k = 0; k < 4; k++) g.fillRect(ax + aw * 0.47, c.y(6.3) + k * c.u(0.8), aw * 0.06, c.u(0.5));
  g.fillStyle = '#1a120c';
  g.fillRect(ax, c.y(0.4), aw, c.u(0.25));
  vase(c, ax + aw * 0.8, c.y(0.4), c.u(0.7), 4);
  g.strokeStyle = '#2d5a2a';
  g.lineWidth = 2;
  for (let k = 0; k < 4; k++) {
    g.beginPath();
    g.moveTo(ax + aw * 0.8, c.y(1.1));
    g.quadraticCurveTo(ax + aw * (0.7 + k * 0.06), c.y(2), ax + aw * (0.66 + k * 0.08), c.y(2.4 + k * 0.2));
    g.stroke();
  }
  circleFill(g, ax + aw * 0.7, c.y(2.5), c.u(0.12), '#e84a6a');
  circleFill(g, ax + aw * 0.86, c.y(2.8), c.u(0.1), '#ffffff');
  finish(c, 11.2);
}

export function circleFill(g: G, x: number, y: number, r: number, color: string) {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

/** New York: exposed brick, cast-iron columns and steel factory windows. */
function loftRoom(c: Ctx) {
  const { g, W, H, e, r } = c;
  // Brick.
  g.fillStyle = '#2a120c';
  g.fillRect(0, 0, W, H);
  const bh = c.u(0.26),
    bw = bh * 2.6;
  for (let row = 0, y = 0; y < H; row++, y += bh) {
    for (let x = row % 2 ? -bw / 2 : 0; x < W; x += bw) {
      const t = r();
      g.fillStyle = t < 0.33 ? '#5a2618' : t < 0.66 ? '#4a1f14' : '#63301e';
      g.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
    }
  }
  // Warm light raking down the brick from picture lights.
  const bays = 4;
  const bayW = W / bays;
  for (let b = 0; b < bays; b++) {
    const x0 = b * bayW;
    const ww = bayW * 0.62,
      wx = x0 + (bayW - ww) / 2;
    const top = c.y(9.6),
      bottom = c.y(0.4);
    opening(c, wx, top, bottom, ww);
    // Steel glazing: a fine black grid with an opening sash.
    g.fillStyle = '#0c0d0f';
    const cols = 4,
      rows = 6;
    for (let k = 0; k <= cols; k++) g.fillRect(wx + (ww * k) / cols - 2, top, 4, bottom - top);
    for (let k = 0; k <= rows; k++) g.fillRect(wx, top + ((bottom - top) * k) / rows - 2, ww, 4);
    g.fillStyle = 'rgba(160,190,230,0.05)';
    g.fillRect(wx, top, ww, bottom - top);
    // Sill.
    g.fillStyle = '#3a3a3a';
    g.fillRect(wx - 6, bottom, ww + 12, c.u(0.18));
    // Cast-iron column between windows.
    post(c, x0 - c.u(0.18), c.u(0.36), c.y(10.8), H, '#22262a', 0.18);
    g.fillStyle = '#2c3034';
    g.fillRect(x0 - c.u(0.3), c.y(10.9), c.u(0.6), c.u(0.3));
    // A string of bare Edison bulbs across the bay.
    for (let k = 0; k < 5; k++) {
      const bx = wx + ww * (k / 4);
      const by = c.y(10.1) + Math.sin((k / 4) * Math.PI) * c.u(0.5);
      glow(g, bx, by, c.u(0.5), '#ffb860', 0.35);
      circleFill(g, bx, by, c.u(0.06), '#ffe2a0');
    }
  }
  // Ceiling: timber joists and a steel beam.
  g.fillStyle = '#16100c';
  g.fillRect(0, 0, W, c.y(11));
  for (let x = 0; x < W; x += c.u(0.9)) {
    g.fillStyle = '#20160e';
    g.fillRect(x, 0, c.u(0.25), c.y(11));
  }
  g.fillStyle = '#1a1c1e';
  g.fillRect(0, c.y(11), W, c.u(0.35));
  // Skirting.
  g.fillStyle = '#121212';
  g.fillRect(0, c.y(-0.9), W, H - c.y(-0.9));
  finish(c, 11.5);
  void e;
}

/** Shanghai 1930s: black lacquer and gold Deco, porthole windows on the Bund. */
function loungeRoom(c: Ctx) {
  const { g, W, H, e } = c;
  const lacquer = '#0d0a0c';
  g.fillStyle = lacquer;
  g.fillRect(0, 0, W, H);
  // Vertical gold reeding.
  for (let x = 0; x < W; x += c.u(0.3)) {
    g.fillStyle = 'rgba(201,164,106,0.06)';
    g.fillRect(x, 0, 1.5, H);
  }
  const bays = 4;
  const bw = W / bays;
  for (let b = 0; b < bays; b++) {
    const x0 = b * bw;
    const cx = x0 + bw / 2;
    if (b % 2 === 0) {
      // A round porthole onto the river.
      const rad = c.u(2.2);
      const cy = c.y(5.2);
      opening(c, cx - rad, cy - rad, cy + rad, rad * 2, true);
      g.strokeStyle = c.brass;
      g.lineWidth = c.u(0.18);
      g.beginPath();
      g.arc(cx, cy, rad + c.u(0.09), 0, Math.PI * 2);
      g.stroke();
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(cx, cy, rad + c.u(0.3), 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = c.brass;
      g.fillRect(cx - 1.5, cy - rad, 3, rad * 2);
    } else {
      // A gold sunburst panel with a teal glass inset.
      const pt = c.y(8.6),
        pb = c.y(1.2);
      g.fillStyle = '#0f3c3c';
      g.fillRect(cx - bw * 0.22, pt, bw * 0.44, pb - pt);
      glow(g, cx, (pt + pb) / 2, bw * 0.3, '#3fd0c8', 0.12);
      g.strokeStyle = rgba(c.brass, 0.85);
      g.lineWidth = 1.5;
      for (let k = 0; k <= 14; k++) {
        const a = Math.PI + (k / 14) * Math.PI;
        g.beginPath();
        g.moveTo(cx, pb);
        g.lineTo(cx + Math.cos(a) * bw * 0.22, pb + Math.sin(a) * (pb - pt));
        g.stroke();
      }
      g.lineWidth = c.u(0.12);
      g.strokeRect(cx - bw * 0.22, pt, bw * 0.44, pb - pt);
    }
    // Mirrored pilasters with stepped gold capitals.
    const pw = c.u(0.7);
    post(c, x0 - pw / 2, pw, c.y(9.6), H, '#1c1a1e', 0.25);
    g.fillStyle = rgba(c.brass, 0.9);
    for (let k = 0; k < 3; k++) g.fillRect(x0 - pw / 2 - k * 4, c.y(9.6) - k * 5, pw + k * 8, 3);
    // Neon accent in the city's colour along the pilaster.
    g.fillStyle = rgba(e.bokeh[b % e.bokeh.length], 0.7);
    g.fillRect(x0 - 1.5, c.y(8.8), 3, c.y(1.0) - c.y(8.8));
    glow(g, x0, c.y(5), c.u(1.2), e.bokeh[b % e.bokeh.length], 0.12);
  }
  // Curved velvet banquettes along the foot of the wall.
  for (let b = 0; b < bays; b++) {
    const x0 = b * bw + bw * 0.1;
    const vw = bw * 0.8;
    const vt = c.y(0.9),
      vb = c.y(-1.3);
    const vg = g.createLinearGradient(0, vt, 0, vb);
    vg.addColorStop(0, '#7a1a2a');
    vg.addColorStop(1, '#2a0810');
    g.fillStyle = vg;
    g.beginPath();
    g.roundRect(x0, vt, vw, vb - vt, c.u(0.4));
    g.fill();
    g.fillStyle = 'rgba(255,200,200,0.06)';
    for (let k = 1; k < 8; k++) g.fillRect(x0 + (vw * k) / 8, vt + 4, 2, (vb - vt) * 0.5);
  }
  brassLine(c, 9.9, 3, 0.8);
  brassLine(c, 10.3, 1.5, 0.6);
  finish(c, 11.4);
}

/** Sky Penthouse: daylight through walls of glass, travertine and sheer curtains. */
function marbleRoom(c: Ctx) {
  const { g, W, H, r } = c;
  const stone = '#d9d0c0';
  g.fillStyle = stone;
  g.fillRect(0, 0, W, H);
  // Travertine bands.
  for (let y = 0; y < H; y += c.u(0.35)) {
    g.fillStyle = `rgba(150,130,100,${0.04 + r() * 0.05})`;
    g.fillRect(0, y, W, 1 + r() * 2);
  }
  const bays = 3;
  const bw = W / bays;
  for (let b = 0; b < bays; b++) {
    const x0 = b * bw;
    const wx = x0 + bw * 0.06,
      ww = bw * 0.88;
    const top = c.y(10.4),
      bottom = c.y(-0.9);
    opening(c, wx, top, bottom, ww);
    // Slim white mullions.
    g.fillStyle = '#f4f2ee';
    g.fillRect(wx + ww / 2 - 2, top, 4, bottom - top);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.beginPath();
    g.moveTo(wx + ww * 0.1, bottom);
    g.lineTo(wx + ww * 0.25, bottom);
    g.lineTo(wx + ww * 0.55, top);
    g.lineTo(wx + ww * 0.4, top);
    g.fill();
    // Sheer curtains gathered at the frame.
    for (const [cx, dir] of [
      [wx, 1],
      [wx + ww, -1],
    ] as const) {
      const cw = bw * 0.07;
      const sx = dir > 0 ? cx : cx - cw;
      const cg = g.createLinearGradient(sx, 0, sx + cw, 0);
      for (let k = 0; k <= 8; k++) cg.addColorStop(k / 8, k % 2 ? 'rgba(255,255,255,0.55)' : 'rgba(235,232,226,0.8)');
      g.fillStyle = cg;
      g.fillRect(sx, top, cw, bottom - top);
    }
  }
  // Ceiling with a recessed cove of light.
  g.fillStyle = '#f2efe8';
  g.fillRect(0, 0, W, c.y(10.6));
  g.fillStyle = 'rgba(255,248,230,0.8)';
  g.fillRect(0, c.y(10.6), W, 3);
  // Floor skirting in pale stone.
  g.fillStyle = '#d6cfc2';
  g.fillRect(0, c.y(-0.9), W, H - c.y(-0.9));
}

/** Kyoto: an open timber pavilion over the garden, bamboo blinds rolled up. */
function pavilionRoom(c: Ctx) {
  const { g, W, H } = c;
  const timber = '#3a2716';
  g.fillStyle = timber;
  g.fillRect(0, 0, W, H);
  const bays = 4;
  const bw = W / bays;
  for (let b = 0; b < bays; b++) {
    const x0 = b * bw;
    const top = c.y(9.2),
      bottom = c.y(-0.6);
    opening(c, x0 + c.u(0.28), top, bottom, bw - c.u(0.56));
    post(c, x0 - c.u(0.28), c.u(0.56), c.y(10.4), H, '#4a321c', 0.15);
    // Rolled sudare blind with its cords.
    const bt = top - c.u(0.05);
    const bg = g.createLinearGradient(0, bt, 0, bt + c.u(0.55));
    bg.addColorStop(0, '#8a6a3a');
    bg.addColorStop(0.5, '#c9a869');
    bg.addColorStop(1, '#6a4a22');
    g.fillStyle = bg;
    g.fillRect(x0 + c.u(0.3), bt, bw - c.u(0.6), c.u(0.55));
    g.fillStyle = '#7a1f1b';
    for (const t of [0.3, 0.7]) {
      const cx = x0 + bw * t;
      g.fillRect(cx - 1, bt, 2, c.u(0.9));
      circleFill(g, cx, bt + c.u(1.0), c.u(0.08), '#7a1f1b');
    }
  }
  // Deep eave beam above, engawa deck below.
  g.fillStyle = '#24170c';
  g.fillRect(0, 0, W, c.y(9.2));
  g.fillStyle = '#4a321c';
  g.fillRect(0, c.y(10.2), W, c.u(0.3));
  const dg = g.createLinearGradient(0, c.y(-0.6), 0, H);
  dg.addColorStop(0, '#7a5a36');
  dg.addColorStop(1, '#3a2716');
  g.fillStyle = dg;
  g.fillRect(0, c.y(-0.6), W, H - c.y(-0.6));
  for (let x = 0; x < W; x += c.u(0.5)) {
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.fillRect(x, c.y(-0.6), 1.5, H - c.y(-0.6));
  }
}

/** Forbidden City: vermilion columns, painted beams, gold walls and dragon roundels. */
function palaceRoom(c: Ctx) {
  const { g, W, H, e } = c;
  const verm = '#9e1f12';
  // Gold-leaf wall with a soft sheen.
  const gw = g.createLinearGradient(0, 0, 0, H);
  gw.addColorStop(0, '#5a3a0c');
  gw.addColorStop(0.5, '#a8781e');
  gw.addColorStop(1, '#4a2e08');
  g.fillStyle = gw;
  g.fillRect(0, 0, W, H);
  const bays = 4;
  const bw = W / bays;
  for (let b = 0; b < bays; b++) {
    const x0 = b * bw;
    const cx = x0 + bw / 2;
    if (b % 2 === 0) {
      // Red lattice doors with gold studs.
      const dt = c.y(8.4),
        db = c.y(-0.8);
      g.fillStyle = mix(verm, '#000000', 0.25);
      g.fillRect(cx - bw * 0.3, dt, bw * 0.6, db - dt);
      lattice(c, cx - bw * 0.26, dt + c.u(0.3), bw * 0.24, (db - dt) * 0.55, '#c8961e', '#ffd9a0', 0.45);
      lattice(c, cx + bw * 0.02, dt + c.u(0.3), bw * 0.24, (db - dt) * 0.55, '#c8961e', '#ffd9a0', 0.45);
      g.fillStyle = '#e8c060';
      for (let k = 0; k < 5; k++) {
        circleFill(g, cx - c.u(0.12), dt + (db - dt) * (0.72 + k * 0.05), c.u(0.05), '#e8c060');
        circleFill(g, cx + c.u(0.12), dt + (db - dt) * (0.72 + k * 0.05), c.u(0.05), '#e8c060');
      }
    } else {
      // A dragon roundel on the gold wall.
      const cy = c.y(5);
      const rad = c.u(1.8);
      glow(g, cx, cy, rad * 1.8, '#ffd27a', 0.25);
      g.strokeStyle = '#6a1a0e';
      g.lineWidth = c.u(0.14);
      g.beginPath();
      g.arc(cx, cy, rad, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = 'rgba(110,30,10,0.85)';
      g.font = `400 ${Math.round(rad * 1.3)}px "Ma Shan Zheng", "Noto Serif SC", serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('龍', cx, cy + rad * 0.05);
      // Cloud scrolls either side.
      g.strokeStyle = 'rgba(110,30,10,0.5)';
      g.lineWidth = 2;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.arc(cx + s * rad * 1.7, cy + rad * 0.4, rad * 0.3, 0, Math.PI * 1.6);
        g.arc(cx + s * rad * 2.1, cy + rad * 0.3, rad * 0.2, Math.PI, Math.PI * 2.6);
        g.stroke();
      }
    }
    // Vermilion column with a gilded base.
    const pw = c.u(0.85);
    post(c, x0 - pw / 2, pw, c.y(9.4), H, verm, 0.18);
    g.fillStyle = '#c8961e';
    g.fillRect(x0 - pw / 2 - 3, c.y(-0.6), pw + 6, c.u(0.25));
  }
  // Painted beams: blue-green bands with gold outlines (hexi caihua).
  const bt = c.y(11.2),
    bb = c.y(9.4);
  g.fillStyle = '#123a4a';
  g.fillRect(0, bt, W, bb - bt);
  g.fillStyle = '#1f6a50';
  g.fillRect(0, bt + (bb - bt) * 0.35, W, (bb - bt) * 0.3);
  g.strokeStyle = '#e8c060';
  g.lineWidth = 1.5;
  for (let x = 0; x < W; x += bw / 2) {
    g.beginPath();
    g.moveTo(x, bt);
    g.lineTo(x + bw * 0.12, (bt + bb) / 2);
    g.lineTo(x, bb);
    g.moveTo(x + bw / 4, (bt + bb) / 2);
    g.ellipse(x + bw / 4, (bt + bb) / 2, bw * 0.08, (bb - bt) * 0.28, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = '#e8c060';
  g.fillRect(0, bt, W, 2);
  g.fillRect(0, bb - 2, W, 2);
  g.fillStyle = '#0c0604';
  g.fillRect(0, 0, W, bt);
  // Hanging palace lanterns.
  for (let k = 0; k < 4; k++) silkLantern(c, (k + 0.5) * (W / 4), c.y(8.6), c.u(0.8), '#d8401e', 0.9);
  finish(c, 12);
  void e;
}

/** Paint the interior for an environment. */
export function paintInterior(e: EnvironmentStyle, scale: 1 | 2, soften = true): HTMLCanvasElement {
  const W = 1024 * scale,
    H = 512 * scale;
  const span = IN_TOP - IN_FLOOR;
  const ux = W / ((2 * Math.PI * IN_RADIUS) / IN_REPEAT);
  const uy = H / span;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  const c: Ctx = {
    g,
    W,
    H,
    ux,
    y: (wy) => ((IN_TOP - wy) / span) * H,
    u: (w) => w * uy,
    r: rng(e.id.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 11)),
    e,
    brass: '#c9a46a',
  };
  switch (e.room) {
    case 'club':
      clubRoom(c);
      break;
    case 'shoji':
      shojiRoom(c);
      break;
    case 'lantern':
      lanternRoom(c);
      break;
    case 'arches':
      windowRoom(c, { arch: true, silk: '#6a3a1a', lacquer: '#3a2210' });
      break;
    case 'loft':
      loftRoom(c);
      break;
    case 'lounge':
      loungeRoom(c);
      break;
    case 'marble':
      marbleRoom(c);
      break;
    case 'pavilion':
      pavilionRoom(c);
      break;
    case 'palace':
      palaceRoom(c);
      break;
    case 'teahouse':
      teahouseRoom(c);
      break;
    case 'janso':
      jansoRoom(c);
      break;
    case 'majlis':
      majlisRoom(c);
      break;
  }
  if (!soften) return cv;
  // Slightly out of focus: the eye stays on the table.
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const og = out.getContext('2d')!;
  if ('filter' in og) {
    og.filter = `blur(${scale * 0.9}px)`;
    og.drawImage(cv, 0, 0);
    og.filter = 'none';
    return out;
  }
  return cv;
}

/** Does this environment's room have openings through to the panorama? */
export const hasOpenings = (e: EnvironmentStyle) => e.backdrop !== 'none';
