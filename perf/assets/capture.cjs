// node perf/assets/capture.cjs OUTDIR kind id1,id2  (vite dev server on :5311)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
(async () => {
  const [out, kind, ids] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  p.setDefaultTimeout(300000);
  p.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:5311/perf/assets/');
  await p.waitForFunction('window.ready');
  for (const id of ids.split(',')) {
    const d = await p.evaluate(([k, id]) => window.shot(k, id), [kind, id]);
    if (!d) { console.log('none', id); continue; }
    const ext = d.startsWith('data:image/webp') ? 'webp' : 'png';
    fs.writeFileSync(`${out}/${kind}-${id}.${ext}`, Buffer.from(d.split(',')[1], 'base64'));
    console.log('ok', id);
  }
  await b.close();
})();
