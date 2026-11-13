// node perf/audio/render.cjs <outdir>  (vite dev server on :5311)
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('console', (m) => m.type() === 'error' && console.log('page:', m.text()));
  await p.goto('http://localhost:5311/perf/audio/index.html');
  await p.waitForFunction(() => window.renderAudio);
  for (const [what, sec] of [['music', 150], ['room', 30], ['hk-teahouse', 60], ['tokyo-janso', 60], ['al-fahidi-majlis', 60]]) {
    const r = await p.evaluate(([w, s]) => window.renderAudio(w, s), [what, sec]);
    const pcm = Buffer.from(r.b64, 'base64');
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
    h.writeUInt32LE(44100, 24); h.writeUInt32LE(44100 * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
    fs.writeFileSync(`${out}/${what}.wav`, Buffer.concat([h, pcm]));
    console.log(what, 'samples', r.n, 'clipped', r.clip);
  }
  await b.close();
})();
