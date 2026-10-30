// Layout overflow check: opens each screen at desktop, iPad and phone sizes and
// reports anything that spills out of its card or clips its own text, and any
// sideways page scroll. Run it before every publish:
//   npx vite --port 5311 &   then   node scripts/check-layout.mjs [baseUrl]
// Exits 1 when something overflows, listing screen, size and the element.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node-tools/node_modules/playwright'));
}

const base = process.argv[2] || 'http://127.0.0.1:5311/';
const SIZES = { desktop: [1440, 900], laptop: [1280, 800], 'ipad-land': [1180, 820], 'ipad-port': [820, 1180], phone: [390, 844], 'small-phone': [360, 740] };
// Screens, with an optional step: open the first item pop-over, or switch tab.
const SCREENS = (process.env.SCREENS || 'home,play,learn,club,collection,collection>view,atelier,atelier>view,profile,daily,minigames,store').split(',');
// Boxes whose contents must stay inside them.
const BOXES = '.cc-card, .card, .iv-card, .lux-card, .cc-strip, .cc-top, .pf-hero, .tile-card, .ec-card, .ec-item, .ec-bundle, .ec-pack, .ec-day, .ec-daily';

const problems = [];
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [size, [w, hh]] of Object.entries(SIZES)) {
  const touch = w < 1000;
  const ctx = await b.newContext({ viewport: { width: w, height: hh }, hasTouch: touch, isMobile: w < 500 });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('jongclub.quality.v1', 'low');
      localStorage.setItem('jongclub.onboarded', '1');
    } catch {}
  });
  const pg = await ctx.newPage();
  for (const s of SCREENS) {
    const [scr, step] = s.split('>');
    await pg.goto(base + '#' + scr, { timeout: 120000 });
    await pg.waitForTimeout(3500);
    if (step === 'view') {
      await pg.evaluate(() => document.querySelector('.cc-card')?.click());
      await pg.waitForTimeout(1500);
    }
    const found = await pg.evaluate((BOXES) => {
      const out = [];
      const name = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}${el.textContent ? ` "${el.textContent.trim().slice(0, 30)}"` : ''}`;
      const visible = (el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return cs.visibility !== 'hidden' && cs.display !== 'none' && r.width > 0 && r.height > 0;
      };
      // Inside a sideways scroller (category strips, carousels) overflow is intended.
      const inScroller = (el, stop) => {
        for (let p = el.parentElement; p && p !== stop; p = p.parentElement) if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) return true;
        return false;
      };
      const se = document.scrollingElement;
      if (se.scrollWidth > innerWidth + 1) out.push(`page scrolls sideways (${se.scrollWidth}px wide in ${innerWidth}px)`);
      for (const box of document.querySelectorAll(BOXES)) {
        if (!visible(box) || inScroller(box, null)) continue;
        const br = box.getBoundingClientRect();
        for (const el of box.querySelectorAll('*')) {
          if (!visible(el) || inScroller(el, box) || el.closest('svg, canvas')) continue;
          if (getComputedStyle(el).position === 'absolute' && el.closest('.iv-pic, .cc-prev, .item-prev')) continue;
          const r = el.getBoundingClientRect();
          if (r.right > br.right + 1.5 || r.left < br.left - 1.5) {
            out.push(`${name(el)} spills out of ${name(box).slice(0, 60)} by ${Math.round(Math.max(r.right - br.right, br.left - r.left))}px`);
            break;
          }
        }
      }
      // Buttons and labels that cut their own text.
      for (const el of document.querySelectorAll('button, .btn, label, .cc-count, .cc-price, .cc-state')) {
        if (!visible(el) || inScroller(el, null)) continue;
        const cs = getComputedStyle(el);
        if (cs.textOverflow === 'ellipsis') continue;
        if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== 'visible') out.push(`${name(el)} clips its text (${el.scrollWidth} > ${el.clientWidth})`);
      }
      return [...new Set(out)].slice(0, 12);
    }, BOXES);
    for (const f of found) problems.push(`${s} @ ${size}: ${f}`);
    process.stdout.write(found.length ? 'x' : '.');
  }
  await ctx.close();
}
await b.close();
console.log('');
if (problems.length) {
  console.log(problems.join('\n'));
  process.exit(1);
}
console.log('layout check: nothing overflows');
