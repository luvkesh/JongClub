// Background music for the club, synthesised so the game stays one page.
// A small traditional ensemble in the gong pentatonic mode, through a hall reverb:
// guzheng (plucked zither with press-bends and glissandi), pipa (bright lute,
// with tremolo), erhu (bowed two-string fiddle with slow vibrato), xiao (breathy
// bamboo flute), a soft muyu woodblock pulse, wind chimes, a temple bell and a low
// drone. Each phrase picks a lead instrument and a gentle accompaniment, with
// generous silence between phrases: relaxed music for a quiet club.

const D3 = 146.83;
/** Gong mode on D: D E F# A B, across three octaves. */
const SCALE = [0, 2, 4, 7, 9].flatMap((s) => [0, 12, 24].map((o) => o + s)).sort((a, b) => a - b).map((st) => D3 * 2 ** (st / 12));

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export class ZenMusic {
  private strings: AudioBuffer[] = [];
  private pipaStrings: AudioBuffer[] = [];
  private last = '';
  private wet: GainNode;
  private dry: GainNode;
  private timer = 0;
  private stopped = false;
  /** Index into SCALE of the last melody note, so phrases move by steps. */
  private at = 5;

  constructor(private ctx: AudioContext, out: AudioNode) {
    const c = ctx;
    this.dry = c.createGain();
    this.dry.gain.value = 1.1;
    this.dry.connect(out);
    const verb = c.createConvolver();
    verb.buffer = this.hall(4.2);
    this.wet = c.createGain();
    this.wet.gain.value = 0.75;
    this.wet.connect(verb).connect(out);
    // Strings for the melody range plus two bass notes.
    for (const f of SCALE) this.strings.push(this.pluck(f));
    for (const f of SCALE) this.pipaStrings.push(this.pluck(f, true));
    this.drone();
    this.timer = window.setTimeout(() => this.phrase(), 1500);
  }

  stop() {
    this.stopped = true;
    window.clearTimeout(this.timer);
  }

  private send(node: AudioNode, wet = 1) {
    node.connect(this.dry);
    if (wet > 0) {
      const g = this.ctx.createGain();
      g.gain.value = wet;
      node.connect(g).connect(this.wet);
    }
  }

  /** A soft, dark hall impulse: decaying stereo noise. */
  private hall(seconds: number) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * seconds);
    const b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        lp += 0.25 * (Math.random() * 2 - 1 - lp);
        d[i] = lp * (1 - i / len) ** 3.2;
      }
    }
    return b;
  }

  /** Karplus-Strong plucked string, rendered once into a buffer. */
  private pluck(freq: number, bright = false) {
    const c = this.ctx;
    const sr = c.sampleRate;
    const len = Math.floor(sr * (bright ? 1.8 : 3.2));
    const b = c.createBuffer(1, len, sr);
    const d = b.getChannelData(0);
    const n = Math.max(2, Math.round(sr / freq));
    const ring = new Float32Array(n);
    // A brighter pick near the bridge: noise with a little comb shaping.
    for (let i = 0; i < n; i++) ring[i] = (Math.random() * 2 - 1) * (i < n * 0.5 ? 1 : 0.6);
    const damp = bright ? (freq > 500 ? 0.986 : 0.991) : freq > 500 ? 0.993 : 0.9965;
    let p = 0;
    for (let i = 0; i < len; i++) {
      const next = (p + 1) % n;
      const v = ring[p];
      ring[p] = damp * 0.5 * (v + ring[next]);
      d[i] = v * (i < 64 ? i / 64 : 1);
      p = next;
    }
    return b;
  }

  private string(t: number, idx: number, gain: number, bend = 1) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.strings[idx];
    // The guzheng player presses the string behind the bridge to bend into a note.
    if (bend !== 1) {
      src.playbackRate.setValueAtTime(1, t);
      src.playbackRate.linearRampToValueAtTime(bend, t + rand(0.18, 0.32));
      src.playbackRate.setTargetAtTime(1, t + rand(0.7, 1.2), 0.25);
    }
    const g = c.createGain();
    g.gain.value = gain;
    const tone = c.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 3800;
    src.connect(tone).connect(g);
    this.send(g, 0.9);
    src.start(t);
    src.stop(t + 3.2);
  }

  /** Xiao: a soft, breathy bamboo flute note with a slow vibrato. */
  private flute(t: number, freq: number, dur: number, gain = 0.05) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 0.985, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.25);
    const vib = c.createOscillator();
    vib.frequency.value = rand(4.3, 5.2);
    const vg = c.createGain();
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(freq * 0.006, t + dur * 0.6);
    vib.connect(vg).connect(o.frequency);
    const h2 = c.createOscillator();
    h2.type = 'sine';
    h2.frequency.value = freq * 2;
    const h2g = c.createGain();
    h2g.gain.value = 0.12;
    h2.connect(h2g);
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.45);
    env.gain.setValueAtTime(gain, t + dur - 0.6);
    env.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(env);
    h2g.connect(env);
    // Breath.
    const nb = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const ns = c.createBufferSource();
    ns.buffer = nb;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq * 2;
    bp.Q.value = 2.5;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(gain * 0.35, t + 0.12);
    ng.gain.linearRampToValueAtTime(gain * 0.12, t + 0.6);
    ng.gain.linearRampToValueAtTime(0, t + dur);
    ns.connect(bp).connect(ng);
    this.send(env, 1.2);
    this.send(ng, 1.2);
    for (const x of [o, vib, h2]) {
      x.start(t);
      x.stop(t + dur + 0.05);
    }
    ns.start(t);
  }

  /** A small temple bell, struck softly. */
  private bell(t: number, freq: number, gain = 0.03) {
    const c = this.ctx;
    for (const [r, g, d] of [
      [1, 1, 4],
      [2.76, 0.4, 2],
      [5.4, 0.15, 1],
    ] as const) {
      const o = c.createOscillator();
      o.frequency.value = freq * r;
      const e = c.createGain();
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(gain * g, t + 0.01);
      e.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(e);
      this.send(e, 1.4);
      o.start(t);
      o.stop(t + d);
    }
  }

  private drone() {
    const c = this.ctx;
    for (const [f, g] of [
      [D3 / 2, 0.035],
      [(D3 * 3) / 4, 0.018],
    ]) {
      const o = c.createOscillator();
      o.frequency.value = f;
      const e = c.createGain();
      e.gain.value = g;
      const lfo = c.createOscillator();
      lfo.frequency.value = rand(0.03, 0.06);
      const lg = c.createGain();
      lg.gain.value = g * 0.6;
      lfo.connect(lg).connect(e.gain);
      o.connect(e);
      this.send(e, 0.6);
      o.start();
      lfo.start();
    }
  }

  /** Pipa: a brighter, shorter pluck; `tremolo` repeats it rapidly, the lute's signature. */
  private pipa(t: number, idx: number, gain: number, tremolo = 0) {
    const c = this.ctx;
    const hits = tremolo ? Math.floor(tremolo / 0.075) : 1;
    for (let k = 0; k < hits; k++) {
      const src = c.createBufferSource();
      src.buffer = this.pipaStrings[idx];
      const g = c.createGain();
      // A tremolo swells a little, then fades.
      g.gain.value = gain * (tremolo ? 0.55 + 0.25 * Math.sin((k / hits) * Math.PI) : 1) * (k % 2 ? 0.8 : 1);
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 180;
      src.connect(hp).connect(g);
      this.send(g, 0.7);
      const at = t + k * 0.075;
      src.start(at);
      src.stop(at + (tremolo ? 0.3 : 1.8));
    }
  }

  /** Erhu: a bowed, nasal string voice with portamento and a slow, late vibrato. */
  private erhu(t: number, freq: number, dur: number, from = freq, gain = 0.045) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + (from === freq ? 0.01 : 0.22));
    const vib = c.createOscillator();
    vib.frequency.value = rand(5, 6);
    const vg = c.createGain();
    vg.gain.setValueAtTime(0, t);
    vg.gain.setValueAtTime(0, t + dur * 0.35);
    vg.gain.linearRampToValueAtTime(freq * 0.012, t + dur * 0.8);
    vib.connect(vg).connect(o.frequency);
    // Body resonances of the small snakeskin drum.
    const f1 = c.createBiquadFilter();
    f1.type = 'peaking';
    f1.frequency.value = 900;
    f1.Q.value = 1.2;
    f1.gain.value = 6;
    const f2 = c.createBiquadFilter();
    f2.type = 'peaking';
    f2.frequency.value = 2600;
    f2.Q.value = 2;
    f2.gain.value = 4;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3600;
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.28);
    env.gain.linearRampToValueAtTime(gain * 0.85, t + dur * 0.6);
    env.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(f1).connect(f2).connect(lp).connect(env);
    this.send(env, 1.1);
    for (const x of [o, vib]) {
      x.start(t);
      x.stop(t + dur + 0.05);
    }
  }

  /** Muyu: a soft, hollow wooden knock. */
  private muyu(t: number, gain = 0.05) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(820, t);
    o.frequency.exponentialRampToValueAtTime(620, t + 0.08);
    const e = c.createGain();
    e.gain.setValueAtTime(gain, t);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(e);
    this.send(e, 0.5);
    o.start(t);
    o.stop(t + 0.18);
  }

  /** A few wind chimes stirring. */
  private chimes(t: number) {
    const n = 3 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) this.bell(t + k * rand(0.12, 0.35), SCALE[pick([10, 11, 12, 13, 14])] * 2, 0.006);
  }

  /** Accompaniment: a slow broken chord on the zither under another lead. */
  private arpeggio(t: number, until: number) {
    const shapes = [
      [0, 3, 5, 6],
      [1, 3, 6, 5],
      [3, 5, 7, 6],
    ];
    const sh = pick(shapes);
    let k = 0;
    for (let at = t; at < until; at += 1.25) this.string(at, sh[k++ % sh.length], k === 1 ? 0.12 : 0.07);
  }

  /** One musical thought, then a rest. Each picks a lead, never the same twice running. */
  private phrase() {
    if (this.stopped) return;
    const c = this.ctx;
    let t = c.currentTime + 0.1;
    const kinds = ['zither', 'zither', 'flute', 'erhu', 'pipa', 'glissando'].filter((k) => k !== this.last);
    const kind = pick(kinds);
    this.last = kind;
    if (kind === 'glissando') {
      // A gentle glissando up the strings, then one held note.
      const from = 3 + Math.floor(Math.random() * 3);
      for (let i = from; i < SCALE.length; i++) this.string(t + (i - from) * 0.07, i, 0.12);
      t += (SCALE.length - from) * 0.07 + 0.6;
      this.string(t, 7, 0.22);
      if (Math.random() < 0.5) this.chimes(t + 0.8);
      t += 1.5;
    } else if (kind === 'flute') {
      // The xiao sings long notes over a slow zither pattern.
      const start = t;
      const n = 2 + Math.floor(Math.random() * 3);
      let i = pick([7, 8, 9, 10]);
      for (let k = 0; k < n; k++) {
        const dur = rand(2.2, 3.6);
        this.flute(t, SCALE[i], dur);
        t += dur - 0.2;
        i = Math.max(5, Math.min(11, i + pick([-2, -1, 1, -1])));
      }
      this.arpeggio(start + 0.4, t);
    } else if (kind === 'erhu') {
      // The erhu's song: stepwise, sliding between notes, a woodblock keeping slow time.
      const start = t;
      let i = pick([5, 6, 7]);
      let prev = SCALE[i];
      const n = 3 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        const dur = k === n - 1 ? rand(2.6, 3.4) : pick([1.2, 1.6, 1.6, 2.2]);
        this.erhu(t, SCALE[i], dur, prev);
        prev = SCALE[i];
        t += dur;
        i = Math.max(4, Math.min(10, i + pick([-1, -1, 1, 1, 2, -2])));
      }
      this.string(start, pick([0, 1]), 0.16);
      if (Math.random() < 0.6) for (let at = start + 0.6; at < t - 0.5; at += 2.4) this.muyu(at, 0.035);
      else this.arpeggio(start + 1.2, t - 0.4);
    } else if (kind === 'pipa') {
      // The pipa: a few bright notes, ending on a tremolo that fades.
      const n = 3 + Math.floor(Math.random() * 3);
      let i = pick([6, 7, 8]);
      for (let k = 0; k < n; k++) {
        this.pipa(t, i, rand(0.12, 0.17));
        t += pick([0.35, 0.5, 0.5, 0.75]);
        i = Math.max(5, Math.min(12, i + pick([-1, 1, 1, -2, 2])));
      }
      this.pipa(t, i, 0.11, rand(1.6, 2.4));
      this.string(t, pick([0, 3]), 0.12);
      t += 2.4;
      if (Math.random() < 0.4) this.chimes(t);
    } else {
      // The zither: a bass note, then a few stepwise notes with rubato.
      this.string(t, pick([0, 1, 3]), 0.2);
      if (Math.random() < 0.25) this.bell(t + 0.02, SCALE[10], 0.018);
      t += rand(0.6, 1.0);
      const n = 3 + Math.floor(Math.random() * 4);
      for (let k = 0; k < n; k++) {
        this.at = Math.max(4, Math.min(SCALE.length - 2, this.at + pick([-2, -1, -1, 1, 1, 2])));
        // Sometimes start a step below and press the string up into the note.
        const idx = Math.random() < 0.22 ? this.at - 1 : this.at;
        this.string(t, idx, rand(0.14, 0.22), SCALE[this.at] / SCALE[idx]);
        // Echo the note an octave below sometimes, the way a player rolls a chord.
        if (Math.random() < 0.18 && this.at >= 5) this.string(t + 0.05, this.at - 5, 0.1);
        t += k === n - 1 ? 0 : pick([0.45, 0.6, 0.6, 0.9, 1.2]);
      }
      t += 2;
    }
    const rest = rand(2.5, 6);
    this.timer = window.setTimeout(() => this.phrase(), (t - c.currentTime + rest) * 1000);
  }
}
