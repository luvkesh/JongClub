// Second deep retest of the arcade mini-games (Match-3, Hex, Colour Match,
// Survival, Treasure Hunt, Boss Challenge, Chain Reaction, Puzzle Rush and
// Dungeon): seeded "chaos" games driven through def.start() with a stub host and
// a stub board (tweens finish at once). Each game mixes legal moves with random
// taps, swipes, hints, undos, shuffles, pauses and pause suggestions, and checks
// the game's invariants after every step: no crash, no illegal suggestion, a
// board that matches the rules, exactly one finish and a sane reward.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Rng } from '../src/engine/rng';
import { miniGame } from '../src/minigames/registry';
import { matchGroup } from '../src/minigames/helpers';
import { MINI_DAILY_CAP } from '../src/minigames/progress';
import { Match3 } from '../src/minigames/games/match3';
import { Sorter } from '../src/minigames/games/colour';
import type { MiniGameDef, MiniHost, MiniLevel, MiniResult, MiniSession } from '../src/minigames/types';
import '../src/minigames/games';

const LEVELS: MiniLevel[] = ['easy', 'medium', 'hard'];
const g = globalThis as unknown as { window?: unknown; innerWidth?: number; innerHeight?: number };

// ------------------------------------------------------------ stub board and host

interface STile {
  kind: number;
  alive: boolean;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  scale: number;
  look: string;
}

class StubBoard {
  readonly w = 0.75;
  readonly h = 1;
  readonly d = 0.55;
  readonly root = new THREE.Group();
  fitExtra: THREE.Box3 | null = null;
  tiles = new Map<number, STile>();
  pulsingIds: number[] = [];
  builds = 0;
  shakes = 0;
  build(specs: { id: number; kind: number; pos: THREE.Vector3; quat?: THREE.Quaternion }[]) {
    this.builds++;
    this.tiles.clear();
    for (const s of specs) {
      if (this.tiles.has(s.id)) throw new Error(`duplicate tile id ${s.id}`);
      if (!Number.isInteger(s.kind) || s.kind < 0 || s.kind > 41) throw new Error(`bad kind ${s.kind}`);
      this.tiles.set(s.id, { kind: s.kind, alive: true, pos: s.pos.clone(), quat: (s.quat ?? new THREE.Quaternion()).clone(), scale: 1, look: 'normal' });
    }
  }
  private t(id: number) {
    const t = this.tiles.get(id);
    if (!t) throw new Error(`no tile ${id}`);
    return t;
  }
  has(id: number) {
    return !!this.tiles.get(id)?.alive;
  }
  kindOf(id: number) {
    return this.tiles.get(id)?.kind ?? -1;
  }
  ids() {
    return [...this.tiles].filter(([, t]) => t.alive).map(([id]) => id);
  }
  pose(id: number) {
    const t = this.tiles.get(id);
    return t ? { pos: t.pos.clone(), quat: t.quat.clone(), scale: t.scale } : null;
  }
  busy() {
    return false;
  }
  get moving() {
    return false;
  }
  setLook(id: number, look: string) {
    this.t(id).look = look;
  }
  look(id: number) {
    return this.tiles.get(id)?.look ?? 'normal';
  }
  looks(fn: (id: number) => string) {
    for (const [id, t] of this.tiles) if (t.alive) t.look = fn(id);
  }
  pulse(ids: number[]) {
    this.pulsingIds = ids;
  }
  shake(id: number) {
    this.t(id);
    this.shakes++;
  }
  moveTo(id: number, to: { pos?: THREE.Vector3; quat?: THREE.Quaternion; scale?: number }, o: { done?: () => void } = {}) {
    const t = this.t(id);
    if (to.pos) {
      if (![to.pos.x, to.pos.y, to.pos.z].every(Number.isFinite)) throw new Error(`NaN move for ${id}`);
      t.pos.copy(to.pos);
    }
    if (to.quat) t.quat.copy(to.quat);
    if (to.scale !== undefined) t.scale = to.scale;
    o.done?.();
  }
  place(id: number, p: { pos?: THREE.Vector3; quat?: THREE.Quaternion; scale?: number }) {
    this.moveTo(id, p);
  }
  remove(id: number, o: { done?: () => void } = {}) {
    // Like TileBoard: a tile that is not there is left alone.
    const t = this.tiles.get(id);
    if (!t?.alive) return;
    t.alive = false;
    t.scale = 0.001;
    o.done?.();
  }
  hide(id: number) {
    const t = this.t(id);
    t.alive = false;
    t.scale = 0.001;
  }
  restore(id: number, p: { pos: THREE.Vector3; quat: THREE.Quaternion }) {
    const t = this.t(id);
    t.alive = true;
    t.scale = 1;
    t.pos.copy(p.pos);
    t.quat.copy(p.quat);
  }
  revive(id: number, p: { pos?: THREE.Vector3; quat?: THREE.Quaternion }) {
    const t = this.t(id);
    t.alive = true;
    t.scale = 1;
    this.moveTo(id, p);
  }
  setKind(id: number, kind: number) {
    if (!Number.isInteger(kind) || kind < 0 || kind > 41) throw new Error(`bad kind ${kind}`);
    this.t(id).kind = kind;
  }
  bounds() {
    return new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
  }
  /** Felt taps land where the test says. */
  felt: THREE.Vector3 | null = null;
  feltPoint() {
    return this.felt ? this.felt.clone() : null;
  }
  pick() {
    return null;
  }
  toScreen() {
    return { x: 0, y: 0 };
  }
}

type FinishArg = Parameters<MiniHost['finish']>[0];

interface Run {
  id: string;
  def: MiniGameDef;
  s: MiniSession;
  host: MiniHost;
  board: StubBoard;
  finishes: MiniResult[];
  toasts: string[];
  stats: Record<string, string | null>;
  counts: { hints: number; undos: number; shuffles: number };
  /** Private state of the session (white-box checks). */
  p: Record<string, any>;
  level: MiniLevel;
  paused: boolean;
}

function start(id: string, level: MiniLevel, seed: number, opts: { daily?: boolean } = {}): Run {
  const def = miniGame(id)!;
  const board = new StubBoard();
  const finishes: MiniResult[] = [];
  const toasts: string[] = [];
  const stats: Record<string, string | null> = {};
  const counts = { hints: 0, undos: 0, shuffles: 0 };
  let s!: MiniSession;
  const host: MiniHost = {
    board: board as unknown as MiniHost['board'],
    camera: { home: { yaw: 0, pitch: 60 }, reset() {}, limits: {} } as unknown as MiniHost['camera'],
    fit() {},
    burst() {},
    rng: new Rng(seed),
    seed,
    level,
    options: {},
    daily: !!opts.daily,
    setStat(k, text) {
      stats[k] = text;
    },
    toast(text) {
      toasts.push(text);
    },
    sound() {},
    finish(r: FinishArg) {
      finishes.push({ hints: counts.hints, undos: counts.undos, shuffles: counts.shuffles, ...r } as MiniResult);
    },
    used(what) {
      counts[what]++;
    },
    refreshButtons() {
      if (!s) return;
      s.badges?.();
      s.attention?.();
      s.canUndo?.();
      s.canUse?.('hint');
      s.canUse?.('shuffle');
    },
  };
  s = def.start(host);
  return { id, def, s, host, board, finishes, toasts, stats, counts, p: s as unknown as Record<string, any>, level, paused: false };
}

/** The shell's buttons: they count successful uses, and do nothing once the game has finished. */
const useHint = (r: Run) => (!r.finishes.length && r.s.hint?.() ? (r.counts.hints++, true) : false);
const useUndo = (r: Run) => (!r.finishes.length && r.s.undo?.() ? (r.counts.undos++, true) : false);
const useShuffle = (r: Run) => (!r.finishes.length && r.s.shuffle?.() ? (r.counts.shuffles++, true) : false);
const pause = (r: Run, p: boolean) => ((r.paused = p), r.s.pause?.(p));

/** Shell-like time: ticks at 10 Hz while playing, and timers run. */
async function wait(r: Run, sec: number) {
  for (let t = 0; t < sec - 1e-9; t += 0.1) {
    if (!r.finishes.length && !r.paused) r.s.tick?.(0.1);
    await vi.advanceTimersByTimeAsync(100);
  }
}

function checkReward(r: Run) {
  expect(r.finishes.length).toBe(1);
  const res = r.finishes[0];
  const pay = r.def.reward(res, r.level);
  expect(Number.isFinite(pay)).toBe(true);
  expect(pay).toBeGreaterThanOrEqual(0);
  expect(pay).toBeLessThanOrEqual(MINI_DAILY_CAP);
  expect(Number.isFinite(res.score)).toBe(true);
  expect(res.score).toBeGreaterThanOrEqual(0);
  expect(res.seconds).toBeGreaterThanOrEqual(0);
  expect(res.cleared).toBeGreaterThanOrEqual(0);
  expect(res.cleared).toBeLessThanOrEqual(res.total);
  return { res, pay };
}

beforeEach(() => {
  vi.useFakeTimers();
  g.window = globalThis;
  g.innerWidth = 1024;
  g.innerHeight = 768;
});
afterEach(() => {
  vi.useRealTimers();
});

// ------------------------------------------------------------ per-game rules for the chaos player

interface Rules {
  /** A legal move, played; false when the player has none to make. */
  move(r: Run, rng: Rng): boolean | Promise<boolean>;
  /** Whether a suggestion (non-empty) is a legal move right now. */
  legal(r: Run, ids: number[]): boolean;
  /** Whether no move exists at all (a null suggestion must mean this). */
  stuck?(r: Run): boolean;
  /** Board bookkeeping checks after every step. */
  inv?(r: Run): void;
  /** Ends a game that has not finished by itself (plays it out). */
  finishOff(r: Run): Promise<void>;
}

const pickTwo = (r: Run, a: number, b: number) => (r.s.onPick(a), r.s.onPick(b));
const alive = (r: Run) => r.board.ids();

const match3Rules: Rules = {
  async move(r) {
    if (r.p.busy) return false;
    const m = (r.p.g as Match3).findMove();
    if (!m) return false;
    const [a, b] = m;
    if (Math.random() < 0.5) pickTwo(r, r.p.idAt[a], r.p.idAt[b]);
    else {
      const d = b - a === 1 ? [1, 0] : [0, 1];
      r.s.onSwipe!(r.p.idAt[a], d[0] * 0.3, d[1] * 0.3);
    }
    await wait(r, 3);
    return true;
  },
  legal(r, ids) {
    if (ids.length !== 2) return false;
    const [a, b] = ids.map((id) => (r.p.idAt as number[]).indexOf(id));
    const n = 7;
    const adj = Math.abs(a - b) === n || (Math.abs(a - b) === 1 && Math.floor(a / n) === Math.floor(b / n));
    return adj && new Match3(n, (r.p.g as Match3).swapped(a, b), [], new Rng(1)).lines().length > 0;
  },
  stuck: (r) => !(r.p.g as Match3).findMove(),
  inv(r) {
    if (r.p.busy || r.finishes.length) return;
    const g = r.p.g as Match3;
    const idAt = r.p.idAt as number[];
    expect(new Set(idAt).size).toBe(49);
    expect(g.lines().length).toBe(0);
    g.cells.forEach((k, i) => {
      expect(k).toBeGreaterThanOrEqual(0);
      expect(r.board.has(idAt[i])).toBe(true);
      expect(r.board.kindOf(idAt[i])).toBe(k);
    });
    for (const d of r.p.dragons as Set<number>) expect(d >= 0 && d < 49).toBe(true);
    expect(r.p.moves).toBeGreaterThan(0);
  },
  async finishOff(r) {
    for (let i = 0; i < 200 && !r.finishes.length; i++) if (!(await match3Rules.move(r, new Rng(i)))) await wait(r, 1);
  },
};

const hexRules: Rules = {
  move(r, rng) {
    const p = r.p.g.pairs() as [number, number][];
    if (!p.length) return false;
    const [a, b] = p[rng.int(p.length)];
    pickTwo(r, a, b);
    return true;
  },
  legal: (r, ids) => ids.length === 2 && r.p.g.canMatch(ids[0], ids[1]),
  stuck: (r) => r.p.g.left > 0 && !r.p.g.pairs(1).length,
  inv(r) {
    const k = r.p.g.kinds as number[];
    k.forEach((v: number, i: number) => {
      expect(r.board.has(i)).toBe(v >= 0);
      if (v >= 0) expect(r.board.kindOf(i)).toBe(v);
    });
    const by = new Map<number, number>();
    for (const v of k) if (v >= 0) by.set(matchGroup(v), (by.get(matchGroup(v)) ?? 0) + 1);
    for (const n of by.values()) expect(n % 2).toBe(0);
  },
  async finishOff(r) {
    for (let i = 0; i < 400 && !r.finishes.length; i++) {
      if (!hexRules.move(r, new Rng(i)) && !useShuffle(r)) {
        await wait(r, 2);
        if (!r.finishes.length) useUndo(r);
      }
      await wait(r, 0.1);
    }
    await wait(r, 2);
  },
};

const colourRules: Rules = {
  move(r, rng) {
    const g = r.p.g as Sorter;
    const ms = g.moves();
    if (!ms.length) return false;
    const [a, b] = ms[rng.int(ms.length)];
    const top = (l: number) => r.p.ids[l][r.p.ids[l].length - 1];
    if (r.p.sel !== null) r.s.onPick(top(r.p.sel)); // put down what is held first
    r.s.onPick(top(a));
    if (r.p.ids[b].length) r.s.onPick(top(b));
    else {
      // An empty lane is tapped on the felt.
      r.board.felt = (r.s as any).slot(b, 1.5);
      r.s.onEmptyTap!(0, 0, new THREE.PerspectiveCamera(), {} as HTMLElement);
      r.board.felt = null;
    }
    return true;
  },
  legal(r, ids) {
    const ls = ids.map((id) => (r.p.ids as number[][]).findIndex((l) => l[l.length - 1] === id));
    if (ls.some((l) => l < 0)) return false;
    const g = r.p.g as Sorter;
    if (ids.length === 2) return g.canMove(ls[0], ls[1]);
    return ids.length === 1 && g.lanes.some((l, i) => !l.length && g.canMove(ls[0], i));
  },
  inv(r) {
    const g = r.p.g as Sorter;
    const ids = r.p.ids as number[][];
    g.lanes.forEach((lane, l) => {
      expect(lane.length).toBeLessThanOrEqual(4);
      expect(ids[l].length).toBe(lane.length);
      lane.forEach((k, s) => expect(r.board.kindOf(ids[l][s])).toBe(k));
    });
  },
  async finishOff(r) {
    for (let i = 0; i < 300 && !r.finishes.length; i++) {
      const sol = new Sorter((r.p.g as Sorter).lanes.map((l) => [...l])).solve(400000);
      if (!sol) {
        if (!useUndo(r)) throw new Error('colour: unsortable with nothing to undo');
        continue;
      }
      if (r.p.sel !== null) r.s.onPick(r.p.ids[r.p.sel][r.p.ids[r.p.sel].length - 1]);
      for (const [a, b] of sol) {
        const top = (l: number) => r.p.ids[l][r.p.ids[l].length - 1];
        r.s.onPick(top(a));
        if (r.p.ids[b].length) r.s.onPick(top(b));
        else {
          r.board.felt = (r.s as any).slot(b, 1.5);
          r.s.onEmptyTap!(0, 0, new THREE.PerspectiveCamera(), {} as HTMLElement);
          r.board.felt = null;
        }
      }
      await wait(r, 1);
    }
  },
};

const survivalRules: Rules = {
  move(r, rng) {
    const p = r.p.g.pairs() as [number, number][];
    if (!p.length) return false;
    const [a, b] = p[rng.int(p.length)];
    pickTwo(r, a, b);
    return true;
  },
  legal: (r, ids) => ids.length === 2 && r.p.g.canMatch(ids[0], ids[1]),
  stuck: (r) => r.p.g.count > 0 && !r.p.g.pairs().length,
  inv(r) {
    const live = new Set<number>((r.p.g.rows as { slots: number[] }[]).flatMap((x) => x.slots.filter((id) => id >= 0)));
    for (const id of live) expect(r.board.has(id)).toBe(true);
    for (const id of alive(r)) expect(live.has(id)).toBe(true);
    for (const id of live) expect(r.board.kindOf(id)).toBe(r.p.g.kinds[id]);
    expect(r.p.g.rows.length).toBeLessThanOrEqual(8);
  },
  async finishOff(r) {
    for (let i = 0; i < 4000 && !r.finishes.length; i++) await wait(r, 0.5);
  },
};

const treasureRules: Rules = {
  move(r, rng) {
    if (r.p.busy) return false;
    const hidden = alive(r).filter((i) => !r.p.g.open.has(i));
    if (!hidden.length) return false;
    const p = r.p.g.proven();
    r.s.onPick(p >= 0 && rng.next() < 0.6 ? p : hidden[rng.int(hidden.length)]);
    return true;
  },
  legal: (r, ids) => ids.length === 1 && !r.p.g.open.has(ids[0]) && r.p.g.treasure.has(ids[0]),
  inv(r) {
    expect(r.p.digs).toBeGreaterThanOrEqual(0);
    expect(r.p.g.found).toBeLessThanOrEqual(r.p.st.treasures);
  },
  async finishOff(r) {
    for (let i = 0; i < 200 && !r.finishes.length; i++) {
      if (!treasureRules.move(r, new Rng(i))) await wait(r, 1);
      await wait(r, 0.1);
    }
    await wait(r, 1);
  },
};

const bossRules: Rules = {
  move(r, rng) {
    const p = (r.s as any).open(40) as [number, number][];
    if (!p.length) return false;
    const [a, b] = p[rng.int(p.length)];
    pickTwo(r, a, b);
    return true;
  },
  legal: (r, ids) => ids.length === 2 && r.p.g.canMatch(ids[0], ids[1]) && !r.p.locked.has(ids[0]) && !r.p.locked.has(ids[1]),
  stuck: (r) => !r.p.g.pairs(1).length,
  inv(r) {
    (r.p.g.cells as number[]).forEach((v, i) => {
      expect(r.board.has(i)).toBe(v >= 0);
      if (v >= 0) expect(r.board.kindOf(i)).toBe(v);
    });
    for (const c of r.p.locked.keys()) expect(r.p.g.cells[c]).toBeGreaterThanOrEqual(0);
    expect(r.p.hp).toBeLessThanOrEqual(r.p.boss.hp);
  },
  async finishOff(r) {
    for (let i = 0; i < 4000 && !r.finishes.length; i++) {
      if (!bossRules.move(r, new Rng(i))) useShuffle(r);
      await wait(r, 0.3);
    }
  },
};

const chainRules: Rules = {
  move(r, rng) {
    const gs = r.p.g.groups() as number[][];
    if (!gs.length) return false;
    const grp = gs[rng.int(gs.length)];
    r.s.onPick(r.p.idAt[grp[rng.int(grp.length)]]);
    return true;
  },
  legal(r, ids) {
    const cells = ids.map((id) => (r.p.idAt as number[]).indexOf(id));
    if (cells.length < 2 || cells.some((c) => c < 0)) return false;
    const grp = new Set(r.p.g.group(cells[0]));
    return cells.every((c) => grp.has(c)) && grp.size === cells.length;
  },
  inv(r) {
    const cells = r.p.g.cells as number[];
    const idAt = r.p.idAt as number[];
    cells.forEach((k, i) => {
      expect(k >= 0).toBe(idAt[i] >= 0);
      if (k >= 0) {
        expect(r.board.has(idAt[i])).toBe(true);
        expect(r.board.kindOf(idAt[i])).toBe(k);
      }
    });
    expect(alive(r).length).toBe(cells.filter((k) => k >= 0).length);
  },
  async finishOff(r) {
    for (let i = 0; i < 400 && !r.finishes.length; i++) {
      if (!chainRules.move(r, new Rng(i))) await wait(r, 1);
    }
    await wait(r, 1);
  },
};

const rushRules: Rules = {
  move(r, rng) {
    if (r.p.busy) return false;
    const ch = r.p.p.choices as number[];
    const i = rng.next() < 0.85 ? ch.indexOf(r.p.p.answer) : rng.int(4);
    r.s.onPick(10 + i);
    return true;
  },
  legal: () => false,
  async finishOff(r) {
    for (let i = 0; i < 2000 && !r.finishes.length; i++) await wait(r, 0.5);
  },
};

const dungeonRules: Rules = {
  move(r, rng) {
    if (r.p.busy) return false;
    const plan = (r.s as any).plan() as number[] | null;
    const near = r.p.g.near(r.p.at) as number[];
    const to = plan && rng.next() < 0.6 ? plan[0] : near[rng.int(near.length)];
    if (r.p.g.rooms[to].t === 'empty') {
      r.board.felt = (r.s as any).world(to);
      r.s.onEmptyTap!(0, 0, new THREE.PerspectiveCamera(), {} as HTMLElement);
      r.board.felt = null;
    } else r.s.onPick(to);
    return true;
  },
  legal(r, ids) {
    if (ids.length !== 1) return false;
    const room = r.p.g.rooms[ids[0]];
    return r.p.g.near(r.p.at).includes(ids[0]) && room.t !== 'empty' && (room.t !== 'door' || r.p.hasKey);
  },
  inv(r) {
    expect(r.p.hp).toBeLessThanOrEqual(r.p.maxHp);
    expect(r.p.armour).toBeLessThanOrEqual(3);
    const hero = r.board.pose(100000)!.pos;
    if (!r.p.busy && !r.finishes.length) {
      const w = (r.s as any).heroPos(r.p.at) as THREE.Vector3;
      expect(hero.distanceTo(w)).toBeLessThan(1e-6);
    }
  },
  async finishOff(r) {
    for (let i = 0; i < 600 && !r.finishes.length; i++) {
      dungeonRules.move(r, new Rng(i));
      await wait(r, 0.5);
    }
  },
};

const RULES: Record<string, Rules> = { match3: match3Rules, hex: hexRules, colour: colourRules, survival: survivalRules, treasure: treasureRules, boss: bossRules, chain: chainRules, rush: rushRules, dungeon: dungeonRules };

/** A game of moves mixed with random taps, swipes, tools, pauses and suggestions. */
async function chaos(id: string, level: MiniLevel, seed: number, steps: number) {
  const rules = RULES[id];
  const r = start(id, level, seed);
  const rng = new Rng(seed * 7919 + 13);
  await wait(r, 0.6);
  for (let i = 0; i < steps && !r.finishes.length; i++) {
    const roll = rng.next();
    if (roll < 0.55) {
      if (!(await rules.move(r, rng))) await wait(r, 0.3);
    } else if (roll < 0.63) {
      // A random tap: a live tile, a gone one, or no tile at all.
      // A random tap on a live tile (the board only picks tiles that are there).
      const ids = alive(r);
      if (ids.length) r.s.onPick(ids[rng.int(ids.length)]);
    } else if (roll < 0.66 && r.s.onSwipe) {
      const ids = alive(r);
      const v = [0, 0.001, -0.4, 0.4, 3, -3];
      r.s.onSwipe(ids[rng.int(ids.length)], v[rng.int(v.length)], v[rng.int(v.length)]);
    } else if (roll < 0.71) useHint(r);
    else if (roll < 0.75) useUndo(r);
    else if (roll < 0.78) useShuffle(r);
    else if (roll < 0.86) {
      const sug = r.s.suggest?.();
      if (sug === null) {
        if (rules.stuck) expect(rules.stuck(r), `${id} suggested nothing with a move left`).toBe(true);
      } else if (sug && sug.length) expect(rules.legal(r, sug), `${id} suggested ${sug}`).toBe(true);
    } else if (roll < 0.9) {
      // A pause: the game's clock and every timer it runs stand still.
      const before = JSON.stringify([r.stats.time, r.stats.moves, r.stats.combo]);
      const busy = r.p.busy;
      pause(r, true);
      await wait(r, 3);
      if (!r.finishes.length && !busy) expect(JSON.stringify([r.stats.time, r.stats.moves, r.stats.combo])).toBe(before);
      pause(r, false);
    } else await wait(r, rng.next() * 2);
    if (r.finishes.length > 1) break;
    if (!r.finishes.length) rules.inv?.(r);
  }
  if (!r.finishes.length) await rules.finishOff(r);
  expect(r.finishes.length, `${id} ${level} seed ${seed} never finished`).toBe(1);
  // Nothing more happens after the end, whatever is pressed.
  await wait(r, 4);
  for (const t of alive(r).slice(0, 5)) r.s.onPick(t);
  useHint(r), useUndo(r), useShuffle(r);
  r.s.onSwipe?.(0, 1, 0);
  await wait(r, 4);
  r.s.dispose();
  await wait(r, 4);
  return { r, ...checkReward(r) };
}

describe('chaos play-throughs: one finish, legal suggestions, sane rewards', () => {
  const SEEDS: Record<string, number> = { match3: 4, hex: 8, colour: 6, survival: 4, treasure: 12, boss: 3, chain: 10, rush: 8, dungeon: 12 };
  for (const id of Object.keys(RULES))
    it(id, async () => {
      for (const level of LEVELS)
        for (let seed = 1; seed <= SEEDS[id]; seed++) {
          const { res } = await chaos(id, level, seed * 31 + level.length, 160);
          expect(typeof res.won).toBe('boolean');
        }
    }, 120000);
});

// ------------------------------------------------------------ regressions found in this round

describe('round 2 regressions', () => {
  it('a second Hint press while a hint shows spends nothing (Match-3, Hex, Survival, Treasure, Boss, Rush, Dungeon)', async () => {
    for (const id of ['match3', 'hex', 'survival', 'boss', 'rush', 'dungeon', 'treasure']) {
      const r = start(id, 'hard', 5);
      await wait(r, 1);
      if (id === 'dungeon') {
        // Walk about until the route to the goal can be lit.
        for (let i = 0; i < 40 && !(r.s as any).plan() && !r.finishes.length; i++) (dungeonRules.move(r, new Rng(i)), await wait(r, 0.5));
      }
      if (id === 'treasure') for (let i = 0; i < 40 && r.p.g.proven() < 0 && !r.finishes.length; i++) (treasureRules.move(r, new Rng(i)), await wait(r, 0.2));
      if (r.finishes.length) continue;
      const before = { hints: r.p.hints, score: r.p.score };
      expect(useHint(r), id).toBe(true);
      expect(r.s.canUse?.('hint'), id).toBe(false);
      expect(useHint(r), id).toBe(false);
      expect(r.counts.hints).toBe(1);
      if (Number.isFinite(before.hints)) expect(r.p.hints).toBe(before.hints - 1);
      if (id === 'hex') expect(r.p.score).toBe(Math.max(0, before.score - 5));
      r.s.dispose();
    }
  });

  it('hex: undo takes back exactly what the pair scored, so take-undo-take cannot farm points', () => {
    const r = start('hex', 'easy', 11);
    for (let round = 0; round < 6; round++) {
      const before = r.p.score;
      for (let i = 0; i < 3; i++) hexRules.move(r, new Rng(round * 3 + i));
      for (let i = 0; i < 3; i++) useUndo(r);
      expect(r.p.score).toBe(before);
    }
  });

  it('hex: a shuffle or an undo clears a lit hint whose faces have changed', () => {
    const r = start('hex', 'easy', 3);
    expect(useHint(r)).toBe(true);
    expect(useShuffle(r)).toBe(true);
    expect(r.p.hintPair).toEqual([]);
    expect(useHint(r)).toBe(true);
    expect(useUndo(r)).toBe(true);
    expect(r.p.hintPair).toEqual([]);
  });

  it('match3: a swipe with no usable direction (NaN, zero, off the board) changes nothing', async () => {
    const r = start('match3', 'easy', 2);
    const cells = [...r.p.g.cells];
    r.s.onSwipe!(r.p.idAt[0], NaN, 0.5);
    r.s.onSwipe!(r.p.idAt[0], 0.5, Infinity);
    r.s.onSwipe!(r.p.idAt[0], 0, 0);
    r.s.onSwipe!(r.p.idAt[0], -1, 0); // off the left edge
    r.s.onSwipe!(r.p.idAt[0], 0, -1); // off the far edge
    r.s.onSwipe!(r.p.idAt[48], 1, 0.2); // off the right edge
    expect(r.p.busy).toBe(false);
    await wait(r, 2);
    expect(r.p.g.cells).toEqual(cells);
    expect(r.p.moves).toBe(25);
  });

  it('colour: a win pays something, never below zero, however many hints it took', () => {
    const d = miniGame('colour')!;
    for (const level of LEVELS)
      for (const hints of [0, 10, 50, 500]) {
        const v = d.reward({ won: true, score: 100, seconds: 900, cleared: 16, total: 16, hints, undos: 0, shuffles: 0 }, level);
        expect(v).toBeGreaterThan(0);
        expect(v).toBeGreaterThanOrEqual(d.reward({ won: false, score: 0, seconds: 1, cleared: 0, total: 16, hints: 0, undos: 0, shuffles: 0 }, level));
      }
  });

  it('colour: in the moment before the win shows, Hint does not claim the rows cannot be sorted', async () => {
    const r = start('colour', 'easy', 9);
    const sol = new Sorter((r.p.g as Sorter).lanes.map((l) => [...l])).solve(400000)!;
    for (const [a, b] of sol) {
      const top = (l: number) => r.p.ids[l][r.p.ids[l].length - 1];
      r.s.onPick(top(a));
      if (r.p.ids[b].length) r.s.onPick(top(b));
      else {
        r.board.felt = (r.s as any).slot(b, 1.5);
        r.s.onEmptyTap!(0, 0, new THREE.PerspectiveCamera(), {} as HTMLElement);
        r.board.felt = null;
      }
    }
    expect((r.p.g as Sorter).solved()).toBe(true);
    const toasts = r.toasts.length;
    expect(useHint(r)).toBe(false);
    expect(r.s.suggest!()).toEqual([]);
    expect(r.s.canUse!('hint')).toBe(false);
    expect(r.toasts.length).toBe(toasts);
    await wait(r, 1);
    expect(checkReward(r).res.won).toBe(true);
  });

  it('survival: with no two matching tiles on the board, neither a shuffle nor a "no moves" nudge is offered', () => {
    const r = start('survival', 'easy', 4);
    // Leave one row whose tiles all differ.
    const g = r.p.g;
    const row = g.rows[0].slots.filter((id: number) => id >= 0);
    const kinds = [0, 9, 18, 27, 31, 34];
    row.forEach((id: number, i: number) => (g.kinds[id] = kinds[i]));
    g.rows = [g.rows[0]];
    expect(g.canPair()).toBe(false);
    expect(r.s.suggest!()).toEqual([]);
    expect(r.s.canUse!('shuffle')).toBe(false);
    expect(r.s.attention!()).toBe(null);
    expect(useShuffle(r)).toBe(false);
    // Two alike, out of reach of each other: now a shuffle can help.
    g.kinds[row[2]] = g.kinds[row[3]] = 5;
    expect(r.s.suggest!()).toBe(null);
    expect(r.s.canUse!('shuffle')).toBe(true);
    expect(r.s.attention!()).toBe('shuffle');
  });

  it('treasure: taps before the first patch turns over spend no dig, and no hint goes while the end shows', async () => {
    const r = start('treasure', 'easy', 21);
    r.s.onPick(0);
    r.s.onPick(1);
    expect(r.p.digs).toBe(20);
    await wait(r, 0.6);
    expect(r.p.g.open.size).toBeGreaterThan(0);
    // Dig every treasure: the hunt is decided, and a hint now must not count.
    for (const t of [...r.p.g.treasure]) r.s.onPick(t);
    expect(r.p.busy).toBe(true);
    expect(useHint(r)).toBe(false);
    await wait(r, 1);
    const { res } = checkReward(r);
    expect(res.won).toBe(true);
    expect(res.hints).toBe(0);
  });

  it('boss: while a cleared wall is dealt again the boss waits, and nothing claims there are no moves', async () => {
    const r = start('boss', 'medium', 8);
    r.p.hp = 1e6; // the boss cannot fall: clear the whole wall
    r.p.boss = { ...r.p.boss, hp: 1e6 };
    for (let i = 0; i < 200 && r.p.g.left; i++) if (!bossRules.move(r, new Rng(i)) && !useShuffle(r)) break;
    expect(r.p.g.left).toBe(0);
    r.p.nextAttack = 0.05;
    const toasts = r.toasts.length;
    r.s.tick!(0.1);
    r.s.tick!(0.1);
    expect(r.toasts.slice(toasts).some((t) => /locks 0/.test(t))).toBe(false);
    expect(r.p.nextAttack).toBeCloseTo(0.05);
    expect(r.s.suggest!()).toEqual([]);
    expect(r.s.canUse!('hint')).toBe(false);
    expect(r.s.canUse!('shuffle')).toBe(false);
    expect(r.s.attention!()).toBe(null);
    await wait(r, 1);
    expect(r.p.g.left).toBeGreaterThan(0);
    expect(r.finishes.length).toBe(0);
  });

  it('boss: a dead end with no shuffle left ends the fight even while some tiles are locked', async () => {
    const r = start('boss', 'hard', 6);
    const g = r.p.g;
    // A pair side by side, and two tiles that match nothing: a dead end once the pair goes.
    g.cells.fill(-1);
    for (const id of r.board.ids()) if (id !== 100000) r.board.hide(id);
    const put = (i: number, k: number) => ((g.cells[i] = k), r.board.revive(i, {}), r.board.setKind(i, k));
    put(0, 5), put(1, 5), put(20, 9), put(40, 18);
    r.p.shuffles = 0;
    r.p.locked.clear();
    r.p.locked.set(40, r.p.clock.elapsed + 8);
    pickTwo(r, 0, 1);
    await wait(r, 1.2);
    expect(r.finishes.length).toBe(1);
    expect(r.finishes[0].won).toBe(false);
  });

  it('boss: a heal reports what it really heals, and a boss at full health heals nothing', () => {
    const r = start('boss', 'easy', 2); // attacks: lock, heal
    r.p.attackN = 1;
    const toasts = r.toasts.length;
    (r.s as any).attack();
    expect(r.p.hp).toBe(160);
    expect(r.toasts.slice(toasts).some((t) => /heals/.test(t))).toBe(false);
    r.p.hp = 155;
    r.p.attackN = 1;
    (r.s as any).attack();
    expect(r.p.hp).toBe(160);
    expect(r.toasts[r.toasts.length - 1]).toBe('Jade Guardian heals 5');
    // Locks stand still while paused, and free up on the clock.
    r.p.attackN = 0;
    (r.s as any).attack();
    expect(r.p.locked.size).toBe(4);
    pause(r, true);
    for (let i = 0; i < 200; i++) r.s.tick!(0.1);
    expect(r.p.locked.size).toBe(4);
    pause(r, false);
    for (let i = 0; i < 81; i++) r.s.tick!(0.1);
    expect(r.p.locked.size).toBe(0);
  });
});

// ------------------------------------------------------------ the rules as the how-to tells them

describe('rules against the how-to text', () => {
  /** A Match-3 board with no line: four kinds in a pattern, `a` kept for the cells a test sets. */
  function match3Board(seed: number, set: Record<number, 'a'>) {
    const r = start('match3', 'easy', seed);
    const ks = r.p.g.kinds as number[];
    const [a, ...rest] = ks;
    const cells = Array.from({ length: 49 }, (_, i) => rest[((i % 7) + 2 * Math.floor(i / 7)) % 4]);
    for (const c of Object.keys(set)) cells[+c] = a;
    r.p.g.cells = cells;
    cells.forEach((k, i) => r.board.setKind(r.p.idAt[i], k));
    expect((r.p.g as Match3).lines().length).toBe(0);
    return { r, a };
  }
  const cell = (x: number, y: number) => y * 7 + x;

  it('match3: four in a line leaves a Dragon on the moved tile; matching it sweeps its row and column', async () => {
    // Bottom row A A _ A, with an A above the gap: swapping it down makes four.
    const { r } = match3Board(3, { [cell(0, 6)]: 'a', [cell(1, 6)]: 'a', [cell(3, 6)]: 'a', [cell(2, 5)]: 'a' });
    pickTwo(r, r.p.idAt[cell(2, 5)], r.p.idAt[cell(2, 6)]);
    await wait(r, 4);
    expect(r.p.moves).toBe(24);
    expect(r.p.score).toBeGreaterThanOrEqual(30);
    // The Dragon stays (unless a cascade already set it off).
    expect(r.p.dragons.has(cell(2, 6)) || r.toasts.includes('Dragon sweep')).toBe(true);
    expect(r.p.g.lines().length).toBe(0);

    // A Dragon set into a line sweeps 13 cells at least (its row and column).
    const { r: r2 } = match3Board(4, { [cell(0, 6)]: 'a', [cell(1, 6)]: 'a', [cell(2, 5)]: 'a' });
    r2.p.dragons.add(cell(1, 6));
    pickTwo(r2, r2.p.idAt[cell(2, 5)], r2.p.idAt[cell(2, 6)]);
    await wait(r2, 4);
    expect(r2.toasts).toContain('Dragon sweep');
    expect(r2.p.score).toBeGreaterThanOrEqual(13 * 10);
    expect(r2.p.dragons.has(cell(1, 6))).toBe(false);
  });

  it('match3: five in a line clears every tile of that kind', async () => {
    const { r } = match3Board(5, { [cell(0, 6)]: 'a', [cell(1, 6)]: 'a', [cell(3, 6)]: 'a', [cell(4, 6)]: 'a', [cell(2, 5)]: 'a', [cell(6, 0)]: 'a', [cell(5, 2)]: 'a' });
    pickTwo(r, r.p.idAt[cell(2, 5)], r.p.idAt[cell(2, 6)]);
    await wait(r, 4);
    expect(r.toasts).toContain('Five in a line: every tile of that kind clears');
    expect(r.p.score).toBeGreaterThanOrEqual(7 * 10);
  });

  it('match3: a swap that makes no line swaps back and costs no move; a tap far away moves the selection', async () => {
    const { r } = match3Board(6, {});
    const cells = [...r.p.g.cells];
    pickTwo(r, r.p.idAt[cell(0, 0)], r.p.idAt[cell(1, 0)]);
    await wait(r, 1);
    expect(r.p.g.cells).toEqual(cells);
    expect(r.p.moves).toBe(25);
    r.s.onPick(r.p.idAt[cell(0, 0)]);
    r.s.onPick(r.p.idAt[cell(5, 5)]);
    expect(r.p.sel).toBe(cell(5, 5));
    r.s.onPick(r.p.idAt[cell(5, 5)]);
    expect(r.p.sel).toBe(null);
  });

  it('match3: with no swap left the tiles are dealt again, and the move counter decides the end', async () => {
    const r = start('match3', 'medium', 12);
    // Run out of moves: a loss once the last move lands short of the target.
    r.p.moves = 1;
    await match3Rules.move(r, new Rng(1));
    await wait(r, 3);
    const { res } = checkReward(r);
    expect(res.won).toBe(res.score >= 2400);
    // A board with no swap is dealt again after a move.
    const r2 = start('match3', 'easy', 13);
    (r2.p.g as Match3).fill = function (this: Match3) {
      Match3.prototype.fill.call(this);
    };
    const findMove = Match3.prototype.findMove;
    let once = true;
    (r2.p.g as Match3).findMove = function (this: Match3) {
      // The first look after the move finds nothing.
      if (!r2.p.busy && once && r2.p.moves < 25) return (once = false), null;
      return findMove.call(this);
    };
    const m = findMove.call(r2.p.g)!;
    pickTwo(r2, r2.p.idAt[m[0]], r2.p.idAt[m[1]]);
    await wait(r2, 4);
    expect(r2.toasts).toContain('No more swaps: the tiles are dealt again.');
    expect(r2.p.dragons.size).toBe(0);
    match3Rules.inv!(r2);
  });

  it('survival: an idle player sees a row creep in every few seconds and loses when the ninth would come', async () => {
    const every: Record<MiniLevel, number> = { easy: 12, medium: 10, hard: 8 };
    for (const level of LEVELS) {
      const r = start('survival', level, 41);
      expect(r.p.g.rows.length).toBe(4);
      await wait(r, every[level] + 0.6);
      expect(r.p.g.rows.length).toBe(5);
      // A pause holds the next row back.
      pause(r, true);
      for (let i = 0; i < 100; i++) r.s.tick!(0.1); // even if a stray tick arrives
      pause(r, false);
      expect(r.p.g.rows.length).toBe(5);
      await wait(r, every[level] * 3);
      expect(r.p.g.rows.length).toBe(8);
      expect(r.finishes.length).toBe(0);
      await wait(r, every[level] + 0.6);
      expect(r.finishes.length).toBe(1);
      expect(r.finishes[0].won).toBe(false);
      checkReward(r);
    }
  });

  it('chain: a group holding a run scores double; Winds and Dragons are one suit, Flowers and Seasons another', () => {
    const r = start('chain', 'easy', 2);
    const w = 8;
    const g = r.p.g;
    // Clear the field to a known corner: 1-2-3 Characters in a row, and East + Red Dragon below.
    g.cells.fill(26); // all 9 Bamboo, one big group
    g.cells[0] = 0;
    g.cells[1] = 1;
    g.cells[2] = 2;
    g.cells[3] = 9;
    g.cells[w] = 27;
    g.cells[w + 1] = 31;
    g.cells[w + 2] = 9;
    g.cells.forEach((k: number, i: number) => r.board.setKind(r.p.idAt[i], k));
    expect(g.group(0).sort()).toEqual([0, 1, 2]);
    expect(g.hasRun(g.group(0))).toBe(true);
    expect(g.group(w).sort((a: number, b: number) => a - b)).toEqual([w, w + 1]);
    const before = r.p.score;
    r.s.onPick(r.p.idAt[0]);
    expect(r.p.score - before).toBe(3 * 2 * 5 * 2);
    chainRules.inv!(r);
    useUndo(r);
    expect(r.p.score).toBe(before);
    chainRules.inv!(r);
  });

  it('dungeon: monsters cost their number less armour, armour caps at three, flowers heal up to five, the door needs the key', async () => {
    // A deal with a room (a tile) straight ahead of the start.
    let r = start('dungeon', 'easy', 1);
    for (let seed = 2; !r.board.tiles.has(r.p.at - r.p.g.w); seed++) r = start('dungeon', 'easy', seed);
    const g = r.p.g;
    const at = r.p.at as number;
    const up = at - g.w;
    const room = (t: string, kind?: number) => (kind === undefined ? { t } : { t, kind });
    const stepTo = async (i: number, rm: any) => {
      g.rooms[i] = rm;
      if (!r.board.tiles.has(i)) throw new Error('room has no tile');
      r.board.revive(i, {});
      r.s.onPick(i);
      await wait(r, 0.5);
    };
    // Rooms with tiles: use the ones the deal gave (every room but the start has one, or none if empty).
    const tiled = (i: number) => r.board.tiles.has(i);
    let back = at;
    let cur = up;
    expect(tiled(cur)).toBe(true); // this seed deals a room with a tile above the start
    await stepTo(cur, room('monster', 3)); // a 4 of Characters (kind 3)
    expect(r.p.hp).toBe(16 - 4);
    expect(r.p.at).toBe(cur);
    // Back and forth over empty rooms costs nothing.
    r.board.felt = (r.s as any).world(back);
    r.s.onEmptyTap!(0, 0, new THREE.PerspectiveCamera(), {} as HTMLElement);
    r.board.felt = null;
    await wait(r, 0.5);
    expect(r.p.at).toBe(back);
    expect(r.p.hp).toBe(12);
    // Armour: four winds give three armour and ten gold.
    for (let i = 0; i < 4; i++) {
      [back, cur] = [cur, back];
      if (!tiled(cur)) {
        r.board.felt = (r.s as any).world(cur);
        r.s.onEmptyTap!(0, 0, new THREE.PerspectiveCamera(), {} as HTMLElement);
        r.board.felt = null;
        await wait(r, 0.5);
        g.rooms[cur] = room('armour', 27);
        (r.s as any).arrive(cur);
      } else await stepTo(cur, room('armour', 27));
    }
    expect(r.p.armour).toBe(3);
    expect(r.p.gold).toBe(10);
    // A 2 does nothing through three armour; a flower heals 5, never past the most.
    g.rooms[r.p.at] = room('monster', 1);
    (r.s as any).arrive(r.p.at);
    expect(r.p.hp).toBe(12);
    g.rooms[r.p.at] = room('potion', 34);
    (r.s as any).arrive(r.p.at);
    expect(r.p.hp).toBe(16);
    // The door stays shut without the key.
    const door = g.find('door');
    r.p.at = door + g.w;
    r.s.onPick(door);
    await wait(r, 0.5);
    expect(r.p.at).toBe(door + g.w);
    expect(r.toasts).toContain('The door is locked. Find the Green Dragon key first.');
    r.p.hasKey = true;
    r.s.onPick(door);
    await wait(r, 0.5);
    expect(r.finishes.length).toBe(1);
    expect(checkReward(r).res.won).toBe(true);
  });
});

describe('daily boards: pause suggestions and hints never change what the seed deals', () => {
  for (const id of ['hex', 'colour', 'treasure', 'chain', 'dungeon'])
    it(id, async () => {
      for (let seed = 1; seed <= 4; seed++) {
        const a = start(id, 'medium', seed, { daily: true });
        const b = start(id, 'medium', seed, { daily: true });
        const rng = new Rng(seed);
        const fp = (r: Run) => JSON.stringify([...r.board.tiles].map(([k, t]) => [k, t.kind, t.alive]));
        expect(fp(a)).toBe(fp(b));
        await wait(a, 0.6);
        await wait(b, 0.6);
        for (let i = 0; i < 25 && !a.finishes.length; i++) {
          for (let j = 0; j < 3; j++) a.s.suggest?.();
          const seedOfMove = rng.int(1e9);
          await RULES[id].move(a, new Rng(seedOfMove));
          await RULES[id].move(b, new Rng(seedOfMove));
          if (i % 7 === 3) (useShuffle(a), useShuffle(b));
          await wait(a, 0.5);
          await wait(b, 0.5);
          expect(fp(a)).toBe(fp(b));
        }
      }
    });
});

describe('rewards for every level', () => {
  /** The most hints, undos and shuffles a game can report (Infinity where unlimited). */
  const CAPS: Record<string, { hints: number; undos: number; shuffles: number }> = {
    match3: { hints: Infinity, undos: 0, shuffles: 0 },
    hex: { hints: Infinity, undos: Infinity, shuffles: Infinity },
    colour: { hints: Infinity, undos: Infinity, shuffles: 0 },
    survival: { hints: Infinity, undos: 0, shuffles: 3 },
    treasure: { hints: 5, undos: 0, shuffles: 0 },
    boss: { hints: Infinity, undos: 0, shuffles: Infinity },
    chain: { hints: Infinity, undos: Infinity, shuffles: 0 },
    rush: { hints: 3, undos: 0, shuffles: 0 },
    dungeon: { hints: Infinity, undos: 0, shuffles: 0 },
  };
  it('are whole, never negative, never above the daily cap, for any result a game can report', () => {
    const rng = new Rng(77);
    const lim = (v: number) => (Number.isFinite(v) ? v : 2000);
    for (const id of Object.keys(CAPS)) {
      const d = miniGame(id)!;
      const c = CAPS[id];
      for (const level of LEVELS)
        for (let i = 0; i < 3000; i++) {
          const total = 1 + rng.int(200);
          const r: MiniResult = {
            won: rng.next() < 0.5,
            score: rng.next() < 0.1 ? 0 : rng.int(rng.next() < 0.5 ? 1000 : 1e6),
            seconds: rng.next() * 3600,
            cleared: rng.int(total + 1),
            total,
            hints: rng.int(lim(c.hints) + 1),
            undos: rng.int(lim(c.undos) + 1),
            shuffles: rng.int(lim(c.shuffles) + 1),
          };
          if (id === 'dungeon') (r.total = 1), (r.cleared = [0, 0.5, 1][rng.int(3)]);
          const v = d.reward(r, level);
          expect(Number.isFinite(v), `${id} ${level} ${JSON.stringify(r)}`).toBe(true);
          expect(Number.isInteger(v)).toBe(true);
          expect(v, `${id} ${level} ${JSON.stringify(r)}`).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(MINI_DAILY_CAP);
        }
    }
  });
});
