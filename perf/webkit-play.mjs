// WebKit (WebKitGTK MiniBrowser over WebDriver, under Xvfb): play N of your discards and report
// main-thread stalls (timer lag) and frame gaps. usage: node perf/webkit-play.mjs URL [discards]
const [url, nArg] = process.argv.slice(2);
const N = Number(nArg || 6);
const W = 'http://127.0.0.1:4444';
const call = async (method, path, body) => { const r = await fetch(W + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) }); const j = await r.json(); if (j.value?.error) throw new Error(j.value.message); return j.value; };
const s = await call('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'MiniBrowser', 'webkitgtk:browserOptions': { binary: '/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/MiniBrowser', args: ['--automation', '--geometry=640x400'] } } } }).catch(async () => call('POST', '/session', { capabilities: { alwaysMatch: { 'webkitgtk:browserOptions': { binary: (await import('fs')).readdirSync('/usr/lib/x86_64-linux-gnu').filter(d=>d.startsWith('webkit2gtk')).map(d=>`/usr/lib/x86_64-linux-gnu/${d}/MiniBrowser`)[0], args: ['--automation'] } } } }));
const sid = s.sessionId;
const run = (script, args = []) => call('POST', `/session/${sid}/execute/sync`, { script, args });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await call('POST', `/session/${sid}/url`, { url });
  for (let i = 0; i < 120 && !(await run('return !!window.jongclub')); i++) await sleep(1000);
  await sleep(3000);
  console.log('ua', await run('return navigator.userAgent'), 'tier', await run('return window.jongclub.table.quality'), 'pr', await run('return window.jongclub.table.renderer.getPixelRatio()'));
  await run(`window.__lag=[];let last=performance.now();setInterval(()=>{const n=performance.now();const l=n-last-50;if(l>60)window.__lag.push(l);last=n;},50);
    window.__gaps=[];let lf=0;const tick=(t)=>{if(lf&&t-lf>120)window.__gaps.push(t-lf);lf=t;requestAnimationFrame(tick)};requestAnimationFrame(tick);
    window.jongclub.startMatch({...window.jongclub.lastConfig,timer:0,pace:'untimed'});`);
  await sleep(3000);
  await run(`const m=window.jongclub.match;window.__ev=[];const o=m.onEvent.bind(m);m.onEvent=(e)=>{const a=performance.now();o(e);window.__ev.push([e.type,performance.now()-a]);};window.__lag=[];window.__gaps=[];window.__t0=performance.now();`);
  let mine = 0;
  for (let g = 0; g < 2000 && mine < N; g++) {
    const st = await run(`const m=window.jongclub.match;if(!m)return'';const ph=m.game.state.phase;
      const pass=[...document.querySelectorAll('button')].find((b)=>b.textContent.trim()==='Pass'&&b.offsetParent);if(pass){pass.click();return'pass';}
      if(ph.kind==='handOver'){const b=[...document.querySelectorAll('button')].find((b)=>/Next hand|Continue/.test(b.textContent)&&b.offsetParent);b&&b.click();return'over';}
      if(ph.kind==='turn'&&ph.seat===m.me&&m.table.interactive.size){const id=[...m.table.interactive][0];m.table.onTileClick(id);m.table.onTileClick(id);return'disc';}return ph.kind;`);
    if (st === 'disc') mine++;
    await sleep(200);
  }
  await sleep(2000);
  const r = await run(`return {lag:window.__lag,gaps:window.__gaps,ev:window.__ev,el:performance.now()-window.__t0}`);
  const top = (a) => a.slice().sort((x, y) => y - x).slice(0, 6).map((x) => x.toFixed(0)).join(' ');
  const disc = r.ev.filter((e) => e[0] === 'discard').map((e) => e[1]);
  console.log(`webkit: ${mine} discards in ${(r.el / 1000).toFixed(0)}s; timer stalls >60ms: ${r.lag.length} (worst ${top(r.lag)}); frame gaps >120ms: ${r.gaps.length} (worst ${top(r.gaps)}); JS per discard event avg ${(disc.reduce((a, b) => a + b, 0) / disc.length).toFixed(1)} ms max ${Math.max(...disc).toFixed(0)}`);
} finally { await call('DELETE', `/session/${sid}`).catch(() => {}); }
