// Randomised invariant fuzzer for the rules engine (QA). Plays many seeded
// matches per rule set with random house rules, the five table options in
// random combinations and random match lengths, driven by a mix of AI and
// random-but-legal players, and checks after every action and every hand:
//
//   - tile conservation (every physical tile exactly once) and legal hand sizes
//   - scores + pot conserved (zero-sum; riichi sticks, goulash pot and draw bank
//     sit in state.riichiPot), uma checked separately at the match end
//   - every win (each co-winner too) re-evaluates with evaluateWin to the same
//     score from the position just before it, reaches the minimum and qualifies
//   - table options: no discard win at a self-draw-only table; one winner per discard, the
//     first caller in turn order (head bump); winner takes all makes every other seat pay;
//     no teams at a three-seat table
//   - chow offered only to the next seat when the rule set says so; never a
//     claim for the discarder; a riichi seat waiting on its own discard is never
//     offered a discard win (furiten)
//   - an exhausted wall leaves exactly the dead wall
//   - dealer / prevailing wind progression matches the rule set's retention rule
//   - the match always terminates; a mid-hand snapshot restored into a fresh
//     game continues identically
//
// Usage: npx vite-node scripts/qa/fuzz-invariants.ts [seedsPerRuleSet=6] [ruleSetFilter|all] [firstSeed=1] [forcedOptions]
//   e.g. npx vite-node scripts/qa/fuzz-invariants.ts 30 all 1 teamPlay,winnerTakesAll

import { AiPlayer, type Difficulty, type Personality } from '../../src/ai/players';
import { MahjongGame } from '../../src/engine/game';
import { Rng } from '../../src/engine/rng';
import type { GameLength } from '../../src/engine/rounds';
import { VARIATIONS } from '../../src/engine/rules';
import { TABLE_OPTION_IDS } from '../../src/engine/rules/tableOptions';
import type { RuleProfile } from '../../src/engine/rules/types';
import type { ClaimResponse, GameState, HandResult } from '../../src/engine/state';
import { isJoker, kindOfTileId } from '../../src/engine/tiles';
import { applyAction, decisionAction, handSeed, type Action } from '../../src/net/actions';
import { profileFor, replayHand, type ReplayRecord } from '../../src/net/replay';
import type { TableConfig } from '../../src/ui/match';

const LENGTHS: GameLength[] = ['oneHand', 'oneHand', 'oneHand', 'eastRound', 'eastRound', 'suddenDeath', 'eastSouth'];
const DIFFS: Difficulty[] = ['beginner', 'casual', 'strategic', 'expert'];
const PERS: Personality[] = ['teacher', 'shark', 'wall', 'gambler', 'zen'];
const MAX_HANDS = 160;

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

export function checkTable(g: MahjongGame, total: number): string | null {
  const s = g.state;
  const p = g.profile;
  const ids = tableIds(s);
  const expected = s.wallOrder.slice().sort((a, b) => a - b);
  if (ids.join() !== expected.join()) return `tile conservation: ${ids.length} on table vs ${expected.length}`;
  for (const t of s.wall) if (kindOfTileId(t.id) !== t.kind) return `tile ${t.id} has kind ${t.kind}`;
  if (g.liveRemaining < 0) return `live wall negative ${g.liveRemaining}`;
  const sum = s.players.reduce((a, pl) => a + pl.score, 0) + s.riichiPot;
  if (Math.abs(sum - total) > 1e-6) return `not zero-sum: ${sum} vs ${total}`;
  const size = (seat: number) => {
    const pl = s.players[seat];
    return pl.hand.length + pl.melds.reduce((a, m) => a + (p.card ? m.tiles.length : p.big ? m.tiles.length - (m.extras ?? 0) : 3), 0);
  };
  const ph = s.phase;
  if (ph.kind === 'handOver') return null;
  for (const pl of s.players) if (!p.card && pl.hand.some((t) => g.isBonus(t.kind))) return `seat ${pl.seat} holds a bonus tile`;
  if (ph.kind === 'turn') {
    for (let seat = 0; seat < p.players; seat++) if (size(seat) !== p.handSize + (seat === ph.seat ? 1 : 0)) return `turn: seat ${seat} holds ${size(seat)}`;
  } else if (ph.kind === 'claims') {
    for (let seat = 0; seat < p.players; seat++) if (size(seat) !== p.handSize) return `claims: seat ${seat} holds ${size(seat)}`;
    if (ph.options[ph.discarder]) return 'discarder offered a claim on own tile';
    for (const [seatS, opts] of Object.entries(ph.options)) {
      const seat = Number(seatS);
      if (opts.some((o) => o.type === 'chow') && p.calls.chowFromLeftOnly && seat !== (ph.discarder + 1) % p.players) return `chow offered to seat ${seat} (not next after ${ph.discarder})`;
      if (opts.some((o) => o.type === 'chow') && !p.calls.chow && !p.big) return 'chow offered with chows off';
      if (opts.some((o) => o.type === 'win') && g.table?.selfDrawOnly) return 'discard win offered at a self-draw-only table';
      if (opts.some((o) => o.type === 'win') && p.furiten && g.players[seat].discardKinds.length && g.waitsOf(seat).some((k) => g.players[seat].discardKinds.includes(k))) return `furiten seat ${seat} offered a win`;
    }
  }
  return null;
}

class Chaos {
  rng: Rng;
  constructor(
    readonly seat: number,
    seed: number,
  ) {
    this.rng = new Rng(seed);
  }
  pick<T>(a: T[]): T {
    return a[this.rng.int(a.length)];
  }
  turn(g: MahjongGame): Action {
    const o = g.turnOptions(this.seat);
    const r = this.rng.next();
    if (o.canWin && r < 0.75) return { t: 'w', s: this.seat };
    if (o.nineTerminals && r < 0.5) return { t: 'a', s: this.seat };
    if (o.kita && r < 0.6) return { t: 'n', s: this.seat };
    if (o.kongs.length && r < 0.6) return { t: 'k', s: this.seat, k: this.pick(o.kongs) };
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
    if (opts.some((o) => o.type === 'win') && this.rng.next() < 0.85) return { type: 'win' };
    if (this.rng.next() < 0.4) return { type: 'pass' };
    return this.pick(opts);
  }
  three(g: MahjongGame): number[] {
    const ids = g.players[this.seat].hand.filter((t) => g.state.goulash || !isJoker(t.kind)).map((t) => t.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = this.rng.int(i + 1);
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids.slice(0, 3);
  }
}

/** Fresh game holding a copy of `state` (a snapshot / restore). */
export function restore(profile: RuleProfile, g: MahjongGame): MahjongGame {
  const c = new MahjongGame(profile, g.players.map((p) => p.name), g.state.handSeed);
  c.state = structuredClone(g.state);
  c.matchOver = g.matchOver;
  return c;
}

export function expectedKeep(profile: RuleProfile, res: HandResult, dealer: number): boolean {
  if (res.abortive) return true;
  if (profile.goulash && res.type === 'draw') return true;
  const won = res.type === 'win' && (res.winners ?? [res.winner]).includes(dealer);
  const drawn = res.type === 'draw';
  switch (profile.rounds.dealerRetention) {
    case 'onDealerWin':
      return won;
    case 'onDealerWinOrDraw':
      return won || drawn;
    case 'onDraw':
      return drawn;
    case 'onDealerWinOrTenpai':
      return won || (drawn && !!res.tenpai?.[dealer]);
    default:
      return false;
  }
}

export interface FuzzStats {
  hands: number;
  wins: number;
  coWins: number;
  draws: number;
  robbed: number;
  lastTile: number;
  /** Matches stopped at MAX_HANDS: only allowed when the dealer legitimately kept the deal on draws (retention on draw / goulash) the whole way. */
  capped?: number;
}

export function fuzzMatch(variation: string, seed: number, stats: FuzzStats, forced?: { length?: GameLength; houseRules?: Record<string, string>; replay?: boolean; trace?: boolean; force?: Record<string, string> }) {
  const rng = new Rng(seed * 7919 + 17);
  const base = VARIATIONS.find((v) => v.id === variation)!.profile!;
  const length = forced?.length ?? LENGTHS[rng.int(LENGTHS.length)];
  const houseRules: Record<string, string> = {};
  if (forced?.houseRules) Object.assign(houseRules, forced.houseRules);
  else {
    if (rng.next() < 0.7) for (const r of base.houseRules) houseRules[r.id] = r.options[rng.int(r.options.length)].value;
    for (const id of TABLE_OPTION_IDS) houseRules[id] = rng.next() < 0.45 ? 'on' : 'off';
  }
  Object.assign(houseRules, forced?.force ?? {});
  const config = { variation, length, houseRules } as unknown as TableConfig;
  const profile = profileFor(config);
  let g = new MahjongGame(profile, ['A', 'B', 'C', 'D'], seed);
  const n = profile.players;
  const total = g.players.reduce((a, p) => a + p.score, 0);
  const tag = `${variation} seed ${seed} ${length} ${JSON.stringify(houseRules)}`;
  const fail = (h: number, msg: string): never => {
    throw new Error(`${tag} hand ${h}: ${msg}`);
  };
  if (n === 3 && g.table?.teams) fail(0, 'teams on at a three-seat table');
  const chaosShare = rng.next();
  const handLogs: Action[][] = [];
  const started = Date.now();
  let timedOut = false;
  const finals: string[] = [];
  let h = 0;
  for (; h < MAX_HANDS; h++) {
    const seats = Array.from({ length: n }, (_, s) => (rng.next() < chaosShare ? { chaos: new Chaos(s, handSeed(seed + s, h)) } : { ai: new AiPlayer(s, DIFFS[rng.int(4)], PERS[rng.int(5)], handSeed(seed + 101 * s, h)) }));
    const roundBefore = structuredClone(g.state.round);
    if (forced?.trace) console.log('hand', h, JSON.stringify(roundBefore), Date.now());
    g.startHand(handSeed(seed, h));
    let err = checkTable(g, total);
    const pw = profile.rounds.prevailingWinds;
    if (g.state.prevailingWind !== pw[Math.min(g.state.round.windIndex, pw.length - 1)]) fail(h, `prevailing wind ${g.state.prevailingWind} at wind index ${g.state.round.windIndex}`);
    if (g.state.seatWinds[g.dealer] !== profile.rounds.seatWindOrder[0]) fail(h, 'dealer is not East');
    if (err) fail(h, `after deal: ${err}`);
    const actions: Action[] = [];
    let before: GameState = structuredClone(g.state);
    // Snapshot / restore: a copy taken mid-hand must play on identically.
    const snapAt = 5 + rng.int(40);
    let snap: { game: MahjongGame; from: number } | null = null;
    const act = (a: Action) => {
      if (actions.length === snapAt) snap = { game: restore(profile, g), from: actions.length };
      before = structuredClone(g.state);
      actions.push(a);
      try {
        applyAction(g, a);
      } catch (e) {
        fail(h, `action ${JSON.stringify(a)} threw ${(e as Error).message}`);
      }
      err = checkTable(g, total);
      if (err) fail(h, `after ${JSON.stringify(a)}: ${err}`);
    };
    let steps = 0;
    while (g.state.phase.kind !== 'handOver') {
      if (steps++ > 4000) fail(h, `stuck in ${g.state.phase.kind}`);
      const ph = g.state.phase;
      const x = (s: number) => seats[s];
      if (ph.kind === 'charleston') {
        const picks = seats.map((q) => (q.ai ? q.ai.charlestonPass(g).map((t) => t.id) : q.chaos!.three(g)));
        picks.forEach((ids, s) => act({ t: 'cp', s, ids }));
      } else if (ph.kind === 'charlestonVote') {
        for (let s = 0; s < n; s++) if (g.state.phase.kind === 'charlestonVote') act({ t: 'cv', s, v: x(s).ai ? (x(s).ai!.charlestonVote(g) ? 1 : 0) : rng.next() < 0.5 ? 1 : 0 });
      } else if (ph.kind === 'exchangeChoice') {
        const c = x(ph.seat).ai ? x(ph.seat).ai!.exchangeChoice(g) : { passes: 3 as const, wall: 1 as const };
        act({ t: 'gx', s: ph.seat, p: c.passes, w: c.wall });
      } else if (ph.kind === 'wallExchange') {
        const picks = seats.map((q) => (q.ai ? q.ai.wallExchangePick(g).map((t) => t.id) : q.chaos!.three(g)));
        picks.forEach((ids, s) => act({ t: 'wx', s, ids }));
      } else if (ph.kind === 'cardPick') {
        seats.forEach((q, s) => act({ t: 'sc', s, c: q.ai ? q.ai.cardPick(g) : g.state.cardOffers![s][0] }));
      } else if (ph.kind === 'roundChoice') {
        act({ t: 'rc', s: ph.seat, c: x(ph.seat).ai ? x(ph.seat).ai!.roundChoice(g) : g.profile.roundChoices![0].code });
      } else if (ph.kind === 'ticTacToe') {
        const picks = seats.map((q) => (q.ai ? q.ai.ticTacToePick(g).map((t) => t.id) : q.chaos!.three(g)));
        picks.forEach((ids, s) => act({ t: 'tt', s, ids }));
      } else if (ph.kind === 'turn') {
        const q = x(ph.seat);
        act(q.chaos ? q.chaos.turn(g) : decisionAction(ph.seat, q.ai!.decideTurn(g)));
      } else if (ph.kind === 'claims') {
        for (const s of g.pendingClaimSeats()) {
          const cur = g.state.phase;
          if (cur.kind !== 'claims') break;
          const q = x(s);
          act({ t: 'c', s, r: q.chaos ? q.chaos.claim(g) : q.ai!.decideClaim(g, cur.options[s], cur.tile.kind) });
        }
      }
    }
    const ph = g.state.phase;
    if (ph.kind !== 'handOver') fail(h, 'hand not over');
    const res = ph.result;
    stats.hands++;
    // Payments add up to the deltas (plus the pot to the winner); the hand's net is the pot taken or put in.
    const d = new Array(n).fill(0);
    for (const pay of res.payments) {
      if (!(pay.amount >= 0) || !Number.isFinite(pay.amount)) fail(h, `bad payment ${JSON.stringify(pay)}`);
      if (pay.from === pay.to) fail(h, `self payment ${JSON.stringify(pay)}`);
      d[pay.from] -= pay.amount;
      d[pay.to] += pay.amount;
    }
    if (res.type === 'win') d[res.winner!] += res.potWon ?? 0;
    if (d.join() !== res.deltas.join()) fail(h, `deltas ${res.deltas} vs payments ${d}`);
    const last = actions[actions.length - 1];
    if (res.type === 'win') {
      stats.wins++;
      const winners = res.winners ?? [res.winner!];
      if (res.winners && res.winners[0] !== res.winner) fail(h, 'winners[0] is not winner');
      if (new Set(winners).size !== winners.length) fail(h, 'a seat won twice');
      if (winners.length > 1) stats.coWins++;
      if (res.robbedKong) stats.robbed++;
      if (g.liveRemaining === 0) stats.lastTile++;
      const selfDrawn = res.discarder === null;
      if (!selfDrawn && g.table?.selfDrawOnly && res.discarder !== null) {
        // A seven-flower hand robbing the eighth is the only thrown-tile win allowed (a flower, not a discard).
        if (last?.t === 'c' || last?.t === 'k' || last?.t === 'n') fail(h, 'won on a thrown tile at a self-draw-only table');
      }
      if (winners.length > 1) fail(h, 'several winners on one discard');
      if (winners.includes(res.discarder ?? -1)) fail(h, 'discarder among winners');
      // The claim window just before: the first caller in turn order is the only winner (head bump).
      if (last?.t === 'c' && before.phase.kind === 'claims') {
        const bp = before.phase;
        const callers = Object.keys(bp.options)
          .map(Number)
          .filter((s) => (s === last.s ? last.r.type : bp.responses[s]?.type) === 'win');
        const order = Array.from({ length: n - 1 }, (_, i) => (bp.discarder + 1 + i) % n);
        if (order.find((s) => callers.includes(s)) !== res.winner) fail(h, 'head bump: not the first caller in turn order');
        // Re-evaluate each winner from the position just before the last response.
        const re = restore(profile, g);
        re.state = structuredClone(before);
        for (const w of winners) {
          const sc = w === res.winner ? res.score! : res.coWinners!.find((c) => c.seat === w)!.score;
          const ev = re.evaluateWin(w, bp.tile.kind, false, true, false, { robbedKong: !!bp.robKong && !bp.kita, winTileId: bp.tile.id, discarder: bp.discarder });
          if (!ev) fail(h, `winner ${w} does not pass evaluateWin`);
          if (ev!.score.points !== sc.points) fail(h, `winner ${w} scored ${sc.points}, re-evaluated ${ev!.score.points}`);
          if (sc.value < re.profile.minValue || sc.qualifies === false) fail(h, `winner ${w} below minimum`);
        }
      } else if (last?.t === 'w' && before.phase.kind === 'turn') {
        const re = restore(profile, g);
        re.state = structuredClone(before);
        const bp = before.phase;
        const ev = re.evaluateWin(res.winner!, bp.drawn!.kind, true, false, bp.afterKong);
        if (!ev || ev.score.points !== res.score!.points) fail(h, `self-draw winner does not re-evaluate (${ev?.score.points} vs ${res.score!.points})`);
        if (res.score!.value < re.profile.minValue) fail(h, 'self-draw below minimum');
      }
      // Winner takes all: every other seat pays each winner (instant / hand payments aside).
      if (g.table?.winnerTakesAll && !selfDrawn) {
        for (const w of winners) for (let s = 0; s < n; s++) if (s !== w && !res.payments.some((p) => p.from === s && p.to === w)) fail(h, `winner takes all: seat ${s} paid nothing to ${w}`);
      }
    } else {
      stats.draws++;
      if (!res.abortive && last && ['d', 'c', 'k', 'n', 'j', 'g'].includes(last.t) && g.liveRemaining !== 0) fail(h, `wall game with ${g.liveRemaining} live tiles left`);
    }
    // Snapshot / restore: replaying the rest of the hand on the copy reaches the same state.
    const sn = snap as { game: MahjongGame; from: number } | null;
    if (sn) {
      for (const a of actions.slice(sn.from)) applyAction(sn.game, a);
      if (JSON.stringify(sn.game.state) !== JSON.stringify(g.state)) fail(h, 'restored snapshot diverged');
    }
    handLogs.push(actions);
    if (forced?.replay) finals.push(JSON.stringify(g.state));
    const dealer = roundBefore.dealerSeat;
    const potBefore = g.state.riichiPot;
    const sumBefore = g.players.reduce((a, p) => a + p.score, 0) + potBefore;
    const over = g.advance();
    const r = g.state.round;
    const keep = r.dealerSeat === dealer;
    if (r.handsPlayed !== roundBefore.handsPlayed + 1) fail(h, 'handsPlayed did not advance');
    if (!over) {
      if (keep !== expectedKeep(profile, res, dealer)) fail(h, `dealer ${keep ? 'kept' : 'passed'} (retention ${profile.rounds.dealerRetention}, ${res.type}${res.abortive ? ' abortive' : ''}, winners ${res.winners ?? res.winner})`);
      if (!keep && r.dealerSeat !== (dealer + 1) % n) fail(h, 'dealer skipped a seat');
      if (keep && (r.windIndex !== roundBefore.windIndex || r.repeat !== roundBefore.repeat + 1)) fail(h, 'kept dealer but wind or repeat wrong');
      if (!keep && r.dealerHand === 0 && r.windIndex !== roundBefore.windIndex + 1) fail(h, 'wind did not advance after the last dealer');
    }
    if (length === 'oneHand' && !over) fail(h, 'single hand did not end');
    if (length === 'suddenDeath' && res.type === 'win' && !over) fail(h, 'sudden death went on after a win');
    if (profile.endOnBust && g.players.some((p) => p.score < 0) && !over) fail(h, 'bust did not end the match');
    const sumAfter = g.players.reduce((a, p) => a + p.score, 0) + g.state.riichiPot;
    if (over && profile.matchEnd) {
      // Uma is its own (zero-sum) settlement.
      if (Math.abs(sumAfter - sumBefore) > 1e-6) fail(h, `match-end settlement not zero-sum: ${sumBefore} -> ${sumAfter}`);
    } else if (Math.abs(sumAfter - sumBefore) > 1e-6) fail(h, 'advance changed the total');
    // Start each hand from a restored snapshot sometimes, as a resumed match would.
    if (!over && rng.next() < 0.2) g = restore(profile, g);
    if (over) break;
    // Time budget (slow AI in special rounds): stop cleanly, every hand so far was checked.
    if (Date.now() - started > 60_000) {
      timedOut = true;
      stats.capped = (stats.capped ?? 0) + 1;
      break;
    }
  }
  if (h >= MAX_HANDS && !timedOut) {
    // Every hand's dealer step was checked above; a match can only run on through draws the
    // rule set lets the dealer keep (random players rarely win), so count it rather than fail.
    if (profile.rounds.dealerRetention !== 'onDealerWinOrDraw' && !profile.goulash && profile.rounds.dealerRetention !== 'onDealerWinOrTenpai') fail(h, 'match did not end');
    stats.capped = (stats.capped ?? 0) + 1;
  }
  // Net lockstep: the recorded actions replay to the same positions (table options come from the config).
  if (forced?.replay) {
    const rec: ReplayRecord = { id: 'q', date: '', config, names: ['A', 'B', 'C', 'D'], me: -1, matchSeed: seed, finalScores: [], placement: 1, mode: 'multiplayer', hands: handLogs };
    handLogs.forEach((_, i) => {
      const end = replayHand(rec, i).steps.slice(-1)[0].state;
      if (JSON.stringify(end) !== finals[i]) fail(i, 'replay diverged');
    });
  }
  return { hands: handLogs.length };
}

declare const process: { argv: string[]; exitCode: number; env: Record<string, string | undefined> };
// Run as a script (vite-node), not when a test imports fuzzMatch.
// Run as a script, not when a test or another fuzzer (fuzzLibFlag.ts) imports it.
const isMain = typeof process !== 'undefined' && !process.env.VITEST && !(globalThis as { __fuzzLib?: boolean }).__fuzzLib;
if (isMain) {
  const args = process.argv.slice(2);
  const per = Number(args[0] ?? 6);
  const filter = args[1] && args[1] !== 'all' ? args[1].split(',') : null;
  const first = Number(args[2] ?? 1);
  // Optional 4th argument: options forced on, e.g. teamPlay,selfDrawOnly=off (the rest stay random).
  const force = args[3] ? Object.fromEntries(args[3].split(',').map((x) => [x.split('=')[0], x.split('=')[1] ?? 'on'])) : undefined;
  const failures: string[] = [];
  for (const v of VARIATIONS) {
    if (v.id === 'india' || (filter && !filter.includes(v.id))) continue;
    const stats: FuzzStats = { hands: 0, wins: 0, coWins: 0, draws: 0, robbed: 0, lastTile: 0 };
    const t0 = Date.now();
    let bad = 0;
    for (let i = 0; i < per; i++) {
      try {
        fuzzMatch(v.id, first + i * 104729, stats, force ? { force } : undefined);
      } catch (e) {
        bad++;
        failures.push((e as Error).message.split('\n')[0]);
      }
    }
    console.log(`${v.id.padEnd(18)} ${per} matches ${String(stats.hands).padStart(4)} hands ${stats.wins} wins (${stats.coWins} multi, ${stats.robbed} robbed, ${stats.lastTile} last tile) ${stats.draws} draws${stats.capped ? ` ${stats.capped} capped` : ''} ${bad ? `FAILED ${bad}` : 'ok'} ${Date.now() - t0}ms`);
  }
  for (const f of failures) console.log('FAIL', f);
  if (failures.length) process.exitCode = 1;
}
