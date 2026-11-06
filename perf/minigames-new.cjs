// Plays each newer mini-game a little in a headless browser and screenshots it.
// node perf/minigames-new.cjs URL OUTDIR [W H] [ids,comma]
const pw = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [url, out, W = '1024', H = '700', only] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const GAMES = (only || 'hex,colour,survival,treasure,boss,chain,rush,dungeon').split(',');
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1, hasTouch: +W < 1000, isMobile: +W < 600 });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com|ipapi|ipwho/, (r) => r.abort());
  page.on('pageerror', (e) => console.log('PAGEERR', e.message, (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  page.on('console', (m) => m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource|ERR_FAILED/.test(m.text()) && console.log('CONSOLE', m.text().slice(0, 300)));
  await page.addInitScript(() => {
    localStorage.setItem('jongclub.quality.v1', 'low');
    localStorage.setItem('jongclub.onboarded', '1');
  });
  await page.goto(url + '#minigames', { timeout: 300000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${out}/hub.png`, timeout: 180000 }).catch(() => console.log('SHOTFAIL'));
  for (const id of GAMES) {
    const t0 = Date.now();
    await page.evaluate(() => (location.hash = 'minigames'));
    await page.waitForTimeout(1500);
    const ok = await page.evaluate((id) => {
      const titles = { hex: 'Mahjong Hex', colour: 'Colour Match', survival: 'Survival', treasure: 'Treasure Hunt', boss: 'Boss Challenge', chain: 'Chain Reaction', rush: 'Puzzle Rush', dungeon: 'Mahjong Dungeon' };
      const card = [...document.querySelectorAll('.mini-card')].find((c) => c.textContent.includes(titles[id]));
      if (!card) return false;
      (card.querySelector('button') || card).click();
      return true;
    }, id);
    if (!ok) { console.log(id, 'NO CARD'); continue; }
    await page.waitForTimeout(800);
    await page.evaluate(() => document.querySelector('.mini-sheet .btn.primary')?.click());
    await page.waitForTimeout(2500);
    // Close the how-to sheet if it opened.
    await page.evaluate(() => { const b = [...document.querySelectorAll('.modal:not([hidden]) button, [class*=sheet] button')].find((b) => /got it|play|close|ok/i.test(b.textContent || '')); b?.click(); });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/${id}-start.png`, timeout: 180000 }).catch(() => console.log('SHOTFAIL'));
    const res = await page.evaluate(async (id) => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const m = window.jongMini;
      if (!m) return 'no jongMini';
      const s = m.debug.session;
      let steps = 0;
      for (let i = 0; i < 14; i++) {
        let ids = null;
        if (id === 'rush') ids = [10 + s.p.choices.indexOf(s.p.answer)];
        else if (id === 'dungeon') { const p = s.plan?.(); const nxt = p?.[0] ?? s.g.near(s.at)[0]; s.step(nxt); steps++; await wait(700); continue; }
        else if (id === 'treasure') { const p = s.g.proven(); ids = [p >= 0 ? p : [...Array(s.kinds.length).keys()].find((c) => !s.g.open.has(c))]; }
        else if (id === 'colour') { const mv = new (s.g.constructor)(s.g.lanes.map((l) => [...l])).solve(40000); if (!mv?.length) break; const [a, b] = mv[0]; s.lane(a); s.lane(b); steps++; await wait(450); continue; }
        else ids = s.suggest();
        if (!ids || !ids.length) { if (s.shuffle) s.shuffle(); await wait(400); continue; }
        if (id === 'chain') ids = [ids[0]];
        for (const t of ids) s.onPick(t);
        steps++;
        await wait(id === 'chain' ? 800 : 500);
      }
      let bad = 0;
      if (id === 'chain') {
        const tiles = m.debug.board.tiles;
        s.idAt.forEach((tid, cell) => {
          if (tid < 0) return;
          const t = tiles.get(tid);
          const last = t.queue.length ? t.queue[t.queue.length - 1].to : t.tween ? t.tween.to : t.pose;
          if (last.pos.distanceTo(s.world(cell)) > 1e-3 || !t.alive) bad++;
        });
      }
      return { steps, ended: s.ended, bad };
    }, id);
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${out}/${id}-mid.png`, timeout: 180000 }).catch(() => console.log('SHOTFAIL'));
    console.log(id, JSON.stringify(res), Math.round((Date.now() - t0) / 1000) + 's');
    await page.evaluate(() => window.jongMini?.leave());
    await page.waitForTimeout(800);
  }
  await browser.close();
})();
