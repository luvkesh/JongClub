// JongBot's advice speaks the player's language: bots play hands of India Rules (East passports,
// South Small Cards, West Goulash), Riichi, American, Classic and more, and every hint, reason,
// warning, call check, read and target name seen along the way must be free of English sentences
// in zh-Hans, zh-Hant, ja, ar and hi. Card hand names stay as printed on the card. In English the
// advice is unchanged (the jongbot-audit tests check its words).
import { afterAll, describe, expect, it } from 'vitest';
import { COLUMNS, useLang, type Lang } from '../src/i18n';
import { CARD } from '../src/engine/rules/american';
import { SMALL_CARDS } from '../src/engine/rules/indiaCards';
import { safetySentence, threatSentence, type OpponentRead, type SafetyReason } from '../src/ai/danger';
import { MahjongGame } from '../src/engine/game';
import { planName, planNote } from '../src/ai/adviceText';
import { NAMES, adviceFor, profileOf, type AdviceCase } from './helpers-advice';

/** Names that stay English: the players, the card hands and their patterns. */
const KEEP = [...NAMES, 'Mah Jongg', ...SMALL_CARDS.map((c) => c.name), ...CARD.flatMap((h) => [h.section, h.pattern])].sort((a, b) => b.length - a.length);
/** Card hands as the planner writes them ("2468: 222 4444 666 8888") and romaji kept beside a translation. */
const STRIP = [/: [A-Z0-9]{1,6}(?: [A-Z0-9]{1,6})+/g, /（[A-Za-z][^）]*）/g];
/** English words that only show up in an English sentence. */
const ENGLISH = /\b(the|you|your|and|with|from|this|that|tile|tiles|hand|ready|discard|waiting|they|their|them|safe|risky|aim|keep|hold|back|check|card|will|can't|could|would|pung|chow|kong|riichi|pass|declare|swap|joker|showing|likely|doubles|points|concealed|worth)\b/i;

function leaks(text: string): string | null {
  let t = text;
  for (const k of KEEP) if (k) t = t.split(k).join(' ');
  for (const re of STRIP) t = t.replace(re, ' ');
  const m = ENGLISH.exec(t);
  return m ? `${m[0]} in: ${text}` : null;
}

const CASES: AdviceCase[] = [
  { label: 'india-E', profile: profileOf('india', { indiaRounds: 'E' }), seed: 8 },
  { label: 'india-S', profile: profileOf('india', { indiaRounds: 'S' }), seed: 3 },
  { label: 'india-W', profile: profileOf('india', { indiaRounds: 'W' }), seed: 3 },
  { label: 'riichi', profile: profileOf('riichi'), seed: 3 },
  { label: 'american', profile: profileOf('american'), seed: 3 },
  { label: 'classic', profile: profileOf('classic'), seed: 8 },
  { label: 'hongkong', profile: profileOf('hongkong'), seed: 5 },
  { label: 'sichuan', profile: profileOf('sichuan'), seed: 5 },
];

/** Every safety reason, and the opponent reads, worded directly (some are rare in a played hand). */
function sentences(): string[] {
  const g = new MahjongGame(profileOf('riichi'), NAMES, 1);
  g.startHand(1);
  const reasons: SafetyReason[] = ['genbutsu', 'passedRiichi', 'passed', 'suji', 'kabe', 'honourDead', 'honourSeen', 'early', 'none'];
  const out = reasons.flatMap((reason) => [safetySentence(4, { hit: 0, reason, via: [0, 6] }), safetySentence(4, { hit: 0.1, reason, via: [1] })]);
  const read = (x: Partial<OpponentRead>) => ({ seat: 1, tenpai: 0.7, value: 1, threat: 1, riichi: false, flushSuit: null, dragonPungs: 0, openMelds: 0, pungHand: false, ...x }) as OpponentRead;
  for (const r of [read({ riichi: true }), read({ flushSuit: 2, openMelds: 2 }), read({ flushSuit: 0, dragonPungs: 2 }), read({ openMelds: 1, tenpai: 0.2 }), read({ tenpai: 0.4 })]) out.push(threatSentence(g, r));
  for (const n of ['Clean Bamboos', 'Dots with honours', 'Characters half flush', 'Bamboos flush', 'Drop Dots', 'Full Flush (Bamboos)', 'Half Flush (Dots)', 'Honitsu (Characters)', 'Chinitsu (Dots)', 'Yakuhai (Red Dragon)', 'Pung of Green Dragons', 'Pung of East Wind', 'Tanyao (all simples)', 'Toitoi (all pungs)', 'Chiitoitsu (seven pairs)', '1s and 9s', 'All honours', 'Three Dragons', 'All Pungs', 'Seven Pairs', 'Riichi'])
    out.push(planName(n));
  for (const n of ['2 han, closed, declare when ready', '3 doubles', '2 of 3 doubles', 'in Bamboos and Dots', '25 points, concealed', '1 faan, needs 3 with other scoring', 'the missing suit']) out.push(planNote(n));
  return out;
}

describe('JongBot advice in every language', () => {
  afterAll(() => useLang('en'));

  it('English keeps its words', () => {
    useLang('en');
    const s = sentences();
    expect(s).toContain("The 5 Character is fairly safe against them: they discarded the 1 Character and 7 Character, so it can't finish a two-sided wait.");
    expect(s).toContain('Bo (South) looks to be collecting Bamboo and has 2 sets showing and may be ready.');
    expect(planName('Yakuhai (Red Dragon)')).toBe('Yakuhai (Red Dragon)');
    // The leak check catches English advice.
    const english = adviceFor(CASES[3], 120).map((x) => x.split('|').slice(2).join('|'));
    const said = english.filter((x) => /\.( |$)/.test(x));
    expect(said.length).toBeGreaterThan(100);
    expect(said.filter((x) => !leaks(x))).toEqual([]);
    expect(leaks('Discard the 7 Bamboo.')).not.toBeNull();
  });

  for (const l of COLUMNS as Lang[])
    it(`${l}: no English sentence in any advice`, () => {
      useLang(l);
      const texts = [...sentences(), ...CASES.flatMap((c) => adviceFor(c, 160).map((x) => x.split('|').slice(2).join('|')))];
      expect(texts.length).toBeGreaterThan(500);
      const bad = [...new Set(texts.map(leaks).filter((x): x is string => !!x))];
      expect(bad.slice(0, 10)).toEqual([]);
    }, 300000);
});
