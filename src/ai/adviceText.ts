// JongBot's words in the player's language. The advice code builds its sentences
// with tr() templates; the helpers here give it the shared pieces (how far from
// ready, a suit, a call word, a list) and translate the target hands' names and
// notes, which the planners keep in English because the code reads them too.
// In English every helper returns exactly the English it always has.

import { andList, lang, listSep, tr, trn } from '../i18n';
import { tileLabel } from '../i18n/tiles';
import { KIND_COUNT, tileName } from '../engine/tiles';

/** Sentences joined as the language writes them: no space after a Chinese or Japanese full stop. */
export function sentences(...parts: (string | null | undefined | false)[]): string {
  const cjk = lang() === 'zh-Hans' || lang() === 'zh-Hant' || lang() === 'ja';
  return parts.filter(Boolean).join(cjk ? '' : ' ');
}

/** "2 tiles from ready", "ready", or no win left. */
export const fromReady = (n: number) => (n >= 99 ? tr('no win possible with these sets') : n <= 0 ? tr('ready') : trn(n, '{n} tile from ready', '{n} tiles from ready'));

/** A suit, as advice names it in the plural: Characters, Dots, Bamboos. */
export const suitName = (s: number) => [tr('Characters'), tr('Dots'), tr('Bamboos')][s] ?? '';
const SUIT_EN = ['Characters', 'Dots', 'Bamboos'];

/** Tile names joined with commas (the waits, the furiten tiles). */
export const tileList = (kinds: number[]) => kinds.map((k) => tileLabel(k)).join(listSep());

/** "A, B and C": English keeps its own join (no Oxford comma); other languages their own. */
export function andJoin(items: string[]): string {
  if (lang() !== 'en') return andList(items);
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * A call word in a sentence ("this pung", "this pon"): English keeps the word it is given; other
 * languages say the call as the buttons do (碰, ポン...). The ruleset's "Riichi" is the word riichi,
 * not the variation's name.
 */
export function callWord(word: string): string {
  if (lang() === 'en') return word;
  if (word.toLowerCase() === 'riichi') return tr('riichi');
  if (word.toLowerCase() === 'buy') return tr('Buy');
  return tr(word.charAt(0).toUpperCase() + word.slice(1));
}

/** A risk label from danger.ts (Safe, Low, Medium, High). */
export const riskWord = (label: string) => (label === 'Safe' ? tr('Safe') : label === 'Low' ? tr('Low') : label === 'Medium' ? tr('Medium') : label === 'High' ? tr('High') : tr(label));

let byName: Map<string, number> | null = null;
/** A tile named in English ("Red Dragon"), in the player's language. */
function tileNamed(en: string): string {
  byName ??= new Map(Array.from({ length: KIND_COUNT }, (_, k) => [tileName(k), k] as [string, number]));
  const k = byName.get(en);
  return k === undefined ? tr(en) : tileLabel(k);
}
const suitNamed = (en: string) => (SUIT_EN.includes(en) ? suitName(SUIT_EN.indexOf(en)) : en === 'Bamboo' ? tr('Bamboo') : tr(en));

const NAME_RULES: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^Clean (\w+)$/, (m) => tr('Clean {suit}', { suit: suitNamed(m[1]) })],
  [/^(\w+) with honours$/, (m) => tr('{suit} with honours', { suit: suitNamed(m[1]) })],
  [/^(\w+) half flush$/, (m) => tr('{suit} half flush', { suit: suitNamed(m[1]) })],
  [/^(\w+) flush$/, (m) => tr('{suit} flush', { suit: suitNamed(m[1]) })],
  [/^Drop (\w+)$/, (m) => tr('Drop {suit}', { suit: suitNamed(m[1]) })],
  [/^Full Flush \((\w+)\)$/, (m) => tr('Full Flush ({suit})', { suit: suitNamed(m[1]) })],
  [/^Half Flush \((\w+)\)$/, (m) => tr('Half Flush ({suit})', { suit: suitNamed(m[1]) })],
  [/^Honitsu \((\w+)\)$/, (m) => tr('Honitsu ({suit})', { suit: suitNamed(m[1]) })],
  [/^Chinitsu \((\w+)\)$/, (m) => tr('Chinitsu ({suit})', { suit: suitNamed(m[1]) })],
  [/^Yakuhai \((.+)\)$/, (m) => tr('Yakuhai ({tile})', { tile: tileNamed(m[1]) })],
  [/^Pung of (.+?)s?$/, (m) => tr('Pung of {tile}', { tile: tileNamed(m[1]) })],
  [/^(.+) or (\d+) more$/, (m) => tr('{card} or {n} more', { card: planName(m[1]), n: Number(m[2]) })],
  [/^(.+) or (.+) hand$/, (m) => tr('{a} or {b} hand', { a: m[1], b: m[2] })],
  [/^(.+) hand$/, (m) => tr('{section} hand', { section: m[1] })],
];

/**
 * A target hand's name as the planner, the chips and the nameplates show it. Names with a row
 * translate (passports, scoring hands); built names (a flush in a suit, a yakuhai) translate their
 * parts; a card hand's own name ("2468: 222 4444 666 8888") stays as printed on the card.
 */
export function planName(name: string): string {
  if (lang() === 'en') return name;
  if (name === 'Riichi') return tr('riichi');
  const t = tr(name);
  if (t !== name) return t;
  if (/: /.test(name)) return name;
  for (const [re, f] of NAME_RULES) {
    const m = re.exec(name);
    if (m) return f(m);
  }
  return name;
}

/** Plan names in a sentence: "3 Knits in the same 2 suits twice + Honour Pung + Honour Pair". */
export const namesText = (names: string[]) => names.filter((n, i) => names.indexOf(n) === i).map((n) => (names.filter((x) => x === n).length > 1 ? tr('{name} twice', { name: planName(n) }) : planName(n))).join(' + ');

function notePart(p: string): string {
  let m: RegExpExecArray | null;
  if ((m = /^(\d+) doubles$/.exec(p))) return tr('{n} doubles', { n: Number(m[1]) });
  if ((m = /^(\d+) of 3 doubles$/.exec(p))) return tr('{n} of 3 doubles', { n: Number(m[1]) });
  if ((m = /^needs (\d+) with other scoring$/.exec(p))) return tr('needs {n} with other scoring', { n: Number(m[1]) });
  if ((m = /^in (.+)$/.exec(p))) return tr('in {suits}', { suits: andList(m[1].split(' and ').map(suitNamed)) });
  if ((m = /^(\d+) (\S+)$/.exec(p))) return `${m[1]} ${tr(m[2])}`;
  if (p === 'concealed') return tr('concealed');
  if (p === 'closed') return tr('closed');
  if (p === 'declare when ready') return tr('declare when ready');
  if (p === 'the missing suit') return tr('the missing suit');
  return tr(p);
}

/** A target hand's note ("2 han, closed, declare when ready", "in Bamboos and Dots", "2 of 3 doubles"). */
export function planNote(note: string): string {
  if (lang() === 'en') return note;
  return note.split(', ').map(notePart).join(listSep());
}
