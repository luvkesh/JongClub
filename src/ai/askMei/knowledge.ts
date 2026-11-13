// Ask Mei's knowledge: what Mei is allowed to answer from. Every pack is built
// from the game's own data, so her answers follow the rule files, the scoring
// guides and the Academy lessons the player already sees: the Mahjong family
// (src/engine/rules), the Variations panels (src/ui/versions.ts), the scoring
// guides (src/ui/scoringGuideData.ts), the lessons (src/ui/academy.ts) and the
// rule notes in docs/variants/. India Rules comes first, as everywhere in the club.
//
// A question never sends the whole library: selectPacks() scores each pack
// against the question (and the last few turns) and fills a word budget, with
// the core pack always first and India Rules the fallback when nothing matches.

import { LESSONS } from '../../ui/academy';
import { VARIATIONS, type VariationInfo } from '../../engine/rules';
import { guideFor } from '../../ui/scoringGuideData';
import { VERSIONS } from '../../ui/versions';
import { VARIATION_SHEETS } from '../../club/variationSheets';
import type { RuleProfile } from '../../engine/rules/types';

export type PackKind = 'core' | 'foundation' | 'variation' | 'doc';

export interface Pack {
  id: string;
  title: string;
  kind: PackKind;
  /** The Academy lesson the pack comes from, for Mei's "open the lesson" link. */
  lesson?: string;
  /** The variation the pack describes. */
  variation?: string;
  /** Words that name this pack (the game's names, aliases and its own terms). */
  keys: string[];
  text: string;
  words: number;
}

/** The rule notes in docs/variants/, read at build time. */
const DOCS = import.meta.glob('../../../docs/variants/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const FOUNDATIONS = ['basics', 'scoring', 'rounds', 'shapes', 'strategy', 'tradition', 'words', 'efficiency', 'waits', 'defence', 'value'];

/** Extra words a player may use for a game, beyond its name and region. */
const ALIASES: Record<string, string[]> = {
  india: ['india', 'indian', 'mumbai', 'bombay', 'passport', 'passports', 'small card', 'small cards', 'big card', 'big cards', 'goulash', 'crochet', 'crochets', 'knit', 'knits', 'mixed chow', 'bouquet', 'qwong', 'joker', 'jokers', 'minor', 'major', 'calling', 'buying', 'exchange', 'tic-tac-toe', 'ulta pulta', 'news', 'east round', 'south round', 'west round', 'north round', 'doubles', 'clean hand', 'dirty hand'],
  classic: ['classic', 'chinese classical', 'traditional', 'faan', 'seven pairs', 'thirteen orphans', 'basic'],
  riichi: ['riichi', 'japanese', 'japan', 'yaku', 'dora', 'furiten', 'ron', 'tsumo', 'han', 'fu', 'honba', 'tenpai', 'yakuman', 'red five', 'aka', 'chi', 'pon', 'kan'],
  taiwanese: ['taiwanese', 'taiwan', 'tai', 'sixteen', '16-tile', 'dealer streak'],
  american: ['american', 'america', 'usa', 'card', 'charleston', 'jokers', 'nmjl', 'racks', 'exposure', 'exposures', 'mah jongg'],
  uae: ['uae', 'dubai', 'emirates', 'club card', 'house rules'],
  'uae-taiwanese': ['dubai taiwanese', 'cheat sheet'],
  'uae-american': ['dubai american'],
  'uae-custom': ['custom', 'host'],
  vietnamese: ['vietnamese', 'vietnam', 'khung', 'phán', 'phan', 'chiếu'],
  indian: ['kolkata', 'calcutta', 'joker club', 'club faan'],
  singapore: ['singapore', 'animals', 'animal', 'bite', 'shooter'],
  hongkong: ['hong kong', 'hongkong', 'cantonese', 'half spicy', 'three faan', 'hk'],
  mcr: ['mcr', 'chinese official', 'official', 'competition', 'eight fan', 'fan', 'international'],
  sichuan: ['sichuan', 'blood battle', 'missing suit', 'bloody', 'wind and rain'],
  malaysian: ['malaysian', 'malaysia'],
  korean3: ['korean', 'korea', 'three players', '3 players', 'three-player'],
  sanma: ['sanma', 'three-player riichi', 'kita', 'nuki'],
  malaysian3: ['malaysian three', 'two suits'],
  'riichi-tournament': ['tournament', 'league', 'wrc', 'ema riichi'],
  ema: ['ema', 'european mahjong', 'tournament'],
  korean: ['korean four', 'korean 4'],
  guangdong: ['guangdong', 'push-down', 'push down', 'canton'],
  'zung-jung': ['zung jung', 'zung-jung', 'zungjung'],
  european: ['european', 'british', 'britain', 'uk', 'english'],
  wuhan: ['wuhan'],
  shanghai: ['shanghai'],
  fujian: ['fujian', 'fuzhou'],
  beijing: ['beijing', 'peking'],
  northeast: ['northeast', 'dongbei', 'harbin'],
  'wright-patterson': ['wright-patterson', 'wright patterson', 'military', 'air force'],
  thai: ['thai', 'thailand'],
  filipino: ['filipino', 'philippines', 'philippine', 'pinoy'],
  indonesian: ['indonesian', 'indonesia'],
};

/** docs/variants notes and which packs they extend (a section of the India rulebook notes goes to the matching round). */
const DOC_HOMES: Record<string, string[]> = {
  'india-rules.md': ['india'],
  'goulash.md': ['india', 'uae', 'classic'],
  'special-rounds.md': ['classic', 'uae'],
  'mixed-hands-and-pairs.md': ['classic'],
  'taiwanese-dubai-card.md': ['uae-taiwanese', 'uae'],
  'vietnamese.md': ['vietnamese'],
  'singapore.md': ['singapore'],
  'indian.md': ['indian'],
  'dice-and-wall-break.md': ['rounds'],
};

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Lower-case word tokens of a text (letters and digits; hyphens kept inside words). */
export const tokens = (s: string): string[] => (s.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).map((w) => w.replace(/['’]s$/, ''));

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'is', 'it', 'i', 'you', 'we', 'my', 'me', 'do', 'does', 'how', 'what', 'when', 'why', 'which', 'can', 'with', 'for', 'this', 'that', 'be', 'are', 'was', 'at', 'by', 'from', 'as', 'if', 'so', 'not', 'no', 'yes', 'about', 'tell', 'explain', 'mean', 'means', 'there', 'they', 'them', 'he', 'she', 'his', 'her', 'its', 'have', 'has', 'had', 'will', 'would', 'should', 'could', 'please', 'mei', 'mahjong', 'tile', 'tiles', 'game', 'games', 'play', 'player', 'players', 'hand', 'hands', 'one', 'two', 'three', 'four', 'win', 'wins', 'rules', 'rule', 'much', 'many', 'more', 'also', 'but', 'than', 'then', 'up', 'out', 'any', 'all', 'some', 'into', 'just', 'like', 'get', 'got', 'use', 'used', 'am', 'your', 'our', 'their']);

function lessonText(id: string): string {
  const l = LESSONS[id];
  if (!l) return '';
  const scenes = l.scenes.map((s) => `${s.title}: ${s.say}`).join('\n');
  // The test's right answers are rules too, stated plainly.
  const quiz = l.quiz.map((q) => `Q: ${q.q} A: ${q.options[q.answer]?.text ?? ''}`).join('\n');
  return `${scenes}\n${quiz}`;
}

function guideText(p: RuleProfile): string {
  const g = guideFor(p);
  const lines: string[] = [];
  if (g.win.length) lines.push(`How to win: ${g.win.join(' ')}`);
  if (g.pay) lines.push(`Payment: ${g.pay}`);
  for (const s of g.sections) lines.push(`${s.title}: ` + s.lines.map((l) => `${l.name} (${l.value} ${g.unit}): ${l.how}`).join('; '));
  if (g.card === 'dubai') lines.push('This table scores with the printed Dubai club card, shown in the game as a cheat sheet.');
  if (g.card === 'american') lines.push('This table scores with its own American card of hands.');
  return lines.join('\n');
}

function houseRulesText(p: RuleProfile): string {
  if (!p.houseRules.length) return '';
  return 'House rules the host can set: ' + p.houseRules.map((r) => `${r.label} (${r.options.map((o) => o.label + (o.value === r.default ? ' [default]' : '')).join(' / ')})`).join('; ');
}

function versionText(id: string): string {
  const v = VERSIONS.find((x) => x.id === id) ?? VARIATION_SHEETS.find((s) => s.id === id);
  if (!v) return '';
  const facts = v.facts.map(([k, val]) => `${k}: ${val}`).join('; ');
  return [`${v.hook}`, `Who plays it: ${v.who}`, facts, `Winning: ${v.win}`, v.club ? 'Rules vary from table to table, so the host sets them.' : ''].filter(Boolean).join('\n');
}

/** The Academy path as Mei should name it, with the lesson ids she may link. */
function learnPathText(): string {
  const names = (id: string) => LESSONS[id]?.title ?? id;
  const foundations = FOUNDATIONS.map((id, i) => `${i + 1}. ${names(id)} [[lesson:${id}]]`).join('; ');
  const variations = VARIATIONS.filter((v) => v.profile).map((v) => `${v.ruleset ? `${v.name} · ${v.ruleset}` : v.name} [[lesson:${v.lesson ?? (v.id === 'classic' ? 'basics' : v.id)}]]`).join('; ');
  const india = ['india-east', 'india-south', 'india-west', 'india-west-doubles', 'india-west-big', 'india-north'].map((id) => `${names(id)} [[lesson:${id}]]`).join('; ');
  return `Learn path (Foundations and Mastery, all taught with India Rules): ${foundations}.\nIndia Rules course: ${india}.\nVariation lessons: ${variations}.`;
}

function docSection(md: string, heading: RegExp): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let on = false;
  for (const ln of lines) {
    if (/^## /.test(ln)) on = heading.test(ln);
    if (on) out.push(ln);
  }
  return out.join('\n').trim();
}

function docFor(name: string): string {
  const k = Object.keys(DOCS).find((p) => p.endsWith('/' + name));
  return k ? DOCS[k] : '';
}

/** Strip markdown furniture so the text reads as notes. */
const plain = (md: string) => md.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/`/g, '').replace(/\|/g, ' ').replace(/^-{3,}\s*$/gm, '').replace(/\n{3,}/g, '\n\n').trim();

function variationName(v: VariationInfo) {
  return v.ruleset ? `${v.name} · ${v.ruleset}` : v.name;
}

let cache: Pack[] | null = null;

/** Every pack Mei can answer from, built once. */
export function knowledgePacks(): Pack[] {
  if (cache) return cache;
  const packs: Pack[] = [];
  const mk = (p: Omit<Pack, 'words'>): Pack => ({ ...p, words: words(p.text) });

  // The core: what the club is, which games it has, and where things are.
  const family = VARIATIONS.filter((v) => v.profile).map((v) => `${variationName(v)} (${v.region}; ${v.level}; ${v.profile!.players === 3 ? 'three players' : 'four players'}): ${v.blurb}`).join('\n');
  packs.push(
    mk({
      id: 'core',
      title: 'JongClub and the Mahjong family',
      kind: 'core',
      keys: ['jongclub', 'club', 'app', 'variations', 'variation', 'which', 'learn', 'academy', 'lesson', 'lessons', 'mini-games', 'jong points', 'points', 'collection', 'atelier', 'profile', 'rating', 'seasons', 'tournament', 'live', 'friends', 'host', 'join'],
      text: [
        'JongClub is a premium online Mahjong club: a 3D table, 31 variations, the Mahjong Academy with Mei, mini-games, a Club with ratings and seasons, and a Collection of tile sets, racks and rooms. It is a club, never a casino.',
        'Menu: Home, Play (Quick Start, Host a New Game, Join a Friend with a table code, Variations, Daily hand), Mini-games (20 solo games that pay Jong Points), Learn (the Academy: lessons with Mei, daily drills, a placement test), Club (seasons, leagues, tournaments, private clubs, World Tour) and Profile (Collection, Jong Points, Settings). JongBot is the in-game helper at the table: tap it for what to discard and why.',
        'India Rules is the club’s main game and the default table. Chinese Classical comes second. Lessons are taught in English in Mei’s recorded voice; the rest of the app is in six languages.',
        'Jong Points are earned by playing, lessons and mini-games (never bought with rating). Levels 1 to 5, every India Rules lesson and the Kolkata Joker Club are free; later lessons open with Jong Points.',
        'The Mahjong family at the club:',
        family,
        learnPathText(),
      ].join('\n'),
    }),
  );

  // Foundations and Mastery, India Rules throughout.
  for (const id of FOUNDATIONS) {
    const l = LESSONS[id];
    if (!l) continue;
    const extra = id === 'rounds' ? '\n' + plain(docFor('dice-and-wall-break.md')) : '';
    packs.push(mk({ id: `lesson:${id}`, title: `Lesson: ${l.title}`, kind: 'foundation', lesson: id, variation: 'india', keys: tokens(l.title), text: lessonText(id) + extra }));
  }

  // One pack per playable variation: its sheet, scoring guide, house rules and lesson.
  for (const v of VARIATIONS) {
    const p = v.profile;
    if (!p) continue;
    const lesson = v.lesson ?? (v.id === 'classic' ? 'basics' : v.id);
    const name = variationName(v);
    const keys = [...tokens(name), ...tokens(v.region), ...(ALIASES[v.id] ?? []).flatMap((a) => [a, ...tokens(a)])];
    const parts = [`${name} (${v.region}). ${v.blurb}`, p.summary, versionText(v.id), guideText(p), houseRulesText(p)];
    if (p.callNames) parts.push('Call words at this table: ' + Object.entries(p.callNames).map(([k, n]) => `${k}: ${n}`).join(', '));
    if (v.id !== 'india' && v.id !== 'classic') parts.push(lessonText(lesson));
    if (v.id === 'classic') parts.push(lessonText('classic'));
    for (const [doc, homes] of Object.entries(DOC_HOMES)) if (homes.includes(v.id) && doc !== 'india-rules.md') parts.push(plain(docFor(doc)));
    packs.push(mk({ id: `variation:${v.id}`, title: name, kind: 'variation', lesson, variation: v.id, keys, text: parts.filter(Boolean).join('\n') }));
  }

  // India Rules in depth: the course lessons, each with its part of the rulebook notes.
  const book = docFor('india-rules.md');
  const indiaParts: [string, RegExp, string[]][] = [
    ['india', /Equipment|The match|Classic/, ['india rules', 'match', 'classic', 'minor', 'major', 'bouquet', 'flowers', 'seasons', 'jokers', 'rotation', 'deal']],
    ['india-east', /East/, ['east', 'passport', 'passports', 'first round', 'concealed', 'exposed']],
    ['india-south', /South/, ['south', 'small card', 'small cards', 'exchange', 'tic-tac-toe', 'buy', 'buying', 'bank', 'secret card']],
    ['india-west', /West/, ['west', 'goulash', 'doubles', 'double', 'clean', 'dirty', 'penalty', 'chart', 'pung', 'kong']],
    ['india-west-doubles', /West/, ['west', 'goulash', 'double', 'doubles', 'score sheet']],
    ['india-west-big', /West/, ['west', 'goulash', 'blessings', 'big doubles', 'limit']],
    ['india-north', /North/, ['north', 'big card', 'big cards', 'joker goulash', 'qwong', 'east’s choice', 'kong', 'run']],
  ];
  for (const [id, re, keys] of indiaParts) {
    const l = LESSONS[id];
    if (!l) continue;
    const notes = id.endsWith('doubles') || id.endsWith('big') ? '' : plain(docSection(book, re));
    packs.push(mk({ id: `lesson:${id}`, title: `India Rules: ${l.title}`, kind: 'variation', lesson: id, variation: 'india', keys: ['india', 'indian', ...keys, ...tokens(l.title)], text: `${lessonText(id)}\n${notes}` }));
  }

  cache = packs;
  return packs;
}

export interface SelectOptions {
  /** The question and, before it, the last few turns (older first). */
  recent?: string[];
  /** The lesson open in Learn, if any. */
  lesson?: string | null;
  /** The variation the player last played, if any. */
  variation?: string | null;
  /** Word budget for the packs sent with a question. */
  budget?: number;
}

/** Inverse document frequency of every token across packs, computed once. */
let idfCache: Map<string, number> | null = null;
function idf(packs: Pack[]): Map<string, number> {
  if (idfCache) return idfCache;
  const df = new Map<string, number>();
  for (const p of packs) for (const t of new Set(tokens(p.text))) df.set(t, (df.get(t) ?? 0) + 1);
  idfCache = new Map([...df].map(([t, n]) => [t, Math.log((packs.length + 1) / n)]));
  return idfCache;
}

/** Score a pack for a question: named games count most, then rare words the pack contains. */
export function scorePack(pack: Pack, question: string, recent: string[] = []): number {
  const q = question.toLowerCase();
  const qTokens = new Set(tokens(question).filter((t) => !STOP.has(t)));
  const rTokens = new Set(recent.flatMap(tokens).filter((t) => !STOP.has(t)));
  let score = 0;
  for (const k of pack.keys) {
    if (k.includes(' ') ? q.includes(k) : qTokens.has(k)) score += k.includes(' ') ? 6 : 3;
    else if (!k.includes(' ') && rTokens.has(k)) score += 1;
  }
  const weights = idf(knowledgePacks());
  const body = new Set(tokens(pack.text));
  for (const t of qTokens) if (body.has(t)) score += Math.min(2.5, weights.get(t) ?? 0);
  for (const t of rTokens) if (body.has(t) && !qTokens.has(t)) score += Math.min(0.6, (weights.get(t) ?? 0) / 4);
  return score;
}

/** The packs to send with a question: the core, then the best matches that fit the budget. */
export function selectPacks(question: string, o: SelectOptions = {}): Pack[] {
  const packs = knowledgePacks();
  const budget = o.budget ?? 9000;
  const core = packs.find((p) => p.kind === 'core')!;
  const scored = packs
    .filter((p) => p.kind !== 'core')
    .map((p) => {
      let s = scorePack(p, question, o.recent);
      if (o.lesson && p.lesson === o.lesson) s += 4;
      if (o.variation && p.variation === o.variation) s += p.kind === 'variation' ? 2.5 : 1;
      // India Rules first: a tie goes to the club's own game.
      if (p.variation === 'india') s += 0.5;
      return { p, s };
    })
    .sort((a, b) => b.s - a.s);
  const out: Pack[] = [core];
  let used = core.words;
  const best = scored[0]?.s ?? 0;
  for (const { p, s } of scored) {
    // Only packs that match something; the weakest matches are left out once the strong ones are in.
    if (s < 2 || (best >= 8 && s < best / 4)) continue;
    if (used + p.words > budget) continue;
    out.push(p);
    used += p.words;
  }
  // Nothing named: start from the game the player is in, else the club's own game and the basics.
  if (out.length === 1) {
    const fallback = [o.lesson ? `lesson:${o.lesson}` : '', o.variation ? `variation:${o.variation}` : '', 'variation:india', 'lesson:basics'].filter(Boolean);
    for (const id of fallback) {
      const p = packs.find((x) => x.id === id);
      if (p && !out.includes(p) && used + p.words <= budget) (out.push(p), (used += p.words));
    }
  }
  return out;
}

/** The lesson ids Mei may link in a reply. */
export const linkableLessons = (): string[] => Object.keys(LESSONS);

/** Reset the caches (tests). */
export function resetKnowledge() {
  cache = null;
  idfCache = null;
}
