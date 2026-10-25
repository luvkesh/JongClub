// Resolution check: requested pixel ratio and face-texture detail per device profile.
// usage: node perf/sharp.cjs URL profile   (ipad | iphone | laptop)
const pw = require('/opt/node-tools/node_modules/playwright');
const [url, prof = 'ipad'] = process.argv.slice(2);
const P = {
  ipad: { w: 1366, h: 1024, dpr: 2, ua: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148', mobile: true },
  iphone: { w: 932, h: 430, dpr: 3, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148', mobile: true },
  laptop: { w: 1470, h: 956, dpr: 2 },
}[prof];
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: P.w, height: P.h }, deviceScaleFactor: P.dpr, isMobile: !!P.mobile, hasTouch: !!P.mobile, userAgent: P.ua });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  // Pretend to be an Apple GPU on a 6-core phone, as Safari reports it (the cloud has software GL).
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 6 });
    const gp = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function (p) { if (p === 0x9246 || p === 0x1f01) return 'Apple GPU'; return gp.call(this, p); };
  });
  await page.goto(url);
  await page.waitForFunction(() => window.jongclub, null, { timeout: 300000 });
  await page.evaluate(() => {
    const t = window.jongclub.table, r = t.renderer, set = r.setPixelRatio.bind(r);
    window.__asked = []; r.setPixelRatio = (v) => { window.__asked.push(+v.toFixed(2)); set(0.08); }; t.resize();
    t.scene.traverse((o) => { if (o.isLight && o.shadow) { o.shadow.mapSize.set(128, 128); o.shadow.map?.dispose(); o.shadow.map = null; } });
    window.jongclub.settings.autoDraw = true;
    window.jongclub.startMatch({ ...window.jongclub.lastConfig, timer: 0, pace: 'untimed' });
  });
  await page.waitForFunction(() => { const m = window.jongclub.match; const p = m?.game.state.phase; return p && p.kind === 'turn' && p.seat === m.me && m.table.interactive.size; }, null, { timeout: 900000 });
  await page.waitForTimeout(12000);
  const out = await page.evaluate(() => {
    const t = window.jongclub.table; const hand = new Set([...t.tiles.values()].filter((x) => x.loc === 'hand').map((x) => `${x.kind}:${x.red ? 'r' : ''}`));
    const faces = [...t.faceTex.entries()].map(([k, x]) => ({ k, s: x.userData.scale, w: x.image.width, a: x.anisotropy, hand: hand.has(k) }));
    return { tier: t.q.tier, prMax: t.prMax, asked: window.__asked.slice(-3), handFaces: faces.filter((f) => f.hand).map((f) => `${f.s}/${f.w}px/a${f.a}`), otherScales: [...new Set(faces.filter((f) => !f.hand).map((f) => f.s))], nFaces: faces.length };
  });
  console.log(prof, JSON.stringify(out));
  // Page pinch-zoom: emulate visualViewport.scale = 3 and resize.
  const z = await page.evaluate(async () => {
    Object.defineProperty(window.visualViewport, 'scale', { get: () => 3, configurable: true });
    window.visualViewport.dispatchEvent(new Event('resize'));
    await new Promise((r) => setTimeout(r, 400));
    return window.__asked.slice(-1)[0];
  });
  console.log(prof, 'page zoom 3x -> pixel ratio', z);
  await browser.close();
})();
