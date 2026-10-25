import { describe, expect, it } from 'vitest';
import { clipKey } from '../src/audio/clipKey';
import { CLIPS } from '../src/audio/narration.gen';
import { PENDING_NARRATION } from '../src/audio/narrationPending';
import { narrationLines } from '../src/ui/academy';

describe('narration', () => {
  it("every line Mei says has a recorded clip or is listed as pending (re-run scripts/record-narration.py after editing lessons)", () => {
    const missing = narrationLines().filter((l) => !CLIPS[clipKey(l)]);
    const pending = new Set(PENDING_NARRATION);
    expect(missing.filter((l) => !pending.has(l))).toEqual([]);
  });

  it('lists only lines that still need recording', () => {
    const lines = new Set(narrationLines());
    for (const l of PENDING_NARRATION) {
      expect(lines.has(l), `no longer spoken: ${l}`).toBe(true);
      expect(CLIPS[clipKey(l)], `already recorded: ${l}`).toBeUndefined();
    }
  });
});
