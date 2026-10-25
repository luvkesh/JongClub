// AI opponents: four difficulty levels crossed with five personalities.
// Difficulty controls how well the bot reads tile efficiency; personality
// controls style (calling, defence, value chasing).

import type { MahjongGame } from '../engine/game';
import { Rng } from '../engine/rng';
import type { ClaimOption, ClaimResponse } from '../engine/state';
import { isDragon, isTerminalOrHonor, suitOf } from '../engine/tiles';
import { shanten } from '../engine/hand';
import type { JokerSwap } from '../engine/game';
import { distance as cardDistance } from '../engine/rules/american';
import type { Tile } from '../engine/tiles';
import { americanPlan, bestSwap, charlestonPick, missingAfterCall } from './american';
import { currentShanten, dominantSuit, exchangePick, evaluateDiscards, handWilds, isValueHonor, openHandHasYakuPath, shantenAfterBuy, shantenAfterCall, shantenWith } from './evaluate';
import { CLEAN_BIAS, offCleanSuit, openValuePath, planClaim, planDiscard, riichiAdvice, tileForKind, type ClaimStyle, type PlanOptions } from './strategy';
import { tr } from '../i18n';
import { pickNearestCard } from './indiaCardPick';
import { bigClaim, bigTurn } from './indiaBigPlay';
import type { BigGroup } from '../engine/rules/indiaBig';

export type Difficulty = 'beginner' | 'casual' | 'strategic' | 'expert';
export type Personality = 'teacher' | 'shark' | 'wall' | 'gambler' | 'zen';

export const DIFFICULTIES: Record<Difficulty, { label: string; detail: string }> = {
  beginner: { label: tr('Beginner'), detail: tr('Makes understandable mistakes') },
  casual: { label: tr('Casual'), detail: tr('Balanced and friendly') },
  strategic: { label: tr('Strategic'), detail: tr('Strong tile efficiency') },
  expert: { label: tr('Expert'), detail: tr('Highly competitive') },
};

export const PERSONALITIES: Record<Personality, { label: string; detail: string; names: string[] }> = {
  teacher: { label: tr('The Teacher'), detail: tr('Explains decisions'), names: ['Mei', 'Professor Lau'] },
  shark: { label: tr('The Shark'), detail: tr('Aggressive'), names: ['Rex', 'Vanessa'] },
  wall: { label: tr('The Wall'), detail: tr('Defensive'), names: ['Hiro', 'Greta'] },
  gambler: { label: tr('The Gambler'), detail: tr('Chases big hands'), names: ['Lucky', 'Dominic'] },
  zen: { label: tr('The Zen Player'), detail: tr('Calm and conservative'), names: ['Sora', 'Amara'] },
};
/** Names for AI seats, one per personality in seat order, never the same name twice at a table
 *  (three Zen players are Sora, Amara and then a name from another personality). */
export function seatNames(personalities: Personality[], taken: string[] = []): string[] {
  const used = new Set(taken);
  const all = Object.values(PERSONALITIES).flatMap((x) => x.names);
  return personalities.map((p, i) => {
    const own = PERSONALITIES[p].names;
    const name = [own[i % 2 === 0 ? 0 : 1], ...own, ...all].find((n) => !used.has(n)) ?? own[0];
    used.add(name);
    return name;
  });
}


interface Style {
  noise: number;
  ukeireWeight: number;
  defense: number;
  callEagerness: number; // -1 never .. 1 always when not worse
  flushBias: number;
  blunderRate: number;
}

const DIFF_STYLE: Record<Difficulty, Pick<Style, 'noise' | 'ukeireWeight' | 'blunderRate'> & { defenseMul: number }> = {
  beginner: { noise: 30, ukeireWeight: 0.3, blunderRate: 0.25, defenseMul: 0.2 },
  casual: { noise: 8, ukeireWeight: 0.8, blunderRate: 0.05, defenseMul: 0.6 },
  strategic: { noise: 2, ukeireWeight: 1, blunderRate: 0, defenseMul: 1 },
  expert: { noise: 0, ukeireWeight: 1.2, blunderRate: 0, defenseMul: 1.5 },
};

const PERS_STYLE: Record<Personality, Pick<Style, 'defense' | 'callEagerness' | 'flushBias'>> = {
  teacher: { defense: 12, callEagerness: 0.3, flushBias: 0 },
  shark: { defense: 3, callEagerness: 0.9, flushBias: 0 },
  wall: { defense: 45, callEagerness: 0.1, flushBias: 0 },
  gambler: { defense: 5, callEagerness: 0.5, flushBias: 6 },
  zen: { defense: 25, callEagerness: -0.5, flushBias: 0 },
};

/**
 * How each personality balances attack and defence in the strong levels.
 * caution > 1 folds earlier (The Wall), < 1 pushes on (The Shark, The Gambler).
 */
const PERS_PLAN: Record<Personality, { caution: number; valueBias: number }> = {
  teacher: { caution: 1, valueBias: 1 },
  shark: { caution: 0.65, valueBias: 1 },
  wall: { caution: 1.7, valueBias: 0.95 },
  gambler: { caution: 0.75, valueBias: 1.25 },
  zen: { caution: 1.2, valueBias: 1 },
};

/** Strategic and expert players use the full attack/defence model. */
const isStrong = (d: Difficulty) => d === 'strategic' || d === 'expert';

export interface AiDecision {
  /** 'abort': declare nine terminals (Riichi). 'kita': set a North aside (sanma). */
  action: 'discard' | 'win' | 'kong' | 'swap' | 'abort' | 'kita' | 'group';
  swap?: JokerSwap;
  /** India Rules Big Cards: the kong, qwong or run to lay down. */
  group?: BigGroup;
  tileId?: number;
  kind?: number;
  riichi?: boolean;
  /** One-line table talk for the Teacher personality. */
  remark?: string;
}

export class AiPlayer {
  readonly style: Style;
  private rng: Rng;
  constructor(
    readonly seat: number,
    readonly difficulty: Difficulty,
    readonly personality: Personality,
    seed: number,
  ) {
    const d = DIFF_STYLE[difficulty];
    const p = PERS_STYLE[personality];
    this.style = { noise: d.noise, ukeireWeight: d.ukeireWeight, blunderRate: d.blunderRate, defense: p.defense * d.defenseMul, callEagerness: p.callEagerness, flushBias: p.flushBias };
    this.rng = new Rng(seed);
  }

  decideTurn(game: MahjongGame): AiDecision {
    const opts = game.turnOptions(this.seat);
    if (opts.canWin) return { action: 'win' };
    if (opts.nineTerminals && this.wantsNineTerminals(game)) return { action: 'abort' };
    if (opts.kita && this.wantsKita(game)) return { action: 'kita' };
    if (game.profile.card) return this.americanTurn(game, opts.jokerSwaps);
    if (game.profile.big) return bigTurn(game, this.seat, opts, this.style.blunderRate + this.style.noise / 200, () => this.rng.next());
    if (game.players[this.seat].riichi) return { action: 'discard', tileId: opts.discards[0].id, kind: opts.discards[0].kind };
    // Only jokers left to choose from (Asian wild profiles): nothing to weigh.
    if (!opts.discards.some((t) => t.kind < 34)) return { action: 'discard', tileId: opts.discards[0].id, kind: opts.discards[0].kind };
    if (isStrong(this.difficulty)) return this.strongTurn(game, opts.kongs, opts.riichiDiscards);
    const before = currentShanten(game, this.seat);
    for (const k of opts.kongs) {
      // Kong only if it doesn't slow the hand down.
      if (shantenAfterKong(game, this.seat, k) <= before) return { action: 'kong', kind: k };
    }
    const kind = this.pickDiscardKind(game);
    const tile = tileForKind(game, this.seat, kind);
    // Declare riichi when the discard leaves a ready closed hand.
    const wantsRiichi = this.difficulty === 'beginner' ? this.rng.next() < 0.5 : this.personality === 'zen' ? this.rng.next() < 0.7 : true;
    const riichi = opts.riichiDiscards.includes(tile.id) && wantsRiichi;
    return { action: 'discard', tileId: tile.id, kind, riichi };
  }

  /**
   * Nine terminals: abandon the hand unless thirteen orphans is close. With
   * eleven or more different terminals and honours, play on for it (a
   * beginner always takes the redeal).
   */
  private wantsNineTerminals(game: MahjongGame): boolean {
    const kinds = new Set(game.players[this.seat].hand.filter((t) => isTerminalOrHonor(t.kind)).map((t) => t.kind)).size;
    return this.difficulty === 'beginner' || kinds < 11;
  }

  /** Kita: set the North aside unless the hand needs it (a pair or set of Norths, thirteen orphans). */
  private wantsKita(game: MahjongGame): boolean {
    const k = game.profile.nukiDora!;
    const pl = game.players[this.seat];
    if (pl.riichi) return true;
    const c = game.concealedCounts(this.seat);
    const before = shanten(c, pl.melds.length, game.shapesFor(this.seat));
    c[k]--;
    return shanten(c, pl.melds.length, game.shapesFor(this.seat)) <= before;
  }

  /** Settings for the shared attack/defence model. */
  planOptions(): PlanOptions {
    const p = PERS_PLAN[this.personality];
    const expert = this.difficulty === 'expert';
    return { depth: expert ? 'full' : 'basic', caution: p.caution * (expert ? 1 : 0.85), valueBias: p.valueBias, flushBias: this.style.flushBias };
  }

  claimStyle(): ClaimStyle {
    return { eagerness: this.style.callEagerness, flushBias: this.style.flushBias, defend: this.difficulty === 'expert' || this.personality === 'wall' || this.personality === 'zen' };
  }

  private strongTurn(game: MahjongGame, kongs: number[], riichiDiscards: number[]): AiDecision {
    const plan = planDiscard(game, this.seat, this.planOptions());
    // Kong only when it doesn't slow the hand and nobody is threatening (a kong shows more dora).
    // Taiwanese has no dora: the replacement draw is free, so always take it.
    if (kongs.length && (!plan.threat || plan.mode === 'push' || (game.profile.base ?? game.profile.id) === 'taiwanese')) {
      const before = currentShanten(game, this.seat);
      for (const k of kongs) if (shantenAfterKong(game, this.seat, k) <= before) return { action: 'kong', kind: k };
    }
    let pick = plan.ranked[0];
    if (this.style.noise) {
      let bestV = -Infinity;
      for (const c of plan.ranked) {
        const v = c.score + (this.rng.next() - 0.5) * this.style.noise;
        if (v > bestV) {
          bestV = v;
          pick = c;
        }
      }
    }
    const tile = tileForKind(game, this.seat, pick.kind);
    let riichi = false;
    if (riichiDiscards.includes(tile.id)) {
      const advice = riichiAdvice(game, this.seat, pick.kind);
      riichi = this.difficulty === 'expert' ? advice.riichi : advice.reason !== 'noTiles';
    }
    return { action: 'discard', tileId: tile.id, kind: pick.kind, riichi };
  }

  // ------------------------------------------------------------ American

  private americanTurn(game: MahjongGame, swaps: JokerSwap[]): AiDecision {
    // A joker is always worth more than the natural tile it replaces.
    const pl = game.players[this.seat];
    const swap = this.difficulty !== 'beginner' ? bestSwap(swaps, pl.hand, pl.melds) : undefined;
    if (swap) return { action: 'swap', swap };
    const ranked = americanPlan(game, this.seat, this.style.defense * 0.02, isStrong(this.difficulty));
    const blunder = this.rng.next() < this.style.blunderRate + this.style.noise / 200;
    const pick = blunder && ranked.length > 1 ? ranked[1 + this.rng.int(Math.min(2, ranked.length - 1))] : ranked[0];
    return { action: 'discard', tileId: pick.tile.id, kind: pick.tile.kind };
  }

  charlestonPass(game: MahjongGame): Tile[] {
    // Asian goulash exchange: pass what the sets-and-a-pair hand needs least.
    if (!game.profile.card) return exchangePick(game, this.seat);
    return charlestonPick(game.players[this.seat].hand, this.style.blunderRate, () => this.rng.next());
  }

  /** Goulash round, as East: more exchanges when the hand is far from a win.
   *  India Rules (Tic-Tac-Toe and wall exchanges are optional): none when close. */
  exchangeChoice(game: MahjongGame): { passes: 0 | 1 | 3; wall: 0 | 1 | 3 } {
    const sh = currentShanten(game, this.seat);
    if (game.state.exchange?.india) {
      // One question at a time: start one when the hand is far, go on to three when it's still far.
      const ph = game.state.phase;
      const step = ph.kind === 'exchangeChoice' ? (ph.step ?? 'ttt') : 'ttt';
      const n = step === 'ttt' ? (sh >= 3 ? 1 : 0) : step === 'tttMore' ? (sh >= 3 ? 3 : 1) : step === 'wall' ? (sh >= 2 ? 1 : 0) : sh >= 3 ? 3 : 1;
      return step === 'ttt' || step === 'tttMore' ? { passes: n, wall: 0 } : { passes: 0, wall: n };
    }
    const far = sh >= 3;
    return { passes: far ? 3 : 1, wall: far ? 3 : 1 };
  }

  /** India Rules Small Cards: keep the card nearest the tiles held, the better-paying one on a tie. */
  cardPick(game: MahjongGame): number {
    const offers = game.state.cardOffers?.[this.seat] ?? [];
    return pickNearestCard(game, this.seat, offers);
  }

  /** India Rules North round, as East before the deal: the East round half the time (passport
   *  compulsory, as the club plays it), otherwise Small Cards, Goulash with a random number or a Big Card. */
  roundChoice(game: MahjongGame): number {
    const codes = (game.profile.roundChoices ?? []).map((c) => c.code);
    if (!codes.length) return 0;
    const r = this.rng.next();
    const goulash = codes.filter((c) => c >= 10 && c < 100);
    const big = codes.filter((c) => c > 100);
    if (r >= 0.8 && big.length) return big[this.rng.int(big.length)];
    const pick = r < 0.45 ? codes[0] : r < 0.65 && codes.includes(2) ? 2 : goulash.length ? goulash[this.rng.int(goulash.length)] : codes[0];
    return pick;
  }

  /** India Rules Tic-Tac-Toe: three tiles, for the right, across and left. */
  ticTacToePick(game: MahjongGame): Tile[] {
    return exchangePick(game, this.seat);
  }

  /** Goulash round: the three tiles to swap with the wall. */
  wallExchangePick(game: MahjongGame): Tile[] {
    return exchangePick(game, this.seat);
  }

  /** Agree to a second Charleston when the hand is still far from the card. */
  charlestonVote(game: MahjongGame): boolean {
    // Card-less Charleston (Wright-Patterson): pass again while the hand is far from a win.
    if (!game.profile.card) return currentShanten(game, this.seat) >= 3;
    const pl = game.players[this.seat];
    return cardDistance(pl.hand, pl.melds) >= 5;
  }

  private americanClaim(game: MahjongGame, options: ClaimOption[], kind: number): ClaimResponse {
    const pl = game.players[this.seat];
    // Compare like with like: tiles needed now vs after calling and making the best discard.
    const now = cardDistance(pl.hand, pl.melds);
    let best: { o: ClaimOption; after: number } | null = null;
    for (const o of options) {
      if (o.type !== 'pung' && o.type !== 'kong') continue;
      const after = missingAfterCall(game, this.seat, kind, o.type === 'kong' ? 4 : 3);
      if (!best || after < best.after) best = { o, after };
    }
    if (best && best.after < now && !(this.difficulty === 'beginner' && this.rng.next() < 0.3)) return best.o;
    return { type: 'pass' };
  }

  pickDiscardKind(game: MahjongGame): number {
    const evals = evaluateDiscards(game, this.seat);
    const s = this.style;
    const clean = !!game.profile.cleanHand;
    const flushBias = Math.max(s.flushBias, clean ? CLEAN_BIAS : 0);
    const suit = flushBias ? dominantSuit(game, this.seat) : null;
    const scored = evals.map((e) => {
      let v = -e.shanten * 100 + e.ukeire * s.ukeireWeight + e.shapeBonus * 2 - e.danger * s.defense;
      if (suit && (e.kind >= 27 ? !clean && !isValueHonor(game, this.seat, e.kind) : suitOf(e.kind) !== suit)) v += flushBias;
      v += (this.rng.next() - 0.5) * s.noise;
      return { kind: e.kind, v };
    });
    scored.sort((a, b) => b.v - a.v);
    if (this.rng.next() < s.blunderRate) return scored[Math.min(scored.length - 1, 1 + this.rng.int(3))].kind;
    return scored[0].kind;
  }

  decideClaim(game: MahjongGame, options: ClaimOption[], discardKind: number): ClaimResponse {
    const win = options.find((o) => o.type === 'win');
    if (win) return win;
    if (game.profile.card) return this.americanClaim(game, options, discardKind);
    if (game.profile.big) return this.difficulty === 'beginner' && this.rng.next() < 0.3 ? { type: 'pass' } : bigClaim(game, this.seat, options, discardKind);
    if (isStrong(this.difficulty)) return planClaim(game, this.seat, options, discardKind, this.claimStyle(), this.planOptions().depth).best;
    if (offCleanSuit(game, this.seat, discardKind)) return { type: 'pass' };
    const before = currentShanten(game, this.seat);
    let best: { o: ClaimOption; gain: number } | null = null;
    for (const o of options) {
      if (game.profile.yakuRequired) {
        const using = o.using ?? [discardKind, discardKind];
        if (!openHandHasYakuPath(game, this.seat, discardKind, using)) continue;
      }
      // Korean: an open hand still needs the minimum from its sets (flowers never count).
      if ((game.profile.base ?? game.profile.id) === 'korean3' && !openValuePath(game, this.seat, discardKind, o.using ?? [discardKind, discardKind])) continue;
      if (o.type === 'buy') {
        const gain = before > 0 ? before - shantenAfterBuy(game, this.seat, discardKind) : 0;
        if (!best || gain > best.gain) best = { o, gain };
        continue;
      }
      const remove = o.using ?? new Array(o.type === 'kong' ? 3 : 2).fill(discardKind);
      const after = o.type === 'kong' ? shantenAfterKongCall(game, this.seat, discardKind) : shantenAfterCall(game, this.seat, remove, discardKind);
      let gain = before - after;
      const value = o.type !== 'chow' && (isDragon(discardKind) || isValueHonor(game, this.seat, discardKind));
      if (value) gain += 0.6;
      if (o.type === 'chow') gain -= 0.3;
      gain += this.style.callEagerness * 0.5;
      if (this.style.flushBias && o.type === 'chow' && suitOf(discardKind) !== dominantSuit(game, this.seat)) gain -= 1;
      if (!best || gain > best.gain) best = { o, gain };
    }
    if (best && best.gain >= 0.75 && !(this.difficulty === 'beginner' && this.rng.next() < 0.3)) return best.o;
    return { type: 'pass' };
  }
}

export function shantenAfterKong(game: MahjongGame, seat: number, kind: number) {
  const pl = game.players[seat];
  const isAdded = pl.melds.some((m) => m.type === 'pung' && m.tiles[0].kind === kind);
  const remove = isAdded ? [kind] : [kind, kind, kind, kind];
  const counts = new Array(34).fill(0);
  for (const t of pl.hand) if (t.kind < 34) counts[t.kind]++;
  for (const k of remove) counts[k]--;
  // After a kong a replacement is drawn; compare on the 13-tile-equivalent hand.
  if (isAdded) return shantenOf(counts, pl.melds.length, game, seat);
  return game.withPendingMeld(seat, { type: 'kong', kind }, () => shantenOf(counts, pl.melds.length + 1, game, seat));
}

function shantenAfterKongCall(game: MahjongGame, seat: number, kind: number) {
  const pl = game.players[seat];
  const counts = new Array(34).fill(0);
  for (const t of pl.hand) if (t.kind < 34) counts[t.kind]++;
  counts[kind] -= 3;
  return game.withPendingMeld(seat, { type: 'kong', kind }, () => shantenOf(counts, pl.melds.length + 1, game, seat));
}

function shantenOf(counts: number[], melds: number, game: MahjongGame, seat: number) {
  return shantenWith(counts, melds, game.shapesFor(seat), handWilds(game, seat));
}

/** Build a table of three AI opponents. */
export function makeOpponents(difficulty: Difficulty, personalities: Personality[], seed: number): { ai: AiPlayer; name: string }[] {
  const used = new Set<string>();
  return personalities.map((p, i) => {
    const names = PERSONALITIES[p].names;
    const name = names.find((n) => !used.has(n)) ?? names[0];
    used.add(name);
    return { ai: new AiPlayer(i + 1, difficulty, p, seed + i * 7919), name };
  });
}
