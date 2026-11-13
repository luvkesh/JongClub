// Deep play-throughs of the casual mini-games (Memory, Slide, Match-3, Chain
// Reaction, Colour Match): every level, many seeds, driven through def.start()
// with a stub host and a stub board whose tweens finish at once.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Rng } from '../src/engine/rng';
import { miniGame } from '../src/minigames/registry';
import type { MiniGameDef, MiniHost, MiniLevel, MiniResult, MiniSession } from '../src/minigames/types';
import type { Pose, TileLook } from '../src/minigames/board';
import { family, matchGroup } from '../src/minigames/helpers';
import { Sorter, dealColour } from '../src/minigames/games/colour';
import { ChainBoard, chainFamily, dealChain, groupScore } from '../src/minigames/games/chain';
import { Match3 } from '../src/minigames/games/match3';
import { SlideBoard } from '../src/minigames/games/slide';
import { miniDailySeed } from '../src/minigames/progress';
import '../src/minigames/games';

beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g.window) g.window = globalThis;
  g.innerWidth = 1024;
  g.innerHeight = 768;
});
beforeEach(() => void vi.useFakeTimers());
afterEach(() => void vi.useRealTimers());

const LEVELS: MiniLevel[] = ['easy', 'medium', 'hard'];

/** A board that keeps state like TileBoard but finishes every tween at once. */
class StubBoard {
  readonly root = new THREE.Group();
  readonly w = 0.4;
  readonly h = 0.55;
  readonly d = 0.3;
  fitExtra: THREE.Box3 | null = null;
  tiles = new Map<number, { kind: number; alive: boolean; pose: Pose; look: TileLook }>();
  builds = 0;
  build(specs: { id: number; kind: number; pos: THREE.Vector3; quat?: THREE.Quaternion }[]) {
    this.builds++;
    this.tiles.clear();
    for (const s of specs) {
      if (this.tiles.has(s.id)) throw new Error(`duplicate id ${s.id}`);
      this.tiles.set(s.id, { kind: s.kind, alive: true, pose: { pos: s.pos.clone(), quat: (s.quat ?? new THREE.Quaternion()).clone(), scale: 1 }, look: 'normal' });
    }
  }
  has(id: number) {
    return !!this.tiles.get(id)?.alive;
  }
  kindOf(id: number) {
    return this.tiles.get(id)?.kind ?? -1;
  }
  ids() {
    return [...this.tiles.entries()].filter(([, t]) => t.alive).map(([id]) => id);
  }
  pose(id: number): Pose | null {
    const t = this.tiles.get(id);
    return t ? { pos: t.pose.pos.clone(), quat: t.pose.quat.clone(), scale: t.pose.scale } : null;
  }
  busy() {
    return false;
  }
  get moving() {
    return false;
  }
  setLook(id: number, look: TileLook) {
    const t = this.tiles.get(id);
    if (t) t.look = look;
  }
  look(id: number) {
    return this.tiles.get(id)?.look ?? 'normal';
  }
  looks(fn: (id: number) => TileLook) {
    for (const [id, t] of this.tiles) if (t.alive) t.look = fn(id);
  }
  pulse() {}
  shake() {}
  moveTo(id: number, to: Partial<Pose>, o: { done?: () => void } = {}) {
    const t = this.tiles.get(id);
    if (!t) return;
    if (to.pos) t.pose.pos.copy(to.pos);
    if (to.quat) t.pose.quat.copy(to.quat);
    if (to.scale !== undefined) t.pose.scale = to.scale;
    o.done?.();
  }
  place(id: number, pose: Partial<Pose>) {
    this.moveTo(id, pose);
  }
  remove(id: number, o: { done?: () => void } = {}) {
    const t = this.tiles.get(id);
    if (!t || !t.alive) return;
    t.alive = false;
    t.look = 'normal';
    t.pose.scale = 0.001;
    o.done?.();
  }
  hide(id: number) {
    const t = this.tiles.get(id);
    if (t) t.alive = false;
  }
  restore(id: number, pose: Pose) {
    const t = this.tiles.get(id);
    if (!t) return;
    t.alive = true;
    t.pose = { pos: pose.pos.clone(), quat: pose.quat.clone(), scale: 1 };
  }
  setKind(id: number, kind: number) {
    const t = this.tiles.get(id);
    if (t) t.kind = kind;
  }
  revive(id: number, pose: Partial<Pose>) {
    const t = this.tiles.get(id);
    if (!t) return;
    t.alive = true;
    this.moveTo(id, { scale: 1, ...pose });
  }
  bounds() {
    return new THREE.Box3();
  }
  feltPoint() {
    return null;
  }
}

interface Harness {
  host: MiniHost;
  board: StubBoard;
  results: MiniResult[];
  stats: Record<string, string | null>;
  used: Record<string, number>;
}

function makeHost(level: MiniLevel, seed: number, board = new StubBoard(), options: Record<string, string> = {}): Harness {
  const results: MiniResult[] = [];
  const stats: Record<string, string | null> = {};
  const used = { hints: 0, undos: 0, shuffles: 0 };
  const host: MiniHost = {
    board: board as unknown as MiniHost['board'],
    camera: { home: { yaw: 0, pitch: 60 }, reset() {} } as unknown as MiniHost['camera'],
    fit() {},
    burst() {},
    rng: new Rng(seed),
    seed,
    level,
    options,
    daily: false,
    setStat: (id, text) => void (stats[id] = text),
    toast() {},
    sound() {},
    finish: (r) => void results.push({ hints: 0, undos: 0, shuffles: 0, ...r }),
    used: (w) => void used[w]++,
    refreshButtons() {},
  };
  return { host, board, results, stats, used };
}

const def = (id: string) => miniGame(id) as MiniGameDef;
const priv = <T = unknown>(s: MiniSession, k: string) => (s as unknown as Record<string, T>)[k];

/** Shell-like ticking: tick at 10 Hz and run timers, `sec` seconds. */
async function advance(s: MiniSession, sec: number, async = false) {
  for (let t = 0; t < sec * 10; t++) {
    s.tick?.(0.1);
    if (async) await vi.advanceTimersByTimeAsync(100);
    else vi.advanceTimersByTime(100);
  }
}

function checkReward(d: MiniGameDef, r: MiniResult, level: MiniLevel) {
  const v = d.reward(r, level);
  expect(Number.isFinite(v)).toBe(true);
  expect(v).toBeLessThanOrEqual(600);
  return v;
}

// ------------------------------------------------------------ Memory

describe('memory, played through', () => {
  it('a perfect player wins every level and seed exactly once', () => {
    const d = def('memory');
    for (const level of LEVELS)
      for (let seed = 1; seed <= 25; seed++) {
        const h = makeHost(level, seed);
        const s = d.start(h.host);
        vi.advanceTimersByTime(2500); // easy peeks first
        const byKind = new Map<number, number[]>();
        for (const id of h.board.ids()) byKind.set(h.board.kindOf(id), [...(byKind.get(h.board.kindOf(id)) ?? []), id]);
        for (const ids of byKind.values()) expect(ids.length % 2).toBe(0);
        for (const ids of byKind.values())
          for (let i = 0; i < ids.length; i += 2) {
            s.onPick(ids[i]);
            s.onPick(ids[i]); // a double tap on the same tile does nothing
            s.onPick(ids[i + 1]);
            vi.advanceTimersByTime(50);
          }
        vi.advanceTimersByTime(2000);
        s.tick?.(5);
        expect(h.results.length).toBe(1);
        const r = h.results[0];
        expect(r.won).toBe(true);
        expect(r.cleared).toBe(r.total);
        expect(h.board.ids().length).toBe(0);
        const v = checkReward(d, r, level);
        expect(v).toBeGreaterThan(0);
        // No more reports after the end, whatever is tapped.
        s.onPick(0);
        vi.advanceTimersByTime(5000);
        expect(h.results.length).toBe(1);
        s.dispose();
      }
  });

  it('a forgetful player who taps fast still clears the board', () => {
    const d = def('memory');
    for (const level of LEVELS)
      for (let seed = 1; seed <= 25; seed++) {
        const h = makeHost(level, seed);
        const s = d.start(h.host);
        const rng = new Rng(seed * 7);
        const known = new Map<number, number>();
        let guard = 0;
        while (!h.results.length && guard++ < 3000) {
          const live = h.board.ids();
          if (rng.int(10) === 0) s.hint?.();
          // Tap a random tile, often while a miss is still turning back over.
          const id = live[rng.int(Math.max(1, live.length))] ?? 0;
          known.set(id, h.board.kindOf(id));
          s.onPick(id);
          vi.advanceTimersByTime(rng.int(4) * 300);
          s.tick?.(0.3);
        }
        vi.advanceTimersByTime(3000);
        expect(h.results.length).toBe(1);
        expect(h.results[0].won).toBe(true);
      }
  });

  it('the clock stops while paused and after the end', () => {
    const h = makeHost('medium', 3);
    const s = def('memory').start(h.host);
    s.tick?.(5);
    s.pause?.(true);
    s.tick?.(100);
    s.pause?.(false);
    s.tick?.(1);
    expect(priv<{ elapsed: number }>(s, 'clock').elapsed).toBeCloseTo(6);
  });

  it('a pair matched just before a restart does not take tiles off the next board', () => {
    const board = new StubBoard();
    const h = makeHost('easy', 9, board);
    const s = def('memory').start(h.host);
    vi.advanceTimersByTime(2500);
    const ids = board.ids();
    const a = ids[0];
    const b = ids.find((i) => i !== a && board.kindOf(i) === board.kindOf(a))!;
    s.onPick(a);
    s.onPick(b);
    s.dispose();
    const h2 = makeHost('easy', 10, board);
    def('memory').start(h2.host);
    vi.advanceTimersByTime(3000);
    expect(board.ids().length).toBe(16);
  });
});

// ------------------------------------------------------------ Slide

/** Cells and board must agree: every tile on the grid is live on the board, every other one is gone. */
function slideConsistent(s: MiniSession, board: StubBoard) {
  const g = priv<SlideBoard>(s, 'g');
  const onGrid = new Set(g.cells.filter((c) => c >= 0));
  expect(new Set(board.ids())).toEqual(onGrid);
  expect(onGrid.size % 2).toBe(0);
}

describe('slide, played through', () => {
  it('plays to an end on every level with hints, slides, undos and shuffles', async () => {
    const d = def('slide');
    let wins = 0,
      losses = 0;
    for (const level of LEVELS)
      for (let seed = 1; seed <= 30; seed++) {
        const h = makeHost(level, seed);
        const s = d.start(h.host);
        const g = () => priv<SlideBoard>(s, 'g');
        const rng = new Rng(seed * 13);
        // The deal has a move.
        expect(g().pairs().length + (g().slideMove() ? 1 : 0)).toBeGreaterThan(0);
        let guard = 0;
        while (!h.results.length && guard++ < 2000) {
          const roll = rng.int(20);
          if (roll === 0 && s.canUndo?.()) s.undo?.();
          else if (roll === 1 && (s.canUse?.('hint') ?? true)) s.hint?.();
          else {
            const m = s.suggest?.();
            if (m === null) {
              if (s.canUse?.('shuffle')) expect(s.shuffle?.()).toBe(true);
              else if (s.canUndo?.() && rng.int(2)) s.undo?.();
            } else if (m && m.length) {
              const p = g().pairs()[0];
              if (p) {
                s.onPick(p[0]);
                if (g().cells.includes(p[1])) s.onPick(p[1]);
              } else {
                const mv = g().slideMove()!;
                if (priv(s, 'sel') !== mv[0]) s.onPick(mv[0]);
                (s as unknown as { onCell(c: number): void }).onCell(mv[2] * g().w + mv[1]);
              }
            }
            // Random taps and slides on the side, which must never break the board.
            const live = g().cells.filter((c) => c >= 0);
            if (live.length && rng.int(3) === 0) {
              s.onPick(live[rng.int(live.length)]);
              (s as unknown as { onCell(c: number): void }).onCell(rng.int(g().cells.length));
            }
          }
          await advance(s, 0.5);
          if (!h.results.length) slideConsistent(s, h.board);
        }
        await advance(s, 2);
        expect(h.results.length, `${level} ${seed}`).toBe(1);
        const r = h.results[0];
        if (r.won) wins++;
        else losses++;
        expect(r.cleared).toBe(r.won ? r.total : r.total - g().cells.filter((c) => c >= 0).length);
        checkReward(d, r, level);
        s.dispose();
      }
    expect(wins).toBeGreaterThan(0);
    expect(wins + losses).toBe(90);
  });

  it('undo cannot be used to farm points', () => {
    const h = makeHost('easy', 4);
    const s = def('slide').start(h.host);
    const g = priv<SlideBoard>(s, 'g');
    const score = () => priv<number>(s, 'score');
    for (let i = 0; i < 5; i++) {
      const p = g.pairs()[0];
      if (!p) break;
      s.onPick(p[0]);
      vi.advanceTimersByTime(100);
      if (priv<number[][]>(s, 'history').length === 0) break;
      const before = score();
      s.undo?.();
      expect(score()).toBeLessThanOrEqual(before);
    }
    // Clear then undo, many times: the score never climbs.
    const start = score();
    for (let i = 0; i < 6; i++) {
      const p = priv<SlideBoard>(s, 'g').pairs()[0];
      if (!p) break;
      s.onPick(p[0]);
      s.undo?.();
    }
    expect(score()).toBeLessThanOrEqual(start);
  });

  it('an undo while a slide is waiting to clear cannot clear tiles out of line', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const h = makeHost('medium', seed);
      const s = def('slide').start(h.host);
      const g = () => priv<SlideBoard>(s, 'g');
      // Clear the pairs already facing, until a slide is needed.
      let guard = 0;
      while (g().pairs().length && guard++ < 40) {
        s.onPick(g().pairs()[0][0]);
        vi.advanceTimersByTime(10);
      }
      const mv = g().slideMove();
      if (!mv) continue;
      s.onPick(mv[0]);
      (s as unknown as { onCell(c: number): void }).onCell(mv[2] * g().w + mv[1]);
      s.undo?.();
      s.shuffle?.();
      vi.advanceTimersByTime(1000);
      slideConsistent(s, h.board);
    }
  });

  it('a win or a loss is not reported after the last pair is undone', () => {
    // Two facing tiles: clearing them wins in 700 ms; an undo in between keeps the game going.
    const h = makeHost('easy', 1);
    const s = def('slide').start(h.host);
    const g = priv<SlideBoard>(s, 'g');
    g.cells = g.cells.map(() => -1);
    const ids = h.board.ids();
    const [a, b] = ids.filter((i) => ids.some((j) => j !== i && h.board.kindOf(j) === h.board.kindOf(i))).slice(0, 1).flatMap((i) => [i, ids.find((j) => j !== i && h.board.kindOf(j) === h.board.kindOf(i))!]);
    g.cells[0] = a;
    g.cells[1] = b;
    for (const id of ids) if (id !== a && id !== b) h.board.hide(id);
    s.onPick(a);
    expect(g.cells.every((c) => c < 0)).toBe(true);
    s.undo?.();
    vi.advanceTimersByTime(2000);
    if (h.results.length) expect(priv<SlideBoard>(s, 'g').cells.some((c) => c >= 0)).toBe(false);
  });

  it('when a shuffle leaves no move and none are left, the game still ends', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const h = makeHost('hard', seed);
      const s = def('slide').start(h.host);
      // Two lone tiles that match nothing: no shuffle can help.
      const g = priv<SlideBoard>(s, 'g');
      const ids = h.board.ids();
      const a = ids[0];
      const b = ids.find((i) => matchGroup(h.board.kindOf(i)) !== matchGroup(h.board.kindOf(a)))!;
      g.cells = g.cells.map(() => -1);
      g.cells[0] = a;
      g.cells[g.w + 1] = b;
      for (const id of ids) if (id !== a && id !== b) h.board.hide(id);
      expect(s.suggest?.()).toBeNull();
      expect(s.shuffle?.()).toBe(true); // hard has one
      expect(s.canUse?.('shuffle')).toBe(false);
      expect(s.canUndo?.()).toBe(false); // the end is on its way
      vi.advanceTimersByTime(3000);
      expect(h.results.length).toBe(1);
      expect(h.results[0].won).toBe(false);
      expect(h.results[0].cleared).toBe(54);
    }
  });

  it('a tap on the tile in front slides the picked one there, pushing it along', () => {
    const h = makeHost('easy', 2);
    const s = def('slide').start(h.host);
    const g = priv<SlideBoard>(s, 'g');
    const ids = h.board.ids();
    const a = ids[0];
    const mate = ids.find((i) => i !== a && matchGroup(h.board.kindOf(i)) === matchGroup(h.board.kindOf(a)))!;
    const other = ids.find((i) => matchGroup(h.board.kindOf(i)) !== matchGroup(h.board.kindOf(a)))!;
    // Row 0: a, other, _ ; the mate sits below column 1: a slide of one place right lines a up with it.
    g.cells = g.cells.map(() => -1);
    g.cells[0] = a;
    g.cells[1] = other;
    g.cells[3 * g.w + 1] = mate;
    for (const id of ids) if (![a, mate, other].includes(id)) h.board.hide(id);
    expect(g.slideMove()).toEqual([a, 1, 0]);
    s.onPick(a);
    s.onPick(other); // the place it should go is held by `other`, which gets pushed on
    vi.advanceTimersByTime(1000);
    expect(new Set(h.board.ids())).toEqual(new Set([other]));
    expect(priv<SlideBoard>(s, 'g').pos(other)).toEqual({ x: 2, y: 0 });
    // And an undo puts all three back where they were.
    expect(s.undo?.()).toBe(true);
    expect(priv<SlideBoard>(s, 'g').pos(a)).toEqual({ x: 0, y: 0 });
    expect(new Set(h.board.ids())).toEqual(new Set([a, mate, other]));
  });

  it('a slide waiting to clear when the game restarts does not clear tiles on the next board', () => {
    const board = new StubBoard();
    for (let seed = 1; seed <= 20; seed++) {
      const h = makeHost('easy', seed, board);
      const s = def('slide').start(h.host);
      const g = priv<SlideBoard>(s, 'g');
      // Clear the pairs already facing, until a slide is needed.
      for (let n = 0; n < 30 && g.pairs().length; n++) s.onPick(g.pairs()[0][0]);
      if (g.pairs().length) continue;
      const mv = g.slideMove();
      if (!mv) continue;
      s.onPick(mv[0]);
      (s as unknown as { onCell(c: number): void }).onCell(mv[2] * g.w + mv[1]);
      s.dispose();
      def('slide').start(makeHost('easy', seed + 100, board).host);
      vi.advanceTimersByTime(2000);
      expect(board.ids().length).toBe(24);
      return;
    }
    throw new Error('no deal without a facing pair');
  });

  it('rewards: a win always pays at least as much as any loss', () => {
    const d = def('slide');
    for (const level of LEVELS) {
      const bigLoss = d.reward({ won: false, score: 0, seconds: 600, cleared: 54, total: 56, hints: 3, undos: 200, shuffles: 1 }, level);
      const poorWin = d.reward({ won: true, score: 0, seconds: 600, cleared: 56, total: 56, hints: 3, undos: 200, shuffles: 1 }, level);
      expect(poorWin).toBeGreaterThanOrEqual(bigLoss);
    }
  });
});

// ------------------------------------------------------------ Match-3

function match3Consistent(s: MiniSession, board: StubBoard) {
  const g = priv<Match3>(s, 'g');
  const idAt = priv<number[]>(s, 'idAt');
  expect(new Set(idAt).size).toBe(49);
  idAt.forEach((id, c) => {
    expect(board.has(id)).toBe(true);
    expect(board.kindOf(id)).toBe(g.cells[c]);
  });
}

describe('match-3, played through', () => {
  it('plays to an end on every level by taps and swipes; the board never jams', async () => {
    const d = def('match3');
    for (const level of LEVELS)
      for (let seed = 1; seed <= 20; seed++) {
        const h = makeHost(level, seed);
        const s = d.start(h.host);
        const rng = new Rng(seed * 31);
        const g = () => priv<Match3>(s, 'g');
        expect(g().lines().length).toBe(0);
        let guard = 0;
        let lastMoves = priv<number>(s, 'moves');
        while (!h.results.length && guard++ < 400) {
          const m = s.suggest?.();
          expect(m).not.toBeNull(); // a settled board always has a swap (it is dealt again otherwise)
          if (m && m.length === 2) {
            const roll = rng.int(4);
            if (roll === 0) {
              // A random swipe, often a dud that swaps back.
              const ids = priv<number[]>(s, 'idAt');
              s.onSwipe?.(ids[rng.int(49)], rng.next() - 0.5, rng.next() - 0.5);
            } else if (roll === 1) {
              const idAt = priv<number[]>(s, 'idAt');
              const [ca, cb] = [idAt.indexOf(m[0]), idAt.indexOf(m[1])];
              s.onSwipe?.(m[0], (cb % 7) - (ca % 7), Math.floor(cb / 7) - Math.floor(ca / 7));
            } else {
              s.onPick(m[0]);
              s.onPick(m[0]); // tapping the same tile twice drops it
              s.onPick(m[0]);
              s.onPick(m[1]);
            }
            if (rng.int(8) === 0) s.hint?.();
            // Taps during the cascade are ignored.
            s.onPick(rng.int(49));
          }
          await advance(s, 3, true);
          for (let w = 0; w < 30 && priv<boolean>(s, 'busy'); w++) await advance(s, 1, true);
          if (!h.results.length) {
            match3Consistent(s, h.board);
            expect(g().lines().length).toBe(0);
            const mv = priv<number>(s, 'moves');
            expect(mv).toBeLessThanOrEqual(lastMoves);
            lastMoves = mv;
            expect(priv<boolean>(s, 'busy')).toBe(false);
          }
        }
        await advance(s, 5, true);
        expect(h.results.length, `${level} ${seed}`).toBe(1);
        const r = h.results[0];
        if (r.won) expect(r.score).toBeGreaterThanOrEqual(SETUP_TARGET[level]);
        const v = checkReward(d, r, level);
        expect(v).toBeGreaterThanOrEqual(0);
        s.dispose();
      }
    // About 2 s alone; give it room on a loaded machine (it timed out once at the 5 s default).
  }, 30_000);

  it('a cascade still running when the game restarts does not touch the next board', async () => {
    const board = new StubBoard();
    const h = makeHost('easy', 5, board);
    const s = def('match3').start(h.host);
    const m = s.suggest!()!;
    s.onPick(m[0]);
    s.onPick(m[1]);
    await vi.advanceTimersByTimeAsync(300);
    s.dispose();
    const h2 = makeHost('easy', 6, board);
    const s2 = def('match3').start(h2.host);
    const kinds = board.ids().map((id) => board.kindOf(id));
    await vi.advanceTimersByTimeAsync(5000);
    expect(board.ids().map((id) => board.kindOf(id))).toEqual(kinds);
    match3Consistent(s2, board);
  });

  it('a swipe with no direction swaps nothing and does not lock the board', () => {
    const h = makeHost('medium', 3);
    const s = def('match3').start(h.host);
    const before = [...priv<Match3>(s, 'g').cells];
    s.onSwipe?.(10, 0, 0);
    expect(priv<boolean>(s, 'busy')).toBe(false);
    expect(priv<Match3>(s, 'g').cells).toEqual(before);
    expect(priv<number>(s, 'moves')).toBe(22);
  });

  it('rewards stay in range', () => {
    const d = def('match3');
    for (const level of LEVELS) {
      const win = d.reward({ won: true, score: 99999, seconds: 0, cleared: 1, total: 1, hints: 0, undos: 0, shuffles: 0 }, level);
      const lose = d.reward({ won: false, score: 3399, seconds: 0, cleared: 3399, total: 3400, hints: 0, undos: 0, shuffles: 0 }, level);
      const poorWin = d.reward({ won: true, score: 1500, seconds: 0, cleared: 1500, total: 1500, hints: 9, undos: 0, shuffles: 0 }, level);
      expect(win).toBeLessThanOrEqual(600);
      expect(poorWin).toBeGreaterThan(lose);
    }
  });

  it('a fill never deals lines and always leaves a swap', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = new Rng(seed);
      const kinds = rng.shuffle([0, 13, 22, 27, 31, 32, 33, 4]).slice(0, 5 + (seed % 3));
      const g = new Match3(7, Array(49).fill(-1), kinds, rng);
      g.fill();
      expect(g.lines().length).toBe(0);
      expect(g.findMove()).not.toBeNull();
    }
  });
});
const SETUP_TARGET: Record<MiniLevel, number> = { easy: 1500, medium: 2400, hard: 3400 };

// ------------------------------------------------------------ Chain Reaction

function chainConsistent(s: MiniSession, board: StubBoard) {
  const g = priv<ChainBoard>(s, 'g');
  const idAt = priv<number[]>(s, 'idAt');
  const live = idAt.filter((i) => i >= 0);
  expect(new Set(board.ids())).toEqual(new Set(live));
  idAt.forEach((id, c) => {
    if (id < 0) expect(g.cells[c]).toBe(-1);
    else expect(board.kindOf(id)).toBe(g.cells[c]);
  });
}

describe('chain reaction, played through', () => {
  it('plays to an end on every level with undos, and scores add up', () => {
    const d = def('chain');
    for (const level of LEVELS)
      for (let seed = 1; seed <= 30; seed++) {
        const h = makeHost(level, seed);
        const s = d.start(h.host);
        const g = () => priv<ChainBoard>(s, 'g');
        const rng = new Rng(seed * 5);
        let expectScore = 0;
        const scores: number[] = [];
        let guard = 0;
        while (!h.results.length && guard++ < 500) {
          const groups = g().groups();
          if (groups.length && rng.int(10)) {
            const roll = rng.int(3);
            const grp = roll === 0 ? s.suggest!()!.map((id) => priv<number[]>(s, 'idAt').indexOf(id)) : groups[rng.int(groups.length)];
            const pts = groupScore(grp.length, g().hasRun(grp));
            scores.push(expectScore);
            expectScore += pts;
            s.onPick(priv<number[]>(s, 'idAt')[grp[rng.int(grp.length)]]);
          } else if (s.canUndo?.() && rng.int(2)) {
            s.undo?.();
            expectScore = scores.pop() ?? 0;
          } else if (!groups.length) {
            // Taps on a dead board do nothing.
            const live = priv<number[]>(s, 'idAt').filter((i) => i >= 0);
            if (live.length) s.onPick(live[0]);
          }
          vi.advanceTimersByTime(rng.int(3) * 400);
          s.tick?.(0.4);
          if (!h.results.length) {
            chainConsistent(s, h.board);
            expect(priv<number>(s, 'score')).toBe(expectScore);
          }
        }
        vi.advanceTimersByTime(2000);
        expect(h.results.length, `${level} ${seed}`).toBe(1);
        const r = h.results[0];
        // The end is only reported when no group is left.
        expect(g().groups().length).toBe(0);
        const left = g().left;
        expect(r.cleared).toBe(r.total - left);
        expect(r.won).toBe(left <= { easy: 8, medium: 10, hard: 12 }[level]);
        checkReward(d, r, level);
        s.dispose();
      }
  });

  it('an undo in the moment before the end keeps the game going', () => {
    let tried = 0;
    for (let seed = 1; seed <= 40 && tried < 5; seed++) {
      const h = makeHost('easy', seed);
      const s = def('chain').start(h.host);
      const g = () => priv<ChainBoard>(s, 'g');
      while (g().groups().length) s.onPick(priv<number[]>(s, 'idAt')[g().groups()[0][0]]);
      tried++;
      // The end is due in a moment: undo the last clear first.
      expect(s.undo?.()).toBe(true);
      vi.advanceTimersByTime(2000);
      expect(h.results.length).toBe(0);
      expect(g().groups().length).toBeGreaterThan(0);
      s.onPick(priv<number[]>(s, 'idAt')[g().groups()[0][0]]);
    }
  });

  it('deals are the same for the same daily seed', () => {
    const a = makeHost('medium', miniDailySeed('chain', '2026-11-13'));
    const b = makeHost('medium', miniDailySeed('chain', '2026-11-13'));
    def('chain').start(a.host);
    def('chain').start(b.host);
    expect(a.board.ids().map((i) => a.board.kindOf(i))).toEqual(b.board.ids().map((i) => b.board.kindOf(i)));
  });

  it('groups are one family and runs count only suited numbers in a row', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = new Rng(seed);
      const b = new ChainBoard(10, 7, dealChain(10, 7, 5, rng));
      for (const g of b.groups()) {
        expect(new Set(g.map((c) => chainFamily(b.cells[c]))).size).toBe(1);
      }
    }
    const b = new ChainBoard(3, 1, [0, 1, 2]);
    expect(b.hasRun([0, 1, 2])).toBe(true);
    const c = new ChainBoard(3, 1, [0, 1, 3]);
    expect(c.hasRun([0, 1, 2])).toBe(false);
  });

  it('rewards: a win always pays at least as much as any loss', () => {
    const d = def('chain');
    for (const level of LEVELS) {
      const bigLoss = d.reward({ won: false, score: 0, seconds: 600, cleared: 80, total: 96, hints: 0, undos: 300, shuffles: 0 }, level);
      const poorWin = d.reward({ won: true, score: 0, seconds: 600, cleared: 96, total: 96, hints: 0, undos: 300, shuffles: 0 }, level);
      expect(poorWin).toBeGreaterThanOrEqual(bigLoss);
    }
  });
});

// ------------------------------------------------------------ Colour Match

const SETUP_COLOUR: Record<MiniLevel, [number, number]> = { easy: [4, 2], medium: [5, 2], hard: [7, 2] };

describe('colour match, played through', () => {
  it('every deal on every level is sortable and its solution sorts it', () => {
    for (const level of LEVELS)
      for (let seed = 1; seed <= 60; seed++) {
        const [f, sp] = SETUP_COLOUR[level];
        const { lanes, par } = dealColour(f, sp, new Rng(seed));
        expect(lanes.length).toBe(f + sp);
        expect(lanes.flat().length).toBe(f * 4);
        const s = new Sorter(lanes.map((l) => [...l]));
        const sol = s.solve(120000)!;
        expect(sol).not.toBeNull();
        expect(sol.length).toBe(par);
        for (const [a, b] of sol) {
          expect(s.canMove(a, b)).toBe(true);
          s.move(a, b);
        }
        expect(s.solved()).toBe(true);
      }
  });

  it('a player following the hints, with stray moves and undos, sorts every board once', () => {
    const d = def('colour');
    for (const level of LEVELS)
      for (let seed = 1; seed <= 15; seed++) {
        const h = makeHost(level, seed);
        const s = d.start(h.host);
        const rng = new Rng(seed * 3);
        const g = () => priv<Sorter>(s, 'g');
        const ids = () => priv<number[][]>(s, 'ids');
        const lane = (l: number) => (s as unknown as { lane(l: number): void }).lane(l);
        let guard = 0;
        while (!h.results.length && guard++ < 400) {
          if (g().solved()) {
            // The win is on its way.
          } else if (rng.int(6) === 0) {
            // A stray legal move (or a refused one), sometimes undone.
            const a = rng.int(g().lanes.length),
              b = rng.int(g().lanes.length);
            lane(a);
            lane(b);
            lane(b); // drop whatever is held
            if (priv<number | null>(s, 'sel') !== null) lane(priv<number>(s, 'sel'));
            if (rng.int(2) && s.canUndo?.()) s.undo?.();
          } else {
            const m = s.suggest?.();
            expect(m).not.toBeNull();
            if (!m || !m.length) {
              if (priv<number | null>(s, 'sel') !== null) lane(priv<number>(s, 'sel'));
              else if (s.canUndo?.()) s.undo?.();
              else break;
            } else {
              // The hint names the tile to move and the tile it goes on, or only the tile when it goes to an empty row.
              const from = ids().findIndex((l) => l[l.length - 1] === m[0]);
              const to = m.length === 2 ? ids().findIndex((l) => l[l.length - 1] === m[1]) : g().lanes.findIndex((l) => !l.length);
              lane(from);
              lane(to);
            }
          }
          // Lanes and ids agree, tile counts never change, no lane overflows.
          expect(ids().map((l) => l.length)).toEqual(g().lanes.map((l) => l.length));
          expect(g().lanes.flat().length).toBe(SETUP_COLOUR[level][0] * 4);
          for (const l of g().lanes) expect(l.length).toBeLessThanOrEqual(4);
          ids().forEach((l, i) => l.forEach((id, j) => expect(h.board.kindOf(id)).toBe(g().lanes[i][j])));
          vi.advanceTimersByTime(300);
          s.tick?.(0.3);
        }
        vi.advanceTimersByTime(1000);
        expect(h.results.length, `${level} ${seed}`).toBe(1);
        expect(h.results[0].won).toBe(true);
        expect(g().solved()).toBe(true);
        checkReward(d, h.results[0], level);
      }
  });

  it('following only the hints sorts every board, in no more moves than the solver found', () => {
    for (const level of LEVELS)
      for (let seed = 1; seed <= 30; seed++) {
        const h = makeHost(level, seed);
        const s = def('colour').start(h.host);
        const g = () => priv<Sorter>(s, 'g');
        const ids = () => priv<number[][]>(s, 'ids');
        const lane = (l: number) => (s as unknown as { lane(l: number): void }).lane(l);
        let n = 0;
        while (!g().solved() && n++ < 200) {
          const m = s.suggest!()!;
          expect(m.length).toBeGreaterThan(0);
          lane(ids().findIndex((l) => l[l.length - 1] === m[0]));
          lane(m.length === 2 ? ids().findIndex((l) => l[l.length - 1] === m[1]) : g().lanes.findIndex((l) => !l.length));
        }
        vi.advanceTimersByTime(1000);
        expect(h.results.length, `${level} ${seed}`).toBe(1);
        expect(priv<number>(s, 'moves')).toBeLessThanOrEqual(priv<number>(s, 'par'));
      }
  });

  it('an undo just after the last move does not report a win on an unsorted board', () => {
    const h = makeHost('easy', 2);
    const s = def('colour').start(h.host);
    const lane = (l: number) => (s as unknown as { lane(l: number): void }).lane(l);
    const sol = new Sorter(priv<Sorter>(s, 'g').lanes.map((l) => [...l])).solve()!;
    for (const [a, b] of sol) {
      lane(a);
      lane(b);
    }
    expect(priv<Sorter>(s, 'g').solved()).toBe(true);
    s.undo?.();
    vi.advanceTimersByTime(2000);
    expect(h.results.length).toBe(0);
    // Redo the last move: now it wins.
    const [a, b] = sol[sol.length - 1];
    lane(a);
    lane(b);
    vi.advanceTimersByTime(2000);
    expect(h.results.length).toBe(1);
  });

  it('suits are kept apart by family()', () => {
    const s = new Sorter([[27, 31], [28], [], []]);
    expect(family(27)).not.toBe(family(31));
    expect(s.canMove(0, 1)).toBe(false);
  });
});
