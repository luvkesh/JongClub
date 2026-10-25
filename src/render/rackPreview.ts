// Atelier previews of the tile racks: the real rack geometry and materials
// (racks.ts, rackLook.ts) with a few of your equipped tiles standing on it,
// rendered once into an image. One small offscreen renderer does every
// preview and is released when the screen stops asking for them.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { rackStyle } from '../cosmetics/racks';
import { HAND_LEAN, HAND_RAISE, rackSegment, type HumanRackFit } from './racks';
import { disposeRackMaterials, rackMaterials } from './rackLook';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { currentTileSet, drawFace } from './tileFaces';
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
  const ts = currentTileSet();
  const felt = '#17402f';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a0d0b');
  scene.environment = env;
  scene.environmentIntensity = 0.6;
  const tier = detectQuality(r.getContext()) === 'low' ? 'medium' : 'high';
  // The table's own wood, for the table-matched rack.
  const tableWood = new THREE.MeshPhysicalMaterial({ color: '#3b2416', roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const tableTrim = new THREE.MeshStandardMaterial({ color: '#c9a46a', metalness: 1, roughness: 0.3 });
  const mats = rackMaterials(st, tier, { wood: tableWood, trim: tableTrim, felt }, 8);
  const s = 1.32,
    z = 3.98;
  const fit: HumanRackFit = { scale: s, z, tw: TW, th: TH, td: TD };
  const length = KINDS.length * (TW * s + 0.012) + 0.3;
  const rack = rackSegment(st, mats, 'human', length, fit);
  rack.position.z = -z;
  scene.add(rack);
  // Felt under the rack.
  const feltMat = new THREE.MeshStandardMaterial({ color: felt, roughness: 0.95 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), feltMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // Your tiles standing on it, leaning back as at the table.
  const body = new RoundedBoxGeometry(TW, TH, TD * 0.64, 3, 0.035);
  body.translate(0, 0, TD * 0.18);
  const back = new RoundedBoxGeometry(TW, TH, TD * 0.4, 3, 0.035);
  back.translate(0, 0, -TD * 0.3);
  const face = new THREE.PlaneGeometry(TW * 0.84, TH * 0.86);
  face.translate(0, 0, TD / 2 + 0.0015);
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: ts.body, roughness: 0.3, clearcoat: 0.5 });
  const backMat = new THREE.MeshPhysicalMaterial({ color: ts.back, roughness: 0.25, clearcoat: 0.8 });
  const faceTex: THREE.Texture[] = [];
  const faceMats: THREE.Material[] = [];
  const step = TW * s + 0.012;
  KINDS.forEach((k, i) => {
    const t = new THREE.CanvasTexture(drawFace(k, false));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    faceTex.push(t);
    const fm = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.32 });
    faceMats.push(fm);
    const g = new THREE.Group();
    const a = new THREE.Mesh(body, bodyMat);
    const b = new THREE.Mesh(back, backMat);
    a.castShadow = b.castShadow = true;
    g.add(a, b, new THREE.Mesh(face, fm));
    g.scale.setScalar(s);
    g.rotation.x = -HAND_LEAN;
    g.position.set((i - (KINDS.length - 1) / 2) * step, (TH * s) / 2 + 0.03 + HAND_RAISE, 0);
    scene.add(g);
  });
  // A warm key from above left, a cool rim from behind and a soft fill.
  const key = new THREE.DirectionalLight('#ffe2b8', 2.6);
  key.position.set(-2.5, 4, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const sc = key.shadow.camera as THREE.OrthographicCamera;
  sc.left = sc.bottom = -2.5;
  sc.right = sc.top = 2.5;
  key.shadow.bias = -0.0005;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#9fc7ff', 0.8);
  rim.position.set(2, 2, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight('#fff0dc', 1.1);
  fill.position.set(-1, 0.6, 4);
  scene.add(fill);
  scene.add(new THREE.AmbientLight('#ffffff', 0.25));
  const cam = new THREE.PerspectiveCamera(32, W / H, 0.05, 50);
  cam.position.set(-2.35, 0.62, 1.55);
  cam.lookAt(-0.25, 0.16, 0.12);
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/webp', 0.9);
  // Free everything this picture made.
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.parent === rack) m.geometry.dispose();
  });
  for (const g of [body, back, face, ground.geometry]) g.dispose();
  for (const m of [bodyMat, backMat, feltMat, tableWood, tableTrim, ...faceMats]) m.dispose();
  for (const t of faceTex) t.dispose();
  disposeRackMaterials(mats);
  key.shadow.map?.dispose();
  return url;
}
