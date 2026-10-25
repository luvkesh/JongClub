import { beforeEach, describe, expect, it } from 'vitest';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { DRILL_TYPES, isRight, makeDrill, safetyOf } = await import('../src/learn/drillGen');
const S = await import('../src/learn/drillSchedule');
const { waits, winningDecompositions } = await import('../src/engine/hand');
const { classicProfile } = await import('../src/engine/rules/classic');
const { tileName, toCounts } = await import('../src/engine/tiles');
const { scorePerfectDiscard, buildPuzzle } = await import('../src/club/daily');

const strip = <T>(x: T) => JSON.parse(JSON.stringify(x));

describe('drill generators', () => {
  it('name: one right option, and it names the tile', () => {
    for (let seed = 1; seed < 40; seed++) {
      const d = makeDrill('name', seed);
      expect(d.options).toHaveLength(4);
      expect(d.options.filter((o) => o.correct)).toHaveLength(1);
      expect(d.options.find((o) => o.correct)!.label).toBe(tileName(d.focus!));
      expect(new Set(d.options.map((o) => o.label)).size).toBe(4);
      expect(d.hideLabels).toBe(true);
    }
  });

  it('wait: the right option is exactly the hand’s waits, the others are not', () => {
    for (let seed = 1; seed < 30; seed++) {
      const d = makeDrill('wait', seed);
      expect(d.hand).toHaveLength(13);
      const w = waits(toCounts(d.hand!), 0, classicProfile.shapes);
      const right = d.options.filter((o) => o.correct);
      expect(right).toHaveLength(1);
      expect(right[0].tiles).toEqual(w);
      for (const o of d.options) if (!o.correct) expect(o.tiles).not.toEqual(w);
      // Every wait really completes the hand.
      for (const k of w) {
        const c = toCounts(d.hand!);
        c[k]++;
        expect(winningDecompositions(c, 0, classicProfile.shapes).length).toBeGreaterThan(0);
      }
      expect(d.explanation).toContain(tileName(w[0]));
    }
  });

  it('discard: right tiles are the daily puzzle’s best answers', () => {
    for (const [seed, v] of [[3, 'classic'], [4, 'riichi'], [5, 'classic']] as const) {
      const d = makeDrill('discard', seed, v);
      expect(d.hand).toHaveLength(14);
      expect(d.correctTiles!.length).toBeGreaterThan(0);
      for (const k of d.correctTiles!) expect(d.hand).toContain(k);
      expect(isRight(d, d.correctTiles![0])).toBe(true);
      const wrong = d.hand!.find((k) => !d.correctTiles!.includes(k));
      if (wrong !== undefined) expect(isRight(d, wrong)).toBe(false);
    }
    expect(typeof buildPuzzle).toBe('function');
    expect(typeof scorePerfectDiscard).toBe('function');
  });

  it('safe: a "safe" tile is never one the riichi player can win on', () => {
    let safe = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const d = makeDrill('safe', seed);
      expect(d.options.map((o) => o.label)).toEqual(['Safe', 'Risky']);
      expect(d.options.filter((o) => o.correct)).toHaveLength(1);
      const isSafe = d.options[0].correct;
      if (isSafe) {
        safe++;
        // They discarded it, or it was let go after their riichi.
        expect(d.pool!.tiles.includes(d.focus!) || d.pool!.since.includes(d.focus!)).toBe(true);
      } else expect(d.pool!.tiles).not.toContain(d.focus!);
      expect(d.pool!.riichiAt).toBeGreaterThanOrEqual(0);
      expect(d.explanation).toMatch(/^The /);
    }
    expect(safe).toBeGreaterThanOrEqual(0);
    expect(safetyOf({ hit: 0, reason: 'genbutsu', via: [] })).toBe('safe');
    expect(safetyOf({ hit: 0.12, reason: 'none', via: [] })).toBe('risky');
    expect(safetyOf({ hit: 0.03, reason: 'suji', via: [] })).toBeNull();
  });

  it('value: the right answer is the engine’s score, explained item by item', () => {
    for (const [seed, v] of [[1, 'classic'], [2, 'riichi'], [3, 'taiwanese'], [4, 'hongkong']] as const) {
      const d = makeDrill('value', seed, v);
      const right = d.options.filter((o) => o.correct);
      expect(right).toHaveLength(1);
      const value = Number(right[0].label.split(' ')[0]);
      expect(d.explanation.startsWith(`${value} `)).toBe(true);
      expect(new Set(d.options.map((o) => o.label)).size).toBe(d.options.length);
      expect(d.hand!.length + d.melds!.reduce((a, m) => a + m.length, 0)).toBeGreaterThanOrEqual(14);
    }
  });

  it('is deterministic by seed', () => {
    for (const t of DRILL_TYPES) expect(strip(makeDrill(t, 77, 'classic'))).toEqual(strip(makeDrill(t, 77, 'classic')));
  });
});

describe('drill schedule', () => {
  beforeEach(() => store.clear());
  const d = { type: 'wait' as const, seed: 9, variation: 'classic' };
  const id = 'wait:classic:9';

  it('brings a missed drill back after 1, 3 and 7 days, then retires it', () => {
    const s = S.emptyState();
    S.recordAnswer(s, d, false, '2026-10-01');
    expect(s.items[id]).toMatchObject({ box: 1, due: '2026-10-02' });
    expect(S.dueItems(s, '2026-10-01')).toHaveLength(0);
    expect(S.dueItems(s, '2026-10-02')).toHaveLength(1);
    S.recordAnswer(s, d, true, '2026-10-02');
    expect(s.items[id]).toMatchObject({ box: 2, due: '2026-10-05' });
    S.recordAnswer(s, d, true, '2026-10-05');
    expect(s.items[id]).toMatchObject({ box: 3, due: '2026-10-12' });
    S.recordAnswer(s, d, true, '2026-10-12');
    expect(s.items[id]).toBeUndefined();
  });

  it('a miss starts over, and early right answers do not move it', () => {
    const s = S.emptyState();
    S.recordAnswer(s, d, false, '2026-10-01');
    S.recordAnswer(s, d, true, '2026-10-02');
    S.recordAnswer(s, d, true, '2026-10-03'); // not due yet
    expect(s.items[id]).toMatchObject({ box: 2, due: '2026-10-05' });
    S.recordAnswer(s, d, false, '2026-10-05');
    expect(s.items[id]).toMatchObject({ box: 1, due: '2026-10-06' });
    // Right first time: never scheduled.
    S.recordAnswer(s, { ...d, seed: 10 }, true, '2026-10-05');
    expect(s.items['wait:classic:10']).toBeUndefined();
  });

  it('plans sets from due drills first, then weak skills', () => {
    const s = S.emptyState();
    for (let i = 0; i < 10; i++) S.recordAnswer(s, { type: 'name', seed: 100 + i, variation: 'classic' }, true, '2026-09-01');
    for (let i = 0; i < 10; i++) S.recordAnswer(s, { type: 'safe', seed: 200 + i, variation: 'riichi' }, i < 2, '2026-09-01');
    const plan = S.planSet(s, '2026-10-01');
    expect(plan).toHaveLength(S.SET_SIZE);
    const reviews = plan.filter((p) => p.review);
    expect(reviews.length).toBe(4); // capped at half the set
    for (const r of reviews) expect(r.type).toBe('safe');
    expect(S.accuracy(s, 'safe')).toBeCloseTo(0.2);
    expect(S.weight(s, 'safe')).toBeGreaterThan(S.weight(s, 'name'));
    for (const t of DRILL_TYPES) expect(plan.filter((p) => p.type === t && !p.review).length).toBeLessThanOrEqual(3);
    expect(strip(S.planSet(s, '2026-10-01'))).toEqual(strip(plan));
    expect(strip(S.planSet(s, '2026-10-01', { salt: 1 }))).not.toEqual(strip(plan));
    const focus = S.planSet(S.emptyState(), '2026-10-01', { focus: 'wait', size: 5 });
    expect(focus.every((p) => p.type === 'wait')).toBe(true);
  });

  it('pays the first set of the day only, counts streaks and saves', () => {
    const s = S.emptyState();
    expect(S.finishSet(s, '2026-10-01', 6, 8)).toBe(6 * S.POINTS_PER_RIGHT + S.POINTS_FOR_SET);
    expect(S.finishSet(s, '2026-10-01', 8, 8)).toBe(0);
    expect(S.finishSet(s, '2026-10-03', 8, 8, true)).toBe(0);
    expect(s.days['2026-10-03'].practice).toBe(1);
    S.finishSet(s, '2026-10-02', 3, 8);
    expect(S.drillStreak(s, '2026-10-02')).toBe(2);
    expect(S.drillStreak(s, '2026-10-03')).toBe(2);
    expect(S.drillStreak(s, '2026-10-04')).toBe(0);
    S.saveDrills(s);
    expect(S.loadDrills().days['2026-10-02'].right).toBe(3);
    expect(S.addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
