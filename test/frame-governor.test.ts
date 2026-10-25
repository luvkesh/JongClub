import { describe, expect, it } from 'vitest';
import { FrameGovernor, GOVERNOR_STEPS } from '../src/render/quality';

/** Feed frames of `ms` each from `t` for `secs` seconds, or until the level changes when `untilChange`. */
function run(g: FrameGovernor, t: number, ms: number, secs: number, untilChange = false) {
  const start = g.level;
  for (const end = t + secs * 1000; t < end; t += ms) {
    g.tick(t);
    if (untilChange && g.level !== start) return t + ms;
  }
  return t;
}

describe('FrameGovernor', () => {
  it('steps down after about 1.5 s of slow frames, not on a single slow window', () => {
    const g = new FrameGovernor(() => {});
    let t = run(g, 1, 16.7, 5);
    // A short burst of slow frames and one long hitch are not the device falling behind.
    t = run(g, t, 30, 0.5);
    t = run(g, t, 16.7, 2);
    g.tick((t += 240));
    t = run(g, t, 16.7, 2);
    expect(g.level).toBe(0);
    run(g, t, 30, 3, true);
    expect(g.level).toBe(1);
  });

  it('waits for a long smooth stretch and backs off a rung that failed, so it never flickers', () => {
    const levels: number[] = [];
    const g = new FrameGovernor((_, l) => levels.push(l));
    let t = run(g, 1, 30, 5, true);
    expect(g.level).toBe(1);
    // Level 0 just failed: smooth frames for 15 s are not enough to retry it (20 s back-off)...
    t = run(g, t, 16.7, 15);
    expect(g.level).toBe(1);
    // ...but after the back-off it tries again.
    t = run(g, t, 16.7, 12);
    expect(g.level).toBe(0);
    // Failing again doubles the wait.
    t = run(g, t, 30, 5, true);
    t = run(g, t, 16.7, 30);
    expect(g.level).toBe(1);
    run(g, t, 16.7, 20);
    expect(g.level).toBe(0);
    expect(levels).toEqual([1, 0, 1, 0]);
  });

  it('never goes past the last rung and ignores paused gaps', () => {
    const g = new FrameGovernor(() => {});
    let t = run(g, 1, 40, 60);
    expect(g.level).toBe(GOVERNOR_STEPS.length - 1);
    const h = new FrameGovernor(() => {});
    for (let i = 0; i < 100; i++) {
      h.tick(t);
      h.pause();
      t += 33;
    }
    expect(h.level).toBe(0);
  });
});
