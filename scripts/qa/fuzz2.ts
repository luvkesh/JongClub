// Second-round engine fuzzer (QA). Where fuzz-invariants.ts plays mostly as the
// bots do, this one drives the moves bots rarely make, on every rule set
// (India Rules included) and every match format:
//
//   - every claim a seat is offered (chow variants, pung, kong, win, buy), and
//     declined wins (pass, or a call instead of the win)
//   - concealed and added kongs whenever offered, robbing them, kita, nine terminals
//   - rigged deals: seats get pairs and triples (all tiles still accounted for)
//     so kongs, robbed kongs, kongs on the last tile and replacement wins happen
//   - every option offered is tried on a copy (it must apply and leave a sound
//     table), and random illegal actions must be refused without touching the game
//   - a mid-hand JSON round trip of the state plays on identically
//   - a match resumed between hands (net/replay resumeAt, as live tables do)
//     plays the next hand identically
//   - the whole match replays from its action log to the same positions
//   - wins not offered on a complete hand are counted (plain profiles) for review
//
// Usage: npx vite-node scripts/qa/fuzz2.ts [matchesPerRuleSet=4] [ruleSets|all] [firstSeed=1] [forced=k=v,...]
//   forced keys: length=<GameLength>, any house rule / table option id (e.g. selfDrawOnly=on).

import './fuzzLibFlag';
import { AiPlayer } from '../../src/ai/players';
import { MahjongGame } from '../../src/engine/game';
import { shanten } from '../../src/engine/hand';
import { Rng } from '../../src/engine/rng';
import type { GameLength } from '../../src/engine/rounds';
import { VARIATIONS } from '../../src/engine/rules';
import { TABLE_OPTION_IDS } from '../../src/engine/rules/tableOptions';
import type { RuleProfile } from '../../src/engine/rules/types';
import type { ClaimResponse, GameState, HandResult } from '../../src/engine/state';
import { isJoker } from '../../src/engine/tiles';
import { applyAction, decisionAction, handSeed, isLegalAction, type Action } from '../../src/net/actions';
import { profileFor, replayHand, resumeAt, type ReplayRecord } from '../../src/net/replay';
import type { TableConfig } from '../../src/ui/match';
import { checkTable, expectedKeep, restore } from './fuzz-invariants';

const LENGTHS: GameLength[] = ['oneHand', 'eastRound', 'eastSouth', 'fullNews', 'timed', 'suddenDeath'];
const MAX_HANDS = 120;

export interface Fuzz2Stats {
  matches: number;
  hands: number;
  wins: number;
  selfDraws: number;
  draws: number;
  abortive: number;
  robbed: number;
  lastTileWins: number;
  replacementWins: number;
  declinedWins: number;
  concealedKongs: number;
  addedKongs: number;
  claimedKongs: number;
  chows: number;
  pungs: number;
  buys: number;
  kongOnLastTile: number;
  probes: number;
  illegalTried: number;
  missedWins: number;
  extraGames: number;
  capped: number;
  examples: string[];
}

export const newStats = (): Fuzz2Stats => ({ matches: 0, hands: 0, wins: 0, selfDraws: 0, draws: 0, abortive: 0, robbed: 0, lastTileWins: 0, replacementWins: 0, declinedWins: 0, concealedKongs: 0, addedKongs: 0, claimedKongs: 0, chows: 0, pungs: 0, buys: 0, kongOnLastTile: 0, probes: 0, illegalTried: 0, missedWins: 0, extraGames: 0, capped: 0, examples: [] });

/** JSON with sorted keys (a resumed game adds optional fields in another order). */
const canon = (v: unknown) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));

/** A copy of the game through a JSON round trip (what a saved or sent position would be). */
function jsonCopy(profile: RuleProfile, g: MahjongGame): MahjongGame {
  const c = new MahjongGame(profile, g.players.map((p) => p.name), g.state.handSeed);
  c.state = JSON.parse(JSON.stringify(g.state)) as GameState;
  c.matchOver = g.matchOver;
  return c;
}

/** Give seats pairs and triples by swapping hand tiles with live-wall tiles (every id stays on the table once). */
function rigPairs(g: MahjongGame, rng: Rng) {
  const s = g.state;
  const ph = s.phase;
  if (ph.kind !== 'turn') return;
  const lo = s.drawnFromFront;
  const hi = s.wall.length - g.profile.deadWall - s.drawnFromBack;
  if (hi - lo < 20) return;
  for (const pl of s.players) {
    if (rng.next() < 0.3) continue;
    for (let tries = 0; tries < 6; tries++) {
      const counts = new Map<number, number>();
      for (const t of pl.hand) counts.set(t.kind, (counts.get(t.kind) ?? 0) + 1);
      // A kind held once or twice: bring another copy in from the wall.
      const kinds = [...counts].filter(([k, n]) => n < 3 && !g.isBonus(k) && !isJoker(k)).map(([k]) => k);
      if (!kinds.length) break;
      const kind = kinds[rng.int(kinds.length)];
      let wi = -1;
      for (let i = lo; i < hi; i++) if (s.wall[i].kind === kind) wi = i;
      if (wi < 0) continue;
      // Swap out a tile that is not the drawn one and not of that kind.
      const out = pl.hand.map((t, i) => [t, i] as const).filter(([t]) => t.kind !== kind && t.id !== ph.drawn?.id && (counts.get(t.kind) ?? 0) === 1);
      if (!out.length) break;
      const [, hiIdx] = out[rng.int(out.length)];
      const tmp = pl.hand[hiIdx];
      pl.hand[hiIdx] = s.wall[wi];
      s.wall[wi] = tmp;
    }
  }
}

class Wild {
  rng: Rng;
  constructor(
    readonly seat: number,
    seed: number,
    readonly declineWin: number,
  ) {
    this.rng = new Rng(seed);
  }
  pick<T>(a: T[]): T {
    return a[this.rng.int(a.length)];
  }
  turn(g: MahjongGame): Action {
    const o = g.turnOptions(this.seat);
    const r = this.rng.next();
    if (o.canWin && this.rng.next() >= this.declineWin) return { t: 'w', s: this.seat };
    if (o.nineTerminals && r < 0.3) return { t: 'a', s: this.seat };
    if (o.kita && r < 0.8) return { t: 'n', s: this.seat };
    if (o.kongs.length && r < 0.9) return { t: 'k', s: this.seat, k: this.pick(o.kongs) };
    if (o.groups?.length && r < 0.8) {
      const x = this.pick(o.groups);
      return x.extend === undefined ? { t: 'g', s: this.seat, ids: x.ids } : { t: 'g', s: this.seat, ids: x.ids, m: x.extend };
    }
    if (o.jokerSwaps.length && r < 0.6) {
      const x = this.pick(o.jokerSwaps);
      return { t: 'j', s: this.seat, o: x.owner, m: x.meld, id: x.tileId };
    }
    if (o.riichiDiscards.length && r < 0.7) return { t: 'd', s: this.seat, id: this.pick(o.riichiDiscards), r: 1 };
    // Keep pairs: throw a lone tile when there is one (more kongs and wins later).
    const ph = g.state.phase;
    const hand = g.players[this.seat].hand;
    const lone = o.discards.filter((t) => hand.filter((x) => x.kind === t.kind).length === 1);
    if (ph.kind === 'turn' && lone.length && this.rng.next() < 0.7) return { t: 'd', s: this.seat, id: this.pick(lone).id };
    return { t: 'd', s: this.seat, id: this.pick(o.discards).id };
  }
  claim(g: MahjongGame): ClaimResponse {
    const ph = g.state.phase;
    if (ph.kind !== 'claims') throw new Error('no claim');
    const opts = ph.options[this.seat];
    const win = opts.some((o) => o.type === 'win');
    if (win && this.rng.next() >= this.declineWin) return { type: 'win' };
    const calls = opts.filter((o) => o.type !== 'win');
    if (calls.length && this.rng.next() < 0.75) return this.pick(calls);
    return { type: 'pass' };
  }
  three(g: MahjongGame, n = 3): number[] {
    const ids = g.players[this.seat].hand.filter((t) => g.state.goulash || !isJoker(t.kind)).map((t) => t.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = this.rng.int(i + 1);
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids.slice(0, n);
  }
}

/** Every action this seat could take now, as offered (some sampled). */
function offered(g: MahjongGame, rng: Rng): Action[] {
  const ph = g.state.phase;
  const out: Action[] = [];
  if (ph.kind === 'turn') {
    const s = ph.seat;
    const o = g.turnOptions(s);
    if (o.canWin) out.push({ t: 'w', s });
    for (const k of o.kongs) out.push({ t: 'k', s, k });
    if (o.kita) out.push({ t: 'n', s });
    if (o.nineTerminals) out.push({ t: 'a', s });
    for (const x of o.jokerSwaps) out.push({ t: 'j', s, o: x.owner, m: x.meld, id: x.tileId });
    for (const x of o.groups ?? []) out.push(x.extend === undefined ? { t: 'g', s, ids: x.ids } : { t: 'g', s, ids: x.ids, m: x.extend });
    for (const id of o.riichiDiscards.slice(0, 2)) out.push({ t: 'd', s, id, r: 1 });
    for (let i = 0; i < 2 && o.discards.length; i++) out.push({ t: 'd', s, id: o.discards[rng.int(o.discards.length)].id });
  } else if (ph.kind === 'claims') {
    for (const s of g.pendingClaimSeats()) {
      for (const r of ph.options[s]) out.push({ t: 'c', s, r });
      out.push({ t: 'c', s, r: { type: 'pass' } });
    }
  }
  return out;
}

/** Actions that must be refused here. */
function illegal(g: MahjongGame, rng: Rng): Action[] {
  const ph = g.state.phase;
  const n = g.profile.players;
  const out: Action[] = [];
  if (ph.kind === 'turn') {
    const s = ph.seat;
    const other = (s + 1 + rng.int(n - 1)) % n;
    const o = g.turnOptions(s);
    const theirs = g.players[other].hand[0];
    if (theirs) out.push({ t: 'd', s, id: theirs.id }, { t: 'd', s: other, id: theirs.id });
    if (!o.canWin) out.push({ t: 'w', s });
    out.push({ t: 'w', s: other });
    const notKong = [0, 9, 18, 27, 31].find((k) => !o.kongs.includes(k));
    if (notKong !== undefined) out.push({ t: 'k', s, k: notKong });
    out.push({ t: 'c', s, r: { type: 'pass' } });
    const nonRiichi = o.discards.find((t) => !o.riichiDiscards.includes(t.id));
    if (nonRiichi && g.profile.riichi) out.push({ t: 'd', s, id: nonRiichi.id, r: 1 });
    if (!o.kita) out.push({ t: 'n', s });
    if (!o.nineTerminals) out.push({ t: 'a', s });
  } else if (ph.kind === 'claims') {
    const pend = g.pendingClaimSeats();
    out.push({ t: 'c', s: ph.discarder, r: { type: 'win' } });
    for (const s of pend) {
      const types = ph.options[s].map((o) => o.type);
      for (const t of ['win', 'pung', 'kong', 'buy'] as const) if (!types.includes(t)) out.push({ t: 'c', s, r: { type: t } } as Action);
      if (!types.includes('chow')) out.push({ t: 'c', s, r: { type: 'chow', using: [0, 1] } });
      out.push({ t: 'd', s, id: g.players[s].hand[0].id });
    }
  }
  return out;
}

function profileComplete(g: MahjongGame, seat: number, extra: number): boolean {
  const p = g.profile;
  if (p.card || p.big || p.wilds || p.seatShapes || p.claimAllowed) return false;
  const c = g.concealedCounts(seat, extra);
  return shanten(c, g.players[seat].melds.length, g.shapesFor(seat)) === -1;
}

export interface Fuzz2Opts {
  length?: GameLength;
  force?: Record<string, string>;
  /** Off: skip the per-step probes (faster). */
  probes?: boolean;
  timeBudgetMs?: number;
}

export function fuzz2Match(variation: string, seed: number, stats: Fuzz2Stats, opts: Fuzz2Opts = {}) {
  const rng = new Rng(seed * 2654435761 + 99991);
  const base = VARIATIONS.find((v) => v.id === variation)!.profile!;
  const length = opts.length ?? LENGTHS[rng.int(LENGTHS.length)];
  const houseRules: Record<string, string> = {};
  if (rng.next() < 0.8) for (const r of base.houseRules) houseRules[r.id] = r.options[rng.int(r.options.length)].value;
  for (const id of TABLE_OPTION_IDS) houseRules[id] = rng.next() < 0.4 ? 'on' : 'off';
  // A saved "multiple winners" choice from before the ruling: must be ignored.
  if (rng.next() < 0.3) houseRules.multipleWinners = 'on';
  Object.assign(houseRules, opts.force ?? {});
  const config = { variation, length, houseRules } as unknown as TableConfig;
  const profile = profileFor(config);
  const names = ['A', 'B', 'C', 'D'];
  let g = new MahjongGame(profile, names, seed);
  const n = profile.players;
  const total = g.players.reduce((a, p) => a + p.score, 0);
  const tag = `${variation} seed ${seed} ${length} ${JSON.stringify(houseRules)}`;
  const fail = (h: number, msg: string): never => {
    throw new Error(`${tag} hand ${h}: ${msg}`);
  };
  const declineWin = [0, 0.2, 0.5][rng.int(3)];
  const rigShare = rng.next();
  // Some seats play as the bots do (card games are rarely won by random play).
  const aiShare = rng.next() * 0.7;
  const probeShare = opts.probes === false ? 0 : 0.15;
  const handLogs: Action[][] = [];
  const finals: string[] = [];
  const starts: { round: GameState['round']; scores: number[]; pot: number; goulash?: boolean }[] = [];
  const started = Date.now();
  // Rigged deals cannot be replayed from the seed.
  const riggedHands = new Set<number>();
  stats.matches++;
  let h = 0;
  let over = false;
  for (; h < MAX_HANDS && !over; h++) {
    const seats = Array.from({ length: n }, (_, s) => new Wild(s, handSeed(seed + 31 * s, h), declineWin));
    const ais = Array.from({ length: n }, (_, s) => (rng.next() < aiShare ? new AiPlayer(s, 'strategic', 'zen', handSeed(seed + 77 * s, h)) : null));
    const roundBefore = structuredClone(g.state.round);
    starts.push({ round: roundBefore, scores: g.players.map((p) => p.score), pot: g.state.riichiPot, goulash: g.state.goulash });
    g.startHand(handSeed(seed, h));
    const rigThis = rng.next() < rigShare;
    let rigged = false;
    const actions: Action[] = [];
    let before: GameState = structuredClone(g.state);
    const jsonAt = 3 + rng.int(60);
    let jsonSnap: { game: MahjongGame; from: number; twin: MahjongGame } | null = null;
    const act = (a: Action) => {
      // (Taken after the deal is rigged, which happens at the first turn.)
      if (actions.length >= jsonAt && !jsonSnap && (!rigThis || rigged)) jsonSnap = { game: jsonCopy(profile, g), from: actions.length, twin: restore(profile, g) };
      before = structuredClone(g.state);
      const ph = g.state.phase;
      // Bookkeeping of the rare moves.
      if (a.t === 'c' && ph.kind === 'claims') {
        if (ph.options[a.s]?.some((o) => o.type === 'win') && a.r.type !== 'win') stats.declinedWins++;
      }
      if (a.t === 'w' && ph.kind === 'turn' && ph.afterKong) stats.replacementWins++;
      if (a.t === 'k') {
        if (g.players[a.s].melds.some((m) => m.type === 'pung' && m.tiles[0].kind === a.k)) stats.addedKongs++;
        else stats.concealedKongs++;
        if (g.liveRemaining === 1) stats.kongOnLastTile++;
      }
      actions.push(a);
      try {
        applyAction(g, a);
      } catch (e) {
        fail(h, `action ${JSON.stringify(a)} threw ${(e as Error).message}`);
      }
      const err = checkTable(g, total);
      if (err) fail(h, `after ${JSON.stringify(a)}: ${err}`);
    };
    let steps = 0;
    while (g.state.phase.kind !== 'handOver') {
      if (steps++ > 6000) fail(h, `stuck in ${g.state.phase.kind}`);
      const ph = g.state.phase;
      if (ph.kind === 'turn' && rigThis && !rigged) {
        rigged = true;
        if (g.state.turnCount === 0 && !g.profile.card) {
          riggedHands.add(h);
          rigPairs(g, rng);
          const err = checkTable(g, total);
          if (err) fail(h, `after rig: ${err}`);
          before = structuredClone(g.state);
        }
      }
      // Probes: every offered action applies on a copy; illegal ones are refused and leave the game untouched.
      if (rng.next() < probeShare && (ph.kind === 'turn' || ph.kind === 'claims')) {
        const snap = JSON.stringify(g.state);
        for (const a of offered(g, rng)) {
          stats.probes++;
          const c = restore(profile, g);
          try {
            applyAction(c, a);
          } catch (e) {
            fail(h, `offered ${JSON.stringify(a)} threw ${(e as Error).message}`);
          }
          const err = checkTable(c, total);
          if (err) fail(h, `offered ${JSON.stringify(a)} left: ${err}`);
          if (!isLegalAction(g, a)) fail(h, `offered ${JSON.stringify(a)} is not legal`);
        }
        for (const a of illegal(g, rng)) {
          stats.illegalTried++;
          if (isLegalAction(g, a)) fail(h, `illegal ${JSON.stringify(a)} accepted in ${ph.kind}`);
        }
        if (JSON.stringify(g.state) !== snap) fail(h, 'probing changed the game');
      }
      // Wins the generator did not offer on a complete plain hand (for review).
      if (ph.kind === 'claims' && !ph.robKong && g.discardWins()) {
        for (let s = 0; s < n; s++) {
          if (s === ph.discarder || ph.options[s]?.some((o) => o.type === 'win') || g.isFuriten(s)) continue;
          if (g.isWild(ph.tile.kind)) continue;
          if (profileComplete(g, s, ph.tile.kind) && g.profile.minValue === 0) {
            stats.missedWins++;
            if (stats.examples.length < 12) stats.examples.push(`${variation} seed ${seed} h${h}: seat ${s} complete on discard ${ph.tile.kind} not offered`);
          }
        }
      }
      if (ph.kind === 'turn' && ph.drawn && !g.turnOptions(ph.seat).canWin && g.profile.minValue === 0) {
        const p = g.profile;
        if (!p.card && !p.big && !p.wilds && !p.seatShapes && !p.claimAllowed && shanten(g.concealedCounts(ph.seat), g.players[ph.seat].melds.length, g.shapesFor(ph.seat)) === -1) {
          stats.missedWins++;
          if (stats.examples.length < 12) stats.examples.push(`${variation} seed ${seed} h${h}: seat ${ph.seat} complete on own draw ${ph.drawn.kind} not offered`);
        }
      }
      const x = (s: number) => seats[s];
      if (ph.kind === 'charleston') {
        seats.map((q) => q.three(g)).forEach((ids, s) => act({ t: 'cp', s, ids }));
      } else if (ph.kind === 'charlestonVote') {
        for (let s = 0; s < n; s++) if (g.state.phase.kind === 'charlestonVote') act({ t: 'cv', s, v: rng.next() < 0.5 ? 1 : 0 });
      } else if (ph.kind === 'exchangeChoice') {
        if (g.state.exchange?.india) {
          const step = ph.step ?? 'ttt';
          const choices = step === 'ttt' || step === 'wall' ? [0, 1, 3] : [1, 3];
          const c = choices[rng.int(choices.length)] as 0 | 1 | 3;
          act({ t: 'gx', s: ph.seat, p: c, w: c });
        } else act({ t: 'gx', s: ph.seat, p: rng.next() < 0.5 ? 1 : 3, w: rng.next() < 0.5 ? 1 : 3 });
      } else if (ph.kind === 'wallExchange') {
        seats.map((q) => q.three(g)).forEach((ids, s) => act({ t: 'wx', s, ids }));
      } else if (ph.kind === 'cardPick') {
        seats.forEach((q, s) => act({ t: 'sc', s, c: q.pick(g.state.cardOffers![s]) }));
      } else if (ph.kind === 'roundChoice') {
        act({ t: 'rc', s: ph.seat, c: x(ph.seat).pick(g.profile.roundChoices!).code });
      } else if (ph.kind === 'ticTacToe') {
        seats.map((q) => q.three(g, n - 1)).forEach((ids, s) => act({ t: 'tt', s, ids }));
      } else if (ph.kind === 'turn') {
        const ai = ais[ph.seat];
        act(ai ? decisionAction(ph.seat, ai.decideTurn(g)) : x(ph.seat).turn(g));
      } else if (ph.kind === 'claims') {
        for (const s of g.pendingClaimSeats()) {
          const cur = g.state.phase;
          if (cur.kind !== 'claims') break;
          const ai = ais[s];
          const r = ai ? ai.decideClaim(g, cur.options[s], cur.tile.kind) : x(s).claim(g);
          if (r.type === 'chow') stats.chows++;
          if (r.type === 'pung') stats.pungs++;
          if (r.type === 'kong') stats.claimedKongs++;
          if (r.type === 'buy') stats.buys++;
          act({ t: 'c', s, r });
        }
      }
    }
    const ph = g.state.phase;
    if (ph.kind !== 'handOver') fail(h, 'hand not over');
    const res: HandResult = ph.result;
    stats.hands++;
    const d = new Array(n).fill(0);
    for (const pay of res.payments) {
      if (!(pay.amount >= 0) || !Number.isFinite(pay.amount)) fail(h, `bad payment ${JSON.stringify(pay)}`);
      if (pay.from === pay.to) fail(h, `self payment ${JSON.stringify(pay)}`);
      if (pay.from < 0 || pay.from >= n || pay.to < 0 || pay.to >= n) fail(h, `payment to a missing seat ${JSON.stringify(pay)}`);
      d[pay.from] -= pay.amount;
      d[pay.to] += pay.amount;
    }
    if (res.type === 'win') d[res.winner!] += res.potWon ?? 0;
    if (d.join() !== res.deltas.join()) fail(h, `deltas ${res.deltas} vs payments ${d}`);
    if (res.type === 'win') {
      stats.wins++;
      if (res.discarder === null) stats.selfDraws++;
      if (res.robbedKong) stats.robbed++;
      if (g.liveRemaining === 0) stats.lastTileWins++;
      if (res.winners && res.winners.length > 1) fail(h, 'several winners');
      if (res.discarder === res.winner) fail(h, 'won on own tile');
      const last = actions[actions.length - 1];
      if (g.table?.selfDrawOnly && res.discarder !== null && (last?.t === 'c' || last?.t === 'k' || last?.t === 'n')) fail(h, 'thrown-tile win at a self-draw-only table');
      if (last?.t === 'c' && before.phase.kind === 'claims') {
        const bp = before.phase;
        const callers = Object.keys(bp.options)
          .map(Number)
          .filter((s) => (s === last.s ? last.r.type : bp.responses[s]?.type) === 'win');
        const order = Array.from({ length: n - 1 }, (_, i) => (bp.discarder + 1 + i) % n);
        if (order.find((s) => callers.includes(s)) !== res.winner) fail(h, 'not the first caller in turn order');
      }
      if (g.table?.winnerTakesAll && res.discarder !== null && res.payments.length) {
        for (let s = 0; s < n; s++) if (s !== res.winner && !res.payments.some((p) => p.from === s && p.to === res.winner)) fail(h, `winner takes all: seat ${s} paid nothing (payments ${JSON.stringify(res.payments)}, score ${JSON.stringify(res.score)}, discarder ${res.discarder}, winner ${res.winner}, wind ${g.state.prevailingWind})`);
      }
    } else {
      stats.draws++;
      if (res.abortive) stats.abortive++;
      const last = actions[actions.length - 1];
      if (!res.abortive && last && ['d', 'c', 'k', 'n', 'g'].includes(last.t) && g.liveRemaining !== 0) fail(h, `wall game with ${g.liveRemaining} live tiles left`);
    }
    // JSON round trip mid-hand: the copy plays on to the same end.
    const js = jsonSnap as { game: MahjongGame; from: number; twin: MahjongGame } | null;
    if (js) {
      const plain = (x: MahjongGame) => JSON.stringify({ ...x.state, log: [] });
      for (const [ai, a] of actions.slice(js.from).entries()) {
        try {
          applyAction(js.game, a);
        } catch (e) {
          let twinOk = true;
          try {
            applyAction(js.twin, a);
          } catch {
            twinOk = false;
          }
          fail(h, `JSON-restored game refused ${JSON.stringify(a)} (step ${ai} after the copy, plain copy ${twinOk ? 'accepts' : 'refuses too'}): ${(e as Error).message}`);
        }
        applyAction(js.twin, a);
        const a1 = plain(js.game);
        const a2 = plain(js.twin);
        if (a1 !== a2) {
          let i = 0;
          while (a1[i] === a2[i]) i++;
          fail(h, `JSON-restored game diverged after ${JSON.stringify(a)} at ${a1.slice(Math.max(0, i - 400), i + 200)} VS ${a2.slice(Math.max(0, i - 400), i + 200)}`);
        }
      }
      // The event log holds live meld objects (a pung's call event shows the kong it became), so it is left out.
      const a1 = JSON.stringify({ ...js.game.state, log: [] });
      const a2 = JSON.stringify({ ...g.state, log: [] });
      if (a1 !== a2) {
        let i = 0;
        while (a1[i] === a2[i]) i++;
        fail(h, `JSON-restored game diverged at ${a1.slice(Math.max(0, i - 300), i + 200)} VS ${a2.slice(Math.max(0, i - 300), i + 200)}`);
      }
    }
    handLogs.push(actions);
    finals.push(canon(g.state));
    const dealer = roundBefore.dealerSeat;
    const potBefore = g.state.riichiPot;
    const sumBefore = g.players.reduce((a, p) => a + p.score, 0) + potBefore;
    over = g.advance();
    const r = g.state.round;
    const keep = r.dealerSeat === dealer;
    if (r.handsPlayed !== roundBefore.handsPlayed + 1) fail(h, 'handsPlayed did not advance');
    const indiaExtra = profile.id === 'india' && res.type === 'draw' && potBefore > 0 && keep && r.windIndex === roundBefore.windIndex && r.dealerHand === roundBefore.dealerHand;
    if (indiaExtra && !expectedKeep(profile, res, dealer)) stats.extraGames++;
    if (!over) {
      if (keep !== expectedKeep(profile, res, dealer) && !indiaExtra) fail(h, `dealer ${keep ? 'kept' : 'passed'} (retention ${profile.rounds.dealerRetention}, ${res.type})`);
      if (!keep && r.dealerSeat !== (dealer + 1) % n) fail(h, 'dealer skipped a seat');
      if (keep && r.windIndex !== roundBefore.windIndex) fail(h, 'kept dealer but wind moved');
      if (!keep && r.dealerHand === 0 && r.windIndex !== roundBefore.windIndex + 1) fail(h, 'wind did not advance after the last dealer');
      const pw = profile.rounds.prevailingWinds;
      if (r.windIndex >= pw.length) fail(h, 'match went past its last wind');
    }
    if (length === 'oneHand' && !over && !indiaExtra) fail(h, 'single hand did not end');
    if (length === 'suddenDeath' && res.type === 'win' && !over) fail(h, 'sudden death went on after a win');
    if (profile.endOnBust && g.players.some((p) => p.score < 0) && !over) fail(h, 'bust did not end the match');
    const sumAfter = g.players.reduce((a, p) => a + p.score, 0) + g.state.riichiPot;
    if (Math.abs(sumAfter - sumBefore) > 1e-6) fail(h, `advance changed the total ${sumBefore} -> ${sumAfter}`);
    if (over && g.state.riichiPot !== 0 && profile.matchEnd) fail(h, 'riichi sticks left on the table at the match end');
    // Resume (as a live table does after a reload): a fresh game at the next hand's start point.
    if (!over && rng.next() < 0.25) {
      const c = new MahjongGame(profile, names, seed);
      resumeAt(c, { round: g.state.round, scores: g.players.map((p) => p.score), pot: g.state.riichiPot, goulash: g.state.goulash });
      c.matchOver = g.matchOver;
      g = c;
    }
    if (Date.now() - started > (opts.timeBudgetMs ?? 45_000)) {
      stats.capped++;
      break;
    }
  }
  if (h >= MAX_HANDS && !over) {
    stats.capped++;
    if (!['onDealerWinOrDraw', 'onDealerWinOrTenpai'].includes(profile.rounds.dealerRetention) && !profile.goulash && profile.id !== 'india') fail(h, `match did not end in ${MAX_HANDS} hands`);
  }
  // The action log replays to the same positions, from the match start and from a resume point.
  const rec: ReplayRecord = { id: 'q', date: '', config, names, me: -1, matchSeed: seed, finalScores: [], placement: 1, mode: 'multiplayer', hands: handLogs };
  const check = [0, handLogs.length - 1, rng.int(handLogs.length)];
  const firstRigged = Math.min(Infinity, ...riggedHands);
  for (const i of new Set(check)) {
    if (riggedHands.has(i)) continue;
    const replay = (r: ReplayRecord, at: number) => {
      try {
        return replayHand(r, at).steps.slice(-1)[0].state;
      } catch (e) {
        return fail(i, `replay threw ${(e as Error).message}`);
      }
    };
    const diff = (a1: string, a2: string) => {
      let j = 0;
      while (a1[j] === a2[j]) j++;
      return `${a1.slice(Math.max(0, j - 300), j + 150)} VS ${a2.slice(Math.max(0, j - 300), j + 150)}`;
    };
    if (i < firstRigged) {
      const end = canon(replay(rec, i));
      if (end !== finals[i]) fail(i, `replay diverged: ${diff(end, finals[i])}`);
    }
    const resumed: ReplayRecord = { ...rec, hands: [handLogs[i]], start: { hand: i, ...starts[i] } };
    const end2 = replay(resumed, 0);
    if (canon(end2) !== finals[i]) fail(i, `replay from a resume point diverged: ${diff(canon(end2), finals[i])}`);
  }
  // Same seed, same match: a digest of every action and every final position (live tables run in lockstep).
  let digest = 0;
  for (const c of JSON.stringify(handLogs) + finals.join()) digest = (Math.imul(digest, 31) + c.charCodeAt(0)) >>> 0;
  return { hands: handLogs.length, digest };
}

declare const process: { argv: string[]; exitCode: number; env: Record<string, string | undefined> };
const isMain = typeof process !== 'undefined' && !process.env.VITEST;
if (isMain) {
  const args = process.argv.slice(2);
  const per = Number(args[0] ?? 4);
  const filter = args[1] && args[1] !== 'all' ? args[1].split(',') : null;
  const first = Number(args[2] ?? 1);
  const forced = args[3] ? Object.fromEntries(args[3].split(',').map((x) => [x.split('=')[0], x.split('=')[1] ?? 'on'])) : {};
  const length = forced.length as GameLength | undefined;
  delete forced.length;
  const failures: string[] = [];
  const all = newStats();
  for (const v of VARIATIONS) {
    if (filter && !filter.includes(v.id)) continue;
    const st = newStats();
    const t0 = Date.now();
    let bad = 0;
    for (let i = 0; i < per; i++) {
      try {
        fuzz2Match(v.id, first + i * 7727, st, { length, force: forced });
      } catch (e) {
        bad++;
        failures.push((e as Error).message.split('\n')[0].slice(0, 1500));
      }
    }
    for (const k of Object.keys(all) as (keyof Fuzz2Stats)[]) if (k !== 'examples') (all[k] as number) += st[k] as number;
    all.examples.push(...st.examples.slice(0, 3));
    console.log(`${v.id.padEnd(18)} ${String(st.hands).padStart(4)}h ${st.wins}w(${st.selfDraws}sd ${st.robbed}rob ${st.lastTileWins}last ${st.replacementWins}repl) ${st.draws}d(${st.abortive}ab) kongs ${st.concealedKongs}c/${st.addedKongs}a/${st.claimedKongs}x lastK ${st.kongOnLastTile} declined ${st.declinedWins} chow ${st.chows} pung ${st.pungs} buy ${st.buys} extra ${st.extraGames} miss ${st.missedWins} probes ${st.probes}/${st.illegalTried}${st.capped ? ` capped ${st.capped}` : ''} ${bad ? `FAILED ${bad}` : 'ok'} ${Date.now() - t0}ms`);
  }
  console.log('TOTAL', JSON.stringify({ ...all, examples: undefined }));
  for (const e of all.examples) console.log('MISS', e);
  for (const f of failures) console.log('FAIL', f);
  if (failures.length) process.exitCode = 1;
}
