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
