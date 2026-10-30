// Atelier pictures of the tables: the real table in miniature (felt with its motif and gold
// thread, the rim in its finish with brass inlay and corner caps, and the apron) set
// for a game with your own tiles, in the jeweller's window the tile sets and racks use.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { tableStyle } from '../cosmetics/catalog';
import { currentTileSet, mix } from './tileFaces';
import { feltMotif, feltWeave } from './feltPattern';
import { finishRim, paintFelt } from './tableLook';
import { jewelStudio, jewelTiles } from './tilePicture';

const W = 480,
  H = 264;
const TW = 0.3,
  TH = 0.4,
  TD = 0.22;
const cache = new Map<string, string>();

/** A data URL picture of table `id` laid for a game. Cached per table and tile set. */
export function tablePreview(id: string, w = W, h = H): string {
  const key = `${id}:${currentTileSet().id}:${w}x${h}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let url = '';
  try {
    url = render(id, w, h);
  } catch {
    url = '';
  }
  if (url) cache.set(key, url);
  return url;
}

function render(id: string, w: number, h: number) {
  const t = tableStyle(id);
  const studio = jewelStudio(w, h, mix(t.felt, '#0b0d0c', 0.3), { floor: 0.7, shine: 0.25, fog: [2.2, 3.4] });
  const disposables: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const table = new THREE.Group();

  const rim = own(new THREE.MeshPhysicalMaterial({ color: '#3b2416' }));
  const trim = own(new THREE.MeshStandardMaterial({ color: '#c9a46a', metalness: 1, roughness: 0.2 }));
  finishRim(rim, trim, t);
  if (rim.map) own(rim.map);
  const brass = own(new THREE.MeshStandardMaterial({ color: '#d4b06a', metalness: 1, roughness: 0.18, envMapIntensity: 1.45 }));
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, ry = 0) => {
    const m = new THREE.Mesh(own(geo), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = m.receiveShadow = true;
    table.add(m);
    return m;
  };
  // The same proportions as the table in play (table3d.ts buildTable).
  add(new RoundedBoxGeometry(9.7, 0.36, 9.7, 4, 0.1), rim, 0, -0.2);
  const RIM_IN = 4.4,
    RIM_W = 0.45,
    RIM_H = 0.17,
    RIM_TOP = 0.1;
  for (let i = 0; i < 4; i++) {
    const long = i % 2 === 0;
    const a = (i * Math.PI) / 2;
    const off = RIM_IN + RIM_W / 2;
    add(new RoundedBoxGeometry(long ? (RIM_IN + RIM_W) * 2 : RIM_IN * 2 + 0.02, RIM_H, RIM_W, 3, 0.06), rim, Math.sin(a) * off, RIM_TOP - RIM_H / 2, Math.cos(a) * off, a);
    add(new THREE.BoxGeometry(off * 2, 0.012, 0.028), trim, Math.sin(a) * off, RIM_TOP + 0.002, Math.cos(a) * off, a);
    const bead = add(new THREE.CylinderGeometry(0.018, 0.018, RIM_IN * 2, 8), brass, Math.sin(a) * (RIM_IN - 0.005), 0.03, Math.cos(a) * (RIM_IN - 0.005));
    bead.rotation.set(0, a, Math.PI / 2);
    const ca = a + Math.PI / 4;
    const cd = Math.SQRT2 * (RIM_IN + RIM_W / 2);
    add(new THREE.BoxGeometry(RIM_W * 0.5, 0.02, RIM_W * 0.5), brass, Math.sin(ca) * cd, RIM_TOP + 0.005, Math.cos(ca) * cd, Math.PI / 4);
  }
  add(new RoundedBoxGeometry(9.2, 0.42, 9.2, 3, 0.06), rim, 0, -0.55);
  add(new THREE.BoxGeometry(9.24, 0.025, 9.24), trim, 0, -0.73);

  // The felt, painted exactly as at the table, with its velvet nap.
  const feltMap = own(new THREE.CanvasTexture(paintFelt(t.felt, feltMotif(t.id), 1024)));
  feltMap.colorSpace = THREE.SRGBColorSpace;
  feltMap.anisotropy = 8;
  const weave = feltWeave(8); // shared with the table: never disposed here
  const felt = own(new THREE.MeshPhysicalMaterial({ map: feltMap, roughness: 0.92, sheen: 0.6, sheenRoughness: 0.75, sheenColor: new THREE.Color(mix(t.felt, '#fff2dc', 0.35)), bumpMap: weave, bumpScale: 0.6, envMapIntensity: 0.4 }));
  add(new THREE.BoxGeometry(8.8, 0.04, 8.8), felt);

  // Laid for a game: four walls of face-down stacks and a few discards face up in the middle.
  const tiles = jewelTiles();
  const lie = (g: THREE.Group, up: boolean, x: number, y: number, z: number, ry: number) => {
    g.rotation.set(up ? -Math.PI / 2 : Math.PI / 2, 0, ry);
    g.position.set(x, y, z);
    table.add(g);
  };
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2;
    for (let i = 0; i < 9; i++) {
      const along = (i - 4) * (TW + 0.006);
      for (let layer = 0; layer < 2; layer++) {
        const x = Math.cos(a) * along + Math.sin(a) * 2.35,
          z = -Math.sin(a) * along + Math.cos(a) * 2.35;
        const g = tiles.tile(null);
        lie(g, false, x, 0.02 + TD / 2 + layer * TD, z, a);
      }
    }
  }
  [0, 13, 31, 22, 8, 27].forEach((k, i) => lie(tiles.tile(k), true, (i % 3 - 1) * (TW + 0.03) - 0.1, 0.02 + TD / 2, (Math.floor(i / 3) - 0.5) * (TH + 0.04) + 0.15, 0.08 * (i % 2 ? 1 : -1)));

  // In miniature, standing on the plinth.
  const s = 0.104;
  table.scale.setScalar(s);
  // Standing low on the plinth (the pedestal would sit unseen in the apron's shadow, so it is left out).
  table.position.y = 0.76 * s;
  table.rotation.y = 0.62;
  table.traverse((o) => (o.castShadow = o.receiveShadow = true));
  studio.show(table);
  const cam = new THREE.PerspectiveCamera(28, w / h, 0.05, 30);
  cam.position.set(0, 0.6, 1.78);
  cam.lookAt(0, 0.04, 0);
  const url = studio.shoot(cam);
  tiles.dispose();
  for (const d of disposables) d.dispose();
  return url;
}
