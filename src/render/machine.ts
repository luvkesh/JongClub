// The automatic table, as in a premium club: the centre panel rises on its
// column, the tiles are swept into the opening, washed inside the table, and
// the four walls rise ready-built from slots in front of each seat.
// This file owns the table's moving parts and the timing; table3d.ts moves the
// tiles along the timeline it returns.

import * as THREE from 'three';

/** Seconds into the sequence (at speed factor 1) for each beat. */
const BEATS = {
  openEnd: 0.3,
  gatherStart: 0.15,
  gatherSpread: 0.45,
  gatherDur: 0.42,
  sinkDur: 0.22,
  closeStart: 1.2,
  closeEnd: 1.45,
  slotsOpen: 1.7,
  riseStart: 1.85,
  riseStagger: 0.07,
  riseDur: 0.62,
  slotsClose: 2.62,
  end: 2.85,
};

export interface MachineTimeline {
  /** When a tile set off for the opening, and how long it takes to reach and sink into it. */
  gather(rand: number): { t0: number; dur: number; sinkDur: number };
  /** When the wall on a side (0..3, from the dealer round the table) starts to rise, and for how long. */
  rise(side: number): { t0: number; dur: number };
  /** Whole sequence length (s). */
  total: number;
}

const smooth = (a: number, b: number, t: number) => {
  const x = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};

export class ShuffleMachine {
  readonly group = new THREE.Group();
  /** The dark opening around the centre column. */
  private hole: THREE.Mesh;
  private column: THREE.Mesh;
  /** Four dark slots in the felt that the walls rise out of. */
  private slots: THREE.Mesh[] = [];
  private t0 = -1;
  private k = 1;

  constructor(
    /** The centre panel (the compass), lifted while the table runs. */
    private panel: THREE.Object3D,
    slotLength: number,
    slotZ: number,
    slotDepth: number,
  ) {
    const dark = new THREE.MeshBasicMaterial({ color: '#050605', transparent: true, opacity: 0, depthWrite: false });
    this.hole = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 1.56), dark);
    this.hole.rotation.x = -Math.PI / 2;
    this.hole.position.y = 0.023;
    this.hole.renderOrder = 1;
    this.column = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1, 24), new THREE.MeshStandardMaterial({ color: '#c9a46a', metalness: 0.9, roughness: 0.3 }));
    for (let q = 0; q < 4; q++) {
      const slot = new THREE.Mesh(new THREE.PlaneGeometry(slotLength, slotDepth), dark.clone());
      slot.rotation.x = -Math.PI / 2;
      const a = (q * Math.PI) / 2;
      slot.position.set(Math.sin(a) * slotZ, 0.023, Math.cos(a) * slotZ);
      slot.rotation.z = a;
      slot.renderOrder = 1;
      this.slots.push(slot);
    }
    this.group.add(this.hole, this.column, ...this.slots);
    this.group.visible = false;
  }

  get running() {
    return this.t0 >= 0;
  }

  /** Start the sequence at clock time `now`; `k` stretches it (1 classic, more for cinematic). */
  start(now: number, k: number): MachineTimeline {
    this.t0 = now;
    this.k = k;
    this.group.visible = true;
    return {
      gather: (r) => ({ t0: now + (BEATS.gatherStart + r * BEATS.gatherSpread) * k, dur: BEATS.gatherDur * k, sinkDur: BEATS.sinkDur * k }),
      rise: (side) => ({ t0: now + (BEATS.riseStart + side * BEATS.riseStagger) * k, dur: BEATS.riseDur * k }),
      total: BEATS.end * k,
    };
  }

  /** Stop at once and put the panel back (a new hand, or leaving the table). */
  stop() {
    this.t0 = -1;
    this.group.visible = false;
    this.panel.position.y = 0.04;
    this.panel.rotation.y = Math.PI / 2;
  }

  /** Where tiles head for: a random spot inside the opening. */
  static holePoint(rand: () => number) {
    const a = rand() * Math.PI * 2;
    const r = 0.4 + rand() * 0.3;
    return new THREE.Vector3(Math.cos(a) * r, 0.1, Math.sin(a) * r);
  }

  update(now: number) {
    if (this.t0 < 0) return;
    const t = (now - this.t0) / this.k;
    if (t >= BEATS.end) {
      this.stop();
      return;
    }
    const open = smooth(0, BEATS.openEnd, t) * (1 - smooth(BEATS.closeStart, BEATS.closeEnd, t));
    const lift = 0.7 * open;
    this.panel.position.y = 0.04 + lift;
    // The wash: the panel turns slowly while the tiles tumble inside.
    this.panel.rotation.y = Math.PI / 2 + smooth(0.2, BEATS.slotsClose, t) * Math.PI * 2;
    this.column.visible = lift > 0.01;
    this.column.scale.set(1, Math.max(0.01, lift), 1);
    this.column.position.y = lift / 2;
    (this.hole.material as THREE.MeshBasicMaterial).opacity = 0.92 * open;
    this.hole.scale.setScalar(0.3 + 0.7 * open);
    const slot = smooth(BEATS.slotsOpen, BEATS.riseStart, t) * (1 - smooth(BEATS.slotsClose - 0.12, BEATS.slotsClose, t));
    for (const s of this.slots) (s.material as THREE.MeshBasicMaterial).opacity = 0.85 * slot;
  }
}
