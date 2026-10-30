// What screens need from the app shell. Screens are plain functions that
// return DOM, so the shell stays small.

import type { Club, Who } from '../net/session';
import type { ReplayRecord } from '../net/replay';
import type { Profile } from '../progression/profile';
import type { MatchOptions, TableConfig } from './match';
import type { LiveHost } from './live';

export type Screen = 'home' | 'play' | 'versions' | 'learn' | 'passport' | 'club' | 'collection' | 'profile' | 'daily' | 'tournaments' | 'atelier' | 'seasons' | 'minigames' | 'store';

export interface AppCtx {
  profile: Profile;
  labels: boolean;
  modal: HTMLElement;
  club: Club | null;
  save(): void;
  go(screen: Screen): void;
  startMatch(cfg: TableConfig, opts?: MatchOptions): void;
  openReplay(rec: ReplayRecord, start?: { hand: number; step: number }): void;
  who(): Who;
  /** Re-apply the equipped cosmetics to the table. */
  applyLoadout(): void;
  /** A sensible table for a variation. */
  tableFor(variation: string): TableConfig;
  /** Open the lesson for a variation in the Academy (lesson ids match variation ids; Classic's is 'basics'). */
  openLesson(lesson: string): void;
  /** A guided game of a variation: one gentle hand with Mei commentating. */
  startGuided(variation?: string, theme?: string): void;
  /** Hosting and joining live tables from other screens (private clubs). */
  liveHost?: () => LiveHost;
}

/** Close the modal. */
export const closeModal = (ctx: AppCtx) => (ctx.modal.hidden = true);
