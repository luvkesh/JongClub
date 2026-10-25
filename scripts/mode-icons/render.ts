// Renders the Play screen's 3D mode icons to frames (run by scripts/mode-icons/build.mjs).
// Each icon is a small gold-and-jade model; frames sweep a gentle sway for the hover motion.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const SIZE = 192;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.append(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const key = new THREE.DirectionalLight('#fff1d6', 2.2);
key.position.set(2, 4, 3);
scene.add(key);
const rim = new THREE.DirectionalLight('#9fe0c0', 1.4);
rim.position.set(-3, 1.5, -2);
scene.add(rim);

const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
camera.position.set(0, 1.1, 6.2);
camera.lookAt(0, 0, 0);

const gold = new THREE.MeshPhysicalMaterial({ color: '#e0b864', metalness: 1, roughness: 0.26, clearcoat: 0.4 });
const goldDark = new THREE.MeshPhysicalMaterial({ color: '#b98a3e', metalness: 1, roughness: 0.34 });
const jade = new THREE.MeshPhysicalMaterial({ color: '#0e6a45', roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.6 });
const jadeDeep = new THREE.MeshPhysicalMaterial({ color: '#0f4a34', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.5 });
const ivory = new THREE.MeshPhysicalMaterial({ color: '#f4ecdc', roughness: 0.32, clearcoat: 0.8 });

const M = (g: THREE.BufferGeometry, m: THREE.Material) => new THREE.Mesh(g, m);

function lathe(points: [number, number][], seg = 64) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg);
}

function extrude(shape: THREE.Shape, depth: number, bevel = 0.06) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 24 });
  g.center();
  return g;
}

function faceTexture(draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 168;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#f6efe0';
  c.fillRect(0, 0, 128, 168);
  draw(c);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function tile(face: THREE.Texture) {
  const g = new THREE.Group();
  const body = M(new RoundedBoxGeometry(0.9, 1.2, 0.5, 4, 0.1), ivory);
  const back = M(new RoundedBoxGeometry(0.9, 1.2, 0.26, 4, 0.1), jade);
  back.position.z = -0.2;
  body.position.z = 0.06;
  const front = M(new THREE.PlaneGeometry(0.78, 1.06), new THREE.MeshPhysicalMaterial({ map: face, roughness: 0.35, clearcoat: 0.8 }));
  front.position.z = 0.312;
  g.add(back, body, front);
  return g;
}

const BUILD: Record<string, () => THREE.Object3D> = {
  // A gold lightning bolt over a jade tile.
  quick() {
    const g = new THREE.Group();
    const t = M(new RoundedBoxGeometry(1.3, 1.7, 0.4, 4, 0.12), jade);
    t.position.z = -0.2;
    t.rotation.z = -0.08;
    const s = new THREE.Shape();
    const p = [[0.18, 1.0], [-0.42, -0.05], [-0.02, -0.05], [-0.22, -1.0], [0.46, 0.18], [0.04, 0.18], [0.3, 1.0]];
    s.moveTo(p[0][0], p[0][1]);
    for (const q of p.slice(1)) s.lineTo(q[0], q[1]);
    s.closePath();
    const b = M(extrude(s, 0.18), gold);
    b.position.z = 0.25;
    b.scale.setScalar(1.05);
    g.add(t, b);
    return g;
  },
  // A celadon teacup on a saucer, gold rims.
  casual() {
    const g = new THREE.Group();
    const cup = M(lathe([[0, -0.5], [0.38, -0.5], [0.42, -0.46], [0.5, -0.3], [0.66, 0.05], [0.74, 0.38], [0.72, 0.42], [0.66, 0.38], [0.6, 0.06], [0.44, -0.28], [0, -0.32]]), jade);
    const rimR = M(new THREE.TorusGeometry(0.73, 0.035, 12, 64), gold);
    rimR.rotation.x = Math.PI / 2;
    rimR.position.y = 0.4;
    const handle = M(new THREE.TorusGeometry(0.22, 0.06, 12, 32, Math.PI * 1.3), gold);
    handle.position.set(0.72, 0.0, 0);
    handle.rotation.z = -Math.PI * 0.62;
    const saucer = M(lathe([[0, -0.62], [0.9, -0.6], [1.12, -0.48], [1.1, -0.45], [0.86, -0.54], [0, -0.55]]), ivory);
    const sRim = M(new THREE.TorusGeometry(1.11, 0.03, 10, 72), gold);
    sRim.rotation.x = Math.PI / 2;
    sRim.position.y = -0.47;
    const tea = M(new THREE.CircleGeometry(0.64, 48), new THREE.MeshStandardMaterial({ color: '#5a300a', roughness: 0.35, envMapIntensity: 0.25 }));
    tea.rotation.x = -Math.PI / 2;
    tea.position.y = 0.26;
    g.add(cup, rimR, handle, saucer, sRim, tea);
    g.rotation.x = 0.22;
    g.position.y = 0.05;
    g.scale.setScalar(1.12);
    return g;
  },
  // A gold crown set with jade.
  ranked() {
    const g = new THREE.Group();
    const band = M(new THREE.CylinderGeometry(0.85, 0.8, 0.42, 64, 1, true), gold);
    band.position.y = -0.45;
    // A velvet cap inside the band.
    const cap = M(new THREE.SphereGeometry(0.78, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#0f4a34', roughness: 0.9 }));
    cap.scale.y = 0.55;
    cap.position.y = -0.5;
    g.add(cap);
    const lip = M(new THREE.TorusGeometry(0.82, 0.06, 12, 64), goldDark);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = -0.66;
    const lip2 = lip.clone();
    lip2.position.y = -0.24;
    g.add(band, lip, lip2);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = M(new THREE.ConeGeometry(0.2, 0.72, 4), gold);
      spike.position.set(Math.sin(a) * 0.8, 0.1, Math.cos(a) * 0.8);
      spike.rotation.y = a;
      const gem = M(new THREE.SphereGeometry(0.1, 20, 14), jade);
      gem.position.set(Math.sin(a) * 0.8, 0.52, Math.cos(a) * 0.8);
      const stud = M(new THREE.SphereGeometry(0.1, 20, 14), jade);
      stud.scale.set(1, 1, 0.6);
      stud.position.set(Math.sin(a + Math.PI / 5) * 0.86, -0.45, Math.cos(a + Math.PI / 5) * 0.86);
      stud.lookAt(0, -0.45, 0);
      g.add(spike, gem, stud);
    }
    const front = M(new THREE.OctahedronGeometry(0.2, 0), jade);
    front.position.set(0, -0.45, 0.88);
    front.scale.set(1, 1.2, 0.5);
    g.add(front);
    g.rotation.x = 0.18;
    g.position.y = 0.12;
    g.scale.setScalar(1.1);
    return g;
  },
  // A gold trophy cup on a jade plinth.
  tournament() {
    const g = new THREE.Group();
    const cup = M(lathe([[0, 0.0], [0.18, 0.02], [0.42, 0.2], [0.58, 0.55], [0.66, 0.98], [0.62, 1.0], [0.54, 0.6], [0.38, 0.28], [0, 0.18]]), gold);
    (cup.material as THREE.Material).side = THREE.DoubleSide;
    const stem = M(lathe([[0, -0.5], [0.1, -0.5], [0.08, -0.2], [0.14, -0.08], [0.06, 0.02], [0, 0.02]]), gold);
    for (const sx of [-1, 1]) {
      const hd = M(new THREE.TorusGeometry(0.24, 0.05, 12, 32, Math.PI * 1.15), gold);
      hd.position.set(sx * 0.62, 0.58, 0);
      hd.rotation.z = sx > 0 ? -Math.PI * 0.55 : Math.PI * 1.55 - Math.PI * 0.6 + Math.PI;
      if (sx < 0) hd.rotation.set(0, Math.PI, -Math.PI * 0.55);
      g.add(hd);
    }
    const plinth = M(new RoundedBoxGeometry(0.9, 0.36, 0.7, 3, 0.06), jade);
    plinth.position.y = -0.68;
    const cap = M(new RoundedBoxGeometry(0.6, 0.08, 0.5, 2, 0.03), goldDark);
    cap.position.y = -0.47;
    const plate = M(new THREE.BoxGeometry(0.5, 0.14, 0.02), gold);
    plate.position.set(0, -0.68, 0.36);
    g.add(cup, stem, plinth, cap, plate);
    g.position.y = -0.1;
    g.scale.setScalar(1.15);
    return g;
  },
  // A gold key with a jade bow.
  private() {
    const g = new THREE.Group();
    const bow = M(new THREE.TorusGeometry(0.42, 0.11, 16, 48), gold);
    bow.position.x = -0.65;
    const inset = M(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 40), jade);
    inset.rotation.x = Math.PI / 2;
    inset.position.x = -0.65;
    const hole = M(new THREE.TorusGeometry(0.12, 0.04, 10, 24), gold);
    hole.position.set(-0.65, 0, 0.07);
    const shaft = M(new THREE.CylinderGeometry(0.075, 0.075, 1.35, 20), gold);
    shaft.rotation.z = Math.PI / 2;
    shaft.position.x = 0.4;
    const collar = M(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 20), goldDark);
    collar.rotation.z = Math.PI / 2;
    collar.position.x = -0.16;
    g.add(bow, inset, hole, shaft, collar);
    for (const [x, h] of [[0.8, 0.34], [0.98, 0.24], [0.62, 0.2]]) {
      const tooth = M(new RoundedBoxGeometry(0.12, h, 0.12, 2, 0.02), gold);
      tooth.position.set(x, -h / 2, 0);
      g.add(tooth);
    }
    g.rotation.z = 0.5;
    g.scale.setScalar(1.25);
    return g;
  },
  // A friendly jade robot head with gold eyes and antenna.
  ai() {
    const g = new THREE.Group();
    const head = M(new RoundedBoxGeometry(1.35, 1.05, 1.0, 5, 0.26), jade);
    const visor = M(new RoundedBoxGeometry(1.05, 0.46, 0.1, 4, 0.05), jadeDeep);
    visor.position.set(0, 0.05, 0.48);
    const glow = new THREE.MeshPhysicalMaterial({ color: '#ffe6a6', emissive: '#ffcc66', emissiveIntensity: 1.2, roughness: 0.2 });
    for (const x of [-0.25, 0.25]) {
      const eye = M(new THREE.SphereGeometry(0.1, 20, 14), glow);
      eye.scale.set(1, 1, 0.5);
      eye.position.set(x, 0.06, 0.55);
      const ear = M(new THREE.CylinderGeometry(0.17, 0.17, 0.14, 28), gold);
      ear.rotation.z = Math.PI / 2;
      ear.position.set(Math.sign(x) * 0.72, 0, 0);
      g.add(eye, ear);
    }
    const mouth = M(new RoundedBoxGeometry(0.4, 0.06, 0.04, 2, 0.02), gold);
    mouth.position.set(0, -0.3, 0.5);
    const stalk = M(new THREE.CylinderGeometry(0.04, 0.04, 0.36, 12), gold);
    stalk.position.y = 0.68;
    const bulb = M(new THREE.SphereGeometry(0.11, 20, 14), gold);
    bulb.position.y = 0.88;
    const neck = M(new THREE.CylinderGeometry(0.3, 0.38, 0.2, 28), goldDark);
    neck.position.y = -0.6;
    g.add(head, visor, mouth, stalk, bulb, neck);
    g.position.y = 0.0;
    g.scale.setScalar(1.05);
    return g;
  },
  // Three tiles fanned like a hand, with a gold sun behind.
  daily() {
    const g = new THREE.Group();
    const faces = [
      faceTexture((c) => {
        c.fillStyle = '#b8261c';
        c.font = 'bold 96px serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('中', 64, 88);
      }),
      faceTexture((c) => {
        for (const [x, y, col] of [[40, 50, '#1d6b4d'], [88, 50, '#b8261c'], [64, 84, '#1d4b8a'], [40, 118, '#b8261c'], [88, 118, '#1d6b4d']] as [number, number, string][]) {
          c.fillStyle = col;
          c.beginPath();
          c.arc(x, y, 16, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = '#f6efe0';
          c.beginPath();
          c.arc(x, y, 6, 0, Math.PI * 2);
          c.fill();
        }
      }),
      faceTexture((c) => {
        c.fillStyle = '#1d7a50';
        c.font = 'bold 92px serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('發', 64, 88);
      }),
    ];
    const sun = M(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 48), gold);
    sun.rotation.x = Math.PI / 2;
    sun.position.set(0.55, 0.42, -0.6);
    g.add(sun);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const ray = M(new THREE.ConeGeometry(0.08, 0.26, 4), gold);
      ray.position.set(0.55 + Math.cos(a) * 0.82, 0.42 + Math.sin(a) * 0.82, -0.6);
      ray.rotation.z = a - Math.PI / 2;
      g.add(ray);
    }
    faces.forEach((f, i) => {
      const t = tile(f);
      const k = i - 1;
      t.position.set(k * 0.62, -0.18 - Math.abs(k) * 0.08, Math.abs(k) * -0.12);
      t.rotation.z = -k * 0.2;
      t.rotation.y = -k * 0.12;
      g.add(t);
    });
    g.scale.setScalar(0.98);
    g.position.y = -0.08;
    return g;
  },
};

let current: THREE.Object3D | null = null;
(window as any).iconNames = Object.keys(BUILD);
(window as any).renderFrame = (name: string, i: number, n: number) => {
  if (!current || current.userData.name !== name) {
    if (current) scene.remove(current);
    const holder = new THREE.Group();
    holder.add(BUILD[name]());
    holder.userData.name = name;
    current = holder;
    scene.add(holder);
  }
  // One full sway: turn right, back through the middle, turn left, home. Plus a small bob.
  const ph = (i / n) * Math.PI * 2;
  current.rotation.y = Math.sin(ph) * 0.42 - 0.12;
  current.position.y = Math.sin(ph * 2) * 0.04;
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
};
(window as any).ready = true;
