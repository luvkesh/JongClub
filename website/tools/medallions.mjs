// Renders the "And the Details" medallions through the game's dev server.
//   npx vite --port 4430   (in the game folder), then
//   node website/tools/medallions.mjs <outDir> [key,key...] [dpr]
// Writes <key>.png at 360*dpr; downscale to 360 webp for the website.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';

const KEYS = ['table', 'frame', 'avatar', 'accessory', 'winAnimation', 'tableEffect', 'sound'];
const [out, only = '', dprArg = '2'] = process.argv.slice(2);
const dpr = +dprArg;
const keys = only ? only.split(',') : KEYS;
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 400, height: 400 } });
p.setDefaultTimeout(900000);
p.on('pageerror', (e) => console.log('ERR', e.message));
p.on('console', (m) => m.type() === 'error' && console.log('console', m.text()));
await p.goto('http://localhost:4430/website/tools/medallions.html');
await p.evaluate(async () => (await import('/src/render/tileFaces.ts')).loadTileFonts());
for (const key of keys) {
  const t0 = Date.now();
  let url;
  for (let tries = 0; !url; tries++) {
    try {
      url = await p.evaluate(async ([key, dpr]) => (await import('/website/tools/medallions.ts')).medallion(key, 360, dpr), [key, dpr]);
    } catch (e) {
      // The dev server reloads the page when other files change; start again.
      if (tries > 3) throw e;
      console.log('retry', key, e.message.split('\n')[0]);
      await p.goto('http://localhost:4430/website/tools/medallions.html');
      await p.evaluate(async () => (await import('/src/render/tileFaces.ts')).loadTileFonts());
    }
  }
  fs.writeFileSync(`${out}/${key}.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log(key, ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
await b.close();
