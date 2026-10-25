import { describe, expect, it } from 'vitest';
import { arrangeHand, completeSets, moveTile } from '../src/ui/handOrder';
import { parseKinds } from '../src/engine/tiles';

const hand = (spec: string) => parseKinds(spec).map((kind, id) => ({ id, kind }));

describe('hand layout', () => {
  it('sorts the drawn tile in and gaps between suits', () => {
    const h = hand('123m 55p 7s');
    const drawn = { id: 99, kind: 1 };
    const slots = arrangeHand([...h, drawn], { mode: 'suit', custom: null, groupSets: false });
    expect(slots.map((s) => s.tile.kind)).toEqual([0, 1, 1, 2, 13, 13, 24]);
    expect(slots.map((s) => s.gap)).toEqual([0, 0, 0, 0, 1, 0, 1]);
  });
  it('finds the most complete sets', () => {
    expect(completeSets(hand('1112345m')).length).toBe(2);
    expect(completeSets(hand('123m 456p 77s'), false).length).toBe(0);
  });
  it('groups sets to the left', () => {
    const slots = arrangeHand(hand('19m 123p 555s'), { mode: 'suit', custom: null, groupSets: true });
    expect(slots.slice(0, 6).every((s) => s.set >= 0)).toBe(true);
    expect(slots[3].gap).toBe(2);
    expect(slots[6].gap).toBe(2);
  });
  it('keeps a custom order and slots new tiles in', () => {
    const h = hand('123m');
    const order = moveTile(arrangeHand(h, { mode: 'suit', custom: null, groupSets: false }), 0, 2);
    expect(order).toEqual([1, 2, 0]);
    const slots = arrangeHand([...h, { id: 9, kind: 8 }], { mode: 'suit', custom: order, groupSets: false });
    expect(slots.map((s) => s.tile.id)).toEqual([1, 2, 0, 9]);
  });
});
