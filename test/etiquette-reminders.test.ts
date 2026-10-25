// Table etiquette (preset phrases, rate limits), the weekly streak shield,
// reminder scheduling and the profile sync merge rules.

import { describe, expect, it } from 'vitest';
import { SignalLimiter, isTableSignal, phraseCode, phraseOf, PHRASES } from '../src/net/etiquette';
import { settleShield, shieldReady, streakDays, weekStart } from '../src/club/streakShield';
import { currentStreak } from '../src/club/daily';
import { dueReminders, NO_REMINDERS } from '../src/club/reminders';
import { applyRemote, emptyShadow, localChanges } from '../src/progression/cloudSync';

describe('table etiquette', () => {
  it('accepts only preset phrases and the emoji reactions, never free text', () => {
    expect(isTableSignal('👏')).toBe(true);
    expect(isTableSignal(phraseCode('gg'))).toBe(true);
    expect(phraseOf('~gg')?.text).toBe('Good game');
    expect(isTableSignal('~you are terrible')).toBe(false);
    expect(isTableSignal('hello')).toBe(false);
    expect(isTableSignal(42)).toBe(false);
    for (const want of ['Nice hand', 'Good game', 'Well played', 'Thank you']) expect(PHRASES.some((p) => p.text === want)).toBe(true);
    expect(PHRASES.filter((p) => p.glyph).length).toBeGreaterThanOrEqual(2);
  });

  it('rate-limits: a gap between signals and a cap per minute', () => {
    const l = new SignalLimiter(5, 60_000, 2000);
    expect(l.allow(0)).toBe(true);
    expect(l.allow(500)).toBe(false);
    let t = 0;
    let sent = 1;
    for (let i = 0; i < 10; i++) if (l.allow((t += 2500))) sent++;
    expect(sent).toBe(5);
    expect(l.allow(70_000)).toBe(true);
  });
});

describe('streak shield', () => {
  it('weeks start on Monday (UTC)', () => {
    expect(weekStart('2026-10-15')).toBe('2026-10-12');
    expect(weekStart('2026-10-12')).toBe('2026-10-12');
    expect(weekStart('2026-10-18')).toBe('2026-10-12');
  });

  it('covers one missed day and keeps the streak', () => {
    const played = ['2026-10-12', '2026-10-13', '2026-10-14'];
    // Missed the 15th; it is now the 16th.
    expect(currentStreak(played, '2026-10-16')).toBe(0);
    const s = settleShield(played, { used: [] }, '2026-10-16')!;
    expect(s.used).toEqual(['2026-10-15']);
    expect(currentStreak(streakDays(played, s), '2026-10-16')).toBe(4);
    // Playing today extends it.
    expect(currentStreak(streakDays([...played, '2026-10-16'], s), '2026-10-16')).toBe(5);
    // Settling again changes nothing.
    expect(settleShield(played, s, '2026-10-16')).toBeNull();
  });

  it('gives one shield a week, and never covers two missed days', () => {
    const played = ['2026-10-12', '2026-10-13', '2026-10-15'];
    const used = { used: ['2026-10-14'] };
    expect(shieldReady(used, '2026-10-16')).toBe(false);
    // The 16th missed too: the week's shield is gone.
    expect(settleShield(played, used, '2026-10-17')).toBeNull();
    // Next week a new one is ready.
    expect(shieldReady(used, '2026-10-19')).toBe(true);
    // Two days missed in a row: no cover.
    expect(settleShield(['2026-10-19'], { used: [] }, '2026-10-22')).toBeNull();
    // Nothing to protect when there was no streak.
    expect(settleShield([], { used: [] }, '2026-10-22')).toBeNull();
  });
});

describe('reminders', () => {
  const all = { ...NO_REMINDERS, daily: true, friend: true, streak: true };
  const at = (iso: string) => new Date(iso);

  it('sends nothing unless switched on', () => {
    expect(dueReminders({ prefs: NO_REMINDERS, now: at('2026-10-16T20:00:00Z'), streakDays: ['2026-10-14', '2026-10-15'], dailyStarted: false, friendsAtTables: ['Aiko'], log: {} }).due).toEqual([]);
  });

  it('sends each kind once a day, and the streak one only late in the day', () => {
    const base = { prefs: all, streakDays: ['2026-10-13', '2026-10-14', '2026-10-15'], dailyStarted: false, friendsAtTables: ['Aiko'] };
    const morning = dueReminders({ ...base, now: at('2026-10-16T11:00:00'), log: {} });
    expect(morning.due.map((r) => r.kind).sort()).toEqual(['daily', 'friend']);
    const again = dueReminders({ ...base, now: at('2026-10-16T12:00:00'), log: morning.log });
    expect(again.due).toEqual([]);
    const evening = dueReminders({ ...base, now: at('2026-10-16T21:30:00Z'), log: again.log });
    expect(evening.due.map((r) => r.kind)).toEqual(['streak']);
    expect(evening.due[0].title).toContain('3-day streak');
    // Played today: no streak reminder.
    expect(dueReminders({ ...base, streakDays: [...base.streakDays, '2026-10-16'], now: at('2026-10-16T21:30:00Z'), log: {} }).due.some((r) => r.kind === 'streak')).toBe(false);
  });
});

describe('profile sync merge', () => {
  it('first sync sends fields as old, so a server profile wins over a fresh device', () => {
    const local = { name: 'Guest', jongPoints: 0 };
    const { send, shadow } = localChanges(local, emptyShadow(), 5000);
    expect(send.jongPoints.t).toBe(1);
    const changed = applyRemote(local, shadow, { jongPoints: { v: 900, t: 4000 }, name: { v: 'Mei', t: 4000 } });
    expect(changed.sort()).toEqual(['jongPoints', 'name']);
    expect(local).toEqual({ name: 'Mei', jongPoints: 900 });
  });

  it('later syncs send only what changed here, stamped now, and keep newer local values', () => {
    const local: Record<string, unknown> = { name: 'Mei', jongPoints: 900 };
    let { shadow } = localChanges(local, emptyShadow(), 1);
    local.jongPoints = 1000;
    const r = localChanges(local, shadow, 9000);
    expect(Object.keys(r.send)).toEqual(['jongPoints']);
    expect(r.send.jongPoints).toEqual({ v: 1000, t: 9000 });
    shadow = r.shadow;
    // An older server value does not overwrite the newer local one.
    expect(applyRemote(local, shadow, { jongPoints: { v: 950, t: 8000 } })).toEqual([]);
    expect(local.jongPoints).toBe(1000);
  });
});
