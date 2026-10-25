// A game of Mahjong Solitaire on the 3D board. The same session plays the
// classic game, Mahjong Tower (tall layouts), Timed Mahjong (a countdown with
// time back for every pair) and Mahjong Blitz (fresh boards until the clock
// runs out). Rules live in logic.ts.

import * as THREE from 'three';
import { Rng } from '../../../engine/rng';
import { tr } from '../../../i18n';
import { FLAT, type TileLook } from '../../board';
import { GameClock, fmtClock, freeLook } from '../../helpers';
import type { MiniHost, MiniLevel, MiniSession } from '../../types';
import { layoutById, type Layout, type Slot } from './layouts';
import { Solitaire, deal } from './logic';

export interface SolitaireMode {
  /** 'classic' counts up; 'timed' counts down with time back per pair; 'blitz' deals new boards until time is up. */
  clock: 'classic' | 'timed' | 'blitz';
  /** Seconds on the clock for timed and blitz. */
  seconds?: number;
  /** Camera elevation at rest (towers look from lower down). */
  pitch?: number;
  /** Mahjong Shuffle: the tiles left change places by themselves after this many pairs. */
  reshuffleEvery?: number;
}

const HINTS: Record<MiniLevel, number> = { easy: Infinity, medium: 5, hard: 2 };
const SHUFFLES: Record<MiniLevel, number> = { easy: Infinity, medium: 3, hard: 1 };
/** Seconds between pairs that still count as a combo. */
const COMBO_GAP = 4;

export class SolitaireSession implements MiniSession {
  private g!: Solitaire;
  private layout: Layout;
  private sel: number | null = null;
  private hintPair: [number, number] | null = null;
  private hintUntil = 0;
  private clock: GameClock;
  private score = 0;
  private combo = 0;
  private bestCombo = 0;
  private lastPair = -99;
  private hintsLeft: number;
  private shufflesLeft: number;
  private ended = false;
  private boards = 0;
  private clearedTotal = 0;
  private stuck = false;
  private pairsDone = 0;
  private rng: Rng;

  constructor(private host: MiniHost, private mode: SolitaireMode, layoutIds: string[]) {
    const pick = host.options.layout && host.options.layout !== 'random' ? host.options.layout : layoutIds[host.rng.int(layoutIds.length)];
    this.layout = layoutById(pick);
    this.rng = host.rng;
    this.hintsLeft = HINTS[host.level];
    this.shufflesLeft = SHUFFLES[host.level];
    this.clock = new GameClock(mode.clock === 'classic' ? 0 : mode.seconds ?? 300);
    host.camera.home = { yaw: 0, pitch: mode.pitch ?? 66 };
    host.camera.reset();
    this.newBoard(true);
  }

  variant() {
    return this.layout.id;
  }

  // ------------------------------------------------------------ board

  private worldOf(s: Slot): THREE.Vector3 {
    const b = this.host.board;
    const xs = this.layout.slots.map((q) => q.x),
      ys = this.layout.slots.map((q) => q.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2,
      cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    return new THREE.Vector3((s.x - cx) * (b.w + 0.012), b.d / 2 + s.z * (b.d + 0.004), (s.y - cy) * (b.h + 0.014));
  }

  private newBoard(first: boolean) {
    const near = this.host.level === 'easy' ? 0.6 : this.host.level === 'medium' ? 0.25 : 0;
    const d = deal(this.layout.slots, this.rng, near);
    this.g = new Solitaire(this.layout.slots, d.kinds);
    const b = this.host.board;
    b.build(
      d.kinds.map((kind, id) => {
        const pos = this.worldOf(this.layout.slots[id]);
        return { id, kind, pos: first ? pos : pos.clone().add(new THREE.Vector3(0, 2.5 + this.layout.slots[id].z * 0.3, 0)), quat: FLAT };
      }),
    );
    if (!first) {
      // Tiles drop into place, top layers last.
      d.kinds.forEach((_, id) => b.moveTo(id, { pos: this.worldOf(this.layout.slots[id]) }, { dur: 0.45, delay: 0.004 * id + this.layout.slots[id].z * 0.05 }));
      this.host.sound('shuffle');
    }
    this.sel = null;
    this.stuck = false;
    this.host.fit(first);
    this.refresh();
  }

  /** Looks: selected, hinted, and (on easier levels) blocked tiles dimmed. */
  private refresh() {
    const b = this.host.board;
    const now = performance.now() / 1000;
    const free = new Set(this.g.freeTiles());
    b.looks((id): TileLook => {
      if (id === this.sel) return 'selected';
      if (this.hintPair && now < this.hintUntil && this.hintPair.includes(id)) return 'hint';
      return freeLook(free.has(id));
    });
    this.host.setStat('left', String(this.g.left), tr('Tiles'));
    this.host.setStat('score', String(this.score), tr('Score'));
    this.host.setStat('moves', String(this.g.pairs().length), tr('Moves'));
    this.host.setStat('combo', this.combo > 1 ? `×${this.combo}` : null, tr('Combo'));
    this.host.refreshButtons();
  }

  // ------------------------------------------------------------ play

  onPick(id: number) {
    if (this.ended || !this.g.alive[id]) return;
    const b = this.host.board;
    if (!this.g.isFree(id)) {
      // A blocked tile gives a little shake.
      b.shake(id);
      this.host.sound('click');
      return;
    }
    if (this.sel === null || this.sel === id) {
      this.sel = this.sel === id ? null : id;
      this.host.sound('click');
      this.refresh();
      return;
    }
    if (this.g.canMatch(this.sel, id)) {
      this.match(this.sel, id);
      return;
    }
    this.sel = id;
    this.host.sound('click');
    this.refresh();
  }

  private match(a: number, b: number) {
    const board = this.host.board;
    this.g.remove(a, b);
    this.sel = null;
    this.hintPair = null;
    this.pairsDone++;
    const t = this.clock.elapsed;
    this.combo = t - this.lastPair <= COMBO_GAP ? this.combo + 1 : 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.lastPair = t;
    this.score += 10 + (this.combo > 1 ? 5 * (this.combo - 1) : 0);
    if (this.mode.clock === 'timed') this.clock.add(this.host.level === 'hard' ? 2 : 3);
    // The two tiles rise and meet between them.
    const pa = board.pose(a)!.pos,
      pb = board.pose(b)!.pos;
    const mid = pa.clone().add(pb).multiplyScalar(0.5);
    board.remove(a, { to: mid });
    board.remove(b, { to: mid });
    window.setTimeout(() => this.host.burst(mid.clone().add(new THREE.Vector3(0, board.d * 3, 0))), 380);
    this.host.sound(this.combo > 2 ? 'kong' : 'pung');
    if (this.combo > 2) this.host.toast(tr('Combo ×{n}', { n: this.combo }), 'good');
    this.afterMove();
  }

  private afterMove() {
    if (this.g.left === 0) {
      this.clearedTotal += this.g.total;
      if (this.mode.clock === 'blitz' && !this.clock.over) {
        this.boards++;
        this.score += 50;
        this.host.toast(tr('Board cleared: +50'), 'good');
        window.setTimeout(() => !this.ended && this.newBoard(false), 700);
        this.refresh();
        return;
      }
      this.refresh();
      window.setTimeout(() => this.win(), 650);
      return;
    }
    const every = this.mode.reshuffleEvery;
    if (every && (this.pairsDone % every === 0 || !this.g.pairs().length)) {
      window.setTimeout(() => this.autoShuffle(), 520);
      this.refresh();
      return;
    }
    const moves = this.g.pairs().length;
    this.stuck = moves === 0;
    if (this.stuck) {
      if (this.shufflesLeft > 0) this.host.toast(tr('No more moves. Shuffle the tiles to carry on.'), 'bad');
      else window.setTimeout(() => this.lose(tr('No more moves')), 900);
    }
    this.refresh();
  }

  suggest(): number[] | null {
    if (this.ended) return [];
    const p = this.g.pairs();
    return p.length ? [...p[this.rng.int(p.length)]] : null;
  }

  hint(): boolean {
    if (this.ended || this.hintsLeft <= 0) return false;
    const pairs = this.g.pairs();
    if (!pairs.length) return false;
    // The pair that frees the most next: prefer tiles with others on their sides or below.
    this.hintPair = pairs[this.rng.int(pairs.length)];
    this.hintUntil = performance.now() / 1000 + 2.6;
    this.hintsLeft--;
    this.score = Math.max(0, this.score - 5);
    this.host.sound('click');
    this.refresh();
    window.setTimeout(() => this.refresh(), 2700);
    return true;
  }

  canUndo() {
    return !this.ended && this.g.history.length > 0;
  }

  undo(): boolean {
    if (!this.canUndo()) return false;
    const m = this.g.undo();
    if (!m) return false;
    const b = this.host.board;
    if (m.kind === 'pair') {
      for (const id of [m.a, m.b]) b.restore(id, { pos: this.worldOf(this.layout.slots[this.g.slotOf[id]]), quat: FLAT, scale: 1 });
      this.score = Math.max(0, this.score - 10);
      this.combo = 0;
      this.pairsDone = Math.max(0, this.pairsDone - 1);
    } else this.moveAll();
    this.sel = null;
    this.stuck = this.g.pairs().length === 0;
    this.host.sound('slide');
    this.refresh();
    return true;
  }

  canUse(tool: 'hint' | 'shuffle') {
    if (this.ended) return false;
    return tool === 'hint' ? this.hintsLeft > 0 && this.g.pairs().length > 0 : this.shufflesLeft > 0;
  }

  shuffle(): boolean {
    if (this.ended || this.shufflesLeft <= 0) return false;
    if (!this.g.shuffle(this.rng)) {
      this.host.toast(tr('These tiles cannot be cleared, whatever the order.'), 'bad');
      window.setTimeout(() => this.lose(tr('No more moves')), 1200);
      return false;
    }
    this.shufflesLeft--;
    this.sel = null;
    this.moveAll();
    this.host.sound('shuffle');
    this.stuck = false;
    this.refresh();
    return true;
  }

  /** Mahjong Shuffle: the board mixes itself, free of charge. */
  private autoShuffle() {
    if (this.ended || !this.g.left) return;
    if (!this.g.shuffle(this.rng)) return this.lose(tr('No more moves'));
    this.sel = null;
    this.hintPair = null;
    this.g.history = [];
    this.moveAll();
    this.host.sound('shuffle');
    this.host.toast(tr('The tiles change places'), 'info');
    this.refresh();
  }

  /** Glide every tile to its slot (after a shuffle), lifting over the others. */
  private moveAll() {
    const b = this.host.board;
    this.g.alive.forEach((alive, id) => {
      if (!alive) return;
      b.moveTo(id, { pos: this.worldOf(this.layout.slots[this.g.slotOf[id]]) }, { dur: 0.55, arc: 0.5, delay: (id % 17) * 0.012 });
    });
  }

  badges() {
    const n = (v: number) => (Number.isFinite(v) ? String(v) : undefined);
    return { hint: n(this.hintsLeft), shuffle: n(this.shufflesLeft) };
  }

  attention() {
    return this.stuck && this.shufflesLeft > 0 ? ('shuffle' as const) : null;
  }

  tick(dt: number) {
    if (this.ended) return;
    this.clock.tick(dt);
    if (this.combo && this.clock.elapsed - this.lastPair > COMBO_GAP) {
      this.combo = 0;
      this.host.setStat('combo', null);
    }
    this.host.setStat('time', this.clock.text(), this.mode.clock === 'classic' ? tr('Time') : tr('Left'));
    if (this.clock.over) {
      if (this.mode.clock === 'blitz') this.endBlitz();
      else this.lose(tr("Time's up"));
    }
  }

  pause(p: boolean) {
    this.clock.paused = p;
  }

  private win() {
    if (this.ended) return;
    this.ended = true;
    const secs = this.clock.elapsed;
    // Quicker clears earn a time bonus; timed games bank the seconds left.
    const timeBonus = this.mode.clock === 'timed' ? Math.round(this.clock.left * 2) : Math.max(0, Math.round(this.g.total * 3 - secs));
    this.score += timeBonus;
    this.host.finish({
      won: true,
      score: this.score,
      seconds: secs,
      cleared: this.g.total,
      total: this.g.total,
      notes: [tr('Layout: {name}', { name: layoutName(this.layout.id) }), ...(timeBonus ? [tr('Time bonus +{n}', { n: timeBonus })] : []), ...(this.bestCombo > 1 ? [tr('Longest combo ×{n}', { n: this.bestCombo })] : [])],
    });
  }

  private endBlitz() {
    if (this.ended) return;
    this.ended = true;
    const cleared = this.clearedTotal + (this.g.total - this.g.left);
    this.host.finish({
      won: this.pairsDone > 0,
      score: this.score,
      seconds: this.clock.elapsed,
      cleared,
      total: cleared,
      notes: [tr('{n} pairs cleared', { n: this.pairsDone }), ...(this.boards ? [tr('{n} boards cleared', { n: this.boards })] : []), ...(this.bestCombo > 1 ? [tr('Longest combo ×{n}', { n: this.bestCombo })] : [])],
    });
  }

  private lose(why: string) {
    if (this.ended) return;
    this.ended = true;
    this.host.finish({ won: false, score: this.score, seconds: this.clock.elapsed, cleared: this.g.total - this.g.left, total: this.g.total, notes: [why, tr('Layout: {name}', { name: layoutName(this.layout.id) })] });
  }

  dispose() {
    this.ended = true;
  }
}

/** Layout names in the player's language. */
export function layoutName(id: string): string {
  const names: Record<string, string> = {
    turtle: tr('Turtle'),
    pyramid: tr('Pyramid'),
    fortress: tr('Fortress'),
    butterfly: tr('Butterfly'),
    peaks: tr('Twin Peaks'),
    garden: tr('Garden'),
    tower: tr('Pagoda Tower'),
    'twin-towers': tr('Twin Towers'),
  };
  return names[id] ?? id;
}

export { fmtClock };
