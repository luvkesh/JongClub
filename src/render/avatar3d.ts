// Players as real 3D figures seated at the table: head, face, hair, outfit,
// arms resting on the rim, and whatever they wear (glasses, sunglasses, caps,
// hats, earrings, pearls, a fan). Built from a few primitives with shared
// materials so three figures stay cheap on phones. The same model renders the
// round portraits on the seat plates. Purely cosmetic.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SKIN_TONES, type AvatarSpec } from '../cosmetics/catalog';
import { FRAMES, luma, mix, shade, tint } from '../cosmetics/avatar';
import { drawJewelFrame } from './frameArt';
import { leanGraphics } from './quality';

const GOLD = '#c8a46a';
const UP = new THREE.Vector3(0, 1, 0);

/** Head centre in figure space (feet at the floor far below; y 0 is the table top). */
const HEAD_Y = 1.7;
const HEAD_R = 0.42;
/** The head group's scale on the shoulders: a big, friendly head, as stylised characters wear it. */
const HEAD_SCALE = 1.02;
/** Where the head pivots (top of the neck). */
const NECK_Y = 1.14;
/** Where the head's centre ends up, after HEAD_SCALE. */
const HEAD_AT = NECK_Y + (HEAD_Y - NECK_Y) * HEAD_SCALE;

/** Head scale per face shape (x, y, z); the hair scales with it so the crown always covers. */
const FACE: Record<string, [number, number, number]> = { oval: [1, 1, 1], round: [1.07, 0.95, 1.02], long: [0.94, 1.08, 1], square: [1.08, 0.98, 1.03], heart: [1.03, 1.04, 0.99] };

/** Head ellipsoid radii (x, upper y, lower y, z); the lower half tapers toward the chin. */
/** How much the head narrows toward the chin. */
const JAW = 0.36;
const HEAD_AX = HEAD_R * 0.88,
  HEAD_UP = HEAD_R * 1.08,
  HEAD_DN = HEAD_R * 1.06,
  HEAD_AZ = HEAD_R * 0.95;

/** Eye centre (x either side, height above the head centre): big eyes set low and wide. */
const EYE_X = 0.145,
  EYE_Y = -0.005;
/** Eyeball radius. */
const EYE_R = 0.085;

/**
 * Mesh and texture detail, fixed for the session: smooth silhouettes and fine
 * painting up close (portraits, the free camera), a little less on lean devices.
 */
let detail = 0;
const DETAIL = () => detail || (detail = leanGraphics() ? 1.6 : 2.6);
/** A segment count scaled by DETAIL. */
const seg = (n: number) => Math.max(n, Math.round(n * DETAIL()));
/** Texture scale: canvases are painted at 512-wide units times this. */
const TEX = () => (leanGraphics() ? 2 : 4);

const gauss = (x: number, y: number, cx: number, cy: number, sx: number, sy: number) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));

/** Nose shapes for the sculpt: [tip height, tip size, width, bridge]. Small and soft on every face. */
const NOSE_SHAPE: Record<string, [number, number, number, number]> = {
  button: [0.085, 0.03, 0.022, 0.006],
  straight: [0.088, 0.034, 0.022, 0.012],
  broad: [0.09, 0.034, 0.03, 0.008],
  aquiline: [0.09, 0.036, 0.02, 0.016],
};

/**
 * How far the face stands out from the plain egg at (x, dy), in head units:
 * brow ridge, eye sockets, cheekbones, the nose, lips and chin, so the face
 * has real form rather than features stuck onto a ball.
 */
function sculpt(x: number, dy: number, nose: string) {
  const [tip, size, wide, bridge] = NOSE_SHAPE[nose] ?? NOSE_SHAPE.button;
  const ax = Math.abs(x);
  let d = 0;
  // A soft little nose: a faint bridge, a round tip and the barest nostrils.
  d += bridge * gauss(x, dy, 0, -0.04, 0.025, 0.05);
  d += size * gauss(x, dy, 0, -tip, 0.036, 0.028);
  d += 0.012 * gauss(ax, dy, wide, -tip - 0.01, 0.02, 0.016);
  // Shallow sockets the big eyes sit in.
  d -= 0.03 * gauss(ax, dy, EYE_X, EYE_Y, 0.07, 0.06);
  // A gentle brow.
  d += 0.008 * gauss(ax, dy, 0.14, 0.12, 0.1, 0.03);
  // Full, round cheeks.
  d += 0.012 * gauss(ax, dy, 0.19, -0.1, 0.07, 0.06);
  // A small round chin.
  d += 0.016 * gauss(x, dy, 0, -0.29, 0.07, 0.045);
  return d;
}

function headGeometry(nose: string) {
  const g = new THREE.SphereGeometry(1, seg(48), seg(36));
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    // Narrow the jaw: the lower the point, the narrower the head.
    const taper = y < 0 ? 1 - JAW * y * y : 1;
    const hx = p.getX(i) * HEAD_AX * taper,
      hy = y * (y < 0 ? HEAD_DN : HEAD_UP);
    let hz = p.getZ(i) * HEAD_AZ * (y < 0 ? 1 - 0.08 * y * y : 1);
    // Sculpt the front, fading out toward the sides.
    if (hz > 0) hz += sculpt(hx, hy, nose) * Math.min(1, (p.getZ(i) / 0.6) ** 2);
    p.setXYZ(i, hx, hy, hz);
  }
  g.computeVertexNormals();
  return g;
}

/** z of the face's surface at (x, dy) where dy is height above the head centre. */
function faceZ(x: number, dy: number) {
  const ny = dy / (dy < 0 ? HEAD_DN : HEAD_UP);
  const taper = ny < 0 ? 1 - JAW * ny * ny : 1;
  const nx = x / (HEAD_AX * taper);
  const k = Math.max(0, 1 - ny * ny - nx * nx);
  return Math.sqrt(k) * HEAD_AZ * (ny < 0 ? 1 - 0.08 * ny * ny : 1);
}

/** faceZ with the sculpt: the skin's surface, for setting features into it. */
const skinZ = (x: number, dy: number, nose: string) => faceZ(x, dy) + sculpt(x, dy, nose);

/** Torso outline (radius, height) turned on a lathe; flattened front to back afterwards. */
const TORSO: [number, number][] = [
  [0.58, -1.1],
  [0.6, -0.7],
  [0.64, -0.3],
  [0.7, 0.1],
  [0.78, 0.45],
  [0.86, 0.75],
  [0.84, 0.95],
  [0.7, 1.08],
  [0.42, 1.17],
  [0.14, 1.2],
  [0.0, 1.22],
];
const TORSO_SX = 1.15;
/** The lathe's smoothed outline, as the torso mesh is turned from it. */
let torsoSmooth: [number, number][] | null = null;
/** The torso's radius at a height (on the smoothed outline, so pieces set on it sit on the cloth). */
function torsoR(y: number) {
  const T = (torsoSmooth ??= new THREE.SplineCurve(TORSO.map(([r, yy]) => new THREE.Vector2(r, yy))).getPoints((TORSO.length - 1) * 6).map((v) => [v.x, v.y] as [number, number]));
  for (let i = 1; i < T.length; i++) {
    const [r0, y0] = T[i - 1],
      [r1, y1] = T[i];
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return 0;
}
const TORSO_SZ = 0.62;

interface Mats {
  skin: THREE.MeshStandardMaterial;
  face: THREE.MeshStandardMaterial;
  skinShade: THREE.MeshStandardMaterial;
  hair: THREE.MeshStandardMaterial;
  outfit: THREE.MeshStandardMaterial;
  sleeve: THREE.MeshStandardMaterial;
  ink: THREE.MeshStandardMaterial;
  cornea: THREE.MeshStandardMaterial;
  glint: THREE.MeshStandardMaterial;
  lash: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
  lip: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  wear: THREE.MeshStandardMaterial;
  lapel: THREE.MeshStandardMaterial;
  sleeveTrim: THREE.MeshStandardMaterial;
  nail: THREE.MeshStandardMaterial;
  lens: THREE.MeshStandardMaterial;
  frame: THREE.MeshStandardMaterial;
  extra: THREE.Material[];
}

const geoCache = new Map<string, THREE.BufferGeometry>();
/** Shared geometry by key (never disposed; a handful of small buffers). */
function geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g as T;
}

function mesh(g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

/** A capsule of radius r from a to b. */
function limb(parent: THREE.Object3D, m: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, r: number) {
  const len = a.distanceTo(b);
  const g = geo(`cap${r.toFixed(3)}:${len.toFixed(2)}`, () => new THREE.CapsuleGeometry(r, len, seg(4), seg(10)));
  const o = mesh(g, m, parent);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
  return o;
}

/** Figures sit beyond the lamp's pool of light, so each part glows faintly in its own colour to stay readable. */
const std = (color: string, roughness = 0.7, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive: color, emissiveIntensity: metalness > 0.5 ? 0.05 : 0.14, ...extra });

/**
 * Skin: a soft red sheen at grazing angles stands in for light scattering
 * under the skin (lean devices keep the plain material).
 */
const skinMat = (color: string) =>
  leanGraphics()
    ? std(color, 0.6)
    : new THREE.MeshPhysicalMaterial({ color, roughness: 0.52, metalness: 0, emissive: color, emissiveIntensity: 0.12, sheen: 0.55, sheenColor: '#ff6a50', sheenRoughness: 0.45, specularIntensity: 0.45 });

/** Hair: smooth and glossy, a lacquered highlight on the clumps (lean devices keep the plain material). */
const hairMat = (hair: string) => {
  const c = shade(hair, 0.05);
  return leanGraphics()
    ? std(c, 0.5, 0, { side: THREE.DoubleSide, emissiveIntensity: 0.1 })
    : new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.55, metalness: 0, emissive: c, emissiveIntensity: 0.1, clearcoat: 0.2, clearcoatRoughness: 0.4, sheen: 0.3, sheenColor: tint(hair, 0.5), sheenRoughness: 0.35, side: THREE.DoubleSide });
};

/**
 * A full fringe over the forehead (a piece of a unit sphere, like the crown):
 * it ends just above the brows in a few soft clumps, curving up toward the
 * temples, and sweeps down to one side when `slant` is set (a side parting).
 */
function bangsGeometry(slant: number) {
  const W = 1.2;
  const g = new THREE.SphereGeometry(1, seg(40), seg(14), Math.PI / 2 - W, W * 2, 0, 1);
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const u = uv.getX(i) * 2 - 1;
    const f = 1 - uv.getY(i);
    const ph = Math.PI / 2 + u * W;
    // Where the fringe ends: just above the brows at the front, rising toward the temples, with soft points.
    const end = 1.3 + slant * u - 0.28 * u * u + 0.035 * Math.cos(u * 15) * (1 - Math.abs(u));
    const th = f * end;
    // Lifts off the forehead a little toward its tips, in rounded clumps.
    const r = 1 + 0.07 * f * f + 0.02 * f * (0.5 + 0.5 * Math.cos(u * 15));
    p.setXYZ(i, -Math.cos(ph) * Math.sin(th) * r, Math.cos(th) * r, Math.sin(ph) * Math.sin(th) * r);
  }
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------ outfit painting

/** v (0 bottom .. 1 top) on the lathe for a height y, following the profile's point spacing. */
function vAt(y: number) {
  for (let i = 1; i < TORSO.length; i++) {
    const [, y0] = TORSO[i - 1],
      [, y1] = TORSO[i];
    if (y <= y1) return (i - 1 + (y - y0) / (y1 - y0)) / (TORSO.length - 1);
  }
  return 1;
}

/**
 * The outfit as a texture wrapped around the torso: the front (u 0.5) carries
 * collars, shirts, ties, lapels, sashes and piping.
 */
/**
 * Sculpt a hair shell (a unit sphere piece) into locks: soft ridges that run
 * from the crown down, wavering a little, so hair has volume and catches light
 * in strands rather than reading as a smooth cap.
 */
function locks(g: THREE.BufferGeometry, depth: number, count = 22, from = 0, to = Math.PI) {
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    const th = Math.acos(THREE.MathUtils.clamp(y, -1, 1));
    const ph = Math.atan2(z, x);
    const wave = Math.sin(ph * count + Math.sin(th * 4 + ph * 3) * 1.4);
    const fine = Math.sin(ph * count * 2.7 + th * 6);
    // Ridges grow from nothing at the crown's centre.
    // ... and settle to a clean edge where the shell ends.
    const k = 1 + depth * Math.min(1, th / 0.6, Math.max(0, to - th) / 0.3, Math.max(0, th - from) / 0.3 + (from === 0 ? 1 : 0)) * (0.65 * (0.5 + 0.5 * wave) ** 1.5 + 0.2 * (0.5 + 0.5 * fine));
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
}

let strandTex: THREE.CanvasTexture | null = null;
/** Broad, soft light and dark clumps (white-based, so it multiplies the hair colour): stylised, glossy hair. Shared by every figure. */
function hairTexture() {
  if (strandTex) return strandTex;
  const S = 128 * TEX();
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d8d8d8';
  g.fillRect(0, 0, S, S);
  let n = 7;
  const rnd = () => ((n = (n * 16807) % 2147483647) / 2147483647);
  // Broad locks first (soft light and dark bands), then fine strands over them.
  g.filter = `blur(${S / 128}px)`;
  for (let i = 0; i < 26; i++) {
    const x = rnd() * S;
    const v = Math.round(205 + rnd() * 50);
    g.strokeStyle = `rgb(${v},${v},${v})`;
    g.globalAlpha = 0.35;
    g.lineWidth = S * (0.02 + rnd() * 0.04);
    g.beginPath();
    g.moveTo(x, -4);
    g.bezierCurveTo(x + (rnd() - 0.5) * S * 0.08, S * 0.3, x + (rnd() - 0.5) * S * 0.08, S * 0.7, x + (rnd() - 0.5) * S * 0.05, S + 4);
    g.stroke();
  }
  g.filter = 'none';
  strandTex = new THREE.CanvasTexture(c);
  strandTex.colorSpace = THREE.SRGBColorSpace;
  strandTex.anisotropy = 8;
  strandTex.wrapS = strandTex.wrapT = THREE.RepeatWrapping;
  strandTex.repeat.set(3, 1);
  return strandTex;
}

/**
 * The face, painted per figure onto the head (the head's UVs run around it with
 * the face's centre at u 0.25): skin with soft modelling (warm cheeks and nose
 * tip, shaded sockets and jaw, a faint grain), lined eyes, hair-stroke brows and
 * shaped lips. Painting these keeps them crisp at any distance, where small
 * meshes on the face broke up into dots and dashes.
 */
function faceTexture(spec: AvatarSpec, skin: string, hair: string) {
  const W = 512 * TEX(),
    H = W / 2;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = skin;
  g.fillRect(0, 0, W, H);
  // Canvas point for a spot on the face: dx across (head units), dy above the head centre.
  const P = (dx: number, dy: number): [number, number] => {
    const ny = THREE.MathUtils.clamp(dy / (dy < 0 ? HEAD_DN : HEAD_UP), -1, 1);
    const th = Math.acos(ny);
    const ring = Math.max(0.05, Math.sin(th)) * HEAD_AX * (ny < 0 ? 1 - JAW * ny * ny : 1);
    const ph = Math.asin(THREE.MathUtils.clamp(dx / ring, -1, 1));
    return [(0.25 + ph / (Math.PI * 2)) * W, (th / Math.PI) * H];
  };
  /** Canvas pixels per head unit near the front of the face. */
  const U = W / (Math.PI * 2 * HEAD_AX);
  const rgba = (hex: string, a: number) => {
    const col = new THREE.Color(hex);
    return `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},${a})`;
  };
  const spot = (dx: number, dy: number, rx: number, ry: number, col: string, a: number) => {
    const [x, y] = P(dx, dy);
    g.save();
    g.translate(x, y);
    g.scale(rx * U, ry * U * 0.95);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, rgba(col, a));
    gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, 1, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  const path = (pts: [number, number][]) => {
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const [px, py] = P(x, y);
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    });
  };
  const dark = luma(skin) < 0.35;
  const deep = shade(skin, 0.3);
  const blush = mix(skin, '#ef7f86', dark ? 0.35 : 0.6);
  // Soft modelling: a bright forehead and nose tip, gentle shade at the temples and under the chin.
  for (const side of [-1, 1]) {
    spot(side * 0.34, 0.04, 0.08, 0.16, deep, 0.14);
    // Rosy round cheeks.
    spot(side * 0.205, -0.115, 0.075, 0.055, blush, dark ? 0.3 : 0.42);
    spot(side * 0.215, -0.1, 0.03, 0.02, tint(skin, 0.4), 0.25);
  }
  spot(0, -0.09, 0.03, 0.022, blush, 0.25);
  spot(0, 0.22, 0.2, 0.1, tint(skin, 0.25), 0.35);
  spot(0, -0.27, 0.07, 0.035, tint(skin, 0.18), 0.25);
  const jaw = g.createLinearGradient(0, H * 0.7, 0, H);
  jaw.addColorStop(0, rgba(deep, 0));
  jaw.addColorStop(1, rgba(deep, 0.3));
  g.fillStyle = jaw;
  g.fillRect(0, H * 0.7, W, H * 0.3);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // A soft crease above each big eye.
  for (const side of [-1, 1]) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 16; i++) {
      const t = 0.7 + ((Math.PI - 1.4) * i) / 16;
      pts.push([side * EYE_X + Math.cos(t) * EYE_R * 1.08, EYE_Y + Math.sin(t) * EYE_R * 1.32]);
    }
    path(pts);
    g.strokeStyle = rgba(deep, 0.2);
    g.lineWidth = 0.006 * U;
    g.stroke();
  }
  // Brows: smooth, soft-edged strokes, tapering to the outer end.
  const bs = spec.brows ?? 'soft';
  const thick = bs === 'thick' ? 0.03 : bs === 'straight' ? 0.024 : 0.021;
  const browCol = shade(hair, luma(hair) > 0.6 ? 0.35 : 0.1);
  for (const side of [-1, 1]) {
    const by = EYE_Y + EYE_R * 1.75;
    const inner: [number, number] = [0.085, by - 0.006];
    const outer: [number, number] = [0.235, bs === 'straight' ? by - 0.004 : by - 0.02];
    const peak: [number, number] = [0.165, bs === 'arched' ? by + 0.025 : bs === 'straight' ? by + 0.004 : by + 0.016];
    const at = (t: number): [number, number] => {
      const u = 1 - t;
      return [side * (u * u * inner[0] + 2 * u * t * peak[0] + t * t * outer[0]), u * u * inner[1] + 2 * u * t * peak[1] + t * t * outer[1]];
    };
    const top: [number, number][] = [],
      bot: [number, number][] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const w = thick * (1 - 0.55 * t) * Math.min(1, 0.55 + 6 * t);
      const [x, y] = at(t);
      top.push([x, y + w * 0.5]);
      bot.push([x, y - w * 0.5]);
    }
    path([...top, ...bot.reverse()]);
    g.closePath();
    g.fillStyle = rgba(browCol, 0.88);
    g.filter = `blur(${Math.max(1, 0.0025 * U)}px)`;
    g.fill();
    g.filter = 'none';
  }
  // A small, sweet smile: a curved line with soft rosy lips and dimpled corners.
  const lip = mix(skin, '#c4525a', dark ? 0.35 : 0.5);
  const lw = spec.lips === 'full' ? 0.06 : spec.lips === 'thin' ? 0.048 : 0.054;
  const lh = spec.lips === 'full' ? 0.024 : spec.lips === 'thin' ? 0.012 : 0.018;
  const my = -0.175;
  const mouthLine = (x: number) => my + 0.022 * (x / lw) ** 2;
  const line: [number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    const x = -lw + (2 * lw * i) / 20;
    line.push([x, mouthLine(x)]);
  }
  const lower: [number, number][] = [];
  for (let i = 20; i >= 0; i--) {
    const x = -lw * 0.75 + (2 * lw * 0.75 * i) / 20;
    const k = 1 - (x / (lw * 0.75)) ** 2;
    lower.push([x, mouthLine(x) - 0.002 - lh * Math.pow(Math.max(0, k), 0.7)]);
  }
  path([...line.slice(3, 18), ...lower]);
  g.closePath();
  g.fillStyle = rgba(lip, 0.75);
  g.fill();
  spot(0.006, my - lh * 0.55, lw * 0.3, lh * 0.3, tint(lip, 0.4), 0.45);
  path(line);
  g.strokeStyle = rgba(shade(lip, 0.45), 0.95);
  g.lineWidth = 0.0065 * U;
  g.stroke();
  for (const side of [-1, 1]) {
    path([[side * lw * 0.92, mouthLine(lw * 0.92) - 0.001], [side * (lw + 0.008), mouthLine(lw) + 0.006]]);
    g.strokeStyle = rgba(shade(lip, 0.45), 0.7);
    g.lineWidth = 0.005 * U;
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** A character's gold badge: a knight plaque, a round spade pin, or an embroidered lotus. */
function badgeTexture(kind: NonNullable<AvatarSpec['badge']>) {
  const S = 64 * TEX();
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const gold = g.createLinearGradient(0, 0, S, S);
  gold.addColorStop(0, '#f6dc96');
  gold.addColorStop(0.5, '#c9a052');
  gold.addColorStop(1, '#8a6428');
  const glyph = (ch: string, col: string, k: number) => {
    g.fillStyle = col;
    g.font = `${Math.round(S * k)}px "DejaVu Sans", "Segoe UI Symbol", "Apple Symbols", serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, S / 2, S * 0.54);
  };
  if (kind === 'knight') {
    g.fillStyle = gold;
    g.beginPath();
    g.roundRect(S * 0.06, S * 0.06, S * 0.88, S * 0.88, S * 0.12);
    g.fill();
    g.fillStyle = '#1d1a16';
    g.beginPath();
    g.roundRect(S * 0.15, S * 0.15, S * 0.7, S * 0.7, S * 0.07);
    g.fill();
    glyph('\u265E', gold as unknown as string, 0.6);
  } else if (kind === 'spade') {
    g.fillStyle = gold;
    g.beginPath();
    g.arc(S / 2, S / 2, S * 0.46, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(90,60,20,0.6)';
    g.lineWidth = S * 0.04;
    g.beginPath();
    g.arc(S / 2, S / 2, S * 0.37, 0, Math.PI * 2);
    g.stroke();
    glyph('\u2660', '#1b1512', 0.5);
  } else {
    // Lotus: a central petal, two pairs either side and a shallow base, in gold thread.
    g.fillStyle = gold;
    g.translate(S / 2, S * 0.66);
    const petal = (ang: number, len: number, w: number) => {
      g.save();
      g.rotate(ang);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(w, -len * 0.5, 0, -len);
      g.quadraticCurveTo(-w, -len * 0.5, 0, 0);
      g.fill();
      g.restore();
    };
    petal(0, S * 0.5, S * 0.16);
    for (const sd of [-1, 1]) {
      petal(sd * 0.55, S * 0.42, S * 0.13);
      petal(sd * 1.05, S * 0.32, S * 0.1);
    }
    g.fillRect(-S * 0.3, S * 0.02, S * 0.6, S * 0.05);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const irisCache = new Map<string, THREE.CanvasTexture>();
/** An iris: fibres radiating from a pupil, a lighter ring round it and a dark limbal edge. Shared per colour. */
function irisTexture(col: string) {
  const hit = irisCache.get(col);
  if (hit) return hit;
  const S = 64 * TEX();
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const C = S / 2;
  const base = g.createRadialGradient(C, C, S * 0.08, C, C, S / 2);
  base.addColorStop(0, tint(col, 0.35));
  base.addColorStop(0.45, col);
  base.addColorStop(0.85, shade(col, 0.25));
  base.addColorStop(1, shade(col, 0.75));
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  let n = 5;
  const rnd = () => ((n = (n * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 220; i++) {
    const a = rnd() * Math.PI * 2;
    const r0 = S * (0.12 + rnd() * 0.06),
      r1 = S * (0.3 + rnd() * 0.18);
    g.strokeStyle = rnd() < 0.5 ? `rgba(255,240,210,${0.12 + rnd() * 0.15})` : `rgba(0,0,0,${0.12 + rnd() * 0.15})`;
    g.lineWidth = S / 160 + rnd() * (S / 120);
    g.beginPath();
    g.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0);
    g.lineTo(C + Math.cos(a + (rnd() - 0.5) * 0.15) * r1, C + Math.sin(a + (rnd() - 0.5) * 0.15) * r1);
    g.stroke();
  }
  // Light pooling in the lower iris, as in a stylised eye.
  const glow = g.createRadialGradient(C, C + S * 0.22, 0, C, C + S * 0.22, S * 0.3);
  glow.addColorStop(0, `rgba(255,214,150,0.55)`);
  glow.addColorStop(1, 'rgba(255,214,150,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, S, S);
  g.fillStyle = '#050404';
  g.beginPath();
  g.arc(C, C, S * 0.22, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.75)';
  g.lineWidth = S * 0.05;
  g.beginPath();
  g.arc(C, C, S * 0.48, 0, Math.PI * 2);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  irisCache.set(col, tex);
  return tex;
}

let weaveTex: THREE.CanvasTexture | null = null;
/** A fine twill tile for the cloth's bump map, repeated many times over the torso. Shared by every figure. */
function weaveTexture() {
  if (weaveTex) return weaveTex;
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#808080';
  g.fillRect(0, 0, S, S);
  g.strokeStyle = '#b4b4b4';
  g.lineWidth = 2;
  for (let i = -S; i < S * 2; i += 4) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + S, S);
    g.stroke();
  }
  weaveTex = new THREE.CanvasTexture(c);
  weaveTex.wrapS = weaveTex.wrapT = THREE.RepeatWrapping;
  weaveTex.repeat.set(48, 20);
  return weaveTex;
}

function outfitTexture(spec: AvatarSpec, outfit: string, skin: string) {
  // Painted at 512 x 256 units, k device pixels each.
  const k = TEX() * 0.75;
  const W = Math.round(512 * k),
    H = Math.round(256 * k);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const kandura = spec.outfit === 'kandura';
  const base = kandura ? (luma(outfit) > 0.7 ? outfit : '#f2efe8') : outfit;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, tint(base, 0.06));
  grad.addColorStop(1, shade(base, 0.22));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // Canvas y for a body height (texture rows run top to bottom, v bottom to top).
  const Y = (y: number) => (1 - vAt(y)) * H;
  // Canvas x for an offset across the chest (in torso units at the front).
  const X = (dx: number) => W / 2 + (dx / (2 * Math.PI * 0.8)) * W;
  const poly = (pts: [number, number][], fill: string) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  const line = (pts: [number, number][], stroke: string, w: number) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
    g.strokeStyle = stroke;
    g.lineWidth = w;
    g.lineCap = 'round';
    g.stroke();
  };
  // Soft folds where cloth gathers at the waist and under the arms: a shade beside a highlight.
  for (const [dx, y0, y1, a] of [
    [0.32, -1.1, -0.1, 0.1],
    [-0.36, -1.1, 0.0, 0.1],
    [0.7, -1.0, 0.5, 0.12],
    [-0.72, -1.0, 0.5, 0.12],
    [0.12, -1.1, -0.5, 0.07],
    [-0.1, -1.1, -0.6, 0.07],
  ] as [number, number, number, number][]) {
    const x = X(dx),
      w = 22 * k;
    const gr = g.createLinearGradient(x - w, 0, x + w, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(0.45, `rgba(0,0,0,${a})`);
    gr.addColorStop(0.6, `rgba(255,255,255,${a * 0.6})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    const ya = Y(y1),
      yb = Y(y0);
    g.save();
    g.beginPath();
    g.moveTo(x, ya);
    g.lineTo(x + w, yb);
    g.lineTo(x - w, yb);
    g.closePath();
    g.clip();
    g.fillRect(x - w, ya, 2 * w, yb - ya);
    g.restore();
  }
  const top = 1.2;
  switch (spec.outfit) {
    case 'suit':
      poly([[-0.2, top], [0.2, top], [0, 0.35]], '#f3efe6');
      poly([[-0.05, 1.05], [0.05, 1.05], [0.07, 0.5], [0, 0.38], [-0.07, 0.5]], '#141414');
      poly([[-0.24, top], [0, 0.3], [-0.12, -0.2], [-0.5, 0.7]], shade(outfit, 0.14));
      poly([[0.24, top], [0, 0.3], [0.12, -0.2], [0.5, 0.7]], shade(outfit, 0.14));
      poly([[0.32, 0.66], [0.46, 0.68], [0.46, 0.62], [0.32, 0.6]], '#f3efe6');
      break;
    case 'blazer':
      poly([[-0.2, top], [0.2, top], [0, 0.4]], '#efe9dc');
      poly([[-0.24, top], [0, 0.3], [-0.1, -0.4], [-0.5, 0.7]], shade(outfit, 0.1));
      poly([[0.24, top], [0, 0.3], [0.1, -0.4], [0.5, 0.7]], shade(outfit, 0.1));
      poly([[0.3, 0.6], [0.48, 0.62], [0.48, 0.55], [0.3, 0.53]], GOLD);
      for (const y of [0.1, -0.25]) {
        g.beginPath();
        g.arc(X(0.02), Y(y), 3.5 * k, 0, Math.PI * 2);
        g.fillStyle = GOLD;
        g.fill();
      }
      break;
    case 'qipao':
      // Mandarin collar band and a diagonal closure piped in gold.
      g.fillStyle = shade(outfit, 0.1);
      g.fillRect(0, Y(top), W, Y(1.0) - Y(top));
      line([[-2.6, 1.0], [2.6, 1.0]], GOLD, 3 * k);
      line([[0, 1.0], [0.25, 0.75], [0.45, 0.4]], GOLD, 3.5 * k);
      for (const [x, y] of [[0.18, 0.82], [0.32, 0.62], [0.42, 0.45]] as [number, number][]) line([[x - 0.05, y], [x + 0.06, y]], GOLD, 4 * k);
      g.globalAlpha = 0.3;
      for (const [x, y] of [[-0.45, 0.2], [0.55, -0.3], [-0.2, -0.6], [1.6, 0.4], [-1.5, -0.2]] as [number, number][]) {
        g.beginPath();
        g.ellipse(X(x), Y(y), 9 * k, 6 * k, 0.5, 0, Math.PI * 2);
        g.fillStyle = tint(outfit, 0.3);
        g.fill();
      }
      g.globalAlpha = 1;
      break;
    case 'kimono':
      poly([[-0.16, top], [0.16, top], [0, 0.55]], skin);
      poly([[0.2, top], [0.12, top], [-0.08, 0.15], [-0.02, 0.1]], '#f3efe6');
      poly([[-0.2, top], [-0.12, top], [0.12, 0.0], [0.04, -0.05]], '#f3efe6');
      poly([[-0.2, top], [0.04, -0.05], [-0.1, -0.05], [-0.42, 0.6]], shade(outfit, 0.14));
      g.fillStyle = GOLD;
      g.fillRect(0, Y(-0.05), W, Y(-0.45) - Y(-0.05));
      g.fillStyle = shade(GOLD, 0.35);
      g.fillRect(0, Y(-0.22), W, 4 * k);
      break;
    case 'kandura': {
      const trim = luma(outfit) > 0.7 ? '#c9a24a' : outfit;
      line([[-0.18, 1.15], [0, 1.05], [0.18, 1.15]], shade('#f2efe8', 0.22), 3 * k);
      line([[0, 1.05], [0, 0.4]], shade('#f2efe8', 0.16), 2.5 * k);
      line([[0, 1.02], [-0.03, 0.6], [-0.02, 0.25]], trim, 4 * k);
      g.beginPath();
      g.arc(X(-0.02), Y(0.22), 5 * k, 0, Math.PI * 2);
      g.fillStyle = trim;
      g.fill();
      break;
    }
    case 'sweater':
      line([[-0.22, 1.16], [0, 0.95], [0.22, 1.16]], shade(outfit, 0.22), 9 * k);
      poly([[-0.14, 1.12], [0.14, 1.12], [0.06, 1.0], [0, 1.04], [-0.06, 1.0]], '#efe9dc');
      g.globalAlpha = 0.16;
      for (let x = 0; x < W; x += 9 * k) {
        g.fillStyle = shade(outfit, 0.4);
        g.fillRect(x, Y(-0.85), 3 * k, Y(-1.1) - Y(-0.85));
      }
      g.globalAlpha = 1;
      break;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Merge the meshes under `root` (except those under `keep`) into one mesh per
 * material, so a figure costs a dozen draw calls rather than seventy.
 */
function mergeStatic(root: THREE.Object3D, keep: Set<THREE.Object3D>) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const byMat = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }>();
  const visit = (o: THREE.Object3D) => {
    for (const c of o.children) {
      if (keep.has(c)) continue;
      const m = c as THREE.Mesh;
      if (m.isMesh && !Array.isArray(m.material)) {
        const g = m.geometry.clone();
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
        for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
        const e = byMat.get(m.material) ?? { geos: [], meshes: [] };
        e.geos.push(g);
        e.meshes.push(m);
        byMat.set(m.material, e);
      }
      visit(c);
    }
  };
  visit(root);
  for (const [mat, { geos, meshes }] of byMat) {
    if (meshes.length < 2) {
      geos[0].dispose();
      continue;
    }
    const merged = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)));
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    for (const m of meshes) m.removeFromParent();
    const out = new THREE.Mesh(merged, mat);
    out.userData.ownGeometry = true;
    root.add(out);
  }
  // Drop groups left empty.
  const empty: THREE.Object3D[] = [];
  root.traverse((o) => o !== root && !(o as THREE.Mesh).isMesh && !keep.has(o) && o.children.length === 0 && empty.push(o));
  for (const o of empty) o.removeFromParent();
}

// ------------------------------------------------------------ the figure

/** A seated player. Add `group` to the scene and call `update` each frame. */
export class SeatFigure {
  readonly group = new THREE.Group();
  /** Turns and nods; holds the face, hair and anything worn on the head. */
  private head = new THREE.Group();
  private torso!: THREE.Mesh;
  private eyes: THREE.Object3D[] = [];
  private mats: Mats;
  private textures: THREE.Texture[] = [];
  private yaw = 0;
  private pitch = -0.12;
  private nextBlink = 1 + Math.random() * 3;
  private phase = Math.random() * Math.PI * 2;
  /** Seconds into a thank-you nod (a cup of tea), or -1. */
  private nodT = -1;
  private static tmp = new THREE.Vector3();

  constructor(readonly spec: AvatarSpec) {
    const skin = SKIN_TONES[Math.max(0, Math.min(SKIN_TONES.length - 1, spec.skin | 0))] ?? SKIN_TONES[1];
    const hair = spec.hairColor || '#1b1715';
    const outfit = spec.outfitColor || '#1f3b33';
    const kandura = spec.outfit === 'kandura';
    const sleeve = kandura ? (luma(outfit) > 0.7 ? outfit : '#f2efe8') : outfit;
    const wear = spec.wearColor || '#7a1f1b';
    this.mats = {
      skin: skinMat(skin),
      face: skinMat('#ffffff'),
      skinShade: std(shade(skin, 0.1), 0.65),
      // Glossy, sculpted clumps with a clear sheen, as stylised hair is drawn.
      hair: hairMat(hair),
      outfit: std('#ffffff', 0.78),
      sleeve: std(shade(sleeve, 0.08), 0.8),
      ink: std('#3a261a', 0.3),
      cornea: std('#ffffff', 0.04, 0, { transparent: true, opacity: 0.12, emissiveIntensity: 0, depthWrite: false }),
      glint: std('#ffffff', 0.1, 0, { emissiveIntensity: 1.1 }),
      lash: std('#22150f', 0.5, 0, { emissiveIntensity: 0.02 }),
      white: std('#f4f1ea', 0.35),
      lip: std(mix(skin, '#9c4a43', 0.5), 0.55),
      gold: std(GOLD, 0.32, 0.9),
      wear: std(wear, 0.75, 0, { side: THREE.DoubleSide }),
      lapel: std(shade(outfit, kandura ? 0 : 0.12), 0.7),
      sleeveTrim: std(shade(sleeve, 0.2), 0.75),
      nail: std(mix(skin, '#f2d0c8', 0.5), 0.25),
      lens: std('#0b0d10', 0.08, 0.6, { transparent: true, opacity: 0.92 }),
      frame: std('#121212', 0.4, 0.3),
      extra: [],
    };
    const tex = outfitTexture(spec, outfit, skin);
    this.textures.push(tex);
    // Smooth glossy colour, with the clumps only in the relief (a bump map), as stylised hair is drawn.
    if (spec.hair !== 'shaved' && spec.hair !== 'buzz') (this.mats.hair.bumpMap = hairTexture()), (this.mats.hair.bumpScale = 0.3);
    const iris = spec.eyeColor || '';
    this.mats.ink.color.set('#ffffff');
    this.mats.ink.emissive.set('#ffffff');
    this.mats.ink.emissiveIntensity = 0.12;
    this.mats.ink.map = this.mats.ink.emissiveMap = irisTexture(iris || '#4a2e1c');
    this.mats.outfit.map = tex;
    this.mats.outfit.emissiveMap = tex;
    // Cloth weave and hair strands catch the light up close; the head carries its soft modelling.
    this.mats.outfit.bumpMap = this.mats.sleeve.bumpMap = weaveTexture();
    this.mats.outfit.bumpScale = this.mats.sleeve.bumpScale = 0.6;
    const face = faceTexture(spec, skin, hair);
    this.textures.push(face);
    this.mats.face.map = this.mats.face.emissiveMap = face;

    this.buildBody();
    this.buildHead();
    this.buildHair(spec.hair, hair);
    this.buildWear();
    this.group.add(this.head);
    this.head.position.set(0, NECK_Y, 0);
    // A slightly smaller head on the shoulders: closer to real proportions.
    this.head.scale.setScalar(HEAD_SCALE);
    // Few draw calls: everything that never moves on its own is merged per material.
    mergeStatic(this.group, new Set<THREE.Object3D>([this.head, this.torso]));
    mergeStatic(this.head, new Set<THREE.Object3D>(this.eyes));
    // A slender build: the body (not the head) narrowed across the shoulders and front to back.
    const body = new THREE.Group();
    for (const c of [...this.group.children]) if (c !== this.head) body.add(c);
    body.scale.set(0.74, 1, 0.86);
    this.group.add(body);
  }

  private buildBody() {
    const m = this.mats;
    const lathe = geo('torso', () => new THREE.LatheGeometry(new THREE.SplineCurve(TORSO.map(([r, y]) => new THREE.Vector2(r, y))).getPoints((TORSO.length - 1) * 6), seg(28), Math.PI, Math.PI * 2));
    this.torso = mesh(lathe, m.outfit, this.group);
    this.torso.scale.set(TORSO_SX, 1, TORSO_SZ);
    // Neck.
    mesh(geo('neck', () => new THREE.CylinderGeometry(0.145, 0.17, 0.4, seg(14))), m.skinShade, this.group, 0, 1.25, 0);
    // Arms: upper arm down from the shoulder, forearm forward onto the rim, a hand at rest.
    for (const side of [-1, 1]) {
      const sh = new THREE.Vector3(side * 0.86, 0.86, 0);
      const el = new THREE.Vector3(side * 1.0, 0.12, 0.3);
      const wr = new THREE.Vector3(side * 0.52, 0.12, 1.0);
      limb(this.group, m.sleeve, sh, el, 0.2);
      limb(this.group, m.sleeve, el, wr, 0.17);
      // A sliver of shirt cuff under a jacket sleeve.
      if (this.spec.outfit === 'suit' || this.spec.outfit === 'blazer') limb(this.group, m.white, wr.clone().lerp(el, 0.02), wr.clone().lerp(el, -0.03), 0.15);
      // A cuff where the sleeve ends.
      const cuff = mesh(geo('cuff', () => new THREE.TorusGeometry(0.165, 0.03, seg(6), seg(18))), m.sleeveTrim, this.group, wr.x, wr.y, wr.z);
      cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), wr.clone().sub(el).normalize());
      this.buildHand(side, wr, wr.clone().sub(el).normalize());
    }
    this.buildDress();
    // Shoulder caps round off where arms meet the torso.
    for (const side of [-1, 1]) mesh(geo('shoulder', () => new THREE.SphereGeometry(0.205, seg(14), seg(10))), m.sleeve, this.group, side * 0.82, 0.86, 0);
    const s = this.spec;
    if (s.accessory === 'pearls') {
      const bead = geo('pearl', () => new THREE.SphereGeometry(0.035, seg(8), seg(6)));
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI * (0.08 + 0.84 * (i / 16));
        mesh(bead, m.white, this.group, -Math.cos(a) * 0.3, 1.12 - Math.sin(a) * 0.1, 0.12 + Math.sin(a) * 0.17);
      }
    }
    if (s.accessory === 'fan') {
      // A folded silk fan held up in the right hand.
      const fan = new THREE.Group();
      const silk = std('#b3352a', 0.6, 0, { side: THREE.DoubleSide });
      m.extra.push(silk);
      mesh(geo('fan', () => new THREE.CircleGeometry(0.42, seg(18), 0, Math.PI)), silk, fan);
      const edge = mesh(geo('fanEdge', () => new THREE.TorusGeometry(0.42, 0.012, seg(4), seg(18), Math.PI)), m.gold, fan);
      edge.position.z = 0.002;
      mesh(geo('fanPin', () => new THREE.SphereGeometry(0.03, seg(8), seg(6))), m.gold, fan);
      fan.position.set(0.5, 0.35, 1.05);
      fan.rotation.set(-0.5, -0.25, -0.45);
      this.group.add(fan);
    }
  }

  /**
   * A hand at rest on the table's rim: a palm, four jointed fingers curling
   * down onto the wood and a thumb along the inner side, continuing the forearm.
   */
  private buildHand(side: number, wrist: THREE.Vector3, dir: THREE.Vector3) {
    const m = this.mats;
    const hand = new THREE.Group();
    hand.position.copy(wrist).addScaledVector(dir, 0.1);
    hand.position.y -= 0.02;
    hand.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(dir.x, 0, dir.z).normalize());
    const palm = mesh(geo('palm', () => new THREE.SphereGeometry(1, seg(16), seg(10))), m.skin, hand, 0, 0, 0.02);
    palm.scale.set(0.12, 0.05, 0.12);
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    // Index to little finger (x across the back of the hand, mirrored for the left), with a slight spread.
    const FINGERS: [number, number][] = [
      [0.07, 0.95],
      [0.024, 1.05],
      [-0.022, 1.0],
      [-0.066, 0.82],
    ];
    for (const [fx, len] of FINGERS) {
      const x = fx * -side;
      const k0 = V(x, 0.005, 0.11);
      const k1 = V(x * 1.08, -0.005, 0.11 + 0.065 * len);
      const k2 = V(x * 1.12, -0.04, 0.11 + 0.11 * len);
      limb(hand, m.skin, k0, k1, 0.022);
      limb(hand, m.skin, k1, k2, 0.02);
      // A knuckle and a nail.
      mesh(geo('knuckle', () => new THREE.SphereGeometry(0.024, seg(8), seg(6))), m.skin, hand, k0.x, k0.y + 0.004, k0.z);
      const nail = mesh(geo('nail', () => new THREE.SphereGeometry(0.015, seg(8), seg(4), 0, Math.PI * 2, 0, Math.PI / 2)), m.nail, hand, k2.x, k2.y + 0.012, k2.z - 0.008);
      nail.scale.set(1, 0.4, 1.3);
    }
    // The thumb, along the inner side and forward.
    const t0 = V(0.09 * side, -0.005, -0.01);
    const t1 = V(0.125 * side, -0.01, 0.06);
    const t2 = V(0.12 * side, -0.025, 0.12);
    limb(hand, m.skin, t0, t1, 0.03);
    limb(hand, m.skin, t1, t2, 0.024);
    this.group.add(hand);
  }

  /**
   * The outfit in relief: collars, lapels with a raised edge, buttons and
   * piping, set just proud of the torso so the painted outfit gains depth.
   */
  private buildDress() {
    const m = this.mats;
    const s = this.spec;
    // A point on the torso's front at an offset across the chest (as the outfit painting measures it) and a height.
    const on = (dx: number, y: number, out = 0.012) => {
      const r = torsoR(y) + out;
      const a = dx / 0.8;
      return new THREE.Vector3(Math.sin(a) * r * TORSO_SX, y, Math.cos(a) * r * TORSO_SZ);
    };
    const edge = (pts: [number, number][], mat: THREE.Material, rad: number, out = 0.012) => {
      // Each run is split into short steps that follow the cloth, so long pieces never sink into the chest.
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1],
          [x1, y1] = pts[i];
        const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.12));
        for (let k = 0; k < n; k++) {
          const a = k / n,
            b = (k + 1) / n;
          limb(this.group, mat, on(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, out), on(x0 + (x1 - x0) * b, y0 + (y1 - y0) * b, out), rad).scale.set(1, 1, 0.6);
        }
      }
    };
    const button = (dx: number, y: number, mat: THREE.Material, r = 0.03) => {
      const b = mesh(geo(`btn${r}`, () => new THREE.CylinderGeometry(r, r, 0.014, seg(14))), mat, this.group);
      b.position.copy(on(dx, y, 0.018));
      b.rotation.x = Math.PI / 2;
      b.rotation.z = 0;
      b.lookAt(b.position.clone().multiplyScalar(2));
      b.rotateX(Math.PI / 2);
    };
    switch (s.outfit) {
      case 'suit':
      case 'blazer': {
        for (const side of [-1, 1]) {
          // Lapel: the raised fold from the collar down to the button stance, and its notch.
          edge([[0.24 * side, 1.2], [0.0, 0.3]], m.lapel, 0.022);
          edge([[0.24 * side, 1.2], [0.5 * side, 0.7]], m.lapel, 0.018);
          // Shirt collar points either side of the knot.
          edge([[0.06 * side, 1.2], [0.15 * side, 1.07]], m.white, 0.02, 0.02);
        }
        for (const y of s.outfit === 'suit' ? [0.18] : [0.1, -0.25]) button(0.02, y, s.outfit === 'suit' ? m.lapel : m.gold);
        break;
      }
      case 'qipao': {
        // A stand collar round the neck, piped in gold, and frog fastenings down the diagonal.
        const col = mesh(geo('stand', () => new THREE.CylinderGeometry(0.205, 0.215, 0.11, seg(20), 1, true)), m.lapel, this.group, 0, 1.24, 0);
        col.scale.set(1, 1, 1);
        mesh(geo('standRim', () => new THREE.TorusGeometry(0.205, 0.008, seg(4), seg(20))), m.gold, this.group, 0, 1.295, 0).rotation.x = Math.PI / 2;
        for (const [x, y] of [[0.18, 0.82], [0.32, 0.62], [0.42, 0.45]] as [number, number][]) {
          edge([[x - 0.05, y], [x + 0.06, y]], m.gold, 0.012, 0.016);
          button(x + 0.065, y, m.gold, 0.016);
        }
        break;
      }
      case 'kimono':
        // The collar bands crossing at the chest.
        edge([[0.2, 1.2], [-0.08, 0.15]], m.white, 0.03);
        edge([[-0.2, 1.2], [0.12, 0.0]], m.white, 0.03, 0.02);
        break;
      case 'sweater': {
        // A ribbed neckline.
        const rib = mesh(geo('rib', () => new THREE.TorusGeometry(0.212, 0.024, seg(8), seg(24))), m.lapel, this.group, 0, 1.165, 0);
        rib.rotation.x = Math.PI / 2;
        break;
      }
      case 'kandura':
        // The tassel at the collar.
        edge([[-0.02, 1.02], [-0.03, 0.6], [-0.02, 0.28]], m.lapel, 0.014);
        break;
    }
    this.buildGarment(on, edge, button);
  }

  /**
   * The named characters' signature pieces (src/cosmetics/cast.ts): a cape,
   * straps, braces, a scarf or a shawl, a turtleneck, and a gold badge.
   */
  private buildGarment(on: (dx: number, y: number, out?: number) => THREE.Vector3, edge: (pts: [number, number][], mat: THREE.Material, rad: number, out?: number) => void, button: (dx: number, y: number, mat: THREE.Material, r?: number) => void) {
    const m = this.mats;
    const s = this.spec;
    const outfit = s.outfitColor || '#1f3b33';
    const cloth = (c: string, rough = 0.75) => {
      const x = std(c, rough);
      m.extra.push(x);
      return x;
    };
    if (s.turtleneck) {
      const roll = mesh(geo('turtle', () => new THREE.CylinderGeometry(0.215, 0.25, 0.2, seg(22), 1, true)), m.lapel, this.group, 0, 1.17, 0);
      roll.scale.set(1, 1, 0.92);
      const lip = mesh(geo('turtleLip', () => new THREE.TorusGeometry(0.215, 0.03, seg(8), seg(24))), m.lapel, this.group, 0, 1.27, 0);
      lip.rotation.x = Math.PI / 2;
      lip.scale.set(1, 0.92, 1);
    }
    /** A flat band of cloth or leather lying on the chest along a path (dx, y), `w` wide. */
    const ribbon = (pts: [number, number][], w: number, mat: THREE.Material, out = 0.02) => {
      const P: [number, number][] = [];
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1],
          [x1, y1] = pts[i];
        const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.04));
        for (let k = i === 1 ? 0 : 1; k <= n; k++) P.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
      }
      const pos: number[] = [],
        idx: number[] = [];
      P.forEach(([x, y], i) => {
        const [ax, ay] = P[Math.max(0, i - 1)],
          [bx, by] = P[Math.min(P.length - 1, i + 1)];
        const l = Math.hypot(bx - ax, by - ay) || 1;
        const nx = -(by - ay) / l,
          ny = (bx - ax) / l;
        // Soft rounded ends.
        const half = (w / 2) * Math.min(1, 0.6 + 0.4 * Math.min(i, P.length - 1 - i));
        for (const sd of [-1, 0, 1]) {
          // The middle row stands a little proud, so the band has a rounded section.
          const v = on(x + nx * half * sd, y + ny * half * sd, out + (sd === 0 ? w * 0.08 : 0));
          pos.push(v.x, v.y, v.z);
        }
        if (i) {
          const a = (i - 1) * 3,
            b = i * 3;
          idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
        }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      const o = mesh(g, mat, this.group);
      o.userData.ownGeometry = true;
      return o;
    };
    switch (s.garment) {
      case 'cape': {
        // A shoulder cape, open at the front, its hem and front edges piped in gold, a gold frog at the throat.
        const GAP = 0.32;
        const prof: [number, number][] = [[0.5, 1.2], [0.74, 1.12], [0.97, 0.97], [1.1, 0.78], [1.15, 0.58], [1.16, 0.46]];
        const cape = new THREE.Group();
        cape.scale.set(1.08, 1, 0.68);
        mesh(geo('cape', () => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg(36), GAP, Math.PI * 2 - GAP * 2)), cloth(shade(outfit, 0.04), 0.7), cape).material.side = THREE.DoubleSide;
        const hem = mesh(geo('capeHem', () => new THREE.TorusGeometry(1.16, 0.022, seg(6), seg(48), Math.PI * 2 - GAP * 2)), m.gold, cape, 0, 0.46, 0);
        hem.rotation.set(Math.PI / 2, 0, Math.PI / 2 + GAP);
        for (const side of [-1, 1]) {
          const a = side * GAP;
          for (let i = 1; i < prof.length; i++) {
            const [r0, y0] = prof[i - 1],
              [r1, y1] = prof[i];
            limb(cape, m.gold, new THREE.Vector3(Math.sin(a) * r0, y0, Math.cos(a) * r0), new THREE.Vector3(Math.sin(a) * r1, y1, Math.cos(a) * r1), 0.02);
          }
        }
        this.group.add(cape);
        // The frog: two knots and a looped bar across the throat.
        const fy = 1.1;
        for (const side of [-1, 1]) button(side * 0.1, fy, m.gold, 0.026);
        edge([[-0.1, fy], [0.1, fy]], m.gold, 0.012, 0.03);
        break;
      }
      case 'straps': {
        // Two tan leather straps across the chest from the left shoulder.
        const tan = cloth('#a8703e', 0.55);
        tan.side = THREE.DoubleSide;
        ribbon([[0.64, 1.0], [0.3, 0.26]], 0.085, tan);
        ribbon([[0.46, 1.08], [0.13, 0.32]], 0.085, tan);
        break;
      }
      case 'suspenders': {
        const leather = cloth('#8a5530', 0.55);
        leather.side = THREE.DoubleSide;
        for (const side of [-1, 1]) {
          ribbon([[0.36 * side, 1.1], [0.33 * side, 0.6], [0.3 * side, -0.6]], 0.08, leather);
          button(0.335 * side, 0.6, m.gold, 0.04);
        }
        break;
      }
      case 'scarf': {
        // A cream silk scarf round the neck, knotted at the front with two falling ends.
        const silk = cloth('#f1e9da', 0.5);
        silk.side = THREE.DoubleSide;
        const ring = mesh(geo('scarfRing', () => new THREE.TorusGeometry(0.23, 0.07, seg(10), seg(26))), silk, this.group, 0, 1.13, 0.02);
        ring.rotation.x = Math.PI / 2 - 0.25;
        ring.scale.set(1.05, 0.95, 1);
        const knot = mesh(geo('scarfKnot', () => new THREE.SphereGeometry(0.075, seg(12), seg(10))), silk, this.group);
        knot.position.copy(on(0.02, 1.05, 0.06));
        ribbon([[0.0, 1.04], [-0.06, 0.75], [-0.03, 0.46]], 0.15, silk, 0.035);
        ribbon([[0.05, 1.04], [0.13, 0.78], [0.17, 0.56]], 0.13, silk, 0.05);
        break;
      }
      case 'shawl': {
        // A draped shawl over one shoulder and across the body, a shade lighter than the robe.
        const drape = cloth(tint(outfit, 0.14), 0.8);
        drape.side = THREE.DoubleSide;
        ribbon([[0.72, 1.02], [0.45, 0.6], [0.0, 0.2], [-0.5, -0.1], [-0.85, -0.25]], 0.42, drape, 0.03);
        break;
      }
    }
    if (s.badge) {
      const at: Record<NonNullable<AvatarSpec['badge']>, [number, number, number]> = { knight: [-0.3, 0.76, 0.22], spade: [0.36, 0.8, 0.17], lotus: [-0.28, 0.7, 0.27] };
      const [dx, y, size] = at[s.badge];
      const tex = badgeTexture(s.badge);
      this.textures.push(tex);
      const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, roughness: 0.35, metalness: 0.55, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.12 });
      m.extra.push(mat);
      const b = mesh(geo('badge', () => new THREE.PlaneGeometry(1, 1)), mat, this.group);
      const p = on(dx, y, s.garment === 'shawl' ? 0.16 : 0.07);
      b.position.copy(p);
      b.scale.setScalar(size);
      b.lookAt(p.clone().add(new THREE.Vector3(p.x / (TORSO_SX * TORSO_SX), 0, p.z / (TORSO_SZ * TORSO_SZ)).normalize()));
    }
  }

  private buildHead() {
    const m = this.mats;
    const h = this.head;
    const at = (y: number) => y - NECK_Y;
    // The head: an egg, a little narrower toward the chin.
    const sp = this.spec;
    // Depth of the face's surface at (x, y) on the head, for setting features into it.
    const nose = sp.nose ?? 'straight';
    const fz = (x: number, y: number) => skinZ(x, y - HEAD_Y, nose);
    const headMesh = mesh(geo(`head:${nose}`, () => headGeometry(nose)), m.face, h, 0, at(HEAD_Y), 0);
    headMesh.scale.set(...(FACE[sp.face ?? 'oval'] ?? FACE.oval));
    for (const side of [-1, 1]) {
      const ear = mesh(geo('ear', () => new THREE.SphereGeometry(0.08, seg(10), seg(8))), m.skinShade, h, side * 0.38, at(HEAD_Y - 0.02), -0.02);
      ear.scale.set(0.5, 1, 0.8);
      // Big, bright eyes: a white, a large painted iris under a glossy cornea, two catchlights,
      // a dark lash line along the upper lid and a soft lid of skin above.
      const eye = new THREE.Group();
      const ey0 = HEAD_Y + EYE_Y;
      eye.position.set(side * EYE_X, at(ey0), fz(side * EYE_X, ey0) - EYE_R * 0.42);
      const EYE: Record<string, [number, number, number]> = { almond: [1.06, 1.0, 0.62], round: [1.0, 1.1, 0.5], narrow: [1.1, 0.84, 0.8], hooded: [1.04, 0.96, 0.72], upturned: [1.06, 1.02, 0.6] };
      const [ex, ey, lidCover] = EYE[sp.eyes ?? 'round'] ?? EYE.round;
      const white = mesh(geo('eyeW', () => new THREE.SphereGeometry(EYE_R, seg(20), seg(14))), m.white, eye);
      white.scale.set(ex, ey, 0.62);
      const front = EYE_R * 0.62;
      const irisDisc = mesh(geo('irisDisc', () => new THREE.CircleGeometry(EYE_R * 0.78, seg(28))), m.ink, eye, 0, -EYE_R * 0.06, front + 0.0006);
      irisDisc.scale.set(1, sp.eyes === 'narrow' ? 0.9 : 1.04, 1);
      const cornea = mesh(geo('cornea', () => new THREE.SphereGeometry(EYE_R * 0.82, seg(18), seg(8), 0, Math.PI * 2, 0, 1.0)), m.cornea, eye, 0, -EYE_R * 0.06, front - EYE_R * 0.55);
      cornea.rotation.x = Math.PI / 2;
      mesh(geo('glint', () => new THREE.SphereGeometry(EYE_R * 0.17, seg(8), seg(6))), m.glint, eye, -side * EYE_R * 0.05 - EYE_R * 0.22, EYE_R * 0.22, front + 0.006).scale.set(1, 1, 0.3);
      mesh(geo('glint2', () => new THREE.SphereGeometry(EYE_R * 0.08, seg(8), seg(6))), m.glint, eye, EYE_R * 0.24, -EYE_R * 0.3, front + 0.005).scale.set(1, 1, 0.3);
      if (sp.eyes === 'upturned') eye.rotation.z = side * 0.12;
      const upper = mesh(geo(`lidU${lidCover}`, () => new THREE.SphereGeometry(EYE_R * 1.05, seg(20), seg(8), 0, Math.PI * 2, 0, lidCover)), m.skin, eye, 0, EYE_R * 0.02, 0);
      upper.scale.set(ex * 1.04, ey * 1.04, 0.68);
      upper.rotation.x = 0.1;
      // The lash line: a bold dark rim along the lid's edge, flicking out at the outer corner.
      const lash = mesh(geo(`lash${lidCover}`, () => new THREE.TorusGeometry(EYE_R * 1.05 * Math.sin(lidCover), EYE_R * 0.085, seg(5), seg(24), Math.PI)), m.lash, upper, 0, EYE_R * 1.05 * Math.cos(lidCover), 0);
      lash.rotation.x = Math.PI / 2;
      const flick = limb(eye, m.lash, new THREE.Vector3(side * EYE_R * 0.95 * ex, EYE_R * 0.42, EYE_R * 0.2), new THREE.Vector3(side * EYE_R * 1.22 * ex, EYE_R * 0.62, EYE_R * 0.05), EYE_R * 0.05);
      flick.scale.set(1, 1, 0.6);
      const lower = mesh(geo('lidL', () => new THREE.SphereGeometry(EYE_R * 1.03, seg(20), seg(6), 0, Math.PI * 2, Math.PI - 0.6, 0.6)), m.skin, eye, 0, 0, 0);
      lower.scale.set(ex * 1.03, ey * 1.02, 0.66);
      h.add(eye);
      this.eyes.push(eye);
    }
    this.buildFacialHair();
    if (this.spec.accessory === 'earrings') {
      const jade = std('#2f7a5c', 0.25, 0.1);
      m.extra.push(jade);
      for (const side of [-1, 1]) {
        limb(h, m.gold, new THREE.Vector3(side * 0.385, at(HEAD_Y - 0.09), -0.01), new THREE.Vector3(side * 0.385, at(HEAD_Y - 0.15), -0.01), 0.008);
        const drop = mesh(geo('jade', () => new THREE.SphereGeometry(0.035, seg(10), seg(8))), jade, h, side * 0.385, at(HEAD_Y - 0.19), -0.01);
        drop.scale.set(0.8, 1.2, 0.8);
      }
    }
  }

  private buildFacialHair() {
    const fh = this.spec.facialHair ?? 'none';
    if (fh === 'none') return;
    const m = this.mats;
    const h = this.head;
    const at = (y: number) => y - NECK_Y;
    const fz = (x: number, y: number) => skinZ(x, y - HEAD_Y, this.spec.nose ?? 'straight');
    if (fh === 'stubble' || fh === 'beard') {
      // A shadow (stubble) or a full shell (beard) over the jaw, below the mouth.
      const mat = fh === 'stubble' ? std(shade(this.spec.hairColor || '#1b1715', 0.1), 0.95, 0, { transparent: true, opacity: 0.28, depthWrite: false }) : m.hair;
      if (mat !== m.hair) m.extra.push(mat);
      const shell = mesh(geo(`jawShell${fh}`, () => new THREE.SphereGeometry(1, seg(24), seg(10), Math.PI * 0.05, Math.PI * 0.9, fh === 'beard' ? 1.95 : 1.9, Math.PI - (fh === 'beard' ? 1.95 : 1.9) - 0.15)), mat, h, 0, at(HEAD_Y), 0);
      shell.scale.set(HEAD_AX * (fh === 'beard' ? 1.06 : 1.01), HEAD_DN * (fh === 'beard' ? 1.08 : 1.01), HEAD_AZ * (fh === 'beard' ? 1.08 : 1.015));
      shell.rotation.y = Math.PI;
    }
    if (fh === 'moustache' || fh === 'beard' || fh === 'goatee') {
      for (const side of [-1, 1]) {
        const mo = limb(h, m.hair, new THREE.Vector3(side * 0.012, at(HEAD_Y - 0.105), fz(0, HEAD_Y - 0.105) + 0.004), new THREE.Vector3(side * 0.085, at(HEAD_Y - 0.13), fz(0.085, HEAD_Y - 0.13) + 0.002), 0.017);
        mo.scale.set(1, 1, 0.7);
      }
    }
    if (fh === 'goatee') {
      const g = mesh(geo('goatee', () => new THREE.SphereGeometry(0.07, seg(12), seg(8))), m.hair, h, 0, at(HEAD_Y - 0.27), fz(0, HEAD_Y - 0.27) - 0.03);
      g.scale.set(0.9, 1.1, 0.6);
    }
  }

  private buildHair(style: AvatarSpec['hair'], color: string) {
    const m = this.mats;
    const h = this.head;
    const at = (y: number) => y - NECK_Y;
    const R = HEAD_R + 0.03;
    const part = this.spec.hairPart ?? 'left';
    const flip = part === 'right' ? -1 : 1;
    if (style === 'shaved' || style === 'buzz') {
      const c = mix(color, SKIN_TONES[this.spec.skin | 0] ?? '#d6a47c', style === 'buzz' ? 0.22 : 0.45);
      m.hair.color.set(c);
      m.hair.emissive.set(c);
    }
    // The crown: a cap over the top of the head, tipped back to show the forehead.
    const close = style === 'shaved' || style === 'buzz';
    const crownTheta = close ? 1.05 : style === 'slicked' ? 1.25 : 1.15;
    const crown = mesh(geo(`crown${crownTheta}:${close}`, () => locks(new THREE.SphereGeometry(1, seg(40), seg(16), 0, Math.PI * 2, 0, crownTheta), close ? 0.004 : 0.04, 22, 0, crownTheta)), m.hair, h, 0, at(HEAD_Y), 0);
    const full = style === 'curly' || style === 'afro' || style === 'sidepart' || style === 'topknot';
    const cr = close ? HEAD_R + 0.008 : full ? R + 0.015 : R;
    const [fx, fy, fzs] = FACE[this.spec.face ?? 'oval'] ?? [1, 1, 1];
    crown.scale.set(cr * 0.95 * fx, cr * 1.1 * fy, cr * 1.02 * fzs);
    // Tipped back to show the forehead, but not so far that the top of the head shows through.
    crown.rotation.x = style === 'slicked' ? -0.2 : -0.26;
    // A full fringe for the styles that wear one, swept to the side of a parting.
    if (style === 'bob' || style === 'long' || style === 'wavy' || style === 'bun' || style === 'ponytail' || style === 'braids') {
      const slant = part === 'centre' ? 0 : 0.2 * flip;
      const bangs = mesh(geo(`bangs${slant}`, () => locks(bangsGeometry(slant), 0.03, 16)), m.hair, h, 0, at(HEAD_Y), 0);
      bangs.scale.set(cr * 0.97 * fx, cr * 1.08 * fy, cr * 1.06 * fzs);
    }
    // The sides and back, open at the face. [lowest theta, gap at the front in radians]
    const skirt: Record<AvatarSpec['hair'], [number, number] | null> = {
      short: [1.75, 2.7],
      shaved: [1.6, 2.9],
      bun: [1.7, 2.6],
      bob: [2.15, 2.0],
      long: [2.25, 1.9],
      wavy: [2.15, 1.95],
      sidepart: [1.75, 2.6],
      slicked: [1.75, 2.7],
      buzz: [1.6, 2.9],
      curly: [1.85, 2.5],
      afro: null,
      ponytail: [1.75, 2.6],
      braids: [2.0, 2.1],
      topknot: [1.7, 2.6],
    };
    const sk = skirt[style];
    if (sk) {
      const [thetaEnd, gap] = sk;
      const g = geo(`skirt${thetaEnd}:${gap}:${close}`, () => locks(new THREE.SphereGeometry(1, seg(40), seg(14), Math.PI / 2 + gap / 2, Math.PI * 2 - gap, 0.7, thetaEnd - 0.7), close ? 0.004 : 0.05, 22, 0.7, thetaEnd));
      const o = mesh(g, m.hair, h, 0, at(HEAD_Y), -0.01);
      const sr = close ? HEAD_R + 0.006 : R;
      o.scale.set(sr * 0.96 * fx, sr * 1.1 * fy, sr * 1.04 * fzs);
    }
    if (style === 'afro') {
      // A full rounded halo, open at the face.
      const halo = mesh(geo('afro', () => locks(new THREE.SphereGeometry(1, seg(40), seg(22), Math.PI / 2 + 1.0, Math.PI * 2 - 2.0, 0, 2.45), 0.06, 30)), m.hair, h, 0, at(HEAD_Y + 0.08), -0.06);
      halo.scale.set(0.66, 0.64, 0.62);
    }
    if (style === 'ponytail') {
      const tail = limb(h, m.hair, new THREE.Vector3(0, at(HEAD_Y + 0.12), -0.44), new THREE.Vector3(0, at(HEAD_Y - 0.45), -0.52), 0.1);
      tail.scale.set(1, 1, 0.85);
      mesh(geo('tie', () => new THREE.TorusGeometry(0.09, 0.025, seg(6), seg(14))), m.wear, h, 0, at(HEAD_Y + 0.1), -0.43).rotation.x = Math.PI / 2;
    }
    if (style === 'braids') {
      const bead = geo('braid', () => new THREE.SphereGeometry(0.06, seg(10), seg(8)));
      for (const side of [-1, 1]) for (let i = 0; i < 7; i++) mesh(bead, m.hair, h, side * (0.36 + i * 0.006), at(HEAD_Y - 0.08 - i * 0.085), 0.0 + (i % 2) * 0.012);
    }
    if (style === 'topknot') mesh(geo('knot', () => new THREE.SphereGeometry(0.13, seg(14), seg(10))), m.hair, h, 0, at(HEAD_Y + 0.5), -0.06);
    if (style === 'long' || style === 'wavy') {
      // Hair falling down the back to the shoulders.
      const back = limb(h, m.hair, new THREE.Vector3(0, at(HEAD_Y + 0.1), -0.2), new THREE.Vector3(0, at(1.0), -0.3), 0.32);
      back.scale.set(1.3, 1, 0.55);
      // Straight, glossy panels falling past the cheeks to the shoulders.
      for (const side of [-1, 1]) {
        const lock = limb(h, m.hair, new THREE.Vector3(side * 0.37, at(HEAD_Y + 0.02), -0.02), new THREE.Vector3(side * 0.44, at(0.98), 0.02), 0.1);
        lock.scale.set(1, 1, 0.55);
      }
    }
    // Whatever sits on top of the head hides the fringe, curls and bun beneath it.
    const hat = this.spec.headwear ?? (this.spec.accessory === 'hat' ? 'fedora' : undefined);
    const covered = !!hat && hat !== 'visor' && hat !== 'beret';
    if (style === 'curly' && !covered) {
      // Tight curls all over the crown.
      const curl = geo('curl', () => new THREE.SphereGeometry(0.075, seg(8), seg(6)));
      for (let ring = 0; ring < 3; ring++) {
        const th = 0.25 + ring * 0.33;
        const count = 6 + ring * 4;
        for (let i = 0; i < count; i++) {
          const ph = (i / count) * Math.PI * 2 + ring;
          const x = Math.sin(th) * Math.sin(ph),
            y = Math.cos(th),
            z = Math.sin(th) * Math.cos(ph);
          if (z > 0.55 && y < 0.75) continue;
          mesh(curl, m.hair, h, x * R * 0.98, at(HEAD_Y) + y * R * 1.1, z * R * 1.0 - 0.03);
        }
      }
    }
    if (style === 'wavy' && !covered) {
      const puff = geo('puff', () => new THREE.SphereGeometry(0.11, seg(10), seg(8)));
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.15 + 0.7 * (i / 8));
        mesh(puff, m.hair, h, -Math.cos(a) * 0.43, at(HEAD_Y + 0.05) + Math.sin(a) * 0.3, -0.1 - Math.sin(a) * 0.08);
      }
    }
    // A round bun on top (the bun style, or hairBun 'top') or high at one side (hairBun 'side'), tied with a band.
    const bun = style === 'bun' ? 'top' : this.spec.hairBun;
    if (bun && hat !== 'beanie' && hat !== 'fedora' && hat !== 'cap') {
      const [bx, by, bz] = bun === 'side' ? [0.3 * flip, HEAD_Y + 0.36, -0.12] : [0, HEAD_Y + 0.47, -0.1];
      const knot = mesh(geo('bunBall', () => locks(new THREE.SphereGeometry(1, seg(22), seg(16)), 0.05, 9)), m.hair, h, bx, at(by), bz);
      knot.scale.setScalar(0.155);
      knot.rotation.set(bun === 'side' ? 0.3 : -0.5, 0, bun === 'side' ? -0.7 * flip : 0);
      const tie = mesh(geo('bunTie', () => new THREE.TorusGeometry(0.1, 0.022, seg(6), seg(18))), m.hair, h, bx * 0.86, at(by - 0.09), bz + 0.02);
      tie.rotation.set(Math.PI / 2 - 0.4, bun === 'side' ? 0.5 * flip : 0, 0);
    }
    if ((style === 'short' || style === 'sidepart') && !covered) {
      // A fringe swept away from the parting; a centre parting splits it.
      const r = style === 'sidepart' ? 0.08 : 0.07;
      if (part === 'centre') {
        for (const side of [-1, 1]) limb(h, m.hair, new THREE.Vector3(side * 0.03, at(HEAD_Y + 0.36), 0.27), new THREE.Vector3(side * 0.27, at(HEAD_Y + 0.26), 0.25), r * 0.9).scale.set(1, 1, 0.7);
      } else {
        const fringe = limb(h, m.hair, new THREE.Vector3(-0.26 * flip, at(HEAD_Y + 0.28), 0.27), new THREE.Vector3(0.2 * flip, at(HEAD_Y + 0.34), 0.29), r);
        fringe.scale.set(1, 1, 0.7);
        if (style === 'sidepart') limb(h, m.hair, new THREE.Vector3(0.2 * flip, at(HEAD_Y + 0.36), 0.22), new THREE.Vector3(0.3 * flip, at(HEAD_Y + 0.22), 0.2), 0.07).scale.set(1, 1, 0.7);
      }
    }
  }

  private buildWear() {
    const s = this.spec;
    const m = this.mats;
    const h = this.head;
    const at = (y: number) => y - NECK_Y;
    if (s.accessory === 'aviators' || s.accessory === 'pixel') {
      this.buildShades(s.accessory);
      return this.buildHeadwear();
    }
    const eye = s.eyewear ?? (s.accessory === 'glasses' ? 'glasses' : null);
    if (eye) {
      const frameMat = eye === 'sunglasses' ? m.frame : m.gold;
      const y0g = at(HEAD_Y + EYE_Y + 0.005);
      const r = eye === 'round' ? EYE_R * 1.42 : EYE_R * 1.32;
      for (const side of [-1, 1]) {
        const x = side * EYE_X * 1.04,
          y = at(HEAD_Y + EYE_Y + 0.005),
          z = faceZ(EYE_X, EYE_Y) + 0.05;
        const rim = mesh(geo(`rim${r}`, () => new THREE.TorusGeometry(r, 0.013, seg(6), seg(24))), frameMat, h, x, y, z);
        if (eye === 'sunglasses') {
          rim.scale.set(1.25, 0.95, 1);
          const lens = mesh(geo(`lens${r}`, () => new THREE.CircleGeometry(r, seg(24))), m.lens, h, x, y, z + 0.002);
          lens.scale.set(1.25, 0.95, 1);
        }
        // Temple arm back to the ear.
        limb(h, frameMat, new THREE.Vector3(side * (x * side + r * (eye === 'sunglasses' ? 1.2 : 0.95)), y + 0.01, z - 0.03), new THREE.Vector3(side * 0.4, y + 0.02, -0.02), 0.009);
      }
      const bz = faceZ(0, EYE_Y + 0.03) + 0.045;
      limb(h, frameMat, new THREE.Vector3(-0.05, y0g + 0.02, bz), new THREE.Vector3(0.05, y0g + 0.02, bz), 0.01);
    }
    this.buildHeadwear();
  }

  /** Gold aviators (teardrop lenses) or pixel shades (a stepped black bar). */
  private buildShades(kind: 'aviators' | 'pixel') {
    const m = this.mats;
    const h = this.head;
    const at = (y: number) => y - NECK_Y;
    const y = at(HEAD_Y + 0.03);
    if (kind === 'aviators') {
      for (const side of [-1, 1]) {
        const x = side * 0.15,
          z = faceZ(0.15, 0.03) + 0.04;
        // Teardrop: wider at the top, drooping toward the cheek.
        const rim = mesh(geo('avRim', () => new THREE.TorusGeometry(0.08, 0.009, seg(6), seg(24))), m.gold, h, x, y - 0.005, z);
        rim.scale.set(1.2, 1.05, 1);
        rim.rotation.z = side * 0.18;
        const lens = mesh(geo('avLens', () => new THREE.CircleGeometry(0.08, seg(24))), m.lens, h, x, y - 0.005, z + 0.002);
        lens.scale.set(1.2, 1.05, 1);
        lens.rotation.z = side * 0.18;
        limb(h, m.gold, new THREE.Vector3(side * 0.245, y + 0.03, z - 0.02), new THREE.Vector3(side * 0.37, y + 0.03, 0.0), 0.007);
      }
      // Double bridge.
      const bz = faceZ(0, 0.05) + 0.035;
      limb(h, m.gold, new THREE.Vector3(-0.06, y + 0.05, bz), new THREE.Vector3(0.06, y + 0.05, bz), 0.007);
      limb(h, m.gold, new THREE.Vector3(-0.055, y + 0.015, bz), new THREE.Vector3(0.055, y + 0.015, bz), 0.006);
      return;
    }
    const px = 0.034;
    const block = geo('pixBlock', () => new THREE.BoxGeometry(px, px, 0.02));
    const black = std('#0c0c0e', 0.5);
    const shine = std('#f4f4f4', 0.4, 0, { emissive: '#ffffff', emissiveIntensity: 0.4 });
    m.extra.push(black, shine);
    const z = faceZ(0, 0.03) + 0.05;
    // Top bar across both eyes, then each lens steps down two rows.
    for (let i = -8; i <= 8; i++) mesh(block, black, h, i * px, y + px * 1.5, z - Math.abs(i) * 0.003);
    for (const side of [-1, 1]) {
      for (let r = 0; r < 3; r++) {
        const cols = r === 2 ? [2, 3, 4, 5] : [1, 2, 3, 4, 5, 6];
        for (const c of cols) {
          const white = r === 0 && (c === 2 || c === 3);
          mesh(block, white ? shine : black, h, side * c * px, y + px * (0.5 - r), z - c * 0.003);
        }
      }
      limb(h, black, new THREE.Vector3(side * 0.27, y + px * 1.5, z - 0.04), new THREE.Vector3(side * 0.37, y + px, 0.0), 0.01);
    }
  }

  private buildHeadwear() {
    const s = this.spec;
    const m = this.mats;
    const h = this.head;
    const at = (y: number) => y - NECK_Y;
    const head = s.headwear ?? (s.accessory === 'hat' ? 'fedora' : null);
    const topY = at(HEAD_Y);
    if (head === 'fedora') {
      const felt = std(luma(s.hairColor || '#000') < 0.25 ? '#2e2823' : '#2a2520', 0.7);
      m.extra.push(felt);
      const hat = new THREE.Group();
      mesh(geo('brim', () => new THREE.CylinderGeometry(0.66, 0.66, 0.035, seg(28))), felt, hat);
      const crownG = geo('fcrown', () => new THREE.CylinderGeometry(0.34, 0.4, 0.28, seg(24), 1, true));
      mesh(crownG, felt, hat, 0, 0.14, 0);
      const band = s.wearColor ? std(s.wearColor, 0.55) : std(shade(GOLD, 0.35), 0.5, 0.4);
      m.extra.push(band);
      mesh(geo('band', () => new THREE.CylinderGeometry(0.405, 0.405, 0.08, seg(24), 1, true)), band, hat, 0, 0.05, 0);
      // A soft rounded top.
      const top = mesh(geo('ftop', () => new THREE.SphereGeometry(0.34, seg(20), seg(8), 0, Math.PI * 2, 0, Math.PI / 2)), felt, hat, 0, 0.28, 0);
      top.scale.set(1, 0.3, 1);
      hat.position.set(0, topY + 0.34, -0.02);
      hat.rotation.x = -0.12;
      h.add(hat);
    } else if (head === 'cap') {
      const cap = new THREE.Group();
      const dome = mesh(geo('capDome', () => new THREE.SphereGeometry(1, seg(24), seg(10), 0, Math.PI * 2, 0, Math.PI / 2)), m.wear, cap);
      dome.scale.set(0.44, 0.36, 0.47);
      const peak = mesh(geo('peak', () => new THREE.CylinderGeometry(0.34, 0.34, 0.025, seg(20), 1, false, -Math.PI / 2, Math.PI)), m.wear, cap, 0, 0.0, 0.28);
      peak.scale.set(1, 1, 0.75);
      peak.rotation.x = 0.12;
      mesh(geo('capBtn', () => new THREE.SphereGeometry(0.035, seg(8), seg(6))), m.wear, cap, 0, 0.36, 0);
      cap.position.set(0, topY + 0.2, 0.0);
      cap.rotation.x = -0.1;
      h.add(cap);
    } else if (head === 'visor') {
      const band = mesh(geo('visorBand', () => new THREE.CylinderGeometry(0.43, 0.43, 0.08, seg(24), 1, true)), m.wear, h, 0, topY + 0.2, 0);
      band.scale.set(0.95, 1, 1.03);
      const peak = mesh(geo('peak', () => new THREE.CylinderGeometry(0.34, 0.34, 0.025, seg(20), 1, false, -Math.PI / 2, Math.PI)), m.wear, h, 0, topY + 0.17, 0.27);
      peak.scale.set(1, 1, 0.8);
      peak.rotation.x = 0.2;
    } else if (head === 'beanie') {
      const knit = mesh(geo('beanie', () => new THREE.SphereGeometry(1, seg(24), seg(10), 0, Math.PI * 2, 0, 1.45)), m.wear, h, 0, topY + 0.06, -0.01);
      knit.scale.set(0.45, 0.5, 0.47);
      const fold = mesh(geo('fold', () => new THREE.TorusGeometry(0.43, 0.06, seg(8), seg(24))), m.wear, h, 0, topY + 0.1, -0.01);
      fold.rotation.x = Math.PI / 2 - 0.12;
      fold.scale.set(0.98, 1.06, 1);
      mesh(geo('pom', () => new THREE.SphereGeometry(0.1, seg(10), seg(8))), m.wear, h, 0, topY + 0.56, -0.03);
    } else if (head === 'beret') {
      const beret = mesh(geo('beret', () => new THREE.SphereGeometry(0.5, seg(22), seg(12))), m.wear, h, 0.08, topY + 0.33, -0.02);
      beret.scale.set(1.05, 0.28, 1.0);
      beret.rotation.z = -0.22;
      mesh(geo('stalk', () => new THREE.CylinderGeometry(0.015, 0.02, 0.06, seg(6))), m.wear, h, 0.1, topY + 0.47, -0.02);
    }
  }

  /**
   * Breathe, blink and look. `look` is a world point to turn toward (the player
   * whose turn it is), or null to look down at one's own tiles.
   */
  update(t: number, dt: number, look: THREE.Vector3 | null) {
    const breathe = Math.sin(t * 1.6 + this.phase);
    this.torso.scale.set(TORSO_SX * (1 + breathe * 0.008), 1 + breathe * 0.006, TORSO_SZ * (1 + breathe * 0.012));
    let yaw = Math.sin(t * 0.23 + this.phase) * 0.06,
      pitch = -0.2;
    if (look) {
      const p = this.group.worldToLocal(SeatFigure.tmp.copy(look));
      p.y -= HEAD_Y;
      yaw = THREE.MathUtils.clamp(Math.atan2(p.x, p.z), -0.75, 0.75);
      pitch = THREE.MathUtils.clamp(Math.atan2(p.y, Math.hypot(p.x, p.z)), -0.35, 0.1);
    }
    const k = 1 - Math.exp(-dt * 3);
    this.yaw += (yaw - this.yaw) * k;
    this.pitch += (pitch - this.pitch) * k;
    // A thank-you nod: two small dips of the head.
    let nod = 0;
    if (this.nodT >= 0) {
      this.nodT += dt;
      nod = Math.max(0, Math.sin((this.nodT / 0.9) * Math.PI * 2)) * 0.28;
      if (this.nodT > 0.9) this.nodT = -1;
    }
    this.head.rotation.set(-this.pitch + nod, this.yaw, Math.sin(t * 0.31 + this.phase) * 0.025, 'YXZ');
    // Blink now and then.
    this.nextBlink -= dt;
    const closed = this.nextBlink < 0 && this.nextBlink > -0.13;
    if (this.nextBlink < -0.13) this.nextBlink = 2.5 + Math.random() * 4;
    for (const e of this.eyes) e.scale.y = closed ? 0.12 : 1;
  }

  /** Nod thanks (for a cup of tea). */
  nod() {
    this.nodT = 0;
  }

  dispose() {
    this.group.removeFromParent();
    const mats = new Set<THREE.Material>(this.mats.extra);
    this.group.traverse((o) => {
      const mm = (o as THREE.Mesh).material;
      if (mm) for (const x of Array.isArray(mm) ? mm : [mm]) mats.add(x);
    });
    for (const mat of mats) mat.dispose();
    for (const t of this.textures) t.dispose();
    this.group.traverse((o) => o.userData.ownGeometry && (o as THREE.Mesh).geometry.dispose());
  }
}

// ------------------------------------------------------------ portraits

let portraitRenderer: THREE.WebGLRenderer | null = null;
let portraitIdle = 0;
const portraitCache = new Map<string, string>();

/** Lights for a portrait: a warm key from above left, a cool fill and a rim behind. */
function portraitScene() {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#f4e6cc', '#1a1410', 0.9));
  const key = new THREE.DirectionalLight('#ffe9c8', 2.2);
  key.position.set(-1.5, 3, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#bcd2ff', 0.6);
  fill.position.set(2, 1, 2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#ffd9a0', 1.4);
  rim.position.set(0, 2.5, -3);
  scene.add(rim);
  return scene;
}

/**
 * A round head-and-shoulders portrait of the 3D figure as a PNG data URL, with
 * the same background and frame ring as the flat avatar. Cached per look.
 * Returns null where WebGL is unavailable (callers fall back to the flat SVG).
 */
export function avatarPortraitUrl(spec: AvatarSpec, size = 96): string | null {
  const key = `${size}|${JSON.stringify(spec)}`;
  const hit = portraitCache.get(key);
  if (hit) return hit;
  try {
    if (!portraitRenderer) {
      portraitRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      portraitRenderer.outputColorSpace = THREE.SRGBColorSpace;
      portraitRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      portraitRenderer.toneMappingExposure = 1.05;
    }
    // Match the screen's pixel density (at least 2x), and render at twice that to downsample cleanly.
    const px = Math.min(1440, Math.round(size * Math.max(2, Math.min(3, window.devicePixelRatio || 1))));
    const rp = Math.min(2048, px * 2);
    portraitRenderer.setPixelRatio(1);
    portraitRenderer.setSize(rp, rp, false);
    portraitRenderer.setClearColor(0x000000, 0);
    const scene = portraitScene();
    const fig = new SeatFigure(spec);
    scene.add(fig.group);
    fig.update(0, 1, null);
    // Face the camera squarely for the portrait.
    (fig as unknown as { head: THREE.Group }).head.rotation.set(0.05, 0, 0);
    // Close on the face: the big head and a hint of the outfit's collar.
    const cam = new THREE.PerspectiveCamera(22, 1, 0.1, 50);
    cam.position.set(0, HEAD_AT + 0.1, 4.7);
    cam.lookAt(0, HEAD_AT - 0.04, 0);
    portraitRenderer.render(scene, cam);

    const out = document.createElement('canvas');
    out.width = out.height = px;
    const g = out.getContext('2d')!;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    const frame = FRAMES[spec.frame];
    const C = px / 2;
    // Room outside the ring for the Master's crown, the laurel and the season stone.
    const R = (frame ? (spec.frame === 'frame-master' || spec.frame === 'frame-champion' || spec.frame.startsWith('frame-season-') ? 0.395 : 0.42) : 0.47) * px;
    const outfit = spec.outfitColor || '#1f3b33';
    const bg = g.createRadialGradient(C, px * 0.38, 0, C, px * 0.38, px * 0.7);
    bg.addColorStop(0, tint(mix(outfit, '#1a1c1b', 0.82), 0.12));
    bg.addColorStop(1, mix(outfit, '#0b0c0c', 0.9));
    g.save();
    g.beginPath();
    g.arc(C, C, R, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = bg;
    g.fillRect(0, 0, px, px);
    g.drawImage(portraitRenderer.domElement, 0, 0, px, px);
    g.restore();
    if (frame) {
      // The frame as a piece of jewellery (frameArt.ts).
      drawJewelFrame(g, spec.frame, frame, C, R, px);
    } else {
      g.strokeStyle = 'rgba(255,255,255,0.12)';
      g.lineWidth = px * 0.008;
      g.beginPath();
      g.arc(C, C, R - px * 0.004, 0, Math.PI * 2);
      g.stroke();
    }
    fig.dispose();
    const url = out.toDataURL('image/png');
    portraitCache.set(key, url);
    // Free the extra GL context once portraits stop being asked for.
    window.clearTimeout(portraitIdle);
    portraitIdle = window.setTimeout(() => {
      portraitRenderer?.dispose();
      portraitRenderer?.forceContextLoss();
      portraitRenderer = null;
    }, 8000);
    return url;
  } catch {
    return null;
  }
}
