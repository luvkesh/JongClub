// QA audit, second pass (2026-11-13): bots, JongBot and the hand-score card against the engine's own
// win test. Each test is a minimal repro of something the retest found and fixed.
import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { withHouseRules } from '../src/engine/rules';
import { indiaProfile, northBig } from '../src/engine/rules/india';
import { BIG_CARDS, bigGroups } from '../src/engine/rules/indiaBig';
import { SMALL_CARDS, cardByName, cardShanten, missing } from '../src/engine/rules/indiaCards';
import { buildProfile } from '../src/club/sim';
import type { ClaimOption } from '../src/engine/state';
import { parseKinds, type Tile } from '../src/engine/tiles';
import { setsShanten } from '../src/engine/hand';
import type { Meld } from '../src/engine/state';
import { currentShanten, currentWaits, winningWaits } from '../src/ai/evaluate';
import { claimHint, handStatus, turnHint } from '../src/ai/jongbot';
import { handNow } from '../src/ai/handScore';
import { AiPlayer } from '../src/ai/players';
import { southAt, toTurn } from './helpers-india';
import { onTurn } from './audit-helpers';

const k = (s: string) => parseKinds(s)[0];

/** Seat 0 holds `hand` with Small Card `card`; seat 3 throws `tile`. Returns seat 0's claim options. */
function claimAt(variation: string, house: Record<string, string>, hand: string, tile: string, card: string, seed = 7) {
  const g = new MahjongGame(buildProfile(variation, 'fullNews', house), ['A', 'B', 'C', 'D'], seed);
  g.state.round.dealerSeat = 3;
  g.startHand(seed);
  toTurn(g);
  if (g.state.phase.kind !== 'turn' || g.state.phase.seat !== 3) throw new Error('seat 3 not on turn');
  g.state.cards![0] = SMALL_CARDS.indexOf(cardByName(card)!);
  const pl = g.players[0];
  parseKinds(hand).forEach((x, i) => (pl.hand[i].kind = x));
  pl.flowers = [];
  (g as unknown as { seatShapeCache: unknown[] }).seatShapeCache = [];
  g.state.turnCount = 6;
  const t = g.players[3].hand[0];
  t.kind = k(tile);
  g.discard(3, t.id);
  const ph = g.state.phase as import('../src/engine/state').Phase;
  const options: ClaimOption[] = ph.kind === 'claims' ? (ph.options[0] ?? []) : [];
  return { g, options };
}

/** Every kind the engine would let `seat` win on with the hand as it is (13-tile view). */
function legalWaits(g: MahjongGame, seat: number): number[] {
  const out: number[] = [];
  for (let w = 0; w < 34; w++) if (g.evaluateWin(seat, w, false, true) || g.evaluateWin(seat, w, true, true)) out.push(w);
  return out;
}

describe('India Rules North, Big Cards: JongBot sees a ready hand', () => {
  /** East holds Terminal Chows (card 2) laid down from its picture, one tile short. */
  function bigReady() {
    const n = 2;
    const card = BIG_CARDS[n - 1];
    const g = new MahjongGame(withHouseRules(indiaProfile, { indiaRounds: 'N' }), ['A', 'B', 'C', 'D'], 5);
    g.startHand(5);
    g.chooseRound(g.dealer, northBig(n));
    toTurn(g);
    const seat = g.dealer;
    const pl = g.players[seat];
    let id = 500;
    let hand: Tile[] = parseKinds(card.picture).map((kind) => ({ id: id++, kind }));
    pl.melds = [];
    for (let i = 0; i < 8; i++) {
      const gr = bigGroups(card, hand, g.bigMelds(seat), g.bigCtx(seat))
        .filter((x) => x.extend === undefined && !x.wild.length)
        .sort((a, b) => b.as.length - a.as.length)[0];
      if (!gr) break;
      const tiles = hand.filter((t) => gr.ids.includes(t.id));
      pl.melds.push({ type: 'kong', big: gr.type === 'kong' ? undefined : gr.type, tiles, concealed: false } as Meld);
      hand = hand.filter((t) => !gr.ids.includes(t.id));
    }
    pl.hand = hand;
    (g as unknown as { seatShapeCache: unknown[] }).seatShapeCache = [];
    return { g, seat };
  }

  it('one tile short reads as ready, waiting on exactly the tiles that win', () => {
    const { g, seat } = bigReady();
    const pl = g.players[seat];
    const last = pl.hand.pop()!;
    // The next player is on turn: this seat waits with its 13-tile view.
    const ph = g.state.phase;
    if (ph.kind === 'turn') g.state.phase = { ...ph, seat: (seat + 1) % 4, drawn: null };
    const legal = legalWaits(g, seat);
    expect(legal).toContain(last.kind);
    expect(currentShanten(g, seat)).toBe(0);
    expect(currentWaits(g, seat)).toEqual(legal);
    expect(handStatus(g, seat)).toMatch(/^Ready/);
  });

  it('the hand-score card shows the discard win on another player’s turn (Big Card groups hold 4+ tiles)', () => {
    const { g, seat } = bigReady();
    const last = g.players[seat].hand.pop()!;
    const ph = g.state.phase;
    if (ph.kind !== 'turn') throw new Error(ph.kind);
    g.state.phase = { ...ph, seat: (seat + 1) % 4, drawn: null };
    const now = handNow(g, seat);
    if (now.state !== 'ready') throw new Error(now.state);
    const w = now.waits.find((x) => x.kind === last.kind)!;
    expect(w.ron?.score.points).toBe(g.evaluateWin(seat, last.kind, false, true)!.score.points);
  });

  it('JongBot never advises breaking the ready hand (it threw a tile the card needs)', () => {
    const { g, seat } = bigReady();
    const pl = g.players[seat];
    pl.hand.pop();
    // A loose tile the card has no use for comes in.
    const loose = { id: 900, kind: k('9p') };
    pl.hand.push(loose);
    (g.state.phase as { drawn: Tile }).drawn = loose;
    const hint = turnHint(g, seat, 'learning');
    expect(hint.focusKind).toBe(k('9p'));
    expect(hint.why).toMatch(/ready to win/);
    const now = handNow(g, seat);
    expect(now.state).toBe('discard');
    if (now.state === 'discard') expect(now.options.map((o) => o.discard)).toEqual([k('9p')]);
  });
});

describe('wild tiles: a ready hand also wins on a drawn joker', () => {
  it('Shanghai: the wild kind is a wait, by self-draw only (a discarded joker is dead)', () => {
    const g = onTurn({ variation: 'shanghai', hand: '123m 456m 789p 11s 23s N', wild: [k('Wd')] });
    const ws = winningWaits(g, 0, k('N'));
    expect(ws).toContain(k('Wd'));
    expect(ws).toContain(k('1s'));
    const now = handNow(g, 0);
    if (now.state !== 'discard') throw new Error(now.state);
    const opt = now.options.find((o) => o.discard === k('N'))!;
    const wd = opt.waits.find((w) => w.kind === k('Wd'))!;
    expect(wd.tsumo).not.toBeNull();
    expect(wd.ron).toBeNull();
    expect(opt.waits.find((w) => w.kind === k('1s'))!.ron).not.toBeNull();
  });
});

describe('claim advice names the chow when there is more than one', () => {
  it('India South, A Run, A Pung and A Pair: only 4-5-6 fits the card, and JongBot says so', () => {
    // The card's runs are 1-2-3, 4-5-6 and 7-8-9: chowing the 4 with 2-3 or 3-5 fits nothing.
    const { g, options } = claimAt('india', { indiaRounds: 'S' }, '8m 7m 8m 7m 8m 9m 3m 2m 6m 5m 6m 7m 7m', '4m', 'A Run, A Pung and A Pair');
    const chows = options.filter((o) => o.type === 'chow');
    expect(chows.length).toBe(3);
    const hint = claimHint(g, 0, options, k('4m'), 'learning');
    expect(hint.action).toBe('chow');
    expect(hint.headline).toMatch(/with the 5 Character and 6 Character/);
  });
});

describe('JongBot in riichi', () => {
  it('names the waits of the hand without the drawn tile (it read the 14 tiles and listed none)', () => {
    const g = onTurn({ variation: 'riichi', hand: '123m 456m 789p 11s 23s N' });
    g.players[0].riichi = true;
    const hint = turnHint(g, 0, 'learning');
    expect(hint.why).toBe('Waiting on 1 Bamboo, 4 Bamboo. You can still win on any of them.');
  });
});

describe('a wait on a tile you hold every copy of is no wait', () => {
  it('Classic: a single wait on the 2 Character beside an exposed pung of it', () => {
    const g = onTurn({ variation: 'classic', hand: '2m 345p 678s 999s N', melds: [{ type: 'pung', kinds: '2m 2m 2m' }] });
    expect(winningWaits(g, 0, k('N'))).not.toContain(k('2m'));
    const now = handNow(g, 0);
    if (now.state !== 'discard') throw new Error(now.state);
    expect(now.options.find((o) => o.discard === k('N'))?.waits.map((w) => w.kind) ?? []).not.toContain(k('2m'));
  });
});

describe('Small Card speed: A Joker Hand', () => {
  const card = cardByName('A Joker Hand')!;
  const comps = card.alts({ A: 0, B: 1, C: 2, seat: 27, round: 28 })[0];
  const counts = (s: string) => {
    const c = new Array(34).fill(0);
    for (const x of parseKinds(s)) c[x]++;
    return c;
  };

  it('the quick count equals the full search, ready hands included', () => {
    for (const s of ['1m 3m 4m 7m 2p 2p 6p 6p 7p 8p 1s 3s 5s 5s', '1m 4m 7m 2p 5p 8p 3s 6s 9s E S W N Rd', '123m 456m 789m 11p 22p 3s', '1m 2p 3s 4m 5p 6s 5m 5p 5s E E E Rd', '1m 1m 2m 2m 3p 3p 4s 4s E E S S Rd', '2m 3p 4s 7m 7p 7s 9m 9m 9m 1s 2s 3s 5p']) {
      const c = counts(s);
      expect(cardShanten(card, c, [], 27, 28), s).toBe(missing(comps, c.slice(), [], card, 99, undefined, Infinity) - 1);
    }
  });

  it('sets beyond those still needed are not progress (the count read a non-hand as complete)', () => {
    // 6-7-8 Dots left over once four sets are set aside: still a pair short.
    expect(setsShanten(counts('6p 7p 8p'), 4, 4)).toBe(0);
    expect(cardShanten(card, counts('1m 3m 4m 7m 2p 2p 6p 6p 7p 8p 1s 3s 5s 5s'), [], 27, 28)).toBe(0);
  });

  it('Buried Treasure (all hidden) reads four pungs and a pair quickly, as the full search does', () => {
    const bt = cardByName('Buried Treasure (all hidden)')!;
    const btComps = bt.alts({ A: 0, B: 1, C: 2, seat: 27, round: 28 })[0];
    for (const s of ['4m 5s 6p 3s 4p 9m 9m 4m 8p 5p 8s 2m 2p 2p', '1m 1m 1m 5p 5p E E E Rd Rd 9s 9s 2s', '1m 2m 3m 4m 5m 6m 7m 8m 9m 1p 2p 3p 4p']) {
      const c = counts(s);
      expect(cardShanten(bt, c, [], 27, 28), s).toBe(missing(btComps, c.slice(), [], bt, 99, undefined, Infinity) - 1);
    }
  });

  it('a bot turn on a scattered hand stays quick', () => {
    const { g, seat } = southAt('A Joker Hand', '1m 4m 7m 2p 5p 8p 3s 6s 9s E S W N Rd');
    const ai = new AiPlayer(seat, 'expert', 'teacher', 1);
    const t0 = performance.now();
    ai.decideTurn(g);
    turnHint(g, seat, 'advanced');
    // Was about 1.5 s for the bot alone (cards rebuilt and searched on every check).
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});
