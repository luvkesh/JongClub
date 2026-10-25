import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { pwaPlugin } from './scripts/pwa-plugin.mjs';

// `--mode artifact` inlines the app into one HTML file for preview hosting, with the
// recorded audio published beside it (scripts/pack-audio.mjs). `--mode standalone`
// inlines everything, audio included, into one file that works offline. The plain
// build is an installable web app: manifest, icons and a service worker (scripts/pwa-plugin.mjs).
export default defineConfig(({ mode }) => ({
  plugins: mode === 'artifact' || mode === 'standalone' ? [viteSingleFile()] : [pwaPlugin()],
  // Keep line breaks in the preview build: a fully minified bundle can put a long unbroken run right after an
  // `id=` (an esbuild-renamed variable), which the preview host mistakes for a review page and refuses.
  esbuild: mode === 'artifact' ? { minifyWhitespace: false } : undefined,
  // Faces kept on the device (src/render/faceStore.ts) are only reused within the same build.
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  build: { outDir: mode === 'artifact' ? 'dist-artifact' : mode === 'standalone' ? 'dist-standalone' : 'dist', chunkSizeWarningLimit: 1200 },
}));
