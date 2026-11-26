// The replay review and the key-moment cards speak the player's language: every discard and call
// of recorded bot matches is reviewed for every seat, and the words must be free of English
// sentences in zh-Hans, zh-Hant, ja, ar and hi. The India card names are translated too.
import { afterAll, describe, expect, it } from 'vitest';
import { COLUMNS, tr, useLang, type Lang } from '../src/i18n';
import { keyMoments, shortLine } from '../src/ai/keyMoments';
import { snapshot, walkMatch } from '../src/ai/matchWalk';
import { foldPraiseSafety, reviewClaim, reviewDiscard } from '../src/ai/review';
import { safetySentence, threatSentence, type OpponentRead, type SafetyReason } from '../src/ai/danger';
import { MahjongGame } from '../src/engine/game';
import { getProfile } from '../src/engine/rules';
import { SMALL_CARDS } from '../src/engine/rules/indiaCards';
import { BIG_CARDS } from '../src/engine/rules/indiaBig';
import type { ReplayRecord } from '../src/net/replay';
import { recordMatch } from './helpers/recordMatch';

const NAMES = ['You', 'Mei', 'Rex', 'Hiro'];
/** Kept as written: the players, and the American win, which the card game calls Mah Jongg everywhere. */
const KEEP = [...NAMES, 'Mah Jongg'];
const ENGLISH = /\b(the|you|your|and|with|from|this|that|tile|tiles|hand|ready|discard|waiting|they|their|them|safe|risky|was|were|kept|left|better|calling|passing|passed|call|joker|showing|choice|nice|good|well|spot)\b/i;

function leaks(text: string): string | null {
  let t = text;
  for (const k of KEEP) t = t.split(k).join(' ');
  const m = ENGLISH.exec(t);
  return m ? `${m[0]} in: ${text}` : null;
}

/** Every review of every seat's discards and calls in a recorded match. */
function reviews(rec: ReplayRecord): string[] {
  const out: string[] = [];
  for (const ev of walkMatch(rec)) {
    if (ev.type !== 'action') continue;
    const a = ev.action;
    const g = ev.game;
    try {
      if (a.t === 'd') out.push(reviewDiscard(snapshot(g), a.s, a.id).explanation);
      else if (a.t === 'c' && g.state.phase.kind === 'claims') {
        const opts = g.state.phase.options[a.s] ?? [];
        if (opts.length) out.push(reviewClaim(snapshot(g), a.s, a.r, opts, g.state.phase.tile.kind).explanation);
      }
    } catch {
      /* a variation the review doesn't cover */
    }
  }
  return out;
}

/** The looking-back reads, worded directly (some are rare in a played hand). */
function reads(): string[] {
  const g = new MahjongGame(getProfile('riichi')!, NAMES, 1);
  g.startHand(1);
  const reasons: SafetyReason[] = ['genbutsu', 'passedRiichi', 'passed', 'suji', 'kabe', 'honourDead', 'honourSeen', 'early', 'none'];
  const out = reasons.flatMap((reason) => [safetySentence(4, { hit: 0, reason, via: [0, 6] }, true), safetySentence(4, { hit: 0.1, reason, via: [1] }, true), foldPraiseSafety(4, { hit: 0, reason, via: [1] })]);
  const read = (x: Partial<OpponentRead>) => ({ seat: 1, tenpai: 0.7, value: 1, threat: 1, riichi: false, flushSuit: null, dragonPungs: 0, openMelds: 0, pungHand: false, ...x }) as OpponentRead;
  for (const r of [read({ riichi: true }), read({ flushSuit: 2, openMelds: 2 }), read({ flushSuit: 0, dragonPungs: 2 }), read({ openMelds: 1, tenpai: 0.2 }), read({ tenpai: 0.4 })]) out.push(threatSentence(g, r, true));
  return out;
}

const RECORDS: ReplayRecord[] = [
  recordMatch('classic', 11, 'eastRound'),
  recordMatch('riichi', 12, 'eastRound'),
  recordMatch('hongkong', 13, 'eastRound'),
  recordMatch('india', 7, 'oneHand'),
  recordMatch('american', 5, 'oneHand'),
];

describe('replay review in every language', () => {
  afterAll(() => useLang('en'));

  it('English keeps its words', () => {
    useLang('en');
    const all = RECORDS.flatMap(reviews);
    expect(all.length).toBeGreaterThan(300);
    // The leak check catches English reviews.
    expect(all.filter((x) => !leaks(x))).toEqual([]);
    expect(reads()).toContain("The 5 Character was fairly safe against them: they discarded the 1 Character and 7 Character, so it couldn't finish a two-sided wait.");
    expect(reads()).toContain('Mei (South) looked to be collecting Bamboo and had 2 sets showing and might have been ready.');
    expect(all.some((x) => /^Nice\. The .+ was the right tile: it kept you .+ with \d+ tiles? that helps?\.$/.test(x))).toBe(true);
    expect(all.some((x) => /^You let go of the .+\. The .+ was better: /.test(x))).toBe(true);
  });

  for (const l of COLUMNS as Lang[])
    it(`${l}: no English sentence in any review or key moment`, () => {
      useLang(l);
      const texts = [...reads(), ...RECORDS.flatMap(reviews)];
      for (const rec of RECORDS) for (const m of keyMoments(rec) ?? []) texts.push(m.title, m.line);
      expect(texts.length).toBeGreaterThan(300);
      const bad = [...new Set(texts.map(leaks).filter((x): x is string => !!x))];
      expect(bad.slice(0, 10)).toEqual([]);
      // No placeholder is left unfilled.
      expect(texts.filter((x) => /\{\w+\}/.test(x)).slice(0, 5)).toEqual([]);
    }, 300000);

  it('short lines end at each language’s full stop', () => {
    expect(shortLine('好棋。打三筒是对的。还有 5 张有效牌。再看一句。')).toBe('好棋。打三筒是对的。');
    expect(shortLine('बढ़िया। 3 बिंदु सही टाइल थी। एक और वाक्य। चौथा।')).toBe('बढ़िया। 3 बिंदु सही टाइल थी।');
  });

  it('every India card has its name in every language', () => {
    const same = new Set(['T.O.E.', 'T.O.E. 2', '56']);
    for (const l of COLUMNS as Lang[]) {
      useLang(l);
      const english = [...SMALL_CARDS, ...BIG_CARDS].map((c) => c.name).filter((n) => !same.has(n) && tr(n) === n);
      expect(english, l).toEqual([]);
    }
  });
});
