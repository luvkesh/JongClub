// Mahjong Dungeon: a small crawl laid out in tiles. Your hero is the Red
// Dragon standing at the near edge. Step one square at a time: number tiles
// are monsters that cost health equal to their number (less your armour),
// Winds are armour, Flowers heal, Seasons are gold, the Green Dragon is the key
// and the White Dragon the door out. Tiles beyond your lantern stay face down.
// Every dungeon is checked to have a way to the key and the door you can survive.

import * as THREE from 'three';
import { tr } from '../../i18n';
import { registerMiniGame } from '../registry';
import { FLAT, FLAT_DOWN } from '../board';
import { FLOWER_KINDS, GameClock, SEASON_KINDS, woodMaterial } from '../helpers';
import { rankOf } from '../../engine/tiles';
import type { Rng } from '../../engine/rng';
import type { MiniHost, MiniLevel, MiniSession } from '../types';

export const HERO = 31;
export const KEY = 32;
export const DOOR = 33;
const SETUP: Record<MiniLevel, { w: number; h: number; hp: number; maxRank: number; fog: number }> = {
  easy: { w: 5, h: 6, hp: 16, maxRank: 5, fog: 0 },
  medium: { w: 6, h: 7, hp: 14, maxRank: 7, fog: 2 },
  hard: { w: 7, h: 8, hp: 12, maxRank: 9, fog: 1 },
};
const HINTS: Record<MiniLevel, number> = { easy: Infinity, medium: 3, hard: 2 };
const PAY: Record<MiniLevel, number> = { easy: 1, medium: 1.5, hard: 2.2 };
const HERO_ID = 100000;
/** The hero stands leaning back a little, so its face reads from the camera above. */
const HERO_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.55, 0, 0));
const MAX_ARMOUR = 3;

export type Room = { t: 'empty' } | { t: 'monster'; kind: number } | { t: 'potion'; kind: number } | { t: 'armour'; kind: number } | { t: 'gold'; kind: number } | { t: 'key' } | { t: 'door' };

export const roomKind = (r: Room) => (r.t === 'key' ? KEY : r.t === 'door' ? DOOR : r.t === 'empty' ? -1 : r.kind);
/** Health a monster takes: its number less your armour. */
export const damage = (r: Room, armour: number) => (r.t === 'monster' ? Math.max(0, rankOf(r.kind) - armour) : 0);

/** Pure rules (tests use this): rooms row major, y = 0 the far row. */
export class Dungeon {
  constructor(
    readonly w: number,
    readonly h: number,
    public rooms: Room[],
    readonly start: number,
  ) {}
  near(i: number) {
    const x = i % this.w,
      y = Math.floor(i / this.w);
    return (
      [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as const
    )
      .filter(([a, b]) => a >= 0 && b >= 0 && a < this.w && b < this.h)
      .map(([a, b]) => b * this.w + a);
  }
  find(t: Room['t']) {
    return this.rooms.findIndex((r) => r.t === t);
  }
  /** The least-damage route from `from` to `to` with `armour` (the door blocks unless it is the goal). Returns [cost, path]. */
  route(from: number, to: number, armour: number, open: (i: number) => boolean = () => true): [number, number[]] | null {
    const n = this.rooms.length;
    const dist = Array(n).fill(Infinity);
    const prev = Array(n).fill(-1);
    dist[from] = 0;
    const done = new Set<number>();
    for (;;) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!done.has(i) && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0) return null;
      if (u === to) break;
      done.add(u);
      for (const v of this.near(u)) {
        if ((this.rooms[v].t === 'door' || !open(v)) && v !== to) continue;
        // A small step cost prefers shorter routes among equally safe ones.
        const d = dist[u] + damage(this.rooms[v], armour) + 0.01;
        if (d < dist[v]) {
          dist[v] = d;
          prev[v] = u;
        }
      }
    }
    const path: number[] = [];
    for (let c = to; c !== from; c = prev[c]) path.unshift(c);
    return [Math.floor(dist[to]), path];
  }
}

/** A dungeon with a key and a door you can reach with health to spare, without counting on armour or potions. */
export function dealDungeon(level: MiniLevel, rng: Rng): Dungeon {
  const st = SETUP[level];
  const n = st.w * st.h;
  for (;;) {
    const start = (st.h - 1) * st.w + Math.floor(st.w / 2);
    const door = rng.int(st.w);
    const rooms: Room[] = Array.from({ length: n }, (_, i) => {
      if (i === start) return { t: 'empty' };
      if (i === door) return { t: 'door' };
      const roll = rng.next();
      if (roll < 0.24) return { t: 'empty' };
      if (roll < 0.66) {
        // Monsters: lower numbers are more common.
        const rank = 1 + Math.min(st.maxRank - 1, Math.floor(Math.pow(rng.next(), 1.6) * st.maxRank));
        return { t: 'monster', kind: rng.int(3) * 9 + rank - 1 };
      }
      if (roll < 0.76) return { t: 'potion', kind: FLOWER_KINDS[rng.int(4)] };
      if (roll < 0.84) return { t: 'armour', kind: 27 + rng.int(4) };
      return { t: 'gold', kind: SEASON_KINDS[rng.int(4)] };
    });
    // The key lies in the middle rows, away from the door.
    const mid = Array.from({ length: n }, (_, i) => i).filter((i) => {
      const y = Math.floor(i / st.w);
      return y >= 1 && y <= st.h - 3 && i !== start && rooms[i].t !== 'door';
    });
    rooms[mid[rng.int(mid.length)]] = { t: 'key' };
    const d = new Dungeon(st.w, st.h, rooms, start);
    const toKey = d.route(start, d.find('key'), 0);
    const toDoor = toKey && d.route(d.find('key'), d.find('door'), 0);
    if (!toKey || !toDoor) continue;
    const cost = toKey[0] + toDoor[0];
    // Enough challenge to matter, never a dungeon you cannot get out of.
    if (cost < st.hp * 0.75 && cost >= Math.min(4, st.hp / 3)) return d;
  }
}

class DungeonSession implements MiniSession {
  private g: Dungeon;
  private st: (typeof SETUP)['easy'];
  private at: number;
  private hp: number;
  private maxHp: number;
  private armour = 0;
  private gold = 0;
  private slain = 0;
  private hasKey = false;
  private steps = 0;
  private seen = new Set<number>();
  private visited = new Set<number>();
  private hints: number;
  private hintPath: number[] = [];
  private clock = new GameClock();
  private ended = false;
  private busy = false;
  private floor: THREE.Mesh;
  private floorMat = woodMaterial('#3c2416');

  constructor(private host: MiniHost) {
    this.st = SETUP[host.level];
    this.g = dealDungeon(host.level, host.rng);
    this.at = this.g.start;
    this.hp = this.maxHp = this.st.hp;
    this.hints = HINTS[host.level];
    const b = host.board;
    this.floor = new THREE.Mesh(new THREE.BoxGeometry(this.st.w * (b.w + 0.08) + 0.12, 0.02, this.st.h * (b.h + 0.08) + 0.12), this.floorMat);
    this.floor.position.y = 0.01;
    this.floor.receiveShadow = true;
    b.root.add(this.floor);
    host.camera.home = { yaw: 0, pitch: 60 };
    host.camera.reset();
    this.visited.add(this.at);
    this.light(true);
    const specs = this.g.rooms.map((r, i) => ({ r, i })).filter(({ r }) => r.t !== 'empty');
    b.build([...specs.map(({ r, i }) => ({ id: i, kind: roomKind(r), pos: this.world(i), quat: this.seen.has(i) ? FLAT : FLAT_DOWN })), { id: HERO_ID, kind: HERO, pos: this.heroPos(this.at), quat: HERO_Q }]);
    b.fitExtra = new THREE.Box3(new THREE.Vector3((-this.st.w / 2) * (b.w + 0.08), 0, (-this.st.h / 2) * (b.h + 0.08)), new THREE.Vector3((this.st.w / 2) * (b.w + 0.08), b.h, (this.st.h / 2) * (b.h + 0.08)));
    host.fit(true);
    host.toast(tr('Find the Green Dragon key, then reach the White Dragon door.'), 'info');
    this.refresh();
  }

  private world(i: number) {
    const b = this.host.board;
    const x = i % this.st.w,
      y = Math.floor(i / this.st.w);
    return new THREE.Vector3((x - (this.st.w - 1) / 2) * (b.w + 0.08), b.d / 2 + 0.02, (y - (this.st.h - 1) / 2) * (b.h + 0.08));
  }
  private heroPos(i: number) {
    const b = this.host.board;
    return this.world(i).setY((b.h / 2) * Math.cos(0.55) + 0.03).add(new THREE.Vector3(0, 0, (b.h / 2) * Math.sin(0.55) * 0.5));
  }

  /** Turn face up every room within the lantern's reach of where you have been. */
  private light(first = false) {
    const fog = this.st.fog;
    const turned: number[] = [];
    for (let i = 0; i < this.g.rooms.length; i++) {
      if (this.seen.has(i)) continue;
      const x = i % this.st.w,
        y = Math.floor(i / this.st.w);
      const lit =
        !fog ||
        [...this.visited].some((v) => {
          const vx = v % this.st.w,
            vy = Math.floor(v / this.st.w);
          return Math.max(Math.abs(vx - x), Math.abs(vy - y)) <= fog;
        });
      if (lit) {
        this.seen.add(i);
        turned.push(i);
      }
    }
    if (!first) turned.forEach((i, n) => this.g.rooms[i].t !== 'empty' && this.host.board.moveTo(i, { pos: this.world(i), quat: FLAT }, { dur: 0.3, arc: 0.14, delay: n * 0.04 }));
  }

  private refresh() {
    this.host.board.looks((id) => {
      if (id === HERO_ID) return 'selected';
      if (this.hintPath.includes(id)) return 'hint';
      const r = this.g.rooms[id];
      if (!this.seen.has(id)) return 'normal';
      if (r?.t === 'key' || (r?.t === 'door' && this.hasKey)) return 'free';
      return 'normal';
    });
    this.host.setStat('left', `${this.hp} / ${this.maxHp}`, tr('Health'));
    this.host.setStat('moves', String(this.armour), tr('Armour'));
    this.host.setStat('score', String(this.gold), tr('Gold'));
    this.host.setStat('status', this.hasKey ? tr('Key found: make for the door') : tr('Find the key'), tr('Quest'));
    this.host.refreshButtons();
  }

  onPick(id: number) {
    if (id === HERO_ID) return;
    this.step(id);
  }
  onEmptyTap(x: number, y: number, camera: THREE.Camera, canvas: HTMLElement) {
    const p = this.host.board.feltPoint(x, y, camera, canvas);
    if (!p) return;
    let best = -1,
      bd = Infinity;
    for (let i = 0; i < this.g.rooms.length; i++) {
      const d = this.world(i).setY(0).distanceTo(p.setY(0));
      if (d < bd) [best, bd] = [i, d];
    }
    if (best >= 0 && bd < this.host.board.h * 0.7) this.step(best);
  }

  /** Step into room `i` (one square from the hero). */
  private step(i: number) {
    if (this.ended || this.busy || i === this.at) return;
    if (!this.g.near(this.at).includes(i)) {
      this.host.toast(tr('Move one square at a time, not on the diagonal.'), 'info');
      return;
    }
    const room = this.g.rooms[i];
    const b = this.host.board;
    this.hintPath = [];
    if (room.t === 'door' && !this.hasKey) {
      b.shake(i);
      this.host.toast(tr('The door is locked. Find the Green Dragon key first.'), 'bad');
      return;
    }
    this.busy = true;
    this.steps++;
    // A hidden room shows itself as you step in.
    if (!this.seen.has(i)) {
      this.seen.add(i);
      if (room.t !== 'empty') b.moveTo(i, { quat: FLAT }, { dur: 0.2 });
    }
    b.moveTo(HERO_ID, { pos: this.heroPos(i) }, { dur: 0.32, arc: 0.22 });
    this.host.sound('slide');
    window.setTimeout(() => this.arrive(i), 340);
  }

  private arrive(i: number) {
    if (this.ended) return;
    const room = this.g.rooms[i];
    const b = this.host.board;
    const at = this.world(i).setY(0.35);
    switch (room.t) {
      case 'monster': {
        const hurt = damage(room, this.armour);
        this.hp -= hurt;
        this.slain++;
        this.host.sound('kong');
        this.host.toast(hurt ? tr('You beat a {n} for {d} health', { n: rankOf(room.kind), d: hurt }) : tr('Your armour turns the blow'), hurt ? 'bad' : 'good');
        break;
      }
      case 'potion': {
        const gain = Math.min(5, this.maxHp - this.hp);
        this.hp += gain;
        this.host.sound('pung');
        this.host.toast(tr('A flower restores {n} health', { n: gain }), 'good');
        break;
      }
      case 'armour':
        if (this.armour < MAX_ARMOUR) {
          this.armour++;
          this.host.toast(tr('Armour +1: monsters hurt less'), 'good');
        } else {
          this.gold += 10;
          this.host.toast(tr('Armour full: sold for 10 gold'), 'info');
        }
        this.host.sound('pung');
        break;
      case 'gold':
        this.gold += 25;
        this.host.sound('score');
        this.host.toast(tr('+25 gold'), 'good');
        break;
      case 'key':
        this.hasKey = true;
        this.host.sound('mahjong');
        this.host.toast(tr('The key! Now find the door.'), 'good');
        break;
      case 'door':
        this.host.burst(at, true);
        return this.end(true);
    }
    if (room.t !== 'empty') {
      b.remove(i, { to: this.heroPos(i) });
      this.host.burst(at, room.t === 'key');
      this.g.rooms[i] = { t: 'empty' };
    }
    this.at = i;
    this.visited.add(i);
    this.light();
    // A fallen hero stays down (busy) until the end shows: no stepping on to the door at 0 health.
    this.busy = this.hp <= 0;
    this.refresh();
    if (this.hp <= 0) {
      this.hp = 0;
      this.refresh();
      // The hero falls over.
      b.moveTo(HERO_ID, { pos: this.world(i).setY(b.d / 2 + 0.02), quat: FLAT_DOWN }, { dur: 0.5 });
      window.setTimeout(() => this.end(false), 600);
    }
  }

  /** The safest route on to the key, or to the door once you hold it (only through rooms you can see). */
  private plan(): number[] | null {
    const goal = this.g.find(this.hasKey ? 'door' : 'key');
    if (goal < 0 || !this.seen.has(goal)) return null;
    const r = this.g.route(this.at, goal, this.armour, (c) => this.seen.has(c));
    return r ? r[1] : null;
  }
  suggest(): number[] | null {
    if (this.ended || this.busy) return [];
    const p = this.plan();
    const next = p?.[0];
    return next !== undefined && this.g.rooms[next].t !== 'empty' ? [next] : [];
  }
  hint() {
    if (this.ended || this.hints <= 0) return false;
    const p = this.plan();
    if (!p) {
      this.host.toast(tr('Explore further: the goal is still in the dark.'), 'info');
      return false;
    }
    this.hints--;
    this.hintPath = p.filter((c) => this.g.rooms[c].t !== 'empty');
    this.refresh();
    window.setTimeout(() => {
      this.hintPath = [];
      if (!this.ended) this.refresh();
    }, 2800);
    return true;
  }
  canUse(tool: 'hint' | 'shuffle') {
    return !this.ended && tool === 'hint' && this.hints > 0;
  }
  badges() {
    return { hint: Number.isFinite(this.hints) ? String(this.hints) : undefined };
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
    const score = this.gold + this.slain * 5 + (won ? 100 + this.hp * 10 : 0);
    this.host.finish({
      won,
      score,
      seconds: this.clock.elapsed,
      cleared: won ? 1 : this.hasKey ? 0.5 : 0,
      total: 1,
      headline: tr('You escaped!'),
      tally: { label: tr('Health'), text: `${this.hp} / ${this.maxHp}` },
      notes: [won ? tr('You escaped with {n} health', { n: this.hp }) : tr('Your hero fell in the dungeon'), tr('{n} monsters beaten, {g} gold', { n: this.slain, g: this.gold }), tr('{n} steps', { n: this.steps })],
    });
  }
  dispose() {
    this.ended = true;
    this.floor.removeFromParent();
    this.floor.geometry.dispose();
    this.floorMat.dispose();
    this.host.board.fitExtra = null;
  }
}

registerMiniGame({
  id: 'dungeon',
  title: tr('Mahjong Dungeon'),
  blurb: tr('Lead the Red Dragon through a dungeon of tiles: beat monsters, grab gold and armour, find the key and escape.'),
  minutes: tr('2–5 min'),
  order: 98,
  icon: { kinds: [31, 5, 36, 27, 33, 15], shape: 'dungeon' },
  levels: ['easy', 'medium', 'hard'],
  ownPortraitCamera: true,
  howTo: [
    tr('Your hero is the standing Red Dragon. Tap a square next to it (not on the diagonal) to step there.'),
    tr('Number tiles are monsters: beating one costs health equal to its number, less your armour. Winds give armour, Flowers heal and Seasons are gold.'),
    tr('Find the Green Dragon key, then step onto the White Dragon door to escape.'),
    tr('On Medium and Hard, rooms beyond your lantern stay face down until you come near.'),
  ],
  tools: { hint: true },
  daily: true,
  // A win never pays less than the best loss, however many hints it took (Easy has unlimited hints).
  reward: (r, level) => (r.won ? Math.max(Math.round(15 * PAY[level]), Math.round(Math.min(200, 70 + r.score * 0.25) * PAY[level] - r.hints * 6)) : Math.round(r.cleared * 30 * PAY[level])),
  start: (host) => new DungeonSession(host),
});
