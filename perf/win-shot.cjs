// node win-shot.cjs URL OUT W H WINNERSEAT(rel to me: 0 you, 1 right...)
const pw = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [url, out, W = '1440', H = '900', WREL = '0'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const HAND = [0, 0, 0, 1, 2, 7, 10, 11, 12, 18, 19, 20, 25], WIN = 18;
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  page.on('pageerror', (e) => console.log('PAGEERR', e.message, (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  await page.addInitScript(() => { localStorage.setItem('jongclub.quality.v1', 'low'); localStorage.setItem('jongclub.onboarded', '1'); });
  await page.goto(url, { timeout: 300000, waitUntil: 'commit' });
  await page.waitForFunction(() => window.jongclub, null, { timeout: 300000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { const app = window.jongclub; app.settings.autoDraw = true; app.settings.speed = 'minimal';
    app.startMatch({ ...app.lastConfig, variation: 'india', houseRules: {}, hints: false, timer: 0, pace: 'untimed', length: 'oneHand' }); });
  let rigged = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 900000) {
    const st = await page.evaluate(([HAND, WIN, WREL, rigged]) => {
      const m = window.jongclub.match; if (!m) return { none: true };
      const g = m.game, s = g.state, p = s.phase, n = g.players.length;
      const wseat = (m.me + WREL) % n, before = (wseat + n - 1) % n;
      const vis = (b) => { const r = b.getBoundingClientRect(); return r.width > 0 && !b.disabled; };
      const btns = [...document.querySelectorAll('button')].filter(vis).map((b) => b.textContent.trim());
      if (!rigged && p.kind === 'turn' && p.seat === before && g.players[before].hand.length % 3 === 2) {
        const pl = g.players[wseat];
        const front = s.drawnFromFront;
        // Sources: the live wall (not the back) and the other hands. Each swap keeps every count.
        const srcs = []; for (let i = front + 1; i < s.wall.length - 20; i++) srcs.push([s.wall, i]);
        g.players.forEach((o, k) => { if (k !== wseat) o.hand.forEach((_, i) => srcs.push([o.hand, i])); });
        const need = HAND.slice(); const keep = [];
        for (const t of pl.hand) { const j = need.indexOf(t.kind); if (j >= 0) { need.splice(j, 1); keep.push(t.id); } }
        for (const k of need) {
          const hi = pl.hand.findIndex((t) => !keep.includes(t.id));
          const src = srcs.find(([arr, i]) => arr[i] && arr[i].kind === k);
          if (!src) return { fail: 'no ' + k };
          const [arr, i] = src; const tmp = arr[i]; arr[i] = pl.hand[hi]; pl.hand[hi] = tmp; keep.push(tmp.id);
        }
        const ws = srcs.find(([arr, i]) => arr[i] && arr[i].kind === WIN && arr !== s.wall || (arr === s.wall && arr[i].kind === WIN));
        if (!ws) return { fail: 'no win tile' };
        { const [arr, i] = ws; const tmp = arr[i]; arr[i] = s.wall[front]; s.wall[front] = tmp; }
        return { rigged: true, wseat };
      }
      return { ph: p.kind, seat: p.seat, me: m.me, btns };
    }, [HAND, WIN, +WREL, rigged]);
    if (st.none) { console.log('ended'); break; }
    if (st.fail) { console.log('FAIL', st.fail); rigged = true; continue; }
    if (st.rigged) { rigged = true; console.log('rigged seat', st.wseat); continue; }
    if (st.btns.some((b) => /^(Next hand|See results)/i.test(b))) { console.log('summary up'); break; }
    if (st.ph === 'turn' && st.seat === st.me || st.ph === 'claims') {
      const did = await page.evaluate(() => {
        const bs = [...document.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width > 0 && !b.disabled);
        const w = bs.find((b) => /^(Mahjong|Hu|Declare)/i.test(b.textContent.trim())); if (w) { w.click(); return 'win'; }
        const pass = bs.find((b) => /^Pass$/i.test(b.textContent.trim())); if (pass) { pass.click(); return 'pass'; }
        const t = window.jongclub.match.table; const ids = [...t.interactive];
        if (ids.length) { const id = ids[ids.length - 1]; t.onTileClick?.(id); t.onTileClick?.(id); return 'tile'; }
        const other = bs.find((b) => /^(Skip|Discard|Start play|Continue|Skip ›|OK|Done)/.test(b.textContent.trim())); if (other) { other.click(); return 'btn'; }
        return null;
      });
      if (did) console.log('did', did);
    } else {
      await page.evaluate(() => { const bs = [...document.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width > 0 && !b.disabled); const o = bs.find((b) => /^(Skip ›|Skip|Start play|Continue|OK|Done|Use JongBot)$/.test(b.textContent.trim())); o?.click(); });
    }
    await page.waitForTimeout(700);
  }
  for (let i = 0; i < 3; i++) { await page.waitForTimeout(3000); }
  await page.screenshot({ path: `${out}/summary.png` });
  console.log(await page.evaluate(() => document.querySelector('.win-hand')?.innerText.replace(/\n/g, ' | ')));
  await page.evaluate(() => document.querySelector('.hide-summary')?.click());
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${out}/table.png` });
  await browser.close();
})();
