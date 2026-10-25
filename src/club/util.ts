// Small deterministic helpers shared by the club modules.

/** 32-bit FNV-1a hash of a string, finished with a murmur-style mix. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return mix32(h);
}

/** Avalanche a 32-bit integer. */
export function mix32(x: number): number {
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

/** Combine several numbers or strings into one positive 31-bit seed. */
export function seedOf(...parts: (number | string)[]): number {
  return hashString(parts.join('|')) & 0x7fffffff;
}

/** Uniform [0,1) from a hash of the parts. */
export const unit = (...parts: (number | string)[]) => seedOf(...parts) / 0x80000000;

/** 'YYYY-MM-DD' for a Date (UTC) or an ISO string. */
export function isoDay(date: Date | string): string {
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    return new Date(date).toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

/** Midnight UTC of a 'YYYY-MM-DD' day as a Date. */
export const dayStart = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Days since the Unix epoch of a 'YYYY-MM-DD' day. */
export const dayNumber = (iso: string) => Math.round(dayStart(iso).getTime() / 86_400_000);

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
