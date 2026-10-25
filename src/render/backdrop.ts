// Environment backdrops: the room's painted walls (interior.ts), the view
// beyond its windows (a painted panorama band further out) and a few
// out-of-focus bokeh lights. Three draw calls in total, so it runs on phones.
// Everything is dim on purpose: the table is the hero.

import * as THREE from 'three';
import type { EnvironmentStyle } from '../cosmetics/catalog';
import { mix } from './tileFaces';
import { IN_FLOOR, IN_RADIUS, IN_REPEAT, IN_TOP, hasOpenings, paintInterior } from './interior';
import { floorCanvas, rugCanvas } from './room';
import { paintHkStreet } from './venueRooms';
import { environmentStyle } from '../cosmetics/catalog';

const W = 2048;
const H = 512;
/** World height of the band: from the floor (-1.6) to TOP. */
const FLOOR = -1.6;
const TOP = 14.4;
const SPAN = TOP - FLOOR;
const RADIUS = 26;
const row = (y: number) => ((TOP - y) / SPAN) * H;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rgba = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(color, a));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

function skyGradient(g: CanvasRenderingContext2D, top: string, horizon: string, horizonY: number) {
  const gr = g.createLinearGradient(0, 0, 0, row(horizonY));
  gr.addColorStop(0, top);
  gr.addColorStop(1, horizon);
  g.fillStyle = gr;
  g.fillRect(0, 0, W, row(horizonY) + 1);
  g.fillStyle = horizon;
  g.fillRect(0, row(horizonY), W, H - row(horizonY));
}

function buildings(g: CanvasRenderingContext2D, r: () => number, base: number, minH: number, maxH: number, color: string, lit: number, lights: string[], minW = 34, maxW = 90) {
  let x = 0;
  const tops: [number, number, number][] = [];
  while (x < W) {
    let w = minW + r() * (maxW - minW);
    if (W - x - w < minW) w = W - x;
    const top = base + minH + Math.pow(r(), 1.6) * (maxH - minH);
    const y0 = row(top);
    g.fillStyle = color;
    g.fillRect(x, y0, w + 1, row(base) - y0);
    // Occasional set-back crown.
    if (r() < 0.25) g.fillRect(x + w * 0.25, y0 - 10, w * 0.5, 11);
    // Windows: a sparse warm grid.
    if (lit > 0) {
      for (let wy = y0 + 8; wy < row(base) - 6; wy += 9) {
        for (let wx = x + 5; wx < x + w - 6; wx += 7) {
          if (r() > lit) continue;
          const c = r() < 0.82 ? '#ffd9a0' : lights[Math.floor(r() * lights.length)];
          g.fillStyle = rgba(c, 0.25 + r() * 0.45);
          g.fillRect(wx, wy, 3, 4);
        }
      }
    }
    tops.push([x + w / 2, y0, w]);
    x += w;
  }
  return tops;
}

function paintSkyline(g: CanvasRenderingContext2D, e: EnvironmentStyle, r: () => number) {
  const glowC = e.bokeh[0];
  skyGradient(g, e.sky, mix(e.sky, glowC, 0.1), 2);
  // A faint city glow above the horizon.
  const hg = g.createLinearGradient(0, row(7), 0, row(1));
  hg.addColorStop(0, rgba(glowC, 0));
  hg.addColorStop(1, rgba(glowC, 0.07));
  g.fillStyle = hg;
  g.fillRect(0, row(7), W, row(1) - row(7));
  buildings(g, r, 0.5, 2.2, 6.5, mix(e.sky, '#000000', 0.05), 0.05, e.bokeh, 26, 60);
  const tops = buildings(g, r, 0.5, 1.4, 8.5, mix(e.sky, '#000000', 0.4), 0.13, e.bokeh);
  // A few slim signs in the city's colours, and red beacons on the tallest towers.
  if (e.bokeh.length > 1) {
    for (let i = 0; i < 7; i++) {
      const [cx, y0, w] = tops[Math.floor(r() * tops.length)];
      const c = e.bokeh[1 + Math.floor(r() * (e.bokeh.length - 1))];
      const sx = cx + (r() - 0.5) * w * 0.5;
      const sy = y0 + 14 + r() * 30;
      glow(g, sx, sy + 22, 26, c, 0.08);
      g.fillStyle = rgba(c, 0.55);
      g.fillRect(sx, sy, 3, 44);
    }
  }
  tops
    .slice()
    .sort((a, b) => a[1] - b[1])
    .slice(0, 4)
    .forEach(([cx, y0]) => {
      glow(g, cx, y0 - 14, 8, '#ff4d3a', 0.35);
      g.fillStyle = 'rgba(255,90,70,0.8)';
      g.fillRect(cx - 1, y0 - 15, 2, 2);
    });
}

function paintHarbour(g: CanvasRenderingContext2D, e: EnvironmentStyle, r: () => number) {
  const horizon = 2.3;
  skyGradient(g, e.sky, mix(e.sky, e.bokeh[0], 0.08), horizon);
  buildings(g, r, horizon, 1, 4.6, mix(e.sky, '#000000', 0.08), 0.06, e.bokeh, 24, 54);
  buildings(g, r, horizon, 0.4, 3.4, mix(e.sky, '#000000', 0.4), 0.14, e.bokeh, 30, 80);
  // A pearl tower: spheres on a needle, once per half-panorama.
  for (const tx of [620, 1660]) {
    const col = mix(e.sky, '#000000', 0.45);
    g.fillStyle = col;
    g.fillRect(tx - 3, row(11.5), 6, row(horizon) - row(11.5));
    g.fillRect(tx - 14, row(5), 4, row(horizon) - row(5));
    g.fillRect(tx + 10, row(5), 4, row(horizon) - row(5));
    for (const [y, rad] of [
      [4.4, 20],
      [8.2, 13],
      [10.4, 6],
    ] as const) {
      glow(g, tx, row(y), rad * 2.4, e.bokeh[0], 0.12);
      g.fillStyle = col;
      g.beginPath();
      g.arc(tx, row(y), rad, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = rgba(e.bokeh[0], 0.55);
      for (let k = 0; k < 6; k++) g.fillRect(tx - rad * 0.7 + k * rad * 0.28, row(y) - 1, 2, 2);
    }
  }
  // Water: dark, with long soft reflections of the lights.
  const water = g.createLinearGradient(0, row(horizon), 0, row(0.7));
  water.addColorStop(0, mix(e.sky, e.bokeh[0], 0.05));
  water.addColorStop(1, mix(e.sky, '#000000', 0.3));
  g.fillStyle = water;
  g.fillRect(0, row(horizon), W, row(0.7) - row(horizon));
  for (let i = 0; i < 160; i++) {
    const c = r() < 0.5 ? '#ffd9a0' : e.bokeh[Math.floor(r() * e.bokeh.length)];
    const x = r() * W;
    const y = row(horizon) + 2 + r() * (row(0.8) - row(horizon) - 10);
    g.fillStyle = rgba(c, 0.12 + r() * 0.22);
    g.fillRect(x, y, 2 + r() * 10, 1.5);
  }
}

function lantern(g: CanvasRenderingContext2D, x: number, y: number, s: number, c1: string, c2: string, a: number) {
  glow(g, x, y, 26 * s, c2, 0.22 * a);
  const gr = g.createRadialGradient(x - 2 * s, y - 3 * s, 1, x, y, 13 * s);
  gr.addColorStop(0, rgba(mix(c2, '#ffffff', 0.35), a));
  gr.addColorStop(0.6, rgba(c1, a));
  gr.addColorStop(1, rgba(mix(c1, '#000000', 0.4), a));
  g.fillStyle = gr;
  g.beginPath();
  g.ellipse(x, y, 10 * s, 12.5 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = rgba('#2a1a10', a);
  g.fillRect(x - 5 * s, y - 14 * s, 10 * s, 3 * s);
  g.fillRect(x - 5 * s, y + 11 * s, 10 * s, 3 * s);
  g.strokeStyle = rgba('#000000', 0.18 * a);
  g.lineWidth = 1;
  g.beginPath();
  g.ellipse(x, y, 4.5 * s, 12 * s, 0, 0, Math.PI * 2);
  g.stroke();
}

function paintLanterns(g: CanvasRenderingContext2D, e: EnvironmentStyle, r: () => number) {
  const [red, amber] = [e.bokeh[0], e.bokeh[1] ?? e.bokeh[0]];
  skyGradient(g, e.sky, mix(e.sky, amber, 0.12), 2.5);
  // Rooftops with upturned eaves.
  const roof = mix(e.sky, '#000000', 0.35);
  let x = 0;
  while (x < W) {
    let w = 120 + r() * 160;
    if (W - x - w < 120) w = W - x;
    const top = row(4.5 + r() * 3.5);
    g.fillStyle = roof;
    g.fillRect(x + 10, top, w - 20, H - top);
    g.beginPath();
    g.moveTo(x - 6, top + 4);
    g.quadraticCurveTo(x + w * 0.2, top - 2, x + w / 2, top - 18);
    g.quadraticCurveTo(x + w * 0.8, top - 2, x + w + 6, top + 4);
    g.lineTo(x + w + 6, top + 9);
    g.lineTo(x - 6, top + 9);
    g.fill();
    // Warm shop windows.
    for (let k = 0; k < 3; k++) {
      if (r() < 0.5) continue;
      const wx = x + 20 + r() * (w - 60);
      const wy = top + 30 + r() * 60;
      g.fillStyle = rgba(amber, 0.16 + r() * 0.2);
      g.fillRect(wx, wy, 18 + r() * 14, 12 + r() * 10);
    }
    x += w;
  }
  // Strings of lanterns at three depths.
  const strings: [number, number, number][] = [
    [9.5, 0.55, 0.55],
    [7.4, 0.8, 0.75],
    [5.6, 1.05, 0.95],
  ];
  for (const [y, s, a] of strings) {
    const span = 340 * s + 80;
    for (let x0 = -r() * span; x0 < W; x0 += span) {
      const y0 = row(y);
      const sag = 26 * s;
      g.strokeStyle = rgba('#000000', 0.5);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo(x0 + span / 2, y0 + sag * 2, x0 + span, y0);
      g.stroke();
      const n = Math.round(span / (44 * s));
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const lx = x0 + span * t;
        if (lx < 20 || lx > W - 20) continue;
        const ly = y0 + 2 * sag * 2 * t * (1 - t) + 16 * s;
        lantern(g, lx, ly, s, i % 3 === 0 ? amber : red, amber, a);
      }
    }
  }
}

function paintDesert(g: CanvasRenderingContext2D, e: EnvironmentStyle, r: () => number) {
  const warm = e.bokeh[0];
  const gr = g.createLinearGradient(0, 0, 0, row(1.6));
  gr.addColorStop(0, e.sky);
  gr.addColorStop(0.55, mix(e.sky, warm, 0.12));
  gr.addColorStop(1, mix(e.sky, warm, 0.36));
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(255,244,220,${0.15 + r() * 0.4})`;
    const s = r() < 0.9 ? 1 : 2;
    g.fillRect(r() * W, r() * row(7), s, s);
  }
  // A low sun settling behind the dunes.
  for (const sx of [760, 1800]) {
    glow(g, sx, row(2.4), 180, warm, 0.22);
    glow(g, sx, row(2.4), 40, '#fff1c9', 0.5);
  }
  const layers = [
    [2.8, 0.55, mix(e.sky, warm, 0.22)],
    [2.0, 0.7, mix(e.sky, warm, 0.12)],
    [1.2, 0.9, mix(e.sky, '#000000', 0.25)],
  ] as const;
  layers.forEach(([base, amp, col], li) => {
    const k1 = (2 + li) * 2,
      k2 = (5 + li * 2) * 2;
    const p1 = r() * 6,
      p2 = r() * 6;
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      const t = (x / W) * Math.PI * 2;
      const y = base + amp * (0.6 * Math.sin(t * (k1 / 2) + p1) + 0.4 * Math.sin(t * (k2 / 2) + p2));
      g.lineTo(x, row(y));
    }
    g.lineTo(W, H);
    g.fill();
    // Wind-lit crest.
    g.strokeStyle = rgba(warm, 0.12);
    g.lineWidth = 1.5;
    g.stroke();
  });
}

/** Tokyo in the rain: dense towers hung with vertical neon signs, rain streaking past. */
function paintNeon(g: CanvasRenderingContext2D, e: EnvironmentStyle, r: () => number) {
  skyGradient(g, e.sky, mix(e.sky, '#3a1a5a', 0.5), 1.5);
  const hg = g.createLinearGradient(0, row(8), 0, row(1));
  hg.addColorStop(0, rgba('#ff4fa0', 0));
  hg.addColorStop(1, rgba('#ff4fa0', 0.12));
  g.fillStyle = hg;
  g.fillRect(0, row(8), W, row(1) - row(8));
  buildings(g, r, 0.5, 3, 9, mix(e.sky, '#000000', 0.1), 0.08, e.bokeh, 30, 70);
  const tops = buildings(g, r, 0.5, 2, 7.5, mix(e.sky, '#000000', 0.5), 0.12, e.bokeh, 40, 100);
  // Vertical signs: a bright bar with glyph-like rungs, and its glow.
  for (let i = 0; i < 46; i++) {
    const [cx, y0, w] = tops[Math.floor(r() * tops.length)];
    const c = e.bokeh[Math.floor(r() * e.bokeh.length)];
    const sx = cx + (r() - 0.5) * w * 0.7;
    const sy = y0 + 10 + r() * 60;
    const sh = 30 + r() * 70,
      sw = 7 + r() * 5;
    glow(g, sx + sw / 2, sy + sh / 2, sh * 0.8, c, 0.16);
    g.fillStyle = rgba(c, 0.85);
    g.fillRect(sx, sy, sw, sh);
    g.fillStyle = rgba('#000000', 0.55);
    for (let k = 4; k < sh - 4; k += 9) g.fillRect(sx + 2, sy + k, sw - 4, 3 + (r() < 0.5 ? 2 : 0));
  }
  // Horizontal billboards.
  for (let i = 0; i < 10; i++) {
    const [cx, y0] = tops[Math.floor(r() * tops.length)];
    const c = e.bokeh[Math.floor(r() * e.bokeh.length)];
    glow(g, cx, y0 + 20, 50, c, 0.15);
    g.fillStyle = rgba(c, 0.5);
    g.fillRect(cx - 24, y0 + 12, 48, 16);
  }
  // Rain.
  g.strokeStyle = 'rgba(200,220,255,0.12)';
  g.lineWidth = 1;
  for (let i = 0; i < 900; i++) {
    const x = r() * W,
      y = r() * H;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - 3, y + 14);
    g.stroke();
  }
}

/** Day over the sea: pale sky, soft clouds, a sparkling horizon and hazy islands. */
function paintDaySea(g: CanvasRenderingContext2D, e: EnvironmentStyle, r: () => number) {
  const horizon = 1.4;
  const sky = g.createLinearGradient(0, 0, 0, row(horizon));
  sky.addColorStop(0, '#7fb2dc');
  sky.addColorStop(0.6, '#b9d6ea');
  sky.addColorStop(1, '#e8f0f2');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, row(horizon) + 1);
  // Clouds: soft clusters of white.
  for (let i = 0; i < 26; i++) {
    const cx = r() * W,
      cy = row(5 + r() * 7);
    for (let k = 0; k < 6; k++) glow(g, cx + (r() - 0.5) * 120, cy + (r() - 0.5) * 18, 30 + r() * 40, '#ffffff', 0.35);
  }
  // Distant islands and a far skyline, blue in the haze.
  for (const [base, col, amp] of [
    [horizon, '#9bb4c8', 1.3],
    [horizon, '#86a2b8', 0.7],
  ] as const) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, row(base));
    for (let x = 0; x <= W; x += 16) {
      const t = (x / W) * Math.PI * 2;
      const y = base + Math.max(0, amp * (0.6 * Math.sin(t * 3 + amp * 4) + 0.5 * Math.sin(t * 7 + 1)));
      g.lineTo(x, row(y));
    }
    g.lineTo(W, row(base));
    g.fill();
  }
  buildings(g, r, horizon, 0.2, 1.4, '#92a9bc', 0, e.bokeh, 8, 22);
  // Sea.
  const sea = g.createLinearGradient(0, row(horizon), 0, H);
  sea.addColorStop(0, '#5f8fb0');
  sea.addColorStop(1, '#2f5f82');
  g.fillStyle = sea;
  g.fillRect(0, row(horizon), W, H - row(horizon));
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.45})`;
    const y = row(horizon) + Math.pow(r(), 2) * (H - row(horizon));
    g.fillRect(r() * W, y, 2 + r() * 8, 1);
  }
  // A sailboat or two.
  for (const sx of [420, 1500]) {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(sx, row(horizon) + 6);
    g.lineTo(sx, row(horizon) - 18);
    g.lineTo(sx + 10, row(horizon) + 4);
    g.fill();
  }
}

/** A Kyoto garden: bamboo grove, red maples, raked gravel and a stone lantern. */
function paintGarden(g: CanvasRenderingContext2D, e: EnvironmentStyle, r: () => number) {
  const sky = g.createLinearGradient(0, 0, 0, row(2));
  sky.addColorStop(0, '#d9e6ea');
  sky.addColorStop(1, '#eef0e2');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  // Far hills in mist.
  g.fillStyle = '#a9bca4';
  g.beginPath();
  g.moveTo(0, row(1));
  for (let x = 0; x <= W; x += 16) g.lineTo(x, row(3.5 + 1.5 * Math.sin((x / W) * Math.PI * 6) + 0.6 * Math.sin((x / W) * Math.PI * 14)));
  g.lineTo(W, row(1));
  g.fill();
  // Bamboo at three depths.
  for (const [n, col, wmin, a] of [
    [90, '#8fae7a', 3, 0.6],
    [60, '#6e9a58', 5, 0.85],
    [30, '#4f7a3a', 8, 1],
  ] as const) {
    for (let i = 0; i < n; i++) {
      const x = r() * W;
      const w = wmin + r() * wmin * 0.6;
      g.fillStyle = rgba(col, a);
      g.fillRect(x, 0, w, row(0.8));
      g.fillStyle = rgba('#2a4a1a', 0.35 * a);
      for (let y = 20 + r() * 40; y < row(0.8); y += 40 + r() * 20) g.fillRect(x - 1, y, w + 2, 2);
    }
    // Leaves.
    for (let i = 0; i < n * 6; i++) {
      g.fillStyle = rgba(mix(col, '#2a4a1a', r() * 0.4), 0.5 * a);
      const x = r() * W,
        y = r() * row(5);
      g.beginPath();
      g.ellipse(x, y, 10 + r() * 8, 2.5, r() * 0.8 - 0.4, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Red and orange maples.
  for (let i = 0; i < 9; i++) {
    const x = r() * W,
      y = row(3 + r() * 2.5);
    g.fillStyle = '#3a2416';
    g.fillRect(x - 3, y, 6, row(0.8) - y);
    for (let k = 0; k < 40; k++) {
      g.fillStyle = rgba(['#c0392b', '#d9542a', '#e8892c', '#a8231c'][k % 4], 0.55);
      g.beginPath();
      g.arc(x + (r() - 0.5) * 110, y + (r() - 0.6) * 60, 8 + r() * 12, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Raked gravel with stepping stones and a stone lantern.
  const gy = row(0.8);
  g.fillStyle = '#d8d4c8';
  g.fillRect(0, gy, W, H - gy);
  g.strokeStyle = 'rgba(120,115,100,0.35)';
  g.lineWidth = 1;
  for (let y = gy + 4; y < H; y += 5) {
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= W; x += 40) g.lineTo(x, y + Math.sin(x * 0.02) * 1.5);
    g.stroke();
  }
  for (const lx of [300, 1340]) {
    g.fillStyle = '#7a7a72';
    g.fillRect(lx - 6, row(2.0), 12, gy - row(2.0));
    g.fillRect(lx - 22, row(2.6), 44, row(2.0) - row(2.6));
    g.beginPath();
    g.moveTo(lx - 34, row(2.6));
    g.lineTo(lx, row(3.4));
    g.lineTo(lx + 34, row(2.6));
    g.fill();
    glow(g, lx, row(2.3), 26, '#ffe2a0', 0.4);
  }
  void e;
}

function paintPanorama(e: EnvironmentStyle) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const r = rng(e.id.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));
  switch (e.backdrop) {
    case 'skyline':
      paintSkyline(g, e, r);
      break;
    case 'harbour':
      paintHarbour(g, e, r);
      break;
    case 'lanterns':
      paintLanterns(g, e, r);
      break;
    case 'desert':
      paintDesert(g, e, r);
      break;
    case 'neon':
      paintNeon(g, e, r);
      break;
    case 'daysea':
      paintDaySea(g, e, r);
      break;
    case 'garden':
      paintGarden(g, e, r);
      break;
    case 'hkstreet':
      paintHkStreet(g, e, r, W, H, row);
      break;
    default:
      paintSkyline(g, e, r);
  }
  // Fade the foot of the band into the floor so the seam never shows.
  if (e.ambient > 0.5) return c;
  const foot = g.createLinearGradient(0, row(0.2), 0, H);
  foot.addColorStop(0, rgba(e.sky, 0));
  foot.addColorStop(1, e.sky);
  g.fillStyle = foot;
  g.fillRect(0, row(0.2), W, H - row(0.2));
  return c;
}

let bokehTex: THREE.Texture | undefined;
/** A soft disc with a faint brighter rim: the look of an out-of-focus light. */
export function bokehTexture() {
  if (bokehTex) return bokehTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 31);
  gr.addColorStop(0, 'rgba(255,255,255,0.45)');
  gr.addColorStop(0.78, 'rgba(255,255,255,0.6)');
  gr.addColorStop(0.9, 'rgba(255,255,255,0.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  bokehTex = new THREE.CanvasTexture(c);
  return bokehTex;
}

export class Backdrop {
  readonly group = new THREE.Group();
  private band: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  private room: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  private bokeh?: THREE.Points;

  constructor(private paint: 1 | 2 = 2) {
    const geo = new THREE.CylinderGeometry(RADIUS, RADIUS, SPAN, 48, 1, true);
    geo.translate(0, FLOOR + SPAN / 2, 0);
    this.band = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false }));
    this.band.renderOrder = -10;
    // The room's own walls, between the table and the view.
    const ig = new THREE.CylinderGeometry(IN_RADIUS, IN_RADIUS, IN_TOP - IN_FLOOR, 72, 1, true);
    ig.translate(0, IN_FLOOR + (IN_TOP - IN_FLOOR) / 2, 0);
    this.room = new THREE.Mesh(ig, new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false, transparent: true }));
    this.room.renderOrder = -9;
    this.group.add(this.band, this.room);
  }

  set(e: EnvironmentStyle) {
    const open = hasOpenings(e);
    this.band.visible = open;
    if (open) {
      // The view beyond the glass: a touch softer still, as if focused on the table.
      const src = paintPanorama(e);
      let cv = src;
      const soft = document.createElement('canvas');
      soft.width = W;
      soft.height = H;
      const sg = soft.getContext('2d')!;
      if ('filter' in sg) {
        sg.filter = 'blur(1.2px)';
        sg.drawImage(src, 0, 0);
        cv = soft;
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.repeat.set(2, 1);
      tex.anisotropy = 4;
      this.band.material.map?.dispose();
      this.band.material.map = tex;
      // The city is painted dim; lift it a little so its lights read through the glass.
      this.band.material.color.setScalar(e.ambient > 0.5 ? 1 : 1.45);
      this.band.material.needsUpdate = true;
    }
    const rt = new THREE.CanvasTexture(paintInterior(e, this.paint));
    rt.colorSpace = THREE.SRGBColorSpace;
    rt.wrapS = THREE.RepeatWrapping;
    rt.repeat.set(IN_REPEAT, 1);
    rt.anisotropy = 4;
    this.room.material.map?.dispose();
    this.room.material.map = rt;
    this.room.material.needsUpdate = true;

    if (this.bokeh) {
      this.group.remove(this.bokeh);
      this.bokeh.geometry.dispose();
      (this.bokeh.material as THREE.Material).dispose();
    }
    // Out-of-focus lights: sconces and lamps inside the room, plus the city through the glass.
    const r = rng(e.id.length * 977 + 13);
    const n = open ? 34 : 22;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const inside = !open || i % 2 === 0;
      const rad = inside ? 9 + r() * 6 : 18 + r() * 6;
      pos.set([Math.cos(a) * rad, inside ? 0.5 + r() * 5.5 : -0.5 + r() * 7, Math.sin(a) * rad], i * 3);
      c.set(inside ? mix('#ffd9a6', e.key, 0.4) : e.bokeh[i % e.bokeh.length]).multiplyScalar(0.5 + r() * 0.5);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.bokeh = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ map: bokehTexture(), size: 1.1, vertexColors: true, transparent: true, opacity: e.ambient > 0.5 ? 0.05 : 0.16, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    this.bokeh.renderOrder = -8;
    this.group.add(this.bokeh);
  }

  update(dt: number) {
    if (this.bokeh) this.bokeh.rotation.y += dt * 0.004;
  }
}

// ------------------------------------------------------------ shop preview

const previewCache = new Map<string, string>();

/**
 * A portrait of an environment for the shop, built from the room's real
 * paintings: the view, the walls, the floor and rug in perspective, the
 * table under its lamp. A few milliseconds per room, cached.
 */
export function environmentPreview(id: string, w = 480, h = 264): string {
  const key = `${id}:${w}x${h}`;
  const hit = previewCache.get(key);
  if (hit) return hit;
  const e = environmentStyle(id);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const k = w / 480;
  // A simple camera: eye height above the floor, focal length, distance from the room's centre.
  const Hc = 5.5,
    f = 260 * k,
    Zc = 15,
    y0 = 0.4 * h;
  const scr = (height: number, D: number) => y0 + ((Hc - height) * f) / D;
  g.fillStyle = e.sky;
  g.fillRect(0, 0, w, h);
  // The view beyond the windows.
  if (hasOpenings(e)) {
    const pano = paintPanorama(e);
    const D = RADIUS + Zc;
    const s = f / D / (H / SPAN);
    const top = scr(TOP - FLOOR, D);
    for (let x = 0; x < w; x += W * s) g.drawImage(pano, x, top, W * s, H * s);
  }
  // The walls: one painting repeats round the room.
  const interior = paintInterior(e, 1, false);
  {
    const D = IN_RADIUS + Zc;
    const pxPerUnit = f / D;
    const iw = ((2 * Math.PI * IN_RADIUS) / IN_REPEAT) * pxPerUnit;
    const ih = (IN_TOP - IN_FLOOR) * pxPerUnit;
    const top = scr(IN_TOP - IN_FLOOR, D);
    for (let x = -iw * 0.3; x < w; x += iw) g.drawImage(interior, x, top, iw, ih);
    if (top > 0) {
      g.fillStyle = e.ambient > 0.5 ? mix(e.sky, '#ffffff', 0.5) : mix(e.sky, '#000000', 0.3);
      g.fillRect(0, 0, w, top);
    }
  }
  // Floor and rug, row by row in perspective.
  const fl = floorCanvas(e.floor);
  const pat = g.createPattern(fl.canvas, 'repeat')!;
  const texPerUnit = (fl.canvas.width * fl.repeat) / 60;
  const rug = rugCanvas(e);
  const floorTop = Math.ceil(scr(0, IN_RADIUS + Zc));
  for (let sy = floorTop; sy < h; sy++) {
    const D = (Hc * f) / (sy + 0.5 - y0);
    const zw = Zc - D;
    const s = f / D / texPerUnit;
    pat.setTransform(new DOMMatrix([s, 0, 0, s, w / 2 - s * (30 * texPerUnit), sy - s * ((zw + 30) * texPerUnit)]));
    g.fillStyle = pat;
    g.fillRect(0, sy, w, 1);
    if (rug && Math.abs(zw) < 7.5) {
      const v = ((zw + 7.5) / 15) * rug.height;
      const half = (7.5 * f) / D;
      g.drawImage(rug, 0, Math.min(rug.height - 1, v), rug.width, 1, w / 2 - half, sy, half * 2, 1);
    }
  }
  // Light: a pool under the lamp, the room falling away into shadow or haze.
  const pool = g.createRadialGradient(w / 2, scr(0, Zc), 10 * k, w / 2, scr(0, Zc), w * 0.6);
  pool.addColorStop(0, 'rgba(0,0,0,0)');
  pool.addColorStop(1, e.ambient > 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.55)');
  g.fillStyle = pool;
  g.fillRect(0, floorTop, w, h - floorTop);
  // The table: rim, felt and a hint of tile walls.
  const quad = (half: number, height: number, color: string) => {
    const far = Zc + half,
      near = Zc - half;
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(w / 2 - (half * f) / far, scr(height, far));
    g.lineTo(w / 2 + (half * f) / far, scr(height, far));
    g.lineTo(w / 2 + (half * f) / near, scr(height, near));
    g.lineTo(w / 2 - (half * f) / near, scr(height, near));
    g.closePath();
    g.fill();
  };
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.6)';
  g.shadowBlur = 18 * k;
  g.shadowOffsetY = 8 * k;
  quad(4.85, 1.45, '#2a180e');
  g.restore();
  {
    // Apron below the near edge.
    const near = Zc - 4.85;
    g.fillStyle = '#1c1008';
    g.fillRect(w / 2 - (4.85 * f) / near, scr(1.45, near), (9.7 * f) / near, ((0.6 * f) / near));
  }
  quad(4.4, 1.6, '#17402f');
  const felt = g.createRadialGradient(w / 2, scr(1.6, Zc), 4, w / 2, scr(1.6, Zc), (5 * f) / Zc);
  felt.addColorStop(0, rgba(mix(e.key, '#ffffff', 0.4), 0.28));
  felt.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = felt;
  g.fillRect(0, scr(1.6, Zc + 4.4), w, scr(1.6, Zc - 4.4) - scr(1.6, Zc + 4.4));
  for (const z of [-2.8, 2.8]) {
    const D = Zc + z;
    g.fillStyle = 'rgba(240,232,214,0.85)';
    g.fillRect(w / 2 - (2.4 * f) / D, scr(1.85, D), (4.8 * f) / D, ((0.22 * f) / D));
  }
  // The lamp's glow above the table.
  const ly = scr(1.6 + 5.7, Zc);
  const lampC = e.lamp === 'halo' ? '#ffffff' : e.lamp === 'lantern' ? '#ff7a3a' : e.lamp === 'palace' ? '#ff9a50' : e.lamp === 'paper' ? '#fff4e0' : mix('#ffd9a6', e.key, 0.5);
  const lg = g.createRadialGradient(w / 2, ly, 2, w / 2, ly, 70 * k);
  lg.addColorStop(0, rgba(lampC, 0.9));
  lg.addColorStop(0.25, rgba(lampC, 0.35));
  lg.addColorStop(1, rgba(lampC, 0));
  g.fillStyle = lg;
  g.fillRect(w / 2 - 70 * k, ly - 70 * k, 140 * k, 140 * k);
  g.fillStyle = rgba(lampC, 0.95);
  g.beginPath();
  if (e.lamp === 'halo') {
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3 * k;
    g.ellipse(w / 2, ly, 34 * k, 6 * k, 0, 0, Math.PI * 2);
    g.stroke();
  } else if (e.lamp === 'industrial') {
    for (const dx of [-30, 0, 30]) {
      g.moveTo(w / 2 + dx * k + 9 * k, ly);
      g.ellipse(w / 2 + dx * k, ly, 9 * k, 5 * k, 0, 0, Math.PI * 2);
    }
    g.fill();
  } else if (e.lamp === 'paper' || e.lamp === 'lantern') {
    g.ellipse(w / 2, ly - 10 * k, 18 * k, 16 * k, 0, 0, Math.PI * 2);
    g.fill();
  } else {
    g.ellipse(w / 2, ly, 26 * k, 7 * k, 0, 0, Math.PI * 2);
    g.fill();
  }
  const url = c.toDataURL('image/jpeg', 0.86);
  previewCache.set(key, url);
  return url;
}
