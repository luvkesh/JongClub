import { describe, expect, it } from 'vitest';
import { loadProfile, type Profile } from '../src/progression/profile';
import {
  ACHIEVEMENT_JP, ADS_PER_DAY, BUNDLES, FIRST_WIN_BONUS, FREE_LESSONS, LOGIN_LADDER,
  adsLeft, buyBundleJp, canOpen, claimAchievement, claimChallenge, claimLogin, econOf, grantPurchase, lessonPrice, loginStatus, payAd, takeFirstWin, unlockLessonJp, weekChallenges,
} from '../src/economy/economy';
import { ACADEMY_ORDER } from '../src/ui/academy';

const all = [...ACADEMY_ORDER, 'guided'];
const fresh = (): Profile => loadProfile();
const day = (d: number, h = 12) => new Date(2026, 9, d, h);

describe('Jong Points economy', () => {
  it('keeps Levels 1-3 and every India Rules lesson free, and locks the rest', () => {
    const p = fresh();
    for (const l of ['basics', 'guided', 'scoring', 'india', 'india-east', 'india-south', 'india-west', 'india-west-doubles', 'india-west-big', 'india-north', 'indian']) expect(canOpen(p, l, all), l).toBe(true);
    for (const l of ['rounds', 'shapes', 'efficiency', 'classic', 'riichi', 'american']) expect(canOpen(p, l, all), l).toBe(false);
    // Every India lesson in the Academy is free.
    for (const l of ACADEMY_ORDER.filter((x) => x.startsWith('india'))) expect(FREE_LESSONS).toContain(l);
  });

  it('keeps lessons finished before the economy open', () => {
    const p = fresh();
    p.lessonsDone = ['rounds', 'riichi'];
    expect(canOpen(p, 'rounds', all)).toBe(true);
    expect(canOpen(p, 'riichi', all)).toBe(true);
    // Lessons marked done later (a placement skip) do not open them.
    p.lessonsDone.push('waits');
    expect(canOpen(p, 'waits', all)).toBe(false);
  });

  it('unlocks a lesson with Jong Points only when the balance covers it', () => {
    const p = fresh();
    p.jongPoints = 100;
    expect(unlockLessonJp(p, 'rounds', all)).toBe(false);
    p.jongPoints = lessonPrice('rounds').jp + 5;
    expect(unlockLessonJp(p, 'rounds', all)).toBe(true);
    expect(p.jongPoints).toBe(5);
    expect(canOpen(p, 'rounds', all)).toBe(true);
    expect(canOpen(p, 'shapes', all)).toBe(false);
  });

  it('bundles open their lessons and cost less than buying each one', () => {
    for (const b of BUNDLES) {
      const list = b.lessons(all);
      expect(list.length, b.id).toBeGreaterThan(0);
      expect(list.some((l) => FREE_LESSONS.includes(l)), b.id).toBe(false);
      expect(b.price.jp, b.id).toBeLessThan(list.reduce((a, l) => a + lessonPrice(l).jp, 0));
    }
    const p = fresh();
    p.jongPoints = 1_000_000;
    expect(buyBundleJp(p, 'mastery')).toBe(true);
    for (const l of ['efficiency', 'waits', 'defence', 'value']) expect(canOpen(p, l, all)).toBe(true);
    expect(canOpen(p, 'riichi', all)).toBe(false);
    grantPurchase(p, 'bundle:world', true);
    expect(canOpen(p, 'riichi', all)).toBe(true);
    expect(econOf(p).purchases[econOf(p).purchases.length - 1]).toMatchObject({ sku: 'bundle:world', demo: true });
  });

  it('pays the daily login ladder and restarts after a missed day', () => {
    const p = fresh();
    expect(claimLogin(p, day(1))).toBe(LOGIN_LADDER[0]);
    expect(claimLogin(p, day(1, 20))).toBe(0);
    expect(claimLogin(p, day(2))).toBe(LOGIN_LADDER[1]);
    expect(loginStatus(p, day(3)).day).toBe(3);
    expect(loginStatus(p, day(5)).day).toBe(1);
    for (let d = 3; d <= 7; d++) claimLogin(p, day(d));
    expect(loginStatus(p, day(7)).claimed).toBe(true);
    claimLogin(p, day(8));
    // The day after Day 7 starts the ladder again.
    expect(loginStatus(p, day(8))).toMatchObject({ day: 1, claimed: true });
    expect(loginStatus(p, day(9)).day).toBe(2);
  });

  it('pays the first win once a day and caps adverts', () => {
    const p = fresh();
    expect(takeFirstWin(p, day(1))).toBe(FIRST_WIN_BONUS);
    expect(takeFirstWin(p, day(1, 18))).toBe(0);
    expect(takeFirstWin(p, day(2))).toBe(FIRST_WIN_BONUS);
    for (let i = 0; i < ADS_PER_DAY; i++) expect(payAd(p, day(3))).toBeGreaterThan(0);
    expect(payAd(p, day(3))).toBe(0);
    expect(adsLeft(p, day(4))).toBe(ADS_PER_DAY);
  });

  it('counts weekly challenges from the start of the week and pays each once', () => {
    const p = fresh();
    const now = day(26);
    const week = weekChallenges(p, now);
    expect(week).toHaveLength(3);
    p.games += 10;
    p.gamesWon += 10;
    p.handsWon += 20;
    p.lessonsDone.push('basics');
    const ready = weekChallenges(p, now).filter((c) => c.counter !== 'dailies');
    for (const c of ready) {
      expect(c.ready, c.id).toBe(true);
      expect(claimChallenge(p, c.id, now)).toBe(c.points);
      expect(claimChallenge(p, c.id, now)).toBe(0);
    }
  });

  it('pays each achievement once', () => {
    const p = fresh();
    p.achievements['first-hand'] = '2026-10-01';
    const before = p.jongPoints;
    expect(claimAchievement(p, 'first-hand')).toBe(ACHIEVEMENT_JP['first-hand']);
    expect(claimAchievement(p, 'first-hand')).toBe(0);
    expect(p.jongPoints).toBe(before + ACHIEVEMENT_JP['first-hand']);
  });
});
