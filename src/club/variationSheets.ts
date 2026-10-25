// Rule sheets for the variations added in the Expansion release. Each sheet
// carries what the Variations screen shows for a game (the same fields as its
// built-in versions) plus the Academy row, so screens can list a new game
// without editing their own files. Sheets live one per game in ./sheets/.
//
// Strings go through tr() where they are written (translated in
// src/i18n/strings/expansion.ts); Mei's line stays English, as all her lines do.

import { riichiTournamentSheet } from './sheets/riichiTournament';
import { emaSheet } from './sheets/ema';
import { korean4Sheet } from './sheets/korean4';
import { guangdongSheet } from './sheets/guangdong';
import { zungJungSheet } from './sheets/zungJung';
import { europeanSheet } from './sheets/european';
import { wuhanSheet } from './sheets/wuhan';
import { shanghaiSheet } from './sheets/shanghai';
import { fujianSheet } from './sheets/fujian';
import { beijingSheet } from './sheets/beijing';
import { northeastSheet } from './sheets/northeast';
import { wrightPattersonSheet } from './sheets/wrightPatterson';
import { thaiSheet } from './sheets/thai';
import { filipinoSheet } from './sheets/filipino';
import { indonesianSheet } from './sheets/indonesian';

export interface VariationSheet {
  /** Variation id (src/engine/rules VARIATIONS). */
  id: string;
  /** Academy lesson id. */
  lesson: string;
  /** One line for the map node. */
  hook: string;
  /** Club play: rules vary from table to table, so the host sets them. */
  club: boolean;
  who: string;
  facts: [string, string][];
  win: string;
  /** Mei's spoken introduction. No digits or abbreviations: it is read aloud. */
  mei: string;
  /** The Academy row: a short title and one line. */
  level: { t: string; d: string };
  /** Where the readings come from, and what JongClub chose where tables differ. */
  notes: string[];
}

export const VARIATION_SHEETS: VariationSheet[] = [riichiTournamentSheet, emaSheet, korean4Sheet, guangdongSheet, zungJungSheet, europeanSheet, wuhanSheet, shanghaiSheet, fujianSheet, beijingSheet, northeastSheet, wrightPattersonSheet, thaiSheet, filipinoSheet, indonesianSheet];

export const sheetFor = (id: string) => VARIATION_SHEETS.find((s) => s.id === id);
