// How the tiles a target hand keeps break into sets, a pair and partial sets, for
// JongBot's planner and the set-aside sort (routes without fixed pieces: a flush,
// all simples, all pungs). A shanten-style search that remembers its blocks.

export interface Blocks {
  pieces: number[][];
  gaps: number[];
  /** Missing tiles that are certain (the third of a pair-partial, the middle of a gap); runs open
   *  at both ends name one end only in their piece and are left out here. */
  need: number[];
}

type Block = { t: 'set' | 'pair' | 'part'; k: number[] };

/** Best blocks toward `sets` more sets and (optionally) a pair from these counts. */
export function decompose(counts: number[], sets: number, pair: boolean, chows: boolean): Blocks {
  const c = counts.slice(0, 34);
  let best: { v: number; bs: Block[] } = { v: -1, bs: [] };
  const cur: Block[] = [];
  const score = () => {
    let s = 0;
    let parts = 0;
    let head = false;
    for (const b of cur) {
      if (b.t === 'set') s++;
      else if (b.t === 'pair' && pair && !head) head = true;
      else parts++;
    }
    const used = Math.min(parts, Math.max(0, sets - s));
    return 2 * Math.min(s, sets) + used + (head ? 1 : 0);
  };
  const walk = (i: number) => {
    while (i < 34 && c[i] === 0) i++;
    if (i === 34) {
      const v = score();
      if (v > best.v) best = { v, bs: cur.slice() };
      return;
    }
    const suited = i < 27;
    const r = i % 9;
    if (c[i] >= 3) {
      c[i] -= 3;
      cur.push({ t: 'set', k: [i, i, i] });
      walk(i);
      cur.pop();
      c[i] += 3;
    }
    if (chows && suited && r <= 6 && c[i + 1] && c[i + 2]) {
      c[i]--, c[i + 1]--, c[i + 2]--;
      cur.push({ t: 'set', k: [i, i + 1, i + 2] });
      walk(i);
      cur.pop();
      c[i]++, c[i + 1]++, c[i + 2]++;
    }
    if (c[i] >= 2) {
      c[i] -= 2;
      cur.push({ t: 'pair', k: [i, i] });
      walk(i);
      cur.pop();
      c[i] += 2;
    }
    if (chows && suited && r <= 7 && c[i + 1]) {
      c[i]--, c[i + 1]--;
      cur.push({ t: 'part', k: [i, i + 1] });
      walk(i);
      cur.pop();
      c[i]++, c[i + 1]++;
    }
    if (chows && suited && r <= 6 && c[i + 2]) {
      c[i]--, c[i + 2]--;
      cur.push({ t: 'part', k: [i, i + 2] });
      walk(i);
      cur.pop();
      c[i]++, c[i + 2]++;
    }
    c[i]--;
    walk(i);
    c[i]++;
  };
  walk(0);
  // Sets first, then the pair, then partial sets; only as many partials as there are sets to make.
  const setsB = best.bs.filter((b) => b.t === 'set');
  const pairs = best.bs.filter((b) => b.t === 'pair');
  const partials = best.bs.filter((b) => b.t === 'part');
  const head = pair ? pairs.shift() : undefined;
  const room = Math.max(0, sets - setsB.length);
  const pieces: number[][] = [];
  const gaps: number[] = [];
  const need: number[] = [];
  for (const b of setsB.slice(0, sets)) pieces.push(b.k), gaps.push(0);
  if (head) pieces.push(head.k), gaps.push(0);
  for (const b of [...pairs, ...partials].slice(0, room)) {
    if (b.k[0] === b.k[1]) {
      pieces.push([b.k[0], b.k[0], b.k[0]]);
      need.push(b.k[0]);
    } else if (b.k[1] - b.k[0] === 2) {
      pieces.push([b.k[0], b.k[1], b.k[0] + 1]);
      need.push(b.k[0] + 1);
    } else {
      // An edge wait (1-2 or 8-9) has one end only; otherwise show the higher end.
      const r = b.k[0] % 9;
      pieces.push([b.k[0], b.k[1], r === 7 ? b.k[0] - 1 : b.k[1] + 1]);
      if (r === 0 || r === 7) need.push(r === 7 ? b.k[0] - 1 : b.k[1] + 1);
    }
    gaps.push(1);
  }
  return { pieces, gaps, need };
}
