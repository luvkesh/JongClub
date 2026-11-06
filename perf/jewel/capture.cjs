// node perf/jewel/capture.cjs OUTDIR set1,set2  (vite dev server on :5311)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
(async () => {
  const [out, sets] = [process.argv[2], (process.argv[3] || 'classic-ivory').split(',')];
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  p.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
  await p.goto('http://localhost:5311/perf/jewel/', { timeout: 120000 });
  await p.waitForFunction('window.ready', null, { timeout: 120000 });
  for (const id of sets) {
    const r = await p.evaluate((id) => window.shot(id), id);
    for (const k of ['faces', 'portrait']) {
      const d = r[k]; if (!d) continue;
      const ext = d.startsWith('data:image/webp') ? 'webp' : 'png';
      fs.writeFileSync(`${out}/${id}-${k}.${ext}`, Buffer.from(d.split(',')[1], 'base64'));
    }
    console.log('ok', id);
  }
  await b.close();
})();
