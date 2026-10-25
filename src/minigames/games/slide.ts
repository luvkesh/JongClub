// Mahjong Slide: two matching tiles go when they face each other along a row
// or column with nothing between. Tap a tile, then an empty place in line with
// it, to slide it there, pushing the tiles in front along; a slide only stays
// if it lines the tile up with its match, which then clears at once.

import * as THREE from 'three';
import { tr } from '../../i18n';
import { registerMiniGame } from '../registry';
import { FLAT } from '../board';
import { GameClock, matchGroup, pairsFromSet } from '../helpers';
import type { MiniHost, MiniLevel, MiniSession } from '../types';

const GRID: Record<MiniLevel, [number, number, number]> = { easy: [6, 6, 24], medium: [8, 7, 40], hard: [9, 8, 56] };
const PAY: Record<MiniLevel, number> = { easy: 1, medium: 1.5, hard: 2.2 };

/** Pure rules, kept apart for tests. */
export class SlideBoard {
  constructor(
    readonly w: number,
    readonly h: number,
    /** Tile id per cell, -1 empty. */
    public cells: number[],
    readonly kinds: number[],
  ) {}
  at(x: number, y: number) {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? -2 : this.cells[y * this.w + x];
  }
  /** The tile id faced along a line from (x, y) in direction (dx, dy), skipping empty cells. */
  faced(x: number, y: number, dx: number, dy: number): number {
    for (let cx = x + dx, cy = y + dy; ; cx += dx, cy += dy) {
      const v = this.at(cx, cy);
      if (v === -2) return -1;
      if (v >= 0) return v;
    }
  }
  pos(id: number) {
    const i = this.cells.indexOf(id);
    return { x: i % this.w, y: Math.floor(i / this.w) };
  }
  /** A match for tile id facing it directly, or -1. */
  matchFor(id: number): number {
    const { x, y } = this.pos(id);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const t = this.faced(x, y, dx, dy);
      if (t >= 0 && matchGroup(this.kinds[t]) === matchGroup(this.kinds[id])) return t;
    }
    return -1;
  }
  canPair(a: number, b: number) {
    if (a === b || matchGroup(this.kinds[a]) !== matchGroup(this.kinds[b])) return false;
    const p = this.pos(a),
      q = this.pos(b);
    if (p.x !== q.x && p.y !== q.y) return false;
    const dx = Math.sign(q.x - p.x),
      dy = Math.sign(q.y - p.y);
    return this.faced(p.x, p.y, dx, dy) === b;
  }
  /**
   * Slide tile `id` toward (tx, ty), an empty cell in line with it, pushing
   * the tiles in front. Returns the new cells, or null if it cannot go there.
   */
  slide(id: number, tx: number, ty: number): number[] | null {
    const p = this.pos(id);
    if ((p.x !== tx && p.y !== ty) || (p.x === tx && p.y === ty)) return null;
    const dx = Math.sign(tx - p.x),
      dy = Math.sign(ty - p.y);
    const steps = Math.abs(tx - p.x) + Math.abs(ty - p.y);
    // The chain: this tile and every tile touching it in front.
    const chain: { x: number; y: number }[] = [];
    let cx = p.x,
      cy = p.y;
    while (this.at(cx, cy) >= 0) {
      chain.push({ x: cx, y: cy });
      cx += dx;
      cy += dy;
    }
    // Room in front of the chain for `steps` moves?
    let room = 0;
    for (let ex = cx, ey = cy; this.at(ex, ey) === -1; ex += dx, ey += dy) room++;
    // Gaps further on let the chain gather more tiles; keep it simple: only empty room straight ahead counts.
    if (room < steps) return null;
    const next = [...this.cells];
    for (const c of chain) next[c.y * this.w + c.x] = -1;
    for (const c of chain) next[(c.y + dy * steps) * this.w + (c.x + dx * steps)] = this.cells[c.y * this.w + c.x];
    return next;
  }
  /** Any pair facing each other now. */
  pairs(): [number, number][] {
    const out: [number, number][] = [];
    for (const id of this.cells) {
      if (id < 0) continue;
      const m = this.matchFor(id);
      if (m > id) out.push([id, m]);
    }
    return out;
  }
  /** A slide that lines up a pair: [tile, target cell] or null. */
  slideMove(): [number, number, number] | null {
    for (const id of this.cells) {
      if (id < 0) continue;
      const p = this.pos(id);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        for (let s = 1; s < Math.max(this.w, this.h); s++) {
          const tx = p.x + dx * s,
            ty = p.y + dy * s;
          if (this.at(tx, ty) === -2) break;
          const next = this.slide(id, tx, ty);
          if (!next) break;
          const b = new SlideBoard(this.w, this.h, next, this.kinds);
          if (b.matchFor(id) >= 0) return [id, tx, ty];
        }
      }
    }
    return null;
  }
}

class SlideSession implements MiniSession {
  private g: SlideBoard;
  private sel: number | null = null;
  private clock = new GameClock();
  private score = 0;
  private moves = 0;
  private ended = false;
  private history: number[][] = [];
  private total: number;
  private hints: number;
  private hintIds: number[] = [];
  private ghosts: THREE.Group = new THREE.Group();
  private ghostMat = new THREE.MeshBasicMaterial({ color: '#ead09a', transparent: true, opacity: 0.22, depthWrite: false });

  constructor(private host: MiniHost) {
    const [w, h, n] = GRID[host.level];
    const pairs = pairsFromSet(n / 2, host.rng);
    const kinds = pairs.flatMap(([a, b]) => [a, b]);
    // Scatter the tiles over the grid, leaving gaps to slide into.
    const cells = Array(w * h).fill(-1);
    const spots = host.rng.shuffle(Array.from({ length: w * h }, (_, i) => i)).slice(0, n);
    spots.forEach((c, id) => (cells[c] = id));
    this.g = new SlideBoard(w, h, cells, kinds);
    this.total = n;
    this.hints = host.level === 'easy' ? Infinity : host.level === 'medium' ? 5 : 3;
    host.board.root.add(this.ghosts);
    host.camera.home = { yaw: 0, pitch: 72 };
    host.camera.reset();
    host.board.build(kinds.map((kind, id) => ({ id, kind, pos: this.world(this.g.pos(id).x, this.g.pos(id).y), quat: FLAT })));
    this.buildGrid();
    host.fit(true);
    this.refresh();
  }

  private world(x: number, y: number) {
    const b = this.host.board;
    return new THREE.Vector3((x - (this.g.w - 1) / 2) * (b.w + 0.03), b.d / 2, (y - (this.g.h - 1) / 2) * (b.h + 0.03));
  }

  /** Faint brass squares mark every place on the grid, and catch taps on empty places. */
  private cellsMesh: THREE.InstancedMesh | null = null;
  private buildGrid() {
    const b = this.host.board;
    const geo = new THREE.BoxGeometry(b.w, 0.004, b.h);
    const mat = new THREE.MeshStandardMaterial({ color: '#c9a46a', metalness: 0.6, roughness: 0.5, transparent: true, opacity: 0.16 });
    const m = new THREE.InstancedMesh(geo, mat, this.g.w * this.g.h);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < this.g.w * this.g.h; i++) {
      const p = this.world(i % this.g.w, Math.floor(i / this.g.w));
      m4.makeTranslation(p.x, 0.003, p.z);
      m.setMatrixAt(i, m4);
    }
    this.cellsMesh = m;
    this.host.board.root.add(m);
  }

  /** Taps on the felt between tiles: the play shell sends tile taps only, so the session listens for empty places itself. */
  pickCell(x: number, y: number, camera: THREE.Camera, el: HTMLElement): number | null {
    if (!this.cellsMesh) return null;
    const r = el.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObject(this.cellsMesh)[0];
    return hit?.instanceId ?? null;
  }

  private refresh() {
    this.host.board.looks((id) => (id === this.sel ? 'selected' : this.hintIds.includes(id) ? 'hint' : 'normal'));
    this.host.setStat('left', String(this.g.cells.filter((c) => c >= 0).length), tr('Tiles'));
    this.host.setStat('moves', String(this.moves), tr('Slides'));
    this.host.setStat('score', String(this.score), tr('Score'));
    this.showTargets();
    this.host.refreshButtons();
  }

  /** With a tile picked, glow the empty places it could slide to. */
  private showTargets() {
    for (const m of [...this.ghosts.children] as THREE.Mesh[]) {
      m.geometry.dispose();
      this.ghosts.remove(m);
    }
    if (this.sel === null) return;
    const p = this.g.pos(this.sel);
    const b = this.host.board;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      for (let s = 1; ; s++) {
        const tx = p.x + dx * s,
          ty = p.y + dy * s;
        if (this.g.at(tx, ty) === -2 || !this.g.slide(this.sel, tx, ty)) break;
        const q = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.92, 0.006, b.h * 0.92), this.ghostMat);
        q.position.copy(this.world(tx, ty)).setY(0.008);
        this.ghosts.add(q);
      }
  }

  /** A slide waiting for its pair to clear: taps wait too. */
  private busy = false;

  onPick(id: number) {
    if (this.ended || this.busy) return;
    if (this.sel !== null && this.sel !== id && this.g.canPair(this.sel, id)) return this.clear(this.sel, id);
    this.sel = this.sel === id ? null : id;
    // A tile already facing its match clears on its own.
    if (this.sel !== null) {
      const m = this.g.matchFor(id);
      if (m >= 0) return this.clear(id, m);
    }
    this.host.sound('click');
    this.refresh();
  }

  onEmptyTap(x: number, y: number, camera: THREE.Camera, el: HTMLElement) {
    const c = this.pickCell(x, y, camera, el);
    if (c !== null) this.onCell(c);
  }

  /** A tap on an empty place: slide the picked tile there. */
  onCell(cell: number) {
    if (this.ended || this.busy || this.sel === null) return;
    if (this.g.cells[cell] >= 0) return this.onPick(this.g.cells[cell]);
    const tx = cell % this.g.w,
      ty = Math.floor(cell / this.g.w);
    const next = this.g.slide(this.sel, tx, ty);
    if (!next) {
      this.host.sound('click');
      return;
    }
    const trial = new SlideBoard(this.g.w, this.g.h, next, this.g.kinds);
    const id = this.sel;
    const m = trial.matchFor(id);
    const b = this.host.board;
    const moved = next.map((v, i) => (v >= 0 && this.g.cells[i] !== v ? v : -1)).filter((v) => v >= 0);
    for (const t of moved) {
      const q = trial.pos(t);
      b.moveTo(t, { pos: this.world(q.x, q.y) }, { dur: 0.22 });
    }
    if (m < 0) {
      // No match lined up: the tiles slide back.
      for (const t of moved) {
        const q = this.g.pos(t);
        b.moveTo(t, { pos: this.world(q.x, q.y) }, { dur: 0.22, delay: 0.12 });
      }
      this.host.toast(tr('A slide stays only when it lines a tile up with its match.'), 'info');
      this.host.sound('slide');
      return;
    }
    this.history.push([...this.g.cells]);
    this.g.cells = next;
    this.moves++;
    this.host.sound('slide');
    this.busy = true;
    window.setTimeout(() => {
      this.busy = false;
      this.clear(id, m, true);
    }, 260);
  }

  private clear(a: number, b: number, slid = false) {
    if (!slid) this.history.push([...this.g.cells]);
    const bd = this.host.board;
    const mid = bd.pose(a)!.pos.add(bd.pose(b)!.pos).multiplyScalar(0.5);
    this.g.cells = this.g.cells.map((v) => (v === a || v === b ? -1 : v));
    bd.remove(a, { to: mid });
    bd.remove(b, { to: mid });
    window.setTimeout(() => this.host.burst(mid.clone().setY(0.3)), 300);
    this.score += slid ? 15 : 10;
    this.sel = null;
    this.hintIds = [];
    this.host.sound('pung');
    if (!this.g.cells.some((c) => c >= 0)) window.setTimeout(() => this.win(), 700);
    else if (!this.g.pairs().length && !this.g.slideMove()) {
      this.stuck = true;
      if (this.shuffles > 0) this.host.toast(tr('No more moves. Shuffle the tiles to carry on.'), 'bad');
      else window.setTimeout(() => this.lose(), 900);
    }
    this.refresh();
  }

  suggest(): number[] | null {
    if (this.ended || this.busy) return [];
    const p = this.g.pairs()[0];
    if (p) return [...p];
    const s = this.g.slideMove();
    return s ? [s[0]] : null;
  }

  hint() {
    if (this.ended || this.hints <= 0) return false;
    const p = this.g.pairs()[0];
    if (p) this.hintIds = [...p];
    else {
      const s = this.g.slideMove();
      if (!s) return false;
      this.hintIds = [s[0]];
      this.sel = s[0];
    }
    this.hints--;
    this.score = Math.max(0, this.score - 5);
    this.refresh();
    window.setTimeout(() => {
      this.hintIds = [];
      if (!this.ended) this.refresh();
    }, 2600);
    return true;
  }
  canUse(tool: 'hint' | 'shuffle') {
    return !this.ended && (tool === 'hint' ? this.hints > 0 : this.shuffles > 0);
  }
  badges() {
    const n = (v: number) => (Number.isFinite(v) ? String(v) : undefined);
    return { hint: n(this.hints), shuffle: n(this.shuffles) };
  }
  attention() {
    return this.stuck && this.shuffles > 0 ? ('shuffle' as const) : null;
  }
  private shuffles = this.host.level === 'easy' ? Infinity : this.host.level === 'medium' ? 2 : 1;
  private stuck = false;

  /** Scatter the tiles left over the grid again. */
  shuffle() {
    if (this.ended || this.shuffles <= 0) return false;
    const ids = this.g.cells.filter((c) => c >= 0);
    const spots = this.host.rng.shuffle(Array.from({ length: this.g.w * this.g.h }, (_, i) => i)).slice(0, ids.length);
    const next = Array(this.g.w * this.g.h).fill(-1);
    ids.forEach((id, n) => (next[spots[n]] = id));
    this.history.push([...this.g.cells]);
    this.g.cells = next;
    ids.forEach((id, n) => this.host.board.moveTo(id, { pos: this.world(spots[n] % this.g.w, Math.floor(spots[n] / this.g.w)) }, { dur: 0.5, arc: 0.4, delay: n * 0.01 }));
    this.shuffles--;
    this.sel = null;
    this.stuck = false;
    this.host.sound('shuffle');
    this.refresh();
    return true;
  }
  canUndo() {
    return !this.ended && this.history.length > 0;
  }
  undo() {
    const prev = this.history.pop();
    if (!prev) return false;
    const bd = this.host.board;
    const was = new Set(this.g.cells.filter((c) => c >= 0));
    this.g.cells = prev;
    prev.forEach((id, i) => {
      if (id < 0) return;
      const pos = this.world(i % this.g.w, Math.floor(i / this.g.w));
      if (!was.has(id)) bd.restore(id, { pos, quat: FLAT, scale: 1 });
      else bd.moveTo(id, { pos }, { dur: 0.22 });
    });
    this.sel = null;
    this.score = Math.max(0, this.score - 10);
    this.host.sound('slide');
    this.refresh();
    return true;
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
    const bonus = Math.max(0, Math.round(this.total * 3 - this.clock.elapsed));
    this.score += bonus;
    this.host.finish({ won: true, score: this.score, seconds: this.clock.elapsed, cleared: this.total, total: this.total, notes: [tr('{n} slides', { n: this.moves }), ...(bonus ? [tr('Time bonus +{n}', { n: bonus })] : [])] });
  }
  private lose() {
    if (this.ended) return;
    this.ended = true;
    this.host.finish({ won: false, score: this.score, seconds: this.clock.elapsed, cleared: this.total - this.g.cells.filter((c) => c >= 0).length, total: this.total, notes: [tr('No more moves')] });
  }
  dispose() {
    this.ended = true;
    this.ghosts.removeFromParent();
    this.cellsMesh?.removeFromParent();
    this.cellsMesh?.dispose();
  }
}

registerMiniGame({
  id: 'slide',
  title: tr('Mahjong Slide'),
  blurb: tr('Slide tiles along their row or column to line them up with their match.'),
  minutes: tr('1–5 min'),
  order: 45,
  icon: { kinds: [14, 30, 14, 3, 30, 12], shape: 'grid' },
  levels: ['easy', 'medium', 'hard'],
  howTo: [
    tr('Two matching tiles clear when they face each other along a row or column with nothing between.'),
    tr('Tap a tile, then a glowing empty place, to slide it there. Tiles in front of it are pushed along.'),
    tr('A slide only stays when it lines the tile up with its match.'),
  ],
  tools: { hint: true, undo: true, shuffle: true },
  reward: (r, level) => (r.won ? Math.max(20, Math.round((40 + r.total) * PAY[level] - r.hints * 4 - r.undos * 2 - r.shuffles * 8)) : Math.round((r.cleared / Math.max(1, r.total)) * 25 * PAY[level])),
  start: (host) => new SlideSession(host),
});
