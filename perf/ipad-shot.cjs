// Screenshot the table on an iPad-sized Safari view (play at low resolution, then redraw full for the shot).
// usage: node perf/ipad-shot.cjs URL OUTPREFIX [variation] [split on|off|auto] [w h dpr]
const pw = require('/opt/node-tools/node_modules/playwright');
const [url, out, variation = 'taiwanese', split = 'auto', W = '1210', H = '700', D = '2'] = process.argv.slice(2);
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: +D, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await page.addInitScript((split) => {
    localStorage.setItem('jongclub.split.v1', split);
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 6 });
    const gp = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function (p) { if (p === 0x9246 || p === 0x1f01) return 'Apple GPU'; return gp.call(this, p); };
  }, split);
  await page.goto(url);
  await page.waitForFunction(() => window.jongclub, null, { timeout: 300000 });
  await page.evaluate((variation) => {
    const app = window.jongclub, t = app.table, r = t.renderer, set = r.setPixelRatio.bind(r);
    window.__want = []; window.__low = true;
    r.setPixelRatio = (v) => { window.__want.push(v); set(window.__low ? 0.12 : v); }; t.resize();
    app.settings.autoDraw = true; app.settings.speed = 'minimal';
    app.startMatch({ ...app.lastConfig, variation, timer: 3, pace: 'untimed' });
  }, variation);
  const N = +(process.env.DISCARDS || 18);
  for (let i = 0; i < 400; i++) {
    const st = await page.evaluate(() => { const m = window.jongclub.match; if (!m) return { n: -1 }; const p = m.game.state.phase; return { n: [...m.table.tiles.values()].filter((x) => x.loc === 'discard').length, mine: p && p.kind === 'turn' && p.seat === m.me && m.table.interactive.size > 0, ph: p?.kind }; });
    if (i % 6 === 0) console.log('progress', JSON.stringify(st));
    if (st.n >= N && st.mine) break;
    if (st.mine) await page.evaluate(() => { const t = window.jongclub.match.table; const id = [...t.interactive].pop(); t.onTileClick?.(id); t.onTileClick?.(id); });
    else await page.evaluate(() => { for (const b of document.querySelectorAll('#hud button')) if (/^(Pass|Skip)$/i.test(b.textContent.trim())) b.click(); });
    await page.waitForTimeout(3000);
  }
  if (process.env.SET || process.env.ENV) await page.evaluate(([set, env]) => { const t = window.jongclub.table; if (set) t.setTileSet(set); if (env) t.setEnvironment(env); }, [process.env.SET, process.env.ENV]);
  await page.evaluate(() => { window.__low = false; window.jongclub.table.resize(); window.jongclub.table.wake?.(3000); });
  await page.waitForTimeout(25000);
  if (process.env.FORCE_GOV) {
    const g = await page.evaluate(async () => {
      const t = window.jongclub.table; t.governor.level = 4; t.applyDensity();
      const out = { stillBefore: window.__want.slice(-1)[0] };
      t.wake(3000); await new Promise((r) => setTimeout(r, 1500)); out.moving = window.__want.slice(-1)[0];
      await new Promise((r) => setTimeout(r, 4000)); out.stillAfter = window.__want.slice(-1)[0];
      t.governor.level = 0; t.applyDensity();
      return out;
    });
    console.log('governor', JSON.stringify(g));
  }
  const info = await page.evaluate(() => { const t = window.jongclub.table; return { tier: t.q.tier, pr: t.renderer.getPixelRatio(), split: t.splitView, faces: [...new Set([...t.faceTex.values()].map((x) => x.image.width))] }; });
  console.log(JSON.stringify(info));
  await page.screenshot({ path: `${out}.png`, timeout: 600000 });
  await browser.close();
})();
