// A faster shanten for the AI's inner loops. Same algorithm and results as
// engine/hand.ts `shanten` (tested against it), but memoised on numeric
// keys so evaluating every discard and draw stays cheap.

import type { ShapeRules } from '../engine/hand';
import { sevenPairsShanten, thirteenOrphansShanten } from '../engine/hand';

type GroupOpt = [sets: number, partials: number, pair: number];
// Honours, suits, and suits read without chows (goulash rounds): keys only agree within one table.
const memo = [new Map<number, GroupOpt[]>(), new Map<number, GroupOpt[]>(), new Map<number, GroupOpt[]>()];

function options(counts: number[], from: number, n: number, suited: boolean): GroupOpt[] {
  let key = 0;
  for (let i = 0; i < n; i++) key = key * 5 + counts[from + i];
  const m = memo[suited ? 1 : n === 9 ? 2 : 0];
  const hit = m.get(key);
  if (hit) return hit;
  const c = counts.slice(from, from + n);
  const found = new Set<number>();
  const walk = (i: number, sets: number, partials: number, pair: number) => {
    while (i < n && c[i] === 0) i++;
    if (i === n) {
      found.add(sets * 100 + Math.min(partials, 8) * 10 + pair);
      return;
    }
    if (c[i] >= 3) {
      c[i] -= 3;
      walk(i, sets + 1, partials, pair);
      c[i] += 3;
    }
    if (suited && i <= n - 3 && c[i + 1] && c[i + 2]) {
      c[i]--, c[i + 1]--, c[i + 2]--;
      walk(i, sets + 1, partials, pair);
      c[i]++, c[i + 1]++, c[i + 2]++;
    }
    if (c[i] >= 2) {
      c[i] -= 2;
      if (!pair) walk(i, sets, partials, 1);
      walk(i, sets, partials + 1, pair);
      c[i] += 2;
    }
    if (suited && i <= n - 2 && c[i + 1]) {
      c[i]--, c[i + 1]--;
      walk(i, sets, partials + 1, pair);
      c[i]++, c[i + 1]++;
    }
    if (suited && i <= n - 3 && c[i + 2]) {
      c[i]--, c[i + 2]--;
      walk(i, sets, partials + 1, pair);
      c[i]++, c[i + 2]++;
    }
    const keep = c[i];
    c[i] = 0;
    walk(i + 1, sets, partials, pair);
    c[i] = keep;
  };
  walk(0, 0, 0, 0);
  const all = [...found].map((v) => [Math.floor(v / 100), Math.floor(v / 10) % 10, v % 10] as GroupOpt);
  const opts = all.filter((a) => !all.some((b) => b !== a && b[2] === a[2] && b[0] >= a[0] && b[0] + b[1] >= a[0] + a[1] && (b[0] > a[0] || b[0] + b[1] > a[0] + a[1])));
  if (m.size > 200_000) m.clear();
  m.set(key, opts);
  return opts;
}

export function fastStandardShanten(counts: number[], meldCount: number, need = 4, chows = true): number {
  const g0 = options(counts, 0, 9, chows);
  const g1 = options(counts, 9, 9, chows);
  const g2 = options(counts, 18, 9, chows);
  const g3 = options(counts, 27, 7, false);
  let best = 2 * need;
  for (const a of g0)
    for (const b of g1) {
      if (a[2] && b[2]) continue;
      for (const c of g2) {
        if ((a[2] || b[2]) && c[2]) continue;
        for (const d of g3) {
          const pairs = a[2] + b[2] + c[2] + d[2];
          if (pairs > 1) continue;
          const sets = meldCount + a[0] + b[0] + c[0] + d[0];
          const partials = a[1] + b[1] + c[1] + d[1];
          const usable = Math.min(partials, need - sets);
          const s = 2 * need - 2 * sets - Math.max(0, usable) - pairs;
          if (s < best) best = s;
        }
      }
    }
  return best;
}

export function fastShanten(counts: number[], meldCount: number, rules: ShapeRules): number {
  let s = rules.standard === false ? 99 : fastStandardShanten(counts, meldCount, rules.sets ?? 4, rules.chows !== false);
  if (meldCount === 0) {
    if (rules.sevenPairs) s = Math.min(s, sevenPairsShanten(counts));
    if (rules.thirteenOrphans) s = Math.min(s, thirteenOrphansShanten(counts));
  }
  for (const sp of rules.special ?? []) if (sp.ai && (!sp.bound || sp.bound(counts, meldCount) < s)) s = Math.min(s, sp.shanten(counts, meldCount));
  return s;
}
