import { describe, expect, it } from 'vitest';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { loadSettings } = await import('../src/ui/screens/settings');

describe('saved settings', () => {
  it('a damaged save keeps sound volumes as numbers from 0 to 1', () => {
    store.set('jongclub.settings.v1', JSON.stringify({ volumes: { music: 'loud', effects: 7, ambient: null }, labels: 'yes', speed: 'minimal', musicOff: true }));
    const s = loadSettings();
    expect(s.volumes).toEqual({ music: 0.25, effects: 1, ambient: 0.35, voices: 1 });
    expect(s.labels).toBe(true);
    expect(s.speed).toBe('minimal');
    expect(s.musicOff).toBe(true);
  });

  it('a save that is not an object gives the defaults', () => {
    for (const raw of ['null', '[1,2]', '"x"', '{bad json']) {
      store.set('jongclub.settings.v1', raw);
      expect(loadSettings().volumes.music, raw).toBe(0.25);
    }
  });
});
