const pw = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [url, out] = process.argv.slice(2);
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  await page.goto(url);
  await page.waitForFunction(() => window.jongclub, null, { timeout: 120000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.jongclub.startMatch({ ...window.jongclub.lastConfig, timer: 0, pace: 'untimed' }));
  await page.waitForFunction(() => { const m = window.jongclub.match; const p = m?.game.state.phase; return p && p.kind === 'turn' && p.seat === m.me && m.table.interactive.size; }, null, { timeout: 300000 });
  await page.waitForTimeout(2000);
  await browser.startTracing(page, { path: out, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'gpu', 'cc', 'viz', 'blink', 'toplevel', 'v8'] });
  await page.waitForTimeout(5000);
  await browser.stopTracing();
  await browser.close();
})();
