// Small rendered illustrations for the premium cards (luxCard): ivory tiles, jade, gold and
// lamplight, drawn as SVG so they stay sharp at any size. Each call gets its own gradient ids.

let seq = 0;

export type LuxArtId = 'quick' | 'host' | 'join' | 'learn' | 'mini' | 'daily' | 'casual' | 'ranked' | 'tournament' | 'foundations' | 'mastery' | 'variations' | 'drills' | 'season' | 'clubs';

/** The shared paints: gold, ivory, jade, lacquer and a soft floor shadow. */
function defs(p: string) {
  return `<defs>
  <linearGradient id="${p}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe7b4"/><stop offset=".45" stop-color="#d9b46a"/><stop offset=".55" stop-color="#b48a45"/><stop offset="1" stop-color="#6e5126"/></linearGradient>
  <linearGradient id="${p}gh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a5a2a"/><stop offset=".3" stop-color="#f6dea4"/><stop offset=".55" stop-color="#c9a056"/><stop offset="1" stop-color="#6e5126"/></linearGradient>
  <linearGradient id="${p}iv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f4eee2"/><stop offset="1" stop-color="#d9cfbc"/></linearGradient>
  <linearGradient id="${p}jd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f7a62"/><stop offset=".5" stop-color="#1a5644"/><stop offset="1" stop-color="#0b2b22"/></linearGradient>
  <radialGradient id="${p}felt" cx=".5" cy=".4" r=".65"><stop offset="0" stop-color="#2f8a68"/><stop offset="1" stop-color="#0f3d2f"/></radialGradient>
  <radialGradient id="${p}glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd890" stop-opacity=".55"/><stop offset="1" stop-color="#ffd890" stop-opacity="0"/></radialGradient>
  <radialGradient id="${p}sh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <linearGradient id="${p}lf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6fae6a"/><stop offset="1" stop-color="#1f5a3a"/></linearGradient>
</defs>`;
}

const leaf = (p: string, x: number, y: number, r: number, s = 1) =>
  `<path transform="translate(${x} ${y}) rotate(${r}) scale(${s})" d="M0 0 C6 -10 18 -12 26 -8 C18 -2 8 2 0 0Z" fill="url(#${p}lf)"/><path transform="translate(${x} ${y}) rotate(${r}) scale(${s})" d="M0 0 C9 -5 16 -7 24 -8" stroke="#bfe3b0" stroke-opacity=".5" stroke-width=".7" fill="none"/>`;

/** A standing tile seen a little from the side: jade back, ivory face, an inked glyph. */
const tile = (p: string, x: number, y: number, w: number, hgt: number, rot: number, face: string) =>
  `<g transform="translate(${x} ${y}) rotate(${rot})">
  <rect x="${w * 0.1}" y="${hgt * 0.06}" width="${w}" height="${hgt}" rx="${w * 0.14}" fill="url(#${p}jd)"/>
  <rect x="0" y="0" width="${w}" height="${hgt}" rx="${w * 0.14}" fill="url(#${p}iv)" stroke="#b8a888" stroke-width=".6"/>
  <rect x="${w * 0.08}" y="${hgt * 0.06}" width="${w * 0.84}" height="${hgt * 0.88}" rx="${w * 0.1}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".8"/>
  ${face}
</g>`;

const east = (w: number, hgt: number) =>
  `<text x="${w / 2}" y="${hgt * 0.7}" text-anchor="middle" font-family="'Noto Serif SC','Songti SC','SimSun',serif" font-weight="700" font-size="${hgt * 0.62}" fill="#17603f">東</text>`;

const flower = (w: number, hgt: number) => {
  const cx = w / 2, cy = hgt / 2, r = w * 0.17;
  let petals = '';
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    petals += `<ellipse cx="${cx + Math.cos(a) * r}" cy="${cy + Math.sin(a) * r}" rx="${r * 0.62}" ry="${r * 0.4}" transform="rotate(${(k * 60).toFixed(0)} ${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r})" fill="#b8402e"/>`;
  }
  return `${petals}<circle cx="${cx}" cy="${cy}" r="${r * 0.5}" fill="#d9a441"/><path d="M${cx} ${cy + r * 1.3} L${cx} ${hgt * 0.9}" stroke="#2c6a48" stroke-width="1.6"/>`;
};


const ring = (w: number, hgt: number) =>
  `<circle cx="${w / 2}" cy="${hgt / 2}" r="${w * 0.3}" fill="none" stroke="#17603f" stroke-width="${w * 0.07}"/><circle cx="${w / 2}" cy="${hgt / 2}" r="${w * 0.17}" fill="#b8402e"/><circle cx="${w / 2}" cy="${hgt / 2}" r="${w * 0.06}" fill="#f4eee2"/>`;

const bamboo = (w: number, hgt: number) =>
  `<rect x="${w * 0.42}" y="${hgt * 0.16}" width="${w * 0.16}" height="${hgt * 0.68}" rx="${w * 0.07}" fill="#17603f"/><path d="M${w * 0.4} ${hgt * 0.38} H${w * 0.6} M${w * 0.4} ${hgt * 0.62} H${w * 0.6}" stroke="#f4eee2" stroke-width="1.4"/>`;

const red = (w: number, hgt: number) =>
  `<text x="${w / 2}" y="${hgt * 0.7}" text-anchor="middle" font-family="'Noto Serif SC','Songti SC','SimSun',serif" font-weight="700" font-size="${hgt * 0.62}" fill="#b8402e">中</text>`;

/** A jade dish on a gold-rimmed stand. */
const plinth = (p: string, cx: number, cy: number, rx: number) =>
  `<ellipse cx="${cx}" cy="${cy + rx * 0.34}" rx="${rx * 1.08}" ry="${rx * 0.2}" fill="url(#${p}sh)"/>
  <path d="M${cx - rx} ${cy} L${cx - rx} ${cy + rx * 0.14} A${rx} ${rx * 0.26} 0 0 0 ${cx + rx} ${cy + rx * 0.14} L${cx + rx} ${cy} Z" fill="url(#${p}gh)"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${rx * 0.26}" fill="url(#${p}jd)" stroke="url(#${p}g)" stroke-width="2"/>
  <ellipse cx="${cx - rx * 0.2}" cy="${cy - rx * 0.06}" rx="${rx * 0.5}" ry="${rx * 0.09}" fill="#fff" fill-opacity=".1"/>`;

const ART: Record<LuxArtId, (p: string) => string> = {
  quick: (p) =>
    `<ellipse cx="80" cy="66" rx="66" ry="46" fill="url(#${p}glow)"/>
    ${plinth(p, 80, 92, 46)}
    ${leaf(p, 112, 82, -40, 1.2)}${leaf(p, 50, 84, -150, 1)}
    ${tile(p, 56, 30, 40, 54, -12, east(40, 54))}`,

  host: (p) => {
    const chair = (x: number, y: number, s: number, flip = 1) =>
      `<g transform="translate(${x} ${y}) scale(${s * flip} ${s})"><rect x="-9" y="-22" width="18" height="24" rx="6" fill="#16392e" stroke="url(#${p}g)" stroke-width="1.4"/><rect x="-11" y="0" width="22" height="7" rx="3" fill="#1d4a3b" stroke="url(#${p}g)" stroke-width="1"/><path d="M-8 7 L-9 20 M8 7 L9 20" stroke="url(#${p}g)" stroke-width="1.6"/></g>`;
    return `<ellipse cx="80" cy="34" rx="40" ry="26" fill="url(#${p}glow)"/>
    <path d="M80 0 L80 14" stroke="url(#${p}g)" stroke-width="1.2"/>
    <path d="M64 24 Q80 10 96 24 Z" fill="url(#${p}g)"/><ellipse cx="80" cy="24" rx="16" ry="3" fill="#ffe7b0"/>
    ${chair(42, 66, 0.9)}${chair(118, 66, 0.9, -1)}
    <ellipse cx="80" cy="104" rx="52" ry="8" fill="url(#${p}sh)"/>
    <path d="M74 80 L70 100 L90 100 L86 80 Z" fill="url(#${p}gh)"/><ellipse cx="80" cy="100" rx="16" ry="3.5" fill="url(#${p}g)"/>
    <ellipse cx="80" cy="76" rx="50" ry="14" fill="#3a2414"/>
    <ellipse cx="80" cy="73" rx="50" ry="14" fill="url(#${p}felt)" stroke="url(#${p}g)" stroke-width="2.4"/>
    <ellipse cx="80" cy="73" rx="34" ry="8.5" fill="none" stroke="#f3e7c7" stroke-opacity=".35" stroke-width="3" stroke-dasharray="3 2"/>
    ${chair(56, 98, 1.05)}${chair(104, 98, 1.05, -1)}`;
  },

  join: (p) => {
    const person = (x: number, y: number, s: number) =>
      `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="0" cy="-30" r="12" fill="url(#${p}g)"/><ellipse cx="-4" cy="-34" rx="4" ry="3" fill="#fff" fill-opacity=".35"/><path d="M-22 10 C-22 -10 -12 -16 0 -16 C12 -16 22 -10 22 10 Z" fill="url(#${p}g)"/><path d="M-14 -6 C-10 -12 -4 -13 2 -13" stroke="#fff" stroke-opacity=".3" stroke-width="2" fill="none"/></g>`;
    return `<ellipse cx="80" cy="62" rx="60" ry="44" fill="url(#${p}glow)"/>
    <ellipse cx="78" cy="104" rx="44" ry="7" fill="url(#${p}sh)"/>
    ${person(62, 92, 1.05)}${person(94, 98, 1.0)}
    <circle cx="118" cy="82" r="14" fill="#0f241d" stroke="url(#${p}g)" stroke-width="2.2"/>
    <path d="M118 75 V89 M111 82 H125" stroke="#f3dca2" stroke-width="2.4" stroke-linecap="round"/>`;
  },

  learn: (p) =>
    `<ellipse cx="80" cy="60" rx="66" ry="44" fill="url(#${p}glow)"/>
    <ellipse cx="80" cy="102" rx="62" ry="8" fill="url(#${p}sh)"/>
    <path d="M18 92 L80 98 L142 92 L142 98 L80 104 L18 98 Z" fill="url(#${p}gh)"/>
    <path d="M22 88 C40 80 64 82 80 92 L80 30 C64 20 40 18 22 26 Z" fill="url(#${p}iv)" stroke="#b8a888" stroke-width=".8"/>
    <path d="M138 88 C120 80 96 82 80 92 L80 30 C96 20 120 18 138 26 Z" fill="url(#${p}iv)" stroke="#b8a888" stroke-width=".8"/>
    <path d="M80 30 L80 92" stroke="#c9b48a" stroke-width="1.2"/>
    ${[38, 46, 54, 62, 70].map((y) => `<path d="M30 ${y} C44 ${y - 5} 60 ${y - 4} 72 ${y + 2}" stroke="#8a7a5c" stroke-opacity=".45" stroke-width="1" fill="none"/>`).join('')}
    <path d="M100 70 C104 56 112 46 124 40" stroke="#2c6a48" stroke-width="1.4" fill="none"/>
    ${leaf(p, 104, 62, -60, 0.45)}${leaf(p, 110, 52, -20, 0.45)}${leaf(p, 116, 46, -70, 0.4)}
    <circle cx="124" cy="40" r="2.6" fill="#b8402e"/><circle cx="118" cy="48" r="2" fill="#b8402e"/>
    <path d="M86 92 L86 112 L90 107 L94 112 L94 94" fill="#9b2f24"/>`,

  mini: (p) =>
    `<ellipse cx="80" cy="62" rx="64" ry="44" fill="url(#${p}glow)"/>
    <path d="M38 88 A44 44 0 1 1 122 88" fill="none" stroke="url(#${p}gh)" stroke-width="2.6"/>
    ${plinth(p, 80, 92, 48)}
    ${leaf(p, 118, 50, -60, 1)}${leaf(p, 122, 62, -20, 0.9)}
    <g><rect x="44" y="70" width="22" height="22" rx="5" fill="#cfe6dc" stroke="#7fb4a0" stroke-width="1"/><circle cx="50" cy="76" r="2" fill="#1a5644"/><circle cx="60" cy="86" r="2" fill="#1a5644"/><circle cx="55" cy="81" r="2" fill="#9b2f24"/></g>
    ${tile(p, 72, 36, 34, 48, 6, flower(34, 48))}`,

  daily: (p) =>
    `<ellipse cx="80" cy="60" rx="62" ry="42" fill="url(#${p}glow)"/>
    <ellipse cx="80" cy="102" rx="56" ry="7" fill="url(#${p}sh)"/>
    <rect x="40" y="26" width="80" height="72" rx="10" fill="#14302a" stroke="url(#${p}g)" stroke-width="2"/>
    <rect x="40" y="26" width="80" height="18" rx="10" fill="url(#${p}g)"/><rect x="40" y="36" width="80" height="8" fill="url(#${p}g)"/>
    <path d="M58 20 V32 M102 20 V32" stroke="url(#${p}g)" stroke-width="4" stroke-linecap="round"/>
    ${tile(p, 64, 52, 26, 36, -4, east(26, 36))}`,

  casual: (p) =>
    `<ellipse cx="80" cy="60" rx="62" ry="42" fill="url(#${p}glow)"/>
    <ellipse cx="80" cy="104" rx="56" ry="7" fill="url(#${p}sh)"/>
    <path d="M44 66 C44 92 58 102 80 102 C102 102 116 92 116 66 Z" fill="url(#${p}iv)" stroke="#b8a888" stroke-width=".8"/>
    <ellipse cx="80" cy="66" rx="36" ry="9" fill="#8a5a1e"/><ellipse cx="80" cy="66" rx="36" ry="9" fill="none" stroke="url(#${p}g)" stroke-width="2"/>
    <path d="M116 72 C132 72 132 90 112 92" fill="none" stroke="url(#${p}g)" stroke-width="3"/>
    <path d="M70 52 C66 44 74 40 70 32 M86 52 C82 44 90 40 86 32" stroke="#fff" stroke-opacity=".35" stroke-width="2" fill="none" stroke-linecap="round"/>`,

  ranked: (p) =>
    `<ellipse cx="80" cy="56" rx="60" ry="44" fill="url(#${p}glow)"/>
    <ellipse cx="80" cy="104" rx="40" ry="6" fill="url(#${p}sh)"/>
    <path d="M80 14 L112 26 V54 C112 76 98 90 80 98 C62 90 48 76 48 54 V26 Z" fill="url(#${p}jd)" stroke="url(#${p}g)" stroke-width="3"/>
    <path d="M80 34 L85 46 L98 47 L88 55 L91 68 L80 61 L69 68 L72 55 L62 47 L75 46 Z" fill="url(#${p}g)"/>`,

  tournament: (p) =>
    `<ellipse cx="80" cy="56" rx="60" ry="44" fill="url(#${p}glow)"/>
    <ellipse cx="80" cy="104" rx="40" ry="6" fill="url(#${p}sh)"/>
    <path d="M56 22 H104 V40 C104 58 94 68 80 68 C66 68 56 58 56 40 Z" fill="url(#${p}g)"/>
    <path d="M56 28 C40 28 40 50 60 52 M104 28 C120 28 120 50 100 52" fill="none" stroke="url(#${p}g)" stroke-width="4"/>
    <path d="M76 68 H84 V82 H76 Z" fill="url(#${p}gh)"/><rect x="62" y="82" width="36" height="8" rx="2" fill="url(#${p}g)"/><rect x="56" y="90" width="48" height="10" rx="2" fill="#2a1a10" stroke="url(#${p}g)" stroke-width="1.4"/>
    <ellipse cx="70" cy="34" rx="5" ry="9" fill="#fff" fill-opacity=".3"/>`,

  foundations: (p) =>
    `<ellipse cx="80" cy="60" rx="64" ry="44" fill="url(#${p}glow)"/>
    <ellipse cx="80" cy="104" rx="54" ry="7" fill="url(#${p}sh)"/>
    ${tile(p, 46, 58, 32, 44, 0, bamboo(32, 44))}${tile(p, 82, 58, 32, 44, 0, ring(32, 44))}
    ${tile(p, 64, 14, 32, 44, 0, east(32, 44))}
    ${leaf(p, 118, 98, -70, 1)}${leaf(p, 120, 96, -20, 0.8)}${leaf(p, 42, 100, -120, 0.8)}`,

  mastery: (p) => {
    let wreath = '';
    for (let k = 0; k < 7; k++) {
      const a = (200 + k * 22) * (Math.PI / 180);
      wreath += leaf(p, 80 + Math.cos(a) * 44, 64 - Math.sin(a) * 40, 160 - k * 24, 0.8);
      wreath += leaf(p, 80 - Math.cos(a) * 44, 64 - Math.sin(a) * 40, 20 + k * 24, 0.8);
    }
    return `<ellipse cx="80" cy="60" rx="62" ry="44" fill="url(#${p}glow)"/>
    <ellipse cx="80" cy="106" rx="44" ry="6" fill="url(#${p}sh)"/>
    <path d="M44 70 C46 92 62 104 80 104 C98 104 114 92 116 70" fill="none" stroke="url(#${p}gh)" stroke-width="2.4"/>
    ${wreath}
    ${tile(p, 62, 30, 36, 50, 0, red(36, 50))}
    <path d="M68 22 L72 12 L80 20 L88 12 L92 22 Z" fill="url(#${p}g)"/>`;
  },

  variations: (p) =>
    `<ellipse cx="80" cy="58" rx="64" ry="46" fill="url(#${p}glow)"/>
    <ellipse cx="80" cy="106" rx="40" ry="6" fill="url(#${p}sh)"/>
    <circle cx="80" cy="58" r="36" fill="url(#${p}jd)" stroke="url(#${p}g)" stroke-width="2.6"/>
    <ellipse cx="80" cy="58" rx="16" ry="36" fill="none" stroke="url(#${p}g)" stroke-width="1.2" stroke-opacity=".8"/>
    <path d="M44 58 H116 M50 40 H110 M50 76 H110" stroke="url(#${p}g)" stroke-width="1.2" stroke-opacity=".8"/>
    <ellipse cx="70" cy="44" rx="10" ry="6" fill="#fff" fill-opacity=".12"/>
    <path d="M80 94 V100" stroke="url(#${p}g)" stroke-width="3"/><path d="M62 102 H98" stroke="url(#${p}g)" stroke-width="4" stroke-linecap="round"/>
    ${tile(p, 14, 52, 22, 30, -14, ring(22, 30))}${tile(p, 124, 46, 22, 30, 12, east(22, 30))}${tile(p, 70, 2, 20, 26, 0, bamboo(20, 26))}`,

  drills: (p) =>
    `<ellipse cx="80" cy="60" rx="62" ry="44" fill="url(#${p}glow)"/>
    <ellipse cx="80" cy="106" rx="44" ry="6" fill="url(#${p}sh)"/>
    <rect x="74" y="12" width="12" height="10" rx="2" fill="url(#${p}g)"/><path d="M106 26 L112 20" stroke="url(#${p}g)" stroke-width="4" stroke-linecap="round"/>
    <circle cx="80" cy="60" r="38" fill="url(#${p}g)"/>
    <circle cx="80" cy="60" r="32" fill="url(#${p}iv)"/>
    ${Array.from({ length: 12 }, (_, k) => { const a = (k * Math.PI) / 6; return `<path d="M${80 + Math.cos(a) * 27} ${60 + Math.sin(a) * 27} L${80 + Math.cos(a) * (k % 3 ? 29 : 31)} ${60 + Math.sin(a) * (k % 3 ? 29 : 31)}" stroke="#6e5126" stroke-width="${k % 3 ? 1 : 2}"/>`; }).join('')}
    <path d="M80 60 L80 36" stroke="#17603f" stroke-width="3" stroke-linecap="round"/><path d="M80 60 L96 68" stroke="#b8402e" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M80 60 L80 28 A32 32 0 0 1 108 44 Z" fill="#2f7a62" fill-opacity=".18"/>
    <circle cx="80" cy="60" r="3.4" fill="url(#${p}g)"/>`,

  // A red paper lantern on a gold cord, for the Club Season.
  season: (p) =>
    `<ellipse cx="80" cy="60" rx="60" ry="44" fill="url(#${p}glow)"/>
    <ellipse cx="80" cy="106" rx="34" ry="5" fill="url(#${p}sh)"/>
    <path d="M80 6 V22" stroke="url(#${p}g)" stroke-width="2"/>
    <rect x="66" y="20" width="28" height="7" rx="2" fill="url(#${p}g)"/>
    <ellipse cx="80" cy="56" rx="34" ry="30" fill="#b3352a"/>
    <path d="M62 30 C54 44 54 68 62 82 M80 26 V86 M98 30 C106 44 106 68 98 82" stroke="#7a1f1b" stroke-width="1.4" fill="none"/>
    <ellipse cx="68" cy="46" rx="8" ry="14" fill="#ffd890" fill-opacity=".28"/>
    <rect x="66" y="84" width="28" height="7" rx="2" fill="url(#${p}g)"/>
    <path d="M74 91 V104 M80 91 V108 M86 91 V104" stroke="url(#${p}g)" stroke-width="1.6"/>`,

  // A small pavilion with a gold key before it, for private clubs.
  clubs: (p) =>
    `<ellipse cx="80" cy="62" rx="62" ry="42" fill="url(#${p}glow)"/>
    <ellipse cx="80" cy="104" rx="56" ry="7" fill="url(#${p}sh)"/>
    <path d="M34 44 Q80 18 126 44 L118 48 Q80 30 42 48 Z" fill="url(#${p}jd)" stroke="url(#${p}g)" stroke-width="1.6"/>
    <path d="M30 42 Q36 46 42 48 M130 42 Q124 46 118 48" stroke="url(#${p}g)" stroke-width="2" fill="none"/>
    <rect x="48" y="48" width="64" height="6" fill="url(#${p}gh)"/>
    <rect x="52" y="54" width="7" height="42" fill="#7a1f1b"/><rect x="101" y="54" width="7" height="42" fill="#7a1f1b"/>
    <rect x="66" y="62" width="28" height="34" rx="2" fill="#14302a" stroke="url(#${p}g)" stroke-width="1.2"/>
    <rect x="44" y="96" width="72" height="6" rx="1" fill="url(#${p}g)"/>
    <circle cx="80" cy="76" r="7" fill="none" stroke="url(#${p}g)" stroke-width="3"/><path d="M80 83 V96 M80 90 H86" stroke="url(#${p}g)" stroke-width="3" stroke-linecap="round"/>`,
};

/** The illustration for one card, as an SVG string. */
export function luxArt(id: LuxArtId): string {
  const p = `lx${seq++}`;
  return `<svg viewBox="0 0 160 120" aria-hidden="true" focusable="false">${defs(p)}${ART[id](p)}</svg>`;
}
