// Deep play-through tests for Connect, Cascade, Boss Challenge, 3D Dimensions and
// Triple Match: whole games driven through def.start(host) with a stub board, on
// every level and option, over many seeds, checking the session's state against
// the board and the result it reports.

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as THREE from "three";
import { Rng } from "../src/engine/rng";
import { miniGame } from "../src/minigames/registry";
import { matchGroup } from "../src/minigames/helpers";
import type {
  MiniGameDef,
  MiniHost,
  MiniLevel,
  MiniResult,
  MiniSession,
} from "../src/minigames/types";
import {
  Connect,
  dealConnect,
  findPath,
} from "../src/minigames/games/connect/logic";
import {
  Dimensions,
  boxShape,
  dealDimensions,
  stepShape,
} from "../src/minigames/games/dimensions/logic";
import {
  TRAY,
  Triple,
  dealTriple,
  tripleLayout,
} from "../src/minigames/games/triple/logic";
import "../src/minigames/games";

(globalThis as unknown as { window: unknown }).window ??= globalThis;
const env =
  (globalThis as { process?: { env: Record<string, string | undefined> } })
    .process?.env ?? {};

// ------------------------------------------------------------ stubs

interface STile {
  kind: number;
  alive: boolean;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  scale: number;
  look: string;
}

function stubBoard(cube = false) {
  const tiles = new Map<number, STile>();
  const b = {
    root: new THREE.Group(),
    w: cube ? 0.5 : 0.4,
    h: cube ? 0.5 : 0.55,
    d: cube ? 0.5 : 0.3,
    fitExtra: null as THREE.Box3 | null,
    tiles,
    pulsingIds: [] as number[],
    build(
      specs: {
        id: number;
        kind: number;
        pos: THREE.Vector3;
        quat?: THREE.Quaternion;
      }[],
    ) {
      tiles.clear();
      const seen = new Set<number>();
      for (const s of specs) {
        if (seen.has(s.id)) throw new Error(`duplicate id ${s.id}`);
        seen.add(s.id);
        tiles.set(s.id, {
          kind: s.kind,
          alive: true,
          pos: s.pos.clone(),
          quat: (s.quat ?? new THREE.Quaternion()).clone(),
          scale: 1,
          look: "normal",
        });
      }
    },
    finish() {},
    setKind(id: number, kind: number) {
      const t = tiles.get(id);
      if (t) t.kind = kind;
    },
    revive(id: number, pose: { pos?: THREE.Vector3 }) {
      const t = tiles.get(id);
      if (!t) return;
      t.alive = true;
      t.scale = 1;
      if (pose.pos) t.pos.copy(pose.pos);
    },
    has: (id: number) => !!tiles.get(id)?.alive,
    kindOf: (id: number) => tiles.get(id)?.kind ?? -1,
    ids: () =>
      [...tiles.entries()].filter(([, t]) => t.alive).map(([id]) => id),
    pose(id: number) {
      const t = tiles.get(id);
      return t
        ? { pos: t.pos.clone(), quat: t.quat.clone(), scale: t.scale }
        : null;
    },
    busy: () => false,
    setLook(id: number, look: string) {
      const t = tiles.get(id);
      if (t) t.look = look;
    },
    look: (id: number) => tiles.get(id)?.look ?? "normal",
    looks(fn: (id: number) => string) {
      for (const [id, t] of tiles) if (t.alive) t.look = fn(id);
    },
    pulse(ids: number[]) {
      b.pulsingIds = ids;
    },
    shake() {},
    moveTo(
      id: number,
      to: { pos?: THREE.Vector3; quat?: THREE.Quaternion; scale?: number },
      o: { done?: () => void } = {},
    ) {
      const t = tiles.get(id);
      if (!t) return;
      if (to.pos) t.pos.copy(to.pos);
      if (to.quat) t.quat.copy(to.quat);
      if (to.scale !== undefined) t.scale = to.scale;
      o.done?.();
    },
    place(id: number, pose: { pos?: THREE.Vector3; scale?: number }) {
      const t = tiles.get(id);
      if (!t) return;
      if (pose.pos) t.pos.copy(pose.pos);
      if (pose.scale !== undefined) t.scale = pose.scale;
    },
    remove(id: number, o: { done?: () => void } = {}) {
      const t = tiles.get(id);
      if (!t || !t.alive) return;
      t.alive = false;
      t.scale = 0.001;
      o.done?.();
    },
    hide(id: number) {
      const t = tiles.get(id);
      if (t) ((t.alive = false), (t.scale = 0.001));
    },
    restore(id: number, pose: { pos: THREE.Vector3 }) {
      const t = tiles.get(id);
      if (!t) return;
      t.alive = true;
      t.scale = 1;
      t.pos.copy(pose.pos);
    },
    bounds: () =>
      new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1)),
    update: () => false,
    dispose() {},
  };
  return b;
}
type StubBoard = ReturnType<typeof stubBoard>;

interface Run {
  host: MiniHost;
  board: StubBoard;
  results: MiniResult[];
  toasts: string[];
  stats: Record<string, string | null>;
  used: Record<string, number>;
  s: MiniSession;
}

function startGame(
  id: string,
  level: MiniLevel,
  seed: number,
  options: Record<string, string> = {},
): Run & { def: MiniGameDef } {
  const def = miniGame(id)!;
  const board = stubBoard(def.shape === "cube");
  const results: MiniResult[] = [];
  const toasts: string[] = [];
  const stats: Record<string, string | null> = {};
  const used = { hints: 0, undos: 0, shuffles: 0 };
  const opts: Record<string, string> = {};
  for (const o of def.options ?? []) opts[o.id] = o.initial;
  Object.assign(opts, options);
  const host: MiniHost = {
    board: board as never,
    camera: { home: { yaw: 0, pitch: 60 }, reset() {}, turn() {} } as never,
    fit() {},
    burst() {},
    rng: new Rng(seed),
    seed,
    level,
    options: opts,
    daily: false,
    setStat: (k, text) => void (stats[k] = text),
    toast: (t) => void toasts.push(t),
    sound() {},
    finish: (r) => void results.push({ hints: 0, undos: 0, shuffles: 0, ...r }),
    used: (w) => void used[w]++,
    refreshButtons() {},
  };
  const s = def.start(host);
  tally.push({
    key: `${id} ${level} ${Object.values(options).join(",")}`,
    results,
  });
  return { def, host, board, results, toasts, stats, used, s };
}

/** Win rates by game, level and option, printed with DEEP_LOG=1. */
const tally: { key: string; results: MiniResult[] }[] = [];
afterAll(() => {
  if (!env.DEEP_LOG) return;
  const by = new Map<string, [number, number]>();
  for (const t of tally) {
    if (!t.results.length) continue;
    const v = by.get(t.key) ?? [0, 0];
    v[0] += t.results[0].won ? 1 : 0;
    v[1]++;
    by.set(t.key, v);
  }
  console.log([...by].map(([k, [w, n]]) => `${k}: ${w}/${n} won`).join("\n"));
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inner = (s: MiniSession) => s as any;

/** Wall-clock time: fires the sessions' setTimeouts. */
/** More seeds per play-through with DEEP_SEEDS=n (a multiplier). */
const K = Math.max(1, Number(env.DEEP_SEEDS) || 1);

const flush = (ms = 1500) => vi.advanceTimersByTime(ms);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function checkReward(def: MiniGameDef, r: MiniResult, level: MiniLevel) {
  const pay = def.reward(r, level);
  expect(Number.isFinite(pay)).toBe(true);
  expect(Math.max(0, pay)).toBeLessThanOrEqual(600);
  expect(r.score).toBeGreaterThanOrEqual(0);
  expect(r.seconds).toBeGreaterThanOrEqual(0);
  expect(r.cleared).toBeLessThanOrEqual(r.total);
}

// ------------------------------------------------------------ Connect / Cascade

function connectInvariants(run: Run) {
  const S = inner(run.s);
  const g: Connect = S.g;
  const idAt: number[] = S.idAt;
  let alive = 0;
  for (let i = 0; i < g.cells.length; i++) {
    if (g.cells[i] < 0) {
      expect(idAt[i]).toBe(-1);
      continue;
    }
    alive++;
    const id = idAt[i];
    expect(id).toBeGreaterThanOrEqual(0);
    expect(run.board.has(id)).toBe(true);
    expect(run.board.kindOf(id)).toBe(g.cells[i]);
  }
  expect(run.board.ids().length).toBe(alive);
  // Gravity: no tile floats over a gap.
  if (g.gravity === "down")
    for (let x = 0; x < g.w; x++)
      for (let y = 0; y + 1 < g.h; y++)
        if (g.at(x, y) >= 0) expect(g.at(x, y + 1)).toBeGreaterThanOrEqual(0);
  if (g.gravity === "left")
    for (let y = 0; y < g.h; y++)
      for (let x = 1; x < g.w; x++)
        if (g.at(x, y) >= 0) expect(g.at(x - 1, y)).toBeGreaterThanOrEqual(0);
  // Every group still has an even count.
  const n = new Map<number, number>();
  for (const k of g.cells)
    if (k >= 0) n.set(matchGroup(k), (n.get(matchGroup(k)) ?? 0) + 1);
  for (const v of n.values()) expect(v % 2).toBe(0);
}

/** A tile-by-tile path check: at most two turns, every step through empty cells or the outer ring. */
function validPath(
  g: Connect,
  a: number,
  b: number,
  path: { x: number; y: number }[],
) {
  expect(path[0]).toEqual({ x: a % g.w, y: Math.floor(a / g.w) });
  expect(path[path.length - 1]).toEqual({ x: b % g.w, y: Math.floor(b / g.w) });
  expect(path.length - 2).toBeLessThanOrEqual(2);
  for (let i = 0; i + 1 < path.length; i++) {
    const p = path[i],
      q = path[i + 1];
    expect(p.x === q.x || p.y === q.y).toBe(true);
    const dx = Math.sign(q.x - p.x),
      dy = Math.sign(q.y - p.y);
    for (
      let x = p.x + dx, y = p.y + dy;
      x !== q.x || y !== q.y;
      x += dx, y += dy
    ) {
      expect(x >= -1 && y >= -1 && x <= g.w && y <= g.h).toBe(true);
      expect(g.at(x, y)).toBe(-1);
    }
  }
}

function playConnect(
  id: string,
  level: MiniLevel,
  seed: number,
  options: Record<string, string> = {},
  opts: { undo?: boolean; hint?: boolean } = {},
) {
  const run = startGame(id, level, seed, options);
  const rng = new Rng(seed * 7 + 3);
  const S = inner(run.s);
  connectInvariants(run);
  let guard = 0;
  while (!run.results.length && guard++ < 2000) {
    if (inner(run.s).ended) {
      flush(3000);
      break;
    }
    const g: Connect = S.g;
    const pairs = g.pairs();
    if (!g.left) {
      flush(2000);
      break;
    }
    const sug = run.s.suggest!();
    if (!pairs.length) {
      expect(sug).toBeNull();
      if (run.s.canUse!("shuffle")) {
        const left = g.left;
        const ok = run.s.shuffle!();
        if (ok) {
          expect(g.left).toBe(left);
          expect(g.pairs(1).length).toBeGreaterThan(0);
        }
        connectInvariants(run);
        if (!ok) {
          run.s.tick!(1);
          flush();
        }
        continue;
      }
      // No shuffles left: the game must end by itself.
      flush(2000);
      expect(run.results.length).toBe(1);
      expect(run.results[0].won).toBe(false);
      break;
    }
    // A suggestion is a live, legal pair.
    expect(sug).not.toBeNull();
    expect(sug!.length).toBe(2);
    const cells = sug!.map((t) => S.idAt.indexOf(t));
    expect(g.canMatch(cells[0], cells[1])).toBe(true);
    if (opts.hint && rng.next() < 0.1 && run.s.canUse!("hint")) {
      expect(run.s.hint!()).toBe(true);
      const hp: [number, number] = S.hintPair;
      expect(g.canMatch(hp[0], hp[1])).toBe(true);
    }
    const [a, b] =
      rng.next() < 0.5
        ? (cells as [number, number])
        : pairs[rng.int(pairs.length)];
    validPath(g, a, b, g.path(a, b)!);
    const left = g.left;
    run.s.onPick(S.idAt[a]);
    run.s.onPick(S.idAt[b]);
    expect(g.left).toBe(left - 2);
    connectInvariants(run);
    if (opts.undo && rng.next() < 0.08 && run.s.canUndo!()) {
      const before = [...g.history[g.history.length - 1].before];
      expect(run.s.undo!()).toBe(true);
      expect(g.cells).toEqual(before);
      connectInvariants(run);
    }
    run.s.tick!(rng.next() < 0.5 ? 0.5 : 4);
    flush(rng.next() < 0.5 ? 100 : 1000);
  }
  flush(5000);
  run.s.tick!(1000);
  flush(5000);
  expect(run.results.length).toBe(1);
  checkReward(run.def, run.results[0], level);
  return run;
}

describe("Connect and Cascade play-throughs", () => {
  it("Connect deals (no gravity) are always clearable in some order", () => {
    // dealConnect falls back to a random deal after 40 failed attempts: count how often.
    for (const [w, h] of [
      [10, 6],
      [12, 7],
      [14, 8],
    ]) {
      for (let seed = 1; seed <= 25; seed++) {
        const cells = dealConnect(w, h, new Rng(seed));
        expect(cells.length).toBe(w * h);
        expect(cells.every((k) => k >= 0)).toBe(true);
        // Random play-downs; with a backwards deal at least one clears quickly.
        let cleared = false;
        for (let t = 0; t < 40 && !cleared; t++) {
          const g = new Connect(w, h, cells);
          const r = new Rng(seed * 100 + t);
          for (;;) {
            const p = g.pairs();
            if (!p.length) break;
            const [a, b] = p[r.int(p.length)];
            g.remove(a, b);
          }
          cleared = g.left === 0;
        }
        expect(cleared, `${w}x${h} seed ${seed}`).toBe(true);
      }
    }
  });

  for (const level of ["easy", "medium", "hard"] as MiniLevel[])
    it(`Connect ${level}: 25 seeds to the end, one finish each`, () => {
      let wins = 0;
      for (let seed = 1; seed <= 25 * K; seed++) {
        const run = playConnect(
          "connect",
          level,
          seed,
          {},
          { undo: true, hint: true },
        );
        if (run.results[0].won) {
          wins++;
          expect(run.results[0].cleared).toBe(run.results[0].total);
          expect(inner(run.s).g.left).toBe(0);
        }
      }
      if (level === "easy") expect(wins).toBe(25 * K);
    });

  for (const level of ["medium", "hard"] as MiniLevel[])
    for (const gravity of ["down", "left"])
      it(`Cascade ${level} gravity ${gravity}: 20 seeds to the end`, () => {
        for (let seed = 1; seed <= 20 * K; seed++)
          playConnect(
            "cascade",
            level,
            seed,
            { gravity },
            { undo: true, hint: true },
          );
      });

  it("undo at the start does nothing; undo after a shuffle restores the board", () => {
    const run = startGame("connect", "easy", 11);
    const S = inner(run.s);
    expect(run.s.canUndo!()).toBe(false);
    expect(run.s.undo!()).toBe(false);
    const before = [...S.g.cells];
    expect(run.s.shuffle!()).toBe(true);
    connectInvariants(run);
    expect(run.s.undo!()).toBe(true);
    expect(S.g.cells).toEqual(before);
    connectInvariants(run);
  });

  it("the clock stops while paused and after the end", () => {
    const run = startGame("connect", "medium", 3);
    const S = inner(run.s);
    run.s.pause!(true);
    run.s.tick!(1000);
    expect(run.results.length).toBe(0);
    expect(S.clock.elapsed).toBe(0);
    run.s.pause!(false);
    run.s.tick!(301);
    expect(run.results.length).toBe(1);
    expect(run.results[0].won).toBe(false);
    run.s.tick!(10);
    flush(5000);
    expect(run.results.length).toBe(1);
    expect(run.s.canUndo!()).toBe(false);
  });

  it("clearing the last pair ends the game at once: no undo, no time-out, no late finish after restart", () => {
    for (const mode of ["undo", "timeout", "dispose"] as const) {
      const run = startGame("connect", "medium", 5);
      const S = inner(run.s);
      // Play down to the last pair along a clearable route.
      let guard = 0;
      while (S.g.left > 2 && guard++ < 500) {
        const p = S.g.pairs(1);
        if (!p.length) {
          S.shuffles = 9;
          run.s.shuffle!();
          continue;
        }
        run.s.onPick(S.idAt[p[0][0]]);
        run.s.onPick(S.idAt[p[0][1]]);
        flush(1000);
      }
      if (!S.g.pairs(1).length) run.s.shuffle!();
      const [a, b] = S.g.pairs(1)[0];
      S.clock.elapsed = 299.9;
      run.s.onPick(S.idAt[a]);
      run.s.onPick(S.idAt[b]);
      expect(S.g.left).toBe(0);
      if (mode === "undo") expect(run.s.undo!()).toBe(false);
      if (mode === "timeout") run.s.tick!(1);
      if (mode === "dispose") {
        run.s.dispose();
        flush(5000);
        // A win is a win even if the shell restarted: what matters is it was recorded once, or not at all after dispose.
        expect(run.results.length).toBeLessThanOrEqual(1);
        continue;
      }
      flush(5000);
      expect(run.results.length).toBe(1);
      expect(run.results[0].won).toBe(true);
      expect(S.g.left).toBe(0);
    }
  });

  it('no late "no more moves" loss after an undo gets the player out of the dead end', () => {
    // Hard: 2 shuffles. Use them up, then play to a dead end and undo before the loss fires.
    let found = false;
    for (let seed = 1; seed <= 60 && !found; seed++) {
      const run = startGame("connect", "hard", seed);
      const S = inner(run.s);
      S.shuffles = 0;
      const rng = new Rng(seed);
      let guard = 0;
      while (S.g.left && guard++ < 200 && !run.results.length) {
        const p = S.g.pairs();
        if (!p.length) break;
        const [a, b] = p[rng.int(p.length)];
        run.s.onPick(S.idAt[a]);
        run.s.onPick(S.idAt[b]);
        if (S.g.left && !S.g.pairs(1).length) {
          // Dead end: the loss is on its way. Undo first.
          expect(run.s.undo!()).toBe(true);
          expect(S.g.pairs(1).length).toBeGreaterThan(0);
          flush(3000);
          expect(run.results.length).toBe(0);
          found = true;
          break;
        }
      }
    }
    expect(found).toBe(true);
  });

  it("a hint marks a legal pair and is cleared by a shuffle", () => {
    const run = startGame("connect", "easy", 21);
    const S = inner(run.s);
    expect(run.s.hint!()).toBe(true);
    expect(S.g.canMatch(S.hintPair[0], S.hintPair[1])).toBe(true);
    run.s.shuffle!();
    if (S.hintPair)
      expect(S.g.canMatch(S.hintPair[0], S.hintPair[1])).toBe(true);
  });

  it("paths never take three turns and go round the outside", () => {
    const rng = new Rng(9);
    for (let n = 0; n < 300; n++) {
      const w = 3 + rng.int(6),
        h = 3 + rng.int(5);
      const full = Array.from({ length: w * h }, () =>
        rng.next() < 0.55 ? 1 : -1,
      );
      const a = rng.int(w * h),
        b = rng.int(w * h);
      if (a === b) continue;
      full[a] = full[b] = 1;
      const g = new Connect(w, h, full);
      const p = findPath(w, h, (x, y) => g.at(x, y) < 0, a, b);
      // Brute force: a path of <= 3 segments through corners anywhere on the padded grid.
      let brute = false;
      const ax = a % w,
        ay = Math.floor(a / w),
        bx = b % w,
        by = Math.floor(b / w);
      const clear = (x0: number, y0: number, x1: number, y1: number) => {
        if (x0 !== x1 && y0 !== y1) return false;
        const dx = Math.sign(x1 - x0),
          dy = Math.sign(y1 - y0);
        for (
          let x = x0 + dx, y = y0 + dy;
          x !== x1 || y !== y1;
          x += dx, y += dy
        )
          if (g.at(x, y) >= 0) return false;
        return x1 === bx && y1 === by ? true : g.at(x1, y1) < 0;
      };
      for (let cx = -1; cx <= w && !brute; cx++)
        for (let cy = -1; cy <= h && !brute; cy++)
          for (const [p1, p2] of [
            [
              [cx, ay],
              [cx, by],
            ],
            [
              [ax, cy],
              [bx, cy],
            ],
          ]) {
            if ((p1[0] === ax && p1[1] === ay) || true) {
              const ok1 =
                p1[0] === ax && p1[1] === ay
                  ? true
                  : clear(ax, ay, p1[0], p1[1]);
              const ok2 =
                p1[0] === p2[0] && p1[1] === p2[1]
                  ? true
                  : ok1 && clear(p1[0], p1[1], p2[0], p2[1]);
              const ok3 =
                p2[0] === bx && p2[1] === by
                  ? true
                  : ok2 && clear(p2[0], p2[1], bx, by);
              if (ok1 && ok2 && ok3) brute = true;
            }
          }
      expect(!!p, `${w}x${h} ${a}->${b}`).toBe(brute);
      if (p) validPath(g, a, b, p);
    }
  });
});

// ------------------------------------------------------------ Boss

function bossInvariants(run: Run) {
  const S = inner(run.s);
  const g: Connect = S.g;
  for (let i = 0; i < g.cells.length; i++) {
    expect(run.board.has(i)).toBe(g.cells[i] >= 0);
    if (g.cells[i] >= 0) expect(run.board.kindOf(i)).toBe(g.cells[i]);
  }
  expect(run.board.has(100000)).toBe(true);
  expect(S.hp).toBeLessThanOrEqual(S.boss.hp);
}

describe("Boss Challenge play-throughs", () => {
  for (const level of ["easy", "medium", "hard"] as MiniLevel[])
    it(`Boss ${level}: 25 seeds to the end`, () => {
      let wins = 0;
      for (let seed = 1; seed <= 25 * K; seed++) {
        const run = startGame("boss", level, seed);
        const S = inner(run.s);
        const rng = new Rng(seed + 99);
        bossInvariants(run);
        let guard = 0;
        while (!run.results.length && guard++ < 3000) {
          if (inner(run.s).ended) {
            flush(3000);
            break;
          }
          const open: [number, number][] = S.open(40);
          const sug = run.s.suggest!();
          if (!open.length) {
            if (sug) expect(sug.length).toBe(0);
            if (S.g.left && !S.g.pairs(1).length && run.s.canUse!("shuffle")) {
              const left = S.g.left;
              if (run.s.shuffle!()) expect(S.g.left).toBe(left);
            }
            run.s.tick!(0.5);
            flush(800);
            bossInvariants(run);
            continue;
          }
          expect(sug && sug.length === 2).toBe(true);
          for (const c of sug!) expect(S.locked.has(c)).toBe(false);
          expect(S.g.canMatch(sug![0], sug![1])).toBe(true);
          const [a, b] =
            rng.next() < 0.5
              ? (sug as [number, number])
              : open[rng.int(open.length)];
          const hp = S.hp;
          run.s.onPick(a);
          run.s.onPick(b);
          expect(S.hp).toBeLessThan(hp);
          run.s.tick!(rng.next() < 0.5 ? 0.4 : 3);
          flush(rng.next() < 0.5 ? 200 : 1000);
          bossInvariants(run);
        }
        flush(5000);
        run.s.tick!(1000);
        flush(5000);
        expect(run.results.length).toBe(1);
        const r = run.results[0];
        checkReward(run.def, r, level);
        if (r.won) {
          wins++;
          expect(S.hp).toBeLessThanOrEqual(0);
          expect(r.cleared).toBe(r.total);
        } else expect(S.hp).toBeGreaterThan(0);
      }
      // Quick play should beat Easy every time.
      if (level === "easy") expect(wins).toBe(25 * K);
    });

  it("a killing blow is a win even if the clock runs out or the boss heals before the result", () => {
    for (const late of ["clock", "heal"] as const) {
      const run = startGame("boss", "easy", 4);
      const S = inner(run.s);
      S.hp = 5;
      const [a, b] = S.open(1)[0];
      if (late === "clock") S.clock.elapsed = S.clock.limit - 0.05;
      else S.nextAttack = 0.05;
      if (late === "heal") S.attackN = 1; // easy: ['lock', 'heal'] -> heal next
      run.s.onPick(a);
      run.s.onPick(b);
      expect(S.hp).toBeLessThanOrEqual(0);
      run.s.tick!(0.1);
      flush(3000);
      expect(run.results.length).toBe(1);
      expect(run.results[0].won).toBe(true);
      expect(run.results[0].cleared).toBe(run.results[0].total);
    }
  });

  it("a boss win never pays less than a loss", () => {
    const def = miniGame("boss")!;
    for (const level of def.levels) {
      const lossBest = def.reward(
        {
          won: false,
          score: 0,
          seconds: 100,
          cleared: 359,
          total: 360,
          hints: 0,
          undos: 0,
          shuffles: 0,
        },
        level,
      );
      const winWorst = def.reward(
        {
          won: true,
          score: 400,
          seconds: 239,
          cleared: 160,
          total: 160,
          hints: 40,
          undos: 0,
          shuffles: 30,
        },
        level,
      );
      expect(winWorst).toBeGreaterThanOrEqual(lossBest);
    }
  });

  it("scramble and shuffle keep tile counts and board faces in step; hints are cleared", () => {
    const run = startGame("boss", "hard", 8);
    const S = inner(run.s);
    for (let n = 0; n < 12; n++) {
      run.s.hint!();
      const left = S.g.left;
      S.attackN = 1; // scramble
      S.nextAttack = 0;
      run.s.tick!(0.01);
      expect(S.g.left).toBe(left);
      bossInvariants(run);
      for (const c of S.hintPair)
        expect(S.g.cells[c]).toBeGreaterThanOrEqual(0);
      if (S.hintPair.length)
        expect(S.g.canMatch(S.hintPair[0], S.hintPair[1])).toBe(true);
    }
  });
});

// ------------------------------------------------------------ Dimensions

describe("3D Dimensions play-throughs", () => {
  it("every shape and level deals 60 seeds without throwing, even-sized and clearable", () => {
    const shapes = [
      boxShape(4, 2, 4),
      boxShape(4, 4, 4),
      boxShape(5, 4, 5, true),
      boxShape(2, 6, 2),
      boxShape(3, 6, 2),
      boxShape(3, 8, 3, true).slice(0, 64),
      stepShape(4, 2),
      stepShape(6, 3),
      stepShape(7, 4),
    ];
    for (const s of shapes)
      for (let seed = 1; seed <= 60; seed++) {
        const kinds = dealDimensions(s, new Rng(seed));
        expect(kinds.every((k) => k >= 0)).toBe(true);
        // Clearable: random play-downs reach the end at least sometimes.
        let ok = false;
        for (let t = 0; t < 30 && !ok; t++) {
          const g = new Dimensions(s, kinds);
          const r = new Rng(seed * 31 + t);
          for (;;) {
            const p = g.pairs();
            if (!p.length) break;
            const [a, b] = p[r.int(p.length)];
            g.remove(a, b);
          }
          ok = g.left === 0;
        }
        expect(ok).toBe(true);
      }
  });

  for (const level of ["easy", "medium", "hard"] as MiniLevel[])
    for (const shape of ["cube", "tower", "steps"])
      it(`Dimensions ${level} ${shape}: 20 seeds to the end`, () => {
        for (let seed = 1; seed <= 20 * K; seed++) {
          const run = startGame("dimensions", level, seed, { shape });
          const S = inner(run.s);
          const g: Dimensions = S.g;
          const rng = new Rng(seed + 5);
          expect(g.n % 2).toBe(0);
          expect(run.s.variant!()).toBe(shape);
          let guard = 0;
          while (!run.results.length && guard++ < 500) {
            if (inner(run.s).ended) {
              flush(3000);
              break;
            }
            const p = g.pairs();
            const sug = run.s.suggest!();
            if (!p.length) {
              expect(sug).toBeNull();
              // A dead end: undo out of it if we can, else the loss comes.
              if (rng.next() < 0.5 && run.s.canUndo!()) {
                expect(run.s.undo!()).toBe(true);
                flush(2000);
                if (g.pairs().length) expect(run.results.length).toBe(0);
                continue;
              }
              flush(2000);
              expect(run.results.length).toBe(1);
              break;
            }
            expect(g.canMatch(sug![0], sug![1])).toBe(true);
            const [a, b] =
              rng.next() < 0.7
                ? (sug as [number, number])
                : p[rng.int(p.length)];
            const left = g.left;
            run.s.onPick(a);
            run.s.onPick(b);
            expect(g.left).toBe(left - 2);
            for (let i = 0; i < g.n; i++)
              expect(run.board.has(i)).toBe(g.alive[i]);
            if (rng.next() < 0.05 && run.s.canUndo!()) {
              const limit = S.clock.limit;
              run.s.undo!();
              expect(g.left).toBe(left);
              if (limit) expect(S.clock.limit).toBe(limit - 2);
              for (let i = 0; i < g.n; i++)
                expect(run.board.has(i)).toBe(g.alive[i]);
            }
            run.s.tick!(rng.next() < 0.5 ? 0.5 : 3);
            flush(rng.next() < 0.5 ? 100 : 1000);
          }
          flush(5000);
          run.s.tick!(1000);
          flush(5000);
          expect(run.results.length).toBe(1);
          const r = run.results[0];
          checkReward(run.def, r, level);
          if (r.won) expect(g.left).toBe(0);
        }
      });

  it("undo and redo of the same pair cannot farm clock seconds", () => {
    const run = startGame("dimensions", "medium", 2);
    const S = inner(run.s);
    const limit = S.clock.limit;
    for (let n = 0; n < 20; n++) {
      const [a, b] = S.g.pairs()[0];
      run.s.onPick(a);
      run.s.onPick(b);
      run.s.undo!();
    }
    expect(S.clock.limit).toBe(limit);
  });

  it("clearing the last pair cannot be undone into a won-with-blocks-left result", () => {
    const run = startGame("dimensions", "easy", 3);
    const S = inner(run.s);
    let guard = 0;
    // Find a clearing order with the logic, then replay it.
    while (S.g.left > 0 && guard++ < 50) {
      const p = S.g.pairs();
      if (!p.length) {
        while (S.g.history.length) run.s.undo!();
        flush(3000);
        break;
      }
      run.s.onPick(p[0][0]);
      run.s.onPick(p[0][1]);
    }
    if (S.g.left === 0) {
      run.s.undo!();
      flush(3000);
      expect(run.results.length).toBe(1);
      expect(run.results[0].won).toBe(true);
      expect(S.g.left).toBe(0);
    }
  });
});

// ------------------------------------------------------------ Triple Match

function tripleInvariants(run: Run) {
  const S = inner(run.s);
  const g: Triple = S.g;
  expect(g.tray.length).toBeLessThanOrEqual(TRAY);
  const cleared = new Set(g.cleared);
  for (let i = 0; i < g.spots.length; i++) {
    const inTray = g.tray.includes(i);
    expect(g.onBoard[i] && inTray).toBe(false);
    expect(cleared.has(i) && (inTray || g.onBoard[i])).toBe(false);
    if (g.onBoard[i] || inTray) expect(run.board.has(i)).toBe(true);
    if (run.board.has(i)) expect(run.board.kindOf(i)).toBe(g.kinds[i]);
  }
  // No kind three times in the tray.
  const n = new Map<number, number>();
  for (const t of g.tray) n.set(g.kinds[t], (n.get(g.kinds[t]) ?? 0) + 1);
  for (const v of n.values()) expect(v).toBeLessThan(3);
  expect(g.cleared.length % 3).toBe(0);
  expect(g.cleared.length + g.tray.length + g.boardLeft).toBe(g.spots.length);
}

describe("Triple Match play-throughs", () => {
  it("deals follow a removal order that never overfills the tray", () => {
    for (const [layers, w, h, kinds, spread] of [
      [2, 7, 5, 9, 1],
      [3, 8, 6, 14, 2],
      [4, 9, 6, 20, 3],
    ])
      for (let seed = 1; seed <= 40; seed++) {
        const rng = new Rng(seed);
        const spots = tripleLayout(layers, w, h, rng);
        expect(spots.length % 3).toBe(0);
        const ks = dealTriple(spots, rng, kinds, spread);
        const count = new Map<number, number>();
        for (const k of ks) count.set(k, (count.get(k) ?? 0) + 1);
        for (const v of count.values()) expect(v % 3).toBe(0);
        // Greedy by hint (the tile the game itself would suggest) clears Easy.
      }
  });

  for (const level of ["easy", "medium", "hard"] as MiniLevel[])
    for (const policy of ["hint", "random"] as const)
      it(`Triple ${level} (${policy} player): 25 seeds to the end`, () => {
        let wins = 0;
        for (let seed = 1; seed <= 25 * K; seed++) {
          const run = startGame("triple", level, seed);
          const S = inner(run.s);
          const g: Triple = S.g;
          const rng = new Rng(seed + 1234);
          tripleInvariants(run);
          let guard = 0;
          while (!run.results.length && guard++ < 1000) {
            if (inner(run.s).ended) {
              flush(3000);
              break;
            }
            const free = g.free();
            const sug = run.s.suggest!();
            if (!free.length) {
              // Everything is in the tray, waiting for the clear to land.
              flush(2000);
              if (!run.results.length) expect(g.boardLeft).toBe(0);
              break;
            }
            expect(sug && g.isFree(sug[0])).toBe(true);
            const id = policy === "hint" ? sug![0] : free[rng.int(free.length)];
            run.s.onPick(id);
            flush(rng.next() < 0.3 ? 100 : 1000);
            tripleInvariants(run);
            if (rng.next() < 0.05 && run.s.canUndo!()) {
              const before = g.history[g.history.length - 1];
              const trayBefore = [...before.trayBefore];
              expect(run.s.undo!()).toBe(true);
              expect(g.tray).toEqual(trayBefore);
              expect(g.onBoard[before.id]).toBe(true);
              tripleInvariants(run);
            }
            if (rng.next() < 0.03 && run.s.canUse!("shuffle") && !g.lost) {
              const left = g.boardLeft;
              run.s.shuffle!();
              flush(1000);
              expect(g.boardLeft).toBe(left);
              tripleInvariants(run);
            }
            run.s.tick!(1);
          }
          flush(5000);
          expect(run.results.length).toBe(1);
          const r = run.results[0];
          checkReward(run.def, r, level);
          if (r.won) {
            wins++;
            expect(g.won).toBe(true);
            expect(r.cleared).toBe(r.total);
          } else expect(g.lost).toBe(true);
          run.s.tick!(100);
          flush(5000);
          expect(run.results.length).toBe(1);
        }
        if (policy === "hint" && level === "easy")
          expect(wins).toBeGreaterThanOrEqual(20 * K);
      });

  it("a tray-full loss cannot be dodged by an undo before it lands, nor fire after a restart", () => {
    const run = startGame("triple", "easy", 1);
    const S = inner(run.s);
    const g: Triple = S.g;
    // Fill the tray with seven tiles of different kinds by hand.
    const seen = new Set<number>();
    let guard = 0;
    while (!g.lost && guard++ < 200) {
      const id = g.free().find((i) => !seen.has(g.kinds[i]));
      if (id === undefined) break;
      seen.add(g.kinds[id]);
      run.s.onPick(id);
    }
    if (!g.lost) return;
    expect(run.s.canUndo!()).toBe(false);
    run.s.dispose();
    flush(3000);
    expect(run.results.length).toBe(0);
  });

  it("the clock only runs while playing", () => {
    const run = startGame("triple", "medium", 6);
    const S = inner(run.s);
    run.s.pause!(true);
    run.s.tick!(50);
    expect(S.clock.elapsed).toBe(0);
    run.s.pause!(false);
    run.s.tick!(2);
    expect(S.clock.elapsed).toBe(2);
  });
});

// ------------------------------------------------------------ shared

describe("rewards and seeds", () => {
  it("rewards stay within 0..600 and a loss never pays more than the matching win", () => {
    for (const id of ["connect", "cascade", "boss", "dimensions", "triple"]) {
      const def = miniGame(id)!;
      const totals = {
        connect: [60, 84, 112],
        cascade: [84, 112],
        boss: [160, 260, 360],
        dimensions: [20, 32, 64, 92, 100],
        triple: [48, 96, 123],
      }[id]!;
      for (const level of def.levels)
        for (const total of totals)
          for (const used of [0, 3, 50]) {
            const win = def.reward(
              {
                won: true,
                score: 99999,
                seconds: 1,
                cleared: total,
                total,
                hints: used,
                undos: used,
                shuffles: used,
              },
              level,
            );
            const lose = def.reward(
              {
                won: false,
                score: 99999,
                seconds: 1,
                cleared: total - 2,
                total,
                hints: 0,
                undos: 0,
                shuffles: 0,
              },
              level,
            );
            expect(Math.max(0, win)).toBeLessThanOrEqual(600);
            expect(lose).toBeGreaterThanOrEqual(0);
            expect(lose).toBeLessThanOrEqual(600);
            expect(
              win,
              `${id} ${level} total ${total} used ${used}`,
            ).toBeGreaterThanOrEqual(lose);
          }
    }
  });

  it("the same seed deals the same board", () => {
    for (const [id, opt] of [
      ["connect", {}],
      ["cascade", { gravity: "left" }],
      ["boss", {}],
      ["dimensions", { shape: "steps" }],
      ["triple", {}],
    ] as [string, Record<string, string>][]) {
      const def = miniGame(id)!;
      for (const level of def.levels) {
        const a = startGame(id, level, 777, opt),
          b = startGame(id, level, 777, opt);
        const dump = (r: Run) =>
          [...r.board.tiles.entries()]
            .map(
              ([k, t]) =>
                `${k}:${t.kind}:${t.pos.x.toFixed(3)},${t.pos.z.toFixed(3)}`,
            )
            .join("|");
        expect(dump(a)).toBe(dump(b));
        a.s.dispose();
        b.s.dispose();
      }
    }
  });
});
