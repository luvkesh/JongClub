// The mini-game contract. A mini-game is a solo Mahjong-tile puzzle played on
// your own 3D table (equipped tile set, table, rack and room). Each game is one
// MiniGameDef registered in registry.ts; the shell (src/ui/screens/minigames.ts)
// builds the hub card, the set-up sheet, the HUD, the result sheet and the
// rewards from it, so a game only supplies its rules and how it lays out tiles.
//
//   registry.ts   registerMiniGame(def), MINI_GAMES
//   board.ts      TileBoard: the shared 3D tile renderer on the club table (instanced tiles, picking, tweens)
//   camera.ts     the board camera: drag to turn, pinch or wheel to zoom, like the main table
//   stage.ts      puts the board on the TableRenderer's scene and hands the camera back afterwards
//   helpers.ts    matching groups, decks, undo stack, game clock
//   progress.ts   Jong Points with a daily cap per game (MINI_DAILY_CAP), best results,
//                 the daily seeded puzzle (same board for everyone on a UTC date)
//
// Rules for every game: rewards are Jong Points only (never rating), nothing
// here changes real-game rules, and cosmetics never change a game's difficulty.

import type { Rng } from '../engine/rng';
import type { TileBoard } from './board';
import type { BoardCamera } from './camera';

export type MiniLevel = 'easy' | 'medium' | 'hard';

/** One choice on the set-up sheet (a layout, a board size, a time limit). */
export interface MiniOption {
  id: string;
  /** Shown as the field label; pass through tr() at the definition. */
  label: string;
  choices: { id: string; label: string }[];
  /** The choice picked the first time. */
  initial: string;
}

/** What a finished game reports. */
export interface MiniResult {
  won: boolean;
  /** The game's own score (higher is better); time-based games may report 0 and use `seconds`. */
  score: number;
  seconds: number;
  /** Tiles cleared, for partial credit on a loss. */
  cleared: number;
  total: number;
  /** Hints, undos and shuffles used (shown on the result sheet). */
  hints: number;
  undos: number;
  shuffles: number;
  /** Extra lines for the result sheet, e.g. "Longest combo ×4". */
  notes?: string[];
}

/** What a running game may use. One host per game played. */
export interface MiniHost {
  /** The 3D board on your table. Cleared and refit by each game. */
  board: TileBoard;
  /** The board camera: set its limits and home angle, then call fit(). */
  camera: BoardCamera;
  /** Frame the board's live tiles (call after building it; `snap` skips the glide). */
  fit(snap?: boolean): void;
  /** Effects at a board point: a burst when a pair clears, the equipped win effect at the end. */
  burst(at: import('three').Vector3, big?: boolean): void;
  /** Seeded randomness: the same seed deals the same board (daily puzzles, restarts). */
  rng: Rng;
  seed: number;
  level: MiniLevel;
  /** The set-up sheet's choices by option id. */
  options: Record<string, string>;
  /** True for the daily puzzle (rewards and records are kept apart). */
  daily: boolean;
  /** HUD read-outs: any of score, moves left, pairs left, timer text, combo, a short status line. */
  setStat(id: 'score' | 'left' | 'moves' | 'time' | 'combo' | 'status', text: string | null, label?: string): void;
  /** A short message over the board ("No more moves", "Combo ×3"). */
  toast(text: string, tone?: 'good' | 'bad' | 'info'): void;
  /** Table sounds: tile click, pair clears, shuffle, win. */
  sound(name: 'click' | 'slide' | 'draw' | 'discard' | 'pung' | 'kong' | 'shuffle' | 'mahjong' | 'score'): void;
  /** Ends the game: shows the result sheet, credits Jong Points and saves records. */
  finish(result: Omit<MiniResult, 'hints' | 'undos' | 'shuffles'> & Partial<Pick<MiniResult, 'hints' | 'undos' | 'shuffles'>>): void;
  /** Count a hint, undo or shuffle the game performed itself (the shell counts its own buttons). */
  used(what: 'hints' | 'undos' | 'shuffles'): void;
  /** Lets the HUD buttons reflect the game: e.g. undo off when there is nothing to undo. */
  refreshButtons(): void;
}

/** A game in play. The shell calls these; the board calls onPick. */
export interface MiniSession {
  /** A tile on the board was tapped. */
  onPick(id: number): void;
  /** A tile was swiped: `dx`, `dz` is the drag on the board (x to the right, z toward you). */
  onSwipe?(id: number, dx: number, dz: number): void;
  /** A tap that hit no tile (the felt between tiles), in client pixels. */
  onEmptyTap?(x: number, y: number, camera: import('three').Camera, canvas: HTMLElement): void;
  /**
   * A playable move to suggest when the player pauses (tile ids), free of charge: [] when
   * nothing should show right now (busy, ended), null when no move exists.
   */
  suggest?(): number[] | null;
  /** Shows a playable move; false when there is none (the shell then offers a shuffle). */
  hint?(): boolean;
  undo?(): boolean;
  canUndo?(): boolean;
  /** Rearranges the remaining tiles so a move exists. */
  shuffle?(): boolean;
  /** Called about 10 times a second while playing (timers). `dt` in seconds. */
  tick?(dt: number): void;
  pause?(paused: boolean): void;
  /** Small counts on the HUD buttons, e.g. hints left ("3"); missing means unlimited. */
  badges?(): Partial<Record<'hint' | 'undo' | 'shuffle', string>>;
  /** A button to draw the eye to (Shuffle when there are no moves). */
  attention?(): 'hint' | 'shuffle' | null;
  /** Whether a tool can be used right now. */
  canUse?(tool: 'hint' | 'shuffle'): boolean;
  /** A short line for the variant in records, e.g. the layout id. */
  variant?(): string;
  dispose(): void;
}

/** A mini-game. */
export interface MiniGameDef {
  id: string;
  /** Names and text go through tr() where defined. */
  title: string;
  blurb: string;
  /** "3–10 min" style length shown on the card. */
  minutes: string;
  /** Hub ordering and grouping. */
  order: number;
  /** Tile kinds shown in the card's 3D icon, and how they stand. */
  icon: { kinds: number[]; shape: 'stack' | 'pair' | 'cube' | 'tray' | 'grid' | 'tower' | 'fan' | 'path' | 'hourglass' };
  levels: MiniLevel[];
  options?: MiniOption[];
  /** How to play, a few short lines; Mei reads them on the help sheet. */
  howTo: string[];
  /** Board shape: flat tiles, upright tiles or tile cubes (3D Dimensions). */
  shape?: 'tile' | 'cube';
  /** Tiles change their face during play (Match-3 refills): the board makes room for that. */
  dynamicKinds?: boolean;
  /** False for games with no move to suggest (Memory): the set-up sheet leaves out "Suggest a move when I pause". */
  pauseHints?: boolean;
  /** Some tiles are held in by others (Solitaire, Triple Match, Dimensions): the set-up sheet offers "Highlight free tiles". */
  layered?: boolean;
  /** Keep the game's own camera angle on portrait phones (it lays its board out for them). */
  ownPortraitCamera?: boolean;
  /** Buttons the HUD shows. */
  tools?: { hint?: boolean; undo?: boolean; shuffle?: boolean };
  /** Jong Points for a result before the daily cap (rewards.ts adds the daily bonus). */
  reward(r: MiniResult, level: MiniLevel): number;
  /** Whether a daily puzzle of this game exists. */
  daily?: boolean;
  start(host: MiniHost): MiniSession;
}
