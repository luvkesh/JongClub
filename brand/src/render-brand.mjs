// Renders brand/*.svg to PNG sizes and favicon.ico. Run: node brand/src/render-brand.mjs
// Needs Playwright (Chromium) and ImageMagick `convert` for the .ico.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const B = new URL('..', import.meta.url).pathname;
const jobs = [
  ['jongclub-app-icon.svg', [16, 32, 48, 180, 192, 512, 1024]],
  ['jongclub-tile.svg', [16, 32, 48, 64, 128]],
  ['jongclub-mark.svg', [128, 256, 512]],
  ['jongclub-mark-mono.svg', [256]],
];
const b = await chromium.launch();
const p = await b.newPage({ deviceScaleFactor: 1 });
for (const [svg, sizes] of jobs) {
  const src = 'data:image/svg+xml;base64,' + fs.readFileSync(B + svg).toString('base64');
  for (const s of sizes) {
    await p.setViewportSize({ width: s, height: s });
    await p.setContent(`<style>html,body{margin:0;background:transparent}</style><img src="${src}" width=${s} height=${s}>`);
    await p.screenshot({ path: `${B}png/${svg.replace('.svg', '')}-${s}.png`, omitBackground: true });
  }
}
// wordmark/lockups at 2x their natural height
for (const [svg, h] of [['jongclub-wordmark.svg', 96], ['jongclub-lockup.svg', 240], ['jongclub-lockup-stacked.svg', 1400]]) {
  const txt = fs.readFileSync(B + svg, 'utf8');
  const [, , w0, h0] = txt.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  const w = Math.round((w0 / h0) * h);
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(`<style>html,body{margin:0;background:transparent}</style><img src="data:image/svg+xml;base64,${Buffer.from(txt).toString('base64')}" width=${w} height=${h}>`);
  await p.screenshot({ path: `${B}png/${svg.replace('.svg', '')}.png`, omitBackground: true });
}
await b.close();
execFileSync('convert', [16, 32, 48].map(s => `${B}png/jongclub-tile-${s}.png`).concat(`${B}favicon.ico`));
console.log('rendered');
