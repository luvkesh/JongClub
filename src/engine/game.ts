// The game engine: a deterministic state machine for one table.
// It knows nothing about rendering, AI or timing. Everything variant
// specific comes from the RuleProfile; round flow comes from rounds.ts.

import { Decomposition, WildReading, shanten, waits, wildDecompositions, wildShanten, wildWaits, type MeldShape, type ShapeRules } from './hand';
import { Rng } from './rng';
import { openingRules, wallBreak } from './opening';
import { advanceRound, initialRound, prevailingWind, seatWind } from './rounds';
import { roundOverlay } from './rules/windRounds';
import type { AbortiveKind, HandScore, Payment, RuleProfile, SeatInfo } from './rules/types';
import type { InstantEvent } from './rules/types';
import type { ClaimOption, ClaimResponse, GameEvent, GameState, HandResult, IndiaExchangeStep, Meld, PlayerState } from './state';
import { FLOWER_BASE, FLOWER_COUNT, JOKER_KIND, KIND_COUNT, Tile, extraTileIds, isFlower, isJoker, isRed, isTerminalOrHonor, isWind, redFiveIds, toCounts, wildCovers, wildTargets, windKind } from './tiles';
import { FL, bigCallKinds, bigDistance, bigGroups, bigScore, bigWins, type BigCtx, type BigGroup, type MInfo } from './rules/indiaBig';

export interface TurnOptions {
  canWin: boolean;
  winScore?: HandScore;
  /** Kinds that can be declared as a concealed or added kong. */
  kongs: number[];
  discards: Tile[];
  /** Tile ids whose discard leaves a ready hand and allows a riichi declaration. */
  riichiDiscards: number[];
  /** American: natural tiles you can trade for a joker in an exposure. */
  jokerSwaps: JokerSwap[];
  /** Riichi: nine different terminals and honours on your first turn; you may abandon the hand. */
  nineTerminals?: boolean;
  /** Sanma: a North may be set aside as a bonus dora (kita). */
  kita?: boolean;
  /** India Rules Big Cards: kongs, qwongs and runs you can lay down now (each draws its extra tiles). */
  groups?: BigGroup[];
}

export interface JokerSwap {
  owner: number;
  meld: number;
  /** Your natural tile that replaces the joker. */
  tileId: number;
}

/** Charleston passes: right, across, left; then optionally left, across, right. */
export const CHARLESTON = [1, 2, 3, 3, 2, 1] as const;
export const charlestonDirName = (offset: number) => (offset === 1 ? 'right' : offset === 2 ? 'across' : 'left');

/** Extra facts about a win that the positional arguments of evaluateWin don't carry. */
export interface WinContext {
  /** Won on a tile being added to someone's pung. */
  robbedKong?: boolean;
  /** Physical id of the winning tile when it is not yet in the hand (for red fives). */
  winTileId?: number;
  /** Seat that threw (or was adding) the winning tile. */
  discarder?: number;
}

export interface WinEvaluation {
  score: HandScore;
  decomposition: Decomposition;
}

export class MahjongGame {
  /** The table's rule profile as set up (house rules applied). */
  readonly baseProfile: RuleProfile;
  /** Profiles of the special wind rounds, made once each. */
  private overlays = new Map<string, RuleProfile>();
  state: GameState;
  matchOver = false;
  /** True while the opening hands are being dealt (bonus tiles found now are "in the deal"). */
  private dealing = false;
  private listeners: ((e: GameEvent, s: GameState) => void)[] = [];

  constructor(profile: RuleProfile, names: string[], seed: number) {
    this.baseProfile = profile;
    const players: PlayerState[] = names.slice(0, profile.players).map((name, seat) => ({
      seat,
      name,
      hand: [],
      melds: [],
      discards: [],
      claimedDiscards: [],
      called: [],
      discardKinds: [],
      score: profile.startingScore,
      riichi: false,
      doubleRiichi: false,
      riichiDiscard: null,
      riichiPaid: false,
      ippatsu: false,
      furitenTemp: false,
      furitenLocked: false,
      flowers: [],
    }));
    const round = initialRound();
    this.state = {
      profileId: profile.id,
      players,
      wall: [],
      wallOrder: [],
      drawnFromFront: 0,
      drawnFromBack: 0,
      round,
      seatWinds: players.map((_, s) => seatWind(profile.rounds, round, s, profile.players)),
      prevailingWind: prevailingWind(profile.rounds, round),
      riichiPot: 0,
      doraRevealed: 0,
      callsMade: 0,
      phase: { kind: 'handOver', result: { type: 'draw', payments: [], deltas: players.map(() => 0) } },
      turnCount: 0,
      log: [],
      handSeed: seed,
      red: [],
    };
  }

  on(fn: (e: GameEvent, s: GameState) => void) {
    this.listeners.push(fn);
  }

  private emit(e: GameEvent) {
    this.state.log.push(e);
    for (const fn of this.listeners) fn(e, this.state);
  }

  get players() {
    return this.state.players;
  }

  /**
   * The rules in force for this hand: the base profile, or the special round
   * its prevailing wind plays (windRounds.ts). Read it fresh, don't keep it:
   * it changes when the wind does.
   */
  get profile(): RuleProfile {
    const round = this.baseProfile.windRounds?.[this.state?.prevailingWind ?? 'E'];
    if (!round) return this.baseProfile;
    // India Rules North: the game East chose for this hand.
    const v = this.state?.roundVariant;
    const id = v === undefined ? round : `${round}:${v}`;
    let o = this.overlays.get(id);
    if (!o) this.overlays.set(id, (o = roundOverlay(this.baseProfile, id)));
    return o;
  }

  get liveRemaining() {
    const s = this.state;
    return s.wall.length - this.profile.deadWall - s.drawnFromFront - s.drawnFromBack;
  }

  get dealer() {
    return this.state.round.dealerSeat;
  }

  get prevailing() {
    return prevailingWind(this.profile.rounds, this.state.round);
  }

  /** Wall indices of dora indicators (top of a dead-wall stack) and the ura indicator beneath. */
  doraIndicatorIndex(i: number, ura = false) {
    return this.state.wall.length - 6 - 2 * i + (ura ? 1 : 0);
  }

  doraIndicators(): Tile[] {
    if (!this.profile.doraFromIndicator) return [];
    return Array.from({ length: this.state.doraRevealed }, (_, i) => this.state.wall[this.doraIndicatorIndex(i)]);
  }

  doraKinds(ura = false): number[] {
    const f = this.profile.doraFromIndicator;
    if (!f) return [];
    return Array.from({ length: this.state.doraRevealed }, (_, i) => f(this.state.wall[this.doraIndicatorIndex(i, ura)].kind));
  }

  // ------------------------------------------------------------ hand setup

  startHand(seed: number) {
    const s = this.state;
    // The wind decides the round's rules, so set it before reading the profile.
    s.prevailingWind = prevailingWind(this.baseProfile.rounds, s.round);
    delete s.roundVariant;
    const p = this.profile;
    const rng = new Rng(seed);
    s.handSeed = seed;
    const tiles: Tile[] = [];
    // Ids are fixed per kind (kind * 4 + copy, flowers from 136) so a reduced set
    // (three-player Korean, Sichuan) still agrees with kindOfTileId in tiles.ts.
    for (const kind of p.tileKinds) for (let c = 0; c < Math.min(4, p.copiesPerKind); c++) tiles.push({ id: kind * 4 + c, kind });
    if (p.flowers) for (let f = 0; f < FLOWER_COUNT; f++) tiles.push({ id: 136 + f, kind: FLOWER_BASE + f });
    if (p.jokers) for (let j = 0; j < p.jokers; j++) tiles.push({ id: 136 + FLOWER_COUNT + j, kind: JOKER_KIND });
    // Typed jokers and animals use fixed ids (tiles.ts), so every client and the renderer agree.
    const nextCopy = new Map<number, number>();
    for (const kind of p.extraTiles ?? []) {
      const n = nextCopy.get(kind) ?? 0;
      nextCopy.set(kind, n + 1);
      tiles.push({ id: extraTileIds(kind)[n], kind });
    }
    rng.shuffle(tiles);
    const dice = new Rng((seed ^ 0x5eed1ce) >>> 0);
    s.dice = [0, 1, 2].map(() => 1 + dice.int(6));
    // Where East's throw breaks the wall, with the wall owner's throw where the rules have two (engine/opening.ts).
    const second = [0, 1, 2].map(() => 1 + dice.int(6));
    s.wallBreak = wallBreak(openingRules(this.baseProfile.id, p.deadWall), [...s.dice, ...second], this.dealer, p.players, Math.ceil(tiles.length / 8), p.deadWall);
    s.afterFlower = false;
    s.wall = tiles;
    s.wallOrder = tiles.map((t) => t.id);
    s.drawnFromFront = 0;
    s.drawnFromBack = 0;
    s.turnCount = 0;
    s.callsMade = 0;
    s.doraRevealed = p.doraFromIndicator ? 1 : 0;
    s.log = [];
    s.red = redFiveIds(p.redFives ?? 0);
    delete s.exchange;
    delete s.outOfPlay;
    this.seatShapeCache = [];
    delete s.cards;
    delete s.cardOffers;
    delete s.wildKinds;
    delete s.wildIndicator;
    if (p.instantPayments) s.instant = [];
    else delete s.instant;
    s.seatWinds = s.players.map((_, seat) => seatWind(p.rounds, s.round, seat, p.players));
    s.prevailingWind = prevailingWind(p.rounds, s.round);
    for (const pl of s.players) {
      pl.hand = [];
      pl.melds = [];
      pl.discards = [];
      pl.claimedDiscards = [];
      pl.called = [];
      pl.discardKinds = [];
      pl.riichi = false;
      pl.doubleRiichi = false;
      pl.riichiDiscard = null;
      pl.riichiPaid = false;
      pl.ippatsu = false;
      pl.furitenTemp = false;
      pl.furitenLocked = false;
      pl.flowers = [];
      pl.tilesTaken = 0;
    }
    this.emit({ type: 'handStart', dealer: this.dealer, seed });
    // India Rules North: East chooses the game before the deal (chooseRound deals).
    if (p.roundChoices) {
      s.phase = { kind: 'roundChoice', seat: this.dealer };
      this.emit({ type: 'roundChoice', seat: this.dealer });
      return;
    }
    this.deal();
  }

  /** East's game for this North hand (India Rules): a code from profile.roundChoices. Then the deal. */
  chooseRound(seat: number, code: number) {
    const s = this.state;
    const ph = s.phase;
    if (ph.kind !== 'roundChoice' || ph.seat !== seat) throw new Error('Not your choice');
    if (!this.profile.roundChoices?.some((c) => c.code === code)) throw new Error('Not a game East can choose');
    s.roundVariant = code;
    this.seatShapeCache = [];
    this.emit({ type: 'roundChosen', seat, code });
    this.deal();
  }

  /** Deal the hand: the cards, the tiles, flowers replaced, then the first phase. */
  private deal() {
    const s = this.state;
    const p = this.profile;
    const seed = s.handSeed;
    if (p.dealCards) {
      const deck = p.dealDeck ? p.dealDeck.slice() : Array.from({ length: p.dealCards }, (_, i) => i);
      new Rng((seed ^ 0xca4d5) >>> 0).shuffle(deck);
      const offer = p.cardChoice ?? 1;
      if (offer > 1) s.cardOffers = Array.from({ length: p.players }, (_, i) => deck.slice(i * offer, (i + 1) * offer));
      else s.cards = deck.slice(0, p.players);
    }
    if (p.fixedWilds) s.wildKinds = p.fixedWilds.slice();
    // Deal in blocks of four then singles, starting with the dealer.
    for (let round = 0; round < 3; round++)
      for (let i = 0; i < p.players; i++) {
        const seat = (this.dealer + i) % p.players;
        for (let k = 0; k < 4; k++) s.players[seat].hand.push(this.takeFront()!);
      }
    for (let i = 0; i < p.players; i++) {
      const seat = (this.dealer + i) % p.players;
      for (let k = 0; k < p.handSize - 12; k++) s.players[seat].hand.push(this.takeFront()!);
    }
    if (p.naturalWild) this.turnUpWild(p.naturalWild.pick);
    // Flowers dealt are set aside and replaced from the back, dealer first.
    this.dealing = true;
    for (let i = 0; i < p.players && !p.card; i++) {
      const seat = (this.dealer + i) % p.players;
      const pl = s.players[seat];
      for (const f of pl.hand.filter((t) => this.isBonus(t.kind))) {
        pl.hand.splice(pl.hand.indexOf(f), 1);
        this.setAside(seat, f);
        const r = this.drawFor(seat, true);
        if (r) pl.hand.push(r);
      }
    }
    const first = this.drawFor(this.dealer, false)!;
    this.dealing = false;
    s.players[this.dealer].hand.push(first);
    // India Rules Small Cards: everyone keeps one of the cards offered, having seen their tiles.
    if (s.cardOffers) {
      s.phase = { kind: 'cardPick', picks: {} };
      this.emit({ type: 'cardPick' });
      return;
    }
    if (p.indiaExchange && !p.card) return this.beginIndiaExchange();
    // A goulash round: East first chooses how many exchanges are played.
    if (p.roundExchange && !p.card) {
      s.phase = { kind: 'exchangeChoice', seat: this.dealer };
      this.emit({ type: 'exchangeChoice', seat: this.dealer });
      return;
    }
    // American plays a Charleston every hand; an Asian goulash table exchanges
    // tiles only on the hand after a wall game.
    if (p.charleston || (s.goulash && p.goulashExchange && !p.card)) {
      s.phase = { kind: 'charleston', stage: 0, picks: {} };
      this.emit({ type: 'charleston', stage: 0 });
      return;
    }
    s.phase = { kind: 'turn', seat: this.dealer, drawn: first, afterKong: false, mustDiscardOnly: false };
    this.flowerWinCheck();
  }

  private takeFront(): Tile | null {
    if (this.liveRemaining <= 0) return null;
    return this.state.wall[this.state.drawnFromFront++];
  }

  /** Draw for a seat, setting aside any flowers and replacing them from the back. */
  private drawFor(seat: number, back: boolean): Tile | null {
    let t = back ? this.takeBack() : this.takeFront();
    let replaced = false;
    while (t && this.isBonus(t.kind)) {
      this.setAside(seat, t);
      t = this.takeBack();
      replaced = true;
    }
    this.state.afterFlower = replaced;
    return t;
  }

  /** A profile's bonus-tile instant win (eight flowers, seven robbing the eighth). Ends the hand if one applies. */
  private flowerWinCheck(): boolean {
    const f = this.profile.flowerWin;
    if (!f || this.state.phase.kind === 'handOver') return false;
    const r = f(this.players.map((p) => p.flowers.map((t) => t.kind)), this.state.seatWinds, this.dealer);
    if (!r) return false;
    const winner = this.players[r.winner];
    let tile = winner.flowers[winner.flowers.length - 1];
    if (r.payer !== null) {
      // The seven-flower hand takes the eighth from the player who drew it.
      const from = this.players[r.payer];
      tile = from.flowers.pop()!;
      winner.flowers.push(tile);
    }
    this.settleWin(r.winner, r.payer, tile, r.score, false);
    return true;
  }

  /** Bonus tiles never stay in a hand: flowers (except in card games), animals, flower jokers. */
  isBonus(kind: number): boolean {
    if (this.profile.card) return false;
    if (this.profile.flowersWild && isFlower(kind)) return false;
    // Big Cards: flowers are jokers or tiles on some cards, kept in the hand.
    if (this.profile.big && this.profile.big.flowers !== 'bonus' && isFlower(kind)) return false;
    return isFlower(kind) || !!this.profile.bonusKinds?.includes(kind);
  }

  /** A wild tile in this profile (Asian jokers, or this hand's natural wild). The American joker is not: it follows the card. */
  isWild(kind: number): boolean {
    return !!this.profile.wilds && (wildTargets(kind).length > 0 || !!this.state.wildKinds?.includes(kind));
  }

  /** These tiles split into naturals and jokers. With a wildCap only that many of each wild kind
   *  are jokers (the first held); the rest are natural tiles. */
  private splitWilds(tiles: Tile[]): { naturals: Tile[]; wilds: Tile[] } {
    const wk = this.state.wildKinds;
    if (!this.profile.wilds) return { naturals: tiles, wilds: [] };
    const cap = this.profile.wildCap;
    const seen = new Map<number, number>();
    const naturals: Tile[] = [];
    const wilds: Tile[] = [];
    for (const t of tiles) {
      if (!this.isWild(t.kind)) naturals.push(t);
      else if (cap !== undefined && wk?.includes(t.kind)) {
        const n = seen.get(t.kind) ?? 0;
        seen.set(t.kind, n + 1);
        (n < cap ? wilds : naturals).push(t);
      } else wilds.push(t);
    }
    return { naturals, wilds };
  }

  /** The joker kind a wild plays as in hand analysis: a natural wild stands for any tile. */
  wildAs(kind: number): number {
    return this.state.wildKinds?.includes(kind) ? JOKER_KIND : kind;
  }

  /** Counts of the natural (non-wild) tiles among these. */
  naturalCounts(tiles: Tile[]): number[] {
    if (this.profile.wildCap !== undefined) return toCounts(this.splitWilds(tiles).naturals.map((t) => t.kind));
    return toCounts(tiles.filter((t) => !this.state.wildKinds?.includes(t.kind)).map((t) => t.kind));
  }

  /** Choose this hand's natural wild: turn up a tile from the back of the wall (flowers are set aside and another turned up). */
  private turnUpWild(pick: 'next' | 'same' | number) {
    const s = this.state;
    let indicator: Tile | null = null;
    if (typeof pick === 'number') s.wildKinds = [pick];
    else {
      for (let tries = 0; tries < 12 && this.liveRemaining > 0; tries++) {
        const t = this.takeBack(false)!;
        (s.outOfPlay ??= []).push(t);
        if (t.kind < KIND_COUNT && !this.isBonus(t.kind)) {
          indicator = t;
          break;
        }
      }
      if (!indicator) return;
      s.wildIndicator = indicator;
      s.wildKinds = [pick === 'next' ? nextKind(indicator.kind) : indicator.kind];
    }
    this.emit({ type: 'wildTile', indicator, kinds: s.wildKinds! });
  }

  private setAside(seat: number, t: Tile) {
    const pl = this.players[seat];
    pl.flowers.push(t);
    this.emit({ type: 'flower', seat, tile: t });
    this.instant({ type: 'bonus', seat, kind: t.kind, held: pl.flowers.map((f) => f.kind), dealing: this.dealing });
  }

  /** Record payments a profile makes on the spot (bites, kong money). Settled with the hand. */
  private instant(e: InstantEvent) {
    const f = this.profile.instantPayments;
    if (!f) return;
    const pays = f(e, this.profile.players);
    if (pays.length) (this.state.instant ??= []).push(...pays);
  }

  private takeBack(revealDora = true): Tile | null {
    if (this.liveRemaining <= 0) return null;
    const s = this.state;
    // A Riichi dead wall holds four replacement tiles. Past those (sanma kita on
    // top of kongs) it is topped up from the live wall, so the replacement is
    // taken from the live wall (its front: the wall is shuffled, so it is the
    // same chance) and the live wall shrinks by one as at the table.
    const t = this.profile.nukiDora !== undefined && s.drawnFromBack >= 4 ? s.wall[s.drawnFromFront++] : s.wall[s.wall.length - 1 - s.drawnFromBack++];
    if (revealDora && this.profile.doraFromIndicator && s.doraRevealed < 5) {
      s.doraRevealed++;
      this.emit({ type: 'dora', indicator: s.wall[this.doraIndicatorIndex(s.doraRevealed - 1)] });
    }
    return t;
  }

  // ------------------------------------------------------------ queries

  /** Concealed counts of natural tiles (a hand's natural wilds are left out: see wildsIn). */
  concealedCounts(seat: number, extra?: number) {
    const hand = this.players[seat].hand;
    if (this.profile.wildCap !== undefined) return this.naturalCounts(extra === undefined ? hand : [...hand, { id: -1, kind: extra }]);
    const c = this.naturalCounts(hand);
    if (extra !== undefined && !this.state.wildKinds?.includes(extra)) c[extra]++;
    return c;
  }

  isConcealed(seat: number) {
    return this.players[seat].melds.every((m) => m.concealed);
  }

  private seatShapeCache: (ShapeRules | undefined)[] = [];

  /** What seat-specific rules know about a seat. */
  seatInfo(seat: number): SeatInfo {
    return { card: this.state.cards?.[seat], seatWind: this.state.seatWinds[seat], prevailing: this.prevailing, hand: this.players[seat].hand.map((t) => t.kind), melds: () => this.meldShapes(seat), bigMelds: () => this.bigMelds(seat), flowersHeld: () => this.players[seat].hand.filter((t) => isFlower(t.kind)).length };
  }

  /** India Rules Big Cards: a seat's laid-down groups as the card checker reads them. */
  bigMelds(seat: number): (MInfo & { extras?: number })[] {
    const bucket = (k: number) => (isFlower(k) ? FL : k);
    return this.players[seat].melds.map((m) => ({
      type: m.big ?? m.type,
      as: m.tiles.map((t) => m.wild?.find((w) => w.id === t.id)?.as ?? bucket(t.kind)).sort((a, b) => a - b),
      jokers: (m.wild ?? []).map((w) => ({ kind: bucket(m.tiles.find((t) => t.id === w.id)!.kind), as: w.as })),
      extras: m.extras,
    }));
  }

  /** What the Big Card checker needs about a seat: its wind, and the numbers of others' exposed kongs. */
  bigCtx(seat: number): BigCtx {
    const ban: number[] = [];
    this.players.forEach((p, s) => {
      if (s !== seat) for (const m of p.melds) if (m.type === 'kong' && !m.big) for (const t of m.tiles) if (t.kind < 27 && !m.wild?.some((w) => w.id === t.id)) ban.push((t.kind % 9) + 1);
    });
    return { seat: windKind(this.state.seatWinds[seat]), ban };
  }

  /** Big Cards: does this seat's hand (with `extra` added) make the card? */
  private bigWinsWith(seat: number, extra?: number): boolean {
    const kinds = this.players[seat].hand.map((t) => t.kind);
    if (extra !== undefined) kinds.push(extra);
    return bigWins(this.profile.big!, kinds, this.bigMelds(seat), this.bigCtx(seat));
  }

  /** The hand shapes this seat plays to (its secret card, at an India Rules Small Card table). */
  shapesFor(seat: number): ShapeRules {
    const p = this.profile;
    if (!p.seatShapes) return p.shapes;
    let r = this.seatShapeCache[seat];
    if (!r || (r as ShapeRules & { profile?: RuleProfile }).profile !== p) {
      r = Object.assign(p.seatShapes(seat, this.seatInfo(seat)) ?? p.shapes, { profile: p });
      this.seatShapeCache[seat] = r;
    }
    return r;
  }

  /** Ready (tenpai) with the current 13-tile-equivalent hand. */
  isTenpai(seat: number) {
    const pl = this.players[seat];
    if (this.profile.card) return this.profile.card.distance(pl.hand, pl.melds) === 1;
    if (this.profile.big) return bigDistance(this.profile.big, pl.hand.map((t) => t.kind), this.bigMelds(seat), this.bigCtx(seat)) === 1;
    if (this.profile.wilds) return wildShanten(this.concealedCounts(seat), this.wildsIn(pl.hand), pl.melds.length, this.shapesFor(seat)) === 0;
    return shanten(this.concealedCounts(seat), pl.melds.length, this.shapesFor(seat)) === 0;
  }

  /** Wild kinds among these tiles (empty unless the profile plays Asian jokers). */
  wildsIn(tiles: Tile[]): number[] {
    return this.profile.wilds ? this.splitWilds(tiles).wilds.map((t) => this.wildAs(t.kind)) : [];
  }

  /** Winning readings of concealed counts plus wilds, for this seat's declared melds. */
  winReadings(seat: number, counts: number[], wilds: number[]): WildReading[] {
    const w = this.profile.wilds ?? { inPair: false, inChow: false };
    return wildDecompositions(counts, wilds, this.players[seat].melds.length, this.shapesFor(seat), w, this.meldShapes(seat));
  }

  /** Declared melds as scoring sees them: each joker shown as the tile it stands for. */
  scoringMelds(seat: number): Meld[] {
    return this.players[seat].melds.map((m) => (m.wild?.length ? { ...m, tiles: m.tiles.map((t) => ({ id: t.id, kind: m.wild!.find((w) => w.id === t.id)?.as ?? t.kind })).sort((a, b) => a.kind - b.kind) } : m));
  }

  /** A seat's declared melds as hand analysis sees them (jokers as the tiles they stand for). */
  meldShapes(seat: number): MeldShape[] {
    const out = this.scoringMelds(seat).map((m): MeldShape => ({ type: m.type, kind: Math.min(...m.tiles.map((t) => t.kind)) }));
    const pending = this.pendingMelds[seat];
    if (pending) out.push(pending);
    return out;
  }

  /** A call the AI is weighing, seen by seat shapes that read declared melds (passports, Small Cards). */
  private pendingMelds: (MeldShape | undefined)[] = [];
  withPendingMeld<T>(seat: number, meld: MeldShape, fn: () => T): T {
    this.pendingMelds[seat] = meld;
    try {
      return fn();
    } finally {
      this.pendingMelds[seat] = undefined;
    }
  }

  /** Jokers sitting in a seat's declared melds. */
  meldWilds(seat: number): number {
    return this.players[seat].melds.reduce((a, m) => a + (m.wild?.length ?? 0), 0);
  }

  waitsOf(seat: number) {
    const pl = this.players[seat];
    const card = this.profile.card;
    if (card) {
      const out: number[] = [];
      for (let k = 0; k <= KIND_COUNT; k++) if (card.evaluate([...pl.hand, { id: -1, kind: k }], pl.melds, false)) out.push(k);
      return out;
    }
    if (this.profile.big) {
      const out: number[] = [];
      for (let k = 0; k <= FLOWER_BASE; k++) if ((k < KIND_COUNT || this.profile.big.flowers === 'tile') && this.bigWinsWith(seat, k)) out.push(k);
      return out;
    }
    if (this.profile.wilds) return wildWaits(this.concealedCounts(seat), this.wildsIn(pl.hand), pl.melds.length, this.shapesFor(seat), this.profile.wilds, this.meldShapes(seat));
    return waits(this.concealedCounts(seat), pl.melds.length, this.shapesFor(seat), this.meldShapes(seat));
  }

  /** Best scoring reading of a winning hand, or null if not a legal win. */
  evaluateWin(seat: number, winKind: number, selfDrawn: boolean, extraInHand: boolean, afterKong = false, win: WinContext = {}): WinEvaluation | null {
    const pl = this.players[seat];
    const card = this.profile.card;
    if (card) {
      const hand = extraInHand ? [...pl.hand, { id: -1, kind: winKind }] : pl.hand;
      const score = card.evaluate(hand, pl.melds, selfDrawn);
      return score ? { score, decomposition: { shape: 'standard', sets: [], pair: -1 } } : null;
    }
    if (this.profile.big) {
      if (!this.bigWinsWith(seat, extraInHand ? winKind : undefined)) return null;
      // Concealed: nothing claimed (laid-down groups came from the wall); the last tile may be a discard.
      const score = bigScore(this.profile.big, !pl.melds.some((m) => m.from !== undefined));
      return { score, decomposition: { shape: 'special', special: this.profile.big.name, sets: [], pair: -1 } };
    }
    const counts = this.concealedCounts(seat, extraInHand && winKind < KIND_COUNT ? winKind : undefined);
    const all = extraInHand ? [...pl.hand, { id: -1, kind: winKind }] : pl.hand;
    const wilds = this.wildsIn(all);
    const readings = this.winReadings(seat, counts, wilds);
    // A natural wild (laizi, baida, gold) may also stand as itself: those readings use no wild.
    // Flowers played as jokers never stand as themselves.
    const wk = this.state.wildKinds;
    if (wk?.length && wilds.length) {
      const own = this.splitWilds(all).wilds.filter((t) => wk.includes(t.kind) && t.kind < KIND_COUNT).map((t) => t.kind);
      for (let j = 1; j <= own.length; j++) {
        const c = counts.slice();
        for (const k of own.slice(0, j)) c[k]++;
        readings.push(...this.winReadings(seat, c, wilds.slice(j)));
      }
    }
    // Fujian: three golds in hand win on your own draw, whatever the rest of the hand.
    if (this.profile.threeWildsWin && selfDrawn && this.state.wildKinds && pl.hand.filter((t) => this.state.wildKinds!.includes(t.kind)).length >= 3)
      readings.push({ decomposition: { shape: 'special', special: 'Three Golds', sets: [], pair: -1 }, counts, assigned: [] });
    let best: WinEvaluation | null = null;
    const dora = this.doraKinds();
    const ura = pl.riichi ? this.doraKinds(true) : [];
    const redFives = this.redFivesIn(seat, extraInHand ? win.winTileId : undefined);
    const melds = this.scoringMelds(seat);
    const meldWilds = this.meldWilds(seat);
    for (const r of readings) {
      const d = r.decomposition;
      const score = this.profile.score({
        decomposition: d,
        melds,
        concealedCounts: r.counts,
        // A joker drawn to win counts as the tile it stands for.
        winKind: this.isWild(winKind) ? (r.assigned.find((a) => a[0] === this.wildAs(winKind))?.[1] ?? winKind) : winKind,
        selfDrawn,
        seatWind: this.state.seatWinds[seat],
        prevailingWind: this.prevailing,
        isDealer: seat === this.dealer,
        lastTileOfWall: this.liveRemaining === 0,
        afterKong,
        dealerRepeat: this.state.round.repeat,
        riichi: pl.riichi,
        doubleRiichi: pl.doubleRiichi,
        ippatsu: pl.ippatsu,
        doraKinds: dora,
        uraDoraKinds: ura,
        house: this.profile.houseChoices,
        flowers: pl.flowers.map((t) => t.kind),
        robbedKong: !!win.robbedKong,
        redFives,
        wildsUsed: r.assigned.length + meldWilds,
        wildsHeld: wilds.length,
        discarderIsDealer: win.discarder !== undefined && win.discarder === this.dealer,
        afterFlower: selfDrawn && !!this.state.afterFlower,
        tilesTaken: (pl.tilesTaken ?? 0) + (selfDrawn ? 0 : 1),
        heavenly: selfDrawn && seat === this.dealer && this.state.turnCount === 0 && this.state.callsMade === 0,
        earthly: !selfDrawn && win.discarder === this.dealer && this.state.turnCount === 1 && this.state.callsMade === 0,
        dice: this.state.dice,
        card: this.state.cards?.[seat],
      });
      if (score.qualifies === false || score.value < this.profile.minValue) continue;
      if (!best || score.points > best.score.points) best = { score, decomposition: d };
    }
    return best;
  }

  /** Red fives a seat holds: hand, melds, and an extra (claimed) tile id. */
  redFivesIn(seat: number, extraId?: number): number {
    const s = this.state;
    if (!s.red?.length) return 0;
    const pl = this.players[seat];
    let n = 0;
    for (const t of pl.hand) if (isRed(s, t.id)) n++;
    for (const m of pl.melds) for (const t of m.tiles) if (isRed(s, t.id)) n++;
    if (extraId !== undefined && isRed(s, extraId) && !pl.hand.some((t) => t.id === extraId)) n++;
    return n;
  }

  /**
   * Another kong may be declared. Dead-wall games (Riichi) stop at four kongs:
   * the four replacement tiles are all the dead wall holds before its dora indicators.
   */
  kongAllowed(): boolean {
    if (!this.profile.doraFromIndicator) return true;
    return this.players.reduce((a, p) => a + p.melds.filter((m) => m.type === 'kong').length, 0) < 4;
  }

  /** Furiten: waiting on a tile you discarded, or passed a win since. */
  isFuriten(seat: number): boolean {
    if (!this.profile.furiten) return false;
    const pl = this.players[seat];
    if (pl.furitenTemp || pl.furitenLocked) return true;
    const w = this.waitsOf(seat);
    return w.some((k) => pl.discardKinds.includes(k));
  }

  turnOptions(seat: number): TurnOptions {
    const ph = this.state.phase;
    const pl = this.players[seat];
    const none: TurnOptions = { canWin: false, kongs: [], discards: [], riichiDiscards: [], jokerSwaps: [] };
    if (ph.kind !== 'turn' || ph.seat !== seat) return none;
    const out: TurnOptions = { canWin: false, kongs: [], discards: pl.hand.slice(), riichiDiscards: [], jokerSwaps: [] };
    // Profiles may keep jokers out of the discards (unless nothing else is left).
    if (this.profile.wilds && !this.profile.wilds.discard) {
      const naturals = pl.hand.filter((t) => !this.isWild(t.kind));
      if (naturals.length) out.discards = naturals;
    }
    if (this.profile.card) {
      if (ph.drawn) {
        const score = this.profile.card.evaluate(pl.hand, pl.melds, true);
        if (score) {
          out.canWin = true;
          out.winScore = score;
        }
      }
      // Trade a natural tile for a joker sitting in anyone's exposure.
      this.players.forEach((owner, o) =>
        owner.melds.forEach((m, mi) => {
          if (!m.tiles.some((t) => isJoker(t.kind))) return;
          const base = m.tiles.find((t) => !isJoker(t.kind));
          const mine = base && pl.hand.find((t) => t.kind === base.kind || (isFlower(t.kind) && isFlower(base.kind)));
          if (mine) out.jokerSwaps.push({ owner: o, meld: mi, tileId: mine.id });
        }),
      );
      return out;
    }
    if (this.profile.big) {
      const big = this.profile.big;
      if (ph.drawn && this.evaluateWin(seat, ph.drawn.kind, true, false, ph.afterKong)) {
        out.canWin = true;
        out.winScore = this.evaluateWin(seat, ph.drawn.kind, true, false, ph.afterKong)!.score;
      }
      if (this.liveRemaining > 0) out.groups = bigGroups(big, pl.hand, this.bigMelds(seat), this.bigCtx(seat));
      // A tile from the wall or bought can take a joker's place in any laid-down group.
      const bucket = (k: number) => (isFlower(k) ? FL : k);
      this.players.forEach((owner, o) =>
        owner.melds.forEach((m, mi) => {
          for (const w of m.wild ?? []) {
            const mine = pl.hand.find((t) => bucket(t.kind) === w.as);
            if (mine && !out.jokerSwaps.some((x) => x.owner === o && x.meld === mi)) out.jokerSwaps.push({ owner: o, meld: mi, tileId: mine.id });
          }
        }),
      );
      return out;
    }
    if (ph.drawn) {
      const ev = this.evaluateWin(seat, ph.drawn.kind, true, false, ph.afterKong);
      if (ev) {
        out.canWin = true;
        out.winScore = ev.score;
      }
    }
    if (this.canDeclareNineTerminals(seat)) out.nineTerminals = true;
    if (this.canKita(seat)) out.kita = true;
    // After riichi the hand is locked: only the drawn tile may go.
    if (pl.riichi) {
      out.discards = ph.drawn ? [ph.drawn] : pl.hand.slice(-1);
      return out;
    }
    if (!ph.mustDiscardOnly && this.liveRemaining > 0 && this.kongAllowed()) {
      const c = this.concealedCounts(seat);
      if (this.profile.calls.concealedKong) c.forEach((n, k) => n === 4 && out.kongs.push(k));
      if (this.profile.calls.addedKong)
        for (const m of pl.melds) if (m.type === 'pung' && c[m.tiles[0].kind] > 0) out.kongs.push(m.tiles[0].kind);
    }
    const r = this.profile.riichi;
    if (r && this.isConcealed(seat) && pl.score >= r.cost && this.liveRemaining >= r.minLiveTiles && !ph.mustDiscardOnly) {
      const c = this.concealedCounts(seat);
      const seen = new Set<number>();
      for (const t of pl.hand) {
        if (seen.has(t.kind)) {
          if (out.riichiDiscards.some((id) => pl.hand.find((x) => x.id === id)?.kind === t.kind)) out.riichiDiscards.push(t.id);
          continue;
        }
        seen.add(t.kind);
        c[t.kind]--;
        if (shanten(c, pl.melds.length, this.shapesFor(seat)) === 0) out.riichiDiscards.push(t.id);
        c[t.kind]++;
      }
    }
    return out;
  }

  /** Kyuushu kyuuhai: first turn, nobody has called, nine or more different terminals and honours. */
  private canDeclareNineTerminals(seat: number): boolean {
    const ph = this.state.phase;
    if (!this.profile.abortiveDraws?.nineTerminals || ph.kind !== 'turn' || !ph.drawn || ph.afterKong) return false;
    const pl = this.players[seat];
    if (pl.discardKinds.length || this.state.callsMade) return false;
    return new Set(pl.hand.filter((t) => isTerminalOrHonor(t.kind)).map((t) => t.kind)).size >= 9;
  }

  /** Sanma kita: a North in hand and a replacement left to draw. */
  private canKita(seat: number): boolean {
    const k = this.profile.nukiDora;
    const ph = this.state.phase;
    if (k === undefined || ph.kind !== 'turn' || ph.mustDiscardOnly || this.liveRemaining <= 0) return false;
    const pl = this.players[seat];
    if (!pl.hand.some((t) => t.kind === k)) return false;
    // After riichi only the North just drawn may go: the locked hand stays as it was.
    return !pl.riichi || ph.drawn?.kind === k;
  }

  private claimOptionsFor(seat: number, discarder: number, tile: Tile): ClaimOption[] {
    const p = this.profile;
    const out: ClaimOption[] = [];
    const pl = this.players[seat];
    if (p.card) {
      // A discarded joker is dead. Exposures need matching naturals or jokers from hand.
      if (isJoker(tile.kind)) return out;
      if (this.evaluateWin(seat, tile.kind, false, true)) out.push({ type: 'win' });
      if (this.liveRemaining <= 0) return out;
      const same = (t: Tile) => t.kind === tile.kind || (isFlower(t.kind) && isFlower(tile.kind)) || isJoker(t.kind);
      const have = pl.hand.filter(same).length;
      if (p.calls.exposedKong && have >= 3) out.push({ type: 'kong' });
      if (p.calls.pung && have >= 2) out.push({ type: 'pung' });
      return out;
    }
    if (p.big) {
      if (this.evaluateWin(seat, tile.kind, false, true, false, { winTileId: tile.id, discarder })) out.push({ type: 'win' });
      if (this.liveRemaining <= 0) return out;
      // Calls take natural tiles only: a pung needs a natural pair in hand.
      const calls = bigCallKinds(p.big, this.bigCtx(seat));
      const nat = pl.hand.filter((t) => t.kind === tile.kind).length;
      if (calls.pung.has(tile.kind)) {
        if (nat >= 3) out.push({ type: 'kong' });
        if (nat >= 2) out.push({ type: 'pung' });
      }
      const k = tile.kind;
      if ((discarder + 1) % p.players === seat && k < 27) {
        const has = (x: number) => Math.floor(x / 9) === Math.floor(k / 9) && x >= 0 && pl.hand.some((t) => t.kind === x);
        for (const start of [k - 2, k - 1, k]) if (calls.chow.has(start) && [start, start + 1, start + 2].every((x) => x === k || has(x))) out.push({ type: 'chow', using: [start, start + 1, start + 2].filter((x) => x !== k) });
      }
      if (p.buyFromLeft && (discarder + 1) % p.players === seat && pl.score >= p.buyFromLeft) out.push({ type: 'buy' });
      return out;
    }
    // A discarded joker is dead: nobody may claim it. A capped wild (North Goulash's number) is a
    // natural tile once discarded: a pair of it in hand may pung it.
    const capped = p.wildCap !== undefined && tile.kind < KIND_COUNT;
    if (this.isWild(tile.kind) && !capped) return out;
    const c = this.concealedCounts(seat);
    if (capped && this.isWild(tile.kind)) c[tile.kind] = pl.hand.filter((t) => t.kind === tile.kind).length;
    if (this.evaluateWin(seat, tile.kind, false, true, false, { winTileId: tile.id, discarder }) && !this.isFuriten(seat)) out.push({ type: 'win' });
    // Calls are not allowed after riichi.
    if (this.liveRemaining > 0 && !pl.riichi) {
      if (p.calls.exposedKong && c[tile.kind] >= 3 && this.kongAllowed()) out.push({ type: 'kong' });
      if (p.calls.pung && c[tile.kind] >= 2) out.push({ type: 'pung' });
      else if (p.calls.pung && c[tile.kind] === 1 && p.wilds?.inCalls) {
        // One natural and a joker make the pung; the narrowest joker goes first.
        const joker = pl.hand
          .map((t) => t.kind)
          .filter((k) => this.isWild(k) && wildCovers(this.wildAs(k), tile.kind))
          .sort((a, b) => wildTargets(this.wildAs(a)).length - wildTargets(this.wildAs(b)).length)[0];
        if (joker !== undefined) out.push({ type: 'pung', using: [tile.kind, joker] });
      }
      const isNext = (discarder + 1) % p.players === seat;
      if (p.calls.chow && (isNext || !p.calls.chowFromLeftOnly) && tile.kind < 27) {
        const r = tile.kind % 9;
        const k = tile.kind;
        if (r >= 2 && c[k - 2] && c[k - 1]) out.push({ type: 'chow', using: [k - 2, k - 1] });
        if (r >= 1 && r <= 7 && c[k - 1] && c[k + 1]) out.push({ type: 'chow', using: [k - 1, k + 1] });
        if (r <= 6 && c[k + 1] && c[k + 2]) out.push({ type: 'chow', using: [k + 1, k + 2] });
      }
    }
    const info = p.claimAllowed ? this.seatInfo(seat) : undefined;
    const allowed = info ? out.filter((o) => p.claimAllowed!(seat, o.type as 'pung' | 'kong' | 'chow' | 'win', tile.kind, info)) : out;
    // Buying the left player's discard: allowed even when the card takes no discard.
    if (p.buyFromLeft && (discarder + 1) % p.players === seat && this.liveRemaining > 0 && !pl.riichi && pl.score >= p.buyFromLeft) allowed.push({ type: 'buy' });
    return allowed;
  }

  // ------------------------------------------------------------ actions

  discard(seat: number, tileId: number, opts: { riichi?: boolean } = {}) {
    const ph = this.state.phase;
    if (ph.kind !== 'turn' || ph.seat !== seat) throw new Error('Not your turn');
    const pl = this.players[seat];
    const turn = this.turnOptions(seat);
    if (!turn.discards.some((t) => t.id === tileId)) throw new Error('That tile cannot be discarded now');
    if (opts.riichi && !turn.riichiDiscards.includes(tileId)) throw new Error('Riichi not allowed with that discard');
    const idx = pl.hand.findIndex((t) => t.id === tileId);
    const [tile] = pl.hand.splice(idx, 1);
    pl.discards.push(tile);
    pl.discardKinds.push(tile.kind);
    if (!pl.riichi) pl.furitenTemp = false;
    pl.ippatsu = false;
    if (opts.riichi) {
      pl.riichi = true;
      pl.doubleRiichi = pl.discards.length === 1 && this.state.callsMade === 0;
      pl.riichiDiscard = pl.discards.length - 1;
      pl.ippatsu = true;
    }
    this.state.turnCount++;
    this.emit({ type: 'discard', seat, tile, riichi: opts.riichi });
    // Everyone followed the dealer's first discard with the same tile.
    if (this.state.turnCount === this.profile.players && this.state.callsMade === 0 && this.players.every((p) => p.discards.length === 1 && p.discards[0].kind === tile.kind))
    {
      const pays = this.profile.chasePayments?.(this.dealer, tile.kind, this.profile.players) ?? [];
      if (pays.length) (this.state.instant ??= []).push(...pays);
    }

    // Four winds (suufon renda): the hand is abandoned unless someone wins on this tile.
    const fourWinds =
      !!this.profile.abortiveDraws?.fourWinds &&
      this.profile.players === 4 &&
      this.state.turnCount === 4 &&
      this.state.callsMade === 0 &&
      isWind(tile.kind) &&
      this.players.every((p) => p.discardKinds.length === 1 && p.discardKinds[0] === tile.kind);

    const options: Record<number, ClaimOption[]> = {};
    let any = false;
    for (let s = 0; s < this.profile.players; s++) {
      if (s === seat) continue;
      let o = this.claimOptionsFor(s, seat, tile);
      if (fourWinds) o = o.filter((x) => x.type === 'win');
      if (o.length) {
        options[s] = o;
        any = true;
      }
    }
    if (!any && fourWinds) {
      this.settleRiichi(seat);
      return this.abortiveDraw('fourWinds');
    }
    if (!any) return this.nextDraw(seat);
    this.state.phase = { kind: 'claims', discarder: seat, tile, options, responses: {} };
    if (fourWinds) this.state.phase.abortAfter = 'fourWinds';
  }

  /** Who still owes a response in the claim window. */
  pendingClaimSeats(): number[] {
    const ph = this.state.phase;
    if (ph.kind !== 'claims') return [];
    return Object.keys(ph.options)
      .map(Number)
      .filter((s) => ph.responses[s] === undefined);
  }

  respond(seat: number, response: ClaimResponse) {
    const ph = this.state.phase;
    if (ph.kind !== 'claims' || !ph.options[seat]) throw new Error('No claim pending');
    if (response.type !== 'pass') {
      const ok = ph.options[seat].some(
        (o) => o.type === response.type && (o.type !== 'chow' || o.using!.join() === (response as ClaimOption).using?.join()),
      );
      if (!ok) throw new Error('Illegal claim');
    }
    ph.responses[seat] = response;
    if (this.pendingClaimSeats().length === 0) this.resolveClaims();
  }

  /** The discarder's riichi stands once their declaration tile isn't won on: pay the deposit. */
  private settleRiichi(discarder: number) {
    const pl = this.players[discarder];
    const r = this.profile.riichi;
    if (r && pl.riichi && !pl.riichiPaid) {
      pl.score -= r.cost;
      this.state.riichiPot += r.cost;
      pl.riichiPaid = true;
    }
  }

  private resolveClaims() {
    const ph = this.state.phase;
    if (ph.kind !== 'claims') return;
    const n = this.profile.players;
    const order = Array.from({ length: n - 1 }, (_, i) => (ph.discarder + 1 + i) % n);
    const pick = (types: string[]) => order.find((s) => types.includes(ph.responses[s]?.type ?? 'pass'));

    // Anyone who passed on a win is furiten until their next discard (or for good after riichi).
    for (const s of order) {
      if (ph.options[s]?.some((o) => o.type === 'win') && ph.responses[s]?.type === 'pass') {
        const pl = this.players[s];
        if (pl.riichi) pl.furitenLocked = true;
        else pl.furitenTemp = true;
      }
    }

    // Three players win on one tile: abandoned (sanchahou), unless the table plays head bump.
    if (this.profile.abortiveDraws?.tripleRon && order.filter((s) => ph.responses[s]?.type === 'win').length >= 3) {
      const d = this.players[ph.discarder];
      // A riichi declared on that tile never stood.
      if (d.riichi && !d.riichiPaid) {
        d.riichi = false;
        d.riichiDiscard = null;
      }
      return this.abortiveDraw('tripleRon');
    }
    const winner = pick(['win']);
    if (winner !== undefined) return this.finishWin(winner, ph.discarder, ph.tile, false, !!ph.robKong && !ph.kita, !!ph.kita);
    // Nobody robbed the kong (or the North): it stands and its owner draws a replacement.
    if (ph.robKong) return ph.kita ? this.completeKita(ph.discarder, ph.tile) : ph.concealedKong ? this.completeConcealedKong(ph.discarder, ph.tile) : this.completeAddedKong(ph.discarder, ph.tile);
    this.settleRiichi(ph.discarder);
    if (ph.abortAfter) return this.abortiveDraw(ph.abortAfter);
    if (this.abortAfterDiscard()) return;

    const big = pick(['kong', 'pung']);
    const chow = pick(['chow']);
    const seat = big ?? chow ?? pick(['buy']);
    if (seat === undefined) return this.nextDraw(ph.discarder, true);
    if (ph.responses[seat]!.type === 'buy') return this.buyDiscard(seat, ph.discarder, ph.tile);

    const answer = ph.responses[seat] as ClaimOption;
    // The engine's own option carries the details (a pung made with a joker).
    const resp = ph.options[seat].find((o) => o.type === answer.type && (o.type !== 'chow' || o.using!.join() === answer.using?.join())) ?? answer;
    const pl = this.players[seat];
    const discarder = this.players[ph.discarder];
    discarder.discards.pop();
    discarder.claimedDiscards.push(ph.tile.id);
    discarder.called.push({ id: ph.tile.id, kind: ph.tile.kind, at: discarder.discards.length, by: seat });
    if (discarder.riichiDiscard !== null && discarder.riichiDiscard >= discarder.discards.length) discarder.riichiDiscard = discarder.discards.length; // next discard shows sideways
    this.state.callsMade++;
    for (const p of this.players) p.ippatsu = false;

    const takeKinds = resp.type === 'chow' || resp.using ? resp.using! : new Array(resp.type === 'kong' ? 3 : 2).fill(ph.tile.kind);
    const taken: Tile[] = [];
    for (const k of takeKinds) {
      let i = pl.hand.findIndex((t) => t.kind === k);
      // Card games: any flower matches a flower; jokers fill in after naturals.
      if (i < 0 && this.profile.card) i = pl.hand.findIndex((t) => isFlower(t.kind) && isFlower(k));
      if (i < 0 && this.profile.card) i = pl.hand.findIndex((t) => isJoker(t.kind));
      taken.push(pl.hand.splice(i, 1)[0]);
    }
    const tiles = [...taken, ph.tile].sort((a, b) => a.kind - b.kind);
    const meld: Meld = { type: resp.type === 'chow' ? 'chow' : resp.type === 'kong' ? 'kong' : 'pung', tiles, concealed: false, from: ph.discarder, claimedId: ph.tile.id };
    const wild = taken.filter((t) => this.isWild(t.kind) && t.kind !== ph.tile.kind);
    if (wild.length) meld.wild = wild.map((t) => ({ id: t.id, as: ph.tile.kind }));
    pl.melds.push(meld);
    pl.tilesTaken = (pl.tilesTaken ?? 0) + 1;
    this.emit({ type: 'call', seat, meld, claim: resp.type });

    // Card games (American) count every exposed tile toward the 14: a called kong
    // takes no replacement, the caller simply discards.
    // Big Cards: a called kong draws the card's extra tiles for a kong (none on some cards).
    const kongDraws = this.profile.big ? this.profile.big.extras.kong : 1;
    if (this.profile.big && meld.type === 'kong') meld.extras = kongDraws;
    if (meld.type === 'kong' && !this.profile.card && kongDraws > 0) {
      this.instant({ type: 'kong', seat, concealed: false });
      const rep = this.drawFor(seat, true);
      if (!rep) return this.exhausted();
      pl.hand.push(rep);
      this.emit({ type: 'draw', seat, tile: rep, replacement: true });
      this.state.phase = { kind: 'turn', seat, drawn: rep, afterKong: true, mustDiscardOnly: false };
      this.flowerWinCheck();
    } else {
      this.state.phase = { kind: 'turn', seat, drawn: null, afterKong: false, mustDiscardOnly: true };
    }
  }

  /** India Rules: `seat` buys the discard instead of drawing. It pays into the bank and keeps the tile concealed. */
  private buyDiscard(seat: number, from: number, tile: Tile) {
    const price = this.profile.buyFromLeft ?? 0;
    const pl = this.players[seat];
    const discarder = this.players[from];
    discarder.discards.pop();
    discarder.claimedDiscards.push(tile.id);
    discarder.called.push({ id: tile.id, kind: tile.kind, at: discarder.discards.length, by: seat });
    pl.score -= price;
    this.state.riichiPot += price;
    pl.hand.push(tile);
    this.emit({ type: 'buy', seat, from, tile, price });
    // Like a call, the bought tile can't make Mahjong or a kong this turn: the player discards.
    this.state.phase = { kind: 'turn', seat, drawn: null, afterKong: false, mustDiscardOnly: true };
  }

  // ------------------------------------------------------------ American

  /** Choose three tiles to pass in the current Charleston stage. Jokers can't be passed. */
  charlestonPass(seat: number, tileIds: number[]) {
    const ph = this.state.phase;
    if (ph.kind !== 'charleston') throw new Error('No Charleston now');
    const pl = this.players[seat];
    const tiles = tileIds.map((id) => pl.hand.find((t) => t.id === id));
    // Jokers never pass, except in a goulash (the hand after a wall game) when the table plays one.
    const jokersOk = !!this.state.goulash;
    if (tiles.length !== 3 || tiles.some((t) => !t || (isJoker(t.kind) && !jokersOk)) || new Set(tileIds).size !== 3) throw new Error('Pass three tiles, no jokers');
    ph.picks[seat] = tileIds;
    if (Object.keys(ph.picks).length < this.profile.players) return;
    const offset = CHARLESTON[ph.stage];
    const moving = this.players.map((p, s) => ph.picks[s].map((id) => p.hand.find((t) => t.id === id)!));
    this.players.forEach((p, s) => (p.hand = p.hand.filter((t) => !ph.picks[s].includes(t.id))));
    moving.forEach((tiles, s) => this.players[this.passTarget(s, ph.stage)].hand.push(...tiles));
    this.emit({ type: 'charlestonPassed', stage: ph.stage, offset });
    const next = ph.stage + 1;
    const ex = this.state.exchange;
    // India Rules: after the three swaps, East calls the optional exchanges.
    if (ex?.india) {
      if (next < 3) {
        this.state.phase = { kind: 'charleston', stage: next, picks: {} };
        this.emit({ type: 'charleston', stage: next });
      } else {
        this.askExchange('ttt');
      }
      return;
    }
    // Goulash round: one exchange (across) or three (right, across, left), then the wall.
    if (ex) {
      if (ex.passes === 1 || next === 3) this.beginWallExchange();
      else {
        this.state.phase = { kind: 'charleston', stage: next, picks: {} };
        this.emit({ type: 'charleston', stage: next });
      }
      return;
    }
    // An Asian goulash exchange is one pass each way, with no second Charleston.
    if (next === 3 && !this.profile.charleston) this.beginPlay();
    else if (next === 3) this.state.phase = { kind: 'charlestonVote', votes: {} };
    else if (next < CHARLESTON.length) {
      this.state.phase = { kind: 'charleston', stage: next, picks: {} };
      this.emit({ type: 'charleston', stage: next });
    } else this.beginPlay();
  }

  /** After the first Charleston, everyone must agree to a second one. */
  charlestonVote(seat: number, again: boolean) {
    const ph = this.state.phase;
    if (ph.kind !== 'charlestonVote') throw new Error('No vote now');
    ph.votes[seat] = again;
    if (Object.keys(ph.votes).length < this.profile.players) return;
    if (Object.values(ph.votes).every(Boolean)) {
      this.state.phase = { kind: 'charleston', stage: 3, picks: {} };
      this.emit({ type: 'charleston', stage: 3 });
    } else this.beginPlay();
  }

  // ------------------------------------------------------------ goulash round

  /** Where a seat's tiles go in this exchange stage. India Rules swaps in pairs:
   *  East-South and West-North, then East-North and South-West, then East-West and South-North. */
  passTarget(seat: number, stage: number): number {
    const n = this.profile.players;
    if (!this.state.exchange?.india || n !== 4) return (seat + CHARLESTON[stage]) % n;
    const r = (seat - this.dealer + n) % n;
    return (this.dealer + (r ^ [1, 3, 2][stage % 3])) % n;
  }

  /** Where a seat's tiles come from in this exchange stage. */
  passSource(seat: number, stage: number): number {
    const n = this.profile.players;
    if (this.state.exchange?.india && n === 4) return this.passTarget(seat, stage);
    return (seat + n - CHARLESTON[stage]) % n;
  }

  /** India Rules: three compulsory blind swaps, then East's Tic-Tac-Toe and wall exchanges. */
  private beginIndiaExchange() {
    const s = this.state;
    s.exchange = { passes: 0, wall: 0, india: true };
    s.phase = { kind: 'charleston', stage: 0, picks: {} };
    this.emit({ type: 'charleston', stage: 0 });
  }

  /** Keep one of the cards offered (India Rules Small Cards). */
  pickCard(seat: number, card: number) {
    const s = this.state;
    const ph = s.phase;
    if (ph.kind !== 'cardPick') throw new Error('No card to choose now');
    if (!s.cardOffers?.[seat]?.includes(card)) throw new Error('Not one of your cards');
    ph.picks[seat] = card;
    if (Object.keys(ph.picks).length < this.profile.players) return;
    s.cards = s.cardOffers.map((_, i) => ph.picks[i]);
    this.seatShapeCache = [];
    this.emit({ type: 'cardsPicked' });
    if (this.profile.indiaExchange) this.beginIndiaExchange();
    else this.beginPlay();
  }

  private askExchange(step: IndiaExchangeStep) {
    this.state.phase = { kind: 'exchangeChoice', seat: this.dealer, step };
    this.emit({ type: 'exchangeChoice', seat: this.dealer, step });
  }

  /** East chooses 1 or 3 exchanges between players and 1 or 3 with the wall. India Rules asks
   *  one step at a time: `passes` answers the Tic-Tac-Toe steps (0 or 1, then 1 or 3) and `wall`
   *  the wall steps (0 or 1, then 1 or 3); a 3 at a first step calls all three at once. */
  chooseExchanges(seat: number, passes: 0 | 1 | 3, wall: 0 | 1 | 3) {
    const ph = this.state.phase;
    if (ph.kind !== 'exchangeChoice' || ph.seat !== seat) throw new Error('Not your choice');
    const ex = this.state.exchange;
    if (ex?.india) {
      const step = ph.step ?? 'ttt';
      const n = step === 'ttt' || step === 'tttMore' ? passes : wall;
      const allowed = step === 'ttt' || step === 'wall' ? [0, 1, 3] : [1, 3];
      if (!allowed.includes(n)) throw new Error(allowed.length === 3 ? 'Choose 0 or 1' : 'Choose 1 or 3');
      if (step === 'ttt' || step === 'tttMore') ex.passes = n;
      else ex.wall = n;
      this.emit({ type: 'exchangeChosen', seat, passes: ex.passes, wall: ex.wall });
      if (step === 'ttt') n ? this.beginTicTacToe(0) : this.askExchange('wall');
      else if (step === 'tttMore') n === 3 ? this.beginTicTacToe(1) : this.askExchange('wall');
      else if (step === 'wall') n ? this.beginWallExchange(0) : this.beginPlay();
      else n === 3 ? this.beginWallExchange(1) : this.beginPlay();
      return;
    }
    if (![1, 3].includes(passes) || ![1, 3].includes(wall)) throw new Error('Choose 1 or 3');
    this.state.exchange = { passes, wall };
    this.emit({ type: 'exchangeChosen', seat, passes, wall });
    const stage = passes === 1 ? 1 : 0;
    this.state.phase = { kind: 'charleston', stage, picks: {} };
    this.emit({ type: 'charleston', stage });
  }

  private beginTicTacToe(round: number) {
    this.state.phase = { kind: 'ticTacToe', round, picks: {} };
    this.emit({ type: 'ticTacToe', round });
  }

  /** Tic-Tac-Toe: three tiles, given to the right, across and left in that order. */
  ticTacToe(seat: number, tileIds: number[]) {
    const ph = this.state.phase;
    if (ph.kind !== 'ticTacToe') throw new Error('No Tic-Tac-Toe now');
    const pl = this.players[seat];
    const n = this.profile.players;
    if (tileIds.length !== n - 1 || new Set(tileIds).size !== n - 1 || tileIds.some((id) => !pl.hand.some((t) => t.id === id))) throw new Error('Choose one tile for each player');
    ph.picks[seat] = tileIds;
    if (Object.keys(ph.picks).length < n) return;
    const moving = this.players.map((p, s) => ph.picks[s].map((id) => p.hand.find((t) => t.id === id)!));
    this.players.forEach((p, s) => (p.hand = p.hand.filter((t) => !ph.picks[s].includes(t.id))));
    moving.forEach((tiles, s) => tiles.forEach((t, i) => this.players[(s + 1 + i) % n].hand.push(t)));
    this.emit({ type: 'ticTacToeDone', round: ph.round });
    const ex = this.state.exchange!;
    // After the first, East says whether to keep it at one or make it three.
    if (ph.round === 0 && ex.passes === 1) this.askExchange('tttMore');
    else if (ph.round + 1 < ex.passes) this.beginTicTacToe(ph.round + 1);
    else this.askExchange('wall');
  }

  private beginWallExchange(round = 0) {
    this.state.phase = { kind: 'wallExchange', round, picks: {} };
    this.emit({ type: 'wallExchange', round });
  }

  /** Three tiles to swap with the wall in this wall exchange. */
  wallExchange(seat: number, tileIds: number[]) {
    const ph = this.state.phase;
    if (ph.kind !== 'wallExchange') throw new Error('No wall exchange now');
    const pl = this.players[seat];
    if (tileIds.length !== 3 || new Set(tileIds).size !== 3 || tileIds.some((id) => !pl.hand.some((t) => t.id === id))) throw new Error('Choose three tiles');
    ph.picks[seat] = tileIds;
    if (Object.keys(ph.picks).length < this.profile.players) return;
    // Dealer first, each player puts three tiles out of play and draws three from the wall.
    // India Rules: each takes any three tiles from the wall, and the tiles put down are
    // mixed back into the wall (here: each goes where a taken tile was).
    const india = !!this.state.exchange?.india;
    const rng = new Rng((this.state.handSeed ^ (0x3a11 + ph.round * 7919)) >>> 0);
    for (let i = 0; i < this.profile.players; i++) {
      const s = (this.dealer + i) % this.profile.players;
      const p = this.players[s];
      const out = p.hand.filter((t) => ph.picks[s].includes(t.id));
      p.hand = p.hand.filter((t) => !ph.picks[s].includes(t.id));
      if (india) {
        for (const put of out) {
          const t = this.swapFromWall(s, put, rng);
          if (t) p.hand.push(t);
        }
        continue;
      }
      (this.state.outOfPlay ??= []).push(...out);
      for (let k = 0; k < 3; k++) {
        const t = this.drawFor(s, false);
        if (t) p.hand.push(t);
      }
    }
    this.emit({ type: 'wallExchanged', round: ph.round });
    if (india && ph.round === 0 && this.state.exchange!.wall === 1) this.askExchange('wallMore');
    else if (ph.round + 1 < (this.state.exchange?.wall ?? 1)) this.beginWallExchange(ph.round + 1);
    else this.beginPlay();
  }

  /** Take a tile from anywhere in the live wall and put `put` in its place. A flower taken is
   *  set aside and replaced from the back, as any drawn flower. */
  private swapFromWall(seat: number, put: Tile, rng: Rng): Tile | null {
    const s = this.state;
    const lo = s.drawnFromFront;
    const hi = s.wall.length - this.profile.deadWall - s.drawnFromBack;
    if (hi <= lo) return put;
    const i = lo + rng.int(hi - lo);
    const t = s.wall[i];
    s.wall[i] = put;
    if (!this.isBonus(t.kind)) return t;
    this.setAside(seat, t);
    return this.drawFor(seat, true);
  }

  private beginPlay() {
    const hand = this.players[this.dealer].hand;
    this.emit({ type: 'charlestonDone' });
    this.state.phase = { kind: 'turn', seat: this.dealer, drawn: hand[hand.length - 1], afterKong: false, mustDiscardOnly: false };
  }

  /** Trade a natural tile from your hand for a joker in an exposure. */
  exchangeJoker(seat: number, swap: JokerSwap) {
    const ok = this.turnOptions(seat).jokerSwaps.some((x) => x.owner === swap.owner && x.meld === swap.meld && x.tileId === swap.tileId);
    if (!ok) throw new Error('No joker to exchange');
    const pl = this.players[seat];
    const meld = this.players[swap.owner].melds[swap.meld];
    const hi = pl.hand.findIndex((t) => t.id === swap.tileId);
    if (this.profile.big) {
      // The natural tile takes the place of the joker standing for it, and the joker comes to your hand.
      const want = isFlower(pl.hand[hi].kind) ? FL : pl.hand[hi].kind;
      const w = meld.wild!.find((x) => x.as === want)!;
      const at = meld.tiles.findIndex((t) => t.id === w.id);
      const joker = meld.tiles[at];
      meld.tiles[at] = pl.hand[hi];
      pl.hand[hi] = joker;
      meld.wild = meld.wild!.filter((x) => x !== w);
      if (!meld.wild.length) delete meld.wild;
      const ph = this.state.phase;
      if (ph.kind === 'turn' && ph.drawn?.id === swap.tileId) ph.drawn = joker;
      this.emit({ type: 'jokerSwap', seat, owner: swap.owner });
      return;
    }
    const ji = meld.tiles.findIndex((t) => isJoker(t.kind));
    const joker = meld.tiles[ji];
    meld.tiles[ji] = pl.hand[hi];
    pl.hand[hi] = joker;
    const ph = this.state.phase;
    if (ph.kind === 'turn' && ph.drawn?.id === swap.tileId) ph.drawn = joker;
    this.emit({ type: 'jokerSwap', seat, owner: swap.owner });
  }

  /** Big Cards: lay down a kong, qwong or run from the hand (or grow your pung or kong into one)
   *  and draw its extra tiles from the back of the wall. */
  declareGroup(seat: number, ids: number[], extend?: number) {
    const key = (x: number[]) => x.slice().sort((a, b) => a - b).join(',');
    const g = this.turnOptions(seat).groups?.find((x) => key(x.ids) === key(ids) && x.extend === extend);
    if (!g) throw new Error('That group cannot be laid down now');
    const pl = this.players[seat];
    const tiles = ids.map((id) => pl.hand.find((t) => t.id === id)!);
    pl.hand = pl.hand.filter((t) => !ids.includes(t.id));
    let meld: Meld;
    if (extend !== undefined) {
      meld = pl.melds[extend];
      meld.tiles.push(...tiles);
      meld.tiles.sort((a, b) => a.kind - b.kind);
      meld.type = 'kong';
      if (g.type !== 'kong') meld.big = g.type;
    } else {
      meld = { type: 'kong', tiles: tiles.sort((a, b) => a.kind - b.kind), concealed: false };
      if (g.type !== 'kong') meld.big = g.type;
      pl.melds.push(meld);
    }
    if (g.wild.length) meld.wild = [...(meld.wild ?? []), ...g.wild];
    meld.extras = (meld.extras ?? 0) + g.extras;
    this.emit({ type: 'call', seat, meld, claim: 'kong' });
    const ph = this.state.phase;
    let drawn: Tile | null = ph.kind === 'turn' ? ph.drawn : null;
    // The drawn tile may have gone into the group.
    if (drawn && ids.includes(drawn.id)) drawn = null;
    for (let i = 0; i < g.extras; i++) {
      const rep = this.drawFor(seat, true);
      if (!rep) return this.exhausted();
      pl.hand.push(rep);
      this.emit({ type: 'draw', seat, tile: rep, replacement: true });
      drawn = rep;
    }
    const must = ph.kind === 'turn' && ph.mustDiscardOnly && !g.extras;
    this.state.phase = { kind: 'turn', seat, drawn, afterKong: g.extras > 0, mustDiscardOnly: must };
    if (g.extras) this.flowerWinCheck();
  }

  declareKong(seat: number, kind: number) {
    const opts = this.turnOptions(seat);
    if (!opts.kongs.includes(kind)) throw new Error('Illegal kong');
    const pl = this.players[seat];
    const added = pl.melds.find((m) => m.type === 'pung' && m.tiles[0].kind === kind);
    if (added) {
      const i = pl.hand.findIndex((t) => t.kind === kind);
      const [tile] = pl.hand.splice(i, 1);
      // Robbing the kong: before the kong stands, others may win on the added tile.
      if (this.profile.robKong) {
        const options: Record<number, ClaimOption[]> = {};
        let any = false;
        for (let s = 0; s < this.profile.players; s++) {
          if (s === seat) continue;
          if (this.evaluateWin(s, tile.kind, false, true, false, { robbedKong: true, winTileId: tile.id, discarder: seat }) && !this.isFuriten(s)) {
            options[s] = [{ type: 'win' }];
            any = true;
          }
        }
        if (any) {
          // The tile sits on the table (phase.tile), in neither hand nor meld, until the window closes.
          this.emit({ type: 'robKongChance', seat, tile });
          this.state.phase = { kind: 'claims', discarder: seat, tile, options, responses: {}, robKong: true };
          return;
        }
      }
      return this.completeAddedKong(seat, tile);
    }
    // Riichi: thirteen orphans may rob a concealed kong of the tile it waits on.
    if (this.profile.robKong && this.profile.kokushiRobsConcealedKong) {
      const tile = pl.hand.filter((t) => t.kind === kind).pop()!;
      const options: Record<number, ClaimOption[]> = {};
      let any = false;
      for (let s = 0; s < this.profile.players; s++) {
        if (s === seat) continue;
        const ev = this.evaluateWin(s, kind, false, true, false, { robbedKong: true, winTileId: tile.id, discarder: seat });
        if (ev?.decomposition.shape === 'thirteenOrphans' && !this.isFuriten(s)) {
          options[s] = [{ type: 'win' }];
          any = true;
        }
      }
      if (any) {
        pl.hand.splice(pl.hand.indexOf(tile), 1);
        this.emit({ type: 'robKongChance', seat, tile });
        this.state.phase = { kind: 'claims', discarder: seat, tile, options, responses: {}, robKong: true, concealedKong: true };
        return;
      }
    }
    const tiles = pl.hand.filter((t) => t.kind === kind);
    pl.hand = pl.hand.filter((t) => t.kind !== kind);
    const meld: Meld = { type: 'kong', tiles, concealed: true };
    pl.melds.push(meld);
    this.emit({ type: 'call', seat, meld, claim: 'kong' });
    this.instant({ type: 'kong', seat, concealed: true });
    this.kongReplacement(seat);
  }

  /** Nobody robbed the concealed kong: lay it down with the tile held back, then replace. */
  private completeConcealedKong(seat: number, tile: Tile) {
    const pl = this.players[seat];
    const tiles = [...pl.hand.filter((t) => t.kind === tile.kind), tile];
    pl.hand = pl.hand.filter((t) => t.kind !== tile.kind);
    const meld: Meld = { type: 'kong', tiles, concealed: true };
    pl.melds.push(meld);
    this.emit({ type: 'call', seat, meld, claim: 'kong' });
    this.instant({ type: 'kong', seat, concealed: true });
    this.kongReplacement(seat);
  }

  // ------------------------------------------------------------ Riichi extras

  /** Kyuushu kyuuhai: abandon the hand with nine different terminals and honours. */
  declareNineTerminals(seat: number) {
    if (!this.turnOptions(seat).nineTerminals) throw new Error('No nine terminals declaration now');
    this.abortiveDraw('nineTerminals', seat);
  }

  /** Sanma kita: set a North aside as a bonus dora and draw a replacement. */
  declareKita(seat: number) {
    if (!this.turnOptions(seat).kita) throw new Error('No North to set aside');
    const k = this.profile.nukiDora!;
    const ph = this.state.phase;
    const pl = this.players[seat];
    const drawn = ph.kind === 'turn' && ph.drawn?.kind === k ? ph.drawn : null;
    const i = drawn ? pl.hand.findIndex((t) => t.id === drawn.id) : pl.hand.findIndex((t) => t.kind === k);
    const [tile] = pl.hand.splice(i, 1);
    // Others may win on the North as on a discard (not robbing a kong: no chankan).
    const options: Record<number, ClaimOption[]> = {};
    let any = false;
    for (let s = 0; s < this.profile.players; s++) {
      if (s === seat) continue;
      if (this.evaluateWin(s, k, false, true, false, { winTileId: tile.id, discarder: seat }) && !this.isFuriten(s)) {
        options[s] = [{ type: 'win' }];
        any = true;
      }
    }
    if (any) {
      this.state.phase = { kind: 'claims', discarder: seat, tile, options, responses: {}, robKong: true, kita: true };
      return;
    }
    this.completeKita(seat, tile);
  }

  /** The North stands aside; its owner draws from the dead wall (no new dora). */
  private completeKita(seat: number, tile: Tile) {
    const pl = this.players[seat];
    pl.flowers.push(tile);
    this.emit({ type: 'flower', seat, tile });
    const rep = this.takeBack(false);
    if (!rep) return this.exhausted();
    this.state.afterFlower = true;
    pl.hand.push(rep);
    this.emit({ type: 'draw', seat, tile: rep, replacement: true });
    this.state.phase = { kind: 'turn', seat, drawn: rep, afterKong: true, mustDiscardOnly: false };
  }

  /** After a discard passes: four riichi, or four kongs between two or more players, abandon the hand. */
  private abortAfterDiscard(): boolean {
    const a = this.profile.abortiveDraws;
    if (!a) return false;
    if (a.fourRiichi && this.profile.players === 4 && this.players.every((p) => p.riichi)) {
      this.abortiveDraw('fourRiichi');
      return true;
    }
    if (a.fourKongs) {
      const kongs = this.players.map((p) => p.melds.filter((m) => m.type === 'kong').length);
      if (kongs.reduce((x, y) => x + y, 0) >= 4 && kongs.filter(Boolean).length >= 2) {
        this.abortiveDraw('fourKongs');
        return true;
      }
    }
    return false;
  }

  /** End the hand with no winner and no draw payments: same dealer, one more honba. */
  private abortiveDraw(reason: AbortiveKind, seat?: number) {
    this.emit(seat === undefined ? { type: 'abortive', reason } : { type: 'abortive', reason, seat });
    const instant = this.state.instant ?? [];
    const deltas = this.applyPayments(instant);
    const result: HandResult = { type: 'draw', payments: [...instant], deltas, abortive: reason };
    if (instant.length) result.instant = instant;
    this.state.phase = { kind: 'handOver', result };
  }

  /** Put the added tile on the pung, making it a kong, then draw the replacement. */
  private completeAddedKong(seat: number, tile: Tile) {
    const pl = this.players[seat];
    const meld = pl.melds.find((m) => m.type === 'pung' && m.tiles[0].kind === tile.kind)!;
    meld.tiles.push(tile);
    meld.type = 'kong';
    this.emit({ type: 'call', seat, meld, claim: 'kong' });
    this.instant({ type: 'kong', seat, concealed: false });
    this.kongReplacement(seat);
  }

  private kongReplacement(seat: number) {
    const pl = this.players[seat];
    this.state.callsMade++;
    for (const p of this.players) p.ippatsu = false;
    const rep = this.drawFor(seat, true);
    if (!rep) return this.exhausted();
    pl.hand.push(rep);
    this.emit({ type: 'draw', seat, tile: rep, replacement: true });
    this.state.phase = { kind: 'turn', seat, drawn: rep, afterKong: true, mustDiscardOnly: false };
    this.flowerWinCheck();
  }

  declareSelfDrawWin(seat: number) {
    const ph = this.state.phase;
    if (ph.kind !== 'turn' || ph.seat !== seat || !ph.drawn) throw new Error('Cannot win now');
    if (!this.turnOptions(seat).canWin) throw new Error('Not a winning hand');
    this.finishWin(seat, null, ph.drawn, ph.afterKong);
  }

  private nextDraw(prevSeat: number, settled = false) {
    if (!settled) {
      this.settleRiichi(prevSeat);
      if (this.abortAfterDiscard()) return;
    }
    const seat = (prevSeat + 1) % this.profile.players;
    const t = this.drawFor(seat, false);
    if (!t) return this.exhausted();
    const pl = this.players[seat];
    pl.hand.push(t);
    pl.tilesTaken = (pl.tilesTaken ?? 0) + 1;
    this.emit({ type: 'draw', seat, tile: t, replacement: false });
    this.state.phase = { kind: 'turn', seat, drawn: t, afterKong: false, mustDiscardOnly: false };
    this.flowerWinCheck();
  }

  /** The profile's own hand-end settlement (flowers and seasons at India Rules tables). */
  private handEndPayments(winner: number | null, discarder: number | null, score: HandScore | null = null): Payment[] {
    const f = this.profile.handPayments;
    if (!f) return [];
    return f({
      winner,
      discarder,
      dealer: this.dealer,
      players: this.profile.players,
      flowers: this.players.map((p) => p.flowers.map((t) => t.kind)),
      seatWinds: this.state.seatWinds,
      prevailing: this.prevailing,
      score,
      hands: this.players.map((p, s) => ({ concealed: p.hand.map((t) => t.kind), melds: this.scoringMelds(s) })),
      calling: (s) => this.isTenpai(s),
    });
  }

  private applyPayments(payments: Payment[]) {
    const deltas = this.players.map(() => 0);
    for (const p of payments) {
      deltas[p.from] -= p.amount;
      deltas[p.to] += p.amount;
    }
    this.players.forEach((p, i) => (p.score += deltas[i]));
    return deltas;
  }

  private finishWin(winner: number, discarder: number | null, tile: Tile, afterKong: boolean, robbedKong = false, kita = false) {
    const selfDrawn = discarder === null;
    const ev = this.evaluateWin(winner, tile.kind, selfDrawn, !selfDrawn, afterKong, { robbedKong, winTileId: tile.id, discarder: discarder ?? undefined })!;
    const pl = this.players[winner];
    if (robbedKong) {
      // The robbed tile never reached the pung, which stays a pung.
      this.emit({ type: 'robKong', seat: winner, from: discarder!, tile });
      pl.hand.push(tile);
    } else if (kita) {
      // Won on a North being set aside: it never reached the discards.
      pl.hand.push(tile);
    } else if (!selfDrawn) {
      const d = this.players[discarder!];
      d.discards.pop();
      d.claimedDiscards.push(tile.id);
      d.called.push({ id: tile.id, kind: tile.kind, at: d.discards.length, by: winner });
      // A riichi declared on the winning discard never stood.
      if (d.riichi && !d.riichiPaid) {
        d.riichi = false;
        d.riichiDiscard = null;
      }
      pl.hand.push(tile);
    }
    this.settleWin(winner, discarder, tile, ev.score, robbedKong);
  }

  /** Pay out a win and end the hand. */
  private settleWin(winner: number, discarder: number | null, tile: Tile, score: HandScore, robbedKong: boolean) {
    const selfDrawn = discarder === null;
    const pl = this.players[winner];
    const bonus = this.state.round.repeat;
    const instant = this.state.instant ?? [];
    // Goulash stakes: a win in the hand after a wall game may pay more.
    const stakes = this.state.goulash ? (this.profile.goulashStakes ?? 1) : 1;
    const won = this.profile.payments(winner, discarder, score, this.dealer, this.profile.players, bonus).map((x) => (stakes === 1 ? x : { ...x, amount: x.amount * stakes }));
    const payments = [...instant, ...won, ...this.handEndPayments(winner, discarder, score)];
    const deltas = this.applyPayments(payments);
    const pot = this.state.riichiPot;
    if (pot) {
      pl.score += pot;
      deltas[winner] += pot;
      this.state.riichiPot = 0;
    }
    this.emit({ type: 'win', seat: winner, selfDrawn, tile });
    const result: HandResult = {
      type: 'win',
      winner,
      discarder,
      winTile: tile,
      score,
      payments,
      deltas,
      revealedHand: pl.hand.slice(),
      revealedMelds: pl.melds.slice(),
      potWon: pot,
      bonusCounters: bonus,
      robbedKong: robbedKong || undefined,
    };
    if (instant.length) result.instant = instant;
    this.state.phase = { kind: 'handOver', result };
  }

  private exhausted() {
    this.emit({ type: 'exhausted' });
    const tenpai = this.players.map((_, s) => this.isTenpai(s));
    const instant = this.state.instant ?? [];
    // Nagashi mangan: paid as a self-drawn mangan, in place of the ready-hand payments.
    const nagashi = this.profile.nagashiMangan ? this.players.filter((p) => p.discardKinds.length > 0 && !p.claimedDiscards.length && p.discardKinds.every(isTerminalOrHonor)).map((p) => p.seat) : [];
    const drawn = nagashi.length ? nagashi.flatMap((s) => this.profile.payments(s, null, nagashiScore(s === this.dealer), this.dealer, this.profile.players, 0)) : (this.profile.drawPayments?.(tenpai) ?? []);
    const payments = [...instant, ...drawn, ...this.handEndPayments(null, null)];
    const deltas = this.applyPayments(payments);
    // Goulash pot: everyone antes into a pot that waits for the next winner.
    // Like riichi sticks, the ante goes straight from the scores into the pot.
    const ante = this.profile.goulashPot ?? 0;
    if (ante > 0) {
      for (const p of this.players) p.score -= ante;
      this.state.riichiPot += ante * this.players.length;
    }
    // Club cards: everyone puts a stake in the bank for the next winner (like riichi sticks, not a payment).
    const stake = this.profile.drawPot ?? 0;
    for (const p of stake ? this.players : []) {
      p.score -= stake;
      this.state.riichiPot += stake;
    }
    const result: HandResult = { type: 'draw', payments, deltas, tenpai: this.profile.drawPayments ? tenpai : undefined };
    if (nagashi.length) result.nagashi = nagashi;
    if (ante > 0) result.potAnte = ante;
    if (instant.length) result.instant = instant;
    this.state.phase = { kind: 'handOver', result };
  }

  /** Move the NEWS round framework on. Returns true if the match is over. */
  /** What the round would become after this hand, without applying it. */
  private nextRound() {
    const ph = this.state.phase;
    if (ph.kind !== 'handOver') throw new Error('Hand still in progress');
    const r = ph.result;
    // A goulash keeps East in the seat after a wall game; the deal passes after it as usual.
    const goulash = !!this.profile.goulash && r.type === 'draw';
    // An abortive draw is replayed with the same dealer and one more honba.
    const rounds = goulash || r.abortive ? { ...this.profile.rounds, dealerRetention: 'onDealerWinOrDraw' as const } : this.profile.rounds;
    const round = advanceRound(rounds, this.state.round, this.profile.players, {
      dealerWon: r.type === 'win' && r.winner === this.dealer,
      drawn: r.type === 'draw',
      dealerTenpai: r.tenpai?.[this.dealer],
    });
    return { round, goulash, over: round.finished || (this.profile.endOnBust && this.players.some((p) => p.score < 0)) };
  }

  /** The round state after this finished hand (timed matches compare it with the current one). */
  peekNextRound() {
    return this.nextRound().round;
  }

  /** True when advancing past this finished hand would end the match. */
  willEnd(): boolean {
    return this.nextRound().over;
  }

  advance(): boolean {
    const { round, over, goulash } = this.nextRound();
    this.state.round = round;
    if (goulash) this.state.goulash = true;
    else delete this.state.goulash;
    this.matchOver = over;
    const end = over && !!this.profile.matchEnd;
    if (end) {
      // Riichi sticks still on the table go to the leader before placements are paid.
      const pot = this.state.riichiPot ?? 0;
      if (pot > 0) {
        const top = this.players.reduce((b, p) => (p.score > b.score ? p : b), this.players[0]);
        top.score += pot;
        this.state.riichiPot = 0;
      }
      const uma = this.profile.matchEnd!(this.players.map((p) => p.score));
      this.players.forEach((p, i) => (p.score += uma[i] ?? 0));
    }
    return over;
  }
}

/** Nagashi mangan, paid like a self-drawn mangan. */
export function nagashiScore(dealer: boolean): HandScore {
  return { value: 5, unit: 'han', items: [{ name: 'Nagashi Mangan', value: 5, note: 'Every discard a terminal or honour, none called' }], points: dealer ? 12000 : 8000, limit: true, qualifies: true, fu: 0, base: 2000, tier: 'Mangan' };
}

/** The tile after this one in order (9 to 1, East to North to East, dragons in a ring): the Wuhan laizi rule. */
export function nextKind(k: number): number {
  if (k < 27) return k - (k % 9) + (((k % 9) + 1) % 9);
  if (k <= 30) return 27 + ((k - 27 + 1) % 4);
  return 31 + ((k - 31 + 1) % 3);
}
