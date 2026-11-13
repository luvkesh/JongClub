// node perf/cast/model.cjs export <Name> <out.glb>   |   node perf/cast/model.cjs render <Name> <outPrefix>   (vite on :4430)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
(async () => {
  const [cmd, name, out, size, camZ, lookY] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 1100 } });
  p.setDefaultTimeout(600000);
  p.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:4430/perf/cast/model.html');
  await p.waitForFunction('window.modelReady');
  if (cmd === 'export') fs.writeFileSync(out, Buffer.from(await p.evaluate((n) => window.exportStandIn(n), name), 'base64'));
  else {
    const urls = await p.evaluate((a) => window.renderModel(a[0], [-3, 0, 3], a[1], a[2], a[3]), [name, +(size || 512), +(camZ || 5.6), +(lookY || 1.45)]);
    urls.forEach((u, i) => fs.writeFileSync(`${out}-${i}.png`, Buffer.from(u.split(',')[1], 'base64')));
  }
  console.log('ok');
  await b.close();
})();
