// 3D Mahjong Dimensions: a block of tile cubes on your table. Turn it (drag,
// or the turn buttons) to find free matching pairs; a cube is free when two
// of its sides that share an edge are open. Against the clock from Medium up,
// with seconds back for every pair.

import * as THREE from 'three';
import { tr } from '../../i18n';
import { registerMiniGame } from '../registry';
import { GameClock, freeLook } from '../helpers';
import type { MiniHost, MiniLevel, MiniSession } from '../types';
import { Dimensions, boxShape, dealDimensions, stepShape, type Block } from './dimensions/logic';

const SHAPES: Record<string, (level: MiniLevel) => Block[]> = {
  cube: (l) => (l === 'easy' ? boxShape(4, 2, 4) : l === 'medium' ? boxShape(4, 4, 4) : boxShape(5, 4, 5, true)),
  tower: (l) => (l === 'easy' ? boxShape(2, 6, 2) : l === 'medium' ? boxShape(3, 6, 2) : boxShape(3, 8, 3, true).slice(0, 64)),
  steps: (l) => (l === 'easy' ? stepShape(4, 2) : l === 'medium' ? stepShape(6, 3) : stepShape(7, 4)),
};
const CLOCK: Record<MiniLevel, number> = { easy: 0, medium: 240, hard: 200 };
const PAY: Record<MiniLevel, number> = { easy: 1, medium: 1.6, hard: 2.3 };

class DimensionsSession implements MiniSession {
  private g: Dimensions;
  private sel: number | null = null;
  private clock: GameClock;
  private score = 0;
  private combo = 0;
  private bestCombo = 0;
  private lastPair = -99;
  private hints: number;
  private ended = false;
  private hintPair: [number, number] | null = null;
  private center: THREE.Vector3;

  constructor(private host: MiniHost) {
    let blocks = (SHAPES[host.options.shape] ?? SHAPES.cube)(host.level);
    if (blocks.length % 2) blocks = blocks.slice(0, -1);
    this.g = new Dimensions(blocks, dealDimensions(blocks, host.rng));
    this.clock = new GameClock(CLOCK[host.level]);
    this.hints = host.level === 'easy' ? Infinity : host.level === 'medium' ? 4 : 2;
    const xs = blocks.map((b) => b.x),
      zs = blocks.map((b) => b.z);
    this.center = new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2);
    host.camera.home = { yaw: 35, pitch: 28 };
    host.camera.reset();
    host.board.build(blocks.map((b, i) => ({ id: i, kind: this.g.kinds[i], pos: this.world(b), quat: new THREE.Quaternion() })));
    host.fit(true);
    this.refresh();
  }

  private world(b: Block) {
    const c = this.host.board.w + 0.012;
    return new THREE.Vector3((b.x - this.center.x) * c, c / 2 + b.y * c + 0.002, (b.z - this.center.z) * c);
  }

  private refresh() {
    const free = new Set(this.g.free());
    this.host.board.looks((id) => (id === this.sel ? 'selected' : this.hintPair?.includes(id) ? 'hint' : freeLook(free.has(id))));
    this.host.setStat('left', String(this.g.left), tr('Blocks'));
    this.host.setStat('score', String(this.score), tr('Score'));
    this.host.setStat('moves', String(this.g.pairs().length), tr('Moves'));
    this.host.setStat('combo', this.combo > 1 ? `×${this.combo}` : null, tr('Combo'));
    this.host.refreshButtons();
  }

  onPick(id: number) {
    if (this.ended || !this.g.alive[id]) return;
    if (!this.g.isFree(id)) {
      this.host.board.shake(id);
      this.host.toast(tr('That block is held in: it needs two open sides that meet.'), 'info');
      this.host.sound('click');
      return;
    }
    if (this.sel === null || this.sel === id) {
      this.sel = this.sel === id ? null : id;
      this.host.sound('click');
      return this.refresh();
    }
    if (this.g.canMatch(this.sel, id)) {
      const a = this.sel;
      this.g.remove(a, id);
      this.sel = null;
      this.hintPair = null;
      const b = this.host.board;
      const mid = b.pose(a)!.pos.add(b.pose(id)!.pos).multiplyScalar(0.5);
      b.remove(a, { to: mid });
      b.remove(id, { to: mid });
      window.setTimeout(() => this.host.burst(mid.clone().setY(mid.y + 0.3)), 380);
      const t = this.clock.elapsed;
      this.combo = t - this.lastPair <= 4 ? this.combo + 1 : 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.lastPair = t;
      this.score += 10 + 5 * (this.combo - 1);
      if (this.clock.limit) this.clock.add(2);
      this.host.sound(this.combo > 2 ? 'kong' : 'pung');
      if (this.g.left === 0) {
        this.refresh();
        window.setTimeout(() => this.win(), 600);
        return;
      }
      // Frame what is left as the block shrinks.
      window.setTimeout(() => !this.ended && this.host.fit(), 500);
      if (!this.g.pairs().length) window.setTimeout(() => this.lose(tr('No more moves')), 900);
      return this.refresh();
    }
    this.sel = id;
    this.host.sound('click');
    this.refresh();
  }

  suggest(): number[] | null {
    if (this.ended) return [];
    const p = this.g.pairs();
    return p.length ? [...p[this.host.rng.int(p.length)]] : null;
  }

  hint(): boolean {
    if (this.ended || this.hints <= 0) return false;
    const p = this.g.pairs();
    if (!p.length) return false;
    this.hintPair = p[this.host.rng.int(p.length)];
    this.hints--;
    this.score = Math.max(0, this.score - 5);
    this.refresh();
    window.setTimeout(() => {
      this.hintPair = null;
      if (!this.ended) this.refresh();
    }, 2800);
    return true;
  }
  canUse(tool: 'hint' | 'shuffle') {
    return !this.ended && tool === 'hint' && this.hints > 0;
  }
  badges() {
    return { hint: Number.isFinite(this.hints) ? String(this.hints) : undefined };
  }
  canUndo() {
    return !this.ended && this.g.history.length > 0;
  }
  undo() {
    const m = this.g.undo();
    if (!m) return false;
    for (const id of m) this.host.board.restore(id, { pos: this.world(this.g.blocks[id]), quat: new THREE.Quaternion(), scale: 1 });
    this.score = Math.max(0, this.score - 10);
    this.combo = 0;
    this.sel = null;
    this.host.sound('slide');
    this.refresh();
    return true;
  }
  tick(dt: number) {
    if (this.ended) return;
    this.clock.tick(dt);
    if (this.combo && this.clock.elapsed - this.lastPair > 4) {
      this.combo = 0;
      this.host.setStat('combo', null);
    }
    this.host.setStat('time', this.clock.text(), this.clock.limit ? tr('Left') : tr('Time'));
    if (this.clock.over) this.lose(tr("Time's up"));
  }
  pause(p: boolean) {
    this.clock.paused = p;
  }
  variant() {
    return this.host.options.shape ?? 'cube';
  }
  private win() {
    if (this.ended) return;
    this.ended = true;
    const bonus = this.clock.limit ? Math.round(this.clock.left * 2) : Math.max(0, Math.round(this.g.n * 3 - this.clock.elapsed));
    this.score += bonus;
    this.host.finish({ won: true, score: this.score, seconds: this.clock.elapsed, cleared: this.g.n, total: this.g.n, notes: [...(bonus ? [tr('Time bonus +{n}', { n: bonus })] : []), ...(this.bestCombo > 1 ? [tr('Longest combo ×{n}', { n: this.bestCombo })] : [])] });
  }
  private lose(why: string) {
    if (this.ended) return;
    this.ended = true;
    this.host.finish({ won: false, score: this.score, seconds: this.clock.elapsed, cleared: this.g.n - this.g.left, total: this.g.n, notes: [why] });
  }
  dispose() {
    this.ended = true;
  }
}

registerMiniGame({
  id: 'dimensions',
  layered: true,
  title: tr('3D Mahjong Dimensions'),
  blurb: tr('Turn a block of tile cubes to find free matching pairs on its sides.'),
  minutes: tr('1–5 min'),
  order: 30,
  icon: { kinds: [31, 13, 27, 31, 4, 22, 33, 13], shape: 'cube' },
  levels: ['easy', 'medium', 'hard'],
  shape: 'cube',
  options: [{ id: 'shape', label: tr('Shape'), initial: 'cube', choices: [{ id: 'cube', label: tr('Cube') }, { id: 'tower', label: tr('Tower') }, { id: 'steps', label: tr('Steps') }] }],
  howTo: [
    tr('Every cube shows its tile on all six sides. Match two free cubes to clear them.'),
    tr('A cube is free when two of its sides that meet at an edge are open.'),
    tr('Drag or use the turn buttons to look round the block. Medium and Hard run against the clock.'),
  ],
  tools: { hint: true, undo: true },
  daily: true,
  reward: (r, level) => (r.won ? Math.round((40 + r.total) * PAY[level] - r.hints * 4 - r.undos) : Math.round((r.cleared / Math.max(1, r.total)) * 25 * PAY[level])),
  start: (host) => new DimensionsSession(host),
});
