// Skip mid-opening: node perf/opening-skip.cjs URL OUT variation [w h]
const pw = require('/opt/node-tools/node_modules/playwright');
const [url, out, variation, W = '1280', H = '800'] = process.argv.slice(2);
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: +W, height: +H } })).newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await page.addInitScript(() => localStorage.setItem('jongclub.quality.v1', 'low'));
  await page.goto(url, { timeout: 300000, waitUntil: 'commit' });
  await page.waitForFunction(() => window.jongclub, null, { timeout: 300000 });
  await page.evaluate((variation) => { const app = window.jongclub; app.settings.autoDraw = true; app.settings.speed = 'classic'; app.startMatch({ ...app.lastConfig, variation, houseRules: {}, timer: 0, pace: 'untimed' }); }, variation);
  await page.waitForSelector('.op-skip', { timeout: 120000 });
  const t = Date.now();
  await page.evaluate(() => document.querySelector('.op-skip').click());
  await page.waitForFunction(() => !document.querySelector('.opening') && window.jongclub.match.game.state.phase.kind !== 'turn' || window.jongclub.match.game.players.some((p) => p.discards.length), null, { timeout: 120000 });
  console.log('dealt and playing', (Date.now() - t) / 1000, 's after skip');
  const info = await page.evaluate(() => { const m = window.jongclub.match; return { opening: !!document.querySelector('.opening'), dealer: m.game.state.round.dealerSeat, wb: { ...m.game.state.wallBreak, throws: m.game.state.wallBreak.throws.map((x) => x.values.join('+')) } }; });
  console.log(JSON.stringify(info));
  await page.screenshot({ path: out });
  await browser.close();
})();
