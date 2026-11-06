// 3D coloured icons for the website's numbers band (Variations, Destinations, Tile sets, Rooms):
// one small rendered object per number on a transparent ground, lit like the "And the Details"
// medallions. The tiles are the game's own (tilePicture.ts jewelTiles). Run in the game's dev
// server from website/tools/staticons.mjs.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { setTileSet } from '../../src/render/tileFaces';
import { jewelTiles } from '../../src/render/tilePicture';

export type StatKey = 'variations' | 'destinations' | 'tilesets' | 'rooms';

let renderer: THREE.WebGLRenderer | null = null;
let env: THREE.Texture | null = null;

function getRenderer(size: number, dpr: number) {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    env = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
  }
  renderer.setPixelRatio(dpr);
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

const own: THREE.Texture[] = [];
function tex(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 16;
  own.push(t);
  return t;
}

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const gold = (rough = 0.16, color = '#e9c27a') =>
  new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: rough, clearcoat: 0.4, clearcoatRoughness: 0.08, envMapIntensity: 1.25 });

const lacquer = (color: string, rough = 0.22) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1 });

function glowSprite(): THREE.Texture {
  const [c, g] = canvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.18, 'rgba(255,255,255,0.65)');
  gr.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return tex(c);
}

/** A soft contact shadow on the (invisible) floor, so each object sits on something. */
function contactShadow(root: THREE.Object3D, w: number, d: number, y: number, opacity = 0.75) {
  const [c, g] = canvas(256, 256);
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(0.5, 'rgba(0,0,0,0.55)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.renderOrder = -1;
  root.add(m);
}

function lights(scene: THREE.Scene) {
  const key = new THREE.SpotLight('#fff0d8', 34, 0, 0.55, 0.9, 1.4);
  key.position.set(-1.8, 3.0, 3.4);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 8;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.01;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 9;
  scene.add(key, key.target);
  for (const sx of [-1, 1]) {
    const rim = new THREE.SpotLight('#ffc674', 20, 0, 0.6, 0.9, 1.4);
    rim.position.set(sx * 2.4, 1.8, -1.2);
    rim.target.position.set(0, 0, 0);
    scene.add(rim, rim.target);
  }
  const fill = new THREE.DirectionalLight('#ffe2bf', 0.7);
  fill.position.set(2.2, 0.4, 3);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight('#ffe9cc', '#120c06', 0.4));
}

function shadows(o: THREE.Object3D) {
  o.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

// ------------------------------------------------------------ Variations: a fan of five tiles

function buildVariations(root: THREE.Group, kits: { dispose(): void }[]) {
  setTileSet('classic-ivory');
  const kit = jewelTiles({ seg: 8, faceScale: 4, anisotropy: 16 });
  kits.push(kit);
  // One of each family, all different: Character, Dots, Bamboo, Red Dragon, Flower.
  const kinds = [0, 13, 18, 31, 34];
  const fan = new THREE.Group();
  kinds.forEach((k, i) => {
    const t = kit.tile(k);
    const a = (i - 2) * 0.4;
    const p = new THREE.Group();
    t.position.set(0, 0.52, 0);
    p.add(t);
    p.rotation.z = -a;
    p.position.z = i * 0.03;
    fan.add(p);
  });
  fan.scale.setScalar(1.38);
  fan.position.set(0.03, -0.66, 0);
  fan.rotation.set(-0.1, -0.3, 0);
  shadows(fan);
  root.add(fan);
}

// ------------------------------------------------------------ Destinations: a lapis and gold globe

function hash3(x: number, y: number, z: number) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const s = (t: number) => t * t * (3 - 2 * t);
  const fx = s(x - xi), fy = s(y - yi), fz = s(z - zi);
  let v = 0;
  for (let dz = 0; dz < 2; dz++)
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++)
        v += hash3(xi + dx, yi + dy, zi + dz) * (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
  return v;
}
function fbm(x: number, y: number, z: number) {
  let v = 0, a = 0.5, f = 1;
  for (let o = 0; o < 5; o++) {
    v += a * vnoise(x * f + 11.3, y * f + 3.7, z * f + 7.1);
    a *= 0.5;
    f *= 2.03;
  }
  return v;
}

function globeTextures() {
  const W = 1024, H = 512;
  const [c, g] = canvas(W, H);
  const [s, sg] = canvas(W, H);
  const col = g.createImageData(W, H);
  const sur = sg.createImageData(W, H);
  for (let j = 0; j < H; j++) {
    const lat = (0.5 - j / H) * Math.PI;
    for (let i = 0; i < W; i++) {
      const lon = (i / W) * Math.PI * 2;
      const x = Math.cos(lat) * Math.cos(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.sin(lon);
      const n = fbm(x * 1.7, y * 1.7, z * 1.7) + (Math.abs(y) > 0.9 ? 0.15 : 0);
      const k = (j * W + i) * 4;
      const land = n > 0.53;
      const coast = Math.abs(n - 0.53) < 0.008;
      if (land || coast) {
        // Gold leaf continents, a touch darker inland.
        const t = Math.min(1, (n - 0.53) * 6);
        col.data[k] = 236 - t * 30;
        col.data[k + 1] = 196 - t * 28;
        col.data[k + 2] = 120 - t * 30;
        sur.data[k + 1] = coast ? 90 : 70 + t * 40; // roughness (G)
        sur.data[k + 2] = 255; // metalness (B)
      } else {
        // Lapis seas: deep blue with a little depth variation and fine gold flecks.
        const d = Math.max(0, 0.53 - n) * 2.4;
        const fleck = hash3(i, j, 9) > 0.9985;
        col.data[k] = fleck ? 230 : 14 + 14 * (1 - d);
        col.data[k + 1] = fleck ? 190 : 34 + 26 * (1 - d);
        col.data[k + 2] = fleck ? 120 : 92 + 50 * (1 - d);
        sur.data[k + 1] = fleck ? 60 : 60;
        sur.data[k + 2] = fleck ? 255 : 0;
      }
      col.data[k + 3] = 255;
      sur.data[k] = 255;
      sur.data[k + 3] = 255;
    }
  }
  g.putImageData(col, 0, 0);
  // Gold graticule: a few latitudes and meridians.
  g.strokeStyle = 'rgba(240,205,130,0.55)';
  g.lineWidth = 1.4;
  for (const la of [-60, -30, 0, 30, 60]) {
    const y = (0.5 - la / 180) * H;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  for (let m = 0; m < 12; m++) {
    const x = (m / 12) * W;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, H);
    g.stroke();
  }
  sg.putImageData(sur, 0, 0);
  return { map: tex(c), surface: tex(s, false) };
}

function buildDestinations(root: THREE.Group) {
  const { map, surface } = globeTextures();
  const R = 0.56;
  const globeMat = new THREE.MeshPhysicalMaterial({ map, metalnessMap: surface, roughnessMap: surface, metalness: 1, roughness: 1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 });
  const tilt = new THREE.Group();
  const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 96), globeMat);
  globe.rotation.y = 2.4;
  tilt.add(globe);
  // The meridian ring and the axis pins.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.06, 0.018, 24, 200), gold(0.14));
  ring.rotation.y = 0.75;
  tilt.add(ring);
  for (const sy of [-1, 1]) {
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.03, 24, 16), gold(0.12));
    pin.position.y = sy * (R + 0.06);
    tilt.add(pin);
  }
  tilt.rotation.z = -0.41;
  tilt.position.y = 0.16;
  root.add(tilt);
  // Stand: a gold stem curving up to the ring's foot, on a walnut and gold base.
  const foot = new THREE.Vector3(0, -(R + 0.06), 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), -0.41).add(new THREE.Vector3(0, 0.16, 0));
  const stemCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.62, 0), new THREE.Vector3(0.02, -0.55, 0), new THREE.Vector3(foot.x * 0.6, (foot.y - 0.55) / 2, 0), foot]);
  tilt.parent!.add(new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 40, 0.024, 16), gold(0.16)));
  const baseWood = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.08, 64), lacquer('#4a2412', 0.3));
  baseWood.position.y = -0.68;
  const baseGold = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 12, 96), gold(0.15));
  baseGold.rotation.x = Math.PI / 2;
  baseGold.position.y = -0.655;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.06, 32), gold(0.15));
  cap.position.y = -0.62;
  root.add(baseWood, baseGold, cap);
  contactShadow(root, 1.2, 0.6, -0.721);
  shadows(root);
  root.rotation.x = 0.12;
}

// ------------------------------------------------------------ Tile sets: three finishes side by side

function buildTileSets(root: THREE.Group, kits: { dispose(): void }[]) {
  const picks: [string, number][] = [
    ['jade', 32],
    ['royal-gold', 35],
    ['cinnabar', 9],
  ];
  const row = new THREE.Group();
  picks.forEach(([set, kind], i) => {
    setTileSet(set);
    const kit = jewelTiles({ seg: 8, faceScale: 4, anisotropy: 16 });
    kits.push(kit);
    const t = kit.tile(kind);
    t.position.set((i - 1) * 0.25, (i - 1) * -0.015, i * 0.16);
    t.rotation.y = -0.42;
    row.add(t);
  });
  row.scale.setScalar(1.8);
  row.position.set(-0.04, 0.02, -0.12);
  row.rotation.x = -0.1;
  shadows(row);
  root.add(row);
  contactShadow(root, 1.7, 0.8, -0.43, 0.65);
}

// ------------------------------------------------------------ Rooms: a little card room

function feltTexture() {
  const [c, g] = canvas(512, 512);
  const gr = g.createRadialGradient(256, 256, 40, 256, 256, 360);
  gr.addColorStop(0, '#1f6a48');
  gr.addColorStop(1, '#0d3a26');
  g.fillStyle = gr;
  g.fillRect(0, 0, 512, 512);
  const r = rng(5);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
    g.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2);
  }
  g.strokeStyle = 'rgba(233,194,122,0.7)';
  g.lineWidth = 4;
  g.strokeRect(36, 36, 440, 440);
  return tex(c);
}

function rugTexture() {
  const [c, g] = canvas(1024, 1024);
  g.fillStyle = '#5e1210';
  g.fillRect(0, 0, 1024, 1024);
  const band = (inset: number, w: number, col: string) => {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.beginPath();
    g.arc(512, 512, 512 - inset, 0, Math.PI * 2);
    g.stroke();
  };
  band(60, 70, '#16224a');
  band(26, 8, '#d8b066');
  band(80, 6, '#d8b066');
  band(150, 4, '#d8b066');
  // A medallion in the middle.
  g.save();
  g.translate(512, 512);
  for (let k = 0; k < 16; k++) {
    g.rotate(Math.PI / 8);
    g.fillStyle = k % 2 ? '#1c2a52' : '#c9963e';
    g.beginPath();
    g.ellipse(0, 150, 26, 90, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#d8b066';
  g.beginPath();
  g.arc(0, 0, 70, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#5e1210';
  g.beginPath();
  g.arc(0, 0, 46, 0, Math.PI * 2);
  g.fill();
  g.restore();
  const r = rng(9);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)';
    g.fillRect(r() * 1024, r() * 1024, 2, 2);
  }
  return tex(c);
}

function buildRooms(root: THREE.Group) {
  const room = new THREE.Group();
  // The rug.
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.02, 128), new THREE.MeshPhysicalMaterial({ map: rugTexture(), roughness: 0.95, sheen: 0.25, sheenColor: new THREE.Color('#c04030') }));
  rug.position.y = -0.01;
  room.add(rug);
  // The table: felt top in a mahogany frame with a gold inlay, four turned legs.
  const H = 0.46, S = 0.92;
  const top = new THREE.Mesh(new THREE.BoxGeometry(S - 0.1, 0.02, S - 0.1), new THREE.MeshPhysicalMaterial({ map: feltTexture(), roughness: 0.95, sheen: 1, sheenColor: new THREE.Color('#4fd08c'), sheenRoughness: 0.4 }));
  top.position.y = H;
  room.add(top);
  const wood = lacquer('#5a2414', 0.25);
  for (const [x, z, w, d] of [
    [0, S / 2 - 0.03, S, 0.06],
    [0, -S / 2 + 0.03, S, 0.06],
    [S / 2 - 0.03, 0, 0.06, S - 0.12],
    [-S / 2 + 0.03, 0, 0.06, S - 0.12],
  ]) {
    const rail = new THREE.Mesh(new RoundedBoxGeometry(w, 0.08, d, 3, 0.02), wood);
    rail.position.set(x, H + 0.01, z);
    room.add(rail);
  }
  const apron = new THREE.Mesh(new THREE.BoxGeometry(S - 0.06, 0.08, S - 0.06), wood);
  apron.position.y = H - 0.06;
  room.add(apron);
  const inlay = new THREE.Mesh(new THREE.BoxGeometry(S - 0.04, 0.012, S - 0.04), gold(0.18));
  inlay.position.y = H - 0.1;
  room.add(inlay);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.022, H - 0.1, 24), wood);
      leg.position.set(sx * (S / 2 - 0.07), (H - 0.1) / 2, sz * (S / 2 - 0.07));
      const shoe = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 16), gold(0.2));
      shoe.position.set(leg.position.x, 0.015, leg.position.z);
      room.add(leg, shoe);
    }
  // Four little walls of tiles on the felt, ivory faces down and jade backs up.
  const tileGeo = new RoundedBoxGeometry(0.055, 0.03, 0.075, 2, 0.008);
  const ivory = new THREE.MeshPhysicalMaterial({ color: '#fbf8f1', roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.1 });
  const jade = new THREE.MeshPhysicalMaterial({ color: '#1f6a4c', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });
  for (let side = 0; side < 4; side++) {
    const wall = new THREE.Group();
    for (let i = 0; i < 8; i++)
      for (let l = 0; l < 2; l++) {
        const t = new THREE.Mesh(tileGeo, l ? jade : ivory);
        t.position.set((i - 3.5) * 0.058, H + 0.025 + l * 0.031, 0);
        wall.add(t);
      }
    wall.rotation.y = (side * Math.PI) / 2;
    wall.position.set(Math.sin((side * Math.PI) / 2) * 0.26, 0, Math.cos((side * Math.PI) / 2) * 0.26);
    room.add(wall);
  }
  // Four velvet chairs in the club's colours.
  const velvet = (c: string) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.8, sheen: 1, sheenColor: new THREE.Color('#ff8a8a'), sheenRoughness: 0.4 });
  const chairCols = ['#8a1c22', '#1c3a6a', '#8a1c22', '#1c3a6a'];
  for (let side = 0; side < 4; side++) {
    const ch = new THREE.Group();
    const seat = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.07, 0.3, 3, 0.03), velvet(chairCols[side]));
    seat.position.y = 0.3;
    const back = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.36, 0.06, 3, 0.03), velvet(chairCols[side]));
    back.position.set(0, 0.5, 0.15);
    const frame = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.03, 0.32, 2, 0.01), gold(0.2));
    frame.position.y = 0.26;
    ch.add(seat, back, frame);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.26, 12), wood);
        l.position.set(sx * 0.15, 0.13, sz * 0.13);
        ch.add(l);
      }
    const a = (side * Math.PI) / 2;
    ch.rotation.y = a;
    ch.position.set(Math.sin(a) * 0.68, 0, Math.cos(a) * 0.68);
    room.add(ch);
  }
  // A warm pendant lamp above the table.
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.3, 0.16, 48, 1, true),
    new THREE.MeshPhysicalMaterial({ color: '#c9963e', metalness: 1, roughness: 0.2, side: THREE.DoubleSide, emissive: '#ffb050', emissiveIntensity: 0 }),
  );
  shade.position.y = 1.18;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff1c8' }));
  bulb.position.y = 1.1;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.4, 8), gold(0.3));
  cord.position.y = 1.46;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: '#ffb850', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.setScalar(0.7);
  glow.position.y = 1.06;
  room.add(shade, bulb, cord, glow);
  const lamp = new THREE.PointLight('#ffc070', 0.8, 2.2, 1.5);
  lamp.position.y = 1.0;
  room.add(lamp);
  shadows(room);
  bulb.castShadow = shade.castShadow = glow.castShadow = cord.castShadow = false;
  room.rotation.y = Math.PI / 4 + 0.18;
  room.position.y = -0.62;
  root.add(room);
}

// ------------------------------------------------------------ render

export function statIcon(key: StatKey, size = 300, dpr = 2) {
  const r = getRenderer(size, dpr);
  r.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 0.65;
  lights(scene);
  const root = new THREE.Group();
  scene.add(root);
  const kits: { dispose(): void }[] = [];
  own.length = 0;
  if (key === 'variations') buildVariations(root, kits);
  else if (key === 'destinations') buildDestinations(root);
  else if (key === 'tilesets') buildTileSets(root, kits);
  else buildRooms(root);
  const fov = 22;
  const cam = new THREE.PerspectiveCamera(fov, 1, 0.1, 50);
  const view: Record<StatKey, [number, number, number]> = {
    variations: [0, 0.35, 4.6],
    destinations: [0, 0.5, 4.6],
    tilesets: [0, 0.55, 4.6],
    rooms: [0, 2.5, 5.2],
  };
  cam.position.set(...view[key]);
  cam.lookAt(0, key === 'rooms' ? -0.02 : 0, 0);
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/png');
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
  });
  for (const k of kits) k.dispose();
  for (const t of own) t.dispose();
  setTileSet('classic-ivory');
  return url;
}
