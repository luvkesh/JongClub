// Mahjong Puzzle Rush: quick-fire set puzzles against the clock. Two tiles
// lie face up beside a face-down gap; pick the one tile of four that turns
// them into a set: a pung (three alike) or a run of three in one suit. Solve
// as many as you can; three wrong picks end the rush.
//
// Only one choice ever makes a set under any rules on the table, India Rules
// included: wrong choices never share the missing number in another suit
// (a mixed run there) or complete a run another way.

import * as THREE from 'three';
import { tr } from '../../i18n';
import { registerMiniGame } from '../registry';
import { FLAT, FLAT_DOWN } from '../board';
import { GameClock } from '../helpers';
import { rankOf } from '../../engine/tiles';
import type { Rng } from '../../engine/rng';
import type { MiniHost, MiniLevel, MiniSession } from '../types';

const SETUP: Record<MiniLevel, { secs: number; target: number; strikes: number }> = {
  easy: { secs: 90, target: 10, strikes: 3 },
  medium: { secs: 75, target: 14, strikes: 3 },
  hard: { secs: 60, target: 16, strikes: 3 },
};
const PAY: Record<MiniLevel, number> = { easy: 1, medium: 1.5, hard: 2.2 };

export interface RushPuzzle {
  /** The three spots of the set, with the gap at `gap`. */
  set: number[];
  gap: number;
  choices: number[];
  answer: number;
  type: 'pung' | 'run-end' | 'run-middle';
}

const suitOfKind = (k: number) => Math.floor(k / 9);

/** Whether three kinds make a set in any rules this table plays: a pung, a run in one suit, or (India Rules) a run across suits. */
export function makesSet(ks: number[]): boolean {
  const [a, b, c] = [...ks].sort((x, y) => x - y);
  if (a === b && b === c) return true;
  if (ks.some((k) => k >= 27)) return false;
  const r = ks.map(rankOf).sort((x, y) => x - y);
  // Runs, in one suit or (India Rules) mixed suits.
  return r[1] === r[0] + 1 && r[2] === r[1] + 1;
}

/** A puzzle with exactly one right choice. Harder levels use runs more and closer decoys. */
export function makePuzzle(rng: Rng, level: MiniLevel): RushPuzzle {
  for (;;) {
    const roll = rng.next();
    const type: RushPuzzle['type'] = roll < (level === 'easy' ? 0.45 : 0.3) ? 'pung' : roll < 0.7 ? 'run-end' : 'run-middle';
    let set: number[];
    let gap: number;
    if (type === 'pung') {
      const k = rng.int(34);
      set = [k, k, k];
      gap = rng.int(3);
    } else {
      const s = rng.int(3);
      const start = rng.int(7);
      set = [0, 1, 2].map((i) => s * 9 + start + i);
      gap = type === 'run-middle' ? 1 : rng.int(2) * 2;
    }
    const answer = set[gap];
    const shown = set.filter((_, i) => i !== gap);
    // Decoys: near the answer on harder levels (same suit, nearby numbers), never a second answer.
    const pool: number[] = [];
    for (let k = 0; k < 34; k++) {
      if (k === answer || makesSet([...shown, k])) continue;
      const near = answer < 27 && k < 27 && suitOfKind(k) === suitOfKind(answer) && Math.abs(rankOf(k) - rankOf(answer)) <= 2;
      const weight = level === 'easy' ? 1 : near ? (level === 'hard' ? 6 : 3) : 1;
      for (let w = 0; w < weight; w++) pool.push(k);
    }
    const decoys = new Set<number>();
    while (decoys.size < 3 && pool.length) decoys.add(pool[rng.int(pool.length)]);
    if (decoys.size < 3) continue;
    const choices = rng.shuffle([answer, ...decoys]);
    return { set, gap, choices, answer, type };
  }
}

class RushSession implements MiniSession {
  private st: (typeof SETUP)['easy'];
  private clock: GameClock;
  private p!: RushPuzzle;
  private solved = 0;
  private strikes = 0;
  private streak = 0;
  private bestStreak = 0;
  private score = 0;
  private busy = false;
  private ended = false;
  private wrong = new Set<number>();
  private hintId = -1;
  private hints: number;

  constructor(private host: MiniHost) {
    this.st = SETUP[host.level];
    this.clock = new GameClock(this.st.secs);
    this.hints = host.level === 'easy' ? 3 : 1;
    host.camera.home = { yaw: 0, pitch: 60 };
    host.camera.reset();
    this.next(true);
    host.fit(true);
  }

  /** Ids: 0..2 the set's spots, 10..13 the choices. */
  private spot(i: number) {
    const b = this.host.board;
    return new THREE.Vector3((i - 1) * (b.w + 0.04), b.d / 2, -b.h * 0.85);
  }
  private choice(i: number) {
    const b = this.host.board;
    return new THREE.Vector3((i - 1.5) * (b.w + 0.22), b.d / 2, b.h * 0.95);
  }

  private next(first = false) {
    this.p = makePuzzle(this.host.rng, this.host.level);
    this.wrong.clear();
    this.hintId = -1;
    const b = this.host.board;
    const specs = [
      ...this.p.set.map((kind, i) => ({ id: i, kind: i === this.p.gap ? this.p.answer : kind, pos: this.spot(i), quat: i === this.p.gap ? FLAT_DOWN : FLAT })),
      ...this.p.choices.map((kind, i) => ({ id: 10 + i, kind, pos: this.choice(i).setY(b.d / 2 + (first ? 0 : 0.6)), quat: FLAT })),
    ];
    b.build(specs);
    if (!first) this.p.choices.forEach((_, i) => b.moveTo(10 + i, { pos: this.choice(i) }, { dur: 0.25, delay: i * 0.04 }));
    this.busy = false;
    const q = this.p.type === 'pung' ? tr('Which tile makes a pung?') : tr('Which tile completes the run?');
    this.host.setStat('status', q, tr('Puzzle'));
    this.refresh();
  }

  private refresh() {
    this.host.board.looks((id) => (this.wrong.has(id) ? 'locked' : id === this.hintId ? 'hint' : 'normal'));
    this.host.setStat('left', `${this.solved} / ${this.st.target}`, tr('Solved'));
    this.host.setStat('score', String(this.score), tr('Score'));
    this.host.setStat('moves', `${this.st.strikes - this.strikes}`, tr('Lives'));
    this.host.setStat('combo', this.streak > 1 ? `×${this.streak}` : null, tr('Streak'));
    this.host.refreshButtons();
  }

  onPick(id: number) {
    if (this.ended || this.busy || id < 10 || this.wrong.has(id)) return;
    const kind = this.p.choices[id - 10];
    const b = this.host.board;
    if (kind === this.p.answer) {
      this.busy = true;
      this.solved++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      const pts = 100 + 25 * Math.min(8, this.streak - 1);
      this.score += pts;
      // The face-down tile lifts away and the pick slides into the gap.
      b.remove(this.p.gap, { dur: 0.2 });
      b.moveTo(id, { pos: this.spot(this.p.gap) }, { dur: 0.32, arc: 0.2 });
      this.host.sound('pung');
      window.setTimeout(() => this.host.burst(this.spot(1).setY(0.3), this.streak >= 5), 280);
      if (this.streak >= 3 && this.streak % 3 === 0) this.host.toast(tr('Streak ×{n}', { n: this.streak }), 'good');
      this.refresh();
      if (this.solved >= this.st.target) {
        window.setTimeout(() => this.end(true), 650);
        return;
      }
      window.setTimeout(() => !this.ended && this.next(), 650);
    } else {
      this.strikes++;
      this.streak = 0;
      this.wrong.add(id);
      b.shake(id);
      this.host.sound('click');
      this.host.toast(this.strikes >= this.st.strikes ? tr('Out of lives') : tr('Not a set. {n} lives left.', { n: this.st.strikes - this.strikes }), 'bad');
      this.refresh();
      if (this.strikes >= this.st.strikes) window.setTimeout(() => this.end(false), 700);
    }
  }

  suggest(): number[] | null {
    // A rush is about finding it yourself: no pause suggestions.
    return [];
  }
  hint() {
    if (this.ended || this.busy || this.hints <= 0) return false;
    this.hints--;
    this.hintId = 10 + this.p.choices.indexOf(this.p.answer);
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
    this.host.setStat('time', this.clock.text(), tr('Left'));
    if (this.clock.over) this.end(this.solved >= this.st.target);
  }
  pause(p: boolean) {
    this.clock.paused = p;
  }
  private end(won: boolean) {
    if (this.ended) return;
    this.ended = true;
    const bonus = won ? Math.round(this.clock.left) * 10 : 0;
    this.score += bonus;
    this.host.finish({
      won,
      score: this.score,
      seconds: this.clock.elapsed,
      cleared: this.solved,
      total: this.st.target,
      headline: tr('Rush complete'),
      tally: { label: tr('Solved'), text: `${this.solved} / ${this.st.target}` },
      notes: [tr('{n} puzzles solved', { n: this.solved }), ...(bonus ? [tr('Time bonus +{n}', { n: bonus })] : []), ...(this.bestStreak > 2 ? [tr('Best streak ×{n}', { n: this.bestStreak })] : [])],
    });
  }
  dispose() {
    this.ended = true;
  }
}

registerMiniGame({
  id: 'rush',
  pauseHints: false,
  title: tr('Mahjong Puzzle Rush'),
  blurb: tr('Quick-fire set puzzles: pick the tile that makes a pung or completes a run, against the clock.'),
  minutes: tr('1–2 min'),
  order: 65,
  icon: { kinds: [12, 13, 14, 30, 5], shape: 'quiz' },
  levels: ['easy', 'medium', 'hard'],
  ownPortraitCamera: true,
  howTo: [
    tr('Two tiles lie face up beside a face-down gap. Tap the one tile of the four below that fills the gap to make a set.'),
    tr('A set is a pung (three alike) or a run (three numbers in a row). Every puzzle has exactly one right answer.'),
    tr('Right answers in a row build a streak worth more points. Three wrong picks end the rush.'),
    tr('Solve the target number of puzzles before the clock runs out.'),
  ],
  tools: { hint: true },
  reward: (r, level) => (r.won ? Math.round(Math.min(200, 50 + r.score * 0.06) * PAY[level] - r.hints * 8) : Math.round((r.cleared / Math.max(1, r.total)) * 35 * PAY[level])),
  start: (host) => new RushSession(host),
});
