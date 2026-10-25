const pw = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [url, out] = process.argv.slice(2);
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => localStorage.setItem('jongclub.quality.v1', 'medium'));
  await page.goto(url);
  await page.waitForFunction(() => window.jongclub, null, { timeout: 300000 });
  await page.waitForTimeout(Number(process.env.HOMEWAIT || 0));
  await page.evaluate(() => { const t = window.jongclub.table, r = t.renderer, set = r.setPixelRatio.bind(r); r.setPixelRatio = () => set(0.08); t.resize();
    window.jongclub.settings.autoDraw = true; window.jongclub.startMatch({ ...window.jongclub.lastConfig, timer: 0, pace: 'untimed' }); });
  await page.waitForFunction(() => { const m = window.jongclub.match; const p = m?.game.state.phase; return p && p.kind === 'turn' && p.seat === m.me && m.table.interactive.size; }, null, { timeout: 900000 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); await cdp.send('Profiler.start');
  let mine = 0;
  for (let g = 0; g < 3000 && mine < 3; g++) {
    const st = await page.evaluate(() => { const m = window.jongclub.match; const ph = m.game.state.phase;
      const pass = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Pass' && b.offsetParent); if (pass) { pass.click(); return 'pass'; }
      if (ph.kind === 'turn' && ph.seat === m.me && m.table.interactive.size) { const id = [...m.table.interactive][0]; m.table.onTileClick(id); m.table.onTileClick(id); return 'disc'; } return ''; });
    if (st === 'disc') mine++;
    await page.waitForTimeout(250);
  }
  const { profile } = await cdp.send('Profiler.stop'); fs.writeFileSync(out, JSON.stringify(profile));
  await browser.close();
})();
