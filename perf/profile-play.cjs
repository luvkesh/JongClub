// Plays N of your own discards (plus all AI turns between) and records long tasks + a CPU profile.
// usage: node perf/profile-play.cjs URL OUTPREFIX [discards] [cpuThrottle] [browser]
const pw = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [url, out, nArg, thrArg, br] = process.argv.slice(2);
const N = Number(nArg || 8), THR = Number(thrArg || 1);
(async () => {
  const browser = await pw[br || 'chromium'].launch({ args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  page.on('crash', () => console.log('CRASH'));
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await page.addInitScript(() => {
    window.__lt = [];
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push({ s: e.startTime, d: e.duration }); }).observe({ type: 'longtask', buffered: true }); } catch {}
    // Frame gaps: anything > 100 ms between rAF callbacks.
    window.__gaps = []; let last = 0;
    const tick = (t) => { if (last && t - last > 100) window.__gaps.push({ s: last, d: t - last }); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    window.__marks = [];
    try { localStorage.setItem('jongclub.onboarded', '1'); } catch {}
  });
  await page.goto(url);
  await page.waitForFunction(() => window.jongclub, null, { timeout: 120000 });
  await page.waitForTimeout(4000);
  let cdp = null;
  if (br !== 'webkit' && br !== 'firefox') {
    cdp = await page.context().newCDPSession(page);
    if (THR > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: THR });
  }
  await page.evaluate(() => { window.jongclub.startMatch({ ...window.jongclub.lastConfig, timer: 0, pace: 'untimed' }); });
  await page.waitForTimeout(3000);
  if (cdp && !process.env.NOPROF) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
  const t0 = await page.evaluate(() => { window.__lt = []; window.__gaps = []; return performance.now(); });
  let mine = 0, guard = 0;
  while (mine < N && guard++ < 4000) {
    const st = await page.evaluate(() => {
      const m = window.jongclub.match; if (!m) return 'none';
      const ph = m.game.state.phase;
      const bar = document.querySelector('.actions, [class*=actions]');
      const pass = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Pass' && b.offsetParent);
      if (pass) { pass.click(); return 'pass'; }
      if (ph.kind === 'handOver') return 'over';
      if (ph.kind === 'turn' && ph.seat === m.me && m.table.interactive.size) {
        const id = [...m.table.interactive][0];
        window.__marks.push({ k: 'click', t: performance.now() });
        m.table.onTileClick(id); m.table.onTileClick(id);
        return 'disc';
      }
      return ph.kind;
    });
    if (st === 'disc') mine++;
    if (st === 'over') { await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find((b)=>/Next hand|Continue|Next/.test(b.textContent)&&b.offsetParent); b&&b.click(); }); }
    await page.waitForTimeout(st === 'disc' ? 400 : 150);
  }
  await page.waitForTimeout(2500);
  const r = await page.evaluate((t0) => ({ lt: window.__lt, gaps: window.__gaps, el: performance.now() - t0, marks: window.__marks }), t0);
  if (cdp && !process.env.NOPROF) { const { profile } = await cdp.send('Profiler.stop'); fs.writeFileSync(out + '.cpuprofile', JSON.stringify(profile)); }
  fs.writeFileSync(out + '.json', JSON.stringify(r));
  const lt = r.lt.map((x) => x.d).sort((a, b) => b - a);
  console.log(`${br||'chromium'} x${THR}: ${mine} discards in ${(r.el/1000).toFixed(1)}s; long tasks ${lt.length}, total ${lt.reduce((a,b)=>a+b,0).toFixed(0)} ms, worst ${lt.slice(0,8).map((x)=>x.toFixed(0)).join(' ')}; frame gaps >100ms ${r.gaps.length}, worst ${r.gaps.map(g=>g.d).sort((a,b)=>b-a).slice(0,6).map(x=>x.toFixed(0)).join(' ')}`);
  await browser.close();
})();
