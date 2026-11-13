// Model fitting check: export a stand-in GLB, or render a CastFigure turning its head.
//   window.exportStandIn(name) -> base64 GLB of the procedural figure (to test the loader)
//   window.renderModel(name, yaw[]) -> PNG data URLs of the fitted model looking left/centre/right
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SeatFigure } from '../../src/render/avatar3d';
import { CastFigure, castModels } from '../../src/render/castModel';
import { CAST } from '../../src/cosmetics/cast';

(window as any).exportStandIn = async (name: string) => {
  const f = new SeatFigure({ ...CAST[name] });
  f.update(0, 1, null);
  const buf = (await new GLTFExporter().parseAsync(f.group, { binary: true })) as ArrayBuffer;
  let s = '';
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};

(window as any).renderModel = async (name: string, looks: number[], size = 512) => {
  const m = await castModels();
  const entry = m[name];
  if (!entry) throw new Error('no model for ' + name);
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setSize(size, size, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#14302a');
  const pm = new THREE.PMREMGenerator(r);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.4;
  const key = new THREE.DirectionalLight('#fff0dc', 2.4);
  key.position.set(-2.6, 3.4, 4.2);
  scene.add(key, new THREE.HemisphereLight('#f6ead6', '#20160f', 0.5));
  const rim = new THREE.DirectionalLight('#ffc98a', 2.5);
  rim.position.set(2.5, 2.5, -3);
  scene.add(rim);
  const fig = new CastFigure({ ...CAST[name] }, entry);
  scene.add(fig.group);
  for (let i = 0; i < 300 && !(fig as any).model; i++) await new Promise((res) => setTimeout(res, 100));
  const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
  cam.position.set(0, 1.75, 5.6);
  cam.lookAt(0, 1.45, 0);
  const out: string[] = [];
  for (const x of looks) {
    for (let t = 0; t < 60; t++) fig.update(t / 30, 1 / 30, new THREE.Vector3(x, 1.9, 5));
    r.render(scene, cam);
    out.push(r.domElement.toDataURL('image/png'));
  }
  return out;
};
(window as any).modelReady = true;
