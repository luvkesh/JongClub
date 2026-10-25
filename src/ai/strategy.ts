// Strategic core for the Asian variants, shared by the strong AI levels,
// JongBot and the replay review. It weighs each discard by how likely it
// is to lead to a win (and what that win is worth) against what it might
// cost if it feeds an opponent. Push or fold falls out of that balance.
//
// Deterministic: no randomness lives here. Callers add their own seeded
// noise if they want it.

import type { MahjongGame } from '../engine/game';
import { sevenPairsShanten, wildWaits } from '../engine/hand';
import { fastStandardShanten } from './fastShanten';
import type { HandScore } from '../engine/rules/types';
import type { ClaimOption, ClaimResponse } from '../engine/state';
import { KIND_COUNT, WINDS, flowerNumber, isAnimal, isDragon, isFlower, isHonor, isRed, windKind, type Tile } from '../engine/tiles';
import { dangerMap, mainThreat, ordinaryPoints, type DangerMap, type OpponentRead, type ReadDepth } from './danger';
import { callMeld, cardUses, currentShanten, dominantSuit, evaluateDiscards, handWilds, isValueHonor, openHandHasYakuPath, shantenAfterBuy, shantenAfterCall, shantenWith, unseenCounts, voidSuit, type DiscardEval } from './evaluate';

export interface PlanOptions {
  depth: ReadDepth;
  /** Multiplier on deal-in cost: above 1 folds earlier, below 1 pushes harder. */
  caution: number;
  /** Multiplier on the value of the own hand (value chasers). */
  valueBias: number;
  /** Bonus for discarding off-suit tiles when chasing a flush. */
  flushBias: number;
}

/** JongBot's own settings: a calm, expert player. */
export const ADVISOR: PlanOptions = { depth: 'full', caution: 1, valueBias: 1, flushBias: 0 };

export interface Candidate extends DiscardEval {
  /** Rough chance this discard leads to a win this hand. */
  pWin: number;
  /** What a win would be worth, relative to an ordinary hand. */
  value: number;
  /** Expected deal-in cost of this discard (relative hand values). */
  loss: number;
  /** Ready, but waiting on a tile already discarded (Riichi furiten). */
  furiten: boolean;
  /** Efficiency-only score: -100 per tile from ready, plus helpful tiles and shape. */
  attack: number;
  /** Expected win value of keeping this hand, 100 = an ordinary win for sure. */
  ev: number;
  /** Expected deal-in cost of this discard on the same scale as ev, including later turns. */
  risk: number;
  /** Final score, higher is better. */
  score: number;
}

export interface DiscardPlan {
  ranked: Candidate[];
  /** Best candidate if danger were ignored. */
  fastest: Candidate;
  mode: 'normal' | 'push' | 'fold';
  danger: DangerMap;
  /** The opponent that matters most, if anyone looks close. */
  threat: OpponentRead | null;
}

// ------------------------------------------------------------------ scoring

/**
 * Best score for a hypothetical win with concealed `counts` (winning tile
 * included). Uses only public information: no ura dora.
 */
export function scoreWith(game: MahjongGame, seat: number, counts: number[], winKind: number, selfDrawn: boolean, riichi: boolean, discarded?: number): HandScore | null {
  // A red five about to be discarded no longer counts.
  const redGone = discarded !== undefined && isRed(game.state, tileForKind(game, seat, discarded).id) ? 1 : 0;
  const pl = game.players[seat];
  const p = game.profile;
  let best: HandScore | null = null;
  const melds = game.scoringMelds(seat);
  const meldWilds = game.meldWilds(seat);
  for (const r of game.winReadings(seat, counts, handWilds(game, seat))) {
    const s = p.score({
      decomposition: r.decomposition,
      melds,
      concealedCounts: r.counts,
      winKind,
      selfDrawn,
      seatWind: game.state.seatWinds[seat],
      prevailingWind: game.prevailing,
      isDealer: seat === game.dealer,
      lastTileOfWall: false,
      afterKong: false,
      dealerRepeat: game.state.round.repeat,
      riichi,
      doubleRiichi: false,
      ippatsu: false,
      doraKinds: game.doraKinds(),
      uraDoraKinds: [],
      house: p.houseChoices,
      flowers: pl.flowers.map((t) => t.kind),
      redFives: game.redFivesIn(seat) - redGone,
      wildsUsed: r.assigned.length + meldWilds,
      card: game.state.cards?.[seat],
    });
    if (s.qualifies === false || s.value < p.minValue) continue;
    if (!best || s.points > best.points) best = s;
  }
  return best;
}

export interface WaitValue {
  waits: number[];
  /** Live copies of the waits. */
  live: number;
  /** Average ron value without a riichi declaration (0 = no yaku on a discard). */
  damaPoints: number;
  /** Average ron value with riichi (Riichi, closed hands), else equals damaPoints. */
  riichiPoints: number;
  /** Every live wait wins on a discard without declaring. */
  yakuAll: boolean;
  /** One of the waits was already discarded by this player. */
  furiten: boolean;
  /** Taiwanese: average of what a win collects in all, weighing self-draws (everyone pays) and discard wins. */
  collected?: number;
}

/** Value of a ready 13-tile-equivalent hand. */
export function waitValue(game: MahjongGame, seat: number, counts: number[], unseen = unseenCounts(game, seat), discarded?: number): WaitValue {
  const pl = game.players[seat];
  const ws = wildWaits(counts, handWilds(game, seat), pl.melds.length, game.shapesFor(seat), game.profile.wilds ?? { inPair: false, inChow: false });
  const canRiichi = !!game.profile.riichi && game.isConcealed(seat);
  let live = 0;
  let dama = 0;
  let withR = 0;
  let yakuAll = true;
  const collect = selfDrawPays(game);
  let coll = 0;
  for (const w of ws) {
    const n = unseen[w];
    if (!n) continue;
    live += n;
    counts[w]++;
    const d = scoreWith(game, seat, counts, w, false, false, discarded);
    const r = canRiichi ? scoreWith(game, seat, counts, w, false, true, discarded) : d;
    if (collect) {
      const t = scoreWith(game, seat, counts, w, true, false, discarded);
      coll += n * collected(game, seat, d, t);
    }
    counts[w]--;
    if (!d) yakuAll = false;
    dama += n * (d?.points ?? 0);
    withR += n * (r?.points ?? 0);
  }
  const furiten = game.profile.furiten && ws.some((w) => pl.discardKinds.includes(w) || w === discarded);
  return { waits: ws, live, damaPoints: live ? dama / live : 0, riichiPoints: live ? withR / live : 0, yakuAll: live > 0 && yakuAll, furiten, collected: collect ? (live ? coll / live : 0) : undefined };
}

/**
 * Share of wins that come by self-draw for a player who keeps pushing:
 * three opponents discard for every tile they draw themselves.
 */
const SELF_DRAW_SHARE = 0.28;

/** Taiwanese: a self-draw is paid by everyone, so it is worth about three discard wins. */
const selfDrawPays = (game: MahjongGame) => (game.profile.base ?? game.profile.id) === 'taiwanese';

/** What a win collects on average, from the profile's own payment rule (Taiwanese only). */
function collected(game: MahjongGame, seat: number, ron: HandScore | null, tsumo: HandScore | null): number {
  const p = game.profile;
  const n = p.players;
  const take = (discarder: number | null, s: HandScore) => p.payments(seat, discarder, s, game.dealer, n, game.state.round.repeat).reduce((a, x) => a + (x.to === seat ? x.amount : 0), 0);
  let r = 0;
  if (ron) for (let o = 0; o < n; o++) if (o !== seat) r += take(o, ron) / (n - 1);
  const t = tsumo ? take(null, tsumo) : 0;
  return (1 - SELF_DRAW_SHARE) * r + SELF_DRAW_SHARE * t;
}

/** Non-dealer Riichi value by han (closed 30–40 fu), interpolated. */
const RIICHI_BY_HAN = [0, 1300, 2600, 5200, 8000, 8000, 12000, 12000, 16000];

/**
 * Rough value of a hand that is not ready yet, relative to an ordinary hand,
 * in the same units as a ready hand's real score (so the two compare fairly).
 */
export function roughValue(game: MahjongGame, seat: number, counts: number[]): number {
  const pl = game.players[seat];
  const meldKinds = pl.melds.flatMap((m) => m.tiles.map((t) => t.kind));
  const value = (k: number) => isValueHonor(game, seat, k);
  let honourSets = 0;
  // On the all-pairs road an honour pung is broken into a pair and scores nothing as a set.
  const shapes = game.shapesFor(seat);
  const pairsRoad = !pl.melds.length && !!shapes.sevenPairs && sevenPairsShanten(counts) < (shapes.standard === false ? 99 : fastStandardShanten(counts, 0, shapes.sets ?? 4, shapes.chows !== false));
  if (!pairsRoad) for (let k = 27; k < KIND_COUNT; k++) if (value(k)) honourSets += counts[k] >= 3 ? 1 : counts[k] === 2 ? 0.35 : 0;
  for (const m of pl.melds) if (m.type !== 'chow' && value(m.tiles[0].kind)) honourSets += 1;
  // Flush potential: share of tiles in one suit plus honours.
  const all = [...meldKinds];
  counts.forEach((n, k) => {
    for (let i = 0; i < n; i++) all.push(k);
  });
  const suit = [0, 0, 0];
  let honours = 0;
  for (const k of all) k < 27 ? suit[Math.floor(k / 9)]++ : honours++;
  const flushShare = (Math.max(...suit) + honours) / Math.max(1, all.length);
  const flush = flushShare >= 0.92 ? 1 : flushShare >= 0.8 ? 0.3 : 0;
  const closed = game.isConcealed(seat);
  const dealer = seat === game.dealer;

  let points: number;
  if ((game.profile.base ?? game.profile.id) === 'riichi') {
    const dora = game.doraKinds();
    const nDora = all.reduce((a, k) => a + dora.filter((d) => d === k).length, 0) + game.redFivesIn(seat);
    const simples = all.filter((k) => k < 27 && k % 9 !== 0 && k % 9 !== 8).length / Math.max(1, all.length);
    let han: number;
    if (closed) han = 1.4 + (simples >= 0.85 ? 0.6 : 0) + 3 * flush;
    else han = openHandHasYakuPath(game, seat, -1, []) ? 1 + 2 * flush : 0;
    if (han > 0) han += nDora + honourSets * (closed ? 1 : 0.6);
    const h = Math.min(han, RIICHI_BY_HAN.length - 1);
    const lo = Math.floor(h);
    points = RIICHI_BY_HAN[lo] + (h - lo) * ((RIICHI_BY_HAN[lo + 1] ?? RIICHI_BY_HAN[lo]) - RIICHI_BY_HAN[lo]);
    if (dealer) points *= 1.5;
  } else if ((game.profile.base ?? game.profile.id) === 'taiwanese') {
    // Seat flowers already held count too. A self-draw is paid by all three
    // others and adds the self-draw tai (three with a concealed hand).
    const seatNo = WINDS.indexOf(game.state.seatWinds[seat]) + 1;
    const seatFlowers = pl.flowers.filter((f) => flowerNumber(f.kind) === seatNo).length;
    const tai = (closed ? 1 : 0) + (dealer ? 1 : 0) + honourSets + 4 * flush + seatFlowers + 0.3;
    const ron = 300 + 100 * tai;
    const self = 3 * (ron + 100 * (closed ? 2 : 1));
    points = (1 - SELF_DRAW_SHARE) * ron + SELF_DRAW_SHARE * self;
  } else if ((game.profile.base ?? game.profile.id) === 'korean3') {
    // Additive points: concealed (and a ready declaration) or self-draw, honours,
    // flushes. Flowers already set aside pay on top.
    const flowers = game.profile.flowers ? pl.flowers.length : 0;
    const pts = (closed ? (game.profile.riichi ? 2 : 1) : 0) + honourSets + 3 * flush + 0.4 + flowers * 0.7;
    points = 100 * Math.min(10, pts);
  } else if ((game.profile.base ?? game.profile.id) === 'singapore' || (game.profile.base ?? game.profile.id) === 'vietnamese') {
    // Bonus tiles already held score whatever happens: seat flowers, animals, flower jokers.
    const seatNo = WINDS.indexOf(game.state.seatWinds[seat]) + 1;
    const bonus = pl.flowers.filter((f) => (isFlower(f.kind) && flowerNumber(f.kind) === seatNo) || !isFlower(f.kind)).length;
    if ((game.profile.base ?? game.profile.id) === 'singapore') {
      const tai = Math.min(5, Math.max(1, honourSets + bonus + 3 * flush + 0.3));
      points = 32 * 2 ** (tai - 1);
    } else {
      const phan = (closed ? 1 : 0) + honourSets + bonus + 4 * flush + 0.6;
      points = 20 * (1 + phan);
    }
  } else {
    let faan = (closed ? 1 : 0) + honourSets + 3 * flush + 0.3;
    if (game.profile.flowers && pl.flowers.length === 0) faan += 1;
    points = 16 * 2 ** Math.min(8, faan);
  }
  return Math.max(0.02, points / ordinaryPoints(game));
}

/**
 * Calibration between the win-value and deal-in sides of the balance,
 * tuned by self-play (expert vs casual seats, duplicate walls).
 */
const RISK_SCALE = 0.2;

/**
 * Deal-in cost relative to the gain from a win, read from the profile's own
 * payment rule: what the discarder pays beyond what a bystander pays, as a
 * share of what the winner collects. Riichi and Taiwanese (the discarder
 * pays it all) come out at 1; Classic's "others pay half" at 0.5; a house
 * rule where everyone pays the same makes a deal-in nearly free.
 */
const lossWeightCache = new WeakMap<object, number>();
function lossWeight(game: MahjongGame): number {
  const p = game.profile;
  const hit = lossWeightCache.get(p);
  if (hit !== undefined) return hit;
  const n = p.players;
  const score: HandScore = { value: 1, unit: '', items: [], points: 1000, limit: false, base: 250 };
  const dealer = n - 1; // a bystander deals, so dealer bonuses don't skew the reading
  const pay = (ps: { from: number; amount: number }[], s: number) => ps.filter((x) => x.from === s).reduce((a, x) => a + x.amount, 0);
  const ron = p.payments(0, 1, score, dealer, n, 0);
  const won = ron.reduce((a, x) => a + (x.from !== 0 ? x.amount : 0), 0);
  const marginal = pay(ron, 1) - pay(ron, 2);
  const w = won > 0 ? Math.min(1.2, Math.max(0.1, marginal / won)) : 0.5;
  lossWeightCache.set(p, w);
  return w;
}

/** Typical ukeire (tiles that improve the hand) at each distance from ready; index 0 is a typical wait. */
const TYPICAL_UKEIRE = [6, 24, 40, 55, 65, 70, 70, 70, 70];
const typical = (s: number) => TYPICAL_UKEIRE[Math.min(Math.max(s, 0), TYPICAL_UKEIRE.length - 1)];

/** Expected own draws needed to become ready from `shanten` tiles away. */
export function drawsToReady(shanten: number, unseenTotal: number): number {
  let t = 0;
  for (let j = 1; j <= shanten; j++) t += (1.6 * Math.max(1, unseenTotal)) / typical(j);
  return t;
}

/**
 * Rough chance of winning from here. Distance from ready dominates; the
 * number of helpful tiles adjusts within a level, and the race against the
 * other players scales it down.
 */
export function pWinFor(shanten: number, ukeire: number, unseenTotal: number, draws: number, furiten: boolean, race = 0.7): number {
  const U = Math.max(1, unseenTotal);
  const ron = furiten ? 1 : 2.5;
  if (shanten <= 0) return race * (1 - Math.pow(1 - Math.min(0.9, ukeire / U), draws * ron));
  const x = draws - drawsToReady(shanten, U);
  const left = Math.min(draws, 3 * Math.log1p(Math.exp(x / 3)));
  const base = 1 - Math.pow(1 - typical(0) / U, left * 2.5);
  const shape = Math.min(1.15, Math.max(0.85, Math.sqrt(ukeire / typical(shanten))));
  return race * base * shape;
}

/**
 * Taiwanese: chance of winning the hand from `shanten` tiles away (rows 1..5+)
 * with `floor(live wall / 4)` own draws left (columns 0..14), measured in
 * self-play. Sixteen-tile hands start far from ready but calls carry them
 * quickly, so far hands early are worth more, and late ones less, than the
 * draw-only model says.
 */
const TW_PWIN = [
  [0, 0.015, 0.035, 0.055, 0.08, 0.1, 0.14, 0.165, 0.195, 0.245, 0.3, 0.34, 0.38, 0.45, 0.52],
  [0, 0.02, 0.03, 0.04, 0.045, 0.055, 0.065, 0.08, 0.095, 0.115, 0.16, 0.21, 0.27, 0.31, 0.36],
  [0, 0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.055, 0.06, 0.075, 0.09, 0.12, 0.165, 0.21, 0.25],
  [0, 0, 0, 0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.055, 0.06, 0.09, 0.11, 0.165, 0.21],
  [0, 0, 0, 0, 0, 0.01, 0.02, 0.03, 0.04, 0.045, 0.05, 0.07, 0.09, 0.11, 0.15],
];
/** Typical improving tiles in a 16-tile hand at 1..5 tiles from ready. */
const TW_UKEIRE = [12.5, 23, 38, 56, 80];

function twPWin(shanten: number, ukeire: number, live: number, race: number): number {
  const row = Math.min(shanten, 5) - 1;
  const d = Math.min(14, Math.max(0, Math.floor(live / 4)));
  const shape = Math.min(1.2, Math.max(0.8, Math.sqrt(ukeire / TW_UKEIRE[row])));
  const raceAvg = 0.54 + 0.018 * d;
  return TW_PWIN[row][d] * shape * Math.min(1.3, Math.max(0.5, race / raceAvg));
}

// ------------------------------------------------------------------ discards

/** The physical tile to let go for a kind: the drawn tile if it fits, never a red five when a plain one will do. */
export function tileForKind(game: MahjongGame, seat: number, kind: number): Tile {
  const ph = game.state.phase;
  const drawn = ph.kind === 'turn' && ph.seat === seat ? ph.drawn : null;
  const same = game.players[seat].hand.filter((t) => t.kind === kind);
  const plain = same.filter((t) => !isRed(game.state, t.id));
  if (drawn && drawn.kind === kind && !isRed(game.state, drawn.id)) return drawn;
  return plain[0] ?? (drawn && drawn.kind === kind ? drawn : same[0]);
}

/** How strongly the AI plays for one suit when the table needs a clean hand. */
export const CLEAN_BIAS = 30;

/** Would a set of `kind` take a clean-hand table's player out of their suit? */
export function offCleanSuit(game: MahjongGame, seat: number, kind: number): boolean {
  if (game.profile.specialRound === 'indiaWest') return !westPath(game, seat, kind);
  if (!game.profile.cleanHand || kind >= 27) return false;
  const s = dominantSuit(game, seat);
  return (s === 'man' ? 0 : s === 'pin' ? 1 : 2) !== Math.floor(kind / 9);
}

/**
 * India Rules Goulash: after exposing a pung of `kind`, can the hand still reach the 3 doubles
 * a win needs? Exposing gives up Concealed Mahjong, so the doubles must come from the kind of
 * clean hand (one suit alone, 1s and 9s, all honours: 3 each) or, for one suit with honours,
 * from dragon, own-wind and round-wind pungs and own flowers.
 */
export function westPath(game: MahjongGame, seat: number, kind: number): boolean {
  const pl = game.players[seat];
  const exposed = [...pl.melds.filter((m) => !m.concealed).map((m) => m.tiles[0].kind), kind];
  const all = [...pl.hand.map((t) => t.kind), ...pl.melds.flatMap((m) => m.tiles.map((t) => t.kind)), kind];
  const terminal = (k: number) => k < 27 && (k % 9 === 0 || k % 9 === 8);
  const plenty = (ok: (k: number) => boolean) => exposed.every(ok) && all.filter(ok).length >= 8;
  // Own and round flowers (and bouquets are rare): one double each.
  const own = WINDS.indexOf(game.state.seatWinds[seat]);
  const round = WINDS.indexOf(game.prevailing);
  const flowers = pl.flowers.filter((f) => isFlower(f.kind) && [own, round].includes(flowerNumber(f.kind) - 1)).length;
  for (let s = 0; s < 3; s++) {
    const inSuit = (k: number) => k < 27 && Math.floor(k / 9) === s;
    if (plenty(inSuit)) return true;
    if (!exposed.every((k) => inSuit(k) || k >= 27)) continue;
    const counts = game.naturalCounts(pl.hand);
    const value = (k: number) => isDragon(k) || k === windKind(game.state.seatWinds[seat]) || k === windKind(game.prevailing);
    let d = flowers;
    for (let k = 27; k < KIND_COUNT; k++) if (value(k) && (exposed.includes(k) || counts[k] >= 2)) d += k === windKind(game.state.seatWinds[seat]) && k === windKind(game.prevailing) ? 2 : 1;
    if (d >= 3 && all.filter((k) => inSuit(k) || k >= 27).length >= 8) return true;
  }
  return plenty(terminal) || plenty(isHonor);
}

export function planDiscard(game: MahjongGame, seat: number, o: PlanOptions = ADVISOR): DiscardPlan {
  const pl = game.players[seat];
  const evals = evaluateDiscards(game, seat);
  const danger = dangerMap(game, seat, o.depth);
  const unseen = unseenCounts(game, seat);
  const unseenTotal = unseen.reduce((a, b) => a + b, 0);
  const draws = Math.max(0, game.liveRemaining) / game.profile.players;
  const counts = game.naturalCounts(pl.hand);
  const lw = lossWeight(game);
  const ordinary = ordinaryPoints(game);
  const clean = !!game.profile.cleanHand;
  const flushBias = Math.max(o.flushBias, clean ? CLEAN_BIAS : 0);
  const suit = flushBias ? dominantSuit(game, seat) : null;
  const suitIdx = suit === 'man' ? 0 : suit === 'pin' ? 1 : suit === 'sou' ? 2 : -1;
  const dora = game.doraKinds();
  // The race: ready opponents may finish before us.
  const maxTenpai = Math.max(0, ...danger.reads.map((r) => r.tenpai));
  const race = danger.reads.reduce((a, r) => a * (1 - 0.25 * r.tenpai), 0.8);

  const riichiGame = (game.profile.base ?? game.profile.id) === 'riichi';
  // A card hand pays what the card says: flush and honour habits mean nothing here.
  const cardHand = !!cardUses(game.shapesFor(seat));
  const cands: Candidate[] = evals.map((e) => {
    counts[e.kind]--;
    let value: number;
    let furiten = false;
    let ukeire = e.ukeire;
    if (e.shanten === 0) {
      const wv = waitValue(game, seat, counts, unseen, e.kind);
      furiten = wv.furiten;
      const pts = wv.collected ?? Math.max(wv.riichiPoints, wv.damaPoints);
      value = pts > 0 ? pts / ordinary : game.isConcealed(seat) ? 0.15 : 0.02; // closed hands can still win by self-draw
      ukeire = wv.live;
    } else value = cardHand ? 1 : roughValue(game, seat, counts);
    counts[e.kind]++;
    if (dora.includes(e.kind) && e.shanten > 0) value *= 0.9;
    const pWin = e.shanten > 0 && (game.profile.base ?? game.profile.id) === 'taiwanese' ? twPWin(e.shanten, ukeire, game.liveRemaining, race) : pWinFor(e.shanten, ukeire, unseenTotal, draws, furiten, race);
    // Efficiency: distance from ready first, then helpful tiles and shape.
    let eff = -100 * e.shanten + ukeire + e.shapeBonus * 2;
    if (furiten) eff -= ukeire * 0.5;
    if (e.shanten === 0) eff += 12 * Math.min(value, 3);
    // Value matters too: a step towards a bigger hand is worth some speed.
    else eff += 15 * Math.log2(Math.max(value, 0.05));
    if (riichiGame && dora.includes(e.kind) && e.shanten > 0) eff -= 6;
    if (suitIdx >= 0 && (e.kind < 27 ? Math.floor(e.kind / 9) !== suitIdx : !clean && !isValueHonor(game, seat, e.kind))) eff += flushBias;
    const ev = 100 * pWin * value * o.valueBias;
    const loss = danger.loss[e.kind];
    // Pushing now usually means pushing again on later turns.
    const exposure = 1 + (0.25 + 0.3 * Math.min(draws, drawsToReady(e.shanten, unseenTotal))) * maxTenpai;
    const risk = RISK_SCALE * 100 * lw * o.caution * loss * exposure;
    return { ...e, pWin, value, loss, furiten, attack: eff, ev, risk, score: 0 };
  });
  // Ready beats one away: whatever tile would improve the slower hand can still reshape the ready
  // one later (draw it, let the other tile go), so being ready now never costs that chance.
  const slowBest = Math.max(-Infinity, ...cands.filter((c) => c.shanten > 0).map((c) => c.attack));
  for (const c of cands) if (c.shanten === 0 && c.ukeire > 0 && c.attack <= slowBest) c.attack = slowBest + 1;
  const fastest = cands.reduce((a, b) => (b.attack > a.attack || (b.attack === a.attack && b.kind < a.kind) ? b : a), cands[0]);
  // The best way to fold: lowest risk, keeping shape where it's free.
  const foldScore = (c: Candidate) => -c.risk + 0.02 * c.attack;
  const foldPick = cands.reduce((a, b) => (foldScore(b) > foldScore(a) ? b : a), cands[0]);
  const fold = foldPick.kind !== fastest.kind && foldPick.ev - foldPick.risk > fastest.ev - fastest.risk;
  for (const c of cands) c.score = fold ? foldScore(c) : c.attack - c.risk;
  const ranked = cands.slice().sort((a, b) => b.score - a.score || a.kind - b.kind);
  const threat = mainThreat(danger.reads);
  const mode: DiscardPlan['mode'] = fold ? 'fold' : threat && ranked[0].risk > 2 ? 'push' : 'normal';
  return { ranked, fastest, mode, danger, threat };
}

export type RiichiReason = 'noYaku' | 'normal' | 'valuable' | 'noTiles' | 'furiten';

export interface RiichiAdvice {
  riichi: boolean;
  reason: RiichiReason;
  wait: WaitValue;
}

/**
 * Whether to declare riichi when discarding `kind` leaves a ready closed hand.
 * Expert play stays quiet (dama) when the hand already scores well without it.
 */
export function riichiAdvice(game: MahjongGame, seat: number, kind: number): RiichiAdvice {
  const counts = game.naturalCounts(game.players[seat].hand);
  counts[kind]--;
  const wait = waitValue(game, seat, counts, undefined, kind);
  if (wait.live === 0) return { riichi: false, reason: 'noTiles', wait };
  if (!wait.yakuAll || wait.furiten) return { riichi: true, reason: wait.furiten ? 'furiten' : 'noYaku', wait };
  const big = seat === game.dealer ? 11600 : 7700;
  if (wait.damaPoints >= big) return { riichi: false, reason: 'valuable', wait };
  return { riichi: true, reason: 'normal', wait };
}

// ------------------------------------------------------------------ calls

export type ClaimReason = 'buy' | 'win' | 'noYaku' | 'noValue' | 'defend' | 'value' | 'speed' | 'noGain' | 'staysClosed' | 'none';

export interface ClaimPlan {
  best: ClaimResponse;
  reason: ClaimReason;
  before: number;
  /** Tiles from ready after the best call (and best discard). */
  after: number;
  /** Score of the best option (positive means calling is worthwhile). */
  gain: number;
}

export interface ClaimStyle {
  /** -1 never .. 1 eager. */
  eagerness: number;
  flushBias: number;
  /** Pass on calls while folding against a strong threat. */
  defend: boolean;
}

export const ADVISOR_CLAIMS: ClaimStyle = { eagerness: 0.3, flushBias: 0, defend: true };

/** Can an open hand still reach the profile's minimum value (non-yaku games)? */
export function openValuePath(game: MahjongGame, seat: number, calledKind: number, using: number[]): boolean {
  if (game.profile.specialRound === 'indiaWest') return westPath(game, seat, calledKind);
  if (game.profile.minValue <= 0) return true;
  const rules = game.shapesFor(seat);
  // Card and passport hands: whether the hand can still win is the ready check's job (shantenAfterCall).
  if (rules.standard === false) return true;
  // A round with no chows (Goulash): every win is All Pungs, which reaches the minimum.
  if (rules.chows === false && !game.profile.cleanHand) return true;
  const pl = game.players[seat];
  const value = (k: number) => isValueHonor(game, seat, k);
  if ((game.profile.base ?? game.profile.id) === 'korean3') return koreanOpenPath(game, seat, calledKind, using, value);
  // A pung of a value honour (a joker may make up the pung).
  if (using.length >= 2 && using.every((k) => k === calledKind || k >= KIND_COUNT) && value(calledKind)) return true;
  if (pl.melds.some((m) => m.type !== 'chow' && value(m.tiles[0].kind))) return true;
  const c = game.naturalCounts(pl.hand);
  if (c.some((n, k) => n >= 2 && value(k) && k !== calledKind)) return true;
  if (game.profile.flowers && pl.flowers.length === 0 && game.profile.minValue <= 1 && (game.profile.base ?? game.profile.id) !== 'singapore') return true; // "no flowers"
  // Bonus tiles already set aside that score: your seat flowers, animals.
  const seatNo = WINDS.indexOf(game.state.seatWinds[seat]) + 1;
  const scoring = pl.flowers.filter((f) => isAnimal(f.kind) || (isFlower(f.kind) && flowerNumber(f.kind) === seatNo)).length;
  if (scoring >= game.profile.minValue) return true;
  // Flush in reach.
  const all = [...pl.hand.map((t) => t.kind), calledKind, ...pl.melds.flatMap((m) => m.tiles.map((t) => t.kind))];
  const suit = [0, 0, 0];
  for (const k of all) if (k < 27) suit[Math.floor(k / 9)]++;
  return Math.max(...suit) + all.filter(isHonor).length >= all.length - 2;
}

/**
 * Korean: an open hand needs the minimum in points from sets alone (flowers
 * never count). Each value honour pung is a point, all pungs two, a flush two
 * or five; self-draw may add one, so aim for one short of the minimum.
 */
function koreanOpenPath(game: MahjongGame, seat: number, calledKind: number, using: number[], value: (k: number) => boolean): boolean {
  const pl = game.players[seat];
  const c = game.naturalCounts(pl.hand);
  let pts = 0;
  const pungCall = using.length >= 2 && using.every((k) => k === calledKind);
  if (pungCall && value(calledKind)) pts += calledKind === windKind(game.state.seatWinds[seat]) && calledKind === windKind(game.prevailing) ? 2 : 1;
  for (const m of pl.melds) if (m.type !== 'chow' && value(m.tiles[0].kind)) pts += 1;
  c.forEach((n, k) => {
    if (k !== calledKind && value(k)) pts += n >= 3 ? 1 : n === 2 ? 0.5 : 0;
  });
  // All pungs in reach: only pung calls so far and mostly pairs and pungs in hand.
  const pairs = c.filter((n) => n >= 2).length;
  if (pungCall && pl.melds.every((m) => m.type !== 'chow') && pairs + pl.melds.length + 1 >= 4) pts += 1.5;
  const all = [...pl.hand.map((t) => t.kind), calledKind, ...pl.melds.flatMap((m) => m.tiles.map((t) => t.kind))];
  const suit = [0, 0, 0];
  for (const k of all) if (k < 27) suit[Math.floor(k / 9)]++;
  if (Math.max(...suit) + all.filter(isHonor).length >= all.length - 2) pts += 2;
  return pts + 1 >= game.profile.minValue;
}

/** True when calling `o` on `kind` would leave `seat` with no winning hand left to build (a set that fits none of
 *  their cards, say) though the hand can still win now. The table warns before such a call; it never blocks it. */
export function callLeavesNoWin(game: MahjongGame, seat: number, o: ClaimOption, kind: number): boolean {
  if (o.type === 'win' || o.type === 'buy') return false;
  if (currentShanten(game, seat) >= 99) return false;
  const using = o.using ?? new Array(o.type === 'kong' ? 3 : 2).fill(kind);
  // Whether any winning hand is left depends on the sets, not on which tile goes next, so one look at the hand
  // straight after the call does (trying every discard, as shantenAfterCall does, takes seconds on card rounds).
  const pl = game.players[seat];
  const counts = game.naturalCounts(pl.hand);
  const wilds = handWilds(game, seat);
  for (const k of using) {
    if (k < KIND_COUNT) counts[k]--;
    else if (wilds.includes(k)) wilds.splice(wilds.indexOf(k), 1);
  }
  const meld = o.type === 'kong' ? { type: 'kong' as const, kind } : callMeld(kind, using);
  return game.withPendingMeld(seat, meld, () => shantenWith(counts, pl.melds.length + 1, game.shapesFor(seat), wilds)) >= 99;
}

function shantenAfterKongCall(game: MahjongGame, seat: number, kind: number) {
  const pl = game.players[seat];
  const counts = game.naturalCounts(pl.hand);
  counts[kind] -= 3;
  return game.withPendingMeld(seat, { type: 'kong', kind }, () => shantenWith(counts, pl.melds.length + 1, game.shapesFor(seat), handWilds(game, seat)));
}

export function planClaim(game: MahjongGame, seat: number, options: ClaimOption[], kind: number, style: ClaimStyle = ADVISOR_CLAIMS, depth: ReadDepth = 'full'): ClaimPlan {
  const before = currentShanten(game, seat);
  const win = options.find((o) => o.type === 'win');
  if (win) return { best: win, reason: 'win', before, after: -1, gain: 99 };
  const pass = (reason: ClaimReason, after = before, gain = 0): ClaimPlan => ({ best: { type: 'pass' }, reason, before, after, gain });
  if (!options.length) return pass('none');
  // Sichuan: never lock in a set of the suit being cleared out.
  if (kind < 27 && Math.floor(kind / 9) === voidSuit(game, seat)) return pass('noValue');
  // A clean hand is needed (India Rules Goulash): no sets of a second suit.
  if (offCleanSuit(game, seat, kind)) return pass('noValue');
  if (style.defend && before >= 2) {
    // Far from ready against a declared or obvious ready hand: don't open up, keep safe tiles.
    const threat = mainThreat(dangerMap(game, seat, depth).reads, 0.9);
    if (threat) return pass('defend');
  }
  const riichiGame = !!game.profile.riichi;
  const closed = game.isConcealed(seat);
  let best: { o: ClaimOption; gain: number; after: number; value: boolean } | null = null;
  let blocked: ClaimReason | null = null;
  let bought: { o: ClaimOption; gain: number; after: number; value: boolean } | null = null;
  for (const o of options) {
    if (o.type === 'buy') {
      // Buying (India Rules): the tile comes in concealed instead of the wall draw, so it is worth
      // its price only when it brings the hand closer. A ready hand can't win on a bought tile.
      const after = before > 0 ? shantenAfterBuy(game, seat, kind) : before;
      // No eagerness (a bought tile doesn't open the hand), but a free call that does as well comes first.
      const gain = before - after - 0.45;
      if (after < before) bought = { o, gain, after, value: false };
      if (!best || gain > best.gain || (gain === best.gain && after <= best.after)) best = { o, gain, after, value: false };
      continue;
    }
    const using = o.using ?? [kind, kind];
    if (game.profile.yakuRequired && !openHandHasYakuPath(game, seat, kind, using)) {
      blocked = 'noYaku';
      continue;
    }
    if (!game.profile.yakuRequired && !openValuePath(game, seat, kind, using)) {
      blocked = 'noValue';
      continue;
    }
    const after = o.type === 'kong' ? shantenAfterKongCall(game, seat, kind) : shantenAfterCall(game, seat, using, kind);
    const value = o.type !== 'chow' && isValueHonor(game, seat, kind);
    let gain = before - after;
    if (value) gain += 0.8;
    if (o.type === 'chow') gain -= 0.25;
    if (o.type === 'kong') gain -= after > before ? 1 : 0.1;
    if (closed && !value) {
      // Opening the hand gives up riichi (or the concealed bonus).
      gain -= riichiGame ? 0.45 : 0.15;
      if (riichiGame && after >= 2) gain -= 0.5;
    }
    if (style.flushBias && kind < 27 && o.type === 'chow') {
      const s = dominantSuit(game, seat);
      if ((s === 'man' ? 0 : s === 'pin' ? 1 : 2) !== Math.floor(kind / 9)) gain -= 1;
    }
    if (isDragon(kind) && o.type !== 'chow') gain += 0.1;
    gain += style.eagerness * 0.5;
    if (!best || gain > best.gain) best = { o, gain, after, value };
  }
  if (!best) return pass(blocked ?? 'none');
  // A buy that brings the hand closer is worth its price when no call is.
  if (best.gain < 0.75 && bought) best = bought;
  if (best.gain >= 0.75 || best === bought) return { best: best.o, reason: best.o.type === 'buy' ? 'buy' : best.value ? 'value' : 'speed', before, after: best.after, gain: best.gain };
  return pass(closed && best.after < before ? 'staysClosed' : 'noGain', best.after, best.gain);
}
