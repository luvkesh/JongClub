// Mahjong Boss Challenge: a giant tile stands at the far end of your table.
// Clear pairs as in Mahjong Connect (a path of up to two turns) and every pair
// strikes the boss; quick pairs strike harder. The boss fights back: it locks
// tiles, scrambles the wall or heals. Bring it down before the clock runs out.
// A cleared wall is dealt again until the boss falls.

import * as THREE from 'three';
import { tr } from '../../i18n';
import { registerMiniGame } from '../registry';
import { FLAT, UPRIGHT } from '../board';
import { GameClock, goldMaterial, matchGroup } from '../helpers';
import type { MiniHost, MiniLevel, MiniSession } from '../types';
import { Connect, dealConnect, type Cell } from './connect/logic';

interface Boss {
  name: string;
  kind: number;
  hp: number;
  /** Seconds between attacks. */
  every: number;
  secs: number;
  /** Tiles a freeze locks, and for how long. */
  lock: number;
  attacks: ('lock' | 'scramble' | 'heal')[];
}
const BOSSES: Record<MiniLevel, Boss> = {
  easy: { name: tr('Jade Guardian'), kind: 32, hp: 160, every: 22, secs: 240, lock: 4, attacks: ['lock', 'heal'] },
  medium: { name: tr('North Wind Spirit'), kind: 30, hp: 260, every: 17, secs: 210, lock: 5, attacks: ['lock', 'scramble', 'heal'] },
  hard: { name: tr('Red Dragon King'), kind: 31, hp: 360, every: 13, secs: 180, lock: 6, attacks: ['lock', 'scramble', 'lock', 'heal'] },
};
const SIZES: Record<MiniLevel, [number, number]> = { easy: [8, 6], medium: [10, 6], hard: [10, 7] };
const SHUFFLES: Record<MiniLevel, number> = { easy: Infinity, medium: 3, hard: 2 };
const HINTS: Record<MiniLevel, number> = { easy: Infinity, medium: 4, hard: 2 };
const PAY: Record<MiniLevel, number> = { easy: 1, medium: 1.5, hard: 2.2 };
const BOSS_ID = 100000;
const LOCK_SECS = 8;

/** Damage for a pair in a combo of `combo` quick pairs. */
export const strike = (combo: number) => 10 + 5 * Math.min(6, combo - 1);

class BossSession implements MiniSession {
  private g!: Connect;
  private w: number;
  private h: number;
  private boss: Boss;
  private hp: number;
  private clock: GameClock;
  private nextAttack: number;
  private attackN = 0;
  /** Locked cells and when they free up (clock seconds). */
  private locked = new Map<number, number>();
  private sel: number | null = null;
  private combo = 0;
  private lastPair = -99;
  private bestCombo = 0;
  private pairs = 0;
  private walls = 1;
  private hints: number;
  private shuffles: number;
  private ended = false;
  /** Set by dispose (a restart or leaving): late timers must not touch the next game. */
  private disposed = false;
  private hintTok = 0;
  private hintPair: number[] = [];
  private lines = new THREE.Group();
  private lineMat = goldMaterial(1);
  private fade = 0;

  constructor(private host: MiniHost) {
    [this.w, this.h] = SIZES[host.level];
    this.boss = BOSSES[host.level];
    this.hp = this.boss.hp;
    this.clock = new GameClock(this.boss.secs);
    this.nextAttack = this.boss.every;
    this.hints = HINTS[host.level];
    this.shuffles = SHUFFLES[host.level];
    host.board.root.add(this.lines);
    host.camera.home = { yaw: 0, pitch: 58 };
    host.camera.reset();
    this.deal();
    host.fit(true);
    host.toast(tr('{boss} blocks your way!', { boss: this.boss.name }), 'info');
  }

  /** Deal a fresh wall (the start, and whenever a wall is cleared). */
  private deal() {
    this.g = new Connect(this.w, this.h, dealConnect(this.w, this.h, this.host.rng), 'none');
    this.locked.clear();
    this.sel = null;
    const b = this.host.board;
    const specs = this.g.cells.map((kind, i) => ({ id: i, kind, pos: this.world(i % this.w, Math.floor(i / this.w)), quat: FLAT }));
    // The boss: a great tile standing beyond the wall, facing you.
    specs.push({ id: BOSS_ID, kind: this.boss.kind, pos: this.bossPos(), quat: UPRIGHT });
    b.build(specs);
    b.place(BOSS_ID, { scale: 2.6 });
    const bp = this.bossPos();
    b.fitExtra = new THREE.Box3(bp.clone().add(new THREE.Vector3(-b.w * 1.5, -bp.y, -0.1)), bp.clone().add(new THREE.Vector3(b.w * 1.5, bp.y, 0.1)));
    this.refresh();
  }

  /** Portrait phones turn the board a quarter (columns become rows) so its tiles can be larger; the rules don't change. */
  private turned = typeof window !== 'undefined' && window.innerWidth / Math.max(1, window.innerHeight) < 0.85;

  private world(x: number, y: number, lift = 0) {
    const b = this.host.board;
    if (this.turned) return new THREE.Vector3((y - (this.h - 1) / 2) * (b.w + 0.02), b.d / 2 + lift, (x - (this.w - 1) / 2) * (b.h + 0.02) + 0.35);
    return new THREE.Vector3((x - (this.w - 1) / 2) * (b.w + 0.02), b.d / 2 + lift, (y - (this.h - 1) / 2) * (b.h + 0.02) + 0.35);
  }
  private bossPos() {
    const b = this.host.board;
    return new THREE.Vector3(0, (b.h * 2.6) / 2, this.world(0, 0).z - b.h * 1.9);
  }

  private refresh() {
    this.host.board.looks((id) => {
      if (id === BOSS_ID) return 'normal';
      if (this.locked.has(id)) return 'locked';
      if (id === this.sel) return 'selected';
      if (this.hintPair.includes(id)) return 'hint';
      return 'normal';
    });
    const pct = Math.max(0, Math.round((this.hp / this.boss.hp) * 100));
    this.host.setStat('status', `${this.boss.name} · ${pct}%`, tr('Boss'));
    this.host.setStat('left', String(Math.max(0, this.hp)), tr('Boss health'));
    this.host.setStat('combo', this.combo > 1 ? `×${this.combo}` : null, tr('Combo'));
    this.host.refreshButtons();
  }

  /** Pairs that can go now, leaving locked tiles out. */
  private open(limit = 8) {
    return this.g.pairs(40).filter(([a, b]) => !this.locked.has(a) && !this.locked.has(b)).slice(0, limit);
  }

  onPick(id: number) {
    if (this.ended || id === BOSS_ID || this.g.cells[id] < 0) return;
    if (this.locked.has(id)) {
      this.host.board.shake(id);
      this.host.toast(tr('Locked by the boss for a few seconds.'), 'bad');
      return;
    }
    if (this.sel === null || this.sel === id) {
      this.sel = this.sel === id ? null : id;
      this.host.sound('click');
      return this.refresh();
    }
    const a = this.sel;
    if (this.g.canMatch(a, id)) return this.take(a, id);
    if (matchGroup(this.g.cells[a]) === matchGroup(this.g.cells[id])) this.host.toast(tr('No clear path with two turns or fewer.'), 'bad');
    this.sel = id;
    this.host.sound('click');
    this.refresh();
  }

  private take(a: number, c: number) {
    this.drawPath(this.g.path(a, c)!);
    this.g.remove(a, c);
    const b = this.host.board;
    const boss = this.bossPos();
    b.remove(a, { delay: 0.15, to: boss });
    b.remove(c, { delay: 0.15, to: boss });
    this.sel = null;
    this.hintPair = [];
    const t = this.clock.elapsed;
    this.combo = t - this.lastPair <= 3.5 ? this.combo + 1 : 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.lastPair = t;
    this.pairs++;
    const dmg = strike(this.combo);
    this.hp -= dmg;
    this.host.sound(this.combo > 2 ? 'kong' : 'pung');
    if (this.combo > 2) this.host.toast(tr('Combo ×{n}: {d} damage', { n: this.combo, d: dmg }), 'good');
    this.later(() => {
      if (this.ended && this.hp > 0) return;
      this.host.burst(boss.clone().setY(this.host.board.h), this.combo > 2);
      this.host.board.shake(BOSS_ID);
    }, 420);
    if (this.hp <= 0) {
      // Won at once: no time-out, heal or late "no moves" can take it back while the blow lands.
      this.end(true, undefined, 700);
      this.refresh();
      return;
    }
    if (this.g.left === 0) {
      this.walls++;
      this.host.toast(tr('A new wall rises!'), 'info');
      this.later(() => !this.ended && (this.deal(), this.host.fit()), 650);
    } else if (!this.open(1).length && !this.locked.size && !this.shuffles) {
      this.later(() => !this.g.pairs(1).length && this.end(false, tr('No more moves')), 900);
    } else if (!this.g.pairs(1).length) this.host.toast(tr('No more moves. Shuffle the tiles to carry on.'), 'bad');
    this.refresh();
  }

  private drawPath(path: Cell[]) {
    this.clearPath();
    const y = this.host.board.d + 0.05;
    for (let i = 0; i + 1 < path.length; i++) {
      const p = this.world(path[i].x, path[i].y),
        q = this.world(path[i + 1].x, path[i + 1].y);
      p.y = q.y = y;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, p.distanceTo(q) + 0.035), this.lineMat);
      bar.position.copy(p).add(q).multiplyScalar(0.5);
      bar.lookAt(q.x, y, q.z);
      this.lines.add(bar);
    }
    this.lineMat.opacity = 1;
    this.lineMat.transparent = true;
    this.fade = 0.6;
  }
  private clearPath() {
    for (const m of [...this.lines.children] as THREE.Mesh[]) {
      m.geometry.dispose();
      this.lines.remove(m);
    }
  }

  /** The boss strikes back. */
  private attack() {
    const kind = this.boss.attacks[this.attackN++ % this.boss.attacks.length];
    const b = this.host.board;
    const p = this.bossPos();
    b.moveTo(BOSS_ID, { pos: p.clone().setY(p.y + 0.35) }, { dur: 0.18 });
    b.moveTo(BOSS_ID, { pos: p }, { dur: 0.25 });
    this.host.sound('kong');
    if (kind === 'heal') {
      const gain = Math.round(this.boss.hp * 0.08);
      this.hp = Math.min(this.boss.hp, this.hp + gain);
      this.host.toast(tr('{boss} heals {n}', { boss: this.boss.name, n: gain }), 'bad');
    } else if (kind === 'scramble' && this.g.left > 2) {
      this.g.shuffle(this.host.rng);
      this.g.cells.forEach((k, i) => {
        if (k < 0) return;
        b.setKind(i, k);
        b.moveTo(i, { pos: this.world(i % this.w, Math.floor(i / this.w), 0.5) }, { dur: 0.16, delay: (i % 7) * 0.02 });
        b.moveTo(i, { pos: this.world(i % this.w, Math.floor(i / this.w)) }, { dur: 0.22 });
      });
      this.sel = null;
      this.hintPair = [];
      this.host.toast(tr('{boss} scrambles the wall!', { boss: this.boss.name }), 'bad');
    } else {
      const live = this.g.cells.map((k, i) => (k >= 0 && !this.locked.has(i) ? i : -1)).filter((i) => i >= 0);
      const pick = this.host.rng.shuffle(live).slice(0, this.boss.lock);
      for (const c of pick) this.locked.set(c, this.clock.elapsed + LOCK_SECS);
      if (this.sel !== null && this.locked.has(this.sel)) this.sel = null;
      if (this.hintPair.some((c) => this.locked.has(c))) this.hintPair = [];
      this.host.toast(tr('{boss} locks {n} tiles!', { boss: this.boss.name, n: pick.length }), 'bad');
    }
    this.refresh();
  }

  suggest(): number[] | null {
    if (this.ended) return [];
    const p = this.open();
    if (p.length) return p[this.host.rng.int(p.length)];
    return this.locked.size ? [] : null;
  }
  hint() {
    if (this.ended || this.hints <= 0) return false;
    const p = this.open();
    if (!p.length) return false;
    this.hints--;
    this.hintPair = p[0];
    this.refresh();
    const tok = ++this.hintTok;
    this.later(() => {
      if (tok !== this.hintTok) return;
      this.hintPair = [];
      if (!this.ended) this.refresh();
    }, 2400);
    return true;
  }
  shuffle() {
    if (this.ended || this.shuffles <= 0 || !this.g.shuffle(this.host.rng)) return false;
    this.shuffles--;
    const b = this.host.board;
    this.g.cells.forEach((k, i) => k >= 0 && b.setKind(i, k));
    this.sel = null;
    this.hintPair = [];
    this.host.sound('shuffle');
    this.refresh();
    return true;
  }
  canUse(tool: 'hint' | 'shuffle') {
    if (this.ended) return false;
    return tool === 'hint' ? this.hints > 0 : this.shuffles > 0;
  }
  badges() {
    const n = (v: number) => (Number.isFinite(v) ? String(v) : undefined);
    return { hint: n(this.hints), shuffle: n(this.shuffles) };
  }
  attention() {
    return !this.ended && !this.g.pairs(1).length && this.shuffles > 0 ? ('shuffle' as const) : null;
  }

  tick(dt: number) {
    if (this.ended) return;
    this.clock.tick(dt);
    if (this.clock.paused) return;
    if (this.fade > 0) {
      this.fade -= dt;
      this.lineMat.opacity = Math.max(0, Math.min(1, this.fade / 0.3));
      if (this.fade <= 0) this.clearPath();
    }
    let freed = false;
    for (const [c, until] of this.locked) if (this.clock.elapsed >= until) (this.locked.delete(c), (freed = true));
    if (freed) this.refresh();
    if (this.combo && this.clock.elapsed - this.lastPair > 3.5) {
      this.combo = 0;
      this.host.setStat('combo', null);
    }
    this.nextAttack -= dt;
    if (this.nextAttack <= 0) {
      this.nextAttack = this.boss.every;
      this.attack();
    }
    this.host.setStat('time', this.clock.text(), tr('Left'));
    this.host.setStat('moves', String(Math.max(0, Math.ceil(this.nextAttack))), tr('Next attack'));
    if (this.clock.over) this.end(false, tr("Time's up"));
  }
  pause(p: boolean) {
    this.clock.paused = p;
  }

  /** A timer that does nothing once the session is disposed. */
  private later(fn: () => void, ms: number) {
    window.setTimeout(() => !this.disposed && fn(), ms);
  }

  /** Ends the game now; the result shows after `delay` ms (the last blow landing). */
  private end(won: boolean, why?: string, delay = 0) {
    if (this.ended) return;
    this.ended = true;
    this.sel = null;
    this.hintPair = [];
    const dealt = this.boss.hp - Math.max(0, this.hp);
    const score = dealt * 2 + this.pairs * 5 + (won ? Math.round(this.clock.left) * 3 : 0);
    const result = {
      won,
      score,
      seconds: this.clock.elapsed,
      cleared: dealt,
      total: this.boss.hp,
      headline: tr('Boss defeated'),
      tally: { label: tr('Damage dealt'), text: `${dealt} / ${this.boss.hp}` },
      notes: [won ? tr('{boss} is defeated!', { boss: this.boss.name }) : why ?? tr("Time's up"), tr('{n} pairs struck', { n: this.pairs }), ...(this.walls > 1 ? [tr('{n} walls dealt', { n: this.walls })] : []), ...(this.bestCombo > 1 ? [tr('Longest combo ×{n}', { n: this.bestCombo })] : [])],
    };
    const done = () => {
      // The boss topples.
      if (won) this.host.board.moveTo(BOSS_ID, { pos: this.bossPos().setY(0.2), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)) }, { dur: 0.7 });
      this.host.finish(result);
    };
    if (delay) this.later(done, delay);
    else done();
  }
  dispose() {
    this.ended = true;
    this.disposed = true;
    this.clearPath();
    this.lines.removeFromParent();
    this.lineMat.dispose();
    this.host.board.fitExtra = null;
  }
}

registerMiniGame({
  id: 'boss',
  title: tr('Mahjong Boss Challenge'),
  blurb: tr('A giant tile guards the table. Match pairs to strike it before it locks and scrambles your wall.'),
  minutes: tr('3–4 min'),
  order: 95,
  icon: { kinds: [31, 13, 22, 4, 27], shape: 'duel' },
  levels: ['easy', 'medium', 'hard'],
  dynamicKinds: true,
  howTo: [
    tr('Match tiles a path of up to two turns can join, as in Mahjong Connect. Every pair strikes the boss.'),
    tr('Pairs made within a few seconds of each other build a combo and strike harder.'),
    tr('The boss fights back: it locks tiles for a few seconds, scrambles the wall or heals itself.'),
    tr('Bring its health to zero before the clock runs out. A cleared wall is dealt again.'),
  ],
  tools: { hint: true, shuffle: true },
  // A win never pays less than the best a loss could (40 × level).
  reward: (r, level) => (r.won ? Math.max(Math.round(40 * PAY[level]), Math.round(Math.min(200, 70 + r.score * 0.1) * PAY[level] - r.hints * 4 - r.shuffles * 6)) : Math.round((r.cleared / Math.max(1, r.total)) * 40 * PAY[level])),
  start: (host) => new BossSession(host),
});
