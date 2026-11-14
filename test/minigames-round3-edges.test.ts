// Round-3 leftovers: records kept per clock (Timed Mahjong) and per gravity
// (Cascade) with older records moved to the default choice, Dungeon's flower at
// full health, Survival's and Boss's pause suggestions on their own random
// stream, Survival's next row called in when there is nothing to do, Connect's
// shuffle that always leaves a move, Slide's undo back into a dead end, the
// browser-history guard for a game's leftover entry, and the Undo arrow mirrored
// in Arabic. Games run through def.start() on the stub board and host of the
// round-2 tests (tweens finish at once).

import playSrc from '../src/minigames/play.ts?raw';
// The project has no Node typings; vitest runs on Node, and CSS imports come through empty there.
// @ts-expect-error node:fs has no type declarations in this project
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Rng } from '../src/engine/rng';
import { miniGame } from '../src/minigames/registry';
import { matchGroup } from '../src/minigames/helpers';
import { bestForGame, bestKey, bestOf, loadMini, migrateBest, recordResult, resetMiniCache, type MiniBest } from '../src/minigames/progress';
import { Connect, removalOrder } from '../src/minigames/games/connect/logic';
import { setLiveMini, skipStaleEntry } from '../src/minigames/historyGuard';
import { MIRROR_IN_RTL, toolSvg } from '../src/minigames/toolIcons';
import { MINIGAMES } from '../src/i18n/strings/minigames';
import type { MiniGameDef, MiniHost, MiniLevel, MiniResult, MiniSession } from '../src/minigames/types';
import '../src/minigames/games';

const g = globalThis as unknown as { window?: unknown; innerWidth?: number; innerHeight?: number };

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

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

function start(id: string, level: MiniLevel, seed: number, options: Record<string, string> = {}): Run {
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
    options,
    daily: false,
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
const useUndo = (r: Run) => (!r.finishes.length && r.s.undo?.() ? (r.counts.undos++, true) : false);
const useShuffle = (r: Run) => (!r.finishes.length && r.s.shuffle?.() ? (r.counts.shuffles++, true) : false);

/** Shell-like time: ticks at 10 Hz while playing, and timers run. */
async function wait(r: Run, sec: number) {
  for (let t = 0; t < sec - 1e-9; t += 0.1) {
    if (!r.finishes.length && !r.paused) r.s.tick?.(0.1);
    await vi.advanceTimersByTimeAsync(100);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  g.window = globalThis;
  g.innerWidth = 1024;
  g.innerHeight = 768;
  store.clear();
  resetMiniCache();
});
afterEach(() => {
  vi.useRealTimers();
});

const res = (o: Partial<MiniResult> = {}): MiniResult => ({ won: true, score: 100, seconds: 60, cleared: 10, total: 10, hints: 0, undos: 0, shuffles: 0, ...o });
const rec = (o: Partial<MiniBest> = {}): MiniBest => ({ score: 0, seconds: 0, wins: 0, plays: 1, ...o });

// ------------------------------------------------------------ 1. records per clock and gravity

describe('records keep the set-up choices that change a score apart', () => {
  it('Timed Mahjong keys its records by layout and clock; Cascade by the way the tiles fall; Connect by game and level', () => {
    expect(start('timed', 'medium', 1, { layout: 'garden', clock: '90' }).s.variant!()).toBe('garden:90');
    expect(start('timed', 'medium', 1, { layout: 'garden', clock: '120' }).s.variant!()).toBe('garden:120');
    expect(start('timed', 'hard', 1, { layout: 'peaks', clock: '180' }).s.variant!()).toBe('peaks:180');
    // The set-up sheet's first choice is 2:00, the clock older records are moved to.
    expect(miniGame('timed')!.options!.find((o) => o.id === 'clock')!.initial).toBe('120');
    expect(start('cascade', 'medium', 1, { gravity: 'left' }).s.variant!()).toBe('left');
    expect(start('cascade', 'medium', 1, {}).s.variant!()).toBe('down');
    expect(miniGame('cascade')!.options!.find((o) => o.id === 'gravity')!.initial).toBe('down');
    expect(start('connect', 'medium', 1).s.variant!()).toBe('');
    // Blitz and plain Solitaire keep their layout-only keys.
    expect(start('solitaire', 'easy', 1, { layout: 'turtle' }).s.variant!()).toBe('turtle');
  });

  it('a 3:00 score does not become the best to beat on 1:30', () => {
    recordResult(bestKey('timed', 'medium', 'garden:180'), res({ score: 900 }), false);
    const first90 = recordResult(bestKey('timed', 'medium', 'garden:90'), res({ score: 400 }), false);
    expect(first90.best.score).toBe(400);
    expect(bestOf('timed:medium:garden:90')?.score).toBe(400);
    expect(bestOf('timed:medium:garden:180')?.score).toBe(900);
    expect(bestOf('cascade:hard:left')).toBe(null);
    recordResult(bestKey('cascade', 'hard', 'left'), res({ score: 50 }));
    expect(bestOf('cascade:hard:down')).toBe(null);
  });

  it('older records move to the default choice once, merged with any already there, and nothing is lost', () => {
    const old = {
      best: {
        'timed:medium:garden': rec({ score: 700, seconds: 0, wins: 2, plays: 5 }),
        'timed:medium:garden:120': rec({ score: 300, wins: 1, plays: 1 }),
        'timed:hard:peaks': rec({ score: 200, plays: 2 }),
        'timed:medium:daily': rec({ score: 150 }),
        'cascade:hard': rec({ score: 420, seconds: 95, wins: 1, plays: 3 }),
        'cascade:medium': rec({ score: 80 }),
        'connect:easy': rec({ score: 60, seconds: 70, wins: 1 }),
        'solitaire:easy:turtle': rec({ score: 510 }),
      },
      earned: {},
      daily: {},
      seen: ['timed'],
      totalEarned: 1234,
    };
    store.set('jongclub.minigames.v1', JSON.stringify(old));
    const before = bestForGame('timed');
    resetMiniCache();
    const s = loadMini();
    expect(Object.keys(s.best).sort()).toEqual(['cascade:hard:down', 'cascade:medium:down', 'connect:easy', 'solitaire:easy:turtle', 'timed:hard:peaks:120', 'timed:medium:daily', 'timed:medium:garden:120'].sort());
    expect(s.best['timed:medium:garden:120']).toEqual({ score: 700, seconds: 0, wins: 3, plays: 6 });
    expect(s.best['cascade:hard:down']).toEqual(old.best['cascade:hard']);
    expect(s.best['connect:easy']).toEqual(old.best['connect:easy']);
    expect(s.totalEarned).toBe(1234);
    expect(s.recordsV).toBe(2);
    // The hub card's totals are the same as before.
    expect(bestForGame('timed')).toEqual(before);
    // Saved, and not moved again: a later load leaves the keys alone.
    expect(JSON.parse(store.get('jongclub.minigames.v1')!).recordsV).toBe(2);
    resetMiniCache();
    expect(Object.keys(loadMini().best).sort()).toEqual(Object.keys(s.best).sort());
  });

  it('migrateBest leaves keys already in the new form alone', () => {
    const best = { 'timed:medium:garden:90': rec({ score: 5 }), 'cascade:medium:left': rec({ score: 6 }), 'timed:hard:daily': rec({ score: 7 }) };
    const copy = JSON.parse(JSON.stringify(best));
    migrateBest(best);
    expect(best).toEqual(copy);
  });
});

// ------------------------------------------------------------ 2. Dungeon flower at full health

describe('dungeon: a flower at full health', () => {
  async function stepOnFlower(hurt: number) {
    for (let seed = 1; seed < 60; seed++) {
      const r = start('dungeon', 'easy', seed);
      const g2 = r.p.g;
      const i = (g2.near(r.p.at) as number[]).find((n) => !['empty', 'door', 'key'].includes(g2.rooms[n].t));
      if (i === undefined) continue;
      g2.rooms[i] = { t: 'potion', kind: 34 };
      r.p.hp = r.p.maxHp - hurt;
      r.toasts.length = 0;
      r.s.onPick(i);
      await wait(r, 0.5);
      return r;
    }
    throw new Error('no room next to the start');
  }

  it('says you are already at full health instead of "restores 0 health"', async () => {
    const r = await stepOnFlower(0);
    expect(r.toasts).toContain('A flower, but you are already at full health');
    expect(r.toasts.some((t) => /restores 0/.test(t))).toBe(false);
    expect(r.p.hp).toBe(r.p.maxHp);
  });

  it('still says how much it restores when hurt', async () => {
    const r = await stepOnFlower(2);
    expect(r.toasts).toContain('A flower restores 2 health');
    expect(r.p.hp).toBe(r.p.maxHp);
  });
});

// ------------------------------------------------------------ 3. pause suggestions on their own stream

describe('pause suggestions never move the game\'s own random stream', () => {
  for (const id of ['survival', 'boss'])
    it(id, () => {
      const idle = start(id, 'medium', 7);
      const plain = start(id, 'medium', 7);
      const shown: string[] = [];
      for (let i = 0; i < 40; i++) {
        const m = idle.s.suggest!();
        expect(m === null || Array.isArray(m)).toBe(true);
        if (m?.length) shown.push(m.join(','));
      }
      expect(shown.length).toBeGreaterThan(0);
      const seq = (r: Run) => Array.from({ length: 8 }, () => r.host.rng.next());
      expect(seq(idle)).toEqual(seq(plain));
    });
});

// ------------------------------------------------------------ 4. Survival: nothing to do

describe('survival: with no pair to take, the next row comes in now', () => {
  /** One row left whose tiles all differ: no pair, and no shuffle could make one. */
  function lonelyRow(r: Run) {
    const g2 = r.p.g;
    const row = g2.rows[0].slots.filter((id: number) => id >= 0);
    const kinds = [0, 9, 18, 27, 31, 34, 3, 12];
    row.forEach((id: number, i: number) => (g2.kinds[id] = kinds[i]));
    g2.rows = [g2.rows[0]];
    expect(g2.pairs().length).toBe(0);
    expect(g2.canPair()).toBe(false);
    return row as number[];
  }

  it('calls the next row in at once, and the HUD says so', async () => {
    const r = start('survival', 'easy', 4);
    await wait(r, 0.2);
    expect(r.p.nextIn).toBeGreaterThan(5);
    lonelyRow(r);
    await wait(r, 0.1);
    expect(r.p.nextIn).toBeLessThanOrEqual(1.5);
    expect(r.toasts).toContain('No pair to take: the next row comes in now');
    expect(r.stats.moves).toBe('Now');
    await wait(r, 1.6);
    expect(r.p.g.rows.length).toBe(2);
    expect(r.finishes.length).toBe(0);
    // One toast for the wait, not one per tick.
    expect(r.toasts.filter((t) => t === 'No pair to take: the next row comes in now').length).toBe(1);
  });

  it('also when two tiles match but no shuffle is left to bring them out', async () => {
    const r = start('survival', 'easy', 4);
    const row = lonelyRow(r);
    r.p.g.kinds[row[2]] = r.p.g.kinds[row[3]] = 5;
    r.p.shuffles = 0;
    await wait(r, 0.1);
    expect(r.p.nextIn).toBeLessThanOrEqual(1.5);
    expect(r.stats.moves).toBe('Now');
  });

  it('waits as usual while a shuffle could still make a pair (the Shuffle button is lit)', async () => {
    const r = start('survival', 'easy', 4);
    const row = lonelyRow(r);
    r.p.g.kinds[row[2]] = r.p.g.kinds[row[3]] = 5;
    await wait(r, 0.3);
    expect(r.p.nextIn).toBeGreaterThan(5);
    expect(r.s.attention!()).toBe('shuffle');
    expect(r.stats.moves).not.toBe('Now');
  });

  it('a free pair on the board leaves the rows at their usual pace', async () => {
    const r = start('survival', 'medium', 9);
    expect(r.p.g.pairs().length).toBeGreaterThan(0);
    await wait(r, 2);
    expect(r.p.nextIn).toBeGreaterThan(7);
    expect(r.toasts).not.toContain('No pair to take: the next row comes in now');
  });
});

// ------------------------------------------------------------ 5. Connect's shuffle always leaves a move

const sameRng = { next: () => 0, int: () => 0, shuffle: <T>(a: T[]) => a } as unknown as Rng;

describe('connect: a shuffle always leaves a move', () => {
  it('a board no random mix can open is dealt along a removal order instead', () => {
    // A B / B A: neither pair joins with two turns, and this "random" stream never changes the order.
    const c = new Connect(2, 2, [0, 9, 9, 0]);
    expect(c.pairs(1)).toEqual([]);
    expect(c.shuffle(sameRng)).toBe(true);
    expect(c.pairs(1).length).toBeGreaterThan(0);
    expect([...c.cells].sort((a, b) => a - b)).toEqual([0, 0, 9, 9]);
    expect(c.history.length).toBe(1);
    // And it can be cleared from there.
    while (c.left) {
      const p = c.pairs(1)[0];
      expect(p).toBeDefined();
      c.remove(p[0], p[1]);
    }
  });

  it('on any partly cleared board, with or without gravity, a shuffle succeeds and the board can still be cleared', () => {
    for (let seed = 1; seed <= 120; seed++) {
      const rng = new Rng(seed);
      const w = 3 + rng.int(6),
        h = 2 + rng.int(5);
      const gravity = (['none', 'down', 'left'] as const)[seed % 3];
      const n = 2 * (1 + rng.int(Math.floor((w * h) / 2)));
      const spots = rng.shuffle(Array.from({ length: w * h }, (_, i) => i)).slice(0, n);
      const cells = Array(w * h).fill(-1);
      spots.forEach((c, i) => (cells[c] = [0, 9, 18, 27, 31, 34][Math.floor(i / 2) % 6]));
      const order = removalOrder(w, h, cells.map((k) => k >= 0), new Rng(seed * 7), gravity);
      expect(order.length * 2, `seed ${seed}`).toBe(n);
      const c = new Connect(w, h, cells, gravity);
      expect(c.shuffle(new Rng(seed * 13)), `seed ${seed}`).toBe(true);
      expect(c.pairs(1).length, `seed ${seed}`).toBeGreaterThan(0);
      expect(c.cells.filter((k) => k >= 0).map(matchGroup).sort()).toEqual(cells.filter((k) => k >= 0).map(matchGroup).sort());
    }
  });

  it('the game ends cleanly, rather than sitting stuck with shuffles left, should a shuffle ever fail', () => {
    const r = start('connect', 'medium', 3);
    r.p.stuck = true;
    r.p.g.shuffle = () => false;
    expect(useShuffle(r)).toBe(false);
    expect(r.finishes.length).toBe(1);
    expect(r.finishes[0].won).toBe(false);
  });
});

// ------------------------------------------------------------ 6. Slide: undo back into a dead end

describe('slide: undoing the shuffle that got you out of a dead end', () => {
  async function undoIntoDeadEnd(shuffles: number) {
    const r = start('slide', 'medium', 3);
    r.p.shuffles = shuffles;
    expect(useShuffle(r)).toBe(true);
    expect(r.p.stuck).toBe(false);
    // The board the undo brings back has no pair and no slide.
    r.p.g.pairs = () => [];
    r.p.g.slideMove = () => null;
    r.toasts.length = 0;
    expect(useUndo(r)).toBe(true);
    return r;
  }

  it('with no shuffle left, ends the game as after a move', async () => {
    const r = await undoIntoDeadEnd(1);
    expect(r.p.stuck).toBe(true);
    expect(r.s.canUndo!()).toBe(false);
    await wait(r, 1.2);
    expect(r.finishes.length).toBe(1);
    expect(r.finishes[0].won).toBe(false);
  });

  it('with a shuffle left, asks for it', async () => {
    const r = await undoIntoDeadEnd(2);
    expect(r.toasts).toContain('No more moves. Shuffle the tiles to carry on.');
    expect(r.s.attention!()).toBe('shuffle');
    await wait(r, 1.2);
    expect(r.finishes.length).toBe(0);
  });
});

// ------------------------------------------------------------ 7. browser history

describe('history: a game\'s entry left behind is skipped', () => {
  const G = globalThis as unknown as { history?: unknown };
  let saved: unknown;
  let back: ReturnType<typeof vi.fn>;
  const setState = (state: unknown) => (G.history = { state, back });
  beforeEach(() => {
    saved = G.history;
    back = vi.fn();
  });
  afterEach(() => {
    G.history = saved;
  });

  it('Forward onto a finished game\'s entry steps straight back to the hub', () => {
    const game = {};
    setLiveMini(game, true);
    setState({ mini: 'connect' });
    // While the game is open its own handler deals with Back (and asks "Leave this game?").
    expect(skipStaleEntry()).toBe(false);
    expect(back).not.toHaveBeenCalled();
    setLiveMini(game, false);
    // Back to the hub: nothing to skip there.
    setState(null);
    expect(skipStaleEntry()).toBe(false);
    // Forward lands on the dead game entry: go back past it.
    setState({ mini: 'connect' });
    expect(skipStaleEntry()).toBe(true);
    expect(back).toHaveBeenCalledTimes(1);
    // Other screens' entries are left alone.
    setState({ other: 1 });
    expect(skipStaleEntry()).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('an old game closing does not mark a newer one as gone', () => {
    const a = {},
      b = {};
    setLiveMini(a, true);
    setLiveMini(b, true);
    setLiveMini(a, false);
    setState({ mini: 'hex' });
    expect(skipStaleEntry()).toBe(false);
    setLiveMini(b, false);
    expect(skipStaleEntry()).toBe(true);
  });

  it('play.ts marks the game open before adding its entry and closed on dispose', () => {
    const src = playSrc;
    expect(src.indexOf('setLiveMini(this, true)')).toBeGreaterThan(-1);
    expect(src.indexOf('setLiveMini(this, true)')).toBeLessThan(src.indexOf("window.addEventListener('popstate', this.onPop)"));
    expect(src).toContain('setLiveMini(this, false)');
    // The round-2 Back-mid-game question stays.
    expect(src).toContain("tr('Leave this game?')");
  });
});

// ------------------------------------------------------------ 8. RTL: the Undo arrow

describe('right to left: direction-bearing tool icons are mirrored', () => {
  it('Undo is marked; Dimensions\' turns, Reset view and the rest are not', () => {
    expect(toolSvg('undo')).toContain('class="ico-dir"');
    for (const id of ['turnL', 'turnR', 'view', 'restart', 'hint', 'shuffle', 'help'] as const) expect(toolSvg(id)).not.toContain('ico-dir');
    expect([...MIRROR_IN_RTL]).toEqual(['undo']);
  });

  it('rtl.css mirrors marked icons under [dir=rtl]', () => {
    const css: string = readFileSync(new URL('../src/i18n/rtl.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\[dir='rtl'\] \.ico-dir \{ transform: scaleX\(-1\); \}/);
  });
});

// ------------------------------------------------------------ new text

describe('new text is in all six languages', () => {
  it('has a row with every language filled', () => {
    for (const en of ['A flower, but you are already at full health', 'No pair to take: the next row comes in now']) {
      const row = MINIGAMES.find((r) => r[0] === en);
      expect(row, en).toBeDefined();
      expect(row!.length).toBe(6);
      for (const t of row!) expect(String(t).trim().length).toBeGreaterThan(0);
      // Hindi in Devanagari, with no Latin or Urdu script mixed in.
      expect(String(row![5])).toMatch(/^[ऀ-ॿ\s:,.]+$/);
    }
  });
});

