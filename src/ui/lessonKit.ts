// Lesson building blocks, shared by academy.ts and the lessons in src/ui/lessons/.

/** Built-in lessons; more live in src/ui/lessons/ and are registered by id. */
export type LessonId = string;

export type Visual =
  | { tiles: string[] }
  | { board: 'seats' | 'wall' | 'centre' | 'turns' }
  /** A winning hand broken into its sets, with the score and who pays. */
  | { hand: HandPic }
  /** A comparison table. */
  | { table: TablePic }
  /** Several tables, one under the other. */
  | { tables: TablePic[] }
  /** Points in a list, each with optional tiles. */
  | { list: ListItem[]; title?: string }
  /** Illustrated cards side by side. */
  | { cards: CardPic[] }
  /** A moving demo of a table ritual. */
  | { demo: DemoKind }
  /** A recorded clip from the 3D table (public/video/lesson-<name>.mp4), with a moving demo where video can't play. */
  | { video: string; demo?: DemoKind; caption?: string };

export interface HandPic {
  title?: string;
  /** An India Rules Small Card, by name, drawn to the left of the hand. */
  card?: string;
  /** Each set: tiles in parseKinds notation, a label (CHOW), a detail (1-2-3 Bamboo), a flag above it, and a highlight. */
  groups: { tiles: string; label?: string; sub?: string; flag?: string; mark?: 'hl' | 'win' | 'called' }[];
  /** What happened, as short chips. */
  facts?: string[];
  scoreTitle?: string;
  /** The score lines: a label and its faan (or a word). Empty: nothing to count. */
  faan?: [string, number | string][];
  none?: string;
  total?: string;
  pay?: { who: string; amount: string; big?: boolean }[];
  winner?: string;
}

export type Cell = string | { tiles?: string; text?: string };
export interface TablePic {
  title?: string;
  head: string[];
  rows: Cell[][];
}
export interface ListItem {
  tiles?: string;
  title?: string;
  text?: string;
}
export interface CardPic {
  tiles?: string;
  title: string;
  /** Other names, in small capitals. */
  alt?: string;
  text?: string;
}
export type DemoKind = 'wash' | 'wall' | 'turn' | 'call' | 'charleston' | 'tictactoe' | 'wallswap';

export interface Scene {
  title: string;
  /** Spoken and shown as the caption. */
  say: string;
  visual?: Visual;
  /** Read for Mei's tile aside instead of say, when it should show only some of the sets she names. */
  aside?: string;
}

export interface Question {
  q: string;
  options: { text: string; tiles?: string }[];
  answer: number;
  /** Shown after a wrong answer, then the question is asked again. */
  explain: string;
}

export interface Lesson {
  id: LessonId;
  title: string;
  scenes: Scene[];
  quiz: Question[];
  /** The lesson this one builds on (a Dubai table builds on its base game). The player links to it. */
  base?: LessonId;
}

export const S = (title: string, say: string, visual?: Visual, aside?: string): Scene => ({ title, say, visual, ...(aside ? { aside } : {}) });
export const Q = (q: string, options: (string | [string, string])[], answer: number, explain: string): Question => ({
  q,
  options: options.map((o) => (typeof o === 'string' ? { text: o } : { text: o[0], tiles: o[1] })),
  answer,
  explain,
});

