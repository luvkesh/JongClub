// 3D gold objects for the website's "Play for It" and "The Club" cards (the user's references
// show a small object on a round stand in each card). Plain three.js, no game code: open
// tools/featicons.html through any static server with three 0.169 under /node_modules/three,
// then call window.featIcon(key) for a PNG data URL. Rendered by tools/featicons.mjs.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const S = 300;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
const pmrem = new THREE.PMREMGenerator(renderer);
const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const gold = (rough = 0.2, color = '#e0b45e') => new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: rough, clearcoat: 0.4, clearcoatRoughness: 0.1, envMapIntensity: 1.3 });
const jade = () => new THREE.MeshPhysicalMaterial({ color: '#2c8a62', roughness: 0.15, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, transmission: 0.1, thickness: 0.4, envMapIntensity: 1.1, sheen: 0.3, sheenColor: new THREE.Color('#bfe8d2') });
const lacquer = (c, r = 0.25) => new THREE.MeshPhysicalMaterial({ color: c, roughness: r, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 });

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; return t; }

function lights(scene) {
  const key = new THREE.SpotLight('#fff0d8', 36, 0, 0.6, 0.9, 1.4);
  key.position.set(-1.8, 3.2, 3.2); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 6; key.shadow.bias = -0.0004;
  scene.add(key, key.target);
  for (const sx of [-1, 1]) { const rim = new THREE.SpotLight('#ffc674', 22, 0, 0.6, 0.9, 1.4); rim.position.set(sx * 2.4, 1.8, -1.4); scene.add(rim, rim.target); }
  const fill = new THREE.DirectionalLight('#ffe2bf', 0.8); fill.position.set(2.2, 0.6, 3); scene.add(fill);
  scene.add(new THREE.HemisphereLight('#ffe9cc', '#0d1a12', 0.45));
}

/** The round stand every object sits on: a dark green top in a polished gold rim. */
function stand(root) {
  const g = new THREE.Group();
  g.scale.set(0.86, 1, 0.86);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.06, 0.12, 96), gold(0.14));
  rim.position.y = -0.06;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.02, 96), new THREE.MeshStandardMaterial({ color: '#06170f', roughness: 0.85, metalness: 0, envMapIntensity: 0.25 }));
  top.position.y = 0.005;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.975, 0.022, 16, 128), gold(0.12));
  lip.rotation.x = Math.PI / 2; lip.position.y = 0.012;
  g.add(rim, top, lip);
  g.traverse((m) => { if (m.isMesh) { m.receiveShadow = true; m.castShadow = true; } });
  root.add(g);
}

function lathe(points, mat, seg = 96) { return new THREE.Mesh(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg), mat); }

// ---------- Jong Points: a stack of coins and one standing coin with a quatrefoil
function coinFace() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#ffffff'; g.lineWidth = 14;
  g.beginPath(); g.arc(256, 256, 214, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 16;
  for (const [x, y] of [[256, 196], [316, 256], [256, 316], [196, 256]]) { g.beginPath(); g.arc(x, y, 58, 0, Math.PI * 2); g.stroke(); }
  return tex(c);
}
function coin(r = 0.36, h = 0.075, face = null) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 72), gold(0.2));
  const edge = new THREE.Mesh(new THREE.TorusGeometry(r * 0.88, h * 0.18, 10, 72), gold(0.12, '#f3d48f'));
  edge.rotation.x = Math.PI / 2; edge.position.y = h / 2;
  g.add(body, edge);
  if (face) {
    const m = gold(0.22); m.bumpMap = face; m.bumpScale = 3;
    const f = new THREE.Mesh(new THREE.CircleGeometry(r * 0.86, 72), m);
    f.rotation.x = -Math.PI / 2; f.position.y = h / 2 + 0.002; g.add(f);
  }
  return g;
}
function buildCoins(root) {
  const face = coinFace();
  for (let i = 0; i < 5; i++) { const c = coin(0.36, 0.075, i === 4 ? face : null); c.position.set(-0.28 + (i % 2) * 0.012, 0.04 + i * 0.078, -0.05); c.rotation.y = i; root.add(c); }
  for (let i = 0; i < 3; i++) { const c = coin(0.34, 0.075, i === 2 ? face : null); c.position.set(0.12, 0.04 + i * 0.078, 0.28); root.add(c); }
  const up = coin(0.42, 0.085, face); up.rotation.set(Math.PI / 2 - 0.25, 0, -0.18); up.position.set(0.38, 0.44, 0.1); root.add(up);
}

// ---------- The season track: a desk calendar with a blossom sprig and two days ticked
function calendarPage() {
  const [c, g] = canvas(1024, 768);
  const gr = g.createLinearGradient(0, 0, 0, 768); gr.addColorStop(0, '#fbf5e6'); gr.addColorStop(1, '#efe3c6');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 768);
  g.strokeStyle = '#c7a466'; g.lineWidth = 4;
  for (let x = 0; x <= 5; x++) { g.beginPath(); g.moveTo(80 + x * 173, 160); g.lineTo(80 + x * 173, 700); g.stroke(); }
  for (let y = 0; y <= 3; y++) { g.beginPath(); g.moveTo(80, 160 + y * 180); g.lineTo(945, 160 + y * 180); g.stroke(); }
  g.strokeStyle = '#2a2015'; g.lineWidth = 16; g.lineCap = 'round';
  for (const [x, y] of [[80, 520], [253, 520]]) { g.beginPath(); g.moveTo(x + 50, y + 95); g.lineTo(x + 80, y + 128); g.lineTo(x + 130, y + 52); g.stroke(); }
  // a blossom sprig
  g.strokeStyle = '#5a3322'; g.lineWidth = 12; g.beginPath(); g.moveTo(980, 120); g.quadraticCurveTo(760, 200, 560, 420); g.stroke();
  g.lineWidth = 7; g.beginPath(); g.moveTo(800, 190); g.lineTo(720, 120); g.stroke();
  for (const [x, y, r] of [[860, 160, 46], [700, 260, 52], [600, 380, 40], [740, 120, 34], [940, 130, 30]]) {
    for (let k = 0; k < 5; k++) { const a = k * 1.2566 + 0.3; g.fillStyle = '#f29db6'; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.36, a, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#c0436a'; g.beginPath(); g.arc(x, y, r * 0.2, 0, Math.PI * 2); g.fill();
  }
  return tex(c);
}
function buildCalendar(root) {
  const page = calendarPage();
  const W = 1.5, H = 1.05;
  const tilt = new THREE.Group(); tilt.rotation.set(-0.32, -0.38, 0); tilt.position.set(0, 0.07, -0.05);
  const back = new THREE.Mesh(new RoundedBoxGeometry(W, H, 0.06, 4, 0.03), lacquer('#7a5a2a', 0.35));
  back.position.set(0, H / 2, -0.06);
  const pages = new THREE.Mesh(new RoundedBoxGeometry(W - 0.04, H - 0.05, 0.05, 4, 0.02), new THREE.MeshStandardMaterial({ color: '#efe4cb', roughness: 0.8 }));
  pages.position.set(0, H / 2 - 0.02, 0);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.06, H - 0.08), new THREE.MeshStandardMaterial({ map: page, roughness: 0.75 }));
  front.position.set(0, H / 2 - 0.03, 0.027);
  tilt.add(back, pages, front);
  for (const x of [-0.45, 0.45]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 12, 40), gold(0.12)); ring.position.set(x, H + 0.0, 0); ring.rotation.y = Math.PI / 2; tilt.add(ring); }
  const bar = new THREE.Mesh(new RoundedBoxGeometry(W + 0.04, 0.08, 0.1, 3, 0.03), gold(0.18)); bar.position.set(0, H - 0.04, -0.02); tilt.add(bar);
  // the easel foot behind
  const foot = new THREE.Mesh(new RoundedBoxGeometry(W - 0.1, 0.9, 0.04, 3, 0.02), lacquer('#6b4d22', 0.4)); foot.position.set(0, 0.42, -0.42); foot.rotation.x = 0.55; tilt.add(foot);
  tilt.scale.setScalar(0.92);
  root.add(tilt);
}

// ---------- World Tour stamps: a perforated stamp of a pagoda, with a postmark
function stampTexture() {
  const [c, g] = canvas(640, 760);
  g.clearRect(0, 0, 640, 760);
  g.fillStyle = '#f7efd9'; g.fillRect(20, 20, 600, 720);
  g.globalCompositeOperation = 'destination-out';
  for (let x = 20; x <= 620; x += 40) for (const y of [20, 740]) { g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fill(); }
  for (let y = 20; y <= 740; y += 40) for (const x of [20, 620]) { g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = '#c9a256'; g.lineWidth = 10; g.strokeRect(62, 62, 516, 636);
  const sky = g.createLinearGradient(0, 70, 0, 690); sky.addColorStop(0, '#9fc9b6'); sky.addColorStop(0.6, '#5f9b83'); sky.addColorStop(1, '#2f6a55');
  g.fillStyle = sky; g.fillRect(70, 70, 500, 620);
  g.fillStyle = '#3d7a62'; g.beginPath(); g.moveTo(70, 560); g.quadraticCurveTo(220, 470, 330, 540); g.quadraticCurveTo(450, 470, 570, 520); g.lineTo(570, 690); g.lineTo(70, 690); g.fill();
  // the pagoda: three roofs
  g.fillStyle = '#f4e1b0';
  const roof = (y, w) => { g.beginPath(); g.moveTo(320 - w, y); g.quadraticCurveTo(320 - w * 0.4, y - 30, 320, y - 54); g.quadraticCurveTo(320 + w * 0.4, y - 30, 320 + w, y); g.closePath(); g.fill(); };
  g.fillRect(250, 440, 140, 130); g.fillRect(270, 340, 100, 100); g.fillRect(288, 250, 64, 90);
  g.fillStyle = '#c9893f'; roof(450, 150); roof(350, 120); roof(258, 90);
  g.fillStyle = '#7d4a22'; for (let i = 0; i < 3; i++) g.fillRect(268 + i * 40, 470, 22, 80);
  g.fillStyle = '#f4e1b0'; g.fillRect(200, 570, 240, 24);
  return tex(c);
}
function buildStamp(root) {
  const t = stampTexture();
  const geo = new THREE.PlaneGeometry(1.0, 1.19, 24, 24);
  const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) + 0.5) * 2.4) * 0.05);
  geo.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.5, roughness: 0.6, side: THREE.DoubleSide });
  const s = new THREE.Mesh(geo, m);
  s.position.set(-0.08, 0.7, 0.0); s.rotation.set(-0.25, 0.2, 0.12);
  root.add(s);
  // a gold postmark: rings and wavy cancel lines beside the stamp
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.014, 10, 64), gold(0.16)); ring.position.set(0.42, 0.98, 0.18); ring.rotation.set(-0.25, 0.2, 0); root.add(ring);
  for (let k = 0; k < 4; k++) {
    const pts = []; for (let i = 0; i <= 30; i++) { const x = i / 30; pts.push(new THREE.Vector3(0.3 + x * 0.55, 0.62 + k * 0.1 + Math.sin(x * 9) * 0.03, 0.2)); }
    const w = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.012, 8), gold(0.16)); w.rotation.set(-0.25, 0.2, 0); root.add(w);
  }
}

// ---------- Buy Jong Points: a jade tag with a gold quatrefoil and a tassel
function buildTag(root) {
  const shape = new THREE.Shape(); const w = 0.62, h = 0.92, r = 0.12;
  shape.moveTo(-w / 2 + r, -h / 2); shape.lineTo(w / 2 - r, -h / 2); shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  shape.lineTo(w / 2, h / 2 - 0.2); shape.lineTo(w / 2 - 0.2, h / 2); shape.lineTo(-w / 2 + 0.2, h / 2); shape.lineTo(-w / 2, h / 2 - 0.2);
  shape.lineTo(-w / 2, -h / 2 + r); shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const hole = new THREE.Path(); hole.absarc(0, h / 2 - 0.15, 0.05, 0, Math.PI * 2, true); shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 6, curveSegments: 24 });
  geo.translate(0, 0, -0.04);
  const tag = new THREE.Group();
  tag.add(new THREE.Mesh(geo, jade()));
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 8, 64), gold(0.14)); frame.position.z = 0.075; frame.position.y = -0.05; tag.add(frame);
  for (const [x, y] of [[0, 0.04], [0.09, -0.05], [0, -0.14], [-0.09, -0.05]]) { const l = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.011, 8, 48), gold(0.14)); l.position.set(x, y, 0.075); tag.add(l); }
  tag.rotation.set(-0.55, -0.15, -0.55); tag.position.set(-0.12, 0.42, 0.05);
  root.add(tag);
  // the cord and the tassel
  const top = new THREE.Vector3(-0.12 + 0.2, 0.42 + 0.38, 0.0);
  const cord = new THREE.CatmullRomCurve3([top, new THREE.Vector3(0.28, 0.98, -0.05), new THREE.Vector3(0.46, 0.88, 0.05), new THREE.Vector3(0.5, 0.62, 0.1)]);
  root.add(new THREE.Mesh(new THREE.TubeGeometry(cord, 60, 0.018, 8), gold(0.25, '#d9a94e')));
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), gold(0.2)); knot.position.set(0.5, 0.6, 0.1); root.add(knot);
  const tassel = lathe([[0.0, 0.0], [0.05, 0.02], [0.07, 0.1], [0.085, 0.35], [0.06, 0.4], [0, 0.41]], gold(0.38, '#d6a447'), 48);
  tassel.rotation.x = Math.PI; tassel.position.set(0.5, 0.58, 0.1); root.add(tassel);
}

// ---------- Ratings: three gold bars rising
function buildChart(root) {
  const base = new THREE.Mesh(new RoundedBoxGeometry(1.25, 0.06, 0.5, 3, 0.02), gold(0.2)); base.position.y = 0.05; root.add(base);
  [[-0.4, 0.45], [0, 0.75], [0.4, 1.1]].forEach(([x, hgt]) => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.28, hgt, 0.28, 4, 0.03), gold(0.16)); b.position.set(x, 0.08 + hgt / 2, 0); root.add(b); });
}

// ---------- Seasons: a glowing paper lantern with gold caps and a tassel
function lanternTexture() {
  const [c, g] = canvas(1024, 512);
  const gr = g.createLinearGradient(0, 0, 1024, 0); gr.addColorStop(0, '#e9b56a'); gr.addColorStop(0.5, '#ffe2a8'); gr.addColorStop(1, '#e9b56a');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  g.strokeStyle = 'rgba(160,110,50,0.5)'; g.lineWidth = 3; for (let x = 0; x < 1024; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  return tex(c);
}
function buildLantern(root) {
  const lt = lanternTexture();
  const body = lathe([[0.18, 0], [0.38, 0.08], [0.47, 0.3], [0.47, 0.5], [0.38, 0.72], [0.18, 0.8]], new THREE.MeshStandardMaterial({ map: lt, emissive: '#ff8a2a', emissiveIntensity: 0.32, color: '#f3c27a', emissiveMap: lt, roughness: 0.7 }));
  body.position.y = 0.32; root.add(body);
  for (const [y, r] of [[0.32, 0.22], [1.12, 0.22]]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.07, 48), gold(0.16)); cap.position.y = y; root.add(cap); }
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), gold(0.12)); finial.position.y = 1.2; root.add(finial);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.18, 24), gold(0.16)); stem.position.y = 0.22; root.add(stem);
  const tassel = lathe([[0, 0], [0.05, 0.02], [0.065, 0.1], [0.08, 0.22], [0, 0.23]], gold(0.38, '#d6a447'), 48); tassel.rotation.x = Math.PI; tassel.position.y = 0.13; root.add(tassel);
  const glow = new THREE.PointLight('#ffb860', 4, 3, 1.5); glow.position.set(0, 0.7, 0.4); root.add(glow);
}

// ---------- Tournaments: a gold cup
function buildTrophy(root) {
  const cup = lathe([[0, 0.55], [0.12, 0.56], [0.3, 0.68], [0.42, 0.9], [0.46, 1.18], [0.44, 1.2], [0.4, 1.18], [0.38, 0.92], [0.27, 0.72], [0.0, 0.62]], gold(0.12));
  root.add(cup);
  const stem = lathe([[0, 0.12], [0.2, 0.12], [0.22, 0.17], [0.09, 0.22], [0.06, 0.4], [0.1, 0.48], [0.13, 0.56], [0, 0.57]], gold(0.14)); root.add(stem);
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.12, 0.62, 4, 0.03), lacquer('#1e3b2e', 0.3)); base.position.y = 0.06; root.add(base);
  const band = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.03, 0.66, 3, 0.012), gold(0.14)); band.position.y = 0.12; root.add(band);
  for (const sx of [-1, 1]) {
    const pts = [new THREE.Vector3(sx * 0.42, 1.08, 0), new THREE.Vector3(sx * 0.66, 1.06, 0), new THREE.Vector3(sx * 0.6, 0.82, 0), new THREE.Vector3(sx * 0.32, 0.74, 0)];
    root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.03, 12), gold(0.14)));
  }
}

// ---------- Private clubs: three members in gold
function figure(s) {
  const g = new THREE.Group();
  const body = lathe([[0, 0], [0.34, 0], [0.36, 0.08], [0.3, 0.36], [0.16, 0.48], [0, 0.5]], gold(0.16));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 48, 32), gold(0.14)); head.position.y = 0.66;
  g.add(body, head); g.scale.setScalar(s); return g;
}
function buildPeople(root) {
  const a = figure(1.12); a.position.set(0, 0.03, -0.12); root.add(a);
  const b = figure(0.92); b.position.set(-0.46, 0.03, 0.14); root.add(b);
  const c = figure(0.92); c.position.set(0.46, 0.03, 0.14); root.add(c);
}

const BUILD = { coins: buildCoins, calendar: buildCalendar, stamp: buildStamp, tag: buildTag, chart: buildChart, lantern: buildLantern, trophy: buildTrophy, people: buildPeople };

window.featIcon = (key, dpr = 2) => {
  renderer.setPixelRatio(dpr); renderer.setSize(S, S, false); renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(); scene.environment = env;
  lights(scene);
  const root = new THREE.Group(); scene.add(root);
  stand(root);
  const obj = new THREE.Group(); root.add(obj);
  BUILD[key](obj);
  obj.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(0, 1.42, 3.75); cam.lookAt(0, 0.5, 0);
  renderer.render(scene, cam);
  return renderer.domElement.toDataURL('image/png');
};
window.featReady = true;
