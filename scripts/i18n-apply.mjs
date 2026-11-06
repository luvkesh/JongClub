#!/usr/bin/env node
// Applies accepted translation fixes to src/i18n/strings/*.ts.
//
//   node scripts/i18n-apply.mjs reviews/i18n/accepted.json
//
// accepted.json: [{ file, en, lang, current, suggested }]. Each fix is placed by
// syntax (the row whose English key is `en`, the column for `lang`) and only if
// that cell still reads `current`, so a string another thread changed meanwhile
// is skipped and reported instead of overwritten. Plural cells are skipped.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { LANGS } from './i18n-rows.mjs';

const fixes = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const byFile = new Map();
for (const f of fixes) byFile.set(f.file, [...(byFile.get(f.file) || []), f]);
const quote = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
let applied = 0;
const skipped = [];

for (const [file, list] of byFile) {
  const p = path.resolve('src/i18n/strings', file);
  let src = fs.readFileSync(p, 'utf8');
  const sf = ts.createSourceFile(p, src, ts.ScriptTarget.ES2020, true);
  const edits = [];
  const want = new Map(list.map((f) => [`${f.en}\u0000${LANGS.indexOf(f.lang) + 1}`, f]));
  const visit = (n) => {
    if (ts.isArrayLiteralExpression(n) && n.elements.length === 6) {
      const k = n.elements[0];
      const en = ts.isStringLiteralLike(k) ? k.text
        : ts.isArrayLiteralExpression(k) && ts.isStringLiteralLike(k.elements[1]) ? k.elements[1].text : null;
      if (en != null) {
        for (let col = 1; col <= 5; col++) {
          const f = want.get(`${en}\u0000${col}`);
          if (!f) continue;
          const cell = n.elements[col];
          if (!ts.isStringLiteralLike(cell)) { skipped.push({ ...f, why: 'plural or non-literal cell' }); }
          else if (cell.text !== f.current) { skipped.push({ ...f, why: `cell now reads ${cell.text}` }); }
          else edits.push({ start: cell.getStart(sf), end: cell.getEnd(), text: quote(f.suggested), f });
          want.delete(`${en}\u0000${col}`);
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  for (const f of want.values()) skipped.push({ ...f, why: 'row not found' });
  for (const e of edits.sort((a, b) => b.start - a.start)) src = src.slice(0, e.start) + e.text + src.slice(e.end);
  fs.writeFileSync(p, src);
  applied += edits.length;
}
console.log(`applied ${applied}, skipped ${skipped.length}`);
for (const s of skipped) console.log(`  skip ${s.lang} ${s.file} "${s.en}": ${s.why}`);
