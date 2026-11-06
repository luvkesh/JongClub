// Mahjong Survival: rows of tiles creep across your table toward you. A tile
// is free at either end of its row; match two free tiles to take them. Every
// few seconds a new row slides in at the far side and pushes the others
// closer. Hold out until the clock runs down without a row crossing the gold
// line at your edge.

import * as THREE from 'three';
import { tr } from '../../i18n';
import { registerMiniGame } from '../registry';
import { FLAT } from '../board';
import { GameClock, freeLook, goldMaterial, pairsFromSet, tilesMatch } from '../helpers';
import type { Rng } from '../../engine/rng';
import type { MiniHost, MiniLevel, MiniSession } from '../types';

/** Row width, seconds between rows, game length and how many rows fit before the line. */
const SETUP: Record<MiniLevel, { w: number; every: number; secs: number; max: number; start: number }> = {
  easy: { w: 6, every: 12, secs: 120, max: 8, start: 4 },
  medium: { w: 7, every: 10, secs: 150, max: 8, start: 4 },
  hard: { w: 8, every: 8, secs: 180, max: 8, start: 4 },
};
const SHUFFLES: Record<MiniLevel, number> = { easy: 3, medium: 2, hard: 1 };
const PAY: Record<MiniLevel, number> = { easy: 1, medium: 1.5, hard: 2.2 };

export interface SRow {
  /** Tile ids by column slot, -1 where a tile has gone. Tiles only ever leave from the ends. */
  slots: number[];
}

/** Pure rules (tests use this). Rows run from the newest (index 0, far side) to the oldest. */
export class Rows {
  rows: SRow[] = [];
  constructor(public kinds: number[]) {}
  live(r: SRow) {
    return r.slots.filter((id) => id >= 0);
  }
  /** The free tiles: the first and last tile left in each row. */
  free(): number[] {
    const out: number[] = [];
    for (const r of this.rows) {
      const l = this.live(r);
      if (l.length) out.push(l[0]);
      if (l.length > 1) out.push(l[l.length - 1]);
    }
    return out;
  }
  isFree(id: number) {
    return this.free().includes(id);
  }
  canMatch(a: number, b: number) {
    return a !== b && this.isFree(a) && this.isFree(b) && tilesMatch(this.kinds[a], this.kinds[b]);
  }
  pairs(): [number, number][] {
    const f = this.free();
    const out: [number, number][] = [];
    for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) if (tilesMatch(this.kinds[f[i]], this.kinds[f[j]])) out.push([f[i], f[j]]);
    return out;
  }
  /** Take a pair; rows left empty go, and the count of rows cleared is returned. */
  remove(a: number, b: number): number {
    for (const r of this.rows) r.slots = r.slots.map((id) => (id === a || id === b ? -1 : id));
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => this.live(r).length);
    return before - this.rows.length;
  }
  push(slots: number[]) {
    this.rows.unshift({ slots });
  }
  get count() {
    return this.rows.reduce((n, r) => n + this.live(r).length, 0);
  }
  /** Deal the live tiles' kinds round again so that at least one pair is free. */
  shuffle(rng: Rng): boolean {
    const ids = this.rows.flatMap((r) => this.live(r));
    for (let t = 0; t < 30; t++) {
      const ks = rng.shuffle(ids.map((id) => this.kinds[id]));
      ids.forEach((id, i) => (this.kinds[id] = ks[i]));
      if (this.pairs().length) return true;
    }
    return false;
  }
}

/** Kinds for `rows` rows of `w`: every two rows hold matching pairs, so each pair lands close together. */
export function survivalKinds(rows: number, w: number, rng: Rng): number[] {
  const out: number[] = [];
  for (let r = 0; r < rows; r += 2) out.push(...rng.shuffle(pairsFromSet(w, rng).flatMap(([a, b]) => [a, b])));
  return out;
}

class SurvivalSession implements MiniSession {
  private g: Rows;
  private st: (typeof SETUP)['easy'];
  private clock: GameClock;
  private nextIn: number;
  /** Rows not yet in play, in order. */
  private queue: number[][] = [];
  private sel: number | null = null;
  private score = 0;
  private pairsTaken = 0;
  private rowsCleared = 0;
  private combo = 0;
  private lastPair = -99;
  private bestCombo = 0;
  private shuffles: number;
  private ended = false;
  private hintPair: number[] = [];
  private line: THREE.Mesh;
  private lineMat = goldMaterial();
  private total = 0;
  private warned = false;

  constructor(private host: MiniHost) {
    this.st = SETUP[host.level];
    const st = this.st;
    const rows = st.start + Math.ceil(st.secs / st.every) + 1;
    const n = rows + (rows % 2);
    const kinds = survivalKinds(n, st.w, host.rng);
    this.g = new Rows(kinds);
    this.total = kinds.length;
    for (let r = 0; r < n; r++) this.queue.push(Array.from({ length: st.w }, (_, i) => r * st.w + i));
    this.clock = new GameClock(st.secs);
    this.nextIn = st.every;
    this.shuffles = SHUFFLES[host.level];
    const b = host.board;
    // The line at your edge: rows that would cross it end the game.
    this.line = new THREE.Mesh(new THREE.BoxGeometry(st.w * (b.w + 0.02) + 0.4, 0.016, 0.06), this.lineMat);
    this.line.position.set(0, 0.006, this.rowZ(st.max - 1) + b.h / 2 + 0.12);
    b.root.add(this.line);
    host.camera.home = { yaw: 0, pitch: 66 };
    host.camera.reset();
    b.build(kinds.map((kind, id) => ({ id, kind, pos: this.pos(id, -2), quat: FLAT })));
    for (let id = 0; id < kinds.length; id++) b.hide(id);
    b.fitExtra = new THREE.Box3(new THREE.Vector3(-(st.w / 2) * b.w - 0.1, 0, this.rowZ(0) - b.h), new THREE.Vector3((st.w / 2) * b.w + 0.1, 0.2, this.rowZ(st.max - 1) + b.h * 1.6));
    for (let i = 0; i < st.start; i++) this.pushRow(true);
    host.fit(true);
    this.refresh();
  }

  /** Board z of row index r (0 the newest, at the far side). */
  private rowZ(r: number) {
    const b = this.host.board;
    return (r - (this.st.max - 1) / 2) * (b.h + 0.05);
  }
  /** Where tile `id` sits in row `r`. */
  private pos(id: number, r: number) {
    const b = this.host.board;
    const x = id % this.st.w;
    return new THREE.Vector3((x - (this.st.w - 1) / 2) * (b.w + 0.02), b.d / 2, this.rowZ(r));
  }

  /** A new row slides in at the far side; the others move one row closer. */
  private pushRow(snap = false) {
    const slots = this.queue.shift();
    if (!slots) return;
    if (this.g.rows.length >= this.st.max) return this.lose();
    this.g.push(slots);
    const b = this.host.board;
    this.g.rows.forEach((r, i) =>
      r.slots.forEach((id) => {
        if (id < 0) return;
        if (i === 0) {
          b.revive(id, { pos: this.pos(id, -1.2), quat: FLAT });
          if (snap) b.place(id, { pos: this.pos(id, 0) });
          else b.moveTo(id, { pos: this.pos(id, 0) }, { dur: 0.45, delay: (id % this.st.w) * 0.02 });
        } else if (!snap) b.moveTo(id, { pos: this.pos(id, i) }, { dur: 0.4 });
        else b.place(id, { pos: this.pos(id, i) });
      }),
    );
    if (!snap) this.host.sound('shuffle');
    this.warned = false;
    this.refresh();
  }

  private refresh() {
    const free = new Set(this.g.free());
    this.host.board.looks((id) => {
      if (id === this.sel) return 'selected';
      if (this.hintPair.includes(id)) return 'hint';
      return freeLook(free.has(id));
    });
    this.host.setStat('left', `${this.g.rows.length} / ${this.st.max}`, tr('Rows'));
    this.host.setStat('score', String(this.score), tr('Score'));
    this.host.setStat('combo', this.combo > 1 ? `×${this.combo}` : null, tr('Combo'));
    this.host.refreshButtons();
  }

  onPick(id: number) {
    if (this.ended) return;
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
    this.sel = null;
    this.hintPair = [];
    const b = this.host.board;
    const mid = b.pose(a)!.pos.add(b.pose(id)!.pos).multiplyScalar(0.5);
    const cleared = this.g.remove(a, id);
    b.remove(a, { to: mid });
    b.remove(id, { to: mid });
    window.setTimeout(() => this.host.burst(mid.clone().setY(0.3)), 250);
    const t = this.clock.elapsed;
    this.combo = t - this.lastPair <= 3 ? this.combo + 1 : 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.lastPair = t;
    this.pairsTaken++;
    this.score += 10 + 5 * (this.combo - 1);
    this.host.sound(this.combo > 2 ? 'kong' : 'pung');
    if (cleared) {
      this.rowsCleared += cleared;
      this.score += 30 * cleared;
      this.host.toast(tr('Row cleared +{n}', { n: 30 * cleared }), 'good');
      // The rows behind close up.
      this.g.rows.forEach((r, i) => r.slots.forEach((sid) => sid >= 0 && b.moveTo(sid, { pos: this.pos(sid, i) }, { dur: 0.35, delay: 0.3 })));
    }
    if (!this.g.count) {
      // Board clear: the next row comes in at once, with a bonus.
      this.score += 50;
      this.nextIn = Math.min(this.nextIn, 1.2);
    }
    this.refresh();
  }

  suggest(): number[] | null {
    if (this.ended) return [];
    const p = this.g.pairs();
    if (!p.length) return this.g.count ? null : [];
    return p[this.host.rng.int(p.length)];
  }
  hint() {
    if (this.ended) return false;
    const p = this.g.pairs();
    if (!p.length) return false;
    this.hintPair = p[0];
    this.refresh();
    window.setTimeout(() => {
      this.hintPair = [];
      if (!this.ended) this.refresh();
    }, 2200);
    return true;
  }
  shuffle() {
    if (this.ended || this.shuffles <= 0 || !this.g.count) return false;
    if (!this.g.shuffle(this.host.rng)) return false;
    this.shuffles--;
    const b = this.host.board;
    this.g.rows.forEach((r, i) =>
      this.g.live(r).forEach((id) => {
        b.setKind(id, this.g.kinds[id]);
        b.moveTo(id, { pos: this.pos(id, i).setY(b.d / 2 + 0.4) }, { dur: 0.18 });
        b.moveTo(id, { pos: this.pos(id, i) }, { dur: 0.25 });
      }),
    );
    this.sel = null;
    this.host.sound('shuffle');
    this.refresh();
    return true;
  }
  canUse(tool: 'hint' | 'shuffle') {
    if (this.ended) return false;
    return tool === 'hint' ? this.g.pairs().length > 0 : this.shuffles > 0 && this.g.count > 1;
  }
  badges() {
    return { shuffle: String(this.shuffles) };
  }
  attention() {
    return !this.ended && this.g.count > 1 && !this.g.pairs().length && this.shuffles > 0 ? ('shuffle' as const) : null;
  }

  tick(dt: number) {
    if (this.ended) return;
    this.clock.tick(dt);
    if (!this.clock.paused) this.nextIn -= dt;
    if (this.combo && this.clock.elapsed - this.lastPair > 3) {
      this.combo = 0;
      this.host.setStat('combo', null);
    }
    // The line glows brighter as the rows near it.
    const near = this.g.rows.length / this.st.max;
    this.lineMat.emissiveIntensity = 0.6 + near * 1.4 + (near > 0.85 ? Math.sin(this.clock.elapsed * 8) * 0.5 : 0);
    if (this.g.rows.length >= this.st.max && this.nextIn < 4 && !this.warned) {
      this.warned = true;
      this.host.toast(tr('The rows are at the line! Clear a row now.'), 'bad');
    }
    this.host.setStat('time', this.clock.text(), tr('Left'));
    this.host.setStat('moves', String(Math.max(0, Math.ceil(this.nextIn))), tr('Next row'));
    if (this.clock.over) return this.win();
    if (this.nextIn <= 0) {
      this.nextIn = this.st.every;
      this.pushRow();
    }
  }
  pause(p: boolean) {
    this.clock.paused = p;
  }

  private win() {
    if (this.ended) return;
    this.ended = true;
    const bonus = 100 + (this.st.max - this.g.rows.length) * 20;
    this.score += bonus;
    this.host.finish({ won: true, score: this.score, seconds: this.clock.elapsed, cleared: this.pairsTaken * 2, total: this.total, headline: tr('You held the line'), tally: { label: tr('Pairs'), text: String(this.pairsTaken) }, notes: [tr('You held the line: +{n}', { n: bonus }), tr('{n} rows cleared', { n: this.rowsCleared }), ...(this.bestCombo > 1 ? [tr('Longest combo ×{n}', { n: this.bestCombo })] : [])] });
  }
  private lose() {
    if (this.ended) return;
    this.ended = true;
    this.host.finish({ won: false, score: this.score, seconds: this.clock.elapsed, cleared: Math.round(this.clock.elapsed), total: this.st.secs, tally: { label: tr('Pairs'), text: String(this.pairsTaken) }, notes: [tr('The rows crossed the line after {n} s', { n: Math.round(this.clock.elapsed) }), tr('{n} rows cleared', { n: this.rowsCleared })] });
  }
  dispose() {
    this.ended = true;
    this.line.removeFromParent();
    this.line.geometry.dispose();
    this.lineMat.dispose();
    this.host.board.fitExtra = null;
  }
}

registerMiniGame({
  id: 'survival',
  title: tr('Mahjong Survival'),
  blurb: tr('Rows of tiles creep toward you. Match the free ends fast and hold the line.'),
  minutes: tr('2–3 min'),
  order: 85,
  icon: { kinds: [3, 30, 14, 24, 7, 31, 16, 20], shape: 'rows' },
  levels: ['easy', 'medium', 'hard'],
  layered: true,
  dynamicKinds: true,
  howTo: [
    tr('A tile is free at either end of its row. Tap two matching free tiles to take them.'),
    tr('Every few seconds a new row slides in at the far side and pushes the others toward you.'),
    tr('If a row would cross the gold line at your edge, the game ends. Clearing a whole row pulls the rest back.'),
    tr('Last until the clock runs out to win.'),
  ],
  tools: { hint: true, shuffle: true },
  reward: (r, level) => (r.won ? Math.round(Math.min(200, 60 + r.score * 0.12) * PAY[level] - r.hints * 4 - r.shuffles * 6) : Math.round((r.cleared / Math.max(1, r.total)) * 30 * PAY[level])),
  start: (host) => new SurvivalSession(host),
});
