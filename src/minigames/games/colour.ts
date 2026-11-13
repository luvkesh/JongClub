// Mahjong Colour Match: rows of mixed tiles lie in wooden lanes on your table.
// Move the front tile of a lane onto an empty lane or onto a tile of the same
// suit, until every full lane holds one suit (Characters, Dots, Bamboo, Winds,
// Dragons, Flowers, Seasons). Deals are checked by a solver, so every board
// can be sorted; the solver also gives hints.

import * as THREE from 'three';
import { tr } from '../../i18n';
import { registerMiniGame } from '../registry';
import { FLAT } from '../board';
import { FAMILY_KINDS, GameClock, UndoStack, family, woodMaterial } from '../helpers';
import type { Rng } from '../../engine/rng';
import type { MiniHost, MiniLevel, MiniSession } from '../types';

const CAP = 4;
/** Suits in play and spare lanes per level. */
const SETUP: Record<MiniLevel, { fams: number; spare: number }> = {
  easy: { fams: 4, spare: 2 },
  medium: { fams: 5, spare: 2 },
  hard: { fams: 7, spare: 2 },
};
const PAY: Record<MiniLevel, number> = { easy: 1, medium: 1.5, hard: 2.2 };
/** Families used per level, in order: the three suits first, then honours and bonus tiles. */
const FAMILY_ORDER = [0, 1, 2, 3, 5, 6, 4];

/** Pure rules (tests use this): lanes of tile kinds, front tile last. */
export class Sorter {
  constructor(
    public lanes: number[][],
    readonly cap = CAP,
  ) {}
  top(l: number) {
    const lane = this.lanes[l];
    return lane.length ? lane[lane.length - 1] : -1;
  }
  canMove(a: number, b: number) {
    if (a === b) return false;
    const from = this.lanes[a],
      to = this.lanes[b];
    if (!from.length || to.length >= this.cap) return false;
    return !to.length || family(to[to.length - 1]) === family(from[from.length - 1]);
  }
  move(a: number, b: number) {
    this.lanes[b].push(this.lanes[a].pop()!);
  }
  /** Each lane is empty or full of one suit. */
  solved() {
    return this.lanes.every((l) => !l.length || (l.length === this.cap && l.every((k) => family(k) === family(l[0]))));
  }
  /** One lane: the suit runs from the front, and whether the lane is all one suit. */
  private pure(l: number) {
    const lane = this.lanes[l];
    return lane.length > 0 && lane.every((k) => family(k) === family(lane[0]));
  }
  /** Moves worth trying (pointless ones left out), the most useful first. */
  moves(): [number, number][] {
    const out: [number, number][] = [];
    const empties: [number, number][] = [];
    let firstEmpty = -1;
    this.lanes.forEach((l, i) => !l.length && firstEmpty < 0 && (firstEmpty = i));
    for (let a = 0; a < this.lanes.length; a++)
      for (let b = 0; b < this.lanes.length; b++) {
        if (!this.canMove(a, b)) continue;
        if (!this.lanes[b].length) {
          // Lanes are alike when empty: only try the first. A one-suit lane gains nothing by moving.
          if (b !== firstEmpty || this.pure(a)) continue;
          empties.push([a, b]);
        } else out.push([a, b]);
      }
    // Onto a lane that is all one suit first: that builds a finished lane.
    out.sort((x, y) => Number(this.pure(y[1])) - Number(this.pure(x[1])));
    return [...out, ...empties];
  }
  private key() {
    return this.lanes
      .map((l) => l.map((k) => family(k).toString(36)).join(''))
      .sort()
      .join('|');
  }
  /** A list of moves that sorts the board, or null (none found within `limit` positions). */
  solve(limit = 60000): [number, number][] | null {
    const seen = new Set<string>();
    const path: [number, number][] = [];
    let budget = limit;
    const dfs = (): boolean => {
      if (this.solved()) return true;
      if (--budget <= 0) return false;
      const k = this.key();
      if (seen.has(k)) return false;
      seen.add(k);
      for (const [a, b] of this.moves()) {
        this.move(a, b);
        path.push([a, b]);
        if (dfs()) {
          this.move(b, a);
          return true;
        }
        path.pop();
        this.move(b, a);
      }
      return false;
    };
    // The search moves tiles and puts them back; restore from a copy all the same.
    const saved = this.lanes.map((l) => [...l]);
    const ok = dfs();
    this.lanes = saved;
    return ok ? path : null;
  }
}

/** A sortable deal: `fams` suits of CAP tiles each, mixed through the lanes, with `spare` empty lanes. */
export function dealColour(fams: number, spare: number, rng: Rng): { lanes: number[][]; par: number } {
  for (let tries = 0; tries < 200; tries++) {
    const tiles: number[] = [];
    for (const f of FAMILY_ORDER.slice(0, fams)) tiles.push(...rng.shuffle([...FAMILY_KINDS[f]]).slice(0, CAP).concat(FAMILY_KINDS[f]).slice(0, CAP));
    rng.shuffle(tiles);
    const lanes: number[][] = [];
    for (let i = 0; i < fams; i++) lanes.push(tiles.slice(i * CAP, i * CAP + CAP));
    for (let i = 0; i < spare; i++) lanes.push([]);
    const s = new Sorter(lanes);
    // A lane that starts already sorted is too easy.
    if (lanes.some((l) => l.length && l.every((k) => family(k) === family(l[0])))) continue;
    const sol = s.solve(120000);
    if (sol) return { lanes, par: sol.length };
  }
  throw new Error('no sortable deal');
}

class ColourSession implements MiniSession {
  private g: Sorter;
  /** Tile ids in each lane, front tile last (parallel to g.lanes). */
  private ids: number[][];
  private sel: number | null = null;
  private moves = 0;
  private par: number;
  private clock = new GameClock();
  private undos = new UndoStack<[number, number]>();
  private ended = false;
  private hintIds: number[] = [];
  private trays = new THREE.Group();
  private trayMat = woodMaterial();
  private trayGeo: THREE.BufferGeometry;
  private total: number;
  /** Portrait phones lay the lanes out as rows, so the tiles can be twice the size. */
  private rows = typeof window !== 'undefined' && window.innerWidth / Math.max(1, window.innerHeight) < 0.85;

  constructor(private host: MiniHost) {
    const st = SETUP[host.level];
    const d = dealColour(st.fams, st.spare, host.rng);
    this.g = new Sorter(d.lanes);
    this.par = d.par;
    let id = 0;
    this.ids = d.lanes.map((l) => l.map(() => id++));
    this.total = id;
    const b = host.board;
    this.trayGeo = this.rows ? new THREE.BoxGeometry(CAP * (b.w + 0.03) + 0.1, 0.02, b.h + 0.1) : new THREE.BoxGeometry(b.w + 0.1, 0.02, CAP * (b.h + 0.03) + 0.1);
    this.g.lanes.forEach((_, l) => {
      const m = new THREE.Mesh(this.trayGeo, this.trayMat);
      m.position.copy(this.slot(l, (CAP - 1) / 2)).setY(0.01);
      m.receiveShadow = true;
      this.trays.add(m);
    });
    b.root.add(this.trays);
    host.camera.home = { yaw: 0, pitch: 70 };
    host.camera.reset();
    b.build(this.g.lanes.flatMap((lane, l) => lane.map((kind, s) => ({ id: this.ids[l][s], kind, pos: this.slot(l, s), quat: FLAT }))));
    // Frame the trays (empty lanes included) with a small margin.
    const half = new THREE.Vector3(b.w / 2 + 0.1, 0.2, b.h / 2 + 0.1);
    b.fitExtra = new THREE.Box3(this.slot(0, 0).sub(half), this.slot(this.g.lanes.length - 1, CAP - 1).add(half));
    host.fit(true);
    this.refresh();
  }

  /** Lane `l`, slot `s` (0 at the back, the front tile nearest you). */
  private slot(l: number, s: number) {
    const b = this.host.board;
    const n = this.g.lanes.length;
    if (this.rows) return new THREE.Vector3((s - (CAP - 1) / 2) * (b.w + 0.03), b.d / 2 + 0.02, (l - (n - 1) / 2) * (b.h + 0.2));
    return new THREE.Vector3((l - (n - 1) / 2) * (b.w + 0.2), b.d / 2 + 0.02, (s - (CAP - 1) / 2) * (b.h + 0.03));
  }

  private laneOf(id: number) {
    return this.ids.findIndex((l) => l.includes(id));
  }

  private refresh() {
    const sorted = this.g.lanes.filter((l) => l.length === CAP && l.every((k) => family(k) === family(l[0]))).length;
    this.host.board.looks((id) => {
      const l = this.laneOf(id);
      const lane = this.ids[l];
      if (this.hintIds.includes(id)) return 'hint';
      if (l === this.sel && lane[lane.length - 1] === id) return 'selected';
      const g = this.g.lanes[l];
      if (g.length === CAP && g.every((k) => family(k) === family(g[0]))) return 'free';
      return 'normal';
    });
    this.host.setStat('left', `${sorted} / ${new Set(this.g.lanes.flat().map(family)).size}`, tr('Rows sorted'));
    this.host.setStat('moves', String(this.moves), tr('Moves'));
    this.host.refreshButtons();
  }

  onPick(id: number) {
    const l = this.laneOf(id);
    if (l >= 0) this.lane(l);
  }

  onEmptyTap(x: number, y: number, camera: THREE.Camera, canvas: HTMLElement) {
    const p = this.host.board.feltPoint(x, y, camera, canvas);
    if (!p) return;
    const b = this.host.board;
    for (let l = 0; l < this.g.lanes.length; l++) {
      const c = this.slot(l, (CAP - 1) / 2);
      const hit = this.rows ? Math.abs(p.z - c.z) < b.h * 0.65 && Math.abs(p.x - c.x) < (CAP * (b.w + 0.03)) / 2 + 0.15 : Math.abs(p.x - c.x) < b.w * 0.75 && Math.abs(p.z - c.z) < (CAP * (b.h + 0.03)) / 2 + 0.15;
      if (hit) return this.lane(l);
    }
  }

  /** A tap on lane `l`: pick up its front tile, or put the held one down there. */
  private lane(l: number) {
    if (this.ended) return;
    this.hintIds = [];
    if (this.sel === null || this.sel === l) {
      this.sel = this.sel === l || !this.g.lanes[l].length ? null : l;
      this.host.sound('click');
      return this.refresh();
    }
    const a = this.sel;
    if (!this.g.canMove(a, l)) {
      if (this.g.lanes[l].length >= CAP) this.host.toast(tr('That row is full.'), 'bad');
      else this.host.toast(tr('Only a tile of the same suit can go on top.'), 'bad');
      this.sel = this.g.lanes[l].length ? l : null;
      this.host.sound('click');
      return this.refresh();
    }
    this.sel = null;
    // Following the plan keeps it; any other move needs a new one.
    if (this.plan?.[0][0] === a && this.plan[0][1] === l) this.plan.shift();
    else this.plan = null;
    this.doMove(a, l);
    this.undos.push([a, l]);
    this.moves++;
    this.refresh();
    if (this.g.solved()) window.setTimeout(() => this.win(), 500);
  }

  private doMove(a: number, b: number, back = false) {
    const id = this.ids[a].pop()!;
    this.g.move(a, b);
    this.ids[b].push(id);
    const to = this.slot(b, this.ids[b].length - 1);
    this.host.board.moveTo(id, { pos: to }, { dur: back ? 0.22 : 0.3, arc: 0.25 });
    this.host.sound('discard');
    const lane = this.g.lanes[b];
    if (!back && lane.length === CAP && lane.every((k) => family(k) === family(lane[0]))) {
      window.setTimeout(() => this.host.burst(to.clone().setY(0.3)), 280);
      this.host.sound('pung');
    }
  }

  canUndo() {
    return !this.ended && this.undos.size > 0;
  }
  undo() {
    const m = this.undos.pop();
    if (!m || this.ended) return false;
    this.doMove(m[1], m[0], true);
    this.plan = null;
    this.sel = null;
    this.hintIds = [];
    this.refresh();
    return true;
  }

  /**
   * The solution the hints follow. The solver's search is not shortest-first, so solving afresh after
   * every hinted move can undo the last one and send a player who follows the hints round in circles:
   * hints keep to one solution until the player leaves it.
   */
  private plan: [number, number][] | null = null;

  /** The next move of a solution from here, as tile ids (the tile to move and where it lands). */
  private nextMove(): number[] | null {
    if (!this.plan?.length) {
      const s = new Sorter(this.g.lanes.map((l) => [...l]));
      this.plan = s.solve(40000);
    }
    if (!this.plan?.length) {
      this.plan = null;
      return null;
    }
    const [a, b] = this.plan[0];
    const top = (l: number) => this.ids[l][this.ids[l].length - 1];
    return this.ids[b].length ? [top(a), top(b)] : [top(a)];
  }
  suggest(): number[] | null {
    // Sorted, with the win on its way: nothing to suggest.
    if (this.ended || this.sel !== null || this.g.solved()) return [];
    // Sorting has no shuffle: when no solution is found, say nothing rather than nudge one.
    return this.nextMove() ?? [];
  }
  hint() {
    // In the moment before the win shows the rows are sorted: no "no way to sort" then.
    if (this.ended || this.g.solved()) return false;
    const m = this.nextMove();
    if (!m) {
      this.host.toast(tr('No way to sort from here. Undo a few moves.'), 'bad');
      return false;
    }
    this.hintIds = m;
    this.refresh();
    window.setTimeout(() => {
      this.hintIds = [];
      if (!this.ended) this.refresh();
    }, 2400);
    return true;
  }
  canUse(tool: 'hint' | 'shuffle') {
    return !this.ended && tool === 'hint' && !this.g.solved();
  }

  tick(dt: number) {
    if (this.ended) return;
    this.clock.tick(dt);
    this.host.setStat('time', this.clock.text(), tr('Time'));
  }
  pause(p: boolean) {
    this.clock.paused = p;
  }
  private win() {
    // An undo (or another move) in the moment before the win can unsort a row again.
    if (this.ended || !this.g.solved()) return;
    this.ended = true;
    const spare = Math.max(0, this.par - this.moves);
    const score = Math.max(100, 600 + spare * 25 - Math.max(0, this.moves - this.par) * 12 - Math.round(this.clock.elapsed));
    this.host.finish({ won: true, score, seconds: this.clock.elapsed, cleared: this.total, total: this.total, headline: tr('Every row sorted'), tally: { label: tr('Moves'), text: String(this.moves) }, notes: [tr('{n} moves (the solver found {p})', { n: this.moves, p: this.par })] });
  }
  dispose() {
    this.ended = true;
    this.trays.removeFromParent();
    this.trayGeo.dispose();
    this.trayMat.dispose();
    this.host.board.fitExtra = null;
  }
}

registerMiniGame({
  id: 'colour',
  title: tr('Mahjong Colour Match'),
  blurb: tr('Sort mixed rows of tiles until every row holds a single suit.'),
  minutes: tr('2–5 min'),
  order: 80,
  icon: { kinds: [2, 12, 20, 28, 36, 5], shape: 'lanes' },
  levels: ['easy', 'medium', 'hard'],
  howTo: [
    tr('Tap a row to pick up its front tile, then tap another row to put it there.'),
    tr('A tile can go into an empty row, or onto a tile of the same suit: Characters, Dots, Bamboo, Winds, Dragons, Flowers or Seasons.'),
    tr('Each row holds four tiles. Finish when every full row holds one suit.'),
  ],
  tools: { hint: true, undo: true },
  daily: true,
  // Hints are unlimited: a win still pays something (never below zero), however many it took.
  reward: (r, level) => (r.won ? Math.max(Math.round(10 * PAY[level]), Math.round(Math.min(200, 50 + r.total * 3 + r.score * 0.05) * PAY[level] - r.hints * 5)) : 0),
  start: (host) => new ColourSession(host),
});
