import { sound } from '../audio/sound';
import { tr } from '../i18n';
import { h } from './dom';
import { icon } from './icons';

/** The settings the music switch reads and writes (StoredSettings in screens/settings.ts). */
export interface MusicSettings {
  volumes: { effects: number; music: number; ambient: number };
  /** Background music and the room's ambient sound switched off with the music button; the sliders keep their levels for when they come back. */
  musicOff?: boolean;
}

const EVENT = 'jongclub:music';

/** Send the volumes to the mixer, with the music and the room's ambient sound silenced while they are switched off. */
export function applyVolumes(s: MusicSettings) {
  sound.setVolumes({ ...s.volumes, music: s.musicOff ? 0 : s.volumes.music, ambient: s.musicOff ? 0 : s.volumes.ambient });
}

/** Switch the background music and the room's ambient sound on or off (tile sounds, callers and Mei stay as set), remembered across visits. */
export function setMusicOff(s: MusicSettings, off: boolean, save: () => void) {
  if (!!s.musicOff === off) return;
  s.musicOff = off;
  applyVolumes(s);
  save();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

/** A round music button; every copy (table menu, top bar) stays in step with the others and with Settings. */
export function musicButton(s: MusicSettings, save: () => void, cls = 'icon-btn music-btn'): HTMLButtonElement {
  const b = h('button', { type: 'button', class: cls, onclick: () => setMusicOff(s, !s.musicOff, save) }) as HTMLButtonElement;
  const paint = () => {
    const off = !!s.musicOff;
    b.innerHTML = icon(off ? 'musicOff' : 'music');
    b.classList.toggle('off', off);
    b.setAttribute('aria-pressed', String(!off));
    const label = off ? tr('Music and room sound are off. Turn them on') : tr('Music and room sound are on. Turn them off');
    b.setAttribute('aria-label', label);
    b.title = label;
  };
  paint();
  const onChange = () => (b.isConnected ? paint() : window.removeEventListener(EVENT, onChange));
  window.addEventListener(EVENT, onChange);
  return b;
}
