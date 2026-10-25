import { describe, expect, it } from 'vitest';
import { coachAllowed, withCoachMode } from '../src/ui/coachMode';

describe('coach mode', () => {
  const on = { coach: true };
  it('is offered at your own AI tables when switched on', () => {
    expect(coachAllowed(on, {})).toBe(true);
    expect(coachAllowed(on, { mode: 'casual' })).toBe(true);
    expect(coachAllowed({ coach: false }, {})).toBe(false);
    expect(coachAllowed({}, {})).toBe(false);
  });

  it('is never available in ranked, live, daily, tournament or guided games', () => {
    expect(coachAllowed(on, { ranked: true })).toBe(false);
    expect(coachAllowed(on, { mode: 'ranked' })).toBe(false);
    expect(coachAllowed(on, { tag: 'ranked:1500,1500,1500' })).toBe(false);
    expect(coachAllowed(on, { mode: 'daily', tag: 'daily:speedJong' })).toBe(false);
    expect(coachAllowed(on, { mode: 'tournament', tag: 'tournament' })).toBe(false);
    expect(coachAllowed(on, { seats: [] })).toBe(false);
    expect(coachAllowed(on, { link: {} as never })).toBe(false);
    const cfg = { name: 'R', variation: 'riichi', length: 'eastRound' as const, difficulty: 'expert' as const, personalities: [], houseRules: {}, timer: 20, hints: false, coach: true };
    const opts = { ranked: true, mode: 'ranked' as const };
    expect(withCoachMode(cfg, opts)).toBe(opts);
    expect(withCoachMode(cfg, opts).coach).toBeUndefined();
  });
});
