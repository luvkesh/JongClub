// The dead-call warning: node perf/qa-callwarn.cjs URL OUTDIR W H
// India North Small Cards; offers you a chow that fits none of your cards and answers the warning both ways.
const pw = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [url, out, W = '390', H = '844'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1, hasTouch: +W < 1000, isMobile: +W < 600 });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com|ipapi|ipwho/, (r) => r.abort());
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await page.addInitScript(() => { localStorage.setItem('jongclub.quality.v1', 'low'); localStorage.setItem('jongclub.onboarded', '1'); });
  await page.goto(url, { timeout: 300000, waitUntil: 'commit' });
  await page.waitForFunction(() => window.jongclub, null, { timeout: 300000 });
  await page.evaluate(() => { const app = window.jongclub; app.settings.autoDraw = false; app.settings.speed = 'minimal'; app.startMatch({ ...app.lastConfig, variation: 'india', houseRules: { indiaRounds: 'N' }, hints: true, timer: 0, pace: 'untimed', length: 'oneHand' }); });
  // East picks Small Cards, whoever East is.
  await page.waitForFunction(() => window.jongclub.match, null, { timeout: 60000 });
  await page.evaluate(() => window.jongclub.match.ais.forEach((a) => (a.roundChoice = () => 2)));
  // Cheap 3D so swiftshader keeps up.
  await page.evaluate(() => { const t = window.jongclub.match.table; t.pixelRatioFor = () => 0.3; t.renderer.setPixelRatio(0.3); });
  // Answer the round choice and card pick with the first button each time until play starts.
  for (let i = 0; i < 200; i++) {
    const ph = await page.evaluate(() => window.jongclub.match?.game.state.phase.kind);
    if (ph === 'turn') break;
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((b) => /^(Play Small Cards|Skip ›|choose this game|\d+[A-Z]|Continue|OK|Done)/i.test(b.textContent.trim()) && b.offsetParent); b?.click(); });
    await page.waitForTimeout(700);
  }
  const pick = await page.evaluate(() => {
    const m = window.jongclub.match; const g = m.game; const c = new Array(34).fill(0);
    for (const t of g.players[m.me].hand) c[t.kind]++;
    for (let k = 0; k < 27; k++) if (k % 9 < 7 && c[k + 1] && c[k + 2]) return { k, using: [k + 1, k + 2] };
    return null;
  });
  console.log('chow offered', JSON.stringify(pick));
  await page.evaluate(({ k, using }) => { window.__claim = window.jongclub.match.humanClaim([{ type: 'chow', using }], k).then((r) => (window.__resp = r)); }, pick);
  await page.waitForTimeout(800);
  const clickChow = () => page.evaluate(() => [...document.querySelectorAll('.btn.claim')].find((b) => !b.classList.contains('pass'))?.click());
  const warnUp = () => page.evaluate(() => { const w = document.querySelector('.call-warn'); return w ? w.innerText.replace(/\n+/g, ' | ') : null; });
  await clickChow(); await page.waitForTimeout(1500);
  console.log('warning:', await warnUp());
  await page.screenshot({ path: `${out}/warn-${W}x${H}.png` });
  await page.keyboard.press('Escape'); await page.mouse.click(8, 8); await page.waitForTimeout(500);
  console.log('after Escape + tap outside, still up:', !!(await warnUp()));
  await page.evaluate(() => [...document.querySelectorAll('.call-warn button')].find((b) => /Don/.test(b.textContent))?.click());
  await page.waitForTimeout(500);
  console.log('Don\'t call -> warning gone:', !(await warnUp()), 'claim buttons still there:', await page.evaluate(() => document.querySelectorAll('.btn.claim').length), 'resp', await page.evaluate(() => JSON.stringify(window.__resp ?? null)));
  await clickChow(); await page.waitForTimeout(1200);
  await page.evaluate(() => [...document.querySelectorAll('.call-warn button')].find((b) => /anyway/.test(b.textContent))?.click());
  await page.waitForTimeout(800);
  console.log('Call anyway -> resp', await page.evaluate(() => JSON.stringify(window.__resp ?? null)), 'warning gone:', !(await warnUp()));
  await browser.close();
})();
