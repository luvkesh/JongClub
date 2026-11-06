// Atelier previews of the tile racks: the real rack geometry and materials
// (racks.ts, rackLook.ts) with a few of your equipped tiles standing on it,
// rendered once into an image. One small offscreen renderer does every
// preview and is released when the screen stops asking for them.

import * as THREE from 'three';
import { rackStyle } from '../cosmetics/racks';
import { HAND_LEAN, HAND_RAISE, rackSegment, type HumanRackFit } from './racks';
import { disposeRackMaterials, rackMaterials } from './rackLook';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { currentTileSet, mix } from './tileFaces';
import { jewelStudio, jewelTiles } from './tilePicture';
import { detectQuality } from './quality';

const W = 480,
  H = 264;
const TW = 0.3,
  TH = 0.4,
  TD = 0.22;
const cache = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null;
let env: THREE.Texture | null = null;
let idle = 0;

function release() {
  env?.dispose();
  env = null;
  renderer?.dispose();
  renderer?.forceContextLoss();
  renderer = null;
}

function getRenderer() {
  clearTimeout(idle);
  idle = window.setTimeout(release, 1500);
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(2);
    renderer.setSize(W, H, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // A bright studio for reflections, as for a jewellery shot.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    env = pmrem.fromScene(room, 0.03).texture;
    room.dispose();
    pmrem.dispose();
  }
  return renderer;
}

/** The shared offscreen renderer and its studio reflections, for other one-off pictures (tilePicture.ts). */
export function previewRenderer() {
  const r = getRenderer();
  return { renderer: r, env };
}

const KINDS = [27, 31, 0, 13, 22, 33];

/** A data URL picture of the rack `id` holding a few of your tiles. Cached per rack and tile set. */
export function rackPreview(id: string): string {
  const ts = currentTileSet();
  const key = `${id}:${ts.id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let url = '';
  try {
    url = render(id);
  } catch {
    url = '';
  }
  if (url) cache.set(key, url);
  return url;
}

function render(id: string) {
  const r = getRenderer();
  const st = rackStyle(id);
  const felt = '#17402f';
  const tier = detectQuality(r.getContext()) === 'low' ? 'medium' : 'high';
  // The rack in the jeweller's window the tile sets use (tilePicture.ts), before velvet of its own lining.
  const studio = jewelStudio(W, H, mix(st.lining || felt, '#0b0d0c', 0.35), { scale: 1.8, floor: 0.7, shine: 0.2, fog: [3.6, 6.2] });
  // The table's own wood, for the table-matched rack.
  const tableWood = new THREE.MeshPhysicalMaterial({ color: '#3b2416', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 });
  const tableTrim = new THREE.MeshStandardMaterial({ color: '#c9a46a', metalness: 1, roughness: 0.22, envMapIntensity: 1.3 });
  const mats = rackMaterials(st, tier, { wood: tableWood, trim: tableTrim, felt }, 8);
  const s = 1.32,
    z = 3.98;
  const fit: HumanRackFit = { scale: s, z, tw: TW, th: TH, td: TD };
  const length = KINDS.length * (TW * s + 0.012) + 0.3;
  const rack = rackSegment(st, mats, 'human', length, fit);
  rack.position.z = -z;
  rack.traverse((o) => (o.castShadow = o.receiveShadow = true));
  studio.show(rack);
  // Your tiles standing on it, leaning back as at the table, in their full finish.
  const tiles = jewelTiles();
  const step = TW * s + 0.012;
  KINDS.forEach((k, i) => {
    const g = tiles.tile(k);
    g.scale.setScalar(s);
    g.rotation.x = -HAND_LEAN;
    g.position.set((i - (KINDS.length - 1) / 2) * step, (TH * s) / 2 + 0.03 + HAND_RAISE, 0);
    studio.show(g);
  });
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 50);
  cam.position.set(-2.75, 1.05, 2.1);
  cam.lookAt(-0.12, 0.2, 0.02);
  const url = studio.shoot(cam);
  // Free everything this picture made.
  rack.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.geometry.dispose();
  });
  for (const m of [tableWood, tableTrim]) m.dispose();
  tiles.dispose();
  disposeRackMaterials(mats);
  return url;
}
