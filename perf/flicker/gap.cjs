// For every rack: distance from each lining/frieze/panel point straight down to the wood under it.
const pw = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 640, height: 400 } })).newPage();
  await page.addInitScript(() => localStorage.setItem('jongclub.quality.v1', 'high'));
  await page.goto('http://localhost:5311/', { timeout: 300000, waitUntil: 'commit' });
  await page.waitForFunction(() => window.jongclub && window.jongclub.table, null, { timeout: 300000 });
  await page.waitForTimeout(6000);
  for (const id of ['rack-table', 'rack-walnut', 'rack-rosewood', 'rack-trunk', 'rack-lacquer', 'rack-pearl', 'rack-jade', 'rack-gilt']) {
    const r = await page.evaluate((id) => {
      const t = window.jongclub.table; t.setRackStyle(id); t.scene.updateMatrixWorld(true);
      const rc = t.raycaster; const res = {};
      const groups = new Set();
      t.scene.traverse((o) => { if (o.isMesh && o.userData.rackSlot) groups.add(o.parent); });
      for (const g of groups) {
        const wood = g.children.filter((m) => ['body', 'accent', 'trim', 'stone'].includes(m.userData.rackSlot));
        for (const m of g.children) {
          const slot = m.userData.rackSlot; if (!['lining', 'frieze', 'panel'].includes(slot)) continue;
          const p = m.geometry.attributes.position, n = m.geometry.attributes.normal; const nm = new m.matrixWorld.constructor().extractRotation(m.matrixWorld);
          let min = 1, max = -1, buried = 0, cnt = 0;
          const tri = m.geometry.index ? m.geometry.index.array : null;
          // sample triangle centroids and their edges' midpoints
          const N = tri ? tri.length / 3 : p.count / 3;
          for (let f = 0; f < N; f++) {
            const ids = tri ? [tri[f * 3], tri[f * 3 + 1], tri[f * 3 + 2]] : [f * 3, f * 3 + 1, f * 3 + 2];
            for (const w of [[1/3,1/3,1/3],[0.8,0.1,0.1],[0.1,0.8,0.1],[0.1,0.1,0.8]]) {
              const P = p.constructor ? null : null;
              let x = 0, y = 0, z = 0, nx = 0, ny = 0, nz = 0;
              ids.forEach((i, k) => { x += p.getX(i) * w[k]; y += p.getY(i) * w[k]; z += p.getZ(i) * w[k]; nx += n.getX(i) * w[k]; ny += n.getY(i) * w[k]; nz += n.getZ(i) * w[k]; });
              const o = rc.ray.origin.set(x, y, z).applyMatrix4(m.matrixWorld);
              const d = rc.ray.direction.set(nx, ny, nz).applyMatrix4(nm).normalize();
              o.addScaledVector(d, 0.03); d.negate(); rc.near = 0; rc.far = 0.2;
              const h = rc.intersectObjects(wood, false)[0];
              if (!h) continue;
              const gap = 0.03 - h.distance; cnt++;
              min = Math.min(min, -gap); max = Math.max(max, -gap); if (-gap < 0.0008) buried++;
            }
          }
          const k = slot + (g === t.racks?.human ? '' : '');
          const key = slot + '@' + g.uuid.slice(0, 4);
          res[key] = { cnt, minGapMm: +(min * 1000).toFixed(2), maxGapMm: +(max * 1000).toFixed(2), tooClose: buried };
        }
      }
      return res;
    }, id);
    console.log(id, JSON.stringify(r));
  }
  await browser.close();
})();
