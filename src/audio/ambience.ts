// Room soundscapes for the signature venues, generated with Web Audio like
// the music in zen.ts, quietly, into the Ambient bus (so the Ambient volume
// in Settings governs them). Each venue layers a bed (a fan's hush, rain on
// glass, desert wind) under occasional small events (a cup set down, a bird
// in its cage, tiles at another table, coffee poured, the coal in a burner).
// Nothing loops audibly: every event is drawn fresh, at random intervals.

import { sound } from './sound';

export type Scape = 'teahouse' | 'janso' | 'majlis';

/** Which soundscape an environment has (null: the club's plain room tone only). */
export const SCAPES: Record<string, Scape> = { 'hk-teahouse': 'teahouse', 'tokyo-janso': 'janso', 'al-fahidi-majlis': 'majlis' };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

class Soundscape {
  private bus: GainNode;
  private timers: number[] = [];
  private nodes: AudioScheduledSourceNode[] = [];
  private stopped = false;

  constructor(
    private ctx: AudioContext,
    out: AudioNode,
    private noise: AudioBuffer,
    readonly kind: Scape,
  ) {
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.gain.setTargetAtTime(0.55, ctx.currentTime, 1.2);
    this.bus.connect(out);
    if (kind === 'teahouse') this.teahouse();
    else if (kind === 'janso') this.janso();
    else this.majlis();
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    for (const t of this.timers) window.clearTimeout(t);
    const now = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setTargetAtTime(0, now, 0.5);
    window.setTimeout(() => {
      for (const n of this.nodes)
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      this.bus.disconnect();
    }, 2500);
  }

  /** Run `fn` again and again, `a`..`b` seconds apart. */
  private every(a: number, b: number, fn: () => void, first = rnd(a, b)) {
    const tick = () => {
      if (this.stopped) return;
      fn();
      this.timers.push(window.setTimeout(tick, rnd(a, b) * 1000));
    };
    this.timers.push(window.setTimeout(tick, first * 1000));
  }

  private panner(pan: number, dest: AudioNode = this.bus) {
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(dest);
    return p;
  }

  /** A looping noise bed through a filter chain, at a level. */
  private bed(level: number, filters: BiquadFilterNode[]) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.loopStart = Math.random();
    const g = c.createGain();
    g.gain.value = level;
    let n: AudioNode = src;
    for (const f of filters) n = n.connect(f);
    n.connect(g).connect(this.bus);
    src.start(c.currentTime, Math.random());
    this.nodes.push(src);
    return { src, gain: g };
  }

  private filter(type: BiquadFilterType, freq: number, q = 0.7) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  /** A slow wobble on a parameter. */
  private lfo(param: AudioParam, rate: number, depth: number) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.value = rate;
    const g = c.createGain();
    g.gain.value = depth;
    o.connect(g).connect(param);
    o.start();
    this.nodes.push(o);
  }

  /** A short noise burst through a band: a tile click, a coal crackle, a drop. */
  private tick(t: number, freq: number, q: number, level: number, dur: number, pan: number) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = this.filter('bandpass', freq, q);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.connect(f).connect(g).connect(this.panner(pan));
    src.start(t, Math.random() * 1.5, dur + 0.02);
  }

  /** A small porcelain or brass ring: a cup set on a saucer or a tray. */
  private clink(t: number, base: number, level: number, pan: number) {
    const c = this.ctx;
    const out = this.panner(pan);
    for (const [ratio, lvl, ring] of [
      [1, 1, 0.35],
      [2.76, 0.5, 0.18],
      [5.4, 0.25, 0.08],
    ]) {
      const o = c.createOscillator();
      o.frequency.value = base * ratio * rnd(0.99, 1.01);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level * lvl, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0003, t + ring);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + ring + 0.05);
    }
    this.tick(t, base * 2, 2, level * 0.6, 0.015, pan);
  }

  /**
   * Murmur: a few bands of noise whose pitch and loudness jump at syllable
   * rate, low-passed until no word can be made out. The sound of a room talking.
   */
  private murmur(level: number, voices: number, cutoff: number) {
    const c = this.ctx;
    const lp = this.filter('lowpass', cutoff);
    const g = c.createGain();
    g.gain.value = level;
    lp.connect(g).connect(this.bus);
    for (let v = 0; v < voices; v++) {
      const src = c.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const bp = this.filter('bandpass', rnd(350, 900), 5);
      const vg = c.createGain();
      vg.gain.value = 0;
      src.connect(bp).connect(vg).connect(this.panner(rnd(-0.7, 0.7), lp));
      src.start(c.currentTime, Math.random());
      this.nodes.push(src);
      // Phrases of syllables, then a pause.
      let talking = Math.random() < 0.5;
      this.every(0.12, 0.26, () => {
        const t = c.currentTime;
        if (Math.random() < (talking ? 0.04 : 0.1)) talking = !talking;
        bp.frequency.setTargetAtTime(rnd(300, 1100), t, 0.03);
        vg.gain.setTargetAtTime(talking ? rnd(0.3, 1) : 0, t, 0.04);
      });
    }
  }

  // ------------------------------------------------------------ the venues

  /** Hong Kong: the fan's hush, a room in conversation, cups and teapot lids, a bird in its cage. */
  private teahouse() {
    const c = this.ctx;
    const fan = this.bed(0.05, [this.filter('lowpass', 260)]);
    this.lfo(fan.gain.gain, 0.57, 0.012);
    this.murmur(0.05, 4, 1400);
    this.every(2.5, 7, () => this.clink(c.currentTime + rnd(0, 0.2), rnd(2100, 2900), rnd(0.008, 0.02), rnd(-0.8, 0.8)));
    // A lid set back on a teapot: two quick knocks.
    this.every(9, 20, () => {
      const t = c.currentTime;
      const pan = rnd(-0.6, 0.6);
      this.clink(t, rnd(1300, 1600), 0.012, pan);
      this.clink(t + rnd(0.07, 0.12), rnd(1300, 1600), 0.008, pan);
    });
    // A caged bird: a short phrase of chirps.
    this.every(10, 24, () => {
      const t0 = c.currentTime;
      const pan = rnd(-0.9, 0.9);
      const n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const t = t0 + i * rnd(0.09, 0.16);
        const o = c.createOscillator();
        o.type = 'sine';
        const f0 = rnd(2600, 3400);
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f0 * rnd(1.3, 1.6), t + 0.04);
        o.frequency.exponentialRampToValueAtTime(f0 * rnd(0.85, 1), t + 0.08);
        const g = c.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.006, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0002, t + 0.09);
        o.connect(g).connect(this.panner(pan));
        o.start(t);
        o.stop(t + 0.12);
      }
    }, 4);
  }

  /** Tokyo: rain on the window, the lamps' faint hum, tiles at the other tables, now and then a wash. */
  private janso() {
    const c = this.ctx;
    const rain = this.bed(0.035, [this.filter('highpass', 1200), this.filter('lowpass', 6500)]);
    this.lfo(rain.gain.gain, 0.08, 0.01);
    // Drops on the glass.
    this.every(0.08, 0.35, () => this.tick(c.currentTime, rnd(1800, 4200), 8, rnd(0.004, 0.012), 0.03, rnd(-1, 1)));
    // Fluorescent hum, barely there.
    for (const [f, lvl] of [
      [100, 0.0025],
      [200, 0.0012],
    ]) {
      const o = c.createOscillator();
      o.frequency.value = f;
      const g = c.createGain();
      g.gain.value = lvl;
      o.connect(g).connect(this.bus);
      o.start();
      this.nodes.push(o);
    }
    // A discard or a call at another table: a few clicks.
    this.every(2.5, 7, () => {
      const t0 = c.currentTime;
      const pan = rnd(-0.9, 0.9);
      const far = Math.random();
      const n = 1 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) this.tick(t0 + i * rnd(0.03, 0.09), rnd(2600, 3800) * (1 - far * 0.3), 3, (0.03 - far * 0.018) * rnd(0.6, 1), 0.04, pan);
    });
    // A hand ends somewhere: the long clatter of a wash.
    this.every(22, 45, () => {
      const t0 = c.currentTime;
      const pan = rnd(-0.8, 0.8);
      for (let i = 0; i < 70; i++) this.tick(t0 + Math.pow(Math.random(), 0.8) * 2.2, rnd(2200, 3600), 2.5, rnd(0.004, 0.012), 0.035, pan + rnd(-0.2, 0.2));
    });
    this.murmur(0.018, 2, 900);
  }

  /** Dubai: wind past the wind tower, the coal in an incense burner, coffee poured and cups on brass. */
  private majlis() {
    const c = this.ctx;
    const bp = this.filter('bandpass', 420, 0.8);
    const wind = this.bed(0.06, [bp, this.filter('lowpass', 1200)]);
    this.lfo(bp.frequency, 0.05, 180);
    this.lfo(wind.gain.gain, 0.07, 0.025);
    this.murmur(0.025, 3, 900);
    // The coal: tiny crackles in small clusters.
    this.every(1.5, 5, () => {
      const t0 = c.currentTime;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.tick(t0 + i * rnd(0.02, 0.12), rnd(3000, 6000), 1.5, rnd(0.003, 0.008), 0.006, 0.35);
    });
    // Coffee poured from a dallah: a bubbling trickle.
    this.every(18, 40, () => {
      const t0 = c.currentTime;
      const src = c.createBufferSource();
      src.buffer = this.noise;
      const f = this.filter('bandpass', rnd(800, 1100), 3);
      const g = c.createGain();
      const dur = rnd(1.2, 2);
      g.gain.setValueAtTime(0, t0);
      for (let k = 0; k < dur * 14; k++) g.gain.linearRampToValueAtTime(rnd(0.004, 0.014), t0 + k / 14);
      g.gain.linearRampToValueAtTime(0, t0 + dur + 0.1);
      src.connect(f).connect(g).connect(this.panner(rnd(-0.5, 0.5)));
      src.start(t0, 0, dur + 0.2);
      // The cup handed over.
      this.clink(t0 + dur + rnd(0.5, 1), rnd(1700, 2100), 0.012, rnd(-0.5, 0.5));
    }, 6);
    this.every(6, 14, () => this.clink(c.currentTime, rnd(1500, 2000), rnd(0.006, 0.012), rnd(-0.8, 0.8)));
  }
}

/** Plays the soundscape of the equipped venue, if it has one. */
class Ambience {
  private current: Soundscape | null = null;
  private want: Scape | null = null;
  private noise?: AudioBuffer;
  private waiting = 0;

  /** Follow the equipped environment (catalogue id). Safe to call before audio is unlocked. */
  set(environmentId: string) {
    this.want = SCAPES[environmentId] ?? null;
    this.apply();
  }

  private apply() {
    if (this.current?.kind === this.want) return;
    const bus = sound.ambientOut();
    if (!bus) {
      // Audio starts on the first tap; check back until it has.
      if (this.want && !this.waiting) this.waiting = window.setInterval(() => sound.ambientOut() && (window.clearInterval(this.waiting), (this.waiting = 0), this.apply()), 1500);
      return;
    }
    this.current?.stop();
    this.current = null;
    if (!this.want) return;
    this.noise ??= whiteNoise(bus.ctx, 4);
    this.current = new Soundscape(bus.ctx, bus.out, this.noise, this.want);
  }
}

function whiteNoise(ctx: BaseAudioContext, seconds: number) {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export const ambience = new Ambience();
