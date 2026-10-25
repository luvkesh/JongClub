// Round medallion pictures for the website's "And the Details" cards: one
// small, rich 3D object per cosmetic category, sitting on a dark disc in a
// thin polished gold rim. Run in the game's dev server from
// website/tools/medallions.mjs.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { drawFace, setTileSet } from '../../src/render/tileFaces';
import { applyTileFinish, dressFace } from '../../src/render/tileMaterials';

export type Key = 'table' | 'frame' | 'avatar' | 'accessory' | 'winAnimation' | 'tableEffect' | 'sound';

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

function tex(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 16;
  return t;
}

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ------------------------------------------------------------ materials

const gold = (rough = 0.16, color = '#e9c27a') =>
  new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: rough, clearcoat: 0.4, clearcoatRoughness: 0.08, envMapIntensity: 1.25 });

function jadeTexture(seed: number, base = '#2f8a5c') {
  const [c, g] = canvas(512, 512);
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  const r = rng(seed);
  for (let i = 0; i < 60; i++) {
    const x = r() * 512,
      y = r() * 512,
      rad = 30 + r() * 120;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const light = r() > 0.5;
    gr.addColorStop(0, light ? 'rgba(170,230,190,0.22)' : 'rgba(8,50,30,0.25)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 512, 512);
  }
  for (let v = 0; v < 10; v++) {
    g.strokeStyle = `rgba(210,245,220,${0.06 + r() * 0.1})`;
    g.lineWidth = 1 + r() * 3;
    g.beginPath();
    let x = r() * 512,
      y = r() * 512;
    g.moveTo(x, y);
    for (let k = 0; k < 8; k++) g.lineTo((x += (r() - 0.5) * 120), (y += (r() - 0.5) * 120));
    g.stroke();
  }
  return tex(c);
}

function jade(seed = 3, base = '#2f8a5c') {
  return new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    map: jadeTexture(seed, base),
    roughness: 0.12,
    metalness: 0,
    transmission: 0.35,
    thickness: 0.4,
    ior: 1.6,
    attenuationColor: new THREE.Color('#1f7a4a'),
    attenuationDistance: 0.4,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    sheen: 0.4,
    sheenColor: new THREE.Color('#9fe0b8'),
  });
}

/** A soft round glow, white in the middle. */
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

/** A four-pointed star glint. */
function starSprite(): THREE.Texture {
  const [c, g] = canvas(256, 256);
  g.translate(128, 128);
  const core = g.createRadialGradient(0, 0, 0, 0, 0, 40);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.3, 'rgba(255,240,200,0.6)');
  core.addColorStop(1, 'rgba(255,220,150,0)');
  g.fillStyle = core;
  g.fillRect(-128, -128, 256, 256);
  for (const [rot, len] of [
    [0, 126],
    [Math.PI / 2, 126],
    [Math.PI / 4, 50],
    [-Math.PI / 4, 50],
  ] as const) {
    g.save();
    g.rotate(rot);
    const ray = g.createLinearGradient(-len, 0, len, 0);
    ray.addColorStop(0, 'rgba(255,230,170,0)');
    ray.addColorStop(0.5, 'rgba(255,255,245,1)');
    ray.addColorStop(1, 'rgba(255,230,170,0)');
    g.fillStyle = ray;
    g.beginPath();
    g.moveTo(-len, 0);
    g.quadraticCurveTo(0, -5, len, 0);
    g.quadraticCurveTo(0, 5, -len, 0);
    g.fill();
    g.restore();
  }
  return tex(c);
}

function sprite(map: THREE.Texture, color: string, size: number, opacity = 1, depthTest = true) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, depthTest }));
  s.scale.setScalar(size);
  return s;
}

// ------------------------------------------------------------ the medallion

const R = 1; // rim centre radius

function discTexture() {
  const [c, g] = canvas(1024, 1024);
  const gr = g.createRadialGradient(470, 440, 10, 512, 512, 512);
  gr.addColorStop(0, '#46361f');
  gr.addColorStop(0.45, '#1d160e');
  gr.addColorStop(0.85, '#0b0907');
  gr.addColorStop(1, '#070605');
  g.fillStyle = gr;
  g.fillRect(0, 0, 1024, 1024);
  // Fine concentric turning marks.
  const r = rng(11);
  for (let i = 0; i < 260; i++) {
    const rad = r() * 500;
    g.strokeStyle = `rgba(${r() > 0.5 ? '255,220,170' : '0,0,0'},${0.012 + r() * 0.02})`;
    g.lineWidth = 0.6 + r() * 1.4;
    g.beginPath();
    g.arc(512, 512, rad, 0, Math.PI * 2);
    g.stroke();
  }
  return tex(c);
}

/** The inner glow just inside the rim, a warm halo that fades toward the centre. */
function haloTexture() {
  const [c, g] = canvas(512, 512);
  const gr = g.createRadialGradient(256, 256, 160, 256, 256, 256);
  gr.addColorStop(0, 'rgba(255,190,110,0)');
  gr.addColorStop(0.78, 'rgba(255,190,110,0.05)');
  gr.addColorStop(0.95, 'rgba(255,200,130,0.22)');
  gr.addColorStop(1, 'rgba(255,200,130,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 512, 512);
  return tex(c);
}

function medallionBase(scene: THREE.Scene) {
  // A shallow dish: flat floor, gently rising to a lip under the rim.
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const rr = t * (R - 0.02);
    const y = t < 0.86 ? 0 : Math.pow((t - 0.86) / 0.14, 2) * 0.05;
    prof.push(new THREE.Vector2(rr, y));
  }
  const dishGeo = new THREE.LatheGeometry(prof, 160);
  // Planar UVs so the texture is radial.
  const p = dishGeo.attributes.position,
    uv = dishGeo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) / 2 / R, 0.5 - p.getZ(i) / 2 / R);
  const dish = new THREE.Mesh(
    dishGeo,
    new THREE.MeshPhysicalMaterial({ color: '#8a8580', map: discTexture(), roughness: 0.6, metalness: 0, specularIntensity: 0.2, clearcoat: 0.25, clearcoatRoughness: 0.4, envMapIntensity: 0.08, side: THREE.DoubleSide }),
  );
  dish.rotation.x = Math.PI / 2; // lathe axis (y) -> toward the camera (z)
  dish.receiveShadow = true;
  scene.add(dish);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(2 * R, 2 * R), new THREE.MeshBasicMaterial({ map: haloTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.position.z = 0.003;
  if (!(window as any).noHalo) scene.add(halo);
  // The rim: a polished gold moulding with a fine bead line inside it.
  const g = gold(0.14);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.012, 0.034, 32, 240), g);
  rim.position.z = 0.04;
  const inner = new THREE.Mesh(new THREE.TorusGeometry(R - 0.045, 0.008, 12, 240), gold(0.22, '#d9b06a'));
  inner.position.z = 0.03;
  scene.add(rim, inner);
}

function lights(scene: THREE.Scene, shadowRange = 1.4) {
  const key = new THREE.SpotLight('#fff0d8', 30, 0, 0.5, 0.9, 1.4);
  key.position.set(-1.6, 2.2, 3.4);
  key.target.position.set(0, 0, 0.3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 10;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.01;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 8;
  void shadowRange;
  scene.add(key, key.target);
  // Warm rims from behind each side to draw edges.
  for (const sx of [-1, 1]) {
    const rim = new THREE.SpotLight('#ffc674', 22, 0, 0.6, 0.9, 1.4);
    rim.position.set(sx * 2.2, 1.6, -0.4);
    rim.target.position.set(0, 0, 0.35);
    scene.add(rim, rim.target);
  }
  const fill = new THREE.DirectionalLight('#ffe2bf', 0.6);
  fill.position.set(2, -0.6, 3);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight('#ffe9cc', '#120c06', 0.35));
}

// ------------------------------------------------------------ objects

function marbleClothTexture() {
  const [c, g] = canvas(1024, 1024);
  g.fillStyle = '#08080a';
  g.fillRect(0, 0, 1024, 1024);
  const r = rng(29);
  // Clouds of smoky grey.
  for (let i = 0; i < 40; i++) {
    const x = r() * 1024,
      y = r() * 1024,
      rad = 60 + r() * 200;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(110,110,120,${0.03 + r() * 0.04})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 1024, 1024);
  }
  const vein = (goldVein: boolean, blur: number) => {
    g.filter = `blur(${blur}px)`;
    g.strokeStyle = goldVein ? `rgba(232,188,104,${0.6 + r() * 0.3})` : `rgba(215,215,222,${0.12 + r() * 0.2})`;
    g.lineWidth = goldVein ? 1.4 + r() * 2.2 : 0.8 + r() * 2;
    g.beginPath();
    let x = r() * 1024,
      y = r() * 1024;
    g.moveTo(x, y);
    let dx = (r() - 0.3) * 150,
      dy = (r() - 0.5) * 100;
    for (let k = 0; k < 10; k++) {
      dx += (r() - 0.5) * 60;
      dy += (r() - 0.5) * 60;
      const mx = x + dx * 0.5 + (r() - 0.5) * 30,
        my = y + dy * 0.5 + (r() - 0.5) * 30;
      x += dx;
      y += dy;
      g.quadraticCurveTo(mx, my, x, y);
    }
    g.stroke();
  };
  for (let v = 0; v < 26; v++) vein(false, 1.5);
  for (let v = 0; v < 26; v++) vein(false, 0);
  for (let v = 0; v < 9; v++) vein(true, 0);
  g.filter = 'none';
  return tex(c);
}

function velvetTexture(base: string) {
  const [c, g] = canvas(512, 512);
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  const r = rng(5);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
    g.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2);
  }
  return tex(c);
}

function tassel(len: number) {
  const grp = new THREE.Group();
  const gm = gold(0.25, '#e3b766');
  // Cord from above.
  const cord = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.05, 0.16, -0.02), new THREE.Vector3(-0.02, 0.1, 0.01), new THREE.Vector3(0, 0.03, 0)]), 24, 0.011, 10),
    gm,
  );
  // The knob: a lathe-turned head with a collar.
  const head = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        [0.0, 0.04],
        [0.02, 0.035],
        [0.034, 0.012],
        [0.03, -0.012],
        [0.04, -0.022],
        [0.038, -0.034],
        [0.032, -0.038],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      32,
    ),
    gold(0.18),
  );
  // The fringe: many fine threads fanning out a little.
  const threads: THREE.BufferGeometry[] = [];
  const r = rng(77);
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2 + r() * 0.1;
    const rr = 0.012 + r() * 0.018;
    const l = len * (0.86 + r() * 0.14);
    const c = new THREE.CylinderGeometry(0.0035, 0.0028, l, 5, 1);
    c.translate(0, -l / 2, 0);
    c.rotateZ(Math.cos(a) * 0.12);
    c.rotateX(-Math.sin(a) * 0.12);
    c.translate(Math.cos(a) * rr, -0.036, Math.sin(a) * rr);
    threads.push(c);
  }
  const fringe = new THREE.Mesh(mergeGeometries(threads), gold(0.38, '#dcae5c'));
  for (const m of [cord, head, fringe]) m.castShadow = true;
  grp.add(cord, head, fringe);
  return grp;
}

/**
 * Where a point of a cloth laid centred on a round table of radius R0 ends up:
 * flat on the top, rolled over the edge, then hanging with soft folds.
 */
function drape(x: number, z: number, R0: number, top: number, folds: number, amp: number, ph: number) {
  const r = Math.hypot(x, z);
  const th = Math.atan2(z, x);
  const rb = 0.035;
  if (r <= R0) return new THREE.Vector3(x, top, z);
  const s = r - R0;
  const roll = (Math.PI / 2) * rb;
  let rad: number, y: number;
  if (s < roll) {
    rad = R0 + rb * Math.sin(s / rb);
    y = top - rb * (1 - Math.cos(s / rb));
  } else {
    const h = s - roll;
    // Folds deepen as the cloth falls, with a little flare at the hem.
    const fold = amp * Math.min(1, h / 0.25) * (Math.sin(folds * th + ph) * 0.75 + Math.sin(folds * 1.9 * th - ph) * 0.25);
    rad = R0 + rb + fold + h * 0.06;
    y = top - rb - h;
  }
  return new THREE.Vector3(Math.cos(th) * rad, y, Math.sin(th) * rad);
}

function buildTable(root: THREE.Group) {
  const velvet = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    map: velvetTexture('#063520'),
    roughness: 0.95,
    sheen: 1,
    sheenColor: new THREE.Color('#4fd08c'),
    sheenRoughness: 0.35,
    side: THREE.DoubleSide,
  });
  const marble = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    map: marbleClothTexture(),
    roughness: 0.45,
    specularIntensity: 0.45,
    sheen: 0.5,
    sheenColor: new THREE.Color('#8a8a92'),
    sheenRoughness: 0.4,
    clearcoat: 0.25,
    clearcoatRoughness: 0.25,
    side: THREE.DoubleSide,
  });
  const R0 = 0.5,
    top = 0.22;
  // The round velvet cloth: a polar grid draped over the table.
  const Rc = 0.98;
  const rings = 90,
    segs = 288;
  const pos: number[] = [],
    uv: number[] = [],
    idx: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const r = (i / rings) * Rc;
    for (let k = 0; k <= segs; k++) {
      const th = (k / segs) * Math.PI * 2;
      const v = drape(Math.cos(th) * r, Math.sin(th) * r, R0, top, 11, 0.04, 0.6);
      pos.push(v.x, v.y, v.z);
      uv.push(0.5 + (Math.cos(th) * r) / (2 * Rc), 0.5 + (Math.sin(th) * r) / (2 * Rc));
    }
  }
  for (let i = 0; i < rings; i++)
    for (let k = 0; k < segs; k++) {
      const a = i * (segs + 1) + k,
        b = a + segs + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  cg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  cg.setIndex(idx);
  cg.computeVertexNormals();
  const cloth = new THREE.Mesh(cg, velvet);
  // The marble topper: a square laid diagonally, its corners falling over the edge.
  const S = 0.5,
    n = 120;
  const tg = new THREE.PlaneGeometry(2 * S, 2 * S, n, n);
  tg.rotateX(-Math.PI / 2);
  tg.rotateY(Math.PI / 4 + 0.12);
  const tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const v = drape(tp.getX(i), tp.getZ(i), R0 + 0.006, top + 0.008, 13, 0.02, 2.0);
    tp.setXYZ(i, v.x, v.y, v.z);
  }
  tg.computeVertexNormals();
  const topper = new THREE.Mesh(tg, marble);
  // Gold piping round the topper's hem.
  const hem: THREE.Vector3[] = [];
  for (let k = 0; k < 160; k++) {
    const t = k / 160;
    const side = Math.floor(t * 4),
      f = t * 4 - side;
    const c = [
      [-S, -S],
      [S, -S],
      [S, S],
      [-S, S],
    ];
    const [x0, z0] = c[side],
      [x1, z1] = c[(side + 1) % 4];
    const p = new THREE.Vector3(x0 + (x1 - x0) * f, 0, z0 + (z1 - z0) * f).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4 + 0.12);
    hem.push(drape(p.x, p.z, R0 + 0.012, top + 0.014, 13, 0.02, 2.0));
  }
  const piping = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hem, true), 400, 0.008, 8, true), gold(0.2));
  // A tassel at the front corner.
  const corner = new THREE.Vector3(S, 0, S).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4 + 0.12);
  const cp = drape(corner.x, corner.z, R0 + 0.012, top + 0.014, 13, 0.02, 2.0);
  const t = tassel(0.2);
  t.children[0].visible = false;
  t.position.set(cp.x, cp.y - 0.035, cp.z);
  t.scale.setScalar(1.3);
  const grp = new THREE.Group();
  grp.add(cloth, topper, piping, t);
  grp.traverse((o) => ((o as THREE.Mesh).isMesh && ((o.castShadow = true), (o.receiveShadow = true))));
  // Seen a little from above.
  grp.rotation.x = 0.62;
  grp.rotation.y = -0.5;
  grp.position.set(0.07, 0.04, 0.4);
  grp.scale.setScalar(1.0);
  root.add(grp);
}

/** An ornate oval gold frame with jade cabochons and a jade panel. */
function buildFrame(root: THREE.Group) {
  const grp = new THREE.Group();
  const a = 0.42,
    b = 0.56;
  const oval = (s: number, z = 0) =>
    new THREE.CatmullRomCurve3(
      Array.from({ length: 96 }, (_, i) => {
        const t = (i / 96) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(t) * a * s, Math.sin(t) * b * s, z);
      }),
      true,
    );
  const g1 = gold(0.15);
  const main = new THREE.Mesh(new THREE.TubeGeometry(oval(1), 240, 0.05, 24, true), g1);
  const outer = new THREE.Mesh(new THREE.TubeGeometry(oval(1.16, -0.01), 240, 0.018, 12, true), gold(0.2));
  const inner = new THREE.Mesh(new THREE.TubeGeometry(oval(0.86, 0.01), 240, 0.014, 12, true), gold(0.2));
  grp.add(main, outer, inner);
  // Bead row between the main moulding and the outer line.
  const beadG = new THREE.SphereGeometry(0.014, 12, 10);
  const beads: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 56; i++) {
    const t = (i / 56) * Math.PI * 2;
    const g = beadG.clone();
    g.translate(Math.cos(t) * a * 1.08, Math.sin(t) * b * 1.08, 0.0);
    beads.push(g);
  }
  grp.add(new THREE.Mesh(mergeGeometries(beads), gold(0.12)));
  // Leaf scrolls around: little flattened gold teardrops pointing along the oval.
  const leafG = new THREE.SphereGeometry(0.036, 20, 14);
  leafG.scale(1, 0.42, 0.7);
  const leaves: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * Math.PI * 2 + Math.PI / 24;
    const g = leafG.clone();
    g.rotateZ(t + Math.PI / 2 + 0.5);
    g.translate(Math.cos(t) * a * 1.0, Math.sin(t) * b * 1.0, 0.04);
    leaves.push(g);
  }
  grp.add(new THREE.Mesh(mergeGeometries(leaves), gold(0.22, '#e2b866')));
  // Jade cabochons in gold bezels at the four points, the top one larger.
  const jm = jade(9, '#2a8a58');
  for (const [t, s] of [
    [Math.PI / 2, 1.35],
    [-Math.PI / 2, 1],
    [0, 1],
    [Math.PI, 1],
  ] as const) {
    const x = Math.cos(t) * a,
      y = Math.sin(t) * b;
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.05 * s, 32, 24), jm);
    gem.scale.set(t === 0 || t === Math.PI ? 0.8 : 1, t === 0 || t === Math.PI ? 1.15 : 0.85, 0.55);
    gem.position.set(x, y, 0.05);
    const bez = new THREE.Mesh(new THREE.TorusGeometry(0.052 * s, 0.012, 12, 48), gold(0.14));
    bez.scale.copy(gem.scale).setZ(1);
    bez.position.set(x, y, 0.045);
    grp.add(gem, bez);
  }
  // Crest: a fan of gold beads above the top gem.
  for (let k = -3; k <= 3; k++) {
    const t = Math.PI / 2 + k * 0.075;
    const bd = new THREE.Mesh(new THREE.SphereGeometry(k === 0 ? 0.02 : 0.014, 16, 12), gold(0.12));
    bd.position.set(Math.cos(t) * (b + 0.11) * 0.8, Math.sin(t) * (b + 0.11) - Math.abs(k) * 0.006, 0.03);
    grp.add(bd);
  }
  // The jade panel with a soft carved cloud.
  const panelShape = new THREE.Shape();
  panelShape.absellipse(0, 0, a * 0.86, b * 0.86, 0, Math.PI * 2, false, 0);
  const panelGeo = new THREE.ExtrudeGeometry(panelShape, { depth: 0.02, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.04, bevelSegments: 8, curveSegments: 96 });
  const pp = panelGeo.attributes.position,
    puv = panelGeo.attributes.uv;
  for (let i = 0; i < pp.count; i++) puv.setXY(i, 0.5 + pp.getX(i) / (2 * a), 0.5 + pp.getY(i) / (2 * b));
  const pj = jade(21, '#1b6a44');
  pj.transmission = 0.1;
  {
    // Deepen the panel toward its edge, as if the stone were domed.
    const c = (pj.map as THREE.CanvasTexture).image as HTMLCanvasElement;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(220, 210, 20, 256, 256, 300);
    gr.addColorStop(0, 'rgba(140,230,170,0.25)');
    gr.addColorStop(0.6, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,25,12,0.6)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 512, 512);
  }
  const panel = new THREE.Mesh(panelGeo, pj);
  panel.position.z = -0.03;
  panel.receiveShadow = true;
  grp.add(panel);
  // A faint inner sheen across the panel.
  const sheen = sprite(glowSprite(), '#8fe0b0', 0.55, 0.22);
  sheen.position.set(-0.08, 0.14, 0.02);
  grp.add(sheen);
  grp.traverse((o) => ((o as THREE.Mesh).isMesh && ((o.castShadow = true), (o.receiveShadow = true))));
  grp.rotation.y = 0.22;
  grp.rotation.x = -0.06;
  grp.position.set(0, -0.05, 0.3);
  grp.scale.setScalar(1.18);
  root.add(grp);
}

/** A navy club blazer with gold piping on a black lacquered dress form. */
function buildBlazer(root: THREE.Group) {
  const grp = new THREE.Group();
  const navyTex = (() => {
    const [c, g] = canvas(512, 512);
    g.fillStyle = '#1a2746';
    g.fillRect(0, 0, 512, 512);
    // A fine twill.
    for (let i = -512; i < 512; i += 4) {
      g.strokeStyle = 'rgba(255,255,255,0.035)';
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 512, 512);
      g.stroke();
    }
    return tex(c);
  })();
  const navy = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: navyTex, roughness: 0.78, sheen: 0.4, sheenColor: new THREE.Color('#3f5590'), sheenRoughness: 0.45 });
  const lapelMat = new THREE.MeshPhysicalMaterial({ color: '#16213d', roughness: 0.38, sheen: 1, sheenColor: new THREE.Color('#8ea6e0'), sheenRoughness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.3 });
  const gm = gold(0.16);
  // Torso: a lathe-turned bust (shoulders to hip), flattened front to back.
  const torsoProf = [
    [0.0, 0.52],
    [0.09, 0.52],
    [0.13, 0.5],
    [0.24, 0.46],
    [0.34, 0.41],
    [0.38, 0.35],
    [0.385, 0.26],
    [0.37, 0.12],
    [0.33, -0.08],
    [0.32, -0.24],
    [0.345, -0.48],
    [0.0, -0.48],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const torsoGeo = new THREE.LatheGeometry(new THREE.SplineCurve(torsoProf).getPoints(80), 128);
  torsoGeo.scale(1, 1, 0.58);
  const torso = new THREE.Mesh(torsoGeo, navy);
  grp.add(torso);
  // Sleeves falling from the shoulders, a little behind the body.
  for (const sx of [-1, 1]) {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * 0.31, 0.32, -0.06),
      new THREE.Vector3(sx * 0.39, 0.25, -0.04),
      new THREE.Vector3(sx * 0.425, -0.05, -0.02),
      new THREE.Vector3(sx * 0.43, -0.43, 0.0),
    ]);
    const tg = new THREE.TubeGeometry(path, 64, 0.088, 32, false);
    // Taper toward the cuff.
    const tp = tg.attributes.position;
    const pts = path.getSpacedPoints(64);
    for (let i = 0; i < tp.count; i++) {
      const seg = Math.floor(i / 33);
      const c = pts[Math.min(64, seg)];
      const k = 1 - (seg / 64) * 0.14;
      tp.setXYZ(i, c.x + (tp.getX(i) - c.x) * k, c.y + (tp.getY(i) - c.y) * k, c.z + (tp.getZ(i) - c.z) * k * 0.92);
    }
    tg.computeVertexNormals();
    const sl = new THREE.Mesh(tg, navy);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.088, 32, 16), navy);
    cap.position.set(sx * 0.335, 0.35, -0.045);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.007, 8, 48), gm);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.set(sx * 0.43, -0.39, 0.0);
    const end = new THREE.Mesh(new THREE.CircleGeometry(0.075, 32), new THREE.MeshStandardMaterial({ color: '#0a0f1c', roughness: 1 }));
    end.rotation.x = Math.PI / 2;
    end.position.set(sx * 0.43, -0.431, 0.0);
    void cap;
    grp.add(sl, cuff, end);
  }
  const front = 0.33 * 0.58; // z of the chest surface
  // Shirt in the V.
  const shirtShape = new THREE.Shape();
  shirtShape.moveTo(-0.12, 0.47);
  shirtShape.lineTo(0.12, 0.47);
  shirtShape.lineTo(0.0, 0.0);
  shirtShape.closePath();
  const shirt = new THREE.Mesh(new THREE.ExtrudeGeometry(shirtShape, { depth: 0.01, bevelEnabled: false }), new THREE.MeshPhysicalMaterial({ color: '#f3efe6', roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color('#ffffff') }));
  shirt.position.z = front + 0.02;
  grp.add(shirt);
  // Tie: jade silk with gold stripes.
  const tieTex = (() => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = '#145a3a';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#d7b265';
    g.lineWidth = 8;
    for (let i = -256; i < 512; i += 48) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i - 256, 256);
      g.stroke();
    }
    return tex(c);
  })();
  const tieShape = new THREE.Shape();
  tieShape.moveTo(-0.025, 0.44);
  tieShape.lineTo(0.025, 0.44);
  tieShape.lineTo(0.045, 0.14);
  tieShape.lineTo(0.0, 0.07);
  tieShape.lineTo(-0.045, 0.14);
  tieShape.closePath();
  const tieGeo = new THREE.ExtrudeGeometry(tieShape, { depth: 0.012, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2 });
  const tuv = tieGeo.attributes.uv,
    tp = tieGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) tuv.setXY(i, tp.getX(i) * 4 + 0.5, tp.getY(i) * 4);
  const tie = new THREE.Mesh(tieGeo, new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: tieTex, roughness: 0.3, sheen: 1, sheenColor: new THREE.Color('#7fe0b0') }));
  tie.position.z = front + 0.032;
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), tie.material);
  knot.scale.set(1, 1.1, 0.6);
  knot.position.set(0, 0.45, front + 0.04);
  grp.add(tie, knot);
  // Lapels: long notched shapes lying on the chest with gold piping on the edge.
  for (const sx of [-1, 1]) {
    const s = new THREE.Shape();
    const pts: [number, number][] = [
      [0.12, 0.49],
      [0.2, 0.47],
      [0.215, 0.38],
      [0.25, 0.37],
      [0.22, 0.2],
      [0.06, -0.08],
      [0.0, -0.12],
      [0.0, 0.0],
    ];
    s.moveTo(sx * pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) s.lineTo(sx * x, y);
    s.closePath();
    const lg = new THREE.ExtrudeGeometry(s, { depth: 0.018, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 3 });
    const lapel = new THREE.Mesh(lg, lapelMat);
    lapel.position.z = front + 0.03;
    lapel.rotation.y = -sx * 0.18;
    // Piping along the open edge.
    const edge = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * 0.12, 0.49, 0.03),
      new THREE.Vector3(sx * 0.06, 0.24, 0.03),
      new THREE.Vector3(0.0, 0.0, 0.03),
      new THREE.Vector3(sx * 0.0, -0.12, 0.03),
    ]);
    const pipe = new THREE.Mesh(new THREE.TubeGeometry(edge, 48, 0.007, 8), gm);
    const outerEdge = new THREE.CatmullRomCurve3(
      [
        [0.2, 0.47],
        [0.215, 0.38],
        [0.25, 0.37],
        [0.22, 0.2],
        [0.06, -0.08],
        [0.0, -0.12],
      ].map(([x, y]) => new THREE.Vector3(sx * x, y, 0.03)),
      false,
      'catmullrom',
      0.1,
    );
    const pipe2 = new THREE.Mesh(new THREE.TubeGeometry(outerEdge, 64, 0.006, 8), gm);
    lapel.add(pipe, pipe2);
    grp.add(lapel);
  }
  // Buttons and a gold crest on the breast pocket.
  for (const [x, y] of [
    [0.05, -0.22],
    [0.05, -0.36],
  ]) {
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 24), gm);
    btn.rotation.x = Math.PI / 2;
    btn.position.set(x, y, front + 0.02);
    grp.add(btn);
  }
  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.01), gm);
  pocket.position.set(-0.22, 0.12, front + 0.0);
  pocket.rotation.z = 0.05;
  pocket.rotation.y = 0.3;
  // A pocket square of gold silk: three soft peaks.
  const silk = new THREE.MeshPhysicalMaterial({ color: '#d9b265', roughness: 0.35, sheen: 1, sheenColor: new THREE.Color('#ffe2a0') });
  for (const [dx, hgt] of [
    [-0.035, 0.05],
    [0, 0.065],
    [0.035, 0.045],
  ]) {
    const pk = new THREE.Mesh(new THREE.ConeGeometry(0.022, hgt, 12), silk);
    pk.scale.z = 0.4;
    pk.position.set(-0.22 + dx, 0.125 + hgt / 2, front - 0.005);
    pk.rotation.y = 0.3;
    pk.rotation.z = -dx * 4;
    grp.add(pk);
  }
  grp.add(pocket);
  // The dress form's neck: black lacquer with a gold cap.
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.12, 32), new THREE.MeshPhysicalMaterial({ color: '#0c0c0e', roughness: 0.15, clearcoat: 1 }));
  neck.position.y = 0.55;
  const capG = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.072, 0.02, 32), gm);
  capG.position.y = 0.62;
  const fin = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), gm);
  fin.position.y = 0.65;
  // Collar.
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 12, 48, Math.PI * 1.2), lapelMat);
  collar.rotation.x = Math.PI / 2;
  collar.rotation.z = Math.PI * 0.9;
  collar.position.set(0, 0.49, -0.01);
  collar.scale.set(1.1, 0.8, 1);
  grp.add(neck, capG, fin, collar);
  grp.traverse((o) => ((o as THREE.Mesh).isMesh && ((o.castShadow = true), (o.receiveShadow = true))));
  grp.rotation.y = 0.32;
  grp.position.set(0, -0.0, 0.45);
  grp.scale.setScalar(1.0);
  root.add(grp);
}

/** Round gold spectacles and a jade drop earring. */
function buildAccessory(root: THREE.Group) {
  const grp = new THREE.Group();
  const gm = gold(0.14);
  const glass = new THREE.MeshPhysicalMaterial({ color: '#6a5a40', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.45, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.2, specularIntensity: 1 });
  const specs = new THREE.Group();
  const lr = 0.19;
  for (const sx of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(lr, 0.016, 20, 96), gm);
    ring.position.x = sx * 0.235;
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(lr, lr, 0.012, 64), glass);
    lens.rotation.x = Math.PI / 2;
    lens.position.x = sx * 0.235;
    // Temples, folded behind.
    const temple = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(sx * (0.235 + lr), 0.03, 0),
          new THREE.Vector3(sx * (0.235 + lr + 0.03), 0.04, -0.05),
          new THREE.Vector3(sx * 0.2, 0.06, -0.09),
          new THREE.Vector3(-sx * 0.15, 0.07, -0.1),
        ]),
        48,
        0.009,
        8,
      ),
      gm,
    );
    // Little hinge knobs.
    const hinge = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), gm);
    hinge.position.set(sx * (0.235 + lr + 0.005), 0.03, -0.005);
    // Nose pad.
    specs.add(ring, lens, temple, hinge);
  }
  const bridge = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.05, 0.05, 0), new THREE.Vector3(0, 0.1, 0.01), new THREE.Vector3(0.05, 0.05, 0)]), 32, 0.014, 10),
    gm,
  );
  specs.add(bridge);
  specs.rotation.set(0.5, -0.3, -0.18);
  specs.position.set(-0.2, 0.17, 0.25);
  specs.scale.setScalar(0.86);
  grp.add(specs);
  // Earring: hook, a gold bead and cap, and a jade drop.
  const ear = new THREE.Group();
  const hook = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.0, 0.08, 0.0), new THREE.Vector3(0.05, 0.13, 0), new THREE.Vector3(0.09, 0.09, 0), new THREE.Vector3(0.09, 0.03, 0)]),
      48,
      0.006,
      8,
    ),
    gm,
  );
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.022, 20, 14), gm);
  bead.position.y = -0.02;
  const capProf = [
    [0.0, 0.0],
    [0.02, -0.004],
    [0.04, -0.03],
    [0.046, -0.05],
    [0.0, -0.05],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const cap = new THREE.Mesh(new THREE.LatheGeometry(capProf, 32), gm);
  cap.position.y = -0.038;
  const dropProf: THREE.Vector2[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40; // 0 top .. 1 bottom
    const y = -t * 0.26;
    const rr = Math.sin(Math.PI * Math.pow(t, 0.75)) * 0.085 * Math.pow(t, 0.25) + 0.0001;
    dropProf.push(new THREE.Vector2(rr, y));
  }
  const drop = new THREE.Mesh(new THREE.LatheGeometry(dropProf, 48), jade(13, '#2f9a62'));
  drop.position.y = -0.06;
  ear.add(hook, bead, cap, drop);
  ear.position.set(0.36, -0.02, 0.34);
  ear.scale.setScalar(1.3);
  ear.rotation.z = 0.08;
  ear.rotation.y = 0.3;
  grp.add(ear);
  grp.traverse((o) => ((o as THREE.Mesh).isMesh && ((o.castShadow = true), (o.receiveShadow = true))));
  grp.scale.setScalar(1.32);
  grp.position.set(-0.02, -0.04, 0.05);
  root.add(grp);
}

/** The game's own ivory tile with 發, in swirling golden light. */
function buildWin(root: THREE.Group, own: THREE.Texture[]) {
  setTileSet('classic-ivory');
  const TW = 0.42,
    TH = 0.56,
    TD = 0.3;
  const body = new RoundedBoxGeometry(TW, TH, TD * 0.64, 5, 0.045);
  body.translate(0, 0, TD * 0.18);
  const back = new RoundedBoxGeometry(TW, TH, TD * 0.4, 5, 0.045);
  back.translate(0, 0, -TD * 0.3);
  const bodyMat = new THREE.MeshPhysicalMaterial();
  const backMat = new THREE.MeshPhysicalMaterial();
  const faceMat = new THREE.MeshPhysicalMaterial({ transparent: true });
  applyTileFinish([bodyMat], backMat, [faceMat]);
  const tile = new THREE.Group();
  const a = new THREE.Mesh(body, bodyMat);
  const b = new THREE.Mesh(back, backMat);
  a.castShadow = b.castShadow = true;
  tile.add(a, b);
  const fc = drawFace(32, false, false, 4);
  const ft = tex(fc);
  own.push(ft);
  faceMat.map = ft;
  dressFace(faceMat, 32, false, false, 16, 4);
  faceMat.bumpScale *= 1.8;
  faceMat.clearcoat = 0.55;
  faceMat.clearcoatRoughness = 0.12;
  const fs = new THREE.Shape();
  {
    const w = TW * 0.94,
      h = TH * 0.95,
      r = 0.04,
      x = -w / 2,
      y = -h / 2;
    fs.moveTo(x + r, y);
    fs.lineTo(x + w - r, y);
    fs.quadraticCurveTo(x + w, y, x + w, y + r);
    fs.lineTo(x + w, y + h - r);
    fs.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    fs.lineTo(x + r, y + h);
    fs.quadraticCurveTo(x, y + h, x, y + h - r);
    fs.lineTo(x, y + r);
    fs.quadraticCurveTo(x, y, x + r, y);
    const fg = new THREE.ShapeGeometry(fs, 12);
    const p = fg.attributes.position,
      uv = fg.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - x) / w, (p.getY(i) - y) / h);
    const face = new THREE.Mesh(fg, faceMat);
    face.position.z = TD / 2 + 0.0015;
    tile.add(face);
  }
  tile.rotation.set(0.1, -0.38, 0.1);
  tile.position.set(0, -0.02, 0.42);
  tile.scale.setScalar(1.25);
  root.add(tile);
  // Light trails: ribbons of gold light spiralling round the tile.
  const fade = (() => {
    const [c, g] = canvas(512, 4);
    const gr = g.createLinearGradient(0, 0, 512, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.55, 'rgba(255,255,255,0.55)');
    gr.addColorStop(0.93, 'rgba(255,255,255,1)');
    gr.addColorStop(0.96, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 512, 4);
    return tex(c, false);
  })();
  const trail = (pts: THREE.Vector3[], color: string, r: number, opacity: number) => {
    const m = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, r, 10),
      new THREE.MeshBasicMaterial({ color, alphaMap: fade, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    return m;
  };
  const spiral = (r0: number, r1: number, tilt: number, turns: number, phase: number, rise: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const ang = phase + t * turns * Math.PI * 2;
      const rr = r0 + (r1 - r0) * t;
      const v = new THREE.Vector3(Math.cos(ang) * rr, Math.sin(ang) * rr * 0.36 - rise / 2 + rise * t, Math.sin(ang) * rr * 0.6);
      v.applyAxisAngle(new THREE.Vector3(0, 0, 1), tilt);
      pts.push(v.add(new THREE.Vector3(0, -0.02, 0.42)));
    }
    return pts;
  };
  const heads: THREE.Vector3[] = [];
  for (const [r0, r1, tilt, turns, phase, rise] of [
    [0.66, 0.5, 0.42, 0.95, 3.4, 0.16],
    [0.6, 0.44, -0.55, 0.85, 0.3, -0.12],
    [0.7, 0.58, 1.25, 0.55, 4.2, 0.08],
  ]) {
    const pts = spiral(r0, r1, tilt, turns, phase, rise);
    root.add(trail(pts, '#ff9f2e', 0.036, 0.3), trail(pts, '#ffc35a', 0.013, 0.75), trail(pts, '#ffeab0', 0.0045, 1));
    heads.push(pts[Math.round(pts.length * 0.93)]);
  }
  // Sparkles and dust.
  const star = starSprite();
  const glow = glowSprite();
  own.push(star, glow);
  for (const h of heads) {
    const hs = sprite(star, '#ffd27a', 0.2);
    hs.position.copy(h).setZ(h.z + 0.05);
    const hg = sprite(glow, '#ffb040', 0.16, 0.8);
    hg.position.copy(hs.position);
    root.add(hs, hg);
  }
  const r = rng(41);
  for (const [x, y, s] of [
    [0.38, 0.4, 0.26],
    [-0.42, -0.32, 0.2],
    [-0.3, 0.5, 0.14],
    [0.5, -0.18, 0.12],
    [0.12, 0.62, 0.1],
  ]) {
    const sp = sprite(star, '#ffe6b0', s);
    sp.position.set(x, y, 0.75);
    sp.material.rotation = r() * 0.4;
    root.add(sp);
  }
  for (let i = 0; i < 60; i++) {
    const ang = r() * Math.PI * 2,
      rr = 0.3 + r() * 0.5;
    const sp = sprite(glow, r() > 0.5 ? '#ffd88a' : '#fff0c8', 0.02 + r() * 0.04, 0.5 + r() * 0.5);
    sp.position.set(Math.cos(ang) * rr, Math.sin(ang) * rr * 0.9, 0.3 + r() * 0.5);
    root.add(sp);
  }
  // A warm bloom behind the tile.
  const bloom = sprite(glow, '#ffb04a', 1.5, 0.35);
  bloom.position.set(0, 0, 0.1);
  root.add(bloom);
}

/** A glass orb on a gold stand holding a glowing lotus, fireflies about it. */
function buildEffect(root: THREE.Group, own: THREE.Texture[]) {
  const grp = new THREE.Group();
  const glow = glowSprite();
  own.push(glow);
  const orbR = 0.4;
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(orbR, 96, 64),
    new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, transmission: 1, thickness: 0.15, ior: 1.3, clearcoat: 1, envMapIntensity: 1.6, specularIntensity: 1, attenuationColor: new THREE.Color('#fff2d8'), attenuationDistance: 3 }),
  );
  orb.position.y = 0.08;
  grp.add(orb);
  // Stand: a lathe-turned gold base cupping the orb.
  const standProf = [
    [0.0, -0.46],
    [0.3, -0.46],
    [0.32, -0.44],
    [0.3, -0.41],
    [0.2, -0.38],
    [0.14, -0.33],
    [0.16, -0.29],
    [0.24, -0.25],
    [0.27, -0.22],
    [0.0, -0.22],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const stand = new THREE.Mesh(new THREE.LatheGeometry(new THREE.SplineCurve(standProf).getPoints(60), 96), gold(0.16));
  stand.castShadow = true;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.01, 10, 96), gold(0.12));
  band.rotation.x = Math.PI / 2;
  band.position.y = -0.43;
  grp.add(stand, band);
  // Lotus: two rings of petals, glowing from within.
  const lotus = new THREE.Group();
  const petalGeo = new THREE.SphereGeometry(1, 32, 16);
  {
    const p = petalGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      // Pointed tip.
      const k = 1 - Math.max(0, y) * 0.55;
      p.setX(i, p.getX(i) * k);
    }
    petalGeo.scale(0.06, 0.15, 0.025);
    petalGeo.translate(0, 0.14, 0);
    petalGeo.computeVertexNormals();
  }
  const petalMat = (c: string, e: string, ei: number) => new THREE.MeshPhysicalMaterial({ color: c, emissive: e, emissiveIntensity: ei, roughness: 0.4, sheen: 1, sheenColor: new THREE.Color('#fff0f0') });
  for (const [n, tilt, col, em, ei, rot] of [
    [9, 1.0, '#f4c6c6', '#ff9a7a', 0.55, 0],
    [7, 0.55, '#fbe1d8', '#ffc08a', 0.85, 0.4],
    [5, 0.22, '#fff2e0', '#ffd79a', 1.2, 0.2],
  ] as const) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(petalGeo, petalMat(col, em, ei));
      const piv = new THREE.Group();
      m.rotation.x = tilt;
      piv.rotation.y = (i / n) * Math.PI * 2 + rot;
      piv.add(m);
      lotus.add(piv);
    }
  }
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffe7a8' }));
  heart.position.y = 0.05;
  lotus.add(heart);
  // Leaves at the foot.
  const leafMat = new THREE.MeshPhysicalMaterial({ color: '#1f5a3a', roughness: 0.45, emissive: '#0f3a24', emissiveIntensity: 0.3, sheen: 0.6, sheenColor: new THREE.Color('#9fe0a0') });
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 8), leafMat);
  leaf.scale.set(1, 0.06, 0.75);
  leaf.position.y = -0.005;
  lotus.add(leaf);
  lotus.scale.setScalar(1.25);
  lotus.position.y = -0.14;
  lotus.rotation.x = 0.35;
  grp.add(lotus);
  const pl = new THREE.PointLight('#ffc27a', 1.4, 1.2, 1.6);
  pl.position.set(0, 0.06, 0.05);
  grp.add(pl);
  // The orb's inner glow and fireflies.
  const core = sprite(glow, '#ffb866', 0.95, 0.55, false);
  core.position.set(0, 0.04, 0.2);
  grp.add(core);
  const r = rng(91);
  for (let i = 0; i < 26; i++) {
    const inside = i < 14;
    const ang = r() * Math.PI * 2;
    const rr = inside ? 0.12 + r() * 0.24 : 0.45 + r() * 0.24;
    const sz = 0.03 + r() * 0.05;
    const col = r() > 0.4 ? '#ffe28a' : '#d8ff9a';
    const f = sprite(glow, col, sz * 2.4, 0.9, false);
    f.position.set(Math.cos(ang) * rr, 0.08 + Math.sin(ang) * rr * 0.9, inside ? 0.42 : 0.5);
    const dot = sprite(glow, '#ffffff', sz * 0.6, 1, false);
    dot.position.copy(f.position);
    grp.add(f, dot);
  }
  grp.traverse((o) => ((o as THREE.Mesh).isMesh && !(o as THREE.Mesh).material.hasOwnProperty('transmission') && ((o.receiveShadow = true), true)));
  grp.position.set(0, 0.02, 0.5);
  grp.rotation.x = 0.12;
  grp.scale.setScalar(1.22);
  // A halo behind the orb.
  const halo = sprite(glow, '#ff9d3a', 1.6, 0.3);
  halo.position.set(0, 0.05, 0.12);
  root.add(halo, grp);
}

/** A bronze-gold bell with rings of sound. */
function buildSound(root: THREE.Group) {
  const grp = new THREE.Group();
  const profile = [
    [0.0, 0.56],
    [0.08, 0.555],
    [0.15, 0.53],
    [0.2, 0.48],
    [0.225, 0.38],
    [0.235, 0.24],
    [0.26, 0.1],
    [0.31, 0.0],
    [0.37, -0.07],
    [0.39, -0.1],
    [0.385, -0.12],
    [0.36, -0.12],
    [0.33, -0.09],
    [0.28, -0.04],
    [0.22, 0.06],
    [0.2, 0.2],
    [0.19, 0.38],
    [0.14, 0.48],
    [0.0, 0.51],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const bronze = gold(0.2, '#d6a45a');
  const bell = new THREE.Mesh(new THREE.LatheGeometry(new THREE.SplineCurve(profile).getPoints(120), 128), bronze);
  bell.material.side = THREE.DoubleSide;
  grp.add(bell);
  // Decorative bands.
  for (const [y, rr, t] of [
    [0.4, 0.228, 0.01],
    [0.32, 0.232, 0.006],
    [0.03, 0.29, 0.008],
    [-0.065, 0.37, 0.012],
  ]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(rr, t, 10, 128), gold(0.12));
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    grp.add(band);
  }
  // Crown loop.
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 16, 48), gold(0.14));
  loop.position.y = 0.64;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), gold(0.14));
  knob.position.y = 0.56;
  knob.scale.set(1, 0.6, 1);
  // Clapper.
  const clap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 16), gold(0.25, '#b8863e'));
  clap.position.set(0.04, -0.12, 0);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), gold(0.3, '#a87a38'));
  rod.position.set(0.02, 0.02, 0);
  rod.rotation.z = 0.12;
  grp.add(loop, knob, clap, rod);
  grp.traverse((o) => ((o as THREE.Mesh).isMesh && ((o.castShadow = true), (o.receiveShadow = true))));
  grp.rotation.z = 0.18;
  grp.rotation.x = 0.2;
  grp.position.set(-0.02, -0.1, 0.42);
  grp.scale.setScalar(1.18);
  root.add(grp);
  // Rings of sound: arcs on both sides, fading outward.
  const glow = glowSprite();
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const rr = 0.5 + i * 0.12;
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(rr, 0.011 - i * 0.002, 8, 64, Math.PI * 0.42),
        new THREE.MeshBasicMaterial({ color: '#ffd38a', transparent: true, opacity: 0.85 - i * 0.25, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      arc.rotation.z = sx > 0 ? -Math.PI * 0.21 : Math.PI - Math.PI * 0.21;
      arc.position.set(-0.02, -0.02, 0.42);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(rr, 0.035, 8, 64, Math.PI * 0.42),
        new THREE.MeshBasicMaterial({ color: '#ffa94a', transparent: true, opacity: 0.18 - i * 0.04, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      halo.rotation.copy(arc.rotation);
      halo.position.copy(arc.position);
      root.add(arc, halo);
    }
  }
  const bloom = sprite(glow, '#ffb04a', 1.3, 0.28);
  bloom.position.set(0, 0, 0.1);
  root.add(bloom);
}

// ------------------------------------------------------------ render

export function medallion(key: Key, size = 360, dpr = 2) {
  const r = getRenderer(size, dpr);
  r.toneMappingExposure = 0.95;
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 0.6;
  medallionBase(scene);
  lights(scene);
  const root = new THREE.Group();
  scene.add(root);
  const own: THREE.Texture[] = [];
  if (key === 'table') buildTable(root);
  else if (key === 'frame') buildFrame(root);
  else if (key === 'avatar') buildBlazer(root);
  else if (key === 'accessory') buildAccessory(root);
  else if (key === 'winAnimation') buildWin(root, own);
  else if (key === 'tableEffect') buildEffect(root, own);
  else if (key === 'sound') buildSound(root);
  // Frame the rim's outer edge at 92% of the picture.
  const fov = 18;
  const half = (R + 0.05) / 0.92;
  const dist = half / Math.tan(((fov / 2) * Math.PI) / 180);
  const cam = new THREE.PerspectiveCamera(fov, 1, 0.1, 50);
  cam.position.set(0, 0, dist);
  cam.lookAt(0, 0, 0);
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/png');
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
  });
  for (const t of own) t.dispose();
  return url;
}
