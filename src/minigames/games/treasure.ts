// Mahjong Treasure Hunt: the flowers and seasons are hidden under a field of
// face-down tiles. Each dig turns a tile over: a treasure, or a Dots tile
// counting the treasures on the eight tiles around it (the White Dragon means
// none, and its empty neighbours turn over for free). Read the clues and find
// every treasure before your digs run out.

import * as THREE from 'three';
import { tr } from '../../i18n';
import { registerMiniGame } from '../registry';
import { FLAT, FLAT_DOWN } from '../board';
import { FLOWER_KINDS, GameClock, SEASON_KINDS } from '../helpers';
import type { Rng } from '../../engine/rng';
import type { MiniHost, MiniLevel, MiniSession } from '../types';

const SETUP: Record<MiniLevel, { w: number; h: number; treasures: number; digs: number }> = {
  easy: { w: 6, h: 6, treasures: 6, digs: 20 },
  medium: { w: 7, h: 7, treasures: 9, digs: 24 },
  hard: { w: 8, h: 8, treasures: 12, digs: 27 },
};
const HINTS: Record<MiniLevel, number> = { easy: 5, medium: 3, hard: 2 };
const PAY: Record<MiniLevel, number> = { easy: 1, medium: 1.5, hard: 2.2 };
/** The clue tiles: White Dragon for none, then one to eight Dots. */
export const clueKind = (n: number) => (n === 0 ? 33 : 9 + n - 1);

/** Pure rules (tests use this). */
export class Hunt {
  open = new Set<number>();
  constructor(
    readonly w: number,
    readonly h: number,
    readonly treasure: Set<number>,
  ) {}
  around(i: number): number[] {
    const x = i % this.w,
      y = Math.floor(i / this.w);
    const out: number[] = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx,
          ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < this.w && ny < this.h) out.push(ny * this.w + nx);
      }
    return out;
  }
  clue(i: number) {
    return this.around(i).filter((j) => this.treasure.has(j)).length;
  }
  kindAt(i: number, treasureKinds: number[]) {
    return this.treasure.has(i) ? treasureKinds[[...this.treasure].sort((a, b) => a - b).indexOf(i) % treasureKinds.length] : clueKind(this.clue(i));
  }
  /** Dig a tile: the tiles that turn over (an empty clue opens its neighbours too). */
  dig(i: number): number[] {
    if (this.open.has(i)) return [];
    const out: number[] = [];
    const stack = [i];
    while (stack.length) {
      const c = stack.pop()!;
      if (this.open.has(c)) continue;
      this.open.add(c);
      out.push(c);
      if (!this.treasure.has(c) && this.clue(c) === 0) for (const n of this.around(c)) if (!this.open.has(n) && !this.treasure.has(n)) stack.push(n);
    }
    return out;
  }
  get found() {
    return [...this.treasure].filter((t) => this.open.has(t)).length;
  }
  /** A hidden tile the open clues prove is a treasure, or -1. */
  proven(): number {
    for (const c of this.open) {
      if (this.treasure.has(c)) continue;
      const hidden = this.around(c).filter((j) => !this.open.has(j));
      const known = this.around(c).filter((j) => this.open.has(j) && this.treasure.has(j)).length;
      if (hidden.length && this.clue(c) - known === hidden.length) return hidden[0];
    }
    return -1;
  }
}

/** A field with the treasures spread out (never three in a 2x2 block), and an empty start tile. */
export function dealHunt(w: number, h: number, n: number, rng: Rng): { hunt: Hunt; start: number } {
  for (;;) {
    const cells = rng.shuffle(Array.from({ length: w * h }, (_, i) => i));
    const t = new Set<number>();
    for (const c of cells) {
      if (t.size >= n) break;
      const x = c % w,
        y = Math.floor(c / w);
      let crowded = false;
      for (const [bx, by] of [[x - 1, y - 1], [x, y - 1], [x - 1, y], [x, y]])
        if (bx >= 0 && by >= 0 && bx + 1 < w && by + 1 < h && [0, 1, w, w + 1].filter((d) => t.has(by * w + bx + d)).length >= 2) crowded = true;
      if (crowded) continue;
      t.add(c);
    }
    const hunt = new Hunt(w, h, t);
    const zeros = cells.filter((c) => !t.has(c) && hunt.clue(c) === 0);
    if (t.size === n && zeros.length) return { hunt, start: zeros[0] };
  }
}

class TreasureSession implements MiniSession {
  private g: Hunt;
  private kinds: number[];
  private digs: number;
  private hints: number;
  private clock = new GameClock();
  private ended = false;
  private busy = false;
  private hintCell = -1;
  private st: (typeof SETUP)['easy'];

  constructor(private host: MiniHost) {
    this.st = SETUP[host.level];
    const { hunt, start } = dealHunt(this.st.w, this.st.h, this.st.treasures, host.rng);
    this.g = hunt;
    const treasureKinds = host.rng.shuffle([...FLOWER_KINDS, ...SEASON_KINDS]);
    this.kinds = Array.from({ length: this.st.w * this.st.h }, (_, i) => hunt.kindAt(i, treasureKinds));
    this.digs = this.st.digs;
    this.hints = HINTS[host.level];
    host.camera.home = { yaw: 0, pitch: 62 };
    host.camera.reset();
    host.board.build(this.kinds.map((kind, i) => ({ id: i, kind, pos: this.world(i), quat: FLAT_DOWN })));
    host.fit(true);
    // The first clear patch is turned over for you.
    window.setTimeout(() => !this.ended && this.turn(this.g.dig(start)), 450);
    this.refresh();
  }

  private world(i: number) {
    const b = this.host.board;
    const x = i % this.st.w,
      y = Math.floor(i / this.st.w);
    return new THREE.Vector3((x - (this.st.w - 1) / 2) * (b.w + 0.05), b.d / 2, (y - (this.st.h - 1) / 2) * (b.h + 0.05));
  }

  /** Turn tiles face up, rippling out. */
  private turn(cells: number[]) {
    const b = this.host.board;
    cells.forEach((c, n) => b.moveTo(c, { pos: this.world(c), quat: FLAT }, { dur: 0.3, arc: 0.16, delay: Math.min(0.6, n * 0.03) }));
    this.refresh();
  }

  private refresh() {
    this.host.board.looks((id) => {
      if (id === this.hintCell) return 'hint';
      if (this.g.open.has(id) && this.g.treasure.has(id)) return 'free';
      return 'normal';
    });
    this.host.setStat('left', `${this.g.found} / ${this.st.treasures}`, tr('Treasures'));
    this.host.setStat('moves', String(this.digs), tr('Digs left'));
    this.host.refreshButtons();
  }

  onPick(id: number) {
    if (this.ended || this.busy || this.g.open.has(id)) return;
    this.hintCell = -1;
    this.digs--;
    const opened = this.g.dig(id);
    this.turn(opened);
    if (this.g.treasure.has(id)) {
      this.host.sound('pung');
      window.setTimeout(() => this.host.burst(this.world(id).setY(0.3)), 300);
      this.host.toast(tr('Treasure!'), 'good');
    } else this.host.sound(opened.length > 1 ? 'shuffle' : 'click');
    this.refresh();
    // The hunt is decided: no more digs while the end shows.
    if (this.g.found === this.st.treasures) {
      this.busy = true;
      window.setTimeout(() => this.end(true), 700);
    } else if (this.digs <= 0) {
      this.busy = true;
      window.setTimeout(() => this.end(false), 700);
    }
  }

  suggest(): number[] | null {
    if (this.ended || this.busy) return [];
    const p = this.g.proven();
    return p >= 0 ? [p] : [];
  }
  hint() {
    if (this.ended || this.hints <= 0) return false;
    const p = this.g.proven();
    if (p < 0) {
      this.host.toast(tr('The clues do not prove a treasure yet. Dig near the higher numbers.'), 'info');
      return false;
    }
    this.hints--;
    this.hintCell = p;
    this.refresh();
    return true;
  }
  canUse(tool: 'hint' | 'shuffle') {
    return !this.ended && tool === 'hint' && this.hints > 0;
  }
  badges() {
    return { hint: String(this.hints) };
  }

  tick(dt: number) {
    if (this.ended) return;
    this.clock.tick(dt);
    this.host.setStat('time', this.clock.text(), tr('Time'));
  }
  pause(p: boolean) {
    this.clock.paused = p;
  }

  private end(won: boolean) {
    if (this.ended) return;
    this.ended = true;
    const found = this.g.found;
    // The rest of the field turns over at the end.
    const hidden = this.kinds.map((_, i) => i).filter((i) => !this.g.open.has(i));
    hidden.forEach((i) => this.g.open.add(i));
    this.turn(hidden);
    const score = found * 60 + (won ? this.digs * 15 + Math.max(0, 120 - Math.round(this.clock.elapsed / 2)) : 0);
    this.host.finish({
      won,
      score,
      seconds: this.clock.elapsed,
      cleared: found,
      total: this.st.treasures,
      headline: tr('Every treasure found'),
      tally: { label: tr('Treasures'), text: `${found} / ${this.st.treasures}` },
      notes: [tr('{n} of {t} treasures found', { n: found, t: this.st.treasures }), ...(won ? [tr('{n} digs to spare', { n: this.digs })] : [tr('Out of digs')])],
    });
  }
  dispose() {
    this.ended = true;
  }
}

registerMiniGame({
  id: 'treasure',
  pauseHints: true,
  title: tr('Mahjong Treasure Hunt'),
  blurb: tr('Flowers and seasons lie buried under face-down tiles. Read the Dots clues and dig them up.'),
  minutes: tr('2–5 min'),
  order: 90,
  icon: { kinds: [35, 10, 33, 11, 40], shape: 'chest' },
  levels: ['easy', 'medium', 'hard'],
  howTo: [
    tr('Tap a face-down tile to dig. Each dig turns one tile over.'),
    tr('A Dots tile counts the treasures on the eight tiles around it. A White Dragon means none, and the tiles around it turn over for free.'),
    tr('Find every flower and season before your digs run out. A hint lights a tile the clues prove is treasure.'),
  ],
  tools: { hint: true },
  daily: true,
  reward: (r, level) => (r.won ? Math.round(Math.min(200, 50 + r.score * 0.18) * PAY[level] - r.hints * 6) : Math.round((r.cleared / Math.max(1, r.total)) * 30 * PAY[level])),
  start: (host) => new TreasureSession(host),
});
