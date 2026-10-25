// The results card's ornaments: the laurel and crown for first place, the
// small icons on each reward and line, and the moonlit pavilion behind the
// heading. Pure SVG strings, coloured by currentColor or the gold gradient.

import './resultsLook.css';

const GOLD = '<defs><linearGradient id="rl-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e2ad"/><stop offset="0.55" stop-color="#d6b071"/><stop offset="1" stop-color="#9c7438"/></linearGradient></defs>';

/** A laurel wreath, open at the top, with a small crown above: first place. */
export const LAUREL = (() => {
  const leaves: string[] = [];
  const cx = 24,
    cy = 25,
    r = 15;
  // Leaves along each branch from the stem up, a pair at each step, smaller towards the tip.
  for (let i = 0; i < 7; i++) {
    const t = ((108 + i * 17) * Math.PI) / 180;
    const x = cx + r * Math.cos(t),
      y = cy + r * Math.sin(t);
    const along = (Math.atan2(Math.cos(t), -Math.sin(t)) * 180) / Math.PI;
    const s = 1.1 - i * 0.07;
    for (const side of [-1, 1]) {
      for (const off of [-1, 1]) {
        const lx = side < 0 ? x : 48 - x;
        const ang = side < 0 ? along + off * 42 : 180 - along - off * 42;
        leaves.push(`<ellipse cx="${lx.toFixed(2)}" cy="${y.toFixed(2)}" rx="${(3.4 * s).toFixed(2)}" ry="${(1.35 * s).toFixed(2)}" transform="rotate(${ang.toFixed(1)} ${lx.toFixed(2)} ${y.toFixed(2)}) translate(${(3 * s).toFixed(2)} 0)"/>`);
      }
    }
  }
  const crown = '<path d="M17.5 11.5 L18.6 4.8 L21.6 8.2 L24 3.6 L26.4 8.2 L29.4 4.8 L30.5 11.5 Z"/><rect x="17.5" y="12.2" width="13" height="1.8" rx="0.6"/>';
  return `<svg viewBox="0 0 48 44" aria-hidden="true">${GOLD}<g fill="url(#rl-gold)"><path d="M19.4 39.3 A15 15 0 0 1 12.6 15.4 M28.6 39.3 A15 15 0 0 0 35.4 15.4" fill="none" stroke="url(#rl-gold)" stroke-width="1.1" stroke-linecap="round"/>${leaves.join('')}${crown}</g></svg>`;
})();

const ic = (body: string, filled = false) => `<svg viewBox="0 0 24 24" aria-hidden="true" ${filled ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"'}>${body}</svg>`;

export const ICONS = {
  /** Jong Points: the club's four-point star in a ring. */
  points: `<svg viewBox="0 0 24 24" aria-hidden="true">${GOLD}<circle cx="12" cy="12" r="10.5" fill="rgba(234,208,154,0.12)" stroke="url(#rl-gold)" stroke-width="1"/><path d="M12 3.6 L13.9 10.1 L20.4 12 L13.9 13.9 L12 20.4 L10.1 13.9 L3.6 12 L10.1 10.1 Z" fill="url(#rl-gold)"/></svg>`,
  rating: ic('<path d="M12 2.8l2.75 5.95 6.45.7-4.8 4.4 1.35 6.4L12 17l-5.75 3.25 1.35-6.4-4.8-4.4 6.45-.7z"/>', true),
  level: ic('<circle cx="12" cy="7.2" r="4.1"/><circle cx="7" cy="13.4" r="4.1"/><circle cx="17" cy="13.4" r="4.1"/><path d="M11 13h2l1.2 8.2H9.8z"/>', true),
  best: ic('<path d="M3.2 8.5l4.6 3.6L12 5l4.2 7.1 4.6-3.6-1.9 10H5.1z"/><rect x="5" y="19.6" width="14" height="1.9" rx=".6"/>', true),
  season: ic('<path d="M5 19c0-8.5 5.5-14 15-14 0 9.5-5.5 15-14 15"/><path d="M5 19l8.5-8.5"/>'),
  academy: ic('<path d="M2.5 9.5L12 5l9.5 4.5L12 14z" fill="currentColor"/><path d="M6.5 11.8v4.1c3 2.4 8 2.4 11 0v-4.1M21.5 9.5v5"/>'),
  daily: ic('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  tourney: ic('<path d="M7 4h10v4a5 5 0 01-10 0zM12 13v4M8 20.5h8M7 6H4a3 3 0 003 4M17 6h3a3 3 0 01-3 4"/>'),
  insight: ic('<path d="M9 17.5h6M10 21h4"/><path d="M12 3a6 6 0 00-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0012 3z"/>'),
};

/**
 * A moonlit pavilion among pines and bamboo, drawn in faint gold behind the
 * heading. Decoration only.
 */
export const SCENE = `<svg viewBox="0 0 320 170" preserveAspectRatio="xMaxYMin meet" aria-hidden="true" focusable="false">
<defs>
<radialGradient id="rl-moon" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#f3dfa8" stop-opacity="0.9"/><stop offset="0.7" stop-color="#d9b874" stop-opacity="0.55"/><stop offset="1" stop-color="#d9b874" stop-opacity="0"/></radialGradient>
<linearGradient id="rl-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9a56b" stop-opacity="0.32"/><stop offset="1" stop-color="#c9a56b" stop-opacity="0.04"/></linearGradient>
<linearGradient id="rl-left" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.35" stop-color="#fff" stop-opacity="1"/></linearGradient>
<mask id="rl-mask"><rect width="320" height="170" fill="url(#rl-left)"/></mask>
</defs>
<g mask="url(#rl-mask)">
<circle cx="196" cy="58" r="30" fill="url(#rl-moon)" opacity="0.5"/>
<circle cx="196" cy="58" r="17" fill="#e8cf96" opacity="0.38"/>
<path d="M60 128 C96 104 128 112 156 98 C182 86 204 96 230 88 C258 80 286 92 320 84 V170 H60Z" fill="url(#rl-fade)" opacity="0.55"/>
<path d="M30 150 C80 128 120 136 160 124 C200 112 248 126 320 112 V170 H30Z" fill="#c9a56b" opacity="0.1"/>
<g fill="#c9a56b" opacity="0.32">
<path d="M222 132 h48 v-4 h-48z"/>
<path d="M226 128 v-12 h40 v12z" opacity="0.7"/>
<path d="M214 117 Q246 110 278 117 L272 112 Q246 106 220 112z"/>
<path d="M230 111 v-9 h32 v9z" opacity="0.7"/>
<path d="M221 103 Q246 96 271 103 L266 98 Q246 92 226 98z"/>
<path d="M235 97 v-8 h22 v8z" opacity="0.7"/>
<path d="M228 90 Q246 84 264 90 L259 85 Q246 80 233 85z"/>
<path d="M245 81 h2 v-8 h-2z"/>
<path d="M150 124 c4-14 10-20 18-22 c-4 4-2 8 6 6 c-6 6-2 10 8 8 c-8 8-18 10-32 8z" opacity="0.6"/>
<path d="M180 128 c2-10 8-16 16-18 c-2 4 0 7 6 6 c-5 5 0 8 7 7 c-8 6-17 7-29 5z" opacity="0.5"/>
</g>
<g stroke="#c9a56b" stroke-linecap="round" fill="none" opacity="0.42">
<path d="M300 170 C298 120 300 70 306 0" stroke-width="2.4"/>
<path d="M314 170 C312 116 314 66 318 0" stroke-width="1.8" opacity="0.7"/>
<path d="M299 120 l2 0 M300 78 l2 0 M303 36 l2 0" stroke-width="3.2" opacity="0.6"/>
</g>
<g fill="#c9a56b" opacity="0.38">
<path d="M302 66 C290 58 274 56 258 60 C272 62 286 66 302 70z"/>
<path d="M303 40 C292 30 278 26 262 26 C276 30 288 36 302 44z"/>
<path d="M305 22 C300 12 292 6 280 2 C290 10 296 16 302 26z"/>
<path d="M301 96 C290 92 276 94 264 100 C278 98 290 98 301 100z"/>
<path d="M306 52 C312 44 316 36 318 26 C314 36 308 44 304 50z"/>
</g>
</g>
</svg>`;
