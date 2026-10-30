// Atelier and season portraits of a tile set, in real 3D: the table's own tile
// geometry and materials (body and back finishes, engraved faces with their
// relief and foil, clear coat) under studio light, rendered once into an image
// on the offscreen renderer the rack previews use. Registered with tileFaces,
// whose painted portrait stays as the fallback.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { currentTileSet, drawBackOnce, drawBodyOnce, drawFaceOnce, mix, setTilePicture3d, withTileSet } from './tileFaces';
import { BUMP, FINISH, apply, faceCoat, faceCoatRough, shadeBody } from './tileMaterials';
import { previewRenderer } from './rackPreview';

const TW = 0.3,
  TH = 0.4,
  TD = 0.22;
/** Red dragon, a five of dots and a nine of characters stand; one more lies face down to show the back. */
const KINDS = [31, 13, 8];

/**
 * The jeweller's window every Atelier portrait shares (tile sets, racks, tables): a polished dark
 * plinth that mirrors the pieces, a velvet backdrop falling into shadow, a near-white key with soft
 * shadows, a cool rim and a small hard spot that strikes a glint from every wire and stone.
 * `show(obj)` adds a piece and its reflection; `shoot(cam)` renders, restores the renderer and frees
 * what the studio made (the caller frees its own geometry and materials).
 */
export function jewelStudio(w: number, h: number, stage: string, opts: { scale?: number; exposure?: number; floor?: number; shine?: number; fog?: [number, number] } = {}) {
  const { renderer: r, env } = previewRenderer();
  const prev = { tm: r.toneMapping, exp: r.toneMappingExposure, pr: r.getPixelRatio(), size: r.getSize(new THREE.Vector2()) };
  const k = opts.scale ?? 1;
  // Supersampled, so the wires and bezels stay crisp when the picture is shown large (item view).
  r.setPixelRatio(2.5);
  r.setSize(w, h, false);
  r.toneMapping = THREE.NeutralToneMapping;
  r.toneMappingExposure = opts.exposure ?? 1.04;
  const scene = new THREE.Scene();
  const air = mix(stage, '#050606', 0.6);
  scene.background = new THREE.Color(air);
  scene.fog = new THREE.Fog(air, ...(opts.fog ?? [2.3 * k, 4.6 * k]));
  scene.environment = env;
  scene.environmentIntensity = 0.85;
  const floorMat = new THREE.MeshPhysicalMaterial({ color: mix(stage, '#000000', opts.floor ?? 0.45), roughness: 0.7, specularIntensity: opts.shine ?? 1, envMapIntensity: 0.15, transparent: true, opacity: 0.88 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14 * k, 14 * k), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.renderOrder = 1;
  scene.add(floor);
  const velvetMat = new THREE.MeshPhysicalMaterial({ color: mix(stage, '#000000', 0.2), roughness: 0.95, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(mix(stage, '#ffffff', 0.35)) });
  const velvet = new THREE.Mesh(new THREE.PlaneGeometry(14 * k, 6 * k), velvetMat);
  velvet.position.set(0, 3 * k, -1.6 * k);
  scene.add(velvet);
  /** The plinth mirrors whatever is shown (each piece is added to both). */
  const mirror = new THREE.Group();
  mirror.scale.y = -1;
  scene.add(mirror);
  const echoes: [THREE.Object3D, THREE.Object3D][] = [];
  const show = <T extends THREE.Object3D>(o: T) => {
    scene.add(o);
    const e = o.clone();
    e.traverse((c) => (c.castShadow = c.receiveShadow = false));
    mirror.add(e);
    echoes.push([o, e]);
    return o;
  };
  const key = new THREE.DirectionalLight('#fff7ee', 2.5);
  key.position.set(-1.4 * k, 2.6 * k, 1.8 * k);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 4;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.004;
  const sc = key.shadow.camera as THREE.OrthographicCamera;
  sc.left = sc.bottom = -1.2 * k;
  sc.right = sc.top = 1.2 * k;
  sc.near = 0.5;
  sc.far = 8 * k;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#ffffff', 0.8);
  fill.position.set(1.8, 0.9, 2.2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#d6e4ff', 1.1);
  rim.position.set(0.6, 1.4, -2.4);
  scene.add(rim);
  const spot = new THREE.PointLight('#fffaf0', 1.4, 5 * k, 2);
  spot.position.set(0.6 * k, 1.2 * k, 1.9 * k);
  scene.add(spot);
  // A pool of light on the velvet behind, so the pieces stand out against it.
  const pool = new THREE.SpotLight('#fff1dc', 3, 6 * k, 0.5, 0.9, 1.5);
  pool.position.set(0, 2.2 * k, 0.6 * k);
  pool.target.position.set(0, 0.6 * k, -1.6 * k);
  scene.add(pool, pool.target);
  const shoot = (cam: THREE.Camera) => {
    // Reflections follow wherever the pieces were moved after show().
    for (const [o, e] of echoes) {
      e.position.copy(o.position);
      e.rotation.copy(o.rotation);
      e.scale.copy(o.scale);
    }
    const shadowType = r.shadowMap.type;
    const shadows = r.shadowMap.enabled;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.render(scene, cam);
    const url = r.domElement.toDataURL('image/webp', 0.92);
    r.shadowMap.type = shadowType;
    r.shadowMap.enabled = shadows;
    r.toneMapping = prev.tm;
    r.toneMappingExposure = prev.exp;
    r.setPixelRatio(prev.pr);
    r.setSize(prev.size.x, prev.size.y, false);
    for (const g of [floor.geometry, velvet.geometry]) g.dispose();
    for (const m of [floorMat, velvetMat]) m.dispose();
    key.shadow.map?.dispose();
    pool.shadow.map?.dispose();
    return url;
  };
  return { scene, show, shoot, key };
}

/**
 * The current set's tiles as at the table: body and back finishes, engraved faces with their relief,
 * metal and clear coat. `tile(kind)` builds one standing tile (null: no face); `dispose()` frees them.
 */
export function jewelTiles() {
  const st = currentTileSet();
  const textures: THREE.Texture[] = [];
  const tex = (c: HTMLCanvasElement, color = true) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    textures.push(t);
    return t;
  };
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
  const faceMats = new Map<number, THREE.Material>();
  const faceMat = (k: number) => {
    let m = faceMats.get(k);
    if (m) return m;
    const { face: f, surface } = drawFaceOnce(k, 2, rough);
    const map = tex(f);
    const s = tex(surface, false);
    m = new THREE.MeshPhysicalMaterial({ map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: 0.1, metalnessMap: s, roughnessMap: s, bumpMap: s, bumpScale: BUMP, metalness: 1, roughness: 1, clearcoat: faceCoat(gf), clearcoatRoughness: faceCoatRough(gf), envMapIntensity: gf.env ?? 1 });
    faceMats.set(k, m);
    return m;
  };
  const tile = (kind: number | null) => {
    const g = new THREE.Group();
    const a = new THREE.Mesh(body, bodyMat);
    const b = new THREE.Mesh(back, backMat);
    a.castShadow = b.castShadow = a.receiveShadow = b.receiveShadow = true;
    g.add(a, b);
    if (kind !== null) g.add(new THREE.Mesh(face, faceMat(kind)));
    return g;
  };
  const dispose = () => {
    for (const g of [body, back, face]) g.dispose();
    for (const m of [bodyMat, backMat, ...faceMats.values()]) m.dispose();
    for (const t of textures) t.dispose();
  };
  return { tile, dispose, set: st };
}

function render(w: number, h: number): string {
  const st = currentTileSet();
  const stage = st.stage === 'suede' ? '#1d5240' : mix(st.back, '#0b0d0c', 0.6);
  const studio = jewelStudio(w, h, stage);
  const tiles = jewelTiles();
  // Three standing in a gentle arc, turned a little toward the camera.
  KINDS.forEach((k, i) => {
    const g = tiles.tile(k);
    g.position.set((i - 1) * 0.37 - 0.16, TH / 2, Math.abs(i - 1) * -0.05);
    g.rotation.y = (1 - i) * 0.16;
    studio.show(g);
  });
  // One face down in front, showing the back, the layers and the seam.
  const down = tiles.tile(null);
  down.rotation.set(Math.PI / 2, 0, -0.42);
  down.position.set(0.5, TD / 2, 0.16);
  studio.show(down);
  const cam = new THREE.PerspectiveCamera(28, w / h, 0.05, 30);
  cam.position.set(0.05, 0.62, 1.95);
  cam.lookAt(0.06, 0.17, 0);
  const url = studio.shoot(cam);
  tiles.dispose();
  return url;
}

setTilePicture3d((id, w, h) => withTileSet(id, () => render(w, h)));
