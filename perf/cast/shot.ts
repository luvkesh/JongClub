// In-game portraits of the named cast, for before/after sheets: node perf/cast/capture.cjs OUTDIR (vite on :4430).
import { avatarPortraitUrl } from '../../src/render/avatar3d';
import { CAST } from '../../src/cosmetics/cast';
(window as any).shot = (name: string, size = 200) => avatarPortraitUrl({ ...CAST[name] }, size);
(window as any).names = Object.keys(CAST);
(window as any).ready = true;
