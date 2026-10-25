// Cost of each part of the scene: hide it, render with gl.finish(), compare (software GL, so relative only).
const pw = require('/opt/node-tools/node_modules/playwright');
const [url, w, h] = process.argv.slice(2);
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: Number(w || 640), height: Number(h || 400) } });
  await page.goto(url);
  await page.waitForFunction(() => window.jongclub, null, { timeout: 120000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.jongclub.startMatch({ ...window.jongclub.lastConfig, timer: 0, pace: 'untimed' }));
  await page.waitForFunction(() => { const m = window.jongclub.match; const p = m?.game.state.phase; return p && p.kind === 'turn' && p.seat === m.me && m.table.interactive.size; }, null, { timeout: 300000 });
  await page.waitForTimeout(2000);
  const out = await page.evaluate((extra) => {
    const t = window.jongclub.table, r = t.renderer, gl = r.getContext();
    t.frame = () => {}; // stop the loop so only our renders count
    const px = new Uint8Array(4); const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const time = (n = 2) => { r.render(t.scene, t.camera); sync(); const a = performance.now(); for (let i = 0; i < n; i++) { r.render(t.scene, t.camera); sync(); } return (performance.now() - a) / n; };
    const res = []; const base = time();
    res.push(['ALL', base.toFixed(0), r.info.render.calls, r.info.render.triangles]);
    const cand = [];
    const label = (o, p) => `${p}${o.name || o.type}${o.material ? '[' + (Array.isArray(o.material) ? o.material[0].type : o.material.type) + ']' : ''}#${o.children.length}`;
    t.scene.children.forEach((o, i) => { if (o.children.length > 3 && o.children.length < 140) o.children.forEach((c, j) => cand.push([c, label(o, '') + '/' + j + ':' + label(c, '')])); else cand.push([o, i + ':' + label(o, '')]); });
    for (const [o, l] of cand) { if (!o.visible) continue; o.visible = false; const d = base - time(2); o.visible = true; if (d > base * 0.015) res.push([l, d.toFixed(0)]); }
    const tiles = [...t.tiles.values()]; tiles.forEach((x) => (x.group.visible = false)); res.push(['ALL TILES', (base - time()).toFixed(0)]); tiles.forEach((x) => (x.group.visible = true));
    r.shadowMap.enabled = false; t.scene.traverse((o) => o.material && (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true))); time(1); res.push(['SHADOWS', (base - time()).toFixed(0)]);
    return res;
  });
  for (const x of out) console.log(x.join('\t'));
  await browser.close();
})();
