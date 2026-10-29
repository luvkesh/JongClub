// A RuleProfile is everything that makes a Mahjong variation itself.
// The game engine reads only from the profile, so adding Riichi, Taiwanese,
// American or UAE play means adding a profile, not editing the engine or UI.

import type { Decomposition, MeldShape, ShapeRules } from '../hand';
import type { RoundProfile } from '../rounds';
import type { Wind } from '../tiles';
import type { Meld } from '../state';
import type { Tile } from '../tiles';
import type { PassportLayout } from './indiaLayout';
import type { BigCard, MInfo } from './indiaBig';

export interface ScoringContext {
  decomposition: Decomposition;
  melds: Meld[];
  /** Concealed counts including the winning tile. */
  concealedCounts: number[];
  winKind: number;
  selfDrawn: boolean;
  seatWind: Wind;
  prevailingWind: Wind;
  isDealer: boolean;
  lastTileOfWall: boolean;
  afterKong: boolean;
  dealerRepeat: number;
  // Riichi-family context. Profiles that don't use these ignore them.
  riichi?: boolean;
  doubleRiichi?: boolean;
  ippatsu?: boolean;
  /** Kinds that are dora this hand (one entry per indicator, so repeats stack). */
  doraKinds?: number[];
  uraDoraKinds?: number[];
  /** House-rule choices made by the table host. */
  house?: Record<string, string>;
  /** Flower kinds the winner has set aside. */
  flowers?: number[];
  /** Won on a tile another player was adding to a pung (robbing the kong). */
  robbedKong?: boolean;
  /** Red fives in the winning hand, win tile and melds included (Riichi aka dora). */
  redFives?: number;
  /** Wild tiles (jokers) the winning reading uses, in hand and melds. The
   *  decomposition, counts and melds already show them as the tiles they stand for. */
  wildsUsed?: number;
  /** Wild tiles in the concealed hand at the win, the winning tile included. */
  wildsHeld?: number;
  // Club-card context (Dubai Taiwanese). Profiles that don't use these ignore them.
  /** The dealer threw the winning tile. */
  discarderIsDealer?: boolean;
  /** Self-drawn on the tile that replaced a flower. */
  afterFlower?: boolean;
  /** Tiles the winner has taken this hand, the winning tile included (opening deal and replacements not counted). */
  tilesTaken?: number;
  /** The dealer won on the deal, before any discard. */
  heavenly?: boolean;
  /** The winner's secret card (India Rules Small Cards). */
  card?: number;
  /** Won on the dealer's first discard, before any call. */
  earthly?: boolean;
  /** This hand's three dice. */
  dice?: number[];
}

/**
 * Jokers in an Asian standard hand (Vietnamese, Indian club). Which kinds are
 * wild, and for what, comes from wildTargets in tiles.ts.
 */
export interface WildRules {
  /** A wild may complete the pair (with a natural, or two wilds together). */
  inPair: boolean;
  /** A wild may stand in a chow inside the concealed hand. */
  inChow: boolean;
  /** One wild plus one natural may claim a discard for a pung. */
  inCalls: boolean;
  /** A wild may be discarded. A discarded wild is dead: nobody may claim it. */
  discard: boolean;
  /** Every set and the pair hold at least one natural tile (India North Goulash with jokers). */
  natural?: boolean;
}

/** Something that pays out on the spot, before the hand ends (Singapore "bites", kong money). */
export type InstantEvent =
  | { type: 'bonus'; seat: number; kind: number; /** Bonus kinds this seat now holds, the new one included. */ held: number[]; /** Still in the opening deal. */ dealing: boolean }
  | { type: 'kong'; seat: number; concealed: boolean };

export interface ScoreItem {
  name: string;
  value: number;
  note?: string;
}

export interface HandScore {
  /** Faan / han / fan, in the profile's own unit. */
  value: number;
  unit: string;
  items: ScoreItem[];
  /** Points the hand is worth before payment rules. */
  points: number;
  limit: boolean;
  /** False when the hand has no scoring pattern that allows a win (e.g. no yaku). */
  qualifies?: boolean;
  /** Minipoints (Riichi fu) when the profile uses them. */
  fu?: number;
  /** Base points used by the payment rule. */
  base?: number;
  /** Named tier, e.g. "Mangan". */
  tier?: string;
}

/** Which Riichi abortive draws a table plays. */
export interface AbortiveRules {
  /** Kyuushu kyuuhai: nine different terminals and honours on your first, uninterrupted turn. */
  nineTerminals: boolean;
  /** Suufon renda: all four players discard the same wind on the first go-round. */
  fourWinds: boolean;
  /** Suukaikan: a fourth kong by a second player, once the next discard passes. */
  fourKongs: boolean;
  /** Suucha riichi: all four players declare riichi. */
  fourRiichi: boolean;
  /** Sanchahou: three players win on one discard (otherwise head bump: the first in turn wins). */
  tripleRon: boolean;
}

export type AbortiveKind = 'nineTerminals' | 'fourWinds' | 'fourKongs' | 'fourRiichi' | 'tripleRon';

export interface Payment {
  from: number;
  to: number;
  amount: number;
  /** What the payment is for, when it isn't the win itself (e.g. "Pure bouquet"). */
  reason?: string;
}

/** What a seat-specific rule needs to know about a seat. */
export interface SeatInfo {
  /** The seat's secret card (index into the profile's deck), if the round deals them. */
  card?: number;
  seatWind: Wind;
  prevailing: Wind;
  /** Concealed tile kinds. */
  hand: number[];
  melds(): MeldShape[];
  /** India Rules Big Cards: the seat's laid-down groups, as the card checker reads them. */
  bigMelds?(): MInfo[];
  /** Flowers and seasons held in the hand (Big Cards that keep them as jokers or tiles). */
  flowersHeld?(): number;
}

/** A finished hand as hand-end settlement sees it (won or drawn). */
export interface SettleInfo {
  winner: number | null;
  discarder: number | null;
  dealer: number;
  players: number;
  /** Bonus tiles each seat set aside (flower kinds). */
  flowers: number[][];
  seatWinds: Wind[];
  prevailing: Wind;
  /** The winner's score (null on a draw). */
  score?: HandScore | null;
  /** Each seat's concealed tile kinds and declared melds at the end of the hand. */
  hands?: { concealed: number[]; melds: Meld[] }[];
  /** Is this seat one tile from Mahjong (calling)? */
  calling?(seat: number): boolean;
}

export interface RuleProfile {
  id: string;
  name: string;
  region: string;
  flag: string;
  summary: string;

  // Tiles and table
  players: number;
  /** Kinds in the set and copies of each. */
  tileKinds: number[];
  copiesPerKind: number;
  handSize: number;

  // Calls
  calls: {
    chow: boolean;
    pung: boolean;
    exposedKong: boolean;
    concealedKong: boolean;
    addedKong: boolean;
    /** Chow may only be claimed by the next player in turn. */
    chowFromLeftOnly: boolean;
  };

  // Winning
  shapes: ShapeRules;
  /** Minimum hand value to declare a win. */
  minValue: number;

  rounds: RoundProfile;

  score(ctx: ScoringContext): HandScore;
  /** Who pays whom for a win. */
  payments(winner: number, discarder: number | null, score: HandScore, dealer: number, players: number, bonusCounters: number): Payment[];
  startingScore: number;

  /** The set includes the eight flower tiles, set aside and replaced when drawn
   *  (unless the profile plays them as hand tiles, as American does). */
  flowers?: boolean;
  /** Plain jokers in the set (American, or Asian wilds with `wilds`). */
  jokers?: number;
  /** Extra tiles beyond the 136 + flowers + jokers: typed jokers and animals,
   *  one entry per physical copy. Ids come from extraTileIds in tiles.ts. */
  extraTiles?: number[];
  /** Kinds besides the eight flowers that are bonus tiles: set aside when drawn
   *  and replaced (animals, the Vietnamese Flower Joker). */
  bonusKinds?: number[];
  /** Jokers that stand in for tiles inside a sets-and-a-pair hand. */
  wilds?: WildRules;
  /** A natural tile turned wild each hand (Wuhan laizi, Shanghai baida, Fujian gold), with
   *  `wilds` saying how it may be used. 'next': a tile is turned up from the back of the wall
   *  and the next tile in order is wild (as a Riichi dora); 'same': the tile turned up is wild
   *  (its other copies); a number: that kind is always wild (a Guangdong ghost tile). */
  naturalWild?: { name: string; pick: 'next' | 'same' | number };
  /** Three of the natural wild in hand win at once on your own draw (Fujian "three golds fall"),
   *  scored as the special shape 'Three Golds'. */
  threeWildsWin?: boolean;
  /** Payments made on the spot (bonus-tile bites, kong money), settled with the hand. */
  instantPayments?(e: InstantEvent, players: number): Payment[];
  /** American house rule: a wall game is followed by a goulash (East stays East, jokers may be passed). */
  goulash?: boolean;
  /** Asian goulash: on the hand after a wall game, everyone exchanges three tiles
   *  (right, across, left) before play. Uses the Charleston phase, without the vote. */
  goulashExchange?: boolean;
  /** Cumulative pot: at a wall game each player puts this many points into the pot,
   *  which carries over (held in state.riichiPot) until someone wins it. 0 = none. */
  goulashPot?: number;
  /** Stake multiplier for a win in a goulash hand (2 = double). Absent = 1. */
  goulashStakes?: number;
  /** Special wind rounds (Indian and Dubai home tables): the round played under each
   *  prevailing wind, by id from windRounds.ts. The game applies it with roundOverlay. */
  windRounds?: Partial<Record<Wind, string>>;
  /** A rule set's own special rounds (India Rules): the profile for round `id`, or null to use windRounds.ts. */
  roundRules?(id: string): RuleProfile | null;
  /** India Rules North round: East chooses the game before each deal. The game's profile is
   *  roundRules(`${specialRound id}:${code}`). */
  roundChoices?: { code: number; label: string }[];
  /** The game East chose (North round), for the table's title. */
  chosenGame?: string;
  /** Kinds wild every hand under this profile (North round jokers: flowers, or a number in all suits). */
  fixedWilds?: number[];
  /** At most this many copies of each wild kind count as jokers for a player; the rest are natural
   *  tiles, and a discarded one may be claimed (North Goulash: one joker of each suit each). */
  wildCap?: number;
  /** Flowers and seasons stay in the hand (as jokers) instead of being set aside. */
  flowersWild?: boolean;
  /** The cards dealt (indices into the deck of dealCards); absent = all of them. */
  dealDeck?: number[];
  /** Set on the profile a special round produces: which round it is. */
  specialRound?: string;
  /** Goulash round: before play, East chooses 1 or 3 player exchanges and 1 or 3 wall exchanges of three tiles. */
  roundExchange?: boolean;
  /** India Rules exchanges (South, West and North rounds): three compulsory blind swaps
   *  (East-South and West-North, East-North and South-West, East-West and South-North), then East
   *  may call 0, 1 or 3 Tic-Tac-Toes (one tile to each other player) and 0, 1 or 3 wall
   *  exchanges, whose tiles are mixed back into the wall. */
  indiaExchange?: boolean;
  /** Each player draws a secret card (India Rules Small Cards): the deck's size. The game deals
   *  four different cards into state.cards at the start of each hand. */
  dealCards?: number;
  /** India Rules East round: how the hand summary lays out a hand (its passports apart from the rest). */
  passportView?(hand: Tile[], melds: Meld[]): PassportLayout;
  /** India Rules East round and Classic: crochets and mixed chows are sets, so hand sorting groups them. */
  mixedSets?: boolean;
  /** The passport is optional (India Rules East with passports not compulsory). */
  passportOptional?: boolean;
  /** Each player is offered this many cards and keeps one after seeing their tiles (the table rule
   *  "draw 3, keep 1"). */
  cardChoice?: number;
  /** Hand shapes for one seat when they differ by seat (a secret card). Null = the profile's shapes. */
  seatShapes?(seat: number, info: SeatInfo): ShapeRules | null;
  /** May this seat make this claim? (A card that is "all from the wall" forbids them.) */
  claimAllowed?(seat: number, type: 'pung' | 'kong' | 'chow' | 'win', kind: number, info: SeatInfo): boolean;
  /** India Rules North round Big Cards: one card for the whole table. Wins, the kongs, qwongs
   *  and runs a player may lay down (with their extra tiles) and the jokers all follow the card. */
  big?: BigCard;
  /** Buying (India Rules South round): the player on the discarder's right may buy the discard
   *  for this many points, into the bank the next winner collects. The tile stays concealed in hand. */
  buyFromLeft?: number;
  /** Flowers and seasons stay face down until Mahjong (India Rules West round). */
  flowersHidden?: boolean;
  /**
   * How the table lays out discards: 'rows' in front of each player (the default), a Japanese
   * 'pond' that keeps called tiles faded in place, or one shared 'centre' board sorted by tile.
   */
  discards?: 'rows' | 'pond' | 'centre';
  /** AI hint: winning hands must be clean (one suit with honours), so play for one suit. */
  cleanHand?: boolean;
  /** Sichuan "missing suit": a winning hand may hold tiles of at most two suits. */
  missingSuit?: boolean;
  /** The engine family this profile plays like, for AI heuristics keyed on a
   *  profile id (a Dubai Taiwanese table plays like 'taiwanese'). Absent = id. */
  base?: string;
  /** Name of the scoring unit for hints and lessons ("faan", "tai", "phán"). */
  scoreUnit?: string;
  /** Card-hand games (American): wins are matched against a card, not sets and a pair. */
  card?: {
    evaluate(hand: Tile[], melds: Meld[], selfDrawn: boolean): HandScore | null;
    /** Tiles still needed for the nearest hand on the card. */
    distance(hand: Tile[], melds: Meld[]): number;
    jokerKind: number;
  };
  /** Pass tiles before play (the American Charleston). */
  charleston?: boolean;
  /** Tiles kept back at the end of the wall (Riichi dead wall). 0 = none. */
  deadWall: number;
  /** Dora: map an indicator kind to the dora kind. Absent = no dora. */
  doraFromIndicator?(indicator: number): number;
  /** Riichi declarations. Absent = no riichi. */
  riichi?: { cost: number; minLiveTiles: number };
  /** Can't win on a discard while waiting on a tile you discarded. */
  furiten: boolean;
  /** Riichi abortive draws, each on or off. The hand is replayed with the same
   *  dealer and one more honba; riichi sticks stay on the table. Absent = none. */
  abortiveDraws?: AbortiveRules;
  /** Nagashi mangan: at a wall game, a player whose discards are all terminals
   *  and honours, none of them called, is paid a mangan by self-draw. */
  nagashiMangan?: boolean;
  /** Thirteen orphans may win on a tile declared as a concealed kong (Riichi). */
  kokushiRobsConcealedKong?: boolean;
  /** Sanma "kita": this kind may be set aside on your turn as a bonus dora
   *  (North in three-player Riichi), replaced from the dead wall. */
  nukiDora?: number;
  /** Others may win on a tile added to an exposed pung (robbing the kong).
   *  The kong maker pays as the discarder. Absent = off (American). */
  robKong?: boolean;
  /** Red fives in the set: 0, 3 (one each of 5m, 5p, 5s) or 4 (a second 5p).
   *  Which ids are red comes from redFiveIds in tiles.ts. Absent = 0. */
  redFives?: number;
  /** Bonus-tile instant wins (eight flowers, seven robbing the eighth). Checked after every draw. */
  flowerWin?(flowers: number[][], seatWinds: Wind[], dealer: number): { winner: number; payer: number | null; score: HandScore } | null;
  /** Everyone followed the dealer's first discard with the same tile ("chasing"): paid on the spot. */
  chasePayments?(dealer: number, kind: number, players: number): Payment[];
  /** At an exhaustive draw every player puts this much in the bank; the next winner collects it. */
  drawPot?: number;
  /** Payments settled with every finished hand, won or drawn, besides the win itself (India Rules: flowers and seasons). */
  handPayments?(info: SettleInfo): Payment[];
  /** Payments at an exhaustive draw, given who is ready (tenpai). */
  drawPayments?(tenpai: boolean[]): Payment[];
  /** The match ends as soon as someone drops below zero. */
  endOnBust: boolean;
  /** Names for calls in this tradition. */
  callNames: { chow: string; pung: string; kong: string; win: string; selfDraw: string; riichi?: string };
  /** Calls are pointless without a scoring pattern (AI and hints use this). */
  yakuRequired: boolean;
  /** Visual identity: felt colour for this variation's table. */
  felt: string;
  tableName: string;

  /** Scoring guide the profile writes for itself (newer tables). English, translated where
   *  shown; each line is [name, value, how]. Absent = the guide is built in scoringGuideData. */
  guide?: { /** Add to the family's own guide instead of replacing it. */ extend?: boolean; win: string[]; pay: string; sections: { title: string; lines: [string, number | string, string][]; closed?: boolean }[] };
  /** Settlement when the match ends (tournament uma): points added to each seat, given final scores. */
  matchEnd?(scores: number[]): number[];

  /** Turn house-rule choices into profile overrides (club profiles such as Dubai). */
  configure?(choices: Record<string, string>): Partial<RuleProfile>;
  /** Choices applied by withHouseRules. */
  houseChoices?: Record<string, string>;
  /** House rules a table host may toggle; surfaced generically in the lobby. */
  houseRules: { id: string; label: string; options: { value: string; label: string }[]; default: string }[];
}
