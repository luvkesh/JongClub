// node perf/tiles3d/capture.cjs OUTDIR mode set1,set2 [kinds]   (vite on :5311)
// mode: closeup | portrait | dump
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
(async () => {
  const [out, mode, sets, kinds] = [process.argv[2], process.argv[3], process.argv[4].split(','), process.argv[5]];
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  p.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
  await p.goto('http://localhost:5311/perf/tiles3d/?scale=' + (process.env.SCALE || 4), { timeout: 180000 });
  await p.waitForFunction('window.ready', null, { timeout: 180000 });
  const save = (f, d) => fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64'));
  for (const id of sets) {
    if (mode === 'dump') {
      const ks = (kinds || '31').split(',').map(Number);
      const r = await p.evaluate(([id, ks]) => window.dump(id, ks), [id, ks]);
      const d = `${out}/${id}`; fs.mkdirSync(d, { recursive: true });
      for (const k of Object.keys(r.faces)) { save(`${d}/face-${k}.png`, r.faces[k].face); save(`${d}/surface-${k}.png`, r.faces[k].surface); }
      save(`${d}/body.png`, r.body); save(`${d}/back.png`, r.back);
      fs.writeFileSync(`${d}/style.json`, JSON.stringify({ style: r.style, finish: r.finish }, null, 1));
    } else {
      const r = await p.evaluate(([m, id, k]) => window[m](id, k ? Number(k) : undefined), [mode, id, kinds]);
      save(`${out}/${id}-${mode}.${r.startsWith('data:image/webp') ? 'webp' : 'png'}`, r);
    }
    console.log('ok', id);
  }
  await b.close();
})();
