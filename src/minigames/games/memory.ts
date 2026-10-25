// Mahjong Memory: tiles lie face down on your table. Turn two at a time; a
// matching pair stays out, any other pair turns back over. Fewer turns score more.

import * as THREE from 'three';
import { tr } from '../../i18n';
import { registerMiniGame } from '../registry';
import { FLAT, FLAT_DOWN } from '../board';
import { GameClock, pairsFromSet } from '../helpers';
import type { MiniHost, MiniLevel, MiniSession } from '../types';

const GRID: Record<MiniLevel, [number, number]> = { easy: [4, 4], medium: [6, 4], hard: [6, 6] };
const PAY: Record<MiniLevel, number> = { easy: 1, medium: 1.6, hard: 2.4 };

class MemorySession implements MiniSession {
  private kinds: number[];
  private up = new Set<number>();
  private done = new Set<number>();
  private open: number[] = [];
  private turns = 0;
  private misses = 0;
  private streak = 0;
  private best = 0;
  private score = 0;
  private clock = new GameClock();
  private ended = false;
  private busy = false;
  private w: number;
  private h: number;
  /** How many times each tile has been seen face up (a miss on a tile you have seen counts against you). */
  private seen = new Map<number, number>();
  private peeks: number;

  constructor(private host: MiniHost) {
    [this.w, this.h] = GRID[host.level];
    // Portrait phones get the long side running up the screen, for bigger tiles.
    if (window.innerHeight > window.innerWidth && this.w > this.h) [this.w, this.h] = [this.h, this.w];
    const pairs = pairsFromSet((this.w * this.h) / 2, host.rng);
    // Pairs of identical tiles (no flower or season mixing in Memory).
    this.kinds = host.rng.shuffle(pairs.flatMap(([a]) => [a, a]));
    this.peeks = host.level === 'easy' ? 2 : host.level === 'medium' ? 1 : 0;
    // Low enough that the lamp's glare on the lacquered backs falls off the board.
    host.camera.home = { yaw: 0, pitch: 56 };
    host.camera.reset();
    host.board.build(this.kinds.map((kind, i) => ({ id: i, kind, pos: this.world(i), quat: FLAT_DOWN })));
    host.fit(true);
    this.refresh();
    // A short look at every tile before they turn over, on the gentler levels.
    if (host.level === 'easy') this.peekAll(1.6);
  }

  private world(i: number, lift = 0) {
    const b = this.host.board;
    const x = i % this.w,
      y = Math.floor(i / this.w);
    return new THREE.Vector3((x - (this.w - 1) / 2) * (b.w + 0.06), b.d / 2 + lift, (y - (this.h - 1) / 2) * (b.h + 0.06));
  }

  private flip(i: number, faceUp: boolean, delay = 0) {
    const b = this.host.board;
    b.moveTo(i, { pos: this.world(i), quat: faceUp ? FLAT : FLAT_DOWN }, { dur: 0.32, arc: 0.18, delay });
  }

  private refresh() {
    this.host.setStat('left', String((this.kinds.length - this.done.size) / 2), tr('Pairs'));
    this.host.setStat('moves', String(this.turns), tr('Turns'));
    this.host.setStat('score', String(this.score), tr('Score'));
    this.host.refreshButtons();
  }

  onPick(id: number) {
    if (this.ended || this.busy || this.done.has(id) || this.up.has(id)) return;
    this.up.add(id);
    this.open.push(id);
    this.seen.set(id, (this.seen.get(id) ?? 0) + 1);
    this.flip(id, true);
    this.host.sound('click');
    if (this.open.length < 2) return;
    const [a, b] = this.open;
    this.open = [];
    this.turns++;
    if (this.kinds[a] === this.kinds[b]) {
      this.done.add(a).add(b);
      this.streak++;
      this.best = Math.max(this.best, this.streak);
      this.score += 20 + 10 * (this.streak - 1);
      this.host.sound('pung');
      window.setTimeout(() => {
        const bd = this.host.board;
        const mid = bd.pose(a)!.pos.add(bd.pose(b)!.pos).multiplyScalar(0.5);
        bd.remove(a, { to: mid });
        bd.remove(b, { to: mid });
        this.host.burst(mid.clone().setY(0.3));
      }, 450);
      if (this.done.size === this.kinds.length) window.setTimeout(() => this.win(), 900);
    } else {
      this.streak = 0;
      this.misses++;
      this.busy = true;
      window.setTimeout(() => {
        this.up.delete(a);
        this.up.delete(b);
        this.flip(a, false);
        this.flip(b, false, 0.05);
        this.busy = false;
      }, 900);
    }
    this.refresh();
  }

  /** Turn every tile face up for a moment. */
  private peekAll(sec: number) {
    this.busy = true;
    const hidden = this.kinds.map((_, i) => i).filter((i) => !this.done.has(i) && !this.up.has(i));
    hidden.forEach((i, n) => this.flip(i, true, n * 0.012));
    window.setTimeout(() => {
      hidden.forEach((i, n) => this.flip(i, false, n * 0.012));
      window.setTimeout(() => (this.busy = false), 400);
    }, sec * 1000);
  }

  /** The hint is a peek: every tile shows for a second. */
  hint() {
    if (this.ended || this.busy || this.peeks <= 0) return false;
    this.peeks--;
    this.score = Math.max(0, this.score - 15);
    this.peekAll(1.1);
    this.refresh();
    return true;
  }
  canUse(tool: 'hint' | 'shuffle') {
    return !this.ended && tool === 'hint' && this.peeks > 0;
  }
  badges() {
    return { hint: String(this.peeks) };
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
    const pairs = this.kinds.length / 2;
    // Perfect memory clears in `pairs` turns; each extra turn costs a little.
    const bonus = Math.max(0, Math.round(pairs * 12 - (this.turns - pairs) * 6 - this.clock.elapsed / 3));
    this.score += bonus;
    this.host.finish({ won: true, score: this.score, seconds: this.clock.elapsed, cleared: this.kinds.length, total: this.kinds.length, notes: [tr('{n} turns for {p} pairs', { n: this.turns, p: pairs }), ...(this.best > 1 ? [tr('Best run of pairs ×{n}', { n: this.best })] : [])] });
  }
  dispose() {
    this.ended = true;
  }
}

registerMiniGame({
  id: 'memory',
  pauseHints: false,
  title: tr('Mahjong Memory'),
  blurb: tr('Tiles lie face down. Turn two at a time and remember where each one hides.'),
  minutes: tr('2–4 min'),
  order: 60,
  ownPortraitCamera: true,
  icon: { kinds: [27, 27, 13, 13], shape: 'pair' },
  levels: ['easy', 'medium', 'hard'],
  howTo: [tr('Tap a tile to turn it over, then tap another.'), tr('A matching pair stays out; any other pair turns back face down.'), tr('Clear the table in as few turns as you can. Hints give you a quick look at every tile.')],
  tools: { hint: true },
  reward: (r, level) => (r.won ? Math.round((30 + r.total * 1.4) * PAY[level] - r.hints * 6) : 0),
  start: (host) => new MemorySession(host),
});
