// Frame interval while sitting at your turn, with parts of the scene switched off one at a time.
const pw = require('/opt/node-tools/node_modules/playwright');
const [url, br, w, h] = process.argv.slice(2);
(async () => {
  const browser = await pw[br || 'chromium'].launch({ args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: Number(w || 640), height: Number(h || 400) } });
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.jongclub, null, { timeout: 120000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.jongclub.startMatch({ ...window.jongclub.lastConfig, timer: 0, pace: 'untimed' }));
  await page.waitForFunction(() => { const m = window.jongclub.match; const p = m?.game.state.phase; return p && p.kind === 'turn' && p.seat === m.me && m.table.interactive.size; }, null, { timeout: 300000 });
  await page.waitForTimeout(3000);
  const measure = (label, setup) => page.evaluate(async ([label, setup]) => {
    const t = window.jongclub.table, r = t.renderer; (0, eval)(setup);
    await new Promise((res) => setTimeout(res, 1500));
    const ts = []; await new Promise((res) => { const s = performance.now(); const f = (x) => { ts.push(x); if (x - s < 8000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    const d = ts.slice(1).map((x, i) => x - ts[i]); const avg = d.reduce((a, b) => a + b, 0) / d.length;
    return `${label.padEnd(34)} ${avg.toFixed(0)} ms/frame (${d.length} frames) calls ${r.info.render.calls} pr ${r.getPixelRatio()}`;
  }, [label, setup]);
  const T = 'window.jongclub.table';
  const steps = JSON.parse(process.env.STEPS || '[]');
  console.log(await measure('baseline', ''));
  for (const [l, c] of steps) console.log(await measure(l, c));
  await browser.close();
})();
