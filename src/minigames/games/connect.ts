// Mahjong Connect (and Mahjong Cascade, the same game with gravity): match
// tiles a path of up to two turns can join. The path lights up in gold over
// the felt as the pair goes.

import * as THREE from 'three';
import { tr } from '../../i18n';
import { registerMiniGame } from '../registry';
import { FLAT } from '../board';
import { GameClock, matchGroup } from '../helpers';
import type { MiniHost, MiniLevel, MiniResult, MiniSession } from '../types';
import { Connect, dealConnect, type Cell, type Gravity } from './connect/logic';

const SIZES: Record<MiniLevel, [number, number]> = { easy: [10, 6], medium: [12, 7], hard: [14, 8] };
const CLOCK: Record<MiniLevel, number> = { easy: 0, medium: 300, hard: 240 };
const SHUFFLES: Record<MiniLevel, number> = { easy: Infinity, medium: 3, hard: 2 };
const HINTS: Record<MiniLevel, number> = { easy: Infinity, medium: 5, hard: 3 };
const LEVEL_PAY: Record<MiniLevel, number> = { easy: 1, medium: 1.5, hard: 2.2 };

class ConnectSession implements MiniSession {
  private g: Connect;
  /** Board tile id in each cell (-1 empty); ids follow tiles when gravity moves them. */
  private idAt: number[];
  private sel: number | null = null;
  private clock: GameClock;
  private score = 0;
  private combo = 0;
  private bestCombo = 0;
  private lastPair = -99;
  private hints: number;
  private shuffles: number;
  private ended = false;
  private hintPair: [number, number] | null = null;
  private lines: THREE.Group;
  private lineMat = new THREE.MeshStandardMaterial({ color: '#f3d48a', emissive: '#c79a3c', emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.3, transparent: true });
  private fade = 0;
  private total: number;
  private stuck = false;

  constructor(
    private host: MiniHost,
    gravity: Gravity,
  ) {
    const [w, h] = SIZES[host.level];
    this.g = new Connect(w, h, dealConnect(w, h, host.rng, gravity), gravity);
    this.total = w * h;
    this.clock = new GameClock(CLOCK[host.level]);
    this.hints = HINTS[host.level];
    this.shuffles = SHUFFLES[host.level];
    this.idAt = this.g.cells.map((_, i) => i);
    this.lines = new THREE.Group();
    host.board.root.add(this.lines);
    host.camera.home = { yaw: 0, pitch: 72 };
    host.camera.reset();
    host.board.build(this.g.cells.map((kind, i) => ({ id: i, kind, pos: this.world(i % w, Math.floor(i / w)), quat: FLAT })));
    host.fit(true);
    this.ensureMoves();
    this.refresh();
  }

  private world(x: number, y: number, lift = 0) {
    const b = this.host.board;
    return new THREE.Vector3((x - (this.g.w - 1) / 2) * (b.w + 0.02), b.d / 2 + lift, (y - (this.g.h - 1) / 2) * (b.h + 0.02));
  }

  private refresh() {
    const b = this.host.board;
    b.looks((id) => {
      const cell = this.idAt.indexOf(id);
      if (cell === this.sel) return 'selected';
      if (this.hintPair?.includes(cell)) return 'hint';
      return 'normal';
    });
    this.host.setStat('left', String(this.g.left), tr('Tiles'));
    this.host.setStat('score', String(this.score), tr('Score'));
    this.host.setStat('combo', this.combo > 1 ? `×${this.combo}` : null, tr('Combo'));
    this.host.refreshButtons();
  }

  onPick(id: number) {
    if (this.ended) return;
    const cell = this.idAt.indexOf(id);
    if (cell < 0) return;
    if (this.sel === null || this.sel === cell) {
      this.sel = this.sel === cell ? null : cell;
      this.host.sound('click');
      this.refresh();
      return;
    }
    const a = this.sel;
    if (this.g.canMatch(a, cell)) {
      this.take(a, cell);
      return;
    }
    // Matching tiles with no clear path: say why.
    if (matchGroup(this.g.cells[a]) === matchGroup(this.g.cells[cell])) this.host.toast(tr('No clear path with two turns or fewer.'), 'bad');
    this.sel = cell;
    this.host.sound('click');
    this.refresh();
  }

  private take(a: number, b: number) {
    const path = this.g.path(a, b)!;
    this.drawPath(path);
    const ida = this.idAt[a],
      idb = this.idAt[b];
    const moves = this.g.remove(a, b);
    this.idAt[a] = this.idAt[b] = -1;
    const board = this.host.board;
    board.remove(ida, { delay: 0.18 });
    board.remove(idb, { delay: 0.18 });
    // Gravity: tiles slide into the gaps.
    if (moves.length) {
      const ids = moves.map(([from]) => this.idAt[from]);
      moves.forEach(([from]) => (this.idAt[from] = -1));
      moves.forEach(([, to], n) => {
        this.idAt[to] = ids[n];
        board.moveTo(ids[n], { pos: this.world(to % this.g.w, Math.floor(to / this.g.w)) }, { dur: 0.3, delay: 0.42 });
      });
    }
    const mid = this.world((a % this.g.w + (b % this.g.w)) / 2, (Math.floor(a / this.g.w) + Math.floor(b / this.g.w)) / 2, 0.2);
    window.setTimeout(() => this.host.burst(mid), 350);
    this.sel = null;
    this.hintPair = null;
    const t = this.clock.elapsed;
    this.combo = t - this.lastPair <= 3.5 ? this.combo + 1 : 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.lastPair = t;
    this.score += 10 + 5 * (this.combo - 1);
    this.host.sound(this.combo > 2 ? 'kong' : 'pung');
    if (this.combo > 2) this.host.toast(tr('Combo ×{n}', { n: this.combo }), 'good');
    if (this.g.left === 0) {
      this.refresh();
      window.setTimeout(() => this.win(), 600);
      return;
    }
    this.ensureMoves();
    this.refresh();
  }

  /** No moves left: offer a shuffle (or end the game when none are left). */
  private ensureMoves() {
    this.stuck = this.g.pairs(1).length === 0;
    if (!this.stuck) return;
    if (this.shuffles > 0) this.host.toast(tr('No more moves. Shuffle the tiles to carry on.'), 'bad');
    else window.setTimeout(() => this.lose(tr('No more moves')), 900);
  }

  private drawPath(path: Cell[]) {
    this.clearPath();
    const y = this.host.board.d + 0.05;
    for (let i = 0; i + 1 < path.length; i++) {
      const p = this.world(path[i].x, path[i].y),
        q = this.world(path[i + 1].x, path[i + 1].y);
      p.y = q.y = y;
      const len = p.distanceTo(q);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, len + 0.035), this.lineMat);
      bar.position.copy(p).add(q).multiplyScalar(0.5);
      bar.lookAt(q.x, y, q.z);
      this.lines.add(bar);
    }
    for (const c of [path[0], path[path.length - 1]]) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), this.lineMat);
      dot.position.copy(this.world(c.x, c.y)).setY(y);
      this.lines.add(dot);
    }
    this.lineMat.opacity = 1;
    this.fade = 0.7;
  }
  private clearPath() {
    for (const m of [...this.lines.children] as THREE.Mesh[]) {
      m.geometry.dispose();
      this.lines.remove(m);
    }
  }

  suggest(): number[] | null {
    if (this.ended) return [];
    const p = this.g.pairs(8);
    if (!p.length) return null;
    return p[this.host.rng.int(p.length)].map((c) => this.idAt[c]).filter((id) => id >= 0);
  }

  hint(): boolean {
    if (this.ended || this.hints <= 0) return false;
    const pairs = this.g.pairs(8);
    if (!pairs.length) return false;
    this.hintPair = pairs[this.host.rng.int(pairs.length)];
    this.hints--;
    this.score = Math.max(0, this.score - 5);
    this.refresh();
    window.setTimeout(() => {
      this.hintPair = null;
      if (!this.ended) this.refresh();
    }, 2600);
    return true;
  }

  canUse(tool: 'hint' | 'shuffle') {
    if (this.ended) return false;
    return tool === 'hint' ? this.hints > 0 && !this.stuck : this.shuffles > 0;
  }

  badges() {
    const n = (v: number) => (Number.isFinite(v) ? String(v) : undefined);
    return { hint: n(this.hints), shuffle: n(this.shuffles) };
  }
  attention() {
    return this.stuck && this.shuffles > 0 ? ('shuffle' as const) : null;
  }

  shuffle(): boolean {
    if (this.ended || this.shuffles <= 0) return false;
    // Tiles keep their ids; the shuffle hands kinds round, so rebuild the board in place with a toss.
    if (!this.g.shuffle(this.host.rng)) return false;
    this.shuffles--;
    this.rebuild(true);
    this.host.sound('shuffle');
    this.stuck = false;
    this.refresh();
    return true;
  }

  canUndo() {
    return !this.ended && this.g.history.length > 0;
  }
  undo(): boolean {
    if (!this.canUndo()) return false;
    this.g.undo();
    this.rebuild(false);
    this.score = Math.max(0, this.score - 10);
    this.combo = 0;
    this.sel = null;
    this.stuck = this.g.pairs(1).length === 0;
    this.host.sound('slide');
    this.refresh();
    return true;
  }

  /** Lay the board out again from the cells (after a shuffle or undo). */
  private rebuild(toss: boolean) {
    const b = this.host.board;
    const w = this.g.w;
    const specs = this.g.cells.map((kind, i) => ({ id: i, kind, pos: this.world(i % w, Math.floor(i / w), toss ? 0.8 : 0), quat: FLAT })).filter((s) => s.kind >= 0);
    b.build(specs);
    this.idAt = this.g.cells.map((k, i) => (k >= 0 ? i : -1));
    if (toss) for (const s of specs) b.moveTo(s.id, { pos: this.world(s.id % w, Math.floor(s.id / w)) }, { dur: 0.35, delay: (s.id % 13) * 0.015 });
  }

  tick(dt: number) {
    if (this.ended) return;
    this.clock.tick(dt);
    if (this.fade > 0) {
      this.fade -= dt;
      this.lineMat.opacity = Math.max(0, Math.min(1, this.fade / 0.3));
      if (this.fade <= 0) this.clearPath();
    }
    if (this.combo && this.clock.elapsed - this.lastPair > 3.5) {
      this.combo = 0;
      this.host.setStat('combo', null);
    }
    this.host.setStat('time', this.clock.text(), this.clock.limit ? tr('Left') : tr('Time'));
    if (this.clock.over) this.lose(tr("Time's up"));
  }
  pause(p: boolean) {
    this.clock.paused = p;
  }

  private win() {
    if (this.ended) return;
    this.ended = true;
    const bonus = this.clock.limit ? Math.round(this.clock.left) : Math.max(0, Math.round(this.total * 2.5 - this.clock.elapsed));
    this.score += bonus;
    this.host.finish({ won: true, score: this.score, seconds: this.clock.elapsed, cleared: this.total, total: this.total, notes: [...(bonus ? [tr('Time bonus +{n}', { n: bonus })] : []), ...(this.bestCombo > 1 ? [tr('Longest combo ×{n}', { n: this.bestCombo })] : [])] });
  }
  private lose(why: string) {
    if (this.ended) return;
    this.ended = true;
    this.host.finish({ won: false, score: this.score, seconds: this.clock.elapsed, cleared: this.total - this.g.left, total: this.total, notes: [why] });
  }
  dispose() {
    this.ended = true;
    this.clearPath();
    this.lines.removeFromParent();
    this.lineMat.dispose();
  }
}

function reward(r: MiniResult, level: MiniLevel) {
  if (!r.won) return Math.round((r.cleared / Math.max(1, r.total)) * 25 * LEVEL_PAY[level]);
  return Math.max(20, Math.round((40 + r.total * 0.9) * LEVEL_PAY[level] - r.hints * 4 - r.shuffles * 8 - r.undos));
}

registerMiniGame({
  id: 'connect',
  title: tr('Mahjong Connect'),
  blurb: tr('Join matching tiles with a path of no more than two turns.'),
  minutes: tr('1–5 min'),
  order: 20,
  icon: { kinds: [33, 9, 33, 22, 18, 9], shape: 'path' },
  levels: ['easy', 'medium', 'hard'],
  howTo: [
    tr('Tap two matching tiles that a path of up to three straight lines can join.'),
    tr('The path can run through empty spaces and round the outside of the board.'),
    tr('Clearing tiles opens new paths. Medium and Hard have a clock.'),
  ],
  tools: { hint: true, undo: true, shuffle: true },
  daily: true,
  reward,
  start: (host) => new ConnectSession(host, 'none'),
});

registerMiniGame({
  id: 'cascade',
  title: tr('Mahjong Cascade'),
  blurb: tr('Mahjong Connect with gravity: tiles fall into every gap, setting up chains.'),
  minutes: tr('2–5 min'),
  order: 75,
  icon: { kinds: [24, 24, 31, 5, 31, 14], shape: 'grid' },
  levels: ['medium', 'hard'],
  options: [{ id: 'gravity', label: tr('Tiles fall'), initial: 'down', choices: [{ id: 'down', label: tr('Down') }, { id: 'left', label: tr('To the left') }] }],
  howTo: [tr('Join matching tiles with a path of up to two turns, as in Connect.'), tr('Every pair you clear lets the tiles above fall into the gap.'), tr('Plan ahead: a fall can line up your next pair or bury it.')],
  tools: { hint: true, undo: true, shuffle: true },
  reward: (r, level) => Math.round(reward(r, level) * 1.1),
  start: (host) => new ConnectSession(host, host.options.gravity === 'left' ? 'left' : 'down'),
});
