// Table callers: each player at the table has their own voice, and calls out
// every tile they discard ("Three Bamboo!") and every claim ("Pung!").
// Eight recorded voices, four female and four male; each match seats two of
// each, shuffled by the match seed so every client hears the same voices.
// Without recordings it falls back to the device voice, pitched per seat.

import { TILE_KIND_COUNT, tileName } from '../engine/tiles';
import { CALLERS, callerClip, type CallerMeta } from './audioPack';
import { playClip, warmClips, type PlayingClip } from './clipPlayer';
import { sound } from './sound';

const KEY = 'jongclub.callers.v1';

/** Every phrase a caller can say: all tile names, then the call words. */
export function callerPhrases(): string[] {
  const tiles = Array.from({ length: TILE_KIND_COUNT }, (_, k) => tileName(k));
  const calls = ['Chow', 'Pung', 'Kong', 'Mahjong', 'Mah Jongg', 'Chi', 'Pon', 'Kan', 'Ron', 'Tsumo', 'Riichi', 'Pong', 'Gang', 'Hu', 'Zimo', 'Ăn', 'Phỗng', 'Chiếu', 'Ù'];
  return [...tiles, ...calls];
}

class Callers {
  enabled = true;
  /** Voice per seat for the current match. */
  private seats: (CallerMeta | null)[] = [];
  private playing: PlayingClip[] = [];
  /** Each seat's clip still playing: a player finishes "Pung!" before naming the tile they throw. */
  private busy = new Map<number, Promise<void>>();
  private gen = 0;

  constructor() {
    try {
      this.enabled = localStorage.getItem(KEY) !== 'off';
    } catch {
      /* default on */
    }
  }

  get library() {
    return CALLERS;
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

  /** Seat two female and two male voices, in an order fixed by the seed. */
  assign(seed: number, players = 4) {
    const rnd = (() => {
      let s = seed >>> 0 || 1;
      return () => ((s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0) / 2 ** 32);
    })();
    const pick = (list: CallerMeta[]) => list.map((v) => [v, rnd()] as const).sort((a, b) => a[1] - b[1]).map(([v]) => v);
    const f = pick(CALLERS.filter((v) => v.gender === 'female'));
    const m = pick(CALLERS.filter((v) => v.gender === 'male'));
    const first = rnd() < 0.5;
    this.seats = Array.from({ length: players }, (_, i) => ((i % 2 === 0) === first ? f[i >> 1] : m[i >> 1]) ?? null);
    this.warm();
  }

  /** Decode the seated voices' tile names ahead of time, so every call plays on cue. */
  private warm(tries = 0) {
    const urls = this.seats.flatMap((v) => (v ? callerPhrases().map((p) => callerClip(v.id, p)) : [])).filter((u): u is string => !!u);
    if (urls.length) warmClips(urls);
    // The pack may still be loading: try again shortly.
    if (urls.length < this.seats.length * 10 && tries < 8) window.setTimeout(() => this.warm(tries + 1), 1500);
  }

  voiceFor(seat: number) {
    return this.seats[seat] ?? null;
  }

  /** Say a tile's name in this seat's voice. */
  tile(seat: number, kind: number) {
    this.say(seat, tileName(kind));
  }

  /** Say a phrase (a tile name or call word) in this seat's voice. */
  say(seat: number, phrase: string) {
    if (!this.enabled) return;
    // Outside a match (the settings preview) nobody is seated yet: use the first recorded voice.
    const voice = this.seats.length ? this.seats[seat] : CALLERS[seat % CALLERS.length];
    const clip = voice ? callerClip(voice.id, phrase) : undefined;
    if (clip) {
      const gen = this.gen;
      const before = this.busy.get(seat);
      const start = () => {
        if (gen !== this.gen || !this.enabled) return Promise.resolve();
        return this.play(clip);
      };
      // Wait for this seat's last word, but never more than a moment.
      const next = before ? Promise.race([before, new Promise<void>((r) => window.setTimeout(r, 1200))]).then(start) : start();
      this.busy.set(seat, next);
      void next.then(() => this.busy.get(seat) === next && this.busy.delete(seat));
      return;
    }
    if (typeof speechSynthesis === 'undefined') return;
    const u = new SpeechSynthesisUtterance(phrase.replace(/^(\d) /, '$1 '));
    u.volume = 1;
    u.rate = 1.05;
    u.pitch = [1.25, 0.8, 1.1, 0.9][seat % 4];
    speechSynthesis.speak(u);
  }

  private play(clip: string): Promise<void> {
    const a = playClip(clip);
    this.playing.push(a);
    sound.duck(true, 'callers');
    void a.done.then(() => {
      this.playing = this.playing.filter((p) => p !== a);
      if (!this.playing.length) sound.duck(false, 'callers');
    });
    return a.done;
  }

  stop() {
    this.gen++;
    this.busy.clear();
    for (const a of this.playing) a.stop();
    this.playing = [];
    sound.duck(false, 'callers');
  }
}

export const callers = new Callers();
