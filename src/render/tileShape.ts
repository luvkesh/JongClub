// The one tile shape every 3D tile shares: the table, the Atelier portraits, the mini-games and the
// website's showcase pictures all build their tiles from here, so a tile looks the same wherever it
// is shown. The tile is modelled in Blender (scripts/blender/tile_model.py; the Cycles renders of the
// tiles use the very same model): one block bevelled on every edge, cut flush into the body and the
// back so no groove or dark line runs round the join, and a domed metal bezel set round the face plate.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TILE_MESH, type TileMeshPart } from './tileMesh.gen';

export const TW = 0.3,
  TH = 0.4,
  TD = 0.22;
/** Radius of the block's bevelled edges (tile_model.py EDGE_R). */
export const EDGE_R = 0.03;
/** The body slab's depth range (z): TD * 0.64 deep, its front at the tile's front. */
export const BODY_Z0 = TD / 2 - TD * 0.64,
  BODY_Z1 = TD / 2;
/** The face plate: a rounded rectangle on the body's front (half sizes), sitting just proud of it. */
export const FACE_HW = 0.116,
  FACE_HH = 0.161,
  FACE_R = 0.016,
  FACE_LIFT = 0.0012;

/**
 * Blender's tile (scripts/blender/tile_model.py, exported into tileMesh.gen.ts): the block bevelled on
 * every edge and cut flush into the body and the back, and the bezel, a domed band of real geometry
 * round the face plate. `metal` marks the bezel's vertices (shadeBody gives them the set's trim metal).
 * UVs are box-projected as the old rounded box's were: the back's frame spans the whole back face.
 */
function fromBlender(part: TileMeshPart, metal = 0) {
  const g = new THREE.BufferGeometry();
  const n = part.p.length / 3;
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const x = part.p[i * 3],
      y = part.p[i * 3 + 1],
      z = part.p[i * 3 + 2];
    const nx = part.n[i * 3],
      ny = part.n[i * 3 + 1],
      nz = part.n[i * 3 + 2];
    const ax = Math.abs(nx) > Math.abs(ny) ? (Math.abs(nx) > Math.abs(nz) ? 0 : 2) : Math.abs(ny) > Math.abs(nz) ? 1 : 2;
    let u: number, v: number;
    if (metal) (u = 0.5), (v = 0.5);
    else if (ax === 2) (u = nz > 0 ? 0.5 + x / TW : 0.5 - x / TW), (v = 0.5 + y / TH);
    else if (ax === 0) (u = 0.5 + (z / TD) * (nx < 0 ? 1 : -1)), (v = 0.5 + y / TH);
    else (u = 0.5 + x / TW), (v = 0.5 + z / TD);
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(part.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(part.n, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('metal', new THREE.BufferAttribute(new Float32Array(n).fill(metal), 1));
  g.setIndex(part.t);
  return g;
}

/** The face plate: a rounded rectangle with 0..1 UVs, so the face texture fills it corner to corner. */
function facePlate(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2,
    y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(s, 8);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - x) / w, (p.getY(i) - y) / h);
  return g;
}

/**
 * The tile's three parts, in tile space (face toward +z, centred): `body` (the face block, with the
 * bezel), `back` (the coloured back) and `face` (the plate the face texture goes on). `seg`: smoothness;
 * up to 3 is the table's lean model, above that the finer one the portraits use.
 */
export function tileGeometry(seg = 3) {
  const lod = TILE_MESH[seg > 3 ? 'hi' : 'lo'];
  const body = mergeGeometries([fromBlender(lod.body), fromBlender(lod.rim, 1)])!;
  body.computeBoundingBox();
  body.computeBoundingSphere();
  const back = fromBlender(lod.back);
  back.computeBoundingBox();
  back.computeBoundingSphere();
  const face = facePlate(FACE_HW * 2, FACE_HH * 2, FACE_R);
  face.translate(0, 0, TD / 2 + FACE_LIFT);
  return { body, back, face };
}
