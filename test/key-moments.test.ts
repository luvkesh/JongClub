import { describe, expect, it } from 'vitest';
import { keyMoments, shortLine } from '../src/ai/keyMoments';
import { replayHand } from '../src/net/replay';
import { recordMatch } from './helpers/recordMatch';

describe('key moments', () => {
  it('picks reviewed moments that point at real replay steps', () => {
    let cards = 0;
    for (const [variation, seed] of [['classic', 11], ['riichi', 12], ['hongkong', 13], ['taiwanese', 14]] as const) {
      const rec = recordMatch(variation, seed, 'eastRound');
      const ms = keyMoments(rec);
      if (!ms) continue;
      expect(ms.length).toBeLessThanOrEqual(3);
      expect(new Set(ms.map((m) => m.kind)).size).toBe(ms.length);
      for (const m of ms) {
        cards++;
        expect(m.line.length).toBeGreaterThan(10);
        expect(m.line).not.toMatch(/shanten|ukeire|genbutsu|tenpai/i);
        const steps = replayHand(rec, m.hand).steps;
        expect(m.step).toBeGreaterThan(0);
        expect(m.step).toBeLessThan(steps.length);
        // The step is one of your own decisions.
        expect(steps[m.step].action?.s).toBe(0);
      }
    }
    expect(cards).toBeGreaterThan(3);
  });

  it('works for American and gives nothing for spectated games', () => {
    const rec = recordMatch('american', 5, 'oneHand');
    const ms = keyMoments(rec);
    if (ms) for (const m of ms) expect(m.line).toBeTruthy();
    expect(keyMoments({ ...rec, me: -1 })).toBeNull();
  });

  it('keeps lines short', () => {
    expect(shortLine('One. Two! Three? Four.')).toBe('Two! Three?');
    expect(shortLine('Nice. The 3 Dot was right.')).toBe('The 3 Dot was right.');
    expect(shortLine('Just one line.')).toBe('Just one line.');
  });
});
