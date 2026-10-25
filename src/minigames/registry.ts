// Every mini-game registers itself here; the hub lists MINI_GAMES in `order`.
// A new game: write src/minigames/games/<id>.ts exporting a MiniGameDef, then
// add one import line to games/index.ts. Nothing else needs to change.

import type { MiniGameDef } from './types';

const games = new Map<string, MiniGameDef>();

export function registerMiniGame(def: MiniGameDef) {
  if (games.has(def.id)) throw new Error(`Mini-game ${def.id} registered twice`);
  games.set(def.id, def);
}

export const miniGames = (): MiniGameDef[] => [...games.values()].sort((a, b) => a.order - b.order);

export const miniGame = (id: string): MiniGameDef | undefined => games.get(id);
