// Recorded audio: Mei's narration and the table callers' voices.
// Normal builds embed the clips, but in their own chunks (narration.gen.ts merges
// parts of over 100 MB together), loaded with import() after the first screen is up: the
// plain build fetches them as separate files, the single-file builds inline
// them but still parse them only when asked. The Artifact build (which has a
// page size limit) leaves them out and loads two packs published next to the page:
// audio/<name>.json maps each clip to a byte range of one of the parts audio/<name>-<n>.mp3.
// Clips become object URLs on first use.

import type { CallerVoice } from './callers.gen';

const SIDECAR = import.meta.env.MODE === 'artifact';

// ------------------------------------------------------------ embedded chunks

let clipsP: Promise<Record<string, string>> | null = null;
let voicesP: Promise<CallerVoice[]> | null = null;
let voicesNow: CallerVoice[] | null = null;

/** Mei's embedded clips, loading their chunk on first call. A failed load (offline, first visit) is retried next time. */
function embeddedClips(): Promise<Record<string, string>> {
  clipsP ??= import('./narration.gen').then(
    (m) => m.CLIPS,
    () => {
      clipsP = null;
      return {};
    },
  );
  return clipsP;
}

/** The callers' embedded clips, loading their chunk on first call. */
function embeddedVoices(): Promise<CallerVoice[]> {
  voicesP ??= import('./callers.gen').then(
    (m) => (voicesNow = m.CALLER_VOICES),
    () => {
      voicesP = null;
      return [];
    },
  );
  return voicesP;
}

let pitchP: Promise<Record<string, string>> | null = null;

/** Mei's Atelier pitches (the item View pop-over), loading their chunk on first call. */
function embeddedPitch(): Promise<Record<string, string>> {
  pitchP ??= import('./pitch.gen').then(
    (m) => m.CLIPS,
    () => {
      pitchP = null;
      return {};
    },
  );
  return pitchP;
}

/** Bytes already on the device for one part: the whole part, or a window fetched with a Range request. */
interface Chunk {
  start: number;
  buf: ArrayBuffer;
}

interface Pack {
  name: string;
  index: Record<string, [number, number, number]>;
  /** Each part's length in bytes, worked out from the index. */
  sizes: number[];
  /** Whole parts held in memory. */
  bufs: (ArrayBuffer | undefined)[];
  wholeP: (Promise<ArrayBuffer | null> | undefined)[];
  /** Windows of a part fetched by byte range, newest last. */
  chunks: Chunk[][];
  /** Whether the host answers Range requests: null until the first try. */
  ranged: boolean | null;
  urls: Map<string, string>;
}

const packs = new Map<string, Promise<Pack | null>>();

/** A pack file, resolved against the page (so a page served from a sub-path still finds audio/). */
function packUrl(file: string): string {
  try {
    return new URL(`audio/${file}`, document.baseURI).href;
  } catch {
    return `audio/${file}`;
  }
}

/** Fetch a pack file; a failed request (a dropped connection, a cold CDN) is retried once. */
async function fetchPack(file: string, range?: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(packUrl(file), range ? { headers: { Range: range } } : undefined);
      if (r.ok) return r;
      if (attempt >= 1) throw new Error(`audio/${file}: ${r.status}`);
    } catch (e) {
      if (attempt >= 1) throw e;
    }
    await new Promise((res) => setTimeout(res, 700));
  }
}

/**
 * A pack's index (a few kilobytes). The audio itself is not fetched here: Mei's narration is close
 * to 90 MB, far too much to pull down on a first visit just to show the Home screen.
 */
function load(name: string): Promise<Pack | null> {
  let p = packs.get(name);
  if (!p) {
    p = fetchPack(`${name}.json`)
      .then((r) => r.json() as Promise<{ parts: number; index: Pack['index'] }>)
      .then(({ parts, index }): Pack => {
        const sizes = new Array<number>(parts).fill(0);
        for (const [part, at, len] of Object.values(index)) sizes[part] = Math.max(sizes[part], at + len);
        return { name, index, sizes, bufs: new Array(parts), wholeP: new Array(parts), chunks: sizes.map(() => []), ranged: null, urls: new Map() };
      })
      .catch(() => {
        // Forget the failure after a while, so a later line can try the network again.
        setTimeout(() => packs.get(name) === p && packs.delete(name), 15000);
        return null;
      });
    packs.set(name, p);
  }
  return p;
}

/** One whole part, fetched once. A failed fetch can be tried again by a later line. */
function wholePart(pack: Pack, part: number): Promise<ArrayBuffer | null> {
  return (pack.wholeP[part] ??= fetchPack(`${pack.name}-${part}.mp3`)
    .then((r) => r.arrayBuffer())
    .then((buf) => {
      pack.chunks[part] = [];
      return (pack.bufs[part] = buf);
    })
    .catch(() => {
      pack.wholeP[part] = undefined;
      return null;
    }));
}

/** Every part, one after another (for hosts that cannot serve a byte range, and the small callers pack). */
async function wholePack(pack: Pack): Promise<boolean> {
  for (let i = 0; i < pack.sizes.length; i++) if (!(await wholePart(pack, i))) return false;
  return true;
}

/** How far past the asked-for clip a Range request reads: the next few lines of the same lesson come with it. */
const AHEAD = 640 * 1024;

const mp3Url = (bytes: ArrayBuffer) => URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));

/** A clip cut from bytes already in memory, if they cover it. */
function clipNow(pack: Pack | null | undefined, key: string): string | undefined {
  if (!pack) return undefined;
  let u = pack.urls.get(key);
  if (u) return u;
  const at = pack.index[key];
  if (!at) return undefined;
  const [part, off, len] = at;
  const whole = pack.bufs[part];
  if (whole) u = mp3Url(whole.slice(off, off + len));
  else {
    const c = pack.chunks[part].find((c) => c.start <= off && off + len <= c.start + c.buf.byteLength);
    if (c) u = mp3Url(c.buf.slice(off - c.start, off - c.start + len));
  }
  if (u) pack.urls.set(key, u);
  return u;
}

/**
 * A clip, fetching only the bytes it needs: a Range request for the clip and the lines after it.
 * Where the host ignores Range and sends the whole part, that part is kept and the rest follow in
 * the background (unless the connection is metered), so later lines play at once.
 */
async function clipUrl(pack: Pack | null, key: string): Promise<string | undefined> {
  const have = clipNow(pack, key);
  if (have || !pack) return have;
  const at = pack.index[key];
  if (!at) return undefined;
  const [part, off, len] = at;
  if (pack.ranged !== false && !pack.wholeP[part]) {
    try {
      const end = Math.min(pack.sizes[part], off + len + AHEAD) - 1;
      const r = await fetchPack(`${pack.name}-${part}.mp3`, `bytes=${off}-${end}`);
      const buf = await r.arrayBuffer();
      if (r.status === 206 && buf.byteLength >= len && buf.byteLength < pack.sizes[part]) {
        pack.ranged = true;
        const chunks = pack.chunks[part];
        chunks.push({ start: off, buf });
        if (chunks.length > 6) chunks.shift();
      } else if (buf.byteLength >= pack.sizes[part]) {
        pack.ranged = false;
        pack.bufs[part] = buf;
        pack.wholeP[part] = Promise.resolve(buf);
        if (!frugal()) void wholePack(pack);
      } else pack.ranged = false;
    } catch {
      /* fall through to the whole part */
    }
    const got = clipNow(pack, key);
    if (got) return got;
  }
  await wholePart(pack, part);
  return clipNow(pack, key);
}

const loaded = new Map<string, Pack | null>();

/** Bring a whole (small) pack into memory, so its clips can be handed out without waiting. */
function preload(name: string) {
  void load(name).then(async (p) => {
    if (p && (await wholePack(p))) loaded.set(name, p);
  });
}

/** A metered or very slow connection: fetch nothing until a line actually needs it. */
function frugal(): boolean {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!conn && (conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType ?? ''));
}

/**
 * Start loading the recorded voices without blocking anything. Embedded builds load the callers
 * (small, needed at the table) first, then Mei's narration. The preview build fetches the callers
 * and only the index of Mei's narration: her clips are fetched line by line as they are spoken.
 */
export function preloadAudio() {
  if (!SIDECAR) {
    void embeddedVoices().then(() => {
      if (!frugal()) void embeddedClips();
    });
    return;
  }
  preload('callers');
  if (!frugal()) void load('narration');
}

/** Whether Mei's recorded clips exist in this build (the generator always writes them). */
export const hasNarration = true;

/** Mei's clip for a line key, waiting for the clips to load if they are still on their way. */
export async function narrationClip(key: string): Promise<string | undefined> {
  if (!SIDECAR) return (await embeddedClips())[key];
  return clipUrl(await load('narration'), key);
}

/** Mei's pitch for an Atelier item, by line key; the pack loads on first use (a View tap), not at start. */
export async function pitchClip(key: string): Promise<string | undefined> {
  if (!SIDECAR) return (await embeddedPitch())[key];
  return clipUrl(await load('pitch'), key);
}

export interface CallerMeta {
  id: string;
  name: string;
  gender: 'female' | 'male';
}

/** The eight table voices (kept in sync with scripts/record-callers.py). */
export const CALLERS: CallerMeta[] = [
  { id: 'mei', name: 'Mei', gender: 'female' },
  { id: 'lin', name: 'Lin', gender: 'female' },
  { id: 'grace', name: 'Grace', gender: 'female' },
  { id: 'sakura', name: 'Sakura', gender: 'female' },
  { id: 'wei', name: 'Wei', gender: 'male' },
  { id: 'george', name: 'George', gender: 'male' },
  { id: 'kenji', name: 'Kenji', gender: 'male' },
  { id: 'omar', name: 'Omar', gender: 'male' },
];

/** A caller's clip for a phrase, if it is ready now (calls never wait). */
export function callerClip(voice: string, phrase: string): string | undefined {
  if (!SIDECAR) {
    if (!voicesNow) void embeddedVoices();
    return voicesNow?.find((v) => v.id === voice)?.clips[phrase];
  }
  if (!loaded.has('callers')) preload('callers');
  return clipNow(loaded.get('callers'), `${voice}|${phrase}`);
}

/** A caller's clip for a phrase, waiting for the pack if it is still loading (Mei's composed lines). */
export async function callerClipAsync(voice: string, phrase: string): Promise<string | undefined> {
  if (!SIDECAR) return (await embeddedVoices()).find((v) => v.id === voice)?.clips[phrase];
  return clipUrl(await load('callers'), `${voice}|${phrase}`);
}
