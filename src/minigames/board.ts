// The shared 3D tile board for mini-games: your equipped tiles on your own
// table. Bodies and backs are two instanced meshes for the whole board, faces
// one instanced mesh per tile kind (they share that kind's face texture), so
// a 144-tile Solitaire board costs a few dozen draw calls. Tiles move by
// tweening their instance matrices; picking uses plain boxes.
//
// Positions are board units on the felt (y up, the player at +z). A flat tile
// lies face up with its top edge pointing away from you.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { TD, TH, TW } from '../render/table3d';
import { drawFace, hasFace } from '../render/tileFaces';
import { applyTileFinish, dressFace } from '../render/tileMaterials';

export type TileLook = 'normal' | 'free' | 'hover' | 'selected' | 'hint' | 'dim' | 'blocked' | 'locked';

export interface BoardTileSpec {
  id: number;
  kind: number;
  pos: THREE.Vector3;
  /** Orientation; flat face-up when left out. */
  quat?: THREE.Quaternion;
  faceDown?: boolean;
}

export interface Pose {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  scale: number;
}

interface Tween {
  from: Pose;
  to: Pose;
  t0: number;
  dur: number;
  arc: number;
  done?: () => void;
}

interface BTile {
  id: number;
  kind: number;
  /** Index in the body and back meshes. */
  i: number;
  /** Index in its kind's face mesh. */
  j: number;
  pose: Pose;
  tween?: Tween;
  queue: Tween[];
  look: TileLook;
  lift: number;
  liftT: number;
  alive: boolean;
}

/** Face up, top edge away from the player. */
export const FLAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
/** Face down (the back up), same heading. */
export const FLAT_DOWN = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, Math.PI));
/** Standing up and facing the player. */
export const UPRIGHT = new THREE.Quaternion();

const LOOK_BODY: Record<TileLook, string> = {
  normal: '#ffffff',
  // Free tiles: a warm ivory body under a gold rim (see RIM_LOOKS).
  free: '#fff3d6',
  hover: '#fff4dc',
  selected: '#ffd27a',
  hint: '#b9f0cf',
  // Held tiles are only a shade cooler, so every face stays white and legible.
  dim: '#dcd7cd',
  // Blocked tiles: a cool shade on the body and edges only; the face stays white.
  blocked: '#aab6c4',
  locked: '#8a8a8a',
};
const LOOK_FACE: Record<TileLook, string> = {
  normal: '#ffffff',
  free: '#ffffff',
  hover: '#fffaf0',
  selected: '#ffe7b0',
  hint: '#d9ffe8',
  dim: '#ebe7df',
  blocked: '#ffffff',
  locked: '#6f6f6f',
};
const LOOK_LIFT: Partial<Record<TileLook, number>> = { free: 0.014, hover: 0.03, selected: 0.07, hint: 0.04 };
/** Looks that show the gold halo: tiles you can take. */
const RIM_LOOKS = new Set<TileLook>(['free', 'selected', 'hint']);
/** Cubes have no rim: a free block warms its whole body instead. */
const CUBE_FREE_BODY = '#ffe2a2';


/**
 * Mip level bias for face textures. Boards show each face at 2 to 5 texels per screen pixel
 * (measured with texelDensity), so plain trilinear filtering reads a small, soft mip level and
 * the ink looks washed out. Sampling one level finer keeps every line crisp; anisotropic
 * filtering keeps tilted faces clean.
 */
const FACE_LOD_BIAS = -1;

/** Samples the face (and its emissive and foil maps) a mip level finer than standard. */
function crispSampling(m: THREE.MeshStandardMaterial) {
  const b = FACE_LOD_BIAS.toFixed(2);
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )', `texture2D( map, vMapUv, ${b} )`))
      .replace('#include <emissivemap_fragment>', THREE.ShaderChunk.emissivemap_fragment.replace('texture2D( emissiveMap, vEmissiveMapUv )', `texture2D( emissiveMap, vEmissiveMapUv, ${b} )`))
      .replace('#include <metalnessmap_fragment>', THREE.ShaderChunk.metalnessmap_fragment.replace('texture2D( metalnessMap, vMetalnessMapUv )', `texture2D( metalnessMap, vMetalnessMapUv, ${b} )`))
      .replace('#include <roughnessmap_fragment>', THREE.ShaderChunk.roughnessmap_fragment.replace('texture2D( roughnessMap, vRoughnessMapUv )', `texture2D( roughnessMap, vRoughnessMapUv, ${b} )`));
  };
  m.customProgramCacheKey = () => `crisp${b}`;
}

/** Boards with this many tile kinds or fewer get fewDetail faces. */
const FEW_KINDS = 18;

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const m4 = new THREE.Matrix4();
const v3 = new THREE.Vector3();
const q4 = new THREE.Quaternion();
const s3 = new THREE.Vector3();
const col = new THREE.Color();

export interface BoardOptions {
  /** Tile size relative to the main table's tiles. */
  scale?: number;
  /** 'cube' draws Mahjong Dimensions blocks: the symbol on all six sides. */
  shape?: 'tile' | 'cube';
  labels?: boolean;
  lowTier?: boolean;
  /** Full face texture detail (pixels per face unit): the tier's faceScale, as at the table. */
  detail?: number;
  /** Detail for boards with few kinds (Memory, Match-3): big tiles up close, and few faces to hold. */
  fewDetail?: number;
  /** Faces are drawn at this detail first (fast), then sharpened to `detail` while the board is still. */
  previewDetail?: number;
  anisotropy?: number;
  /** Uploads sharpened faces in idle time, so no frame stalls on them. */
  renderer?: THREE.WebGLRenderer | null;
  /** Called when a sharper face is in place (the stage draws a frame). */
  onSharpen?: () => void;
  /**
   * The table's own face texture for a kind. When given, the board shows those
   * (the table draws and sharpens them) instead of holding a second full-detail
   * copy of every face, which on some devices runs the graphics memory out.
   */
  faceSource?: ((kind: number) => THREE.Texture | null) | null;
  /** Tiles may change kind during play (setKind). */
  dynamic?: boolean;
}

export class TileBoard {
  readonly root = new THREE.Group();
  readonly shape: 'tile' | 'cube';
  readonly scale: number;
  /** Tile size in board units: width, height (length on the felt) and depth (thickness). */
  readonly w: number;
  readonly h: number;
  readonly d: number;
  /** Called when a live tile is tapped. */
  onPick?: (id: number) => void;
  private tiles = new Map<number, BTile>();
  private bodyMesh: THREE.InstancedMesh | null = null;
  private backMesh: THREE.InstancedMesh | null = null;
  private pickMesh: THREE.InstancedMesh | null = null;
  /** The gold halo round free tiles (tile boards only). */
  private rimMesh: THREE.InstancedMesh | null = null;
  private rimMat = new THREE.MeshBasicMaterial({ color: '#f5c451', toneMapped: false });
  private faceMeshes = new Map<number, THREE.InstancedMesh>();
  /** Tile ids by instance slot in each kind's face mesh. */
  private faceSlots = new Map<number, number[]>();
  private capacity = 0;
  private faceTex = new Map<number, THREE.Texture>();
  private bodyMat = new THREE.MeshPhysicalMaterial({ color: '#f3ead6', roughness: 0.3 });
  private backMat = new THREE.MeshPhysicalMaterial({ color: '#1f5a46', roughness: 0.25 });
  private faceMats = new Map<number, THREE.MeshStandardMaterial>();
  private geo: { body: THREE.BufferGeometry; back: THREE.BufferGeometry | null; face: THREE.BufferGeometry; pick: THREE.BufferGeometry; rim?: THREE.BufferGeometry };
  private raycaster = new THREE.Raycaster();
  private now = 0;
  private dirty = new Set<number>();
  private colorsDirty = false;
  private opts: Required<BoardOptions>;
  /** Face detail for the board now built (see fewDetail). */
  private detail = 2.25;
  /** Shadow-casting tiles moved since the last frame (the stage asks the renderer for a shadow pass). */
  moved = false;

  constructor(opts: BoardOptions = {}) {
    this.opts = { scale: 1.3, shape: 'tile', labels: true, lowTier: false, detail: 2.25, fewDetail: 0, previewDetail: 2.25, anisotropy: 8, dynamic: false, renderer: null, onSharpen: () => {}, faceSource: null, ...opts };
    this.shape = this.opts.shape;
    this.scale = this.opts.scale;
    const s = this.scale;
    if (this.shape === 'cube') {
      const c = TW * 1.18 * s;
      this.w = this.h = this.d = c;
      const body = new RoundedBoxGeometry(c, c, c, 3, c * 0.12);
      // The symbol on all six sides, as on Dimensions blocks.
      const fw = c * 0.66,
        fh = c * 0.86;
      const faces: THREE.BufferGeometry[] = [];
      const rots = [
        [0, 0, 0],
        [0, Math.PI, 0],
        [0, Math.PI / 2, 0],
        [0, -Math.PI / 2, 0],
        [-Math.PI / 2, 0, 0],
        [Math.PI / 2, 0, 0],
      ];
      for (const [x, y, z] of rots) {
        const p = new THREE.PlaneGeometry(fw, fh);
        p.translate(0, 0, c / 2 + 0.002);
        p.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(x, y, z)));
        faces.push(p);
      }
      this.geo = { body, back: null, face: mergeSimple(faces), pick: new THREE.BoxGeometry(c, c, c) };
    } else {
      this.w = TW * s;
      this.h = TH * s;
      this.d = TD * s;
      // The same two-part tile as the main table: ivory face block and coloured back.
      const body = new RoundedBoxGeometry(TW, TH, TD * 0.64, 3, 0.035);
      body.translate(0, 0, TD * 0.18);
      const back = new RoundedBoxGeometry(TW, TH, TD * 0.4, 3, 0.035);
      back.translate(0, 0, -TD * 0.3);
      const face = new THREE.PlaneGeometry(TW * 0.84, TH * 0.86);
      face.translate(0, 0, TD / 2 + 0.0015);
      // A gold halo a touch larger than the tile, just under its top: it shows as a
      // bright edge all round a free tile and never covers the face.
      const rim = new RoundedBoxGeometry(TW * 1.075, TH * 1.06, TD * 0.72, 3, 0.04);
      rim.translate(0, 0, TD / 2 - TD * 0.36 - 0.004);
      for (const g of [body, back, face, rim]) g.scale(s, s, s);
      const pick = new THREE.BoxGeometry(TW * s, TH * s, TD * s);
      this.geo = { body, back, face, pick, rim };
    }
    this.root.name = 'minigame-board';
  }

  // ------------------------------------------------------------ building

  /** Lay out a fresh board. Every id must be unique. */
  build(specs: BoardTileSpec[]) {
    this.clearMeshes();
    const n = specs.length;
    this.bodyMesh = new THREE.InstancedMesh(this.geo.body, this.bodyMat, Math.max(1, n));
    this.bodyMesh.castShadow = this.bodyMesh.receiveShadow = true;
    if (this.geo.back) {
      this.backMesh = new THREE.InstancedMesh(this.geo.back, this.backMat, Math.max(1, n));
      this.backMesh.castShadow = this.backMesh.receiveShadow = true;
    }
    this.pickMesh = new THREE.InstancedMesh(this.geo.pick, new THREE.MeshBasicMaterial({ visible: false }), Math.max(1, n));
    if (this.geo.rim) this.rimMesh = new THREE.InstancedMesh(this.geo.rim, this.rimMat, Math.max(1, n));
    const byKind = new Map<number, number>();
    for (const sp of specs) byKind.set(sp.kind, (byKind.get(sp.kind) ?? 0) + 1);
    this.detail = byKind.size <= FEW_KINDS ? Math.max(this.opts.detail, this.opts.fewDetail) : this.opts.detail;
    // Boards whose tiles change kind (Match-3) give every kind room for the whole board.
    this.capacity = n;
    for (const [kind, count] of byKind) this.faceMesh(kind, this.opts.dynamic ? n : count);
    specs.forEach((sp, i) => {
      const slots = this.faceSlots.get(sp.kind)!;
      const j = slots.length;
      slots.push(sp.id);
      this.faceMeshes.get(sp.kind)!.count = slots.length;
      const quat = sp.quat?.clone() ?? (sp.faceDown ? FLAT_DOWN.clone() : FLAT.clone());
      const t: BTile = { id: sp.id, kind: sp.kind, i, j, pose: { pos: sp.pos.clone(), quat, scale: 1 }, queue: [], look: 'normal', lift: 0, liftT: 0, alive: true };
      this.tiles.set(sp.id, t);
      this.bodyMesh!.setColorAt(i, col.set('#ffffff'));
      this.faceMeshes.get(sp.kind)!.setColorAt(j, col.set('#ffffff'));
      this.writeMatrix(t);
    });
    for (const m of [this.bodyMesh, this.backMesh, this.pickMesh, this.rimMesh, ...this.faceMeshes.values()]) {
      if (!m) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      // Instances move all over the board; the default sphere would cull them wrongly.
      m.frustumCulled = false;
      this.root.add(m);
    }
    this.finish();
    this.moved = true;
  }

  /** Dress bodies, backs and faces in the equipped set (call after a tile-set change too). */
  finish() {
    applyTileFinish([this.bodyMat], this.backMat, [...this.faceMats.values()], this.opts.lowTier);
    for (const [kind, m] of this.faceMats) dressFace(m, kind, this.opts.labels, false, this.opts.anisotropy, this.faceTex.get(kind)?.userData.scale ?? this.detail);
    // Cubes are solid ivory all round.
    if (this.shape === 'cube') this.bodyMat.side = THREE.FrontSide;
  }

  private faceMesh(kind: number, capacity: number) {
    let fm = this.faceMeshes.get(kind);
    if (fm) return fm;
    fm = new THREE.InstancedMesh(this.geo.face, this.faceMat(kind), Math.max(1, capacity));
    fm.receiveShadow = true;
    fm.count = 0;
    fm.frustumCulled = false;
    this.faceMeshes.set(kind, fm);
    this.faceSlots.set(kind, []);
    return fm;
  }

  /** Give a tile another face (Match-3 refills). The board must be built with `dynamic`. */
  setKind(id: number, kind: number) {
    const t = this.tiles.get(id);
    if (!t || t.kind === kind) return;
    // Out of the old kind's mesh: the last instance there fills the gap.
    const oldMesh = this.faceMeshes.get(t.kind)!;
    const oldSlots = this.faceSlots.get(t.kind)!;
    const lastId = oldSlots[oldSlots.length - 1];
    if (lastId !== id) {
      const lt = this.tiles.get(lastId)!;
      oldSlots[t.j] = lastId;
      lt.j = t.j;
      oldMesh.setColorAt(lt.j, col.set(LOOK_FACE[lt.look]));
      this.dirty.add(lastId);
    }
    oldSlots.pop();
    oldMesh.count = oldSlots.length;
    // Into the new kind's.
    const isNew = !this.faceMeshes.has(kind);
    const fm = this.faceMesh(kind, this.capacity);
    if (isNew) {
      this.finish();
      this.root.add(fm);
    }
    const slots = this.faceSlots.get(kind)!;
    t.kind = kind;
    t.j = slots.length;
    slots.push(id);
    fm.count = slots.length;
    fm.setColorAt(t.j, col.set(LOOK_FACE[t.look]));
    this.colorsDirty = true;
    this.dirty.add(id);
  }

  /** Bring a tile back to the board at once (a refill dropping in). */
  revive(id: number, pose: Partial<Pose>) {
    const t = this.tiles.get(id);
    if (!t) return;
    t.alive = true;
    this.place(id, { scale: 1, ...pose });
  }

  private faceMat(kind: number) {
    let m = this.faceMats.get(kind);
    if (m) return m;
    const shared = this.opts.faceSource?.(kind) ?? null;
    let tex: THREE.Texture;
    if (shared) tex = shared;
    else {
      const full = this.detail;
      // Faces the table already drew (or loaded from the device) are used as they are: no soft first draw.
      const has = (d: number) => hasFace(kind, this.opts.labels, false, d);
      const quick = has(full) ? full : has(this.opts.detail) ? this.opts.detail : Math.min(full, this.opts.previewDetail);
      tex = this.makeFaceTexture(kind, quick);
      if (quick < full) this.queueSharpen(kind);
    }
    this.faceTex.set(kind, tex);
    // As at the table: the face texture doubles as a faint emissive so the ink stays crisp in low light.
    m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.2, roughness: 0.32, metalness: 0 });
    crispSampling(m);
    this.faceMats.set(kind, m);
    return m;
  }

  private makeFaceTexture(kind: number, scale: number) {
    const tex = new THREE.CanvasTexture(drawFace(kind, this.opts.labels, false, scale));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.opts.anisotropy;
    tex.userData.scale = scale;
    return tex;
  }

  private sharpenQueue: number[] = [];
  private sharpenTimer = 0;
  private disposed = false;

  private queueSharpen(kind: number) {
    if (!this.sharpenQueue.includes(kind)) this.sharpenQueue.push(kind);
    if (this.sharpenTimer) return;
    const ric = (window as Window & { requestIdleCallback?: (cb: (d: { timeRemaining(): number }) => void, o?: { timeout: number }) => number }).requestIdleCallback;
    this.sharpenTimer = ric ? ric((d) => this.runSharpen(d), { timeout: 1500 }) : window.setTimeout(() => this.runSharpen(), 60);
  }

  /** True while any tile is tweening or waiting to. */
  get moving() {
    for (const t of this.tiles.values()) if (t.tween || t.queue.length) return true;
    return false;
  }

  /**
   * Redraws a few faces at full detail per idle slice. A full-detail face takes tens
   * of milliseconds to draw and upload, so never while tiles move (see render/quality.ts).
   */
  private runSharpen(deadline?: { timeRemaining(): number }) {
    this.sharpenTimer = 0;
    if (this.disposed) return;
    if (this.moving) {
      this.sharpenTimer = window.setTimeout(() => this.runSharpen(), 400);
      return;
    }
    const full = this.detail;
    // Kinds on the board first.
    const live = new Set([...this.tiles.values()].filter((t) => t.alive).map((t) => t.kind));
    this.sharpenQueue.sort((a, b) => Number(live.has(b)) - Number(live.has(a)));
    do {
      const kind = this.sharpenQueue.shift();
      if (kind === undefined) break;
      const old = this.faceTex.get(kind);
      const m = this.faceMats.get(kind);
      if (!old || !m || (old.userData.scale ?? 0) >= full) continue;
      const tex = this.makeFaceTexture(kind, full);
      this.opts.renderer?.initTexture(tex);
      this.faceTex.set(kind, tex);
      m.map = m.emissiveMap = tex;
      dressFace(m, kind, this.opts.labels, false, this.opts.anisotropy, full);
      if (m.metalnessMap) this.opts.renderer?.initTexture(m.metalnessMap);
      old.dispose();
      this.opts.onSharpen();
    } while (deadline && deadline.timeRemaining() > 12);
    if (this.sharpenQueue.length) this.queueSharpen(this.sharpenQueue[0]);
  }

  private clearMeshes() {
    for (const m of [this.bodyMesh, this.backMesh, this.pickMesh, this.rimMesh, ...this.faceMeshes.values()]) {
      if (!m) continue;
      this.root.remove(m);
      m.dispose();
    }
    this.bodyMesh = this.backMesh = this.pickMesh = this.rimMesh = null;
    this.faceMeshes.clear();
    this.faceSlots.clear();
    this.tiles.clear();
    this.dirty.clear();
  }

  dispose() {
    this.disposed = true;
    this.clearMeshes();
    // Shared faces belong to the table.
    if (!this.opts.faceSource) for (const t of this.faceTex.values()) t.dispose();
    for (const m of this.faceMats.values()) m.dispose();
    this.faceTex.clear();
    this.faceMats.clear();
    this.bodyMat.dispose();
    this.backMat.dispose();
    this.rimMat.dispose();
    for (const g of Object.values(this.geo)) g?.dispose();
    this.root.removeFromParent();
  }

  // ------------------------------------------------------------ tile state

  has(id: number) {
    return !!this.tiles.get(id)?.alive;
  }
  kindOf(id: number) {
    return this.tiles.get(id)?.kind ?? -1;
  }
  ids(): number[] {
    return [...this.tiles.values()].filter((t) => t.alive).map((t) => t.id);
  }
  pose(id: number): Pose | null {
    const t = this.tiles.get(id);
    return t ? { pos: t.pose.pos.clone(), quat: t.pose.quat.clone(), scale: t.pose.scale } : null;
  }
  busy(id?: number) {
    if (id !== undefined) {
      const t = this.tiles.get(id);
      return !!t && (!!t.tween || t.queue.length > 0);
    }
    for (const t of this.tiles.values()) if (t.tween || t.queue.length || Math.abs(t.lift - t.liftT) > 1e-3) return true;
    return false;
  }

  setLook(id: number, look: TileLook) {
    const t = this.tiles.get(id);
    if (!t || t.look === look) return;
    const rimWas = RIM_LOOKS.has(t.look);
    t.look = look;
    t.liftT = LOOK_LIFT[look] ?? 0;
    if (rimWas !== RIM_LOOKS.has(look)) this.dirty.add(id);
    this.bodyMesh?.setColorAt(t.i, col.set(this.shape === 'cube' && look === 'free' ? CUBE_FREE_BODY : LOOK_BODY[look]));
    this.faceMeshes.get(t.kind)?.setColorAt(t.j, col.set(LOOK_FACE[look]));
    this.colorsDirty = true;
  }
  look(id: number): TileLook {
    return this.tiles.get(id)?.look ?? 'normal';
  }
  /** Set every live tile's look at once from a function. */
  looks(fn: (id: number) => TileLook) {
    for (const t of this.tiles.values()) if (t.alive) this.setLook(t.id, fn(t.id));
  }

  /** Tiles glowing softly in gold: a move suggested while the player pauses. */
  private pulsing: number[] = [];
  private pulseT0 = 0;
  private gold = new THREE.Color('#ffd27a');

  /** Pulse these tiles softly in gold (a suggested move); empty stops it. */
  pulse(ids: number[]) {
    const stop = this.pulsing.filter((id) => !ids.includes(id));
    this.pulsing = ids.filter((id) => this.tiles.get(id)?.alive);
    this.pulseT0 = this.now;
    for (const id of [...stop, ...this.pulsing]) {
      const t = this.tiles.get(id);
      if (!t) continue;
      this.bodyMesh?.setColorAt(t.i, col.set(this.shape === 'cube' && t.look === 'free' ? CUBE_FREE_BODY : LOOK_BODY[t.look]));
      this.dirty.add(id);
    }
    this.colorsDirty = true;
  }
  get pulsingIds(): readonly number[] {
    return this.pulsing;
  }

  /** A little side-to-side shake: this tile can't be taken yet. */
  shake(id: number) {
    const t = this.tiles.get(id);
    if (!t || t.tween || t.queue.length) return;
    const p = t.pose.pos.clone();
    const side = new THREE.Vector3(this.w * 0.09, 0, 0);
    this.moveTo(id, { pos: p.clone().add(side) }, { dur: 0.05 });
    this.moveTo(id, { pos: p.clone().sub(side) }, { dur: 0.08 });
    this.moveTo(id, { pos: p.clone().add(side.multiplyScalar(0.4)) }, { dur: 0.06 });
    this.moveTo(id, { pos: p }, { dur: 0.06 });
  }

  /** Move a tile (eased, optionally in an arc). Queued after any move already under way. */
  moveTo(id: number, to: Partial<Pose>, o: { dur?: number; arc?: number; delay?: number; done?: () => void; now?: boolean } = {}) {
    const t = this.tiles.get(id);
    if (!t) return;
    const last = t.queue.length ? t.queue[t.queue.length - 1].to : t.tween?.to ?? t.pose;
    const target: Pose = { pos: (to.pos ?? last.pos).clone(), quat: (to.quat ?? last.quat).clone(), scale: to.scale ?? last.scale };
    const tw: Tween = { from: last, to: target, t0: 0, dur: Math.max(0.001, o.dur ?? 0.35), arc: o.arc ?? 0, done: o.done };
    (tw as Tween & { delay?: number }).delay = o.delay ?? 0;
    if (o.now) {
      t.queue = [];
      t.tween = undefined;
      tw.from = { pos: t.pose.pos.clone(), quat: t.pose.quat.clone(), scale: t.pose.scale };
    }
    t.queue.push(tw);
  }

  /** Put a tile somewhere at once. */
  place(id: number, pose: Partial<Pose>) {
    const t = this.tiles.get(id);
    if (!t) return;
    t.queue = [];
    t.tween = undefined;
    if (pose.pos) t.pose.pos.copy(pose.pos);
    if (pose.quat) t.pose.quat.copy(pose.quat);
    if (pose.scale !== undefined) t.pose.scale = pose.scale;
    this.dirty.add(id);
  }

  /** Take a tile off the board: it lifts, drifts toward `to` (when given) and shrinks away. */
  remove(id: number, o: { to?: THREE.Vector3; delay?: number; dur?: number; done?: () => void } = {}) {
    const t = this.tiles.get(id);
    if (!t || !t.alive) return;
    t.alive = false;
    this.setLook(id, 'normal');
    const p = t.pose.pos;
    const up = p.clone().add(new THREE.Vector3(0, this.d * 2.4, 0));
    this.moveTo(id, { pos: up }, { dur: 0.16, delay: o.delay });
    const end = (o.to ?? up).clone().add(new THREE.Vector3(0, this.d * 1.2, 0));
    this.moveTo(id, { pos: end, scale: 0.001 }, { dur: o.dur ?? 0.32, done: o.done });
  }

  /** Bring a removed tile back where it was (undo). */
  restore(id: number, pose: Pose) {
    const t = this.tiles.get(id);
    if (!t) return;
    t.alive = true;
    t.queue = [];
    t.tween = undefined;
    t.pose.scale = 0.001;
    t.pose.pos.copy(pose.pos).add(new THREE.Vector3(0, this.d * 2, 0));
    t.pose.quat.copy(pose.quat);
    this.moveTo(id, { pos: pose.pos, quat: pose.quat, scale: 1 }, { dur: 0.3 });
  }

  // ------------------------------------------------------------ frame

  /** Advance tweens; true while anything moves. */
  private sourceCheck = 0;

  /** The table sharpens its faces in idle time: show each sharper one as it lands. */
  private followSource() {
    const src = this.opts.faceSource;
    if (!src) return;
    for (const [kind, m] of this.faceMats) {
      const t = src(kind);
      if (!t || t === m.map) continue;
      m.map = m.emissiveMap = t;
      this.faceTex.set(kind, t);
      dressFace(m, kind, this.opts.labels, false, this.opts.anisotropy, t.userData.scale);
      this.opts.onSharpen();
    }
  }

  update(dt: number): boolean {
    this.now += dt;
    if (this.now - this.sourceCheck > 0.4) {
      this.sourceCheck = this.now;
      this.followSource();
    }
    let anim = false;
    if (this.pulsing.length) {
      // Fades in, then breathes: never a flash.
      const k = Math.min(1, (this.now - this.pulseT0) / 0.6) * (0.55 + 0.45 * Math.sin((this.now - this.pulseT0) * 3.2 - Math.PI / 2));
      for (const id of this.pulsing) {
        const t = this.tiles.get(id);
        if (!t?.alive) continue;
        this.bodyMesh?.setColorAt(t.i, col.set(LOOK_BODY[t.look]).lerp(this.gold, 0.25 + 0.75 * Math.max(0, k)));
      }
      this.colorsDirty = true;
      anim = true;
    }
    for (const t of this.tiles.values()) {
      if (!t.tween && t.queue.length) {
        const tw = t.queue.shift()!;
        tw.from = { pos: t.pose.pos.clone(), quat: t.pose.quat.clone(), scale: t.pose.scale };
        tw.t0 = this.now + ((tw as Tween & { delay?: number }).delay ?? 0);
        t.tween = tw;
      }
      const tw = t.tween;
      if (tw) {
        anim = true;
        const k = (this.now - tw.t0) / tw.dur;
        if (k >= 0) {
          const e = ease(Math.min(1, k));
          t.pose.pos.lerpVectors(tw.from.pos, tw.to.pos, e);
          if (tw.arc) t.pose.pos.y += Math.sin(Math.PI * Math.min(1, k)) * tw.arc;
          t.pose.quat.slerpQuaternions(tw.from.quat, tw.to.quat, e);
          t.pose.scale = tw.from.scale + (tw.to.scale - tw.from.scale) * e;
          this.dirty.add(t.id);
          if (k >= 1) {
            t.tween = undefined;
            tw.done?.();
          }
        }
      }
      if (Math.abs(t.lift - t.liftT) > 1e-4) {
        t.lift += (t.liftT - t.lift) * (1 - Math.exp(-dt * 16));
        if (Math.abs(t.lift - t.liftT) < 1e-4) t.lift = t.liftT;
        this.dirty.add(t.id);
        anim = true;
      }
    }
    if (this.dirty.size) {
      for (const id of this.dirty) {
        const t = this.tiles.get(id);
        if (t) this.writeMatrix(t);
      }
      this.dirty.clear();
      for (const m of [this.bodyMesh, this.backMesh, this.pickMesh, this.rimMesh, ...this.faceMeshes.values()]) if (m) m.instanceMatrix.needsUpdate = true;
      this.moved = true;
    }
    if (this.colorsDirty) {
      this.colorsDirty = false;
      for (const m of [this.bodyMesh, ...this.faceMeshes.values()]) if (m?.instanceColor) m.instanceColor.needsUpdate = true;
    }
    return anim;
  }

  private writeMatrix(t: BTile) {
    v3.copy(t.pose.pos);
    v3.y += t.lift;
    q4.copy(t.pose.quat);
    const s = t.pose.scale;
    s3.set(s, s, s);
    m4.compose(v3, q4, s3);
    this.bodyMesh?.setMatrixAt(t.i, m4);
    this.backMesh?.setMatrixAt(t.i, m4);
    // A removed tile can't be picked, even mid-flight.
    if (!t.alive) s3.set(0, 0, 0);
    this.pickMesh?.setMatrixAt(t.i, t.alive ? m4 : m4.clone().compose(v3, q4, s3));
    this.faceMeshes.get(t.kind)?.setMatrixAt(t.j, m4);
    if (this.rimMesh) {
      if (t.alive && (RIM_LOOKS.has(t.look) || this.pulsing.includes(t.id))) this.rimMesh.setMatrixAt(t.i, m4);
      else this.rimMesh.setMatrixAt(t.i, m4.clone().compose(v3, q4, s3.set(0, 0, 0)));
    }
  }

  // ------------------------------------------------------------ picking

  /** The live tile under a point (client pixels), nearest the camera. */
  pick(clientX: number, clientY: number, camera: THREE.Camera, el: HTMLElement): number | null {
    if (!this.pickMesh) return null;
    const r = el.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, camera);
    this.root.updateMatrixWorld();
    const hits = this.raycaster.intersectObject(this.pickMesh, false);
    for (const hit of hits) {
      if (hit.instanceId === undefined) continue;
      for (const t of this.tiles.values()) if (t.i === hit.instanceId && t.alive) return t.id;
    }
    return null;
  }

  /**
   * How sharp the faces can look: texels of each face texture per drawn pixel along the face's
   * width and height, over the live tiles in view (1.5 or more reads crisp).
   */
  texelDensity(camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.root.updateMatrixWorld();
    const fw = (this.shape === 'cube' ? 0.66 : 0.84) * (this.shape === 'cube' ? this.w : TW * this.scale),
      fh = (this.shape === 'cube' ? 0.86 * this.w : 0.86 * TH * this.scale);
    const top = this.shape === 'cube' ? this.w / 2 : TD * this.scale / 2;
    const px = (v: THREE.Vector3) => {
      v.project(camera);
      return new THREE.Vector2(((v.x + 1) / 2) * size.x, ((1 - v.y) / 2) * size.y);
    };
    const ratios: number[] = [];
    let texW = 0;
    for (const t of this.tiles.values()) {
      if (!t.alive) continue;
      const tex = this.faceTex.get(t.kind);
      const img = tex?.image as { width: number; height: number } | undefined;
      if (!img) continue;
      texW = img.width;
      m4.compose(t.pose.pos, t.pose.quat, s3.set(t.pose.scale, t.pose.scale, t.pose.scale)).premultiply(this.root.matrixWorld);
      const c = px(new THREE.Vector3(0, 0, top).applyMatrix4(m4));
      const x = px(new THREE.Vector3(fw / 2, 0, top).applyMatrix4(m4));
      const y = px(new THREE.Vector3(0, fh / 2, top).applyMatrix4(m4));
      if (c.x < 0 || c.y < 0 || c.x > size.x || c.y > size.y) continue;
      ratios.push(Math.min(img.width / (2 * c.distanceTo(x)), img.height / (2 * c.distanceTo(y))));
    }
    ratios.sort((a, b) => a - b);
    return { tiles: ratios.length, min: ratios[0] ?? 0, median: ratios[ratios.length >> 1] ?? 0, texW, pixelRatio: renderer.getPixelRatio() };
  }

  /** Bounds of the live tiles in world space (for framing the camera). */
  /** Extra room (board space) the camera frame must include, such as a tray. */
  fitExtra: THREE.Box3 | null = null;

  bounds(all = false): THREE.Box3 {
    const b = new THREE.Box3();
    if (this.fitExtra) b.union(this.fitExtra);
    const half = new THREE.Vector3(Math.max(this.w, this.h) / 2, this.d, Math.max(this.w, this.h) / 2);
    for (const t of this.tiles.values()) {
      if (!all && !t.alive) continue;
      const p = (t.tween?.to ?? t.pose).pos;
      b.expandByPoint(v3.copy(p).sub(half));
      b.expandByPoint(v3.copy(p).add(half));
    }
    if (b.isEmpty()) b.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 0.3, 1));
    return b.applyMatrix4(this.root.matrixWorld);
  }

  /** Screen position (client px) of a board point. */
  toScreen(p: THREE.Vector3, camera: THREE.Camera, el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const v = p.clone().applyMatrix4(this.root.matrixWorld).project(camera);
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }
}

/** Merge plain geometries that share attributes (position, normal, uv). */
function mergeSimple(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  const names = ['position', 'normal', 'uv'] as const;
  let vtx = 0;
  const idx: number[] = [];
  const data: Record<string, number[]> = { position: [], normal: [], uv: [] };
  for (const g of parts) {
    for (const n of names) data[n].push(...(g.getAttribute(n).array as ArrayLike<number> as number[]));
    const ix = g.getIndex();
    if (ix) for (let k = 0; k < ix.count; k++) idx.push(ix.getX(k) + vtx);
    vtx += g.getAttribute('position').count;
    g.dispose();
  }
  out.setAttribute('position', new THREE.Float32BufferAttribute(data.position, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(data.normal, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
  out.setIndex(idx);
  return out;
}
