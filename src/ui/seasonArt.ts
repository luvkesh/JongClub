// A small round night scene for each Club Season's city, drawn in the season's
// own colours: the Home screen's season card shows it.

type Colors = [string, string, string];

/** Windows lit in a building: a few small squares, the same every time. */
function windows(x: number, y: number, w: number, h: number, light: string, seed: number) {
  let out = '';
  let s = seed;
  for (let yy = y + 3; yy < y + h - 2; yy += 3.2) {
    for (let xx = x + 1.4; xx < x + w - 1.4; xx += 2.4) {
      s = (s * 9301 + 49297) % 233280;
      if (s / 233280 < 0.34) out += `<rect x="${xx.toFixed(1)}" y="${yy.toFixed(1)}" width="1" height="1.3" fill="${light}" opacity="${(0.55 + (s % 40) / 100).toFixed(2)}"/>`;
    }
  }
  return out;
}

const towers = (list: [number, number, number][], base: number, ink: string, light: string) =>
  list.map(([x, w, h], i) => `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" fill="${ink}"/>${windows(x, base - h, w, h, light, i * 17 + 5)}`).join('');

/** Light on water: the skyline's glow broken into short strokes. */
const water = (y: number, light: string, accent: string) =>
  `<rect x="0" y="${y}" width="100" height="${100 - y}" fill="url(#sa-water)"/>` +
  [8, 18, 27, 36, 47, 58, 66, 74, 83, 92]
    .map((x, i) => `<rect x="${x - 2}" y="${y + 3 + (i % 3) * 4}" width="${3 + (i % 2) * 2}" height="0.9" rx="0.45" fill="${i % 2 ? accent : light}" opacity="0.55"/>`)
    .join('');

const SCENES: Record<string, (c: Colors, ink: string) => string> = {
  hongkong: ([, a, l], ink) =>
    `<path d="M0 60 Q18 38 34 50 Q48 40 62 52 Q80 44 100 56 V72 H0z" fill="${ink}" opacity="0.55"/>` +
    towers([[6, 7, 18], [14, 6, 24], [21, 8, 16], [30, 6, 28], [37, 9, 21], [47, 7, 33], [55, 8, 44], [64, 6, 26], [71, 9, 30], [81, 7, 22], [89, 8, 17]], 72, ink, l) +
    `<path d="M55 28 L59 22 L63 28z" fill="${ink}"/>` +
    water(72, l, a),
  tokyo: ([, a, l], ink) =>
    `<path d="M-4 70 L24 44 L30 47 L36 42 L60 70z" fill="${l}" opacity="0.12"/>` +
    towers([[4, 8, 14], [13, 7, 20], [62, 8, 18], [71, 7, 24], [80, 9, 15], [90, 8, 21]], 76, ink, l) +
    `<g stroke="${a}" stroke-width="1.1" fill="none"><path d="M50 14 L42 76 M50 14 L58 76 M44.5 56 H55.5 M46 44 H54 M47.6 32 H52.4 M43.5 66 L56.5 66"/><path d="M44.5 56 L54 44 M55.5 56 L46 44 M43.5 66 L55.5 56 M56.5 66 L44.5 56" stroke-width="0.5" opacity="0.8"/></g>` +
    `<rect x="45" y="42" width="10" height="3" fill="${a}"/><rect x="46.5" y="30.5" width="7" height="2.4" fill="${a}"/>` +
    `<rect x="0" y="76" width="100" height="24" fill="${ink}"/>`,
  dubai: ([, a, l], ink) =>
    `<path d="M74 22 a7 7 0 1 0 6 9 a5.5 5.5 0 1 1 -6 -9z" fill="${l}" opacity="0.85"/>` +
    towers([[8, 7, 16], [16, 6, 22], [24, 7, 13], [64, 7, 19], [72, 6, 26], [80, 8, 15], [89, 7, 21]], 74, ink, l) +
    `<path d="M50 8 L51.2 30 L53.5 30 L54.5 48 L57 48 L58.5 74 H41.5 L43 48 L45.5 48 L46.5 30 L48.8 30z" fill="${ink}"/>` +
    windows(46, 32, 8, 40, l, 3) +
    `<path d="M0 78 Q20 70 42 76 Q66 82 100 72 V100 H0z" fill="${a}" opacity="0.5"/><path d="M0 86 Q30 78 58 86 T100 84 V100 H0z" fill="${ink}"/>`,
  taipei: ([, a, l], ink) => {
    let t = `<rect x="47" y="9" width="2" height="9" fill="${ink}"/>`;
    for (let i = 0; i < 8; i++) {
      const y = 18 + i * 6.4;
      t += `<path d="M${43.5 + i * 0.1} ${y} H${52.5 - i * 0.1} L${54 - i * 0.05} ${y + 6.4} H${42 + i * 0.05}z" fill="${ink}" stroke="${a}" stroke-width="0.35" stroke-opacity="0.7"/>`;
    }
    return (
      [[16, 30], [26, 22], [74, 26], [84, 34], [10, 44], [90, 18]].map(([x, y]) => `<g><ellipse cx="${x}" cy="${y}" rx="2.6" ry="3.2" fill="${a}"/><ellipse cx="${x}" cy="${y}" rx="1.4" ry="2.2" fill="${l}" opacity="0.6"/></g>`).join('') +
      t +
      `<rect x="44" y="69" width="8" height="7" fill="${ink}"/>` +
      towers([[4, 8, 18], [13, 7, 12], [24, 8, 22], [33, 7, 15], [58, 7, 19], [66, 8, 13], [76, 7, 23], [86, 9, 16]], 76, ink, l) +
      `<rect x="0" y="76" width="100" height="24" fill="${ink}"/>`
    );
  },
  singapore: ([, a, l], ink) =>
    towers([[4, 7, 20], [12, 6, 28], [82, 7, 24], [90, 8, 18]], 70, ink, l) +
    `<path d="M33 70 L35 34 H41 L42 70z M45 70 L47 34 H53 L54 70z M57 70 L59 34 H65 L66 70z" fill="${ink}"/>${windows(35, 36, 6, 32, l, 7)}${windows(47, 36, 6, 32, l, 9)}${windows(59, 36, 6, 32, l, 11)}` +
    `<path d="M30 33 Q50 29 71 33 L71 31 Q50 27 30 31z" fill="${ink}"/>` +
    [21, 26, 74].map((x) => `<path d="M${x - 4} 52 Q${x} 56 ${x + 4} 52 L${x + 0.6} 70 H${x - 0.6}z" fill="${a}" opacity="0.8"/>`).join('') +
    water(70, l, a),
  hanoi: ([, a, l], ink) =>
    `<circle cx="72" cy="24" r="7" fill="${l}" opacity="0.8"/>` +
    `<path d="M50 20 L52 26 H48z M38 34 Q50 24 62 34 Q55 32 50 33 Q45 32 38 34z M35 46 Q50 34 65 46 Q57 43 50 44 Q43 43 35 46z" fill="${a}"/>` +
    `<rect x="43" y="34" width="14" height="8" fill="${ink}"/><rect x="40" y="46" width="20" height="9" fill="${ink}"/><rect x="49" y="55" width="2" height="12" fill="${ink}"/>` +
    `<rect x="44.5" y="36.5" width="2" height="3" fill="${l}" opacity="0.7"/><rect x="53.5" y="36.5" width="2" height="3" fill="${l}" opacity="0.7"/><rect x="47" y="48.5" width="6" height="4" fill="${l}" opacity="0.6"/>` +
    `<path d="M0 60 Q14 52 26 58 L30 66 H0z M100 60 Q86 52 74 58 L70 66 H100z" fill="${ink}"/>` +
    water(66, l, a) +
    [[22, 80], [70, 84], [84, 78]].map(([x, y]) => `<path d="M${x - 4} ${y} Q${x - 2} ${y - 5} ${x} ${y - 6} Q${x + 2} ${y - 5} ${x + 4} ${y}z" fill="${a}" opacity="0.85"/><ellipse cx="${x}" cy="${y + 1}" rx="6" ry="1.4" fill="${ink}" opacity="0.8"/>`).join(''),
};

/** The season's city at night, as an SVG string sized by its container. */
export function seasonArt(themeId: string, colors: Colors): string {
  const [base, accent, light] = colors;
  const ink = '#06080a';
  const scene = (SCENES[themeId] ?? SCENES.hongkong)(colors, ink);
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
<defs>
<radialGradient id="sa-sky" cx="50%" cy="78%" r="80%"><stop offset="0" stop-color="${accent}" stop-opacity="0.75"/><stop offset="0.45" stop-color="${base}"/><stop offset="1" stop-color="#05070a"/></radialGradient>
<linearGradient id="sa-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${base}"/><stop offset="1" stop-color="#030405"/></linearGradient>
<clipPath id="sa-clip"><circle cx="50" cy="50" r="50"/></clipPath>
</defs>
<g clip-path="url(#sa-clip)"><rect width="100" height="100" fill="url(#sa-sky)"/>
${[[12, 12], [30, 8], [84, 10], [92, 30], [6, 34], [64, 6]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.6" fill="${light}" opacity="0.8"/>`).join('')}
${scene}</g>
</svg>`;
}
