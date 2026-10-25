// Settings row offering to install JongClub as an app: the browser's own
// install dialog where it offers one, or the Add to Home Screen steps on iPhone
// and iPad. Shows nothing where installing is not possible (the Artifact
// preview, file://) or the app is already installed.

import { h } from '../ui/dom';
import { installState, onInstallChange, promptInstall } from './register';
import '../ui/accessibility.css';
import { tr } from '../i18n';

export function installField(): HTMLElement {
  const row = h('div', { class: 'field install-field' });
  let off = () => {};
  const render = () => {
    // Settings was closed and rebuilt: stop listening for this row.
    if (row.parentElement === null && row.dataset.drawn) return off();
    row.dataset.drawn = '1';
    const state = installState();
    row.hidden = state === 'none' || state === 'installed';
    row.replaceChildren();
    if (row.hidden) return;
    row.append(h('span', {}, tr('Install app')));
    if (state === 'prompt') {
      row.append(
        h(
          'div',
          { class: 'install-row' },
          h('button', { type: 'button', class: 'btn sm', onclick: () => void promptInstall() }, tr('Install JongClub')),
          h('small', {}, tr('Opens full screen from your home screen or dock, and plays against AI offline.')),
        ),
      );
    } else {
      row.append(h('div', { class: 'install-row' }, h('small', {}, tr('In Safari, tap Share, then Add to Home Screen. JongClub then opens full screen and plays against AI offline.'))));
    }
  };
  off = onInstallChange(render);
  render();
  return row;
}
