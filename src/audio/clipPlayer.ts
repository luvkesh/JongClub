// Plays recorded voice clips (Mei, the table callers) through the game's Web
// Audio context rather than a fresh <audio> element per clip.
// Safari only lets an <audio> element start inside a tap, or shortly after
// one, so clips started later by the game (the third and fourth players'
// discards, a line after a timer) were silently refused. Once the context has
// been unlocked by the first tap it can play any number of clips at any time.
// Without a running context (no tap yet, or no Web Audio) it falls back to an
// <audio> element.

import { sound } from './sound';

export interface PlayingClip {
  /** Settles when the clip ends, fails or is stopped. */
  done: Promise<void>;
  stop(): void;
}

const buffers = new Map<string, Promise<AudioBuffer | null>>();

/** Decode a clip once; later plays reuse the buffer. */
function decode(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  let p = buffers.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => r.arrayBuffer())
      // The callback form, for older Safari.
      .then((b) => new Promise<AudioBuffer>((res, rej) => ctx.decodeAudioData(b, res, rej)))
      .catch(() => {
        buffers.delete(url);
        return null;
      });
    buffers.set(url, p);
  }
  return p;
}

let wired = false;
/** Safari can suspend the context again (a call, the app in the background): any tap resumes it. */
function wire() {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  const resume = () => {
    const c = sound.context;
    if (c && c.state !== 'running') void c.resume().catch(() => {});
  };
  window.addEventListener('pointerdown', resume, true);
  window.addEventListener('keydown', resume, true);
  // iOS 17+: let voices play even with the ring/silent switch on, like <audio> does.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) {
    try {
      session.type = 'playback';
    } catch {
      /* ignore */
    }
  }
}

/** Start decoding clips ahead of time, so the first call of each plays without delay. */
export function warmClips(urls: Iterable<string>) {
  const ctx = sound.context;
  if (!ctx) return;
  const todo = [...urls].filter((u) => !buffers.has(u));
  // A few at a time, when the page is idle, so a match never stutters while they decode.
  const idle = (f: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(f, { timeout: 500 }) : setTimeout(f, 50));
  const step = () => {
    const batch = todo.splice(0, 8);
    if (!batch.length) return;
    void Promise.all(batch.map((u) => decode(ctx, u))).then(() => idle(step));
  };
  idle(step);
}

function viaElement(url: string, volume: number): PlayingClip {
  const a = new Audio(url);
  a.volume = Math.min(1, volume);
  let settle!: () => void;
  const done = new Promise<void>((r) => (settle = r));
  a.onended = a.onerror = () => settle();
  a.play().catch(() => settle());
  return {
    done,
    stop: () => {
      a.pause();
      settle();
    },
  };
}

/** Play a clip (a data:, blob: or same-origin URL). */
export function playClip(url: string, volume = 1): PlayingClip {
  wire();
  const ctx = sound.context;
  // Not unlocked yet (no tap so far): a suspended context would hold the clip forever.
  if (!ctx || ctx.state !== 'running') {
    if (ctx) void ctx.resume().catch(() => {});
    return viaElement(url, volume);
  }
  let stopped = false;
  let src: AudioBufferSourceNode | null = null;
  let settle!: () => void;
  const done = new Promise<void>((r) => (settle = r));
  void decode(ctx, url).then((buf) => {
    if (stopped) return settle();
    if (!buf) {
      // Undecodable here: let the browser's own player try.
      const el = viaElement(url, volume);
      void el.done.then(settle);
      return;
    }
    src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(ctx.destination);
    src.onended = () => settle();
    src.start();
  });
  return {
    done,
    stop: () => {
      stopped = true;
      try {
        src?.stop();
      } catch {
        /* already ended */
      }
      settle();
    },
  };
}
