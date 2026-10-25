// Renders the Play screen's mode icons to sprite sheets in src/ui/icons/.
// usage: (vite dev server on :5199) node scripts/mode-icons/build.mjs
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const N = Number(process.env.FRAMES ?? 24);
const out = process.env.OUT ?? '/tmp/claude-0/icon-frames';
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
p.on('console', (m) => console.log('page:', m.text()));
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto('http://localhost:5199/scripts/mode-icons/index.html');
await p.waitForFunction(() => window.ready, null, { timeout: 120000 });
const names = await p.evaluate(() => window.iconNames);
const only = process.env.ONLY?.split(',');
for (const name of names) {
  if (only && !only.includes(name)) continue;
  for (let i = 0; i < N; i++) {
    const url = await p.evaluate(([n, i, N]) => window.renderFrame(n, i, N), [name, i, N]);
    fs.writeFileSync(`${out}/${name}-${String(i).padStart(2, '0')}.png`, Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log('rendered', name);
}
await b.close();
