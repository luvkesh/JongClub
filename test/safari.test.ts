// Safari audio: the prefixed AudioContext, the callback form of decodeAudioData and the
// 'interrupted' state (src/audio/sound.ts).
import { afterEach, describe, expect, it, vi } from 'vitest';

/** A stand-in for any Web Audio node or param: every property is a callable that returns another stand-in. */
function node(): any {
  const f: any = () => node();
  return new Proxy(f, {
    get: (t, k) => (k === 'then' ? undefined : k === Symbol.toPrimitive ? () => 0 : k === 'length' ? 0 : k in t ? t[k] : node()),
    set: () => true,
  });
}

class FakeCtx {
  static made = 0;
  state = 'running';
  sampleRate = 8;
  currentTime = 0;
  decodeArgs: number[] = [];
  resumed = 0;
  constructor() {
    FakeCtx.made++;
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(32), duration: 1, length: 32, numberOfChannels: 1, sampleRate: 8 };
  }
  decodeAudioData(_b: ArrayBuffer, ok?: (b: unknown) => void) {
    this.decodeArgs.push(arguments.length);
    // Old Safari: no promise, only the callbacks.
    ok?.(this.createBuffer());
    return undefined;
  }
  resume() {
    this.resumed++;
    return Promise.resolve();
  }
  get destination() {
    return node();
  }
}
for (const m of ['createGain', 'createOscillator', 'createBufferSource', 'createBiquadFilter', 'createDynamicsCompressor', 'createStereoPanner', 'createConvolver', 'createDelay', 'createWaveShaper', 'createConstantSource', 'createPanner'])
  (FakeCtx.prototype as any)[m] = () => node();

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Safari audio', () => {
  it('starts on webkitAudioContext when AudioContext is missing, decodes with callbacks and resumes when interrupted', async () => {
    vi.stubGlobal('window', { webkitAudioContext: FakeCtx, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {} });
    const { sound } = await import('../src/audio/sound');
    sound.unlock();
    expect(FakeCtx.made).toBe(1);
    const ctx = sound.context as unknown as FakeCtx;
    await sound.ready;
    expect(ctx.decodeArgs.length).toBeGreaterThan(0);
    expect(ctx.decodeArgs.every((n) => n === 3)).toBe(true);
    ctx.state = 'interrupted';
    sound.unlock();
    expect(ctx.resumed).toBe(1);
    expect(FakeCtx.made).toBe(1);
  });
});

describe('Safari face store', () => {
  it('keeps PNG bytes as ArrayBuffers, which Safari private browsing can store in IndexedDB (Blobs it refuses)', async () => {
    const { toStored } = await import('../src/render/faceStore');
    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
    const s = await toStored({ face: png, relief: png });
    expect(s.face).toBeInstanceOf(ArrayBuffer);
    expect((s.face as ArrayBuffer).byteLength).toBe(4);
    expect(s.relief).toBeInstanceOf(ArrayBuffer);
    expect('foil' in s).toBe(false);
    // Bytes already stored pass through.
    const again = await toStored(s);
    expect(again.face).toBe(s.face);
  });
});
