import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { classicProfile } from '../src/engine/rules/classic';
import { withHouseRules } from '../src/engine/rules/index';
import { riichiProfile } from '../src/engine/rules/riichi';
import type { RuleProfile } from '../src/engine/rules/types';
import { Tile, isRed, parseKinds, redFiveIds } from '../src/engine/tiles';

const k = (s: string) => parseKinds(s)[0];

/** Tiles with ids that avoid the red copies unless listed in `red`. */
function tiles(spec: string, red: number[] = []): Tile[] {
  const used = new Map<number, number>();
  return parseKinds(spec).map((kind) => {
    const redId = red.find((id) => Math.floor(id / 4) === kind && !used.has(-id));
    if (redId !== undefined) {
      used.set(-redId, 1);
      return { id: redId, kind };
    }
    const n = used.get(kind) ?? 0;
    used.set(kind, n + 1);
    return { id: kind * 4 + 3 - n, kind };
  });
}

function game(profile: RuleProfile) {
  const g = new MahjongGame(profile, ['A', 'B', 'C', 'D'], 11);
  g.startHand(11);
  return g;
}

describe('red fives', () => {
  it('picks the red copies by id', () => {
    expect(redFiveIds(0)).toEqual([]);
    expect(redFiveIds(3)).toEqual([16, 52, 88]);
    expect(redFiveIds(4)).toEqual([16, 52, 53, 88]);
    for (const id of redFiveIds(4)) expect([k('5m'), k('5p'), k('5s')]).toContain(Math.floor(id / 4));
  });

  it('house rule sets state.red; three is the default', () => {
    expect(game(riichiProfile).state.red).toEqual([16, 52, 88]);
    expect(game(withHouseRules(riichiProfile, {})).state.red).toEqual([16, 52, 88]);
    expect(game(withHouseRules(riichiProfile, { redFives: '4' })).state.red).toEqual([16, 52, 53, 88]);
    expect(game(withHouseRules(riichiProfile, { redFives: '0' })).state.red).toEqual([]);
    expect(game(classicProfile).state.red).toEqual([]);
    const g = game(riichiProfile);
    expect(isRed(g.state, 52)).toBe(true);
    expect(isRed(g.state, 55)).toBe(false);
    expect(isRed({}, 52)).toBe(false);
  });

  it('each red five in hand, melds or the win tile is one han, its own line', () => {
    const g = game(withHouseRules(riichiProfile, { redFives: '4' }));
    const pl = g.players[0];
    pl.riichi = true;
    // Concealed red 5m and 5s; win on the red 5p by discard.
    pl.hand = tiles('234m 456m 345s 66s 4p 6p', [16, 88]);
    pl.melds = [];
    const ev = g.evaluateWin(0, k('5p'), false, true, false, { winTileId: 52 })!;
    const red = ev.score.items.find((i) => i.name === 'Red five')!;
    expect(red.value).toBe(3);
    expect(red.note).toBe('Aka dora');
    // Same hand, plain 5p: two reds.
    const plain = g.evaluateWin(0, k('5p'), false, true, false, { winTileId: 55 })!;
    expect(plain.score.items.find((i) => i.name === 'Red five')!.value).toBe(2);
    expect(ev.score.value - plain.score.value).toBe(1);
  });

  it('counts reds in open melds, but red fives alone are not a yaku', () => {
    const g = game(riichiProfile);
    const pl = g.players[0];
    pl.melds = [{ type: 'chow', tiles: [{ id: 15, kind: k('4m') }, { id: 16, kind: k('5m') }, { id: 23, kind: k('6m') }], concealed: false, from: 3 }];
    // Open, no yaku: red fives don't make it a win.
    pl.hand = tiles('123p 456s 789s 9m');
    expect(g.evaluateWin(0, k('9m'), false, true, false, { winTileId: 35 })).toBeNull();
    // With a yakuhai pung it qualifies and shows the melded red five.
    pl.hand = tiles('123p 456s RdRdRd 9m');
    const ev = g.evaluateWin(0, k('9m'), false, true, false, { winTileId: 35 });
    expect(ev).not.toBeNull();
    expect(ev!.score.items.find((i) => i.name === 'Red five')!.value).toBe(1);
  });

  it('red fives off: no line item', () => {
    const g = game(withHouseRules(riichiProfile, { redFives: '0' }));
    const pl = g.players[0];
    pl.riichi = true;
    pl.melds = [];
    pl.hand = tiles('234m 456m 345s 66s 4p 6p', [16, 88]);
    const ev = g.evaluateWin(0, k('5p'), false, true, false, { winTileId: 52 })!;
    expect(ev.score.items.some((i) => i.name === 'Red five')).toBe(false);
  });
});
