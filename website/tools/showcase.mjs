// Renders the Atelier showcase pictures through the game's dev server.
//   npx vite --port 4430   (in the game folder), then
//   node website/tools/showcase.mjs <outDir> [tiles|racks|all] [id,id...] [dpr]
// Writes <kind>-<id>.png at full size; build the website's jpgs from them
// (tiles: 2880 x 1200 at dpr 2, saved as progressive jpg quality 84).
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';

const [out, which = 'all', only = '', dprArg = '2'] = process.argv.slice(2);
const dpr = +dprArg;
const pick = only ? only.split(',') : null;
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 400, height: 300 } });
p.setDefaultTimeout(900000);
p.on('pageerror', (e) => console.log('ERR', e.message));
p.on('console', (m) => m.type() === 'error' && console.log('console', m.text()));
await p.goto('http://localhost:4430/website/tools/showcase.html');
const ids = await p.evaluate(async () => {
  const tf = await import('/src/render/tileFaces.ts');
  await tf.loadTileFonts();
  const cat = await import('/src/cosmetics/catalog.ts');
  return {
    tiles: cat.CATALOG.filter((c) => c.category === 'tileSet').map((c) => c.id),
    racks: cat.CATALOG.filter((c) => c.category === 'rack').map((c) => c.id),
  };
});
if (which === 'winds') {
  for (const [k, n] of [[27, 'east'], [28, 'south'], [29, 'west'], [30, 'north']]) {
    const url = await p.evaluate(async ([k, dpr]) => (await import('/website/tools/showcase.ts')).singleTile(k, 'classic-ivory', 420, 460, dpr), [k, dpr]);
    fs.writeFileSync(`${out}/wind-${n}.png`, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wind', n);
  }
}
for (const kind of ['tiles', 'racks']) {
  if (which !== 'all' && which !== kind) continue;
  for (const [n, id] of ids[kind].entries()) {
    if (pick && !pick.includes(id)) continue;
    // Tile sets take turns on four stagings so neighbours in the carousel differ.
    const mode = ['plinths', 'disc', 'case', 'bare'][n % 4];
    const t0 = Date.now();
    // The dev server may reload the page (a file changed); reload and try again.
    let url;
    for (let tries = 0; ; tries++) {
      try {
        url = await p.evaluate(
      async ([kind, id, dpr, mode, n]) => {
        const s = await import('/website/tools/showcase.ts');
        // Tile sets: 1440 x 600 css px; at dpr 2 that is the website's 2880 x 1200 picture.
        return kind === 'tiles' ? s.tileShowcase(id, 1440, 600, dpr, mode, n) : s.rackShowcase(id, 'noyer', 1440, 792, dpr);
      },
      [kind, id, dpr, mode, n],
    );
        break;
      } catch (e) {
        if (tries >= 3) throw e;
        console.log('retry', id, e.message.split('\n')[0]);
        await p.goto('http://localhost:4430/website/tools/showcase.html');
        await p.evaluate(async () => (await import('/src/render/tileFaces.ts')).loadTileFonts());
      }
    }
    fs.writeFileSync(`${out}/${kind}-${id}.png`, Buffer.from(url.split(',')[1], 'base64'));
    console.log(kind, id, kind === 'tiles' ? mode : '', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
}
await b.close();
