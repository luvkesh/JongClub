// Turns the single-file build into an Artifact page body: the host adds
// its own doctype/html/head/body skeleton, so strip ours and keep the rest.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('dist-artifact/index.html', 'utf8');
const head = src.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charset[^>]*>/, '').replace(/<meta name="viewport"[^>]*>/, '');
const body = src.match(/<body>([\s\S]*?)<\/body>/)[1];
const page = `${head.trim()}\n${body.trim()}\n`;
// The preview host treats a page as a code-review page (and refuses it as too large) when an `id=`
// is followed by 2048+ characters with no whitespace. Fail here rather than at publish time.
for (const m of page.matchAll(/(?<![\w-])id\s*=/gi)) {
  const run = page.slice(m.index + m[0].length).match(/^\S*/)[0].length;
  if (run >= 2048) {
    console.error(`to-artifact: an id= at ${m.index} runs ${run} characters without a break: ${page.slice(m.index, m.index + 80)}`);
    process.exit(1);
  }
}
writeFileSync('dist-artifact/jongclub.html', page);
console.log('wrote dist-artifact/jongclub.html', (head.length + body.length) / 1024 | 0, 'KB');
