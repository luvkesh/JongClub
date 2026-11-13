// Mahjong Chain Reaction: a field of tiles from a few suits. Tap a group of
// two or more touching tiles of one suit to clear it; the tiles behind fall
// toward you and empty columns close up. Big groups score far more, and a
// group holding a run (three numbers in a row) scores double. Leave as few
// tiles as you can.

import * as THREE from 'three';
import { tr } from '../../i18n';
import { registerMiniGame } from '../registry';
import { FLAT } from '../board';
import { FAMILY_KINDS, GameClock, UndoStack, family } from '../helpers';
import { rankOf } from '../../engine/tiles';
import type { Rng } from '../../engine/rng';
import type { MiniHost, MiniLevel, MiniSession } from '../types';

const SETUP: Record<MiniLevel, { w: number; h: number; fams: number; target: number }> = {
  easy: { w: 8, h: 6, fams: 3, target: 8 },
  medium: { w: 10, h: 7, fams: 4, target: 10 },
  hard: { w: 12, h: 8, fams: 5, target: 12 },
};
const PAY: Record<MiniLevel, number> = { easy: 1, medium: 1.5, hard: 2.2 };
/** Families in play, in order: the three suits, then Winds and Dragons together, then the bonus tiles. */
const POOLS = [FAMILY_KINDS[0], FAMILY_KINDS[1], FAMILY_KINDS[2], [...FAMILY_KINDS[3], ...FAMILY_KINDS[4]], [...FAMILY_KINDS[5], ...FAMILY_KINDS[6]]];
/** Family of a kind as Chain Reaction groups them (honours together, bonus tiles together). */
export const chainFamily = (k: number) => {
  const f = family(k);
  return f === 4 ? 3 : f >= 5 ? 4 : f;
};

/** Points for clearing a group of n tiles. */
export const groupScore = (n: number, run: boolean) => n * (n - 1) * 5 * (run ? 2 : 1);

/** Pure rules (tests use this): cells row major, y = 0 the far row, -1 empty. */
export class ChainBoard {
  constructor(
    readonly w: number,
    readonly h: number,
    public cells: number[],
  ) {}
  at(x: number, y: number) {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : this.cells[y * this.w + x];
  }
  /** The touching same-family group containing cell i. */
  group(i: number): number[] {
    const k = this.cells[i];
    if (k < 0) return [];
    const f = chainFamily(k);
    const seen = new Set([i]);
    const stack = [i];
    while (stack.length) {
      const c = stack.pop()!;
      const x = c % this.w,
        y = Math.floor(c / this.w);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const n = ny * this.w + nx;
        if (this.at(nx, ny) >= 0 && !seen.has(n) && chainFamily(this.cells[n]) === f) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    return [...seen];
  }
  /** Every group of two or more. */
  groups(): number[][] {
    const seen = new Set<number>();
    const out: number[][] = [];
    this.cells.forEach((k, i) => {
      if (k < 0 || seen.has(i)) return;
      const g = this.group(i);
      g.forEach((c) => seen.add(c));
      if (g.length >= 2) out.push(g);
    });
    return out;
  }
  /** Whether a group holds three numbers in a row (suited tiles only). */
  hasRun(g: number[]) {
    const ranks = new Set(g.map((c) => this.cells[c]).filter((k) => k < 27).map(rankOf));
    for (const r of ranks) if (ranks.has(r + 1) && ranks.has(r + 2)) return true;
    return false;
  }
  /** Clear a group; tiles fall toward the player (higher y) and empty columns close toward the middle. Returns where every tile left went, [from, to]. */
  clear(g: number[]): [number, number][] {
    for (const c of g) this.cells[c] = -1;
    const next = Array(this.w * this.h).fill(-1);
    const where = new Map<number, number>();
    const cols: number[][] = [];
    for (let x = 0; x < this.w; x++) {
      const col: number[] = [];
      for (let y = this.h - 1; y >= 0; y--) if (this.cells[y * this.w + x] >= 0) col.push(y * this.w + x);
      cols.push(col);
    }
    // Close empty columns toward the middle: keep the non-empty columns, centred.
    const full = cols.filter((c) => c.length);
    const x0 = Math.floor((this.w - full.length) / 2);
    full.forEach((col, i) =>
      col.forEach((from, n) => {
        const to = (this.h - 1 - n) * this.w + x0 + i;
        next[to] = this.cells[from];
        where.set(from, to);
      }),
    );
    this.cells = next;
    return [...where.entries()];
  }
  get left() {
    return this.cells.filter((k) => k >= 0).length;
  }
}

export function dealChain(w: number, h: number, fams: number, rng: Rng): number[] {
  const pools = POOLS.slice(0, fams);
  return Array.from({ length: w * h }, () => {
    const p = pools[rng.int(pools.length)];
    return p[rng.int(p.length)];
  });
}

class ChainSession implements MiniSession {
  private g: ChainBoard;
  /** Tile id in each cell (-1 empty). */
  private idAt: number[];
  private score = 0;
  private best = 0;
  private clock = new GameClock();
  private undos = new UndoStack<{ cells: number[]; idAt: number[]; score: number }>();
  private ended = false;
  private hover: number[] = [];
  private st: (typeof SETUP)['easy'];

  constructor(private host: MiniHost) {
    this.st = SETUP[host.level];
    this.g = new ChainBoard(this.st.w, this.st.h, dealChain(this.st.w, this.st.h, this.st.fams, host.rng));
    // A field with no group at all is no game.
    while (this.g.groups().length < 6) this.g.cells = dealChain(this.st.w, this.st.h, this.st.fams, host.rng);
    this.idAt = this.g.cells.map((_, i) => i);
    host.camera.home = { yaw: 0, pitch: 70 };
    host.camera.reset();
    host.board.build(this.g.cells.map((kind, i) => ({ id: i, kind, pos: this.world(i), quat: FLAT })));
    host.fit(true);
    this.refresh();
  }

  private world(i: number) {
    const b = this.host.board;
    const x = i % this.st.w,
      y = Math.floor(i / this.st.w);
    return new THREE.Vector3((x - (this.st.w - 1) / 2) * (b.w + 0.02), b.d / 2, (y - (this.st.h - 1) / 2) * (b.h + 0.02));
  }

  private refresh() {
    this.host.board.looks((id) => (this.hover.includes(this.idAt.indexOf(id)) ? 'hint' : 'normal'));
    this.host.setStat('left', `${this.g.left}`, tr('Tiles'));
    this.host.setStat('score', String(this.score), tr('Score'));
    this.host.setStat('moves', String(this.st.target), tr('Goal: tiles left'));
    this.host.refreshButtons();
  }

  onPick(id: number) {
    if (this.ended) return;
    const cell = this.idAt.indexOf(id);
    if (cell < 0) return;
    const grp = this.g.group(cell);
    if (grp.length < 2) {
      this.host.board.shake(id);
      this.host.toast(tr('A group needs two or more touching tiles of one suit.'), 'bad');
      return;
    }
    this.undos.push({ cells: [...this.g.cells], idAt: [...this.idAt], score: this.score });
    this.hover = [];
    const run = this.g.hasRun(grp);
    const pts = groupScore(grp.length, run);
    this.score += pts;
    this.best = Math.max(this.best, grp.length);
    const b = this.host.board;
    const centre = grp.reduce((v, c) => v.add(this.world(c)), new THREE.Vector3()).multiplyScalar(1 / grp.length);
    grp.forEach((c, n) => b.remove(this.idAt[c], { to: centre, delay: n * 0.012 }));
    window.setTimeout(() => this.host.burst(centre.clone().setY(0.3), grp.length >= 8), 220);
    this.host.sound(grp.length >= 6 ? 'kong' : 'pung');
    if (run) this.host.toast(tr('Run inside: double points, +{n}', { n: pts }), 'good');
    else if (grp.length >= 6) this.host.toast(tr('Chain of {n}: +{p}', { n: grp.length, p: pts }), 'good');
    const next = Array(this.idAt.length).fill(-1);
    for (const [from, to] of this.g.clear(grp)) {
      next[to] = this.idAt[from];
      if (from !== to) b.moveTo(this.idAt[from], { pos: this.world(to) }, { dur: 0.3, delay: 0.3 });
    }
    this.idAt = next;
    this.refresh();
    if (!this.g.groups().length) window.setTimeout(() => this.end(), 800);
  }

  canUndo() {
    return !this.ended && this.undos.size > 0;
  }
  undo() {
    const u = this.undos.pop();
    if (!u || this.ended) return false;
    this.g.cells = u.cells;
    this.idAt = u.idAt;
    this.score = u.score;
    const b = this.host.board;
    this.idAt.forEach((id, i) => {
      if (id < 0) return;
      const p = { pos: this.world(i), quat: FLAT, scale: 1 };
      if (!b.has(id)) b.restore(id, p);
      else b.moveTo(id, { pos: p.pos }, { dur: 0.25 });
    });
    this.hover = [];
    this.host.sound('slide');
    this.refresh();
    return true;
  }

  /** The biggest group on the board. */
  private biggest() {
    return this.g.groups().sort((a, b) => b.length - a.length)[0] ?? null;
  }
  suggest(): number[] | null {
    if (this.ended) return [];
    const g = this.biggest();
    return g ? g.map((c) => this.idAt[c]) : [];
  }
  hint() {
    const g = this.biggest();
    if (this.ended || !g) return false;
    this.hover = g;
    this.refresh();
    window.setTimeout(() => {
      this.hover = [];
      if (!this.ended) this.refresh();
    }, 2200);
    return true;
  }
  canUse(tool: 'hint' | 'shuffle') {
    return !this.ended && tool === 'hint';
  }

  tick(dt: number) {
    if (this.ended) return;
    this.clock.tick(dt);
    this.host.setStat('time', this.clock.text(), tr('Time'));
  }
  pause(p: boolean) {
    this.clock.paused = p;
  }
  private end() {
    // An undo in the moment before the end brings groups back: then play goes on.
    if (this.ended || this.g.groups().length) return;
    this.ended = true;
    const left = this.g.left;
    const won = left <= this.st.target;
    const bonus = left === 0 ? 1000 : won ? (this.st.target - left) * 40 : 0;
    this.score += bonus;
    const total = this.st.w * this.st.h;
    this.host.finish({
      won,
      score: this.score,
      seconds: this.clock.elapsed,
      cleared: total - left,
      total,
      headline: left === 0 ? tr('Board cleared') : tr('Goal reached'),
      tally: { label: tr('Tiles left'), text: String(left) },
      notes: [left === 0 ? tr('Every tile cleared: +1,000') : tr('{n} tiles left (goal {t} or fewer)', { n: left, t: this.st.target }), tr('Biggest group: {n}', { n: this.best })],
    });
  }
  dispose() {
    this.ended = true;
  }
}

registerMiniGame({
  id: 'chain',
  title: tr('Mahjong Chain Reaction'),
  blurb: tr('Clear touching groups of one suit. The bigger the group, the bigger the score.'),
  minutes: tr('2–4 min'),
  order: 88,
  icon: { kinds: [10, 13, 15, 2, 6, 22], shape: 'burst' },
  levels: ['easy', 'medium', 'hard'],
  howTo: [
    tr('Tap a group of two or more touching tiles of one suit to clear it. Winds and Dragons count as one suit, and so do Flowers and Seasons.'),
    tr('The tiles behind fall toward you, and empty columns close up.'),
    tr('A group of n tiles scores n × (n − 1) × 5. A group holding a run of three numbers scores double.'),
    tr('The game ends when no group is left. Leave no more tiles than the goal to win.'),
  ],
  tools: { hint: true, undo: true },
  daily: true,
  // A win never pays less than the best loss could (25 × PAY), however many undos it took.
  reward: (r, level) => (r.won ? Math.max(Math.round(25 * PAY[level]), Math.round(Math.min(200, 50 + r.score * 0.04) * PAY[level] - r.undos * 2)) : Math.round((r.cleared / Math.max(1, r.total)) * 25 * PAY[level])),
  start: (host) => new ChainSession(host),
});
