// Tile racks, as at a club table: every seat's hand stands on a rack, in the
// style equipped from The Atelier (cosmetics/racks.ts; materials in
// rackLook.ts). All four racks match, as a set does at a club table.
// Your own rack holds the hand leaning back toward you. Each opponent's rack
// has a raised step for the standing hand and, in front of it, a shallow
// sloped shelf where their called sets (and flowers) are laid out, high enough
// to be seen over the wall and tilted toward the middle of the table so they
// read from your seat at every camera angle.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rackStyle, type RackStyle } from '../cosmetics/racks';
import { disposeRackMaterials, rackMaterials, type RackMaterials } from './rackLook';
import type { QualityTier } from './quality';

/** Your hand leans back toward you at this angle (radians about the rack's long axis). */
export const HAND_LEAN = 0.62;
/** Your hand stands this much higher than the felt: the rack's base. */
export const HAND_RAISE = 0.07;

/**
 * Every rack carries a set ledge level with the top of the two-high wall
 * (two tiles lying flat), so revealed sets on it are never hidden behind a wall.
 */
export const LEDGE_Y = 0.47;

/** Opponent racks, in the seat's local frame (+z runs out from the centre toward the player). */
export const OPP_RACK = {
  /** Length along the table edge. */
  length: 6.0,
  /** Inner edge, by the wall. */
  z0: 3.1,
  /** Where the shelf's lip ends and called tiles start. */
  shelfZ: 3.15,
  /** Shelf surface height at shelfZ: the set ledge. */
  shelfY: LEDGE_Y,
  /** Shelf slope, rising toward the player (radians). */
  slope: 0.21,
  /** Where the shelf meets the hand step. */
  stepZ: 3.62,
  /** The hand step's surface (the shelf's height where it meets the step). */
  stepY: LEDGE_Y + 0.47 * Math.tan(0.21),
  /** Outer edge. */
  z1: 4.02,
  /** Standing hand tiles' centre line. */
  handZ: 3.8,
};

/**
 * Your rack's set ledge, in front of your hand (toward the centre): its front
 * edge is level with the wall's top, and it leans toward you like a lectern so
 * your revealed sets face you over the wall.
 */
export const MY_LEDGE = {
  /** Front edge, just behind your wall. */
  z0: 3.1,
  /** Where the ledge meets your rack's base. */
  z1: 3.86,
  /** Surface height at its front edge. */
  y0: LEDGE_Y + 0.02,
  /** Lean toward you (radians): the surface falls toward your hand. */
  tilt: 0.16,
};

/** Height of your set ledge's surface at local depth z. */
export function myLedgeHeight(z: number) {
  return MY_LEDGE.y0 - (z - MY_LEDGE.z0 - 0.03) * Math.tan(MY_LEDGE.tilt);
}

/** Your ledge's surface normal: up, leaning toward you. */
export const MY_LEDGE_NORMAL = new THREE.Vector3(0, Math.cos(MY_LEDGE.tilt), Math.sin(MY_LEDGE.tilt));

/** Height of the opponent shelf surface at local depth z. */
export function shelfHeight(z: number) {
  return OPP_RACK.shelfY + (z - OPP_RACK.shelfZ) * Math.tan(OPP_RACK.slope);
}

/** The shelf's surface normal in the seat's local frame: up, leaning toward the centre. */
export const SHELF_NORMAL = new THREE.Vector3(0, Math.cos(OPP_RACK.slope), -Math.sin(OPP_RACK.slope));

/** The opponent rack's cross-section (shelf lip, slope, hand step), in shape coordinates (-z, y). */
function oppShape() {
  const R = OPP_RACK;
  const lipY = R.shelfY + 0.035;
  const pts: [number, number][] = [
    [R.z0, 0.02],
    [R.z0, lipY - 0.012],
    [R.z0 + 0.012, lipY],
    [R.shelfZ - 0.006, lipY],
    [R.shelfZ, R.shelfY],
    [R.stepZ, shelfHeight(R.stepZ)],
    [R.stepZ, R.stepY],
    [R.z1 - 0.02, R.stepY],
    [R.z1, R.stepY - 0.02],
    [R.z1, 0.02],
  ];
  return new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(-z, y)));
}

/** The profile extruded along the table edge, `length` long and centred; `grow` widens the outline (end caps). */
function oppExtrude(length: number, grow = 0.012, bevel = 0.025) {
  const geo = new THREE.ExtrudeGeometry(oppShape(), { depth: length, bevelEnabled: true, bevelThickness: bevel, bevelSize: grow, bevelSegments: 2, steps: 1, curveSegments: 4 });
  geo.translate(0, 0, -length / 2);
  // Shape (x, y, extrusion) -> seat (extrusion, y, -x).
  geo.rotateY(Math.PI / 2);
  return geo;
}

type Slot = 'body' | 'accent' | 'trim' | 'lining' | 'stone' | 'gem' | 'frieze' | 'panel';
const SLOTS: Slot[] = ['body', 'accent', 'trim', 'lining', 'stone', 'gem', 'frieze', 'panel'];
/** Carved decals keep their own UVs (one ornament repeat per unit of u). */
const DECALS: Slot[] = ['frieze', 'panel'];
type Parts = Record<Slot, THREE.BufferGeometry[]>;
const noParts = (): Parts => ({ body: [], accent: [], trim: [], lining: [], stone: [], gem: [], frieze: [], panel: [] });

/** A box of the given size centred at (x, y, z), optionally rounded. */
function box(w: number, h: number, d: number, x: number, y: number, z: number, r = 0) {
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.999) : new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

/** A dome (rivet or cabochon) facing `dir` ('-z' toward the table centre, '+z' toward the player, '+x'/'-x' outward). */
function dome(r: number, x: number, y: number, z: number, dir: '-z' | '+z' | '+x' | '-x', seg: number) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(3, seg >> 1), 0, Math.PI * 2, 0, Math.PI / 2);
  if (dir === '-z') g.rotateX(-Math.PI / 2);
  else if (dir === '+z') g.rotateX(Math.PI / 2);
  else if (dir === '+x') g.rotateZ(-Math.PI / 2);
  else g.rotateZ(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

/** A carved decal `w` x `h` centred at (x, y, z), facing toward the player (+z) or the centre (-z), its ornament repeated `n` times along it. */
function decal(w: number, h: number, x: number, y: number, z: number, facing: '+z' | '-z', n: number) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * n);
  if (facing === '-z') g.rotateY(Math.PI);
  g.translate(x, y, z);
  return g;
}

/** A carved band `w` long and `d` deep lying on a surface that rises toward +z at `slope` radians, centred at (x, y, z). */
function decalFlat(w: number, d: number, x: number, y: number, z: number, slope: number) {
  const g = new THREE.PlaneGeometry(w, d / Math.cos(slope));
  const uv = g.attributes.uv;
  const n = Math.max(1, Math.round(w / (d * 4)));
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * n);
  g.rotateX(-Math.PI / 2 - slope);
  g.translate(x, y, z);
  return g;
}

/** A cast medallion on a rack's end: a disc, a raised ring, four bosses and a centre boss (or cabochon). */
function medallion(P: Parts, st: RackStyle, sx: number, x: number, y: number, z: number, r: number, seg: number) {
  const disc = new THREE.CylinderGeometry(r, r, 0.008, seg * 2);
  disc.rotateZ(Math.PI / 2);
  disc.translate(x + sx * 0.004, y, z);
  P.trim.push(disc);
  const ring = new THREE.TorusGeometry(r * 0.86, 0.0065, 6, seg * 2);
  ring.rotateY(Math.PI / 2);
  ring.translate(x + sx * 0.008, y, z);
  P.trim.push(ring);
  const dir = sx > 0 ? '+x' : '-x';
  for (const a of [0.25, 0.75, 1.25, 1.75]) P.trim.push(dome(r * 0.13, x + sx * 0.008, y + Math.sin(a * Math.PI) * r * 0.52, z + Math.cos(a * Math.PI) * r * 0.52, dir, seg));
  (st.gem ? P.gem : P.trim).push(dome(r * 0.3, x + sx * 0.008, y, z, dir, seg));
}

/** Cast corner brackets (an L of metal) at the four corners of a front face spanning x in ±half, y in [y0, y1], at depth z. */
function brackets(P: Parts, half: number, y0: number, y1: number, z: number, arm: number) {
  for (const sx of [-1, 1])
    for (const [y, sy] of [
      [y0, 1],
      [y1, -1],
    ]) {
      P.trim.push(box(0.016, arm, 0.007, sx * (half - 0.008), y + (sy * arm) / 2, z, 0.003));
      P.trim.push(box(arm, 0.016, 0.007, sx * (half - arm / 2), y + sy * 0.008, z, 0.003));
    }
}

/**
 * Box-projected UVs in the rack's own frame, so one painted grain runs the
 * length of every piece: one texture repeat covers 2 x 0.5 world units.
 */
function boxUV(geo: THREE.BufferGeometry) {
  const p = geo.attributes.position,
    n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)),
      ay = Math.abs(n.getY(i)),
      az = Math.abs(n.getZ(i));
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    let u: number, v: number;
    if (ay >= ax && ay >= az) (u = x), (v = z);
    else if (az >= ax) (u = x), (v = y);
    else (u = z * 0.25), (v = y);
    uv[i * 2] = u / 2;
    uv[i * 2 + 1] = v / 0.5;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function merge(geos: THREE.BufferGeometry[], keepUV = false) {
  if (keepUV) {
    const out = mergeGeometries(geos)!;
    for (const g of geos) g.dispose();
    return out;
  }
  const flat = geos.map((g) => {
    const f = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(f.attributes)) if (k !== 'position' && k !== 'normal') f.deleteAttribute(k);
    if (!f.attributes.normal) f.computeVertexNormals();
    boxUV(f);
    if (f !== g) g.dispose();
    return f;
  });
  const out = mergeGeometries(flat)!;
  for (const f of flat) f.dispose();
  return out;
}

/** The pieces of an opponent rack `length` long, in the seat's local frame. */
function oppRackParts(st: RackStyle, length: number, seg: number): Parts {
  const R = OPP_RACK;
  const P = noParts();
  const lipY = R.shelfY + 0.035;
  const front = R.z0 - 0.012; // the lip's front face, toward the table centre
  const half = length / 2;
  const body = oppExtrude(length);
  body.computeVertexNormals();
  P.body.push(body);
  // Felt (or suede, velvet, leather) laid into the sloped shelf, inside a fine border of the wood.
  if (st.lining || st.body === 'table') {
    const z0 = R.shelfZ + 0.135,
      z1 = R.stepZ - 0.125;
    const zc = (z0 + z1) / 2;
    const pl = new THREE.PlaneGeometry(length - 0.5, (z1 - z0) / Math.cos(R.slope));
    pl.rotateX(-Math.PI / 2 - R.slope);
    pl.translate(0, shelfHeight(zc) + 0.0135, zc); // above the profile's 0.012 bevel
    P.lining.push(pl);
  }
  // Carved bands in the wood either side of the lining, seen from every seat.
  for (const [a, b] of [
    [R.shelfZ + 0.014, R.shelfZ + 0.12],
    [R.stepZ - 0.11, R.stepZ - 0.008],
  ]) {
    const zc = (a + b) / 2;
    P.frieze.push(decalFlat(length - 0.3, b - a, 0, shelfHeight(zc) + 0.0125, zc, R.slope));
  }
  // A front band in the second wood, for two-tone racks.
  if (st.accent) P.accent.push(box(length, lipY - 0.03, 0.014, 0, (lipY + 0.03) / 2 + 0.005, front - 0.006, 0.005));
  const face = st.accent ? front - 0.013 : front;
  // Stringing: metal lines along the lip top and the front face.
  P.trim.push(box(length - 0.06, 0.007, 0.014, 0, lipY + 0.014, R.z0 + 0.01));
  if (st.stringing === 2) {
    P.trim.push(box(length - 0.06, 0.01, 0.006, 0, lipY - 0.022, face - 0.002));
    P.trim.push(box(length - 0.06, 0.01, 0.006, 0, 0.045, face - 0.002));
    P.trim.push(box(length - 0.06, 0.007, 0.012, 0, R.stepY + 0.014, R.z1 - 0.02));
  }
  // Cast end caps, a little proud of the profile all round.
  if (st.caps) {
    for (const sx of [-1, 1]) {
      const cap = oppExtrude(0.04, 0.026, 0.012);
      cap.translate(sx * (half + 0.045), 0, 0);
      cap.computeVertexNormals();
      P.trim.push(cap);
    }
  }
  // A cast medallion on each end, on the cap or on the wood.
  for (const sx of [-1, 1]) medallion(P, st, sx, sx * (half + (st.caps ? 0.077 : 0.025)), 0.24, 3.6, 0.075, seg);
  const midY = (lipY + 0.03) / 2 + 0.005;
  // Brass rivets along the front, as on a trunk.
  if (st.studs) {
    const n = Math.max(4, Math.round(length / 0.24));
    for (let i = 0; i < n; i++) {
      const x = -half + 0.12 + ((length - 0.24) * i) / (n - 1);
      P.trim.push(dome(0.013, x, lipY - 0.03, face, '-z', seg));
      P.trim.push(dome(0.013, x, 0.06, face, '-z', seg));
    }
  }
  // Carved panels along the whole front, one per stone cartouche where there are stones.
  const panels = Math.max(3, Math.round(length / 0.75));
  const py0 = 0.085,
    py1 = lipY - 0.05;
  P.panel.push(decal(length, py1 - py0, 0, (py0 + py1) / 2, face - 0.0015, '-z', panels));
  brackets(P, half, 0.03, lipY - 0.01, face - 0.003, 0.1);
  // Stone cartouches set in metal bezels along the front.
  if (st.cartouche) {
    const n = panels;
    const w = Math.min(0.32, length / n - 0.3);
    for (let i = 0; i < n; i++) {
      const x = -half + ((i + 0.5) * length) / n;
      P.trim.push(box(w + 0.03, 0.105, 0.01, x, midY, face - 0.003, 0.004));
      P.stone.push(box(w, 0.08, 0.014, x, midY, face - 0.006, 0.012));
    }
  }
  return P;
}

export interface HumanRackFit {
  /** Your hand tiles' scale. */
  scale: number;
  /** Their resting centre line (local z). */
  z: number;
  /** Tile size and depth before scaling. */
  tw: number;
  th: number;
  td: number;
}

/**
 * Your rack: a base the tile bottoms rest on, a backrest along the lower part of
 * the tiles' backs, and a tile-stop rail on your side, with the style's lining,
 * stringing, caps and inlays. Built to the hand's scale.
 */
function humanRackParts(st: RackStyle, f: HumanRackFit, length: number, seg: number, withLedge = true): Parts {
  const P = noParts();
  const s = f.scale;
  const h = (f.th * s) / 2,
    d = (f.td * s) / 2;
  const up = new THREE.Vector3(0, Math.cos(HAND_LEAN), -Math.sin(HAND_LEAN));
  const n = new THREE.Vector3(0, Math.sin(HAND_LEAN), Math.cos(HAND_LEAN));
  const c = new THREE.Vector3(0, h + 0.03 + HAND_RAISE, f.z);
  const backBottom = c.clone().addScaledVector(up, -h).addScaledVector(n, -d);
  const frontBottom = c.clone().addScaledVector(up, -h).addScaledVector(n, d);
  const baseTop = backBottom.y + 0.005;
  const half = length / 2;
  const z0 = backBottom.z - 0.16,
    z1 = frontBottom.z + 0.1;
  P.body.push(box(length, baseTop - 0.02, z1 - z0, 0, (baseTop + 0.02) / 2, (z0 + z1) / 2, 0.02));
  const restH = f.th * s * 0.5,
    restT = 0.05;
  const rest = new RoundedBoxGeometry(length, restH, restT, 2, 0.018);
  rest.rotateX(-HAND_LEAN);
  const rp = backBottom.clone().addScaledVector(up, restH / 2).addScaledVector(n, -restT / 2 - 0.004);
  rest.translate(0, rp.y, rp.z);
  P.body.push(rest);
  // The tile-stop rail on your side.
  const railH = 0.12,
    railD = 0.075,
    railY = baseTop - 0.01 + railH / 2,
    railZ = z1 - railD / 2;
  (st.accent ? P.accent : P.body).push(box(length, railH, railD, 0, railY, railZ, 0.02));
  const railTop = railY + railH / 2;
  // Lining on the base, between the backrest and the rail, where the tiles stand.
  if (st.lining || st.body === 'table') {
    const lz0 = backBottom.z + 0.01,
      lz1 = z1 - railD - 0.008;
    const pl = new THREE.PlaneGeometry(length - 0.12, lz1 - lz0);
    pl.rotateX(-Math.PI / 2);
    pl.translate(0, baseTop + 0.002, (lz0 + lz1) / 2);
    P.lining.push(pl);
  }
  // Stringing along the rail's top, and a second line low on its face.
  P.trim.push(box(length - 0.08, 0.008, 0.016, 0, railTop + 0.001, railZ));
  if (st.stringing === 2) P.trim.push(box(length - 0.08, 0.01, 0.006, 0, railY - railH * 0.36, z1 + 0.002));
  if (st.caps) {
    for (const sx of [-1, 1]) {
      P.trim.push(box(0.05, railH + 0.016, railD + 0.016, sx * (half + 0.012), railY, railZ, 0.008));
      P.trim.push(box(0.05, baseTop - 0.02 + 0.012, z1 - z0 + 0.012, sx * (half + 0.012), (baseTop + 0.02) / 2, (z0 + z1) / 2, 0.008));
      if (st.gem) P.gem.push(dome(0.022, sx * (half + 0.037), railY, railZ, sx > 0 ? '+x' : '-x', seg));
    }
  }
  // The carved frieze along the rail's face, between cast corner brackets.
  const fh = 0.076;
  P.frieze.push(decal(length - 0.2, fh, 0, railY + 0.006, z1 + 0.0015, '+z', Math.max(1, Math.round((length - 0.2) / (fh * 4)))));
  brackets(P, half, railY - railH / 2 + 0.008, railTop - 0.008, z1 + 0.003, 0.07);
  if (st.studs) {
    const k = Math.max(6, Math.round(length / 0.22));
    for (let i = 0; i < k; i++) P.trim.push(dome(0.012, -half + 0.12 + ((length - 0.24) * i) / (k - 1), railY + 0.012, z1 + 0.001, '+z', seg));
  }
  if (st.cartouche) {
    const k = Math.max(3, Math.round(length / 0.75));
    const w = Math.min(0.3, length / k - 0.3);
    for (let i = 0; i < k; i++) {
      const x = -half + ((i + 0.5) * length) / k;
      P.trim.push(box(w + 0.026, 0.06, 0.008, x, railY + 0.008, z1 + 0.003, 0.004));
      P.stone.push(box(w, 0.042, 0.012, x, railY + 0.008, z1 + 0.006, 0.01));
    }
  }
  if (withLedge) {
    // The set ledge: a lectern-like block in front of your hand, its surface
    // falling toward you, with a lip at the low edge so sets sit square.
    const L = MY_LEDGE;
    const zb = z0 + 0.02;
    const zLip = zb - 0.05;
    const yLow = myLedgeHeight(zLip);
    const pts: [number, number][] = [
      [L.z0, 0.02],
      [L.z0, L.y0 - 0.014],
      [L.z0 + 0.014, L.y0],
      [L.z0 + 0.03, L.y0],
      [zLip, yLow],
      [zLip, yLow + 0.045],
      [zb, yLow + 0.045],
      [zb, 0.02],
    ];
    const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(-z, y)));
    const lg = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.01, bevelSegments: 2, steps: 1, curveSegments: 4 });
    lg.translate(0, 0, -length / 2);
    lg.rotateY(Math.PI / 2);
    lg.computeVertexNormals();
    P.body.push(lg);
    // Lining laid into the ledge.
    if (st.lining || st.body === 'table') {
      const a = L.z0 + 0.145,
        b = zLip - 0.03;
      const zc = (a + b) / 2;
      const pl = new THREE.PlaneGeometry(length - 0.4, (b - a) / Math.cos(L.tilt));
      pl.rotateX(-Math.PI / 2 + L.tilt);
      pl.translate(0, myLedgeHeight(zc) + 0.012, zc);
      P.lining.push(pl);
    }
    // A carved band along the ledge's front, between the stringing and the lining.
    const fa = L.z0 + 0.03,
      fb = L.z0 + 0.13;
    P.frieze.push(decalFlat(length - 0.3, fb - fa, 0, myLedgeHeight((fa + fb) / 2) + 0.0115, (fa + fb) / 2, -L.tilt));
    // Stringing along the ledge's front edge and its lip.
    P.trim.push(box(length - 0.06, 0.008, 0.014, 0, L.y0 + 0.012, L.z0 + 0.012));
    P.trim.push(box(length - 0.06, 0.007, 0.012, 0, yLow + 0.057, zLip + 0.025));
    if (st.caps) {
      for (const sx of [-1, 1]) {
        const cap = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.022, bevelSegments: 2, steps: 1, curveSegments: 4 });
        cap.translate(0, 0, -0.02);
        cap.rotateY(Math.PI / 2);
        cap.translate(sx * (half + 0.04), 0, 0);
        cap.computeVertexNormals();
        P.trim.push(cap);
      }
    }
  }
  return P;
}

/** Merge parts into one mesh per material and add them to `into`. */
function addParts(into: THREE.Group, P: Parts, mats: RackMaterials) {
  for (const slot of SLOTS) {
    if (!P[slot].length) continue;
    const m = new THREE.Mesh(merge(P[slot], DECALS.includes(slot)), mats[slot]);
    m.castShadow = slot === 'body' || slot === 'accent';
    m.receiveShadow = true;
    if (DECALS.includes(slot)) m.renderOrder = 1;
    m.userData.rackSlot = slot;
    into.add(m);
  }
}

function clearGroup(g: THREE.Group) {
  for (const c of [...g.children]) {
    g.remove(c);
    (c as THREE.Mesh).geometry?.dispose();
  }
}

/** A rack on its own (for previews): an opponent's rack or yours, `length` long. */
export function rackSegment(st: RackStyle, mats: RackMaterials, kind: 'opp' | 'human', length: number, fit?: HumanRackFit) {
  const g = new THREE.Group();
  addParts(g, kind === 'opp' ? oppRackParts(st, length, 12) : humanRackParts(st, fit!, length, 12, false), mats);
  return g;
}

export class Racks {
  readonly group = new THREE.Group();
  /** One rack per screen quadrant (0 yours, 1 right, 2 across, 3 left). */
  private quads: THREE.Group[] = [];
  private human = new THREE.Group();
  private opp = new THREE.Group();
  private humanKey = '';
  /** Your rack's current length (its set ledge runs the same length). */
  humanLength = 6;
  private fit: { f: HumanRackFit; width: number } | null = null;
  private style: RackStyle = rackStyle('rack-table');
  private mats: RackMaterials;
  private felt = '#17402f';

  constructor(
    private wood: THREE.Material,
    private trim: THREE.Material,
    private tier: QualityTier = 'high',
    private aniso = 4,
  ) {
    this.mats = this.makeMats();
    for (let q = 0; q < 4; q++) {
      const g = new THREE.Group();
      g.rotation.y = (q * Math.PI) / 2;
      this.quads.push(g);
      this.group.add(g);
    }
    this.quads[0].add(this.human);
    this.buildOpp();
  }

  private makeMats() {
    return rackMaterials(this.style, this.tier, { wood: this.wood, trim: this.trim, felt: this.felt }, this.aniso);
  }

  private get seg() {
    return this.tier === 'low' ? 6 : 10;
  }

  /** Opponent racks share one set of merged meshes, instanced into the three quadrants. */
  private buildOpp() {
    clearGroup(this.opp);
    addParts(this.opp, oppRackParts(this.style, OPP_RACK.length, this.seg), this.mats);
    for (let q = 1; q < 4; q++) {
      const g = this.quads[q];
      for (const c of [...g.children]) g.remove(c);
      for (const m of this.opp.children as THREE.Mesh[]) {
        const copy = new THREE.Mesh(m.geometry, m.material);
        copy.castShadow = m.castShadow;
        copy.receiveShadow = m.receiveShadow;
        g.add(copy);
      }
    }
  }

  /** Equip a rack (cosmetics/racks.ts id). Rebuilds the four racks; cheap, only on change. */
  setStyle(id: string) {
    const st = rackStyle(id);
    if (st.id === this.style.id) return;
    this.style = st;
    disposeRackMaterials(this.mats);
    this.mats = this.makeMats();
    this.buildOpp();
    this.humanKey = '';
    if (this.fit) this.fitHuman(this.fit.f, this.fit.width);
  }

  get styleId() {
    return this.style.id;
  }

  /** The table's felt changed: the table-matched rack lines its ledges in a deeper shade of it. */
  setFelt(color: string) {
    if (color === this.felt) return;
    this.felt = color;
    if (this.style.lining) return;
    disposeRackMaterials(this.mats);
    this.mats = this.makeMats();
    this.buildOpp();
    this.humanKey = '';
    if (this.fit) this.fitHuman(this.fit.f, this.fit.width);
  }

  /** Rebuild your rack for the hand's scale and length (cheap; only when they change). */
  fitHuman(f: HumanRackFit, handWidth: number) {
    this.fit = { f, width: handWidth };
    const length = Math.max(4.6, Math.min(8.2, handWidth + 0.6));
    const key = `${f.scale.toFixed(3)}:${f.z}:${length.toFixed(1)}`;
    if (key === this.humanKey) return;
    this.humanKey = key;
    this.humanLength = Math.round(length * 10) / 10;
    clearGroup(this.human);
    addParts(this.human, humanRackParts(this.style, f, Math.round(length * 10) / 10, this.seg), this.mats);
  }

  /** Which quadrants have a rack (a three-seat table leaves one empty), and whether yours shows. */
  setVisible(quadrants: boolean[], humanShown: boolean) {
    this.quads.forEach((g, q) => (g.visible = quadrants[q]));
    this.human.visible = humanShown;
  }

  /**
   * Orientation of a called tile on an opponent's shelf: face along the shelf
   * normal, its top pointing to the seat that owns it so it faces the table
   * (on your own ledge, away from you). Face down tiles (a concealed kong's ends) turn over.
   * `tilt` leans the face toward the centre (the shelf's slope by default).
   */
  static shelfQuat(quadrant: number, faceDown: boolean, tilt = OPP_RACK.slope) {
    const qq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (quadrant * Math.PI) / 2);
    const n = new THREE.Vector3(0, Math.cos(tilt), -Math.sin(tilt)).applyQuaternion(qq);
    // Your own ledge reads upright from your seat; every opponent's tiles turn to face the table,
    // their foot toward the centre and their top toward the player who owns them.
    const g = quadrant === 0 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 0, 1).applyQuaternion(qq);
    const up = g.addScaledVector(n, -g.dot(n)).normalize();
    const z = faceDown ? n.clone().negate() : n;
    const x = new THREE.Vector3().crossVectors(up, z).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, z));
  }

}
