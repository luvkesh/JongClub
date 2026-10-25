// Atelier and season portraits of a tile set, in real 3D: the table's own tile
// geometry and materials (body and back finishes, engraved faces with their
// relief and foil, clear coat) under studio light, rendered once into an image
// on the offscreen renderer the rack previews use. Registered with tileFaces,
// whose painted portrait stays as the fallback.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { currentTileSet, drawBackOnce, drawBodyOnce, drawFaceOnce, mix, setTilePicture3d, withTileSet } from './tileFaces';
import { FINISH, apply, shadeBody } from './tileMaterials';
import { previewRenderer } from './rackPreview';

const TW = 0.3,
  TH = 0.4,
  TD = 0.22;
/** Red dragon, a five of dots and a nine of characters stand; one more lies face down to show the back. */
const KINDS = [31, 13, 8];

function render(w: number, h: number): string {
  const { renderer: r, env } = previewRenderer();
  const st = currentTileSet();
  const prev = { tm: r.toneMapping, exp: r.toneMappingExposure, pr: r.getPixelRatio(), size: r.getSize(new THREE.Vector2()) };
  r.setPixelRatio(2);
  r.setSize(w, h, false);
  r.toneMapping = THREE.NeutralToneMapping;
  r.toneMappingExposure = 1.02;
  const scene = new THREE.Scene();
  const suede = st.stage === 'suede';
  const stage = suede ? '#1d5240' : mix(st.back, '#0b0d0c', 0.6);
  // The floor fades into the dark behind it, as on a photographer's sweep: no horizon line.
  const air = mix(stage, '#050606', 0.55);
  scene.background = new THREE.Color(air);
  scene.fog = new THREE.Fog(air, 2.2, 4.2);
  scene.environment = env;
  scene.environmentIntensity = 0.75;
  const textures: THREE.Texture[] = [];
  const tex = (c: HTMLCanvasElement, color = true) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    textures.push(t);
    return t;
  };
  // The stage: the set's own colour (or the luxury case's suede), soft enough to show contact shadows.
  const floorMat = new THREE.MeshStandardMaterial({ color: stage, roughness: 0.9 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const body = new RoundedBoxGeometry(TW, TH, TD * 0.64, 4, 0.035);
  body.translate(0, 0, TD * 0.18);
  const back = new RoundedBoxGeometry(TW, TH, TD * 0.4, 4, 0.035);
  back.translate(0, 0, -TD * 0.3);
  const face = new THREE.PlaneGeometry(TW * 0.84, TH * 0.86);
  face.translate(0, 0, TD / 2 + 0.0015);
  const bodyMat = new THREE.MeshPhysicalMaterial();
  apply(bodyMat, FINISH[st.bodyFinish], st.stripes ? null : tex(drawBodyOnce()), false);
  shadeBody(bodyMat, st.stripes, st.trim);
  const backMat = new THREE.MeshPhysicalMaterial();
  apply(backMat, FINISH[st.backFinish], tex(drawBackOnce()), false);
  if (st.backFinish === 'glass') backMat.opacity = 0.55;
  const gf = FINISH[st.ground];
  const rough = Math.max(0.08, Math.min(0.5, gf.roughness + 0.04));
  const faceMats = KINDS.map((k) => {
    const { face: f, surface } = drawFaceOnce(k, 2, rough);
    const map = tex(f);
    const s = tex(surface, false);
    return new THREE.MeshPhysicalMaterial({ map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: 0.1, metalnessMap: s, roughnessMap: s, bumpMap: s, bumpScale: 1.4, metalness: 1, roughness: 1, clearcoat: Math.max(0.35, gf.clearcoat ?? 0), clearcoatRoughness: Math.max(0.06, gf.clearcoatRoughness ?? 0.15), envMapIntensity: gf.env ?? 1 });
  });
  const tile = (fm: THREE.Material | null) => {
    const g = new THREE.Group();
    const a = new THREE.Mesh(body, bodyMat);
    const b = new THREE.Mesh(back, backMat);
    a.castShadow = b.castShadow = a.receiveShadow = b.receiveShadow = true;
    g.add(a, b);
    if (fm) g.add(new THREE.Mesh(face, fm));
    scene.add(g);
    return g;
  };
  // Three standing in a gentle arc, turned a little toward the camera.
  faceMats.forEach((fm, i) => {
    const g = tile(fm);
    const x = (i - 1) * 0.37 - 0.16;
    g.position.set(x, TH / 2, Math.abs(i - 1) * -0.05);
    g.rotation.y = (1 - i) * 0.16;
  });
  // One face down in front, showing the back, the layers and the seam.
  const down = tile(null);
  down.rotation.set(Math.PI / 2, 0, -0.42);
  down.position.set(0.5, TD / 2, 0.16);

  // Studio light: a near-white key with soft shadows, a fill and a cool rim to draw the edges.
  const key = new THREE.DirectionalLight('#fff7ee', 2.5);
  key.position.set(-1.4, 2.6, 1.8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 4;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.004;
  const sc = key.shadow.camera as THREE.OrthographicCamera;
  sc.left = sc.bottom = -1.2;
  sc.right = sc.top = 1.2;
  sc.near = 0.5;
  sc.far = 8;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#ffffff', 0.8);
  fill.position.set(1.8, 0.9, 2.2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#d6e4ff', 1.1);
  rim.position.set(0.6, 1.4, -2.4);
  scene.add(rim);
  const cam = new THREE.PerspectiveCamera(28, w / h, 0.05, 30);
  cam.position.set(0.05, 0.62, 1.95);
  cam.lookAt(0.06, 0.17, 0);
  const shadowType = r.shadowMap.type;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/webp', 0.92);
  r.shadowMap.type = shadowType;
  r.toneMapping = prev.tm;
  r.toneMappingExposure = prev.exp;
  r.setPixelRatio(prev.pr);
  r.setSize(prev.size.x, prev.size.y, false);
  for (const g of [body, back, face, floor.geometry]) g.dispose();
  for (const m of [bodyMat, backMat, floorMat, ...faceMats]) m.dispose();
  for (const t of textures) t.dispose();
  key.shadow.map?.dispose();
  return url;
}

setTilePicture3d((id, w, h) => withTileSet(id, () => render(w, h)));
