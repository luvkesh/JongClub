// The four chairs round the table. Their style climbs with the room: a plain
// lacquer chair in the free Private Club, carved Ming-style or Art Deco chairs in
// the first rooms you buy, signature chairs in the three venues (a bentwood
// tea-house chair, a Shōwa parlour swivel chair, a carved majlis armchair), a
// tufted penthouse chair and, in the Forbidden City, a gilded throne.
//
// Each chair is three merged meshes (frame, upholstery, metal trim) shared by
// all four seats, so the whole set stays a dozen draw calls on a phone.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { EnvironmentStyle } from '../cosmetics/catalog';

export type ChairKind = 'plain' | 'carved' | 'deco' | 'teahouse' | 'parlour' | 'majlis' | 'luxe' | 'throne';

/** Which chair each room gets. Rooms not listed get the plain chair. */
export const CHAIR_FOR_ROOM: Record<string, ChairKind> = {
  'private-club': 'plain',
  tokyo: 'carved',
  taipei: 'carved',
  dubai: 'carved',
  kyoto: 'carved',
  'new-york': 'deco',
  shanghai: 'deco',
  'hk-teahouse': 'teahouse',
  'tokyo-janso': 'parlour',
  'al-fahidi-majlis': 'majlis',
  'modern-luxury': 'luxe',
  imperial: 'throne',
};

/** The metal of each chair's trim: brass, gold or chrome. */
const TRIM: Record<ChairKind, { color: string; roughness: number }> = {
  plain: { color: '#c9a46a', roughness: 0.35 },
  carved: { color: '#c9a46a', roughness: 0.32 },
  deco: { color: '#d8b46a', roughness: 0.22 },
  teahouse: { color: '#b88a4a', roughness: 0.4 },
  parlour: { color: '#dfe4ea', roughness: 0.18 },
  majlis: { color: '#d0a050', roughness: 0.3 },
  luxe: { color: '#e6c271', roughness: 0.18 },
  throne: { color: '#f0c45a', roughness: 0.2 },
};

/** Upholstery: silk and velvet are matte, the parlour's vinyl and the deco leather shine a little. */
const CLOTH: Record<ChairKind, number> = { plain: 0.7, carved: 0.75, deco: 0.5, teahouse: 0.6, parlour: 0.42, majlis: 0.9, luxe: 0.85, throne: 0.55 };

type Parts = { frame: THREE.BufferGeometry[]; cushion: THREE.BufferGeometry[]; trim: THREE.BufferGeometry[] };

// ------------------------------------------------------------ small builders

function box(w: number, h: number, d: number, x: number, y: number, z: number, r = 0.02): THREE.BufferGeometry {
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)) : new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

function cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, seg = 10) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(x, y, z);
  return g;
}

/** A leg or post from point a to point b. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1 = r0, seg = 10) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, seg);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m);
  return g;
}

function sphere(r: number, x: number, y: number, z: number, seg = 10) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg - 3));
  g.translate(x, y, z);
  return g;
}

function tube(points: [number, number, number][], r: number, seg = 32) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), seg, r, 8, false);
}

/** An arc of torus in the XY plane, centred at (x, y, z). */
function arc(radius: number, r: number, from: number, to: number, x: number, y: number, z: number, seg = 24) {
  const g = new THREE.TorusGeometry(radius, r, 8, seg, to - from);
  g.rotateZ(from);
  g.translate(x, y, z);
  return g;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// Seat heights: the table top is at y = 0 and the floor at -1.6.
const FLOOR = -1.6;

// ------------------------------------------------------------ the chairs

/** The Private Club's chair: seat rail, four turned legs, back posts, a top rail and silk cushions. */
function plain(): Parts {
  const frame = [box(1.3, 0.12, 1.1, 0, -0.6, 0, 0.04), box(1.36, 0.12, 0.12, 0, 0.84, 0.5, 0.04)];
  for (const [x, z] of [[-0.56, -0.46], [0.56, -0.46], [-0.56, 0.46], [0.56, 0.46]]) frame.push(cyl(0.045, 0.035, 1.0, x, -1.1, z));
  for (const x of [-0.56, 0.56]) frame.push(cyl(0.045, 0.045, 1.4, x, 0.1, 0.5));
  // Gilt details: sabots, post finials, a band on the crest rail, a framed back with a medallion, a seat-rail strip.
  const trim: THREE.BufferGeometry[] = [];
  for (const [x, z] of [[-0.56, -0.46], [0.56, -0.46], [-0.56, 0.46], [0.56, 0.46]]) trim.push(cyl(0.052, 0.056, 0.08, x, FLOOR + 0.04, z));
  for (const x of [-0.56, 0.56]) trim.push(sphere(0.06, x, 0.93, 0.5, 10), cyl(0.05, 0.05, 0.03, x, 0.885, 0.5));
  trim.push(box(1.38, 0.025, 0.02, 0, 0.84, 0.435, 0.004), box(1.38, 0.025, 0.02, 0, -0.55, -0.555, 0.004));
  trim.push(box(1.04, 0.03, 0.02, 0, 0.78, 0.455, 0.004), box(1.04, 0.03, 0.02, 0, 0.06, 0.455, 0.004), box(0.03, 0.72, 0.02, -0.51, 0.42, 0.455, 0.004), box(0.03, 0.72, 0.02, 0.51, 0.42, 0.455, 0.004));
  const med = new THREE.TorusGeometry(0.09, 0.016, 6, 22);
  med.translate(0, 0.46, 0.452);
  trim.push(med, sphere(0.03, 0, 0.46, 0.45, 8));
  return { frame, cushion: [box(1.2, 0.14, 1.0, 0, -0.47, -0.02, 0.05), box(1.0, 0.7, 0.08, 0, 0.42, 0.5, 0.03)], trim };
}

/** A Ming-style yoke-back chair: curved crest rail, vase splat, stretchers, brass feet and medallion. */
function carved(): Parts {
  const frame: THREE.BufferGeometry[] = [box(1.3, 0.1, 1.1, 0, -0.6, 0, 0.03)];
  const trim: THREE.BufferGeometry[] = [];
  // Cusped apron under the seat, front and sides.
  frame.push(box(1.16, 0.14, 0.05, 0, -0.73, -0.52, 0.02), box(0.05, 0.14, 0.96, -0.6, -0.73, 0, 0.02), box(0.05, 0.14, 0.96, 0.6, -0.73, 0, 0.02));
  for (const x of [-0.42, 0, 0.42]) frame.push(sphere(0.045, x, -0.81, -0.52, 8));
  for (const [x, z] of [[-0.58, -0.48], [0.58, -0.48], [-0.58, 0.48], [0.58, 0.48]]) {
    frame.push(rod(V(x, -0.62, z), V(x * 1.04, FLOOR + 0.06, z * 1.04), 0.05, 0.04));
    trim.push(cyl(0.05, 0.055, 0.07, x * 1.04, FLOOR + 0.035, z * 1.04));
  }
  // Stepped stretchers: low at the front (a footrest), higher at the sides and back.
  frame.push(box(1.18, 0.06, 0.06, 0, FLOOR + 0.18, -0.49), box(0.05, 0.05, 0.96, -0.59, -1.2, 0), box(0.05, 0.05, 0.96, 0.59, -1.2, 0), box(1.18, 0.05, 0.05, 0, -1.25, 0.49));
  // Back posts lean back a touch; the yoke rail sweeps past them and curls up at the ends.
  for (const x of [-0.56, 0.56]) frame.push(rod(V(x, -0.58, 0.5), V(x, 0.82, 0.6), 0.045, 0.04));
  frame.push(tube([[-0.86, 0.98, 0.6], [-0.66, 0.88, 0.62], [0, 0.96, 0.66], [0.66, 0.88, 0.62], [0.86, 0.98, 0.6]], 0.05));
  // The vase splat.
  const s = new THREE.Shape();
  s.moveTo(-0.2, 0);
  s.bezierCurveTo(-0.34, 0.35, -0.12, 0.6, -0.16, 0.9);
  s.bezierCurveTo(-0.22, 1.15, -0.3, 1.32, -0.24, 1.42);
  s.lineTo(0.24, 1.42);
  s.bezierCurveTo(0.3, 1.32, 0.22, 1.15, 0.16, 0.9);
  s.bezierCurveTo(0.12, 0.6, 0.34, 0.35, 0.2, 0);
  s.closePath();
  const splat = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 10 });
  splat.rotateX(Math.atan2(0.1, 1.4));
  splat.translate(0, -0.56, 0.5);
  frame.push(splat);
  // A brass medallion on the splat.
  const med = new THREE.TorusGeometry(0.1, 0.02, 6, 20);
  med.translate(0, 0.42, 0.6);
  trim.push(med, sphere(0.035, 0, 0.42, 0.6, 8));
  return { frame, cushion: [box(1.18, 0.12, 0.98, 0, -0.49, -0.02, 0.05)], trim };
}

/** A 1930s tub armchair: channel-tufted barrel back, rolled top, brass band and sabots. */
function deco(): Parts {
  const frame: THREE.BufferGeometry[] = [];
  const trim: THREE.BufferGeometry[] = [];
  const cushion: THREE.BufferGeometry[] = [box(1.32, 0.34, 1.12, 0, -0.56, -0.04, 0.12)];
  const R = 0.7;
  const n = 9;
  // Back channels on an arc round the rear of the seat (angle 0 = straight behind).
  for (let i = 0; i < n; i++) {
    const a = -1.75 + (i / (n - 1)) * 3.5;
    const g = new RoundedBoxGeometry(0.27, 1.0, 0.16, 2, 0.06);
    g.rotateY(a);
    g.translate(Math.sin(a) * R, -0.05, Math.cos(a) * R - 0.04);
    cushion.push(g);
  }
  // The rolled top and the brass band round the base.
  const roll = new THREE.TorusGeometry(R, 0.09, 8, 28, 3.6);
  roll.rotateX(Math.PI / 2);
  roll.rotateY(1.8 - Math.PI / 2);
  roll.translate(0, 0.46, -0.04);
  cushion.push(roll);
  const band = new THREE.TorusGeometry(R + 0.02, 0.025, 6, 28, 3.6);
  band.rotateX(Math.PI / 2);
  band.rotateY(1.8 - Math.PI / 2);
  band.translate(0, -0.72, -0.04);
  trim.push(band, box(1.3, 0.04, 0.04, 0, -0.72, -0.6, 0.015));
  frame.push(box(1.26, 0.1, 1.08, 0, -0.78, -0.04, 0.03));
  for (const [x, z] of [[-0.54, -0.5], [0.54, -0.5], [-0.5, 0.46], [0.5, 0.46]]) {
    frame.push(rod(V(x, -0.8, z), V(x * 1.06, FLOOR + 0.12, z * 1.06), 0.055, 0.035));
    trim.push(cyl(0.036, 0.03, 0.12, x * 1.06, FLOOR + 0.06, z * 1.06));
  }
  return { frame, cushion, trim };
}

/** The Hong Kong tea house: a bentwood café chair with a hoop back, an inner curl and a leg ring. */
function teahouse(): Parts {
  const frame: THREE.BufferGeometry[] = [cyl(0.62, 0.6, 0.08, 0, -0.62, 0, 28)];
  const trim: THREE.BufferGeometry[] = [];
  // Seat rim.
  const rim = new THREE.TorusGeometry(0.61, 0.04, 6, 32);
  rim.rotateX(Math.PI / 2);
  rim.translate(0, -0.64, 0);
  frame.push(rim);
  for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42]]) {
    frame.push(rod(V(x, -0.64, z), V(x * 1.18, FLOOR + 0.04, z * 1.18), 0.04, 0.032));
    trim.push(cyl(0.035, 0.035, 0.05, x * 1.18, FLOOR + 0.025, z * 1.18));
  }
  // Back legs run up into the hoop.
  for (const x of [-0.42, 0.42]) {
    frame.push(rod(V(x * 1.15, FLOOR + 0.04, 0.6), V(x, -0.64, 0.46), 0.032, 0.04), rod(V(x, -0.64, 0.46), V(x * 1.1, 0.1, 0.56), 0.04, 0.04));
    trim.push(cyl(0.035, 0.035, 0.05, x * 1.15, FLOOR + 0.025, 0.6));
  }
  frame.push(arc(0.462, 0.042, 0, Math.PI, 0, 0.1, 0.56, 28));
  // The inner curl: a smaller loop inside the hoop.
  frame.push(arc(0.24, 0.03, -Math.PI / 2 + 0.35, Math.PI * 1.5 - 0.35, 0, 0.02, 0.56, 24), rod(V(0, -0.22, 0.56), V(0, -0.64, 0.48), 0.03, 0.03));
  const ring = new THREE.TorusGeometry(0.5, 0.028, 6, 32);
  ring.rotateX(Math.PI / 2);
  ring.translate(0, -1.15, 0.04);
  frame.push(ring);
  return { frame, cushion: [cyl(0.55, 0.57, 0.06, 0, -0.55, 0, 28)], trim };
}

/** The Tokyo jansō: a Shōwa parlour swivel chair in vinyl on a chrome five-star base. */
function parlour(): Parts {
  const frame: THREE.BufferGeometry[] = [box(1.16, 0.08, 1.0, 0, -0.72, 0, 0.03)];
  const trim: THREE.BufferGeometry[] = [cyl(0.07, 0.08, 0.66, 0, -1.08, 0, 14), cyl(0.12, 0.12, 0.08, 0, -0.73, 0, 14)];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    trim.push(rod(V(0, -1.4, 0), V(Math.sin(a) * 0.62, FLOOR + 0.12, Math.cos(a) * 0.62), 0.05, 0.035, 8));
    frame.push(sphere(0.07, Math.sin(a) * 0.62, FLOOR + 0.07, Math.cos(a) * 0.62, 8));
  }
  // Chrome arm loops with black pads.
  for (const x of [-0.64, 0.64]) {
    trim.push(tube([[x, -0.72, -0.3], [x * 1.04, -0.32, -0.34], [x * 1.04, -0.24, 0.1], [x * 1.02, -0.3, 0.42], [x, -0.72, 0.4]], 0.03, 24));
    frame.push(box(0.11, 0.07, 0.62, x * 1.04, -0.2, 0.02, 0.03));
  }
  const back = new RoundedBoxGeometry(1.1, 0.86, 0.2, 3, 0.09);
  back.rotateX(-0.12);
  back.translate(0, 0.02, 0.5);
  trim.push(rod(V(0, -0.72, 0.42), V(0, -0.3, 0.52), 0.035, 0.035, 8));
  return { frame, cushion: [box(1.16, 0.22, 1.02, 0, -0.56, -0.02, 0.1), back], trim };
}

/** The majlis: a low carved armchair with mashrabiya lattice, an ogee crest, sadu cushions and brass studs. */
function majlis(): Parts {
  const frame: THREE.BufferGeometry[] = [box(1.46, 0.14, 1.2, 0, -0.84, 0, 0.03)];
  const trim: THREE.BufferGeometry[] = [];
  for (const [x, z] of [[-0.66, -0.54], [0.66, -0.54], [-0.66, 0.54], [0.66, 0.54]]) {
    frame.push(box(0.12, 0.62, 0.12, x, -1.22, z, 0.02), sphere(0.09, x, FLOOR + 0.08, z, 10));
  }
  // Arms: a lattice panel on each side, topped with a rail and a brass knob.
  for (const x of [-0.7, 0.7]) {
    frame.push(box(0.1, 0.06, 1.18, x, -0.28, 0, 0.02), box(0.08, 0.56, 0.08, x, -0.52, -0.56, 0.02));
    for (let i = 0; i < 4; i++) frame.push(box(0.04, 0.5, 0.03, x, -0.52, -0.36 + i * 0.26, 0.005));
    frame.push(box(0.04, 0.03, 1.1, x, -0.52, 0, 0.005));
    trim.push(sphere(0.06, x, -0.22, -0.56, 10));
  }
  // The back: posts, a mashrabiya grid and an ogee crest.
  for (const x of [-0.66, 0.66]) {
    frame.push(box(0.1, 1.6, 0.1, x, -0.05, 0.56, 0.02));
    trim.push(sphere(0.06, x, 0.8, 0.56, 10));
  }
  for (let i = 0; i < 6; i++) frame.push(box(0.035, 1.24, 0.03, -0.45 + i * 0.18, -0.12, 0.56, 0.005));
  for (let j = 0; j < 7; j++) frame.push(box(1.22, 0.035, 0.03, 0, -0.66 + j * 0.18, 0.56, 0.005));
  const s = new THREE.Shape();
  s.moveTo(-0.72, 0);
  s.lineTo(-0.72, 0.08);
  s.bezierCurveTo(-0.4, 0.1, -0.2, 0.18, -0.1, 0.34);
  s.quadraticCurveTo(-0.02, 0.44, 0, 0.56);
  s.quadraticCurveTo(0.02, 0.44, 0.1, 0.34);
  s.bezierCurveTo(0.2, 0.18, 0.4, 0.1, 0.72, 0.08);
  s.lineTo(0.72, 0);
  s.closePath();
  const crest = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false, curveSegments: 10 });
  crest.translate(0, 0.62, 0.52);
  frame.push(crest);
  trim.push(sphere(0.05, 0, 1.2, 0.56, 10), cyl(0.0, 0.035, 0.14, 0, 1.3, 0.56, 8));
  // Brass studs along the seat front.
  for (let i = 0; i < 7; i++) trim.push(sphere(0.028, -0.6 + i * 0.2, -0.84, -0.61, 6));
  // A thick seat cushion, a leaning back cushion and two bolsters.
  const backC = new RoundedBoxGeometry(1.18, 0.9, 0.2, 3, 0.09);
  backC.rotateX(-0.22);
  backC.translate(0, -0.28, 0.4);
  const cushion = [box(1.24, 0.24, 1.08, 0, -0.65, -0.04, 0.1), backC];
  for (const x of [-0.54, 0.54]) {
    const b = new THREE.CylinderGeometry(0.12, 0.12, 0.92, 14);
    b.rotateX(Math.PI / 2);
    b.translate(x, -0.42, -0.02);
    cushion.push(b);
  }
  return { frame, cushion, trim };
}

/** The Sky Penthouse: a tufted dining armchair on slender splayed legs with gold caps and a gold top rail. */
function luxe(): Parts {
  const frame: THREE.BufferGeometry[] = [box(1.3, 0.08, 1.14, 0, -0.68, 0, 0.03)];
  const trim: THREE.BufferGeometry[] = [];
  for (const [x, z] of [[-0.56, -0.48], [0.56, -0.48], [-0.56, 0.48], [0.56, 0.48]]) {
    frame.push(rod(V(x, -0.7, z), V(x * 1.12, FLOOR + 0.1, z * 1.12), 0.045, 0.025));
    trim.push(cyl(0.027, 0.024, 0.1, x * 1.12, FLOOR + 0.05, z * 1.12));
  }
  const back = new RoundedBoxGeometry(1.24, 1.12, 0.18, 3, 0.08);
  back.rotateX(-0.1);
  back.translate(0, 0.02, 0.52);
  // Arms: upholstered pads.
  const cushion = [box(1.24, 0.22, 1.08, 0, -0.53, -0.02, 0.1), back, box(0.14, 0.34, 0.96, -0.62, -0.3, 0.02, 0.06), box(0.14, 0.34, 0.96, 0.62, -0.3, 0.02, 0.06)];
  // Tufting buttons and a gold top rail.
  for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) trim.push(sphere(0.03, -0.32 + i * 0.32, -0.12 + j * 0.34, 0.42 - j * 0.035, 6));
  trim.push(rod(V(-0.62, 0.6, 0.6), V(0.62, 0.6, 0.6), 0.03, 0.03, 8));
  return { frame, cushion, trim };
}

/** The Forbidden City: a gilded throne with scroll arms, a crested back panel, hoof feet and silk cushions. */
function throne(): Parts {
  const frame: THREE.BufferGeometry[] = [box(1.56, 0.16, 1.24, 0, -0.66, 0, 0.03), box(1.5, 0.2, 0.06, 0, -0.84, -0.6, 0.02), box(0.06, 0.2, 1.16, -0.75, -0.84, 0, 0.02), box(0.06, 0.2, 1.16, 0.75, -0.84, 0, 0.02)];
  const trim: THREE.BufferGeometry[] = [];
  for (const [x, z] of [[-0.7, -0.56], [0.7, -0.56], [-0.7, 0.56], [0.7, 0.56]]) {
    frame.push(box(0.14, 0.82, 0.14, x, -1.12, z, 0.02));
    trim.push(box(0.2, 0.1, 0.2, x * 1.02, FLOOR + 0.05, z * 1.02, 0.04), box(0.16, 0.04, 0.16, x, -0.92, z, 0.01));
  }
  // Arms: solid side panels with gold scrolls at the front.
  for (const x of [-0.74, 0.74]) {
    frame.push(box(0.1, 0.5, 1.14, x, -0.34, 0.02, 0.04));
    trim.push(box(0.12, 0.04, 1.16, x, -0.08, 0.02, 0.015));
    const scroll = new THREE.TorusGeometry(0.13, 0.04, 8, 20, Math.PI * 1.5);
    scroll.rotateY(Math.PI / 2);
    scroll.translate(x, -0.18, -0.54);
    trim.push(scroll);
  }
  // The back panel with a gold border, a medallion and an arched crest.
  frame.push(box(1.44, 1.56, 0.12, 0, 0.2, 0.6, 0.03));
  trim.push(box(1.48, 0.05, 0.14, 0, 0.98, 0.6, 0.015), box(0.05, 1.56, 0.14, -0.72, 0.2, 0.6, 0.015), box(0.05, 1.56, 0.14, 0.72, 0.2, 0.6, 0.015));
  const med = new THREE.CylinderGeometry(0.22, 0.22, 0.04, 28);
  med.rotateX(Math.PI / 2);
  med.translate(0, 0.42, 0.53);
  const ring = new THREE.TorusGeometry(0.26, 0.025, 6, 32);
  ring.translate(0, 0.42, 0.53);
  trim.push(med, ring, arc(0.72, 0.05, 0, Math.PI, 0, 0.98, 0.6, 32), arc(0.42, 0.035, 0.2, Math.PI - 0.2, 0, 1.0, 0.6, 24), sphere(0.08, 0, 1.76, 0.6, 12));
  const arch = new THREE.Shape();
  arch.absarc(0, 0, 0.7, 0, Math.PI, false);
  arch.closePath();
  const archG = new THREE.ExtrudeGeometry(arch, { depth: 0.1, bevelEnabled: false, curveSegments: 24 });
  archG.translate(0, 0.98, 0.55);
  frame.push(archG);
  const backC = new RoundedBoxGeometry(1.2, 0.86, 0.14, 3, 0.06);
  backC.translate(0, -0.06, 0.48);
  return { frame, cushion: [box(1.34, 0.18, 1.08, 0, -0.5, -0.04, 0.08), backC], trim };
}

const BUILD: Record<ChairKind, () => Parts> = { plain, carved, deco, teahouse, parlour, majlis, luxe, throne };

function merge(list: THREE.BufferGeometry[]) {
  if (!list.length) return null;
  const geo = mergeGeometries(
    list.map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k);
      return n;
    }),
  );
  for (const g of list) g.dispose();
  return geo;
}

/** The four chairs. Built once per chair style and recoloured per room. */
export class ChairSet {
  readonly group = new THREE.Group();
  private kind: ChairKind | '' = '';
  private geos: THREE.BufferGeometry[] = [];
  private frameMat = new THREE.MeshPhysicalMaterial({ color: '#16100c', roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.12 });
  private cushionMat = new THREE.MeshStandardMaterial({ color: '#3a1a1a', roughness: 0.7, metalness: 0 });
  private trimMat = new THREE.MeshStandardMaterial({ color: '#c9a46a', metalness: 1, roughness: 0.32 });

  /** Dress the chairs for a room. */
  set(e: EnvironmentStyle) {
    const kind = CHAIR_FOR_ROOM[e.id] ?? 'plain';
    this.frameMat.color.set(e.chair[0]);
    this.cushionMat.color.set(e.chair[1]);
    this.cushionMat.roughness = CLOTH[kind];
    this.trimMat.color.set(TRIM[kind].color);
    this.trimMat.roughness = TRIM[kind].roughness;
    // The penthouse's pale frame is matte; the dark lacquers keep their gloss.
    this.frameMat.clearcoat = kind === 'luxe' || kind === 'majlis' ? 0.3 : 1;
    this.frameMat.roughness = kind === 'teahouse' || kind === 'majlis' ? 0.55 : 0.4;
    if (kind !== this.kind) this.build(kind);
  }

  private build(kind: ChairKind) {
    this.kind = kind;
    this.group.clear();
    for (const g of this.geos) g.dispose();
    const parts = BUILD[kind]();
    const frame = merge(parts.frame);
    const cushion = merge(parts.cushion);
    const trim = merge(parts.trim);
    this.geos = [frame, cushion, trim].filter((g): g is THREE.BufferGeometry => !!g);
    // The throne stands a little larger than the rest.
    const scale = kind === 'throne' ? 1.06 : 1;
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      if (frame) {
        const f = new THREE.Mesh(frame, this.frameMat);
        f.castShadow = true;
        g.add(f);
      }
      if (cushion) g.add(new THREE.Mesh(cushion, this.cushionMat));
      if (trim) g.add(new THREE.Mesh(trim, this.trimMat));
      const a = (i * Math.PI) / 2;
      g.position.set(Math.sin(a) * 5.9, (scale - 1) * -FLOOR, Math.cos(a) * 5.9);
      g.rotation.y = a;
      g.scale.setScalar(scale);
      this.group.add(g);
    }
  }
}
