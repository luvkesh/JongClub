import { describe, expect, it } from 'vitest';
import { makeDrill } from '../src/learn/drillGen';

// User 2026-11-13: count-the-hand drills use India Rules where they can, and never offer scores no hand can make.
describe('count-the-hand drills, India Rules first', () => {
  it('a new player counts an India Rules hand, with halves and doubles as the wrong answers', () => {
    const d = makeDrill('value', 1);
    expect(d.variation).toBe('india');
    const values = d.options.map((o) => parseInt(o.label.replace(/[^0-9]/g, ''), 10));
    expect(values).toHaveLength(4);
    for (const v of values) expect(v % 250).toBe(0);
    expect(d.options.filter((o) => o.correct)).toHaveLength(1);
  }, 60000);
});
