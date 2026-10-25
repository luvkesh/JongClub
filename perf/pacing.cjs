// Pacing check with drawing stubbed out (so rAF runs at the display rate): renders per second idle vs moving, shadow refreshes.
const pw = require('/opt/node-tools/node_modules/playwright');
const [url] = process.argv.slice(2);
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 300 } });
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.jongclub, null, { timeout: 120000 });
  await page.evaluate(() => { const t = window.jongclub.table; const r = t.renderer; window.__n = 0; window.__sh = 0; r.render = () => { window.__n++; if (r.shadowMap.needsUpdate) window.__sh++; r.shadowMap.needsUpdate = false; }; });
  const rate = async (label) => { const a = await page.evaluate(() => [window.__n, window.__sh, performance.now()]); await page.waitForTimeout(3000); const b = await page.evaluate(() => [window.__n, window.__sh, performance.now()]); const s = (b[2] - a[2]) / 1000; console.log(`${label.padEnd(26)} ${((b[0] - a[0]) / s).toFixed(0)} renders/s, ${((b[1] - a[1]) / s).toFixed(0)} shadow refreshes/s`); };
  await rate('home (orbit)');
  await page.evaluate(() => window.jongclub.startMatch({ ...window.jongclub.lastConfig, timer: 0, pace: 'untimed' }));
  await page.waitForTimeout(500);
  await rate('dealing');
  await page.waitForFunction(() => { const m = window.jongclub.match; const p = m?.game.state.phase; return p && p.kind === 'turn' && p.seat === m.me && m.table.interactive.size; }, null, { timeout: 300000 });
  await page.waitForTimeout(2500);
  await rate('your turn, table still');
  await page.mouse.move(100, 100); for (let i = 0; i < 30; i++) { await page.mouse.move(100 + i * 5, 150); await page.waitForTimeout(90); }
  console.log('(pointer moved for ~3s)'); 
  await page.evaluate(() => { const m = window.jongclub.match; const id = [...m.table.interactive][0]; m.table.onTileClick(id); m.table.onTileClick(id); });
  await rate('after your discard');
  await browser.close();
})();
