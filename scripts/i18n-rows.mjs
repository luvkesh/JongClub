// Loads every row of the UI string tables (src/i18n/strings/*.ts) with the file it came from.
// The tables only import types, so each file is transpiled on its own and evaluated.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export const LANGS = ['zh-Hans', 'zh-Hant', 'ja', 'ar', 'hi'];
const DIR = path.resolve('src/i18n/strings');

export async function loadRows() {
  const rows = [];
  for (const f of fs.readdirSync(DIR).sort()) {
    if (!f.endsWith('.ts') || f === 'index.ts' || f === 'types.ts') continue;
    const src = fs.readFileSync(path.join(DIR, f), 'utf8');
    const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const mod = { exports: {} };
    new Function('module', 'exports', 'require', js)(mod, mod.exports, () => ({}));
    for (const table of Object.values(mod.exports)) {
      if (!Array.isArray(table)) continue;
      for (const r of table) {
        const en = Array.isArray(r[0]) ? r[0][1] : r[0];
        rows.push({ id: rows.length, file: f, en, key: r[0], cells: r });
      }
    }
  }
  return rows;
}
