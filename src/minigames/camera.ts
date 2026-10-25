// The board camera for mini-games, with the main table's feel: drag to turn
// and tilt, pinch or scroll to zoom, a tap picks a tile. It frames the board's
// bounds inside the space the HUD leaves free and eases every change.

import * as THREE from 'three';

export interface CameraLimits {
  /** Turn either way from straight on, in degrees; 180 turns all the way round. */
  yaw: number;
  /** Elevation range in degrees (90 is straight down). */
  pitchMin: number;
  pitchMax: number;
  zoomMin: number;
  zoomMax: number;
}

export const FLAT_LIMITS: CameraLimits = { yaw: 40, pitchMin: 38, pitchMax: 86, zoomMin: 0.8, zoomMax: 2.6 };
export const CUBE_LIMITS: CameraLimits = { yaw: 180, pitchMin: -55, pitchMax: 80, zoomMin: 0.7, zoomMax: 2.2 };

/** Space the HUD covers, in CSS pixels, so the board is framed in what is left. */
export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const TAP_PX = 9;

export class BoardCamera {
  limits: CameraLimits = FLAT_LIMITS;
  /** Defaults the reset button returns to. */
  home = { yaw: 0, pitch: 64 };
  private target = new THREE.Vector3();
  /** Sideways and forward shift of the focus when zoomed in (world units on the felt). */
  private pan = new THREE.Vector2();
  private yaw = 0;
  private pitch = 64;
  private zoom = 1;
  private cur = { yaw: 0, pitch: 64, zoom: 1, tx: 0, ty: 0, tz: 0, dist: 10 };
  private dist = 10;
  private box = new THREE.Box3(new THREE.Vector3(-2, 0, -2), new THREE.Vector3(2, 0.4, 2));
  insets: Insets = { top: 70, bottom: 86, left: 12, right: 12 };
  private ptrs = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>();
  private pinch: { d: number; zoom: number } | null = null;
  private moved = false;
  /** Slow idle turn (Dimensions' showcase); 0 is still. */
  spin = 0;
  onTap?: (x: number, y: number) => void;
  onHover?: (x: number, y: number) => void;
  /** A press on the board: return true to take the drag over (Match-3 swipes a tile) instead of turning the view. */
  onDragStart?: (x: number, y: number) => boolean;
  /** A taken-over drag went far enough: from its start point toward (x, y). Fires once per drag. */
  onSwipe?: (sx: number, sy: number, x: number, y: number) => void;
  private claimed: { sx: number; sy: number; done: boolean } | null = null;
  /** True while the camera is still easing (the stage keeps drawing at full rate). */
  settling = true;
  private detach: (() => void) | null = null;

  /** Listen for gestures on the layer over the canvas. */
  attach(el: HTMLElement) {
    this.detach?.();
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button, a, input, select, .mini-ui')) return;
      el.setPointerCapture?.(e.pointerId);
      this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
      this.moved = false;
      this.claimed = this.ptrs.size === 1 && this.onDragStart?.(e.clientX, e.clientY) ? { sx: e.clientX, sy: e.clientY, done: false } : null;
      if (this.ptrs.size === 2) {
        this.claimed = null;
        const [a, b] = [...this.ptrs.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoom };
        this.moved = true;
      }
    };
    const move = (e: PointerEvent) => {
      const p = this.ptrs.get(e.pointerId);
      if (!p) {
        if (e.pointerType === 'mouse') this.onHover?.(e.clientX, e.clientY);
        return;
      }
      const dx = e.clientX - p.x,
        dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.pinch && this.ptrs.size >= 2) {
        const [a, b] = [...this.ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.setZoom(this.pinch.zoom * (d / Math.max(1, this.pinch.d)));
        // Two fingers moving together slide the board.
        this.panBy(dx / 2, dy / 2, el.clientHeight);
        return;
      }
      if (this.claimed) {
        const c = this.claimed;
        if (!c.done && Math.hypot(e.clientX - c.sx, e.clientY - c.sy) >= TAP_PX * 1.6) {
          c.done = true;
          this.moved = true;
          this.onSwipe?.(c.sx, c.sy, e.clientX, e.clientY);
        }
        return;
      }
      if (!this.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < TAP_PX) return;
      this.moved = true;
      // Zoomed in, a drag slides the board under your finger; at the full view it turns and tilts it.
      if (this.zoom > 1.08 && !e.shiftKey) {
        this.panBy(dx, dy, el.clientHeight);
        return;
      }
      const h = Math.max(300, el.clientHeight);
      this.yaw = this.clampYaw(this.yaw - (dx / h) * 160);
      this.pitch = THREE.MathUtils.clamp(this.pitch + (dy / h) * 110, this.limits.pitchMin, this.limits.pitchMax);
      this.settling = true;
    };
    const up = (e: PointerEvent) => {
      const p = this.ptrs.get(e.pointerId);
      this.ptrs.delete(e.pointerId);
      if (this.ptrs.size < 2) this.pinch = null;
      if (this.ptrs.size === 0) this.claimed = null;
      if (p && !this.moved && this.ptrs.size === 0 && e.type === 'pointerup') this.onTap?.(e.clientX, e.clientY);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      this.setZoom(this.zoom * Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    this.detach = () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }

  dispose() {
    this.detach?.();
    this.detach = null;
  }

  private clampYaw(y: number) {
    if (this.limits.yaw >= 180) return y;
    return THREE.MathUtils.clamp(y, -this.limits.yaw, this.limits.yaw);
  }

  setZoom(z: number) {
    this.zoom = THREE.MathUtils.clamp(z, this.limits.zoomMin, this.limits.zoomMax);
    this.clampPan();
    this.settling = true;
  }

  /** Slide the focus by a drag of (dx, dy) pixels, in the camera's own left-right and up-down. */
  private panBy(dx: number, dy: number, viewH: number) {
    const per = (2 * Math.tan(THREE.MathUtils.degToRad(this.fov / 2)) * (this.cur.dist / this.cur.zoom)) / Math.max(200, viewH);
    const y = THREE.MathUtils.degToRad(this.cur.yaw);
    const p = THREE.MathUtils.degToRad(this.cur.pitch);
    // Screen right on the felt, and screen up projected onto the felt (shortened by the view's slant).
    const rx = Math.cos(y),
      rz = -Math.sin(y);
    const s = Math.max(0.35, Math.sin(p));
    const fx = -Math.sin(y),
      fz = -Math.cos(y);
    this.pan.x += (-dx * rx + (dy / s) * fx) * per;
    this.pan.y += (-dx * rz + (dy / s) * fz) * per;
    this.clampPan();
    this.settling = true;
  }

  private clampPan() {
    const size = this.box.getSize(new THREE.Vector3());
    const k = Math.max(0, 1 - 1 / this.zoom);
    this.pan.x = THREE.MathUtils.clamp(this.pan.x, (-size.x / 2) * k, (size.x / 2) * k);
    this.pan.y = THREE.MathUtils.clamp(this.pan.y, (-size.z / 2) * k, (size.z / 2) * k);
  }
  private fov = 40;
  get zoomLevel() {
    return this.zoom;
  }

  /** Turn by a number of degrees (the Dimensions turn buttons). */
  turn(deg: number) {
    this.yaw = this.clampYaw(this.yaw + deg);
    this.settling = true;
  }
  tilt(deg: number) {
    this.pitch = THREE.MathUtils.clamp(this.pitch + deg, this.limits.pitchMin, this.limits.pitchMax);
    this.settling = true;
  }

  reset() {
    this.yaw = this.home.yaw;
    this.pitch = this.home.pitch;
    this.zoom = 1;
    this.pan.set(0, 0);
    this.settling = true;
  }
  get changed() {
    return Math.abs(this.yaw - this.home.yaw) > 1 || Math.abs(this.pitch - this.home.pitch) > 1 || Math.abs(this.zoom - 1) > 0.02;
  }

  /** Frame these bounds (world space). `snap` jumps there instead of easing. */
  frame(box: THREE.Box3, snap = false) {
    this.box.copy(box);
    box.getCenter(this.target);
    this.settling = true;
    if (snap) {
      this.cur = { yaw: this.yaw, pitch: this.pitch, zoom: this.zoom, tx: this.target.x, ty: this.target.y, tz: this.target.z, dist: this.cur.dist };
      this.snapDist = true;
    }
  }
  private snapDist = true;

  /** Place the camera for this frame. Returns true while easing. */
  apply(cam: THREE.PerspectiveCamera, dt: number, viewW: number, viewH: number): boolean {
    if (this.spin && !this.ptrs.size) {
      this.yaw += this.spin * dt;
      this.settling = true;
    }
    const k = 1 - Math.exp(-dt * 8);
    const c = this.cur;
    c.yaw += (this.yaw - c.yaw) * k;
    c.pitch += (this.pitch - c.pitch) * k;
    c.zoom += (this.zoom - c.zoom) * k;
    this.fov = cam.fov;
    const tx = this.target.x + this.pan.x,
      tz = this.target.z + this.pan.y;
    c.tx += (tx - c.tx) * k;
    c.ty += (this.target.y - c.ty) * k;
    c.tz += (tz - c.tz) * k;
    const look = new THREE.Vector3(c.tx, c.ty, c.tz);
    const dir = this.dirFor(c.yaw, c.pitch);
    // The distance that fits the board in the free area, at this angle (zoom 1).
    this.dist = this.fitDistance(cam, this.target, dir, viewW, viewH);
    if (this.snapDist) {
      c.dist = this.dist;
      this.snapDist = false;
    }
    c.dist += (this.dist - c.dist) * k;
    const d = c.dist / c.zoom;
    cam.position.copy(look).addScaledVector(dir, d);
    // Shift the picture so the board sits in the middle of the free area, not the whole screen.
    const ox = (this.insets.left - this.insets.right) / 2,
      oy = (this.insets.top - this.insets.bottom) / 2;
    if (Math.abs(ox) > 0.5 || Math.abs(oy) > 0.5) cam.setViewOffset(viewW, viewH, -ox, -oy, viewW, viewH);
    else cam.clearViewOffset();
    cam.up.set(0, 1, 0);
    cam.lookAt(look);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const still =
      Math.abs(this.yaw - c.yaw) < 0.05 && Math.abs(this.pitch - c.pitch) < 0.05 && Math.abs(this.zoom - c.zoom) < 1e-3 && Math.abs(this.dist - c.dist) < 1e-3 && Math.abs(look.x - tx) + Math.abs(look.y - this.target.y) + Math.abs(look.z - tz) < 1e-3;
    this.settling = !still || !!this.spin;
    return this.settling;
  }

  private dirFor(yawDeg: number, pitchDeg: number) {
    const y = THREE.MathUtils.degToRad(yawDeg),
      p = THREE.MathUtils.degToRad(pitchDeg);
    return new THREE.Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p));
  }

  private fitCam = new THREE.PerspectiveCamera();
  private corners = Array.from({ length: 8 }, () => new THREE.Vector3());

  /** Smallest distance at which every corner of the board falls inside the free area. */
  private fitDistance(cam: THREE.PerspectiveCamera, look: THREE.Vector3, dir: THREE.Vector3, w: number, h: number) {
    const f = this.fitCam;
    f.fov = cam.fov;
    f.aspect = w / Math.max(1, h);
    f.near = 0.1;
    f.far = 200;
    f.updateProjectionMatrix();
    const b = this.box;
    let i = 0;
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) this.corners[i++].set(x, y, z);
    // Free area in normalised device units (the view offset recentres it).
    const fw = Math.max(80, w - this.insets.left - this.insets.right) / w;
    const fh = Math.max(80, h - this.insets.top - this.insets.bottom) / h;
    // Portrait screens are width-bound: let the board run nearly edge to edge.
    const lim = { x: fw * (w < h ? 0.98 : 0.9), y: fh * 0.9 };
    let lo = 0.5,
      hi = 120;
    for (let it = 0; it < 22; it++) {
      const mid = (lo + hi) / 2;
      f.position.copy(look).addScaledVector(dir, mid);
      f.up.set(0, 1, 0);
      f.lookAt(look);
      f.updateMatrixWorld();
      let ok = true;
      for (const c of this.corners) {
        const v = c.clone().project(f);
        if (v.z > 1 || Math.abs(v.x) > lim.x || Math.abs(v.y) > lim.y) {
          ok = false;
          break;
        }
      }
      if (ok) hi = mid;
      else lo = mid;
    }
    return hi;
  }
}
