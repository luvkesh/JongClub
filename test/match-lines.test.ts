import { describe, expect, it } from 'vitest';
import { callerPhrases } from '../src/audio/callers';
import { partText, type SpeechPart } from '../src/audio/voice';
import { TILE_KIND_COUNT } from '../src/engine/tiles';
import { charlestonPrompt, claimPrompt, hintSpoken, matchLines, resultSpoken, turnPrompt, votePrompt, withHint } from '../src/ui/matchLines';
import { narrationLines } from '../src/ui/academy';

/** Every piece must be something Mei recorded: a fixed line, or a tile name / call word from her caller clips. */
function recordable(parts: SpeechPart[]) {
  const lines = new Set(matchLines());
  const phrases = new Set(callerPhrases());
  for (const p of parts) {
    if ('line' in p) expect(lines.has(p.line), p.line).toBe(true);
    else expect(phrases.has(partText(p)), partText(p)).toBe(true);
  }
}

describe('Mei’s composed table lines', () => {
  it('builds every prompt from recorded pieces', () => {
    recordable(turnPrompt(false).parts);
    recordable(turnPrompt(true, 'Tsumo').parts);
    for (let k = 0; k < TILE_KIND_COUNT; k++) recordable(claimPrompt(k).parts);
    for (const d of ['right', 'across', 'left']) recordable(charlestonPrompt(d, true).parts);
    recordable(votePrompt().parts);
    for (const r of [0, 1, 2, 3, null]) recordable(resultSpoken(r, 'x').parts);
  });

  it('says the tile first, then the fixed question', () => {
    const c = claimPrompt(22);
    expect(c.parts[0]).toEqual({ tile: 22 });
    expect(c.parts[1]).toEqual({ line: 'Claim it, or pass?' });
    expect(c.text.endsWith('Claim it, or pass?')).toBe(true);
  });

  it('turns JongBot hints into a tile or call word plus a recorded line, keeping the full caption', () => {
    const d = hintSpoken({ headline: 'Discard the 5 Bamboo.', focusKind: 22, action: 'discard' });
    expect(d.parts[0]).toEqual({ tile: 22 });
    expect(d.text).toBe('Discard the 5 Bamboo.');
    recordable(d.parts);
    const p = hintSpoken({ headline: 'Pon the 5 Bamboo.', action: 'pung' }, 'Pon');
    expect(p.parts[0]).toEqual({ call: 'Pon' });
    recordable(p.parts);
    for (const action of ['win', 'pass'] as const) recordable(hintSpoken({ headline: 'x', action }).parts);
    recordable(hintSpoken({ headline: 'Swap your 3 Dot for the joker in your exposure.', focusKind: 11, action: 'discard' }).parts);
    recordable(hintSpoken({ headline: 'Pass the 1, 2, 3 to the right.' }).parts);
    const w = withHint(claimPrompt(22), { headline: 'Pass.', action: 'pass' });
    expect(w.parts.length).toBe(3);
    expect(w.text).toContain('JongBot: Pass.');
  });

  it('lists its fixed lines for recording', () => {
    const all = new Set(narrationLines());
    for (const l of matchLines()) expect(all.has(l), l).toBe(true);
  });
});
