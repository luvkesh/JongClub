// Portrait frames drawn as jewellery (the 3D portraits in avatar3d.ts): a polished metal band
// with studio reflections and a bevel, milgrain beading on both edges, and each frame's own
// work set into it: carved jade, red lacquer with gold cloisons, a crown with a ruby, laurel in
// green enamel, a season's enamel band with its lozenge stone.

import { mix } from '../cosmetics/avatar';

type G = CanvasRenderingContext2D;

/** A conic sweep round the ring where the browser has it (Safari 16.1+); a diagonal otherwise. */
const sweep = (g: G, C: number, r: number): CanvasGradient =>
  typeof (g as Partial<G>).createConicGradient === 'function' ? g.createConicGradient(-2.2, C, C) : g.createLinearGradient(C - r, C - r, C + r, C + r);

/** Polished metal: a band of bright and dark reflections round the ring, as from a softbox above left. */
function metalStroke(g: G, C: number, r: number, w: number, base: string) {
  const stops: [number, number][] = [
    [0, 0.55],
    [0.08, 0.95],
    [0.16, 0.4],
    [0.3, -0.35],
    [0.42, 0.15],
    [0.5, 0.7],
    [0.58, 0.1],
    [0.72, -0.45],
    [0.86, 0.25],
    [1, 0.55],
  ];
  const tone = (t: number) => (t >= 0 ? mix(base, '#fffaf0', t * 0.75) : mix(base, '#120c06', -t));
  const grad = sweep(g, C, r);
  for (const [at, t] of stops) grad.addColorStop(at, tone(t));
  g.strokeStyle = grad;
  g.lineWidth = w;
  g.beginPath();
  g.arc(C, C, r, 0, Math.PI * 2);
  g.stroke();
  // Bevel: a lit outer lip, a shadowed inner lip and fine dark hairlines at both edges.
  const ring = (rr: number, lw: number, style: string | CanvasGradient) => {
    g.strokeStyle = style;
    g.lineWidth = lw;
    g.beginPath();
    g.arc(C, C, rr, 0, Math.PI * 2);
    g.stroke();
  };
  const lip = g.createLinearGradient(C - r, C - r, C + r, C + r);
  lip.addColorStop(0, 'rgba(255,250,235,0.85)');
  lip.addColorStop(0.5, 'rgba(255,250,235,0.15)');
  lip.addColorStop(1, 'rgba(255,250,235,0.05)');
  ring(r + w * 0.36, w * 0.12, lip);
  const low = g.createLinearGradient(C - r, C - r, C + r, C + r);
  low.addColorStop(0, 'rgba(0,0,0,0.05)');
  low.addColorStop(1, 'rgba(0,0,0,0.45)');
  ring(r - w * 0.36, w * 0.12, low);
  ring(r + w * 0.5, Math.max(1, w * 0.04), 'rgba(10,6,2,0.7)');
  ring(r - w * 0.5, Math.max(1, w * 0.04), 'rgba(10,6,2,0.7)');
}

/** A row of tiny metal beads along a circle (milgrain). */
function milgrain(g: G, C: number, r: number, bead: number, base: string) {
  const n = Math.max(24, Math.round((Math.PI * 2 * r) / (bead * 2.6)));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = C + Math.cos(a) * r,
      y = C + Math.sin(a) * r;
    const b = g.createRadialGradient(x - bead * 0.35, y - bead * 0.35, 0, x, y, bead);
    b.addColorStop(0, mix(base, '#ffffff', 0.85));
    b.addColorStop(0.5, base);
    b.addColorStop(1, mix(base, '#000000', 0.55));
    g.fillStyle = b;
    g.beginPath();
    g.arc(x, y, bead, 0, Math.PI * 2);
    g.fill();
  }
}

/** A domed cabochon in a metal collet, with its glint. */
function stone(g: G, x: number, y: number, r: number, color: string, metal: string) {
  const m = g.createLinearGradient(x - r, y - r, x + r, y + r);
  m.addColorStop(0, mix(metal, '#ffffff', 0.7));
  m.addColorStop(0.5, metal);
  m.addColorStop(1, mix(metal, '#000000', 0.5));
  g.fillStyle = m;
  g.beginPath();
  g.arc(x, y, r * 1.28, 0, Math.PI * 2);
  g.fill();
  const s = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  s.addColorStop(0, mix(color, '#ffffff', 0.55));
  s.addColorStop(0.45, color);
  s.addColorStop(1, mix(color, '#000000', 0.6));
  g.fillStyle = s;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  g.ellipse(x - r * 0.38, y - r * 0.42, r * 0.26, r * 0.15, -0.7, 0, Math.PI * 2);
  g.fill();
}

/** An enamel or stone band inside the metal: glossy, with a highlight along its upper left. */
function band(g: G, C: number, r: number, w: number, color: string) {
  const grad = sweep(g, C, r);
  [
    [0, 0.25],
    [0.12, 0.45],
    [0.35, -0.3],
    [0.6, 0.15],
    [0.8, -0.4],
    [1, 0.25],
  ].forEach(([at, t]) => grad.addColorStop(at, t >= 0 ? mix(color, '#ffffff', t) : mix(color, '#000000', -t)));
  g.strokeStyle = grad;
  g.lineWidth = w;
  g.beginPath();
  g.arc(C, C, r, 0, Math.PI * 2);
  g.stroke();
}

/**
 * Draw frame `fid` round a portrait of radius R centred at C, on a canvas `px` wide.
 * `f` is the frame's [outer, inner highlight, deep] colours (FRAMES in cosmetics/avatar.ts).
 */
export function drawJewelFrame(g: G, fid: string, f: [string, string, string], C: number, R: number, px: number) {
  const w = px * 0.058;
  const mid = R + px * 0.034;
  const gold = '#d9b45c';
  const metal = fid === 'frame-jade' || fid === 'frame-lacquer' || fid.startsWith('frame-season-') ? gold : f[0];
  g.save();
  // A soft shadow under the ring, so it sits proud of the card.
  g.shadowColor = 'rgba(0,0,0,0.55)';
  g.shadowBlur = px * 0.03;
  g.shadowOffsetY = px * 0.012;
  g.strokeStyle = mix(metal, '#000000', 0.5);
  g.lineWidth = w;
  g.beginPath();
  g.arc(C, C, mid, 0, Math.PI * 2);
  g.stroke();
  g.restore();
  metalStroke(g, C, mid, w, metal);
  const bead = px * 0.0055;
  if (fid === 'frame-jade') {
    // A carved jade hoop in a gold setting, with notches cut round it.
    band(g, C, mid, w * 0.62, f[0]);
    g.strokeStyle = mix(f[2], '#000000', 0.2);
    g.lineWidth = Math.max(1, px * 0.003);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      g.globalAlpha = 0.45;
      g.beginPath();
      g.moveTo(C + Math.cos(a) * (mid - w * 0.28), C + Math.sin(a) * (mid - w * 0.28));
      g.lineTo(C + Math.cos(a) * (mid + w * 0.28), C + Math.sin(a) * (mid + w * 0.28));
      g.stroke();
    }
    g.globalAlpha = 1;
  } else if (fid === 'frame-lacquer') {
    // Red lacquer between gold cloisons, with four gold studs.
    band(g, C, mid, w * 0.6, f[0]);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      stone(g, C + Math.cos(a) * mid, C + Math.sin(a) * mid, w * 0.24, gold, gold);
    }
  } else if (fid.startsWith('frame-season-')) {
    // The season's enamel band, with its lozenge stone at the top.
    band(g, C, mid, w * 0.56, f[0]);
    const y = C - mid;
    const d = w * 0.62;
    g.fillStyle = gold;
    g.beginPath();
    g.moveTo(C, y - d * 1.25);
    g.lineTo(C + d, y);
    g.lineTo(C, y + d * 1.25);
    g.lineTo(C - d, y);
    g.closePath();
    g.fill();
    stone(g, C, y, w * 0.34, f[1], gold);
  }
  milgrain(g, C, mid - w * 0.5 - bead * 1.2, bead, metal);
  milgrain(g, C, mid + w * 0.5 + bead * 1.2, bead, metal);
  if (fid === 'frame-brass') {
    // Four seed pearls at the quarters.
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 - Math.PI / 2;
      stone(g, C + Math.cos(a) * mid, C + Math.sin(a) * mid, w * 0.3, '#f4efe6', metal);
    }
  } else if (fid === 'frame-master') {
    // A crown at the top, its points tipped with pearls round a ruby.
    const y = C - mid + w * 0.15;
    const cw = w * 1.8,
      ch = w * 1.15;
    const cg = g.createLinearGradient(C - cw, y - ch, C + cw, y);
    cg.addColorStop(0, mix(metal, '#ffffff', 0.7));
    cg.addColorStop(0.5, metal);
    cg.addColorStop(1, mix(metal, '#000000', 0.45));
    g.fillStyle = cg;
    g.strokeStyle = mix(metal, '#000000', 0.6);
    g.lineWidth = Math.max(1, px * 0.003);
    g.beginPath();
    g.moveTo(C - cw, y + ch * 0.2);
    g.lineTo(C - cw * 1.05, y - ch);
    g.lineTo(C - cw * 0.5, y - ch * 0.45);
    g.lineTo(C, y - ch * 1.25);
    g.lineTo(C + cw * 0.5, y - ch * 0.45);
    g.lineTo(C + cw * 1.05, y - ch);
    g.lineTo(C + cw, y + ch * 0.2);
    g.closePath();
    g.fill();
    g.stroke();
    for (const [x, yy] of [
      [C - cw * 1.05, y - ch],
      [C, y - ch * 1.25],
      [C + cw * 1.05, y - ch],
    ])
      stone(g, x, yy, w * 0.2, '#f4efe6', metal);
    stone(g, C, y - ch * 0.25, w * 0.34, '#b3122a', metal);
  } else if (fid === 'frame-champion') {
    // Laurel sprays in green enamel, veined in gold, rising from a ruby at the foot.
    for (const side of [-1, 1]) {
      const a0 = Math.PI / 2 + side * 0.22,
        a1 = Math.PI / 2 + side * 1.85;
      for (let i = 0; i < 9; i++) {
        const a = a0 + (a1 - a0) * (i / 8);
        for (const off of [-1, 1]) {
          const rr = mid + off * w * 0.5;
          const x = C + Math.cos(a) * rr,
            y = C + Math.sin(a) * rr;
          const rot = a + Math.PI / 2 + off * side * 0.55;
          const L = w * (0.5 - i * 0.02),
            Wd = w * 0.2;
          g.save();
          g.translate(x, y);
          g.rotate(rot);
          const lg = g.createLinearGradient(0, -Wd, 0, Wd);
          lg.addColorStop(0, '#7fc49a');
          lg.addColorStop(0.5, '#2f7a5c');
          lg.addColorStop(1, '#143826');
          g.fillStyle = lg;
          g.beginPath();
          g.ellipse(0, 0, L, Wd, 0, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = gold;
          g.lineWidth = Math.max(0.8, px * 0.0022);
          g.stroke();
          g.beginPath();
          g.moveTo(-L * 0.85, 0);
          g.lineTo(L * 0.85, 0);
          g.stroke();
          g.restore();
        }
      }
    }
    stone(g, C, C + mid, w * 0.36, '#b3122a', gold);
  }
}
