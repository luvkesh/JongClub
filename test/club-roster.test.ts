import { describe, expect, it } from 'vitest';
import { REGIONS, ROSTER, difficultyForRating, isOnline, leaderboard, memberById, onlineNow } from '../src/club/roster';

describe('club roster', () => {
  it('has about sixty distinct, well-formed members', () => {
    expect(ROSTER.length).toBeGreaterThanOrEqual(55);
    expect(new Set(ROSTER.map((m) => m.id)).size).toBe(ROSTER.length);
    for (const m of ROSTER) {
      expect(REGIONS).toContain(m.region);
      expect(m.rating).toBeGreaterThanOrEqual(900);
      expect(m.rating).toBeLessThanOrEqual(2300);
      expect(m.difficulty).toBe(difficultyForRating(m.rating));
      expect(Object.keys(m.ratings)).toHaveLength(12);
      expect(m.ratings[m.favoriteVariation]).toBe(Math.max(...Object.values(m.ratings)));
      expect(m.bio.length).toBeGreaterThan(10);
      expect(memberById(m.id)).toBe(m);
    }
    expect(new Set(ROSTER.map((m) => m.region)).size).toBe(REGIONS.length);
    expect(ROSTER.filter((m) => m.rating >= 1700).length).toBeGreaterThan(10);
  });

  it('online presence is deterministic per time bucket', () => {
    const d = new Date('2026-10-09T19:05:00Z');
    expect(onlineNow(d).map((m) => m.id)).toEqual(onlineNow(new Date('2026-10-09T19:10:00Z')).map((m) => m.id));
    expect(onlineNow(d).length).toBeGreaterThan(0);
    expect(typeof isOnline(ROSTER[0], d)).toBe('boolean');
  });

  it('leaderboards are sorted and filter by region', () => {
    const all = leaderboard('overall');
    expect(all).toHaveLength(ROSTER.length);
    for (let i = 1; i < all.length; i++) expect(all[i - 1].rating).toBeGreaterThanOrEqual(all[i].rating);
    const riichi = leaderboard('riichi', 'East Asia');
    expect(riichi.every((r) => r.member.region === 'East Asia')).toBe(true);
    expect(riichi[0].rank).toBe(1);
    expect(riichi[0].rating).toBe(riichi[0].member.ratings.riichi);
  });
});
