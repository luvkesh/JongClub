// Renders the Play for It / Club 3D objects (featicons.js) to PNG.
//   mkdir /tmp/fi && cd /tmp/fi && npm i three@0.169.0 && cp <website>/tools/featicons.{html,js} .
//   python3 -m http.server 8766   (in /tmp/fi), then
//   node website/tools/featicons.mjs <outDir> [key,key...]
// Then downscale each to 320px webp into website/assets/feat/.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const [out = 'feat-out', only = 'coins,calendar,stamp,tag,chart,lantern,trophy,people'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 400, height: 400 } });
await p.goto('http://127.0.0.1:8766/featicons.html');
await p.waitForFunction(() => window.featReady);
for (const k of only.split(',')) fs.writeFileSync(`${out}/${k}.png`, Buffer.from((await p.evaluate((k) => window.featIcon(k, 2), k)).split(',')[1], 'base64'));
await b.close();
