import { describe, expect, it } from 'vitest';
import { TILE_SETS } from '../src/cosmetics/catalog';
import { ANIMAL_BASE, FLOWER_BASE, FLOWER_JOKER, JOKER_KIND, TILE_KIND_COUNT, parseKinds } from '../src/engine/tiles';
import { accessibleStyle, tileIndex, tileIndexLabel } from '../src/render/tileAccess';
import { A11Y_DEFAULTS, HAPTIC_PATTERNS, loadA11y, parseA11y, saveA11y } from '../src/ui/accessibility';
import { isIos, shouldRegister, type PageEnv } from '../src/pwa/register';

const label = (spec: string) => tileIndexLabel(parseKinds(spec)[0]);

describe('suit-marked tile index', () => {
  it('marks suited tiles with number and suit', () => {
    expect(label('5p')).toBe('5●');
    expect(label('3s')).toBe('3║');
    expect(label('7m')).toBe('7万');
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => label(`${n}p`))).toEqual(['1●', '2●', '3●', '4●', '5●', '6●', '7●', '8●', '9●']);
  });

  it('letters winds and dragons, with the White Dragon distinct from West', () => {
    expect(['E', 'S', 'W', 'N'].map(label)).toEqual(['E', 'S', 'W', 'N']);
    expect(['Rd', 'Gd', 'Wd'].map(label)).toEqual(['RED◆', 'GREEN◆', 'WHITE◆']);
  });

  it('numbers flowers and seasons by seat, each with its own mark', () => {
    expect([0, 1, 2, 3].map((i) => tileIndexLabel(FLOWER_BASE + i))).toEqual(['1✿', '2✿', '3✿', '4✿']);
    expect([4, 5, 6, 7].map((i) => tileIndexLabel(FLOWER_BASE + i))).toEqual(['1☀', '2☀', '3☀', '4☀']);
  });

  it('names jokers and animals', () => {
    expect(tileIndexLabel(JOKER_KIND)).toBe('J');
    expect([0, 1, 2, 3].map((i) => tileIndexLabel(FLOWER_JOKER + i))).toEqual(['JF', 'JW', 'JD', 'JN']);
    expect([0, 1, 2, 3].map((i) => tileIndexLabel(ANIMAL_BASE + i))).toEqual(['Cat', 'Mou', 'Roo', 'Cen']);
  });

  it('gives every tile kind a short index, and different kinds different indexes', () => {
    const all = Array.from({ length: TILE_KIND_COUNT }, (_, k) => tileIndexLabel(k));
    all.forEach((l, k) => {
      expect(l.length).toBeGreaterThan(0);
      // Dragons are named in full (RED, GREEN, WHITE) so White never reads as West.
      expect(l.length).toBeLessThanOrEqual(k >= 31 && k <= 33 ? 6 : 3);
    });
    // Flowers share numbers with suits only through their own marks.
    expect(new Set(all).size).toBe(all.length);
  });

  it('never relies on colour alone: suits differ by mark', () => {
    const marks = new Set(['1m', '1p', '1s'].map((s) => tileIndex(parseKinds(s)[0]).mark));
    expect(marks.size).toBe(3);
  });
});

describe('accessible tile styles', () => {
  const ivory = TILE_SETS[0];

  it('leaves a set alone with no options', () => {
    expect(accessibleStyle(ivory, { suitMarks: true, colourSafe: false, highContrast: false })).toBe(ivory);
  });

  it('colour-safe swaps the red, green and blue inks but keeps the set', () => {
    const s = accessibleStyle(ivory, { suitMarks: false, colourSafe: true, highContrast: false });
    expect(s.id).toBe(ivory.id);
    expect(s.ink[0]).toBe(ivory.ink[0]);
    expect(s.ink.slice(1)).not.toEqual(ivory.ink.slice(1));
    expect(new Set(s.ink).size).toBe(4);
    // The catalogue entry itself is untouched.
    expect(TILE_SETS[0].ink).toEqual(ivory.ink);
  });

  it('high contrast gives every set a bright, flat face and black ink', () => {
    for (const set of TILE_SETS) {
      const s = accessibleStyle(set, { suitMarks: false, colourSafe: false, highContrast: true });
      expect(s.face[0]).toBe('#ffffff');
      expect(s.ink[0]).toBe('#000000');
      expect(s.inkStyle).toBe('flat');
      expect(s.back).toBe(set.back);
    }
  });
});

describe('accessibility settings', () => {
  it('parses stored settings defensively', () => {
    expect(parseA11y(null)).toEqual(A11Y_DEFAULTS);
    expect(parseA11y('not json')).toEqual(A11Y_DEFAULTS);
    expect(parseA11y('[1,2]')).toEqual(A11Y_DEFAULTS);
    expect(parseA11y('{"suitMarks":true,"largeTiles":"yes","extra":1}')).toEqual({ ...A11Y_DEFAULTS, suitMarks: true });
  });

  it('round-trips through storage', () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const s = { ...A11Y_DEFAULTS, colourSafe: true, highContrast: true, haptics: false, reduceMotion: true };
    saveA11y(s, store);
    expect(loadA11y(store)).toEqual(s);
    expect(loadA11y(null)).toEqual(A11Y_DEFAULTS);
  });

  it('keeps haptic taps short', () => {
    for (const p of Object.values(HAPTIC_PATTERNS)) expect(p.reduce((a, b) => a + b, 0)).toBeLessThan(150);
  });
});

describe('service worker registration', () => {
  const web: PageEnv = { mode: 'production', protocol: 'https:', hostname: 'jongclub.example', origin: 'https://jongclub.example', secure: true, framed: false, supported: true };

  it('registers on the plain web build served from a real origin', () => {
    expect(shouldRegister(web)).toBe(true);
    expect(shouldRegister({ ...web, protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:4173' })).toBe(true);
  });

  it('never registers in the Artifact, the single-file builds, frames or file://', () => {
    expect(shouldRegister({ ...web, mode: 'artifact' })).toBe(false);
    expect(shouldRegister({ ...web, mode: 'standalone' })).toBe(false);
    expect(shouldRegister({ ...web, mode: 'development' })).toBe(false);
    expect(shouldRegister({ ...web, framed: true })).toBe(false);
    expect(shouldRegister({ ...web, origin: 'null' })).toBe(false);
    expect(shouldRegister({ ...web, protocol: 'file:', origin: 'null', secure: false })).toBe(false);
    expect(shouldRegister({ ...web, hostname: 'abc.claudeusercontent.com' })).toBe(false);
    expect(shouldRegister({ ...web, hostname: 'claude.ai' })).toBe(false);
    expect(shouldRegister({ ...web, protocol: 'http:', secure: false })).toBe(false);
    expect(shouldRegister({ ...web, supported: false })).toBe(false);
  });

  it('spots iPhone and iPad for the Add to Home Screen hint', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5, 'MacIntel')).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0, 'MacIntel')).toBe(false);
    expect(isIos('Mozilla/5.0 (Linux; Android 14)')).toBe(false);
  });
});
