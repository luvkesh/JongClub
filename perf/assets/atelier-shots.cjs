// node shots.cjs OUTDIR  -> atelier screenshot per category (desktop 1440x900)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const out = process.argv[2]; require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  p.setDefaultTimeout(180000);
  await p.goto('http://localhost:5311/#atelier');
  await p.waitForSelector('.cc-cats button');
  const n = await p.locator('.cc-cats button').count();
  for (let i = 0; i < n; i++) {
    await p.locator('.cc-cats button').nth(i).click();
    await p.waitForTimeout(20000);
    await p.screenshot({ path: `${out}/cat-${i}.png` });
    console.log('cat', i);
  }
  await b.close();
})();
