// node perf/cast/model.cjs export <Name> <out.glb>   |   node perf/cast/model.cjs render <Name> <outPrefix>   (vite on :4430)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
(async () => {
  const [cmd, name, out] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 600, height: 600 } });
  p.setDefaultTimeout(600000);
  p.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:4430/perf/cast/model.html');
  await p.waitForFunction('window.modelReady');
  if (cmd === 'export') fs.writeFileSync(out, Buffer.from(await p.evaluate((n) => window.exportStandIn(n), name), 'base64'));
  else {
    const urls = await p.evaluate((n) => window.renderModel(n, [-3, 0, 3]), name);
    urls.forEach((u, i) => fs.writeFileSync(`${out}-${i}.png`, Buffer.from(u.split(',')[1], 'base64')));
  }
  console.log('ok');
  await b.close();
})();
