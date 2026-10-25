// Device-profile pass: load time, memory, render CPU per frame, draw calls, long tasks, and the
// JS cost of discard / claim / win moments. usage: node perf/final.cjs URL profile [discards]
// profiles: desktop (1440x900 @2x, auto tier), laptop (1280x800 @1x, medium), phone (390x844 @3x, low, CPU x4)
const pw = require('/opt/node-tools/node_modules/playwright');
const [url, prof = 'desktop', nArg] = process.argv.slice(2);
const N = Number(nArg || 3);
const P = { desktop: { w: 1440, h: 900, dpr: 2, tier: 'high', thr: 1 }, laptop: { w: 1280, h: 800, dpr: 1, tier: 'medium', thr: 2 }, phone: { w: 844, h: 390, dpr: 3, tier: 'low', thr: 4, mobile: true } }[prof];
(async () => {
  const browser = await pw.chromium.launch({ dumpio: !!process.env.DUMPIO, args: ['--enable-unsafe-swiftshader', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const ctx = await browser.newContext({ viewport: { width: P.w, height: P.h }, deviceScaleFactor: P.dpr, isMobile: !!P.mobile, hasTouch: !!P.mobile });
  const page = await ctx.newPage();
  page.on('crash', () => console.log('CRASH'));
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await page.addInitScript((tier) => {
    try { localStorage.setItem('jongclub.quality.v1', tier); } catch {}
    window.__lt = []; window.__mark = 'load';
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push({ t: e.startTime, d: e.duration, m: window.__mark }); }).observe({ type: 'longtask', buffered: true }); } catch {}
  }, P.tier);
  const cdp = await ctx.newCDPSession(page);
  if (P.thr > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: P.thr });
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.jongclub, null, { timeout: 300000 });
  const tLoad = Date.now() - t0;
  // Software GL here: shrink the drawing buffer and shadow map so the GPU side is nearly free and what
  // remains is the CPU side (JS, three.js draw submission, DOM), which is what this harness can measure.
  if (!process.env.FULLGPU) await page.evaluate(() => {
    const t = window.jongclub.table, r = t.renderer, set = r.setPixelRatio.bind(r);
    r.setPixelRatio = () => set(0.08); t.resize();
    t.scene.traverse((o) => { if (o.isLight && o.shadow) { o.shadow.mapSize.set(128, 128); o.shadow.map?.dispose(); o.shadow.map = null; } });
  });
  await page.evaluate(() => {
    const t = window.jongclub.table, r = t.renderer, o = r.render.bind(r);
    window.__rf = []; r.render = (s, c) => { const a = performance.now(); o(s, c); window.__rf.push({ d: performance.now() - a, calls: r.info.render.calls, tri: r.info.render.triangles, m: window.__mark }); };
    const up = t.runFaceUpgrades?.bind(t); window.__up = [];
    if (up) t.runFaceUpgrades = (d) => { const a = performance.now(); up(d); window.__up.push({ d: performance.now() - a, m: window.__mark }); };
    window.__mark = 'home';
  });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { window.__mark = 'deal'; window.jongclub.settings.autoDraw = true; window.jongclub.startMatch({ ...window.jongclub.lastConfig, timer: 0, pace: 'untimed' }); });
  await page.waitForFunction(() => { const m = window.jongclub.match; const p = m?.game.state.phase; return p && p.kind === 'turn' && p.seat === m.me && m.table.interactive.size; }, null, { timeout: 900000 });
  const tFirstTurn = Date.now() - t0;
  await page.evaluate(() => { const m = window.jongclub.match; window.__ev = []; const o = m.onEvent.bind(m); m.onEvent = (e) => { const a = performance.now(); if (e.type === 'discard' || e.type === 'call') window.__mark = e.type; o(e); window.__ev.push({ type: e.type, d: performance.now() - a }); }; window.__mark = 'play'; });
  let mine = 0;
  for (let g = 0; g < 4000 && mine < N; g++) {
    const st = await page.evaluate(() => { const m = window.jongclub.match; if (!m) return ''; const ph = m.game.state.phase;
      const pass = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Pass' && b.offsetParent); if (pass) { pass.click(); return 'pass'; }
      if (ph.kind === 'handOver') return 'over';
      if (ph.kind === 'turn' && ph.seat === m.me && m.table.interactive.size) { const id = [...m.table.interactive][0]; window.__mark = 'discard'; m.table.onTileClick(id); m.table.onTileClick(id); return 'disc'; } return ph.kind; });
    if (st === 'disc') mine++; if (st === 'over') break;
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => { window.__mark = 'win'; window.jongclub.table.celebrateWin(0, { selfDrawn: true, camera: true }); });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(() => {
    const t = window.jongclub.table, r = t.renderer; let gpuBytes = 0, nTex = 0;
    const seen = new Set();
    t.scene.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) for (const k of ['map', 'emissiveMap', 'metalnessMap', 'roughnessMap', 'normalMap', 'bumpMap', 'alphaMap', 'aoMap']) { const tx = m[k]; if (tx && !seen.has(tx)) { seen.add(tx); const im = tx.image; if (im && im.width) { gpuBytes += im.width * im.height * 4 * (tx.generateMipmaps === false ? 1 : 1.33); nTex++; } } } });
    return { rf: window.__rf, lt: window.__lt, ev: window.__ev, up: window.__up, heap: performance.memory ? performance.memory.usedJSHeapSize : 0, gpuMB: gpuBytes / 1048576, nTex, texInfo: r.info.memory.textures, geo: r.info.memory.geometries, progs: r.info.programs.length, tier: t.quality, pr: r.getPixelRatio() };
  });
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const mx = (a) => (a.length ? Math.max(...a) : 0);
  const by = (m) => r.rf.filter((x) => x.m === m).map((x) => x.d);
  const lt = (m) => r.lt.filter((x) => x.m === m).map((x) => x.d);
  const ev = (t) => r.ev.filter((x) => x.type === t).map((x) => x.d);
  console.log(`== ${prof} (tier ${r.tier}, pixel ratio ${r.pr}, CPU x${P.thr}) discards ${mine}`);
  console.log(`load to app ${(tLoad / 1000).toFixed(1)}s; to first turn ${(tFirstTurn / 1000).toFixed(1)}s; JS heap ${(r.heap / 1048576).toFixed(0)} MB; scene textures ${r.nTex} ≈ ${r.gpuMB.toFixed(0)} MB GPU; three textures ${r.texInfo}, geometries ${r.geo}, programs ${r.progs}`);
  console.log(`draw calls ${med(r.rf.map((x) => x.calls))}, triangles ${med(r.rf.map((x) => x.tri))}`);
  for (const m of ['deal', 'play', 'discard', 'call', 'win']) console.log(`  ${m.padEnd(8)} render CPU median ${med(by(m)).toFixed(1)} ms, max ${mx(by(m)).toFixed(0)} ms; long tasks ${lt(m).length}, worst ${mx(lt(m)).toFixed(0)} ms`);
  console.log(`  JS per event: discard avg ${(ev('discard').reduce((a, b) => a + b, 0) / Math.max(1, ev('discard').length)).toFixed(1)} max ${mx(ev('discard')).toFixed(0)}; call n${ev('call').length} max ${mx(ev('call')).toFixed(0)}`);
  console.log(`  face upgrades: ${r.up.length} slices, worst ${mx(r.up.map((x) => x.d)).toFixed(0)} ms, during play/discard ${r.up.filter((x) => x.m !== 'home' && x.m !== 'load').length}`);
  await browser.close();
})();
