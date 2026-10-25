// QA of the menus: node perf/qa-screens.cjs URL OUTDIR W H
// Collection/Atelier pop-over (next/prev, equip, acquire), Profile name edit, avatar editor, Club, Learn, Mini-games.
const pw = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [url, out, W = '390', H = '844'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1, hasTouch: +W < 1000, isMobile: +W < 600 });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com|ipapi|ipwho/, (r) => r.abort());
  page.on('pageerror', (e) => console.log('PAGEERR', e.message, (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  page.on('console', (m) => m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource|ERR_FAILED/.test(m.text()) && console.log('CONSOLE', m.text().slice(0, 300)));
  await page.addInitScript(() => { localStorage.setItem('jongclub.quality.v1', 'low'); localStorage.setItem('jongclub.onboarded', '1'); });
  let n = 0;
  const shot = async (tag) => { try { await page.screenshot({ path: `${out}/${String(n++).padStart(2, '0')}-${tag}.png`, timeout: 90000 }); } catch { console.log('SHOTFAIL', tag); } };
  const go = async (hash) => { await page.goto(url + '#' + hash, { timeout: 300000 }); await page.waitForTimeout(3500); };
  const click = (sel, i = 0) => page.evaluate(([sel, i]) => { const el = document.querySelectorAll(sel)[i]; if (!el) return false; el.click(); return true; }, [sel, i]);
  const text = (sel) => page.evaluate((sel) => document.querySelector(sel)?.innerText.replace(/\s+/g, ' ').slice(0, 200), sel);
  const overlaps = () => page.evaluate(() => {
    // Visible buttons that overlap each other (not nested).
    const bs = [...document.querySelectorAll('button, a.btn, .btn')].filter((b) => { const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.opacity !== '0' && r.bottom > 0 && r.top < innerHeight; });
    const out = [];
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j];
      if (a.contains(b) || b.contains(a)) continue;
      const r = a.getBoundingClientRect(), q = b.getBoundingClientRect();
      const ox = Math.min(r.right, q.right) - Math.max(r.left, q.left), oy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
      if (ox > 4 && oy > 4) {
        // Is either actually on top at the overlap's centre?
        const cx = (Math.max(r.left, q.left) + Math.min(r.right, q.right)) / 2, cy = (Math.max(r.top, q.top) + Math.min(r.bottom, q.bottom)) / 2;
        const top = document.elementFromPoint(cx, cy);
        if (top && (a.contains(top) || b.contains(top))) out.push(`${(a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 25)} <> ${(b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 25)}`);
      }
    }
    return out.slice(0, 6);
  });
  const report = async (tag) => { const o = await overlaps(); if (o.length) console.log('OVERLAP', tag, JSON.stringify(o)); };

  await go('collection'); await shot('collection'); await report('collection');
  await click('.cc-card'); await page.waitForTimeout(1500); await shot('view'); await report('view');
  console.log('view 1:', await text('.iv-card'));
  for (let i = 0; i < 3; i++) { await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /next/i.test(b.getAttribute('aria-label') || ''))?.click()); await page.waitForTimeout(700); }
  console.log('view after next x3:', await text('.iv-card'));
  await shot('view-next'); await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  console.log('pop-over closed by Escape:', !(await page.evaluate(() => { const v = document.querySelector('.iv-card'); return v && v.getBoundingClientRect().height > 0; })));
  await go('atelier'); await shot('atelier'); await report('atelier');
  await go('profile'); await shot('profile'); await report('profile');
  const pencil = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((b) => /name/i.test(b.getAttribute('aria-label') || '')); b?.click(); return b?.getAttribute('aria-label'); });
  console.log('name edit btn', pencil);
  await page.waitForTimeout(500);
  await page.keyboard.press('Control+A'); await page.keyboard.type('QA Tester Name That Is Rather Long Indeed'); await page.keyboard.press('Enter');
  await page.waitForTimeout(800); await shot('profile-renamed');
  console.log('name now', await page.evaluate(() => window.jongclub?.profile?.name));
  await go('club'); await shot('club'); await report('club');
  await go('learn'); await shot('learn'); await report('learn');
  await go('minigames'); await page.waitForTimeout(3000); await shot('minigames'); await report('minigames');
  await go('play'); await shot('play'); await report('play');
  await go('home'); await shot('home'); await report('home');
  await go('settings'); await shot('settings'); await report('settings');
  await browser.close();
})();
