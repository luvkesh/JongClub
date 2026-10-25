// JongBot audit (american agent): failing repros. Each test asserts the correct behaviour.
import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { buildProfile } from '../src/club/sim';
import { withHouseRules } from '../src/engine/rules';
import { americanProfile, distance } from '../src/engine/rules/american';
import { wrightPattersonProfile } from '../src/engine/rules/wrightPatterson';
import { AiPlayer } from '../src/ai/players';
import { charlestonPick } from '../src/ai/american';
import { exchangePick, currentShanten } from '../src/ai/evaluate';
import { parseKinds, JOKER_KIND } from '../src/engine/tiles';
import { charlestonHint, claimHint, turnHint } from '../src/ai/jongbot';

let nextId = 5000;
const pung = (spec: string) => ({ type: 'pung' as const, tiles: parseKinds(spec).map((kind) => ({ id: nextId++, kind })), concealed: false });

/** American game advanced past the Charleston; the dealer (on turn, 14 tiles) holds `hand`. */
function americanTurn(hand: string, seed = 3) {
  const g = new MahjongGame(americanProfile, ['A', 'B', 'C', 'D'], seed);
  g.startHand(seed);
  while (g.state.phase.kind === 'charleston') for (let s = 0; s < 4; s++) if (g.state.phase.kind === 'charleston') g.charlestonPass(s, charlestonPick(g.players[s].hand).map((t) => t.id));
  if (g.state.phase.kind === 'charlestonVote') for (let s = 0; s < 4; s++) if (g.state.phase.kind === 'charlestonVote') g.charlestonVote(s, false);
  const seat = (g.state.phase as { seat: number }).seat;
  const kinds = parseKinds(hand);
  g.players[seat].hand.forEach((t, i) => (t.kind = kinds[i]));
  return { g, seat };
}

/** Wright-Patterson game, optionally advanced past the Charleston with `hand` for the player on turn. */
function wp(hand: string | null, seed = 3) {
  const g = new MahjongGame(withHouseRules(wrightPattersonProfile, {}), ['A', 'B', 'C', 'D'], seed);
  g.startHand(seed);
  if (!hand) return { g, seat: 0 };
  while (g.state.phase.kind === 'charleston') for (let s = 0; s < 4; s++) if (g.state.phase.kind === 'charleston') g.charlestonPass(s, exchangePick(g, s).map((t) => t.id));
  if (g.state.phase.kind === 'charlestonVote') for (let s = 0; s < 4; s++) if (g.state.phase.kind === 'charlestonVote') g.charlestonVote(s, false);
  const seat = (g.state.phase as { seat: number }).seat;
  const k = parseKinds(hand);
  g.players[seat].hand.forEach((t, i) => (t.kind = k[i]));
  (g as unknown as { seatShapeCache: unknown[] }).seatShapeCache = [];
  return { g, seat };
}

/** Dubai Asian with the special wind rounds, flowers off, at the first turn of `wind` (0 E passport, 1 S small card, 2 W goulash). */
function uaeRound(wind: number, seed = 5) {
  const g = new MahjongGame(buildProfile('uae', 'fullNews', { specialRounds: 'on', flowers: 'off' }), ['A', 'B', 'C', 'D'], seed);
  g.state.round = { ...g.state.round, windIndex: wind };
  g.startHand(seed);
  const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, 'expert', 'zen', s + 1));
  for (let i = 0; i < 50 && g.state.phase.kind !== 'turn'; i++) {
    const ph = g.state.phase;
    if (ph.kind === 'exchangeChoice') g.chooseExchanges(ph.seat, 1, 1);
    else if (ph.kind === 'charleston') ais.map((a) => a.charlestonPass(g).map((t) => t.id)).forEach((ids, s) => g.charlestonPass(s, ids));
    else if (ph.kind === 'wallExchange') ais.map((a) => a.wallExchangePick(g).map((t) => t.id)).forEach((ids, s) => g.wallExchange(s, ids));
  }
  return g;
}
function setHand(g: MahjongGame, seat: number, spec: string) {
  const k = parseKinds(spec);
  const pl = g.players[seat];
  expect(pl.hand.length).toBe(k.length);
  pl.hand.forEach((t, i) => (t.kind = k[i]));
  (g as unknown as { seatShapeCache: unknown[] }).seatShapeCache = [];
}

describe('audit american: JongBot advice errors', () => {
  it('american joker swap: does not advise swapping away a tile needed for a pair (jokers cannot fill pairs)', () => {
    // NN EE WW SS RR GG 00, one Soap short. B exposed N N + joker. Trading our N for the joker breaks the NN pair.
    const { g, seat } = americanTurn('NN EE WW SS RdRd GdGd Wd 1m');
    g.players[(seat + 1) % 4].melds.push(pung('NN J'));
    expect(g.turnOptions(seat).jokerSwaps.length).toBe(1);
    const pl = g.players[seat];
    const best = (hand: typeof pl.hand) => Math.min(...hand.map((t) => distance(hand.filter((x) => x !== t), [])));
    const swapped = pl.hand.map((t) => (t.id === g.turnOptions(seat).jokerSwaps[0].tileId ? { ...t, kind: JOKER_KIND } : t));
    expect(best(swapped)).toBeGreaterThan(best(pl.hand)); // the swap really is worse (1 -> 2)
    const h = turnHint(g, seat, 'learning');
    expect(h.headline).not.toMatch(/^Swap/);
    expect(h.headline).toBe('Discard the 1 Character.');
  });

  it('wright-patterson charleston: advice does not call the every-hand Charleston a goulash after a wall game', () => {
    const { g } = wp(null);
    expect(g.state.phase.kind).toBe('charleston');
    expect(g.state.goulash).toBeFalsy();
    const h = charlestonHint(g, 0, 'learning');
    expect(h.why).not.toMatch(/goulash|wall game/i);
  });

  it('wright-patterson: an all-pairs route is named Heavenly Twins, not Li Gu Li Gu', () => {
    const { g, seat } = wp('1122m 3344p 55s 79s EN');
    const h = turnHint(g, seat, 'learning');
    expect(h.why).not.toMatch(/Lì Gǔ/);
    expect(h.why).toMatch(/Heavenly Twins/);
  });

  it('uae South small-card round: the Seven Pairs card hand is named as such, not Li Gu Li Gu', () => {
    const g = uaeRound(1);
    expect(g.profile.specialRound).toBe('smallCard');
    const seat = g.dealer;
    setHand(g, seat, '88m 22m 55m 33p 11s 4s 5p 7p 3s');
    const h = turnHint(g, seat, 'learning');
    expect(h.why ?? '').not.toMatch(/Lì Gǔ/);
  });

  it('uae West goulash round: a pung call is not refused for value (no chows, so every open hand is All Pungs = 3 faan)', () => {
    const g = uaeRound(2);
    expect(g.profile.specialRound).toBe('goulash');
    const seat = (g.dealer + 1) % 4;
    setHand(g, seat, '666p 777s 88s 22m 4m 7m 1s');
    const h = claimHint(g, seat, [{ type: 'pung' }], parseKinds('8s')[0], 'learning');
    expect(h.why).not.toMatch(/couldn't reach the 3 faan/);
    expect(h.action).toBe('pung');
  });

  it('uae East passport round: a pung call is not refused for value (every passport win scores at least 1 faan)', () => {
    const g = uaeRound(0);
    expect(g.profile.specialRound).toBe('passport');
    const seat = (g.dealer + 1) % 4;
    setHand(g, seat, 'E S W N Rd Gd 12m 55p 77s 9p');
    expect(currentShanten(g, seat)).toBe(1);
    const h = claimHint(g, seat, [{ type: 'pung' }], parseKinds('7s')[0], 'learning');
    expect(h.why).not.toMatch(/couldn't reach the 1 faan/);
    expect(h.action).toBe('pung'); // 6-passport + 777s + 55p + 12m: ready after the call
  });

  it('weak: american dead tile: a card hand whose last needed pair tile is all out is not "one tile from Mah Jongg"', () => {
    // Needs a second Soap for the 00 pair; the other three Soaps are in the discards.
    const { g, seat } = americanTurn('NN EE WW SS RdRd GdGd Wd 1m');
    g.players[(seat + 1) % 4].discards.push({ id: 7001, kind: 33 }, { id: 7002, kind: 33 }, { id: 7003, kind: 33 });
    const h = turnHint(g, seat, 'learning');
    expect(h.why).not.toMatch(/one tile from Mah Jongg/);
  });

  it('weak: american dead hand: the turn advice tells the player the hand is dead', () => {
    const { g, seat } = americanTurn('1m 2m 3m 4p 5p 6p 7s 8s 9s E S W N Rd');
    const pl = g.players[seat];
    pl.hand.splice(0, 6);
    pl.melds.push(pung('111m'), pung('RdRdRd'));
    expect(distance(pl.hand.slice(1), pl.melds)).toBe(Infinity);
    const h = turnHint(g, seat, 'learning');
    expect(`${h.headline} ${h.why ?? ''} ${h.warning ?? ''}`).toMatch(/dead/i);
  });
});
