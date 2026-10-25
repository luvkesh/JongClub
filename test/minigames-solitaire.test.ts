import { describe, expect, it } from 'vitest';
import { LAYOUTS, TOWER_LAYOUTS } from '../src/minigames/games/solitaire/layouts';
import { Solitaire, deal, layoutProblems } from '../src/minigames/games/solitaire/logic';
import { Rng } from '../src/engine/rng';
import { fullSet, matchGroup } from '../src/minigames/helpers';

/** Play a board out greedily with random pair choice; true if it clears. */
function playOut(g: Solitaire, rng: Rng, shuffles = 0) {
  for (let guard = 0; guard < 400 && g.left; guard++) {
    const p = g.pairs();
    if (!p.length) {
      if (shuffles-- <= 0 || !g.shuffle(rng)) return false;
      continue;
    }
    const [a, b] = p[rng.int(p.length)];
    g.remove(a, b);
  }
  return g.left === 0;
}

describe('solitaire layouts', () => {
  for (const l of [...LAYOUTS, ...TOWER_LAYOUTS]) {
    it(`${l.name} is valid (${l.slots.length} tiles)`, () => {
      expect(layoutProblems(l.slots)).toEqual([]);
      expect(l.slots.length).toBeLessThanOrEqual(144);
    });
  }
  it('the Turtle has the classic 144 tiles', () => {
    expect(LAYOUTS.find((l) => l.id === 'turtle')!.slots.length).toBe(144);
  });
});

describe('solitaire deals', () => {
  it('a full deal uses the whole set once', () => {
    const d = deal(LAYOUTS[0].slots, new Rng(7));
    expect([...d.kinds].sort((a, b) => a - b)).toEqual(fullSet().sort((a, b) => a - b));
  });
  it('every deal is solvable (the deal order is a solution)', () => {
    for (const l of [...LAYOUTS, ...TOWER_LAYOUTS])
      for (let seed = 1; seed <= 6; seed++) {
        const d = deal(l.slots, new Rng(seed * 31 + l.slots.length));
        const g = new Solitaire(l.slots, d.kinds);
        for (const [a, b] of d.solution) expect(g.remove(a, b)).toBe(true);
        expect(g.left).toBe(0);
      }
  });
  it('random play with shuffles usually clears a board', () => {
    let won = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const l = LAYOUTS[seed % LAYOUTS.length];
      const g = new Solitaire(l.slots, deal(l.slots, new Rng(seed)).kinds);
      if (playOut(g, new Rng(seed + 100), 30)) won++;
    }
    expect(won).toBeGreaterThanOrEqual(12);
  });
  it('flowers match flowers and seasons match seasons', () => {
    expect(matchGroup(34)).toBe(matchGroup(37));
    expect(matchGroup(38)).toBe(matchGroup(41));
    expect(matchGroup(34)).not.toBe(matchGroup(38));
  });
  it('undo puts a pair back and a shuffle keeps a solvable board', () => {
    const l = LAYOUTS[0];
    const g = new Solitaire(l.slots, deal(l.slots, new Rng(3)).kinds);
    const [a, b] = g.pairs()[0];
    expect(g.remove(a, b)).toBe(true);
    expect(g.left).toBe(142);
    g.undo();
    expect(g.left).toBe(144);
    expect(g.shuffle(new Rng(9))).toBe(true);
    expect(g.pairs().length).toBeGreaterThan(0);
  });
});
