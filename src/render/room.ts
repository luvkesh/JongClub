// Room dressing around the table: the pendant lamp with its soft beam and
// dust, the rug and parquet, the chairs (establishing shot only), a contact
// shadow under the table, and the warm reflection environment the brass,
// lacquer and tiles pick up. All procedural; a handful of draw calls.

import * as THREE from 'three';
import type { EnvironmentStyle } from '../cosmetics/catalog';
import { mix } from './tileFaces';
import type { QualitySpec } from './quality';
import { ChairSet } from './chairs';
import { SideTables } from './sideTables';
import { VenueProps, buildVenueLamp, paintSaduRug, paintVenueFloor } from './venueProps';

export const FLOOR_Y = -1.6;
export const LAMP_Y = 5.7;

function canvas(w: number, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function srgb(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let softTex: THREE.Texture | undefined;
/** A soft round glow, for fake bloom and dust. */
export function softGlow() {
  if (softTex) return softTex;
  const [c, g] = canvas(64);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.2, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.14)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  softTex = new THREE.CanvasTexture(c);
  return softTex;
}

/**
 * A warm, dim club room for reflections: dark walls, one bright lamp overhead
 * and a few low sconces, so brass and lacquer catch believable highlights.
 */
export function clubEnvironment(renderer: THREE.WebGLRenderer) {
  const s = new THREE.Scene();
  const box = new THREE.Mesh(new THREE.BoxGeometry(30, 14, 30), new THREE.MeshBasicMaterial({ color: '#1a120c', side: THREE.BackSide }));
  box.position.y = 5;
  s.add(box);
  const em = (color: string, k: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) });
  const lamp = new THREE.Mesh(new THREE.CircleGeometry(2.4, 32), em('#fff0dc', 9));
  lamp.rotation.x = Math.PI / 2;
  lamp.position.y = 9;
  s.add(lamp);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.6), em(i % 2 ? '#ffd6a8' : '#ffe8cc', 2.2));
    p.position.set(Math.cos(a) * 14.8, 4, Math.sin(a) * 14.8);
    p.lookAt(0, 4, 0);
    s.add(p);
  }
  // A long soft window glow on one side, so glossy backs get a gentle sweep.
  const win = new THREE.Mesh(new THREE.PlaneGeometry(14, 4), em('#c8bca8', 0.6));
  win.position.set(0, 5, -14.8);
  s.add(win);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), em('#2a1a10', 1));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.5;
  s.add(floor);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(s, 0.02).texture;
  pmrem.dispose();
  s.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    (m.material as THREE.Material | undefined)?.dispose();
  });
  return tex;
}

// ------------------------------------------------------------ floor and rug

function parquetTexture() {
  const [c, g] = canvas(512);
  g.fillStyle = '#1b110b';
  g.fillRect(0, 0, 512, 512);
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // Herringbone: 45° planks, alternating.
  const L = 128,
    Wd = 32;
  g.save();
  g.translate(256, 256);
  g.rotate(Math.PI / 4);
  for (let row = -12; row < 12; row++) {
    for (let col = -12; col < 12; col++) {
      const x = col * Wd + row * Wd,
        y = row * Wd - col * Wd;
      const tone = 18 + r() * 14;
      const vertical = (row + col) % 2 === 0;
      g.fillStyle = `rgb(${tone + 14},${tone + 4},${tone - 4})`;
      if (vertical) g.fillRect(x, y, Wd - 1, L / 2 - 1);
      else g.fillRect(x, y, L / 2 - 1, Wd - 1);
    }
  }
  g.restore();
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,220,180,0.03)';
    g.fillRect(r() * 512, r() * 512, 1 + r() * 6, 1);
  }
  const t = srgb(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  t.anisotropy = 4;
  return t;
}

const floorCache = new Map<string, THREE.Texture>();

/** Each room's floor, painted once and tiled. */
function floorTexture(kind: EnvironmentStyle['floor']) {
  const hit = floorCache.get(kind);
  if (hit) return hit;
  if (kind === 'parquet') {
    const t = parquetTexture();
    floorCache.set(kind, t);
    return t;
  }
  const S = 512;
  const [c, g] = canvas(S);
  let sd = 11;
  const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  let repeat = 10;
  const veins = (color: string, n: number, a: number) => {
    for (let i = 0; i < n; i++) {
      g.strokeStyle = color.replace('A', String(a * (0.4 + r())));
      g.lineWidth = 0.6 + r() * 2;
      g.beginPath();
      let x = r() * S,
        y = r() * S;
      g.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        const nx = x + (r() - 0.3) * 160,
          ny = y + (r() - 0.5) * 120;
        g.quadraticCurveTo(x + (r() - 0.5) * 80, y + (r() - 0.5) * 80, nx, ny);
        x = nx;
        y = ny;
      }
      g.stroke();
    }
  };
  switch (kind) {
    case 'tatami': {
      // Mats two-by-one in the auspicious layout, with dark cloth borders.
      repeat = 7;
      const mats: [number, number, number, number][] = [
        [0, 0, 256, 128],
        [256, 0, 128, 256],
        [384, 0, 128, 256],
        [0, 128, 128, 256],
        [128, 128, 128, 256],
        [256, 256, 256, 128],
        [0, 384, 256, 128],
        [256, 384, 256, 128],
      ];
      for (const [x, y, w, h] of mats) {
        const tone = 0.9 + r() * 0.15;
        g.fillStyle = `rgb(${Math.round(176 * tone)},${Math.round(170 * tone)},${Math.round(110 * tone)})`;
        g.fillRect(x, y, w, h);
        // Woven rush.
        const vertical = h > w;
        for (let k = 0; k < (vertical ? w : h); k += 3) {
          g.fillStyle = k % 6 ? 'rgba(90,80,30,0.12)' : 'rgba(255,250,210,0.08)';
          if (vertical) g.fillRect(x + k, y, 1.5, h);
          else g.fillRect(x, y + k, w, 1.5);
        }
        // Heri: the cloth border along the long sides.
        g.fillStyle = '#1a1a1a';
        if (vertical) {
          g.fillRect(x, y, 7, h);
          g.fillRect(x + w - 7, y, 7, h);
        } else {
          g.fillRect(x, y, w, 7);
          g.fillRect(x, y + h - 7, w, 7);
        }
        g.strokeStyle = 'rgba(0,0,0,0.4)';
        g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      }
      break;
    }
    case 'terracotta': {
      const n = 8,
        t = S / n;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const k = r();
          g.fillStyle = `rgb(${120 + k * 40},${42 + k * 18},${24 + k * 10})`;
          g.fillRect(x * t + 2, y * t + 2, t - 4, t - 4);
          g.fillStyle = 'rgba(255,200,150,0.06)';
          g.fillRect(x * t + 2, y * t + 2, t - 4, 3);
        }
      g.globalCompositeOperation = 'destination-over';
      g.fillStyle = '#2a140c';
      g.fillRect(0, 0, S, S);
      g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'zellige': {
      // Eight-point stars in sand with small crosses of turquoise glaze.
      repeat = 14;
      g.fillStyle = '#1f5a6a';
      g.fillRect(0, 0, S, S);
      const n = 4,
        t = S / n;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const cx = x * t + t / 2,
            cy = y * t + t / 2;
          g.fillStyle = r() < 0.5 ? '#d9c39a' : '#e3cfa8';
          g.beginPath();
          for (let k = 0; k < 16; k++) {
            const a = (k / 16) * Math.PI * 2;
            const rad = k % 2 ? t * 0.36 : t * 0.5;
            g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
          }
          g.closePath();
          g.fill();
          g.fillStyle = '#7a2a1a';
          g.beginPath();
          g.arc(cx, cy, t * 0.1, 0, Math.PI * 2);
          g.fill();
        }
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.lineWidth = 2;
      for (let k = 0; k <= n; k++) {
        g.beginPath();
        g.moveTo(k * t, 0);
        g.lineTo(k * t, S);
        g.moveTo(0, k * t);
        g.lineTo(S, k * t);
        g.stroke();
      }
      break;
    }
    case 'planks': {
      repeat = 6;
      const pw = 64;
      for (let x = 0; x < S; x += pw) {
        let y = -r() * 300;
        while (y < S) {
          const len = 220 + r() * 200;
          const k = r();
          g.fillStyle = `rgb(${46 + k * 22},${30 + k * 14},${20 + k * 8})`;
          g.fillRect(x + 1, y + 1, pw - 2, len - 2);
          for (let i = 0; i < 14; i++) {
            g.fillStyle = r() < 0.6 ? 'rgba(0,0,0,0.12)' : 'rgba(255,220,170,0.05)';
            g.fillRect(x + 2 + r() * (pw - 4), y, 1 + r() * 2, len);
          }
          y += len;
        }
      }
      break;
    }
    case 'checker': {
      // Black and white marble, laid on the diagonal.
      repeat = 12;
      const n = 4,
        t = S / n;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          g.fillStyle = (x + y) % 2 ? '#141214' : '#e6e1d8';
          g.fillRect(x * t, y * t, t, t);
        }
      veins('rgba(120,120,120,A)', 22, 0.25);
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      for (let k = 0; k <= n; k++) {
        g.beginPath();
        g.moveTo(k * t, 0);
        g.lineTo(k * t, S);
        g.moveTo(0, k * t);
        g.lineTo(S, k * t);
        g.stroke();
      }
      break;
    }
    case 'whitemarble': {
      repeat = 5;
      g.fillStyle = '#efece6';
      g.fillRect(0, 0, S, S);
      veins('rgba(140,138,135,A)', 26, 0.35);
      g.strokeStyle = 'rgba(160,150,140,0.35)';
      g.lineWidth = 1.5;
      g.strokeRect(0, 0, S, S);
      g.beginPath();
      g.moveTo(S / 2, 0);
      g.lineTo(S / 2, S);
      g.stroke();
      break;
    }
    case 'goldbrick': {
      // The palace's "golden bricks": dark, dense and polished like ink stone.
      repeat = 12;
      const n = 4,
        t = S / n;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const k = r();
          g.fillStyle = `rgb(${38 + k * 14},${38 + k * 12},${40 + k * 12})`;
          g.fillRect(x * t + 2, y * t + 2, t - 4, t - 4);
          const lg = g.createLinearGradient(x * t, y * t, x * t + t, y * t + t);
          lg.addColorStop(0, 'rgba(255,255,255,0.07)');
          lg.addColorStop(0.5, 'rgba(255,255,255,0)');
          g.fillStyle = lg;
          g.fillRect(x * t + 2, y * t + 2, t - 4, t - 4);
        }
      g.globalCompositeOperation = 'destination-over';
      g.fillStyle = '#1a1612';
      g.fillRect(0, 0, S, S);
      g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'mosaic':
    case 'carpet':
    case 'limestone':
      repeat = paintVenueFloor(kind, g, S, r);
      break;
  }
  const t = srgb(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  floorCache.set(kind, t);
  return t;
}

/** A silk rug under the table: deep field, key-fret border, a quiet medallion. */
function fretRug(e: EnvironmentStyle, field: string) {
  const S = 512;
  const [c, g] = canvas(S);
  const border = mix(field, '#000000', 0.45);
  const gold = mix('#c9a46a', e.key, 0.25);
  g.fillStyle = border;
  g.fillRect(0, 0, S, S);
  g.fillStyle = field;
  g.fillRect(40, 40, S - 80, S - 80);
  // Silk pile: fine noise.
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  // Key-fret border.
  g.strokeStyle = gold;
  g.globalAlpha = 0.55;
  g.lineWidth = 2;
  g.strokeRect(10, 10, S - 20, S - 20);
  g.strokeRect(40, 40, S - 80, S - 80);
  const fret = (x: number, y: number, s: number) => {
    g.beginPath();
    g.moveTo(x, y + s);
    g.lineTo(x, y);
    g.lineTo(x + s, y);
    g.lineTo(x + s, y + s * 0.7);
    g.lineTo(x + s * 0.3, y + s * 0.7);
    g.lineTo(x + s * 0.3, y + s * 0.35);
    g.stroke();
  };
  g.lineWidth = 1.6;
  for (let x = 16; x < S - 30; x += 20) {
    fret(x, 16, 14);
    fret(x, S - 32, 14);
    fret(16, x, 14);
    fret(S - 32, x, 14);
  }
  // Medallion and corner sprays.
  g.globalAlpha = 0.18;
  g.lineWidth = 2;
  for (const rad of [70, 96, 104]) {
    g.beginPath();
    g.arc(S / 2, S / 2, rad, 0, Math.PI * 2);
    g.stroke();
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    g.beginPath();
    g.ellipse(S / 2 + Math.cos(a) * 82, S / 2 + Math.sin(a) * 82, 16, 7, a, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 1;
  const t = srgb(c);
  t.anisotropy = 4;
  return t;
}

/** The rug in the room's own pattern. */
function rugTexture(e: EnvironmentStyle) {
  const field = e.rug;
  if (e.rugStyle === 'fret') return fretRug(e, field);
  const S = 512;
  const [c, g] = canvas(S);
  const gold = '#d4a94e';
  g.fillStyle = field;
  g.fillRect(0, 0, S, S);
  // Pile.
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 9;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const cx = S / 2;
  switch (e.rugStyle) {
    case 'sadu':
      paintSaduRug(g, S);
      break;
    case 'persian': {
      const indigo = '#1c2a4a',
        ivory = '#e9dcc0';
      g.fillStyle = indigo;
      g.fillRect(0, 0, S, 56);
      g.fillRect(0, S - 56, S, 56);
      g.fillRect(0, 0, 56, S);
      g.fillRect(S - 56, 0, 56, S);
      // Border florets.
      for (let k = 28; k < S; k += 36)
        for (const [x, y] of [
          [k, 28],
          [k, S - 28],
          [28, k],
          [S - 28, k],
        ]) {
          g.fillStyle = k % 72 < 36 ? ivory : gold;
          for (let p = 0; p < 4; p++) {
            g.beginPath();
            g.ellipse(x + Math.cos((p * Math.PI) / 2) * 7, y + Math.sin((p * Math.PI) / 2) * 7, 6, 3.5, (p * Math.PI) / 2, 0, Math.PI * 2);
            g.fill();
          }
        }
      g.strokeStyle = ivory;
      g.lineWidth = 3;
      g.strokeRect(60, 60, S - 120, S - 120);
      // Lobed medallion.
      for (const [rad, col] of [
        [150, indigo],
        [120, ivory],
        [100, field],
        [60, gold],
        [30, indigo],
      ] as const) {
        g.fillStyle = col;
        g.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.05) {
          const rr = rad * (1 + 0.08 * Math.cos(a * 8));
          g.lineTo(cx + Math.cos(a) * rr, cx + Math.sin(a) * rr);
        }
        g.fill();
      }
      // Corner spandrels.
      g.fillStyle = indigo;
      for (const [x, y] of [
        [60, 60],
        [S - 60, 60],
        [60, S - 60],
        [S - 60, S - 60],
      ]) {
        g.beginPath();
        g.arc(x, y, 70, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'cloud': {
      g.strokeStyle = gold;
      g.lineWidth = 6;
      g.strokeRect(16, 16, S - 32, S - 32);
      g.lineWidth = 2;
      g.strokeRect(30, 30, S - 60, S - 60);
      g.lineWidth = 4;
      for (let i = 0; i < 9; i++) {
        const x = 90 + (i % 3) * 166,
          y = 90 + Math.floor(i / 3) * 166;
        g.beginPath();
        g.arc(x, y, 20, Math.PI * 0.5, Math.PI * 2.1);
        g.arc(x + 9, y - 2, 10, 0, Math.PI * 1.6);
        g.moveTo(x - 34, y + 22);
        g.quadraticCurveTo(x, y + 28, x + 38, y + 12);
        g.stroke();
      }
      break;
    }
    case 'deco': {
      const line = mix(field, '#f0e0c0', 0.55);
      g.strokeStyle = line;
      for (let k = 0; k < 6; k++) {
        g.lineWidth = k % 2 ? 1.5 : 4;
        const m = 20 + k * 26;
        g.beginPath();
        g.moveTo(m + 30, m);
        g.lineTo(S - m - 30, m);
        g.lineTo(S - m, m + 30);
        g.lineTo(S - m, S - m - 30);
        g.lineTo(S - m - 30, S - m);
        g.lineTo(m + 30, S - m);
        g.lineTo(m, S - m - 30);
        g.lineTo(m, m + 30);
        g.closePath();
        g.stroke();
      }
      g.lineWidth = 2;
      for (let k = 0; k <= 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        g.beginPath();
        g.moveTo(cx, cx);
        g.lineTo(cx + Math.cos(a) * 80, cx + Math.sin(a) * 80);
        g.stroke();
      }
      break;
    }
    case 'waves': {
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 2;
      for (let y = 30; y < S; y += 26) {
        g.beginPath();
        for (let x = 0; x <= S; x += 8) g.lineTo(x, y + Math.sin(x * 0.03 + y) * 6);
        g.stroke();
      }
      g.strokeStyle = 'rgba(120,110,95,0.35)';
      g.strokeRect(14, 14, S - 28, S - 28);
      break;
    }
    case 'dragon': {
      // Imperial yellow: a red roundel with the dragon, cloud bands, a blue border.
      g.fillStyle = '#1c3a7a';
      g.fillRect(0, 0, S, 40);
      g.fillRect(0, S - 40, S, 40);
      g.fillRect(0, 0, 40, S);
      g.fillRect(S - 40, 0, 40, S);
      g.strokeStyle = '#8a1c12';
      g.lineWidth = 3;
      g.strokeRect(48, 48, S - 96, S - 96);
      g.fillStyle = '#8a1c12';
      g.beginPath();
      g.arc(cx, cx, 120, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#f0d070';
      g.lineWidth = 5;
      g.stroke();
      g.fillStyle = '#f0d070';
      g.font = '400 150px "Ma Shan Zheng", "Noto Serif SC", serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('龍', cx, cx + 6);
      g.strokeStyle = '#8a1c12';
      g.lineWidth = 3;
      for (const [x, y] of [
        [110, 110],
        [S - 110, 110],
        [110, S - 110],
        [S - 110, S - 110],
      ]) {
        g.beginPath();
        g.arc(x, y, 18, Math.PI * 0.5, Math.PI * 2.1);
        g.arc(x + 8, y - 2, 9, 0, Math.PI * 1.6);
        g.stroke();
      }
      break;
    }
  }
  const t = srgb(c);
  t.anisotropy = 4;
  return t;
}

/** Soft dark pool under the table where the lamp cannot reach. */
function contactTexture() {
  const [c, g] = canvas(128);
  const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,0.85)');
  gr.addColorStop(0.55, 'rgba(0,0,0,0.6)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// ------------------------------------------------------------ lamp

function silkTexture(color: string) {
  const [c, g] = canvas(256);
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, '#fffaf0');
  gr.addColorStop(0.45, mix('#fff2dc', color, 0.3));
  gr.addColorStop(0.9, mix(color, '#b36a2a', 0.35));
  gr.addColorStop(1, mix(color, '#5a3010', 0.6));
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  // Radial pleats.
  g.strokeStyle = 'rgba(120,70,20,0.12)';
  g.lineWidth = 2;
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    g.beginPath();
    g.moveTo(128 + Math.cos(a) * 30, 128 + Math.sin(a) * 30);
    g.lineTo(128 + Math.cos(a) * 128, 128 + Math.sin(a) * 128);
    g.stroke();
  }
  return srgb(c);
}

const BEAM_VERT = `
varying vec3 vN;
varying vec3 vV;
varying float vH;
uniform float uH;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  vH = clamp((position.y + uH * 0.5) / uH, 0.0, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const BEAM_FRAG = `
uniform vec3 uColor;
uniform float uOpacity;
varying vec3 vN;
varying vec3 vV;
varying float vH;
void main() {
  // Bright near the lamp, fading toward the felt; soft at the silhouette.
  float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
  float a = uOpacity * edge * smoothstep(0.0, 0.75, vH) * (0.35 + 0.65 * vH);
  gl_FragColor = vec4(uColor * a, a);
}`;

// ------------------------------------------------------------ the room

/** The floor's painted canvas and how many times it tiles across the 60-unit floor (for shop previews). */
export function floorCanvas(kind: EnvironmentStyle['floor']) {
  const t = floorTexture(kind);
  return { canvas: t.image as HTMLCanvasElement, repeat: t.repeat.x };
}

const rugCache = new Map<string, HTMLCanvasElement>();
/** The rug's painted canvas (for shop previews), or null for a bare floor. */
export function rugCanvas(e: EnvironmentStyle) {
  if (e.rugStyle === 'none') return null;
  let c = rugCache.get(e.id);
  if (!c) {
    c = rugTexture(e).image as HTMLCanvasElement;
    rugCache.set(e.id, c);
  }
  return c;
}

// ------------------------------------------------------------ pendant lamps

/** A canvas texture for a glowing shade: a warm gradient plus ribs, lattice or piercing. */
function shadeTexture(kind: 'washi' | 'redsilk' | 'pierced' | 'palace', color: string) {
  const [c, g] = canvas(256);
  if (kind === 'pierced') {
    g.fillStyle = '#5a3a14';
    g.fillRect(0, 0, 256, 256);
    // Pierced brass: rows of stars and teardrops glowing through.
    for (let y = 16; y < 256; y += 32)
      for (let x = (y / 32) % 2 ? 16 : 0; x < 256; x += 32) {
        const gr = g.createRadialGradient(x, y, 0, x, y, 12);
        gr.addColorStop(0, '#fff2c8');
        gr.addColorStop(0.5, color);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.beginPath();
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2;
          const r = k % 2 ? 4 : 9;
          g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        g.fill();
      }
    return srgb(c);
  }
  const gr = g.createLinearGradient(0, 0, 0, 256);
  if (kind === 'redsilk') {
    gr.addColorStop(0, '#5a0c06');
    gr.addColorStop(0.5, '#ff5a2a');
    gr.addColorStop(1, '#5a0c06');
  } else {
    gr.addColorStop(0, mix(color, '#000000', 0.25));
    gr.addColorStop(0.5, mix(color, '#ffffff', 0.5));
    gr.addColorStop(1, mix(color, '#000000', 0.3));
  }
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  if (kind === 'palace') {
    // Red lacquer frame round painted silk panels.
    g.fillStyle = '#6a1008';
    g.fillRect(0, 0, 256, 22);
    g.fillRect(0, 234, 256, 22);
    for (let x = 0; x < 256; x += 43) g.fillRect(x, 0, 8, 256);
    g.fillStyle = 'rgba(160,40,30,0.55)';
    for (let x = 22; x < 256; x += 43) {
      g.beginPath();
      g.arc(x + 4, 128, 9, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    // Ribs.
    g.fillStyle = kind === 'redsilk' ? 'rgba(60,0,0,0.35)' : 'rgba(80,60,30,0.18)';
    for (let k = 0; k < 256; k += kind === 'redsilk' ? 24 : 18) g.fillRect(k, 0, 2, 256);
    if (kind === 'washi') for (let k = 0; k < 256; k += 20) g.fillRect(0, k, 256, 1.5);
  }
  return srgb(c);
}

const em = (color: string, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) });

/** Builds the pendant for a room. Its bottom sits near y = -0.3 in lamp space. */
function buildLamp(kind: EnvironmentStyle['lamp'], warm: string, lacquer: THREE.Material, brass: THREE.Material, diffuser: THREE.MeshBasicMaterial): THREE.Object3D[] {
  const parts: THREE.Object3D[] = [];
  const rod = (len: number, y: number, mat = brass) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 8), mat);
    m.position.y = y + len / 2;
    parts.push(m);
  };
  switch (kind) {
    case 'drum': {
      // Black lacquer drum, gold-leaf lining, silk diffuser and a tassel.
      const R = 1.55,
        Hs = 0.62;
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.86, R, Hs, 64, 1, true), lacquer);
      const leaf = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.86 - 0.01, R - 0.01, Hs, 64, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#e0a860').multiplyScalar(1.4), side: THREE.BackSide }));
      diffuser.map = silkTexture(warm);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(R - 0.02, 64), diffuser);
      disc.rotation.x = Math.PI / 2;
      disc.position.y = -Hs * 0.32;
      const top = new THREE.Mesh(new THREE.CircleGeometry(R * 0.86, 48), lacquer);
      top.rotation.x = -Math.PI / 2;
      top.position.y = Hs / 2;
      for (const [rad, y] of [
        [R, -Hs / 2],
        [R * 0.86, Hs / 2],
      ]) {
        const m = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.025, 8, 96), brass);
        m.rotation.x = Math.PI / 2;
        m.position.y = y;
        parts.push(m);
      }
      const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.32, 12), new THREE.MeshStandardMaterial({ color: '#8a1f16', roughness: 0.7 }));
      tassel.position.y = -Hs / 2 - 0.2;
      parts.push(shell, leaf, disc, top, tassel);
      rod(9, Hs / 2);
      break;
    }
    case 'paper': {
      // A round washi lantern, glowing all over.
      const ball = new THREE.Mesh(new THREE.SphereGeometry(1.05, 40, 24), new THREE.MeshBasicMaterial({ map: shadeTexture('washi', warm) }));
      ball.scale.set(1, 0.92, 1);
      ball.position.y = 0.55;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 24), new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.5 }));
      cap.position.y = 1.5;
      parts.push(ball, cap);
      rod(9, 1.55, new THREE.MeshStandardMaterial({ color: '#111111' }));
      break;
    }
    case 'lantern': {
      // A great red silk lantern with gilded caps and a long tassel.
      const ball = new THREE.Mesh(new THREE.SphereGeometry(1.15, 40, 24), new THREE.MeshBasicMaterial({ map: shadeTexture('redsilk', warm) }));
      ball.scale.set(1, 0.82, 1);
      ball.position.y = 0.7;
      parts.push(ball);
      for (const y of [-0.2, 1.62]) {
        const capM = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.16, 32), brass);
        capM.position.y = y;
        parts.push(capM);
      }
      const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9, 12), new THREE.MeshStandardMaterial({ color: '#c0301e', roughness: 0.8 }));
      tassel.position.y = -0.7;
      parts.push(tassel);
      rod(9, 1.7);
      break;
    }
    case 'brass': {
      // A pierced brass lantern: stars of light spill from its panels.
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 1.4, 8, 1, true), new THREE.MeshBasicMaterial({ map: shadeTexture('pierced', warm), side: THREE.DoubleSide }));
      body.position.y = 0.6;
      const dome = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.7, 8), brass);
      dome.position.y = 1.65;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.5, 0.25, 8), brass);
      base.position.y = -0.22;
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), brass);
      finial.position.y = -0.42;
      parts.push(body, dome, base, finial);
      rod(9, 2);
      break;
    }
    case 'industrial': {
      // Three black enamel domes on a steel bar, a bare bulb under each.
      const black = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.35, metalness: 0.6, side: THREE.DoubleSide });
      const bar = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.06, 0.06), black);
      bar.position.y = 1.2;
      parts.push(bar);
      for (const x of [-1.5, 0, 1.5]) {
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), black);
        dome.position.set(x, 0.2, 0);
        const inner = new THREE.Mesh(new THREE.SphereGeometry(0.54, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), em('#fff1d8', 0.9));
        inner.material.side = THREE.BackSide;
        inner.position.copy(dome.position);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), em('#ffd8a0', 2));
        bulb.position.set(x, 0.05, 0);
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), black);
        cord.position.set(x, 0.95, 0);
        parts.push(dome, inner, bulb, cord);
      }
      rod(9, 1.2, black);
      break;
    }
    case 'deco': {
      // Tiers of frosted glass in brass rings.
      const glass = em(mix(warm, '#ffffff', 0.4), 1.1);
      let y = 0;
      for (const [rad, h] of [
        [1.35, 0.22],
        [1.05, 0.26],
        [0.75, 0.3],
        [0.45, 0.3],
      ]) {
        const tier = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h, 48), glass);
        tier.position.y = y + h / 2;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.03, 8, 64), brass);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y;
        parts.push(tier, ring);
        y += h;
      }
      const drop = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 6), brass);
      drop.rotation.x = Math.PI;
      drop.position.y = -0.25;
      parts.push(drop);
      rod(9, y);
      break;
    }
    case 'halo': {
      // A floating ring of light on three fine cables.
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.07, 12, 96), em('#ffffff', 1.6));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.2;
      const inner = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.035, 8, 96), em('#f4f0e8', 1.2));
      inner.rotation.x = Math.PI / 2;
      inner.position.y = 0.32;
      parts.push(ring, inner);
      const steel = new THREE.MeshStandardMaterial({ color: '#cccccc', metalness: 1, roughness: 0.3 });
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 9, 4), steel);
        cable.position.set(Math.cos(a) * 1.7, 4.7, Math.sin(a) * 1.7);
        parts.push(cable);
      }
      break;
    }
    case 'palace': {
      // A hexagonal palace lantern: lacquer frame, painted silk, gilded crown and tassels.
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.3, 6, 1, true), new THREE.MeshBasicMaterial({ map: shadeTexture('palace', warm), side: THREE.DoubleSide }));
      body.position.y = 0.55;
      const red = new THREE.MeshStandardMaterial({ color: '#7a1408', roughness: 0.35 });
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.15, 0.35, 6), red);
      crown.position.y = 1.38;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.7, 0.25, 6), red);
      base.position.y = -0.2;
      parts.push(body, crown, base);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.25, 8), brass);
        fin.position.set(Math.cos(a) * 1.15, 1.4, Math.sin(a) * 1.15);
        const tas = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.6, 8), new THREE.MeshStandardMaterial({ color: '#c0301e' }));
        tas.position.set(Math.cos(a) * 1.1, -0.6, Math.sin(a) * 1.1);
        parts.push(fin, tas);
      }
      rod(9, 1.55);
      break;
    }
    case 'fan':
    case 'fluoro':
    case 'majlis':
      parts.push(...buildVenueLamp(kind, warm, lacquer, brass));
      break;
  }
  return parts;
}

// ------------------------------------------------------------ the room

export class Room {
  readonly group = new THREE.Group();
  private lamp = new THREE.Group();
  private lampParts: THREE.Object3D[] = [];
  private lampKind = '';
  private glowBase = 0.42;
  private beam?: THREE.Mesh<THREE.CylinderGeometry, THREE.ShaderMaterial>;
  private lampGlow: THREE.Sprite;
  private diffuser: THREE.MeshBasicMaterial;
  private dust: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private dustSeed: Float32Array;
  private chairSet = new ChairSet();
  private chairs: THREE.Group;
  private rug: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  /** Daylight fill: a sky-and-ground light that only day rooms turn up. */
  private daylight: THREE.HemisphereLight;
  /** Hanging lanterns round the room (lantern-lit rooms only). */
  private hanging = new THREE.Group();
  /** Set pieces of the signature venues (venueProps.ts). */
  private venue: VenueProps;
  /** Corner side tables: tea service, each seat's gold, the dice (sideTables.ts). */
  readonly sides: SideTables;
  readonly floorMat: THREE.MeshStandardMaterial;
  readonly lacquer: THREE.MeshPhysicalMaterial;
  readonly brass: THREE.MeshStandardMaterial;

  constructor(q: QualitySpec) {
    this.brass = new THREE.MeshStandardMaterial({ color: '#c9a46a', metalness: 1, roughness: 0.32 });
    this.lacquer = new THREE.MeshPhysicalMaterial({ color: '#16100c', roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.12 });

    this.floorMat = new THREE.MeshStandardMaterial({ map: floorTexture('parquet'), color: '#c4a488', roughness: 0.62, metalness: 0, envMapIntensity: 0.1 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR_Y;
    floor.receiveShadow = true;
    this.group.add(floor);

    this.rug = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, envMapIntensity: 0.2 }));
    this.rug.rotation.x = -Math.PI / 2;
    this.rug.position.y = FLOOR_Y + 0.01;
    this.rug.receiveShadow = true;
    this.group.add(this.rug);

    const contact = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ map: contactTexture(), transparent: true, depthWrite: false, opacity: 0.9 }));
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = FLOOR_Y + 0.02;
    contact.renderOrder = 1;
    this.group.add(contact);

    this.daylight = new THREE.HemisphereLight('#dfe8f0', '#b8ad9c', 0);
    this.group.add(this.daylight);

    // The pendant; its shape follows the room (see buildLamp).
    this.diffuser = new THREE.MeshBasicMaterial({ map: silkTexture('#ffd9a6'), color: '#ffffff' });
    this.lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softGlow(), color: '#ffcf8f', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.lampGlow.scale.set(6.5, 3.2, 1);
    this.lampGlow.position.y = -0.28;
    this.lamp.add(this.lampGlow);
    this.lamp.position.y = LAMP_Y;
    this.group.add(this.lamp);
    this.setLamp('drum', '#ffd9a6');

    if (q.props) {
      const h = LAMP_Y - 0.4;
      const geo = new THREE.CylinderGeometry(1.4, 5.4, h, 48, 1, true);
      this.beam = new THREE.Mesh(
        geo,
        new THREE.ShaderMaterial({
          vertexShader: BEAM_VERT,
          fragmentShader: BEAM_FRAG,
          uniforms: { uColor: { value: new THREE.Color('#ffd9a6') }, uOpacity: { value: 0.06 }, uH: { value: h } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      );
      this.beam.position.y = LAMP_Y - 0.31 - h / 2;
      this.beam.renderOrder = 5;
      this.group.add(this.beam);
      this.group.add(this.hanging);
    }

    // Dust motes drifting in the lamp's light.
    const n = q.dust;
    const pos = new Float32Array(n * 3);
    this.dustSeed = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      this.dustSeed[i * 2] = Math.random() * Math.PI * 2;
      this.dustSeed[i * 2 + 1] = Math.sqrt(Math.random());
      pos[i * 3 + 1] = 0.5 + Math.random() * (LAMP_Y - 1);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ map: softGlow(), color: '#ffe2b0', size: 0.05, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.dust.renderOrder = 6;
    this.group.add(this.dust);
    this.placeDust(0);

    // Four chairs, finer as the room climbs (chairs.ts). Only in the establishing shot.
    this.chairs = this.chairSet.group;
    this.group.add(this.chairs);
    this.venue = new VenueProps(q);
    this.group.add(this.venue.group);
    this.sides = new SideTables(q, softGlow());
    this.group.add(this.sides.group);
  }

  private setLamp(kind: EnvironmentStyle['lamp'], warm: string) {
    const key = `${kind}:${warm}`;
    if (key === this.lampKind) return;
    this.lampKind = key;
    for (const o of this.lampParts) {
      this.lamp.remove(o);
      o.traverse((m) => {
        const mesh = m as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material | undefined;
        if (mat && mat !== this.brass && mat !== this.lacquer && mat !== this.diffuser) {
          (mat as THREE.MeshBasicMaterial).map?.dispose();
          mat.dispose();
        }
      });
    }
    this.lampParts = buildLamp(kind, warm, this.lacquer, this.brass, this.diffuser);
    this.lamp.add(...this.lampParts);
  }

  /** Lanterns strung round the room for lantern-lit environments. */
  private setHanging(e: EnvironmentStyle) {
    for (const o of [...this.hanging.children]) {
      this.hanging.remove(o);
      (o as THREE.Mesh).geometry?.dispose();
    }
    if (e.lamp !== 'lantern' && e.lamp !== 'palace') return;
    const geo = new THREE.SphereGeometry(0.5, 20, 14);
    const mat = new THREE.MeshBasicMaterial({ map: shadeTexture(e.lamp === 'palace' ? 'palace' : 'redsilk', '#ffb060'), fog: false });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.2;
      const m = new THREE.Mesh(geo, mat);
      m.scale.set(1, 0.85, 1);
      m.position.set(Math.cos(a) * 10.5, 6.2 + (i % 2) * 0.9, Math.sin(a) * 10.5);
      this.hanging.add(m);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softGlow(), color: '#ff7a3a', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      glow.scale.set(2.6, 2.6, 1);
      glow.position.copy(m.position);
      this.hanging.add(glow);
    }
  }

  /** Dress the room for an environment: floor, rug, pendant, chairs and daylight. */
  setEnvironment(e: EnvironmentStyle, _rugField?: string) {
    const day = e.ambient > 0.5;
    const warm = e.lamp === 'halo' ? '#ffffff' : e.lamp === 'fluoro' ? '#f2f5ff' : e.lamp === 'lantern' ? '#ff9a5a' : e.lamp === 'paper' && e.ambient < 0.5 ? '#f4f0ff' : mix('#ffd9a6', e.key, 0.5);
    this.setLamp(e.lamp, warm);
    this.lampGlow.material.color.set(warm);
    this.glowBase = day ? 0.12 : 0.42;
    this.beam?.material.uniforms.uColor.value.set(warm);
    if (this.beam) this.beam.material.uniforms.uOpacity.value = day ? 0.02 : 0.06;
    this.dust.material.color.set(mix('#ffe2b0', e.bokeh[0], 0.25));
    this.dust.material.opacity = day ? 0.2 : 0.55;
    this.floorMat.map = floorTexture(e.floor);
    this.floorMat.color.set(e.floor === 'parquet' ? '#c4a488' : '#ffffff');
    this.floorMat.roughness = e.floor === 'whitemarble' || e.floor === 'checker' || e.floor === 'goldbrick' ? 0.25 : e.floor === 'tatami' ? 0.9 : 0.6;
    if (e.floor === 'carpet') this.floorMat.roughness = 0.95;
    else if (e.floor === 'mosaic') this.floorMat.roughness = 0.35;
    this.floorMat.envMapIntensity = this.floorMat.roughness < 0.3 ? 0.5 : 0.1;
    this.floorMat.needsUpdate = true;
    this.rug.visible = e.rugStyle !== 'none';
    this.rug.material.map?.dispose();
    this.rug.material.map = this.rug.visible ? rugTexture(e) : null;
    this.rug.material.needsUpdate = true;
    this.chairSet.set(e);
    this.sides.set(e);
    // Day rooms are lit by the sky; night rooms by their lamps alone.
    this.daylight.intensity = e.ambient * 1.25;
    this.daylight.color.set(mix('#dfe8f0', e.sky, 0.3));
    this.setHanging(e);
    this.venue.set(e);
  }

  private placeDust(now: number) {
    const p = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    const top = LAMP_Y - 0.5;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const t = THREE.MathUtils.clamp(y / top, 0, 1);
      // Inside the beam: the cone narrows toward the lamp.
      const rad = (1.3 + (1 - t) * 3.4) * this.dustSeed[i * 2 + 1];
      const a = this.dustSeed[i * 2] + now * 0.03 + Math.sin(now * 0.4 + i) * 0.05;
      p.setXYZ(i, Math.cos(a) * rad, y, Math.sin(a) * rad);
    }
    p.needsUpdate = true;
  }

  /**
   * Per frame: drift the dust; show the lamp only when the camera is below it
   * (a phone looks down through where it hangs); chairs only in the establishing shot.
   */
  update(now: number, dt: number, camera: THREE.Camera, establishing: boolean, minimal: boolean) {
    const below = camera.position.y < LAMP_Y - 0.4;
    this.lamp.visible = below;
    if (this.beam) this.beam.visible = below;
    this.chairs.visible = establishing;
    if (!minimal) {
      const p = this.dust.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) + dt * (0.03 + (i % 5) * 0.006);
        if (y > LAMP_Y - 0.5) y = 0.4;
        p.setY(i, y);
      }
      this.placeDust(now);
    }
    this.lampGlow.material.opacity = this.glowBase + Math.sin(now * 0.7) * 0.02;
    this.venue.update(now, dt, this.lamp, minimal);
    this.sides.update(now, dt, minimal);
  }
}

