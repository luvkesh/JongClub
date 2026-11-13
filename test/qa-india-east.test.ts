// QA audit of India Rules: East round, Classic, and match bookkeeping (2026-11-13).
import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { withHouseRules } from '../src/engine/rules';
import { eastReading, flowerLines, indiaProfile } from '../src/engine/rules/india';
import { passportLayout } from '../src/engine/rules/indiaLayout';
import { FLOWER_BASE, parseKinds, toCounts, type Tile } from '../src/engine/tiles';
import type { Meld } from '../src/engine/state';

const P = (choices: Record<string, string> = {}) => withHouseRules(indiaProfile, { indiaRounds: 'E', ...choices });
const k = (s: string) => parseKinds(s)[0];

/** A fresh East-round game at the dealer's first turn, flowers cleared, the four hands set. */
function table(hands: (string | null)[], choices: Record<string, string> = {}, seed = 5) {
  const g = new MahjongGame(P(choices), ['A', 'B', 'C', 'D'], seed);
  g.startHand(seed);
  expect(g.state.phase.kind).toBe('turn');
  hands.forEach((h, s) => {
    if (h === null) return;
    const kinds = parseKinds(h);
    const pl = g.players[s];
    if (kinds.length !== pl.hand.length) throw new Error(`seat ${s}: ${kinds.length} vs ${pl.hand.length}`);
    pl.hand.forEach((t, i) => (t.kind = kinds[i]));
  });
  for (const pl of g.players) pl.flowers = [];
  (g as unknown as { seatShapeCache: unknown[] }).seatShapeCache = [];
  return g;
}
const scores = (g: MahjongGame) => g.players.map((p) => p.score);
const deltas = (g: MahjongGame) => {
  const ph = g.state.phase;
  if (ph.kind !== 'handOver') throw new Error('hand not over: ' + ph.kind);
  return ph.result.deltas;
};
const passAll = (g: MahjongGame, except: number[] = []) => {
  for (const s of g.pendingClaimSeats()) if (!except.includes(s)) g.respond(s, { type: 'pass' });
};
const tileOf = (g: MahjongGame, seat: number, kind: number) => g.players[seat].hand.find((t) => t.kind === kind)!;
// Filler hands that call nothing: all far apart honours / terminals.
const JUNK13 = '1m 5m 9m 3p 7p 2s 6s E S W N Rd Gd';

describe('East round payments (spec 65-68)', () => {
  it('a discard Mahjong with nothing exposed is concealed: 1000 each, East 2000', () => {
    // Seat 1 waits on E: 123m 456p 789s (passport) 111s + E.
    const g = table(['E 1m 5m 9m 3p 7p 2s 6s S W N Rd Gd Wd', '123m 456p 789s 111s E', JUNK13, JUNK13]);
    g.discard(0, tileOf(g, 0, k('E')).id);
    expect(g.state.phase.kind).toBe('claims');
    g.respond(1, { type: 'win' });
    passAll(g);
    expect(deltas(g)).toEqual([-2000, 4000, -1000, -1000]);
  });
  it('a fully concealed self-draw by East: everyone pays 4000', () => {
    const g = table(['123m 456p 789s 111s EE', JUNK13, JUNK13, JUNK13]);
    (g.state.phase as { drawn: Tile }).drawn = g.players[0].hand[13];
    g.declareSelfDrawWin(0);
    expect(deltas(g)).toEqual([12000, -4000, -4000, -4000]);    // East won, and the deal still passes; the scores carry into the next hand.
    g.advance();
    expect(g.state.round.dealerSeat).toBe(1);
    g.startHand(6);
    expect(scores(g)).toEqual([47000, 31000, 31000, 31000]);
    expect(g.state.seatWinds).toEqual(['N', 'E', 'S', 'W']);
  });
  it('an exposed set makes it a normal hand: 500 each, East 1000, even self-drawn', () => {
    const g = table([null, '123m 456p 789s 11s E Wd', JUNK13, JUNK13]);
    // Seat 1 pungs 1s from East.
    g.players[0].hand[0].kind = k('1s');
    g.discard(0, g.players[0].hand[0].id);
    g.respond(1, { type: 'pung' });
    passAll(g);
    expect(g.players[1].melds).toHaveLength(1);
    // Seat 1 discards something useless? It must keep 123m 456p 789s EE + pung: 11 tiles + a discard.
    // Give it a junk tile to throw first.
    const pl = g.players[1];
    expect(pl.hand).toHaveLength(11);
    // Draw next: put E on the wall front for seat 1 after a round; simpler: score directly.
    g.discard(1, tileOf(g, 1, k('Wd')).id);
    passAll(g);
    const ev = g.evaluateWin(1, k('E'), true, true);
    expect(ev?.score.points).toBe(500);
  });
});

describe('Claims (spec 39-42, user rulings)', () => {
  it('Mahjong beats pung; two Mahjong calls: the next in turn wins', () => {
    // Seats 2 and 3 both win on 5p from seat 1. Seat 2 is next in turn after 1.
    const g = table(['1m 1m 9m 3p 7p 2s 6s E S W N Rd Gd Wd', '5p 5m 9m 3p 7p 2s 6s E S W N Rd Gd', '123m 456p 789s 111s 5p', '123m 456p 789s EEE 5p']);
    // East throws a junk tile, seat 1 draws: force the claim flow from seat 1.
    g.discard(0, tileOf(g, 0, k('Wd')).id);
    passAll(g);
    expect(g.state.phase.kind).toBe('turn');
    const ph = g.state.phase as { seat: number };
    expect(ph.seat).toBe(1);
    g.discard(1, tileOf(g, 1, k('5p')).id);
    expect(g.state.phase.kind).toBe('claims');
    g.respond(3, { type: 'win' });
    g.respond(2, { type: 'win' });
    passAll(g);
    const r = (g.state.phase as { result: { winner: number } }).result;
    expect(r.winner).toBe(2);
  });
  it('pung beats chow, and chow only from the left', () => {
    const g = table(['4p 1m 9m 3p 7p 2s 6s E S W N Rd Gd Wd', '56p 1m 9m 3s 7s 2s 6s E S W N Rd', JUNK13, '44p 1m 9m 7s 2s 6s E S W N Rd Gd']);
    g.discard(0, tileOf(g, 0, k('4p')).id);
    const ph = g.state.phase as { options: Record<number, { type: string; using?: number[] }[]> };
    expect(ph.options[1].map((o) => o.type)).toContain('chow');
    expect(ph.options[3].map((o) => o.type)).toContain('pung');
    expect(ph.options[3].map((o) => o.type)).not.toContain('chow');
    // Seat 3 can't chow (not left of East).
    expect(() => g.respond(3, { type: 'chow', using: [k('5p'), k('6p')] } as never)).toThrow();
    g.respond(1, { type: 'chow', using: [k('5p'), k('6p')] } as never);
    g.respond(3, { type: 'pung' });
    passAll(g);
    expect(g.players[3].melds).toHaveLength(1);
    expect(g.players[1].melds).toHaveLength(0);
  });
  it('no pair, knit, crochet or mixed chow from a discard', () => {
    // Seat 1 holds 4m (pair possible), 5m 6s (mixed chow with 4p), 4s (knit / crochet with 4p 4m).
    const g = table(['4p 1m 9m 3p 7p 2s 6s E S W N Rd Gd Wd', '4m 4s 5m 6s 1p 9p 9s E S W N Rd Gd', JUNK13, JUNK13]);
    g.discard(0, tileOf(g, 0, k('4p')).id);
    const ph = g.state.phase;
    const opts = ph.kind === 'claims' ? ph.options[1] ?? [] : [];
    expect(opts).toEqual([]);
    expect(() => g.respond(1, { type: 'chow', using: [k('5m'), k('6s')] } as never)).toThrow();
  });
});

describe('Exhausted wall (spec 69, user ruling: deal passes)', () => {
  it('a drawn game pays flowers only and passes the deal', () => {
    const g = table(['1m 1m 9m 3p 7p 2s 6s E S W N Rd Gd Wd', JUNK13, JUNK13, JUNK13]);
    g.players[1].flowers = [{ id: 137, kind: FLOWER_BASE + 1 }, { id: 141, kind: FLOWER_BASE + 5 }];
    // Leave no live tile: East's discard is the last.
    g.state.drawnFromFront = g.state.wall.length - g.state.drawnFromBack;
    g.discard(0, tileOf(g, 0, k('Wd')).id);
    passAll(g);
    expect(g.state.phase.kind).toBe('handOver');
    expect(deltas(g)).toEqual([-500, 1500, -500, -500]);
    g.advance();
    expect(g.state.round.dealerSeat).toBe(1);
    expect(g.matchOver).toBe(false);
  });
  it('a flower drawn as the last tile: a drawn game, the flower is still paid', () => {
    const g = table(['1m 1m 9m 3p 7p 2s 6s E S W N Rd Gd Wd', JUNK13, JUNK13, JUNK13]);
    const s = g.state;
    s.drawnFromFront = s.wall.length - s.drawnFromBack - 1;
    // Make the last live tile seat 1's own flower F2, and give seat 1 its own season already.
    s.wall[s.drawnFromFront] = { id: 137, kind: FLOWER_BASE + 1 };
    g.players[1].flowers = [{ id: 141, kind: FLOWER_BASE + 5 }];
    g.discard(0, tileOf(g, 0, k('Wd')).id);
    passAll(g);
    expect(g.state.phase.kind).toBe('handOver');
    expect(g.players[1].flowers.map((f) => f.kind)).toContain(FLOWER_BASE + 1);
    expect(deltas(g)).toEqual([-500, 1500, -500, -500]);
  });
});

describe('Kongs (spec 27, 24)', () => {
  it('a concealed kong keeps the hand fully concealed; win on the replacement', () => {
    const g = table(['1111m 222p 333s 456s E', JUNK13, JUNK13, JUNK13]);
    // Replacement from the back: make it E.
    const s = g.state;
    s.wall[s.wall.length - 1 - s.drawnFromBack] = { id: 999, kind: k('E') };
    g.declareKong(0, k('1m'));
    expect(g.players[0].melds[0].concealed).toBe(true);
    expect(g.turnOptions(0).canWin).toBe(true);
    g.declareSelfDrawWin(0);
    expect(deltas(g)).toEqual([12000, -4000, -4000, -4000]);
  });
  it('a kong may still be declared with one live tile, and its replacement is that tile', () => {
    const g = table(['1111m 456p 789s 11s EE', JUNK13, JUNK13, JUNK13]);
    const s = g.state;
    s.drawnFromFront = s.wall.length - s.drawnFromBack - 1;
    expect(g.liveRemaining).toBe(1);
    expect(g.turnOptions(0).kongs).toContain(k('1m'));
    g.declareKong(0, k('1m'));
    expect(g.liveRemaining).toBe(0);
    expect(g.state.phase.kind).toBe('turn');
  });
  it('no kong with no live tile left', () => {
    const g = table(['1111m 456p 789s 11s EE', JUNK13, JUNK13, JUNK13]);
    const s = g.state;
    s.drawnFromFront = s.wall.length - s.drawnFromBack;
    expect(g.turnOptions(0).kongs).toEqual([]);
  });
});

describe('Flowers (spec 69-70)', () => {
  const F = (n: number) => FLOWER_BASE + n - 1; // F1..F4 flowers, F5..F8 seasons
  it('own and round pair the same: paid once (user ruling)', () => {
    expect(flowerLines([F(1), F(5)], 'E', 'E')).toEqual([['Own flower and season', 500]]);
    expect(flowerLines([F(1), F(5), F(2), F(6)], 'S', 'E')).toEqual([['Own flower and season', 500], ['Round flower and season', 500]]);
  });
  it('bouquets', () => {
    expect(flowerLines([F(1), F(6), F(3), F(8)], 'W', 'E')).toEqual([['Mixed bouquet', 500]]);
    expect(flowerLines([F(1), F(2), F(3), F(4)], 'W', 'E')).toEqual([['Pure bouquet', 1000]]);
  });
});

describe('Match bookkeeping (spec 33-34, user rulings)', () => {
  const play = (choices: Record<string, string>) => {
    const g = new MahjongGame(withHouseRules(indiaProfile, choices), ['A', 'B', 'C', 'D'], 1);
    const log: string[] = [];
    for (let h = 0; h < 40 && !g.matchOver; h++) {
      g.startHand(100 + h);
      if (g.state.phase.kind === 'roundChoice') g.chooseRound(g.dealer, 0);
      log.push(`${g.state.prevailingWind}${g.dealer}`);
      g.state.phase = { kind: 'handOver', result: { type: 'draw', payments: [], deltas: [0, 0, 0, 0] } };
      g.advance();
    }
    return log;
  };
  it('the 16-game match: 4 rounds x 4 deals, each seat East once per round', () => {
    expect(play({ indiaRounds: 'ESWN' })).toEqual(['E0', 'E1', 'E2', 'E3', 'S0', 'S1', 'S2', 'S3', 'W0', 'W1', 'W2', 'W3', 'N0', 'N1', 'N2', 'N3']);
  });
  it('one round alone: 4 deals', () => {
    expect(play({ indiaRounds: 'E' })).toEqual(['E0', 'E1', 'E2', 'E3']);
    expect(play({ indiaRounds: 'W' })).toEqual(['W0', 'W1', 'W2', 'W3']);
  });
  it('Classic: 16 deals, the East-round game in every wind', () => {
    expect(play({ indiaRounds: 'C' })).toEqual(['E0', 'E1', 'E2', 'E3', 'S0', 'S1', 'S2', 'S3', 'W0', 'W1', 'W2', 'W3', 'N0', 'N1', 'N2', 'N3']);
  });
});

describe('Classic (indiaRounds C)', () => {
  it('a plain hand wins without a passport and pays like the East round', () => {
    const g = table(['E 1m 5m 9m 3p 7p 2s 6s S W N Rd Gd Wd', '123m 345p 2m 3s 4p 111s E', JUNK13, JUNK13], { indiaRounds: 'C' });
    g.discard(0, tileOf(g, 0, k('E')).id);
    g.respond(1, { type: 'win' });
    passAll(g);
    expect(deltas(g)).toEqual([-2000, 4000, -1000, -1000]);
  });
});

describe('Classic has no passports (spec 46-48)', () => {
  const C = withHouseRules(indiaProfile, { indiaRounds: 'C' });
  const win = (h: string) => C.shapes.special![0].complete(toCounts(parseKinds(h)), 0, []);
  it('a plain 3+3+3+3+2 with mixed sets wins', () => {
    expect(win('1m 2p 3s 5m 5p 5s 789m EEE RdRd')).toBe(true);
    expect(win('5m 5p 5s 7m 7s 123m 456p 789s')).toBe(true); // knit pair with a crochet
  });
  it('a passport-only hand (not four sets and a pair) does not win', () => {
    expect(win('ESWN S 123m 456p 789s')).toBe(false); // NEWS + wind: 5+3+3+3
    expect(win('11m 22m 33p 44p 55s 66s EE')).toBe(false); // 6+6+2
    expect(win('11p 44p 66p 123m 456s 99m')).toBe(false); // 6+3+3+2
    expect(win('RdGdWd EE 1m 1s 4m 4s 9m 9s 123p')).toBe(false); // 5+6+3
  });
  it('the game turns the passport-only hand away too', () => {
    const g = table(['ESWN S 123m 456p 789s', JUNK13, JUNK13, JUNK13], { indiaRounds: 'C' });
    (g.state.phase as { drawn: Tile }).drawn = g.players[0].hand[13];
    expect(g.turnOptions(0).canWin).toBe(false);
  });
});

describe('Two Mahjong calls on one discard (book p. 9)', () => {
  it('only the player nearest in turn wins, even with a saved "multiple winners" choice', () => {
    const g = table(['1m 1m 9m 3p 7p 2s 6s E S W N Rd Gd Wd', '5p 5m 9m 3p 7p 2s 6s E S W N Rd Gd', '123m 456p 789s 111s 5p', '123m 456p 789s EEE 5p'], { multipleWinners: 'on' });
    g.discard(0, tileOf(g, 0, k('Wd')).id);
    passAll(g);
    g.discard(1, tileOf(g, 1, k('5p')).id);
    g.respond(3, { type: 'win' });
    g.respond(2, { type: 'win' });
    passAll(g);
    const r = (g.state.phase as { result: { winner?: number; winners?: number[]; deltas: number[] } }).result;
    expect(r.winner).toBe(2);
    expect(r.winners ?? [2]).toEqual([2]);
    // Concealed: 1000 from each player, East 2000.
    expect(r.deltas).toEqual([-2000, -1000, 4000, -1000]);
  });
});

describe('More kongs', () => {
  it('an exposed kong from a discard, then Mahjong on the replacement: a normal hand', () => {
    const g = table(['Wd 1m 9m 3p 7p 2s 6s E S W N Rd Gd 5m', 'WdWdWd 222p 333s 456s E', JUNK13, JUNK13]);
    const s = g.state;
    s.wall[s.wall.length - 1 - s.drawnFromBack] = { id: 998, kind: k('E') };
    g.discard(0, tileOf(g, 0, k('Wd')).id);
    g.respond(1, { type: 'kong' });
    passAll(g);
    expect(g.players[1].melds[0]).toMatchObject({ type: 'kong', concealed: false });
    expect(g.turnOptions(1).canWin).toBe(true);
    g.declareSelfDrawWin(1);
    // Wd kong + 222p + 333s = 3 pungs? no: honour kong is not a suit pung. 456s EE. Passport? none -> check
    expect(deltas(g)).toEqual([-1000, 2000, -500, -500]);
  });
  it('a promoted kong: the pung grows from the wall, replacement drawn, no robbing', () => {
    const g = table([null, '22p 1m 9m 3s 7s 2s 6s E S W N Rd', JUNK13, JUNK13]);
    g.players[0].hand[0].kind = k('2p');
    g.discard(0, g.players[0].hand[0].id);
    g.respond(1, { type: 'pung' });
    passAll(g);
    // give seat 1 the 4th 2p in hand on its next turn
    g.discard(1, tileOf(g, 1, k('Rd')).id);
    passAll(g);
    for (let i = 0; i < 3; i++) {
      const ph = g.state.phase as { seat: number; drawn: Tile };
      g.discard(ph.seat, ph.drawn.id);
      passAll(g);
    }
    const ph1 = g.state.phase as { seat: number; drawn: Tile };
    expect(ph1.seat).toBe(1);
    ph1.drawn.kind = k('2p');
    expect(g.turnOptions(1).kongs).toContain(k('2p'));
    const before = g.liveRemaining;
    g.declareKong(1, k('2p'));
    expect(g.players[1].melds[0]).toMatchObject({ type: 'kong', concealed: false });
    expect(g.liveRemaining).toBe(before - 1);
    expect(g.state.phase).toMatchObject({ kind: 'turn', seat: 1, afterKong: true });
  });
});

describe('Hand reading (passportView) matches the scoring', () => {
  let id = 7000;
  const tiles = (s: string): Tile[] => parseKinds(s).map((kind) => ({ id: id++, kind }));
  it('a kong inside a passport', () => {
    const kong: Meld = { type: 'kong', tiles: tiles('4m 4m 4m 4m'), concealed: true };
    const l = passportLayout(tiles('777s 222p 123m 99s'), [kong], true);
    expect(l.passports.map((p) => p.name)).toEqual(['3 Pungs in 3 different suits']);
    expect(l.passports[0].melds).toEqual([kong]);
    expect(l.loose).toEqual([]);
    expect(eastReading(toCounts(parseKinds('777s 222p 123m 99s')), [{ type: 'kong', kind: k('4m') }], true)).not.toBeNull();
  });
});
