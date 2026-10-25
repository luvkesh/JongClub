// 3D icons for the mini-game cards, rendered from your equipped tile set: a
// small model per game (a solitaire stack, a cube, a tray...) turned through
// 24 frames into a sprite sheet that plays the Play screen's sway on hover
// (.mode-icon in cards.css). One offscreen renderer draws them all and is
// released shortly after; sheets are cached per game, tile set and size, in
// memory and on the device (IndexedDB), so each is drawn once.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { TD, TH, TW } from '../render/table3d';
import { currentTileSet, drawFace } from '../render/tileFaces';
import { applyTileFinish } from '../render/tileMaterials';
import type { MiniGameDef } from './types';

/** Card icon size in CSS pixels (minigames.css: .mini-medal). */
const CSS_PX = 144;
/** Frame size in pixels: the card icon at 3x, a little over for zoom, so it is crisp on every screen. */
const F = Math.min(384, Math.ceil(CSS_PX * 3 * 1.15));
/** Each frame is drawn at twice its size and scaled down: clean edges and sharp ink. */
const SUPER = 2;
const FRAMES = 24;
const VERSION = 'v4';
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
  idle = window.setTimeout(release, 2000);
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(SUPER);
    renderer.setSize(F, F, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // As at the table: ivory stays ivory and the ink keeps its full colour (no blown-out white).
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 0.92;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    env = pmrem.fromScene(room, 0.03).texture;
    room.dispose();
    pmrem.dispose();
  }
  return renderer;
}

const keyOf = (def: MiniGameDef) => `${VERSION}:${def.id}:${currentTileSet().id}:${F}`;

/** A sprite sheet data URL for a game's card icon (empty when WebGL is unavailable). */
export function miniIcon(def: MiniGameDef): string {
  const key = keyOf(def);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let url = '';
  try {
    url = render(def);
  } catch {
    url = '';
  }
  cache.set(key, url);
  if (url) void store(key, url);
  return url;
}

// ------------------------------------------------------------ device cache

const DB = 'jongclub-mini-icons';
let dbp: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  dbp ??= new Promise((res) => {
    try {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('icons');
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(null);
    } catch {
      res(null);
    }
  });
  return dbp;
}
async function load(key: string): Promise<string | null> {
  const d = await db();
  if (!d) return null;
  return new Promise((res) => {
    try {
      const rq = d.transaction('icons').objectStore('icons').get(key);
      rq.onsuccess = () => res(typeof rq.result === 'string' ? rq.result : null);
      rq.onerror = () => res(null);
    } catch {
      res(null);
    }
  });
}
async function store(key: string, url: string) {
  const d = await db();
  if (!d) return;
  try {
    const tx = d.transaction('icons', 'readwrite');
    const os = tx.objectStore('icons');
    // Older sizes and versions of this icon (same game and tile set) go.
    const rq = os.getAllKeys();
    rq.onsuccess = () => {
      const [, game, set] = key.split(':');
      for (const k of rq.result) {
        if (typeof k !== 'string' || k === key) continue;
        const [, g, ts] = k.split(':');
        if (g === game && ts === set) os.delete(k);
      }
      os.put(url, key);
    };
  } catch {
    /* storage unavailable */
  }
}

// Icons are drawn one at a time in idle time, never all in one frame, and never while
// a mini-game is being played: each takes a few dozen milliseconds (24 frames and an image encode).
const queue: { def: MiniGameDef; cb: (url: string) => void }[] = [];
let queueTimer = 0;
let held = false;

/** Ask for a game's icon; `cb` gets the sheet when it is ready (at once if cached). */
export function requestMiniIcon(def: MiniGameDef, cb: (url: string) => void) {
  const key = keyOf(def);
  const hit = cache.get(key);
  if (hit !== undefined) return cb(hit);
  const job = { def, cb };
  queue.push(job);
  // Drawn before on this device: use that, no drawing at all.
  void load(key).then((url) => {
    if (!url) return pump();
    cache.set(key, url);
    const i = queue.indexOf(job);
    if (i >= 0) queue.splice(i, 1);
    cb(url);
  });
}

/** Drop icons not drawn yet (the page that wanted them has gone). */
export function cancelMiniIcons() {
  queue.length = 0;
}

/** Hold icon drawing while a mini-game is on screen. */
export function holdMiniIcons(on: boolean) {
  held = on;
  if (!on) pump();
}

function pump() {
  if (queueTimer || held || !queue.length) return;
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  const run = () => {
    queueTimer = 0;
    if (held) return;
    const job = queue.shift();
    if (job) {
      // Another card may have asked for the same icon while this one waited.
      const hit = cache.get(keyOf(job.def));
      job.cb(hit ?? miniIcon(job.def));
    }
    pump();
  };
  queueTimer = ric ? ric(run, { timeout: 700 }) : window.setTimeout(run, 40);
}

function render(def: MiniGameDef): string {
  const r = getRenderer();
  const scene = new THREE.Scene();
  scene.environment = env;
  // Neutral white light, no green bounce from the felt: the tiles keep their true ivory and the ink its colour.
  // One clear key light and gentle fill: modelled sides, rich colour, nothing washed out.
  scene.environmentIntensity = 0.45;
  const key = new THREE.DirectionalLight('#fffaf0', 2.3);
  key.position.set(2.5, 4, 3);
  const fill = new THREE.DirectionalLight('#ffffff', 0.35);
  fill.position.set(-3, 2, 4);
  scene.add(key, fill, new THREE.HemisphereLight('#ffffff', '#5b5750', 0.3));

  const bodyMat = new THREE.MeshPhysicalMaterial({ color: '#f3ead6', roughness: 0.3 });
  const backMat = new THREE.MeshPhysicalMaterial({ color: '#1f5a46', roughness: 0.25 });
  const faceMats = new Map<number, THREE.MeshStandardMaterial>();
  const texes: THREE.Texture[] = [];
  const faceMat = (k: number) => {
    let m = faceMats.get(k);
    if (!m) {
      // Scale 3 is ample for a face a few dozen pixels across, and it is the canvas the table keeps
      // already on most devices, so no extra large canvases are cached.
      const t = new THREE.CanvasTexture(drawFace(k, false, false, 3));
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      texes.push(t);
      m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.12, roughness: 0.32 });
      faceMats.set(k, m);
    }
    return m;
  };
  const body = new RoundedBoxGeometry(TW, TH, TD * 0.64, 3, 0.035);
  body.translate(0, 0, TD * 0.18);
  const back = new RoundedBoxGeometry(TW, TH, TD * 0.4, 3, 0.035);
  back.translate(0, 0, -TD * 0.3);
  const face = new THREE.PlaneGeometry(TW * 0.84, TH * 0.86);
  face.translate(0, 0, TD / 2 + 0.0015);
  const C = TW * 1.1;
  const cubeBody = new RoundedBoxGeometry(C, C, C, 3, C * 0.12);
  const cubeFace = new THREE.PlaneGeometry(C * 0.66, C * 0.86);
  cubeFace.translate(0, 0, C / 2 + 0.002);
  const geos: THREE.BufferGeometry[] = [body, back, face, cubeBody, cubeFace];
  const mats: THREE.Material[] = [];

  const model = new THREE.Group();
  scene.add(model);
  const tile = (k: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(body, bodyMat), new THREE.Mesh(back, backMat), new THREE.Mesh(face, faceMat(k)));
    g.position.set(x, y, z);
    g.rotation.set(rx, ry, rz, 'YXZ');
    model.add(g);
    return g;
  };
  const flat = -Math.PI / 2;
  const cube = (k: number, x: number, y: number, z: number) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(cubeBody, bodyMat));
    const m = faceMat(k);
    for (const [rx, ry] of [
      [0, 0],
      [0, Math.PI / 2],
      [0, -Math.PI / 2],
      [0, Math.PI],
      [-Math.PI / 2, 0],
    ]) {
      const f = new THREE.Mesh(cubeFace, m);
      f.rotation.set(rx, ry, 0, 'YXZ');
      g.add(f);
    }
    g.position.set(x, y, z);
    model.add(g);
  };
  const ks = def.icon.kinds;
  const k = (i: number) => ks[i % ks.length];
  let tiltX = 0.5;
  switch (def.icon.shape) {
    case 'stack': {
      // A little solitaire pyramid: three, two, one.
      const w = TW + 0.01;
      [-1, 0, 1].forEach((i, n) => tile(k(n + 2), i * w, TD / 2, 0.12, flat));
      [-0.5, 0.5].forEach((i, n) => tile(k(n), i * w, TD * 1.5 + 0.004, 0.12, flat));
      tile(k(4), 0, TD * 2.5 + 0.008, 0.12, flat);
      tile(k(0), 0, TD / 2, -0.32, flat);
      tiltX = 0.75;
      break;
    }
    case 'tower':
      for (let z = 0; z < 5; z++) for (const [x, y] of [[-0.5, 0], [0.5, 0], [0, -1]] as const) if (z < 4 || x === 0) tile(k(z + x * 2), x * (TW + 0.01) * (z < 4 ? 1 : 0), TD / 2 + z * (TD + 0.004), y * (TH * 0.5), flat);
      tiltX = 0.45;
      break;
    case 'pair':
      tile(k(0), -TW * 0.56, TH / 2, 0, -0.12, 0.25, 0.05);
      tile(k(1), TW * 0.56, TH / 2, 0, -0.12, -0.25, -0.05);
      tiltX = 0.2;
      break;
    case 'fan':
      for (let i = 0; i < 5; i++) tile(k(i), (i - 2) * TW * 0.45, TH / 2 + Math.cos((i - 2) * 0.35) * 0.04, Math.abs(i - 2) * 0.03, -0.1, 0, -(i - 2) * 0.28);
      tiltX = 0.15;
      break;
    case 'tray': {
      const tray = new THREE.Mesh(new RoundedBoxGeometry(TW * 3.7, 0.05, TD * 1.6, 3, 0.02), new THREE.MeshPhysicalMaterial({ color: '#6b3b20', roughness: 0.35, clearcoat: 0.8 }));
      tray.position.y = 0.025;
      model.add(tray);
      for (let i = 0; i < 3; i++) tile(k(0), (i - 1) * (TW + 0.02), TH / 2 + 0.05, 0, -0.18);
      tile(k(1), 0.2, TD / 2, 0.55, flat, 0.4);
      tiltX = 0.3;
      break;
    }
    case 'cube':
      for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) cube(k(x + y * 2 + z * 3), (x - 0.5) * (C + 0.01), C / 2 + y * (C + 0.01), (z - 0.5) * (C + 0.01));
      tiltX = 0.55;
      break;
    case 'hourglass': {
      // An hourglass in a turned wooden frame, sand running, with a tile stood beside it.
      const wood = new THREE.MeshPhysicalMaterial({ color: '#6b3b20', roughness: 0.35, clearcoat: 0.8 });
      const glass = new THREE.MeshPhysicalMaterial({ color: '#eef6f2', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1 });
      const sand = new THREE.MeshStandardMaterial({ color: '#d9a650', roughness: 0.8, emissive: '#5a3a10', emissiveIntensity: 0.25 });
      const brass = new THREE.MeshStandardMaterial({ color: '#e2bd6c', metalness: 0.75, roughness: 0.3 });
      mats.push(wood, glass, sand, brass);
      const H = 0.6;
      const prof = [
        [0.0, 0.04], [0.1, 0.045], [0.13, 0.12], [0.11, 0.2], [0.03, 0.27], [0.022, 0.3], [0.03, 0.33], [0.11, 0.4], [0.13, 0.48], [0.1, 0.555], [0.0, 0.56],
      ].map(([r, y]) => new THREE.Vector2(r, y));
      const parts: [THREE.BufferGeometry, THREE.Material, number, number][] = [
        [new THREE.LatheGeometry(prof, 48), glass, 0, 0],
        [new THREE.CylinderGeometry(0.17, 0.17, 0.035, 48), wood, 0, 0.0175],
        [new THREE.CylinderGeometry(0.17, 0.17, 0.035, 48), wood, 0, H - 0.0175],
        [new THREE.TorusGeometry(0.17, 0.008, 8, 48), brass, 0, 0.035],
        [new THREE.TorusGeometry(0.17, 0.008, 8, 48), brass, 0, H - 0.035],
        [new THREE.CylinderGeometry(0.02, 0.112, 0.085, 40), sand, 0, 0.0875],
        [new THREE.CylinderGeometry(0.095, 0.022, 0.07, 40), sand, 0, 0.29 + 0.07],
        [new THREE.CylinderGeometry(0.004, 0.004, 0.2, 8), sand, 0, 0.23],
      ];
      for (const [g, m, , y] of parts) {
        const mesh = new THREE.Mesh(g, m);
        mesh.position.y = y;
        if (g instanceof THREE.TorusGeometry) mesh.rotation.x = Math.PI / 2;
        model.add(mesh);
        geos.push(g);
      }
      const post = new THREE.CylinderGeometry(0.012, 0.012, H - 0.07, 16);
      geos.push(post);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        const m = new THREE.Mesh(post, wood);
        m.position.set(Math.cos(a) * 0.15, H / 2, Math.sin(a) * 0.15);
        model.add(m);
      }
      model.children.forEach((c) => (c.position.x -= 0.09));
      // The glass draws after the solid parts so the sand shows through it.
      model.children[0].renderOrder = 1;
      tile(k(0), 0.2, TH / 2, 0.1, -0.06, -0.4, 0.02);
      tiltX = 0.22;
      break;
    }
    case 'grid':
    case 'path': {
      const w = TW + 0.015,
        hh = TH + 0.015;
      for (let x = 0; x < 3; x++) for (let y = 0; y < 2; y++) tile(k(x + y * 3), (x - 1) * w, TD / 2, (y - 0.5) * hh, flat);
      // A gold path joining the corners, as in Mahjong Connect.
      const gold = new THREE.MeshStandardMaterial({ color: '#f0cf7e', emissive: '#a77d2c', emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3 });
      const pts = [new THREE.Vector3(-w, TD + 0.03, -hh / 2), new THREE.Vector3(-w, TD + 0.03, hh), new THREE.Vector3(w, TD + 0.03, hh), new THREE.Vector3(w, TD + 0.03, hh / 2)];
      const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.05), 32, 0.018, 6), gold);
      model.add(line);
      geos.push(line.geometry);
      tiltX = 0.9;
      break;
    }
  }
  // Frame the model: centre it and fit the camera to its bounds.
  const box = new THREE.Box3().setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  model.position.sub(c);
  const pivot = new THREE.Group();
  scene.remove(model);
  pivot.add(model);
  scene.add(pivot);
  const radius = box.getSize(new THREE.Vector3()).length() / 2;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  // Tall and boxy models (the tower, the cube) sit a little further back so they stay inside the medallion.
  const dist = (radius / Math.sin(THREE.MathUtils.degToRad(15))) * (def.icon.shape === 'cube' || def.icon.shape === 'tower' ? 0.98 : 0.84);
  cam.position.set(0, Math.sin(tiltX) * dist, Math.cos(tiltX) * dist);
  cam.lookAt(0, 0, 0);

  applyTileFinish([bodyMat], backMat, [...faceMats.values()], false);

  const sheet = document.createElement('canvas');
  sheet.width = F * FRAMES;
  sheet.height = F;
  const g2 = sheet.getContext('2d')!;
  g2.imageSmoothingEnabled = true;
  g2.imageSmoothingQuality = 'high';
  for (let f = 0; f < FRAMES; f++) {
    pivot.rotation.y = Math.sin((f / FRAMES) * Math.PI * 2) * 0.32 + (def.icon.shape === 'cube' ? 0.6 : 0);
    r.render(scene, cam);
    g2.drawImage(r.domElement, f * F, 0, F, F);
  }
  for (const g of geos) g.dispose();
  for (const t of texes) t.dispose();
  for (const m of [bodyMat, backMat, ...faceMats.values(), ...mats]) m.dispose();
  return sheet.toDataURL('image/webp', 0.94);
}
