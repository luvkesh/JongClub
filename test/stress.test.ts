// Mass simulation across every variation: AI and random-but-legal players on
// many seeds, random house rules and game lengths. After every action the
// table is checked: every tile id accounted for exactly once, hand sizes,
// zero-sum scores (riichi sticks included), legal phases, and the round
// framework. Recorded matches must replay to identical positions.
// STRESS_N raises the seeds per variation (default 20).

import { describe, expect, it } from 'vitest';
import { AiPlayer, type Difficulty, type Personality } from '../src/ai/players';
import { MahjongGame } from '../src/engine/game';
import { Rng } from '../src/engine/rng';
import type { GameLength } from '../src/engine/rounds';
import { VARIATIONS } from '../src/engine/rules';
import type { RuleProfile } from '../src/engine/rules/types';
import type { ClaimResponse, GameState } from '../src/engine/state';
import { isJoker, kindOfTileId } from '../src/engine/tiles';
import { charlestonHint, claimHint, handStatus, turnHint } from '../src/ai/jongbot';
import { reviewClaim, reviewDiscard } from '../src/ai/review';
import { applyAction, decisionAction, handSeed, type Action } from '../src/net/actions';
import { decodeAction, encodeAction } from '../src/net/lockstep';
import { profileFor, replayHand, type ReplayRecord } from '../src/net/replay';
import type { TableConfig } from '../src/ui/match';

declare const process: { env: Record<string, string | undefined> };
const FULL = !!Number(process.env.STRESS_N ?? 0);
const N = Number(process.env.STRESS_N ?? 0) || 20;
const MAX_HANDS = Number(process.env.STRESS_MAX_HANDS ?? 0) || 120;

const LENGTHS: GameLength[] = ['oneHand', 'eastRound', 'eastSouth', 'fullNews'];
const DIFFS: Difficulty[] = ['beginner', 'casual', 'strategic', 'expert'];
const PERS: Personality[] = ['teacher', 'shark', 'wall', 'gambler', 'zen'];

/** Every physical tile on the table, wherever it is. Throws on a duplicate. */
export function tableIds(s: GameState): number[] {
  const ids: number[] = [];
  for (const p of s.players) {
    for (const t of p.hand) ids.push(t.id);
    for (const t of p.discards) ids.push(t.id);
    for (const t of p.flowers) ids.push(t.id);
    for (const m of p.melds) for (const t of m.tiles) ids.push(t.id);
  }
  for (let i = s.drawnFromFront; i < s.wall.length - s.drawnFromBack; i++) ids.push(s.wall[i].id);
  if (s.phase.kind === 'claims' && s.phase.robKong) ids.push(s.phase.tile.id);
  for (const t of s.outOfPlay ?? []) ids.push(t.id);
  return ids.sort((a, b) => a - b);
}

/** Check the table after an action. Returns a problem description, or null. */
export function checkInvariants(g: MahjongGame, startTotal: number): string | null {
  const s = g.state;
  const p = g.profile;
  const ids = tableIds(s);
  const expected = s.wallOrder.slice().sort((a, b) => a - b);
  if (ids.join() !== expected.join()) return `tile conservation broken: ${ids.length} on table vs ${expected.length} in set`;
  for (const t of s.wall) if (kindOfTileId(t.id) !== t.kind) return `tile ${t.id} has kind ${t.kind}`;
  if (s.drawnFromFront + s.drawnFromBack > s.wall.length) return 'drew past the wall';
  if (g.liveRemaining < 0) return `live wall negative (${g.liveRemaining})`;
  // Zero-sum: every payment is a transfer; riichi sticks wait in the pot.
  const total = s.players.reduce((a, pl) => a + pl.score, 0) + s.riichiPot;
  if (Math.abs(total - startTotal) > 1e-6) return `scores not zero-sum: ${total} vs ${startTotal}`;
  for (const pl of s.players) if (!Number.isFinite(pl.score)) return `score not finite: ${pl.score}`;
  // Hand sizes: a set counts three, kongs included (Asian); American melds count tile for tile.
  const size = (seat: number) => {
    const pl = s.players[seat];
    // Big Cards: a laid-down group counts its tiles less the extra tiles it drew.
    const meldTiles = pl.melds.reduce((a, m) => a + (p.card ? m.tiles.length : p.big ? m.tiles.length - (m.extras ?? 0) : 3), 0);
    return pl.hand.length + meldTiles;
  };
  const ph = s.phase;
  if (ph.kind === 'handOver') return null;
  for (const pl of s.players) {
    if (!p.card && pl.hand.some((t) => g.isBonus(t.kind))) return `seat ${pl.seat} holds a bonus tile`;
    for (const m of pl.melds) {
      if (m.big === 'qwong' && m.tiles.length !== 5) return 'qwong without five tiles';
      if (m.big === 'run' && m.tiles.length < 4) return 'run under four tiles';
      if (!p.card && !m.big && m.type === 'kong' && m.tiles.length !== 4) return 'kong without four tiles';
      if (m.type !== 'kong' && m.tiles.length !== 3) return `${m.type} with ${m.tiles.length} tiles`;
    }
  }
  if (ph.kind === 'turn') {
    for (let seat = 0; seat < p.players; seat++) {
      const want = seat === ph.seat ? p.handSize + 1 : p.handSize;
      if (size(seat) !== want) return `turn: seat ${seat} holds ${size(seat)}, want ${want}`;
    }
    if (ph.drawn && !s.players[ph.seat].hand.some((t) => t.id === ph.drawn!.id)) return 'drawn tile not in hand';
    const opts = g.turnOptions(ph.seat);
    if (!opts.discards.length && !opts.canWin) return 'turn with nothing to do';
  } else if (ph.kind === 'claims') {
    for (let seat = 0; seat < p.players; seat++) if (size(seat) !== p.handSize) return `claims: seat ${seat} holds ${size(seat)}`;
    if (!Object.keys(ph.options).length) return 'claim window with no options';
    if (!ph.robKong) {
      const d = s.players[ph.discarder];
      if (d.discards[d.discards.length - 1]?.id !== ph.tile.id) return 'claimed tile is not the last discard';
    }
  } else if (ph.kind === 'charleston' || ph.kind === 'charlestonVote' || ph.kind === 'exchangeChoice' || ph.kind === 'wallExchange' || ph.kind === 'ticTacToe' || ph.kind === 'cardPick') {
    for (let seat = 0; seat < p.players; seat++) {
      const want = seat === g.dealer ? p.handSize + 1 : p.handSize;
      if (size(seat) !== want) return `charleston: seat ${seat} holds ${size(seat)}`;
    }
  }
  return null;
}

/** A player that picks uniformly among legal actions (exercises rare paths). */
export class ChaosPlayer {
  private rng: Rng;
  constructor(
    readonly seat: number,
    seed: number,
  ) {
    this.rng = new Rng(seed);
  }
  private pick<T>(a: T[]): T {
    return a[this.rng.int(a.length)];
  }
  turn(g: MahjongGame): Action {
    const o = g.turnOptions(this.seat);
    const r = this.rng.next();
    if (o.canWin && r < 0.7) return { t: 'w', s: this.seat };
    if (o.nineTerminals && r < 0.5) return { t: 'a', s: this.seat };
    if (o.kita && r < 0.6) return { t: 'n', s: this.seat };
    if (o.kongs.length && r < 0.5) return { t: 'k', s: this.seat, k: this.pick(o.kongs) };
    if (o.jokerSwaps.length && r < 0.5) {
      const x = this.pick(o.jokerSwaps);
      return { t: 'j', s: this.seat, o: x.owner, m: x.meld, id: x.tileId };
    }
    if (o.riichiDiscards.length && r < 0.6) return { t: 'd', s: this.seat, id: this.pick(o.riichiDiscards), r: 1 };
    return { t: 'd', s: this.seat, id: this.pick(o.discards).id };
  }
  claim(g: MahjongGame): ClaimResponse {
    const ph = g.state.phase;
    if (ph.kind !== 'claims') throw new Error('no claim');
    const opts = ph.options[this.seat];
    if (opts.some((o) => o.type === 'win') && this.rng.next() < 0.8) return { type: 'win' };
    if (this.rng.next() < 0.5) return { type: 'pass' };
    return this.pick(opts);
  }
  charleston(g: MahjongGame): number[] {
    const hand = g.players[this.seat].hand.filter((t) => g.state.goulash || !isJoker(t.kind));
    const ids = hand.map((t) => t.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = this.rng.int(i + 1);
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids.slice(0, 3);
  }
  vote(): boolean {
    return this.rng.next() < 0.5;
  }
}

export function randomHouseRules(p: RuleProfile, rng: Rng): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of p.houseRules) out[r.id] = r.options[rng.int(r.options.length)].value;
  return out;
}

interface Seat {
  ai?: AiPlayer;
  chaos?: ChaosPlayer;
}

/** Play a whole match, checking invariants after every action. */
export function stressMatch(variation: string, seed: number, opts: { length?: GameLength; houseRules?: Record<string, string>; chaos?: number; probe?: (g: MahjongGame, a: Action) => void } = {}) {
  const rng = new Rng(seed * 31 + 7);
  const base = VARIATIONS.find((v) => v.id === variation)!.profile!;
  const length = opts.length ?? LENGTHS[rng.int(LENGTHS.length)];
  const houseRules = opts.houseRules ?? (rng.next() < 0.7 ? randomHouseRules(base, rng) : {});
  const config = { variation, length, houseRules } as unknown as TableConfig;
  const profile = profileFor(config);
  const g = new MahjongGame(profile, ['A', 'B', 'C', 'D'], seed);
  const n = profile.players;
  const startTotal = g.players.reduce((a, p) => a + p.score, 0);
  const chaos = opts.chaos ?? 0.35;
  const hands: Action[][] = [];
  const finals: GameState[] = [];
  const fail = (msg: string, h: number) => {
    throw new Error(`${variation} seed ${seed} ${length} ${JSON.stringify(houseRules)} hand ${h}: ${msg}`);
  };
  let h = 0;
  for (; h < MAX_HANDS; h++) {
    const seats: Seat[] = Array.from({ length: n }, (_, s) => s).map((s) =>
      rng.next() < chaos ? { chaos: new ChaosPlayer(s, handSeed(seed + s, h)) } : { ai: new AiPlayer(s, DIFFS[rng.int(4)], PERS[rng.int(5)], handSeed(seed + s * 101, h)) },
    );
    const roundBefore = structuredClone(g.state.round);
    g.startHand(handSeed(seed, h));
    const log: Action[] = [];
    const act = (a: Action) => {
      if (opts.probe) {
        try {
          opts.probe(g, a);
        } catch (e) {
          fail(`probe before ${JSON.stringify(a)} failed: ${(e as Error).stack}`, h);
        }
      }
      log.push(a);
      // Lockstep wire format: every action survives encode/decode unchanged.
      const wire = decodeAction(encodeAction(a));
      if (JSON.stringify(wire) !== JSON.stringify(a)) fail(`lockstep encoding changed ${JSON.stringify(a)} into ${JSON.stringify(wire)}`, h);
      try {
        applyAction(g, a);
      } catch (e) {
        fail(`action ${JSON.stringify(a)} threw: ${(e as Error).message}`, h);
      }
      const bad = checkInvariants(g, startTotal);
      if (bad) fail(`after ${JSON.stringify(a)}: ${bad}`, h);
    };
    const bad0 = checkInvariants(g, startTotal);
    if (bad0) fail(`after deal: ${bad0}`, h);
    let steps = 0;
    while (g.state.phase.kind !== 'handOver') {
      if (steps++ > 3000) fail(`stuck in ${g.state.phase.kind}`, h);
      const ph = g.state.phase;
      if (ph.kind === 'charleston') {
        const picks = seats.map((x) => (x.ai ? x.ai.charlestonPass(g).map((t) => t.id) : x.chaos!.charleston(g)));
        picks.forEach((ids, s) => act({ t: 'cp', s, ids }));
      } else if (ph.kind === 'charlestonVote') {
        for (let s = 0; s < n; s++) if (g.state.phase.kind === 'charlestonVote') act({ t: 'cv', s, v: (seats[s].ai ? seats[s].ai!.charlestonVote(g) : seats[s].chaos!.vote()) ? 1 : 0 });
      } else if (ph.kind === 'exchangeChoice') {
        const x = seats[ph.seat];
        const c = x.ai ? x.ai.exchangeChoice(g) : { passes: 3 as const, wall: 1 as const };
        act({ t: 'gx', s: ph.seat, p: c.passes, w: c.wall });
      } else if (ph.kind === 'wallExchange') {
        const picks = seats.map((x) => (x.ai ? x.ai.wallExchangePick(g).map((t) => t.id) : x.chaos!.charleston(g)));
        picks.forEach((ids, s) => act({ t: 'wx', s, ids }));
      } else if (ph.kind === 'cardPick') {
        seats.forEach((x, s) => act({ t: 'sc', s, c: x.ai ? x.ai.cardPick(g) : g.state.cardOffers![s][0] }));
      } else if (ph.kind === 'roundChoice') {
        const x = seats[ph.seat];
        act({ t: 'rc', s: ph.seat, c: x.ai ? x.ai.roundChoice(g) : g.profile.roundChoices![g.state.handSeed % g.profile.roundChoices!.length].code });
      } else if (ph.kind === 'ticTacToe') {
        const picks = seats.map((x) => (x.ai ? x.ai.ticTacToePick(g).map((t) => t.id) : x.chaos!.charleston(g)));
        picks.forEach((ids, s) => act({ t: 'tt', s, ids }));
      } else if (ph.kind === 'turn') {
        const x = seats[ph.seat];
        if (x.chaos) act(x.chaos.turn(g));
        else {
          let d;
          try {
            d = x.ai!.decideTurn(g);
          } catch (e) {
            fail(`AI decideTurn threw: ${(e as Error).stack}`, h);
          }
          act(decisionAction(ph.seat, d!));
        }
      } else if (ph.kind === 'claims') {
        for (const s of g.pendingClaimSeats()) {
          const cur = g.state.phase;
          if (cur.kind !== 'claims') break;
          const x = seats[s];
          let r: ClaimResponse;
          try {
            r = x.chaos ? x.chaos.claim(g) : x.ai!.decideClaim(g, cur.options[s], cur.tile.kind);
          } catch (e) {
            fail(`AI decideClaim threw: ${(e as Error).stack}`, h);
          }
          act({ t: 'c', s, r: r! });
        }
      }
    }
    const ph = g.state.phase;
    if (ph.kind !== 'handOver') fail('hand did not end', h);
    const res = ph.result;
    // Result bookkeeping: deltas match payments plus the pot.
    const deltas = new Array(n).fill(0);
    for (const pay of res.payments) {
      if (!(pay.amount >= 0) || !Number.isFinite(pay.amount)) fail(`bad payment ${JSON.stringify(pay)}`, h);
      if (pay.from === pay.to) fail(`self payment ${JSON.stringify(pay)}`, h);
      deltas[pay.from] -= pay.amount;
      deltas[pay.to] += pay.amount;
    }
    if (res.type === 'win') {
      deltas[res.winner!] += res.potWon ?? 0;
      if (!res.score || res.score.value < profile.minValue) fail(`win below minimum: ${res.score?.value}`, h);
      if (res.score!.qualifies === false) fail('win without a qualifying pattern', h);
    }
    if (deltas.join() !== res.deltas.join()) fail(`deltas ${res.deltas} vs payments ${deltas}`, h);
    hands.push(log);
    finals.push(structuredClone(g.state));
    const over = g.advance();
    // Round framework.
    const r = g.state.round;
    if (r.handsPlayed !== roundBefore.handsPlayed + 1) fail('handsPlayed did not advance', h);
    const dealerKept = r.dealerSeat === roundBefore.dealerSeat;
    if (!dealerKept && r.dealerSeat !== (roundBefore.dealerSeat + 1) % n) fail('dealer skipped a seat', h);
    if (dealerKept && r.windIndex !== roundBefore.windIndex) fail('wind advanced while dealer stayed', h);
    if (profile.rounds.dealerRetention === 'never' && dealerKept && !(profile.goulash && res.type === 'draw')) fail('dealer kept with retention never', h);
    if (res.type === 'win' && res.winner === roundBefore.dealerSeat && profile.rounds.dealerRetention !== 'never' && profile.rounds.dealerRetention !== 'onDraw' && !dealerKept) fail('dealer won but lost the deal', h);
    if (profile.rounds.dealerRetention === 'onDraw' && dealerKept !== (res.type === 'draw')) fail('India Rules: the deal passes after a win and stays after a draw', h);
    if (length === 'oneHand' && !over) fail('single hand match did not end', h);
    if (profile.endOnBust && g.players.some((p) => p.score < 0) && !over) fail('bust did not end the match', h);
    if (over) break;
  }
  if (h >= MAX_HANDS) fail(`match did not end in ${MAX_HANDS} hands`, h);
  return { config, hands, finals, seed, profile };
}

/** Rebuild every hand from the record and compare with what was played. */
export function checkReplay(m: ReturnType<typeof stressMatch>) {
  const rec: ReplayRecord = { id: 'x', date: '', config: m.config, names: ['A', 'B', 'C', 'D'], me: -1, matchSeed: m.seed, finalScores: [], placement: 1, mode: 'multiplayer', hands: m.hands };
  m.hands.forEach((_, i) => {
    const end = replayHand(rec, i).steps.slice(-1)[0].state;
    expect(end, `${m.config.variation} seed ${m.seed} hand ${i}`).toEqual(m.finals[i]);
  });
}

/** JongBot hints and replay reviews on every position: never throw, never suggest an illegal action. */
export function probeAdvice(g: MahjongGame, a: Action) {
  const ph = g.state.phase;
  for (const depth of ['beginner', 'learning', 'advanced'] as const) {
    if (ph.kind === 'turn' && a.s === ph.seat) {
      const o = g.turnOptions(ph.seat);
      const hint = turnHint(g, ph.seat, depth);
      if (hint.action === 'win' && !o.canWin) throw new Error('hint says win but cannot');
      if (hint.action === 'discard' && hint.focusKind !== undefined && !o.discards.some((t) => t.kind === hint.focusKind) && !o.jokerSwaps.length)
        throw new Error(`hint discards ${hint.focusKind}, not discardable: ${JSON.stringify(hint)}`);
      if (hint.action === 'riichi' && !o.riichiDiscards.some((id) => g.players[ph.seat].hand.find((t) => t.id === id)?.kind === hint.focusKind)) throw new Error('hint riichi not allowed');
      handStatus(g, ph.seat);
    } else if (ph.kind === 'claims' && ph.options[a.s]) {
      const hint = claimHint(g, a.s, ph.options[a.s], ph.tile.kind, depth);
      if (hint.action && hint.action !== 'pass' && !ph.options[a.s].some((o) => o.type === hint.action)) throw new Error(`hint claims ${hint.action} not offered`);
    } else if (ph.kind === 'charleston') {
      const hint = charlestonHint(g, a.s, depth);
      const hand = g.players[a.s].hand;
      if (hint.tiles.length !== 3 || hint.tiles.some((id) => !hand.some((t) => t.id === id && (g.state.goulash || !isJoker(t.kind))))) throw new Error('charleston hint illegal');
    }
  }
  if (a.t === 'd') {
    const r = reviewDiscard(g, a.s, a.id);
    if (!r.explanation || !(r.weight >= 0 && r.weight <= 1)) throw new Error('bad review');
  } else if (a.t === 'c' && ph.kind === 'claims') {
    const r = reviewClaim(g, a.s, a.r, ph.options[a.s], ph.tile.kind);
    if (!r.explanation || !(r.weight >= 0 && r.weight <= 1)) throw new Error('bad claim review');
  }
}

describe('mass simulation', () => {
  for (const v of VARIATIONS) {
    it(`${v.id}: ${N} matches with random house rules keep every invariant`, () => {
      // By default mostly single hands, every fourth an East round (American: single hands, its card matching is slow);
      // with STRESS_N set, any length up to a full NEWS.
      for (let i = 0; i < N; i++) {
        const length: GameLength | undefined = FULL ? undefined : v.id === 'american' || i % 4 !== 3 ? 'oneHand' : 'eastRound';
        stressMatch(v.id, 1000 + i * 7919, { length });
      }
    }, 900_000);
  }

  it('JongBot hints and reviews hold on every position of every variation', () => {
    for (const v of VARIATIONS) for (let i = 0; i < (FULL ? N : 2); i++) stressMatch(v.id, 555 + i * 104729, { length: 'oneHand', probe: probeAdvice });
  }, 600_000);

  it('recorded matches replay to identical positions in every variation', () => {
    for (const v of VARIATIONS) checkReplay(stressMatch(v.id, 31337, { length: v.id === 'american' ? 'oneHand' : 'eastRound' }));
  }, 300_000);
});
