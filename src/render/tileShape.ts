// The one tile shape every 3D tile shares: the table, the Atelier portraits, the mini-games and the
// website's showcase pictures all build their tiles from here, so a tile looks the same wherever it
// is shown. A tile is two slabs that meet flush (the body, rounded only at the front, and the back,
// rounded only at the back), so no groove or dark line runs round the join; the face is a rounded
// plate set inside a polished metal bezel that shadeBody (tileMaterials.ts) lays on the body's front.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const TW = 0.3,
  TH = 0.4,
  TD = 0.22;
/** Radius of the slabs' rounded edges. */
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
 * The bezel round the face plate (half sizes of its outer edge, corner radius, width). The plate covers
 * its inner part; the rest shows as a polished band with a rounded profile, all inside the flat front.
 */
export const BEZEL_HW = 0.1205,
  BEZEL_HH = 0.1665,
  BEZEL_R = 0.022,
  BEZEL_W = 0.0105;

/**
 * A slab `d` deep, rounded on one side only: at the front (+z) when `front`, else at the back. The other
 * end is cut square so two slabs meet flush. Centred on z = 0.
 */
function slab(w: number, h: number, d: number, seg: number, front: boolean) {
  const g = new RoundedBoxGeometry(w, h, d * 2, seg, EDGE_R);
  const p = g.attributes.position;
  const n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    let z = p.getZ(i);
    if (front ? z < 0 : z > 0) {
      z = 0;
      // The squared-off end lies inside the other slab: its normals point straight out of it.
      n.setXYZ(i, 0, 0, front ? -1 : 1);
    }
    p.setZ(i, (front ? z - d / 2 : z + d / 2));
  }
  g.computeBoundingBox();
  g.computeBoundingSphere();
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
 * The tile's three parts, in tile space (face toward +z, centred): `body` (the face block), `back` (the
 * coloured back) and `face` (the plate the face texture goes on). `seg`: smoothness of the rounded edges.
 */
export function tileGeometry(seg = 3) {
  const body = slab(TW, TH, BODY_Z1 - BODY_Z0, seg, true);
  body.translate(0, 0, (BODY_Z0 + BODY_Z1) / 2);
  const back = slab(TW, TH, BODY_Z0 + TD / 2, seg, false);
  back.translate(0, 0, (BODY_Z0 - TD / 2) / 2);
  const face = facePlate(FACE_HW * 2, FACE_HH * 2, FACE_R);
  face.translate(0, 0, TD / 2 + FACE_LIFT);
  return { body, back, face };
}
