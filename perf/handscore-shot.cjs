// Screenshot the hand score, calculator and rule book at the table:
//   node perf/handscore-shot.cjs URL OUTDIR variation W H [discards]
const pw = require('/opt/node-tools/node_modules/playwright');
const [url, out, variation, W = '1440', H = '900', N = '4'] = process.argv.slice(2);
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const touch = +W < 1000;
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1, hasTouch: touch, isMobile: +W < 500 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 4).join(' | ')));
  page.on('console', (m) => m.type() === 'error' && errs.push('CONSOLE ' + m.text().slice(0, 200)));
  await page.addInitScript(() => { localStorage.setItem('jongclub.quality.v1', 'low'); localStorage.setItem('jongclub.onboarded', '1'); });
  await page.goto(url, { timeout: 300000, waitUntil: 'commit' });
  await page.waitForFunction(() => window.jongclub, null, { timeout: 300000 });
  await page.evaluate((variation) => {
    const app = window.jongclub;
    app.settings.autoDraw = true; app.settings.speed = 'minimal';
    app.startMatch({ ...app.lastConfig, variation, hints: false, timer: 0, pace: 'untimed' });
  }, variation);
  for (let i = 0; i < 300; i++) {
    const st = await page.evaluate(() => { const m = window.jongclub.match; if (!m) return { n: -1 }; const p = m.game.state.phase; return { n: m.game.players[m.me].discards.length, mine: p && p.kind === 'turn' && p.seat === m.me && m.table.interactive.size > 0, ph: p?.kind }; });
    if (st.n >= +N && st.mine) break;
    if (st.mine) await page.evaluate(() => { const t = window.jongclub.match.table; const id = [...t.interactive].pop(); t.onTileClick?.(id); t.onTileClick?.(id); });
    else await page.evaluate(() => { for (const b of document.querySelectorAll('#hud button, .overlay button')) if (/^(Pass|Skip|Done|Continue|OK|Keep these|Start|Use JongBot)/i.test(b.textContent.trim())) b.click(); });
    await page.waitForTimeout(1200);
  }
  await page.waitForTimeout(1500);
  const shot = (name) => page.screenshot({ path: `${out}/${variation}-${W}x${H}-${name}.png`, timeout: 180000 });
  // Buttons: visible, inside the screen, not on top of each other.
  const hud = await page.evaluate(() => {
    const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), shown: cs.display !== 'none' && b.width > 0 }; };
    const tools = [...document.querySelectorAll('.hud-tools > *')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.getBoundingClientRect());
    let overlap = 0;
    for (let i = 0; i < tools.length; i++) for (let j = i + 1; j < tools.length; j++) { const a = tools[i], b = tools[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlap++; }
    return { calc: r('.calc-btn'), book: r('.guide-btn'), overlap, scrollX: document.documentElement.scrollWidth > innerWidth };
  });
  console.log('HUD', JSON.stringify(hud));
  await shot('0-table');
  // Your plate: tap for the score.
  await page.evaluate(() => { const m = window.jongclub.match; const el = document.querySelector('.seat-0'); el && el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(600);
  const plate = await page.evaluate(() => { const b = document.querySelector('.seat-river.with-score'); if (!b) return null; const r = b.getBoundingClientRect(); return { text: b.innerText.slice(0, 300), in: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, r: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] }; });
  console.log('PLATE0', JSON.stringify(plate));
  await shot('1-my-plate');
  await page.evaluate(() => document.querySelector('.seat-river')?.remove());
  // Another player's plate.
  await page.evaluate(() => { const el = document.querySelector('.seat-2:not([hidden])') || document.querySelector('.seat-1'); el && el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(600);
  const other = await page.evaluate(() => { const b = document.querySelector('.seat-river.with-score'); if (!b) return null; const r = b.getBoundingClientRect(); return { text: b.innerText.slice(0, 200), in: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight }; });
  console.log('PLATE2', JSON.stringify(other));
  await shot('2-other-plate');
  await page.evaluate(() => document.querySelector('.seat-river')?.remove());
  // Your hand's status line opens the calculator.
  await page.evaluate(() => document.querySelector('.hand-status')?.click());
  await page.waitForTimeout(800);
  console.log('STATUS-OPENS', await page.evaluate(() => !document.querySelector('.sc-panel').hidden));
  await shot('3-calc');
  await page.evaluate(() => document.querySelector('.sc-panel .sg-close')?.click());
  // The calculator button, or the table menu item where the bar folds it away.
  const via = await page.evaluate(() => {
    const b = document.querySelector('.calc-btn');
    if (b && b.getBoundingClientRect().width > 0) { b.click(); return 'button'; }
    document.querySelector('.more-btn')?.click();
    const it = document.querySelector('.calc-item');
    if (it) { it.click(); return 'menu'; }
    return 'none';
  });
  await page.waitForTimeout(800);
  console.log('OPENED-VIA', via, await page.evaluate(() => !document.querySelector('.sc-panel').hidden));
  await page.evaluate(() => document.querySelector('.sc-mine')?.click());
  await page.waitForTimeout(500);
  const calc = await page.evaluate(() => { const p = document.querySelector('.sc-panel'); const r = p.getBoundingClientRect(); const over = [...p.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.right > r.right + 1 || b.left < r.left - 1); }).length; return { now: p.querySelector('.sc-now')?.innerText.slice(0, 200), result: p.querySelector('.sc-result')?.innerText.slice(0, 200), count: p.querySelector('.sc-count')?.textContent, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], sideways: over }; });
  console.log('CALC', JSON.stringify(calc));
  await shot('4-calc-mine');
  // Build a hand by tapping the picker.
  await page.evaluate(() => { document.querySelector('.sc-clear')?.click(); const picks = [...document.querySelectorAll('.sc-pick')]; const want = [0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 22, 22]; for (const k of want) picks.find((b) => b.querySelector('img')?.dataset.tile === String(k))?.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('.sc-panel .sg-body')?.scrollTo(0, 400));
  const built = await page.evaluate(() => ({ result: document.querySelector('.sc-result')?.innerText.slice(0, 300), count: document.querySelector('.sc-count')?.textContent }));
  console.log('BUILT', JSON.stringify(built));
  await shot('5-calc-built');
  // The rule book closes the calculator.
  await page.evaluate(() => document.querySelector('.guide-btn')?.click());
  await page.waitForTimeout(800);
  const book = await page.evaluate(() => ({ calcOpen: !document.querySelector('.sc-panel').hidden, bookOpen: !document.querySelector('.sg-panel:not(.sc-panel)').hidden, title: document.querySelector('.sg-panel:not(.sc-panel) h3')?.textContent }));
  console.log('BOOK', JSON.stringify(book));
  await shot('6-rule-book');
  console.log('ERRORS', JSON.stringify(errs));
  await browser.close();
})();
