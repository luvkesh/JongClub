// Atelier pictures of the win animations, table effects and tile sounds: the real table in
// miniature (tablePreview.ts) with the effect painted over it as it plays: lanterns rising, gold
// dust, sakura petals, candle glow, a low mist, fireflies, or the ripples of a tile's click.

import { tablePreview } from './tablePreview';

type G = CanvasRenderingContext2D;
const cache = new Map<string, string>();

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function glow(g: G, x: number, y: number, r: number, color: string, a = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = a;
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.globalAlpha = 1;
}

function lantern(g: G, x: number, y: number, s: number) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  glow(g, x, y, s * 2.6, 'rgba(255,120,60,0.55)');
  g.restore();
  const body = g.createRadialGradient(x - s * 0.25, y - s * 0.2, s * 0.1, x, y, s);
  body.addColorStop(0, '#fff1c4');
  body.addColorStop(0.35, '#ffb45f');
  body.addColorStop(0.8, '#e2402c');
  body.addColorStop(1, '#8a1a12');
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(x, y, s * 0.82, s, 0, 0, Math.PI * 2);
  g.fill();
  // Paper ribs and gilt caps.
  g.strokeStyle = 'rgba(140,30,18,0.45)';
  g.lineWidth = Math.max(0.8, s * 0.04);
  for (const k of [-0.5, 0, 0.5]) {
    g.beginPath();
    g.ellipse(x, y, Math.abs(k) * s * 0.82 || 0.5, s, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = '#d9b45c';
  g.fillRect(x - s * 0.36, y - s * 1.06, s * 0.72, s * 0.14);
  g.fillRect(x - s * 0.36, y + s * 0.92, s * 0.72, s * 0.14);
}

function star(g: G, x: number, y: number, s: number, color: string) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y - s);
  g.quadraticCurveTo(x, y, x + s, y);
  g.quadraticCurveTo(x, y, x, y + s);
  g.quadraticCurveTo(x, y, x - s, y);
  g.quadraticCurveTo(x, y, x, y - s);
  g.fill();
}

function petal(g: G, x: number, y: number, s: number, rot: number) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const p = g.createLinearGradient(0, -s, 0, s);
  p.addColorStop(0, '#fff3f6');
  p.addColorStop(0.6, '#ffb7c5');
  p.addColorStop(1, '#e98aa0');
  g.fillStyle = p;
  g.beginPath();
  g.moveTo(0, s);
  g.bezierCurveTo(s * 0.9, s * 0.4, s * 0.7, -s * 0.8, s * 0.12, -s);
  g.lineTo(0, -s * 0.72);
  g.lineTo(-s * 0.12, -s);
  g.bezierCurveTo(-s * 0.7, -s * 0.8, -s * 0.9, s * 0.4, 0, s);
  g.fill();
  g.restore();
}

/** Rings spreading from a tile set down on the felt: the click, drawn. */
function ripples(g: G, x: number, y: number, w: number, color: string) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 1; i <= 7; i++) {
    const r = w * 0.065 * i;
    g.strokeStyle = color;
    g.globalAlpha = 0.95 - i * 0.12;
    g.lineWidth = Math.max(1.5, w * (0.009 - i * 0.001));
    g.beginPath();
    g.ellipse(x, y, r, r * 0.38, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
  glow(g, x, y, w * 0.12, color, 0.8);
}

function paint(g: G, id: string, w: number, h: number) {
  const r = rng(id.length * 7919 + id.charCodeAt(4) * 31);
  const cx = w / 2,
    cy = h * 0.5;
  switch (id) {
    case 'win-classic':
      g.save();
      g.globalCompositeOperation = 'lighter';
      glow(g, cx, cy, w * 0.35, 'rgba(255,214,140,0.5)');
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        g.strokeStyle = 'rgba(255,226,170,0.16)';
        g.lineWidth = w * 0.012;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * w * 0.05, cy + Math.sin(a) * w * 0.03);
        g.lineTo(cx + Math.cos(a) * w * 0.5, cy + Math.sin(a) * w * 0.3);
        g.stroke();
      }
      g.restore();
      break;
    case 'win-lanterns':
      for (let i = 0; i < 9; i++) lantern(g, w * (0.12 + r() * 0.76), h * (0.08 + r() * 0.55), w * (0.018 + r() * 0.03));
      break;
    case 'win-gold-dust':
      g.save();
      g.globalCompositeOperation = 'lighter';
      glow(g, cx, cy, w * 0.4, 'rgba(255,200,110,0.3)');
      for (let i = 0; i < 260; i++) {
        const a = r() * Math.PI * 2,
          d = Math.pow(r(), 0.7) * w * 0.42;
        const x = cx + Math.cos(a) * d,
          y = cy + Math.sin(a) * d * 0.55 - r() * h * 0.15;
        const s = w * (0.002 + Math.pow(r(), 3) * 0.012);
        if (s > w * 0.007) glow(g, x, y, s * 3, 'rgba(255,220,140,0.6)');
        star(g, x, y, s, r() < 0.3 ? '#fff6dc' : '#ffd27a');
      }
      g.restore();
      break;
    case 'win-sakura':
      for (let i = 0; i < 46; i++) petal(g, r() * w, r() * h * 0.9, w * (0.006 + r() * 0.012), r() * 6.28);
      break;
    case 'fx-candle': {
      // Warm light falling in from candles at the table's edge.
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (const [x, y] of [
        [0.08, 0.78],
        [0.92, 0.72],
        [0.5, 0.95],
      ]) {
        glow(g, w * x, h * y, w * 0.32, 'rgba(255,150,60,0.42)');
        glow(g, w * x, h * y, w * 0.05, 'rgba(255,230,170,0.9)');
      }
      g.restore();
      const v = g.createRadialGradient(cx, cy, w * 0.2, cx, cy, w * 0.7);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(30,12,0,0.5)');
      g.fillStyle = v;
      g.fillRect(0, 0, w, h);
      break;
    }
    case 'fx-mist':
      for (let i = 0; i < 26; i++) {
        const x = r() * w,
          y = h * (0.45 + r() * 0.4);
        g.save();
        g.translate(x, y);
        g.scale(1, 0.22);
        glow(g, 0, 0, w * (0.12 + r() * 0.16), 'rgba(225,235,240,0.32)');
        g.restore();
      }
      break;
    case 'fx-fireflies':
      g.fillStyle = 'rgba(4,10,8,0.35)';
      g.fillRect(0, 0, w, h);
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 46; i++) {
        const x = r() * w,
          y = r() * h * 0.85;
        const s = w * (0.003 + r() * 0.004);
        glow(g, x, y, s * 6, 'rgba(200,255,120,0.55)');
        glow(g, x, y, s, 'rgba(250,255,210,1)');
      }
      g.restore();
      break;
    case 'sound-auto':
      ripples(g, cx, cy + h * 0.06, w, 'rgba(232,203,146,0.9)');
      break;
    case 'sound-bamboo':
      ripples(g, cx, cy + h * 0.06, w, 'rgba(214,170,96,0.9)');
      break;
    case 'sound-glass':
      ripples(g, cx, cy + h * 0.06, w, 'rgba(170,220,245,0.95)');
      break;
  }
}

/** The sounds each sit at a table of their own material: dark wood for bamboo, stone for glass. */
const TABLE_FOR: Record<string, string> = { 'sound-bamboo': 'manhattan', 'sound-glass': 'black-marble' };

/** A data URL picture of effect `id` over the table `table`. Cached. */
export async function effectPreview(id: string, table = TABLE_FOR[id] ?? 'classic-green', w = 960, h = 528): Promise<string> {
  const key = `${id}:${table}:${w}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const base = tablePreview(table, w / 2, h / 2);
  if (!base) return '';
  const img = new Image();
  img.src = base;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0, w, h);
  paint(g, id, w, h);
  const url = c.toDataURL('image/webp', 0.9);
  cache.set(key, url);
  return url;
}
