// Renders the website's companion portraits through the game's dev server.
//   npx vite --port 4430   (in the game folder), then
//   node website/tools/companions.mjs <outDir> [name:salt,...]
// Writes <name>.png (640 square, transparent) and <name>.json (the look).
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';

/** Salts chosen so each companion wears a fitting set of table extras (see companions.html). */
export const CAST = { Mei: 13, Rex: 30, Hiro: 12, Lucky: 33, Amara: 1 };
const [out, only = '', size = '640'] = process.argv.slice(2);
const cast = only ? Object.fromEntries(only.split(',').map((x) => x.split(':')).map(([n, s]) => [n, +(s ?? CAST[n] ?? 1)])) : CAST;
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 400, height: 400 } });
p.setDefaultTimeout(900000);
p.on('pageerror', (e) => console.log('ERR', e.message));
p.on('console', (m) => m.type() === 'error' && console.log('console', m.text()));
for (const [name, salt] of Object.entries(cast)) {
  const t0 = Date.now();
  let res;
  for (let tries = 0; !res; tries++) {
    try {
      await p.goto(`http://localhost:4430/website/tools/companions.html?salt=${salt}`);
      res = await p.evaluate(async ([name, size]) => {
        const m = await import('/website/tools/companions.ts');
        return { url: m.portrait(name, size, 2), spec: m.tableLook(name) };
      }, [name, +size]);
    } catch (e) {
      // The dev server reloads the page when other files change; start again.
      if (tries > 3) throw e;
      console.log('retry', name, e.message.split('\n')[0]);
    }
  }
  const file = name.toLowerCase();
  fs.writeFileSync(`${out}/${file}.png`, Buffer.from(res.url.split(',')[1], 'base64'));
  fs.writeFileSync(`${out}/${file}.json`, JSON.stringify({ salt, ...res.spec }, null, 1));
  console.log(name, salt, JSON.stringify(res.spec), ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
await b.close();
