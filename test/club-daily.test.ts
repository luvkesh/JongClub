import { describe, expect, it } from 'vitest';
import {
  FOUR_WINDS_GOALS,
  clubRegular,
  currentStreak,
  dailyKey,
  dailySeed,
  fourWinds,
  longestStreak,
  perfectDiscard,
  scorePerfectDiscard,
  scoreSpeedJong,
  scoreTodaysHand,
  speedJong,
  todaysHand,
  variationChallenge,
  type FourWindsSummary,
} from '../src/club/daily';

const strip = <T>(x: T) => JSON.parse(JSON.stringify(x));

describe('daily challenges', () => {
  it('keys and seeds come from the UTC date', () => {
    expect(dailyKey(new Date('2026-10-09T23:59:00Z'))).toBe('2026-10-09');
    expect(dailySeed('2026-10-09')).toBe(dailySeed('2026-10-09T08:00:00Z'));
    expect(dailySeed('2026-10-09')).not.toBe(dailySeed('2026-10-10'));
  });

  it('the same date gives the same puzzle', () => {
    const a = perfectDiscard('2026-10-09');
    const b = perfectDiscard(new Date('2026-10-09T15:30:00Z'));
    expect(strip(a)).toEqual(strip(b));
    expect(strip(perfectDiscard('2026-10-10'))).not.toEqual(strip(a));
  });

  it('puzzles are well-formed with the best answer first', () => {
    for (const d of ['2026-10-09', '2026-10-10', '2026-11-02', '2027-01-01']) {
      const p = perfectDiscard(d);
      expect(['classic', 'riichi']).toContain(p.variation);
      expect(p.hand).toHaveLength(14);
      expect(p.answers.length).toBeGreaterThan(1);
      expect(p.answers[0].score).toBe(100);
      for (let i = 1; i < p.answers.length; i++) expect(p.answers[i - 1].score).toBeGreaterThanOrEqual(p.answers[i].score);
      for (const a of p.answers) expect(p.hand).toContain(a.kind);
      expect(scorePerfectDiscard(p, p.answers[0].kind)).toBe(100);
      expect(p.explanation).toMatch(/^Discard the /);
      if (p.variation === 'riichi') expect(p.doraKinds?.length).toBeGreaterThan(0);
    }
  });

  it("today's hand rotates by weekday and is fixed for the day", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 7; i++) seen.add(todaysHand(new Date(Date.UTC(2026, 9, 5 + i))).variation);
    expect([...seen].sort()).toEqual(['american', 'classic', 'riichi', 'singapore', 'taiwanese', 'uae', 'vietnamese']);
    expect(strip(todaysHand('2026-10-09'))).toEqual(strip(todaysHand('2026-10-09T22:00:00Z')));
    const t = todaysHand('2026-10-09');
    expect(t.length).toBe('oneHand');
    expect(t.opponents).toHaveLength(3);
    expect(scoreTodaysHand('classic', 192, true)).toBe(442);
    expect(scoreTodaysHand('classic', -64, false)).toBe(-64);
  });

  it('speed jong scores fewer turns higher', () => {
    expect(speedJong('2026-10-09').length).toBe('oneHand');
    expect(scoreSpeedJong(6, true)).toBeGreaterThan(scoreSpeedJong(12, true));
    expect(scoreSpeedJong(6, false)).toBe(0);
  });

  it('four winds goals check the documented summary', () => {
    const g = fourWinds('2026-10-09');
    expect(FOUR_WINDS_GOALS).toContain(g);
    const s: FourWindsSummary = { won: true, seatWind: 'E', roundWind: 'S', dealerAtWin: true, pungKindsAtWin: [27, 31], dealtIn: false, length: 'eastSouth', matchComplete: true };
    const byId = (id: string) => FOUR_WINDS_GOALS.find((x) => x.id === id)!;
    expect(byId('east-dealer').check(s)).toBe(true);
    expect(byId('seat-wind-pung').check(s)).toBe(true);
    expect(byId('south-round').check(s)).toBe(true);
    expect(byId('clean-match').check(s)).toBe(true);
    expect(byId('clean-match').check({ ...s, dealtIn: true })).toBe(false);
    expect(byId('round-wind-pung').check(s)).toBe(false);
    expect(byId('dragon-pung').check(s)).toBe(true);
    expect(byId('east-dealer').check({ ...s, won: false })).toBe(false);
  });

  it('variation challenge needs the right variation', () => {
    const v = variationChallenge('2026-10-09');
    expect(v.check({ variation: v.variation, placement: 1, handsWon: 3 })).toBe(true);
    expect(v.check({ variation: v.variation === 'classic' ? 'riichi' : 'classic', placement: 1, handsWon: 3 })).toBe(false);
  });

  it('streak helpers', () => {
    const days = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10));
    expect(longestStreak(days)).toBe(30);
    expect(longestStreak(['2026-01-01', '2026-01-03', '2026-01-02', '2026-01-02', '2026-01-05'])).toBe(3);
    expect(currentStreak(days, '2026-09-30')).toBe(30);
    expect(currentStreak(days, '2026-10-01')).toBe(30); // today not played yet
    expect(currentStreak(days, '2026-10-02')).toBe(0);
    expect(clubRegular(days, '2026-09-30').achieved).toBe(true);
    expect(clubRegular(days.slice(1), '2026-09-30').achieved).toBe(false);
  });
});
