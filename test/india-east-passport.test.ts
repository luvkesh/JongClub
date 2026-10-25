import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { withHouseRules } from '../src/engine/rules';
import { eastReading, indiaProfile } from '../src/engine/rules/india';
import { passportLayout } from '../src/engine/rules/indiaLayout';
import { parseKinds, toCounts, type Tile } from '../src/engine/tiles';
import type { Meld } from '../src/engine/state';

const k = (s: string) => parseKinds(s)[0];
let id = 5000;
const tiles = (s: string): Tile[] => parseKinds(s).map((kind) => ({ id: id++, kind }));
const pung = (s: string, concealed = false): Meld => ({ type: 'pung', tiles: tiles(`${s} ${s} ${s}`), concealed });
const kinds = (ts: { tiles: Tile[] }[]) => ts.map((g) => g.tiles.map((t) => t.kind));

describe('India Rules East round: a win needs a passport (the user, 2026-10-24)', () => {
  it('is compulsory by default', () => {
    const g = new MahjongGame(withHouseRules(indiaProfile, { indiaRounds: 'E' }), ['A', 'B', 'C', 'D'], 3);
    g.startHand(3);
    expect(g.profile.passportView).toBeDefined();
    expect(indiaProfile.houseRules.find((r) => r.id === 'passport')!.default).toBe('required');
  });
  it('turns away the reported hand: N pung, 1m 2s 3p, 2m 2p 2s, 456m, 66s', () => {
    const melds = [{ type: 'pung' as const, kind: k('N') }];
    const counts = toCounts(parseKinds('1m 2s 3p 2m 2p 2s 456m 66s'));
    expect(eastReading(counts, melds, true)).toBeNull();
    // It is a plain 3+3+3+3+2, so only the optional table rule would let it win.
    expect(eastReading(counts, melds, false)?.passports).toEqual([]);
  });
  it('a saved table with the old optional default plays compulsory', () => {
    const P = withHouseRules(indiaProfile, { indiaRounds: 'E', passport: 'off' });
    const g = new MahjongGame(P, ['A', 'B', 'C', 'D'], 3);
    g.startHand(3);
    expect(g.profile.shapes.special![0].name).toBe('Passport');
  });
});

describe('India Rules East round: the hand laid out with its passport apart', () => {
  it('a winning hand: the passport, then the sets and the pair', () => {
    const l = passportLayout(tiles('444m 777s 222p 123m 99s'), [], true);
    expect(l.passports.map((p) => p.name)).toEqual(['3 Pungs in 3 different suits']);
    expect(kinds(l.passports[0].sets).flat().sort((a, b) => a - b)).toEqual(parseKinds('444m 222p 777s').sort((a, b) => a - b));
    expect(kinds(l.sets)).toEqual([parseKinds('123m'), parseKinds('99s')]);
    expect(l.loose).toEqual([]);
  });
  it('a declared pung can be part of the passport', () => {
    const n = pung('N');
    const l = passportLayout(tiles('RdRd 123m 456p 789s'), [n], true);
    expect(l.passports[0].name).toBe('Honour Pung + Honour Pair');
    expect(l.passports[0].melds).toEqual([n]);
    expect(kinds(l.passports[0].sets)).toEqual([parseKinds('RdRd')]);
    expect(l.melds).toEqual([]);
  });
  it('another hand: the passport it holds, the rest loose', () => {
    const l = passportLayout(tiles('ESWN S 13m 5p 79s 2m'), [], true);
    expect(l.passports.map((p) => p.name)).toEqual(['NEWS + another Wind']);
    expect(l.loose).toHaveLength(6);
  });
  it('a hand with no passport says so', () => {
    const l = passportLayout(tiles('1m 5m 9m 3p 7p 2s 6s E S W Rd Gd Wd'), [], true);
    expect(l.passports).toEqual([]);
    expect(l.loose).toHaveLength(13);
  });
});
