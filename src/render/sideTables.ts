// Side tables at the four corners of the main table, as in a fine club. Each
// holds one seat's gold (cash coins and yuanbao ingots that grow and shrink with
// that seat's score) and its tea cup; the two far tables carry the tea service,
// with a wisp of steam, and the dice tray. The look climbs with the room like the
// chairs do (chairs.ts), and the signature venues bring their own service: a
// bamboo steamer in the tea house, an iron tetsubin in the Tokyo parlour, a
// brass dallah and dates in the majlis.
//
// Everything that never moves is merged into one mesh per material across all
// four tables, coins and ingots are instanced, and steam is one Points cloud
// (none on the low tier), so the whole set is about a dozen draw calls.
//
// Corners are numbered by screen quadrant: corner q sits between seat quadrant q
// and q + 1 (0 you, 1 right, 2 across, 3 left), at the right hand of seat q.

import * as THREE from 'three';
import { openingRules } from '../engine/opening';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { EnvironmentStyle } from '../cosmetics/catalog';
import { CHAIR_FOR_ROOM, type ChairKind } from './chairs';
import type { QualitySpec } from './quality';

const FLOOR = -1.6;
/** The side tables' surface: a little below the main table's felt. */
export const SIDE_TOP = -0.42;
/** Corner table centres sit this far out along both axes (the main table's half-width is 4.85). */
const D = 5.95;
/** Felt height for the dice roll. */
const FELT = 0.0;
/** Die edge. */
const DS = 0.2;

/** How many dice a variation rolls (engine/opening.ts: two in India Rules, Riichi, American and the two-throw Chinese tables, three in Hong Kong and Taiwan). */
export function diceForVariation(id: string): 2 | 3 {
  return openingRules(id).dice;
}

/** Gold units for a score: 20 at the starting score (two ingots and four coins), none at or below zero. */
export const START_UNITS = 20;
export function purseUnits(score: number, start: number): number {
  if (!(start > 0)) return START_UNITS;
  return Math.max(0, Math.min(MAX_UNITS, Math.round((START_UNITS * score) / start)));
}
/** One ingot is worth this many coins. */
const INGOT = 8;
const MAX_INGOTS = 4;
const STACKS = 3;
const STACK = 8;
const MAX_UNITS = MAX_INGOTS * INGOT + STACKS * STACK;

// ------------------------------------------------------------ looks

type Pot = 'yixing' | 'tetsubin' | 'dallah';
type Side = 'caddy' | 'steamer' | 'dates' | 'sweets';
interface Look {
  frame: string;
  frameMetal?: number;
  frameRough: number;
  top: string;
  topRough: number;
  topMetal?: number;
  metal: string;
  metalRough: number;
  round: boolean;
  legs: 'straight' | 'hoof' | 'pedestal' | 'octagon';
  pot: Pot;
  potColor: string;
  potMetal: number;
  potRough: number;
  cup: string;
  tea: string;
  side: Side;
  accent: string;
  dice: string;
  /** Gilt bands on the pot's shoulder, foot and lid. */
  gilt?: boolean;
}

const LOOKS: Record<ChairKind, Look> = {
  // Rosewood with a brass inlay line, a jade-glazed pot with gilt bands and a blue-and-white caddy.
  plain: { frame: '#3a2216', frameRough: 0.42, top: '#2c1910', topRough: 0.35, metal: '#c9a46a', metalRough: 0.32, round: false, legs: 'straight', pot: 'yixing', potColor: '#1d4a3a', potMetal: 0, potRough: 0.14, gilt: true, cup: '#f4efe4', tea: '#8a5a1e', side: 'caddy', accent: '#2c5d8a', dice: '#f3ead6' },
  // Carved huanghuali with horse-hoof feet, celadon cups and a cinnabar caddy.
  carved: { frame: '#2a160c', frameRough: 0.4, top: '#3a1e10', topRough: 0.32, metal: '#c9a46a', metalRough: 0.3, round: false, legs: 'hoof', pot: 'yixing', potColor: '#6e3220', potMetal: 0, potRough: 0.5, cup: '#cfe0cf', tea: '#9a6a22', side: 'caddy', accent: '#7a1a14', dice: '#f3ead6' },
  // Black lacquer drum table with a gold band, white-and-gold porcelain.
  deco: { frame: '#101012', frameRough: 0.3, top: '#0c0c0e', topRough: 0.18, metal: '#d8b46a', metalRough: 0.22, round: true, legs: 'pedestal', pot: 'yixing', potColor: '#f6f3ec', potMetal: 0, potRough: 0.22, cup: '#f6f3ec', tea: '#9a6a22', side: 'sweets', accent: '#1f6a6a', dice: '#f6f3ec' },
  // Teak tea-house table with a stacked bamboo steamer.
  teahouse: { frame: '#5a3420', frameRough: 0.55, top: '#6a4028', topRough: 0.5, metal: '#b88a4a', metalRough: 0.4, round: false, legs: 'straight', pot: 'yixing', potColor: '#7a3a22', potMetal: 0, potRough: 0.55, cup: '#f2f0ea', tea: '#6a3a12', side: 'steamer', accent: '#c8a46a', dice: '#f3ead6' },
  // Parlour: black lacquer, chrome, a cast-iron tetsubin and dark glazed cups of green tea.
  parlour: { frame: '#141418', frameRough: 0.3, top: '#1a1a20', topRough: 0.25, metal: '#dfe4ea', metalRough: 0.18, round: false, legs: 'straight', pot: 'tetsubin', potColor: '#2a2a2c', potMetal: 0.6, potRough: 0.5, cup: '#5a3a2a', tea: '#7a8a3a', side: 'caddy', accent: '#2a3a5a', dice: '#f3ead6' },
  // Majlis: a beaten brass tray on a carved octagonal stand, a dallah, finjan cups and dates.
  majlis: { frame: '#3a2414', frameRough: 0.5, top: '#c9a050', topRough: 0.3, topMetal: 1, metal: '#d0a050', metalRough: 0.3, round: true, legs: 'octagon', pot: 'dallah', potColor: '#d0a050', potMetal: 1, potRough: 0.28, cup: '#f4efe4', tea: '#a8742a', side: 'dates', accent: '#4a2412', dice: '#f4efe4' },
  // Penthouse: white marble on a gold pedestal, fine white porcelain, pink macarons.
  luxe: { frame: '#e6c271', frameMetal: 1, frameRough: 0.22, top: '#f1eee8', topRough: 0.18, metal: '#e6c271', metalRough: 0.18, round: true, legs: 'pedestal', pot: 'yixing', potColor: '#fbfaf7', potMetal: 0, potRough: 0.2, cup: '#fbfaf7', tea: '#b07a2a', side: 'sweets', accent: '#e0a8b0', dice: '#fbfaf7' },
  // Forbidden City: cinnabar lacquer, gold mounts, a gold teapot.
  throne: { frame: '#7a140c', frameRough: 0.32, top: '#8a1a10', topRough: 0.25, metal: '#f0c45a', metalRough: 0.2, round: false, legs: 'hoof', pot: 'yixing', potColor: '#e2b24a', potMetal: 1, potRough: 0.25, cup: '#f6f1e6', tea: '#9a6a22', side: 'caddy', accent: '#e2b24a', dice: '#f6eedc' },
};

// ------------------------------------------------------------ small builders

function box(w: number, h: number, d: number, x: number, y: number, z: number, r = 0.02): THREE.BufferGeometry {
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)) : new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

function cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, seg = 16) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(x, y, z);
  return g;
}

function lathe(points: [number, number][], seg = 20) {
  return new THREE.LatheGeometry(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
    seg,
  );
}

function tube(points: [number, number, number][], r: number, seg = 16) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), seg, r, 6, false);
}

/** An arc of torus in the XY plane, centred at (x, y, z). */
function arc(radius: number, r: number, from: number, to: number, x: number, y: number, z: number, seg = 16) {
  const g = new THREE.TorusGeometry(radius, r, 6, seg, to - from);
  g.rotateZ(from);
  g.translate(x, y, z);
  return g;
}

function ellipsoid(rx: number, ry: number, rz: number, x: number, y: number, z: number, seg = 10) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(6, seg - 3));
  g.scale(rx, ry, rz);
  g.translate(x, y, z);
  return g;
}

/** Give a geometry a flat vertex colour (for meshes that merge several colours under one material). */
function painted(g: THREE.BufferGeometry, color: string) {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

function merge(list: THREE.BufferGeometry[], keepColor = false) {
  if (!list.length) return null;
  const geo = mergeGeometries(
    list.map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv' && !(keepColor && k === 'color')) n.deleteAttribute(k);
      if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
      return n;
    }),
  );
  for (const g of list) g.dispose();
  return geo;
}

const place = (g: THREE.BufferGeometry, x: number, y: number, z: number, s = 1, ry = 0) => {
  if (s !== 1) g.scale(s, s, s);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
};

// ------------------------------------------------------------ the pieces

/** Item scale: the tiles are drawn larger than life, so the tea things are too. */
const S = 2.2;

/** A teapot, origin at the centre of its foot. Returns body parts and where its spout tip is. */
function teapot(kind: Pot): { parts: THREE.BufferGeometry[]; spout: THREE.Vector3 } {
  if (kind === 'tetsubin') {
    const parts = [
      lathe([[0, 0], [0.1, 0], [0.15, 0.03], [0.16, 0.07], [0.14, 0.11], [0.07, 0.13], [0, 0.13]], 22),
      cyl(0.07, 0.072, 0.012, 0, 0.136, 0, 18),
      ellipsoid(0.02, 0.016, 0.02, 0, 0.152, 0, 8),
      arc(0.15, 0.011, 0.15, Math.PI - 0.15, 0, 0.12, 0, 18),
      tube([[0.14, 0.05, 0], [0.19, 0.08, 0], [0.215, 0.115, 0]], 0.016, 8),
    ];
    return { parts, spout: new THREE.Vector3(0.215, 0.12, 0) };
  }
  if (kind === 'dallah') {
    const parts = [
      lathe([[0, 0], [0.11, 0], [0.12, 0.03], [0.1, 0.11], [0.055, 0.17], [0.04, 0.24], [0.065, 0.28], [0.03, 0.32], [0, 0.34]], 22),
      new THREE.ConeGeometry(0.018, 0.07, 10).translate(0, 0.37, 0),
      tube([[0.07, 0.13, 0], [0.13, 0.2, 0], [0.17, 0.27, 0], [0.22, 0.31, 0]], 0.014, 12),
      arc(0.07, 0.01, Math.PI / 2, Math.PI * 1.45, -0.07, 0.19, 0, 14),
    ];
    return { parts, spout: new THREE.Vector3(0.22, 0.32, 0) };
  }
  // Yixing: a round squat body, a domed lid with a pearl knob, a curved spout and a loop handle.
  const parts = [
    lathe([[0, 0], [0.085, 0], [0.12, 0.02], [0.14, 0.06], [0.135, 0.1], [0.11, 0.128], [0.06, 0.142], [0, 0.142]], 24),
    lathe([[0, 0], [0.066, 0], [0.06, 0.014], [0.03, 0.026], [0, 0.03]], 18).translate(0, 0.138, 0),
    ellipsoid(0.018, 0.016, 0.018, 0, 0.18, 0, 8),
    tube([[0.12, 0.05, 0], [0.18, 0.075, 0], [0.215, 0.12, 0], [0.235, 0.15, 0]], 0.014, 10),
    arc(0.058, 0.012, Math.PI / 2, Math.PI * 1.5, -0.14, 0.075, 0, 14),
  ];
  return { parts, spout: new THREE.Vector3(0.235, 0.155, 0) };
}

/** A small tea bowl, origin at its foot, with tea inside (vertex coloured). */
function cupGeometry(look: Look) {
  const body = painted(lathe([[0, 0], [0.028, 0], [0.032, 0.004], [0.046, 0.05], [0.042, 0.05], [0.03, 0.009], [0, 0.009]], 18), look.cup);
  const tea = painted(new THREE.CircleGeometry(0.04, 18).rotateX(-Math.PI / 2).translate(0, 0.038, 0), look.tea);
  const g = merge([body, tea], true)!;
  g.scale(S, S, S);
  return g;
}

/** Where things stand on each corner table, in the table's own frame (-x toward its seat). */
const AT = {
  purse: new THREE.Vector2(-0.46, 0.4),
  cup: new THREE.Vector2(-0.6, -0.44),
  service: new THREE.Vector2(0.42, 0.1),
  side: new THREE.Vector2(0.52, -0.58),
};

/** Seat quadrant q's direction from the table centre. */
const seatDir = (q: number) => new THREE.Vector3(Math.sin((q * Math.PI) / 2), 0, Math.cos((q * Math.PI) / 2));

/** Corner table q's frame: at the corner between seat quadrants q and q + 1, its +z toward seat q's side. */
function cornerMatrix(q: number) {
  const c = seatDir(q)
    .add(seatDir(q + 1))
    .multiplyScalar(D);
  return new THREE.Matrix4().compose(c, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (q * Math.PI) / 2), new THREE.Vector3(1, 1, 1));
}

const toWorld = (q: number, x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(cornerMatrix(q));

// ------------------------------------------------------------ textures

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!];
}

/** A gold cash coin's face: a raised rim, a square hole and four characters (招財進寶). */
function coinFace(): THREE.Texture {
  const [c, g] = canvas(128);
  const gr = g.createRadialGradient(54, 50, 6, 64, 64, 64);
  gr.addColorStop(0, '#fff1b8');
  gr.addColorStop(0.55, '#e6b84e');
  gr.addColorStop(1, '#a8781e');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(90,56,10,0.7)';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(64, 64, 57, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#3a2408';
  g.fillRect(52, 52, 24, 24);
  g.strokeStyle = 'rgba(255,236,170,0.8)';
  g.lineWidth = 3;
  g.strokeRect(48, 48, 32, 32);
  g.fillStyle = 'rgba(96,60,12,0.85)';
  g.font = 'bold 26px "Songti SC","Noto Serif SC","SimSun",serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const chars = ['招', '進', '財', '寶'];
  const at = [
    [64, 30],
    [64, 99],
    [98, 64],
    [30, 64],
  ];
  chars.forEach((ch, i) => g.fillText(ch, at[i][0], at[i][1]));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Die faces in BoxGeometry order (+x, -x, +y, -y, +z, -z) = 2, 5, 1, 6, 3, 4. Red one and four, as on Chinese dice. */
const FACE_VALUES = [2, 5, 1, 6, 3, 4];
const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.26, 0.26], [0.74, 0.26], [0.5, 0.5], [0.26, 0.74], [0.74, 0.74]],
  6: [[0.28, 0.24], [0.72, 0.24], [0.28, 0.5], [0.72, 0.5], [0.28, 0.76], [0.72, 0.76]],
};
function dieFace(v: number, body: string, trim: string): THREE.Texture {
  const [c, g] = canvas(128);
  g.fillStyle = body;
  g.fillRect(0, 0, 128, 128);
  // Gilded edge.
  g.strokeStyle = trim;
  g.globalAlpha = 0.85;
  g.lineWidth = 6;
  g.strokeRect(5, 5, 118, 118);
  g.globalAlpha = 1;
  const red = v === 1 || v === 4;
  for (const [x, y] of PIPS[v]) {
    const r = v === 1 ? 19 : 11;
    const gr = g.createRadialGradient(x * 128 - 2, y * 128 - 2, 1, x * 128, y * 128, r);
    gr.addColorStop(0, red ? '#e0483a' : '#2a3550');
    gr.addColorStop(1, red ? '#8e1a12' : '#0c1222');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x * 128, y * 128, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** The turn that brings face value v to the top. */
function topFace(v: number) {
  const q = new THREE.Quaternion();
  const X = new THREE.Vector3(1, 0, 0),
    Z = new THREE.Vector3(0, 0, 1);
  if (v === 6) q.setFromAxisAngle(X, Math.PI);
  else if (v === 2) q.setFromAxisAngle(Z, Math.PI / 2);
  else if (v === 5) q.setFromAxisAngle(Z, -Math.PI / 2);
  else if (v === 3) q.setFromAxisAngle(X, -Math.PI / 2);
  else if (v === 4) q.setFromAxisAngle(X, Math.PI / 2);
  return q;
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

// ------------------------------------------------------------ the set

interface Roll {
  t0: number;
  from: THREE.Vector3[];
  throwAt: THREE.Vector3;
  land: THREE.Vector3[];
  final: THREE.Quaternion[];
  axis: THREE.Vector3[];
  /** Time scale (1 = the hand-start roll; the opening's seat throws run faster). */
  pace: number;
  /** Stay where they landed (the next throw picks them up from there). */
  hold: boolean;
}

interface Flight {
  mesh: THREE.Mesh;
  from: number;
  to: number;
  t0: number;
  dur: number;
}

export class SideTables {
  readonly group = new THREE.Group();
  private kind: ChairKind | '' = '';
  private statics = new THREE.Group();
  private frameMat = new THREE.MeshPhysicalMaterial({ color: '#3a2216', roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  private topMat = new THREE.MeshPhysicalMaterial({ color: '#2c1910', roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  private metalMat = new THREE.MeshStandardMaterial({ color: '#c9a46a', metalness: 1, roughness: 0.32 });
  private potMat = new THREE.MeshPhysicalMaterial({ color: '#7a3a22', roughness: 0.55, clearcoat: 0.3 });
  private porcelainMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.1 });
  private accentMat = new THREE.MeshStandardMaterial({ color: '#2c5d8a', roughness: 0.4 });
  private gold = new THREE.MeshStandardMaterial({ color: '#f6cf6a', metalness: 1, roughness: 0.3, envMapIntensity: 2.2, emissive: '#3a2600' });
  private coinFaceMat: THREE.MeshStandardMaterial;
  private coins: THREE.InstancedMesh;
  private ingots: THREE.InstancedMesh;
  private dice: THREE.Mesh[] = [];
  private diceMats: THREE.MeshStandardMaterial[] = [];
  private diceTex: THREE.Texture[] = [];
  private diceCount = 3;
  private diceHome: THREE.Vector3[] = [];
  private diceRest: THREE.Quaternion[] = [];
  private roll: Roll | null = null;
  private cupGeo: THREE.BufferGeometry | null = null;
  private cups: THREE.Mesh[] = [];
  private cupHome: THREE.Vector3[] = [];
  private flights: Flight[] = [];
  private sips: { q: number; t0: number }[] = [];
  /** Until when each corner's cup is freshly poured (steams). */
  private fresh = [0, 0, 0, 0];
  private target: (number | null)[] = [START_UNITS, START_UNITS, START_UNITS, START_UNITS];
  private shown = [START_UNITS, START_UNITS, START_UNITS, START_UNITS];
  private steam: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null = null;
  private steamPer = 0;
  private spout = new THREE.Vector3();
  private matrix = new THREE.Matrix4();
  private now = 0;
  private dirty = true;

  constructor(q: QualitySpec, glow: THREE.Texture) {
    this.group.add(this.statics);
    this.coinFaceMat = new THREE.MeshStandardMaterial({ map: coinFace(), metalness: 0.85, roughness: 0.32, envMapIntensity: 2.2, emissive: '#3a2600' });
    const coinGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.03, 28);
    this.coins = new THREE.InstancedMesh(coinGeo, [this.gold, this.coinFaceMat, this.coinFaceMat], 4 * STACKS * STACK);
    this.coins.count = 0;
    this.coins.frustumCulled = false;
    this.ingots = new THREE.InstancedMesh(this.ingotGeometry(), this.gold, 4 * MAX_INGOTS);
    this.ingots.count = 0;
    this.ingots.frustumCulled = false;
    this.group.add(this.coins, this.ingots);

    const dieGeo = new RoundedBoxGeometry(DS, DS, DS, 3, DS * 0.16);
    for (let f = 0; f < 6; f++) this.diceMats.push(new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0 }));
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(dieGeo, this.diceMats);
      m.castShadow = true;
      this.dice.push(m);
      this.diceRest.push(new THREE.Quaternion());
      this.group.add(m);
    }

    // Steam: a few soft puffs per source, the teapot's spout and any freshly poured cup.
    this.steamPer = q.tier === 'high' ? 10 : q.tier === 'medium' ? 6 : 0;
    if (this.steamPer) {
      const n = this.steamPer * 5;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      this.steam = new THREE.Points(g, new THREE.PointsMaterial({ map: glow, size: 0.2, vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.steam.frustumCulled = false;
      this.steam.renderOrder = 6;
      this.group.add(this.steam);
    }
    this.build('plain');
    this.setDiceCount(3);
  }

  /** A yuanbao: a boat-shaped body with raised ends and a dome, about 0.22 long. */
  private ingotGeometry() {
    const g = merge([ellipsoid(0.078, 0.032, 0.05, 0, 0.026, 0, 16), ellipsoid(0.034, 0.03, 0.044, -0.056, 0.046, 0, 10), ellipsoid(0.034, 0.03, 0.044, 0.056, 0.046, 0, 10), ellipsoid(0.03, 0.03, 0.03, 0, 0.05, 0, 10)])!;
    g.scale(1.45, 1.45, 1.45);
    return g;
  }

  /** Dress the side tables for a room. */
  set(e: EnvironmentStyle) {
    const kind = CHAIR_FOR_ROOM[e.id] ?? 'plain';
    if (kind !== this.kind) this.build(kind);
  }

  private build(kind: ChairKind) {
    this.kind = kind;
    const L = LOOKS[kind];
    this.frameMat.color.set(L.frame);
    this.frameMat.metalness = L.frameMetal ?? 0;
    this.frameMat.roughness = L.frameRough;
    this.frameMat.clearcoat = L.frameMetal ? 0 : kind === 'teahouse' || kind === 'majlis' ? 0.3 : 0.9;
    this.topMat.color.set(L.top);
    this.topMat.roughness = L.topRough;
    this.topMat.metalness = L.topMetal ?? 0;
    this.topMat.clearcoat = L.topMetal ? 0 : 0.5;
    this.metalMat.color.set(L.metal);
    this.metalMat.roughness = L.metalRough;
    this.potMat.color.set(L.potColor);
    this.potMat.metalness = L.potMetal;
    this.potMat.roughness = L.potRough;
    this.potMat.clearcoat = L.potMetal ? 0 : 0.5;
    this.accentMat.color.set(L.accent);
    this.accentMat.roughness = L.side === 'steamer' ? 0.75 : 0.35;

    for (const o of [...this.statics.children]) {
      this.statics.remove(o);
      (o as THREE.Mesh).geometry.dispose();
    }
    const parts: Record<'frame' | 'top' | 'metal' | 'pot' | 'porcelain' | 'accent', THREE.BufferGeometry[]> = { frame: [], top: [], metal: [], pot: [], porcelain: [], accent: [] };
    for (let q = 0; q < 4; q++) {
      const local: typeof parts = { frame: [], top: [], metal: [], pot: [], porcelain: [], accent: [] };
      this.table(L, local);
      this.dress(L, q, local);
      const m = cornerMatrix(q);
      for (const k of Object.keys(local) as (keyof typeof parts)[]) for (const g of local[k]) parts[k].push(g.applyMatrix4(m));
    }
    const mats = { frame: this.frameMat, top: this.topMat, metal: this.metalMat, pot: this.potMat, porcelain: this.porcelainMat, accent: this.accentMat };
    for (const k of Object.keys(parts) as (keyof typeof parts)[]) {
      const g = merge(parts[k], k === 'porcelain');
      if (!g) continue;
      const mesh = new THREE.Mesh(g, mats[k]);
      mesh.receiveShadow = true;
      this.statics.add(mesh);
    }

    // Each seat's cup (they slide and lift, so they stay separate meshes).
    for (const c of this.cups) this.group.remove(c);
    for (const f of this.flights) this.group.remove(f.mesh);
    this.flights = [];
    this.cupGeo?.dispose();
    this.cupGeo = cupGeometry(L);
    this.cups = [];
    this.cupHome = [];
    for (let q = 0; q < 4; q++) {
      const home = toWorld(q, AT.cup.x, SIDE_TOP + 0.012, AT.cup.y);
      const m = new THREE.Mesh(this.cupGeo, this.porcelainMat);
      m.position.copy(home);
      this.cups.push(m);
      this.cupHome.push(home);
      this.group.add(m);
    }

    // Dice: this room's ivory with a trim in its metal.
    this.diceTex.forEach((t) => t.dispose());
    this.diceTex = FACE_VALUES.map((v) => dieFace(v, L.dice, L.metal));
    this.diceMats.forEach((m, i) => {
      m.map = this.diceTex[i];
      m.needsUpdate = true;
    });
    this.placeDiceHome();
    this.layoutPurses(true);
  }

  /** The table itself, centred on the origin, its surface at SIDE_TOP. */
  private table(L: Look, p: Record<string, THREE.BufferGeometry[]>) {
    const T = SIDE_TOP;
    if (L.round) {
      p.top.push(cyl(1.08, 1.08, 0.07, 0, T - 0.035, 0, 48));
      const ring = new THREE.TorusGeometry(1.08, 0.02, 6, 56).rotateX(Math.PI / 2).translate(0, T - 0.02, 0);
      p.metal.push(ring);
      if (L.legs === 'octagon') {
        // A carved octagonal stand under the brass tray.
        p.frame.push(new THREE.CylinderGeometry(0.72, 0.8, T - 0.07 - FLOOR, 8, 1, true).translate(0, (T - 0.07 + FLOOR) / 2, 0));
        p.frame.push(new THREE.CylinderGeometry(0.72, 0.72, 0.04, 8).translate(0, T - 0.09, 0));
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
          p.metal.push(ellipsoid(0.05, 0.11, 0.02, Math.sin(a) * 0.74, (T + FLOOR) / 2, Math.cos(a) * 0.74, 8).rotateY(0));
        }
      } else {
        p.frame.push(cyl(0.1, 0.13, T - 0.07 - FLOOR - 0.1, 0, (T - 0.07 + FLOOR + 0.1) / 2, 0, 18));
        p.frame.push(cyl(0.42, 0.5, 0.1, 0, FLOOR + 0.05, 0, 32));
        p.metal.push(new THREE.TorusGeometry(0.5, 0.014, 6, 40).rotateX(Math.PI / 2).translate(0, FLOOR + 0.1, 0));
        p.metal.push(cyl(0.12, 0.12, 0.05, 0, T - 0.1, 0, 18));
      }
      return;
    }
    const H = 1.0;
    p.top.push(box(H * 2, 0.07, H * 2, 0, T - 0.035, 0, 0.03));
    // A brass inlay line round the top.
    const i = H - 0.09;
    for (const [w, d, x, z] of [
      [i * 2, 0.012, 0, i],
      [i * 2, 0.012, 0, -i],
      [0.012, i * 2, i, 0],
      [0.012, i * 2, -i, 0],
    ])
      p.metal.push(box(w, 0.004, d, x, T + 0.001, z, 0));
    // Apron, waisted under the top.
    p.frame.push(box(H * 2 - 0.12, 0.13, H * 2 - 0.12, 0, T - 0.135, 0, 0.02));
    const legTop = T - 0.2;
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const lx = x * (H - 0.11),
        lz = z * (H - 0.11);
      if (L.legs === 'hoof') {
        // Square legs ending in inward-turned horse-hoof feet, with brass sabots.
        p.frame.push(box(0.1, legTop - FLOOR - 0.08, 0.1, lx, (legTop + FLOOR + 0.08) / 2, lz, 0.015));
        p.frame.push(box(0.13, 0.08, 0.13, lx - x * 0.025, FLOOR + 0.06, lz - z * 0.025, 0.03));
        p.metal.push(box(0.14, 0.02, 0.14, lx - x * 0.025, FLOOR + 0.01, lz - z * 0.025, 0.005));
      } else {
        p.frame.push(box(0.09, legTop - FLOOR, 0.09, lx, (legTop + FLOOR) / 2, lz, 0.015));
        p.metal.push(box(0.1, 0.03, 0.1, lx, FLOOR + 0.015, lz, 0.005));
      }
    }
    if (L.legs === 'hoof') {
      // Cusped spandrels under the apron.
      for (const [x, z, w, d] of [
        [0, H - 0.07, 1.1, 0.03],
        [0, -(H - 0.07), 1.1, 0.03],
        [H - 0.07, 0, 0.03, 1.1],
        [-(H - 0.07), 0, 0.03, 1.1],
      ])
        p.frame.push(box(w, 0.07, d, x, T - 0.235, z, 0.012));
    }
    // A low shelf between the legs.
    p.frame.push(box(H * 2 - 0.3, 0.03, H * 2 - 0.3, 0, FLOOR + 0.32, 0, 0.01));
  }

  /** What stands on corner table q. */
  private dress(L: Look, q: number, p: Record<string, THREE.BufferGeometry[]>) {
    const T = SIDE_TOP;
    // The seat's gold sits in a shallow lacquer tray with a metal lip.
    const P = AT.purse;
    p.frame.push(box(0.9, 0.035, 0.72, P.x, T + 0.018, P.y, 0.014));
    for (const [w, d, x, z] of [
      [0.9, 0.02, P.x, P.y + 0.355],
      [0.9, 0.02, P.x, P.y - 0.355],
      [0.02, 0.72, P.x + 0.445, P.y],
      [0.02, 0.72, P.x - 0.445, P.y],
    ])
      p.metal.push(box(w, 0.06, d, x, T + 0.03, z, 0.005));
    // The seat's saucer under its cup.
    p.porcelain.push(painted(cyl(0.075 * S, 0.06 * S, 0.012, AT.cup.x, T + 0.006, AT.cup.y, 20), L.cup));

    const V = AT.service;
    if (q === 1) {
      // The tea service: a slatted tea boat with the pot and two spare cups.
      p.frame.push(box(0.98, 0.05, 0.7, V.x, T + 0.025, V.y, 0.018));
      for (let k = -3; k <= 3; k++) p.metal.push(box(0.9, 0.005, 0.014, V.x, T + 0.051, V.y + k * 0.09, 0));
      const pot = teapot(L.pot);
      const potS = L.pot === 'dallah' ? S * 0.95 : S;
      for (const g of pot.parts) p.pot.push(place(g, V.x + 0.12, T + 0.05, V.y + 0.03, potS, -Math.PI / 2 + 0.5));
      if (L.gilt)
        for (const [r, y] of [[0.112, 0.126], [0.088, 0.004], [0.064, 0.14]])
          p.metal.push(place(new THREE.TorusGeometry(r, 0.006, 6, 32).rotateX(Math.PI / 2).translate(0, y, 0), V.x + 0.12, T + 0.05, V.y + 0.03, potS, 0));
      this.spout = pot.spout
        .clone()
        .multiplyScalar(potS)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2 + 0.5)
        .add(new THREE.Vector3(V.x + 0.12, T + 0.05, V.y + 0.03))
        .applyMatrix4(cornerMatrix(1));
      for (const dz of [-0.17, 0.17]) {
        const c = cupGeometry(L);
        p.porcelain.push(place(c, V.x - 0.3, T + 0.05, V.y + dz));
      }
    } else if (q === 2) {
      // The dice tray: a shallow turned dish.
      p.frame.push(place(lathe([[0, 0], [0.3, 0], [0.34, 0.06], [0.322, 0.066], [0.295, 0.016], [0, 0.016]], 36), V.x, T, V.y));
      p.metal.push(new THREE.TorusGeometry(0.334, 0.01, 6, 44).rotateX(Math.PI / 2).translate(V.x, T + 0.064, V.y));
    } else {
      // Spare cups, upturned on a little stand.
      p.frame.push(cyl(0.27, 0.29, 0.04, V.x, T + 0.02, V.y, 28));
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        const c = cupGeometry(L);
        c.rotateX(Math.PI);
        p.porcelain.push(place(c, V.x + Math.cos(a) * 0.13, T + 0.04 + 0.05 * S, V.y + Math.sin(a) * 0.13));
      }
    }

    // Each venue's own touch.
    const W = AT.side;
    // Steamer, dates and sweets are modelled small and scaled up round their spot.
    const sp: Record<'accent' | 'frame' | 'porcelain', THREE.BufferGeometry[]> = { accent: [], frame: [], porcelain: [] };
    if (L.side === 'steamer') {
      for (let k = 0; k < 2; k++) {
        sp.accent.push(cyl(0.15, 0.15, 0.07, W.x, T + 0.035 + k * 0.072, W.y, 24));
        sp.frame.push(new THREE.TorusGeometry(0.15, 0.008, 5, 24).rotateX(Math.PI / 2).translate(W.x, T + 0.005 + k * 0.072, W.y));
      }
      sp.accent.push(ellipsoid(0.15, 0.05, 0.15, W.x, T + 0.144, W.y, 18));
    } else if (L.side === 'dates') {
      sp.porcelain.push(painted(lathe([[0, 0], [0.09, 0], [0.15, 0.05], [0.142, 0.052], [0.085, 0.01], [0, 0.01]], 24), L.cup).translate(W.x, T, W.y));
      for (let k = 0; k < 9; k++) {
        const a = k * 2.4,
          r = 0.03 + (k % 3) * 0.03;
        sp.accent.push(ellipsoid(0.028, 0.017, 0.017, W.x + Math.cos(a) * r, T + 0.04 + (k > 5 ? 0.02 : 0), W.y + Math.sin(a) * r, 8).rotateY(0));
      }
    } else if (L.side === 'sweets') {
      sp.porcelain.push(painted(cyl(0.14, 0.11, 0.015, W.x, T + 0.008, W.y, 24), L.cup));
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        sp.accent.push(cyl(0.03, 0.03, 0.035, W.x + Math.cos(a) * 0.075, T + 0.034, W.y + Math.sin(a) * 0.075, 12));
      }
    } else {
      // A lidded tea caddy.
      p.accent.push(place(lathe([[0, 0], [0.055, 0], [0.072, 0.05], [0.068, 0.115], [0.048, 0.135], [0, 0.135]], 20), W.x, T, W.y, S));
      p.metal.push(place(lathe([[0, 0], [0.05, 0], [0.04, 0.02], [0, 0.03]], 16), W.x, T + 0.132 * S, W.y, S));
      p.metal.push(ellipsoid(0.03, 0.03, 0.03, W.x, T + 0.175 * S, W.y, 8));
    }
    const K = 1.7;
    const m = new THREE.Matrix4().makeTranslation(W.x, T, W.y).multiply(new THREE.Matrix4().makeScale(K, K, K)).multiply(new THREE.Matrix4().makeTranslation(-W.x, -T, -W.y));
    for (const k of Object.keys(sp) as (keyof typeof sp)[]) for (const g of sp[k]) p[k].push(g.applyMatrix4(m));
  }

  // ------------------------------------------------------------ gold

  /** Each corner's purse in gold units (purseUnits), or null for an empty seat. By screen quadrant. */
  setPurses(units: (number | null)[]) {
    for (let q = 0; q < 4; q++) this.target[q] = units[q] ?? null;
    this.dirty = true;
  }

  /** Lay the coins and ingots out from `shown`; `snap` skips the falling top coin. */
  private layoutPurses(snap = false) {
    let ci = 0,
      ii = 0;
    const m = this.matrix;
    const quat = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    for (let q = 0; q < 4; q++) {
      if (this.target[q] === null) continue;
      const v = this.shown[q];
      const whole = Math.floor(v + 1e-6);
      const ingots = Math.min(MAX_INGOTS, Math.floor(whole / INGOT));
      const coins = whole - ingots * INGOT;
      const corner = cornerMatrix(q);
      const y0 = SIDE_TOP + 0.035;
      for (let k = 0; k < ingots; k++) {
        const pos = new THREE.Vector3(AT.purse.x - 0.3 + k * 0.2, y0, AT.purse.y + 0.17).applyMatrix4(corner);
        quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (q * Math.PI) / 2 + (k % 2 ? 0.08 : -0.06));
        this.ingots.setMatrixAt(ii++, m.compose(pos, quat, one));
      }
      // The coin being added drops onto its stack as the purse grows.
      const fall = snap ? 0 : 1 - (v - whole);
      for (let k = 0; k < coins; k++) {
        const s = Math.floor(k / STACK),
          h = k % STACK;
        const top = k === coins - 1 && this.shown[q] < (this.target[q] ?? 0);
        const jx = Math.sin(k * 12.9898 + q) * 0.006,
          jz = Math.cos(k * 78.233 + q) * 0.006;
        const pos = new THREE.Vector3(AT.purse.x - 0.27 + s * 0.27 + jx, y0 + 0.015 + h * 0.03 + (top ? fall * 0.16 : 0), AT.purse.y - 0.14 + jz).applyMatrix4(corner);
        quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), k * 0.7);
        this.coins.setMatrixAt(ci++, m.compose(pos, quat, one));
      }
    }
    this.coins.count = ci;
    this.ingots.count = ii;
    this.coins.instanceMatrix.needsUpdate = true;
    this.ingots.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------ dice

  setDiceCount(n: number) {
    this.diceCount = Math.max(2, Math.min(3, n));
    this.dice.forEach((d, i) => (d.visible = i < this.diceCount));
    this.placeDiceHome();
  }

  private placeDiceHome() {
    const V = AT.service;
    const offs = this.diceCount === 2 ? [-0.09, 0.09] : [-0.13, 0.02, 0.14];
    this.diceHome = offs.map((o, i) => toWorld(2, V.x + o, SIDE_TOP + 0.016 + DS / 2, V.y + (i === 1 ? 0.11 : -0.06)));
    if (!this.roll)
      this.dice.forEach((d, i) => {
        if (i >= this.diceHome.length) return;
        d.position.copy(this.diceHome[i]);
        d.quaternion.copy(this.diceRest[i]);
      });
  }

  /**
   * The hand-start roll: the dice leave their tray, tumble onto the felt in front
   * of the dealer, show `values`, and go back. Calm: they just turn to the values on the tray.
   */
  rollDice(values: number[], dealerQuad: number, calm: boolean, opts: { pace?: number; hold?: boolean } = {}) {
    const n = this.diceCount;
    const vals = Array.from({ length: n }, (_, i) => Math.max(1, Math.min(6, values[i] ?? 1 + ((i * 7) % 6))));
    const final = vals.map((v, i) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (dealerQuad * Math.PI) / 2 + (i - 1) * 0.35 + 0.2).multiply(topFace(v)));
    this.diceRest = final.map((q) => q.clone());
    while (this.diceRest.length < 3) this.diceRest.push(new THREE.Quaternion());
    if (calm) {
      this.roll = null;
      this.placeDiceHome();
      return;
    }
    const dir = seatDir(dealerQuad);
    const perp = new THREE.Vector3(dir.z, 0, -dir.x);
    this.roll = {
      t0: this.now,
      from: this.dice.slice(0, n).map((d) => d.position.clone()),
      throwAt: dir.clone().multiplyScalar(2.3).setY(FELT + 0.75),
      land: vals.map((_, i) =>
        dir
          .clone()
          .multiplyScalar(1.22 + Math.sin(i * 3.1 + vals[0]) * 0.06)
          .addScaledVector(perp, (i - (n - 1) / 2) * 0.26)
          .setY(FELT + DS / 2),
      ),
      final,
      axis: vals.map((v, i) => new THREE.Vector3(Math.sin(v + i), 0.4, Math.cos(v * 2 + i)).normalize()),
      pace: opts.pace ?? 1,
      hold: !!opts.hold,
    };
  }

  /** Dice left on the felt by a held throw go back to their tray. */
  sendDiceHome() {
    const n = this.diceCount;
    const at = this.dice.slice(0, n).map((d) => d.position.clone());
    const final = this.dice.slice(0, n).map((d) => d.quaternion.clone());
    this.diceRest = [...final.map((q) => q.clone()), new THREE.Quaternion(), new THREE.Quaternion()].slice(0, 3);
    this.roll = { t0: this.now - 1.85, from: at, throwAt: at[0], land: at, final, axis: at.map(() => new THREE.Vector3(0, 1, 0)), pace: 1, hold: false };
  }

  /** Seconds a roll takes from tray to tray. */
  static readonly ROLL_S = 2.3;

  private updateRoll() {
    const r = this.roll;
    if (!r) return;
    const t = (this.now - r.t0) * r.pace;
    const n = r.land.length;
    if (r.hold && t > 1.25) {
      // Held on the felt: settle on the final faces and wait for the next throw.
      for (let i = 0; i < n; i++) {
        this.dice[i].position.copy(r.land[i]);
        this.dice[i].quaternion.copy(r.final[i]);
      }
      this.roll = null;
      return;
    }
    for (let i = 0; i < n; i++) {
      const d = this.dice[i];
      const ti = t - i * 0.04;
      if (ti < 0.35) {
        // Gathered up from the tray and lifted over the table.
        const k = smooth(clamp01(ti / 0.35));
        d.position.lerpVectors(r.from[i], r.throwAt, k);
        d.position.y += Math.sin(Math.PI * k) * 0.4;
      } else if (ti < 1.15) {
        // Thrown: a skid along the felt with two bounces, spinning down to the final face.
        const k = clamp01((ti - 0.35) / 0.8);
        const e = easeOut(k);
        d.position.lerpVectors(r.throwAt, r.land[i], e);
        d.position.y = r.land[i].y + (r.throwAt.y - r.land[i].y) * (1 - k) * (1 - k) * Math.abs(Math.cos(k * Math.PI * 2.5));
        d.quaternion.copy(r.final[i]).multiply(new THREE.Quaternion().setFromAxisAngle(r.axis[i], (1 - e) * 9));
      } else if (ti < 1.85) {
        d.position.copy(r.land[i]);
        d.quaternion.copy(r.final[i]);
      } else {
        const k = smooth(clamp01((ti - 1.85) / 0.45));
        d.position.lerpVectors(r.land[i], this.diceHome[i], k);
        d.position.y += Math.sin(Math.PI * k) * 0.5;
        d.quaternion.copy(r.final[i]);
      }
    }
    if (t > SideTables.ROLL_S + 0.1) {
      this.roll = null;
      this.placeDiceHome();
    }
  }

  // ------------------------------------------------------------ tea

  /**
   * A cup of tea from one seat to another (screen quadrants): it glides round the
   * outside of the table to the receiver's side table, who lifts it to sip.
   * Calm: no glide or sip, the receiver's cup is simply fresh. Returns seconds to arrival.
   */
  passTea(from: number, to: number, calm: boolean): number {
    if (from === to) return 0;
    if (calm) {
      this.fresh[to] = this.now + 10;
      return 0;
    }
    const dq = (((to - from) % 4) + 4) % 4;
    const dur = 1.1 + 0.45 * (dq === 2 ? 2 : 1);
    const mesh = new THREE.Mesh(this.cupGeo!, this.porcelainMat);
    mesh.position.copy(this.cupHome[from]);
    this.group.add(mesh);
    this.flights.push({ mesh, from, to, t0: this.now, dur });
    return dur;
  }

  private updateTea() {
    for (const f of [...this.flights]) {
      const k = clamp01((this.now - f.t0) / f.dur);
      const a = this.cupHome[f.from],
        b = this.cupHome[f.to];
      const a0 = Math.atan2(a.x, a.z);
      let da = Math.atan2(b.x, b.z) - a0;
      while (da > Math.PI + 1e-3) da -= Math.PI * 2;
      while (da < -Math.PI + 1e-3) da += Math.PI * 2;
      const e = smooth(k);
      // Round the outside of the table, a little wider at mid-way so it clears the chairs.
      const r = THREE.MathUtils.lerp(Math.hypot(a.x, a.z), Math.hypot(b.x, b.z), e) + Math.sin(Math.PI * e) * 0.6;
      const ang = a0 + da * e;
      f.mesh.position.set(Math.sin(ang) * r, THREE.MathUtils.lerp(a.y, b.y, e) + Math.sin(Math.PI * e) * 0.42, Math.cos(ang) * r);
      f.mesh.rotation.z = Math.sin(Math.PI * e) * 0.06;
      if (k >= 1) {
        this.group.remove(f.mesh);
        this.flights = this.flights.filter((x) => x !== f);
        this.fresh[f.to] = this.now + 10;
        this.sips.push({ q: f.to, t0: this.now + 0.25 });
      }
    }
    // The receiver lifts the cup toward their seat, tips it, and sets it down.
    for (let q = 0; q < 4; q++) {
      const c = this.cups[q];
      const s = this.sips.find((x) => x.q === q);
      if (!s) {
        c.position.copy(this.cupHome[q]);
        c.rotation.set(0, 0, 0);
        continue;
      }
      const k = (this.now - s.t0) / 1.6;
      if (k < 0) continue;
      if (k >= 1) {
        this.sips = this.sips.filter((x) => x !== s);
        continue;
      }
      const lift = Math.sin(Math.PI * clamp01(k));
      // The table's own -x: toward its seat.
      const toSeat = seatDir(q + 1).negate();
      c.position.copy(this.cupHome[q]).addScaledVector(toSeat, lift * 0.22);
      c.position.y += lift * 0.3;
      // Tip toward the seat at the top of the lift.
      const tip = Math.max(0, Math.sin(Math.PI * clamp01((k - 0.25) / 0.5))) * 0.55;
      c.rotation.set(0, 0, 0);
      c.rotateOnWorldAxis(new THREE.Vector3(toSeat.z, 0, -toSeat.x), -tip);
    }
  }

  /** Whether a dice roll or a cup is moving (the renderer draws at full rate then). */
  get busy() {
    return !!this.roll || this.flights.length > 0 || this.sips.length > 0;
  }

  // ------------------------------------------------------------ per frame

  update(now: number, dt: number, minimal: boolean) {
    this.now = now;
    this.updateRoll();
    this.updateTea();
    // Purses count up or down toward their targets, a coin at a time.
    let moved = false;
    for (let q = 0; q < 4; q++) {
      const t = this.target[q];
      if (t === null) continue;
      const d = t - this.shown[q];
      if (Math.abs(d) < 1e-3) continue;
      const step = minimal ? Math.abs(d) : Math.max(5, Math.abs(d) * 1.4) * dt;
      this.shown[q] = Math.abs(d) <= step ? t : this.shown[q] + Math.sign(d) * step;
      moved = true;
    }
    if (moved || this.dirty) {
      this.dirty = false;
      this.layoutPurses(minimal);
    }
    this.updateSteam(now, minimal);
  }

  private updateSteam(now: number, minimal: boolean) {
    const st = this.steam;
    if (!st) return;
    st.visible = !minimal;
    if (minimal) return;
    const pos = st.geometry.attributes.position as THREE.BufferAttribute;
    const col = st.geometry.attributes.color as THREE.BufferAttribute;
    const N = this.steamPer;
    const sources: [THREE.Vector3, number, number][] = [[this.spout, 0.75, 0.32]];
    for (let q = 0; q < 4; q++) {
      const left = this.fresh[q] - now;
      sources.push([this.cups[q].position.clone().setY(this.cups[q].position.y + 0.05 * S), left > 0 ? Math.min(1, left / 3) : 0, 0.26]);
    }
    for (let s = 0; s < sources.length; s++) {
      const [src, strength, rise] = sources[s];
      for (let i = 0; i < N; i++) {
        const j = s * N + i;
        const ph = (i / N + s * 0.37) % 1;
        const life = (now * 0.32 + ph) % 1;
        const sway = Math.sin(now * 1.3 + i * 2.1 + s) * 0.035 * life;
        pos.setXYZ(j, src.x + sway, src.y + life * rise, src.z + Math.cos(now * 1.1 + i * 1.7) * 0.03 * life);
        const b = strength * Math.sin(Math.PI * life) * 0.42;
        col.setXYZ(j, b, b * 0.97, b * 0.93);
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }
}
