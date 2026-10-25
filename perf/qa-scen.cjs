// QA scenarios at the table: node perf/qa-scen.cjs URL OUTDIR W H variation [houseJSON]
// Opening ceremony then leaving mid-way; calculator, rule book, plate score card, table menu.
const pw = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [url, out, W = '390', H = '844', variation = 'india', house = '{}'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const touch = +W < 1000;
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1, hasTouch: touch, isMobile: +W < 600 });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  page.on('pageerror', (e) => console.log('PAGEERR', e.message, (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  page.on('console', (m) => m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text()) && console.log('CONSOLE', m.text().slice(0, 300)));
  await page.addInitScript(() => { localStorage.setItem('jongclub.quality.v1', 'low'); localStorage.setItem('jongclub.onboarded', '1'); });
  await page.goto(url, { timeout: 300000, waitUntil: 'commit' });
  await page.waitForFunction(() => window.jongclub, null, { timeout: 300000 });
  await page.waitForTimeout(2000);
  let n = 0;
  const shot = async (tag) => { try { await page.screenshot({ path: `${out}/${String(n++).padStart(2, '0')}-${tag}.png`, timeout: 90000 }); } catch (e) { console.log('SHOTFAIL', tag); } };
  const start = (speed) => page.evaluate(([variation, house, speed]) => {
    const app = window.jongclub;
    app.settings.autoDraw = false; app.settings.speed = speed;
    app.startMatch({ ...app.lastConfig, variation, houseRules: JSON.parse(house), hints: true, hintDepth: 'advanced', timer: 0, pace: 'untimed', length: 'fullNews' });
  }, [variation, house, speed]);
  const tap = async (sel) => { const ok = await page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return false; el.click(); return true; }, sel); if (!ok) console.log('MISSING', sel); return ok; };
  // 1. Opening, then leave in the middle of it.
  if (!process.env.SKIP_OPENING) {
    await start('classic');
    for (const t of [2500, 3000, 3000]) { await page.waitForTimeout(t); await shot('opening'); }
    console.log('opening card:', await page.evaluate(() => document.querySelector('.opening')?.innerText.replace(/\n/g, ' | ')));
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^Leave table$/i.test(b.getAttribute('aria-label') || ''))?.click());
    await page.waitForTimeout(800); await shot('leave-q');
    console.log('leave buttons', await page.evaluate(() => [...document.querySelectorAll('.table-sheet button, .overlay button')].map((b) => b.textContent.trim()).join(' / ')));
    await page.evaluate(() => [...document.querySelectorAll('.table-sheet button, .overlay button')].find((b) => /^Leave/i.test(b.textContent.trim()))?.click());
    await page.waitForTimeout(6000);
    await shot('after-leave');
    console.log('route after leave', await page.evaluate(() => location.hash + ' match=' + !!window.jongclub.match));
  }
  // 2. A dealt hand: calculator, rule book, plates.
  await start('minimal');
  await page.waitForFunction(() => { const m = window.jongclub.match; return m && m.game.state.phase.kind === 'turn'; }, null, { timeout: 300000 });
  await page.waitForTimeout(4000);
  await shot('dealt');
  const phone = +W <= 760 || +H <= 500;
  if (phone) { await tap('.more-btn'); await page.waitForTimeout(800); await shot('drawer'); await tap('.calc-item'); }
  else await tap('.calc-btn');
  await page.waitForTimeout(1500); await shot('calc');
  await page.evaluate(() => [...document.querySelectorAll('.sc-mine')].forEach((b) => b.click()));
  await page.waitForTimeout(1200); await shot('calc-mine');
  console.log('calc result:', await page.evaluate(() => document.querySelector('.sc-result')?.innerText.slice(0, 200)));
  await page.evaluate(() => document.querySelector('.sc-panel .sg-close')?.click());
  await page.waitForTimeout(500);
  await tap('.hand-status'); await page.waitForTimeout(1200); await shot('status-calc');
  await page.evaluate(() => document.querySelector('.sc-panel .sg-close')?.click());
  // Rule book
  if (phone) { await tap('.more-btn'); await page.waitForTimeout(500); }
  const rb = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((b) => /rule book/i.test(b.getAttribute('aria-label') || b.textContent || '')); b?.click(); return b?.outerHTML.slice(0, 120); });
  console.log('rulebook btn', rb);
  await page.waitForTimeout(1500); await shot('rulebook');
  await page.evaluate(() => document.querySelector('.sg-panel:not(.sc-panel) .sg-close')?.click());
  // Plates
  for (const q of [1, 2, 3, 0]) {
    const ok = await page.evaluate((q) => { const el = document.querySelector(`.seat-${q}`); if (!el || el.hidden) return false; el.click(); return true; }, q);
    if (!ok) continue;
    await page.waitForTimeout(900); await shot('plate' + q);
    console.log('plate', q, await page.evaluate((q) => document.querySelector(`.seat-${q} .seat-river`)?.innerText.replace(/\n/g, ' | ').slice(0, 300), q));
    const geo = await page.evaluate((q) => { const r = document.querySelector(`.seat-${q} .seat-river`)?.getBoundingClientRect(); return r && { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), vw: innerWidth, vh: innerHeight }; }, q);
    if (geo && (geo.l < 0 || geo.t < 0 || geo.r > geo.vw || geo.b > geo.vh)) console.log('OFFSCREEN plate card', q, JSON.stringify(geo));
    await page.evaluate((q) => document.querySelector(`.seat-${q}`)?.click(), q);
  }
  await browser.close();
})();
