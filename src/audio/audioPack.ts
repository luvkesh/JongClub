// Recorded audio: Mei's narration and the table callers' voices.
// Normal builds embed the clips, but in their own chunks (narration.gen.ts is
// tens of megabytes), loaded with import() after the first screen is up: the
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

interface Pack {
  index: Record<string, [number, number, number]>;
  bufs: ArrayBuffer[];
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
async function fetchPack(file: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(packUrl(file));
      if (r.ok) return r;
      if (attempt >= 1) throw new Error(`audio/${file}: ${r.status}`);
    } catch (e) {
      if (attempt >= 1) throw e;
    }
    await new Promise((res) => setTimeout(res, 700));
  }
}

function load(name: string): Promise<Pack | null> {
  let p = packs.get(name);
  if (!p) {
    p = fetchPack(`${name}.json`)
      .then((r) => r.json() as Promise<{ parts: number; index: Pack['index'] }>)
      .then(async ({ parts, index }) => ({
        index,
        bufs: await Promise.all(Array.from({ length: parts }, (_, i) => fetchPack(`${name}-${i}.mp3`).then((r) => r.arrayBuffer()))),
        urls: new Map(),
      }))
      .catch(() => {
        // Forget the failure after a while, so a later line can try the network again.
        setTimeout(() => packs.get(name) === p && packs.delete(name), 15000);
        return null;
      });
    packs.set(name, p);
  }
  return p;
}

const loaded = new Map<string, Pack | null>();

function clipUrl(pack: Pack | null | undefined, key: string): string | undefined {
  if (!pack) return undefined;
  let u = pack.urls.get(key);
  if (!u) {
    const at = pack.index[key];
    if (!at) return undefined;
    u = URL.createObjectURL(new Blob([pack.bufs[at[0]].slice(at[1], at[1] + at[2])], { type: 'audio/mpeg' }));
    pack.urls.set(key, u);
  }
  return u;
}

function preload(name: string) {
  void load(name).then((p) => {
    if (p) loaded.set(name, p);
  });
}

/**
 * Start loading the recorded voices without blocking anything: the callers
 * (small, needed at the table) first, then Mei's narration. On a metered or
 * very slow connection the narration waits until a line actually needs it.
 */
export function preloadAudio() {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  const frugal = !!conn && (conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType ?? ''));
  if (!SIDECAR) {
    void embeddedVoices().then(() => {
      if (!frugal) void embeddedClips();
    });
    return;
  }
  preload('callers');
  if (!frugal) preload('narration');
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
  return clipUrl(loaded.get('callers'), `${voice}|${phrase}`);
}

/** A caller's clip for a phrase, waiting for the pack if it is still loading (Mei's composed lines). */
export async function callerClipAsync(voice: string, phrase: string): Promise<string | undefined> {
  if (!SIDECAR) return (await embeddedVoices()).find((v) => v.id === voice)?.clips[phrase];
  const pack = await load('callers');
  if (pack) loaded.set('callers', pack);
  return clipUrl(pack, `${voice}|${phrase}`);
}
