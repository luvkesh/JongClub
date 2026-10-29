import { beforeEach, describe, expect, it } from 'vitest';
import { parseKinds, toCounts } from '../src/engine/tiles';
import { shanten, waits } from '../src/engine/hand';
import { classicProfile } from '../src/engine/rules/classic';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { PLACEMENT, gradePlacement, applyPlacement, loadPlacement, savePlacement, suggestionFor } = await import('../src/progression/placement');
const { loadProfile } = await import('../src/progression/profile');
const { activate, guestAccount } = await import('../src/auth/account');

const rules = classicProfile.shapes;
const all = () => PLACEMENT.map((q) => q.answer);
const missing = (...ids: string[]) => PLACEMENT.map((q) => (ids.includes(q.id) ? (q.answer + 1) % q.options.length : q.answer));

describe('placement test', () => {
  beforeEach(() => store.clear());

  it('has ten short questions covering every skill asked for', () => {
    expect(PLACEMENT).toHaveLength(10);
    expect(new Set(PLACEMENT.map((q) => q.id)).size).toBe(10);
    for (const s of ['tiles', 'sets', 'waits', 'discard', 'scoring', 'calls']) expect(PLACEMENT.some((q) => q.skill === s), s).toBe(true);
    for (const q of PLACEMENT) {
      expect(q.answer).toBeLessThan(q.options.length);
      expect(q.q.length).toBeLessThan(90);
      for (const o of q.options) expect(o.text || o.tiles).toBeTruthy();
      if (q.hand) expect(parseKinds(q.hand).length).toBeGreaterThanOrEqual(13);
    }
  });

  it('waits match the engine', () => {
    for (const q of PLACEMENT.filter((x) => x.skill === 'waits')) {
      const w = waits(toCounts(parseKinds(q.hand!)), 0, rules).sort((a, b) => a - b);
      expect(w, q.id).toEqual(parseKinds(q.options[q.answer].tiles!).sort((a, b) => a - b));
      // The wrong options really are wrong.
      for (const [i, o] of q.options.entries()) if (i !== q.answer) expect(parseKinds(o.tiles!).sort((a, b) => a - b)).not.toEqual(w);
    }
  });

  it('the best discard is the only one that leaves the hand ready', () => {
    const q = PLACEMENT.find((x) => x.skill === 'discard')!;
    const hand = parseKinds(q.hand!);
    expect(hand).toHaveLength(14);
    const after = (tile: number) => {
      const c = toCounts(hand);
      c[tile]--;
      return shanten(c, 0, rules);
    };
    const s = q.options.map((o) => after(parseKinds(o.tiles!)[0]));
    expect(s[q.answer]).toBe(0);
    for (const [i, v] of s.entries()) if (i !== q.answer) expect(v).toBeGreaterThan(0);
  });

  it('a full score marks the beginner lessons and suggests expert play', () => {
    const r = gradePlacement(all());
    expect(r.score).toBe(10);
    expect(r.lessons.sort()).toEqual(['basics', 'guided', 'rounds', 'scoring', 'words']);
    expect(r.suggestion.difficulty).toBe('expert');
    expect(r.suggestion.length).toBe('eastSouth');
  });

  it('only marks a lesson whose questions were all right', () => {
    const r = gradePlacement(missing('india-pay', 'wait-multi'));
    expect(r.score).toBe(8);
    expect(r.lessons).toContain('basics');
    expect(r.lessons).toContain('rounds');
    expect(r.lessons).not.toContain('scoring');
    expect(r.lessons).not.toContain('words');
    expect(r.suggestion.difficulty).toBe('strategic');
  });

  it('a low score marks nothing and starts with the guided game, even with the basics right', () => {
    const r = gradePlacement(missing('terminals', 'dealer', 'wait-two-sided', 'wait-multi', 'best-discard', 'india-pay'));
    expect(r.score).toBe(4);
    expect(r.lessons).toEqual([]);
    expect(r.suggestion).toEqual(suggestionFor(0));
    expect(r.suggestion.length).toBeNull();
    expect(gradePlacement([]).score).toBe(0);
  });

  it('bands the suggested AI level by score', () => {
    expect([0, 4, 5, 6, 7, 8, 9, 10].map((n) => suggestionFor(n).difficulty)).toEqual(['beginner', 'beginner', 'casual', 'casual', 'strategic', 'strategic', 'expert', 'expert']);
  });

  it('marks lessons on the profile once, and stores the result per account', () => {
    activate(guestAccount());
    const p = loadProfile();
    p.lessonsDone = ['basics'];
    const r = gradePlacement(all(), '2026-10-16T00:00:00.000Z');
    expect(applyPlacement(p, r).sort()).toEqual(['guided', 'rounds', 'scoring', 'words']);
    expect(applyPlacement(p, r)).toEqual([]);
    expect(p.lessonsDone.filter((l) => l === 'basics')).toHaveLength(1);

    expect(loadPlacement()).toBeNull();
    savePlacement(r);
    expect(loadPlacement()?.score).toBe(10);
    expect(store.has('jongclub.placement.v1')).toBe(true);
    // Signing in carries the guest's result over; the account then keeps its own.
    activate({ id: 'email-x', provider: 'email', name: 'Lin', email: 'lin@example.com', since: '' });
    expect(loadPlacement()?.score).toBe(10);
    savePlacement(gradePlacement([]));
    expect(loadPlacement()?.score).toBe(0);
    expect(store.has('jongclub.placement.v1:email-x')).toBe(true);
    activate(guestAccount());
    expect(loadPlacement()?.score).toBe(10);
  });
});
