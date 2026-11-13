// Mahjong Hex: tiles laid as a honeycomb, each row offset by half a tile so
// every tile touches six others. A tile is free when three neighbouring sides
// in a row around it are open; take free matching pairs until the honeycomb
// is gone. Deals are built backwards, pair by pair, so every board clears.

import * as THREE from 'three';
import { tr } from '../../i18n';
import { registerMiniGame } from '../registry';
import { FLAT } from '../board';
import { GameClock, UndoStack, freeLook, matchGroup, pairsFromSet, tilesMatch } from '../helpers';
import { Rng } from '../../engine/rng';
import type { MiniHost, MiniLevel, MiniSession } from '../types';

/** Honeycomb radius per level; the centre cell stays empty so the count is even. */
const RADIUS: Record<MiniLevel, number> = { easy: 3, medium: 4, hard: 5 };
const SHUFFLES: Record<MiniLevel, number> = { easy: Infinity, medium: 3, hard: 2 };
const HINTS: Record<MiniLevel, number> = { easy: Infinity, medium: 5, hard: 3 };
const PAY: Record<MiniLevel, number> = { easy: 1, medium: 1.5, hard: 2.2 };
/** Axial neighbour steps, in order round the hexagon. */
const DIRS: [number, number][] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

export interface HexCell {
  q: number;
  r: number;
}

/** The cells of a honeycomb of radius R, centre left out. */
export function hexCells(R: number): HexCell[] {
  const out: HexCell[] = [];
  for (let r = -R; r <= R; r++) for (let q = -R; q <= R; q++) if (Math.abs(q + r) <= R && (q || r)) out.push({ q, r });
  return out;
}

/**
 * Upright phones: a taller honeycomb with fewer tiles across, so each tile is larger
 * (the round one is 11 tiles wide on Hard). Same tile count per level; row lengths
 * alternate by one so every row still sits half a tile off its neighbours.
 */
export const TALL_ROWS: Record<MiniLevel, number[]> = {
  easy: [5, 6, 5, 4, 5, 6, 5],
  medium: [6, 7, 6, 7, 8, 7, 6, 7, 6],
  hard: [7, 8, 9, 8, 9, 8, 9, 8, 9, 8, 7],
};

/** A honeycomb from row lengths, each row centred under the one above. */
export function rowCells(rows: number[]): HexCell[] {
  const out: HexCell[] = [];
  // Axial r must have the parity that makes every centred row land on whole q.
  const r0 = (rows[0] - 1) % 2;
  rows.forEach((L, k) => {
    const r = r0 + k;
    for (let i = 0; i < L; i++) out.push({ q: i - (L - 1) / 2 - r / 2, r });
  });
  return out;
}

/** Pure rules (tests use this). */
export class HexBoard {
  /** Neighbour cell index in each direction, -1 off the board. */
  readonly nb: number[][];
  constructor(
    readonly cells: HexCell[],
    public kinds: number[],
  ) {
    const at = new Map(cells.map((c, i) => [`${c.q},${c.r}`, i]));
    this.nb = cells.map((c) => DIRS.map(([dq, dr]) => at.get(`${c.q + dq},${c.r + dr}`) ?? -1));
  }
  /** Free: three neighbouring sides in a row open (off the board counts as open). */
  isFree(i: number, occ = this.kinds.map((k) => k >= 0)) {
    if (!occ[i]) return false;
    const open = this.nb[i].map((n) => n < 0 || !occ[n]);
    for (let d = 0; d < 6; d++) if (open[d] && open[(d + 1) % 6] && open[(d + 2) % 6]) return true;
    return false;
  }
  free(occ = this.kinds.map((k) => k >= 0)) {
    return this.cells.map((_, i) => i).filter((i) => this.isFree(i, occ));
  }
  canMatch(a: number, b: number) {
    return a !== b && this.isFree(a) && this.isFree(b) && tilesMatch(this.kinds[a], this.kinds[b]);
  }
  pairs(limit = Infinity): [number, number][] {
    const f = this.free();
    const out: [number, number][] = [];
    for (let i = 0; i < f.length; i++)
      for (let j = i + 1; j < f.length; j++)
        if (tilesMatch(this.kinds[f[i]], this.kinds[f[j]])) {
          out.push([f[i], f[j]]);
          if (out.length >= limit) return out;
        }
    return out;
  }
  get left() {
    return this.kinds.filter((k) => k >= 0).length;
  }
  /** A removal order clearing the given cells two free cells at a time, or null on a dead end. */
  order(occ0: boolean[], rng: Rng): [number, number][] | null {
    const occ = [...occ0];
    const out: [number, number][] = [];
    let left = occ.filter(Boolean).length;
    while (left > 0) {
      const f = this.free(occ);
      if (f.length < 2) return null;
      const a = f[rng.int(f.length)];
      const rest = f.filter((x) => x !== a);
      const b = rest[rng.int(rest.length)];
      occ[a] = occ[b] = false;
      out.push([a, b]);
      left -= 2;
    }
    return out;
  }
  /** Deal the remaining kinds again along a fresh removal order, so the board can still be cleared. */
  shuffle(rng: Rng): boolean {
    const occ = this.kinds.map((k) => k >= 0);
    let ord: [number, number][] | null = null;
    for (let t = 0; t < 200 && !ord; t++) ord = this.order(occ, rng);
    if (!ord) return false;
    // The tiles left always pair up by match group.
    const by = new Map<number, number[]>();
    for (const k of this.kinds) if (k >= 0) by.set(matchGroup(k), [...(by.get(matchGroup(k)) ?? []), k]);
    const pairs = rng.shuffle([...by.values()].flatMap((ks) => ks.flatMap((k, i) => (i % 2 ? [] : [[k, ks[i + 1]] as [number, number]]))));
    ord.forEach(([a, b], i) => {
      this.kinds[a] = pairs[i][0];
      this.kinds[b] = pairs[i][1];
    });
    return true;
  }
}

/** A solvable honeycomb of radius R (or of the given cells). */
export function dealHex(R: number | HexCell[], rng: Rng): HexBoard {
  const cells = typeof R === 'number' ? hexCells(R) : R;
  const g = new HexBoard(cells, Array(cells.length).fill(-1));
  let ord: [number, number][] | null = null;
  for (let t = 0; t < 400 && !ord; t++) ord = g.order(Array(cells.length).fill(true), rng);
  if (!ord) throw new Error('honeycomb cannot be dealt');
  const pairs = pairsFromSet(cells.length / 2, rng);
  ord.forEach(([a, b], i) => {
    g.kinds[a] = pairs[i][0];
    g.kinds[b] = pairs[i][1];
  });
  return g;
}

class HexSession implements MiniSession {
  private g: HexBoard;
  private sel: number | null = null;
  private clock = new GameClock();
  private undos = new UndoStack<{ a: number; b: number; ka: number; kb: number; pts: number } | { shuffle: number[] }>();
  private score = 0;
  private combo = 0;
  private lastPair = -99;
  private bestCombo = 0;
  private hints: number;
  private shuffles: number;
  private ended = false;
  private hintPair: number[] = [];
  private total: number;
  /** Pause suggestions draw from their own stream, so the deal's shuffles stay the same (daily puzzle). */
  private hintRng: Rng;

  constructor(private host: MiniHost) {
    const tall = typeof window !== 'undefined' && window.innerWidth / Math.max(1, window.innerHeight) < 0.85;
    this.g = dealHex(tall ? rowCells(TALL_ROWS[host.level]) : RADIUS[host.level], host.rng);
    this.total = this.g.cells.length;
    this.hintRng = new Rng((host.seed ^ 0x2c1b3c6d) >>> 0);
    this.hints = HINTS[host.level];
    this.shuffles = SHUFFLES[host.level];
    host.camera.home = { yaw: 0, pitch: 72 };
    host.camera.reset();
    host.board.build(this.g.kinds.map((kind, i) => ({ id: i, kind, pos: this.world(i), quat: FLAT })));
    host.fit(true);
    this.refresh();
  }

  private world(i: number) {
    const b = this.host.board;
    const { q, r } = this.g.cells[i];
    return new THREE.Vector3((q + r / 2) * (b.w + 0.03), b.d / 2, r * (b.h + 0.02));
  }

  private refresh() {
    const free = new Set(this.g.free());
    this.host.board.looks((id) => (id === this.sel ? 'selected' : this.hintPair.includes(id) ? 'hint' : freeLook(free.has(id))));
    this.host.setStat('left', String(this.g.left), tr('Tiles'));
    this.host.setStat('score', String(this.score), tr('Score'));
    this.host.setStat('combo', this.combo > 1 ? `×${this.combo}` : null, tr('Combo'));
    this.host.refreshButtons();
  }

  onPick(id: number) {
    if (this.ended || this.g.kinds[id] < 0) return;
    if (!this.g.isFree(id)) {
      this.host.board.shake(id);
      return;
    }
    if (this.sel === null || this.sel === id) {
      this.sel = this.sel === id ? null : id;
      this.host.sound('click');
      return this.refresh();
    }
    const a = this.sel;
    if (!this.g.canMatch(a, id)) {
      this.sel = id;
      this.host.sound('click');
      return this.refresh();
    }
    const move = { a, b: id, ka: this.g.kinds[a], kb: this.g.kinds[id], pts: 0 };
    this.undos.push(move);
    this.g.kinds[a] = this.g.kinds[id] = -1;
    const b = this.host.board;
    const mid = this.world(a).add(this.world(id)).multiplyScalar(0.5);
    b.remove(a, { to: mid });
    b.remove(id, { to: mid });
    window.setTimeout(() => this.host.burst(mid.clone().setY(0.3)), 250);
    this.sel = null;
    this.hintPair = [];
    const t = this.clock.elapsed;
    this.combo = t - this.lastPair <= 3.5 ? this.combo + 1 : 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.lastPair = t;
    // An undo takes back exactly what the pair scored (combo included), so take-undo-take cannot farm points.
    move.pts = 10 + 5 * (this.combo - 1);
    this.score += move.pts;
    this.host.sound(this.combo > 2 ? 'kong' : 'pung');
    if (this.combo > 2) this.host.toast(tr('Combo ×{n}', { n: this.combo }), 'good');
    this.refresh();
    if (!this.g.left) window.setTimeout(() => this.win(), 600);
    else if (!this.g.pairs(1).length) {
      this.host.toast(this.shuffles > 0 ? tr('No more moves. Shuffle the tiles to carry on.') : tr('No more moves'), 'bad');
      if (this.shuffles <= 0) this.loseIfStuck();
    }
  }

  /** A dead end with no shuffle left: the game ends, unless the player undoes a move in time. */
  private loseIfStuck() {
    window.setTimeout(() => {
      if (this.ended || !this.g.left || this.g.pairs(1).length || this.shuffles > 0) return;
      this.ended = true;
      this.host.finish({ won: false, score: this.score, seconds: this.clock.elapsed, cleared: this.total - this.g.left, total: this.total });
    }, 1500);
  }

  canUndo() {
    return !this.ended && this.undos.size > 0;
  }
  undo() {
    const m = this.undos.pop();
    if (!m || this.ended) return false;
    const b = this.host.board;
    if ('shuffle' in m) {
      this.g.kinds = m.shuffle;
      this.g.kinds.forEach((k, i) => k >= 0 && b.setKind(i, k));
    } else {
      this.g.kinds[m.a] = m.ka;
      this.g.kinds[m.b] = m.kb;
      for (const c of [m.a, m.b]) b.restore(c, { pos: this.world(c), quat: FLAT, scale: 1 });
      this.score = Math.max(0, this.score - m.pts);
    }
    this.sel = null;
    this.hintPair = [];
    this.combo = 0;
    this.host.sound('slide');
    this.refresh();
    return true;
  }

  suggest(): number[] | null {
    if (this.ended || !this.g.left) return [];
    const p = this.g.pairs(12);
    return p.length ? p[this.hintRng.int(p.length)] : null;
  }
  hint() {
    // A second press while a hint shows would spend another (and 5 points) on the same pair.
    if (this.ended || this.hints <= 0 || this.hintPair.length) return false;
    const p = this.g.pairs(1);
    if (!p.length) return false;
    this.hints--;
    const pair = (this.hintPair = p[0]);
    this.score = Math.max(0, this.score - 5);
    this.refresh();
    window.setTimeout(() => {
      if (this.hintPair !== pair) return;
      this.hintPair = [];
      if (!this.ended) this.refresh();
    }, 2400);
    return true;
  }
  shuffle() {
    if (this.ended || this.shuffles <= 0) return false;
    const before = [...this.g.kinds];
    if (!this.g.shuffle(this.host.rng)) return false;
    this.shuffles--;
    this.undos.push({ shuffle: before });
    const b = this.host.board;
    this.g.kinds.forEach((k, i) => {
      if (k < 0) return;
      b.setKind(i, k);
      b.moveTo(i, { pos: this.world(i).setY(0.5) }, { dur: 0.16, delay: (i % 9) * 0.015 });
      b.moveTo(i, { pos: this.world(i) }, { dur: 0.24 });
    });
    this.sel = null;
    // The lit pair has new faces now.
    this.hintPair = [];
    this.host.sound('shuffle');
    this.refresh();
    return true;
  }
  canUse(tool: 'hint' | 'shuffle') {
    if (this.ended) return false;
    return tool === 'hint' ? this.hints > 0 && !this.hintPair.length : this.shuffles > 0;
  }
  badges() {
    const n = (v: number) => (Number.isFinite(v) ? String(v) : undefined);
    return { hint: n(this.hints), shuffle: n(this.shuffles) };
  }
  attention() {
    return !this.ended && this.g.left > 0 && !this.g.pairs(1).length && this.shuffles > 0 ? ('shuffle' as const) : null;
  }
  variant() {
    return `r${RADIUS[this.host.level]}`;
  }

  tick(dt: number) {
    if (this.ended) return;
    this.clock.tick(dt);
    if (this.combo && this.clock.elapsed - this.lastPair > 3.5) {
      this.combo = 0;
      this.host.setStat('combo', null);
    }
    this.host.setStat('time', this.clock.text(), tr('Time'));
  }
  pause(p: boolean) {
    this.clock.paused = p;
  }
  private win() {
    // An undo during the short pause before the win brings tiles back: play on.
    if (this.ended || this.g.left) return;
    this.ended = true;
    const bonus = Math.max(0, Math.round(this.total * 3 - this.clock.elapsed));
    this.score += bonus;
    this.host.finish({ won: true, score: this.score, seconds: this.clock.elapsed, cleared: this.total, total: this.total, notes: [...(bonus ? [tr('Time bonus +{n}', { n: bonus })] : []), ...(this.bestCombo > 1 ? [tr('Longest combo ×{n}', { n: this.bestCombo })] : [])] });
  }
  dispose() {
    this.ended = true;
  }
}

registerMiniGame({
  id: 'hex',
  title: tr('Mahjong Hex'),
  blurb: tr('A honeycomb of tiles. Free tiles have three open sides in a row; clear it pair by pair.'),
  minutes: tr('2–6 min'),
  order: 15,
  icon: { kinds: [27, 9, 18, 31, 0, 13, 29], shape: 'hex' },
  levels: ['easy', 'medium', 'hard'],
  layered: true,
  dynamicKinds: true,
  howTo: [
    tr('Every tile in the honeycomb touches up to six others.'),
    tr('A tile is free when three of its sides in a row are open. Tap two matching free tiles to take them.'),
    tr('Any flower matches any flower, and any season any season. Clear the whole honeycomb to win.'),
  ],
  tools: { hint: true, undo: true, shuffle: true },
  daily: true,
  reward: (r, level) => (r.won ? Math.max(20, Math.round((40 + r.total * 1.1) * PAY[level] - r.hints * 4 - r.shuffles * 8 - r.undos)) : 0),
  start: (host) => new HexSession(host),
});
