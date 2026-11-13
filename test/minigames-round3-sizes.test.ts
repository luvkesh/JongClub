// Round-3 tile sizes on phones: a wide honeycomb for Hex on phones held sideways
// (same tile counts, true honeycomb, every deal clears), the Boss standing beside
// its wall there, the screen-shape check, and the board camera's tighter fit (the
// board's own points and span instead of its bounding box, centred in the free area).

import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Rng } from '../src/engine/rng';
import { HexBoard, WIDE_ROWS, dealHex, hexCells, rowCells } from '../src/minigames/games/hex';
import { sidewaysPhone } from '../src/minigames/helpers';
import { BoardCamera } from '../src/minigames/camera';
import { miniGame } from '../src/minigames/registry';
import type { MiniHost, MiniLevel, MiniSession } from '../src/minigames/types';
import '../src/minigames/games';

const g = globalThis as unknown as { window?: unknown };
const realWindow = g.window;
function screen(w: number, h: number) {
  g.window = { innerWidth: w, innerHeight: h, setTimeout: () => 0, clearTimeout: () => {} };
}
afterEach(() => {
  g.window = realWindow;
});

describe('sideways phones', () => {
  it('only short, wide screens count', () => {
    g.window = undefined;
    expect(sidewaysPhone()).toBe(false);
    screen(844, 390);
    expect(sidewaysPhone()).toBe(true);
    screen(740, 360);
    expect(sidewaysPhone()).toBe(true);
    screen(667, 375);
    expect(sidewaysPhone()).toBe(true);
    screen(390, 844);
    expect(sidewaysPhone()).toBe(false);
    screen(1024, 768);
    expect(sidewaysPhone()).toBe(false);
    screen(1366, 1024);
    expect(sidewaysPhone()).toBe(false);
  });
});

describe('Hex wide honeycomb (sideways phones)', () => {
  const R = { medium: 4, hard: 5 } as const;
  for (const level of ['medium', 'hard'] as const) {
    const rows = WIDE_ROWS[level]!;
    it(`${level}: same count as the round board, shallow, whole axial cells`, () => {
      const cells = rowCells(rows);
      expect(cells.length).toBe(hexCells(R[level]).length);
      // Shallower than the round board (2R + 1 rows), so the short screen height holds it.
      expect(rows.length).toBeLessThan(2 * R[level] + 1);
      for (const c of cells) expect(Number.isInteger(c.q)).toBe(true);
      expect(new Set(cells.map((c) => `${c.q},${c.r}`)).size).toBe(cells.length);
      // A true honeycomb: neighbouring rows sit half a tile apart, never straight above one another.
      const xs = new Set(cells.map((c) => `${c.q + c.r / 2},${c.r}`));
      for (const c of cells) expect(xs.has(`${c.q + c.r / 2},${c.r + 1}`)).toBe(false);
      // Every row touches the next one (no split board).
      for (let k = 0; k + 1 < rows.length; k++) expect(Math.abs(rows[k] - rows[k + 1])).toBe(1);
    });
    it(`${level}: every deal clears by free pairs, and the matching kinds pair up`, () => {
      for (let seed = 1; seed <= 40; seed++) {
        const b: HexBoard = dealHex(rowCells(rows), new Rng(seed));
        expect(b.kinds.every((k) => k >= 0)).toBe(true);
        expect(b.order(b.kinds.map(() => true), new Rng(seed + 99))).not.toBeNull();
        expect(b.pairs(1).length).toBe(1);
      }
    });
  }
  it('Hex lays the wide honeycomb out sideways and the round one elsewhere', () => {
    const counts = (w: number, h: number, level: MiniLevel) => {
      screen(w, h);
      const run = startStub('hex', level);
      const zs = new Set([...run.board.tiles.values()].map((t) => t.pos.z.toFixed(3)));
      run.session.dispose?.();
      return { tiles: run.board.tiles.size, rows: zs.size };
    };
    expect(counts(844, 390, 'hard')).toEqual({ tiles: 90, rows: 7 });
    expect(counts(1024, 768, 'hard')).toEqual({ tiles: 90, rows: 11 });
    expect(counts(844, 390, 'medium')).toEqual({ tiles: 60, rows: 7 });
    expect(counts(844, 390, 'easy')).toEqual({ tiles: 36, rows: 7 });
  });
});

// ------------------------------------------------------------ a stub board and host for a game's start

interface STile {
  kind: number;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  scale: number;
}
class StubBoard {
  readonly w = 0.75;
  readonly h = 1;
  readonly d = 0.55;
  readonly root = new THREE.Group();
  fitExtra: THREE.Box3 | null = null;
  tiles = new Map<number, STile>();
  pulsingIds: number[] = [];
  build(specs: { id: number; kind: number; pos: THREE.Vector3; quat?: THREE.Quaternion }[]) {
    this.tiles.clear();
    for (const s of specs) this.tiles.set(s.id, { kind: s.kind, pos: s.pos.clone(), quat: (s.quat ?? new THREE.Quaternion()).clone(), scale: 1 });
  }
  place(id: number, p: { pos?: THREE.Vector3; quat?: THREE.Quaternion; scale?: number }) {
    const t = this.tiles.get(id)!;
    if (p.pos) t.pos.copy(p.pos);
    if (p.quat) t.quat.copy(p.quat);
    if (p.scale !== undefined) t.scale = p.scale;
  }
  looks() {}
  setLook() {}
  pulse() {}
  shake() {}
  hide() {}
  moveTo() {}
  remove() {}
  restore() {}
  revive() {}
  has(id: number) {
    return this.tiles.has(id);
  }
}

function startStub(id: string, level: MiniLevel): { board: StubBoard; session: MiniSession } {
  const board = new StubBoard();
  const camera = new BoardCamera();
  const host = {
    board,
    camera,
    fit: () => {},
    burst: () => {},
    rng: new Rng(7),
    seed: 7,
    level,
    options: {},
    daily: false,
    setStat: () => {},
    toast: () => {},
    sound: () => {},
    finish: () => {},
    used: () => {},
    refreshButtons: () => {},
  } as unknown as MiniHost;
  const def = miniGame(id)!;
  return { board, session: def.start(host) };
}

describe('Boss Challenge on sideways phones', () => {
  const BOSS_ID = 100000;
  const layout = (w: number, h: number) => {
    screen(w, h);
    const run = startStub('boss', 'hard');
    const boss = run.board.tiles.get(BOSS_ID)!;
    const wall = [...run.board.tiles.entries()].filter(([id]) => id !== BOSS_ID).map(([, t]) => t.pos);
    const fitExtra = run.board.fitExtra;
    run.session.dispose?.();
    return { boss, wall, fitExtra, count: wall.length };
  };
  it('the boss stands beside the wall, leaning back to face you; the wall keeps its tiles', () => {
    const { boss, wall, count } = layout(740, 360);
    expect(count).toBe(70);
    const maxX = Math.max(...wall.map((p) => p.x));
    const zs = wall.map((p) => p.z);
    // Right of the wall, level with its middle, not beyond it.
    expect(boss.pos.x - (0.75 * 2.6) / 2).toBeGreaterThan(maxX + 0.75 / 2);
    expect(boss.pos.z).toBeGreaterThan(Math.min(...zs));
    expect(boss.pos.z).toBeLessThan(Math.max(...zs));
    // Leaning back: its face turns up toward the camera.
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(boss.quat);
    expect(normal.y).toBeGreaterThan(0.5);
    expect(boss.scale).toBe(2.6);
  });
  it('elsewhere the boss stands upright beyond the wall, as before', () => {
    for (const [w, h] of [
      [390, 844],
      [1024, 768],
    ]) {
      const { boss, wall, count, fitExtra } = layout(w, h);
      expect(count).toBe(70);
      expect(boss.pos.x).toBeCloseTo(0);
      expect(boss.pos.z).toBeLessThan(Math.min(...wall.map((p) => p.z)));
      expect(new THREE.Vector3(0, 0, 1).applyQuaternion(boss.quat).z).toBeCloseTo(1);
      expect(fitExtra).not.toBeNull();
    }
  });
});

// ------------------------------------------------------------ the board camera's fit

describe('board camera fit', () => {
  // A stepped pyramid, as a layered Solitaire board: the bounding box puts the top layer's height
  // over the whole footprint, the points do not.
  const pyramid: THREE.Vector3[] = [];
  for (let layer = 0; layer < 4; layer++) {
    const half = 3 - layer * 0.7,
      y = layer * 0.3;
    for (const x of [-half, half]) for (const z of [-half * 0.7, half * 0.7]) for (const dy of [0, 0.3]) pyramid.push(new THREE.Vector3(x, y + dy, z));
  }
  const box = new THREE.Box3().setFromPoints(pyramid);
  const insets = { top: 8, bottom: 8, left: 172, right: 82 };

  it('fitting the board itself comes closer than fitting its bounding box', () => {
    const c = new BoardCamera();
    c.home = { yaw: 0, pitch: 84 };
    const cam = new THREE.PerspectiveCamera(38, 740 / 360, 0.1, 200);
    const corners: THREE.Vector3[] = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
    const byPoints = c.distanceFor(cam, box, insets, 740, 360, pyramid);
    const byBox = c.distanceFor(cam, box, insets, 740, 360, corners);
    expect(byPoints).toBeLessThan(byBox * 0.97);
  });

  it('the framed board fills the free area, clear of the HUD on every side', () => {
    for (const [W, H, ins, pitch] of [
      [740, 360, insets, 84],
      [390, 844, { top: 120, bottom: 90, left: 6, right: 6 }, 78],
      [1024, 768, { top: 70, bottom: 86, left: 10, right: 10 }, 66],
    ] as const) {
      const c = new BoardCamera();
      c.home = { yaw: 0, pitch };
      c.reset();
      c.insets = { ...ins };
      const cam = new THREE.PerspectiveCamera(38, W / H, 0.1, 200);
      c.frame(box, true, pyramid);
      for (let i = 0; i < 4; i++) c.apply(cam, 1 / 60, W, H);
      const px = pyramid.map((p) => {
        const v = p.clone().project(cam);
        return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H };
      });
      const x0 = Math.min(...px.map((p) => p.x)),
        x1 = Math.max(...px.map((p) => p.x)),
        y0 = Math.min(...px.map((p) => p.y)),
        y1 = Math.max(...px.map((p) => p.y));
      expect(x0).toBeGreaterThanOrEqual(ins.left - 0.5);
      expect(x1).toBeLessThanOrEqual(W - ins.right + 0.5);
      expect(y0).toBeGreaterThanOrEqual(ins.top - 0.5);
      expect(y1).toBeLessThanOrEqual(H - ins.bottom + 0.5);
      // One side or the other is nearly filled (the board is as large as the free area allows)...
      const fillX = (x1 - x0) / (W - ins.left - ins.right),
        fillY = (y1 - y0) / (H - ins.top - ins.bottom);
      expect(Math.max(fillX, fillY)).toBeGreaterThan(0.89);
      // ...and the picture is centred in it.
      expect(Math.abs((x0 + x1) / 2 - (ins.left + W - ins.right) / 2)).toBeLessThan(2);
      expect(Math.abs((y0 + y1) / 2 - (ins.top + H - ins.bottom) / 2)).toBeLessThan(2);
    }
  });
});
