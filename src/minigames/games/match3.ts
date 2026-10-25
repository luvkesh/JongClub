// Mahjong Match-3: swap two neighbouring tiles to make lines of three or more
// of a kind. Lines clear, the tiles above fall and new ones drop in; chains
// score more. Four in a line leaves a Dragon that clears its whole row and
// column when matched; five clears every tile of that kind.

import * as THREE from 'three';
import { tr } from '../../i18n';
import { registerMiniGame } from '../registry';
import { FLAT } from '../board';
import type { Rng } from '../../engine/rng';
import type { MiniHost, MiniLevel, MiniSession } from '../types';

const SIZE = 7;
/** Tile kinds in play: a suit run plus winds and dragons, so faces read apart at a glance. */
const POOL = [0, 13, 22, 27, 31, 32, 33, 4];
const SETUP: Record<MiniLevel, { kinds: number; moves: number; target: number }> = {
  easy: { kinds: 5, moves: 25, target: 1500 },
  medium: { kinds: 6, moves: 22, target: 2400 },
  hard: { kinds: 7, moves: 20, target: 3400 },
};
const PAY: Record<MiniLevel, number> = { easy: 1, medium: 1.5, hard: 2.2 };

/** Pure rules for tests: a grid of kinds (row major), -1 empty. */
export class Match3 {
  constructor(
    readonly n: number,
    public cells: number[],
    private kinds: number[],
    private rng: Rng,
  ) {}
  at(x: number, y: number) {
    return x < 0 || y < 0 || x >= this.n || y >= this.n ? -9 : this.cells[y * this.n + x];
  }
  /** Cells in lines of three or more. */
  lines(): { cells: number[]; len: number }[] {
    const out: { cells: number[]; len: number }[] = [];
    const n = this.n;
    for (const horiz of [true, false])
      for (let a = 0; a < n; a++) {
        let run: number[] = [];
        for (let b = 0; b <= n; b++) {
          const x = horiz ? b : a,
            y = horiz ? a : b;
          const k = b < n ? this.at(x, y) : -9;
          if (run.length && k >= 0 && k === this.cells[run[0]]) run.push(y * n + x);
          else {
            if (run.length >= 3) out.push({ cells: run, len: run.length });
            run = k >= 0 ? [y * n + x] : [];
          }
        }
      }
    return out;
  }
  swapped(a: number, b: number) {
    const c = [...this.cells];
    [c[a], c[b]] = [c[b], c[a]];
    return c;
  }
  /** A swap that makes a line, or null. */
  findMove(): [number, number] | null {
    const n = this.n;
    for (let i = 0; i < n * n; i++)
      for (const j of [i + 1, i + n]) {
        if (j >= n * n || (j === i + 1 && j % n === 0)) continue;
        const m = new Match3(n, this.swapped(i, j), this.kinds, this.rng);
        if (m.lines().length) return [i, j];
      }
    return null;
  }
  random() {
    return this.kinds[this.rng.int(this.kinds.length)];
  }
  /** Fill the board with no lines already made and at least one move. */
  fill() {
    do {
      for (let i = 0; i < this.n * this.n; i++) {
        let k: number;
        do k = this.random();
        while ((i % this.n >= 2 && this.cells[i - 1] === k && this.cells[i - 2] === k) || (i >= 2 * this.n && this.cells[i - this.n] === k && this.cells[i - 2 * this.n] === k));
        this.cells[i] = k;
      }
    } while (!this.findMove());
  }
}

const DRAGON_TINT = 'hint' as const;

class Match3Session implements MiniSession {
  private g: Match3;
  /** Tile id in each cell. */
  private idAt: number[];
  private sel: number | null = null;
  private score = 0;
  private moves: number;
  private busy = false;
  private ended = false;
  private chainBest = 0;
  /** Cells holding a Dragon (four in a line): matched, it clears its row and column. */
  private dragons = new Set<number>();
  private setup: (typeof SETUP)['easy'];
  private hints: number;
  private hintPair: [number, number] | null = null;

  constructor(private host: MiniHost) {
    this.setup = SETUP[host.level];
    const kinds = host.rng.shuffle([...POOL]).slice(0, this.setup.kinds);
    this.g = new Match3(SIZE, Array(SIZE * SIZE).fill(-1), kinds, host.rng);
    this.g.fill();
    this.moves = this.setup.moves;
    this.hints = host.level === 'easy' ? Infinity : 3;
    this.idAt = this.g.cells.map((_, i) => i);
    host.camera.home = { yaw: 0, pitch: 74 };
    host.camera.reset();
    host.board.build(this.g.cells.map((kind, i) => ({ id: i, kind, pos: this.world(i), quat: FLAT })));
    host.fit(true);
    this.refresh();
  }

  private world(i: number, rowsAbove = 0) {
    const b = this.host.board;
    const x = i % SIZE,
      y = Math.floor(i / SIZE) - rowsAbove;
    return new THREE.Vector3((x - (SIZE - 1) / 2) * (b.w + 0.03), b.d / 2, (y - (SIZE - 1) / 2) * (b.h + 0.03));
  }

  private refresh() {
    this.host.board.looks((id) => {
      const cell = this.idAt.indexOf(id);
      if (cell === this.sel) return 'selected';
      if (this.hintPair?.includes(cell) || this.dragons.has(cell)) return DRAGON_TINT;
      return 'normal';
    });
    this.host.setStat('score', `${this.score.toLocaleString('en-US')} / ${this.setup.target.toLocaleString('en-US')}`, tr('Score'));
    this.host.setStat('moves', String(this.moves), tr('Moves left'));
    this.host.refreshButtons();
  }

  onPick(id: number) {
    if (this.ended || this.busy) return;
    const cell = this.idAt.indexOf(id);
    if (this.sel === null) {
      this.sel = cell;
      this.host.sound('click');
      return this.refresh();
    }
    const a = this.sel;
    const adj = Math.abs(a - cell) === SIZE || (Math.abs(a - cell) === 1 && Math.floor(a / SIZE) === Math.floor(cell / SIZE));
    if (!adj) {
      this.sel = cell === a ? null : cell;
      this.host.sound('click');
      return this.refresh();
    }
    this.sel = null;
    this.hintPair = null;
    void this.swap(a, cell);
  }

  /** Slide a tile toward a neighbour to swap them. */
  onSwipe(id: number, dx: number, dz: number) {
    if (this.ended || this.busy) return;
    const cell = this.idAt.indexOf(id);
    if (cell < 0) return;
    const x = cell % SIZE,
      y = Math.floor(cell / SIZE);
    const [nx, ny] = Math.abs(dx) >= Math.abs(dz) ? [x + Math.sign(dx), y] : [x, y + Math.sign(dz)];
    if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) return;
    this.sel = null;
    this.hintPair = null;
    void this.swap(cell, ny * SIZE + nx);
  }

  private wait(ms: number) {
    return new Promise<void>((r) => window.setTimeout(r, ms));
  }

  private async swap(a: number, b: number) {
    this.busy = true;
    const bd = this.host.board;
    const ia = this.idAt[a],
      ib = this.idAt[b];
    bd.moveTo(ia, { pos: this.world(b) }, { dur: 0.2, arc: 0.08 });
    bd.moveTo(ib, { pos: this.world(a) }, { dur: 0.2 });
    this.host.sound('slide');
    const next = this.g.swapped(a, b);
    const trial = new Match3(SIZE, next, [], this.host.rng);
    if (!trial.lines().length) {
      // No line: they swap back.
      await this.wait(230);
      bd.moveTo(ia, { pos: this.world(a) }, { dur: 0.2 });
      bd.moveTo(ib, { pos: this.world(b) }, { dur: 0.2 });
      await this.wait(220);
      this.busy = false;
      this.refresh();
      return;
    }
    this.g.cells = next;
    [this.idAt[a], this.idAt[b]] = [ib, ia];
    for (const [x, y] of [
      [a, b],
      [b, a],
    ])
      if (this.dragons.has(x)) {
        this.dragons.delete(x);
        this.dragons.add(y);
      }
    this.moves--;
    await this.wait(220);
    await this.resolve(b);
    this.busy = false;
    if (this.score >= this.setup.target) return this.end(true);
    if (this.moves <= 0) return this.end(false);
    if (!this.g.findMove()) {
      this.host.toast(tr('No more swaps: the tiles are dealt again.'), 'info');
      this.reshuffle();
    }
    this.refresh();
  }

  /** Clear lines, drop and refill until the board settles. */
  private async resolve(focus: number) {
    const bd = this.host.board;
    let chain = 0;
    for (;;) {
      const lines = this.g.lines();
      if (!lines.length) break;
      chain++;
      this.chainBest = Math.max(this.chainBest, chain);
      const clear = new Set<number>();
      const newDragons: number[] = [];
      for (const l of lines) {
        for (const c of l.cells) clear.add(c);
        if (l.len === 4) newDragons.push(l.cells.includes(focus) ? focus : l.cells[1]);
        if (l.len >= 5) {
          // Five in a line clears every tile of that kind.
          const k = this.g.cells[l.cells[0]];
          this.g.cells.forEach((v, i) => v === k && clear.add(i));
          this.host.toast(tr('Five in a line: every tile of that kind clears'), 'good');
        }
      }
      // Matched Dragons sweep their row and column.
      for (const c of [...clear])
        if (this.dragons.has(c)) {
          this.dragons.delete(c);
          for (let i = 0; i < SIZE; i++) {
            clear.add(Math.floor(c / SIZE) * SIZE + i);
            clear.add(i * SIZE + (c % SIZE));
          }
          this.host.toast(tr('Dragon sweep'), 'good');
        }
      for (const d of newDragons) clear.delete(d);
      for (const d of newDragons) this.dragons.add(d);
      const gained = clear.size * 10 * chain;
      this.score += gained;
      if (chain > 1) this.host.toast(tr('Chain ×{n}', { n: chain }), 'good');
      this.host.sound(chain > 1 ? 'kong' : 'pung');
      // Ids leave with their cells, so remember them by column before gravity moves idAt.
      const freedBy = new Map<number, number[]>();
      for (const c of clear) {
        const x = c % SIZE;
        if (!freedBy.has(x)) freedBy.set(x, []);
        freedBy.get(x)!.push(this.idAt[c]);
        bd.remove(this.idAt[c]);
        this.g.cells[c] = -1;
        this.dragons.delete(c);
      }
      const mid = this.world(focus).setY(0.3);
      this.host.burst(mid, clear.size > 5);
      this.refresh();
      await this.wait(420);
      // Gravity and refill, column by column.
      for (let x = 0; x < SIZE; x++) {
        let dst = SIZE - 1;
        for (let y = SIZE - 1; y >= 0; y--) {
          const i = y * SIZE + x;
          if (this.g.cells[i] < 0) continue;
          const j = dst * SIZE + x;
          if (j !== i) {
            this.g.cells[j] = this.g.cells[i];
            this.g.cells[i] = -1;
            this.idAt[j] = this.idAt[i];
            if (this.dragons.delete(i)) this.dragons.add(j);
            bd.moveTo(this.idAt[j], { pos: this.world(j) }, { dur: 0.26 });
          }
          dst--;
        }
        // The cleared tiles come back as new ones, dropping in from above the board.
        const freed = freedBy.get(x) ?? [];
        for (let y = dst, n = 0; y >= 0; y--, n++) {
          const j = y * SIZE + x;
          const id = freed[n];
          const k = this.g.random();
          this.g.cells[j] = k;
          this.idAt[j] = id;
          bd.setKind(id, k);
          bd.revive(id, { pos: this.world(j, dst + 2), quat: FLAT });
          bd.moveTo(id, { pos: this.world(j) }, { dur: 0.32, delay: 0.03 * n });
        }
      }
      await this.wait(380);
    }
  }

  private reshuffle() {
    this.g.fill();
    const bd = this.host.board;
    this.dragons.clear();
    this.g.cells.forEach((k, i) => {
      bd.setKind(this.idAt[i], k);
      bd.moveTo(this.idAt[i], { pos: this.world(i) }, { dur: 0.3, arc: 0.3, delay: (i % 7) * 0.02 });
    });
    this.host.sound('shuffle');
  }

  suggest(): number[] | null {
    if (this.ended || this.busy) return [];
    const m = this.g.findMove();
    return m ? m.map((c) => this.idAt[c]) : null;
  }

  hint() {
    if (this.ended || this.busy || this.hints <= 0) return false;
    const m = this.g.findMove();
    if (!m) return false;
    this.hintPair = m;
    this.hints--;
    this.refresh();
    window.setTimeout(() => {
      this.hintPair = null;
      if (!this.ended) this.refresh();
    }, 2400);
    return true;
  }
  canUse(tool: 'hint' | 'shuffle') {
    return !this.ended && !this.busy && tool === 'hint' && this.hints > 0;
  }
  badges() {
    return { hint: Number.isFinite(this.hints) ? String(this.hints) : undefined };
  }
  private end(won: boolean) {
    if (this.ended) return;
    this.ended = true;
    const bonus = won ? this.moves * 50 : 0;
    this.score += bonus;
    this.host.finish({
      won,
      score: this.score,
      seconds: 0,
      cleared: Math.min(this.score, this.setup.target),
      total: this.setup.target,
      notes: [won ? tr('Target {n} reached', { n: this.setup.target }) : tr('Target {n} not reached', { n: this.setup.target }), ...(bonus ? [tr('{n} moves to spare: +{b}', { n: this.moves, b: bonus })] : []), ...(this.chainBest > 1 ? [tr('Longest chain ×{n}', { n: this.chainBest })] : [])],
    });
  }
  dispose() {
    this.ended = true;
  }
}

registerMiniGame({
  id: 'match3',
  title: tr('Mahjong Match-3'),
  blurb: tr('Swap neighbouring tiles to line up three of a kind. Chains and Dragons score big.'),
  minutes: tr('1–3 min'),
  order: 70,
  icon: { kinds: [31, 31, 31, 13, 22], shape: 'fan' },
  levels: ['easy', 'medium', 'hard'],
  dynamicKinds: true,
  howTo: [
    tr('Slide a tile onto a neighbour, or tap one then the other, to swap them. A swap must make a line of three or more.'),
    tr('Lines clear, the tiles above fall and new ones drop in. Chains score more.'),
    tr('Four in a line leaves a glowing Dragon: match it to sweep its row and column. Five clears every tile of that kind.'),
    tr('Reach the target score before your moves run out.'),
  ],
  tools: { hint: true },
  reward: (r, level) => (r.won ? Math.round(Math.min(260, 60 + r.score * 0.03) * PAY[level]) : Math.round((r.cleared / Math.max(1, r.total)) * 30 * PAY[level])),
  start: (host) => new Match3Session(host),
});
