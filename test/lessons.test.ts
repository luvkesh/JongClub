import { describe, expect, it } from 'vitest';
import { ACADEMY_ORDER, LESSONS, OPTIONAL_LESSONS, RETIRED_LESSONS, narrationLines } from '../src/ui/academy';
import { coachLines, SCRIPTS } from '../src/ui/coach';
import { parseKinds } from '../src/engine/tiles';
import { EAST_PAY, eastReading } from '../src/engine/rules/india';
import { WEST_EXAMPLES, goulashCount } from '../src/ui/lessons/india';
import { loserCount, westCount } from '../src/engine/rules/indiaWest';
import { classicPayments, classicScore } from '../src/engine/rules/classic';
import { standardShanten, waits, winningDecompositions } from '../src/engine/hand';
import { VARIATIONS } from '../src/engine/rules';
import { hkHalfGun, hongKongScore } from '../src/engine/rules/hongkong';
import { mcrPayments, mcrScore } from '../src/engine/rules/mcr';
import { sichuanPayments, sichuanScore } from '../src/engine/rules/sichuan';
import { malaysianProfile, malaysianScore } from '../src/engine/rules/malaysian';
import type { ScoringContext } from '../src/engine/rules/types';
import type { Meld } from '../src/engine/state';

const NEW = ['words', 'scoring', 'shapes', 'tradition', 'hongkong', 'mcr', 'sichuan', 'malaysian', 'uae-taiwanese', 'uae-american', 'uae-custom'];
const text = (id: string) => {
  const l = LESSONS[id];
  return [...l.scenes.flatMap((s) => [s.title, s.say]), ...l.quiz.flatMap((q) => [q.q, q.explain, ...q.options.map((o) => o.text)])].join(' ');
};

describe('academy lessons', () => {
  it('lists every lesson once on the Academy path, with tradition optional', () => {
    expect([...ACADEMY_ORDER].sort()).toEqual(Object.keys(LESSONS).filter((l) => !RETIRED_LESSONS.includes(l)).sort());
    expect(OPTIONAL_LESSONS).toEqual(['tradition']);
    // Every playable version has a lesson of its own.
    for (const v of VARIATIONS) if (v.profile && v.id !== 'classic') expect(LESSONS[v.id], v.id).toBeDefined();
    // Every lesson has Mei's guided-game script for its table.
    for (const id of ['hongkong', 'mcr', 'sichuan', 'malaysian', 'uae-taiwanese', 'uae-american', 'uae-custom']) expect(SCRIPTS[id], id).toBeDefined();
    // The Dubai tables link to the lesson they build on.
    expect([LESSONS['uae-taiwanese'].base, LESSONS['uae-american'].base, LESSONS['uae-custom'].base]).toEqual(['taiwanese', 'american', 'uae']);
    expect(ACADEMY_ORDER.slice(0, 3)).toEqual(['basics', 'words', 'scoring']);
  });

  for (const id of Object.keys(LESSONS)) {
    it(`${id}: short scenes, a valid quiz, and tiles that draw`, () => {
      const l = LESSONS[id];
      expect(l.id).toBe(id);
      expect(l.scenes.length).toBeGreaterThan(0);
      expect(l.scenes.length).toBeLessThanOrEqual(20);
      // Golden rule: each scene is short enough to take in at a glance.
      for (const s of l.scenes) expect(s.say.split(/\s+/).length, s.title).toBeLessThanOrEqual(75);
      expect(l.quiz.length).toBeGreaterThanOrEqual(3);
      for (const q of l.quiz) {
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
        expect(new Set(q.options.map((o) => o.text)).size).toBe(q.options.length);
        for (const o of q.options) if (o.tiles) expect(parseKinds(o.tiles).length, o.tiles).toBeGreaterThan(0);
      }
      for (const s of l.scenes) if (s.visual && 'tiles' in s.visual) for (const spec of s.visual.tiles) expect(parseKinds(spec).length, `${s.title}: ${spec}`).toBeGreaterThan(0);
    });
  }

  it('narrates every new lesson line and quiz question', () => {
    const lines = new Set(narrationLines());
    for (const id of NEW) {
      for (const s of LESSONS[id].scenes) expect(lines.has(s.say), s.title).toBe(true);
      for (const q of LESSONS[id].quiz) expect(lines.has(q.q), q.q).toBe(true);
    }
    for (const l of coachLines()) expect(lines.has(l)).toBe(true);
  });

  it('introduces each word before a lesson uses it', () => {
    // word -> the lesson that first explains it. No lesson earlier on the path may use it.
    const intro: Record<string, string> = {
      meld: 'words',
      terminal: 'words',
      'self-draw': 'words',
      tenpai: 'words',
      'prevailing wind': 'words',
      faan: 'words',
      tai: 'words',
      han: 'words',
      phán: 'words',
      Ron: 'words',
      Tsumo: 'words',
      Phỗng: 'words',
      'chicken hand': 'scoring',
      hanchan: 'rounds',
      goulash: 'words',
      'seven pairs': 'scoring',
      'thirteen orphans': 'shapes',
      Sanshoku: 'shapes',
      yaku: 'words',
      dora: 'words',
      'dead wall': 'words',
      furiten: 'riichi',
      fu: 'words',
      exposure: 'american',
      Khung: 'vietnamese',
      shooter: 'words',
      fan: 'words',
      Sheung: 'hongkong',
      'half-spicy': 'hongkong',
      'Sik Wu': 'hongkong',
      Peng: 'words',
      'wind and rain': 'sichuan',
      'missing suit': 'sichuan',
      'knitted': 'mcr',
    };
    for (const [word, at] of Object.entries(intro)) {
      const re = new RegExp(`(^|[^\\p{L}])${word}s?([^\\p{L}]|$)`, 'iu');
      const first = ACADEMY_ORDER.find((id) => re.test(text(id)));
      expect(first, `"${word}" should first appear in ${at}, where it is explained`).toBe(at);
    }
  });

  it('basics explains the claim window and the table timer', () => {
    const t = text('basics');
    expect(t).toMatch(/next player draws/);
    expect(t).toMatch(/almost instant/);
    expect(t).toMatch(/relaxed, standard or competitive/);
    expect(SCRIPTS.classic.claim.pung).toMatch(/next player draws/);
  });

  it('keeps seat directions right: from East, South is on the right, West across, North on the left', () => {
    for (const id of ['basics', 'tradition']) expect(text(id)).toMatch(/South is on your right, West is across, and North is on your left/);
    expect(text('rounds')).toMatch(/player on East’s right is South, the player opposite is West, and the player on East’s left is North/);
    const all = ACADEMY_ORDER.map(text).join(' ');
    expect(all).not.toMatch(/South (is|sits) on (your|East’s) left|North (is|sits) on (your|East’s) right/);
  });

  it('never claims one official UAE ruleset, and keeps American rules apart', () => {
    expect(text('uae')).toMatch(/no single official UAE way/);
    expect(text('tradition')).toMatch(/no single official UAE rulebook/);
    // The Dubai Asian goulash exchanges three tiles; the Charleston and the card belong to American tables.
    for (const id of ['uae', 'uae-taiwanese', 'uae-custom']) expect(text(id), id).not.toMatch(/Charleston|\bcard\b/i);
    for (const id of ['uae', 'uae-taiwanese', 'uae-american', 'uae-custom']) expect(text(id), id).toMatch(/not an official|no single official|official UAE rulebook|isn’t the League’s card/);
    expect(text('american')).not.toMatch(/faan|\btai\b|\bhan\b|yaku/);
  });

  it('every variant lesson opens with where it is played and how it differs', () => {
    for (const id of ['riichi', 'taiwanese', 'american', 'uae', 'vietnamese', 'indian', 'singapore', 'hongkong', 'mcr', 'sichuan', 'malaysian']) {
      const opening = LESSONS[id].scenes.slice(0, 2).map((s) => s.say).join(' ');
      expect(opening, id).toMatch(/Classic|Asian rules|game all of its own/);
    }
  });
});

describe('scoring lesson examples match the Classic engine', () => {
  const tiles = (spec: string) => parseKinds(spec).map((kind, id) => ({ id, kind }));
  const score = (concealed: string, melds: Meld[], win: number, selfDrawn: boolean) => {
    const counts = new Array(34).fill(0);
    for (const k of parseKinds(concealed)) counts[k]++;
    const [decomposition] = winningDecompositions(counts, melds.length, { sevenPairs: true, thirteenOrphans: true });
    expect(decomposition).toBeDefined();
    return classicScore({ decomposition, melds, concealedCounts: counts, winKind: win, selfDrawn, seatWind: 'S', prevailingWind: 'E', isDealer: false, lastTileOfWall: false, afterKong: false, dealerRepeat: 0 });
  };
  const pay = (s: ReturnType<typeof classicScore>, discarder: number | null) => classicPayments(0, discarder, s, 1, 4, 0).map((p) => p.amount);

  it('example one: a chicken hand on a discard is 16, the discarder pays 32, the others 8', () => {
    const s = score('123m 456p 789s 55m', [{ type: 'pung', tiles: tiles('777p'), concealed: false, from: 3 }], parseKinds('5m')[0], false);
    expect([s.value, s.points]).toEqual([0, 16]);
    expect(pay(s, 3)).toEqual([8, 8, 32]);
  });

  it('example two: concealed, self-drawn, Red Dragons is 3 faan, 128 from everyone', () => {
    const s = score('RdRdRd 234m 567p 678s 99s', [], parseKinds('9s')[0], true);
    expect([s.value, s.points]).toEqual([3, 128]);
    expect(pay(s, null)).toEqual([128, 128, 128]);
  });

  it('example three: mixed one suit with Green Dragons on a discard is 4 faan, 512 and 128', () => {
    const s = score('456s 789s GdGdGd 22s', [{ type: 'chow', tiles: tiles('123s'), concealed: false, from: 3 }], parseKinds('2s')[0], false);
    expect([s.value, s.points]).toEqual([4, 256]);
    expect(pay(s, 3)).toEqual([128, 128, 512]);
  });
});

describe('variant lesson examples match their engines', () => {
  const tiles = (spec: string) => parseKinds(spec).map((kind, id) => ({ id, kind }));
  const ctx = (concealed: string, melds: Meld[], win: string, selfDrawn: boolean, extra: Partial<ScoringContext> = {}): ScoringContext => {
    const counts = new Array(34).fill(0);
    for (const k of parseKinds(concealed)) counts[k]++;
    const [decomposition] = winningDecompositions(counts, melds.length, { sevenPairs: true, thirteenOrphans: true });
    expect(decomposition).toBeDefined();
    return { decomposition, melds, concealedCounts: counts, winKind: parseKinds(win)[0], selfDrawn, seatWind: 'S', prevailingWind: 'E', isDealer: false, lastTileOfWall: false, afterKong: false, dealerRepeat: 0, ...extra };
  };
  const amounts = (ps: { amount: number }[]) => ps.map((p) => p.amount);

  it('Hong Kong: half flush, round wind, no flowers on a discard is 5 faan, 192; the others pay 96', () => {
    const s = hongKongScore(ctx('456s 789s EEE 55s', [{ type: 'chow', tiles: tiles('123s'), concealed: false, from: 3 }], '5s', false, { flowers: [] }));
    expect([s.value, s.points]).toEqual([5, 192]);
    expect(amounts(hkHalfGun(0, 3, s, 1, 4))).toEqual([96, 96, 192]);
  });

  it('MCR: mixed triple chow, all chows, concealed, no honours is 13 fan; the discarder pays 21, the others 8', () => {
    const s = mcrScore(ctx('234m 234p 234s 789s 55p', [], '4m', false));
    expect(s.value).toBe(13);
    expect(s.items.map((i) => i.name).sort()).toEqual(['All Chows', 'Concealed Hand', 'Mixed Triple Chow', 'No Honours']);
    expect(amounts(mcrPayments(0, 3, s, 1, 4))).toEqual([8, 8, 21]);
  });

  it('Sichuan: all pungs in one suit by self-draw is 3 fan, 90 from each player', () => {
    const s = sichuanScore(ctx('111s 333s 555s 777s 99s', [], '9s', true));
    expect([s.value, s.points]).toEqual([3, 90]);
    expect(amounts(sichuanPayments(0, null, s, 1, 4))).toEqual([90, 90, 90]);
    // A hand holding all three suits can't win.
    expect(sichuanScore(ctx('123m 456p 789s 222m 55p', [], '5p', false)).qualifies).toBe(false);
  });

  it('Malaysian: Pong Pong plus a cat on a discard is 3 tai, 128; the discarder pays 256', () => {
    const s = malaysianScore(ctx('222m 444m 555p 888s 66p', [], '6p', false, { flowers: parseKinds('Cat') }));
    expect([s.value, s.points]).toEqual([3, 128]);
    expect(amounts(malaysianProfile.payments(0, 3, s, 1, 4, 0))).toEqual([128, 128, 256]);
  });
});

describe('Mastering Mahjong examples follow the engine', () => {
  const counts = (spec: string) => {
    const c = new Array(34).fill(0);
    for (const k of parseKinds(spec)) c[k]++;
    return c;
  };
  const shapes = { sevenPairs: true, thirteenOrphans: true };
  const kinds = (spec: string) => [...parseKinds(spec)].sort((a, b) => a - b);

  it('Building a fast hand: steps from ready', () => {
    expect(standardShanten(counts('123m 456p 789s EE 45s'), 0)).toBe(0);
    expect(standardShanten(counts('123m 456p 78s EE 45s N'), 0)).toBe(1);
    expect(standardShanten(counts('123m 45p 78s EE 13s N W'), 0)).toBe(2);
    // One step from ready: 3, 6 or 9 of Bamboo move it on.
    const one = counts('123m 456p 45s 78s EE N');
    expect(standardShanten(one, 0)).toBe(1);
    for (const t of ['3s', '6s', '9s']) {
      const c = counts(`123m 456p 45s 78s EE N ${t}`);
      c[parseKinds('N')[0]]--;
      expect(standardShanten(c, 0), t).toBe(0);
    }
  });

  it('Reading waits: every shape waits where the lesson says', () => {
    const cases: [string, string][] = [
      ['SSS WWW NNN GdGd 45s', '3s 6s'],
      ['SSS WWW NNN GdGd 46s', '5s'],
      ['SSS WWW NNN GdGd 12s', '3s'],
      ['SSS WWW NNN 55p 88s', '5p 8s'],
      ['SSS WWW NNN RdRdRd E', 'E'],
      ['SSS WWW NNN 3456s', '3s 6s'],
      ['SSS WWW NNN 2345m', '2m 5m'],
      ['SSS WWW NNN 4445p', '3p 5p 6p'],
      ['SSS WWW NNN 1112s', '2s 3s'],
      ['123m 456p 789s EE 45s', '3s 6s'],
    ];
    for (const [hand, wins] of cases) expect(waits(counts(hand), 0, shapes), hand).toEqual(kinds(wins));
  });
});

describe('India Rules lesson examples follow the engine', () => {
  const counts = (s: string) => {
    const c = new Array(34).fill(0);
    for (const k of parseKinds(s)) c[k]++;
    return c;
  };
  it('East round: three pungs in three suits, a chow and a pair is a 9 + 3 + 2 passport hand', () => {
    const r = eastReading(counts('444m 777s 222p 567m WdWd'), [], true);
    expect(r?.passports.length).toBe(1);
    expect(EAST_PAY.concealed).toBe(1000);
  });
  it('West round: the worked goulash hand is clean, 48 points and 4 doubles, 768', () => {
    const k = (s: string) => parseKinds(s)[0];
    const groups = [
      { kind: k('Rd'), kong: false, concealed: false },
      { kind: k('Wd'), kong: false, concealed: true },
      { kind: k('1s'), kong: false, concealed: true },
      { kind: k('9s'), kong: false, concealed: true },
    ];
    const c = westCount(parseKinds('RdRdRd WdWdWd 111s 999s 55s'), groups, k('5s'), [], 'S', 'W', { selfDrawn: false, concealed: false, lastTile: false, earthly: false, heavenly: false });
    expect(c.clean).toBe('One suit with honours');
    expect([c.points, c.doubles, c.score]).toEqual([48, 4, 768]);
  });
  it('West round: the losing hand in the goulash twist counts 14 points, 3 doubles, 112', () => {
    const gd = parseKinds('Gd')[0];
    const melds = [{ type: 'pung', concealed: false, tiles: [gd, gd, gd].map((kind) => ({ kind })) }] as unknown as Meld[];
    const c = loserCount(parseKinds('333p 4p 6p 77p 9p NN'), melds, parseKinds('F3'), 'W', 'W');
    expect(c.clean).toBe('One suit with honours');
    expect([c.points, c.doubles, c.score]).toEqual([14, 3, 112]);
    // East pays double, North pays once, the winner nothing.
    expect(c.score * 2 + c.score).toBe(336);
  });
  it('West round: the penalty hand is 34 points, 3 doubles, 272, and the thrower pays 1,088', () => {
    const k = (s: string) => parseKinds(s)[0];
    const groups = [
      { kind: k('Rd'), kong: false, concealed: false },
      { kind: k('N'), kong: false, concealed: false },
      { kind: k('W'), kong: false, concealed: false },
      { kind: k('6m'), kong: false, concealed: false },
    ];
    const c = westCount(parseKinds('RdRdRd NNN WWW 666m 22m'), groups, k('2m'), [], 'N', 'W', { selfDrawn: false, concealed: false, lastTile: false, earthly: false, heavenly: false });
    expect([c.points, c.doubles, c.score]).toEqual([34, 3, 272]);
    expect(c.score * 2 + c.score + c.score).toBe(1088);
  });
  it.each(WEST_EXAMPLES.map((x) => [x.title, x] as const))('West round score sheet: %s is a clean winning hand worth what Mei says', (_t, x) => {
    const c = goulashCount(x);
    expect(c.clean).not.toBeNull();
    expect(c.doubles).toBeGreaterThanOrEqual(3);
    expect(c.score).toBe(x.score);
    // 4 sets of 3 or 4 tiles and a pair.
    expect(x.sets.length).toBe(4);
    expect(parseKinds(x.pair).length).toBe(2);
  });
});
