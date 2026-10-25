// CPU profile of three.js frame work at your turn with the GPU side shrunk. usage: node perf/renderprof.cjs URL out [tier]
const pw = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [url, out, tier = 'medium'] = process.argv.slice(2);
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript((t) => localStorage.setItem('jongclub.quality.v1', t), tier);
  await page.goto(url);
  await page.waitForFunction(() => window.jongclub, null, { timeout: 300000 });
  await page.evaluate(() => { const t = window.jongclub.table, r = t.renderer, set = r.setPixelRatio.bind(r); r.setPixelRatio = () => set(0.08); t.resize();
    t.scene.traverse((o) => { if (o.isLight && o.shadow) { o.shadow.mapSize.set(128, 128); o.shadow.map?.dispose(); o.shadow.map = null; } });
    window.jongclub.settings.autoDraw = true; window.jongclub.startMatch({ ...window.jongclub.lastConfig, timer: 0, pace: 'untimed' }); });
  await page.waitForFunction(() => { const m = window.jongclub.match; const p = m?.game.state.phase; return p && p.kind === 'turn' && p.seat === m.me && m.table.interactive.size; }, null, { timeout: 900000 });
  await page.waitForTimeout(3000);
  const stats = await page.evaluate(() => { const t = window.jongclub.table; let objs = 0, meshes = 0, vis = 0, casters = 0; t.scene.traverse((o) => { objs++; if (o.isMesh || o.isPoints || o.isSprite || o.isInstancedMesh) { meshes++; if (o.visible) vis++; if (o.castShadow) casters++; } }); const mats = new Set(); t.scene.traverse((o) => o.material && (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m))); return { objs, meshes, vis, casters, mats: mats.size }; });
  console.log(JSON.stringify(stats));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
  await page.evaluate(() => { const t = window.jongclub.table; const iv = setInterval(() => t.wake(500), 200); setTimeout(() => clearInterval(iv), 6000); });
  await page.waitForTimeout(6000);
  const { profile } = await cdp.send('Profiler.stop');
  fs.writeFileSync(out, JSON.stringify(profile));
  const fr = await page.evaluate(() => window.jongclub.table.perf);
  console.log(JSON.stringify(fr));
  await browser.close();
})();
