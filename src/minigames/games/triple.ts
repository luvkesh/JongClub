// Mahjong Triple Match: tap free tiles into a seven-place tray on your table;
// three of a kind clear. A full tray loses.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { tr } from '../../i18n';
import { registerMiniGame } from '../registry';
import { FLAT } from '../board';
import { GameClock, freeLook } from '../helpers';
import type { MiniHost, MiniLevel, MiniSession } from '../types';
import { TRAY, Triple, dealTriple, tripleLayout, type Spot } from './triple/logic';

const SETUP: Record<MiniLevel, { layers: number; w: number; h: number; kinds: number; spread: number; undo: number; shuffle: number; hint: number }> = {
  easy: { layers: 2, w: 7, h: 5, kinds: 9, spread: 1, undo: Infinity, shuffle: Infinity, hint: Infinity },
  medium: { layers: 3, w: 8, h: 6, kinds: 14, spread: 2, undo: 3, shuffle: 2, hint: 4 },
  hard: { layers: 4, w: 9, h: 6, kinds: 20, spread: 3, undo: 1, shuffle: 1, hint: 2 },
};
const PAY: Record<MiniLevel, number> = { easy: 1, medium: 1.5, hard: 2.2 };

class TripleSession implements MiniSession {
  private g: Triple;
  private cfg: (typeof SETUP)['easy'];
  private clock = new GameClock();
  private score = 0;
  private ended = false;
  private undos: number;
  private shuffles: number;
  private hints: number;
  private hintId: number | null = null;
  private tray: THREE.Group;
  private trayZ = 0;
  private center = { x: 0, y: 0 };
  private sets = 0;
  private chain = 0;

  constructor(private host: MiniHost) {
    this.cfg = SETUP[host.level];
    const spots = tripleLayout(this.cfg.layers, this.cfg.w, this.cfg.h, host.rng);
    this.g = new Triple(spots, dealTriple(spots, host.rng, this.cfg.kinds, this.cfg.spread));
    this.undos = this.cfg.undo;
    this.shuffles = this.cfg.shuffle;
    this.hints = this.cfg.hint;
    const xs = spots.map((s) => s.x),
      ys = spots.map((s) => s.y);
    this.center = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
    const b = host.board;
    this.trayZ = ((Math.max(...ys) - this.center.y) + 1.15) * (b.h + 0.01) + 0.25;
    this.tray = this.buildTray();
    // Measured before it joins the board, so the box is in board space.
    b.fitExtra = new THREE.Box3().setFromObject(this.tray);
    b.root.add(this.tray);
    host.camera.home = { yaw: 0, pitch: 62 };
    host.camera.reset();
    b.build(spots.map((s, i) => ({ id: i, kind: this.g.kinds[i], pos: this.world(s), quat: FLAT })));
    host.fit(true);
    this.refresh();
  }

  private world(s: Spot) {
    const b = this.host.board;
    return new THREE.Vector3((s.x - this.center.x) * (b.w + 0.01), b.d / 2 + s.z * (b.d + 0.004), (s.y - this.center.y) * (b.h + 0.01));
  }

  private trayPos(i: number) {
    const b = this.host.board;
    const step = b.w + 0.04;
    return new THREE.Vector3((i - (TRAY - 1) / 2) * step, 0.07 + b.d / 2, this.trayZ);
  }

  /** A lacquered tray with seven brass-lined places. */
  private buildTray() {
    const b = this.host.board;
    const g = new THREE.Group();
    const w = TRAY * (b.w + 0.04) + 0.16,
      d = b.h + 0.18;
    const wood = new THREE.MeshPhysicalMaterial({ color: '#3a1d12', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.18 });
    const base = new THREE.Mesh(new RoundedBoxGeometry(w, 0.07, d, 3, 0.025), wood);
    base.position.set(0, 0.035, this.trayZ);
    base.castShadow = base.receiveShadow = true;
    g.add(base);
    const brass = new THREE.MeshStandardMaterial({ color: '#c9a46a', metalness: 1, roughness: 0.32 });
    for (let i = 0; i < TRAY; i++) {
      const p = this.trayPos(i);
      const ring = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.02, 0.004, b.h + 0.02), brass);
      ring.position.set(p.x, 0.072, this.trayZ);
      const inner = new THREE.Mesh(new THREE.BoxGeometry(b.w - 0.004, 0.006, b.h - 0.004), wood);
      inner.position.set(p.x, 0.073, this.trayZ);
      g.add(ring, inner);
    }
    return g;
  }

  private refresh() {
    const free = new Set(this.g.free());
    this.host.board.looks((id) => {
      if (!this.g.onBoard[id]) return 'normal';
      if (id === this.hintId) return 'hint';
      return freeLook(free.has(id));
    });
    this.host.setStat('left', String(this.g.boardLeft + this.g.tray.length), tr('Tiles'));
    this.host.setStat('score', String(this.score), tr('Score'));
    this.host.setStat('moves', `${this.g.tray.length} / ${TRAY}`, tr('Tray'));
    this.host.refreshButtons();
  }

  private layTray(delay = 0) {
    this.g.tray.forEach((id, i) => this.host.board.moveTo(id, { pos: this.trayPos(i), quat: FLAT }, { dur: 0.26, delay }));
  }

  onPick(id: number) {
    if (this.ended || !this.g.onBoard[id]) return;
    if (!this.g.isFree(id)) {
      this.host.board.shake(id);
      this.host.sound('click');
      return;
    }
    this.hintId = null;
    const before = this.g.tray.length;
    const set = this.g.take(id);
    const b = this.host.board;
    // The tile flies to its place in the tray; the rest shuffle along.
    const slot = set.length ? before : this.g.tray.indexOf(id);
    b.moveTo(id, { pos: this.trayPos(Math.max(0, slot)), quat: FLAT }, { dur: 0.34, arc: 0.35, now: true });
    this.host.sound('draw');
    if (set.length) {
      this.sets++;
      const t = this.clock.elapsed;
      this.chain = t - this.lastSet < 5 ? this.chain + 1 : 1;
      this.lastSet = t;
      this.score += 30 + 10 * (this.chain - 1);
      const mid = this.trayPos(Math.max(0, slot - 1));
      window.setTimeout(() => {
        for (const s of set) b.remove(s, { to: mid });
        this.host.burst(mid.clone().setY(mid.y + 0.25));
        this.host.sound('pung');
        this.layTray(0.2);
      }, 380);
    } else this.layTray(0.12);
    if (this.g.won) window.setTimeout(() => this.win(), 900);
    else if (this.g.lost) window.setTimeout(() => this.lose(), 700);
    this.refresh();
  }
  private lastSet = -99;

  suggest(): number[] | null {
    if (this.ended) return [];
    const id = this.g.hint();
    return id === null ? null : [id];
  }

  hint(): boolean {
    if (this.ended || this.hints <= 0) return false;
    const id = this.g.hint();
    if (id === null) return false;
    this.hintId = id;
    this.hints--;
    this.refresh();
    window.setTimeout(() => {
      this.hintId = null;
      if (!this.ended) this.refresh();
    }, 2500);
    return true;
  }
  canUse(tool: 'hint' | 'shuffle') {
    if (this.ended) return false;
    return tool === 'hint' ? this.hints > 0 : this.shuffles > 0;
  }
  canUndo() {
    return !this.ended && this.undos > 0 && this.g.history.length > 0 && this.g.history[this.g.history.length - 1].clearedBefore === this.g.cleared.length;
  }
  undo() {
    if (!this.canUndo()) return false;
    const id = this.g.undo();
    if (id === null) return false;
    this.undos--;
    this.host.board.moveTo(id, { pos: this.world(this.g.spots[id]), quat: FLAT }, { dur: 0.32, arc: 0.3, now: true });
    this.layTray();
    this.host.sound('slide');
    this.refresh();
    return true;
  }
  shuffle() {
    if (this.ended || this.shuffles <= 0) return false;
    // Tiles change places rather than faces: shuffle by moving each board tile to another's spot.
    const ids = this.g.spots.map((_, i) => i).filter((i) => this.g.onBoard[i]);
    this.g.shuffle(this.host.rng);
    // Rebuild with the new kinds where they now lie, then toss them in.
    const b = this.host.board;
    const specs = this.g.spots.map((s, i) => ({ id: i, kind: this.g.kinds[i], pos: this.g.onBoard[i] ? this.world(s).add(new THREE.Vector3(0, 0.6, 0)) : this.g.tray.includes(i) ? this.trayPos(this.g.tray.indexOf(i)) : this.world(s), quat: FLAT }));
    b.build(specs);
    for (const i of this.g.cleared) b.place(i, { scale: 0.001 });
    for (const i of this.g.cleared) b.remove(i);
    for (const i of ids) b.moveTo(i, { pos: this.world(this.g.spots[i]) }, { dur: 0.35, delay: (i % 11) * 0.02 });
    this.shuffles--;
    this.host.sound('shuffle');
    this.refresh();
    return true;
  }
  badges() {
    const n = (v: number) => (Number.isFinite(v) ? String(v) : undefined);
    return { hint: n(this.hints), undo: n(this.undos), shuffle: n(this.shuffles) };
  }
  tick(dt: number) {
    if (this.ended) return;
    this.clock.tick(dt);
    this.host.setStat('time', this.clock.text(), tr('Time'));
  }
  pause(p: boolean) {
    this.clock.paused = p;
  }
  private win() {
    if (this.ended) return;
    this.ended = true;
    const n = this.g.spots.length;
    const bonus = Math.max(0, Math.round(n * 2.2 - this.clock.elapsed));
    this.score += bonus;
    this.host.finish({ won: true, score: this.score, seconds: this.clock.elapsed, cleared: n, total: n, notes: [tr('{n} sets of three', { n: this.sets }), ...(bonus ? [tr('Time bonus +{n}', { n: bonus })] : [])] });
  }
  private lose() {
    if (this.ended) return;
    this.ended = true;
    const n = this.g.spots.length;
    this.host.finish({ won: false, score: this.score, seconds: this.clock.elapsed, cleared: this.g.cleared.length, total: n, notes: [tr('The tray is full')] });
  }
  dispose() {
    this.ended = true;
    this.host.board.fitExtra = null;
    this.tray.removeFromParent();
    this.tray.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  }
}

registerMiniGame({
  id: 'triple',
  layered: true,
  title: tr('Mahjong Triple Match'),
  blurb: tr('Collect three of a kind in your tray. Seven places, so choose with care.'),
  minutes: tr('2–5 min'),
  order: 40,
  icon: { kinds: [22, 31, 5], shape: 'tray' },
  levels: ['easy', 'medium', 'hard'],
  howTo: [
    tr('Tap a tile with nothing on top of it to move it into the tray.'),
    tr('Three of the same tile in the tray clear away.'),
    tr('The tray holds seven tiles. Fill it without a set and the game is over.'),
  ],
  tools: { hint: true, undo: true, shuffle: true },
  reward: (r, level) => (r.won ? Math.max(20, Math.round((40 + r.total * 0.8) * PAY[level] - r.hints * 4 - r.shuffles * 8 - r.undos * 2)) : Math.round((r.cleared / Math.max(1, r.total)) * 25 * PAY[level])),
  start: (host) => new TripleSession(host),
});
