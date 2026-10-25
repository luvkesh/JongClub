// Studio showcase pictures for the website's Atelier: every tile set and rack
// from the game's own faces, finishes and rack geometry, lit like a jewellery
// shot (key spot, gold rims, a soft top panel, a mirrored stage). Run in the
// game's dev server from website/tools/showcase.mjs; re-run whenever the
// game's tiles or racks change so the website matches.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { currentTileSet, drawBackOnce, drawBodyOnce, drawFace, luma, mix, setTileSet } from '../../src/render/tileFaces';
import { applyTileFinish, dressFace } from '../../src/render/tileMaterials';
import { rackStyle } from '../../src/cosmetics/racks';
import { HAND_LEAN, HAND_RAISE, rackSegment, type HumanRackFit } from '../../src/render/racks';
import { disposeRackMaterials, rackMaterials } from '../../src/render/rackLook';

const TW = 0.3,
  TH = 0.4,
  TD = 0.22;
const FACE_SCALE = 4;
const HI_FACE_SCALE = 6;

let renderer: THREE.WebGLRenderer | null = null;
let env: THREE.Texture | null = null;

function getRenderer(w: number, h: number, dpr: number) {
  if (!renderer) {
    RectAreaLightUniformsLib.init();
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
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
  renderer.setSize(w, h, false);
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

/**
 * A height map that presses the face's ink into the ground: wherever the
 * face differs from its plain ground it sits lower, with a softened wall so
 * the light catches the cut's edge.
 */
function engraveMap(face: HTMLCanvasElement) {
  const w = face.width,
    h = face.height;
  const src = face.getContext('2d')!.getImageData(0, 0, w, h).data;
  // The ground: the median colour of a ring just inside the border.
  const ring: number[][] = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const x = Math.round(w / 2 + Math.cos(a) * w * 0.44),
      y = Math.round(h / 2 + Math.sin(a) * h * 0.06);
    const o = (y * w + x) * 4;
    ring.push([src[o], src[o + 1], src[o + 2]]);
  }
  const med = [0, 1, 2].map((k) => ring.map((p) => p[k]).sort((a, b) => a - b)[32]);
  const [c, g] = canvas(w, h);
  const out = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const d = Math.abs(src[o] - med[0]) + Math.abs(src[o + 1] - med[1]) + Math.abs(src[o + 2] - med[2]);
    const ink = Math.min(1, Math.max(0, (d - 40) / 90));
    const v = Math.round(255 * (1 - ink * 0.85));
    out.data[o] = out.data[o + 1] = out.data[o + 2] = v;
    out.data[o + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  // Soften the walls of the cut a little.
  const [c2, g2] = canvas(w, h);
  g2.filter = `blur(${Math.max(1, w / 400)}px)`;
  g2.drawImage(c, 0, 0);
  return c2;
}

/** One tile of the equipped set, upright with its face toward +z, standing on y = 0. */
function makeTile(kind: number, faceUp: boolean, own: { geo: THREE.BufferGeometry[]; mat: THREE.Material[]; tex: THREE.Texture[] }, hi = false) {
  const st = currentTileSet();
  // The close-up product shots (hi) get smoother bodies and finer finishes; racks keep the game's look.
  const seg = hi ? 10 : 5;
  const body = new RoundedBoxGeometry(TW, TH, TD * 0.64, seg, 0.035);
  body.translate(0, 0, TD * 0.18);
  const back = new RoundedBoxGeometry(TW, TH, TD * 0.4, seg, 0.035);
  back.translate(0, 0, -TD * 0.3);
  own.geo.push(body, back);
  const bodyMat = new THREE.MeshPhysicalMaterial();
  const backMat = new THREE.MeshPhysicalMaterial();
  const faceMat = new THREE.MeshPhysicalMaterial({ transparent: true });
  applyTileFinish([bodyMat], backMat, [faceMat]);
  own.mat.push(bodyMat, backMat, faceMat);
  if (hi) {
    const bt = tex(drawBackOnce(768, 1024));
    own.tex.push(bt);
    backMat.map = bt;
    if (!st.stripes) {
      const yt = tex(drawBodyOnce());
      own.tex.push(yt);
      bodyMat.map = yt;
    }
    // A polished lacquer over body and back: the bevel catches a clean highlight.
    for (const m of [bodyMat, backMat]) {
      m.clearcoat = Math.max(m.clearcoat, 0.6);
      m.clearcoatRoughness = Math.min(m.clearcoatRoughness, 0.08);
    }
  }
  const g = new THREE.Group();
  const a = new THREE.Mesh(body, bodyMat);
  const b = new THREE.Mesh(back, backMat);
  a.castShadow = b.castShadow = true;
  a.receiveShadow = b.receiveShadow = true;
  g.add(a, b);
  if (faceUp) {
    const fs = hi ? HI_FACE_SCALE : FACE_SCALE;
    const fc = drawFace(kind, false, false, fs);
    const ft = tex(fc);
    own.tex.push(ft);
    faceMat.map = ft;
    // The game's own engraving (relief, foil metal); a touch deeper for the close-up.
    dressFace(faceMat, kind, false, false, 16, fs);
    faceMat.bumpScale *= 1.8;
    // A thin glaze over the engraving, as on polished resin.
    faceMat.clearcoat = 0.55;
    faceMat.clearcoatRoughness = 0.12;
    faceMat.emissiveMap = ft;
    faceMat.emissive.set('#ffffff');
    faceMat.emissiveIntensity = 0.02;
    const face = new THREE.Mesh(new RoundedFace(TW * 0.94, TH * 0.95, 0.03), faceMat);
    own.geo.push(face.geometry);
    face.position.z = TD / 2 + 0.0012;
    face.receiveShadow = true;
    g.add(face);
  } else {
    g.rotation.y = Math.PI;
  }
  g.userData.inner = true;
  const outer = new THREE.Group();
  outer.add(g);
  g.position.y = TH / 2;
  void st;
  return outer;
}

/** A rounded-rectangle plane with 0..1 UVs, so the face fits the tile's rounded corners. */
class RoundedFace extends THREE.ShapeGeometry {
  constructor(w: number, h: number, r: number) {
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
    super(s, 12);
    const p = this.attributes.position;
    const uv = this.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - x) / w, (p.getY(i) - y) / h);
  }
}

/** Seeded random numbers for the procedural textures. */
function rng(seed: number) {
  let s = (seed % 2147483646) + 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/**
 * Polished Nero Marquina: a deep black stone with soft cloudy depth, fine
 * white fissures and a few warm gold veins with a faint glow round them.
 */
function marbleTexture(seed: number, size = 2048, lift = 0) {
  const [c, g] = canvas(size, size);
  const r = rng(seed);
  g.fillStyle = mix('#09090a', '#2a2724', lift);
  g.fillRect(0, 0, size, size);
  // Cloudy depth in the stone.
  g.filter = `blur(${size / 40}px)`;
  for (let i = 0; i < 40; i++) {
    const x = r() * size,
      y = r() * size,
      rr = size * (0.05 + r() * 0.18);
    g.fillStyle = r() < 0.5 ? `rgba(40,36,34,${0.25 + r() * 0.3})` : `rgba(0,0,0,${0.3 + r() * 0.4})`;
    g.beginPath();
    g.ellipse(x, y, rr, rr * (0.3 + r() * 0.5), r() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  g.filter = 'none';
  const vein = (gold: boolean, w: number, a: number) => {
    let x = r() * size,
      y = r() * size;
    const ang = -0.5 + r() * 0.6;
    const pts: [number, number][] = [[x, y]];
    for (let k = 0; k < 18; k++) {
      x += Math.cos(ang) * size * 0.06 + (r() - 0.5) * size * 0.05;
      y += Math.sin(ang) * size * 0.06 + (r() - 0.5) * size * 0.05;
      pts.push([x, y]);
    }
    const path = () => {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length - 1; k++) {
        const mx = (pts[k][0] + pts[k + 1][0]) / 2,
          my = (pts[k][1] + pts[k + 1][1]) / 2;
        g.quadraticCurveTo(pts[k][0], pts[k][1], mx, my);
      }
    };
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (gold) {
      // The glow, then the vein, then its bright core.
      g.filter = `blur(${w * 2.5}px)`;
      g.strokeStyle = `rgba(200,150,70,${a * 0.35})`;
      g.lineWidth = w * 5;
      path();
      g.stroke();
      g.filter = 'none';
      g.strokeStyle = `rgba(214,166,84,${a})`;
      g.lineWidth = w;
      path();
      g.stroke();
      g.strokeStyle = `rgba(255,222,150,${a * 0.8})`;
      g.lineWidth = Math.max(1, w * 0.35);
      path();
      g.stroke();
    } else {
      g.strokeStyle = `rgba(215,212,210,${a})`;
      g.lineWidth = w;
      path();
      g.stroke();
    }
  };
  for (let i = 0; i < 34; i++) vein(false, (0.6 + r() * 2.2) * (1 + lift), (0.05 + r() * 0.14) * (1 + lift * 2));
  for (let i = 0; i < 7 * (1 + lift * 4); i++) vein(true, (1.5 + r() * 4) * (1 + lift), 0.55 + r() * 0.4);
  for (let i = 0; i < 10 * (1 + lift * 3); i++) vein(true, 0.8 + r() * 1.2, 0.35 + r() * 0.3);
  return tex(c);
}

/** Dark lacquered wood for the table the pieces stand on: fine long grain under a deep gloss. */
function lacquerWood(seed: number) {
  const [c, g] = canvas(2048, 1024);
  const r = rng(seed);
  g.fillStyle = '#1b0f08';
  g.fillRect(0, 0, 2048, 1024);
  for (let i = 0; i < 900; i++) {
    const y = r() * 1024;
    const l = r() < 0.5;
    g.strokeStyle = l ? `rgba(92,56,30,${0.05 + r() * 0.12})` : `rgba(0,0,0,${0.1 + r() * 0.2})`;
    g.lineWidth = 0.6 + r() * 3;
    g.beginPath();
    g.moveTo(0, y);
    const amp = 2 + r() * 8,
      f = 0.002 + r() * 0.004,
      ph = r() * 6;
    for (let x = 0; x <= 2048; x += 32) g.lineTo(x, y + Math.sin(x * f + ph) * amp);
    g.stroke();
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 3);
  return t;
}

/** A soft round darkness to lay under a piece: ambient occlusion where it meets the table. */
function blobTexture() {
  const [c, g] = canvas(256, 256);
  const b = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  b.addColorStop(0, 'rgba(0,0,0,0.85)');
  b.addColorStop(0.55, 'rgba(0,0,0,0.5)');
  b.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = b;
  g.fillRect(0, 0, 256, 256);
  return tex(c);
}

/** The table's opacity: solid near the pieces, melting into the blurred room behind. */
function tableAlpha() {
  const [c, g] = canvas(512, 512);
  // Plane 8 x 8 centred on the pieces; v = 0 at the far edge (z = -4).
  const lin = g.createLinearGradient(0, 0, 0, 512);
  const zv = (z: number) => (z + 4) / 8;
  lin.addColorStop(0, '#000');
  lin.addColorStop(zv(-2.5), '#000');
  lin.addColorStop(zv(-0.9), '#e4e4e4');
  lin.addColorStop(zv(-0.2), '#ececec');
  lin.addColorStop(1, '#ffffff');
  g.fillStyle = lin;
  g.fillRect(0, 0, 512, 512);
  // Fade the far sides as well.
  g.globalCompositeOperation = 'multiply';
  const side = g.createLinearGradient(0, 0, 512, 0);
  side.addColorStop(0, '#000');
  side.addColorStop(0.18, '#fff');
  side.addColorStop(0.82, '#fff');
  side.addColorStop(1, '#000');
  g.fillStyle = side;
  g.fillRect(0, 0, 512, 512);
  return tex(c, false);
}

const ROOMS = ['private-club', 'imperial', 'hk-teahouse', 'dubai', 'shanghai', 'al-fahidi-majlis', 'new-york', 'taipei'];
const imgs = new Map<string, Promise<HTMLImageElement>>();
function loadImage(src: string) {
  let p = imgs.get(src);
  if (!p) {
    p = new Promise((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => fail(new Error('no image ' + src));
      i.src = src;
    });
    imgs.set(src, p);
  }
  return p;
}

/**
 * The room behind the pieces: one of the game's own rooms, far out of focus,
 * darkened and warmed, with lantern bokeh and pale blossom in the corners.
 * The middle stays calm so the pieces stand out.
 */
async function roomBackdrop(room: string, seed: number, W: number, H: number) {
  const img = await loadImage(`/website/rooms/room-${room}-1800.jpg`);
  const r = rng(seed * 97 + 13);
  // The upper part of the room (walls, lamps), framed to the picture's shape.
  const sw = img.width * 0.86,
    sh = sw / (W / H);
  const sx = (img.width - sw) / 2,
    sy = img.height * 0.02;
  // Heavy blur cheaply: down-sample, blur, up-sample, blur again.
  const [s, sg] = canvas(Math.round(W / 4), Math.round(H / 4));
  sg.filter = `blur(${W / 480}px)`;
  sg.drawImage(img, sx, sy, sw, sh, -W / 60, -H / 60, s.width + W / 30, s.height + H / 30);
  const [c, g] = canvas(W, H);
  g.imageSmoothingQuality = 'high';
  g.filter = `blur(${W / 300}px) saturate(1.15)`;
  g.drawImage(s, -W * 0.04, -H * 0.04, W * 1.08, H * 1.08);
  g.filter = 'none';
  // Grade: darker and warmer, like a room lit by lanterns.
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = '#9c7c5e';
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  // The middle a little calmer and darker, so the pieces pop; a warm halo high behind them.
  const calm = g.createRadialGradient(W * 0.5, H * 0.55, 0, W * 0.5, H * 0.55, W * 0.36);
  calm.addColorStop(0, 'rgba(14,9,6,0.3)');
  calm.addColorStop(1, 'rgba(14,9,6,0)');
  g.fillStyle = calm;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  const halo = g.createRadialGradient(W * 0.5, H * 0.3, 0, W * 0.5, H * 0.3, W * 0.32);
  halo.addColorStop(0, 'rgba(120,78,36,0.18)');
  halo.addColorStop(1, 'rgba(120,78,36,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, W, H);
  // Lantern bokeh: soft discs with a slightly brighter rim, kept off the middle.
  const disc = (x: number, y: number, rad: number, col: string, a: number) => {
    const d = g.createRadialGradient(x, y, 0, x, y, rad);
    d.addColorStop(0, `rgba(${col},${a * 0.55})`);
    d.addColorStop(0.82, `rgba(${col},${a * 0.75})`);
    d.addColorStop(0.93, `rgba(${col},${a})`);
    d.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = d;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  };
  for (let i = 0; i < 26; i++) {
    let x = r() * W,
      y = r() * H * 0.75;
    if (Math.abs(x - W / 2) < W * 0.24) x = x < W / 2 ? x - W * 0.24 : x + W * 0.24;
    const rad = H * (0.015 + r() * r() * 0.07);
    disc(x, y, rad, r() < 0.7 ? '255,186,104' : '255,214,160', 0.12 + r() * 0.22);
  }
  g.globalCompositeOperation = 'source-over';
  // Blossom in the top corners: out-of-focus branches with pale pink flowers.
  for (const side of [0, 1]) {
    const flip = (x: number) => (side ? W - x : x);
    g.filter = `blur(${H / 70}px)`;
    g.strokeStyle = 'rgba(28,16,12,0.85)';
    g.lineCap = 'round';
    const pts: [number, number][] = [];
    let x = -W * 0.02,
      y = H * (0.05 + r() * 0.12);
    g.lineWidth = H * 0.022;
    g.beginPath();
    g.moveTo(flip(x), y);
    for (let k = 0; k < 6; k++) {
      x += W * (0.014 + r() * 0.012);
      y += H * (r() - 0.35) * 0.06;
      g.lineTo(flip(x), y);
      pts.push([x, y]);
    }
    g.stroke();
    g.lineWidth = H * 0.01;
    for (const [bx, by] of pts.slice(1, 5)) {
      g.beginPath();
      g.moveTo(flip(bx), by);
      g.lineTo(flip(bx + W * 0.02 * r()), by + H * (r() - 0.6) * 0.12);
      g.stroke();
    }
    g.filter = 'none';
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) {
      const [bx, by] = pts[Math.floor(r() * pts.length)];
      const px = bx + (r() - 0.5) * W * 0.06,
        py = by + (r() - 0.5) * H * 0.12;
      disc(flip(px), py, H * (0.012 + r() * 0.035), r() < 0.6 ? '255,170,196' : '255,214,226', 0.18 + r() * 0.28);
    }
    g.globalCompositeOperation = 'source-over';
  }
  // The lower half sinks into shadow, so the table in front reads calm.
  const low = g.createLinearGradient(0, H * 0.4, 0, H);
  low.addColorStop(0, 'rgba(8,5,3,0)');
  low.addColorStop(1, 'rgba(8,5,3,0.7)');
  g.fillStyle = low;
  g.fillRect(0, 0, W, H);
  // A gentle vignette.
  const v = g.createRadialGradient(W / 2, H * 0.5, H * 0.4, W / 2, H * 0.5, W * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  return c;
}

/**
 * A studio environment for reflections: the warm room all round, a big soft
 * box above the camera, a strip light to each side and warm strips behind.
 */
function studioEnv(r: THREE.WebGLRenderer, room: HTMLCanvasElement) {
  const s = new THREE.Scene();
  const rt = tex(room);
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), new THREE.MeshBasicMaterial({ map: rt, side: THREE.BackSide }));
  sphere.material.color.setScalar(0.9);
  s.add(sphere);
  const box = (w: number, h: number, pos: [number, number, number], col: string, k: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  box(5, 2.2, [0, 6, 5], '#fff6ea', 5); // overhead soft box, toward the camera
  box(6, 2.4, [0, 1.6, 8], '#fff3e6', 1.3); // a big diffuser behind the camera
  box(1.2, 5, [-7, 2.5, 3], '#fff1e0', 3); // key-side strip
  box(1.2, 5, [7, 2, 2], '#ffe9d2', 1.6); // fill-side strip
  box(0.8, 5, [-5, 2, -6], '#ffbe70', 4); // warm rims behind
  box(0.8, 5, [5, 2, -6], '#ffbe70', 4);
  const pmrem = new THREE.PMREMGenerator(r);
  const out = pmrem.fromScene(s, 0.02).texture;
  pmrem.dispose();
  s.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  });
  rt.dispose();
  return out;
}

/** The product-shot lighting: soft key with shadows, a fill, a soft box above and warm rims behind. */
function productLights(scene: THREE.Scene, target: THREE.Vector3, k = 1) {
  const key = new THREE.SpotLight('#fff3e4', 26 * k, 0, 0.36, 1, 1.6);
  key.position.set(-0.8, 3.0, 2.4);
  key.target.position.copy(target);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.radius = 8;
  key.shadow.blurSamples = 20;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.006;
  key.shadow.camera.near = 1.5;
  key.shadow.camera.far = 6;
  scene.add(key, key.target);
  const fill = new THREE.RectAreaLight('#ffe9d4', 0.9 * k, 2.4, 1.6);
  fill.position.set(2.2, 0.9, 1.8);
  fill.lookAt(target);
  const top = new THREE.RectAreaLight('#fff6ea', 1.3 * k, 2.6, 0.6);
  top.position.set(0, 2.1, 1.5);
  top.lookAt(target);
  scene.add(fill, top);
  for (const sx of [-1, 1]) {
    const rim = new THREE.SpotLight('#ffbf6e', 42 * k, 0, 0.36, 0.9, 1.6);
    rim.position.set(sx * 1.5, 1.35, -1.7);
    rim.target.position.copy(target).add(new THREE.Vector3(0, 0.18, 0));
    scene.add(rim, rim.target);
  }
  const crown = new THREE.SpotLight('#ffe2b0', 16 * k, 0, 0.5, 1, 1.6);
  crown.position.set(0.2, 2.6, -1.4);
  crown.target.position.copy(target);
  scene.add(crown, crown.target);
  scene.add(new THREE.HemisphereLight('#ffe6c8', '#140c06', 0.18 * k));
}

/**
 * A tile set on show, as a jewellery shot: its back and three or more faces,
 * standing on a marble stage (or in the set's case, or on the bare table)
 * on a dark lacquered table, in a room far out of focus.
 */
export type Stage = 'plinths' | 'disc' | 'case' | 'bare';

/** Distinct faces for one set's picture, varied from set to set: honours first, then numbers from different suits. */
function facePick(id: string, n: number): number[] {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0), h / 4294967296);
  const dragons = [31, 32, 33], winds = [27, 28, 29, 30];
  const suits = [0, 9, 18].sort(() => rnd() - 0.5);
  const out: number[] = [];
  const add = (pool: number[]) => {
    const left = pool.filter((k) => !out.includes(k));
    out.push(left[Math.floor(rnd() * left.length)]);
  };
  add(rnd() < 0.6 ? dragons : winds);
  for (let i = 0; out.length < n; i++) {
    if (i === 3 && n >= 5) add(rnd() < 0.5 ? winds : dragons);
    else add(Array.from({ length: 9 }, (_, j) => suits[i % 3] + j));
  }
  return out.slice(0, n);
}

export async function tileShowcase(id: string, w = 1440, h = 600, dpr = 2, mode: Stage = 'plinths', n = 0) {
  setTileSet(id);
  const st = currentTileSet();
  const r = getRenderer(w, h, dpr);
  r.setClearColor(0x000000, 1);
  r.toneMappingExposure = 0.92;
  const own = { geo: [] as THREE.BufferGeometry[], mat: [] as THREE.Material[], tex: [] as THREE.Texture[] };
  const scene = new THREE.Scene();
  const room = await roomBackdrop(ROOMS[n % ROOMS.length], n + 1, 1920, 800);
  const bg = tex(room);
  own.tex.push(bg);
  scene.background = bg;
  const envTex = studioEnv(r, room);
  own.tex.push(envTex);
  scene.environment = envTex;
  scene.environmentIntensity = 0.7;

  // Everything that stands on the table; mirrored under it for the lacquer's reflection.
  const stage = new THREE.Group();
  scene.add(stage);
  const reflectors: Reflector[] = [];
  const marbleMap = marbleTexture(7 + n * 31);
  own.tex.push(marbleMap);
  const marble = new THREE.MeshPhysicalMaterial({ map: marbleMap, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.9 });
  const marbleTop = new THREE.MeshPhysicalMaterial({ map: marbleMap, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.8, envMapIntensity: 0.9 });
  const gold = new THREE.MeshPhysicalMaterial({ color: '#e9bd6a', metalness: 1, roughness: 0.13, clearcoat: 0.5, clearcoatRoughness: 0.05 });
  own.mat.push(marble, marbleTop, gold);
  const add = (m: THREE.Object3D, shadow = true) => {
    m.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && shadow) o.castShadow = o.receiveShadow = true;
    });
    stage.add(m);
    return m;
  };
  /** A polished top: a mirror under a thin film of the marble, so the pieces reflect in the stone. */
  const mirrorTop = (geo: THREE.BufferGeometry, y: number, x = 0, z = 0) => {
    const ref = new Reflector(geo, { textureWidth: Math.min(2048, w * dpr), textureHeight: Math.min(2048, w * dpr), color: 0x9a9a9a, clipBias: 0.001 });
    ref.rotation.x = -Math.PI / 2;
    ref.position.set(x, y, z);
    reflectors.push(ref);
    scene.add(ref);
    const film = new THREE.Mesh(geo, marbleTop);
    film.rotation.x = -Math.PI / 2;
    film.position.set(x, y + 0.0006, z);
    film.receiveShadow = true;
    film.renderOrder = 4;
    scene.add(film);
  };
  const blob = blobTexture();
  own.tex.push(blob);
  const blobMat = new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, opacity: 0.9 });
  own.mat.push(blobMat);
  const shade = (sx: number, sz: number, x = 0, z = 0, y = 0.0015) => {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), blobMat);
    b.rotation.x = -Math.PI / 2;
    b.position.set(x, y, z);
    b.renderOrder = 2;
    scene.add(b);
  };
  const tile = (k: number) => makeTile(k, k >= 0, own, true);

  let target = new THREE.Vector3(0, 0.3, 0),
    dist = 1.9,
    azim = -0.1,
    elev = 0.21;
  if (mode === 'disc') {
    // One round marble stage with a polished gold rim; the pieces stand close on a gentle arc.
    const R = 0.66,
      DH = 0.075,
      FH = 0.022;
    const foot = new THREE.CylinderGeometry(R + 0.03, R + 0.04, FH, 128);
    const disc = new THREE.CylinderGeometry(R, R, DH, 128, 1, true);
    const rimBand = new THREE.CylinderGeometry(R + 0.012, R + 0.012, 0.018, 128, 1, true);
    const rimTop = new THREE.TorusGeometry(R + 0.006, 0.008, 16, 160);
    const top = new THREE.CircleGeometry(R, 128);
    own.geo.push(foot, disc, rimBand, rimTop, top);
    const f = new THREE.Mesh(foot, gold);
    f.position.y = FH / 2;
    const d = new THREE.Mesh(disc, marble);
    d.position.y = FH + DH / 2;
    const band = new THREE.Mesh(rimBand, gold);
    band.position.y = FH + DH - 0.009;
    const ring = new THREE.Mesh(rimTop, gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = FH + DH;
    add(f);
    add(d);
    add(band);
    add(ring);
    mirrorTop(top, FH + DH);
    shade(R * 2.9, R * 2.9);
    const kinds = [-1, ...facePick(id, 3)];
    kinds.forEach((k, i) => {
      const x = (i - 1.5) * 0.335,
        z = 0.12 - x * x * 0.55;
      const t = tile(k);
      t.position.set(x, FH + DH + 0.001, z);
      t.rotation.y = -x * 0.5;
      add(t);
    });
    target.set(0, 0.235, 0);
    dist = 2.12;
    elev = 0.14;
  } else if (mode === 'plinths') {
    // A row of marble risers of different heights, each with a gold band, one piece on each.
    const heights = [0.09, 0.15, 0.12, 0.07];
    // The veins drawn larger on the small risers, each riser cut from a different part of the slab.
    const pm = marbleTexture(11 + n * 17, 2048, 0.6);
    pm.wrapS = pm.wrapT = THREE.RepeatWrapping;
    pm.repeat.set(0.4, 0.4);
    pm.needsUpdate = true;
    own.tex.push(pm);
    const plinthMarble = new THREE.MeshPhysicalMaterial({ map: pm, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.2 });
    own.mat.push(plinthMarble);
    const kinds = [-1, ...facePick(id, 3)];
    const step = 0.37;
    kinds.forEach((k, i) => {
      const PH = heights[i];
      const x = (i - 1.5) * step,
        z = Math.abs(i - 1.5) < 1 ? -0.06 : 0.06;
      const PW = 0.35,
        PD = 0.3;
      const slab = new RoundedBoxGeometry(PW, PH, PD, 6, 0.012);
      const bandG = new RoundedBoxGeometry(PW + 0.01, 0.014, PD + 0.01, 4, 0.006);
      const footG = new RoundedBoxGeometry(PW + 0.022, 0.018, PD + 0.022, 4, 0.008);
      own.geo.push(slab, bandG, footG);
      const foot = new THREE.Mesh(footG, gold);
      foot.position.set(x, 0.009, z);
      const m = new THREE.Mesh(slab, plinthMarble);
      m.position.set(x, 0.018 + PH / 2, z);
      const band = new THREE.Mesh(bandG, gold);
      band.position.set(x, 0.018 + PH - 0.006, z);
      add(foot);
      add(m);
      add(band);
      shade(PW * 1.9, PD * 1.9, x, z);
      const t = tile(k);
      t.position.set(x, 0.018 + PH + 0.002, z + 0.01);
      t.rotation.y = -x * 0.22;
      add(t);
    });
    target.set(0, 0.29, 0);
    dist = 2.3;
  } else if (mode === 'case') {
    // Part of the set: the pieces standing in the set's open lacquer case, lid raised behind.
    const kinds = [-1, ...facePick(id, 3)];
    const sc = 0.96,
      step = TW * sc + 0.02;
    const CW = kinds.length * step + 0.12,
      CD = 0.42,
      CH = 0.04,
      WH = 0.1,
      WT = 0.035;
    const lacquer = new THREE.MeshPhysicalMaterial({ color: '#120808', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03 });
    const lineCol = luma(st.back) < 0.25 ? '#5a1622' : mix(st.back, '#000000', 0.35);
    const lining = new THREE.MeshPhysicalMaterial({ color: lineCol, roughness: 0.9, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(mix(lineCol, '#ffffff', 0.35)) });
    own.mat.push(lacquer, lining);
    const g = new THREE.Group();
    const box = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
      own.geo.push(geo);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    box(new RoundedBoxGeometry(CW, CH, CD, 4, 0.012), lacquer, 0, CH / 2, 0);
    box(new RoundedBoxGeometry(CW, WH, WT, 4, 0.01), lacquer, 0, CH + WH / 2 - 0.01, -CD / 2 + WT / 2);
    box(new RoundedBoxGeometry(CW, WH * 0.55, WT, 4, 0.01), lacquer, 0, CH + (WH * 0.55) / 2 - 0.01, CD / 2 - WT / 2);
    box(new RoundedBoxGeometry(WT, WH, CD, 4, 0.01), lacquer, -CW / 2 + WT / 2, CH + WH / 2 - 0.01, 0);
    box(new RoundedBoxGeometry(WT, WH, CD, 4, 0.01), lacquer, CW / 2 - WT / 2, CH + WH / 2 - 0.01, 0);
    // Gold edging along the front and the top of the sides.
    box(new RoundedBoxGeometry(CW + 0.006, 0.01, WT + 0.006, 3, 0.004), gold, 0, CH + WH * 0.55 - 0.01, CD / 2 - WT / 2);
    box(new RoundedBoxGeometry(CW + 0.006, 0.012, 0.012, 3, 0.005), gold, 0, 0.006, CD / 2 + 0.002);
    const padG = new RoundedBoxGeometry(CW - WT * 2, 0.02, CD - WT * 2, 3, 0.008);
    box(padG, lining, 0, CH + 0.005, 0);
    // The lid, raised and leaning back, lined to match.
    const lid = new THREE.Group();
    const LH = 0.5;
    const shell = new RoundedBoxGeometry(CW, LH, 0.03, 4, 0.012);
    const inner = new RoundedBoxGeometry(CW - 0.06, LH - 0.06, 0.012, 3, 0.005);
    const lidTrim = new RoundedBoxGeometry(CW - 0.04, LH - 0.04, 0.008, 3, 0.004);
    own.geo.push(shell, inner, lidTrim);
    const ls = new THREE.Mesh(shell, lacquer);
    ls.position.set(0, LH / 2, -0.015);
    const lt = new THREE.Mesh(lidTrim, gold);
    lt.position.set(0, LH / 2, 0.002);
    const li = new THREE.Mesh(inner, lining);
    li.position.set(0, LH / 2, 0.006);
    lid.add(ls, lt, li);
    lid.position.set(0, CH + WH - 0.01, -CD / 2);
    lid.rotation.x = -0.32;
    g.add(lid);
    add(g);
    shade(CW * 1.3, CD * 2.4, 0, -0.05);
    kinds.forEach((k, i) => {
      const t = tile(k);
      t.scale.setScalar(sc);
      t.position.set((i - (kinds.length - 1) / 2) * step, CH + 0.016, 0.03);
      t.rotation.x = -0.1;
      add(t);
    });
    target.set(0, 0.215, 0);
    dist = 2.15;
    elev = 0.24;
  } else {
    // No stage at all: the pieces stand straight on the lacquered table, fanned a little.
    const kinds = [-1, ...facePick(id, 3)];
    kinds.forEach((k, i) => {
      const x = (i - 1.5) * 0.345;
      const t = tile(k);
      t.position.set(x, 0.001, 0.1 - x * x * 0.5);
      t.rotation.y = -x * 0.45;
      add(t);
      shade(TW * 1.7, TD * 2.6, x, 0.1 - x * x * 0.5);
    });
    target.set(0, 0.205, 0);
    dist = 2.0;
  }

  // The table: dark lacquered wood that melts into the room, with the pieces mirrored in it.
  const wood = lacquerWood(5 + n);
  const alpha = tableAlpha();
  own.tex.push(wood, alpha);
  const tableMat = new THREE.MeshPhysicalMaterial({ map: wood, alphaMap: alpha, transparent: true, depthWrite: false, roughness: 0.75, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.3 });
  own.mat.push(tableMat);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), tableMat);
  table.rotation.x = -Math.PI / 2;
  table.receiveShadow = true;
  table.renderOrder = 1;
  scene.add(table);
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.55, depthWrite: false }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = 0.002;
  catcher.receiveShadow = true;
  catcher.renderOrder = 3;
  scene.add(catcher);
  const mirrored = stage.clone();
  mirrored.scale.y = -1;
  mirrored.traverse((o) => (o.castShadow = false));
  scene.add(mirrored);

  productLights(scene, target);
  const cam = new THREE.PerspectiveCamera(22, w / h, 0.05, 50);
  cam.position.set(target.x + Math.sin(azim) * Math.cos(elev) * dist, target.y + Math.sin(elev) * dist, target.z + Math.cos(azim) * Math.cos(elev) * dist);
  cam.lookAt(target);
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/png');
  for (const m of reflectors) m.dispose();
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !own.geo.includes(m.geometry)) m.geometry.dispose();
  });
  for (const g of own.geo) g.dispose();
  for (const m of own.mat) m.dispose();
  for (const t of own.tex) t.dispose();
  return url;
}

/** The studio lighting the rack and single-tile pictures use (key spot, gold rims, soft top panel). */
function studioLights(scene: THREE.Scene, spread: number, target = new THREE.Vector3(0, 0.2, 0)) {
  const key = new THREE.SpotLight('#fff1dc', 24, 0, 0.42, 0.85, 1.6);
  key.position.set(-1.4, 3.2, 1.9);
  key.target.position.copy(target);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 6;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.01;
  scene.add(key, key.target);
  // Gold rims from behind, one each side, to draw the edges.
  for (const sx of [-1, 1]) {
    const rim = new THREE.SpotLight('#ffc978', 34, 0, 0.5, 0.9, 1.6);
    rim.position.set(sx * spread, 1.3, -1.6);
    rim.target.position.copy(target);
    scene.add(rim, rim.target);
  }
  // A long soft panel above the camera: the bright stripe on glossy faces.
  const panel = new THREE.RectAreaLight('#fff4e4', 1.4, spread * 2.2, 0.5);
  panel.position.set(0, 1.9, 2.2);
  panel.lookAt(target);
  scene.add(panel);
  scene.add(new THREE.HemisphereLight('#ffe9cc', '#120c06', 0.25));
}

/** Dark panelled wall with out-of-focus brass lamps, as behind a club table. */
function clubWallTexture() {
  const [c, g] = canvas(1600, 900);
  const bg = g.createLinearGradient(0, 0, 0, 900);
  bg.addColorStop(0, '#120c07');
  bg.addColorStop(1, '#070504');
  g.fillStyle = bg;
  g.fillRect(0, 0, 1600, 900);
  // Panels.
  g.filter = 'blur(10px)';
  for (let x = -60; x < 1600; x += 360) {
    g.fillStyle = 'rgba(70,42,22,0.55)';
    g.fillRect(x + 30, 120, 300, 620);
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(x + 50, 140, 260, 580);
  }
  // Lamps and brass glints.
  for (const [x, y, rr, a] of [
    [1240, 260, 150, 0.55],
    [300, 210, 120, 0.35],
    [1480, 520, 80, 0.3],
    [760, 160, 90, 0.22],
  ] as const) {
    const l = g.createRadialGradient(x, y, 0, x, y, rr);
    l.addColorStop(0, `rgba(255,196,110,${a})`);
    l.addColorStop(1, 'rgba(255,196,110,0)');
    g.fillStyle = l;
    g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  g.fillStyle = 'rgba(214,168,92,0.35)';
  g.fillRect(1180, 330, 26, 420);
  g.fillRect(1330, 300, 18, 460);
  g.filter = 'none';
  return tex(c);
}

/** Green baize with a fine weave, for the rack to sit on. */
function baizeTexture() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#123a2a';
  g.fillRect(0, 0, 512, 512);
  let s = 11;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40000; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${r() * 0.05})` : `rgba(0,0,0,${r() * 0.1})`;
    g.fillRect(r() * 512, r() * 512, 1, 1 + r() * 2);
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(60, 60);
  return t;
}

/** A rack on show at a club table, holding a few tiles of the given set, lit in the studio way. */
export function rackShowcase(id: string, tileSet = 'classic-ivory', w = 1440, h = 792, dpr = 2) {
  setTileSet(tileSet);
  const r = getRenderer(w, h, dpr);
  r.toneMappingExposure = 0.82;
  const own = { geo: [] as THREE.BufferGeometry[], mat: [] as THREE.Material[], tex: [] as THREE.Texture[] };
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 0.55;
  // The far baize melts into the room's dark.
  scene.fog = new THREE.Fog('#0b0805', 5, 13);
  const st = rackStyle(id);
  const felt = '#17402f';
  const tableWood = new THREE.MeshPhysicalMaterial({ color: '#3b2416', roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.15 });
  const tableTrim = new THREE.MeshStandardMaterial({ color: '#c9a46a', metalness: 1, roughness: 0.25 });
  own.mat.push(tableWood, tableTrim);
  const mats = rackMaterials(st, 'high', { wood: tableWood, trim: tableTrim, felt }, 16);
  const KINDS = facePick(id, 7);
  const s = 1.32,
    z = 3.98;
  const fit: HumanRackFit = { scale: s, z, tw: TW, th: TH, td: TD };
  const step = TW * s + 0.012;
  const length = KINDS.length * step + 0.3;
  const rack = rackSegment(st, mats, 'human', length, fit);
  rack.position.z = -z;
  rack.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
  });
  scene.add(rack);
  // Centre the tiles on the rack as built.
  const rb = new THREE.Box3().setFromObject(rack);
  const cx = (rb.min.x + rb.max.x) / 2;
  const wallTex = clubWallTexture();
  const baize = baizeTexture();
  own.tex.push(wallTex, baize);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshBasicMaterial({ map: wallTex, toneMapped: false, fog: false }));
  wall.position.set(3.5, 2.2, -7.5);
  wall.scale.setScalar(1.6);
  wall.lookAt(-2.6, 0.7, 2.2);
  scene.add(wall);
  const feltMat = new THREE.MeshPhysicalMaterial({ map: baize, color: '#ffffff', roughness: 0.92, sheen: 0.35, sheenRoughness: 0.5, sheenColor: new THREE.Color('#2f6b4d') });
  own.mat.push(feltMat);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), feltMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  KINDS.forEach((k, i) => {
    const t = makeTile(k, true, own);
    const inner = t.children[0];
    inner.position.y = 0;
    inner.traverse((o) => (o.castShadow = true));
    t.scale.setScalar(s);
    t.rotation.x = -HAND_LEAN;
    t.position.set(cx + (i - (KINDS.length - 1) / 2) * step, (TH * s) / 2 + 0.03 + HAND_RAISE, 0);
    scene.add(t);
  });
  studioLights(scene, 2.6, new THREE.Vector3(-0.2, 0.2, 0.1));
  const cam = new THREE.PerspectiveCamera(28, w / h, 0.05, 60);
  cam.position.set(cx - 2.5, 0.66, 2.95);
  cam.lookAt(cx - 0.12, 0.25, 0.05);
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/png');
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !own.geo.includes(m.geometry)) m.geometry.dispose();
  });
  for (const g of own.geo) g.dispose();
  for (const m of own.mat) m.dispose();
  for (const t of own.tex) t.dispose();
  disposeRackMaterials(mats);
  void mix;
  return url;
}

/**
 * One tile alone on a clear background, standing and turned a little so its
 * layers show, with a soft contact shadow: for the website's wind row.
 */
export function singleTile(kind: number, tileSet = 'classic-ivory', w = 360, h = 460, dpr = 2) {
  setTileSet(tileSet);
  if (renderer) renderer.setClearColor(0x000000, 0);
  const r = getRenderer(w, h, dpr);
  r.setClearColor(0x000000, 0);
  r.toneMappingExposure = 0.85;
  const own = { geo: [] as THREE.BufferGeometry[], mat: [] as THREE.Material[], tex: [] as THREE.Texture[] };
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 0.45;
  const t = makeTile(kind, true, own);
  t.rotation.y = -0.32;
  scene.add(t);
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ opacity: 0.6 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.receiveShadow = true;
  scene.add(catcher);
  studioLights(scene, 1.0, new THREE.Vector3(0, 0.2, 0));
  const cam = new THREE.PerspectiveCamera(22, w / h, 0.05, 50);
  cam.position.set(0.2, 0.66, 2.05);
  cam.lookAt(0.03, 0.2, 0);
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/png');
  r.setClearColor(0x000000, 1);
  catcher.geometry.dispose();
  for (const g of own.geo) g.dispose();
  for (const m of own.mat) m.dispose();
  for (const x of own.tex) x.dispose();
  return url;
}
