import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { buildProfile } from '../src/club/sim';
import { parseKinds, KIND_COUNT, type Tile } from '../src/engine/tiles';
import { claimHint, turnHint } from '../src/ai/jongbot';
import { planDiscard } from '../src/ai/strategy';

/** Seat 0 (dealer, on turn) holds `hand`; extra `discards` are placed in seats' discard rows. */
function withHand(rs: string, hand: string, seed = 5, house: Record<string, string> = {}) {
  const p = buildProfile(rs, 'eastRound', house);
  const g = new MahjongGame(p, Array.from({ length: p.players }, (_, i) => 'P' + i), seed);
  g.startHand(seed);
  const kinds = parseKinds(hand);
  const pl = g.players[0];
  expect(g.state.phase.kind).toBe('turn');
  pl.hand.length = kinds.length;
  pl.hand.forEach((t, i) => (t.kind = kinds[i]));
  (g as unknown as { seatShapeCache: unknown[] }).seatShapeCache = [];
  return g;
}
let fake = 9000;
const discard = (g: MahjongGame, seat: number, kind: number) => {
  const t: Tile = { id: fake++, kind };
  g.players[seat].discards.push(t);
  g.players[seat].discardKinds.push(kind);
};

describe('riichi-family JongBot audit', () => {
  it('sanma: advises kita (set the North aside) instead of discarding the North', () => {
    const g = withHand('sanma', '123p 456p 789s 11s 34s N');
    expect(g.turnOptions(0).kita).toBe(true);
    const h = turnHint(g, 0, 'learning');
    // Discarding a North in sanma throws away a bonus dora; kita keeps it and draws a replacement.
    expect(h.headline).not.toBe('Discard the North Wind.');
    expect(`${h.headline} ${h.why}`).toMatch(/aside|kita/i);
  });

  it('riichi: open honitsu/toitoi is a yaku, so a pon of a non-value wind is not "no yaku, could never win"', () => {
    // Dealer (East seat, East round). South is not a value wind, but the hand is all Dots + honours.
    const g = withHand('riichi', '11p 234p 567p 99p SS NN 9p');
    g.players[0].hand.pop(); // 13 tiles, as when someone else discards
    const h = claimHint(g, 0, [{ type: 'pung' }], 28 /* South */, 'learning');
    expect(h.why ?? '').not.toMatch(/could never win/);
  });

  it('riichi: turn warning says "no yaku" for an open half-flush hand', () => {
    const g = withHand('riichi', '11p 234p 567p 9p N SSS 3p');
    const pl = g.players[0];
    const s = pl.hand.splice(11, 3); // the three Souths become an open pung
    pl.melds.push({ type: 'pung', tiles: s, concealed: false, from: 1, claimedId: s[0].id });
    (g as unknown as { seatShapeCache: unknown[] }).seatShapeCache = [];
    const h = turnHint(g, 0, 'learning');
    expect(h.warning ?? '').not.toMatch(/no yaku/);
  });

  it('korean3: riichi advice does not talk about han, ippatsu or ura dora (Korean riichi is +1 point, no deposit)', () => {
    const g = withHand('korean3', '123p 456p 789s 11s 34s Wd');
    const h = turnHint(g, 0, 'learning');
    expect(h.action).toBe('riichi');
    expect(h.why ?? '').not.toMatch(/\bhan\b|ippatsu|ura dora/);
  });

  it('korean (4p): same riichi text problem', () => {
    const g = withHand('korean', '123p 456p 789s 11s 34s Wd');
    const h = turnHint(g, 0, 'learning');
    expect(h.action).toBe('riichi');
    expect(h.why ?? '').not.toMatch(/\bhan\b|ippatsu|ura dora/);
  });

  it('korean3: claim text says "scores 1 points"', () => {
    const g = withHand('korean3', '123p 456p 789s 1s RdRd 3s 9p');
    g.players[0].hand.pop();
    const h = claimHint(g, 0, [{ type: 'pung' }], 31, 'learning');
    expect(h.action).toBe('pung');
    expect(h.why ?? '').not.toMatch(/1 points/);
  });

  it('riichi: furiten warning missing when the discarded wait has no live copies left', () => {
    // After the 1m goes: 678m 56p 789s 234s WdWd waits on 4p/7p. All four 4p are visible, one in our own discards.
    const g = withHand('riichi', '678m 56p 789s 234s WdWd 1m');
    discard(g, 0, 12);
    discard(g, 1, 12);
    discard(g, 1, 12);
    discard(g, 2, 12);
    expect(g.waitsOf).toBeDefined();
    const h = turnHint(g, 0, 'learning');
    expect(h.focusKind).toBe(0);
    expect(h.warning ?? '').toMatch(/Furiten/);
  });

  it('riichi: does not advise staying quiet (dama) on a furiten hand: it cannot win on a discard', () => {
    // 123456789p RdRd 23p after the 9s: waits 1p/4p, and a 4p is in our discards.
    const g = withHand('riichi', '123456789p RdRd 23p 9s');
    discard(g, 0, 12);
    const h = turnHint(g, 0, 'learning');
    expect(h.focusKind).toBe(26);
    expect(h.headline).not.toMatch(/stay quiet/);
  });

  it('riichi: keeps the red five rather than an equal plain five (tanki choice)', () => {
    const g = withHand('riichi', '123m 789m 111p 999s 5p 5s', 5);
    const pl = g.players[0];
    expect(g.state.red).toContain(52);
    // make the 5p the red one
    for (const p of g.players) for (const t of p.hand) if (t.id === 52) t.id = 8999;
    pl.hand[12].id = 52;
    const dora = g.doraKinds();
    expect(dora.includes(13) || dora.includes(22)).toBe(false);
    const h = turnHint(g, 0, 'learning');
    expect(h.focusKind).toBe(22); // let the plain 5s go, wait on the red 5p
  });

  it('three-seat games do not crash the advisor', () => {
    for (const rs of ['sanma', 'korean3']) {
      const g = withHand(rs, '123p 456p 789s 11s 34s E');
      expect(() => turnHint(g, 0, 'advanced')).not.toThrow();
      expect(planDiscard(g, 0).ranked.length).toBeGreaterThan(0);
    }
  });
});
void KIND_COUNT;
