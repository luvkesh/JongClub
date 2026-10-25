// The club's AI members: a curated list of names and home cities, with
// everything else (ratings, style, avatar, bio) generated from a fixed seed
// so every player sees the same club. All members are fictional.

import type { Difficulty, Personality } from '../ai/players';
import { HAIR_COLORS, type AvatarSpec } from '../cosmetics/catalog';
import { VARIATIONS } from '../engine/rules';
import { Rng } from '../engine/rng';
import { clamp, unit } from './util';

export type Region = 'East Asia' | 'Southeast Asia' | 'Middle East' | 'Europe' | 'Americas' | 'South Asia' | 'Oceania';
export const REGIONS: Region[] = ['East Asia', 'Southeast Asia', 'South Asia', 'Middle East', 'Europe', 'Americas', 'Oceania'];

export type VariationId = 'classic' | 'riichi' | 'taiwanese' | 'american' | 'uae' | 'vietnamese' | 'indian' | 'singapore' | 'hongkong' | 'mcr' | 'sichuan' | 'malaysian' | 'india'
  // The Expansion tables.
  | 'guangdong' | 'riichi-tournament' | 'ema' | 'korean' | 'zung-jung' | 'european' | 'beijing' | 'northeast' | 'wuhan' | 'shanghai' | 'fujian' | 'thai' | 'indonesian' | 'filipino' | 'wright-patterson';
/** The first five, in their original order: members' favourites and ratings are drawn from these first so the roster stays stable. */
const CORE_IDS: VariationId[] = ['classic', 'riichi', 'taiwanese', 'american', 'uae'];
const LATER_IDS: VariationId[] = ['vietnamese', 'indian', 'singapore'];
/** Added with the catalogue. UAE's other rulesets are rated under 'uae'. */
const NEWER_IDS: VariationId[] = ['hongkong', 'mcr', 'sichuan', 'malaysian'];
export const VARIATION_IDS: VariationId[] = [...CORE_IDS, ...LATER_IDS, ...NEWER_IDS];

export interface ClubMember {
  id: string;
  name: string;
  region: Region;
  city: string;
  /** Standard UTC offset of the home city in hours (no daylight saving). */
  utcOffset: number;
  favoriteVariation: VariationId;
  personality: Personality;
  /** Follows the overall rating: beginner < 1200 <= casual < 1500 <= strategic < 1850 <= expert. */
  difficulty: Difficulty;
  /** Overall rating, about 900..2300. */
  rating: number;
  ratings: Record<VariationId, number>;
  avatar: AvatarSpec;
  bio: string;
  /** How often they drop by the club: 0.6 (rarely) .. 1.4 (most evenings). */
  activity: number;
}

interface City {
  region: Region;
  utc: number;
  /** Variations popular in that city, most popular first. */
  lean: VariationId[];
  /** Outfits that suit the city, picked more often. */
  outfits: AvatarSpec['outfit'][];
}

const CITIES: Record<string, City> = {
  Tokyo: { region: 'East Asia', utc: 9, lean: ['riichi', 'classic'], outfits: ['kimono', 'suit', 'blazer'] },
  Osaka: { region: 'East Asia', utc: 9, lean: ['riichi'], outfits: ['kimono', 'sweater'] },
  Kyoto: { region: 'East Asia', utc: 9, lean: ['riichi', 'classic'], outfits: ['kimono'] },
  Seoul: { region: 'East Asia', utc: 9, lean: ['classic', 'riichi'], outfits: ['suit', 'blazer'] },
  Taipei: { region: 'East Asia', utc: 8, lean: ['taiwanese', 'classic'], outfits: ['qipao', 'blazer'] },
  Kaohsiung: { region: 'East Asia', utc: 8, lean: ['taiwanese'], outfits: ['qipao', 'sweater'] },
  'Hong Kong': { region: 'East Asia', utc: 8, lean: ['hongkong', 'classic', 'taiwanese'], outfits: ['qipao', 'suit'] },
  Macau: { region: 'East Asia', utc: 8, lean: ['hongkong', 'classic'], outfits: ['qipao', 'suit'] },
  Shanghai: { region: 'East Asia', utc: 8, lean: ['classic', 'sichuan', 'mcr'], outfits: ['qipao', 'suit', 'blazer'] },
  Beijing: { region: 'East Asia', utc: 8, lean: ['mcr', 'classic'], outfits: ['qipao', 'blazer'] },
  Guangzhou: { region: 'East Asia', utc: 8, lean: ['classic', 'hongkong'], outfits: ['qipao', 'sweater'] },
  Singapore: { region: 'Southeast Asia', utc: 8, lean: ['classic', 'riichi', 'singapore'], outfits: ['blazer', 'qipao'] },
  'Kuala Lumpur': { region: 'Southeast Asia', utc: 8, lean: ['malaysian', 'classic', 'singapore'], outfits: ['blazer', 'suit'] },
  Bangkok: { region: 'Southeast Asia', utc: 7, lean: ['classic'], outfits: ['blazer', 'sweater'] },
  Manila: { region: 'Southeast Asia', utc: 8, lean: ['classic', 'american'], outfits: ['blazer', 'sweater'] },
  Jakarta: { region: 'Southeast Asia', utc: 7, lean: ['classic'], outfits: ['blazer', 'suit'] },
  'Ho Chi Minh City': { region: 'Southeast Asia', utc: 7, lean: ['classic', 'vietnamese'], outfits: ['blazer', 'sweater'] },
  Dubai: { region: 'Middle East', utc: 4, lean: ['uae', 'classic'], outfits: ['kandura', 'suit', 'blazer'] },
  'Abu Dhabi': { region: 'Middle East', utc: 4, lean: ['uae'], outfits: ['kandura', 'suit'] },
  Doha: { region: 'Middle East', utc: 3, lean: ['uae', 'classic'], outfits: ['kandura', 'blazer'] },
  Muscat: { region: 'Middle East', utc: 4, lean: ['uae'], outfits: ['kandura', 'sweater'] },
  Beirut: { region: 'Middle East', utc: 2, lean: ['classic', 'uae'], outfits: ['suit', 'blazer'] },
  Riyadh: { region: 'Middle East', utc: 3, lean: ['uae'], outfits: ['kandura', 'blazer'] },
  Mumbai: { region: 'South Asia', utc: 5.5, lean: ['classic', 'uae', 'indian'], outfits: ['blazer', 'suit'] },
  Bengaluru: { region: 'South Asia', utc: 5.5, lean: ['classic', 'riichi'], outfits: ['sweater', 'blazer'] },
  Delhi: { region: 'South Asia', utc: 5.5, lean: ['classic', 'indian'], outfits: ['suit', 'blazer'] },
  Colombo: { region: 'South Asia', utc: 5.5, lean: ['classic'], outfits: ['blazer', 'sweater'] },
  Karachi: { region: 'South Asia', utc: 5, lean: ['classic', 'uae'], outfits: ['suit', 'blazer'] },
  Dhaka: { region: 'South Asia', utc: 6, lean: ['classic'], outfits: ['blazer', 'sweater'] },
  London: { region: 'Europe', utc: 0, lean: ['classic', 'riichi'], outfits: ['suit', 'blazer'] },
  Paris: { region: 'Europe', utc: 1, lean: ['classic', 'riichi', 'mcr'], outfits: ['blazer', 'suit'] },
  Berlin: { region: 'Europe', utc: 1, lean: ['riichi', 'classic', 'mcr'], outfits: ['sweater', 'blazer'] },
  Amsterdam: { region: 'Europe', utc: 1, lean: ['classic'], outfits: ['sweater', 'blazer'] },
  Milan: { region: 'Europe', utc: 1, lean: ['classic'], outfits: ['suit', 'blazer'] },
  Madrid: { region: 'Europe', utc: 1, lean: ['classic'], outfits: ['blazer', 'suit'] },
  Stockholm: { region: 'Europe', utc: 1, lean: ['riichi'], outfits: ['sweater'] },
  Lisbon: { region: 'Europe', utc: 0, lean: ['classic'], outfits: ['sweater', 'blazer'] },
  Istanbul: { region: 'Europe', utc: 3, lean: ['classic', 'uae'], outfits: ['suit', 'blazer'] },
  Zurich: { region: 'Europe', utc: 1, lean: ['riichi', 'classic'], outfits: ['suit'] },
  'New York': { region: 'Americas', utc: -5, lean: ['american', 'classic'], outfits: ['suit', 'blazer'] },
  'Boca Raton': { region: 'Americas', utc: -5, lean: ['american'], outfits: ['sweater', 'blazer'] },
  'San Francisco': { region: 'Americas', utc: -8, lean: ['classic', 'riichi', 'american'], outfits: ['sweater', 'blazer'] },
  Vancouver: { region: 'Americas', utc: -8, lean: ['classic', 'hongkong', 'taiwanese'], outfits: ['sweater'] },
  Toronto: { region: 'Americas', utc: -5, lean: ['classic', 'american'], outfits: ['blazer', 'sweater'] },
  Chicago: { region: 'Americas', utc: -6, lean: ['american'], outfits: ['suit', 'sweater'] },
  'São Paulo': { region: 'Americas', utc: -3, lean: ['riichi', 'classic'], outfits: ['blazer', 'suit'] },
  'Mexico City': { region: 'Americas', utc: -6, lean: ['classic', 'american'], outfits: ['blazer'] },
  Sydney: { region: 'Oceania', utc: 10, lean: ['classic', 'riichi'], outfits: ['blazer', 'sweater'] },
  Melbourne: { region: 'Oceania', utc: 10, lean: ['classic', 'taiwanese'], outfits: ['sweater', 'suit'] },
  Auckland: { region: 'Oceania', utc: 12, lean: ['classic'], outfits: ['sweater', 'blazer'] },
};

/** Curated fictional members: [name, city]. */
const MEMBERS: [string, string][] = [
  ['Haruki Tanabe', 'Tokyo'],
  ['Aiko Morimoto', 'Tokyo'],
  ['Ren Ishikawa', 'Osaka'],
  ['Yuna Kurosawa', 'Kyoto'],
  ['Chen Wei-Lun', 'Taipei'],
  ['Lin Yu-Ting', 'Taipei'],
  ['Hsu Ming-Hao', 'Kaohsiung'],
  ['Grace Leung', 'Hong Kong'],
  ['Kelvin Tsang', 'Hong Kong'],
  ['Wong Ka-Yan', 'Hong Kong'],
  ['Zhou Lanying', 'Shanghai'],
  ['Li Jiahao', 'Shanghai'],
  ['Song Meixin', 'Beijing'],
  ['Park Ji-woo', 'Seoul'],
  ['Kang Min-seo', 'Seoul'],
  ['Ivy Lo', 'Macau'],
  ['Huang Zihan', 'Guangzhou'],
  ['Rachel Tan', 'Singapore'],
  ['Darren Goh', 'Singapore'],
  ['Nur Aisyah Rahman', 'Kuala Lumpur'],
  ['Benjamin Ong', 'Kuala Lumpur'],
  ['Ploy Srisuk', 'Bangkok'],
  ['Miguel Santos', 'Manila'],
  ['Andrea Villanueva', 'Manila'],
  ['Putri Wijaya', 'Jakarta'],
  ['Nguyen Thao Linh', 'Ho Chi Minh City'],
  ['Omar Al Mansouri', 'Dubai'],
  ['Layla Haddad', 'Dubai'],
  ['Rashid Al Nuaimi', 'Abu Dhabi'],
  ['Fatima Al Suwaidi', 'Abu Dhabi'],
  ['Yousef Karam', 'Doha'],
  ['Noor Al Harthy', 'Muscat'],
  ['Karim Nassar', 'Beirut'],
  ['Sara Al Qahtani', 'Riyadh'],
  ['Priya Raman', 'Mumbai'],
  ['Arjun Mehta', 'Mumbai'],
  ['Kavya Iyer', 'Bengaluru'],
  ['Rohan Kapoor', 'Delhi'],
  ['Anjali Perera', 'Colombo'],
  ['Zara Qureshi', 'Karachi'],
  ['Tanvir Hossain', 'Dhaka'],
  ['Eleanor Whitcombe', 'London'],
  ['James Okafor', 'London'],
  ['Camille Durand', 'Paris'],
  ['Lukas Brenner', 'Berlin'],
  ['Sofie van Dijk', 'Amsterdam'],
  ['Giulia Ferraro', 'Milan'],
  ['Mateo Ruiz', 'Madrid'],
  ['Annika Lindqvist', 'Stockholm'],
  ['Inês Carvalho', 'Lisbon'],
  ['Elif Demir', 'Istanbul'],
  ['Felix Ammann', 'Zurich'],
  ['Ruth Goldberg', 'New York'],
  ['Marcus Bell', 'New York'],
  ['Diane Feldman', 'Boca Raton'],
  ['Sophie Chen-Martin', 'San Francisco'],
  ['Daniel Kwan', 'Vancouver'],
  ['Theo Lambert', 'Toronto'],
  ['Bernadette Kaplan', 'Chicago'],
  ['Isabela Moreira', 'São Paulo'],
  ['Valeria Ortega', 'Mexico City'],
  ['Olivia Hartley', 'Sydney'],
  ['Jack Nguyen', 'Melbourne'],
  ['Mere Te Rangi', 'Auckland'],
];

const ROSTER_SEED = 0x4a6f6e67; // "Jong"

const PERSONALITY_LIST: Personality[] = ['teacher', 'shark', 'wall', 'gambler', 'zen'];

export function difficultyForRating(rating: number): Difficulty {
  if (rating < 1200) return 'beginner';
  if (rating < 1500) return 'casual';
  if (rating < 1850) return 'strategic';
  return 'expert';
}

const variationShort = (id: VariationId) => VARIATIONS.find((v) => v.id === id)?.short ?? id;

const BIOS: Record<Personality, string[]> = {
  teacher: [
    'Hosts a Sunday beginners’ table in {city} and loves a well-explained discard.',
    'Has taught {fav} to half of {city}. Always happy to talk you through a hand.',
    'Keeps a notebook of memorable hands and shares them over tea.',
  ],
  shark: [
    'Calls early, plays fast and rarely leaves a {fav} table without the lead.',
    'The {city} regular everyone checks the seating chart for.',
    'Believes the best defence is a quick win.',
  ],
  wall: [
    'Patient and careful. Dealing into this {city} player is famously rare.',
    'Reads the discards like a newspaper. A quiet presence at the {fav} tables.',
    'Folds without fuss and waits for the right hand.',
  ],
  gambler: [
    'Chases full flushes and grand hands. Unforgettable when it works.',
    'Plays {fav} for the beautiful hands, not the safe ones.',
    'Collects limit hands the way others collect tile sets.',
  ],
  zen: [
    'Calm at every table. Plays {fav} in {city} with a cup of green tea.',
    'Unhurried, polite and quietly consistent.',
    'Says the click of the tiles is the best part of the evening.',
  ],
};

const OUTFIT_COLORS = ['#1f3b33', '#141414', '#7a1f1b', '#1a2440', '#5a4321', '#2a1530', '#f5f3ee', '#8a6a4a', '#0f4a46', '#3b2416', '#1d3f8a', '#c9a24a'];
const HAIRS: AvatarSpec['hair'][] = ['short', 'long', 'bun', 'bob', 'shaved', 'wavy'];
const ACCESSORIES: AvatarSpec['accessory'][] = ['none', 'none', 'glasses', 'earrings', 'hat', 'fan', 'pearls'];
const SKIN_BY_REGION: Record<Region, number[]> = {
  'East Asia': [0, 1, 1, 2],
  'Southeast Asia': [1, 2, 2, 3],
  'South Asia': [2, 3, 3, 4],
  'Middle East': [1, 2, 2, 3],
  Europe: [0, 0, 1, 2, 4],
  Americas: [0, 1, 2, 3, 4, 5],
  Oceania: [0, 1, 2, 3, 4],
};

const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[rng.int(arr.length)];
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Each member gets a distinct strength quantile, so ratings spread evenly over 900..2300. */
const QUANTILES: number[] = new Rng(ROSTER_SEED).shuffle(MEMBERS.map((_, i) => i / (MEMBERS.length - 1)));

function buildMember(name: string, cityName: string, index: number): ClubMember {
  const city = CITIES[cityName];
  const rng = new Rng(ROSTER_SEED + index * 7919);
  const rating = Math.round(clamp(900 + 1400 * QUANTILES[index] + (rng.next() - 0.5) * 40, 900, 2300));
  const fav = rng.next() < 0.7 ? city.lean[0] : rng.next() < 0.6 ? pick(rng, city.lean) : pick(rng, CORE_IDS);
  const ratings = {} as Record<VariationId, number>;
  for (const v of CORE_IDS) {
    const offset = v === fav ? 60 + rng.int(90) : city.lean.includes(v) ? -rng.int(120) : -60 - rng.int(220);
    ratings[v] = Math.round(clamp(rating + offset, 800, 2400));
  }
  // Later variations draw from their own stream, so adding them changed nobody else.
  const later = new Rng(ROSTER_SEED + index * 7919 + 1);
  for (const v of LATER_IDS) {
    const offset = v === fav ? 60 + later.int(90) : city.lean.includes(v) ? 20 - later.int(120) : -60 - later.int(220);
    ratings[v] = Math.round(clamp(rating + offset, 800, 2400));
  }
  const newer = new Rng(ROSTER_SEED + index * 7919 + 2);
  for (const v of NEWER_IDS) {
    const offset = v === fav ? 60 + newer.int(90) : city.lean.includes(v) ? 20 - newer.int(120) : -60 - newer.int(220);
    ratings[v] = Math.round(clamp(rating + offset, 800, 2400));
  }
  const personality = pick(rng, PERSONALITY_LIST);
  const outfit = rng.next() < 0.7 ? pick(rng, city.outfits) : pick(rng, ['qipao', 'suit', 'kimono', 'blazer', 'sweater'] as const);
  const avatar: AvatarSpec = {
    skin: pick(rng, SKIN_BY_REGION[city.region]),
    hair: pick(rng, HAIRS),
    hairColor: rng.next() < 0.15 ? HAIR_COLORS[5] : HAIR_COLORS[rng.int(5)],
    outfit,
    outfitColor: outfit === 'kandura' ? '#f5f3ee' : pick(rng, OUTFIT_COLORS),
    accessory: pick(rng, ACCESSORIES),
    frame: rating >= 2100 ? 'frame-master' : rating >= 1800 ? pick(rng, ['frame-jade', 'frame-lacquer']) : rng.next() < 0.5 ? 'frame-brass' : 'none',
  };
  const bio = pick(rng, BIOS[personality]).replace('{city}', cityName).replace('{fav}', variationShort(fav));
  return {
    id: slug(name),
    name,
    region: city.region,
    city: cityName,
    utcOffset: city.utc,
    favoriteVariation: fav,
    personality,
    difficulty: difficultyForRating(rating),
    rating,
    ratings,
    avatar,
    bio,
    activity: Math.round((0.6 + rng.next() * 0.8) * 100) / 100,
  };
}

export const ROSTER: ClubMember[] = MEMBERS.map(([name, city], i) => buildMember(name, city, i));

const BY_ID = new Map(ROSTER.map((m) => [m.id, m]));
export const memberById = (id: string): ClubMember | undefined => BY_ID.get(id);

/** Online-ness is decided per 15-minute bucket, so it changes gently over the day. */
export const ONLINE_BUCKET_MS = 15 * 60 * 1000;

/** Likelihood of being at the club at a local hour: quiet at night, busy in the evening. */
function hourlyPresence(localHour: number): number {
  if (localHour < 1) return 0.35;
  if (localHour < 7) return 0.04;
  if (localHour < 12) return 0.14;
  if (localHour < 18) return 0.22;
  return 0.5;
}

export function isOnline(member: ClubMember, date: Date = new Date()): boolean {
  const bucket = Math.floor(date.getTime() / ONLINE_BUCKET_MS);
  const localHour = (((date.getUTCHours() + date.getUTCMinutes() / 60 + member.utcOffset) % 24) + 24) % 24;
  return unit(member.id, bucket) < hourlyPresence(localHour) * member.activity;
}

/** Members at the club right now (deterministic for a 15-minute window). */
export function onlineNow(date: Date = new Date()): ClubMember[] {
  return ROSTER.filter((m) => isOnline(m, date));
}

export interface LeaderboardRow {
  rank: number;
  member: ClubMember;
  rating: number;
}

/** Ranked list by overall rating or one variation's rating, optionally within a region. */
export function leaderboard(scope: 'overall' | VariationId | string, region?: Region | string): LeaderboardRow[] {
  const rate = (m: ClubMember) => (scope === 'overall' ? m.rating : (m.ratings[scope as VariationId] ?? m.rating));
  return ROSTER.filter((m) => !region || m.region === region)
    .map((m) => ({ member: m, rating: rate(m) }))
    .sort((a, b) => b.rating - a.rating || a.member.id.localeCompare(b.member.id))
    .map((r, i) => ({ rank: i + 1, ...r }));
}
