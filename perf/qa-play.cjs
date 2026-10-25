// QA play-through: node perf/qa-play.cjs URL OUTDIR variation [w h] [hands] [houseRulesJSON]
// Plays through the real UI (taps tiles and buttons), logs page errors, stalls and screenshots.
const pw = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [url, out, variation, W = '1024', H = '700', HANDS = '1', house = '{}'] = process.argv.slice(2);
const SPEED = process.env.SPEED || 'minimal';
const CLAIM = +(process.env.CLAIM || 0.5);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const touch = +W < 1000;
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1, hasTouch: touch, isMobile: +W < 600 });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const errs = [];
  page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message, (e.stack || '').split('\n').slice(1, 4).join(' | ')); });
  page.on('console', (m) => m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource|ipapi|ipwho/.test(m.text()) && console.log('CONSOLE', m.text().slice(0, 300)));
  await page.addInitScript(() => { localStorage.setItem('jongclub.quality.v1', 'low'); localStorage.setItem('jongclub.onboarded', '1'); });
  await page.goto(url, { timeout: 300000, waitUntil: 'commit' });
  await page.waitForFunction(() => window.jongclub, null, { timeout: 300000 });
  await page.waitForTimeout(2000);
  await page.evaluate(([variation, house, speed, hands]) => {
    const app = window.jongclub;
    app.settings.autoDraw = false; app.settings.speed = speed;
    app.startMatch({ ...app.lastConfig, variation, houseRules: JSON.parse(house), hints: true, hintDepth: 'advanced', timer: 0, pace: 'untimed', length: hands > 1 ? 'fullNews' : 'oneHand' });
  }, [variation, house, SPEED, +HANDS]);
  let done = 0, last = '', still = 0, shots = 0, step = 0;
  const shot = async (tag) => { try { await page.screenshot({ path: `${out}/${variation}-${String(shots++).padStart(2, '0')}-${tag}.png`, timeout: 90000 }); } catch (e) { console.log('SHOTFAIL', tag, e.message.split('\n')[0]); } };
  // Cheap 3D: a low drawing resolution keeps swiftshader fast (DOM stays sharp). LOWPR=0 turns it off.
  const lowpr = () => process.env.LOWPR !== '0' && page.evaluate(() => { const t = window.jongclub.match?.table; if (t && !t.__lowpr) { t.__lowpr = 1; t.pixelRatioFor = () => 0.3; t.renderer.setPixelRatio(0.3); } }).catch(() => {});
  await page.waitForTimeout(1500);
  await lowpr();
  await shot('start');
  const t0 = Date.now();
  while (Date.now() - t0 < +(process.env.MAXMS || 1500000)) {
    step++;
    if (step % 10 === 1) await lowpr();
    const st = await page.evaluate(() => {
      const app = window.jongclub; const m = app.match;
      const vis = (b) => { const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !b.disabled && !b.closest('[inert]'); };
      const btns = [...document.querySelectorAll('button')].filter(vis).map((b) => b.textContent.trim().replace(/\s+/g, ' ').slice(0, 40));
      if (!m) return { none: true, btns, route: location.hash };
      const p = m.game.state.phase;
      return { ph: p?.kind, seat: p?.seat, me: m.me, mine: p?.kind === 'turn' && p.seat === m.me, inter: m.table.interactive.size, btns, wall: m.game.state.wall?.length, hand: m.game.state.handNumber };
    });
    const key = JSON.stringify([st.ph, st.seat, st.inter, st.wall, st.btns.slice(0, 6)]);
    if (key === last) still++; else { still = 0; last = key; }
    if (still === 40) { console.log('STALL?', JSON.stringify(st)); await shot('stall'); }
    if (still > 120) { console.log('STUCK', JSON.stringify(st)); await shot('stuck'); break; }
    if (process.env.STOPAT && st.ph === 'turn' && st.mine && (await page.evaluate(() => { const m = window.jongclub.match; return m.game.state.log.filter((e) => e.type === 'discard' && e.seat === m.me).length; })) >= +process.env.STOPAT) { await page.waitForTimeout(2500); await shot('stopat'); console.log('STATUS', await page.evaluate(() => document.querySelector('.hand-status')?.textContent)); break; }
    if (st.none) { console.log('match ended, route', st.route, st.btns.slice(0, 8)); await shot('end'); break; }
    const click = async (re) => page.evaluate((src) => {
      const re = new RegExp(src, 'i');
      const vis = (b) => { const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !b.disabled && !b.closest('[inert]'); };
      const b = [...document.querySelectorAll('button')].filter(vis).find((b) => re.test(b.textContent.trim()));
      if (b) { b.click(); return b.textContent.trim().slice(0, 30); }
      return null;
    }, re.source);
    let did = null;
    if (st.btns.some((b) => /^(Next hand|See results)/.test(b))) {
      await page.waitForTimeout(1500); await shot('summary');
      console.log('HANDRESULT', await page.evaluate(() => { const g = window.jongclub.match.game; const r = g.state.phase.result; return JSON.stringify({ dealer: g.dealer, winner: r?.winner, pts: r?.score?.points, deltas: r?.deltas, pay: (r?.payments || []).map((p) => [p.from, p.to, p.amount, p.reason]), shown: [...document.querySelectorAll('.overlay .delta, .overlay [class*=delta]')].map((e) => e.textContent).slice(0, 8) }); }).catch((e) => e.message));
      if (process.env.ALLHANDS && (await click(/^All hands/))) { await page.waitForTimeout(1200); await shot('allhands'); await click(/^Back to summary|^Close/); }
      did = await click(/^(Next hand|See results)/); done++;
      if (done >= +HANDS) { await page.waitForTimeout(3000); await shot('after'); break; }
    } else if (st.ph === 'turn' && st.mine) {
      did = await click(/^(Mahjong|Mah Jongg|Hu|Tsumo|Ron|Declare)/) || (st.btns.some((b) => /^Draw a tile/.test(b)) ? await click(/^Draw a tile/) : null);
      if (!did && st.inter > 0) {
        did = await page.evaluate(() => { const t = window.jongclub.match.table; const ids = [...t.interactive]; const id = ids[Math.floor(Math.random() * ids.length)]; t.onTileClick?.(id); t.onTileClick?.(id); return 'tile ' + id; });
      }
      if (!did) did = await click(/^(Skip|Riichi|Discard)/);
    } else if (st.ph === 'claims') {
      did = await click(/^(Mahjong|Mah Jongg|Ron|Hu)\b/);
      if (!did && Math.random() < CLAIM) did = await click(/^(Pung|Pong|Pon|Chow|Chi|Kong|Kan|Gang|Buy)/);
      if (!did) did = await click(/^Pass\b/);
    } else {
      did = await click(/^(Use JongBot|Start play|Start the exchanges|Give the tiles|Swap with the wall|Pass three|Pass again|Keep it at one|Play Small Cards|No Tic-Tac-Toe|No wall exchange|Continue|Keep playing|Skip ›|choose this game|OK|Done)/);
      if (!did && st.ph && !['turn', 'claims', 'handOver', 'dealing'].includes(st.ph) && still > 3) {
        did = await click(/^(Pass|Swap|Start|Choose|Keep|Give|Next|Confirm)/) || (st.ph === 'cardPick' ? await click(/^\d+[A-Z]/) : null);
        if (!did && still > 6) console.log('no action for phase', st.ph, st.btns.slice(0, 10));
      }
    }
    if (did && process.env.VERBOSE) console.log(step, st.ph, '->', did);
    if (step % 60 === 0) { console.log('progress', step, JSON.stringify({ ph: st.ph, wall: st.wall, hand: st.hand, done })); await shot('mid'); }
    await page.waitForTimeout(400);
  }
  console.log('RESULT', variation, W + 'x' + H, 'hands', done, 'errors', errs.length);
  await browser.close();
})();
