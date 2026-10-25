// Table sound effects from real recordings: tile-on-tile clacks and tiles landing on
// felt (see sfx.gen.ts and README "Sound effects"). Every hit picks a different
// take and varies its pitch, level, tone and stereo position slightly, so no two
// shuffles, draws or discards sound the same. Chimes stay synthesised.
// Three independent buses: effects, music, ambient.

import { SFX } from './sfx.gen';
import { ZenMusic } from './zen';

export type Sfx = 'click' | 'slide' | 'shuffle' | 'draw' | 'discard' | 'pung' | 'kong' | 'chow' | 'mahjong' | 'score' | 'button' | 'turn' | 'react' | 'riichi' | 'dice';

/** Tile material: chooses the timbre of every tile click, draw and discard. */
export type TileMaterial = 'ivory' | 'jade' | 'stone' | 'pearl' | 'crystal' | 'metal' | 'bamboo' | 'glass';

type Pool = 'clack' | 'wood' | 'metal' | 'felt' | 'table';

interface Voice {
  /** Which recorded tile-on-tile hits to use. */
  pool: 'clack' | 'wood' | 'metal';
  /** Playback rate: lower is a bigger, heavier tile. */
  rate: number;
  /** Low-pass cut-off (Hz): darker for dense stone, open for glass. */
  tone: number;
  /** How much the felt thud shows when a tile lands. */
  body: number;
  /** A faint glassy ring on top of the click (Hz, 0 for none). */
  ring: number;
}

const VOICES: Record<TileMaterial, Voice> = {
  // Warm, traditional melamine tiles: the default JongClub sound.
  ivory: { pool: 'clack', rate: 0.66, tone: 9000, body: 1, ring: 0 },
  jade: { pool: 'clack', rate: 0.57, tone: 6500, body: 1.25, ring: 0 },
  stone: { pool: 'clack', rate: 0.54, tone: 6000, body: 1.35, ring: 0 },
  pearl: { pool: 'clack', rate: 0.72, tone: 11000, body: 0.9, ring: 0 },
  crystal: { pool: 'clack', rate: 0.86, tone: 16000, body: 0.75, ring: 2480 },
  metal: { pool: 'metal', rate: 0.72, tone: 9000, body: 0.8, ring: 0 },
  bamboo: { pool: 'wood', rate: 0.78, tone: 8000, body: 1, ring: 0 },
  glass: { pool: 'clack', rate: 0.95, tone: 16000, body: 0.7, ring: 3100 },
};

export interface Volumes {
  effects: number;
  music: number;
  ambient: number;
}

interface HitOpts {
  gain?: number;
  /** Multiplies the material's playback rate. */
  rate?: number;
  /** -1 (left) to 1 (right). */
  pan?: number;
  /** Extra darkening for tiles further away (0 = none, 1 = very distant). */
  far?: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

class Sound {
  private ctx?: AudioContext;
  private buses?: Record<keyof Volumes, GainNode>;
  private noise?: AudioBuffer;
  private music?: ZenMusic;
  private musicIn?: GainNode;
  private samples: Partial<Record<Pool, AudioBuffer[]>> = {};
  private last: Partial<Record<Pool, number>> = {};
  volumes: Volumes = { effects: 0.8, music: 0.25, ambient: 0.35 };
  private voice: Voice = VOICES.ivory;
  material: TileMaterial = 'ivory';

  /** Choose the tile material, so clicks, draws and discards sound like it. Purely cosmetic. */
  setMaterial(m: TileMaterial) {
    this.material = VOICES[m] ? m : 'ivory';
    this.voice = VOICES[this.material];
  }

  /** The audio context once unlocked (recorded voices play through it too: see clipPlayer.ts). */
  get context(): AudioContext | undefined {
    return this.ctx;
  }

  /** Must be called from a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }
    const c = this.ctx;
    const master = c.createGain();
    master.connect(c.destination);
    this.buses = { effects: c.createGain(), music: c.createGain(), ambient: c.createGain() };
    for (const b of Object.values(this.buses)) b.connect(master);
    this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.musicIn = c.createGain();
    this.musicIn.connect(this.buses.music);
    this.applyVolumes();
    this.loadSamples();
    this.startAmbient();
    this.startMusic();
  }

  /** Resolves once every recorded sample is decoded (sounds before then use a synthesised stand-in). */
  ready: Promise<void> = Promise.resolve();

  private loadSamples() {
    const c = this.ctx!;
    const jobs = (Object.keys(SFX) as Pool[]).map(async (pool) => {
      const bufs = await Promise.all(
        SFX[pool].map(async (url) => {
          try {
            const b64 = url.slice(url.indexOf(',') + 1);
            const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
            return trimLead(c, await c.decodeAudioData(bytes.buffer));
          } catch {
            return undefined;
          }
        }),
      );
      this.samples[pool] = bufs.filter((b): b is AudioBuffer => !!b);
    });
    this.ready = Promise.all(jobs).then(() => undefined);
  }

  setVolumes(v: Partial<Volumes>) {
    Object.assign(this.volumes, v);
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.buses || !this.ctx) return;
    for (const k of Object.keys(this.buses) as (keyof Volumes)[]) this.buses[k].gain.setTargetAtTime(this.volumes[k], this.ctx.currentTime, 0.05);
  }

  /** A random take from a pool, never the same one twice running. */
  private take(pool: Pool): AudioBuffer | undefined {
    const list = this.samples[pool];
    if (!list?.length) return undefined;
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === this.last[pool]) i = (i + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
    this.last[pool] = i;
    return list[i];
  }

  /** Play one recorded take through a little natural variation. */
  private sample(t: number, pool: Pool, rate: number, gain: number, tone: number, pan = 0): boolean {
    const buf = this.take(pool);
    if (!buf) return false;
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * rnd(0.94, 1.06);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(tone * rnd(0.85, 1.1), c.sampleRate / 2 - 100);
    lp.Q.value = 0.5;
    const g = c.createGain();
    g.gain.value = gain * rnd(0.8, 1);
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan + rnd(-0.08, 0.08)));
    src.connect(lp).connect(g).connect(p).connect(this.buses!.effects);
    src.start(t);
    return true;
  }

  /** Tile against tile. */
  private clack(t: number, o: HitOpts = {}) {
    const v = this.voice;
    const gain = o.gain ?? 0.6;
    const far = o.far ?? 0;
    if (!this.sample(t, v.pool, v.rate * (o.rate ?? 1), gain, v.tone * (1 - far * 0.7), o.pan ?? 0)) this.knock(t, (o.rate ?? 1) * 1.05, gain * 0.7);
    if (v.ring && gain > 0.2) this.ping(t, v.ring * (o.rate ?? 1) * rnd(0.98, 1.02), gain * 0.05, 0.18);
  }

  /** A tile landing on the felt: a soft thud with the tile's own click on top. */
  private land(t: number, o: HitOpts = {}) {
    const gain = o.gain ?? 0.7;
    const pan = o.pan ?? 0;
    this.sample(t, 'felt', rnd(0.85, 1.05) * (o.rate ?? 1), gain * 0.9 * this.voice.body, 5000 * (1 - (o.far ?? 0) * 0.6), pan);
    this.clack(t + rnd(0, 0.004), { ...o, gain: gain * 0.55 });
  }

  /** Tiles sliding over felt: soft, uneven friction rather than a clean whoosh. */
  private rub(t: number, dur: number, gain = 0.12, pan = 0) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise!;
    src.loop = true;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = rnd(250, 400);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(rnd(1400, 1900), t);
    lp.frequency.linearRampToValueAtTime(rnd(2300, 3200), t + dur * 0.6);
    lp.frequency.linearRampToValueAtTime(rnd(1200, 1700), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    // Hand pressure wobbles, so friction comes in uneven grains.
    const steps = Math.max(3, Math.round(dur / 0.04));
    for (let i = 1; i < steps; i++) {
      const x = i / steps;
      const shape = Math.sin(Math.PI * Math.min(1, x * 1.3)) ** 0.7;
      g.gain.linearRampToValueAtTime(gain * shape * rnd(0.55, 1), t + dur * x);
    }
    g.gain.linearRampToValueAtTime(0, t + dur);
    const p = c.createStereoPanner();
    p.pan.value = pan;
    src.connect(hp).connect(lp).connect(g).connect(p).connect(this.buses!.effects);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  /** Stand-in click for the moment before the recordings are decoded. */
  private knock(t: number, pitch = 1, gain = 0.5) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise!;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600 * pitch;
    bp.Q.value = 2.5;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    src.connect(bp).connect(g).connect(this.buses!.effects);
    src.start(t, Math.random() * 0.5, 0.08);
    this.ping(t, 1350 * pitch, gain * 0.25, 0.09);
  }

  private ping(t: number, f: number, level: number, ring: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + ring);
    o.connect(g).connect(this.buses!.effects);
    o.start(t);
    o.stop(t + ring + 0.01);
  }

  private chime(t: number, notes: number[], gap = 0.09, gain = 0.18, bus: keyof Volumes = 'effects') {
    const c = this.ctx!;
    notes.forEach((f, i) => {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = c.createGain();
      const s = t + i * gap;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(gain, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, s + 1.2);
      o.connect(g).connect(this.buses![bus]);
      o.start(s);
      o.stop(s + 1.3);
    });
  }

  /**
   * Washing the tiles: several hands sweep the face-down tiles around the felt,
   * so you hear a dense, uneven clatter over soft friction, near and far.
   */
  private wash(t: number, dur: number) {
    let s = t;
    while (s < t + dur - 0.2) {
      const len = rnd(0.35, 0.6);
      const pan = rnd(-0.6, 0.6);
      const far = Math.random() * 0.6;
      this.rub(s, len, rnd(0.06, 0.1), pan);
      // Collisions bunch up mid-sweep, where the hand moves fastest.
      const n = Math.round(len * rnd(45, 70));
      for (let i = 0; i < n; i++) {
        const x = Math.random() ** 0.9;
        const at = s + len * x;
        const loud = Math.random() < 0.12 ? rnd(0.35, 0.55) : rnd(0.07, 0.25);
        const edge = Math.sin(Math.PI * x);
        this.clack(at, { gain: loud * (0.4 + 0.6 * edge), rate: rnd(0.88, 1.12), pan: pan + rnd(-0.3, 0.3), far: far + rnd(0, 0.3) });
      }
      if (Math.random() < 0.6) this.sample(s + len * rnd(0.2, 0.8), 'felt', rnd(0.9, 1.1), rnd(0.12, 0.22), 4000, pan);
      // Hands overlap: the next sweep starts before this one ends.
      s += len * rnd(0.45, 0.75);
    }
  }

  /** Building and dealing: rows of tiles pushed into line, then picked up in blocks and set down. */
  private build(t: number, blocks: number, gap: number) {
    for (let b = 0; b < blocks; b++) {
      const s = t + b * gap + rnd(-0.02, 0.03);
      const pan = rnd(-0.5, 0.5);
      this.rub(s, rnd(0.1, 0.16), rnd(0.05, 0.08), pan);
      // Tiles butting together as the row closes up.
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.clack(s + 0.08 + i * rnd(0.018, 0.035), { gain: rnd(0.18, 0.32), rate: rnd(0.95, 1.08), pan });
      this.land(s + 0.1 + n * 0.03, { gain: rnd(0.3, 0.45), pan });
    }
  }

  /** Several tiles turned face-up and pushed together: a quick flam, then they settle. */
  private meld(t: number, tiles: number) {
    this.rub(t, 0.09, 0.06);
    for (let i = 0; i < tiles; i++) this.clack(t + 0.05 + i * rnd(0.04, 0.06), { gain: rnd(0.45, 0.6), rate: rnd(0.96, 1.05), pan: (i - tiles / 2) * 0.12 });
    this.land(t + 0.07 + tiles * 0.055, { gain: 0.5 });
  }

  /** `delay` (s) schedules the sound a little ahead, for sequences and previews. */
  play(name: Sfx, delay = 0) {
    if (!this.ctx || !this.buses) return;
    const t = this.ctx.currentTime + 0.005 + delay;
    switch (name) {
      case 'click':
        return this.clack(t, { gain: 0.42, rate: 1.04 });
      case 'button':
        // A light tap of a tile edge: tactile, not beepy.
        return this.clack(t, { gain: 0.2, rate: 1.25, far: 0.3 });
      case 'turn':
        return this.chime(t, [880], 0, 0.04);
      case 'draw':
        this.rub(t, 0.11, 0.07);
        return this.clack(t + 0.09, { gain: 0.45 });
      case 'slide':
        return this.build(t, 8, 0.17);
      case 'discard':
        this.land(t, { gain: 1 });
        // A tiny settle as the tile rocks flat.
        return this.clack(t + rnd(0.03, 0.05), { gain: 0.12, rate: 1.1 });
      case 'shuffle':
        return this.wash(t, 1.6);
      case 'chow':
      case 'pung':
        return this.meld(t, 3);
      case 'kong':
        this.meld(t, 4);
        return this.land(t + 0.32, { gain: 0.55 });
      case 'mahjong': {
        // The winning hand is knocked down: a ripple of tiles tipping onto the felt.
        const n = 14;
        for (let i = 0; i < n; i++) this.land(t + i * rnd(0.022, 0.03), { gain: 0.3 + (0.25 * i) / n, pan: -0.5 + i / n });
        return this.chime(t + 0.5, [523, 659, 784, 1047, 1319], 0.1, 0.06);
      }
      case 'score':
        return this.chime(t, [784, 1175], 0.08, 0.08);
      case 'riichi':
        // The riichi stick laid down on the table.
        this.sample(t, 'table', rnd(0.95, 1.05), 0.55, 7000);
        this.sample(t + 0.004, 'wood', rnd(0.9, 1.1), 0.35, 9000);
        return this.chime(t + 0.08, [659, 988], 0.07, 0.045);
      case 'react':
        return this.chime(t, [1047], 0, 0.05);
      case 'dice':
        // Dice landing on the felt: quick, light knocks that bunch up as they settle.
        [0, 0.13, 0.22, 0.28, 0.32].forEach((d, i) => this.clack(t + d, { gain: 0.34 - i * 0.05, rate: rnd(1.45, 1.7), pan: rnd(-0.2, 0.2) }));
        return;
    }
  }

  /** Room tone: soft filtered noise with a slow swell, like a quiet club. */
  private startAmbient() {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise!;
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = c.createGain();
    g.gain.value = 0.08;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = c.createGain();
    lg.gain.value = 0.03;
    lfo.connect(lg).connect(g.gain);
    src.connect(lp).connect(g).connect(this.buses!.ambient);
    src.start();
    lfo.start();
  }

  /** The Ambient bus, for venue soundscapes (ambience.ts); null until unlock(). */
  ambientOut(): { ctx: AudioContext; out: AudioNode } | null {
    return this.ctx && this.buses ? { ctx: this.ctx, out: this.buses.ambient } : null;
  }

  /** Chinese Zen background music (see zen.ts). */
  private startMusic() {
    this.music ??= new ZenMusic(this.ctx!, this.musicIn!);
  }

  /** Voices speaking over the music (Mei, the callers); music stays low until all of them finish. */
  private duckers = new Set<string>();

  duck(on: boolean, who = 'narrator') {
    if (on) this.duckers.add(who);
    else this.duckers.delete(who);
    if (!this.ctx || !this.musicIn) return;
    const low = this.duckers.size > 0;
    this.musicIn.gain.setTargetAtTime(low ? 0.35 : 1, this.ctx.currentTime, low ? 0.15 : 0.6);
  }
}

/** MP3 decoders pad the start with silence; cut it so hits land on time. */
function trimLead(c: BaseAudioContext, b: AudioBuffer): AudioBuffer {
  const d = b.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  let start = 0;
  while (start < d.length && Math.abs(d[start]) < peak * 0.05) start++;
  start = Math.max(0, start - Math.round(b.sampleRate * 0.001));
  if (start < 8) return b;
  const out = c.createBuffer(1, d.length - start, b.sampleRate);
  out.copyToChannel(d.subarray(start), 0);
  return out;
}

export const sound = new Sound();
