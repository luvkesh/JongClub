// Deep play-through tests for Mahjong Solitaire, Tower, Timed, Blitz and Shuffle:
// every game is driven through def.start(host) with a stub host and a stub board
// (tweens finish at once), played to the end on every level and option with many
// seeds, and checked against the rules after every step.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Rng } from '../src/engine/rng';
import { matchGroup } from '../src/minigames/helpers';
import { miniGame } from '../src/minigames/registry';
import type { MiniGameDef, MiniHost, MiniLevel, MiniResult } from '../src/minigames/types';
import { LAYOUTS, TOWER_LAYOUTS } from '../src/minigames/games/solitaire/layouts';
import { Solitaire, deal, freeSlots, removalOrder, slotFree, topology } from '../src/minigames/games/solitaire/logic';
import '../src/minigames/games/solitaire';

(globalThis as unknown as { window: unknown }).window = globalThis;

type Finish = Omit<MiniResult, 'hints' | 'undos' | 'shuffles'> & Partial<Pick<MiniResult, 'hints' | 'undos' | 'shuffles'>>;

/** A TileBoard stand-in: poses only, every tween lands at once. */
class StubBoard {
  w = 0.36;
  h = 0.48;
  d = 0.26;
  tiles = new Map<number, { kind: number; pos: THREE.Vector3; alive: boolean; look: string }>();
  looksCalls = 0;
  builds = 0;
  build(specs: { id: number; kind: number; pos: THREE.Vector3 }[]) {
    this.builds++;
    this.tiles.clear();
    for (const s of specs) this.tiles.set(s.id, { kind: s.kind, pos: s.pos.clone(), alive: true, look: 'normal' });
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
  pose(id: number) {
    const t = this.tiles.get(id);
    return t ? { pos: t.pos.clone(), quat: new THREE.Quaternion(), scale: 1 } : null;
  }
  setLook(id: number, look: string) {
    const t = this.tiles.get(id);
    if (t) t.look = look;
  }
  look(id: number) {
    return this.tiles.get(id)?.look ?? 'normal';
  }
  looks(fn: (id: number) => string) {
    this.looksCalls++;
    for (const [id, t] of this.tiles) if (t.alive) t.look = fn(id);
  }
  moveTo(id: number, to: { pos?: THREE.Vector3 }, o: { done?: () => void } = {}) {
    const t = this.tiles.get(id);
    if (!t) return;
    if (to.pos) t.pos.copy(to.pos);
    o.done?.();
  }
  place(id: number, pose: { pos?: THREE.Vector3 }) {
    const t = this.tiles.get(id);
    if (t && pose.pos) t.pos.copy(pose.pos);
  }
  remove(id: number, o: { done?: () => void } = {}) {
    const t = this.tiles.get(id);
    if (!t || !t.alive) return;
    t.alive = false;
    o.done?.();
  }
  hide(id: number) {
    const t = this.tiles.get(id);
    if (t) t.alive = false;
  }
  restore(id: number, pose: { pos: THREE.Vector3 }) {
    const t = this.tiles.get(id);
    if (!t) return;
    t.alive = true;
    t.pos.copy(pose.pos);
  }
  shake() {}
  pulse() {}
  busy() {
    return false;
  }
  bounds() {
    return new THREE.Box3();
  }
}

interface Run {
  def: MiniGameDef;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  s: any;
  board: StubBoard;
  finishes: Finish[];
  toasts: string[];
  used: string[];
  host: MiniHost;
}

function start(id: string, level: MiniLevel, options: Record<string, string>, seed: number, daily = false): Run {
  const def = miniGame(id)!;
  const board = new StubBoard();
  const finishes: Finish[] = [];
  const toasts: string[] = [];
  const used: string[] = [];
  const host: MiniHost = {
    board: board as unknown as MiniHost['board'],
    camera: { home: { yaw: 0, pitch: 60 }, reset() {} } as unknown as MiniHost['camera'],
    fit() {},
    burst() {},
    rng: new Rng(seed),
    seed,
    level,
    options,
    daily,
    setStat() {},
    toast: (t) => void toasts.push(t),
    sound() {},
    finish: (r) => void finishes.push(r),
    used: (w) => void used.push(w),
    refreshButtons() {},
  };
  const s = def.start(host);
  return { def, s, board, finishes, toasts, used, host };
}

/** Advance the game clock and the page timers together, as the shell does (ticks of 0.1 s). */
function advance(r: Run, sec: number) {
  const steps = Math.round(sec * 10);
  for (let i = 0; i < steps; i++) {
    if (!r.finishes.length) r.s.tick(0.1);
    vi.advanceTimersByTime(100);
  }
}

/** The board and the rules agree: live tiles, where they sit, and whole pairs left. */
function checkInvariants(r: Run) {
  const g: Solitaire = r.s.g;
  for (let id = 0; id < g.total; id++) {
    expect(r.board.has(id)).toBe(g.alive[id]);
    if (g.alive[id]) {
      expect(g.inSlot[g.slotOf[id]]).toBe(id);
      const want = r.s.worldOf(g.t.slots[g.slotOf[id]]) as THREE.Vector3;
      expect(r.board.pose(id)!.pos.distanceTo(want)).toBeLessThan(1e-6);
    }
  }
  const occupied = g.slotOf.filter((_, id) => g.alive[id]);
  expect(new Set(occupied).size).toBe(occupied.length);
  const groups = new Map<number, number>();
  g.alive.forEach((a, id) => a && groups.set(matchGroup(g.kinds[id]), (groups.get(matchGroup(g.kinds[id])) ?? 0) + 1));
  for (const n of groups.values()) expect(n % 2).toBe(0);
}

function snapshot(g: Solitaire) {
  return { alive: [...g.alive], slotOf: [...g.slotOf], hist: g.history.length };
}

interface PlayOpts {
  picker: 'suggest' | 'random' | 'hint';
  undoP?: number;
  shuffleP?: number;
  hintP?: number;
  secPerMove?: number;
  maxSteps?: number;
}

/** Play to the end like a person: legal pairs, now and then an undo, a hint or a shuffle. */
function play(r: Run, seed: number, o: PlayOpts) {
  const rng = new Rng(seed * 7919 + 13);
  const tools = r.def.tools ?? {};
  const stats = { moves: 0, undos: 0, shuffles: 0, hints: 0, dead: 0 };
  for (let step = 0; step < (o.maxSteps ?? 3000) && !r.finishes.length; step++) {
    advance(r, o.secPerMove ?? 0.3);
    if (r.finishes.length) break;
    const g: Solitaire = r.s.g;
    checkInvariants(r);
    const sug = r.s.suggest() as number[] | null;
    if (sug === null) {
      expect(g.pairs().length).toBe(0);
      expect(g.left).toBeGreaterThan(0);
      stats.dead++;
      if (tools.shuffle && r.s.canUse('shuffle')) {
        const before = g.left;
        const ok = r.s.shuffle();
        expect(r.s.g.left).toBe(before);
        if (ok) {
          stats.shuffles++;
          expect(r.s.g.pairs().length).toBeGreaterThan(0);
        }
      } else if (tools.undo && r.s.canUndo() && rng.next() < 0.5) {
        expect(r.s.undo()).toBe(true);
        stats.undos++;
      } else advance(r, 2);
      continue;
    }
    if (sug.length === 0) continue; // between boards (Blitz)
    expect(sug.length).toBe(2);
    expect(g.canMatch(sug[0], sug[1])).toBe(true);
    if (tools.hint && o.hintP && rng.next() < o.hintP && r.s.canUse('hint')) {
      expect(r.s.hint()).toBe(true);
      const hp = r.s.hintPair as [number, number];
      expect(g.canMatch(hp[0], hp[1])).toBe(true);
      stats.hints++;
    }
    if (tools.undo && o.undoP && rng.next() < o.undoP && r.s.canUndo()) {
      const hist = g.history.length;
      const last = g.history[hist - 1];
      const before = snapshot(g);
      expect(r.s.undo()).toBe(true);
      stats.undos++;
      expect(g.history.length).toBe(hist - 1);
      if (last.kind === 'pair') {
        expect(g.alive[last.a] && g.alive[last.b]).toBe(true);
        expect(before.alive[last.a] || before.alive[last.b]).toBe(false);
      } else expect(g.slotOf).toEqual(last.before);
      checkInvariants(r);
      continue;
    }
    if (tools.shuffle && o.shuffleP && rng.next() < o.shuffleP && r.s.canUse('shuffle')) {
      const before = snapshot(g);
      const kinds = g.alive.map((a, id) => (a ? g.kinds[id] : -1)).filter((k) => k >= 0);
      if (r.s.shuffle()) {
        stats.shuffles++;
        const after = g.alive.map((a, id) => (a ? g.kinds[id] : -1)).filter((k) => k >= 0);
        expect(after).toEqual(kinds);
        expect(g.alive).toEqual(before.alive);
        expect(g.pairs().length).toBeGreaterThan(0);
        // Live tiles keep to the slots that were filled.
        const filled = new Set(before.slotOf.filter((_, id) => before.alive[id]));
        g.slotOf.forEach((s, id) => g.alive[id] && expect(filled.has(s)).toBe(true));
        checkInvariants(r);
      }
      continue;
    }
    let pair: number[] = sug;
    if (o.picker === 'random') {
      const all = g.pairs();
      pair = all[rng.int(all.length)];
    }
    const left = g.left;
    // A blocked tile first: it must not be taken or selected.
    const blocked = g.alive.findIndex((a, id) => a && !g.isFree(id));
    if (blocked >= 0 && rng.next() < 0.2) {
      r.s.onPick(blocked);
      expect(r.s.sel).toBe(null);
    }
    r.s.onPick(pair[0]);
    expect(r.s.sel).toBe(pair[0]);
    r.s.onPick(pair[1]);
    expect(g.alive[pair[0]] || g.alive[pair[1]]).toBe(false);
    expect(g.left).toBe(left - 2);
    stats.moves++;
  }
  // Let any timer still pending land.
  advance(r, 3);
  return stats;
}

/** Take pairs through the session until `n` tiles are left (a rules-level reshuffle when stuck). */
function clearTo(r: Run, n: number) {
  const g: Solitaire = r.s.g;
  while (g.left > n) {
    if (!g.pairs().length) {
      expect(g.shuffle(new Rng(g.left))).toBe(true);
      r.s.moveAll();
    }
    const [a, b] = g.pairs()[0];
    r.s.onPick(a);
    r.s.onPick(b);
  }
}

function expectSaneResult(r: Run, level: MiniLevel) {
  expect(r.finishes.length).toBe(1);
  const f = r.finishes[0];
  const full: MiniResult = { hints: 0, undos: 0, shuffles: 0, ...f };
  expect(f.cleared).toBeGreaterThanOrEqual(0);
  expect(f.cleared).toBeLessThanOrEqual(f.total);
  expect(f.seconds).toBeGreaterThanOrEqual(0);
  expect(Number.isFinite(f.score)).toBe(true);
  expect(f.score).toBeGreaterThanOrEqual(0);
  const pay = r.def.reward(full, level);
  expect(pay).toBeGreaterThanOrEqual(0);
  expect(pay).toBeLessThanOrEqual(600);
  // Nothing more happens after the end.
  const el = r.s.clock.elapsed;
  r.s.tick(5);
  vi.advanceTimersByTime(5000);
  expect(r.s.clock.elapsed).toBe(el);
  expect(r.finishes.length).toBe(1);
  expect(r.s.suggest()).toEqual([]);
  expect(r.s.canUndo()).toBe(false);
  expect(r.s.canUse('hint')).toBe(false);
  expect(r.s.canUse('shuffle')).toBe(false);
  return f;
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const ALL = [...LAYOUTS, ...TOWER_LAYOUTS];

describe('solitaire rules, directly', () => {
  it('every deal on every layout and level is solvable in its own order', () => {
    for (const l of ALL)
      for (const near of [0.6, 0.25, 0])
        for (let seed = 1; seed <= 25; seed++) {
          const d = deal(l.slots, new Rng(seed * 101 + l.slots.length), near);
          const g = new Solitaire(l.slots, d.kinds);
          for (const [a, b] of d.solution) expect(g.remove(a, b)).toBe(true);
          expect(g.left).toBe(0);
        }
  });
  it('freeSlots agrees with slotFree and the topology is symmetric', () => {
    for (const l of ALL) {
      const t = topology(l.slots);
      t.slots.forEach((_, a) => {
        for (const b of t.left[a]) expect(t.right[b]).toContain(a);
        for (const b of t.right[a]) expect(t.left[b]).toContain(a);
        expect(t.above[a]).not.toContain(a);
      });
      const occ = l.slots.map(() => true);
      const free = freeSlots(t, occ);
      expect(free.length).toBeGreaterThanOrEqual(2);
      for (const s of free) expect(slotFree(t, occ, s)).toBe(true);
    }
  });
  it('removalOrder returns null rather than an illegal order', () => {
    // Two tiles stacked: neither order works.
    const slots = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
    ];
    const t = topology(slots);
    expect(removalOrder(t, [true, true], new Rng(1))).toBeNull();
    const g = new Solitaire(slots, [5, 5]);
    expect(g.pairs()).toEqual([]);
    expect(g.shuffle(new Rng(1))).toBe(false);
    expect(g.history).toEqual([]);
  });
  it('undo after shuffles and pairs walks back to the deal exactly', () => {
    for (const l of ALL)
      for (let seed = 1; seed <= 4; seed++) {
        const rng = new Rng(seed);
        const g = new Solitaire(l.slots, deal(l.slots, rng).kinds);
        const start = snapshot(g);
        for (let i = 0; i < 30 && g.left; i++) {
          if (i % 7 === 3) expect(g.shuffle(rng)).toBe(true);
          const p = g.pairs();
          if (!p.length) continue;
          g.remove(...p[rng.int(p.length)]);
        }
        while (g.undo());
        expect(snapshot(g)).toEqual(start);
        expect(g.undo()).toBeNull();
      }
  });
});

describe('Mahjong Solitaire played through the session', () => {
  for (const l of LAYOUTS)
    for (const level of ['easy', 'medium', 'hard'] as MiniLevel[])
      it(`${l.id} on ${level}: plays to a clean finish`, () => {
        let wins = 0;
        const seeds = l.id === 'turtle' ? 6 : 4;
        for (let seed = 1; seed <= seeds; seed++) {
          const r = start('solitaire', level, { layout: l.id }, seed * 977 + level.length);
          expect(r.s.variant()).toBe(l.id);
          expect(r.s.g.total).toBe(l.slots.length);
          // Undo at the start does nothing.
          expect(r.s.canUndo()).toBe(false);
          expect(r.s.undo()).toBe(false);
          play(r, seed, { picker: seed % 2 ? 'suggest' : 'random', undoP: 0.08, shuffleP: 0.02, hintP: 0.05 });
          const f = expectSaneResult(r, level);
          if (f.won) {
            wins++;
            expect(f.cleared).toBe(f.total);
            expect(r.s.g.left).toBe(0);
          } else expect(f.cleared).toBe(f.total - r.s.g.left);
        }
        if (level === 'easy') expect(wins).toBe(seeds); // unlimited shuffles always finish
      });
  it('the Surprise me layout picks a real layout, the same one for the same seed', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const a = start('solitaire', 'easy', { layout: 'random' }, seed);
      const b = start('solitaire', 'easy', { layout: 'random' }, seed);
      expect(LAYOUTS.map((l) => l.id)).toContain(a.s.variant());
      expect(a.s.variant()).toBe(b.s.variant());
      expect(a.s.g.kinds).toEqual(b.s.g.kinds);
    }
  });
});

describe('Mahjong Tower played through the session', () => {
  for (const l of TOWER_LAYOUTS)
    for (const level of ['medium', 'hard'] as MiniLevel[])
      it(`${l.id} on ${level}`, () => {
        for (let seed = 1; seed <= 5; seed++) {
          const r = start('tower', level, { layout: l.id }, seed * 31);
          expect(r.s.variant()).toBe(l.id);
          play(r, seed, { picker: seed % 2 ? 'suggest' : 'random', undoP: 0.05, shuffleP: 0.02, hintP: 0.05 });
          expectSaneResult(r, level);
        }
      });
});

describe('Timed Mahjong played through the session', () => {
  for (const layout of ['garden', 'peaks', 'pyramid'])
    for (const clock of ['90', '120', '180'])
      for (const level of ['medium', 'hard'] as MiniLevel[])
        it(`${layout}, ${clock}s, ${level}`, () => {
          for (let seed = 1; seed <= 3; seed++) {
            const r = start('timed', level, { layout, clock }, seed * 17 + Number(clock));
            expect(r.s.variant()).toBe(layout);
            expect(r.s.clock.limit).toBe(Number(clock));
            // Slow play runs out of time; quick play clears.
            const slow = seed === 3;
            play(r, seed, { picker: 'suggest', hintP: 0.03, shuffleP: 0.01, secPerMove: slow ? 6 : 0.8 });
            const f = expectSaneResult(r, level);
            if (!f.won) {
              expect(f.notes?.[0]).toMatch(/Time|moves/);
              if (/Time/.test(f.notes![0])) expect(r.s.clock.over).toBe(true);
            } else expect(f.score).toBeGreaterThan(0);
          }
        });
  it('pausing stops the clock', () => {
    const r = start('timed', 'medium', { layout: 'garden', clock: '90' }, 5);
    r.s.tick(1);
    r.s.pause(true);
    r.s.tick(50);
    expect(r.s.clock.elapsed).toBe(1);
    r.s.pause(false);
    r.s.tick(1);
    expect(r.s.clock.elapsed).toBe(2);
    expect(r.finishes).toEqual([]);
  });
  it('clearing the board with a second left still wins, even while the tiles fly off', () => {
    const r = start('timed', 'hard', { layout: 'garden', clock: '90' }, 11);
    const g: Solitaire = r.s.g;
    clearTo(r, 2);
    const [a, b] = g.pairs()[0];
    r.s.onPick(a);
    r.s.onPick(b);
    // A third of a second on the clock as the last pair flies off (the win lands at 0.65 s).
    r.s.clock.elapsed = r.s.clock.limit - 0.3;
    advance(r, 3);
    expect(r.finishes.length).toBe(1);
    expect(r.finishes[0].won).toBe(true);
  });
});

describe('Mahjong Blitz played through the session', () => {
  for (const level of ['easy', 'medium', 'hard'] as MiniLevel[])
    it(`${level}: runs to the clock`, () => {
      for (let seed = 1; seed <= 4; seed++) {
        const r = start('blitz', level, {}, seed * 13);
        expect(['garden', 'peaks']).toContain(r.s.variant());
        play(r, seed, { picker: 'suggest', hintP: 0.03, shuffleP: 0.02, secPerMove: seed === 4 ? 0.2 : 0.6 });
        const f = expectSaneResult(r, level);
        // Two tiles per pair, across every board.
        expect(f.cleared).toBe(r.s.pairsDone * 2);
        expect(f.total).toBe(f.cleared);
        expect(f.won).toBe(r.s.pairsDone > 0);
        expect(r.def.reward({ hints: 0, undos: 0, shuffles: 0, ...f }, level)).toBeLessThanOrEqual(220);
      }
    });
  it('a board cleared just before the bell is not counted twice', () => {
    const r = start('blitz', 'easy', {}, 21);
    const g: Solitaire = r.s.g;
    clearTo(r, 0);
    // The bell rings while the next board is still on its way.
    r.s.clock.elapsed = 89.95;
    advance(r, 0.3);
    expect(r.finishes.length).toBe(1);
    expect(r.finishes[0].cleared).toBe(g.total);
  });
  it('pressing Shuffle between boards does not end the run', () => {
    const r = start('blitz', 'medium', {}, 22);
    clearTo(r, 0);
    expect(r.s.canUse('shuffle')).toBe(false);
    r.s.shuffle();
    advance(r, 3);
    expect(r.finishes).toEqual([]);
    expect(r.s.g.left).toBe(r.s.g.total);
    expect(r.board.builds).toBe(2);
  });
  it('a dead board with no shuffles left ends the run with every board counted', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const r = start('blitz', 'hard', {}, seed);
      r.s.shufflesLeft = 0;
      const rng = new Rng(seed);
      for (let i = 0; i < 400 && !r.finishes.length; i++) {
        advance(r, 0.1);
        const p = r.s.g.pairs();
        if (!p.length) continue;
        const [a, b] = p[rng.int(p.length)];
        r.s.onPick(a);
        r.s.onPick(b);
      }
      advance(r, 3);
      if (!r.finishes.length) continue;
      const f = r.finishes[0];
      expect(f.cleared).toBe(r.s.pairsDone * 2);
    }
  });
});

describe('Mahjong Shuffle played through the session', () => {
  for (const l of LAYOUTS)
    for (const level of ['easy', 'medium', 'hard'] as MiniLevel[])
      it(`${l.id} on ${level}`, () => {
        for (let seed = 1; seed <= 3; seed++) {
          const r = start('shuffle', level, { layout: l.id }, seed * 53);
          const every = r.s.mode.reshuffleEvery as number;
          expect(every).toBe(level === 'easy' ? 8 : level === 'medium' ? 6 : 4);
          let shuffled = 0;
          let lastSlots = [...r.s.g.slotOf];
          const rng = new Rng(seed);
          for (let i = 0; i < 2000 && !r.finishes.length; i++) {
            advance(r, 0.6);
            if (r.finishes.length) break;
            const g: Solitaire = r.s.g;
            checkInvariants(r);
            if (g.slotOf.some((s, id) => s !== lastSlots[id])) {
              shuffled++;
              // A self-shuffle forgets the undo history.
              expect(g.history).toEqual([]);
              lastSlots = [...g.slotOf];
            }
            const p = g.pairs();
            if (!p.length) continue; // the board mixes itself
            if (rng.next() < 0.05 && r.s.canUndo()) {
              r.s.undo();
              lastSlots = [...g.slotOf];
              continue;
            }
            const [a, b] = p[rng.int(p.length)];
            r.s.onPick(a);
            r.s.onPick(b);
          }
          advance(r, 3);
          const f = expectSaneResult(r, level);
          expect(shuffled).toBeGreaterThan(0);
          if (f.won) expect(f.cleared).toBe(f.total);
        }
      });
});

describe('session edge cases', () => {
  it('undo of the last pair cannot sneak in before the win lands', () => {
    const r = start('solitaire', 'medium', { layout: 'garden' }, 3);
    clearTo(r, 0);
    expect(r.s.canUndo()).toBe(false);
    r.s.undo();
    advance(r, 1);
    expect(r.finishes.length).toBe(1);
    expect(r.finishes[0].won).toBe(true);
    expect(r.finishes[0].cleared).toBe(36);
  });
  it('a dead end with no shuffles left loses, unless the player undoes first', () => {
    let lost = 0,
      saved = 0;
    for (let seed = 1; seed <= 40; seed++) {
      for (const undoFirst of [false, true]) {
        const r = start('solitaire', 'hard', { layout: 'pyramid' }, seed);
        r.s.shufflesLeft = 0;
        const rng = new Rng(seed);
        while (r.s.g.pairs().length) {
          const p = r.s.g.pairs();
          const [a, b] = p[rng.int(p.length)];
          r.s.onPick(a);
          r.s.onPick(b);
        }
        if (r.s.g.left === 0) break;
        expect(r.s.suggest()).toBeNull();
        expect(r.s.canUse('shuffle')).toBe(false);
        if (undoFirst) {
          expect(r.s.undo()).toBe(true);
          vi.advanceTimersByTime(3000);
          expect(r.finishes).toEqual([]);
          saved++;
        } else {
          vi.advanceTimersByTime(3000);
          expect(r.finishes.length).toBe(1);
          expect(r.finishes[0].won).toBe(false);
          lost++;
        }
      }
    }
    expect(lost).toBeGreaterThan(0);
    expect(saved).toBe(lost);
  });
  it('undo after a shuffle puts the tiles back; a stale hint is dropped by a shuffle', () => {
    const r = start('solitaire', 'easy', { layout: 'turtle' }, 8);
    const g: Solitaire = r.s.g;
    for (let i = 0; i < 10; i++) {
      const [a, b] = g.pairs()[0];
      r.s.onPick(a);
      r.s.onPick(b);
    }
    const before = snapshot(g);
    expect(r.s.hint()).toBe(true);
    expect(r.s.shuffle()).toBe(true);
    expect(r.s.hintPair).toBe(null);
    checkInvariants(r);
    expect(r.s.undo()).toBe(true);
    expect(snapshot(g)).toEqual(before);
    checkInvariants(r);
  });
  it('selecting, deselecting and picking another tile', () => {
    const r = start('solitaire', 'easy', { layout: 'garden' }, 4);
    const g: Solitaire = r.s.g;
    const free = g.freeTiles();
    r.s.onPick(free[0]);
    expect(r.s.sel).toBe(free[0]);
    r.s.onPick(free[0]);
    expect(r.s.sel).toBe(null);
    const other = free.find((id) => matchGroup(g.kinds[id]) !== matchGroup(g.kinds[free[0]]))!;
    r.s.onPick(free[0]);
    r.s.onPick(other);
    expect(r.s.sel).toBe(other);
    expect(g.left).toBe(36);
    // Out-of-range and removed tiles are ignored.
    r.s.onPick(999);
    r.s.onPick(-1);
    expect(r.s.sel).toBe(other);
  });
  it('hints count down per level and stop at zero', () => {
    for (const [level, n] of [
      ['medium', 5],
      ['hard', 2],
    ] as const) {
      const r = start('solitaire', level, { layout: 'turtle' }, 2);
      for (let i = 0; i < n; i++) expect(r.s.hint()).toBe(true);
      expect(r.s.hint()).toBe(false);
      expect(r.s.canUse('hint')).toBe(false);
      expect(r.s.badges().hint).toBe('0');
    }
    const e = start('solitaire', 'easy', { layout: 'turtle' }, 2);
    for (let i = 0; i < 30; i++) expect(e.s.hint()).toBe(true);
    expect(e.s.badges().hint).toBeUndefined();
  });
  it('the same seed deals the same board, and suggestions do not change later shuffles', () => {
    for (const id of ['solitaire', 'tower', 'timed', 'blitz', 'shuffle']) {
      const def = miniGame(id)!;
      const level = def.levels[0];
      const opts = Object.fromEntries((def.options ?? []).map((o) => [o.id, o.initial]));
      const a = start(id, level, opts, 20261113, true);
      const b = start(id, level, opts, 20261113, true);
      expect(a.s.g.kinds).toEqual(b.s.g.kinds);
      expect(a.s.variant()).toBe(b.s.variant());
      // Player A pauses (free suggestions), player B does not; their shuffles still match.
      for (let i = 0; i < 5; i++) a.s.suggest();
      a.s.g.shuffle(a.s.rng);
      b.s.g.shuffle(b.s.rng);
      expect(a.s.g.slotOf).toEqual(b.s.g.slotOf);
    }
  });
  it('a hint timer that lands after the game is closed leaves the board alone', () => {
    const r = start('solitaire', 'easy', { layout: 'garden' }, 6);
    r.s.hint();
    r.s.dispose();
    const n = r.board.looksCalls;
    vi.advanceTimersByTime(5000);
    expect(r.board.looksCalls).toBe(n);
    expect(r.finishes).toEqual([]);
  });
  it('dispose stops everything: no finish, no tick, no new board', () => {
    const r = start('blitz', 'easy', {}, 9);
    clearTo(r, 0);
    r.s.dispose();
    r.s.tick(200);
    vi.advanceTimersByTime(5000);
    expect(r.finishes).toEqual([]);
    expect(r.board.builds).toBe(1);
  });
});

describe('rewards', () => {
  it('stay in 0..600, and a win always pays more than a loss', () => {
    for (const id of ['solitaire', 'tower', 'timed', 'blitz', 'shuffle']) {
      const def = miniGame(id)!;
      for (const level of def.levels)
        for (const total of [36, 72, 86, 92, 100, 104, 114, 144]) {
          const base = { score: 400, seconds: 100, total, hints: 0, undos: 0, shuffles: 0 };
          const bestLoss = def.reward({ ...base, won: false, cleared: total - 2 }, level);
          const worstWin = def.reward({ ...base, won: true, cleared: total, hints: 40, undos: 300, shuffles: 40, score: id === 'blitz' ? 400 : 0 }, level);
          const bestWin = def.reward({ ...base, won: true, cleared: total, score: 100000 }, level);
          for (const v of [bestLoss, worstWin, bestWin]) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(600);
          }
          if (id !== 'blitz') expect(worstWin).toBeGreaterThan(bestLoss);
          expect(def.reward({ ...base, won: false, cleared: 0, score: 0 }, level)).toBe(0);
        }
    }
  });
});
