// Lesson text by language. Mei's lessons (scenes, tests and her spoken lines in
// src/ui/academy.ts and src/ui/lessons/) are written and recorded in English.
// A language gets its lessons by adding a table here, keyed by the English line,
// once Mei's voice is recorded in that language (scripts/record-narration.py).
// Until then the Academy shows lessons in English with a short note, and the
// rest of the screen (buttons, progress, results) follows the chosen language.

import { lang, tr, type Lang } from './index';

export const LESSON_TEXT: Partial<Record<Lang, Record<string, string>>> = {};

/** True when the chosen language has its own lesson text. */
export const lessonsTranslated = (l: Lang = lang()) => l === 'en' || !!LESSON_TEXT[l];

/** A lesson line (a title, a scene, a question) in the chosen language, or English until that language has lessons. */
export function lt(line: string): string {
  return LESSON_TEXT[lang()]?.[line] ?? line;
}

/** The note shown in the Academy while lessons are English only, or null. */
export function lessonNote(): string | null {
  return lessonsTranslated() ? null : tr('Lessons are in English for now. Mei will teach in your language soon.');
}
