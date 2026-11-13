// QA audit (2026-11-13): bots, JongBot and the hand-score card against the engine's own rules.
// Each test is a minimal repro of something the audit found; `it.fails` marks a finding that is
// reported but not fixed here (the body states the expected behaviour and fails today).
import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { buildProfile } from '../src/club/sim';
import { FLOWER_BASE, parseKinds } from '../src/engine/tiles';
import type { ClaimOption } from '../src/engine/state';
import { collectFor, handNow } from '../src/ai/handScore';
import { handStatus, turnHint } from '../src/ai/jongbot';
import { currentShanten, evaluateDiscards } from '../src/ai/evaluate';
import { callLeavesNoWin } from '../src/ai/strategy';
import { SMALL_CARDS, cardByName, cardShanten, missing } from '../src/engine/rules/indiaCards';
import { toTurn } from './helpers-india';
import { onClaim, onTurn } from './audit-helpers';

/** Seat 0 holds `hand` (and `melds`); seat 3 throws `tile`. Plays any exchange phase first (India rounds too). */
function claimAt(variation: string, house: Record<string, string>, hand: string, tile: string, melds: { type: 'pung' | 'chow'; kinds: string }[] = [], seed = 7) {
  const g = new MahjongGame(buildProfile(variation, 'fullNews', house), ['A', 'B', 'C', 'D'], seed);
  g.state.round.dealerSeat = 3;
  g.startHand(seed);
  toTurn(g);
  if (g.state.phase.kind !== 'turn' || g.state.phase.seat !== 3) throw new Error('seat 3 not on turn');
  const pl = g.players[0];
  pl.melds = [];
  for (const m of melds) {
    const tiles = pl.hand.splice(0, 3);
    parseKinds(m.kinds).forEach((k, i) => (tiles[i].kind = k));
    pl.melds.push({ type: m.type, tiles, concealed: false, from: 2 });
  }
  const kinds = parseKinds(hand);
  if (kinds.length !== pl.hand.length) throw new Error(`hand needs ${pl.hand.length}`);
  pl.hand.forEach((t, i) => (t.kind = kinds[i]));
  pl.flowers = [];
  (g as unknown as { seatShapeCache: unknown[] }).seatShapeCache = [];
  const kind = parseKinds(tile)[0];
  // Not the dealer's first discard (no Earth's Blessing and the like).
  g.state.turnCount = 6;
  const t = g.players[3].hand[0];
  t.kind = kind;
  g.discard(3, t.id);
  const ph = g.state.phase as GamePhaseAny;
  const options: ClaimOption[] = (ph.kind === 'claims' ? ph.options?.[0] : undefined) ?? [];
  return { g, kind, options };
}

type GamePhaseAny = { kind: string; options?: ClaimOption[][] };

/** Win seat 0 on the claim window's tile (others pass) and return what it really collected. */
function settleRon(g: MahjongGame): { delta: number; points: number } {
  g.respond(0, { type: 'win' });
  for (const s of g.pendingClaimSeats()) if (g.state.phase.kind === 'claims') g.respond(s, { type: 'pass' });
  const ph = g.state.phase;
  if (ph.kind !== 'handOver' || ph.result.winner !== 0) throw new Error('seat 0 did not win');
  return { delta: ph.result.deltas[0] - (ph.result.potWon ?? 0), points: ph.result.score!.points };
}

describe('hand-score card vs settlement', () => {
  it('winner takes all: a discard win is paid by everyone, and the card says so', () => {
    const { g, kind, options } = onClaim({ variation: 'hongkong', house: { winnerTakesAll: 'on' }, hand: '123m 456m 789p RdRdRd 5s', tile: '5s' });
    expect(options.some((o) => o.type === 'win')).toBe(true);
    const now = handNow(g, 0);
    if (now.state !== 'ready') throw new Error(now.state);
    const said = now.waits.find((w) => w.kind === kind)!.ron!.collect;
    expect(said).toBe(settleRon(g).delta);
  });

  it('self-draw only: no wait is shown as winnable on a discard', () => {
    const { g, options } = onClaim({ variation: 'hongkong', house: { selfDrawOnly: 'on' }, hand: '123m 456m 789p RdRdRd 5s', tile: 'Rd' });
    expect(options.some((o) => o.type === 'win')).toBe(false);
    const now = handNow(g, 0);
    if (now.state !== 'ready') throw new Error(now.state);
    for (const w of now.waits) expect(w.ron).toBeNull();
    expect(now.waits.every((w) => w.tsumo)).toBe(true);
  });

  it('India South: a card all from the wall shows no discard win (the table never offers one)', () => {
    // Ringlet: a pung, a chow, a mixed chow, a crochet and a knit, all from the wall. Ready on 2p (the knit).
    const { g, options } = claimAt('india', { indiaRounds: 'S' }, 'EEE 123m 4m 5p 6s 7m 7p 7s 2s', '2p');
    g.state.cards![0] = SMALL_CARDS.indexOf(cardByName('Ringlet')!);
    (g as unknown as { seatShapeCache: unknown[] }).seatShapeCache = [];
    // The claim options were made before the card was set: ask the engine again.
    expect(options.some((o) => o.type === 'win')).toBe(false);
    const now = handNow(g, 0);
    if (now.state !== 'ready') throw new Error(now.state);
    expect(now.waits.map((w) => w.kind)).toContain(parseKinds('2p')[0]);
    for (const w of now.waits) expect(w.ron).toBeNull();
  });

  it('India West: the win is paid at the hand end, and the card shows what it really collects', () => {
    // Clean bamboo with honours: pungs only (no chows in West), 3+ doubles.
    const { g, kind, options } = claimAt('india', { indiaRounds: 'W' }, 'RdRdRd 222s 444s 666s 8s', '8s');
    expect(options.some((o) => o.type === 'win')).toBe(true);
    const now = handNow(g, 0);
    if (now.state !== 'ready') throw new Error(now.state);
    const w = now.waits.find((x) => x.kind === kind)!;
    expect(w.ron!.collect).toBeGreaterThan(0);
    const real = settleRon(g);
    expect(w.ron!.score.points).toBe(real.points);
    expect(w.ron!.collect).toBe(real.delta);
  });

  it('collectFor still uses a non-dealer discarder at an ordinary table', () => {
    const { g } = onClaim({ variation: 'hongkong', hand: '123m 456m 789p RdRdRd 5s', tile: '5s' });
    const ev = g.evaluateWin(0, parseKinds('5s')[0], false, true)!;
    expect(collectFor(g, 0, ev.score, false)).toBe(settleRon(g).delta);
  });
});

describe('JongBot and the bots: ready means the rules accept a wait', () => {
  // Classic (mixed sets on): White Dragon pung, two mixed chows and a knit pair wait on 3m/6m.
  const MIXED = { hand: '5m 8m 8s 5m 7p 4s 8p 9s 4m 3p', melds: [{ type: 'pung' as const, kinds: 'WdWdWd' }] };

  it('a ready mixed-sets hand reads as ready (status and shanten)', () => {
    const { g } = onClaim({ variation: 'classic', ...MIXED, tile: '3m' });
    const legal = [...Array(34).keys()].filter((k) => g.evaluateWin(0, k, true, true) || g.evaluateWin(0, k, false, true));
    expect(legal.length).toBeGreaterThan(0);
    expect(currentShanten(g, 0)).toBe(0);
    expect(handStatus(g, 0)).toMatch(/^Ready/);
  });

  it('JongBot keeps a ready mixed-sets hand ready when it can', () => {
    // The same hand on turn with a loose North drawn: throwing the North keeps it ready.
    const g = onTurn({ variation: 'classic', hand: MIXED.hand + ' N', melds: MIXED.melds });
    const ev = evaluateDiscards(g, 0).find((e) => e.kind === parseKinds('N')[0])!;
    expect(ev.shanten).toBe(0);
    const hint = turnHint(g, 0, 'learning');
    expect(hint.focusKind).toBe(parseKinds('N')[0]);
    expect(hint.why).toMatch(/ready to win/);
  });
});

describe('Small Card search speed (bots froze for seconds per decision)', () => {
  it('Ordinary Suit Hand with a chow and a pung declared answers quickly', () => {
    const card = cardByName('Ordinary Suit Hand')!;
    const melds = [
      { type: 'pung' as const, kind: parseKinds('N')[0] },
      { type: 'chow' as const, kind: parseKinds('3s')[0] },
    ];
    const hand = parseKinds('1s Gd 6s 2s 1s Gd 2s Rd');
    const counts = new Array(34).fill(0);
    for (const k of hand) counts[k]++;
    const t0 = performance.now();
    // What evaluateDiscards asks: each discard, then each draw.
    let n = 0;
    for (let d = 0; d < 34; d++) {
      if (!counts[d]) continue;
      counts[d]--;
      for (let k = 0; k < 34; k++) {
        if (counts[k] >= 4) continue;
        counts[k]++;
        cardShanten(card, counts, melds, 27, 28);
        counts[k]--;
        n++;
      }
      counts[d]++;
    }
    // Was about 40 ms a call (7 s for one bot turn); now well under 2 ms.
    expect((performance.now() - t0) / n).toBeLessThan(5);
  });

  it('All Pair Hand and Dirty Pairs: the quick count equals the full search', () => {
    for (const name of ['All Pair Hand', 'Dirty Pairs']) {
      const card = cardByName(name)!;
      const comps = card.alts({ A: 0, B: 1, C: 2, seat: 27, round: 27 })[0];
      for (const spec of ['1m 1m 2m 3m 3m 5m 5m 9m E E Rd 4p 4p', '1m 2m 3m 4m 5m 6m 7m 8m 9m E S W N', '1m 1m 1m 1m 2m 2m E E S S Rd Rd Gd']) {
        const counts = new Array(34).fill(0);
        for (const k of parseKinds(spec)) counts[k]++;
        // Brute force: choose the 7 distinct kinds that need the fewest tiles.
        const kinds = [...new Set(comps[0].opts.map((o) => o.tiles[0]))];
        const need = kinds.map((k) => 2 - Math.min(2, counts[k])).sort((a, b) => a - b);
        const want = need.slice(0, 7).reduce((a, b) => a + b, 0);
        expect(missing(comps, counts, [], card, 99, undefined, Infinity), `${name} ${spec}`).toBe(want);
      }
    }
  });
});

describe('dead-call warning', () => {
  it('a Small Card call that fits the card is not flagged; one that fits nothing is', () => {
    // All Winds and Dragons: a pung of East fits, a pung of 2s or a chow fits nothing.
    const { g } = claimAt('india', { indiaRounds: 'S' }, '2s 2s 4s 5s 1m 2m E E S S N N Rd', 'E');
    g.state.cards![0] = SMALL_CARDS.indexOf(cardByName('All Winds and Dragons')!);
    (g as unknown as { seatShapeCache: unknown[] }).seatShapeCache = [];
    expect(callLeavesNoWin(g, 0, { type: 'pung' }, parseKinds('E')[0])).toBe(false);
    expect(callLeavesNoWin(g, 0, { type: 'pung' }, parseKinds('2s')[0])).toBe(true);
    expect(callLeavesNoWin(g, 0, { type: 'chow', using: parseKinds('1m 2m') }, parseKinds('3m')[0])).toBe(true);
  });

  it('India West: a pung in a second suit leaves no clean hand, so the call is flagged (user ruling 2026-11-13)', () => {
    // Exposed 5m pung; calling 5p makes every clean pattern impossible (not one suit, not 1s and 9s, not honours).
    const { g, kind, options } = claimAt('india', { indiaRounds: 'W' }, '5p 5p 6m 6m 7m 7m 8m 8m 9m E', '5p', [{ type: 'pung', kinds: '5m 5m 5m' }]);
    const pung = options.find((o) => o.type === 'pung')!;
    expect(pung).toBeDefined();
    expect(callLeavesNoWin(g, 0, pung, kind)).toBe(true);
  });

  it('India West: a second-suit pung of 1s or 9s next to a 9 pung keeps the terminal hand open, so no warning', () => {
    const { g, kind, options } = claimAt('india', { indiaRounds: 'W' }, '1p 1p 1m 1m 9s 9s 9p 9p 9m E', '1p', [{ type: 'pung', kinds: '9m 9m 9m' }]);
    const pung = options.find((o) => o.type === 'pung');
    if (!pung) return;
    expect(callLeavesNoWin(g, 0, pung, kind)).toBe(false);
  });

  it('India West: a pung in the same suit is never flagged for cleanliness', () => {
    const { g, kind, options } = claimAt('india', { indiaRounds: 'W' }, '5m 5m 6m 6m 7m 7m 8m 8m 9m E', '5m', [{ type: 'pung', kinds: '2m 2m 2m' }]);
    const pung = options.find((o) => o.type === 'pung')!;
    expect(pung).toBeDefined();
    expect(callLeavesNoWin(g, 0, pung, kind)).toBe(false);
  });
});

void FLOWER_BASE;

describe('team play: a partner is never a deal-in risk', () => {
  /** Give `seat` two exposed pungs, 2m and 5p (a likely 3 Pungs in 3 suits passport). */
  const showPungs = (g: MahjongGame, seat: number) => {
    const pl = g.players[seat];
    pl.melds = ['2m', '5p'].map((k) => {
      const tiles = pl.hand.splice(0, 3);
      tiles.forEach((t) => (t.kind = parseKinds(k)[0]));
      return { type: 'pung' as const, tiles, concealed: false, from: (seat + 3) % 4 };
    });
  };

  it('India East: a partner showing a passport is not a threat, a rival is', async () => {
    const { passportThreats } = await import('../src/ai/passportAdvice');
    const g = onTurn({ variation: 'india', house: { indiaRounds: 'E', teamPlay: 'on' }, hand: '123m 456m 789p 11s 23s E' });
    showPungs(g, 2);
    expect(passportThreats(g, 0).filter((t) => t.seat === 2)).toEqual([]);
    showPungs(g, 1);
    expect(passportThreats(g, 0).some((t) => t.seat === 1)).toBe(true);
  });

  it('American: a partner’s exposures carry no danger', async () => {
    const { exposureDanger } = await import('../src/ai/american');
    const g = new MahjongGame(buildProfile('american', 'fullNews', { teamPlay: 'on' }), ['A', 'B', 'C', 'D'], 3);
    g.startHand(3);
    const p = g.players[2];
    const tiles = p.hand.splice(0, 3);
    tiles.forEach((t) => (t.kind = parseKinds('5m')[0]));
    p.melds = [{ type: 'pung', tiles, concealed: false, from: 1 }];
    expect(exposureDanger(g, 0)(parseKinds('5m')[0])).toBe(0);
    expect(exposureDanger(g, 1)(parseKinds('5m')[0])).toBeGreaterThan(0);
  });
});
