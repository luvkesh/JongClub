// Second-round deep tests for the tile-matching mini-games: Solitaire (every layout),
// Tower, Timed, Blitz, Shuffle, Connect, Cascade, 3D Dimensions, Triple Match, Slide
// and Memory. Each game is driven through def.start(host) with a stub board (tweens
// land at once) and fake timers, by a "monkey" that mixes legal moves with stray
// taps, double taps, hints, undos, shuffles, pauses and idle time, checking after
// every step that the session agrees with its board, that suggestions are legal,
// that a game with no way on ends, and that it reports exactly one sane result.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Rng } from '../src/engine/rng';
import { miniGame } from '../src/minigames/registry';
import type { MiniGameDef, MiniHost, MiniLevel, MiniResult, MiniSession } from '../src/minigames/types';
import { LAYOUTS, TOWER_LAYOUTS } from '../src/minigames/games/solitaire/layouts';
import type { Solitaire } from '../src/minigames/games/solitaire/logic';
import type { Connect } from '../src/minigames/games/connect/logic';
import type { Dimensions } from '../src/minigames/games/dimensions/logic';
import { TRAY, type Triple } from '../src/minigames/games/triple/logic';
import type { SlideBoard } from '../src/minigames/games/slide';
import '../src/minigames/games';

(globalThis as unknown as { window: unknown }).window ??= globalThis;
/** More seeds with R2_SEEDS=n (a multiplier). */
const K = Math.max(1, Number((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.R2_SEEDS) || 1);

// ------------------------------------------------------------ stub board

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
    builds: 0,
    build(specs: { id: number; kind: number; pos: THREE.Vector3; quat?: THREE.Quaternion }[]) {
      b.builds++;
      tiles.clear();
      for (const s of specs) {
        if (tiles.has(s.id)) throw new Error(`duplicate id ${s.id}`);
        tiles.set(s.id, { kind: s.kind, alive: true, pos: s.pos.clone(), quat: (s.quat ?? new THREE.Quaternion()).clone(), scale: 1, look: 'normal' });
      }
    },
    has: (id: number) => !!tiles.get(id)?.alive,
    kindOf: (id: number) => tiles.get(id)?.kind ?? -1,
    ids: () => [...tiles.entries()].filter(([, t]) => t.alive).map(([id]) => id),
    pose(id: number) {
      const t = tiles.get(id);
      return t ? { pos: t.pos.clone(), quat: t.quat.clone(), scale: t.scale } : null;
    },
    busy: () => false,
    setLook(id: number, look: string) {
      const t = tiles.get(id);
      if (t) t.look = look;
    },
    look: (id: number) => tiles.get(id)?.look ?? 'normal',
    looks(fn: (id: number) => string) {
      for (const [id, t] of tiles) if (t.alive) t.look = fn(id);
    },
    pulse(ids: number[]) {
      b.pulsingIds = ids;
    },
    shake() {},
    moveTo(id: number, to: { pos?: THREE.Vector3; quat?: THREE.Quaternion; scale?: number }, o: { done?: () => void } = {}) {
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
    restore(id: number, pose: { pos: THREE.Vector3; quat?: THREE.Quaternion }) {
      const t = tiles.get(id);
      if (!t) return;
      t.alive = true;
      t.scale = 1;
      t.pos.copy(pose.pos);
      if (pose.quat) t.quat.copy(pose.quat);
    },
    bounds: () => new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1)),
    update: () => false,
    dispose() {},
  };
  return b;
}
type StubBoard = ReturnType<typeof stubBoard>;

// ------------------------------------------------------------ harness

interface Run {
  def: MiniGameDef;
  host: MiniHost;
  board: StubBoard;
  results: MiniResult[];
  toasts: string[];
  stats: Record<string, string | null>;
  bursts: number;
  /** A finish, toast or burst that came after dispose. */
  late: string[];
  disposed: boolean;
  s: MiniSession;
  level: MiniLevel;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inner = (s: MiniSession) => s as any;

function startGame(id: string, level: MiniLevel, seed: number, options: Record<string, string> = {}, daily = false): Run {
  const def = miniGame(id)!;
  const board = stubBoard(def.shape === 'cube');
  const opts: Record<string, string> = {};
  for (const o of def.options ?? []) opts[o.id] = o.initial;
  Object.assign(opts, options);
  const run = { def, board, results: [], toasts: [], stats: {}, bursts: 0, late: [], disposed: false, level } as unknown as Run;
  const host: MiniHost = {
    board: board as never,
    camera: { home: { yaw: 0, pitch: 60 }, reset() {}, turn() {} } as never,
    fit() {},
    burst() {
      if (run.disposed) run.late.push('burst');
      run.bursts++;
    },
    rng: new Rng(seed),
    seed,
    level,
    options: opts,
    daily,
    setStat: (k, text) => void (run.stats[k] = text),
    toast: (t) => {
      if (run.disposed) run.late.push(`toast ${t}`);
      run.toasts.push(t);
    },
    sound() {},
    finish: (r) => {
      if (run.disposed) run.late.push('finish');
      run.results.push({ hints: 0, undos: 0, shuffles: 0, ...r });
    },
    used() {},
    refreshButtons() {},
  };
  run.host = host;
  run.s = def.start(host);
  return run;
}

function dispose(r: Run) {
  r.s.dispose();
  r.disposed = true;
}

/** Shell-like ticking at 10 Hz, with the page timers run alongside. */
function advance(r: Run, sec: number) {
  for (let i = 0; i < Math.round(sec * 10); i++) {
    if (!r.results.length) r.s.tick?.(0.1);
    vi.advanceTimersByTime(100);
  }
}

function checkResult(r: Run) {
  expect(r.results.length).toBe(1);
  const f = r.results[0];
  for (const k of ['score', 'seconds', 'cleared', 'total'] as const) {
    expect(Number.isFinite(f[k]), k).toBe(true);
    expect(f[k], k).toBeGreaterThanOrEqual(0);
  }
  expect(f.cleared).toBeLessThanOrEqual(f.total);
  if (f.won && r.def.id !== 'blitz') expect(f.cleared).toBe(f.total);
  const pay = r.def.reward(f, r.level);
  expect(Number.isFinite(pay)).toBe(true);
  expect(pay).toBeGreaterThanOrEqual(0);
  expect(pay).toBeLessThanOrEqual(600);
  // Nothing more after the end.
  advance(r, 3);
  r.s.tick?.(5);
  vi.advanceTimersByTime(5000);
  expect(r.results.length).toBe(1);
  if (r.s.suggest) expect(r.s.suggest()).toEqual([]);
  expect(r.s.canUndo?.() ?? false).toBe(false);
  expect(r.s.canUse?.('hint') ?? false).toBe(false);
  expect(r.s.canUse?.('shuffle') ?? false).toBe(false);
  expect(r.s.hint?.() ?? false).toBe(false);
  expect(r.s.undo?.() ?? false).toBe(false);
  expect(r.s.shuffle?.() ?? false).toBe(false);
}

// ------------------------------------------------------------ per-game adapters

interface Adapter {
  /** Check the session's rules state against its board. */
  check(r: Run): void;
  /** Is the suggestion a playable move right now? */
  legal(r: Run, ids: number[]): boolean;
  /** True when the rules say no move is left (what a null suggestion must mean). */
  noMove(r: Run): boolean;
  /** Play the suggested move by taps. */
  play(r: Run, ids: number[], rng: Rng): void;
  /** Tile ids still in play (for stray taps). */
  live(r: Run): number[];
}

const pairGame = (get: (r: Run) => { canMatch(a: number, b: number): boolean; pairs(): unknown[] }): Pick<Adapter, 'legal' | 'noMove' | 'play'> => ({
  legal: (r, ids) => ids.length === 2 && get(r).canMatch(ids[0], ids[1]),
  noMove: (r) => get(r).pairs().length === 0,
  play: (r, ids) => {
    r.s.onPick(ids[0]);
    r.s.onPick(ids[1]);
  },
});

const solitaireAdapter: Adapter = {
  ...pairGame((r) => inner(r.s).g as Solitaire),
  check(r) {
    const g: Solitaire = inner(r.s).g;
    for (let id = 0; id < g.total; id++) {
      expect(r.board.has(id), `tile ${id}`).toBe(g.alive[id]);
      if (g.alive[id]) {
        expect(g.inSlot[g.slotOf[id]]).toBe(id);
        const want = inner(r.s).worldOf(g.t.slots[g.slotOf[id]]) as THREE.Vector3;
        expect(r.board.pose(id)!.pos.distanceTo(want)).toBeLessThan(1e-6);
      }
    }
    expect(r.board.ids().length).toBe(g.left);
  },
  live: (r) => r.board.ids(),
};

const connectAdapter: Adapter = {
  check(r) {
    const S = inner(r.s);
    const g: Connect = S.g;
    const ids: number[] = S.idAt;
    const live = new Set(r.board.ids());
    let n = 0;
    g.cells.forEach((k, c) => {
      if (k < 0) {
        expect(ids[c]).toBe(-1);
        return;
      }
      n++;
      expect(live.has(ids[c]), `cell ${c}`).toBe(true);
      expect(r.board.kindOf(ids[c])).toBe(k);
    });
    expect(live.size).toBe(n);
  },
  legal(r, ids) {
    const S = inner(r.s);
    const cells = ids.map((id) => S.idAt.indexOf(id));
    return ids.length === 2 && cells.every((c) => c >= 0) && (S.g as Connect).canMatch(cells[0], cells[1]);
  },
  noMove: (r) => (inner(r.s).g as Connect).pairs(1).length === 0,
  play(r, ids) {
    r.s.onPick(ids[0]);
    r.s.onPick(ids[1]);
  },
  live: (r) => r.board.ids(),
};

const dimensionsAdapter: Adapter = {
  ...pairGame((r) => inner(r.s).g as Dimensions),
  check(r) {
    const g: Dimensions = inner(r.s).g;
    for (let id = 0; id < g.n; id++) expect(r.board.has(id)).toBe(g.alive[id]);
  },
  live: (r) => r.board.ids(),
};

const tripleAdapter: Adapter = {
  check(r) {
    const g: Triple = inner(r.s).g;
    expect(g.tray.length).toBeLessThanOrEqual(TRAY);
    const live = new Set(r.board.ids());
    g.spots.forEach((_, i) => {
      const inPlay = g.onBoard[i] || g.tray.includes(i);
      // A set that just cleared leaves the board a moment later.
      if (inPlay) expect(live.has(i), `tile ${i}`).toBe(true);
      expect(g.cleared.includes(i)).toBe(!inPlay);
      expect(r.board.kindOf(i)).toBe(g.kinds[i]);
    });
    // Every kind still in play comes in threes.
    const by = new Map<number, number>();
    g.spots.forEach((_, i) => !g.cleared.includes(i) && by.set(g.kinds[i], (by.get(g.kinds[i]) ?? 0) + 1));
    for (const v of by.values()) expect(v % 3).toBe(0);
  },
  legal: (r, ids) => {
    const g: Triple = inner(r.s).g;
    if (ids.length !== 1 || !g.isFree(ids[0])) return false;
    // With one place left in the tray, a tile that completes a set comes first.
    const inTray = (i: number) => g.tray.filter((t) => g.kinds[t] === g.kinds[i]).length;
    if (g.tray.length === TRAY - 1 && g.free().some((i) => inTray(i) === 2)) return inTray(ids[0]) === 2;
    return true;
  },
  noMove: (r) => (inner(r.s).g as Triple).free().length === 0,
  play: (r, ids) => r.s.onPick(ids[0]),
  live: (r) => {
    const g: Triple = inner(r.s).g;
    return g.spots.map((_, i) => i).filter((i) => g.onBoard[i]);
  },
};

/** A slide of tile `id` that lines it up with its match: [x, y] of the target, or null. */
function slideFor(g: SlideBoard, id: number): [number, number] | null {
  const p = g.pos(id);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
    for (let s = 1; s < Math.max(g.w, g.h); s++) {
      const next = g.slide(id, p.x + dx * s, p.y + dy * s);
      if (!next) break;
      if (new (g.constructor as typeof SlideBoard)(g.w, g.h, next, g.kinds).matchFor(id) >= 0) return [p.x + dx * s, p.y + dy * s];
    }
  return null;
}

const slideAdapter: Adapter = {
  check(r) {
    const g: SlideBoard = inner(r.s).g;
    const live = new Set(r.board.ids());
    const onGrid = g.cells.filter((c) => c >= 0);
    expect(new Set(onGrid).size).toBe(onGrid.length);
    expect(live).toEqual(new Set(onGrid));
    for (const id of onGrid) {
      const p = g.pos(id);
      expect(r.board.pose(id)!.pos.distanceTo(inner(r.s).world(p.x, p.y))).toBeLessThan(1e-6);
    }
  },
  legal(r, ids) {
    const g: SlideBoard = inner(r.s).g;
    if (ids.length === 2) return g.canPair(ids[0], ids[1]);
    return ids.length === 1 && g.cells.includes(ids[0]) && slideFor(g, ids[0]) !== null;
  },
  noMove: (r) => {
    const g: SlideBoard = inner(r.s).g;
    return !g.pairs().length && !g.slideMove();
  },
  play(r, ids) {
    const g: SlideBoard = inner(r.s).g;
    if (ids.length === 2) {
      r.s.onPick(ids[0]);
      if (r.board.has(ids[1])) r.s.onPick(ids[1]);
      return;
    }
    // Make the slide that lines this tile up.
    const t = slideFor(g, ids[0])!;
    r.s.onPick(ids[0]);
    if (inner(r.s).sel === ids[0]) inner(r.s).onCell(t[1] * g.w + t[0]);
  },
  live: (r) => r.board.ids(),
};

const ADAPTERS: Record<string, Adapter> = {
  solitaire: solitaireAdapter,
  tower: solitaireAdapter,
  timed: solitaireAdapter,
  blitz: solitaireAdapter,
  shuffle: solitaireAdapter,
  connect: connectAdapter,
  cascade: connectAdapter,
  dimensions: dimensionsAdapter,
  triple: tripleAdapter,
  slide: slideAdapter,
};

interface MonkeyOpts {
  steps?: number;
  /** Chance of each extra action per step. */
  stray?: number;
  undo?: number;
  hint?: number;
  shuffle?: number;
  pause?: number;
  /** Seconds between moves. */
  pace?: number;
}

/** Play a game to its end with a mix of good moves and everything else a player might press. */
function monkey(r: Run, seed: number, o: MonkeyOpts = {}) {
  const a = ADAPTERS[r.def.id];
  const rng = new Rng(seed * 31 + 7);
  const tools = r.def.tools ?? {};
  let stuckFor = 0;
  for (let step = 0; step < (o.steps ?? 4000) && !r.results.length; step++) {
    advance(r, o.pace ?? 0.2);
    if (r.results.length) break;
    a.check(r);
    const sug = r.s.suggest ? r.s.suggest() : [];
    if (sug === null) {
      expect(a.noMove(r), 'null suggestion with a move left').toBe(true);
    } else if (sug.length) {
      expect(a.legal(r, sug), `illegal suggestion ${sug}`).toBe(true);
      for (const id of sug) expect(r.board.has(id)).toBe(true);
    }
    // Stray taps: a random live tile, a double tap, a tap on a gone tile.
    if (rng.next() < (o.stray ?? 0.15)) {
      const live = a.live(r);
      if (live.length) {
        const id = live[rng.int(live.length)];
        r.s.onPick(id);
        if (rng.next() < 0.3) r.s.onPick(id);
      }
      r.s.onPick(9999);
      a.check(r);
      continue;
    }
    if (tools.hint && rng.next() < (o.hint ?? 0.05)) {
      const can = r.s.canUse?.('hint') ?? true;
      const ok = r.s.hint!();
      if (!can) expect(ok).toBe(false);
      a.check(r);
    }
    if (tools.undo && rng.next() < (o.undo ?? 0.08)) {
      const can = r.s.canUndo!();
      expect(r.s.undo!()).toBe(can);
      a.check(r);
      continue;
    }
    if (tools.shuffle && rng.next() < (o.shuffle ?? 0.04)) {
      const can = r.s.canUse?.('shuffle') ?? true;
      const ok = r.s.shuffle!();
      if (!can) expect(ok).toBe(false);
      a.check(r);
      continue;
    }
    if (rng.next() < (o.pause ?? 0.03)) {
      const t = inner(r.s).clock?.elapsed;
      r.s.pause?.(true);
      // The shell stops ticking while paused; page timers still run.
      vi.advanceTimersByTime(2000);
      if (t !== undefined) {
        r.s.tick?.(0.5);
        expect(inner(r.s).clock.elapsed).toBe(t);
      }
      r.s.pause?.(false);
      continue;
    }
    if (sug === null) {
      // No move: a shuffle if there is one, else an undo, else the game must end by itself.
      if (tools.shuffle && (r.s.canUse?.('shuffle') ?? true) && r.s.shuffle!()) continue;
      if (tools.undo && r.s.canUndo!() && rng.next() < 0.5) {
        r.s.undo!();
        continue;
      }
      stuckFor++;
      if (stuckFor > 30) {
        const canShuffle = tools.shuffle && (r.s.canUse?.('shuffle') ?? true);
        throw new Error(`${r.def.id} ${r.level}: stuck with no move for 30 steps (shuffle ${canShuffle}, undo ${r.s.canUndo?.()})`);
      }
      continue;
    }
    stuckFor = 0;
    if (!sug.length) continue;
    a.play(r, sug, rng);
  }
  advance(r, 3);
  vi.advanceTimersByTime(3000);
  expect(r.results.length, `${r.def.id} ${r.level} never finished`).toBe(1);
  checkResult(r);
  expect(r.late).toEqual([]);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

// ------------------------------------------------------------ monkey play-throughs

describe('monkey play-throughs', () => {
  for (const l of [...LAYOUTS, ...TOWER_LAYOUTS])
    for (const level of ['easy', 'medium', 'hard'] as MiniLevel[]) {
      const game = TOWER_LAYOUTS.includes(l) ? 'tower' : 'solitaire';
      if (game === 'tower' && level === 'easy') continue;
      it(`${game} ${l.id} ${level}`, () => {
        for (let seed = 1; seed <= 3 * K; seed++) monkey(startGame(game, level, seed, { layout: l.id }), seed);
      });
    }
  for (const level of ['easy', 'medium', 'hard'] as MiniLevel[])
    it(`shuffle (Mahjong Shuffle) ${level}, every layout`, () => {
      for (const l of LAYOUTS) monkey(startGame('shuffle', level, 5, { layout: l.id }), 5);
    });
  for (const level of ['medium', 'hard'] as MiniLevel[])
    for (const clock of ['90', '120', '180'])
      it(`timed ${level} ${clock}s, every layout`, () => {
        for (const layout of ['garden', 'peaks', 'pyramid']) monkey(startGame('timed', level, 3, { layout, clock }), 3, { pace: 0.6 });
      });
  for (const level of ['easy', 'medium', 'hard'] as MiniLevel[])
    it(`blitz ${level}`, () => {
      for (let seed = 1; seed <= 3 * K; seed++) monkey(startGame('blitz', level, seed), seed, { pace: 0.15 });
    });
  for (const level of ['easy', 'medium', 'hard'] as MiniLevel[]) {
    it(`connect ${level}`, () => {
      for (let seed = 1; seed <= 4 * K; seed++) monkey(startGame('connect', level, seed), seed);
    });
    it(`dimensions ${level}, every shape`, () => {
      for (const shape of ['cube', 'tower', 'steps']) for (let seed = 1; seed <= 3 * K; seed++) monkey(startGame('dimensions', level, seed, { shape }), seed);
    });
    it(`triple ${level}`, () => {
      for (let seed = 1; seed <= 6 * K; seed++) monkey(startGame('triple', level, seed), seed);
    });
    it(`slide ${level}`, () => {
      for (let seed = 1; seed <= 6 * K; seed++) monkey(startGame('slide', level, seed), seed);
    });
  }
  for (const level of ['medium', 'hard'] as MiniLevel[])
    for (const gravity of ['down', 'left'])
      it(`cascade ${level} ${gravity}`, () => {
        for (let seed = 1; seed <= 4 * K; seed++) monkey(startGame('cascade', level, seed, { gravity }), seed);
      });
});

// ------------------------------------------------------------ regressions

/** Two quick pairs (a combo) through the session's taps; returns the score after each. */
function twoQuickPairs(r: Run, pairs: () => number[][]) {
  const [a, b] = pairs()[0];
  r.s.onPick(a);
  r.s.onPick(b);
  const after1 = inner(r.s).score;
  const [c, d] = pairs()[0];
  r.s.onPick(c);
  r.s.onPick(d);
  return [after1, inner(r.s).score];
}

describe('undo takes back exactly the points the move scored', () => {
  it('Solitaire: a combo pair undone leaves the score as before it', () => {
    const r = startGame('solitaire', 'easy', 4, { layout: 'pyramid' });
    const [s1, s2] = twoQuickPairs(r, () => inner(r.s).g.pairs());
    expect(s2).toBe(s1 + 15);
    expect(r.s.undo!()).toBe(true);
    expect(inner(r.s).score).toBe(s1);
    // Undo and redo cannot pump the score up.
    for (let i = 0; i < 5; i++) {
      const [a, b] = inner(r.s).g.pairs()[0];
      r.s.onPick(a);
      r.s.onPick(b);
      r.s.undo!();
    }
    expect(inner(r.s).score).toBeLessThanOrEqual(s1);
  });

  it('Mahjong Shuffle: an undo after the tiles changed places has nothing to take back', () => {
    const r = startGame('shuffle', 'hard', 2, { layout: 'pyramid' });
    for (let i = 0; i < 4; i++) {
      const [a, b] = inner(r.s).g.pairs()[0];
      r.s.onPick(a);
      r.s.onPick(b);
    }
    vi.advanceTimersByTime(600);
    expect(r.s.canUndo!()).toBe(false);
    const [a, b] = inner(r.s).g.pairs()[0];
    const before = inner(r.s).score;
    r.s.onPick(a);
    r.s.onPick(b);
    r.s.undo!();
    expect(inner(r.s).score).toBe(before);
  });

  it('Connect: a combo pair undone leaves the score as before it', () => {
    const r = startGame('connect', 'easy', 4);
    const S = inner(r.s);
    const [s1, s2] = twoQuickPairs(r, () => (S.g as Connect).pairs(1).map((p) => p.map((c) => S.idAt[c])));
    expect(s2).toBe(s1 + 15);
    expect(r.s.undo!()).toBe(true);
    expect(S.score).toBe(s1);
  });

  it('Dimensions: a combo pair undone leaves the score as before it', () => {
    const r = startGame('dimensions', 'easy', 4);
    const [s1, s2] = twoQuickPairs(r, () => inner(r.s).g.pairs());
    expect(s2).toBe(s1 + 15);
    expect(r.s.undo!()).toBe(true);
    expect(inner(r.s).score).toBe(s1);
  });

  it('Slide: undoing a slide takes it off the slide count', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const r = startGame('slide', 'easy', seed);
      const S = inner(r.s);
      const g: SlideBoard = S.g;
      // Clear the pairs that face each other already, then slide.
      for (let p = g.pairs()[0]; p; p = S.g.pairs()[0]) {
        r.s.onPick(p[0]);
        if (r.board.has(p[1])) r.s.onPick(p[1]);
        vi.advanceTimersByTime(400);
      }
      const m = (S.g as SlideBoard).slideMove();
      if (!m || r.results.length) continue;
      r.s.onPick(m[0]);
      S.onCell(m[2] * S.g.w + m[1]);
      vi.advanceTimersByTime(400);
      expect(S.moves).toBe(1);
      expect(r.s.undo!()).toBe(true);
      expect(S.moves).toBe(0);
      expect(r.stats.moves).toBe('0');
      return;
    }
    throw new Error('no seed reached a slide');
  });
});

describe('daily boards stay the same whatever the pause suggestions drew', () => {
  for (const id of ['solitaire', 'connect', 'cascade', 'dimensions', 'triple', 'slide'])
    it(id, () => {
      // Suggestions drawn while the player pauses must not change the shuffle that follows.
      const plain = (() => {
        const r = startGame(id, 'medium', 20261113, {}, true);
        r.s.shuffle?.();
        return JSON.stringify(inner(r.s).g);
      })();
      const poked = (() => {
        const r = startGame(id, 'medium', 20261113, {}, true);
        for (let k = 0; k < 5; k++) r.s.suggest?.();
        r.s.shuffle?.();
        return JSON.stringify(inner(r.s).g);
      })();
      expect(poked).toBe(plain);
    });
});

describe('tools that cannot help are off', () => {
  it('Triple: no shuffle with fewer than two tiles on the board', () => {
    let reached = false;
    for (let seed = 1; seed <= 10 && !reached; seed++) {
      const r = startGame('triple', 'easy', seed);
      const g: Triple = inner(r.s).g;
      while (!r.results.length && g.boardLeft > 1) {
        const s = r.s.suggest!()!;
        r.s.onPick(s[0]);
        vi.advanceTimersByTime(400);
      }
      if (r.results.length || g.boardLeft !== 1) continue;
      reached = true;
      expect(r.s.canUse!('shuffle')).toBe(false);
      const left = inner(r.s).shuffles;
      expect(r.s.shuffle!()).toBe(false);
      expect(inner(r.s).shuffles).toBe(left);
    }
    expect(reached).toBe(true);
  });
});

describe('nothing reaches the board after the game is closed', () => {
  it('Solitaire: the burst of a pair taken just before leaving', () => {
    const r = startGame('solitaire', 'easy', 3, { layout: 'garden' });
    const [a, b] = inner(r.s).g.pairs()[0];
    r.s.onPick(a);
    r.s.onPick(b);
    dispose(r);
    vi.advanceTimersByTime(3000);
    expect(r.late).toEqual([]);
  });
  it('Slide: the burst of a pair cleared just before leaving', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const r = startGame('slide', 'easy', seed);
      const p = (inner(r.s).g as SlideBoard).pairs()[0];
      if (!p) continue;
      r.s.onPick(p[0]);
      if (r.board.has(p[1])) r.s.onPick(p[1]);
      dispose(r);
      vi.advanceTimersByTime(3000);
      expect(r.late).toEqual([]);
      return;
    }
  });
  it('Slide: a second hint is not wiped by the first one’s timer', () => {
    const r = startGame('slide', 'easy', 2);
    expect(r.s.hint!()).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(r.s.hint!()).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(inner(r.s).hintIds.length).toBeGreaterThan(0);
    vi.advanceTimersByTime(2000);
    expect(inner(r.s).hintIds.length).toBe(0);
  });
});

describe('rewards over the whole range of results', () => {
  const GAMES = ['solitaire', 'tower', 'timed', 'blitz', 'shuffle', 'connect', 'cascade', 'dimensions', 'triple', 'slide', 'memory'];
  for (const id of GAMES)
    it(id, () => {
      const def = miniGame(id)!;
      for (const level of def.levels)
        for (const total of [16, 24, 36, 56, 64, 72, 84, 120, 144]) {
          let bestLoss = 0;
          for (const won of [false, true])
            for (const cleared of [0, 2, Math.floor(total / 2), total - 2, total])
              for (const helps of [0, 1, 3, 10, 40])
                for (const seconds of [0, 30, 600, 10000])
                  for (const score of [0, 50, 1000, 100000]) {
                    if (won && id !== 'blitz' && cleared !== total) continue;
                    if (!won && cleared === total && id !== 'blitz') continue;
                    const r: MiniResult = { won, score, seconds, cleared, total, hints: helps, undos: helps, shuffles: helps };
                    const pay = def.reward(r, level);
                    const what = `${id} ${level} ${JSON.stringify(r)}`;
                    expect(Number.isFinite(pay), what).toBe(true);
                    expect(Math.round(pay), what).toBeLessThanOrEqual(600);
                    // Memory peeks are capped at two (and Memory has no loss).
                    if (id === 'memory' && helps > 2) continue;
                    expect(pay, what).toBeGreaterThanOrEqual(0);
                    if (!won) bestLoss = Math.max(bestLoss, pay);
                    else if (id !== 'blitz') expect(pay, `${what}: a win pays less than a loss (${bestLoss})`).toBeGreaterThanOrEqual(bestLoss);
                  }
        }
    });
});

describe('Mahjong Shuffle: the moment before the tiles change places', () => {
  it('a hint or an undo is not spent on tiles about to move, and no move is suggested', () => {
    const r = startGame('shuffle', 'medium', 8, { layout: 'garden' });
    const S = inner(r.s);
    for (let i = 0; i < 6; i++) {
      const [a, b] = S.g.pairs()[0];
      r.s.onPick(a);
      r.s.onPick(b);
    }
    // Six pairs on Medium: the tiles change places in a moment.
    const hints = S.hintsLeft;
    expect(r.s.canUse!('hint')).toBe(false);
    expect(r.s.hint!()).toBe(false);
    expect(S.hintsLeft).toBe(hints);
    expect(r.s.canUndo!()).toBe(false);
    expect(r.s.undo!()).toBe(false);
    expect(r.s.suggest!()).toEqual([]);
    // A pair taken meanwhile does not queue a second mix.
    const [a, b] = S.g.pairs()[0] ?? [];
    if (a !== undefined) {
      r.s.onPick(a);
      r.s.onPick(b);
    }
    const before = r.toasts.filter((t) => t === 'The tiles change places').length;
    vi.advanceTimersByTime(2000);
    expect(r.toasts.filter((t) => t === 'The tiles change places').length).toBe(before + 1);
    expect(r.s.canUse!('hint')).toBe(true);
    expect(r.s.suggest!()!.length).toBe(2);
  });
});

describe('pause freezes the clocks and the combo windows', () => {
  for (const id of ['timed', 'blitz', 'connect', 'dimensions'])
    it(id, () => {
      const r = startGame(id, 'medium', 6);
      const S = inner(r.s);
      const pair = (): number[] => {
        if (id === 'connect') return (S.g as Connect).pairs(1)[0].map((c: number) => S.idAt[c]);
        return S.g.pairs()[0];
      };
      let p = pair();
      r.s.onPick(p[0]);
      r.s.onPick(p[1]);
      const left = S.clock.left;
      r.s.pause!(true);
      // A paused shell does not tick, but a stray tick must not move the clock either.
      for (let i = 0; i < 50; i++) r.s.tick!(0.1);
      vi.advanceTimersByTime(10000);
      expect(S.clock.left).toBe(left);
      r.s.pause!(false);
      p = pair();
      r.s.onPick(p[0]);
      r.s.onPick(p[1]);
      expect(S.combo).toBe(2);
      expect(r.results.length).toBe(0);
    });
});
