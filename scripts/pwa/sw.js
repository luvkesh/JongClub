// JongClub service worker (plain web build only; see scripts/pwa-plugin.mjs).
// The app shell is cached on install, so the club opens and AI tables play
// offline. Recorded voices are large, so they are cached the first time they
// are fetched rather than up front. Placeholders are filled in at build time.

const VERSION = __VERSION__;
const SHELL = __SHELL__;
const AUDIO = __AUDIO__;

const SHELL_CACHE = `jongclub-shell-${VERSION}`;
const AUDIO_CACHE = 'jongclub-audio';
const FONT_CACHE = 'jongclub-fonts';
const scope = new URL(self.registration.scope);
const url = (p) => new URL(p, scope).href;
const shellUrls = new Set(SHELL.map(url));
const isAudio = (u) => AUDIO.some((p) => u.pathname.endsWith('/' + p)) || /\/audio\/[^/]+\.(mp3|json)$/.test(u.pathname);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll([...shellUrls])));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      // Drop older shells, and voice chunks this build no longer uses.
      for (const k of await caches.keys()) if (k.startsWith('jongclub-shell-') && k !== SHELL_CACHE) await caches.delete(k);
      const audio = await caches.open(AUDIO_CACHE);
      for (const req of await audio.keys()) if (!isAudio(new URL(req.url))) await audio.delete(req);
      await self.clients.claim();
    })(),
  );
});

/** Serve from a cache, fetching (and keeping) on a miss. */
async function cacheFirst(cacheName, req) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone()).catch(() => {});
  return res;
}

/** The page itself: the newest from the network, the cached shell when offline. */
async function page(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(SHELL_CACHE)).put(url('./'), res.clone()).catch(() => {});
    return res;
  } catch {
    return (await caches.match(url('./'))) ?? (await caches.match(url('index.html'))) ?? Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  // Range requests (media seeking) go straight to the network.
  if (req.headers.has('range')) return;
  if (u.origin === scope.origin) {
    if (req.mode === 'navigate') return e.respondWith(page(req));
    if (isAudio(u)) return e.respondWith(cacheFirst(AUDIO_CACHE, req));
    if (shellUrls.has(u.origin + u.pathname)) return e.respondWith(cacheFirst(SHELL_CACHE, req));
    return;
  }
  // Web fonts, so faces and type look the same offline.
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') e.respondWith(cacheFirst(FONT_CACHE, req));
});
