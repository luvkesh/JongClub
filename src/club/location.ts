// Where the player is, for city and country leaderboards. The IP address
// gives a first guess, the device's location (GPS) a precise one when the
// player allows it, and the time zone is the fallback when neither is
// reachable. Nothing leaves the device but the IP lookup itself.

import type { Region } from './roster';

/** [city, ISO country code, latitude, longitude, IANA time zones that point here]. */
type Place = [string, string, number, number, string[]?];

/** Every club member's home city, plus the larger cities players are likely to be near. */
export const PLACES: Place[] = [
  ['Tokyo', 'JP', 35.68, 139.69, ['Asia/Tokyo']], ['Osaka', 'JP', 34.69, 135.5], ['Kyoto', 'JP', 35.01, 135.77], ['Nagoya', 'JP', 35.18, 136.91], ['Fukuoka', 'JP', 33.59, 130.4], ['Sapporo', 'JP', 43.06, 141.35],
  ['Seoul', 'KR', 37.57, 126.98, ['Asia/Seoul']], ['Busan', 'KR', 35.18, 129.08],
  ['Taipei', 'TW', 25.03, 121.57, ['Asia/Taipei']], ['Kaohsiung', 'TW', 22.63, 120.3], ['Taichung', 'TW', 24.15, 120.67],
  ['Hong Kong', 'HK', 22.32, 114.17, ['Asia/Hong_Kong']], ['Macau', 'MO', 22.2, 113.55, ['Asia/Macau']],
  ['Shanghai', 'CN', 31.23, 121.47, ['Asia/Shanghai']], ['Beijing', 'CN', 39.9, 116.4], ['Guangzhou', 'CN', 23.13, 113.26], ['Shenzhen', 'CN', 22.54, 114.06], ['Chengdu', 'CN', 30.57, 104.07], ['Wuhan', 'CN', 30.59, 114.31], ['Xiamen', 'CN', 24.48, 118.09], ['Harbin', 'CN', 45.8, 126.53, ['Asia/Harbin']], ['Hangzhou', 'CN', 30.27, 120.16], ['Chongqing', 'CN', 29.56, 106.55, ['Asia/Chongqing']],
  ['Ulaanbaatar', 'MN', 47.89, 106.91, ['Asia/Ulaanbaatar']],
  ['Singapore', 'SG', 1.35, 103.82, ['Asia/Singapore']], ['Kuala Lumpur', 'MY', 3.14, 101.69, ['Asia/Kuala_Lumpur']], ['Penang', 'MY', 5.41, 100.33], ['Johor Bahru', 'MY', 1.49, 103.74], ['Kuching', 'MY', 1.55, 110.36, ['Asia/Kuching']],
  ['Bangkok', 'TH', 13.76, 100.5, ['Asia/Bangkok']], ['Chiang Mai', 'TH', 18.79, 98.98], ['Manila', 'PH', 14.6, 120.98, ['Asia/Manila']], ['Cebu', 'PH', 10.32, 123.89],
  ['Jakarta', 'ID', -6.21, 106.85, ['Asia/Jakarta']], ['Surabaya', 'ID', -7.25, 112.75], ['Bali', 'ID', -8.65, 115.22, ['Asia/Makassar']], ['Medan', 'ID', 3.6, 98.67],
  ['Ho Chi Minh City', 'VN', 10.82, 106.63, ['Asia/Ho_Chi_Minh', 'Asia/Saigon']], ['Hanoi', 'VN', 21.03, 105.85], ['Phnom Penh', 'KH', 11.56, 104.92, ['Asia/Phnom_Penh']], ['Yangon', 'MM', 16.87, 96.2, ['Asia/Yangon', 'Asia/Rangoon']], ['Vientiane', 'LA', 17.98, 102.63, ['Asia/Vientiane']], ['Brunei', 'BN', 4.9, 114.94, ['Asia/Brunei']],
  ['Dubai', 'AE', 25.2, 55.27, ['Asia/Dubai']], ['Abu Dhabi', 'AE', 24.45, 54.38], ['Sharjah', 'AE', 25.35, 55.42], ['Doha', 'QA', 25.29, 51.53, ['Asia/Qatar']], ['Muscat', 'OM', 23.59, 58.41, ['Asia/Muscat']], ['Manama', 'BH', 26.23, 50.59, ['Asia/Bahrain']], ['Kuwait City', 'KW', 29.38, 47.99, ['Asia/Kuwait']],
  ['Riyadh', 'SA', 24.71, 46.68, ['Asia/Riyadh']], ['Jeddah', 'SA', 21.49, 39.19], ['Beirut', 'LB', 33.89, 35.5, ['Asia/Beirut']], ['Amman', 'JO', 31.95, 35.93, ['Asia/Amman']], ['Tel Aviv', 'IL', 32.09, 34.78, ['Asia/Jerusalem']], ['Cairo', 'EG', 30.04, 31.24, ['Africa/Cairo']], ['Tehran', 'IR', 35.69, 51.39, ['Asia/Tehran']], ['Baghdad', 'IQ', 33.31, 44.36, ['Asia/Baghdad']],
  ['Mumbai', 'IN', 19.08, 72.88, ['Asia/Kolkata', 'Asia/Calcutta']], ['Delhi', 'IN', 28.61, 77.21], ['Bengaluru', 'IN', 12.97, 77.59], ['Kolkata', 'IN', 22.57, 88.36], ['Chennai', 'IN', 13.08, 80.27], ['Hyderabad', 'IN', 17.39, 78.49], ['Pune', 'IN', 18.52, 73.86], ['Ahmedabad', 'IN', 23.02, 72.57], ['Darjeeling', 'IN', 27.04, 88.26], ['Goa', 'IN', 15.5, 73.83],
  ['Colombo', 'LK', 6.93, 79.86, ['Asia/Colombo']], ['Karachi', 'PK', 24.86, 67.0, ['Asia/Karachi']], ['Lahore', 'PK', 31.55, 74.34], ['Dhaka', 'BD', 23.81, 90.41, ['Asia/Dhaka']], ['Kathmandu', 'NP', 27.72, 85.32, ['Asia/Kathmandu', 'Asia/Katmandu']], ['Malé', 'MV', 4.18, 73.51, ['Indian/Maldives']],
  ['London', 'GB', 51.51, -0.13, ['Europe/London']], ['Manchester', 'GB', 53.48, -2.24], ['Edinburgh', 'GB', 55.95, -3.19], ['Dublin', 'IE', 53.35, -6.26, ['Europe/Dublin']],
  ['Paris', 'FR', 48.86, 2.35, ['Europe/Paris']], ['Lyon', 'FR', 45.76, 4.84], ['Berlin', 'DE', 52.52, 13.4, ['Europe/Berlin']], ['Munich', 'DE', 48.14, 11.58], ['Hamburg', 'DE', 53.55, 9.99], ['Frankfurt', 'DE', 50.11, 8.68],
  ['Amsterdam', 'NL', 52.37, 4.9, ['Europe/Amsterdam']], ['Brussels', 'BE', 50.85, 4.35, ['Europe/Brussels']], ['Luxembourg', 'LU', 49.61, 6.13, ['Europe/Luxembourg']], ['Zurich', 'CH', 47.38, 8.54, ['Europe/Zurich']], ['Geneva', 'CH', 46.2, 6.14], ['Vienna', 'AT', 48.21, 16.37, ['Europe/Vienna']],
  ['Milan', 'IT', 45.46, 9.19], ['Rome', 'IT', 41.9, 12.5, ['Europe/Rome']], ['Madrid', 'ES', 40.42, -3.7, ['Europe/Madrid']], ['Barcelona', 'ES', 41.39, 2.17], ['Lisbon', 'PT', 38.72, -9.14, ['Europe/Lisbon']], ['Porto', 'PT', 41.15, -8.61],
  ['Stockholm', 'SE', 59.33, 18.07, ['Europe/Stockholm']], ['Copenhagen', 'DK', 55.68, 12.57, ['Europe/Copenhagen']], ['Oslo', 'NO', 59.91, 10.75, ['Europe/Oslo']], ['Helsinki', 'FI', 60.17, 24.94, ['Europe/Helsinki']],
  ['Warsaw', 'PL', 52.23, 21.01, ['Europe/Warsaw']], ['Prague', 'CZ', 50.08, 14.44, ['Europe/Prague']], ['Budapest', 'HU', 47.5, 19.04, ['Europe/Budapest']], ['Athens', 'GR', 37.98, 23.73, ['Europe/Athens']], ['Bucharest', 'RO', 44.43, 26.1, ['Europe/Bucharest']], ['Kyiv', 'UA', 50.45, 30.52, ['Europe/Kyiv', 'Europe/Kiev']],
  ['Istanbul', 'TR', 41.01, 28.98, ['Europe/Istanbul']], ['Moscow', 'RU', 55.76, 37.62, ['Europe/Moscow']],
  ['New York', 'US', 40.71, -74.01, ['America/New_York']], ['Boca Raton', 'US', 26.37, -80.13], ['Miami', 'US', 25.76, -80.19], ['Boston', 'US', 42.36, -71.06], ['Washington', 'US', 38.91, -77.04], ['Philadelphia', 'US', 39.95, -75.17], ['Atlanta', 'US', 33.75, -84.39],
  ['Chicago', 'US', 41.88, -87.63, ['America/Chicago']], ['Houston', 'US', 29.76, -95.37], ['Dallas', 'US', 32.78, -96.8], ['Denver', 'US', 39.74, -104.99, ['America/Denver']], ['Phoenix', 'US', 33.45, -112.07, ['America/Phoenix']], ['Las Vegas', 'US', 36.17, -115.14],
  ['Los Angeles', 'US', 34.05, -118.24, ['America/Los_Angeles']], ['San Francisco', 'US', 37.77, -122.42], ['Seattle', 'US', 47.61, -122.33], ['Honolulu', 'US', 21.31, -157.86, ['Pacific/Honolulu']],
  ['Toronto', 'CA', 43.65, -79.38, ['America/Toronto']], ['Vancouver', 'CA', 49.28, -123.12, ['America/Vancouver']], ['Montreal', 'CA', 45.5, -73.57], ['Calgary', 'CA', 51.05, -114.07, ['America/Edmonton']],
  ['Mexico City', 'MX', 19.43, -99.13, ['America/Mexico_City']], ['São Paulo', 'BR', -23.55, -46.63, ['America/Sao_Paulo']], ['Rio de Janeiro', 'BR', -22.91, -43.17], ['Buenos Aires', 'AR', -34.6, -58.38, ['America/Argentina/Buenos_Aires', 'America/Buenos_Aires']], ['Lima', 'PE', -12.05, -77.04, ['America/Lima']], ['Bogotá', 'CO', 4.71, -74.07, ['America/Bogota']], ['Santiago', 'CL', -33.45, -70.67, ['America/Santiago']],
  ['Sydney', 'AU', -33.87, 151.21, ['Australia/Sydney']], ['Melbourne', 'AU', -37.81, 144.96, ['Australia/Melbourne']], ['Brisbane', 'AU', -27.47, 153.03, ['Australia/Brisbane']], ['Perth', 'AU', -31.95, 115.86, ['Australia/Perth']], ['Adelaide', 'AU', -34.93, 138.6, ['Australia/Adelaide']],
  ['Auckland', 'NZ', -36.85, 174.76, ['Pacific/Auckland']], ['Wellington', 'NZ', -41.29, 174.78],
  ['Johannesburg', 'ZA', -26.2, 28.05, ['Africa/Johannesburg']], ['Cape Town', 'ZA', -33.92, 18.42], ['Lagos', 'NG', 6.52, 3.38, ['Africa/Lagos']], ['Nairobi', 'KE', -1.29, 36.82, ['Africa/Nairobi']], ['Casablanca', 'MA', 33.57, -7.59, ['Africa/Casablanca']],
];

/** The club's regions by country. Countries not listed fall back on their continent below. */
const REGION_OF: Record<string, Region> = {
  JP: 'East Asia', KR: 'East Asia', TW: 'East Asia', HK: 'East Asia', MO: 'East Asia', CN: 'East Asia', MN: 'East Asia',
  SG: 'Southeast Asia', MY: 'Southeast Asia', TH: 'Southeast Asia', PH: 'Southeast Asia', ID: 'Southeast Asia', VN: 'Southeast Asia', KH: 'Southeast Asia', MM: 'Southeast Asia', LA: 'Southeast Asia', BN: 'Southeast Asia',
  AE: 'Middle East', QA: 'Middle East', OM: 'Middle East', BH: 'Middle East', KW: 'Middle East', SA: 'Middle East', LB: 'Middle East', JO: 'Middle East', IL: 'Middle East', EG: 'Middle East', IR: 'Middle East', IQ: 'Middle East',
  IN: 'South Asia', LK: 'South Asia', PK: 'South Asia', BD: 'South Asia', NP: 'South Asia', MV: 'South Asia',
  AU: 'Oceania', NZ: 'Oceania',
  US: 'Americas', CA: 'Americas', MX: 'Americas', BR: 'Americas', AR: 'Americas', PE: 'Americas', CO: 'Americas', CL: 'Americas',
};

/** The club's region for a country; Europe and Africa share the Europe region (similar evening hours). */
export const regionOfCountry = (cc: string): Region => REGION_OF[cc] ?? 'Europe';

/** The city a club member lives in, with its country. */
export function placeOf(city: string): { city: string; country: string } | undefined {
  const p = PLACES.find((x) => x[0] === city);
  return p && { city: p[0], country: p[1] };
}

/** Countries in the table, for the country picker. */
export const COUNTRIES = [...new Set(PLACES.map((p) => p[1]))];

export const citiesIn = (cc: string) => PLACES.filter((p) => p[1] === cc).map((p) => p[0]);

/** A country's name in the player's language. */
export function countryName(cc: string, lang = 'en'): string {
  try {
    return new Intl.DisplayNames([lang, 'en'], { type: 'region' }).of(cc) ?? cc;
  } catch {
    return cc;
  }
}

const km = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const r = Math.PI / 180;
  const x = (bLon - aLon) * r * Math.cos(((aLat + bLat) / 2) * r);
  const y = (bLat - aLat) * r;
  return Math.hypot(x, y) * 6371;
};

/** The nearest city in the table, preferring one in the given country. */
export function nearestPlace(lat: number, lon: number, cc?: string): { city: string; country: string; km: number } {
  let best: Place = PLACES[0]!,
    bd = Infinity;
  for (const p of PLACES) {
    if (cc && p[1] !== cc && PLACES.some((q) => q[1] === cc)) continue;
    const d = km(lat, lon, p[2], p[3]);
    if (d < bd) (bd = d), (best = p);
  }
  return { city: best[0], country: best[1], km: bd };
}

export interface Located {
  city: string;
  country: string;
  source: 'gps' | 'ip' | 'tz';
}

/** A guess from the device's time zone alone. */
export function fromTimeZone(): Located | null {
  let tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return null;
  }
  const p = PLACES.find((x) => x[4]?.includes(tz));
  return p ? { city: p[0], country: p[1], source: 'tz' } : null;
}

const withTimeout = <T>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);

/** City and country from the IP address. Null when the lookup is blocked or fails. */
export async function fromIp(): Promise<Located | null> {
  const tries: [string, (j: Record<string, unknown>) => [string, string, number, number] | null][] = [
    ['https://ipapi.co/json/', (j) => (typeof j.country_code === 'string' ? [j.country_code, String(j.city ?? ''), Number(j.latitude), Number(j.longitude)] : null)],
    ['https://ipwho.is/', (j) => (typeof j.country_code === 'string' ? [j.country_code, String(j.city ?? ''), Number(j.latitude), Number(j.longitude)] : null)],
  ];
  for (const [url, read] of tries) {
    try {
      const res = await withTimeout(fetch(url, { cache: 'no-store' }), 4000);
      if (!res.ok) continue;
      const got = read((await res.json()) as Record<string, unknown>);
      if (!got) continue;
      const [cc, city, lat, lon] = got;
      const known = PLACES.find((p) => p[1] === cc.toUpperCase() && p[0].toLowerCase() === city.toLowerCase());
      if (known) return { city: known[0], country: known[1], source: 'ip' };
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        const near = nearestPlace(lat, lon, cc.toUpperCase());
        // Far from any city we list: keep the city the lookup named.
        return { city: near.km < 120 || !city ? near.city : city, country: cc.toUpperCase(), source: 'ip' };
      }
      return { city: city || citiesIn(cc.toUpperCase())[0] || '', country: cc.toUpperCase(), source: 'ip' };
    } catch {
      /* blocked or offline: try the next */
    }
  }
  return null;
}

/** Precise location from the device. Asks the player's permission; null when refused or unavailable. */
export function fromGps(): Promise<Located | null> {
  return new Promise((done) => {
    if (!('geolocation' in navigator)) return done(null);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const near = nearestPlace(pos.coords.latitude, pos.coords.longitude);
          done({ city: near.city, country: near.country, source: 'gps' });
        },
        () => done(null),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 3600_000 },
      );
    } catch {
      done(null);
    }
  });
}

/** True when the player already allowed location for this page, so GPS can be used without asking. */
export async function gpsAllowed(): Promise<boolean> {
  try {
    const st = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    return st?.state === 'granted';
  } catch {
    return false;
  }
}

/** The best location reachable without asking: GPS if already allowed, else IP, else the time zone. */
export async function detectLocation(): Promise<Located | null> {
  if (await gpsAllowed()) {
    const g = await fromGps();
    if (g) return g;
  }
  return (await fromIp()) ?? fromTimeZone();
}

/** The profile fields a location fills. */
interface Placed {
  city?: string;
  country?: string;
  region: string;
  locSource?: Located['source'] | 'manual';
}

export function applyLocation(p: Placed, loc: { city: string; country: string; source: Placed['locSource'] }) {
  p.city = loc.city;
  p.country = loc.country;
  p.region = regionOfCountry(loc.country);
  p.locSource = loc.source;
}

/**
 * Find the player once per launch, quietly. A place they picked themselves
 * sticks; a time-zone guess never replaces a better one already found.
 * Resolves true when the profile changed.
 */
export async function refreshLocation(p: Placed): Promise<boolean> {
  if (p.locSource === 'manual') return false;
  // A first guess straight away from the time zone, while the network lookup runs.
  let changed = false;
  if (!p.locSource) {
    const tz = fromTimeZone();
    if (tz) applyLocation(p, tz), (changed = true);
  }
  const loc = await detectLocation();
  if (!loc) return changed;
  if (loc.source === 'tz' && p.locSource && p.locSource !== 'tz') return changed;
  if (p.locSource === 'gps' && loc.source !== 'gps') return changed;
  if (loc.city === p.city && loc.country === p.country && loc.source === p.locSource) return changed;
  applyLocation(p, loc);
  return true;
}
