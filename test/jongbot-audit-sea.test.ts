// JongBot audit (sea): Taiwanese, UAE Taiwanese, Singapore, Malaysian (4p/3p),
// Vietnamese, Kolkata Joker Club, Thai, Indonesian, Filipino, EMA, European.
// Each test asserts the correct behaviour; failing tests are open findings.
import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { buildProfile } from '../src/club/sim';
import { parseKinds, tileName } from '../src/engine/tiles';
import { claimHint, handStatus, turnHint } from '../src/ai/jongbot';
import type { Meld } from '../src/engine/state';

/**
 * A game of `id` where the dealer holds `hand` (14 tiles minus 3 per meld, on turn)
 * plus open `melds` (each a kinds spec). Returns the game and the dealer seat.
 */
function onTurn(id: string, hand: string, melds: string[] = [], house: Record<string, string> = {}, seed = 3) {
  const g = new MahjongGame(buildProfile(id, 'oneHand', house), ['A', 'B', 'C', 'D'].slice(0, buildProfile(id, 'oneHand', house).players), seed);
  g.startHand(seed);
  const seat = g.dealer;
  const pl = g.players[seat];
  pl.flowers = [];
  const ms: Meld[] = [];
  for (const m of melds) {
    const ks = parseKinds(m);
    const tiles = pl.hand.splice(0, ks.length);
    tiles.forEach((t, i) => (t.kind = ks[i]));
    ms.push({ type: ks[0] === ks[1] ? (ks.length === 4 ? 'kong' : 'pung') : 'chow', tiles, concealed: false, from: (seat + 3) % g.profile.players });
  }
  pl.melds = ms;
  const kinds = parseKinds(hand);
  expect(pl.hand.length).toBe(kinds.length);
  pl.hand.forEach((t, i) => (t.kind = kinds[i]));
  (g as unknown as { seatShapeCache: unknown[] }).seatShapeCache = [];
  return { g, seat };
}

/** Seat after the dealer holding a 13-tile hand (claim tests). */
function offTurn(id: string, hand: string, melds: string[] = [], house: Record<string, string> = {}, seed = 3) {
  const p = buildProfile(id, 'oneHand', house);
  const g = new MahjongGame(p, ['A', 'B', 'C', 'D'].slice(0, p.players), seed);
  g.startHand(seed);
  const seat = (g.dealer + 1) % p.players;
  const pl = g.players[seat];
  pl.flowers = [];
  const ms: Meld[] = [];
  for (const m of melds) {
    const ks = parseKinds(m);
    const tiles = pl.hand.splice(0, ks.length);
    tiles.forEach((t, i) => (t.kind = ks[i]));
    ms.push({ type: ks[0] === ks[1] ? 'pung' : 'chow', tiles, concealed: false, from: g.dealer });
  }
  pl.melds = ms;
  const kinds = parseKinds(hand);
  expect(pl.hand.length).toBe(kinds.length);
  pl.hand.forEach((t, i) => (t.kind = kinds[i]));
  return { g, seat };
}

/** Engine truth: the waits after discarding one `kind`, and those that can actually win (either way). */
function engineWaitsAfter(g: MahjongGame, seat: number, kind: number) {
  const pl = g.players[seat];
  const i = pl.hand.findIndex((t) => t.kind === kind);
  const [t] = pl.hand.splice(i, 1);
  const w = g.waitsOf(seat);
  const win = w.filter((k) => g.evaluateWin(seat, k, false, true) || g.evaluateWin(seat, k, true, true));
  pl.hand.splice(i, 0, t);
  return { w, win };
}

describe('Kolkata Joker Club: a joker may not make up the pair (jokerPair off, the default)', () => {
  it('the waits JongBot names are real waits (a joker cannot stand in the pair)', () => {
    // 123m 456m 789p 234s + Joker + East (drawn). Discarding East is right, but the
    // joker can only finish a set, so the waits are 1-6m, 7-9p, 1-4s (engine: 12 kinds).
    // JongBot listed 29 kinds (every honour, 7-9m, 1p, 5-6p ...) and "103 tiles".
    const { g, seat } = onTurn('indian', '123m 456m 789p 234s J E');
    const h = turnHint(g, seat, 'learning');
    const e = engineWaitsAfter(g, seat, parseKinds('E')[0]);
    const named = [...(h.why ?? '').matchAll(/(\d (?:Character|Dot|Bamboo)|\w+ Wind|\w+ Dragon) \(/g)].map((m) => m[1]);
    const real = e.w.map(tileName);
    expect(named.filter((n) => !real.includes(n))).toEqual([]);
  });

  it('jokers do not complete seven pairs (engine never reads a joker seven-pairs win)', () => {
    // From the fuzz run: 2 jokers + 4 natural pairs + 7p 8p 6m. JongBot said "You're ready".
    const { g, seat } = onTurn('indian', 'J J 77s 22m 78p 99s 22s 6m 1s');
    const h = turnHint(g, seat, 'learning');
    const e = engineWaitsAfter(g, seat, h.focusKind!);
    expect(e.w).toEqual([]);
    expect(h.why ?? '').not.toMatch(/You're ready|ready to win/);
  });
});

describe('EMA: eight fan to win', () => {
  it('does not call ready a hand that can never reach 8 fan', () => {
    // From the fuzz run: Green Dragon pung and 123m chow called; discarding 1p leaves
    // 345s 678m 2p single wait: Dragon Pung (2) + Single Wait (1) ... far below 8 fan.
    const { g, seat } = onTurn('ema', '345s 678m 12p', ['GdGdGd', '123m']);
    const h = turnHint(g, seat, 'learning');
    const e = engineWaitsAfter(g, seat, h.focusKind!);
    // If JongBot says "ready to win", at least one wait must be a legal win.
    if (/ready to win/.test(h.why ?? '')) expect(e.win.length).toBeGreaterThan(0);
  });

  it('does not advise a chow that leaves an open hand with no way to 8 fan', () => {
    // Green Dragon pung already called; a plain chow of 1m from the left. The hand
    // (mixed suits, no flush, no honours left) cannot reach 8 fan after the call.
    const { g, seat } = offTurn('ema', '23m 345s 678m 19p', ['GdGdGd']);
    const kind = parseKinds('1m')[0];
    const h = claimHint(g, seat, [{ type: 'chow', using: [kind + 1, kind + 2] }], kind, 'learning');
    expect(h.action).toBe('pass');
  });

  it('Knitted Straight with a called set is not mistaken for ready', () => {
    // From the fuzz run: 1p pung called. Concealed 345s 5s 1m 4m 7m 8s 3p 9p (+3s drawn).
    // The knitted 147m/369p/258s still lacks 6p and 2s; the engine finds no wait.
    const { g, seat } = onTurn('ema', '3455s 3s 1m 4m 7m 8s 3p 9p', ['111p']);
    const h = turnHint(g, seat, 'learning');
    const e = engineWaitsAfter(g, seat, h.focusKind!);
    expect(e.w).toEqual([]);
    expect(h.why ?? '').not.toMatch(/ready to win/);
  });
});

describe('Singapore: one tai to win', () => {
  it('a ready hand with no tai on any wait is not announced as "ready to win" without a warning', () => {
    // From the fuzz run: 333s 888p 44p 66s 567m + 2p; no flowers, no animals, no honours.
    // Discarding 2p waits on 4p/6s shanpon: no Ping Hu, no pungs of value: 0 tai, no win.
    const { g, seat } = onTurn('singapore', '333s 888p 44p 66s 567m 2p');
    const h = turnHint(g, seat, 'learning');
    const e = engineWaitsAfter(g, seat, h.focusKind!);
    // The advice must not promise a win the rules forbid (it may also pick another discard).
    if (e.w.length && !e.win.length) expect(h.why ?? '').not.toMatch(/You'll be ready to win/);
  });
});


describe('Vietnamese: typed jokers (Wind / Dragon / Number Joker)', () => {
  it('a Number Joker is not a free wild: JW + JN + WdWd is not ready', () => {
    // 123m 456m 789p + Wind Joker + Number Joker + White pair + 5s (drawn).
    // After 5s goes, JW (winds only) and JN (suits only) cannot make a set or the
    // pair together with any one draw: the engine finds no wait. JongBot said
    // "You'll be ready to win. Waiting on White Dragon" (fuzz run, open-hand version).
    const { g, seat } = onTurn('vietnamese', '123m 456m 789p JW JN WdWd 5s');
    const h = turnHint(g, seat, 'learning');
    const e = engineWaitsAfter(g, seat, h.focusKind!);
    expect(e.w).toEqual([]);
    expect(h.why ?? '').not.toMatch(/ready to win/);
  });
});

describe('Filipino: the all-pairs hand is Siete Pares', () => {
  it('names Siete Pares, not the Taiwanese Li Gu Li Gu', () => {
    // 16-tile hand (+1 drawn) of six pairs, a pung-able pair and junk: the pairs route is shortest.
    const { g, seat } = onTurn('filipino', '11m 22m 33p 44p 55s 66s EE 1s 5p 9m');
    const h = turnHint(g, seat, 'learning');
    expect(h.why ?? '').toMatch(/Go for/);
    expect(h.why ?? '').not.toMatch(/Lì Gǔ/);
    expect(h.why ?? '').toMatch(/Siete Pares/);
  });
});


describe('Claim text: "the set scores 1 <unit>"', () => {
  const rd = parseKinds('Rd')[0];
  it('European: a dragon pung doubles the score; "scores 1 points" is wrong (and bad grammar)', () => {
    const { g, seat } = offTurn('european', 'RdRd 123m 456p 78s 99s 1p');
    const h = claimHint(g, seat, [{ type: 'pung' }], rd, 'learning');
    expect(h.action).toBe('pung');
    expect(h.why ?? '').not.toMatch(/scores 1 points/);
  });
  it('Filipino: a dragon pung scores nothing, so the text must not claim it scores', () => {
    const { g, seat } = offTurn('filipino', 'RdRd 123m 456p 789s 11p 5s 9m 3s', []);
    const h = claimHint(g, seat, [{ type: 'pung' }], rd, 'learning');
    expect(h.why ?? '').not.toMatch(/the set scores/);
  });
  it('EMA: a Dragon Pung is 2 fan, not 1', () => {
    const { g, seat } = offTurn('ema', 'RdRd 123m 456p 78s 99s 1p');
    const h = claimHint(g, seat, [{ type: 'pung' }], rd, 'learning');
    expect(h.why ?? '').not.toMatch(/scores 1 fan/);
  });
});


describe('Kolkata Joker Club: a pung made with a joker', () => {
  it('the claim advice says the joker is used', () => {
    const rd = parseKinds('Rd')[0];
    const { g, seat } = offTurn('indian', 'Rd J 123m 456p 78s 99s 1p');
    const opts = g['claimOptionsFor' as never] as unknown;
    void opts;
    const h = claimHint(g, seat, [{ type: 'pung', using: [rd, parseKinds('J')[0]] }], rd, 'learning');
    expect(h.action).toBe('pung');
    expect(`${h.headline} ${h.why}`).toMatch(/[Jj]oker/);
  });
});

describe('Taiwanese: four of a kind in hand', () => {
  it('JongBot mentions the concealed kong it can declare', () => {
    const { g, seat } = onTurn('taiwanese', '1111m 234p 567s 789m 23s EE');
    expect(g.turnOptions(seat).kongs.length).toBe(1);
    const h = turnHint(g, seat, 'learning');
    console.log('kong case', h.headline, '|', h.why);
    expect(`${h.headline} ${h.why}`).toMatch(/[Kk]ong|Gang/);
  });
});

describe('log', () => {
  it('prints the hints for review', () => {
    for (const [id, hand, melds] of [
      ['indian', '123m 456m 789p 234s J E', []],
      ['indian', 'J J 77s 22m 78p 99s 22s 6m 1s', []],
      ['ema', '345s 678m 12p', ['GdGdGd', '123m']],
      ['ema', '3455s 3s 1m 4m 7m 8s 3p 9p', ['111p']],
      ['singapore', '333s 888p 44p 66s 567m 2p', []],
    ] as [string, string, string[]][]) {
      const { g, seat } = onTurn(id, hand, melds);
      const h = turnHint(g, seat, 'advanced');
      console.log(id, hand, '=>', h.headline, '|', h.why, '|', handStatus(g, seat), JSON.stringify(h.table));
      void tileName;
    }
  });
});
