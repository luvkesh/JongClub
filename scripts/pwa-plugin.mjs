// Makes the plain web build (`vite build`, dist/) an installable app: writes the
// web app manifest and its icons (from brand/png), links them from index.html,
// and writes sw.js (scripts/pwa/sw.js) with the build's own file list.
// The single-file builds (Artifact, standalone) do not use it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const ICONS = [
  { src: 'brand/png/jongclub-app-icon-192.png', out: 'icons/app-192.png', size: 192, purpose: 'any' },
  { src: 'brand/png/jongclub-app-icon-512.png', out: 'icons/app-512.png', size: 512, purpose: 'any' },
  { src: 'brand/png/jongclub-app-icon-512.png', out: 'icons/app-512.png', size: 512, purpose: 'maskable' },
  { src: 'brand/png/jongclub-app-icon-180.png', out: 'icons/apple-touch-icon.png', size: 180 },
];
/** Chunks holding recorded voices: cached the first time they are used, not on install. */
const AUDIO_CHUNK = /(^|\/)(narration|callers)\.gen-[^/]+\.js$/;

export const MANIFEST = {
  name: 'JongClub',
  short_name: 'JongClub',
  description: 'The Table Awaits. Learn. Play. Master.',
  id: './',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'any',
  background_color: '#090d0b',
  theme_color: '#090d0b',
  categories: ['games', 'education'],
  icons: ICONS.filter((i) => i.purpose).map((i) => ({ src: i.out, sizes: `${i.size}x${i.size}`, type: 'image/png', purpose: i.purpose })),
};

export function pwaPlugin() {
  return {
    name: 'jongclub-pwa',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml() {
      return [
        { tag: 'link', attrs: { rel: 'manifest', href: 'manifest.webmanifest' }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: 'icons/apple-touch-icon.png' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'mobile-web-app-capable', content: 'yes' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: 'JongClub' }, injectTo: 'head' },
      ];
    },
    generateBundle(_opts, bundle) {
      const done = new Set();
      for (const i of ICONS) {
        if (done.has(i.out)) continue;
        done.add(i.out);
        this.emitFile({ type: 'asset', fileName: i.out, source: readFileSync(root + i.src) });
      }
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify(MANIFEST, null, 2) });
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const audio = files.filter((f) => AUDIO_CHUNK.test(f));
      const shell = [...new Set(['./', 'manifest.webmanifest', ...done, ...files.filter((f) => !AUDIO_CHUNK.test(f) && f !== 'index.html')])];
      // The build's own hashed names version the cache.
      let h = 0;
      for (const ch of files.sort().join('|')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      const sw = readFileSync(root + 'scripts/pwa/sw.js', 'utf8')
        .replace('__VERSION__', JSON.stringify(h.toString(36)))
        .replace('__SHELL__', JSON.stringify(shell))
        .replace('__AUDIO__', JSON.stringify(audio));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
    },
  };
}
