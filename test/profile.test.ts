import { beforeEach, describe, expect, it } from 'vitest';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { loadProfile, forfeitRanked, applyMatch } = await import('../src/progression/profile');

const KEY = 'jongclub.profile.v1';

describe('profile', () => {
  beforeEach(() => store.clear());

  it('fills new fields into an old save', () => {
    store.set(KEY, JSON.stringify({ name: 'Old', jongPoints: 500, loadout: { tileSet: 'jade' } }));
    const p = loadProfile();
    expect(p.name).toBe('Old');
    expect(p.loadout.tileSet).toBe('jade');
    expect(p.loadout.winAnimation).toBeTruthy();
    expect(Array.isArray(p.owned)).toBe(true);
    expect(p.avatar.skin).toBeTypeOf('number');
  });

  it('survives junk in storage', () => {
    store.set(KEY, 'null');
    expect(loadProfile().jongPoints).toBeGreaterThanOrEqual(0);
    store.set(KEY, '[1,2]');
    expect(loadProfile().ratings).toBeTypeOf('object');
  });

  it('repairs corrupted or partial fields from older saves', () => {
    store.set(
      KEY,
      JSON.stringify({
        xp: '100',
        rating: null,
        games: 'many',
        streak: -3,
        loadout: 'jade',
        avatar: [1, 2],
        varStats: { classic: { games: 3, wins: 1 }, riichi: 'junk' },
        ratings: { classic: 'high', riichi: 1234 },
        bestHand: 'big',
        name: 42,
      }),
    );
    const p = loadProfile();
    expect(p.xp).toBe(100);
    expect(p.rating).toBe(1000);
    expect(p.games).toBe(0);
    expect(p.streak).toBe(0);
    expect(p.loadout).not.toHaveProperty('0');
    expect(p.loadout.tileSet).toBeTruthy();
    expect(p.avatar).not.toHaveProperty('0');
    expect(p.varStats.classic.placements).toEqual([0, 0, 0, 0]);
    expect(p.varStats.classic.games).toBe(3);
    expect(p.varStats.riichi).toBeUndefined();
    expect(p.ratings).toEqual({ riichi: 1234 });
    expect(p.bestHand).toBeNull();
    expect(p.name).toBe('Guest');
    const r = applyMatch(p, { placement: 1, finalScore: 0, handsWon: 1, handsPlayed: 4, selfDraws: 0, bestHand: null, limitHand: false, fullNews: false, variation: 'classic', lengthLabel: 'East round', ranked: true, riichis: 1 });
    expect(p.xp).toBeTypeOf('number');
    expect(Number.isFinite(p.rating)).toBe(true);
    expect(r.ratingAfter).toBeGreaterThan(r.ratingBefore);
    expect(p.varStats.classic.placements).toEqual([1, 0, 0, 0]);
    expect(p.varStats.classic.riichis).toBe(1);
  });

  it('leaving ranked costs rating, unranked games never change it', () => {
    const p = loadProfile();
    const before = p.rating;
    applyMatch(p, { placement: 4, finalScore: 0, handsWon: 0, handsPlayed: 1, selfDraws: 0, bestHand: null, limitHand: false, fullNews: false, variation: 'classic', lengthLabel: 'Single hand', ranked: false });
    expect(p.rating).toBe(before);
    forfeitRanked(p, 'classic', [1000, 1000, 1000]);
    expect(p.rating).toBeLessThan(before);
    expect(p.jongPoints).toBeGreaterThanOrEqual(0);
  });
});
