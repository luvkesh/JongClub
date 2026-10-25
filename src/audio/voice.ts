// Tutorial narration through the device's own speech voices.
// The narrator is Mei, the club's host. Speech should sound like a person, so
// we rank the device's voices by how natural they are: neural voices (Edge's
// "Natural" voices, Chrome's online Google voices, Apple's Siri, Premium and
// Enhanced voices) come first. A multilingual Chinese neural voice is the best
// of all: it speaks English fluently with a light Chinese accent. Plain Chinese
// voices are not used for English, because they read it robotically.
// Lines are spoken a sentence at a time with small breaths in between, which
// keeps the rhythm natural and avoids Chrome cutting long speech short.
// Captions are always on screen, so nothing depends on audio.

import { tileName } from '../engine/tiles';
import { clipKey } from './clipKey';
import { callerClipAsync, hasNarration, narrationClip } from './audioPack';
import { playClip, type PlayingClip } from './clipPlayer';
import { sound } from './sound';

/**
 * A piece of a composed line: a tile name or call word (from Mei's caller
 * clips) or a fixed narration line (from her recorded lines).
 */
export type SpeechPart = { tile: number } | { call: string } | { line: string };

/** The text a part stands for. */
export const partText = (p: SpeechPart) => ('tile' in p ? tileName(p.tile) : 'call' in p ? p.call : p.line);

const KEY = 'jongclub.voice.v1';
const VOICE_KEY = 'jongclub.voice.name.v1';
const ALL_KEY = 'jongclub.voice.all.v1';
/** The recorded voice; chosen unless the player picks a device voice. */
export const RECORDED = 'recorded';

const NATURAL = /natural|neural|online|premium|enhanced|siri|wavenet|journey|studio/i;
const WARM_EN = /\b(ava|emma|jenny|aria|sonia|libby|natasha|clara|michelle|sara|samantha|serena|kate|karen|moira|tessa|fiona|martha|google uk english female|google us english)\b/i;
const ROBOTIC = /espeak|desktop|compact|default|festival|pico/i;

function score(v: SpeechSynthesisVoice) {
  const lang = v.lang.replace('_', '-').toLowerCase();
  const name = v.name;
  const zh = /^(zh|yue|cmn)/.test(lang);
  const en = lang.startsWith('en');
  const multi = /multilingual/i.test(name);
  if (!en && !(zh && multi)) return -1;
  let s = 0;
  if (NATURAL.test(name)) s += 50;
  if (!v.localService) s += 15; // network voices are the neural ones
  if (zh && multi) s += 40; // fluent English with a Chinese accent: Mei herself
  if (WARM_EN.test(name)) s += 15;
  if (/female|woman/i.test(name)) s += 5;
  if (/en-gb|en-au|en-ie|en-nz|en-sg|en-hk/.test(lang)) s += 4;
  if (ROBOTIC.test(name)) s -= 30;
  return s;
}

const sentences = (text: string) =>
  text
    .replace(/\s+/g, ' ')
    .match(/[^.!?…]+[.!?…]+["”’)]*|[^.!?…]+$/g)
    ?.map((x) => x.trim())
    .filter(Boolean) ?? [text];

/** Words a speech engine tends to mangle, spelled the way they should sound. */
const say = (s: string) =>
  s
    .replace(/Mah ?Jongg?/gi, 'Mahjong')
    .replace(/JongBot/g, 'Jong Bot')
    .replace(/JongClub/g, 'Jong Club')
    .replace(/\bfaan\b/gi, 'fahn')
    .replace(/\btai\b/gi, 'tie')
    .replace(/\bhan\b/g, 'hahn')
    .replace(/\byaku\b/gi, 'yah-koo')
    .replace(/\bron\b/gi, 'rohn')
    .replace(/\bTsumo\b/g, 'Tsoo-mo')
    .replace(/\bxiao\b/gi, 'shyow')
    .replace(/\briichi\b/gi, 'ree-chee');

class Narrator {
  private voice: SpeechSynthesisVoice | null = null;
  private ready = false;
  private run = 0;
  private audio: PlayingClip | null = null;
  /** Settles the clip promise of a line that was stopped part way. */
  private release: (() => void) | null = null;
  /** Use Mei's recorded clips when a line has one. */
  recorded = hasNarration;
  enabled = true;
  /** Speak everything the game says (hints, prompts, results), not just lessons. */
  speakAll = false;
  /** True when the chosen voice speaks English with a Chinese accent. */
  accented = false;

  constructor() {
    try {
      this.enabled = localStorage.getItem(KEY) !== 'off';
    } catch {
      /* default on */
    }
    try {
      this.speakAll = localStorage.getItem(ALL_KEY) === 'on';
    } catch {
      /* default off */
    }
    try {
      if (localStorage.getItem(VOICE_KEY) && localStorage.getItem(VOICE_KEY) !== RECORDED) this.recorded = false;
    } catch {
      /* ignore */
    }
    if (typeof speechSynthesis === 'undefined') {
      if (!this.hasClips) this.enabled = false;
      return;
    }
    this.pick();
    speechSynthesis.addEventListener?.('voiceschanged', () => this.pick());
  }

  get available() {
    return this.hasClips || typeof speechSynthesis !== 'undefined';
  }

  get hasClips() {
    return hasNarration;
  }

  private get speech() {
    return typeof speechSynthesis !== 'undefined';
  }

  /** Voices worth offering, most natural first. */
  voices(): SpeechSynthesisVoice[] {
    if (!this.speech) return [];
    return speechSynthesis
      .getVoices()
      .map((v) => [v, score(v)] as const)
      .filter(([, s]) => s >= 0)
      .sort((a, b) => b[1] - a[1])
      .map(([v]) => v);
  }

  get voiceName() {
    return this.recorded ? RECORDED : this.voice?.name ?? '';
  }

  private pick() {
    const ranked = this.voices();
    if (!ranked.length) return;
    let chosen: string | null = null;
    try {
      chosen = localStorage.getItem(VOICE_KEY);
    } catch {
      /* ignore */
    }
    this.voice = ranked.find((v) => v.name === chosen) ?? ranked[0];
    this.accented = /^(zh|yue|cmn)/i.test(this.voice.lang);
    this.ready = true;
  }

  /** Choose a voice by name (from `voices()`). */
  setVoice(name: string) {
    this.recorded = name === RECORDED && this.hasClips;
    try {
      localStorage.setItem(VOICE_KEY, name);
    } catch {
      /* ignore */
    }
    this.pick();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stop();
    try {
      localStorage.setItem(KEY, on ? 'on' : 'off');
    } catch {
      /* ignore */
    }
  }

  setSpeakAll(on: boolean) {
    this.speakAll = on;
    if (!on) this.stop();
    try {
      localStorage.setItem(ALL_KEY, on ? 'on' : 'off');
    } catch {
      /* ignore */
    }
  }

  /** Speak game content (hints, prompts) only when "Speak all content" is on. */
  auto(text: string) {
    if (this.speakAll) void this.say(text);
  }

  /** Speak a composed line only when "Speak all content" is on. */
  autoParts(parts: SpeechPart[], text: string) {
    if (this.speakAll) void this.sayParts(parts, text);
  }

  /** Play one recorded clip to its end (or until stopped). */
  private playClip(url: string): Promise<void> {
    return new Promise<void>((resolve) => {
      const a = playClip(url);
      this.audio = a;
      this.release = resolve;
      void a.done.then(() => resolve());
    });
  }

  /**
   * Speak a line composed from Mei's recorded pieces: tile names and call
   * words from her caller clips, fixed lines from her narration. A piece with
   * no recording is skipped (the caption still shows it), so the player never
   * hears another voice standing in for Mei. With a device voice chosen in
   * Settings, `text` is read whole instead.
   */
  async sayParts(parts: SpeechPart[], text: string): Promise<void> {
    if (!this.recorded) return this.say(text);
    this.stop();
    if (!this.enabled || !this.available) return;
    const run = ++this.run;
    const urls = await Promise.all(parts.map((p) => ('line' in p ? narrationClip(clipKey(p.line)) : callerClipAsync('mei', partText(p)))));
    if (run !== this.run) return;
    const play = urls.filter((u): u is string => !!u);
    if (!play.length) return;
    sound.duck(true);
    for (let i = 0; i < play.length; i++) {
      if (run !== this.run) return;
      await this.playClip(play[i]);
      // A small breath between a tile name and the sentence after it.
      if (i < play.length - 1 && run === this.run) await new Promise((r) => window.setTimeout(r, 140));
    }
    if (run === this.run) {
      this.audio = null;
      sound.duck(false);
    }
  }

  private utter(text: string, last: boolean, run: number): Promise<void> {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(say(text));
      if (this.voice) {
        u.voice = this.voice;
        u.lang = this.voice.lang;
      }
      const natural = this.voice ? NATURAL.test(this.voice.name) || !this.voice.localService : false;
      // Neural voices already have good pacing; older voices sound better a touch slower.
      u.rate = natural ? 0.98 : 0.9;
      // Questions and exclamations lift a little.
      u.pitch = /[!?]$/.test(text) ? 1.06 : 1;
      let done = false;
      const end = () => {
        if (done) return;
        done = true;
        if (run !== this.run) return resolve();
        // A breath between sentences: longer after a full stop than a comma-ish pause.
        window.setTimeout(resolve, last ? 0 : /[.…]$/.test(text) ? 480 : 420);
      };
      u.onend = end;
      u.onerror = end;
      speechSynthesis.speak(u);
    });
  }

  /** Speak a line; resolves when it ends (or at once if narration is off). */
  async say(text: string): Promise<void> {
    this.stop();
    if (!this.enabled || !this.available) return;
    const run = ++this.run;
    const clip = this.recorded ? await narrationClip(clipKey(text)) : undefined;
    if (run !== this.run) return;
    if (clip) {
      sound.duck(true);
      await this.playClip(clip);
      if (run === this.run) {
        this.audio = null;
        sound.duck(false);
      }
      return;
    }
    // Mei's voice is her recordings: a line she has not recorded stays a caption,
    // never a different-sounding device voice (unless one was picked in Settings).
    if (this.recorded) return;
    if (!this.speech) return;
    if (!this.ready) this.pick();
    sound.duck(true);
    const parts = sentences(text);
    for (let i = 0; i < parts.length; i++) {
      if (run !== this.run) return;
      await this.utter(parts[i], i === parts.length - 1, run);
    }
    if (run === this.run) sound.duck(false);
  }

  stop() {
    this.run++;
    if (this.audio) {
      this.audio.stop();
      this.audio = null;
    }
    const r = this.release;
    this.release = null;
    r?.();
    if (this.speech) speechSynthesis.cancel();
    sound.duck(false);
  }
}

export const narrator = new Narrator();
