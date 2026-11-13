// node perf/cast/capture.cjs OUTDIR [size]  (vite dev server on :4430): one in-game portrait PNG per cast member.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
(async () => {
  const [out, size = '200'] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 1 });
  p.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
  await p.goto('http://localhost:4430/perf/cast/', { timeout: 120000 });
  await p.waitForFunction('window.ready', null, { timeout: 120000 });
  const names = await p.evaluate('window.names');
  for (const n of names) {
    const d = await p.evaluate(([n, s]) => window.shot(n, s), [n, +size]);
    fs.writeFileSync(`${out}/${n.toLowerCase().replace(/ /g, '-')}.png`, Buffer.from(d.split(',')[1], 'base64'));
  }
  console.log('ok', names.length);
  await b.close();
})();
