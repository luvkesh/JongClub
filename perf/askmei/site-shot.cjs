// The website's Ask Mei picture: node perf/askmei/site-shot.cjs URL OUT.png  (1800x1125 at 2x, a short conversation)
const pw = require('/opt/node-tools/node_modules/playwright');
const [url, out] = process.argv.slice(2);
const replies = [
  'A **passport** is a hand shape you must hold to go out in the East round. No passport, no Mahjong.\n- The East round sheet lists every passport.\n- Build it from your hand or the wall: a passport set is never called.\nStart from the pairs you already hold, and keep one eye on the flowers.\n[[lesson:india-east]]',
  'Up to **three**, and only one counts. Hold more and you choose the best at the showdown.',
];
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 750 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com|ipapi|ipwho/, (r) => r.abort());
  await page.addInitScript(() => { localStorage.setItem('jongclub.quality.v1', 'low'); localStorage.setItem('jongclub.onboarded', '1'); localStorage.setItem('jongclub.askmei.key.v1', 'AIzaSyA-0123456789abcdefghijklmnopqrstu'); });
  let n = 0;
  await page.route(/generativelanguage\.googleapis\.com/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: replies[Math.min(n++, replies.length - 1)] }] }, finishReason: 'STOP' }] }) }));
  await page.goto(url + '#learn', { timeout: 300000 }); await page.waitForTimeout(3500);
  const sec = await page.$('.lx-ask'); await sec.scrollIntoViewIfNeeded();
  await page.click('.am-chip:has-text("passport")'); await page.waitForTimeout(1200);
  await page.fill('.am-input', 'How many passports can I hold?'); await page.click('.am-send'); await page.waitForTimeout(1200);
  await page.fill('.am-input', 'What if the dealer wins twice?');
  await page.evaluate(() => { const s = document.querySelector('.lx-ask'); s.scrollIntoView({ block: 'start' }); window.scrollBy(0, -52); document.querySelector('header, .app-header, .topbar')?.remove(); const th = document.querySelector('.am-thread'); th.style.maxHeight = 'none'; });
  await page.waitForTimeout(400);
  const box = await (await page.$('.lx-ask')).boundingBox();
  console.log('section', JSON.stringify(box));
  await page.screenshot({ path: out });
  await browser.close();
})();
