import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs helper, no type declarations
import { extractKeys, sourceFiles, writeJson } from '../scripts/i18n-keys.mjs';
import { COLUMNS, LANGUAGES, andList, dictionary, isRtl, lang, matchLang, tr, trn, useLang, type Lang } from '../src/i18n';
import { TABLES } from '../src/i18n/strings';
import { DYNAMIC_KEYS } from '../src/i18n/dynamic';
import { UPCOMING_VARIATIONS, VARIATIONS } from '../src/engine/rules';
import { GAME_LENGTHS } from '../src/engine/rounds';
import { WIND_NAMES } from '../src/engine/tiles';
import { LINES } from '../src/ui/matchLines';
import { CATALOGUE } from '../src/club/catalogue';
import { REGIONS } from '../src/club/roster';
import { SPECIAL_ROUNDS } from '../src/engine/rules/windRounds';
import { BIG_CARD, SMALL_CARD } from '../src/engine/rules/special';

/**
 * Strings that may stay English in every language: brand names and symbols
 * that read the same everywhere. Anything else missing from a dictionary fails.
 */
declare const process: { env: Record<string, string | undefined> };

const ENGLISH_OK = new Set<string>(['JongClub', 'JongBot', 'Mei', 'Riichi', 'NEWS', '{a} · {b}']);

type Extracted = { keys: Map<string, string>; plurals: Map<string, string>; dynamic: string[] };
const found = extractKeys(sourceFiles('src')) as Extracted;

/** Keys the code passes to tr() through a variable, gathered from the data they come from. */
function dataKeys(): Map<string, string> {
  const out = new Map<string, string>();
  const add = (k: string | undefined, where: string) => {
    if (k) out.set(k, where);
  };
  for (const v of [...VARIATIONS, ...UPCOMING_VARIATIONS]) {
    add(v.region, 'VARIATIONS.region');
    add(v.level, 'VARIATIONS.level');
    add(v.blurb, 'VARIATIONS.blurb');
    const p = v.profile;
    if (!p) continue;
    add(p.summary, `${v.id}.summary`);
    for (const n of Object.values(p.callNames)) add(n, `${v.id}.callNames`);
    add(p.naturalWild?.name, `${v.id}.naturalWild`);
    if (p.guide) {
      for (const w of p.guide.win) add(w, `${v.id}.guide`);
      add(p.guide.pay || undefined, `${v.id}.guide`);
      for (const x of p.guide.sections) {
        add(x.title, `${v.id}.guide`);
        for (const l of x.lines) add(l[2], `${v.id}.guide`);
      }
    }
    for (const r of p.houseRules) {
      add(r.label, `${v.id}.houseRules`);
      for (const o of r.options) add(o.label, `${v.id}.houseRules.${r.id}`);
    }
  }
  for (const e of CATALOGUE) add(e.blurb, 'CATALOGUE.blurb');
  for (const r of REGIONS) add(r, 'roster.REGIONS');
  for (const g of Object.values(GAME_LENGTHS)) add(g.label, 'GAME_LENGTHS');
  for (const w of Object.values(WIND_NAMES)) add(w, 'WIND_NAMES');
  for (const l of Object.values(LINES)) add(l, 'matchLines.LINES');
  for (const k of DYNAMIC_KEYS) add(k, 'i18n/dynamic');
  for (const r of Object.values(SPECIAL_ROUNDS)) add(r.name, 'SPECIAL_ROUNDS'), add(r.rule, 'SPECIAL_ROUNDS');
  for (const c of [...SMALL_CARD, ...BIG_CARD]) add(c.how, 'special.CARD');
  return out;
}

const allKeys = new Map<string, string>([...dataKeys(), ...found.keys]);
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('i18n string tables', () => {
  it('finds the wrapped strings', () => {
    expect(found.keys.size).toBeGreaterThan(1000);
    expect(found.dynamic).toEqual([]);
  });

  it('every language has every string', () => {
    const missing: Record<string, string[]> = {};
    for (const l of COLUMNS) {
      const d = dictionary(l);
      missing[l] = [...allKeys.keys()].filter((k) => !d.has(k) && !ENGLISH_OK.has(k));
    }
    if (process.env.I18N_DUMP) {
      const rows = [...allKeys].filter(([k]) => COLUMNS.some((l) => missing[l].includes(k)));
      writeJson(process.env.I18N_DUMP, rows.map(([k, where]) => ({ k, where, one: found.plurals.get(k) })));
    }
    for (const l of COLUMNS) expect(missing[l].slice(0, 20), `${l}: ${missing[l].length} missing`).toEqual([]);
  });

  it('keeps every placeholder, and each key appears once', () => {
    const seen = new Set<string>();
    const bad: string[] = [];
    for (const table of TABLES)
      for (const row of table) {
        const key = Array.isArray(row[0]) ? row[0][1] : row[0];
        if (seen.has(key)) bad.push(`duplicate: ${key}`);
        seen.add(key);
        const want = placeholders(key).filter((p) => p !== 'n' || !Array.isArray(row[0]));
        for (const cell of row.slice(1)) {
          const forms = typeof cell === 'string' ? [cell] : Object.values(cell);
          for (const f of forms) {
            if (f === '') continue;
            const got = new Set(placeholders(f));
            // Tile names may use {cn}, the Chinese numeral, in place of {n}.
            for (const p of want) if (!got.has(p) && !(p === 'n' && got.has('cn'))) bad.push(`${key} -> ${f} (lost {${p}})`);
            for (const p of got) if (!placeholders(key).includes(p) && p !== 'cn') bad.push(`${key} -> ${f} (unknown {${p}})`);
          }
        }
      }
    expect(bad).toEqual([]);
  });

  it('plural keys are plural rows', () => {
    const rows = new Map<string, unknown>();
    for (const table of TABLES) for (const row of table) rows.set(Array.isArray(row[0]) ? row[0][1] : row[0], row[0]);
    for (const [other, one] of found.plurals) {
      const key = rows.get(other);
      if (key !== undefined) expect(key, other).toEqual([one, other]);
    }
  });
});

describe('tr and trn', () => {
  it('fills placeholders and falls back to English', () => {
    useLang('en');
    expect(tr('Hello {name}, {n} left', { name: 'Ana', n: 3 })).toBe('Hello Ana, 3 left');
    expect(tr('No such {thing}')).toBe('No such {thing}');
    useLang('ja');
    expect(tr('A string nobody translated {x}', { x: 1 })).toBe('A string nobody translated 1');
    useLang('en');
  });

  it('uses each language’s plural rules', () => {
    useLang('en');
    expect(trn(1, '{n} game', '{n} games')).toBe('1 game');
    expect(trn(2, '{n} game', '{n} games')).toBe('2 games');
    for (const l of COLUMNS) {
      useLang(l);
      for (const n of [3, 11, 100]) expect(trn(n, '{n} game', '{n} games')).toContain(String(n));
      expect(trn(1, '{n} game', '{n} games')).not.toBe('1 game');
    }
    useLang('ja');
    expect(trn(1, '{n} game', '{n} games')).toBe('1局');
    expect(trn(5, '{n} game', '{n} games')).toBe('5局');
    useLang('ar');
    // Arabic has six plural forms: one and two are said in words, 3–10 and 11–99 take different noun forms.
    expect(trn(1, '{n} game', '{n} games')).toBe('مباراة واحدة');
    expect(trn(2, '{n} game', '{n} games')).toBe('مباراتان');
    expect(trn(5, '{n} game', '{n} games')).toBe('5 مباريات');
    expect(trn(11, '{n} game', '{n} games')).toBe('11 مباراة');
    useLang('zh-Hant');
    expect(tr('{n} Character', { n: 3, cn: '三' })).toBe('三萬');
    expect(tr('Hand {n} / {total}', { n: 2, total: 8 })).toBe('第 2 / 8 局');
    useLang('en');
  });

  it('matches browser languages', () => {
    expect(matchLang('zh-CN')).toBe('zh-Hans');
    expect(matchLang('zh-TW')).toBe('zh-Hant');
    expect(matchLang('zh-Hant-HK')).toBe('zh-Hant');
    expect(matchLang('ja-JP')).toBe('ja');
    expect(matchLang('ar-AE')).toBe('ar');
    expect(matchLang('hi-IN')).toBe('hi');
    expect(matchLang('fr-FR')).toBe('en');
    expect(matchLang(undefined)).toBe('en');
    expect(LANGUAGES.map((x) => x.id)).toEqual(['en', ...COLUMNS]);
  });

  it('sets <html lang> and right-to-left for Arabic', () => {
    const root = { lang: '', dir: '' };
    const g = globalThis as { document?: unknown };
    const had = g.document;
    g.document = { documentElement: root };
    try {
      useLang('ar');
      expect(root).toEqual({ lang: 'ar', dir: 'rtl' });
      expect(isRtl()).toBe(true);
      useLang('ja');
      expect(root).toEqual({ lang: 'ja', dir: 'ltr' });
      expect(isRtl()).toBe(false);
      useLang('en');
      expect(root).toEqual({ lang: 'en', dir: 'ltr' });
    } finally {
      g.document = had;
    }
    expect(lang()).toBe('en');
  });

  it('joins lists in the language', () => {
    useLang('en');
    expect(andList(['A', 'B', 'C'])).toBe('A, B, and C');
    useLang('ja' as Lang);
    expect(andList(['A', 'B'])).not.toBe('');
    useLang('en');
  });
});
