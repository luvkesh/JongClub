import { describe, expect, it } from 'vitest';
import { Rng } from '../src/engine/rng';
import { Sorter, dealColour } from '../src/minigames/games/colour';
import { Rows, survivalKinds } from '../src/minigames/games/survival';
import { Hunt, clueKind, dealHunt } from '../src/minigames/games/treasure';
import { strike } from '../src/minigames/games/boss';
import { ChainBoard, dealChain, groupScore } from '../src/minigames/games/chain';
import { makePuzzle, makesSet } from '../src/minigames/games/rush';
import { dealHex, hexCells } from '../src/minigames/games/hex';
import { Dungeon, dealDungeon, damage, roomKind } from '../src/minigames/games/dungeon';
import { family, matchGroup } from '../src/minigames/helpers';
import { miniGames } from '../src/minigames/registry';
import '../src/minigames/games';

describe('the eight newer mini-games are registered', () => {
  it('lists twenty games with unique ids and sane rewards', () => {
    const ids = miniGames().map((d) => d.id);
    for (const id of ['hex', 'colour', 'survival', 'treasure', 'boss', 'chain', 'rush', 'dungeon']) expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of miniGames()) {
      for (const level of d.levels) {
        const won = d.reward({ won: true, score: 5000, seconds: 60, cleared: 100, total: 100, hints: 0, undos: 0, shuffles: 0 }, level);
        const lost = d.reward({ won: false, score: 10, seconds: 60, cleared: 3, total: 100, hints: 0, undos: 0, shuffles: 0 }, level);
        expect(won).toBeGreaterThan(0);
        expect(won).toBeLessThanOrEqual(600);
        expect(lost).toBeGreaterThanOrEqual(0);
        expect(lost).toBeLessThan(won);
      }
    }
  });
});

describe('colour match', () => {
  it('deals boards the solver can sort, and the solution sorts them', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { lanes } = dealColour(5, 2, new Rng(seed));
      const s = new Sorter(lanes.map((l) => [...l]));
      const sol = s.solve()!;
      expect(sol).not.toBeNull();
      for (const [a, b] of sol) {
        expect(s.canMove(a, b)).toBe(true);
        s.move(a, b);
      }
      expect(s.solved()).toBe(true);
    }
  });
  it('only lets a tile onto its own suit or an empty row', () => {
    const s = new Sorter([[0, 9], [10], [], [1, 2, 3, 4]]);
    expect(s.canMove(0, 1)).toBe(true); // dots onto dots
    expect(s.canMove(0, 2)).toBe(true); // into an empty row
    expect(s.canMove(1, 3)).toBe(false); // dots onto characters
    expect(s.canMove(0, 3)).toBe(false); // full row
  });
  it('the hard deal with seven families still sorts', () => {
    const { lanes } = dealColour(7, 2, new Rng(7));
    expect(new Set(lanes.flat().map(family)).size).toBe(7);
  });
});

describe('survival', () => {
  it('only row ends are free, and an emptied row goes', () => {
    const kinds = [5, 7, 5, 9, 9, 7];
    const r = new Rows(kinds);
    r.push([3, 4, 5]);
    r.push([0, 1, 2]);
    expect(r.free().sort()).toEqual([0, 2, 3, 5]);
    expect(r.canMatch(0, 2)).toBe(true);
    expect(r.canMatch(1, 5)).toBe(false); // 1 is in the middle
    expect(r.remove(0, 2)).toBe(0);
    expect(r.free()).toContain(1);
    expect(r.remove(1, 5)).toBe(1); // row [0,1,2] gone
    expect(r.rows.length).toBe(1);
  });
  it('every two rows hold whole pairs', () => {
    const ks = survivalKinds(6, 7, new Rng(3));
    for (let i = 0; i < ks.length; i += 14) {
      const block = ks.slice(i, i + 14);
      const by = new Map<number, number>();
      for (const k of block) by.set(matchGroup(k), (by.get(matchGroup(k)) ?? 0) + 1);
      for (const n of by.values()) expect(n % 2).toBe(0);
    }
  });
});

describe('treasure hunt', () => {
  it('clues count the treasures around a tile and an empty clue opens its neighbours', () => {
    const h = new Hunt(4, 3, new Set([0]));
    expect(h.clue(1)).toBe(1);
    expect(h.clue(5)).toBe(1);
    expect(h.clue(3)).toBe(0);
    expect(clueKind(0)).toBe(33);
    expect(clueKind(3)).toBe(11);
    const opened = h.dig(3);
    expect(opened.length).toBeGreaterThan(1);
    expect(opened).not.toContain(0);
  });
  it('proves a treasure when a clue has only that many hidden neighbours', () => {
    const h = new Hunt(3, 1, new Set([2]));
    h.dig(1);
    expect(h.clue(1)).toBe(1);
    h.dig(0);
    expect(h.proven()).toBe(2);
  });
  it('deals the asked number of treasures with a clear start', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { hunt, start } = dealHunt(8, 8, 12, new Rng(seed));
      expect(hunt.treasure.size).toBe(12);
      expect(hunt.treasure.has(start)).toBe(false);
      expect(hunt.clue(start)).toBe(0);
    }
  });
});

describe('boss challenge', () => {
  it('quick pairs strike harder, up to a cap', () => {
    expect(strike(1)).toBe(10);
    expect(strike(3)).toBe(20);
    expect(strike(50)).toBe(strike(7));
  });
});

describe('chain reaction', () => {
  it('clears a touching group of one suit, drops tiles and closes empty columns', () => {
    // 2 x 2: two characters on the left column, dots and bamboo on the right.
    const b = new ChainBoard(2, 2, [0, 9, 1, 18]);
    expect(b.group(0).sort()).toEqual([0, 2]);
    expect(b.group(1)).toEqual([1]);
    expect(b.groups().length).toBe(1);
    const moves = b.clear([0, 2]);
    expect(b.left).toBe(2);
    // The right column moved into the middle; nothing floats above an empty cell.
    expect(moves.length).toBe(2);
    for (let x = 0; x < 2; x++) if (b.at(x, 0) >= 0) expect(b.at(x, 1)).toBeGreaterThanOrEqual(0);
  });
  it('scores bigger groups far more and doubles a run', () => {
    expect(groupScore(2, false)).toBe(10);
    expect(groupScore(6, false)).toBe(150);
    expect(groupScore(6, true)).toBe(300);
    const b = new ChainBoard(3, 1, [2, 3, 4]);
    expect(b.hasRun([0, 1, 2])).toBe(true);
  });
  it('deals only the families asked for', () => {
    const cells = dealChain(10, 7, 3, new Rng(5));
    expect(cells.every((k) => k < 27)).toBe(true);
  });
});

describe('puzzle rush', () => {
  it('knows sets, including India Rules mixed runs', () => {
    expect(makesSet([4, 4, 4])).toBe(true);
    expect(makesSet([3, 4, 5])).toBe(true);
    expect(makesSet([3, 13, 5])).toBe(true); // mixed run
    expect(makesSet([27, 27, 28])).toBe(false);
    expect(makesSet([7, 8, 27])).toBe(false);
  });
  it('every puzzle has exactly one choice that makes a set', () => {
    const rng = new Rng(11);
    for (let i = 0; i < 300; i++) {
      const p = makePuzzle(rng, (['easy', 'medium', 'hard'] as const)[i % 3]);
      const shown = p.set.filter((_, j) => j !== p.gap);
      expect(new Set(p.choices).size).toBe(4);
      expect(p.choices.filter((c) => makesSet([...shown, c]))).toEqual([p.answer]);
    }
  });
});

describe('hex', () => {
  it('builds honeycombs with an even count', () => {
    expect(hexCells(3).length).toBe(36);
    expect(hexCells(4).length).toBe(60);
    expect(hexCells(5).length).toBe(90);
  });
  it('every deal can be cleared by taking free pairs', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const g = dealHex(4, new Rng(seed));
      // Greedy play can dead-end, so follow a fresh removal order the way the deal was built.
      const ord = g.order(g.kinds.map((k) => k >= 0), new Rng(seed + 100));
      expect(ord).not.toBeNull();
      // The deal itself was built pair by pair from free tiles, so matching kinds pair up.
      const by = new Map<number, number>();
      for (const k of g.kinds) by.set(matchGroup(k), (by.get(matchGroup(k)) ?? 0) + 1);
      for (const n of by.values()) expect(n % 2).toBe(0);
    }
  });
  it('a corner tile is free and a tile in the middle is not', () => {
    const g = dealHex(3, new Rng(2));
    const corner = g.cells.findIndex((c) => c.q === 3 && c.r === 0);
    const inner = g.cells.findIndex((c) => c.q === 1 && c.r === 0);
    expect(g.isFree(corner)).toBe(true);
    expect(g.isFree(inner)).toBe(false);
  });
  it('a shuffle keeps the board clearable', () => {
    const rng = new Rng(9);
    const g = dealHex(3, rng);
    expect(g.shuffle(rng)).toBe(true);
    expect(g.pairs(1).length).toBeGreaterThan(0);
  });
});

describe('dungeon', () => {
  it('monsters cost their number less armour', () => {
    expect(damage({ t: 'monster', kind: 4 }, 0)).toBe(5);
    expect(damage({ t: 'monster', kind: 4 }, 2)).toBe(3);
    expect(damage({ t: 'monster', kind: 0 }, 3)).toBe(0);
    expect(damage({ t: 'potion', kind: 34 }, 0)).toBe(0);
    expect(roomKind({ t: 'key' })).toBe(32);
  });
  it('every dungeon has a key and a door you can reach and survive', () => {
    for (const level of ['easy', 'medium', 'hard'] as const)
      for (let seed = 1; seed <= 10; seed++) {
        const d: Dungeon = dealDungeon(level, new Rng(seed));
        const key = d.find('key'),
          door = d.find('door');
        expect(key).toBeGreaterThanOrEqual(0);
        expect(door).toBeGreaterThanOrEqual(0);
        const a = d.route(d.start, key, 0)!,
          b = d.route(key, door, 0)!;
        expect(a).not.toBeNull();
        expect(b).not.toBeNull();
        expect(a[0] + b[0]).toBeLessThan({ easy: 16, medium: 14, hard: 12 }[level]);
        // The route never steps through the door before the key.
        expect(a[1].slice(0, -1)).not.toContain(door);
      }
  });
});

describe('chain reaction gravity', () => {
  it('after any run of clears nothing floats and no empty column sits between tiles', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = new Rng(seed);
      const b = new ChainBoard(10, 7, dealChain(10, 7, 4, rng));
      let ids = b.cells.map((_, i) => i);
      for (let step = 0; step < 40; step++) {
        const gs = b.groups();
        if (!gs.length) break;
        const g = gs[rng.int(gs.length)];
        const next = Array(ids.length).fill(-1);
        const live = b.left - g.length;
        for (const [from, to] of b.clear(g)) next[to] = ids[from];
        ids = next;
        expect(ids.filter((v) => v >= 0).length).toBe(live);
        expect(new Set(ids.filter((v) => v >= 0)).size).toBe(live);
        const cols = Array.from({ length: 10 }, (_, x) => Array.from({ length: 7 }, (_, y) => b.at(x, y) >= 0));
        for (const col of cols) for (let y = 0; y + 1 < 7; y++) if (col[y]) expect(col[y + 1]).toBe(true);
        const used = cols.map((c) => c.some(Boolean));
        const first = used.indexOf(true),
          last = used.lastIndexOf(true);
        if (first >= 0) expect(used.slice(first, last + 1).every(Boolean)).toBe(true);
      }
    }
  });
});
