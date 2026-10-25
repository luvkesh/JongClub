// Carved and inlaid ornament for the tile racks: a running frieze for your
// rack's rail and framed panels for the fronts of the opponents' racks. Each
// is painted as a decal (transparent except in the cuts) with the light baked
// in, so it reads on phones, plus a normal map so the cuts catch the real
// lights on better devices. Used by rackLook.ts.

import * as THREE from 'three';

export type CarveMotif = 'fret' | 'cloud' | 'coin' | 'wave' | 'vine';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** One cloud scroll (xiangyun) about (x, y), mirrored when `flip`. */
function cloud(g: CanvasRenderingContext2D, x: number, y: number, s: number, flip = false) {
  g.save();
  g.translate(x, y);
  g.scale(flip ? -s : s, s);
  g.beginPath();
  g.arc(-20, 0, 22, Math.PI * 0.2, Math.PI * 1.9);
  g.arc(-20, 0, 10, Math.PI * 1.9, Math.PI * 0.6, true);
  g.moveTo(2, 4);
  g.bezierCurveTo(16, 34, 40, 30, 46, 6);
  g.arc(30, 4, 12, 0, Math.PI * 1.3, true);
  g.stroke();
  g.restore();
}

/** A square key-fret spiral of side `s` with its open end at the bottom left. */
function fretSpiral(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const k = s / 6;
  g.beginPath();
  g.moveTo(x, y + s);
  g.lineTo(x, y);
  g.lineTo(x + s, y);
  g.lineTo(x + s, y + s - k);
  g.lineTo(x + 2 * k, y + s - k);
  g.lineTo(x + 2 * k, y + 2 * k);
  g.lineTo(x + s - 2 * k, y + 2 * k);
  g.lineTo(x + s - 2 * k, y + s - 3 * k);
  g.stroke();
}

function leaf(g: CanvasRenderingContext2D, x: number, y: number, a: number, l: number) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(l * 0.5, -l * 0.35, l, 0);
  g.quadraticCurveTo(l * 0.5, l * 0.35, 0, 0);
  g.stroke();
  g.restore();
}

/** The running frieze on a 512 x 128 tile that repeats seamlessly along the rack. */
function drawFrieze(g: CanvasRenderingContext2D, motif: CarveMotif) {
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(-10, 12);
  g.lineTo(522, 12);
  g.moveTo(-10, 116);
  g.lineTo(522, 116);
  g.stroke();
  g.lineWidth = 7;
  if (motif === 'fret') {
    for (let x = 0; x < 512; x += 128) {
      fretSpiral(g, x + 22, 30, 68);
      g.beginPath();
      g.moveTo(x + 22, 98);
      g.lineTo(x + 150, 98);
      g.stroke();
    }
  } else if (motif === 'cloud') {
    for (let x = 0; x < 512; x += 128) cloud(g, x + 52, 60, 1, (x / 128) % 2 === 1);
  } else if (motif === 'coin') {
    for (let x = -64; x <= 576; x += 64) {
      g.beginPath();
      g.arc(x, 64, 40, 0, Math.PI * 2);
      g.stroke();
    }
  } else if (motif === 'wave') {
    for (let x = -32; x <= 544; x += 64)
      for (const r of [42, 28, 14]) {
        g.beginPath();
        g.arc(x, 104, r, Math.PI, 0);
        g.stroke();
      }
  } else {
    // Two scrolling vines twined about each other, leafing and flowering.
    const vy = (x: number, ph: number) => 64 + Math.sin((x / 256) * Math.PI * 4 + ph) * 30;
    for (const ph of [0, Math.PI]) {
      g.beginPath();
      for (let x = -8; x <= 520; x += 4) {
        if (x === -8) g.moveTo(x, vy(x, ph));
        else g.lineTo(x, vy(x, ph));
      }
      g.stroke();
    }
    g.lineWidth = 4;
    for (let i = 0; i < 16; i++) {
      const x = i * 32 + 16,
        ph = i % 2 ? Math.PI : 0;
      const y = vy(x, ph),
        up = Math.cos((x / 256) * Math.PI * 4 + ph) > 0;
      leaf(g, x, y, up ? -0.7 : 0.7, 22);
    }
    for (let i = 0; i < 8; i++) {
      const x = i * 64 + 32;
      g.beginPath();
      g.arc(x, 64, 7, 0, Math.PI * 2);
      g.stroke();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        g.beginPath();
        g.arc(x + Math.cos(a) * 12, 64 + Math.sin(a) * 12, 4, 0, Math.PI * 2);
        g.stroke();
      }
    }
  }
}

/** One framed panel on a 512 x 256 tile: a frame with cut corners, flanking ornament and a centre medallion (or a frame for a stone). */
function drawPanel(g: CanvasRenderingContext2D, motif: CarveMotif, stone: boolean) {
  g.lineWidth = 6;
  g.strokeRect(14, 14, 484, 228);
  // Inner frame with concave corners.
  const a = 34,
    b = 478,
    c = 34,
    d = 222,
    k = 18;
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(a + k, c);
  g.lineTo(b - k, c);
  g.arc(b, c, k, Math.PI, Math.PI / 2, true);
  g.lineTo(b, d - k);
  g.arc(b, d, k, -Math.PI / 2, Math.PI, true);
  g.lineTo(a + k, d);
  g.arc(a, d, k, 0, -Math.PI / 2, true);
  g.lineTo(a, c + k);
  g.arc(a, c, k, Math.PI / 2, 0, true);
  g.stroke();
  g.lineWidth = 6;
  if (stone) {
    // A frame around the inlaid stone, with a scroll at either end.
    const w = 272,
      h = 104;
    g.beginPath();
    g.roundRect(256 - w / 2, 128 - h / 2, w, h, 20);
    g.stroke();
    cloud(g, 256 - w / 2 - 34, 124, 0.62, true);
    cloud(g, 256 + w / 2 + 34, 124, 0.62);
    return;
  }
  // Centre medallion with an endless knot.
  g.beginPath();
  g.arc(256, 128, 64, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 5;
  g.save();
  g.translate(256, 128);
  g.rotate(Math.PI / 4);
  const s = 30;
  g.strokeRect(-s, -s, 2 * s, 2 * s);
  g.beginPath();
  for (const t of [-s / 3, s / 3]) {
    g.moveTo(t, -s);
    g.lineTo(t, s);
    g.moveTo(-s, t);
    g.lineTo(s, t);
  }
  g.stroke();
  for (const [x, y] of [
    [-s, -s],
    [s, -s],
    [s, s],
    [-s, s],
  ]) {
    g.beginPath();
    g.arc(x * 1.1, y * 1.1, 8, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
  g.lineWidth = 6;
  // Flanking ornament, mirrored either side.
  for (const side of [-1, 1]) {
    const cx = 256 + side * 128;
    if (motif === 'fret') {
      fretSpiral(g, cx - 34, 94, 68);
    } else if (motif === 'cloud') {
      cloud(g, cx, 112, 0.95, side < 0);
      cloud(g, cx + side * 24, 160, 0.6, side > 0);
    } else if (motif === 'coin') {
      for (const [ox, oy] of [
        [-26, -26],
        [26, -26],
        [-26, 26],
        [26, 26],
      ]) {
        g.beginPath();
        g.arc(cx + ox * 0.75, 128 + oy * 0.75, 28, 0, Math.PI * 2);
        g.stroke();
      }
    } else if (motif === 'wave') {
      for (const ox of [-30, 30])
        for (const r of [34, 22, 10]) {
          g.beginPath();
          g.arc(cx + ox, 170, r, Math.PI, 0);
          g.stroke();
        }
      for (const r of [34, 22, 10]) {
        g.beginPath();
        g.arc(cx, 130, r, Math.PI, 0);
        g.stroke();
      }
    } else {
      g.beginPath();
      g.moveTo(cx - side * 70, 128);
      g.bezierCurveTo(cx - side * 30, 60, cx + side * 20, 196, cx + side * 66, 120);
      g.stroke();
      g.lineWidth = 4;
      leaf(g, cx - side * 36, 100, side > 0 ? -1.2 : -1.9, 34);
      leaf(g, cx + side * 26, 150, side > 0 ? 1.0 : 2.1, 32);
      g.beginPath();
      g.arc(cx + side * 66, 108, 12, 0, Math.PI * 1.7);
      g.stroke();
      g.lineWidth = 6;
    }
  }
  // Corner scrolls inside the inner frame.
  g.lineWidth = 4;
  for (const [x, y, sx, sy] of [
    [a + 14, c + 14, 1, 1],
    [b - 14, c + 14, -1, 1],
    [b - 14, d - 14, -1, -1],
    [a + 14, d - 14, 1, -1],
  ]) {
    g.beginPath();
    g.moveTo(x, y + sy * 30);
    g.quadraticCurveTo(x, y, x + sx * 30, y);
    g.stroke();
  }
}

export interface CarveLook {
  /** Inlay metal laid into the cuts (gold, silver), or none for a plain cut. */
  inlay?: string;
  /** The colour of the cut's floor and walls (a deeper shade of the body). */
  tone: string;
  /** The cut is into metal (gilt): cuts stay metallic. */
  metal: boolean;
}

/**
 * Paint `kind` at `scale` (1 = 1024 px wide) into a colour+alpha decal and a
 * normal map. The light is baked from above and slightly left.
 */
function paint(kind: 'frieze' | 'panel', motif: CarveMotif, stone: boolean, look: CarveLook, scale: number) {
  const W = Math.round(1024 * scale),
    H = Math.round((kind === 'frieze' ? 256 : 512) * scale);
  const [, mg] = canvas(W, H);
  mg.fillStyle = '#000';
  mg.fillRect(0, 0, W, H);
  mg.strokeStyle = '#fff';
  mg.lineCap = mg.lineJoin = 'round';
  mg.scale(W / 512, H / (kind === 'frieze' ? 128 : 256));
  if (kind === 'frieze') drawFrieze(mg, motif);
  else drawPanel(mg, motif, stone);
  const src = mg.getImageData(0, 0, W, H).data;
  // Soften the cut into a V-shaped groove: blur the mask twice.
  let h = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) h[i] = src[i * 4] / 255;
  const blur = (a: Float32Array) => {
    const o = new Float32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = (x + dx + W) % W,
              yy = Math.min(H - 1, Math.max(0, y + dy));
            s += a[yy * W + xx];
          }
        o[y * W + x] = s / 9;
      }
    return o;
  };
  h = blur(blur(h));
  const [c, cg] = canvas(W, H);
  const [n, ng] = canvas(W, H);
  const col = cg.createImageData(W, H);
  const nor = ng.createImageData(W, H);
  const tone = new THREE.Color(look.tone);
  const fill = look.inlay ? new THREE.Color(look.inlay) : null;
  const L = new THREE.Vector3(-0.35, 0.65, 0.68).normalize();
  const k = 2.4 * scale;
  const v = new THREE.Vector3();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const hx = h[y * W + ((x + 1) % W)] - h[y * W + ((x - 1 + W) % W)];
      const hy = h[Math.min(H - 1, y + 1) * W + x] - h[Math.max(0, y - 1) * W + x];
      // Cuts are depressions: the wall facing the light is lit, the far wall in shadow.
      v.set(hx * k, -hy * k, 1).normalize();
      const lit = v.dot(L);
      const a = Math.min(1, h[i] * 2.2);
      const o = i * 4;
      if (fill) {
        // Inlay sits nearly flush: bright metal with a faint dark seam at its edge.
        const edge = Math.min(1, Math.abs(hx) + Math.abs(hy)) * 0.6;
        const t = (0.85 + 0.35 * (lit - 0.68)) * (1 - edge);
        col.data[o] = Math.min(255, fill.r * 255 * t + tone.r * 255 * edge);
        col.data[o + 1] = Math.min(255, fill.g * 255 * t + tone.g * 255 * edge);
        col.data[o + 2] = Math.min(255, fill.b * 255 * t + tone.b * 255 * edge);
      } else {
        // A cut: dark floor, the lit wall a touch lighter than the surface around it.
        const t = Math.max(0.12, 0.3 + 1.4 * (lit - 0.68)) * (1.2 - h[i] * 0.6);
        col.data[o] = Math.min(255, tone.r * 255 * t);
        col.data[o + 1] = Math.min(255, tone.g * 255 * t);
        col.data[o + 2] = Math.min(255, tone.b * 255 * t);
      }
      col.data[o + 3] = Math.round(a * 255);
      nor.data[o] = Math.round((v.x * 0.5 + 0.5) * 255);
      nor.data[o + 1] = Math.round((v.y * 0.5 + 0.5) * 255);
      nor.data[o + 2] = Math.round((v.z * 0.5 + 0.5) * 255);
      nor.data[o + 3] = 255;
    }
  cg.putImageData(col, 0, 0);
  ng.putImageData(nor, 0, 0);
  return { map: c, normal: n };
}

const lookCache = new Map<string, { map: HTMLCanvasElement; normal: HTMLCanvasElement }>();

/** The decal material for a frieze or a panel. Its textures repeat along u. */
export function carveMaterial(kind: 'frieze' | 'panel', motif: CarveMotif, stone: boolean, look: CarveLook, tier: 'low' | 'medium' | 'high', aniso: number) {
  const scale = tier === 'low' ? 0.5 : 1;
  const key = [kind, motif, stone, look.inlay, look.tone, scale].join(':');
  let p = lookCache.get(key);
  if (!p) {
    p = paint(kind, motif, stone, look, scale);
    lookCache.set(key, p);
  }
  const map = new THREE.CanvasTexture(p.map);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.anisotropy = aniso;
  const metal = !!look.inlay || look.metal;
  const m = new THREE.MeshStandardMaterial({
    map,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    metalness: metal ? 0.95 : 0.05,
    roughness: metal ? 0.28 : 0.55,
    envMapIntensity: metal ? 1.2 : 0.6,
  });
  if (tier !== 'low') {
    const nm = new THREE.CanvasTexture(p.normal);
    nm.wrapS = THREE.RepeatWrapping;
    nm.anisotropy = aniso;
    m.normalMap = nm;
    m.normalScale.set(1, 1);
  }
  return m;
}
