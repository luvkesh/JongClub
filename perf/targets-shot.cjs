// Screenshot the target help: node perf/targets-shot.cjs URL OUT variation [houseRulesJSON] [discards] [w h]
const pw = require('/opt/node-tools/node_modules/playwright');
const [url, out, variation, house = '{}', N = '6', W = '1180', H = '760'] = process.argv.slice(2);
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text().slice(0, 200)));
  await page.addInitScript(() => localStorage.setItem('jongclub.quality.v1', 'low'));
  await page.goto(url, { timeout: 300000, waitUntil: 'commit' });
  await page.waitForFunction(() => window.jongclub, null, { timeout: 300000 });
  await page.evaluate(([variation, house]) => {
    const app = window.jongclub;
    app.settings.autoDraw = true; app.settings.speed = 'minimal'; app.settings.groupSets = true;
    app.startMatch({ ...app.lastConfig, variation, houseRules: JSON.parse(house), hints: true, hintDepth: 'advanced', timer: 0, pace: 'untimed' });
  }, [variation, house]);
  for (let i = 0; i < 300; i++) {
    const st = await page.evaluate(() => { const m = window.jongclub.match; if (!m) return { n: -1 }; const p = m.game.state.phase; return { n: m.game.players[m.me].discards.length, mine: p && p.kind === 'turn' && p.seat === m.me && m.table.interactive.size > 0, ph: p?.kind }; });
    if (i % 5 === 0) console.log('progress', JSON.stringify(st));
    if (st.n >= +N && st.mine) break;
    if (st.mine) await page.evaluate(() => { const t = window.jongclub.match.table; const id = [...t.interactive].pop(); t.onTileClick?.(id); t.onTileClick?.(id); });
    else await page.evaluate(() => { for (const b of document.querySelectorAll('#hud button, .overlay button')) if (/^(Pass|Skip|Done|Continue|OK|Keep these|Start)/i.test(b.textContent.trim())) b.click(); });
    await page.waitForTimeout(1500);
  }
  await page.evaluate(() => { const b = document.querySelector('.bot-more'); b && b.click(); });
  await page.waitForTimeout(4000);
  const txt = await page.evaluate(() => ({ chips: [...document.querySelectorAll('.pp-chip')].map((x) => x.textContent), group: document.querySelector('.hand-tools .btn.on, [aria-pressed]')?.textContent, bot: document.querySelector('.jongbot')?.innerText.slice(0, 900), seats: [...document.querySelectorAll('.seat-pp')].map((x) => x.textContent) }));
  console.log(JSON.stringify(txt, null, 1));
  await page.screenshot({ path: `${out}.png` });
  await browser.close();
})();
