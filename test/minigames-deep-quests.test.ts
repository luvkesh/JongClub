// Deep play-through tests for Mahjong Hex, Survival, Treasure Hunt, Puzzle Rush
// and Dungeon: sessions are started through their MiniGameDef with a stub host
// and a stub board (tweens finish at once), then played to the end many times
// on every level and many seeds by a simulated player.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Rng } from '../src/engine/rng';
import { miniGame } from '../src/minigames/registry';
import { matchGroup } from '../src/minigames/helpers';
import { MINI_DAILY_CAP, miniDailySeed } from '../src/minigames/progress';
import { HexBoard, dealHex } from '../src/minigames/games/hex';
import { Rows } from '../src/minigames/games/survival';
import { Hunt, clueKind, dealHunt } from '../src/minigames/games/treasure';
import { makePuzzle, makesSet } from '../src/minigames/games/rush';
import { Dungeon, dealDungeon, damage, roomKind } from '../src/minigames/games/dungeon';
import type { MiniGameDef, MiniHost, MiniLevel, MiniResult, MiniSession } from '../src/minigames/types';
import '../src/minigames/games';

const LEVELS: MiniLevel[] = ['easy', 'medium', 'hard'];
const g = globalThis as unknown as { window?: unknown };

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
  build(specs: { id: number; kind: number; pos: THREE.Vector3; quat?: THREE.Quaternion }[]) {
    this.builds++;
    this.tiles.clear();
    for (const s of specs) {
      if (this.tiles.has(s.id)) throw new Error(`duplicate tile id ${s.id}`);
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
  }
  moveTo(id: number, to: { pos?: THREE.Vector3; quat?: THREE.Quaternion; scale?: number }, o: { done?: () => void } = {}) {
    const t = this.t(id);
    if (to.pos) t.pos.copy(to.pos);
    if (to.quat) t.quat.copy(to.quat);
    if (to.scale !== undefined) t.scale = to.scale;
    o.done?.();
  }
  place(id: number, p: { pos?: THREE.Vector3; quat?: THREE.Quaternion; scale?: number }) {
    this.moveTo(id, p);
  }
  remove(id: number, o: { done?: () => void } = {}) {
    const t = this.t(id);
    if (!t.alive) return;
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
    this.t(id).kind = kind;
  }
  bounds() {
    return new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
  }
  feltPoint() {
    return null;
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
}

function start(id: string, level: MiniLevel, seed: number, opts: { daily?: boolean; options?: Record<string, string> } = {}): Run {
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
    options: opts.options ?? {},
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
  return { def, s, host, board, finishes, toasts, stats, counts, p: s as unknown as Record<string, any>, level };
}

/** The shell's own buttons: they count successful uses. */
const useHint = (r: Run) => (r.s.hint?.() ? (r.counts.hints++, true) : false);
const useUndo = (r: Run) => (r.s.undo?.() ? (r.counts.undos++, true) : false);
const useShuffle = (r: Run) => (r.s.shuffle?.() ? (r.counts.shuffles++, true) : false);
/** Let pending timeouts fire and tick the game clock. */
function wait(r: Run, sec: number, step = 0.1) {
  for (let t = 0; t < sec - 1e-9; t += step) {
    if (!r.finishes.length) r.s.tick?.(step);
    vi.advanceTimersByTime(step * 1000);
  }
}

function checkResult(r: Run) {
  expect(r.finishes.length).toBe(1);
  const res = r.finishes[0];
  const pay = r.def.reward(res, r.level);
  expect(Number.isFinite(pay)).toBe(true);
  expect(pay).toBeGreaterThanOrEqual(0);
  expect(pay).toBeLessThanOrEqual(MINI_DAILY_CAP);
  expect(res.score).toBeGreaterThanOrEqual(0);
  expect(res.seconds).toBeGreaterThanOrEqual(0);
  expect(res.cleared).toBeLessThanOrEqual(res.total);
  return { res, pay };
}

beforeEach(() => {
  vi.useFakeTimers();
  g.window = globalThis;
});
afterEach(() => {
  vi.useRealTimers();
});

// ------------------------------------------------------------ Mahjong Hex

describe('hex: full games', () => {
  /** Plays a hex game; returns the run. */
  function playHex(level: MiniLevel, seed: number, rng: Rng) {
    const r = start('hex', level, seed);
    const hb = () => r.p.g as HexBoard;
    expect(r.board.ids().length).toBe(hb().cells.length);
    let guard = 0;
    while (!r.finishes.length && guard++ < 2000) {
      const live = hb().kinds.filter((k) => k >= 0).length;
      // Board and rules agree on every tile.
      expect(r.board.ids().sort((a, b) => a - b)).toEqual(hb().kinds.map((k, i) => (k >= 0 ? i : -1)).filter((i) => i >= 0));
      for (const id of r.board.ids()) expect(r.board.kindOf(id)).toBe(hb().kinds[id]);
      // Kinds always pair up.
      const by = new Map<number, number>();
      for (const k of hb().kinds) if (k >= 0) by.set(matchGroup(k), (by.get(matchGroup(k)) ?? 0) + 1);
      for (const n of by.values()) expect(n % 2).toBe(0);
      const sug = r.s.suggest!();
      if (!hb().left) {
        // Board cleared: the win shows after a short pause.
        expect(sug).toEqual([]);
        wait(r, 1);
        continue;
      }
      if (sug === null) {
        expect(hb().pairs().length).toBe(0);
        if (!useShuffle(r)) {
          // Out of shuffles: undo is the only way out. Back right up and try another order.
          expect(r.s.canUndo!()).toBe(true);
          r.p.jams = (r.p.jams ?? 0) + 1;
          while (useUndo(r));
          expect(hb().left).toBe(hb().cells.length);
        } else expect(hb().kinds.filter((k) => k >= 0).length).toBe(live);
        continue;
      }
      expect(sug.length).toBe(2);
      expect(hb().canMatch(sug[0], sug[1])).toBe(true);
      const roll = rng.next();
      if (roll < 0.04 && r.s.canUndo!()) {
        const before = [...hb().kinds];
        r.s.onPick(sug[0]);
        r.s.onPick(sug[1]);
        if (r.finishes.length) break;
        if (hb().left === 0) {
          // Undo inside the win's delay must not leave a won game with tiles on the board.
          useUndo(r);
          wait(r, 1);
          if (!r.finishes.length) expect(hb().left).toBe(2);
          continue;
        }
        useUndo(r);
        expect(hb().kinds).toEqual(before);
        continue;
      }
      if (roll < 0.07) {
        const had = r.p.hints;
        if (useHint(r)) {
          expect(r.p.hintPair.length).toBe(2);
          expect(hb().canMatch(r.p.hintPair[0], r.p.hintPair[1])).toBe(true);
        } else expect(had <= 0 || hb().pairs().length === 0).toBe(true);
      }
      r.s.onPick(sug[0]);
      r.s.onPick(sug[1]);
      wait(r, 0.3);
    }
    wait(r, 2);
    return r;
  }

  it('every level plays out to a single win on many seeds', () => {
    for (const level of LEVELS) {
      let wins = 0,
        jammed = 0;
      for (let seed = 1; seed <= 25; seed++) {
        const r = playHex(level, seed * 7919, new Rng(seed));
        if (r.p.jams) jammed++;
        const { res, pay } = checkResult(r);
        expect(res.won).toBe(true);
        expect(r.board.ids().length).toBe(0);
        expect(res.cleared).toBe(res.total);
        expect(pay).toBeGreaterThan(0);
        wins++;
        // Clock and combo stop after the end.
        const t = r.p.clock.elapsed;
        r.s.tick!(5);
        expect(r.p.clock.elapsed).toBe(t);
        expect(r.s.suggest!()).toEqual([]);
        expect(r.s.hint!()).toBe(false);
        expect(r.s.shuffle!()).toBe(false);
        expect(r.s.undo!()).toBe(false);
      }
      expect(wins).toBe(25);
      // Random play rarely jams with no shuffle left; undo always gets out.
      expect(jammed).toBeLessThanOrEqual(5);
    }
  });

  it('undo straight after the last pair keeps the game going instead of winning with tiles left', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const r = start('hex', 'easy', seed);
      const hb = () => r.p.g as HexBoard;
      // Play to the last pair using a solving order.
      for (let guard = 0; hb().left > 2 && guard < 500; guard++) {
        const p = r.s.suggest!();
        if (!p) {
          useShuffle(r);
          continue;
        }
        r.s.onPick(p[0]);
        r.s.onPick(p[1]);
      }
      let last = r.s.suggest!();
      if (!last) {
        useShuffle(r);
        last = r.s.suggest!();
      }
      r.s.onPick(last![0]);
      r.s.onPick(last![1]);
      expect(hb().left).toBe(0);
      expect(useUndo(r)).toBe(true);
      expect(hb().left).toBe(2);
      vi.advanceTimersByTime(2000);
      expect(r.finishes.length).toBe(0);
      r.s.onPick(last![0]);
      r.s.onPick(last![1]);
      vi.advanceTimersByTime(2000);
      expect(r.finishes.length).toBe(1);
      expect(r.finishes[0].won).toBe(true);
    }
  });

  it('pause stops the clock; shuffles and hints run out where limited', () => {
    const r = start('hex', 'hard', 5);
    r.s.tick!(1);
    r.s.pause!(true);
    r.s.tick!(10);
    expect(r.p.clock.elapsed).toBeCloseTo(1);
    r.s.pause!(false);
    expect(r.s.badges!()).toEqual({ hint: '3', shuffle: '2' });
    let n = 0;
    while (useShuffle(r)) n++;
    expect(n).toBe(2);
    expect(r.s.canUse!('shuffle')).toBe(false);
    n = 0;
    while (useHint(r)) n++;
    expect(n).toBe(3);
    // Undoing shuffles puts the board back exactly.
    const start0 = dealHex(5, new Rng(5)).kinds;
    while (useUndo(r));
    expect(r.p.g.kinds).toEqual(start0);
  });

  it('the same seed deals the same honeycomb (daily puzzle)', () => {
    const seed = miniDailySeed('hex', '2026-11-13');
    expect(miniDailySeed('hex', '2026-11-13')).toBe(seed);
    for (const level of LEVELS) expect(start('hex', level, seed).p.g.kinds).toEqual(start('hex', level, seed).p.g.kinds);
  });

  it('a random fresh removal order exists for many deals and shuffles at every radius', () => {
    for (const R of [3, 4, 5])
      for (let seed = 1; seed <= 15; seed++) {
        const rng = new Rng(seed * 31 + R);
        const b = dealHex(R, rng);
        // Random greedy play with shuffles at dead ends always clears.
        for (let guard = 0; b.left && guard < 400; guard++) {
          const ps = b.pairs();
          if (!ps.length) {
            const n = b.left;
            expect(b.shuffle(rng)).toBe(true);
            expect(b.left).toBe(n);
            continue;
          }
          const [x, y] = ps[rng.int(ps.length)];
          b.kinds[x] = b.kinds[y] = -1;
        }
        expect(b.left).toBe(0);
      }
  });
});

// ------------------------------------------------------------ Survival

describe('survival: full games', () => {
  /** skill: chance per tick of taking an available pair. */
  function playSurvival(level: MiniLevel, seed: number, skill: number, rng: Rng) {
    const r = start('survival', level, seed);
    const rows = () => r.p.g as Rows;
    let guard = 0;
    while (!r.finishes.length && guard++ < 20000) {
      // Every live tile in the rules is live on the board with the same kind.
      if (guard % 10 === 0) {
        const live = rows().rows.flatMap((x) => rows().live(x));
        expect(new Set(r.board.ids())).toEqual(new Set(live));
        for (const id of live) expect(r.board.kindOf(id)).toBe(rows().kinds[id]);
      }
      expect(rows().rows.length).toBeLessThanOrEqual(8);
      if (rng.next() < skill) {
        const sug = r.s.suggest!();
        if (sug === null) {
          if (r.s.canUse!('shuffle')) useShuffle(r);
        } else if (sug.length) {
          expect(rows().canMatch(sug[0], sug[1])).toBe(true);
          r.s.onPick(sug[0]);
          r.s.onPick(sug[1]);
        }
      }
      if (rng.next() < 0.01) useHint(r);
      r.s.tick!(0.1);
      vi.advanceTimersByTime(100);
    }
    vi.advanceTimersByTime(3000);
    return r;
  }

  it('skilled players hold out, idle players lose, and the game stops after the end', () => {
    for (const level of LEVELS) {
      let wins = 0;
      for (let seed = 1; seed <= 15; seed++) {
        const r = playSurvival(level, seed, 0.5, new Rng(seed));
        const { res } = checkResult(r);
        if (res.won) wins++;
        // Nothing creeps after the end.
        const rowsBefore = r.p.g.rows.length;
        const nextIn = r.p.nextIn;
        r.s.tick!(60);
        expect(r.p.g.rows.length).toBe(rowsBefore);
        expect(r.p.nextIn).toBe(nextIn);
        expect(r.finishes.length).toBe(1);
      }
      // Fast play holds out nearly always; Hard (one shuffle) can still jam with no free pair now and then.
      expect(wins).toBeGreaterThanOrEqual(level === 'hard' ? 10 : 13);
      for (let seed = 1; seed <= 5; seed++) {
        const r = playSurvival(level, seed, 0, new Rng(seed));
        const { res } = checkResult(r);
        expect(res.won).toBe(false);
      }
    }
  });

  it('a win never pays less than a loss, even with many hints', () => {
    const def = miniGame('survival')!;
    for (const level of LEVELS) {
      const lossMax = def.reward({ won: false, score: 0, seconds: 179, cleared: 179, total: 180, hints: 0, undos: 0, shuffles: 0 }, level);
      const win = def.reward({ won: true, score: 120, seconds: 180, cleared: 10, total: 100, hints: 40, undos: 0, shuffles: 3 }, level);
      expect(win).toBeGreaterThanOrEqual(lossMax);
    }
  });

  it('pausing stops the rows and the clock', () => {
    const r = start('survival', 'medium', 3);
    r.s.pause!(true);
    r.s.tick!(100);
    expect(r.p.clock.elapsed).toBe(0);
    expect(r.p.nextIn).toBe(10);
    expect(r.p.g.rows.length).toBe(4);
  });

  it('a shuffle that finds no pair leaves every tile as it was (the board still shows those faces)', () => {
    // Four live tiles of four different kinds: no arrangement has a pair.
    const r = new Rows([0, 9, 18, 27, 5, 5]);
    r.push([0, 1, 2, 3]);
    const before = [...r.kinds];
    expect(r.shuffle(new Rng(1))).toBe(false);
    expect(r.kinds).toEqual(before);
    // And in a session: a failed shuffle keeps rules and board in step and costs nothing.
    const run = start('survival', 'easy', 8);
    const rows = run.p.g as Rows;
    const live = rows.rows.flatMap((x) => rows.live(x));
    live.forEach((id, i) => (rows.kinds[id] = i % 34));
    for (const id of live) run.board.setKind(id, rows.kinds[id]);
    const left = run.p.shuffles;
    expect(useShuffle(run)).toBe(false);
    expect(run.p.shuffles).toBe(left);
    for (const id of live) expect(run.board.kindOf(id)).toBe(rows.kinds[id]);
  });

  it('shuffle keeps the tiles and their kinds', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = start('survival', 'hard', seed);
      const before = r.p.g.rows.flatMap((x: { slots: number[] }) => x.slots.filter((i) => i >= 0)).map((id: number) => r.p.g.kinds[id]).sort();
      if (useShuffle(r)) {
        const after = r.p.g.rows.flatMap((x: { slots: number[] }) => x.slots.filter((i) => i >= 0)).map((id: number) => r.p.g.kinds[id]).sort();
        expect(after).toEqual(before);
        expect(r.p.g.pairs().length).toBeGreaterThan(0);
      }
    }
  });
});

// ------------------------------------------------------------ Treasure Hunt

describe('treasure hunt: full games', () => {
  /** A careful player: digs proven treasure, then the hidden cell most likely to be treasure by its clues. */
  function playTreasure(level: MiniLevel, seed: number, rng: Rng) {
    const r = start('treasure', level, seed);
    const h = () => r.p.g as Hunt;
    // Nothing is open until the first patch turns over by itself.
    vi.advanceTimersByTime(500);
    expect(h().open.size).toBeGreaterThan(1);
    let guard = 0;
    while (!r.finishes.length && guard++ < 200) {
      if (r.p.busy) {
        vi.advanceTimersByTime(100);
        continue;
      }
      // Open clue tiles show the right count; every open tile shows its own kind.
      for (const c of h().open) {
        if (h().treasure.has(c)) expect(r.board.kindOf(c)).toBeGreaterThanOrEqual(34);
        else expect(r.board.kindOf(c)).toBe(clueKind(h().clue(c)));
      }
      const sug = r.s.suggest!();
      let pick: number;
      if (sug && sug.length) {
        expect(h().treasure.has(sug[0])).toBe(true);
        expect(h().open.has(sug[0])).toBe(false);
        pick = sug[0];
      } else {
        // Score hidden cells by how short their clues are of treasure.
        const hidden = Array.from({ length: h().w * h().h }, (_, i) => i).filter((i) => !h().open.has(i));
        let best = hidden[rng.int(hidden.length)],
          bs = -1;
        for (const c of hidden) {
          let sc = 0;
          let safe = false;
          for (const n of h().around(c)) {
            if (!h().open.has(n) || h().treasure.has(n)) continue;
            const hid = h().around(n).filter((j) => !h().open.has(j)).length;
            const need = h().clue(n) - h().around(n).filter((j) => h().open.has(j) && h().treasure.has(j)).length;
            if (need === 0) safe = true;
            sc += need / hid;
          }
          if (safe) sc = -1;
          if (sc > bs) [best, bs] = [c, sc];
        }
        pick = best;
      }
      r.s.onPick(pick);
      vi.advanceTimersByTime(50);
    }
    vi.advanceTimersByTime(2000);
    return r;
  }

  it('deals the start on an empty clue and plays out on every level', () => {
    for (const level of LEVELS) {
      let wins = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const r = playTreasure(level, seed * 13, new Rng(seed));
        const { res, pay } = checkResult(r);
        if (res.won) {
          wins++;
          expect(res.cleared).toBe(res.total);
        }
        expect(r.p.digs).toBeGreaterThanOrEqual(0);
        // Everything turns over at the end.
        expect(r.p.g.open.size).toBe(r.p.g.w * r.p.g.h);
        expect(pay).toBeGreaterThanOrEqual(0);
      }
      // A careful player wins most hunts.
      expect(wins).toBeGreaterThanOrEqual(34);
    }
  });

  it('no extra digs once the last dig is spent or the last treasure is found', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const r = start('treasure', 'easy', seed);
      vi.advanceTimersByTime(500);
      const hidden = () => Array.from({ length: 36 }, (_, i) => i).filter((i) => !r.p.g.open.has(i) && !r.p.g.treasure.has(i));
      // Spend the last dig on a plain tile, then keep tapping the treasures.
      r.p.digs = 1;
      r.s.onPick(hidden()[0]);
      expect(r.p.digs).toBe(0);
      const treasures = [...r.p.g.treasure].filter((t) => !r.p.g.open.has(t));
      for (const t of treasures) r.s.onPick(t);
      expect(r.p.digs).toBeGreaterThanOrEqual(0);
      vi.advanceTimersByTime(2000);
      expect(r.finishes.length).toBe(1);
      expect(r.finishes[0].won).toBe(false);
    }
    // After the last treasure, taps don't eat the spare digs.
    const r = start('treasure', 'easy', 99);
    vi.advanceTimersByTime(500);
    for (const t of [...r.p.g.treasure]) r.s.onPick(t);
    const spare = r.p.digs;
    for (let i = 0; i < 36; i++) r.s.onPick(i);
    expect(r.p.digs).toBe(spare);
    vi.advanceTimersByTime(2000);
    expect(r.finishes.length).toBe(1);
    expect(r.finishes[0].won).toBe(true);
  });

  it('clues count the eight neighbours and treasures are never three in a 2x2', () => {
    for (const [w, hgt, n] of [
      [6, 6, 6],
      [7, 7, 9],
      [8, 8, 12],
    ])
      for (let seed = 1; seed <= 60; seed++) {
        const { hunt, start: s0 } = dealHunt(w, hgt, n, new Rng(seed));
        expect(hunt.treasure.size).toBe(n);
        expect(hunt.treasure.has(s0)).toBe(false);
        expect(hunt.clue(s0)).toBe(0);
        for (let i = 0; i < w * hgt; i++) {
          const x = i % w,
            y = Math.floor(i / w);
          let c = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < hgt && hunt.treasure.has((y + dy) * w + x + dx)) c++;
          expect(hunt.clue(i)).toBe(c);
          if (x + 1 < w && y + 1 < hgt) expect([i, i + 1, i + w, i + w + 1].filter((j) => hunt.treasure.has(j)).length).toBeLessThan(3);
        }
        // A dig never turns over a treasure for free.
        const opened = hunt.dig(s0);
        for (const c of opened) expect(hunt.treasure.has(c)).toBe(false);
        // proven() only ever names a hidden treasure.
        const p = hunt.proven();
        if (p >= 0) {
          expect(hunt.treasure.has(p)).toBe(true);
          expect(hunt.open.has(p)).toBe(false);
        }
      }
  });

  it('the same seed hides the same treasures', () => {
    const seed = miniDailySeed('treasure', '2026-11-13');
    for (const level of LEVELS) expect([...start('treasure', level, seed).p.g.treasure]).toEqual([...start('treasure', level, seed).p.g.treasure]);
  });
});

// ------------------------------------------------------------ Puzzle Rush

describe('puzzle rush: full games', () => {
  it('every puzzle has exactly one right answer, including India mixed runs', () => {
    for (const level of LEVELS) {
      const rng = new Rng(level.length * 977);
      for (let i = 0; i < 3000; i++) {
        const p = makePuzzle(rng, level);
        const shown = p.set.filter((_, j) => j !== p.gap);
        expect(p.set[p.gap]).toBe(p.answer);
        expect(makesSet(p.set)).toBe(true);
        expect(new Set(p.choices).size).toBe(4);
        expect(p.choices.every((c) => c >= 0 && c < 34)).toBe(true);
        expect(p.choices.filter((c) => makesSet([...shown, c]))).toEqual([p.answer]);
      }
    }
  });

  function playRush(level: MiniLevel, seed: number, accuracy: number, rng: Rng) {
    const r = start('rush', level, seed);
    let guard = 0;
    while (!r.finishes.length && guard++ < 5000) {
      const pz = r.p.p;
      // The board shows the puzzle: two face-up tiles, the gap and four choices.
      expect(r.board.ids().filter((id) => id >= 10).length).toBe(4);
      for (let i = 0; i < 4; i++) expect(r.board.kindOf(10 + i)).toBe(pz.choices[i]);
      if (!r.p.busy) {
        const right = pz.choices.indexOf(pz.answer);
        let pick = right;
        if (rng.next() > accuracy) {
          const wrong = [0, 1, 2, 3].filter((i) => i !== right && !r.p.wrong.has(10 + i));
          if (wrong.length) pick = wrong[rng.int(wrong.length)];
        }
        if (rng.next() < 0.05 && useHint(r)) expect(r.p.hintId).toBe(10 + right);
        r.s.onPick(10 + pick);
      }
      r.s.tick!(0.4);
      vi.advanceTimersByTime(400);
    }
    vi.advanceTimersByTime(2000);
    return r;
  }

  it('plays out on every level: accurate players win, careless ones lose', () => {
    for (const level of LEVELS)
      for (let seed = 1; seed <= 20; seed++) {
        const good = playRush(level, seed, 1, new Rng(seed));
        const { res: gr, pay: gp } = checkResult(good);
        expect(gr.won).toBe(true);
        expect(gr.cleared).toBe(gr.total);
        const bad = playRush(level, seed, 0.3, new Rng(seed));
        const { res: br, pay: bp } = checkResult(bad);
        expect(br.won).toBe(false);
        expect(bp).toBeLessThan(gp);
        expect(Number(bad.stats.moves)).toBeGreaterThanOrEqual(0);
      }
  });

  it('after the third wrong pick nothing more can be picked, so a lost rush stays lost', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const r = start('rush', 'easy', seed);
      // Solve up to one short of the target.
      for (let i = 0; i < 9; i++) {
        r.s.onPick(10 + r.p.p.choices.indexOf(r.p.p.answer));
        vi.advanceTimersByTime(700);
      }
      // Three wrong picks spread over puzzles, the last on the final puzzle.
      const wrongOf = () => r.p.p.choices.findIndex((c: number) => c !== r.p.p.answer && !r.p.wrong.has(10 + r.p.p.choices.indexOf(c)));
      r.s.onPick(10 + wrongOf());
      r.s.onPick(10 + wrongOf());
      r.s.onPick(10 + wrongOf());
      expect(r.p.strikes).toBe(3);
      // A quick tap on the right answer must not win now.
      r.s.onPick(10 + r.p.p.choices.indexOf(r.p.p.answer));
      expect(r.s.hint!()).toBe(false);
      vi.advanceTimersByTime(2000);
      expect(r.finishes.length).toBe(1);
      expect(r.finishes[0].won).toBe(false);
      expect(r.stats.moves).toBe('0');
    }
  });

  it('the clock runs down to a loss, stops while paused and after the end', () => {
    const r = start('rush', 'hard', 4);
    r.s.pause!(true);
    r.s.tick!(100);
    expect(r.finishes.length).toBe(0);
    r.s.pause!(false);
    r.s.tick!(59.9);
    expect(r.finishes.length).toBe(0);
    r.s.tick!(0.2);
    expect(r.finishes.length).toBe(1);
    expect(r.finishes[0].won).toBe(false);
    r.s.tick!(10);
    expect(r.finishes.length).toBe(1);
    const t = r.p.clock.elapsed;
    r.s.tick!(10);
    expect(r.p.clock.elapsed).toBe(t);
  });
});

// ------------------------------------------------------------ Dungeon

describe('dungeon: full games', () => {
  /** Walks to the key and the door along the safest route (seeing everything). */
  function playDungeon(level: MiniLevel, seed: number, rng: Rng, wander = 0) {
    const r = start('dungeon', level, seed);
    const d = () => r.p.g as Dungeon;
    let guard = 0;
    while (!r.finishes.length && guard++ < 400) {
      if (r.p.busy) {
        vi.advanceTimersByTime(400);
        continue;
      }
      const goal = d().find(r.p.hasKey ? 'door' : 'key');
      let next: number;
      if (rng.next() < wander) {
        const opts = d().near(r.p.at).filter((i) => !(d().rooms[i].t === 'door' && !r.p.hasKey));
        next = opts[rng.int(opts.length)];
      } else {
        const route = d().route(r.p.at, goal, r.p.armour);
        expect(route).not.toBeNull();
        next = route![1][0];
        // The hint follows the same kind of route.
        const sug = r.s.suggest!();
        if (sug?.length) expect(d().near(r.p.at)).toContain(sug![0]);
      }
      const hpBefore = r.p.hp;
      const room = d().rooms[next];
      r.s.onPick(next);
      vi.advanceTimersByTime(400);
      if (room.t === 'monster') expect(r.p.hp).toBe(Math.max(0, hpBefore - damage(room, r.p.armour - 0)));
      // Board shows every non-empty room and nothing else (plus the hero).
      for (let i = 0; i < d().rooms.length; i++) expect(r.board.has(i)).toBe(d().rooms[i].t !== 'empty');
      r.s.tick!(0.4);
    }
    vi.advanceTimersByTime(2000);
    return r;
  }

  it('a careful hero always escapes on every level', () => {
    for (const level of LEVELS)
      for (let seed = 1; seed <= 60; seed++) {
        const r = playDungeon(level, seed * 101, new Rng(seed));
        const { res, pay } = checkResult(r);
        expect(res.won).toBe(true);
        expect(r.p.hp).toBeGreaterThan(0);
        expect(pay).toBeGreaterThan(0);
        // The clock stops at the end.
        const t = r.p.clock.elapsed;
        r.s.tick!(9);
        expect(r.p.clock.elapsed).toBe(t);
      }
  });

  it('random wandering ends in exactly one result, and a fallen hero cannot keep walking', () => {
    for (const level of LEVELS)
      for (let seed = 1; seed <= 40; seed++) {
        const r = playDungeon(level, seed, new Rng(seed), 0.7);
        if (!r.finishes.length) continue; // still wandering safely: no end yet
        const { res } = checkResult(r);
        if (!res.won) expect(r.p.hp).toBe(0);
        else expect(r.p.hp).toBeGreaterThan(0);
      }
  });

  it('a hero who falls cannot step again before the end (no escape at 0 health)', () => {
    let tested = 0;
    for (let seed = 1; seed <= 300 && tested < 5; seed++) {
      const r = start('dungeon', 'hard', seed);
      const d = r.p.g as Dungeon;
      // Find a monster next to the start and drop health so it kills.
      const m = d.near(r.p.at).find((i) => d.rooms[i].t === 'monster');
      if (m === undefined) continue;
      tested++;
      r.p.hp = 1;
      r.s.onPick(m);
      vi.advanceTimersByTime(350);
      expect(r.p.hp).toBe(0);
      const before = r.p.at;
      for (const n of d.near(m)) r.s.onPick(n);
      vi.advanceTimersByTime(350);
      expect(r.p.at).toBe(before);
      vi.advanceTimersByTime(1000);
      expect(r.finishes.length).toBe(1);
      expect(r.finishes[0].won).toBe(false);
    }
    expect(tested).toBe(5);
  });

  it('the door stays shut without the key, and deals are always escapable', () => {
    for (const level of LEVELS)
      for (let seed = 1; seed <= 200; seed++) {
        const d = dealDungeon(level, new Rng(seed));
        expect(d.rooms.filter((x) => x.t === 'key').length).toBe(1);
        expect(d.rooms.filter((x) => x.t === 'door').length).toBe(1);
        expect(d.rooms[d.start].t).toBe('empty');
        const key = d.find('key'),
          door = d.find('door');
        const a = d.route(d.start, key, 0)!,
          b = d.route(key, door, 0)!;
        expect(a[1]).not.toContain(door);
        const hp = { easy: 16, medium: 14, hard: 12 }[level];
        // Walking the route for real leaves the hero standing.
        let left = hp;
        for (const c of [...a[1], ...b[1]]) left -= damage(d.rooms[c], 0);
        expect(left).toBeGreaterThan(0);
        for (const room of d.rooms) if (room.t !== 'empty') expect(roomKind(room)).toBeGreaterThanOrEqual(0);
      }
    const r = start('dungeon', 'easy', 3);
    const d = r.p.g as Dungeon;
    // Teleport next to the door without the key.
    const door = d.find('door');
    r.p.at = d.near(door).find((i: number) => d.rooms[i].t !== 'door')!;
    r.s.onPick(door);
    vi.advanceTimersByTime(1000);
    expect(r.finishes.length).toBe(0);
    expect(r.p.at).not.toBe(door);
  });

  it('taps on the felt step into empty rooms next to the hero', () => {
    const r = start('dungeon', 'easy', 12);
    const d = r.p.g as Dungeon;
    const b = r.board;
    const at = (i: number) => new THREE.Vector3(((i % d.w) - (d.w - 1) / 2) * (b.w + 0.08), 0, (Math.floor(i / d.w) - (d.h - 1) / 2) * (b.h + 0.08));
    let target = d.near(r.p.at).find((i) => d.rooms[i].t === 'empty');
    if (target === undefined) {
      d.rooms[d.near(r.p.at)[0]] = { t: 'empty' };
      target = d.near(r.p.at)[0];
    }
    b.feltPoint = () => at(target!) as unknown as null;
    r.s.onEmptyTap!(0, 0, new THREE.PerspectiveCamera(), {} as HTMLElement);
    vi.advanceTimersByTime(400);
    expect(r.p.at).toBe(target);
    expect(r.p.steps).toBe(1);
  });

  it('a win never pays less than a loss, even with many hints on Easy', () => {
    const def = miniGame('dungeon')!;
    for (const level of LEVELS) {
      const lossMax = def.reward({ won: false, score: 500, seconds: 60, cleared: 0.5, total: 1, hints: 0, undos: 0, shuffles: 0 }, level);
      const win = def.reward({ won: true, score: 110, seconds: 60, cleared: 1, total: 1, hints: 30, undos: 0, shuffles: 0 }, level);
      expect(win).toBeGreaterThanOrEqual(lossMax);
    }
  });

  it('the same seed builds the same dungeon', () => {
    const seed = miniDailySeed('dungeon', '2026-11-13');
    for (const level of LEVELS) expect(JSON.stringify(start('dungeon', level, seed).p.g.rooms)).toBe(JSON.stringify(start('dungeon', level, seed).p.g.rooms));
  });
});

describe('follow-ups from the mini-game retest (2026-11-13)', () => {
  it('hex: a dead end with no shuffle left ends as a loss, unless an undo gets out first', () => {
    const r = start('hex', 'medium', 4);
    const hb = r.p.g as HexBoard;
    r.p.shuffles = 0;
    const realPairs = hb.pairs.bind(hb);
    let stuck = true;
    hb.pairs = ((n?: number) => (stuck ? [] : realPairs(n))) as typeof hb.pairs;
    r.p.loseIfStuck();
    wait(r, 2);
    expect(r.finishes.length).toBe(1);
    expect(r.finishes[0].won).toBe(false);
    // A second game where the player gets out in time keeps playing.
    const r2 = start('hex', 'medium', 4);
    const hb2 = r2.p.g as HexBoard;
    r2.p.shuffles = 0;
    const real2 = hb2.pairs.bind(hb2);
    stuck = true;
    hb2.pairs = ((n?: number) => (stuck ? [] : real2(n))) as typeof hb2.pairs;
    r2.p.loseIfStuck();
    stuck = false;
    wait(r2, 2);
    expect(r2.finishes.length).toBe(0);
  });

  it('hex: pause suggestions leave the deal’s own random stream alone (daily shuffles stay the same)', () => {
    const a = start('hex', 'hard', 9);
    const b = start('hex', 'hard', 9);
    for (let i = 0; i < 20; i++) a.s.suggest!();
    expect(a.host.rng.next()).toBe(b.host.rng.next());
  });

  it('dungeon: the hint routes only through rooms you have seen', () => {
    let checked = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const r = start('dungeon', 'hard', seed);
      const seen = r.p.seen as Set<number>;
      // Light the goal (as if a lantern showed it) and ask again.
      seen.add(r.p.g.find('key'));
      const plan = r.p.plan() as number[] | null;
      if (!plan) continue;
      checked++;
      for (const c of plan.slice(0, -1)) expect(seen.has(c)).toBe(true);
    }
    expect(checked).toBeGreaterThan(0);
  });
});
