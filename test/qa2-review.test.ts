// Second deep retest (menus, Learn, account and economy): one test per fix.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
import { loadProfile } from '../src/progression/profile';
import { dailyHandsInWeek, weekOf } from '../src/economy/economy';
import { dailyFieldDone, dailyKey, dailySweepDone } from '../src/club/daily';

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

describe('daily challenges: the all-five sweep bonus', () => {
  it('a Speed Jong hand that was not won is not done, so the sweep waits for it', () => {
    // compete.ts keeps 0 for a Speed Jong hand that was lost.
    const rec = { hand: 300, discard: 80, speed: 0, winds: true, variation: true };
    expect(dailyFieldDone(rec, 'speed')).toBe(false);
    expect(dailySweepDone(rec)).toBe(false);
    expect(dailySweepDone({ ...rec, speed: 640 })).toBe(true);
    expect(dailySweepDone({ ...rec, winds: false })).toBe(false);
    expect(dailyFieldDone({ discard: 0 }, 'discard')).toBe(true);
  });
});

describe('guest progress moves to the first new account', () => {
  beforeEach(() => store.clear());

  it('season XP, skills, drills, shield, clubs and placement move with the profile', async () => {
    const { activate, guestAccount, signOut } = await import('../src/auth/account');
    const { seasonProgress, addSeasonXp } = await import('../src/progression/season');
    activate(guestAccount());
    const p = loadProfile();
    p.jongPoints = 500;
    const { saveProfile } = await import('../src/progression/profile');
    saveProfile(p);
    addSeasonXp('lesson', 80);
    const guestXp = seasonProgress().xp;
    expect(guestXp).toBeGreaterThan(0);
    for (const k of ['jongclub.skills.v1', 'jongclub.drills.v1', 'jongclub.streak-shield.v1', 'jongclub.clubs.v1', 'jongclub.placement.v1']) store.set(k, `{"from":"${k}"}`);

    activate({ id: 'email-q', provider: 'email', name: 'Quinn', email: 'q@x.co', since: '' });
    expect(loadProfile().jongPoints).toBe(500);
    expect(seasonProgress().xp).toBe(guestXp);
    for (const k of ['jongclub.skills.v1', 'jongclub.drills.v1', 'jongclub.streak-shield.v1', 'jongclub.clubs.v1', 'jongclub.placement.v1']) {
      expect(store.get(`${k}:email-q`), k).toBe(`{"from":"${k}"}`);
      expect(store.has(k), k).toBe(false);
    }

    // Signing out leaves a fresh guest, season XP included.
    signOut();
    activate(guestAccount());
    expect(seasonProgress().xp).toBe(0);
    // Signing back in to an account that has its own slot moves nothing.
    addSeasonXp('lesson', 80);
    saveProfile(loadProfile());
    activate({ id: 'email-q', provider: 'email', name: 'Quinn', email: 'q@x.co', since: '' });
    expect(seasonProgress().xp).toBe(guestXp);
    expect(store.has('jongclub.season.v1')).toBe(true);
    signOut();
  });
});
