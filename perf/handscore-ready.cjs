// Screenshot the hand-score card for a hand one discard from ready (14 tiles on your turn):
//   node perf/handscore-ready.cjs URL OUTDIR variation W H "hand spec"
const pw = require('/opt/node-tools/node_modules/playwright');
const [url, out, variation, W = '1440', H = '900', spec = '1m 2m 3m 4m 5m 6m 7p 8p 9p Rd Rd Rd 5s 9s'] = process.argv.slice(2);
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await page.addInitScript(() => { localStorage.setItem('jongclub.quality.v1', 'low'); localStorage.setItem('jongclub.onboarded', '1'); });
  await page.goto(url, { timeout: 300000, waitUntil: 'commit' });
  await page.waitForFunction(() => window.jongclub, null, { timeout: 300000 });
  await page.evaluate((variation) => { const app = window.jongclub; app.settings.autoDraw = true; app.settings.speed = 'minimal'; app.startMatch({ ...app.lastConfig, variation, hints: false, timer: 0, pace: 'untimed' }); }, variation);
  for (let i = 0; i < 200; i++) {
    const mine = await page.evaluate(() => { const m = window.jongclub.match; const p = m?.game.state.phase; return !!(p && p.kind === 'turn' && p.seat === m.me && m.table.interactive.size > 0); });
    if (mine) break;
    await page.evaluate(() => { for (const b of document.querySelectorAll('#hud button, .overlay button')) if (/^(Pass|Skip|Done|Continue|OK|Keep these|Start|Use JongBot)/i.test(b.textContent.trim())) b.click(); });
    await page.waitForTimeout(1000);
  }
  const KIND = (t) => { const m = t.match(/^(\d)([mps])$/); if (m) return { m: 0, p: 9, s: 18 }[m[2]] + +m[1] - 1; return { E: 27, S: 28, W: 29, N: 30, Rd: 31, Gd: 32, Wd: 33 }[t]; };
  const kinds = spec.split(' ').map(KIND);
  await page.evaluate((kinds) => { const m = window.jongclub.match; const pl = m.game.players[m.me]; pl.melds = []; pl.hand.forEach((t, i) => (t.kind = kinds[i % kinds.length])); m.game.state.phase.drawn = pl.hand[pl.hand.length - 1]; }, kinds);
  await page.evaluate(() => { const el = document.querySelector('.seat-0'); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(800);
  console.log('PLATE', await page.evaluate(() => document.querySelector('.seat-river')?.innerText));
  await page.screenshot({ path: `${out}/${variation}-ready-plate.png`, timeout: 180000 });
  await page.evaluate(() => document.querySelector('.seat-river')?.remove());
  await page.evaluate(() => document.querySelector('.calc-btn').click());
  await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector('.sc-mine').click());
  await page.waitForTimeout(800);
  console.log('CALC', await page.evaluate(() => document.querySelector('.sc-panel .sg-body')?.innerText.slice(0, 600)));
  await page.screenshot({ path: `${out}/${variation}-ready-calc.png`, timeout: 180000 });
  await browser.close();
})();
