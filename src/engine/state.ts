// Plain-data game state. No methods, so it can be serialised for replays,
// network sync (Phase 3) or saved games.

import type { WallBreak } from './opening';
import type { AbortiveKind, HandScore, Payment } from './rules/types';
import type { RoundState } from './rounds';
import type { Tile, Wind } from './tiles';

export type MeldType = 'chow' | 'pung' | 'kong';

export interface Meld {
  type: MeldType;
  tiles: Tile[];
  /** Concealed kong (declared from the hand). */
  concealed: boolean;
  /** Seat the claimed tile came from (undefined for concealed). */
  from?: number;
  claimedId?: number;
  /** Wild tiles in this meld and the kind each stands for (Asian jokers). */
  wild?: { id: number; as: number }[];
  /** India Rules Big Cards: a qwong (five of a kind) or a run of four or more, laid down as a
   *  kong-like group (type 'kong'), and the extra tiles the group has drawn. */
  big?: 'qwong' | 'run';
  extras?: number;
}

export interface PlayerState {
  seat: number;
  name: string;
  hand: Tile[];
  melds: Meld[];
  discards: Tile[];
  /** Ids of discards that another player claimed (rendered dimmed / removed). */
  claimedDiscards: number[];
  /** Discards another player took, with the river slot they left (index into discards) and who took them. */
  called: { id: number; kind: number; at: number; by: number }[];
  /** Kinds this player has ever discarded this hand (claimed ones included). */
  discardKinds: number[];
  score: number;
  riichi: boolean;
  doubleRiichi: boolean;
  /** Index into discards of the sideways riichi tile. */
  riichiDiscard: number | null;
  /** Deposit paid (the declaration tile was not won on). */
  riichiPaid: boolean;
  ippatsu: boolean;
  /** Passed a winning discard since their own last discard. */
  furitenTemp: boolean;
  /** Passed a winning tile after declaring riichi: furiten for the rest of the hand. */
  furitenLocked: boolean;
  /** Flower tiles set aside face up (profiles with flowers). */
  flowers: Tile[];
  /** Tiles taken this hand: live draws and claimed discards (not the deal or replacements). */
  tilesTaken?: number;
}

export type ClaimType = 'win' | 'kong' | 'pung' | 'chow' | 'buy';

/** India Rules: Tic-Tac-Toe or not; after one, one or three; then a wall exchange or not; after one,
 *  one or three. */
export type IndiaExchangeStep = 'ttt' | 'tttMore' | 'wall' | 'wallMore';

export interface ClaimOption {
  type: ClaimType;
  /** For chow: the two kinds from hand used with the discard. For a pung made
   *  with a joker: the natural kind and the joker kind. */
  using?: number[];
}

export type ClaimResponse = { type: 'pass' } | ClaimOption;

export type Phase =
  | { kind: 'turn'; seat: number; drawn: Tile | null; afterKong: boolean; mustDiscardOnly: boolean; pendingRiichi?: boolean }
  | {
      kind: 'claims';
      discarder: number;
      tile: Tile;
      options: Record<number, ClaimOption[]>;
      responses: Record<number, ClaimResponse | undefined>;
      /** Robbing the kong: `discarder` is adding `tile` to an exposed pung and the
       *  only options are 'win'. If all pass, the kong stands. */
      robKong?: boolean;
      /** With robKong: the tile is being declared as a concealed kong (only thirteen orphans may rob it). */
      concealedKong?: boolean;
      /** With robKong: the tile is a North being set aside (sanma kita), not a kong. */
      kita?: boolean;
      /** Four winds: if nobody wins on this discard, the hand is abandoned. */
      abortAfter?: AbortiveKind;
    }
  | { kind: 'handOver'; result: HandResult }
  /** American Charleston: each seat picks three tiles to pass. */
  | { kind: 'charleston'; stage: number; picks: Record<number, number[]> }
  | { kind: 'charlestonVote'; votes: Record<number, boolean> }
  /** Goulash round: East chooses how many exchanges are played. */
  /** `step`, India Rules only: East calls the exchanges one question at a time. */
  | { kind: 'exchangeChoice'; seat: number; step?: IndiaExchangeStep }
  /** Goulash round: everyone swaps three tiles with the wall (round 0, 1, 2). */
  | { kind: 'wallExchange'; round: number; picks: Record<number, number[]> }
  /** India Rules Tic-Tac-Toe: everyone gives one tile to each other player (round 0, 1, 2). */
  | { kind: 'ticTacToe'; round: number; picks: Record<number, number[]> }
  /** Everyone keeps one of the Small Cards they were offered (India Rules). */
  | { kind: 'cardPick'; picks: Record<number, number> }
  /** India Rules North round: before the deal, East chooses the game (a code from profile.roundChoices). */
  | { kind: 'roundChoice'; seat: number };

export interface HandResult {
  type: 'win' | 'draw';
  winner?: number;
  discarder?: number | null;
  winTile?: Tile;
  score?: HandScore;
  payments: Payment[];
  /** Score deltas per seat. */
  deltas: number[];
  revealedHand?: Tile[];
  revealedMelds?: Meld[];
  /** Who was ready at a drawn hand (profiles with tenpai payments). */
  tenpai?: boolean[];
  /** Riichi sticks (or a goulash pot) collected by the winner. */
  potWon?: number;
  /** Goulash pot: what each player put into the pot at this wall game (not in deltas). */
  potAnte?: number;
  bonusCounters?: number;
  /** The win robbed a kong: `discarder` was adding `winTile` to a pung. */
  robbedKong?: boolean;
  /** Payments made during the hand (bites, kong money); also included in `payments` and `deltas`. */
  instant?: Payment[];
  /** Riichi abortive draw: the hand was abandoned (same dealer, one more honba). */
  abortive?: AbortiveKind;
  /** Seats paid nagashi mangan at this wall game. */
  nagashi?: number[];
}

export type GameEvent =
  | { type: 'handStart'; dealer: number; seed: number }
  | { type: 'draw'; seat: number; tile: Tile; replacement: boolean }
  | { type: 'discard'; seat: number; tile: Tile; riichi?: boolean }
  | { type: 'dora'; indicator: Tile }
  /** The hand's natural wild (laizi, baida, gold): the tile turned up, if any, and the wild kinds. */
  | { type: 'wildTile'; indicator: Tile | null; kinds: number[] }
  | { type: 'flower'; seat: number; tile: Tile }
  | { type: 'charleston'; stage: number }
  | { type: 'charlestonPassed'; stage: number; offset: number }
  | { type: 'charlestonDone' }
  | { type: 'exchangeChoice'; seat: number; step?: IndiaExchangeStep }
  | { type: 'exchangeChosen'; seat: number; passes: 0 | 1 | 3; wall: 0 | 1 | 3 }
  | { type: 'ticTacToe'; round: number }
  | { type: 'ticTacToeDone'; round: number }
  | { type: 'cardPick' }
  | { type: 'cardsPicked' }
  | { type: 'roundChoice'; seat: number }
  | { type: 'roundChosen'; seat: number; code: number }
  | { type: 'wallExchange'; round: number }
  | { type: 'wallExchanged'; round: number }
  | { type: 'jokerSwap'; seat: number; owner: number }
  | { type: 'call'; seat: number; meld: Meld; claim: ClaimType }
  /** `seat` bought `from`'s discard (India Rules): it goes into the hand, concealed. */
  | { type: 'buy'; seat: number; from: number; tile: Tile; price: number }
  | { type: 'win'; seat: number; selfDrawn: boolean; tile: Tile }
  /** An added kong opened a robbing window: others may win on `tile`. */
  | { type: 'robKongChance'; seat: number; tile: Tile }
  /** `seat` robbed the kong `from` was adding `tile` to. Followed by 'win'. */
  | { type: 'robKong'; seat: number; from: number; tile: Tile }
  | { type: 'exhausted' }
  /** The hand was abandoned (Riichi abortive draw). */
  | { type: 'abortive'; reason: AbortiveKind; seat?: number };

export interface GameState {
  profileId: string;
  players: PlayerState[];
  /** Remaining wall, live tiles drawn from the front, replacements from the back. */
  wall: Tile[];
  /** Original wall order this hand (for rendering wall stacks). */
  wallOrder: number[];
  drawnFromFront: number;
  drawnFromBack: number;
  round: RoundState;
  seatWinds: Wind[];
  prevailingWind: Wind;
  /** Riichi deposits waiting for the next winner (points). */
  riichiPot: number;
  /** Dora indicators showing (Riichi). */
  doraRevealed: number;
  callsMade: number;
  phase: Phase;
  turnCount: number;
  log: GameEvent[];
  handSeed: number;
  /** Ids of red fives this hand (Riichi aka dora). Empty or absent = none. */
  red?: number[];
  /** Payments owed on the spot this hand (Singapore bites, kong money). */
  instant?: Payment[];
  /** Goulash round: the exchanges East chose for this hand. */
  exchange?: { passes: 0 | 1 | 3; wall: 0 | 1 | 3; india?: boolean };
  /** Each seat's secret card this hand (India Rules Small Cards). */
  cards?: number[];
  /** The cards each seat is offered to choose from (India Rules: draw 3, keep 1). */
  cardOffers?: number[][];
  /** Tiles swapped out in a goulash round's wall exchange: out of play for the hand. */
  outOfPlay?: Tile[];
  /** India Rules North round: the game East chose this hand (a code from profile.roundChoices). */
  roundVariant?: number;
  /** Kinds that are wild this hand (a profile's naturalWild or fixedWilds). */
  wildKinds?: number[];
  /** The tile turned up to choose them. */
  wildIndicator?: Tile;
  /** American goulash: this hand follows a wall game (jokers may be passed). */
  goulash?: boolean;
  /** The last draw replaced a flower (a "flower wall" draw). */
  afterFlower?: boolean;
  /** Three dice for this hand, from their own stream of the hand seed (the shuffle is unchanged). */
  dice?: number[];
  /** Where East's throw broke the wall this hand (engine/opening.ts); drawn by the table, no effect on play. */
  wallBreak?: WallBreak;
}
