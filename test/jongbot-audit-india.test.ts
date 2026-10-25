import { AiPlayer } from '../src/ai/players';
// JongBot audit, India Rules (East Passport, South Small Cards, West Goulash).
// Each test asserts the CORRECT behaviour and currently fails.
import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { SMALL_CARDS, cardByName, cardShanten } from '../src/engine/rules/indiaCards';
import { parseKinds, toCounts } from '../src/engine/tiles';
import { claimHint, charlestonHint, turnHint } from '../src/ai/jongbot';
import { scoreWith } from '../src/ai/strategy';
import type { RuleProfile } from '../src/engine/rules/types';
import { EAST, SOUTH, WEST, exactMissing, setHand, southAt, toTurn } from './helpers-india';

const K = (s: string) => parseKinds(s)[0];

function at(profile: RuleProfile, hand: string, seed = 11) {
  const g = new MahjongGame(profile, ['A', 'B', 'C', 'D'], seed);
  g.startHand(seed);
  toTurn(g);
  const seat = g.dealer;
  setHand(g, seat, hand);
  g.players.forEach((p) => (p.flowers = []));
  return { g, seat };
}
/** Seat right of the dealer facing the dealer's discard `discard`. */
function claimAt(profile: RuleProfile, hand: string, discard: string, card?: string) {
  const { g, seat: d } = at(profile, '123m 456m 789m 12p 4p 99s');
  const seat = (d + 1) % 4;
  if (card) g.state.cards![seat] = SMALL_CARDS.indexOf(cardByName(card)!);
  setHand(g, seat, hand);
  const k = K(discard);
  const opts = (g as unknown as { claimOptionsFor: (s: number, d: number, t: { id: number; kind: number }) => never[] }).claimOptionsFor(seat, d, { id: 9999, kind: k });
  return { g, seat, opts, h: claimHint(g, seat, opts, k, 'learning') };
}
/** South: the recommended discard must not leave the hand further from the card than the best discard. */
function southDiscardOk(card: string, hand: string) {
  const { g, seat } = southAt(card, hand);
  const c = toCounts(g.players[seat].hand.map((t) => t.kind));
  const cd = cardByName(card)!;
  const sw = 27 + 'ESWN'.indexOf(g.state.seatWinds[seat]);
  const rw = 27 + 'ESWN'.indexOf(g.prevailing);
  const after = (k: number) => { const x = c.slice(); x[k]--; return exactMissing(cd, x, sw, rw); };
  const best = Math.min(...[...new Set(g.players[seat].hand.map((t) => t.kind))].map(after));
  const h = turnHint(g, seat, 'advanced');
  return { h, got: after(h.focusKind!), best };
}

describe('India South (Small Cards): card distance search (indiaCards.ts missing(), top-3 pruning)', () => {
  it('All Pair Major Hand: keeps the six pairs and throws the 3 Character', () => {
    const r = southDiscardOk('All Pair Major Hand', '1m 1m 9p 9p 1s 3m EE NN RdRd WdWd');
    expect(r.h.headline).toBe('Discard the 3 Character.'); // JongBot: "Discard the 1 Bamboo", "0 tiles still out there"
    expect(r.got).toBe(r.best);
  });
  it('Knitting: never throws a tile of a finished knit', () => {
    const r = southDiscardOk('Knitting', '1m 1s 1p 3s 3s 4s 5m 5s 5m 5s 8m 8s 9m 9s');
    expect(r.got).toBe(r.best); // JongBot throws the 8 Character
  });
  it('Heavenly Twins: one pair short is 1 tile from ready, not 13', () => {
    const { g, seat } = southAt('Heavenly Twins', '1s 1s Rd 3s Gd 4s 5s 5s 6s 6s 8s 8s 9s 9s');
    const h = turnHint(g, seat, 'learning');
    expect(h.why).toContain('1 tile from ready'); // JongBot: "13 tiles from ready"
  });
  it('Heavenly Twins: cardShanten agrees with an exhaustive count', () => {
    const c = toCounts(parseKinds('1s 2s 3s 3s 4s 4s 5s 5s 6s 6s 8s 8s 9s 9s'));
    expect(cardShanten(cardByName('Heavenly Twins')!, c, [], 27, 28)).toBe(0); // gives 1
  });
  it('All Pair Major Hand: never prints "99 tiles from ready"', () => {
    const { g, seat } = southAt('All Pair Major Hand', '5p 1m 9p 9p 1s 8m EE NN RdRd WdWd');
    const h = turnHint(g, seat, 'learning');
    expect(h.why).not.toMatch(/99 tiles/);
  });
});

describe('India South: claims (shantenAfterCall -> cardShape.shanten returns 99 for a hypothetical meld)', () => {
  it('Western Command: pungs the Red Dragon that makes the hand ready', () => {
    const { h, opts } = claimAt(SOUTH, '555p EEE RdRd 123m 9s 4p', 'Rd', 'Western Command');
    expect(opts.length).toBeGreaterThan(0);
    expect(h.action).toBe('pung'); // JongBot: Pass
  });
  it('Hovering Angels: chows the 6 Bamboo from the left to get ready', () => {
    const { h } = claimAt(SOUTH, 'SSS Rd 123m 456p 78s Wd', '6s', 'Hovering Angels');
    expect(h.action).toBe('chow');
  });
  it('Red Lantern: pungs the Red Dragon', () => {
    const { h } = claimAt(SOUTH, 'RdRd SSS 1234567p 1m', 'Rd', 'Red Lantern');
    expect(h.action).toBe('pung');
  });
  it('Four Blessings: pungs the North Wind', () => {
    const { h } = claimAt(SOUTH, 'EEE SSS WWW NN 5p 6p', 'N', 'Four Blessings');
    expect(h.action).toBe('pung');
  });
});

describe('India South: value and phase text', () => {
  it('scoreWith values a winning card hand (strategy.ts scoreWith leaves out ctx.card)', () => {
    const { g, seat } = southAt('Western Command', '555p EEE RdRdRd 123m 99s');
    const c = g.naturalCounts(g.players[seat].hand);
    expect(g.turnOptions(seat).canWin).toBe(true);
    expect(scoreWith(g, seat, c, K('9s'), true, false)).not.toBeNull(); // null: every South wait is valued 0
  });
  it('exchange advice does not call the Small Card round a Goulash round with no chows', () => {
    const g = new MahjongGame(SOUTH, ['A', 'B', 'C', 'D'], 3);
    g.startHand(3);
    const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, 'casual', 'zen', s + 1));
    if (g.state.phase.kind === 'cardPick') ais.forEach((ai, s) => g.pickCard(s, ai.cardPick(g)));
    expect(g.state.phase.kind).toBe('charleston');
    expect(charlestonHint(g, 0, 'learning').why).not.toMatch(/Goulash|no chows/);
  });
});

describe('India East (Passport)', () => {
  // The two compulsory-passport cases went to the rules thread: the engine itself accepts the hand (see the note there).
  it('NEWS + another wind passport: throws the Red Dragon (ready on 6/9 Bamboo), not a wind', () => {
    const { g, seat } = at(EAST, 'ESWN E 123m 456p 78s Rd');
    expect(turnHint(g, seat, 'learning').headline).toBe('Discard the Red Dragon.'); // JongBot: South Wind
  });
  it('GRW + honour pair passport: throws the 1 Dot (ready on East), not East', () => {
    const { g, seat } = at(EAST, 'RdGdWd E 123m 456p 789s 1p');
    expect(turnHint(g, seat, 'learning').headline).toBe('Discard the 1 Dot.'); // JongBot: East Wind
  });
  it('(weak) 6+6+2 passport: says ready after the Red Dragon goes, not "1 tile from ready"', () => {
    const { g, seat } = at(EAST, '11m 33m 55m 22m 44p 66s 8p Rd');
    expect(turnHint(g, seat, 'learning').why).toMatch(/ready to win/);
  });
});

describe('India West (Goulash)', () => {
  it('a dirty (two-suit) pung hand is not "ready to win"', () => {
    const { g, seat } = at(WEST, '222m 555m 777m 33p 44p Rd');
    expect(turnHint(g, seat, 'learning').why).not.toMatch(/ready to win/);
  });
  it('terminal hand: pungs the 1 Dot (offCleanSuit treats it as off-suit)', () => {
    const { h } = claimAt(WEST, '111m 999m 11p 99s 9p E 1s', '1p');
    expect(h.action).toBe('pung'); // JongBot: Pass, "couldn't reach the 3 doubles"
  });
  it('does not pung a non-scoring North Wind that leaves at most 1 double', () => {
    const { g, seat, h } = claimAt(WEST, '222m 444m 66m 88m NN 5m', 'N');
    expect(g.state.seatWinds[seat]).toBe('S');
    expect(h.action).toBe('pass'); // concealed it wins with 3+ (concealed Mahjong); exposed it never reaches 3
  });
  it('does not pung a Red Dragon that gives up concealed Mahjong and leaves at most 2 doubles', () => {
    const { h } = claimAt(WEST, '222m 444m 66m 88m RdRd 5m', 'Rd');
    expect(h.action).toBe('pass');
  });
});
