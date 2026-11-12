// Mei's recorded line for each mini-game: its "How to play" sheet, read as one
// line. scripts/narration-lines.ts records these with the lessons, and
// test/narration.test.ts checks that every game has its clip.

import { source } from '../i18n';
import { miniGames } from './registry';
import type { MiniGameDef } from './types';

/** The line Mei reads for a game's sheet: its English how-to, which is what her clip is keyed by. */
export const howToLine = (game: MiniGameDef): string => game.howTo.map(source).join(' ');

/** Every registered game's line (import ../minigames/games first). */
export const miniGameLines = (): string[] => miniGames().map(howToLine);
