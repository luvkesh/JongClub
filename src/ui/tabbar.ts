// Phones get five tabs at the foot of the screen instead of the nine-tab strip:
// Play (with Variations and Daily), Learn, Club (with World Tour), Collection
// and You (Profile and Settings). Screens inside a tab are a segmented control
// above the page. Desktop keeps the top navigation; tabbar.css decides which shows.
// The bar lives in the shell, so it is hidden with it during a match or replay.

import type { Screen } from './ctx';
import { h } from './dom';
import './tabbar.css';
import { tr } from '../i18n';

interface Sub {
  label: string;
  screen?: Screen;
  /** A sub-tab that opens something rather than a screen (Settings). */
  action?: 'settings';
}

interface Tab {
  id: string;
  label: string;
  icon: string;
  /** Screens that light this tab; the first is where it opens. */
  screens: Screen[];
  subs?: Sub[];
}

const svg = (d: string) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const PHONE_TABS: Tab[] = [
  {
    id: 'play',
    label: tr('Play'),
    icon: svg('<rect x="6" y="3" width="12" height="18" rx="2.5"/><circle cx="12" cy="12" r="3.2"/>'),
    screens: ['play', 'versions', 'daily', 'tournaments', 'minigames'],
    subs: [{ label: tr('Play'), screen: 'play' }, { label: tr('Mini-games'), screen: 'minigames' }, { label: tr('Variations'), screen: 'versions' }, { label: tr('Daily'), screen: 'daily' }],
  },
  { id: 'learn', label: tr('Learn'), icon: svg('<path d="M3 5.5c3-1.2 6-1 9 1 3-2 6-2.2 9-1V19c-3-1-6-.8-9 1.2C9 18.2 6 18 3 19z"/><path d="M12 6.5v13.7"/>'), screens: ['learn'] },
  {
    id: 'club',
    label: tr('Club'),
    icon: svg('<path d="M3 9.5 12 4l9 5.5"/><path d="M5.5 10v8.5M10 10v8.5M14 10v8.5M18.5 10v8.5M3 20.5h18"/>'),
    screens: ['club', 'passport', 'seasons'],
    subs: [{ label: tr('Club'), screen: 'club' }, { label: tr('World Tour'), screen: 'passport' }],
  },
  { id: 'collection', label: tr('Collection'), icon: svg('<path d="M12 3.5 19.5 12 12 20.5 4.5 12z"/><path d="M12 8.2 15.3 12 12 15.8 8.7 12z"/>'), screens: ['collection', 'atelier'] },
  {
    id: 'you',
    label: tr('You'),
    icon: svg('<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c1.4-3.8 4.2-5.7 7.5-5.7s6.1 1.9 7.5 5.7"/>'),
    screens: ['profile', 'store'],
    subs: [{ label: tr('Profile'), screen: 'profile' }, { label: tr('Jong Points'), screen: 'store' }, { label: tr('Settings'), action: 'settings' }],
  },
];

/** The phone tab a screen belongs to (none for Home, reached from the wordmark). */
export const tabOf = (s: Screen) => PHONE_TABS.find((t) => t.screens.includes(s)) ?? null;

/** The sub-tab lit for a screen: its own, or the tab's first (Tournaments sits under Play). */
export const subOf = (s: Screen) => {
  const t = tabOf(s);
  return t?.subs ? t.subs.find((x) => x.screen === s) ?? t.subs[0] : null;
};

export interface PhoneNav {
  bar: HTMLElement;
  sub: HTMLElement;
  update(screen: Screen): void;
}

export function phoneNav(go: (s: Screen) => void, openSettings: () => void, click: () => void): PhoneNav {
  const bar = h('nav', { class: 'tabbar', 'aria-label': tr('Main') });
  const sub = h('div', { class: 'subtabs' });
  for (const t of PHONE_TABS) {
    bar.append(h('button', { type: 'button', class: 'tab', 'data-tab': t.id, onclick: () => (click(), go(t.screens[0])) }, h('span', { class: 'tab-icon', html: t.icon }), h('span', { class: 'tab-label' }, t.label)));
  }
  let shown: string | null = null;
  const update = (screen: Screen) => {
    const tab = tabOf(screen);
    for (const b of bar.querySelectorAll<HTMLElement>('.tab')) {
      const on = b.dataset.tab === tab?.id;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    if (shown !== tab?.id) {
      shown = tab?.id ?? null;
      sub.replaceChildren(
        ...(tab?.subs
          ? [
              h(
                'div',
                { class: 'subtabs-seg', role: 'group', 'aria-label': tab.label },
                ...tab.subs.map((s) => h('button', { type: 'button', 'data-screen': s.screen ?? '', onclick: () => (click(), s.screen ? go(s.screen) : openSettings()) }, s.label)),
              ),
            ]
          : []),
      );
    }
    const lit = subOf(screen);
    for (const b of sub.querySelectorAll<HTMLElement>('button')) {
      const on = !!lit?.screen && b.dataset.screen === lit.screen;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
  };
  return { bar, sub, update };
}
