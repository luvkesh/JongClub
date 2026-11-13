// Renders the generated music and room sound offline, faster than real time, so
// perf/audio/check.cjs can measure loudness and look for clicks. Timers the
// music sets with window.setTimeout are driven by the offline clock.
type T = { due: number; fn: () => void; id: number };
let q: T[] = [];
let nextId = 1;
let clock = 0;
(window as any).setTimeout = (fn: () => void, ms = 0) => { const id = nextId++; q.push({ due: clock + ms / 1000, fn, id }); return id; };
(window as any).clearTimeout = (id: number) => { q = q.filter((t) => t.id !== id); };
(window as any).setInterval = (fn: () => void, ms = 0) => { const id = nextId++; const tick = () => { fn(); q.push({ due: clock + ms / 1000, fn: tick, id }); }; q.push({ due: clock + ms / 1000, fn: tick, id }); return id; };
(window as any).clearInterval = (window as any).clearTimeout;

async function render(what: string, seconds: number): Promise<Float32Array[]> {
  const sr = 44100;
  const ctx = new OfflineAudioContext(2, sr * seconds, sr);
  q = []; clock = 0;
  const out = ctx.createGain();
  out.connect(ctx.destination);
  if (what === 'music') {
    const { ZenMusic } = await import('../../src/audio/zen');
    new ZenMusic(ctx as unknown as AudioContext, out);
  } else {
    const { sound } = await import('../../src/audio/sound');
    const { ambience } = await import('../../src/audio/ambience');
    const s = sound as any;
    s.ctx = ctx; s.buses = { effects: ctx.createGain(), music: ctx.createGain(), ambient: out };
    s.noise = ctx.createBuffer(1, sr, sr);
    const d = s.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (what === 'room') s.startAmbient();
    else ambience.set(what);
  }
  const step = 0.05;
  for (let t = step; t < seconds; t += step) {
    const at = t;
    ctx.suspend(at).then(() => {
      clock = at;
      const due = q.filter((x) => x.due <= at).sort((a, b) => a.due - b.due);
      q = q.filter((x) => x.due > at);
      for (const x of due) try { x.fn(); } catch (e) { console.error(e); }
      ctx.resume();
    });
  }
  const buf = await ctx.startRendering();
  return [buf.getChannelData(0), buf.getChannelData(1)];
}
(window as any).renderAudio = async (what: string, seconds: number) => {
  const [l, r] = await render(what, seconds);
  const i16 = new Int16Array(l.length * 2);
  let clip = 0;
  for (let i = 0; i < l.length; i++) {
    for (const [j, v] of [[0, l[i]], [1, r[i]]] as const) { if (Math.abs(v) >= 1) clip++; i16[i * 2 + j] = Math.max(-32768, Math.min(32767, Math.round(v * 32767))); }
  }
  let s = ''; const u8 = new Uint8Array(i16.buffer);
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return { b64: btoa(s), clip, n: l.length };
};
// The same random draws on every run, so renders before and after a change compare like for like.
let seed = 12345;
Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
