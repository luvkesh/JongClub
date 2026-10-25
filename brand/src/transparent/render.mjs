import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
// node render2.mjs in.svg out.png width [bg]  (keeps aspect)
const [inp, out, width, bg] = process.argv.slice(2);
const svg = fs.readFileSync(inp, 'utf8').replace(/<\?xml[^>]*>/, '');
const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const W = +width, H = Math.round(W * vb[3] / vb[2]);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: Math.min(W, 4096), height: Math.min(H, 4096) }, deviceScaleFactor: W > 4096 ? W / 4096 : 1 });
const VW = Math.min(W, 4096), VH = Math.round(VW * vb[3] / vb[2]);
await p.setViewportSize({ width: VW, height: VH });
await p.setContent(`<html><body style="margin:0;background:${bg || 'transparent'}">${svg.replace(/(<svg[^>]*?)\swidth="[\d.]+" height="[\d.]+"/, `$1 width="${VW}" height="${VH}"`)}</body></html>`);
await p.waitForTimeout(300);
await p.screenshot({ path: out, omitBackground: !bg, clip: { x: 0, y: 0, width: VW, height: VH } });
await b.close();
