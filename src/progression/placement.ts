// The placement test: ten quick questions for players who already know the
// game. A good score marks the beginner lessons they have shown they know as
// done, and suggests an AI level and a first table, so an expert is not sent
// through the Basics. The result is kept per account, like the profile.
//
// The waits and the best discard are checked against the engine in
// test/placement.test.ts.

import type { Difficulty } from '../ai/players';
import { currentAccount } from '../auth/account';
import type { GameLength } from '../engine/rounds';
import type { Profile } from './profile';
import { tr } from '../i18n';

export type PlacementSkill = 'tiles' | 'sets' | 'words' | 'rounds' | 'waits' | 'discard' | 'scoring' | 'riichi';

export interface PlacementQuestion {
  id: string;
  skill: PlacementSkill;
  q: string;
  /** Tiles shown with the question (a hand), in parseKinds notation. */
  hand?: string;
  /** Text and/or tiles. A tile-name question hides the corner labels. */
  options: { text: string; tiles?: string }[];
  answer: number;
  /** One line shown after the answer. */
  explain: string;
  /** Hide tile corner labels (they would give a tile-name answer away). */
  noLabels?: boolean;
}

const Q = (id: string, skill: PlacementSkill, q: string, options: (string | [string, string])[], answer: number, explain: string, extra: Partial<PlacementQuestion> = {}): PlacementQuestion => ({
  id,
  skill,
  q,
  options: options.map((o) => (typeof o === 'string' ? { text: o } : { text: o[0], tiles: o[1] })),
  answer,
  explain,
  ...extra,
});

export const PLACEMENT: PlacementQuestion[] = [
  Q('name-character', 'tiles', tr('Which tile is the 7 of Characters?'), [['', '7m'], ['', '7p'], ['', '7s']], 0, tr('Characters carry the number in Chinese, with 萬 beneath it.'), { noLabels: true }),
  Q('name-dragon', 'tiles', tr('Which tile is the Green Dragon?'), [['', 'Gd'], ['', 'Rd'], ['', 'Wd']], 0, tr('The Green Dragon is 發; the Red is 中 and the White is a plain frame.'), { noLabels: true }),
  Q('set', 'sets', tr('Which of these is a complete set?'), [['', '678p'], ['', '689p'], ['', '66p 7p']], 0, tr('A chow is three numbers in a row in one suit.')),
  Q('terminals', 'words', tr('Which tiles are terminals?'), [tr('The ones and nines'), tr('The twos to eights'), tr('The winds and dragons')], 0, tr('Terminals sit at the ends of each suit; winds and dragons are honours.')),
  Q('dealer', 'rounds', tr('Which seat deals and plays first?'), [tr('East'), tr('South'), tr('Whoever holds the most honours')], 0, tr('East is always the dealer, and play runs East, South, West, North.')),
  Q('wait-two-sided', 'waits', tr('Your hand is ready. Which tiles complete it?'), [[tr('3 or 6 Bamboo'), '3s 6s'], [tr('4 or 5 Bamboo'), '4s 5s'], [tr('Only 6 Bamboo'), '6s']], 0, tr('4 and 5 Bamboo wait on either end: 3 or 6.'), { hand: '123m 456p 789s EE 45s' }),
  Q('wait-multi', 'waits', tr('Your hand is ready. Which tiles complete it?'), [[tr('2 or 5 Characters'), '2m 5m'], [tr('1 or 6 Characters'), '1m 6m'], [tr('3 or 4 Characters'), '3m 4m']], 0, tr('2-3-4-5 is a run plus a single: a 2 or a 5 makes the pair.'), { hand: '2345m 123p 789s EEE' }),
  Q('best-discard', 'discard', tr('You have just drawn. Which tile do you discard?'), [[tr('North'), 'N'], [tr('3 Bamboo'), '3s'], [tr('East'), 'E']], 0, tr('Throwing the lone North leaves you ready, waiting on 2 or 5 Bamboo.'), { hand: '123m 456p 789s 34s EE N' }),
  Q('faan', 'scoring', tr('In Classic, a hand of three faan is worth…'), [tr('128 points'), tr('48 points'), tr('3 points')], 0, tr('Sixteen points doubled once per faan: 32, 64, 128.')),
  Q('riichi-yaku', 'riichi', tr('In Riichi, your hand is complete but has no yaku. Can you win?'), [tr('No, every win needs a yaku'), tr('Yes, any complete hand wins'), tr('Only by self-draw')], 0, tr('A Riichi win always needs at least one yaku, even with dora.')),
];

/** Beginner lessons the test can mark as known: every one of their questions right, and a score at least this. */
export const PLACEMENT_LESSONS: { lesson: string; skills: PlacementSkill[]; minScore: number }[] = [
  { lesson: 'basics', skills: ['tiles', 'sets'], minScore: 5 },
  // Level 2 of the Academy, the guided game: skipped along with the basics.
  { lesson: 'guided', skills: ['tiles', 'sets'], minScore: 5 },
  { lesson: 'words', skills: ['words', 'waits'], minScore: 7 },
  { lesson: 'rounds', skills: ['rounds'], minScore: 7 },
  { lesson: 'scoring', skills: ['scoring'], minScore: 7 },
];

export interface PlacementSuggestion {
  difficulty: Difficulty;
  /** null: start with the guided game with Mei. */
  length: GameLength | null;
  /** Shown on the result: "A guided game with Mei", "Casual AI, East round"… */
  label: string;
}

export interface PlacementResult {
  date: string;
  score: number;
  total: number;
  /** Question ids answered correctly. */
  correct: string[];
  /** Lessons this result marks as known. */
  lessons: string[];
  suggestion: PlacementSuggestion;
}

export function suggestionFor(score: number): PlacementSuggestion {
  if (score >= 9) return { difficulty: 'expert', length: 'eastSouth', label: tr('Expert AI, East and South rounds') };
  if (score >= 7) return { difficulty: 'strategic', length: 'eastRound', label: tr('Strategic AI, an East round') };
  if (score >= 5) return { difficulty: 'casual', length: 'eastRound', label: tr('Casual AI, an East round') };
  return { difficulty: 'beginner', length: null, label: tr('A guided game with Mei') };
}

/** Score a set of answers (option index per question, in PLACEMENT order). */
export function gradePlacement(answers: number[], date = new Date().toISOString()): PlacementResult {
  const correct = PLACEMENT.filter((q, i) => answers[i] === q.answer).map((q) => q.id);
  const score = correct.length;
  const knows = (skill: PlacementSkill) => PLACEMENT.filter((q) => q.skill === skill).every((q) => correct.includes(q.id));
  const lessons = PLACEMENT_LESSONS.filter((l) => score >= l.minScore && l.skills.every(knows)).map((l) => l.lesson);
  return { date, score, total: PLACEMENT.length, correct, lessons, suggestion: suggestionFor(score) };
}

/** Mark the result's lessons as done on the profile. Returns the ones that were new. */
export function applyPlacement(p: Profile, r: PlacementResult): string[] {
  const added = r.lessons.filter((l) => !p.lessonsDone.includes(l));
  p.lessonsDone.push(...added);
  return added;
}

// ------------------------------------------------------------ storage

const BASE = 'jongclub.placement.v1';
const DISMISS = 'jongclub.placement.offer.v1';

/** One slot per account, like the profile; a guest uses the plain key. */
function key() {
  const a = currentAccount();
  return a && a.provider !== 'guest' ? `${BASE}:${a.id}` : BASE;
}

export function loadPlacement(): PlacementResult | null {
  try {
    // An account that has none yet carries the guest's over, as the profile does.
    const raw = localStorage.getItem(key()) ?? localStorage.getItem(BASE);
    const r = raw ? JSON.parse(raw) : null;
    return r && typeof r === 'object' && typeof r.score === 'number' && r.suggestion ? (r as PlacementResult) : null;
  } catch {
    return null;
  }
}

export function savePlacement(r: PlacementResult) {
  try {
    localStorage.setItem(key(), JSON.stringify(r));
  } catch {
    /* storage unavailable */
  }
}

/** "No thanks" on the Learn screen's first-visit offer (the Academy link stays). */
export function placementOfferDismissed(): boolean {
  try {
    return !!localStorage.getItem(DISMISS);
  } catch {
    return false;
  }
}

export function dismissPlacementOffer() {
  try {
    localStorage.setItem(DISMISS, '1');
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------ Mei's lines

/** The verdict under the score. */
export function placementVerdict(score: number): string {
  return score >= 9 ? tr('You know your way around a table. Straight to a strong game.') : score >= 7 ? tr('A seasoned player. The basics are behind you.') : score >= 5 ? tr('You know the game. A friendly table is the place to start.') : tr('A good start. Mei will show you the rest, one hand at a time.');
}

/** What Mei says on the opening card. */
export const placementIntroLine = () => `${tr('Already play?')} ${tr('Ten quick questions, about two minutes. We’ll mark the lessons you already know as done and suggest a table at your level.')}`;

/** What Mei says after an answer. */
export const placementAnswerLine = (q: PlacementQuestion, right: boolean) => (right ? tr('Correct.') : `${tr('Not quite.')} ${q.explain}`);

/** What Mei says with the result. */
export const placementResultLine = (score: number, total: number) => `${tr('{n} of {total}', { n: score, total })}. ${placementVerdict(score)}`;

/** Every placement line Mei speaks, for recording (scripts/record-narration.py). */
export function placementLines(): string[] {
  const out = [placementIntroLine()];
  for (const q of PLACEMENT) out.push(q.q, placementAnswerLine(q, true), placementAnswerLine(q, false));
  for (let n = 0; n <= PLACEMENT.length; n++) out.push(placementResultLine(n, PLACEMENT.length));
  return out;
}
