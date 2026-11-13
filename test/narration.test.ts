import { describe, expect, it } from 'vitest';
import { clipKey } from '../src/audio/clipKey';
import { CLIPS } from '../src/audio/narration.gen';
import { PENDING_NARRATION } from '../src/audio/narrationPending';
import '../src/minigames/games';
import { miniGameLines } from '../src/minigames/narration';
import { narrationLines } from '../src/ui/academy';

/** Every line Mei can say: the lessons, the table and the mini-games' how-to sheets. */
const spoken = () => [...narrationLines(), ...miniGameLines()];

describe('narration', () => {
  it("every line Mei says has a recorded clip or is listed as pending (re-run scripts/record-narration.py after editing lessons)", () => {
    const missing = spoken().filter((l) => !CLIPS[clipKey(l)]);
    const pending = new Set(PENDING_NARRATION);
    expect(missing.filter((l) => !pending.has(l))).toEqual([]);
  });

  it('lists only lines that still need recording', () => {
    const lines = new Set(spoken());
    for (const l of PENDING_NARRATION) {
      expect(lines.has(l), `no longer spoken: ${l}`).toBe(true);
      expect(CLIPS[clipKey(l)], `already recorded: ${l}`).toBeUndefined();
    }
  });
});
