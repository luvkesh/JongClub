// node run.cjs OUT [W H] ; env VARIANTS=base,nodecal,... 
const pw = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [out, W = '1280', H = '720'] = process.argv.slice(2);
const variants = (process.env.VARIANTS || 'base').split(',');
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await page.addInitScript((q) => localStorage.setItem('jongclub.quality.v1', q), process.env.Q || 'high');
  await page.goto('http://localhost:5311/', { timeout: 300000, waitUntil: 'commit' });
  await page.waitForFunction(() => window.jongclub && window.jongclub.table, null, { timeout: 300000 });
  await page.waitForTimeout(8000); await page.evaluate((e)=>Object.assign(window,e), {__R: process.env.R, __Y: process.env.Y, __STEP: process.env.STEP, __ENV: process.env.ENV, __RACK: process.env.RACK});
  if (process.env.MATCH) {
    await page.evaluate(() => { const app = window.jongclub; app.settings.autoDraw = true; app.startMatch({ ...app.lastConfig, houseRules: {}, timer: 0, pace: 'untimed' }); });
    await page.waitForTimeout(+process.env.MATCH);
  }
  const N = +(process.env.N || 16);
  for (const v of variants) {
    const frames = await page.evaluate(async ([v, N, W, H]) => {
      const t = window.jongclub.table;
      t.frame = () => {}; // stop the app's own drawing
      const R = t.renderer, S = t.scene;
      const restore = [];
      if (!window.__setup) { window.__setup = 1; if (window.__ENV) t.setEnvironment(window.__ENV); if (window.__RACK) t.setRackStyle(window.__RACK); }
      const set = (o, k, val) => { const old = o[k]; restore.push(() => { o[k] = old; if (o.isMaterial) o.needsUpdate = true; }); o[k] = val; if (o.isMaterial) o.needsUpdate = true; };
      S.traverse((o) => {
        if (!o.isMesh) return;
        const slot = o.userData.rackSlot;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        if (v === 'nodecal' && (slot === 'frieze' || slot === 'panel')) set(o, 'visible', false);
        if (v === 'notrim' && slot === 'trim') set(o, 'visible', false);
        if (v === 'rough' && slot) for (const m of mats) { if ('clearcoatRoughness' in m) set(m, 'clearcoatRoughness', Math.max(0.25, m.clearcoatRoughness)); set(m, 'roughness', Math.max(0.4, m.roughness)); }
        if (v === 'nocoat' && slot) for (const m of mats) if ('clearcoat' in m) set(m, 'clearcoat', 0);
        if (v === 'norack' && slot) set(o, 'visible', false);
        const lin = mats[0] && mats[0].sheen > 0 && mats[0].roughness >= 0.9 && o.geometry.attributes.position.count < 60;
        if (v === 'noline' && lin) set(o, 'visible', false);
        if (v === 'nosheen' && lin) set(mats[0], 'sheen', 0);
        if (v === 'lift' && lin) { const g = o.geometry; const p = g.attributes.position; const nn = g.attributes.normal; restore.push(() => { for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) - 0.004 * nn.getY(i)); p.needsUpdate = true; }); for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + 0.004 * nn.getY(i)); p.needsUpdate = true; }
        if (v === 'noshadow') set(o, 'receiveShadow', false);
      });
      window.__restore = restore;
      R.shadowMap.needsUpdate = true;
      const cam = t.camera.clone();
      const out = [];
      const c = document.createElement('canvas');
      for (let i = 0; i < N; i++) {
        const a = 0.6 + i * +(window.__STEP||0.0015); // tiny steps: under a pixel of motion per frame at the rails
        cam.position.set(Math.sin(a) * +(window.__R||7.5), +(window.__Y||5.2), Math.cos(a) * +(window.__R||7.5));
        cam.lookAt(0, 0.2, 0);
        cam.aspect = W / H; cam.updateProjectionMatrix();
        R.render(S, cam);
        out.push(R.domElement.toDataURL('image/png'));
      }
      for (const r of restore.reverse()) r();
      return out;
    }, [v, N, +W, +H]);
    frames.forEach((d, i) => fs.writeFileSync(`${out}-${v}-${String(i).padStart(2, '0')}.png`, Buffer.from(d.split(',')[1], 'base64')));
    console.log('done', v);
  }
  await browser.close();
})();
