// JongBot's advice in the India Rules special rounds: it must play to the round's
// own target (the seat's Small Card in the South round), not to an ordinary hand.
import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { withHouseRules } from '../src/engine/rules';
import { indiaProfile, BUY_PRICE } from '../src/engine/rules/india';
import { cardByName, SMALL_CARDS } from '../src/engine/rules/indiaCards';
import { parseKinds } from '../src/engine/tiles';
import { claimHint, turnHint } from '../src/ai/jongbot';
import { planDiscard } from '../src/ai/strategy';
import { AiPlayer } from '../src/ai/players';
import { playHandHeadless } from '../src/club/sim';

const SOUTH = withHouseRules(indiaProfile, { indiaRounds: 'S' });

/** Play the opening exchanges with bots, so the dealer is on turn. */
function toFirstTurn(g: MahjongGame) {
  const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, 'strategic', 'zen', s + 1));
  for (let i = 0; i < 50 && g.state.phase.kind !== 'turn'; i++) {
    const ph = g.state.phase;
    if (ph.kind === 'charleston') ais.map((ai) => ai.charlestonPass(g).map((t) => t.id)).forEach((ids, s) => g.charlestonPass(s, ids));
    else if (ph.kind === 'exchangeChoice') {
      const c = ais[ph.seat].exchangeChoice(g);
      g.chooseExchanges(ph.seat, c.passes, c.wall);
    } else if (ph.kind === 'cardPick') ais.forEach((ai, s) => g.pickCard(s, ai.cardPick(g)));
    else if (ph.kind === 'ticTacToe') ais.map((ai) => ai.ticTacToePick(g).map((t) => t.id)).forEach((ids, s) => g.ticTacToe(s, ids));
    else if (ph.kind === 'wallExchange') ais.map((ai) => ai.wallExchangePick(g).map((t) => t.id)).forEach((ids, s) => g.wallExchange(s, ids));
  }
  expect(g.state.phase.kind).toBe('turn');
}

/** Give `seat` this card and these tiles (14 for the seat on turn, 13 otherwise). */
function deal(g: MahjongGame, seat: number, card: string, hand: string) {
  g.state.cards![seat] = SMALL_CARDS.indexOf(cardByName(card)!);
  (g as unknown as { seatShapeCache: unknown[] }).seatShapeCache = [];
  const kinds = parseKinds(hand);
  const pl = g.players[seat];
  expect(kinds.length).toBe(pl.hand.length);
  pl.hand.forEach((t, i) => (t.kind = kinds[i]));
}

function southGame() {
  const g = new MahjongGame(SOUTH, ['A', 'B', 'C', 'D'], 11);
  g.startHand(11);
  toFirstTurn(g);
  return g;
}

const turnSeat = (g: MahjongGame) => (g.state.phase as { seat: number }).seat;
const TERMINALS = parseKinds('19m 19p 19s');

describe('JongBot plays to the Small Card (South round)', () => {
  it('Heads and Tails (the reported screenshot): throws a middle tile, never a 1 or 9', () => {
    const g = southGame();
    const s = turnSeat(g);
    deal(g, s, 'Heads and Tails', '456p 1579m 12p 129s WW');
    const h = turnHint(g, s, 'learning');
    expect(TERMINALS).not.toContain(h.focusKind);
    expect(parseKinds('W')).not.toContain(h.focusKind);
    expect(h.why).toContain('Heads and Tails');
    // Every tile the card can't use ranks above every tile it can.
    const ranked = planDiscard(g, s).ranked.map((c) => c.kind);
    const useful = [...TERMINALS, ...parseKinds('ESWN')];
    const firstUseful = ranked.findIndex((k) => useful.includes(k));
    expect(ranked.slice(firstUseful).every((k) => useful.includes(k))).toBe(true);
  });

  it('a one-suit card throws the other suits first', () => {
    const g = southGame();
    const s = turnSeat(g);
    deal(g, s, 'Purity Hand', '2244668m 13p 5s 99m EE');
    const h = turnHint(g, s, 'learning');
    expect(parseKinds('1p 3p 5s E')).toContain(h.focusKind);
  });
});

describe('Buying the left player’s discard (South round)', () => {
  /** Seat `s` discards a tile of `kind`; the seat on its right is the buyer. */
  function discardTo(g: MahjongGame, kind: string) {
    const s = turnSeat(g);
    const t = g.players[s].hand[0];
    t.kind = parseKinds(kind)[0];
    g.discard(s, t.id);
    return { from: s, buyer: (s + 1) % 4 };
  }

  it('offers the buy to the right-hand player only, and JongBot recommends it when the tile fits', () => {
    const g = southGame();
    const buyer = (turnSeat(g) + 1) % 4;
    deal(g, buyer, 'Heads and Tails', '111m 1p 9p 1s 9s 9m 23p 45s W');
    discardTo(g, '9m');
    const ph = g.state.phase;
    expect(ph.kind).toBe('claims');
    if (ph.kind !== 'claims') return;
    expect(ph.options[buyer].map((o) => o.type)).toContain('buy');
    for (const [s, o] of Object.entries(ph.options)) if (+s !== buyer) expect(o.map((x) => x.type)).not.toContain('buy');
    const h = claimHint(g, buyer, ph.options[buyer], parseKinds('9m')[0], 'learning');
    expect(h.action).toBe('buy');
    expect(h.headline).toBe(`Buy the 9 Character for ${BUY_PRICE}.`);
    expect(h.why).toContain('Heads and Tails');
  });

  it('says pass when the tile is no use to the card', () => {
    const g = southGame();
    const buyer = (turnSeat(g) + 1) % 4;
    deal(g, buyer, 'Heads and Tails', '111m 1p 9p 1s 9s 9m 23p 45s W');
    discardTo(g, '5p');
    const ph = g.state.phase;
    if (ph.kind !== 'claims') return; // nobody could even buy: fine
    const opts = ph.options[buyer];
    const h = claimHint(g, buyer, opts, parseKinds('5p')[0], 'learning');
    expect(h.action).toBe('pass');
  });

  it('a bought tile goes into the hand concealed, and its price into the bank', () => {
    const g = southGame();
    const buyer = (turnSeat(g) + 1) % 4;
    deal(g, buyer, 'Heads and Tails', '111m 1p 9p 1s 9s 9m 23p 45s W');
    const { from } = discardTo(g, '9m');
    const before = g.players[buyer].score;
    for (const s of g.pendingClaimSeats()) g.respond(s, s === buyer ? { type: 'buy' } : { type: 'pass' });
    const ph = g.state.phase;
    expect(ph.kind === 'turn' && ph.seat === buyer && ph.mustDiscardOnly).toBe(true);
    const pl = g.players[buyer];
    expect(pl.hand.length).toBe(14);
    expect(pl.melds.length).toBe(0);
    expect(pl.score).toBe(before - BUY_PRICE);
    expect(g.state.riichiPot).toBe(BUY_PRICE);
    expect(g.players[from].discards.length).toBe(0);
    expect(g.turnOptions(buyer).canWin).toBe(false);
  });

  it('bots buy and play whole hands, and points stay whole', () => {
    let buys = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const g = new MahjongGame(SOUTH, ['A', 'B', 'C', 'D'], seed);
      g.on((e) => {
        if (e.type === 'buy') buys++;
      });
      g.startHand(seed);
      const total = g.players.reduce((a, p) => a + p.score, 0) + g.state.riichiPot;
      expect(playHandHeadless(g, [0, 1, 2, 3].map((s) => new AiPlayer(s, 'strategic', 'zen', seed * 10 + s)))).toBe(true);
      expect(g.players.reduce((a, p) => a + p.score, 0) + g.state.riichiPot).toBe(total);
    }
    expect(buys).toBeGreaterThan(0);
  }, 120_000);
});
