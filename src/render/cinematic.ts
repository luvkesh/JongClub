// The signature moment: a brief cinematic for a limit hand, a yakuman or the
// maximum tai. The camera glides low along the winning hand and rises away,
// a band of gold light sweeps across the tiles, a shaft of warm light falls
// on them and fine gold motes drift up. Quiet and short: no coins, no
// flashing, no fanfare. Skippable at any moment; with reduced motion (or the
// Minimal animation speed) it is a still, short glow with no camera move and
// no particles.

import * as THREE from 'three';
import type { HandScore } from '../engine/rules/types';
import { Particles, sparkle } from './fx';

/** Is this win worth the signature moment? Limit hands, yakuman (not mangan and friends) and maximum tai. */
export function isSignatureWin(s: Pick<HandScore, 'limit' | 'tier'> | null | undefined): boolean {
  if (!s) return false;
  if (s.tier) return /yakuman/i.test(s.tier);
  return !!s.limit;
}

/** The name the moment carries: the tier (Yakuman, Double Yakuman) or the limit's own word. */
export function signatureName(s: Pick<HandScore, 'tier' | 'unit'>): string {
  if (s.tier) return s.tier;
  return s.unit === 'tai' ? 'Maximum tai' : 'Limit hand';
}

/** How long the moment lasts, in seconds. */
export function signatureDuration(calm: boolean, speed: 'minimal' | 'classic' | 'cinematic'): number {
  if (calm) return 1.6;
  return speed === 'cinematic' ? 5.2 : 4.2;
}

export interface SignatureTile {
  group: THREE.Object3D;
  bodyMat: THREE.MeshStandardMaterial;
  faceMat: THREE.MeshStandardMaterial;
}

export interface SignatureOptions {
  /** Middle of the winning hand, world space. */
  centre: THREE.Vector3;
  /** Unit vector along the hand (left to right as the winner sees it). */
  along: THREE.Vector3;
  /** Unit vector from the table's centre out toward the winner. */
  out: THREE.Vector3;
  /** Half the hand's length. */
  span: number;
  tiles: SignatureTile[];
  now: number;
  dur: number;
  calm: boolean;
  /** Portrait phone: keep the camera further back. */
  compact: boolean;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const shaftTex = new Map<boolean, THREE.Texture>();
/** Soft vertical gradient: bright at the foot, gone at the top; `sides` also softens the edges. */
function shaftTexture(sides = true) {
  const hit = shaftTex.get(sides);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d')!;
  const v = g.createLinearGradient(0, 0, 0, 128);
  v.addColorStop(0, 'rgba(255,255,255,0)');
  v.addColorStop(0.7, 'rgba(255,255,255,0.55)');
  v.addColorStop(1, 'rgba(255,255,255,0.9)');
  g.fillStyle = v;
  g.fillRect(0, 0, 64, 128);
  if (sides) {
    g.globalCompositeOperation = 'destination-in';
    const h = g.createLinearGradient(0, 0, 64, 0);
    h.addColorStop(0, 'rgba(0,0,0,0)');
    h.addColorStop(0.5, 'rgba(0,0,0,1)');
    h.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = h;
    g.fillRect(0, 0, 64, 128);
  }
  const t = new THREE.CanvasTexture(c);
  shaftTex.set(sides, t);
  return t;
}

export class SignatureShot {
  private t0: number;
  private dur: number;
  private ending: { t: number; w: number } | null = null;
  private group = new THREE.Group();
  private sheen: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private shaft: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private motes: Particles | null = null;
  private seeds: Float32Array;
  private base: { body: number; bodyColor: THREE.Color; face: number; faceColor: THREE.Color }[];
  private u: number[];
  private path: { pos: THREE.CatmullRomCurve3; look: THREE.CatmullRomCurve3 } | null = null;
  done = false;

  constructor(
    private scene: THREE.Scene,
    private o: SignatureOptions,
  ) {
    this.t0 = o.now;
    this.dur = o.dur;
    const { centre, along, out, span } = o;
    // Where each tile sits along the hand, 0..1, for the sweep.
    this.u = o.tiles.map((t) => Math.min(1, Math.max(0, (t.group.position.clone().sub(centre).dot(along) + span) / (2 * span))));
    this.base = o.tiles.map((t) => ({ body: t.bodyMat.emissiveIntensity, bodyColor: t.bodyMat.emissive.clone(), face: t.faceMat.emissiveIntensity, faceColor: t.faceMat.emissive.clone() }));

    // The band of light: a tall soft sheen standing over the hand, facing out.
    this.sheen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 1.4),
      new THREE.MeshBasicMaterial({ map: shaftTexture(), color: '#ffd27a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    this.sheen.lookAt(out);
    this.sheen.renderOrder = 6;
    // A shaft of warm light falling on the hand from above.
    // A soft-edged plane facing the winner: no hard silhouette when the camera passes close.
    const sg = new THREE.PlaneGeometry(span * 2 + 1.2, 6);
    this.shaft = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: shaftTexture(true), color: '#ffcf7a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.shaft.position.copy(centre).setY(centre.y + 2.6);
    this.shaft.lookAt(this.shaft.position.clone().add(out));
    this.shaft.renderOrder = 5;
    this.group.add(this.sheen, this.shaft);
    scene.add(this.group);

    this.seeds = new Float32Array(0);
    if (!o.calm) {
      // Fine gold motes: spiralling slowly up around the hand.
      const n = 150;
      const p = new Particles(n, sparkle(), true);
      this.seeds = new Float32Array(n * 5);
      for (let i = 0; i < n; i++) {
        this.seeds.set([Math.random(), Math.random() * Math.PI * 2, 0.25 + Math.random() * 0.7, 0.15 + Math.random() * 0.55, Math.random() * 6.28], i * 5);
        p.size[i] = 0.035 + Math.random() * 0.06;
        const warm = 0.8 + Math.random() * 0.2;
        p.color.set([1, 0.84 * warm + 0.1, 0.5 * warm], i * 3);
      }
      this.motes = p;
      scene.add(p.points);
      // The camera's path in the hand's own frame: low along one end, round the front, rising away.
      const m = o.compact ? 1.6 : 1;
      const at = (a: number, up: number, ou: number) => centre.clone().addScaledVector(along, a * m).addScaledVector(out, ou * m).add(new THREE.Vector3(0, up * m, 0));
      this.path = {
        pos: new THREE.CatmullRomCurve3([at(-span - 1.6, 0.75, 2.0), at(-span * 0.4, 1.1, 2.7), at(span * 0.5, 1.6, 3.0), at(span + 1.4, 2.6, 3.4)]),
        look: new THREE.CatmullRomCurve3([centre.clone().addScaledVector(along, -span * 0.6), centre.clone().addScaledVector(along, -span * 0.1), centre.clone().addScaledVector(along, span * 0.2), centre.clone()]),
      };
    }
  }

  /** Cut it short: everything fades in a third of a second and the camera returns. */
  finish(now: number) {
    if (this.ending || this.done) return;
    const t = (now - this.t0) / this.dur;
    this.ending = { t: now, w: this.weight(t) };
  }

  /** Camera weight of the path at progress t. */
  private weight(t: number) {
    return smooth(0, 0.16, t) * (1 - smooth(0.8, 1, t));
  }

  /**
   * Per frame. Bends the camera's base pose and look toward the path, lights
   * the tiles and moves the light and motes. Returns false once finished.
   */
  update(now: number, camBase: THREE.Vector3, camLook: THREE.Vector3, pointScale: number): boolean {
    if (this.done) return false;
    const { o } = this;
    const t = (now - this.t0) / this.dur;
    const endK = this.ending ? Math.max(0, 1 - (now - this.ending.t) / 0.35) : 1;
    if (t >= 1 || endK <= 0) {
      this.dispose();
      return false;
    }
    // Overall level of the light: rises, holds, falls.
    const level = smooth(0, 0.12, t) * (1 - smooth(0.78, 1, t)) * endK;

    // Camera.
    if (this.path) {
      const w = (this.ending ? this.ending.w * endK : this.weight(t)) * (o.compact ? 0.8 : 1);
      const k = smooth(0, 1, Math.min(1, t * 1.05));
      if (w > 0) {
        camBase.lerp(this.path.pos.getPointAt(k), w);
        camLook.lerp(this.path.look.getPointAt(k), w);
      }
    }

    // The sweep across the tiles: one pass early, a softer one back again; calm is a still glow.
    const s1 = o.calm ? -1 : smooth(0.12, 0.55, t) * 1.3 - 0.15;
    const s2 = o.calm ? -1 : 1.15 - smooth(0.58, 0.9, t) * 1.3;
    const gold = new THREE.Color('#ffc864');
    const faceGold = new THREE.Color('#ffe7b8');
    o.tiles.forEach((tile, i) => {
      const u = this.u[i];
      const b = this.base[i];
      const hit = o.calm ? Math.sin(Math.PI * Math.min(1, t)) * 0.55 : Math.exp(-(((u - s1) / 0.13) ** 2)) * 1.1 + Math.exp(-(((u - s2) / 0.16) ** 2)) * 0.5 + 0.12 * smooth(0.5, 0.7, t);
      const k = hit * endK;
      tile.bodyMat.emissive.copy(b.bodyColor).lerp(gold, Math.min(1, k * 1.5));
      tile.bodyMat.emissiveIntensity = b.body + k * 0.9;
      tile.faceMat.emissive.copy(b.faceColor).lerp(faceGold, Math.min(1, k));
      tile.faceMat.emissiveIntensity = b.face + k * 0.45;
    });

    // The sheen rides the first pass; the shaft holds over the hand.
    const sx = Math.min(1.1, Math.max(-0.1, s1));
    this.sheen.position.copy(o.centre).addScaledVector(o.along, (sx * 2 - 1) * o.span).add(new THREE.Vector3(0, 0.45, 0)).addScaledVector(o.out, 0.25);
    this.sheen.material.opacity = o.calm ? 0 : 0.5 * smooth(0.1, 0.2, t) * (1 - smooth(0.5, 0.6, t)) * endK;
    this.shaft.material.opacity = 0.12 * level;

    // Motes.
    const p = this.motes;
    if (p) {
      const born = 0.18;
      for (let i = 0; i < p.n; i++) {
        const [uu, a0, rr, vy, ph] = this.seeds.subarray(i * 5, i * 5 + 5);
        const age = (t - born * uu) * this.dur;
        if (age < 0) {
          p.alpha[i] = 0;
          continue;
        }
        const a = a0 + age * 0.45;
        const x = (uu * 2 - 1) * o.span;
        const pos = o.centre
          .clone()
          .addScaledVector(o.along, x + Math.cos(a) * rr * 0.4)
          .addScaledVector(o.out, Math.sin(a) * rr * 0.5);
        p.pos[i * 3] = pos.x;
        p.pos[i * 3 + 1] = o.centre.y - 0.2 + age * vy;
        p.pos[i * 3 + 2] = pos.z;
        p.alpha[i] = Math.min(1, age / 0.4) * level * (0.55 + 0.45 * Math.sin(age * 5 + ph));
        p.rot[i] = age * 0.5 + ph;
      }
      p.flush(pointScale);
    }
    return true;
  }

  dispose() {
    if (this.done) return;
    this.done = true;
    this.o.tiles.forEach((tile, i) => {
      const b = this.base[i];
      tile.bodyMat.emissive.copy(b.bodyColor);
      tile.bodyMat.emissiveIntensity = b.body;
      tile.faceMat.emissive.copy(b.faceColor);
      tile.faceMat.emissiveIntensity = b.face;
    });
    this.group.removeFromParent();
    this.sheen.geometry.dispose();
    this.sheen.material.dispose();
    this.shaft.geometry.dispose();
    this.shaft.material.dispose();
    this.motes?.dispose();
    void this.scene;
  }
}
