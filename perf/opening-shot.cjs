// The opening ceremony in frames: node perf/opening-shot.cjs URL OUTPREFIX variation [w h] [frames] [stepMs]
const pw = require('/opt/node-tools/node_modules/playwright');
const [url, out, variation, W = '1024', H = '700', N = '14', STEP = '900'] = process.argv.slice(2);
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text().slice(0, 200)));
  await page.addInitScript(() => localStorage.setItem('jongclub.quality.v1', 'low'));
  await page.goto(url, { timeout: 300000, waitUntil: 'commit' });
  await page.waitForFunction(() => window.jongclub, null, { timeout: 300000 });
  await page.waitForTimeout(3000);
  await page.evaluate(([variation, slow]) => {
    const app = window.jongclub;
    app.settings.autoDraw = true; app.settings.speed = 'classic'; window.__openingSlow = slow;
    app.startMatch({ ...app.lastConfig, variation, houseRules: {}, timer: 0, pace: 'untimed' });
  }, [variation, +(process.env.SLOW || 1)]);
  const t0 = Date.now();
  for (let i = 0; i < +N; i++) {
    await page.waitForTimeout(+STEP);
    // Press Roll / Continue once the card is waiting on you (after this frame's screenshot below).
    const info = await page.evaluate(() => { const m = window.jongclub.match; const c = document.querySelector('.opening'); return { dealer: m?.game.state.round.dealerSeat, wb: m?.game.state.wallBreak && { ...m.game.state.wallBreak, throws: undefined }, card: c?.innerText.replace(/\n/g, ' | ') }; });
    console.log(((Date.now() - t0) / 1000).toFixed(1), JSON.stringify(info));
    await page.screenshot({ path: `${out}-${String(i).padStart(2, '0')}.png` });
    await page.evaluate(() => document.querySelector('.op-act')?.click());
  }
  await browser.close();
})();
