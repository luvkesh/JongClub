// Spaced repetition for the daily drills: Leitner boxes. A drill you miss
// goes into box 1 and comes back the next day; answer it right when it
// returns and it moves to box 2 (back in 3 days), then box 3 (back in 7
// days), and after that it is learned and leaves the schedule. A miss at any
// point starts it over at box 1.
//
// Per-skill accuracy (recent answers) picks which kinds of drill a new set
// leans on, so a set spends its time on your weak spots.

import { seedOf, dayNumber, isoDay } from '../club/util';
import { accountKey, readJson, writeJson } from '../progression/accountKey';
import { DRILL_TYPES, drillId, type DrillType } from './drillGen';

/** Days until a drill in box 1, 2 and 3 comes back. */
export const INTERVALS = [1, 3, 7];
export const SET_SIZE = 8;
/** Jong Points per right answer in the day's first set, and for finishing it. Small, and earned. */
export const POINTS_PER_RIGHT = 5;
export const POINTS_FOR_SET = 10;

export interface ScheduledDrill {
  type: DrillType;
  seed: number;
  variation: string;
  /** 1..3 */
  box: number;
  /** 'YYYY-MM-DD' it is due back. */
  due: string;
}

export interface SkillRecord {
  right: number;
  total: number;
  /** Last answers, oldest first: 1 right, 0 wrong. */
  recent: number[];
}

export interface DayRecord {
  /** Daily sets finished (the first one pays). */
  sets: number;
  /** Practice sets of one kind, or after the daily set. */
  practice?: number;
  right: number;
  total: number;
  points: number;
}

export interface DrillState {
  items: Record<string, ScheduledDrill>;
  skills: Partial<Record<DrillType, SkillRecord>>;
  days: Record<string, DayRecord>;
}

export const emptyState = (): DrillState => ({ items: {}, skills: {}, days: {} });

const KEY = 'jongclub.drills.v1';
const RECENT = 20;

export function loadDrills(): DrillState {
  const s = readJson<Partial<DrillState>>(accountKey(KEY));
  const base = emptyState();
  if (!s || typeof s !== 'object') return base;
  const obj = (x: unknown) => !!x && typeof x === 'object' && !Array.isArray(x);
  return { items: obj(s.items) ? s.items! : base.items, skills: obj(s.skills) ? s.skills! : base.skills, days: obj(s.days) ? s.days! : base.days };
}

export function saveDrills(s: DrillState) {
  writeJson(accountKey(KEY), s);
}

export function addDays(day: string, n: number): string {
  return new Date((dayNumber(day) + n) * 86_400_000).toISOString().slice(0, 10);
}

export const today = () => isoDay(new Date());

/** Record one answer: per-skill accuracy, and the drill's place in the schedule. */
export function recordAnswer(s: DrillState, d: { type: DrillType; seed: number; variation: string }, right: boolean, day: string) {
  const sk = (s.skills[d.type] ??= { right: 0, total: 0, recent: [] });
  sk.total++;
  if (right) sk.right++;
  sk.recent = [...sk.recent, right ? 1 : 0].slice(-RECENT);
  const id = drillId(d.type, d.variation, d.seed);
  const item = s.items[id];
  if (!right) {
    s.items[id] = { type: d.type, seed: d.seed, variation: d.variation, box: 1, due: addDays(day, INTERVALS[0]) };
  } else if (item && item.due <= day) {
    // Right when it came back: further apart, then learned.
    if (item.box >= INTERVALS.length) delete s.items[id];
    else s.items[id] = { ...item, box: item.box + 1, due: addDays(day, INTERVALS[item.box]) };
  }
}

/** Drills due back on `day`, oldest first. */
export function dueItems(s: DrillState, day: string): ScheduledDrill[] {
  return Object.values(s.items)
    .filter((x) => x.due <= day)
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.box - b.box));
}

/** Recent accuracy for a kind of drill, or null if never tried. */
export function accuracy(s: DrillState, type: DrillType): number | null {
  const r = s.skills[type]?.recent;
  return r?.length ? r.reduce((a, b) => a + b, 0) / r.length : null;
}

/** How much a set should lean on a kind of drill: untried and weak kinds most. */
export function weight(s: DrillState, type: DrillType): number {
  const acc = accuracy(s, type);
  return acc === null ? 1 : 0.25 + (1 - acc) * 1.5;
}

export interface PlannedDrill {
  type: DrillType;
  seed: number;
  variation: string;
  /** It came back from the schedule. */
  review: boolean;
}

/**
 * The drills for one set: those due back first (up to half the set), then new
 * ones picked by weakness, never more than three of a kind. `focus` makes a
 * practice set of one kind; `salt` gives a different set on the same day.
 */
export function planSet(s: DrillState, day: string, opts: { size?: number; focus?: DrillType; salt?: number; variation?: string } = {}): PlannedDrill[] {
  const size = opts.size ?? SET_SIZE;
  const variation = opts.variation ?? 'classic';
  const due = dueItems(s, day).filter((x) => !opts.focus || x.type === opts.focus);
  const out: PlannedDrill[] = due.slice(0, Math.ceil(size / 2)).map((x) => ({ type: x.type, seed: x.seed, variation: x.variation, review: true }));
  const count = (t: DrillType) => out.filter((x) => x.type === t).length;
  for (let i = 0; out.length < size && i < 200; i++) {
    const r = seedOf('drills', day, opts.salt ?? 0, opts.focus ?? '', i);
    let type: DrillType;
    if (opts.focus) type = opts.focus;
    else {
      const open = DRILL_TYPES.filter((t) => count(t) < 3);
      const ws = open.map((t) => weight(s, t));
      let x = (r / 0x80000000) * ws.reduce((a, b) => a + b, 0);
      type = open[open.length - 1];
      for (let j = 0; j < open.length; j++) {
        x -= ws[j];
        if (x < 0) {
          type = open[j];
          break;
        }
      }
    }
    const seed = seedOf('drill', day, opts.salt ?? 0, type, i);
    out.push({ type, seed, variation: type === 'value' || type === 'discard' ? variation : type === 'safe' ? 'riichi' : 'classic', review: false });
  }
  // Mix reviews in among the new ones, but keep the order stable for the day.
  return out
    .map((x, i) => ({ x, k: seedOf('order', day, opts.salt ?? 0, i) }))
    .sort((a, b) => a.k - b.k)
    .map((o) => o.x);
}

/**
 * Finish a set: points (the day's first daily set only) and the day's record.
 * Practice sets count their answers but neither pay nor keep the streak.
 * Returns the points earned.
 */
export function finishSet(s: DrillState, day: string, right: number, total: number, practice = false): number {
  const d = (s.days[day] ??= { sets: 0, right: 0, total: 0, points: 0 });
  const first = d.sets === 0 && !practice;
  if (practice) d.practice = (d.practice ?? 0) + 1;
  else d.sets++;
  d.right += right;
  d.total += total;
  const pts = first ? right * POINTS_PER_RIGHT + POINTS_FOR_SET : 0;
  d.points += pts;
  // Keep about two months of days.
  const keys = Object.keys(s.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 60))) delete s.days[k];
  return pts;
}

/** Days in a row with a finished set, up to today (a streak still counts until today's set is due). */
export function drillStreak(s: DrillState, day: string): number {
  let n = 0;
  let d = s.days[day]?.sets ? day : addDays(day, -1);
  while (s.days[d]?.sets) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}
