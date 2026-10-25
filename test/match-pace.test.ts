import { describe, expect, it } from 'vitest';
import { Countdown, PACES, firstTurnLimit, countdownAt, paceLimits, paceOf, paceSummary, shouldTick } from '../src/ui/pace';

describe('table speed', () => {
  it('maps every speed to claim and turn limits, untimed to none', () => {
    expect(paceLimits({ pace: 'relaxed' })).toEqual({ claim: 15, turn: 45 });
    expect(paceLimits({ pace: 'standard' })).toEqual({ claim: 8, turn: 25 });
    expect(paceLimits({ pace: 'competitive' })).toEqual({ claim: 4, turn: 12 });
    expect(paceLimits({ pace: 'untimed', timer: 30 })).toEqual({ claim: 0, turn: 0 });
    for (const p of Object.values(PACES)) expect(p.claim <= p.turn).toBe(true);
  });

  it('reads older configs (turn timer only) as the nearest speed', () => {
    expect(paceOf({ timer: 0 })).toBe('untimed');
    expect(paceOf({ timer: 12 })).toBe('competitive');
    expect(paceOf({ timer: 20 })).toBe('standard');
    expect(paceOf({ timer: 30 })).toBe('standard');
    expect(paceOf({ timer: 60 })).toBe('relaxed');
    expect(paceOf({ pace: 'bogus', timer: 0 })).toBe('untimed');
  });

  it('summarises the speed for table lists', () => {
    expect(paceSummary({ pace: 'standard' })).toBe('Standard pace · 8s claims · 25s turns');
    expect(paceSummary({ pace: 'untimed' })).toBe('Untimed');
  });
});

describe('countdown', () => {
  it('counts whole seconds down, rounding up, and ends at zero', () => {
    expect(countdownAt(8000, 0)).toMatchObject({ left: 8, frac: 1, low: false, done: false });
    expect(countdownAt(8000, 100)).toMatchObject({ left: 8, done: false });
    expect(countdownAt(8000, 5001)).toMatchObject({ left: 3, low: true });
    expect(countdownAt(8000, 8000)).toMatchObject({ left: 0, frac: 0, done: true });
    expect(countdownAt(8000, 9999).done).toBe(true);
    expect(countdownAt(0, 5000).done).toBe(false);
  });

  it('ticks once per second in the last three seconds only', () => {
    expect(shouldTick(5, 4)).toBe(false);
    expect(shouldTick(4, 3)).toBe(true);
    expect(shouldTick(2, 1)).toBe(true);
    expect(shouldTick(1, 0)).toBe(false);
    expect(shouldTick(3, 3)).toBe(false);
    const cd = new Countdown(5000, 0);
    const ticks: number[] = [];
    for (let t = 0; t <= 5000; t += 100) if (cd.step(t).tick) ticks.push(t);
    expect(ticks).toEqual([2000, 3000, 4000]);
  });

  it('stands still while paused', () => {
    const cd = new Countdown(4000, 0);
    cd.step(1000);
    expect(cd.step(30000, true).left).toBe(3);
    expect(cd.step(31000).left).toBe(2);
    expect(cd.step(33000).done).toBe(true);
  });
});

describe('first move of the hand', () => {
  it('doubles the turn time, never below 15 s, and leaves untimed alone', () => {
    expect(firstTurnLimit(PACES.relaxed.turn)).toBe(90);
    expect(firstTurnLimit(PACES.standard.turn)).toBe(50);
    expect(firstTurnLimit(PACES.competitive.turn)).toBe(24);
    expect(firstTurnLimit(5)).toBe(15);
    expect(firstTurnLimit(PACES.untimed.turn)).toBe(0);
  });
});
