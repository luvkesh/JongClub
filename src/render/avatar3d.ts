// Players as real 3D figures seated at the table: head, face, hair, outfit,
// arms resting on the rim, and whatever they wear (glasses, sunglasses, caps,
// hats, earrings, pearls, a fan). Built from a few primitives with shared
// materials so three figures stay cheap on phones. The same model renders the
// round portraits on the seat plates. Purely cosmetic.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SKIN_TONES, type AvatarSpec } from '../cosmetics/catalog';
import { FRAMES, luma, mix, shade, tint } from '../cosmetics/avatar';

const GOLD = '#c8a46a';
const UP = new THREE.Vector3(0, 1, 0);

/** Head centre in figure space (feet at the floor far below; y 0 is the table top). */
const HEAD_Y = 1.78;
const HEAD_R = 0.42;
/** Where the head pivots (top of the neck). */
const NECK_Y = 1.32;

/** Head scale per face shape (x, y, z); the hair scales with it so the crown always covers. */
const FACE: Record<string, [number, number, number]> = { oval: [1, 1, 1], round: [1.07, 0.95, 1.02], long: [0.94, 1.08, 1], square: [1.08, 0.98, 1.03], heart: [1.03, 1.04, 0.99] };

/** Head ellipsoid radii (x, upper y, lower y, z); the lower half tapers toward the chin. */
const HEAD_AX = HEAD_R * 0.9,
  HEAD_UP = HEAD_R * 1.1,
  HEAD_DN = HEAD_R * 1.12,
  HEAD_AZ = HEAD_R * 0.98;

function headGeometry() {
  const g = new THREE.SphereGeometry(1, 28, 20);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    // Narrow the jaw: the lower the point, the narrower the head.
    const taper = y < 0 ? 1 - 0.22 * y * y : 1;
    p.setXYZ(i, p.getX(i) * HEAD_AX * taper, y * (y < 0 ? HEAD_DN : HEAD_UP), p.getZ(i) * HEAD_AZ * (y < 0 ? 1 - 0.08 * y * y : 1));
  }
  g.computeVertexNormals();
  return g;
}

/** z of the face's surface at (x, dy) where dy is height above the head centre. */
function faceZ(x: number, dy: number) {
  const ny = dy / (dy < 0 ? HEAD_DN : HEAD_UP);
  const taper = ny < 0 ? 1 - 0.22 * ny * ny : 1;
  const nx = x / (HEAD_AX * taper);
  const k = Math.max(0, 1 - ny * ny - nx * nx);
  return Math.sqrt(k) * HEAD_AZ * (ny < 0 ? 1 - 0.08 * ny * ny : 1);
}

/** Torso outline (radius, height) turned on a lathe; flattened front to back afterwards. */
const TORSO: [number, number][] = [
  [0.58, -1.1],
  [0.6, -0.7],
  [0.64, -0.3],
  [0.7, 0.1],
  [0.78, 0.45],
  [0.86, 0.75],
  [0.84, 0.95],
  [0.66, 1.08],
  [0.36, 1.16],
  [0.14, 1.2],
  [0.0, 1.22],
];
const TORSO_SX = 1.15;
const TORSO_SZ = 0.62;

interface Mats {
  skin: THREE.MeshStandardMaterial;
  skinShade: THREE.MeshStandardMaterial;
  hair: THREE.MeshStandardMaterial;
  outfit: THREE.MeshStandardMaterial;
  sleeve: THREE.MeshStandardMaterial;
  ink: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
  lip: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  wear: THREE.MeshStandardMaterial;
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
  const g = geo(`cap${r.toFixed(3)}:${len.toFixed(2)}`, () => new THREE.CapsuleGeometry(r, len, 4, 10));
  const o = mesh(g, m, parent);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
  return o;
}

/** Figures sit beyond the lamp's pool of light, so each part glows faintly in its own colour to stay readable. */
const std = (color: string, roughness = 0.7, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive: color, emissiveIntensity: metalness > 0.5 ? 0.05 : 0.14, ...extra });

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
let strandTex: THREE.CanvasTexture | null = null;
/** Fine light and dark strands (white-based, so it multiplies the hair colour). Shared by every figure. */
function hairTexture() {
  if (strandTex) return strandTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d8d8d8';
  g.fillRect(0, 0, 128, 128);
  let n = 7;
  const rnd = () => ((n = (n * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * 128;
    const v = Math.round(150 + rnd() * 105);
    g.strokeStyle = `rgb(${v},${v},${v})`;
    g.globalAlpha = 0.55;
    g.lineWidth = 0.6 + rnd() * 1.1;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + (rnd() - 0.5) * 10, 40, x + (rnd() - 0.5) * 10, 90, x + (rnd() - 0.5) * 6, 128);
    g.stroke();
  }
  strandTex = new THREE.CanvasTexture(c);
  strandTex.colorSpace = THREE.SRGBColorSpace;
  strandTex.wrapS = strandTex.wrapT = THREE.RepeatWrapping;
  strandTex.repeat.set(3, 1);
  return strandTex;
}

function outfitTexture(spec: AvatarSpec, outfit: string, skin: string) {
  const W = 512,
    H = 256;
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
        g.arc(X(0.02), Y(y), 3.5, 0, Math.PI * 2);
        g.fillStyle = GOLD;
        g.fill();
      }
      break;
    case 'qipao':
      // Mandarin collar band and a diagonal closure piped in gold.
      g.fillStyle = shade(outfit, 0.1);
      g.fillRect(0, Y(top), W, Y(1.0) - Y(top));
      line([[-2.6, 1.0], [2.6, 1.0]], GOLD, 3);
      line([[0, 1.0], [0.25, 0.75], [0.45, 0.4]], GOLD, 3.5);
      for (const [x, y] of [[0.18, 0.82], [0.32, 0.62], [0.42, 0.45]] as [number, number][]) line([[x - 0.05, y], [x + 0.06, y]], GOLD, 4);
      g.globalAlpha = 0.3;
      for (const [x, y] of [[-0.45, 0.2], [0.55, -0.3], [-0.2, -0.6], [1.6, 0.4], [-1.5, -0.2]] as [number, number][]) {
        g.beginPath();
        g.ellipse(X(x), Y(y), 9, 6, 0.5, 0, Math.PI * 2);
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
      g.fillRect(0, Y(-0.22), W, 4);
      break;
    case 'kandura': {
      const trim = luma(outfit) > 0.7 ? '#c9a24a' : outfit;
      line([[-0.18, 1.15], [0, 1.05], [0.18, 1.15]], shade('#f2efe8', 0.22), 3);
      line([[0, 1.05], [0, 0.4]], shade('#f2efe8', 0.16), 2.5);
      line([[0, 1.02], [-0.03, 0.6], [-0.02, 0.25]], trim, 4);
      g.beginPath();
      g.arc(X(-0.02), Y(0.22), 5, 0, Math.PI * 2);
      g.fillStyle = trim;
      g.fill();
      break;
    }
    case 'sweater':
      line([[-0.22, 1.16], [0, 0.95], [0.22, 1.16]], shade(outfit, 0.22), 9);
      poly([[-0.14, 1.12], [0.14, 1.12], [0.06, 1.0], [0, 1.04], [-0.06, 1.0]], '#efe9dc');
      g.globalAlpha = 0.16;
      for (let x = 0; x < W; x += 9) {
        g.fillStyle = shade(outfit, 0.4);
        g.fillRect(x, Y(-0.85), 3, Y(-1.1) - Y(-0.85));
      }
      g.globalAlpha = 1;
      break;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
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
      skin: std(skin, 0.62),
      skinShade: std(shade(skin, 0.1), 0.65),
      // Matte, with fine strands: a glossy cap caught the key light and read as a bald patch.
      hair: std(shade(hair, 0.05), 0.92, 0, { side: THREE.DoubleSide, emissiveIntensity: 0.1 }),
      outfit: std('#ffffff', 0.78),
      sleeve: std(shade(sleeve, 0.08), 0.8),
      ink: std(shade(skin, 0.82), 0.3),
      white: std('#f4f1ea', 0.35),
      lip: std(mix(skin, '#9c4a43', 0.5), 0.55),
      gold: std(GOLD, 0.32, 0.9),
      wear: std(wear, 0.75, 0, { side: THREE.DoubleSide }),
      lens: std('#0b0d10', 0.08, 0.6, { transparent: true, opacity: 0.92 }),
      frame: std('#121212', 0.4, 0.3),
      extra: [],
    };
    const tex = outfitTexture(spec, outfit, skin);
    this.textures.push(tex);
    if (spec.hair !== 'shaved' && spec.hair !== 'buzz') {
      const strands = hairTexture();
      this.mats.hair.map = strands;
      this.mats.hair.emissiveMap = strands;
    }
    const iris = spec.eyeColor || '';
    if (iris) this.mats.ink.color.set(iris), this.mats.ink.emissive.set(iris);
    this.mats.outfit.map = tex;
    this.mats.outfit.emissiveMap = tex;

    this.buildBody();
    this.buildHead();
    this.buildHair(spec.hair, hair);
    this.buildWear();
    this.group.add(this.head);
    this.head.position.set(0, NECK_Y, 0);
    // Few draw calls: everything that never moves on its own is merged per material.
    mergeStatic(this.group, new Set<THREE.Object3D>([this.head, this.torso]));
    mergeStatic(this.head, new Set<THREE.Object3D>(this.eyes));
  }

  private buildBody() {
    const m = this.mats;
    const lathe = geo('torso', () => new THREE.LatheGeometry(TORSO.map(([r, y]) => new THREE.Vector2(r, y)), 28, Math.PI, Math.PI * 2));
    this.torso = mesh(lathe, m.outfit, this.group);
    this.torso.scale.set(TORSO_SX, 1, TORSO_SZ);
    // Neck.
    mesh(geo('neck', () => new THREE.CylinderGeometry(0.14, 0.16, 0.42, 14)), m.skinShade, this.group, 0, 1.3, 0);
    // Arms: upper arm down from the shoulder, forearm forward onto the rim, a hand at rest.
    for (const side of [-1, 1]) {
      const sh = new THREE.Vector3(side * 0.86, 0.86, 0);
      const el = new THREE.Vector3(side * 1.0, 0.12, 0.3);
      const wr = new THREE.Vector3(side * 0.52, 0.12, 1.0);
      limb(this.group, m.sleeve, sh, el, 0.2);
      limb(this.group, m.sleeve, el, wr, 0.17);
      // A sliver of shirt cuff under a jacket sleeve.
      if (this.spec.outfit === 'suit' || this.spec.outfit === 'blazer') limb(this.group, m.white, wr.clone().lerp(el, 0.02), wr.clone().lerp(el, -0.03), 0.15);
      const hand = mesh(geo('hand', () => new THREE.SphereGeometry(0.16, 14, 10)), m.skin, this.group, side * 0.46, 0.12, 1.16);
      hand.scale.set(0.95, 0.62, 1.25);
      hand.rotation.y = side * 0.5;
    }
    // Shoulder caps round off where arms meet the torso.
    for (const side of [-1, 1]) mesh(geo('shoulder', () => new THREE.SphereGeometry(0.205, 14, 10)), m.sleeve, this.group, side * 0.82, 0.86, 0);
    const s = this.spec;
    if (s.accessory === 'pearls') {
      const bead = geo('pearl', () => new THREE.SphereGeometry(0.035, 8, 6));
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
      mesh(geo('fan', () => new THREE.CircleGeometry(0.42, 18, 0, Math.PI)), silk, fan);
      const edge = mesh(geo('fanEdge', () => new THREE.TorusGeometry(0.42, 0.012, 4, 18, Math.PI)), m.gold, fan);
      edge.position.z = 0.002;
      mesh(geo('fanPin', () => new THREE.SphereGeometry(0.03, 8, 6)), m.gold, fan);
      fan.position.set(0.5, 0.35, 1.05);
      fan.rotation.set(-0.5, -0.25, -0.45);
      this.group.add(fan);
    }
  }

  private buildHead() {
    const m = this.mats;
    const h = this.head;
    const at = (y: number) => y - NECK_Y;
    // The head: an egg, a little narrower toward the chin.
    const sp = this.spec;
    // Depth of the face's surface at (x, y) on the head, for setting features into it.
    const fz = (x: number, y: number) => faceZ(x, y - HEAD_Y);
    const headMesh = mesh(geo('head', () => headGeometry()), m.skin, h, 0, at(HEAD_Y), 0);
    headMesh.scale.set(...(FACE[sp.face ?? 'oval'] ?? FACE.oval));
    for (const side of [-1, 1]) {
      const ear = mesh(geo('ear', () => new THREE.SphereGeometry(0.08, 10, 8)), m.skinShade, h, side * 0.38, at(HEAD_Y - 0.02), -0.02);
      ear.scale.set(0.5, 1, 0.8);
      // Eyes: a white with a dark iris, set into the face.
      const eye = new THREE.Group();
      eye.position.set(side * 0.145, at(HEAD_Y + 0.03), fz(side * 0.145, HEAD_Y + 0.03) - 0.025);
      const white = mesh(geo('eyeW', () => new THREE.SphereGeometry(0.058, 12, 8)), m.white, eye);
      const EYE: Record<string, [number, number]> = { almond: [1.15, 0.85], round: [1.05, 1.02], narrow: [1.22, 0.6], hooded: [1.15, 0.78], upturned: [1.18, 0.8] };
      const [ex, ey] = EYE[sp.eyes ?? 'almond'] ?? EYE.almond;
      white.scale.set(ex, ey, 0.55);
      const irisMesh = mesh(geo('iris', () => new THREE.SphereGeometry(0.036, 10, 8)), m.ink, eye, 0, -0.004, 0.026);
      if (sp.eyes === 'narrow') irisMesh.scale.set(1, 0.78, 1);
      if (sp.eyes === 'upturned') eye.rotation.z = side * 0.2;
      if (sp.eyes === 'hooded' || sp.eyes === 'narrow') {
        // A soft upper lid in the skin's shade.
        const lid = mesh(geo('lid', () => new THREE.SphereGeometry(0.062, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)), m.skinShade, eye, 0, sp.eyes === 'narrow' ? 0.006 : 0.012, 0.004);
        lid.scale.set(ex * 1.05, 0.55, 0.62);
      }
      h.add(eye);
      this.eyes.push(eye);
      // Brows in the hair colour.
      const bs = sp.brows ?? 'soft';
      const br = bs === 'thick' ? 0.023 : bs === 'straight' ? 0.017 : 0.016;
      const inner = new THREE.Vector3(side * 0.08, at(HEAD_Y + 0.135), fz(0.08, HEAD_Y + 0.135) + 0.005);
      const outer = new THREE.Vector3(side * 0.22, at(HEAD_Y + (bs === 'straight' ? 0.135 : 0.12)), fz(0.22, HEAD_Y + 0.12) + 0.005);
      if (bs === 'arched') {
        const peak = new THREE.Vector3(side * 0.165, at(HEAD_Y + 0.158), fz(0.165, HEAD_Y + 0.158) + 0.005);
        limb(h, m.hair, inner, peak, br).scale.set(1, 1, 0.6);
        limb(h, m.hair, peak, outer, br).scale.set(1, 1, 0.6);
      } else limb(h, m.hair, inner, outer, br).scale.set(1, 1, 0.6);
      // A touch of warmth on the cheeks.
      if (this.spec.skin < 4) {
        const blush = std('#e07a6a', 0.8, 0, { transparent: true, opacity: 0.18, depthWrite: false });
        m.extra.push(blush);
        const ch = mesh(geo('cheek', () => new THREE.CircleGeometry(0.06, 12)), blush, h, side * 0.2, at(HEAD_Y - 0.1), fz(0.2, HEAD_Y - 0.1) + 0.006);
        ch.rotation.y = side * 0.5;
      }
    }
    const nose = mesh(geo('nose', () => new THREE.SphereGeometry(0.05, 10, 8)), m.skinShade, h, 0, at(HEAD_Y - 0.06), fz(0, HEAD_Y - 0.06) - 0.015);
    const NOSE: Record<string, [number, number, number]> = { button: [0.72, 0.85, 0.8], straight: [0.8, 1.1, 0.9], broad: [1.2, 1.0, 0.92], aquiline: [0.74, 1.35, 1.18] };
    nose.scale.set(...(NOSE[sp.nose ?? 'straight'] ?? NOSE.straight));
    if (sp.nose === 'broad') for (const side of [-1, 1]) mesh(geo('nostril', () => new THREE.SphereGeometry(0.028, 8, 6)), m.skinShade, h, side * 0.045, at(HEAD_Y - 0.085), fz(side * 0.045, HEAD_Y - 0.085) - 0.004);
    // A gentle smile: the lower half of a thin ring.
    const mouth = mesh(geo('mouth', () => new THREE.TorusGeometry(0.07, 0.013, 6, 14, Math.PI)), m.lip, h, 0, at(HEAD_Y - 0.14), fz(0, HEAD_Y - 0.18) - 0.004);
    mouth.rotation.set(0.35, 0, Math.PI);
    mouth.scale.set(sp.lips === 'full' ? 1.08 : 1, sp.lips === 'thin' ? 0.4 : 0.55, 1);
    if (sp.lips === 'full') {
      const lower = mesh(geo('lowerLip', () => new THREE.SphereGeometry(0.05, 12, 8)), m.lip, h, 0, at(HEAD_Y - 0.17), fz(0, HEAD_Y - 0.17) - 0.012);
      lower.scale.set(1.2, 0.42, 0.55);
    }
    this.buildFacialHair();
    if (this.spec.accessory === 'earrings') {
      const jade = std('#2f7a5c', 0.25, 0.1);
      m.extra.push(jade);
      for (const side of [-1, 1]) {
        limb(h, m.gold, new THREE.Vector3(side * 0.385, at(HEAD_Y - 0.09), -0.01), new THREE.Vector3(side * 0.385, at(HEAD_Y - 0.15), -0.01), 0.008);
        const drop = mesh(geo('jade', () => new THREE.SphereGeometry(0.035, 10, 8)), jade, h, side * 0.385, at(HEAD_Y - 0.19), -0.01);
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
    const fz = (x: number, y: number) => faceZ(x, y - HEAD_Y);
    if (fh === 'stubble' || fh === 'beard') {
      // A shadow (stubble) or a full shell (beard) over the jaw, below the mouth.
      const mat = fh === 'stubble' ? std(shade(this.spec.hairColor || '#1b1715', 0.1), 0.95, 0, { transparent: true, opacity: 0.28, depthWrite: false }) : m.hair;
      if (mat !== m.hair) m.extra.push(mat);
      const shell = mesh(geo(`jawShell${fh}`, () => new THREE.SphereGeometry(1, 24, 10, Math.PI * 0.05, Math.PI * 0.9, fh === 'beard' ? 1.95 : 1.9, Math.PI - (fh === 'beard' ? 1.95 : 1.9) - 0.15)), mat, h, 0, at(HEAD_Y), 0);
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
      const g = mesh(geo('goatee', () => new THREE.SphereGeometry(0.07, 12, 8)), m.hair, h, 0, at(HEAD_Y - 0.27), fz(0, HEAD_Y - 0.27) - 0.03);
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
    const crown = mesh(geo(`crown${crownTheta}`, () => new THREE.SphereGeometry(1, 26, 12, 0, Math.PI * 2, 0, crownTheta)), m.hair, h, 0, at(HEAD_Y), 0);
    const full = style === 'curly' || style === 'afro' || style === 'sidepart' || style === 'topknot';
    const cr = close ? HEAD_R + 0.008 : full ? R + 0.015 : R;
    const [fx, fy, fzs] = FACE[this.spec.face ?? 'oval'] ?? [1, 1, 1];
    crown.scale.set(cr * 0.95 * fx, cr * 1.1 * fy, cr * 1.02 * fzs);
    // Tipped back to show the forehead, but not so far that the top of the head shows through.
    crown.rotation.x = style === 'slicked' ? -0.2 : -0.26;
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
      const g = geo(`skirt${thetaEnd}:${gap}`, () => new THREE.SphereGeometry(1, 26, 10, Math.PI / 2 + gap / 2, Math.PI * 2 - gap, 0.7, thetaEnd - 0.7));
      const o = mesh(g, m.hair, h, 0, at(HEAD_Y), -0.01);
      const sr = close ? HEAD_R + 0.006 : R;
      o.scale.set(sr * 0.96 * fx, sr * 1.1 * fy, sr * 1.04 * fzs);
    }
    if (style === 'afro') {
      // A full rounded halo, open at the face.
      const halo = mesh(geo('afro', () => new THREE.SphereGeometry(1, 28, 16, Math.PI / 2 + 1.0, Math.PI * 2 - 2.0, 0, 2.45)), m.hair, h, 0, at(HEAD_Y + 0.08), -0.06);
      halo.scale.set(0.66, 0.64, 0.62);
    }
    if (style === 'ponytail') {
      const tail = limb(h, m.hair, new THREE.Vector3(0, at(HEAD_Y + 0.12), -0.44), new THREE.Vector3(0, at(HEAD_Y - 0.45), -0.52), 0.1);
      tail.scale.set(1, 1, 0.85);
      mesh(geo('tie', () => new THREE.TorusGeometry(0.09, 0.025, 6, 14)), m.wear, h, 0, at(HEAD_Y + 0.1), -0.43).rotation.x = Math.PI / 2;
    }
    if (style === 'braids') {
      const bead = geo('braid', () => new THREE.SphereGeometry(0.06, 10, 8));
      for (const side of [-1, 1]) for (let i = 0; i < 7; i++) mesh(bead, m.hair, h, side * (0.36 + i * 0.006), at(HEAD_Y - 0.08 - i * 0.085), 0.0 + (i % 2) * 0.012);
    }
    if (style === 'topknot') mesh(geo('knot', () => new THREE.SphereGeometry(0.13, 14, 10)), m.hair, h, 0, at(HEAD_Y + 0.5), -0.06);
    if (style === 'long' || style === 'wavy') {
      // Hair falling down the back to the shoulders.
      const back = limb(h, m.hair, new THREE.Vector3(0, at(HEAD_Y + 0.1), -0.2), new THREE.Vector3(0, at(1.15), -0.3), 0.3);
      back.scale.set(1.25, 1, 0.55);
      for (const side of [-1, 1]) {
        const lock = limb(h, m.hair, new THREE.Vector3(side * 0.36, at(HEAD_Y - 0.05), 0.02), new THREE.Vector3(side * 0.42, at(1.15), 0.05), 0.075);
        lock.scale.set(1, 1, 0.8);
      }
    }
    // Whatever sits on top of the head hides the fringe, curls and bun beneath it.
    const hat = this.spec.headwear ?? (this.spec.accessory === 'hat' ? 'fedora' : undefined);
    const covered = !!hat && hat !== 'visor' && hat !== 'beret';
    if (style === 'curly' && !covered) {
      // Tight curls all over the crown.
      const curl = geo('curl', () => new THREE.SphereGeometry(0.075, 8, 6));
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
      const puff = geo('puff', () => new THREE.SphereGeometry(0.11, 10, 8));
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.15 + 0.7 * (i / 8));
        mesh(puff, m.hair, h, -Math.cos(a) * 0.43, at(HEAD_Y + 0.05) + Math.sin(a) * 0.3, -0.1 - Math.sin(a) * 0.08);
      }
    }
    if (style === 'bun' && hat !== 'beanie' && hat !== 'fedora') {
      mesh(geo('bun', () => new THREE.SphereGeometry(0.17, 14, 10)), m.hair, h, 0, at(HEAD_Y + 0.42), -0.18);
    }
    if ((style === 'bob' || style === 'short' || style === 'sidepart') && !covered) {
      // A fringe swept away from the parting; a centre parting splits it.
      const r = style === 'bob' ? 0.085 : style === 'sidepart' ? 0.08 : 0.07;
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
      const r = eye === 'round' ? 0.085 : 0.078;
      for (const side of [-1, 1]) {
        const x = side * 0.145,
          y = at(HEAD_Y + 0.03),
          z = faceZ(0.145, 0.03) + 0.035;
        const rim = mesh(geo(`rim${r}`, () => new THREE.TorusGeometry(r, 0.011, 6, 20)), frameMat, h, x, y, z);
        if (eye === 'sunglasses') {
          rim.scale.set(1.25, 0.95, 1);
          const lens = mesh(geo('lens', () => new THREE.CircleGeometry(0.078, 20)), m.lens, h, x, y, z + 0.002);
          lens.scale.set(1.25, 0.95, 1);
        }
        // Temple arm back to the ear.
        limb(h, frameMat, new THREE.Vector3(side * (eye === 'sunglasses' ? 0.245 : 0.225), y + 0.01, z - 0.02), new THREE.Vector3(side * 0.37, y + 0.02, 0.0), 0.008);
      }
      const bz = faceZ(0, 0.045) + 0.03;
      limb(h, frameMat, new THREE.Vector3(-0.055, at(HEAD_Y + 0.045), bz), new THREE.Vector3(0.055, at(HEAD_Y + 0.045), bz), 0.009);
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
        const rim = mesh(geo('avRim', () => new THREE.TorusGeometry(0.08, 0.009, 6, 24)), m.gold, h, x, y - 0.005, z);
        rim.scale.set(1.2, 1.05, 1);
        rim.rotation.z = side * 0.18;
        const lens = mesh(geo('avLens', () => new THREE.CircleGeometry(0.08, 24)), m.lens, h, x, y - 0.005, z + 0.002);
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
      mesh(geo('brim', () => new THREE.CylinderGeometry(0.66, 0.66, 0.035, 28)), felt, hat);
      const crownG = geo('fcrown', () => new THREE.CylinderGeometry(0.33, 0.4, 0.36, 24));
      mesh(crownG, felt, hat, 0, 0.18, 0);
      mesh(geo('band', () => new THREE.CylinderGeometry(0.405, 0.405, 0.07, 24, 1, true)), std(shade(GOLD, 0.35), 0.5, 0.4), hat, 0, 0.05, 0);
      // The pinch on top.
      const dent = mesh(geo('dent', () => new THREE.SphereGeometry(0.2, 12, 8)), std(shade('#2a2520', 0.3), 0.7), hat, 0, 0.33, 0);
      dent.scale.set(1, 0.25, 1.4);
      hat.position.set(0, topY + 0.34, -0.02);
      hat.rotation.x = -0.12;
      h.add(hat);
    } else if (head === 'cap') {
      const cap = new THREE.Group();
      const dome = mesh(geo('capDome', () => new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2)), m.wear, cap);
      dome.scale.set(0.44, 0.36, 0.47);
      const peak = mesh(geo('peak', () => new THREE.CylinderGeometry(0.34, 0.34, 0.025, 20, 1, false, -Math.PI / 2, Math.PI)), m.wear, cap, 0, 0.0, 0.28);
      peak.scale.set(1, 1, 0.75);
      peak.rotation.x = 0.12;
      mesh(geo('capBtn', () => new THREE.SphereGeometry(0.035, 8, 6)), m.wear, cap, 0, 0.36, 0);
      cap.position.set(0, topY + 0.2, 0.0);
      cap.rotation.x = -0.1;
      h.add(cap);
    } else if (head === 'visor') {
      const band = mesh(geo('visorBand', () => new THREE.CylinderGeometry(0.43, 0.43, 0.08, 24, 1, true)), m.wear, h, 0, topY + 0.2, 0);
      band.scale.set(0.95, 1, 1.03);
      const peak = mesh(geo('peak', () => new THREE.CylinderGeometry(0.34, 0.34, 0.025, 20, 1, false, -Math.PI / 2, Math.PI)), m.wear, h, 0, topY + 0.17, 0.27);
      peak.scale.set(1, 1, 0.8);
      peak.rotation.x = 0.2;
    } else if (head === 'beanie') {
      const knit = mesh(geo('beanie', () => new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, 1.45)), m.wear, h, 0, topY + 0.06, -0.01);
      knit.scale.set(0.45, 0.5, 0.47);
      const fold = mesh(geo('fold', () => new THREE.TorusGeometry(0.43, 0.06, 8, 24)), m.wear, h, 0, topY + 0.1, -0.01);
      fold.rotation.x = Math.PI / 2 - 0.12;
      fold.scale.set(0.98, 1.06, 1);
      mesh(geo('pom', () => new THREE.SphereGeometry(0.1, 10, 8)), m.wear, h, 0, topY + 0.56, -0.03);
    } else if (head === 'beret') {
      const beret = mesh(geo('beret', () => new THREE.SphereGeometry(0.5, 22, 12)), m.wear, h, 0.08, topY + 0.33, -0.02);
      beret.scale.set(1.05, 0.28, 1.0);
      beret.rotation.z = -0.22;
      mesh(geo('stalk', () => new THREE.CylinderGeometry(0.015, 0.02, 0.06, 6)), m.wear, h, 0.1, topY + 0.47, -0.02);
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
    const px = size * 2;
    portraitRenderer.setPixelRatio(1);
    portraitRenderer.setSize(px, px, false);
    portraitRenderer.setClearColor(0x000000, 0);
    const scene = portraitScene();
    const fig = new SeatFigure(spec);
    scene.add(fig.group);
    fig.update(0, 1, null);
    // Face the camera squarely for the portrait.
    (fig as unknown as { head: THREE.Group }).head.rotation.set(0.05, 0, 0);
    const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
    cam.position.set(0, HEAD_Y + 0.05, 5.0);
    cam.lookAt(0, HEAD_Y - 0.22, 0);
    portraitRenderer.render(scene, cam);

    const out = document.createElement('canvas');
    out.width = out.height = px;
    const g = out.getContext('2d')!;
    const frame = FRAMES[spec.frame];
    const C = px / 2;
    const R = (frame ? 0.42 : 0.47) * px;
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
      const ring = g.createLinearGradient(0, 0, px, px);
      ring.addColorStop(0, frame[1]);
      ring.addColorStop(0.45, frame[0]);
      ring.addColorStop(1, frame[2]);
      g.strokeStyle = ring;
      g.lineWidth = px * 0.054;
      g.beginPath();
      g.arc(C, C, R + px * 0.034, 0, Math.PI * 2);
      g.stroke();
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
