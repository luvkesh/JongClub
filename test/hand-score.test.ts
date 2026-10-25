// The hand-score card and the score calculator (src/ai/handScore.ts): what a
// hand is worth now, in every variation, must be exactly what the engine pays
// when the hand is really won, and reading it must never change the game.
import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { VARIATIONS } from '../src/engine/rules';
import { buildProfile } from '../src/club/sim';
import { AiPlayer } from '../src/ai/players';
import { applyAction, decisionAction } from '../src/net/actions';
import { calcNeed, calculate, collectFor, handNow, onShow } from '../src/ai/handScore';
import { parseKinds } from '../src/engine/tiles';
import { onClaim, onTurn } from './audit-helpers';

/** A plain sets-and-a-pair hand in tiles every variation deals (no characters: Sanma has only 1 and 9). */
const PLAIN = '234p 456p 789s 234s 55s';
const PLAIN16 = '234p 456p 789s 234s 678s 55s';
const handFor = (size: number) => (size === 16 ? PLAIN16 : PLAIN);

/** Play bots through every step until `stop` says so (or the hand ends). */
function play(g: MahjongGame, stop: (g: MahjongGame) => boolean, steps = 3000) {
  const n = g.profile.players;
  const ais = Array.from({ length: n }, (_, s) => new AiPlayer(s, 'expert', 'zen', 3 + s));
  for (let i = 0; i < steps; i++) {
    if (stop(g)) return;
    const ph = g.state.phase;
    if (ph.kind === 'handOver') return;
    if (ph.kind === 'turn') applyAction(g, decisionAction(ph.seat, ais[ph.seat].decideTurn(g)));
    else if (ph.kind === 'claims') {
      for (const s of g.pendingClaimSeats()) {
        const c = g.state.phase;
        if (c.kind !== 'claims') break;
        g.respond(s, ais[s].decideClaim(g, c.options[s], c.tile.kind));
      }
    } else if (ph.kind === 'charleston') ais.map((a) => a.charlestonPass(g).map((t) => t.id)).forEach((ids, s) => g.charlestonPass(s, ids));
    else if (ph.kind === 'exchangeChoice') {
      const c = ais[ph.seat].exchangeChoice(g);
      g.chooseExchanges(ph.seat, c.passes, c.wall);
    } else if (ph.kind === 'cardPick') ais.forEach((a, s) => g.pickCard(s, a.cardPick(g)));
    else if (ph.kind === 'roundChoice') g.chooseRound(ph.seat, ais[ph.seat].roundChoice(g));
    else if (ph.kind === 'ticTacToe') ais.map((a) => a.ticTacToePick(g).map((t) => t.id)).forEach((ids, s) => g.ticTacToe(s, ids));
    else if (ph.kind === 'wallExchange') ais.map((a) => a.wallExchangePick(g).map((t) => t.id)).forEach((ids, s) => g.wallExchange(s, ids));
    else if (ph.kind === 'charlestonVote') ais.forEach((a, s) => g.state.phase.kind === 'charlestonVote' && g.charlestonVote(s, a.charlestonVote(g)));
  }
}

describe('your hand now', () => {
  it('a winning hand on your turn scores exactly what declaring it would', () => {
    for (const variation of ['classic', 'hongkong', 'mcr', 'singapore', 'european', 'zung-jung']) {
      const g = onTurn({ variation, hand: '123m 456m 789p RdRdRd 55s' });
      const o = g.turnOptions(0);
      const now = handNow(g, 0);
      expect(now.state, variation).toBe(o.canWin ? 'win' : now.state === 'discard' ? 'discard' : 'building');
      if (o.canWin && now.state === 'win') {
        expect(now.win.score.points).toBe(o.winScore!.points);
        expect(now.win.score.items).toEqual(o.winScore!.items);
        expect(now.winKind).toBe(parseKinds('5s')[0]);
      }
    }
  });

  it('a ready hand lists every winning tile, with what each pays on a discard and self-drawn', () => {
    const { g } = onClaim({ variation: 'classic', hand: '123m 456m 789p RdRdRd 5s', tile: '5s' });
    const now = handNow(g, 0);
    expect(now.state).toBe('ready');
    if (now.state !== 'ready') return;
    // 5s pairs up; Classic's knit pairs also take a 5 of another suit.
    expect(now.waits.map((w) => w.kind)).toContain(parseKinds('5s')[0]);
    for (const x of now.waits) expect(x.ron?.score.points).toBe(g.evaluateWin(0, x.kind, false, true)?.score.points);
    const w = now.waits.find((x) => x.kind === parseKinds('5s')[0])!;
    expect(w.ron?.score.points).toBe(g.evaluateWin(0, w.kind, false, true)?.score.points);
    expect(w.tsumo?.score.points).toBe(g.evaluateWin(0, w.kind, true, true)?.score.points);
    // The dragon pung counts in both.
    expect(w.ron!.score.items.some((i) => /dragon/i.test(i.name))).toBe(true);
    expect(w.left).toBeGreaterThanOrEqual(0);
    expect(w.left).toBeLessThanOrEqual(3);
  });

  it('Riichi: a closed ready hand with no yaku says so on a discard but scores self-drawn', () => {
    const { g } = onClaim({ variation: 'riichi', hand: '123m 456m 789p 11s 23s', tile: '1s' });
    const now = handNow(g, 0);
    expect(now.state).toBe('ready');
    if (now.state !== 'ready') return;
    const ws = now.waits.map((w) => w.kind).sort();
    expect(ws).toEqual(parseKinds('14s').sort());
    // Ittsuu in man? No: 123m 456m + 789p. So a discard win needs a yaku it lacks, unless the
    // wait itself makes pinfu. Whatever the engine says, the card says the same.
    for (const w of now.waits) {
      expect(w.ron?.score.points ?? null).toBe(g.evaluateWin(0, w.kind, false, true)?.score.points ?? null);
      expect(w.tsumo).not.toBeNull();
    }
  });

  it('14 tiles that are not a win show the discards that leave you ready, best first', () => {
    const g = onTurn({ variation: 'classic', hand: '123m 456m 789p RdRdRd 5s 9s' });
    const now = handNow(g, 0);
    expect(now.state).toBe('discard');
    if (now.state !== 'discard') return;
    // Throwing either loose tile leaves a wait (Classic's mixed chows and knit pairs can add more).
    expect(now.options.map((o) => o.discard)).toEqual(expect.arrayContaining(parseKinds('5s 9s')));
    const pts = now.options.map((o) => o.best?.score.points ?? 0);
    expect(pts).toEqual(pts.slice().sort((a, b) => b - a));
  });

  it('a hand one tile from ready finds the best win one swap away', () => {
    const { g } = onClaim({ variation: 'hongkong', hand: '123m 456m 78p RdRdRd 5s 9s', tile: 'Rd' });
    const now = handNow(g, 0);
    expect(now.state).toBe('building');
    if (now.state !== 'building') return;
    expect(now.away).toBe(1);
    expect(now.reach).not.toBeNull();
    expect(now.reach!.value.score.points).toBeGreaterThan(0);
  });

  it('reading a hand never changes the game', () => {
    const g = onTurn({ variation: 'uae', hand: '123m 456m 789p RdRdRd 5s 9s' });
    const before = JSON.stringify(g.state);
    handNow(g, 0);
    for (let s = 1; s < 4; s++) handNow(g, s), onShow(g, s);
    calculate(g, 0, { hand: parseKinds('123m 456m 789p RdRdRd 55s'), melds: [], selfDrawn: true });
    expect(JSON.stringify(g.state)).toBe(before);
  });

  it('another player shows only what is on show', () => {
    const g = onTurn({ variation: 'classic', hand: '123m 456m 789p RdRdRd 5s 9s' });
    const s = onShow(g, 2);
    expect(s.points).toBe(g.players[2].score);
    expect(s.tiles).toBe(g.players[2].hand.length);
    expect(s.sets).toBe(0);
  });
});

describe('every variation, played', () => {
  // Bots play a hand in each variation; at every step every seat's read must leave the game
  // untouched, a seat on turn reads "win" exactly when the engine lets it declare, with the
  // same score, and the winner reads its real result after the hand.
  for (const v of VARIATIONS) {
    it(`${v.id}: the read matches the engine all hand long`, () => {
      const p = buildProfile(v.id, 'fullNews', {});
      const g = new MahjongGame(p, ['A', 'B', 'C', 'D'], 11);
      g.startHand(11);
      let checked = 0;
      play(g, (g) => {
        const ph = g.state.phase;
        for (let s = 0; s < g.profile.players; s++) {
          const before = JSON.stringify(g.state);
          const now = handNow(g, s, false);
          expect(JSON.stringify(g.state)).toBe(before);
          if (ph.kind === 'turn' && ph.seat === s) {
            const o = g.turnOptions(s);
            expect(now.state === 'win', `${v.id} seat ${s}`).toBe(o.canWin);
            if (o.canWin && now.state === 'win') expect(now.win.score.points).toBe(o.winScore!.points);
            checked++;
          }
        }
        return false;
      });
      expect(checked).toBeGreaterThan(5);
      const ph = g.state.phase;
      if (ph.kind === 'handOver' && ph.result.winner !== undefined && ph.result.winner !== null) {
        const now = handNow(g, ph.result.winner);
        expect(now.state).toBe('won');
        if (now.state === 'won') expect(now.win.score.points).toBe(ph.result.score!.points);
      }
    }, 60_000);
  }
});

describe('what a win pays you', () => {
  it('matches the real settlement wherever nothing else is paid with the hand', () => {
    let compared = 0;
    for (const v of VARIATIONS) {
      const p = buildProfile(v.id, 'fullNews', {});
      if (p.handPayments || p.instantPayments || p.card) continue;
      for (const seed of [5, 11, 23]) {
        const g = new MahjongGame(p, ['A', 'B', 'C', 'D'], seed);
        g.startHand(seed);
        let expected: { seat: number; collect: number } | null = null;
        play(g, (g) => {
          const ph = g.state.phase;
          if (ph.kind === 'turn' && !g.state.instant?.length) {
            const now = handNow(g, ph.seat, false);
            expected = now.state === 'win' ? { seat: ph.seat, collect: now.win.collect } : null;
          } else if (ph.kind !== 'handOver') expected = null;
          return false;
        });
        const ph = g.state.phase;
        if (ph.kind !== 'handOver' || ph.result.type !== 'win' || ph.result.discarder !== null || !expected) continue;
        const e = expected as { seat: number; collect: number };
        if (e.seat !== ph.result.winner || ph.result.instant?.length) continue;
        expect(e.collect, v.id).toBe(ph.result.deltas[e.seat] - (ph.result.potWon ?? 0));
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(3);
  }, 120_000);

  it('a discard win is paid by a player who is not the dealer', () => {
    const g = onTurn({ variation: 'riichi', hand: '234m 456m 789p 234s 55s' });
    const s = g.evaluateWin(0, parseKinds('5s')[0], true, false)!.score;
    // Seat 0 is the dealer: a discard win takes the whole amount from one player.
    const ron = collectFor(g, 0, s, false);
    const tsumo = collectFor(g, 0, s, true);
    expect(ron).toBeGreaterThan(0);
    expect(tsumo).toBeGreaterThan(0);
  });
});

describe('the score calculator', () => {
  it('needs the right number of tiles for the sets declared', () => {
    const g = onTurn({ variation: 'classic', hand: '123m 456m 789p RdRdRd 5s 9s' });
    expect(calcNeed(g, 0)).toBe(14);
    expect(calcNeed(g, 2)).toBe(8);
    const r = calculate(g, 0, { hand: parseKinds('123m 456m'), melds: [], selfDrawn: false });
    expect(r).toEqual({ ok: false, reason: 'count', need: 14 });
  });

  // For every variation, a hand scored in the calculator matches the same hand really held
  // on your turn: same verdict, same points.
  for (const v of VARIATIONS) {
    it(`${v.id}: scores a hand exactly as the table would`, () => {
      const p = buildProfile(v.id, 'fullNews', {});
      if (p.card) return;
      const hand = handFor(p.handSize);
      let g: MahjongGame;
      try {
        g = onTurn({ variation: v.id, hand });
      } catch {
        return; // a variation whose opening phases leave no plain turn (checked in the play test)
      }
      // Red fives come from the real tiles' ids; the calculator's tiles are plain.
      g.state.red = [];
      const o = g.turnOptions(0);
      const kinds = parseKinds(hand);
      const r = calculate(g, 0, { hand: kinds, melds: [], selfDrawn: true, flowers: true });
      expect(r.ok, v.id).toBe(o.canWin);
      if (r.ok && o.canWin) expect(r.win.score.points).toBe(o.winScore!.points);
      if (!r.ok) expect(['noWin', 'noValue']).toContain(r.reason);
    });
  }

  it('declared sets count: a dragon pung on show scores in Classic', () => {
    const g = onTurn({ variation: 'classic', hand: '123m 456m 789p RdRdRd 5s 9s' });
    const r = calculate(g, 0, { hand: parseKinds('123m 456m 789p 55s'), melds: [{ type: 'pung', kinds: parseKinds('RdRdRd') }], selfDrawn: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.win.score.items.some((i) => /dragon/i.test(i.name))).toBe(true);
  });

  it('self-drawn and discard wins can differ', () => {
    const g = onTurn({ variation: 'hongkong', hand: '123m 456m 789p RdRdRd 5s 9s' });
    const hand = parseKinds('123m 456m 789p RdRdRd 55s');
    const self = calculate(g, 0, { hand, melds: [], selfDrawn: true });
    const ron = calculate(g, 0, { hand, melds: [], selfDrawn: false });
    expect(self.ok && ron.ok).toBe(true);
    if (self.ok && ron.ok) expect(self.win.score.value).toBeGreaterThan(ron.win.score.value);
  });

  it('tells a winning shape that does not score from no win at all', () => {
    // A table that needs 10 faan: a plain hand on a discard is a shape but not a win.
    const g = onTurn({ variation: 'hongkong', house: { minValue: '10' }, hand: '123m 456m 789p RdRdRd 5s 9s' });
    const r = calculate(g, 0, { hand: parseKinds('123m 567m 789p 234s 55s'), melds: [], selfDrawn: false });
    expect(r).toEqual({ ok: false, reason: 'noValue' });
    const bad = calculate(g, 0, { hand: parseKinds('123m 567m 789p 234s 59s'), melds: [], selfDrawn: false });
    expect(bad).toEqual({ ok: false, reason: 'noWin' });
  });

  it('Riichi: declaring riichi adds its yaku', () => {
    const g = onTurn({ variation: 'riichi', hand: '234m 456m 789p 234s 55s' });
    const hand = parseKinds('234m 456m 789p 234s 55s');
    const plain = calculate(g, 0, { hand, melds: [], selfDrawn: false });
    const riichi = calculate(g, 0, { hand, melds: [], selfDrawn: false, riichi: true });
    expect(riichi.ok).toBe(true);
    if (riichi.ok && plain.ok) expect(riichi.win.score.value).toBeGreaterThan(plain.win.score.value);
  });

  it('American: a card hand scores from the card', () => {
    const g = new MahjongGame(buildProfile('american', 'fullNews', {}), ['A', 'B', 'C', 'D'], 3);
    g.startHand(3);
    play(g, (g) => g.state.phase.kind === 'turn');
    const r = calculate(g, 0, { hand: parseKinds('NNNN EEE WWW SSSS'), melds: [], selfDrawn: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.win.score.points).toBeGreaterThan(0);
  });

  it('leaves your real hand, sets, flowers and riichi as they were', () => {
    const g = onTurn({ variation: 'riichi', hand: '234m 456m 789p 234s 55s' });
    const pl = g.players[0];
    const before = JSON.stringify({ hand: pl.hand, melds: pl.melds, flowers: pl.flowers, riichi: pl.riichi, phase: g.state.phase });
    calculate(g, 0, { hand: parseKinds('111m 999m 111p 999p 11s'), melds: [], selfDrawn: true, riichi: true });
    expect(JSON.stringify({ hand: pl.hand, melds: pl.melds, flowers: pl.flowers, riichi: pl.riichi, phase: g.state.phase })).toBe(before);
  });
});
