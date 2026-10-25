const pw = require('/opt/node-tools/node_modules/playwright');
const [url] = process.argv.slice(2);
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 300 } });
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.jongclub, null, { timeout: 120000 });
  await page.evaluate(() => {
    const r = window.jongclub.table.renderer; window.__seen = new Set(); window.__log = [];
    const t0 = performance.now();
    setInterval(() => { for (const p of r.info.programs) if (!window.__seen.has(p.id)) { window.__seen.add(p.id); window.__log.push(`${((performance.now()-t0)/1000).toFixed(1)}s ${p.name} ${p.cacheKey.slice(0,80)}`); } }, 200);
  });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { window.__log.push('--- match start'); window.jongclub.startMatch({ ...window.jongclub.lastConfig, timer: 0, pace: 'untimed' }); });
  let mine = 0;
  for (let i = 0; i < 1200 && mine < 2; i++) {
    const st = await page.evaluate(() => { const m = window.jongclub.match; if (!m) return ''; const ph = m.game.state.phase;
      const pass = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Pass' && b.offsetParent); if (pass) { pass.click(); return 'pass'; }
      if (ph.kind === 'turn' && ph.seat === m.me && m.table.interactive.size) { const id = [...m.table.interactive][0]; window.__log.push('--- my discard'); m.table.onTileClick(id); m.table.onTileClick(id); return 'disc'; } return ''; });
    if (st === 'disc') mine++;
    await page.waitForTimeout(200);
  }
  console.log((await page.evaluate(() => window.__log)).join('\n'));
  await browser.close();
})();
