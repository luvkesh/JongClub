// Per-frame timing around discards: does a discard make frames slower than the baseline?
// usage: node perf/frames.cjs URL [discards] [w] [h] [browser] [initScriptFile]
const pw = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [url, nArg, wArg, hArg, br, extra] = process.argv.slice(2);
const N = Number(nArg || 6);
(async () => {
  const browser = await pw[br || 'chromium'].launch({ args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: Number(wArg || 640), height: Number(hArg || 400) } });
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
  if (extra) await page.addInitScript({ content: fs.readFileSync(extra, 'utf8') });
  await page.goto(url);
  await page.waitForFunction(() => window.jongclub, null, { timeout: 120000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const app = window.jongclub; const t = app.table; const r = t.renderer; const orig = r.render.bind(r);
    window.__f = []; window.__ev = [];
    r.render = (s, c) => { const a = performance.now(); orig(s, c); const gl = r.getContext(); gl.getError(); const b = performance.now(); window.__f.push({ t: a, d: b - a, calls: r.info.render.calls, tri: r.info.render.triangles, prog: r.info.programs.length, tex: r.info.memory.textures }); };
    app.startMatch({ ...app.lastConfig, timer: 0, pace: 'untimed' });
  });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { const m = window.jongclub.match; const o = m.onEvent.bind(m); m.onEvent = (e) => { const a = performance.now(); o(e); window.__ev.push({ t: a, type: e.type, seat: e.seat, d: performance.now() - a }); }; const L = m.table.layout.bind(m.table); m.table.layout = (...x) => { const a = performance.now(); const r = L(...x); window.__ev.push({ t: a, type: 'layout', d: performance.now() - a }); return r; }; });
  let mine = 0, guard = 0;
  while (mine < N && guard++ < 3000) {
    const st = await page.evaluate(() => {
      const m = window.jongclub.match; if (!m) return 'none';
      const ph = m.game.state.phase;
      const pass = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Pass' && b.offsetParent);
      if (pass) { pass.click(); return 'pass'; }
      if (ph.kind === 'handOver') { const b=[...document.querySelectorAll('button')].find((b)=>/Next hand|Continue/.test(b.textContent)&&b.offsetParent); b&&b.click(); return 'over'; }
      if (ph.kind === 'turn' && ph.seat === m.me && m.table.interactive.size) { const id = [...m.table.interactive][0]; m.table.onTileClick(id); m.table.onTileClick(id); return 'disc'; }
      return ph.kind;
    });
    if (st === 'disc') mine++;
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(2000);
  const { f, ev } = await page.evaluate(() => ({ f: window.__f, ev: window.__ev }));
  const ds = ev.filter((e) => e.type === 'discard').map((e) => e.t);
  const near = (t) => ds.some((d) => t >= d && t < d + 1500);
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
  const late = f.filter((x) => x.t > (f[0]?.t ?? 0) + 4000);
  const a = late.filter((x) => near(x.t)).map((x) => x.d), b = late.filter((x) => !near(x.t)).map((x) => x.d);
  const progs = [...new Set(f.map((x) => x.prog))];
  console.log(`${br || 'chromium'}: frames ${f.length}; render ms median after-discard ${med(a).toFixed(0)} (max ${Math.max(...a).toFixed(0)}) vs other ${med(b).toFixed(0)} (max ${Math.max(...b).toFixed(0)}); draw calls median ${med(f.map(x=>x.calls))}, triangles ${med(f.map(x=>x.tri))}; programs seen ${progs.join(',')}; textures ${med(f.map(x=>x.tex))}`);
  const evs = {}; for (const e of ev) (evs[e.type] ??= []).push(e.d);
  console.log('JS per event (ms): ' + Object.entries(evs).map(([k, v]) => `${k} n${v.length} avg ${(v.reduce((x, y) => x + y, 0) / v.length).toFixed(1)} max ${Math.max(...v).toFixed(0)}`).join('; '));
  // programs growing after start = shader compiles mid-game
  let last = 0; for (const x of f) { if (x.prog !== last) { console.log('  programs', last, '->', x.prog, 'at', (x.t - f[0].t).toFixed(0), 'ms, frame', x.d.toFixed(0), 'ms'); last = x.prog; } }
  await browser.close();
})();
