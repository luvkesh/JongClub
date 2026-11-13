// Second deep retest (menus, Learn, account and economy): one test per fix.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadProfile } from '../src/progression/profile';
import { dailyHandsInWeek, weekOf } from '../src/economy/economy';
import { dailyKey } from '../src/club/daily';

afterEach(() => vi.unstubAllEnvs());

describe('weekly "Daily Hand on 3 days" counter', () => {
  it('counts a Daily Hand in one week only, west of Greenwich', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    const p = loadProfile();
    // Sunday 15 Nov 2026, 20:00 in Los Angeles is already Monday 16 Nov in UTC.
    const sundayEvening = new Date('2026-11-16T04:00:00Z');
    const key = dailyKey(sundayEvening);
    expect(key).toBe('2026-11-16');
    p.daily[key] = { hand: 1200 };
    const thisWeek = weekOf(sundayEvening);
    const nextWeek = weekOf(new Date('2026-11-16T18:00:00Z'));
    expect(thisWeek).toBe('2026-11-09');
    expect(nextWeek).toBe('2026-11-16');
    expect(dailyHandsInWeek(p, thisWeek) + dailyHandsInWeek(p, nextWeek)).toBe(1);
  });

  it('keeps counting the days of the week in India', () => {
    vi.stubEnv('TZ', 'Asia/Kolkata');
    const p = loadProfile();
    for (const k of ['2026-11-15', '2026-11-16', '2026-11-18', '2026-11-22', '2026-11-23']) p.daily[k] = { hand: 1 };
    p.daily['2026-11-17'] = { discard: 3 };
    expect(weekOf(new Date('2026-11-18T06:00:00Z'))).toBe('2026-11-16');
    expect(dailyHandsInWeek(p, '2026-11-16')).toBe(3);
  });
});

describe('Club Regular on the profile (30 days in a row)', () => {
  it('does not count a day twice when the clocks go forward', async () => {
    const { applyMatch } = await import('../src/progression/profile');
    vi.stubEnv('TZ', 'Europe/London');
    // 00:30 on Monday 30 March 2026 in London (summer time began on Sunday): still Sunday 29th in UTC.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-29T23:30:00Z'));
    try {
      const p = loadProfile();
      // 29 days in a row, 1 to 29 March: one short of Club Regular.
      p.daysPlayed = Array.from({ length: 29 }, (_, i) => `2026-03-${String(i + 1).padStart(2, '0')}`);
      const r = applyMatch(p, { placement: 4, finalScore: 0, handsWon: 0, handsPlayed: 1, selfDraws: 0, bestHand: null, limitHand: false, fullNews: false, variation: 'classic', lengthLabel: 'Single hand', ranked: false });
      expect(r.unlocked).not.toContain('club-regular');
      expect(p.achievements['club-regular']).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
