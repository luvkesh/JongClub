// Drawn icons for the Club, Collection, Atelier and Profile screens: one
// stroke weight in currentColor, like ./icons.ts, plus a few filled emblems
// (league medals, achievement diamonds) that carry their own colours.

const P: Record<string, string> = {
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v3.5M8.5 20h7M9.5 20l.8-3.5h3.4l.8 3.5"/>',
  sprout: '<path d="M12 20v-7"/><path d="M12 13c0-4 2.6-6.5 7-6.5 0 4.2-2.8 6.5-7 6.5z"/><path d="M12 15.5c0-3-2.2-5-5.8-5 0 3.3 2.3 5 5.8 5z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2"/>',
  people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5a6 6 0 0 1 12 0"/><circle cx="17" cy="9.5" r="2.5"/><path d="M16 14.2a4.8 4.8 0 0 1 5.5 4.8"/>',
  club: '<circle cx="12" cy="7.5" r="3"/><circle cx="5.5" cy="10" r="2.2"/><circle cx="18.5" cy="10" r="2.2"/><path d="M6.5 20a5.5 5.5 0 0 1 11 0M1.8 18a3.8 3.8 0 0 1 5.2-3.5M22.2 18a3.8 3.8 0 0 0-5.2-3.5"/>',
  season: '<path d="M4 20h16M6 20v-6l6-4 6 4v6M12 10V4M12 4l4 2-4 2"/><path d="M10 20v-3.5h4V20"/>',
  arrow: '<path d="M5 12h13M13 7l5 5-5 5"/>',
  chevron: '<path d="M9.5 6 15.5 12l-6 6"/>',
  chevronDown: '<path d="M6.5 9.5 12 15l5.5-5.5"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.4 3.6 5.2 3.6 8.5s-1.1 6.1-3.6 8.5c-2.5-2.4-3.6-5.2-3.6-8.5S9.5 5.9 12 3.5z"/>',
  voice: '<path d="M4 10v4M8 7v10M12 4.5v15M16 7v10M20 10v4"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="2.6"/>',
  pin: '<path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  locate: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  city: '<path d="M3.5 20.5h17M5 20.5V9.5h5v11M10 20.5V4h7v16.5M17 20.5V12h2.5v8.5"/><path d="M12.5 7.5h2M12.5 10.5h2M12.5 13.5h2M7 12.5h1M7 15.5h1"/>',
  pencil: '<path d="M4 20l1-4.2L15.6 5.2a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.2 19z"/><path d="M13.5 7.3l3.2 3.2"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.3-5.4"/><path d="M4.5 4v4.5H9"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.2"/><path d="M12 8.6 15.4 12 12 15.4 8.6 12z"/>',
  gamepad: '<path d="M7 8h10a4 4 0 0 1 4 4.4l-.5 3.6a2.6 2.6 0 0 1-4.6 1.3L14.4 15H9.6l-1.5 2.3A2.6 2.6 0 0 1 3.5 16L3 12.4A4 4 0 0 1 7 8z"/><path d="M7.5 11v3M6 12.5h3M15.5 11.5h.01M17.5 13.5h.01"/>',
  percent: '<path d="M18.5 5.5l-13 13"/><circle cx="7" cy="7" r="2.3"/><circle cx="17" cy="17" r="2.3"/>',
  hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V5a1.5 1.5 0 0 1 3 0v6M14 11V6.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 6.5-6 6.5-2.6 0-4-1.2-5.4-3.3L3.8 14a1.5 1.5 0 0 1 2.4-1.8L8 14.5"/>',
  flame: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.6 2.6-5.6 3.9-8.8.9 1.8 1.9 2.7 3 3.1C12.6 6.3 13.5 4.2 15.6 3c-.4 3.3 3 6 3 11.6 0 3.7-2.7 6.4-6.6 6.4z"/><path d="M12 21c-1.7 0-2.9-1.2-2.9-2.9 0-1.9 1.6-2.9 2.3-4.6.9 1.3 3.5 2.4 3.5 4.6 0 1.7-1.2 2.9-2.9 2.9z"/>',
  leaf: '<path d="M5 19c0-8 5-13.5 15-14-.4 9.5-6 14.5-13 14.5"/><path d="M5 19c3-4 6.5-7 10-9"/>',
  crown: '<path d="M4 17.5 3 7.5l5 4 4-6.5 4 6.5 5-4-1 10z"/><path d="M4 20.5h16"/>',
  star: '<path d="M12 3.5l2.6 5.5 6 .8-4.4 4.1 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8z"/>',
  bars: '<path d="M5 20V12M10 20V6M15 20v-9M20 20V9"/>',
  target: '<circle cx="11" cy="13" r="7.5"/><circle cx="11" cy="13" r="4"/><circle cx="11" cy="13" r=".8"/><path d="M11 13l8.5-8.5M16.5 4.5l3 3M19.5 4.5v3h-3"/>',
  history: '<path d="M4.5 12a7.5 7.5 0 1 0 2.3-5.4"/><path d="M4.5 4v4.5H9M12 8v4.5l3 2"/>',
  diamond: '<path d="M12 3.5 20.5 12 12 20.5 3.5 12z"/><path d="M12 8.2 15.8 12 12 15.8 8.2 12z"/>',
  medal: '<circle cx="12" cy="15" r="5.5"/><path d="M8.5 10.7 6 3.5h4l2 4.5 2-4.5h4l-2.5 7.2"/>',
  fan: '<path d="M12 20 3.5 10.5a12 12 0 0 1 17 0z"/><path d="M12 20 7.5 7M12 20 12 6M12 20l4.5-13"/><circle cx="12" cy="20" r=".8"/>',
  face: '<circle cx="12" cy="9" r="5"/><path d="M5 21a7 7 0 0 1 14 0M10 8.5h.01M14 8.5h.01M10.3 11a2.4 2.4 0 0 0 3.4 0"/>',
  hair: '<path d="M5.5 14C4.2 7.8 7.4 3.5 12 3.5s7.8 4.3 6.5 10.5"/><path d="M5.5 14c1.5.8 2.3-.5 2.5-3 2.6.2 6.2-.8 8-3.5.4 2.6.6 5.5 2.5 6.5"/><path d="M8 13.5a4 4 0 0 0 8 0M9 20.5a6 6 0 0 1 6 0"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 1.8-.8 1.8-1.6 0-1.4-1.3-1.7-1.3-3 0-1 .8-1.6 1.8-1.6h2.3a3.9 3.9 0 0 0 3.9-3.9c0-3.9-3.8-6.9-8.5-6.9z"/><circle cx="7.6" cy="11" r="1"/><circle cx="10" cy="7.3" r="1"/><circle cx="14.4" cy="7.3" r="1"/>',
  shirt: '<path d="M8.5 3.5 4 5.5 2.5 10l3 1.3V20.5h13v-9.2l3-1.3L20 5.5l-4.5-2a3.5 3.5 0 0 1-7 0z"/>',
  glasses: '<circle cx="6.5" cy="13.5" r="3.5"/><circle cx="17.5" cy="13.5" r="3.5"/><path d="M10 13.5a2 2 0 0 1 4 0M3 13l1.2-5.5M21 13l-1.2-5.5"/>',
  frame: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.5"/><path d="M12 1.8v2M12 20.2v2M1.8 12h2M20.2 12h2M4.8 4.8l1.4 1.4M17.8 17.8l1.4 1.4M4.8 19.2l1.4-1.4M17.8 6.2l1.4-1.4"/>',
  tiles: '<rect x="3" y="6" width="5.5" height="8" rx="1"/><rect x="9.25" y="6" width="5.5" height="8" rx="1"/><rect x="15.5" y="6" width="5.5" height="8" rx="1"/><path d="M2.5 17.5h19M4 17.5l1 2.5h14l1-2.5"/>',
  rack: '<path d="M2.5 15.5h19l-1.5 4h-16z"/><rect x="4" y="8" width="4" height="7.5" rx=".8"/><rect x="10" y="8" width="4" height="7.5" rx=".8"/><rect x="16" y="8" width="4" height="7.5" rx=".8"/>',
  table: '<ellipse cx="12" cy="9.5" rx="9" ry="4"/><path d="M3 9.5v1.5c0 2.2 4 4 9 4s9-1.8 9-4V9.5M7 14.3l-1 6.2M17 14.3l1 6.2M12 15v5.5"/>',
  room: '<path d="M3 20.5h18M5 20.5V10M19 20.5V10M2.5 10 12 3.5 21.5 10"/><path d="M9.5 20.5v-6h5v6M8 10.5h8"/>',
  avatar: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  sparkle: '<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/><path d="M19 15.5c.3 2 1 2.7 3 3-2 .3-2.7 1-3 3-.3-2-1-2.7-3-3 2-.3 2.7-1 3-3z"/>',
  wand: '<path d="M4 20 15.5 8.5M14 7l3 3"/><path d="M18 3v3M16.5 4.5h3M20 9.5v2M19 10.5h2M10 3.5v2M9 4.5h2"/>',
  note: '<path d="M9 18V5.5l11-2.5v12.5"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/>',
  bag: '<path d="M5 8h14l-1 12.5H6z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
  brush: '<path d="M20 4c-3 1.2-7.5 5.5-9.5 8.5l1.9 1.9C15.5 12.4 18.8 7 20 4z"/><path d="M10.5 12.5c-2.4 0-3.9 1.6-3.9 3.6 0 1.7-1.1 2.8-2.6 3.3 3.5 1.4 8.3.6 8.4-5z"/>',
  filter: '<path d="M3.5 5.5h17l-6.5 7.5v6l-4 1.5V13z"/>',
  lotus: '<path d="M12 18.5c-2.2-2-3.2-4.3-3.2-6.8S9.8 7 12 5c2.2 2 3.2 4.2 3.2 6.7s-1 4.8-3.2 6.8z"/><path d="M12 18.5c-3.3 0-6.4-1.8-8.5-5.3 2.4-.6 4.3-.3 5.5.4M12 18.5c3.3 0 6.4-1.8 8.5-5.3-2.4-.6-4.3-.3-5.5.4"/>',
};

/** An inline line icon by name, sized by CSS (.gl). */
export function glyph(name: string, cls = ''): string {
  return `<svg class="gl ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] ?? ''}</svg>`;
}

/** A league's medal, drawn in its own metal. */
export function leagueEmblem(name: 'Master' | 'Diamond' | 'Platinum' | 'Gold' | 'Silver' | 'Bronze' | 'Beginner', size = 34): string {
  const s = `width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true" focusable="false" class="lg-emb"`;
  const g = (id: string, a: string, b: string, c: string) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>`;
  const medal = (id: string, a: string, b: string, c: string, n: string) =>
    `<svg ${s}>${g(id, a, b, c)}<path d="M13 3h5l2 7-4 2zM27 3h-5l-2 7 4 2z" fill="#7a1f1b" opacity=".9"/><circle cx="20" cy="24" r="12" fill="url(#${id})" stroke="rgba(0,0,0,.35)"/><circle cx="20" cy="24" r="8.6" fill="none" stroke="rgba(255,255,255,.35)"/><text x="20" y="28.6" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="12" font-weight="700" fill="rgba(40,24,8,.75)">${n}</text></svg>`;
  switch (name) {
    case 'Master':
      return `<svg ${s}>${g('lgm', '#fff0b8', '#e2b75a', '#9b6a24')}<path d="M7 29 5 13l8 6 7-11 7 11 8-6-2 16z" fill="url(#lgm)" stroke="rgba(60,36,8,.55)" stroke-linejoin="round"/><rect x="7" y="30.5" width="26" height="4" rx="1.4" fill="url(#lgm)"/><circle cx="20" cy="22" r="2.3" fill="#c0392b"/><circle cx="12.5" cy="24" r="1.6" fill="#2e8b6a"/><circle cx="27.5" cy="24" r="1.6" fill="#2e8b6a"/></svg>`;
    case 'Diamond':
      return `<svg ${s}>${g('lgd', '#e9fbff', '#8fd7f2', '#3a8fbf')}<path d="M8 15 13 7h14l5 8-12 18z" fill="url(#lgd)" stroke="rgba(10,40,70,.5)" stroke-linejoin="round"/><path d="M8 15h24M13 7l3 8 4-8 4 8 3-8M16 15l4 18 4-18" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".9"/></svg>`;
    case 'Platinum':
      return `<svg ${s}>${g('lgp', '#f4fbff', '#b6d4e6', '#6e8fa8')}<path d="M20 5 33 14 28 32H12L7 14z" fill="url(#lgp)" stroke="rgba(30,50,70,.5)" stroke-linejoin="round"/><path d="M20 5v10M7 14l13 1 13-1M12 32l8-17 8 17" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".9"/></svg>`;
    case 'Gold':
      return medal('lgg', '#fff1b5', '#e3b456', '#9a6a22', '1');
    case 'Silver':
      return medal('lgs', '#ffffff', '#cfd5da', '#7f8a93', '2');
    case 'Bronze':
      return medal('lgb', '#ffd9b0', '#c98a52', '#7c4a22', '3');
    default:
      return `<svg ${s}><path d="M20 34V20" stroke="#7fbf6a" stroke-width="2.2" stroke-linecap="round"/><path d="M20 21c0-7 4.5-11.5 12-11.5 0 7.3-4.8 11.5-12 11.5z" fill="#6fb85c" stroke="#3f7a35"/><path d="M20 25c0-5.4-3.8-9-10-9 0 5.8 4 9 10 9z" fill="#8fd27a" stroke="#3f7a35"/></svg>`;
  }
}

export type LeagueName = Parameters<typeof leagueEmblem>[0];
/** League tiers from the top, with their entry ratings (as progression/profile.ts leagueOf). */
export const LEAGUE_TIERS: [LeagueName, number][] = [
  ['Master', 2100],
  ['Diamond', 1900],
  ['Platinum', 1700],
  ['Gold', 1500],
  ['Silver', 1300],
  ['Bronze', 1100],
  ['Beginner', 0],
];
export const tierOf = (rating: number): LeagueName => (LEAGUE_TIERS.find(([, min]) => rating >= min) ?? LEAGUE_TIERS[6])[0];

/** A faint landscape (hills and a pavilion) for the corner of a card. */
export const SCENERY =
  `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 110"><g fill="none" stroke="#c9a56b" stroke-width="1" opacity=".55"><path d="M0 96c26-10 40-28 62-30 18-2 26 14 44 12 22-2 30-30 58-32 26-2 46 22 76 26"/><path d="M0 110c30-14 54-18 80-14 30 4 52-8 84-10 30-2 52 8 76 12" opacity=".6"/><path d="M168 64v-16M156 48h24l-4-6h-16zM160 42l8-8 8 8M162 64v-8h12v8M150 64h36"/></g></svg>')}")`;
