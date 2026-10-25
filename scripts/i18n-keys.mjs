// Finds every UI string the code passes to tr() and trn() (src/i18n): the
// first argument of tr(), and the singular and plural arguments of trn().
// Used by test/i18n.test.ts; run `node scripts/i18n-keys.mjs` to list them.

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Write data as JSON (the test's I18N_DUMP=path lists strings still to translate). */
export function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 1));
}

/** All .ts files under a directory. */
export function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (p.endsWith('.ts') && !p.endsWith('.d.ts') && !p.endsWith('.gen.ts')) out.push(p);
  }
  return out;
}

/** Skip a string or template literal starting at i; returns the index after it. */
function skipString(src, i) {
  const q = src[i];
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') j += 2;
    else if (q === '`' && c === '$' && src[j + 1] === '{') j = skipBalanced(src, j + 1);
    else if (c === q) return j + 1;
    else j++;
  }
  return j;
}

/** Skip a bracketed expression starting at the opening bracket at i. */
function skipBalanced(src, i) {
  let depth = 0;
  let j = i;
  while (j < src.length) {
    const c = src[j];
    if (c === "'" || c === '"' || c === '`') {
      j = skipString(src, j);
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) return j + 1;
    }
    j++;
  }
  return j;
}

/** Split a call's arguments (src from just after the opening paren). Returns [start, end] ranges. */
function callArgs(src, i) {
  const args = [];
  let start = i;
  let j = i;
  while (j < src.length) {
    const c = src[j];
    if (c === "'" || c === '"' || c === '`') {
      j = skipString(src, j);
      continue;
    }
    if (c === '(' || c === '[' || c === '{') {
      j = skipBalanced(src, j);
      continue;
    }
    if (c === ',' || c === ')') {
      args.push([start, j]);
      if (c === ')') break;
      start = j + 1;
    }
    j++;
  }
  return args;
}

/** Blank out comments (keeping offsets and line numbers), leaving strings alone. */
function stripComments(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      const end = skipString(src, i);
      out += src.slice(i, end);
      i = end;
    } else if (c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      const stop = end < 0 ? src.length : end;
      out += ' '.repeat(stop - i);
      i = stop;
    } else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? src.length : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const unescape = (s) => s.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|.)/g, (_, e) => (e[0] === 'u' ? String.fromCodePoint(parseInt(e.replace(/[u{}]/g, ''), 16)) : e === 'n' ? '\n' : e));

/**
 * The string literals in a key argument (a plain literal, or the branches of a
 * ternary). Literals inside nested calls or objects belong to those, and a
 * template literal with ${} in a key is reported as `dynamic`.
 */
function literalsIn(src, a, b) {
  const lits = [];
  let dynamic = false;
  let j = a;
  while (j < b) {
    const c = src[j];
    if (c === "'" || c === '"' || c === '`') {
      const end = skipString(src, j);
      const body = src.slice(j + 1, end - 1);
      if (c === '`' && body.includes('${')) dynamic = true;
      else lits.push(unescape(body));
      j = end;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') {
      // Parentheses group ternary branches; anything else (calls, objects, indexes) is not a key.
      const end = skipBalanced(src, j);
      const call = /[\w\]\)]\s*$/.test(src.slice(a, j));
      if (c === '(' && !call) {
        const inner = literalsIn(src, j + 1, end - 1);
        lits.push(...inner.lits);
        dynamic ||= inner.dynamic;
      }
      j = end;
      continue;
    }
    j++;
  }
  return { lits, dynamic };
}

/**
 * Every key in the files: `keys` (tr and the plural form of trn), `plurals`
 * (trn's [one, other] pairs) and `dynamic` (file:line of template-literal keys).
 */
export function extractKeys(files, root = process.cwd()) {
  const keys = new Map();
  const plurals = new Map();
  const dynamic = [];
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    const re = /(?<![\w.$])(trn?)\(/g;
    let m;
    while ((m = re.exec(src))) {
      if (/function\s*$/.test(src.slice(Math.max(0, m.index - 20), m.index))) continue;
      const args = callArgs(src, m.index + m[0].length);
      const where = `${relative(root, f)}:${src.slice(0, m.index).split('\n').length}`;
      const keyArgs = m[1] === 'tr' ? args.slice(0, 1) : args.slice(1, 3);
      const found = keyArgs.map(([a, b]) => literalsIn(src, a, b));
      if (found.some((x) => x.dynamic)) dynamic.push(where);
      if (m[1] === 'trn' && found.length === 2 && found[0].lits.length === 1 && found[1].lits.length === 1) {
        plurals.set(found[1].lits[0], found[0].lits[0]);
        if (!keys.has(found[1].lits[0])) keys.set(found[1].lits[0], where);
      } else for (const x of found) for (const k of x.lits) if (k && !keys.has(k)) keys.set(k, where);
    }
  }
  return { keys, plurals, dynamic };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const { keys, plurals, dynamic } = extractKeys(sourceFiles(join(process.cwd(), 'src')));
  console.log(JSON.stringify({ count: keys.size, plurals: plurals.size, dynamic, keys: [...keys.keys()] }, null, 1));
}
