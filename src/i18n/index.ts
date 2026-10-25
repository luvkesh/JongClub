// Languages. UI text is written in English at the call site and wrapped in tr():
//   tr('Find your table')                        a plain string
//   tr('{name} wins with {n} faan', { name, n })  {name} placeholders
//   trn(n, '{n} game', '{n} games')               plurals, by the language's own plural rules
// The English source is the key. Each language's dictionary is built from the
// string tables in ./strings (one row per string, a column per language), and a
// missing entry falls back to English. Switching language saves the choice on
// this device and reloads, so text built once at start-up is translated too.
// Lesson text and Mei's narration stay English for now (see ./lessons.ts).

import { TABLES, type Cell } from './strings';
import './rtl.css';

export type Lang = 'en' | 'zh-Hans' | 'zh-Hant' | 'ja' | 'ar' | 'hi';

/** The languages offered, each named in its own script. */
export const LANGUAGES: { id: Lang; name: string; english: string }[] = [
  { id: 'en', name: 'English', english: 'English' },
  { id: 'zh-Hans', name: '简体中文', english: 'Simplified Chinese' },
  { id: 'zh-Hant', name: '繁體中文', english: 'Traditional Chinese' },
  { id: 'ja', name: '日本語', english: 'Japanese' },
  { id: 'ar', name: 'العربية', english: 'Arabic' },
  { id: 'hi', name: 'हिन्दी', english: 'Hindi' },
];

/** Column order of the string tables after English. */
export const COLUMNS: Exclude<Lang, 'en'>[] = ['zh-Hans', 'zh-Hant', 'ja', 'ar', 'hi'];

const RTL: Lang[] = ['ar'];
export const LANG_KEY = 'jongclub.lang.v1';

/** The best supported language for a browser language tag, else English. */
export function matchLang(tag: string | undefined | null): Lang {
  const l = (tag ?? '').toLowerCase();
  if (l.startsWith('zh')) return /hant|-tw|-hk|-mo/.test(l) ? 'zh-Hant' : 'zh-Hans';
  if (l.startsWith('ja')) return 'ja';
  if (l.startsWith('ar')) return 'ar';
  if (l.startsWith('hi')) return 'hi';
  return 'en';
}

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY) as Lang | null;
    if (saved && LANGUAGES.some((x) => x.id === saved)) return saved;
  } catch {
    /* storage blocked */
  }
  if (typeof navigator !== 'undefined') for (const tag of navigator.languages ?? [navigator.language]) {
    const m = matchLang(tag);
    if (m !== 'en' || tag.toLowerCase().startsWith('en')) return m;
  }
  return 'en';
}

let current: Lang = initialLang();
type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>>;
let dict = new Map<string, string | PluralForms>();
let rules: Intl.PluralRules | null = null;

/** Build one language's dictionary from the string tables. */
export function dictionary(lang: Lang): Map<string, string | PluralForms> {
  const m = new Map<string, string | PluralForms>();
  if (lang === 'en') return m;
  const col = COLUMNS.indexOf(lang);
  for (const table of TABLES)
    for (const row of table) {
      const key = Array.isArray(row[0]) ? row[0][1] : row[0];
      const cell = row[col + 1] as Cell | undefined;
      if (cell !== undefined && cell !== '') m.set(key, cell as string | PluralForms);
    }
  return m;
}

/** Switch the language in place (tests, and start-up). The page reloads after a choice in Settings. */
export function useLang(lang: Lang) {
  current = lang;
  dict = dictionary(lang);
  rules = new Intl.PluralRules(lang === 'en' ? 'en' : lang);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = isRtl() ? 'rtl' : 'ltr';
  }
}

export const lang = () => current;
export const isRtl = (l: Lang = current) => RTL.includes(l);

/** Choose a language on this device and reload so every screen picks it up. */
export function setLang(lang: Lang, reload = true) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* this session only */
  }
  useLang(lang);
  if (reload && typeof location !== 'undefined') location.reload();
}

/** Whole numbers from 1,000 up read with thousands commas in every language (1,000, not 1000). */
function num(v: string | number) {
  return typeof v === 'number' && Number.isInteger(v) && Math.abs(v) >= 1000 ? v.toLocaleString('en-US') : String(v);
}

function fill(s: string, params?: Record<string, string | number>) {
  if (!params) return s;
  // A player still called by the default name "Guest" reads it in their own language.
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? (k === 'name' && params[k] === 'Guest' ? shownName('Guest') : num(params[k])) : m));
}

/** A display name as shown: the default "Guest" in the player's language, anything else as typed. */
export function shownName(name: string): string {
  if (name !== 'Guest') return name;
  const e = dict.get('Guest');
  return typeof e === 'string' ? e : e?.other ?? name;
}

/** Translate an English UI string, filling {placeholders} from `params`. */
export function tr(src: string, params?: Record<string, string | number>): string {
  const e = dict.get(src);
  return fill(typeof e === 'string' ? e : e?.other ?? src, params);
}

/**
 * A count with its noun: trn(3, '{n} game', '{n} games'). The key is the plural
 * (`other`) form; languages with more forms (Arabic) give each in the table.
 */
export function trn(n: number, one: string, other: string, params: Record<string, string | number> = {}): string {
  const p = { n, ...params };
  const e = dict.get(other);
  if (current === 'en' || e === undefined) return fill(n === 1 ? one : other, p);
  if (typeof e === 'string') return fill(e, p);
  const form = rules?.select(n) ?? 'other';
  return fill(e[form] ?? e.other ?? other, p);
}

/** Join a short list the way the language does ("A, B and C"). */
export function andList(items: string[]): string {
  try {
    const LF = (Intl as unknown as { ListFormat: new (l: string, o: object) => { format(x: string[]): string } }).ListFormat;
    return new LF(current, { type: 'conjunction' }).format(items);
  } catch {
    return items.join(', ');
  }
}

useLang(current);
