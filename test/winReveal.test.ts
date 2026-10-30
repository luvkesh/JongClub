import { describe, expect, it } from 'vitest';
import { concealedSets } from '../src/ui/winReveal';

const hand = (kinds: number[]) => kinds.map((kind, id) => ({ id, kind }));
const shape = (kinds: number[]) => concealedSets(hand(kinds)).map((g) => g.map((t) => t.kind));

describe('winning hand split into sets', () => {
  it('reads the screenshot hand as chows and a pair', () => {
    // 7-8-9 characters, 8-8 pair... : 7m 8m 8m 8m 9m 5p 6p 7p 5s 6s 7s 7s 8s 9s
    const k = [6, 7, 7, 7, 8, 13, 14, 15, 22, 23, 24, 24, 25, 26];
    const sets = shape(k);
    expect(sets.flat().sort((a, b) => a - b)).toEqual([...k].sort((a, b) => a - b));
    expect(sets).toHaveLength(5);
    expect(sets[sets.length - 1]).toHaveLength(2);
  });
  it('keeps every tile with fewer concealed tiles after calls', () => {
    expect(shape([0, 0, 0, 30, 30])).toEqual([[0, 0, 0], [30, 30]]);
  });
  it('groups a mixed pung across the suits as one set', () => {
    // 1-2-3, 5-6-7, 7-8-9 characters, 6 of each suit, a pair of winds (Classic mixed hands)
    const sets = shape([0, 1, 2, 4, 5, 5, 6, 6, 7, 8, 14, 23, 27, 27]);
    expect(sets).toHaveLength(5);
    expect(sets.some((g) => [...g].sort((a, b) => a - b).join() === '5,14,23')).toBe(true);
  });
  it('groups seven pairs', () => {
    expect(shape([0, 0, 5, 5, 9, 9, 12, 12, 20, 20, 27, 27, 33, 33])).toHaveLength(7);
  });
  it('falls back to suits for thirteen orphans', () => {
    const k = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33, 33];
    expect(shape(k).flat()).toHaveLength(14);
    expect(shape(k)).toHaveLength(4);
  });
});

describe('winning hand on the table follows the summary', () => {
  it('lays an India East hand out passport first, then the sets with it, the pair last', async () => {
    const { passportLayout } = await import('../src/engine/rules/indiaLayout');
    const { winTableSets } = await import('../src/ui/winReveal');
    const { parseKinds } = await import('../src/engine/tiles');
    // The user's screenshot: knits 2m2s 3m3s 8m8s, chow 234p, pung 111m, pair 1s1s.
    const tiles = parseKinds('111238m 234p 11238s').map((kind, id) => ({ id, kind }));
    const pl = passportLayout(tiles, [], true);
    const kinds = winTableSets(tiles, pl).map((ids) => ids.map((id) => tiles[id].kind).sort((a, b) => a - b));
    const summary = [...pl.passports.flatMap((p) => p.sets), ...pl.sets].map((x) => x.tiles.map((t) => t.kind).sort((a, b) => a - b));
    expect(kinds).toEqual(summary);
    expect(kinds.slice(0, 3).every((g) => g.length === 2)).toBe(true);
    expect(kinds[kinds.length - 1]).toEqual([18, 18]);
    expect(kinds.flat()).toHaveLength(14);
  });
});
