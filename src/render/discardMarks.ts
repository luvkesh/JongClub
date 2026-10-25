// What the discard layouts add on the felt besides the tiles themselves: the faded
// print a called tile leaves in a Riichi pond, the small gold arrow that points to
// whoever took it (or, on the centre board, from whoever threw the newest tile),
// the count chips on the centre board and its engraved slot outlines.

import * as THREE from 'three';
import { FLOWER_BASE, KIND_COUNT } from '../engine/tiles';

export type DiscardLayout = 'rows' | 'pond' | 'centre';
export type DiscardSetting = 'auto' | DiscardLayout;

/** The layout a table shows: the player's choice, or the variation's own. */
export const discardLayoutFor = (setting: DiscardSetting | undefined, variation: DiscardLayout | undefined): DiscardLayout =>
  setting && setting !== 'auto' ? setting : variation ?? 'rows';

/** Centre board: tile scale, slot pitch, and the gap left for the compass between its upper and lower halves. */
export const BOARD_SCALE = 1.4;
export const BOARD_COL = 0.3 * BOARD_SCALE + 0.034;
export const BOARD_ROW = 0.4 * BOARD_SCALE + 0.04;
export const BOARD_GAP = 0.8;
/** The spotlight for the newest discard, beside the compass. */
export const SPOT_X = 1.26;
export const SPOT_SCALE = 1.62;
/** Room below the board for the spotlight on portrait phones. */
export const SPOT_BELOW = 0.4 * SPOT_SCALE + 0.2;

/**
 * Each kind's fixed slot on the centre board: Bams, Craks and Dots in rows of
 * nine, then winds, dragons, one slot for every flower and one for jokers.
 */
export function boardSlot(kind: number): { row: number; col: number } {
  if (kind >= 18 && kind < 27) return { row: 0, col: kind - 18 };
  if (kind < 9) return { row: 1, col: kind };
  if (kind < 18) return { row: 2, col: kind - 9 };
  if (kind < KIND_COUNT) return { row: 3, col: kind - 27 };
  return { row: 3, col: kind < FLOWER_BASE + 8 ? 7 : 8 };
}

/** Where a slot's centre lies, in the viewer's frame (x to the right, z toward the viewer). */
export function boardPos(row: number, col: number) {
  const x = (col - 4) * BOARD_COL;
  const z = row < 2 ? -BOARD_GAP - BOARD_ROW * (1.5 - row) : BOARD_GAP + BOARD_ROW * (row - 1.5);
  return { x, z };
}

/** How far the board reaches toward the viewer. */
export const BOARD_NEAR = BOARD_GAP + BOARD_ROW * 2;

const GOLD = '#d4af60';
const INK = 'rgba(18,22,20,0.92)';

function discTexture(draw: (g: CanvasRenderingContext2D, s: number) => void) {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2 - 6, 0, Math.PI * 2);
  g.fillStyle = INK;
  g.fill();
  g.lineWidth = 7;
  g.strokeStyle = GOLD;
  g.stroke();
  g.fillStyle = '#f0d696';
  draw(g, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
const up = new THREE.Vector3(0, 1, 0);

export class DiscardMarks {
  private ghosts: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  private arrows: THREE.Mesh[] = [];
  private chips: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>[] = [];
  private used = { ghost: 0, arrow: 0, chip: 0 };
  private arrowTex = discTexture((g, s) => {
    g.beginPath();
    g.moveTo(s / 2, s * 0.24);
    g.lineTo(s * 0.73, s * 0.66);
    g.lineTo(s * 0.27, s * 0.66);
    g.closePath();
    g.fill();
  });
  private chipTex = new Map<number, THREE.CanvasTexture>();
  private disc = new THREE.CircleGeometry(1, 40);
  private plane = new THREE.PlaneGeometry(1, 1);
  private outline: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

  constructor(private scene: THREE.Scene) {
    this.outline = this.makeOutline();
    this.outline.visible = false;
    scene.add(this.outline);
  }

  /** Hide every mark; layout() then shows the ones it uses. */
  begin() {
    this.used = { ghost: 0, arrow: 0, chip: 0 };
  }

  /** Hide the marks this layout did not use. */
  end() {
    this.ghosts.forEach((m, i) => (m.visible = i < this.used.ghost));
    this.arrows.forEach((m, i) => (m.visible = i < this.used.arrow));
    this.chips.forEach((m, i) => (m.visible = i < this.used.chip));
  }

  /** A called tile's faded print in its old pond slot. */
  ghost(tex: THREE.Texture, pos: THREE.Vector3, quat: THREE.Quaternion, w: number, h: number) {
    let m = this.ghosts[this.used.ghost];
    if (!m) {
      m = new THREE.Mesh(this.plane, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.46, depthWrite: false, toneMapped: false }));
      m.renderOrder = 1;
      this.scene.add(m);
      this.ghosts.push(m);
    }
    this.used.ghost++;
    if (m.material.map !== tex) {
      m.material.map = tex;
      m.material.needsUpdate = true;
    }
    m.position.copy(pos);
    m.quaternion.copy(quat);
    m.scale.set(w, h, 1);
  }

  /** A gold arrow chip lying on the felt, pointing along `dir` (world, horizontal). */
  arrow(pos: THREE.Vector3, dir: THREE.Vector3, r = 0.1) {
    let m = this.arrows[this.used.arrow];
    if (!m) {
      m = new THREE.Mesh(this.disc, new THREE.MeshBasicMaterial({ map: this.arrowTex, transparent: true, depthWrite: false, toneMapped: false }));
      m.renderOrder = 3;
      this.scene.add(m);
      this.arrows.push(m);
    }
    this.used.arrow++;
    m.position.copy(pos);
    // The texture's arrow points to -z once laid flat; turn it toward dir.
    m.quaternion.setFromAxisAngle(up, Math.atan2(-dir.x, -dir.z)).multiply(flat);
    m.scale.setScalar(r);
  }

  /** A count chip ("3") on a centre-board slot, upright for the viewer (`quat` = the viewer's seat turn). */
  chip(n: number, pos: THREE.Vector3, quat: THREE.Quaternion, r = 0.095) {
    let m = this.chips[this.used.chip];
    if (!m) {
      m = new THREE.Mesh(this.disc, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
      m.renderOrder = 3;
      this.scene.add(m);
      this.chips.push(m);
    }
    this.used.chip++;
    const tex = this.countTexture(n);
    if (m.material.map !== tex) {
      m.material.map = tex;
      m.material.needsUpdate = true;
    }
    m.position.copy(pos);
    m.quaternion.copy(quat).multiply(flat);
    m.scale.setScalar(r);
  }

  /** The board's engraved slot outlines (shown only for the centre layout), turned to the viewer. */
  showOutline(show: boolean, quat?: THREE.Quaternion) {
    this.outline.visible = show;
    if (show && quat) this.outline.quaternion.copy(quat).multiply(flat);
  }

  private countTexture(n: number) {
    let t = this.chipTex.get(n);
    if (!t) {
      t = discTexture((g, s) => {
        g.font = `600 ${s * 0.5}px Cinzel, Georgia, serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(String(n), s / 2, s / 2 + s * 0.03);
      });
      this.chipTex.set(n, t);
    }
    return t;
  }

  private makeOutline() {
    const w = 9 * BOARD_COL + 0.1;
    const d = 2 * (BOARD_NEAR + 0.05);
    const px = 256;
    const c = document.createElement('canvas');
    c.width = Math.round(w * px);
    c.height = Math.round(d * px);
    const g = c.getContext('2d')!;
    g.strokeStyle = 'rgba(150, 205, 180, 0.32)';
    g.lineWidth = 4;
    const tw = 0.3 * BOARD_SCALE * px,
      th = 0.4 * BOARD_SCALE * px;
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 9; col++) {
        const { x, z } = boardPos(row, col);
        const cx = (x + w / 2) * px,
          cy = (z + d / 2) * px;
        g.beginPath();
        g.roundRect(cx - tw / 2, cy - th / 2, tw, th, 14);
        g.stroke();
      }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    m.position.y = 0.021;
    m.renderOrder = 1;
    return m;
  }
}
