// Puts a mini-game board on the club table. The TableRenderer keeps drawing
// the room, the table, the racks, the side tables and the effects as usual;
// the stage adds the board to its scene, sets the camera just before each
// frame is drawn (scene.onBeforeRender, after the table's own camera pass) and
// keeps the match tiles and the centre compass out of the picture. Leaving puts
// everything back and returns the table to its landing view.

import * as THREE from 'three';
import type { TableRenderer } from '../render/table3d';
import type { TileBoard } from './board';
import type { BoardCamera } from './camera';

type BeforeRender = THREE.Scene['onBeforeRender'];

/** The table's pixel budget (drawing-buffer pixels per frame), see TableRenderer.resize(). */
const MAX_PIXELS = 4_200_000;
/** A still board draws at full sharpness this long after the last movement. */
const STILL_MS = 260;

export class MiniStage {
  private prev: BeforeRender | null = null;
  private hidden: { o: THREE.Object3D; was: boolean }[] = [];
  private last = 0;
  private on = false;
  /** When the board last moved (ms), and whether the still, full-sharpness ratio is in use. */
  private movedAt = 0;
  private sharp = false;
  private sharpPr = 0;
  private sharpTimer = 0;
  private splitPref: TableRenderer['splitPref'] | null = null;
  /** Extra per-frame work (a game's own effects). */
  onFrame?: (dt: number) => void;
  board: TileBoard | null = null;
  cam: BoardCamera | null = null;

  constructor(private table: TableRenderer) {}

  enter(board: TileBoard, cam: BoardCamera) {
    if (this.on) this.exit(false);
    this.on = true;
    this.board = board;
    this.cam = cam;
    const t = this.table;
    // The seat view, so the table draws at its calm rate when nothing moves (the orbit glides all the time).
    t.setView('seat', 0.01);
    // No split view (the hand strip along the bottom) under a mini-game: there is no hand, and its
    // strip would draw a second view of the board with gold rules across the screen.
    this.splitPref = t.splitPref;
    t.splitPref = 'off';
    t.scene.add(board.root);
    // The match tiles (meshes tagged with a tileId) and the compass disc in the middle of the felt.
    const groups = new Set<THREE.Object3D>();
    t.scene.traverse((o) => {
      if (o.userData.tileId !== undefined && o.parent && o.parent !== t.scene) groups.add(o.parent);
      const g = (o as THREE.Mesh).geometry as THREE.CylinderGeometry | undefined;
      if (g?.type === 'CylinderGeometry' && Math.abs((g.parameters?.radiusTop ?? 0) - 0.62) < 1e-3 && Math.abs(o.position.x) < 0.01 && Math.abs(o.position.z) < 0.01) groups.add(o);
    });
    this.hidden = [...groups].map((o) => ({ o, was: o.visible }));
    this.prev = t.scene.onBeforeRender;
    this.last = performance.now();
    const prev = this.prev as unknown as ((...a: unknown[]) => void) | null;
    t.scene.onBeforeRender = ((renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, ...rest: unknown[]) => {
      prev?.call(scene, renderer, scene, camera, ...rest);
      this.frame(camera as THREE.PerspectiveCamera, renderer);
    }) as unknown as BeforeRender;
    t.wake(1500);
  }

  private frame(camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    // The table may have shown a tile again (a tween ending): note it and hide it for this frame.
    for (const h of this.hidden) {
      if (h.o.visible) {
        h.was = true;
        h.o.visible = false;
      }
    }
    const b = this.board,
      c = this.cam;
    if (!b || !c) return;
    const moving = b.update(dt);
    this.onFrame?.(dt);
    const size = renderer.getSize(new THREE.Vector2());
    const easing = c.apply(camera, dt, size.x, size.y);
    if (b.moved) {
      b.moved = false;
      renderer.shadowMap.needsUpdate = true;
    }
    // Only real motion (tiles travelling, the camera gliding) may cost sharpness. A hover
    // highlight or a free tile's small lift keeps drawing, at full density.
    const motion = b.moving || easing;
    if (moving && !motion) this.table.wake(250);
    // A still board is drawn dense on purpose: its frames must not teach the governor to step down.
    if (!motion) this.table.governor.pause();
    if (motion) {
      this.table.wake(250);
      this.movedAt = now;
      // Moving again on a device the governor has stepped down: back to its resolution.
      if (this.sharp && this.table.governor.step.scale < 1) this.later(() => this.unsharpen());
    } else if (now - this.movedAt > STILL_MS && (!this.sharp || renderer.getPixelRatio() < this.sharpPr - 0.01)) this.later(() => this.sharpen());
  }

  /** Size changes never happen mid-frame. */
  private later(fn: () => void) {
    if (this.sharpTimer) return;
    this.sharpTimer = window.setTimeout(() => {
      this.sharpTimer = 0;
      if (this.on) fn();
    }, 0);
  }

  /**
   * A still board is drawn at the screen's full pixel density (within the table's
   * pixel budget), so every tile reads perfectly at any zoom. It costs nothing while
   * still, since the table then draws only now and then; while tiles move, a device
   * the frame governor has stepped down goes back to its lower resolution.
   */
  private sharpen() {
    const el = this.table.renderer.domElement;
    const w = el.clientWidth || window.innerWidth,
      h = el.clientHeight || window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, 2.5, Math.sqrt(MAX_PIXELS / Math.max(1, w * h)));
    this.sharp = true;
    this.sharpPr = pr;
    if (pr > this.table.renderer.getPixelRatio() + 0.01) {
      this.table.renderer.setPixelRatio(pr);
      this.table.wake(120);
    }
  }

  private unsharpen() {
    this.sharp = false;
    this.table.resize();
  }

  /** Keep drawing at full rate for a while (an effect is playing). */
  wake(ms = 600) {
    this.table.wake(ms);
  }

  exit(restore = true) {
    if (!this.on) return;
    this.on = false;
    window.clearTimeout(this.sharpTimer);
    this.sharpTimer = 0;
    this.sharp = false;
    const t = this.table;
    if (this.splitPref) t.splitPref = this.splitPref;
    this.splitPref = null;
    t.scene.onBeforeRender = this.prev ?? (() => undefined);
    this.prev = null;
    for (const h of this.hidden) h.o.visible = h.was;
    this.hidden = [];
    this.board?.root.removeFromParent();
    this.board = null;
    this.cam = null;
    t.camera.clearViewOffset();
    t.camera.up.set(0, 1, 0);
    if (restore) {
      // Back to the table's own framing and the landing loop.
      t.resize();
      t.idle();
    }
  }
}
