import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { classicProfile } from '../src/engine/rules/classic';
import { getProfile, withHouseRules } from '../src/engine/rules';
import { parseKinds, type Tile } from '../src/engine/tiles';
import type { Meld } from '../src/engine/state';
import type { RuleProfile } from '../src/engine/rules/types';
import { targetKit } from '../src/ai/targets';
import { turnHint } from '../src/ai/jongbot';
import { SHAPE_ORPHANS, SHAPE_PAIRS, SHAPE_SETS } from '../src/ai/shapeKit';
import { arrangeHand } from '../src/ui/handOrder';

let nextId = 5000;
const tiles = (spec: string): Tile[] => parseKinds(spec).map((kind) => ({ id: nextId++, kind }));

function table(hand: string, profile: RuleProfile = classicProfile, melds: Meld[] = []) {
  const g = new MahjongGame(profile, ['You', 'Mei', 'Rex', 'Hiro'], 5);
  g.startHand(77);
  const h = tiles(hand);
  g.players[0].hand = h;
  g.players[0].melds = melds;
  g.state.phase = { kind: 'turn', seat: 0, drawn: h[h.length - 1], afterKong: false, mustDiscardOnly: false };
  return g;
}

/** The rack as the match lays it out once a target is chosen (match.ts handLayout). */
function rack(g: MahjongGame, key: string) {
  const plan = targetKit(g)!.plans(g, 0).find((p) => p.key === key)!;
  const groups = plan.pieces.map((piece, i) => piece.slice(0, piece.length - plan.gaps[i]));
  return arrangeHand(g.players[0].hand, { mode: 'suit', custom: null, groupSets: true, chows: true, groups });
}

describe('Group for: special hands at a Chinese Classical table', () => {
  it('offers sets and a pair first (the default), then Seven Pairs and Thirteen Orphans', () => {
    const g = table('19m 19p 19s ESW RdGd 55p 3s');
    const kit = targetKit(g)!;
    expect(kit.id).toBe('shape');
    expect(kit.plans(g, 0).map((p) => p.key)).toEqual([SHAPE_SETS, SHAPE_PAIRS, SHAPE_ORPHANS]);
  });

  it('Seven Pairs pulls your pairs to the left, each spaced apart', () => {
    const g = table('1122m 33p 77s EE 5p 9s Rd Gd');
    const slots = rack(g, SHAPE_PAIRS);
    const lead = slots.slice(0, 10).map((s) => s.tile.kind);
    expect(lead).toEqual(parseKinds('11m 22m 33p 77s EE'));
    // A new piece starts every two tiles.
    expect(slots.slice(0, 10).filter((s) => s.gap === 2).length).toBe(4);
    const plan = targetKit(g)!.plans(g, 0).find((p) => p.key === SHAPE_PAIRS)!;
    expect(plan.missing).toBe(2); // 14 tiles with 5 pairs: one discard and one draw from ready
  });

  it('Thirteen Orphans pulls out ones, nines, winds and dragons, with the pair beside its twin', () => {
    const g = table('19m 1p 9s EESN RdGdWd 5p 6s');
    const slots = rack(g, SHAPE_ORPHANS);
    const pulled = slots.filter((s) => s.set >= 0).map((s) => s.tile.kind);
    expect(pulled).toEqual(parseKinds('19m 1p 9s EESN RdGdWd'));
    // The two loose tiles come last.
    expect(slots.slice(-2).map((s) => s.tile.kind).sort()).toEqual(parseKinds('5p 6s').sort());
  });

  it('sets and a pair groups as before', () => {
    const g = table('123m 456p 777s EE 59m 2s 8p');
    const plan = targetKit(g)!.plans(g, 0)[0];
    expect(plan.key).toBe(SHAPE_SETS);
    expect(plan.pieces).toEqual([]);
  });

  it('drops the special hands once you have claimed a set', () => {
    const meld: Meld = { type: 'pung', tiles: tiles('555p'), concealed: false, from: 1 };
    const g = table('19m 19p 19s ES RdGd 3s', classicProfile, [meld]);
    expect(targetKit(g)!.plans(g, 0).map((p) => p.key)).toEqual([SHAPE_SETS]);
  });

  it('is not used at India Rules or other tables', () => {
    for (const id of ['india', 'hongkong', 'taiwanese']) {
      const g = table('19m 19p 19s ESW RdGd 55p 3s', getProfile(id)!);
      expect(targetKit(g)?.id).not.toBe('shape');
    }
  });

  it('JongBot lists the hands without repeating them in its reason', () => {
    const g = table('1122m 33p 77s EE 5p 9s Rd Gd', withHouseRules(classicProfile, {}));
    const hint = turnHint(g, 0, 'learning');
    expect(hint.targets?.plans.map((p) => p.names[0])).toContain('Seven Pairs');
    expect(hint.why ?? '').not.toMatch(/^Aim for/);
  });
});
