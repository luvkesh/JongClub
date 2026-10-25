// Tokens set on the wall once East's throw has broken it: a brass token on the
// first live stack (the front), a bronze one on the last stack of the main wall
// (the back), and an ivory token with a gold rim on the marked section (the
// flower wall in India Rules, the dead wall in Riichi). A few small meshes, no textures.

import * as THREE from 'three';

type Key = 'front' | 'back' | 'seg';

interface Token {
  group: THREE.Group;
  at: THREE.Vector3 | null;
  /** When it was set down (drops in from just above). */
  t0: number;
}

const R = 0.085;
const H = 0.018;
const DROP_S = 0.35;

export class WallMarkers {
  readonly group = new THREE.Group();
  private tokens: Record<Key, Token>;
  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];

  constructor(scene: THREE.Scene) {
    this.group.name = 'wall-markers';
    const disc = new THREE.CylinderGeometry(R, R * 1.04, H, 40);
    const rim = new THREE.TorusGeometry(R * 0.98, H * 0.42, 8, 40).rotateX(Math.PI / 2);
    // A pip engraved in the middle: a low dome in the rim's metal.
    const pip = new THREE.SphereGeometry(R * 0.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.35, 1);
    this.geos.push(disc, rim, pip);
    const metal = (color: number, rough: number) => new THREE.MeshStandardMaterial({ color, metalness: 0.92, roughness: rough });
    const brass = metal(0xcfa54a, 0.3);
    const bronze = metal(0x7a5230, 0.42);
    const gold = metal(0xe2bd5c, 0.25);
    const ivory = new THREE.MeshStandardMaterial({ color: 0xf4ecdc, metalness: 0, roughness: 0.38 });
    const jade = new THREE.MeshStandardMaterial({ color: 0x2f7d5b, metalness: 0.1, roughness: 0.3 });
    this.mats.push(brass, bronze, gold, ivory, jade);
    const make = (body: THREE.Material, edge: THREE.Material, centre: THREE.Material): Token => {
      const g = new THREE.Group();
      const d = new THREE.Mesh(disc, body);
      const r = new THREE.Mesh(rim, edge);
      r.position.y = H / 2;
      const p = new THREE.Mesh(pip, centre);
      p.position.y = H / 2;
      for (const m of [d, r, p]) m.castShadow = true;
      g.add(d, r, p);
      g.visible = false;
      this.group.add(g);
      return { group: g, at: null, t0: 0 };
    };
    this.tokens = { front: make(brass, gold, jade), back: make(bronze, brass, bronze), seg: make(ivory, gold, gold) };
    scene.add(this.group);
  }

  /** Where each token sits (null hides it); a token moving to a new place drops in again. */
  set(key: Key, at: THREE.Vector3 | null, now: number) {
    const t = this.tokens[key];
    if (!at) {
      t.at = null;
      t.group.visible = false;
      return;
    }
    if (!t.at || t.at.distanceToSquared(at) > 1e-4) t.t0 = now;
    t.at = at.clone().setY(at.y + H / 2);
    t.group.visible = true;
  }

  /** Per frame; true while a token is still dropping into place. */
  update(now: number): boolean {
    let busy = false;
    for (const t of Object.values(this.tokens)) {
      if (!t.at) continue;
      const k = Math.min(1, Math.max(0, (now - t.t0) / DROP_S));
      const e = 1 - (1 - k) * (1 - k);
      t.group.position.copy(t.at);
      t.group.position.y += (1 - e) * 0.32;
      t.group.rotation.y = (1 - e) * 1.4;
      if (k < 1) busy = true;
    }
    return busy;
  }

  dispose() {
    this.geos.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
    this.group.removeFromParent();
  }
}
