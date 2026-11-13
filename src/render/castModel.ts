// Sculpted 3D models of the regulars (Mei, Rex, Hiro, Lucky, Amara), made with
// an image-to-3D generator from their reference card art and published next
// to the page as public/models/cast/<name>.glb. public/models/cast/manifest.json
// lists the ones that exist and how each one sits:
//
//   { "Mei": { "file": "mei.glb", "neck": 0.58, "height": 1.55, "turn": 0 } }
//
//   neck    where the neck is, as a share of the model's height from its lowest
//           point; everything above it turns and nods as the head
//   height  the model's height in figure units once seated (a bust is about 1.5)
//   base    figure-space height of the model's lowest point (default 0.55)
//   turn    radians to turn the model so it faces forward (generators differ)
//
// A seat whose regular has a model shows it once it has loaded, with the
// procedural SeatFigure standing in until then (and wherever loading fails).
// Generated models are one textured mesh with no skeleton, so the head turns
// through a soft "neck" band in the vertex shader rather than a bone, and the
// figure breathes by a gentle scale; eyes are painted into the texture, so the
// models do not blink.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { AvatarSpec } from '../cosmetics/catalog';
import { castNameFor } from '../cosmetics/cast';
import { SeatFigure } from './avatar3d';

export interface CastModelEntry {
  file: string;
  neck: number;
  height: number;
  base?: number;
  turn?: number;
}

const BASE = 'models/cast/';
let manifestP: Promise<Record<string, CastModelEntry>> | null = null;

/** The models that exist (an empty list where there are none or the manifest cannot be read). */
export function castModels(): Promise<Record<string, CastModelEntry>> {
  manifestP ??= fetch(BASE + 'manifest.json')
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return manifestP;
}

const sceneP = new Map<string, Promise<THREE.Group>>();

function loadModel(e: CastModelEntry): Promise<THREE.Group> {
  let p = sceneP.get(e.file);
  if (!p) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    p = loader.loadAsync(BASE + e.file).then((g) => g.scene);
    sceneP.set(e.file, p);
  }
  return p;
}

/** Uniforms shared by one figure's materials: the head's turn, its pivot, and the soft neck band. */
interface NeckUniforms {
  uHead: { value: THREE.Matrix4 };
  uPivot: { value: THREE.Vector3 };
  uNeck: { value: THREE.Vector2 };
}

/** Bend everything above the neck band by uHead about uPivot, blending in across the band. */
function bendable(mat: THREE.Material, u: NeckUniforms) {
  const m = mat.clone();
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uHead;\nuniform vec3 uPivot;\nuniform vec2 uNeck;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float neckW = smoothstep(uNeck.x, uNeck.y, transformed.y);
        vec3 bent = (uHead * vec4(transformed - uPivot, 1.0)).xyz + uPivot;
        transformed = mix(transformed, bent, neckW);`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        float neckN = smoothstep(uNeck.x, uNeck.y, position.y);
        objectNormal = normalize(mix(objectNormal, mat3(uHead) * objectNormal, neckN));`,
      );
  };
  m.customProgramCacheKey = () => 'castNeck';
  return m;
}

/**
 * A regular at the table: their sculpted model once loaded, the procedural
 * figure until then. Same interface as SeatFigure (group, update, nod, dispose).
 */
export class CastFigure {
  readonly group = new THREE.Group();
  private stand: SeatFigure;
  private model: THREE.Group | null = null;
  private mats: THREE.Material[] = [];
  private u: NeckUniforms = { uHead: { value: new THREE.Matrix4() }, uPivot: { value: new THREE.Vector3() }, uNeck: { value: new THREE.Vector2(1, 1.1) } };
  private body = new THREE.Group();
  private yaw = 0;
  private pitch = -0.12;
  private phase = Math.random() * Math.PI * 2;
  private nodT = -1;
  private gone = false;
  private headAt = new THREE.Vector3();
  private static tmp = new THREE.Vector3();
  private static q = new THREE.Quaternion();
  private static e = new THREE.Euler();

  constructor(readonly spec: AvatarSpec, entry: CastModelEntry) {
    this.stand = new SeatFigure(spec);
    this.group.add(this.stand.group);
    this.group.add(this.body);
    loadModel(entry).then(
      (src) => !this.gone && this.fit(src, entry),
      () => {},
    );
  }

  private fit(src: THREE.Group, e: CastModelEntry) {
    const model = src.clone(true);
    // Measure in the model's own frame, turned to face forward.
    model.rotation.y = e.turn ?? 0;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const s = e.height / Math.max(1e-6, size.y);
    const holder = new THREE.Group();
    holder.add(model);
    holder.scale.setScalar(s);
    const cx = (box.min.x + box.max.x) / 2,
      cz = (box.min.z + box.max.z) / 2;
    model.position.set(-cx, -box.min.y, -cz);
    holder.position.y = e.base ?? 0.55;
    // The neck band and pivot, in the model's own (unscaled, recentred) units.
    const neckY = size.y * e.neck;
    this.u.uNeck.value.set(neckY - size.y * 0.04, neckY + size.y * 0.04);
    this.u.uPivot.value.set(0, neckY, 0);
    this.headAt.set(0, (e.base ?? 0.55) + (neckY + size.y * 0.15) * s, 0);
    // Materials bend at the neck; the generator's texture keeps its colours, lit by the room.
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      // The bend moves vertices in the mesh's own space: bake its transform so "up" is the model's up.
      mesh.geometry = mesh.geometry.clone();
      mesh.updateMatrixWorld(true);
      mesh.geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(model.position.x, model.position.y, model.position.z).multiply(new THREE.Matrix4().makeRotationY(model.rotation.y)).multiply(mesh.matrix));
      mesh.position.set(0, 0, 0);
      mesh.rotation.set(0, 0, 0);
      mesh.scale.set(1, 1, 1);
      mesh.userData.ownGeometry = true;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const bent = list.map((mm) => {
        const std = mm as THREE.MeshStandardMaterial;
        if (std.isMeshStandardMaterial) {
          std.roughness = Math.max(std.roughness, 0.55);
          std.metalness = Math.min(std.metalness, 0.1);
          if (std.map) std.map.anisotropy = 8;
        }
        const b = bendable(mm, this.u);
        this.mats.push(b);
        return b;
      });
      mesh.material = Array.isArray(mesh.material) ? bent : bent[0];
    });
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    this.body.add(holder);
    this.model = holder;
    this.stand.dispose();
  }

  /** Breathe and look (a world point, or null to look down at one's own tiles). */
  update(t: number, dt: number, look: THREE.Vector3 | null) {
    if (!this.model) return this.stand.update(t, dt, look);
    const breathe = Math.sin(t * 1.6 + this.phase);
    this.body.scale.set(1 + breathe * 0.006, 1 + breathe * 0.004, 1 + breathe * 0.008);
    let yaw = Math.sin(t * 0.23 + this.phase) * 0.06,
      pitch = -0.16;
    if (look) {
      const p = this.group.worldToLocal(CastFigure.tmp.copy(look)).sub(this.headAt);
      yaw = THREE.MathUtils.clamp(Math.atan2(p.x, p.z), -0.6, 0.6);
      pitch = THREE.MathUtils.clamp(Math.atan2(p.y, Math.hypot(p.x, p.z)), -0.3, 0.1);
    }
    const k = 1 - Math.exp(-dt * 3);
    this.yaw += (yaw - this.yaw) * k;
    this.pitch += (pitch - this.pitch) * k;
    let nod = 0;
    if (this.nodT >= 0) {
      this.nodT += dt;
      nod = Math.max(0, Math.sin((this.nodT / 0.9) * Math.PI * 2)) * 0.22;
      if (this.nodT > 0.9) this.nodT = -1;
    }
    CastFigure.q.setFromEuler(CastFigure.e.set(-this.pitch + nod, this.yaw, Math.sin(t * 0.31 + this.phase) * 0.02, 'YXZ'));
    this.u.uHead.value.makeRotationFromQuaternion(CastFigure.q);
  }

  nod() {
    if (!this.model) return this.stand.nod();
    this.nodT = 0;
  }

  dispose() {
    this.gone = true;
    this.group.removeFromParent();
    this.stand.dispose();
    for (const m of this.mats) m.dispose();
    this.group.traverse((o) => o.userData.ownGeometry && (o as THREE.Mesh).geometry.dispose());
  }
}

/** The figure for a seat: a regular's sculpted model where one exists, else the procedural figure. */
export function seatFigure(spec: AvatarSpec, models: Record<string, CastModelEntry>): SeatFigure | CastFigure {
  const name = castNameFor(spec);
  const entry = name ? models[name] : undefined;
  return entry ? new CastFigure(spec, entry) : new SeatFigure(spec);
}
