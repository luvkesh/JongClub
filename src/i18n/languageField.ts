// Settings: the language, saved on this device. Choosing one reloads the club
// so every screen picks it up; at a table the change waits until you leave.

import { flashNote, h } from '../ui/dom';
import { LANGUAGES, LANG_KEY, lang, setLang, tr, type Lang } from './index';

export function languageField(busy: () => boolean = () => false): HTMLElement {
  const id = 'f-language';
  const s = h('select', { id, class: 'region-select' }, ...LANGUAGES.map((l) => h('option', { value: l.id, selected: l.id === lang(), lang: l.id }, l.name))) as HTMLSelectElement;
  s.onchange = () => {
    const next = s.value as Lang;
    if (!busy()) return setLang(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      /* this session only */
    }
    flashNote(tr('The new language is used when you leave the table.'));
  };
  return h('label', { class: 'field lang-field', for: id }, h('span', {}, tr('Language'), lang() === 'en' ? '' : h('span', { lang: 'en', class: 'lang-en' }, ' · Language')), s);
}
