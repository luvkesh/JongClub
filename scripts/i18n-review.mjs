#!/usr/bin/env node
// Native-speaker review of the UI string tables by a third-party AI (Google Gemini).
//
//   GEMINI_API_KEY=... node scripts/i18n-review.mjs [lang ...]
//
// Reads every row of src/i18n/strings/*.ts, sends each language column in
// batches with the English source and a mahjong glossary, and writes the
// model's suggestions to reviews/i18n/<lang>.json. Batches are cached in
// reviews/i18n/cache/, so a run that hits a rate limit can simply be resumed.
// Nothing in src/ is changed: scripts/i18n-apply.mjs applies the suggestions
// that a person (or Claude) has accepted.
//
// Env: GEMINI_MODEL (one model or a comma list to fall back through when one is busy; default: newest available "pro", else "flash"),
//      BATCH (rows per request, default 100), PAUSE_MS (between requests, default 4000).
import fs from 'node:fs';
import path from 'node:path';
import { loadRows, LANGS } from './i18n-rows.mjs';

const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!KEY) { console.error('GEMINI_API_KEY is not set.'); process.exit(2); }
const API = 'https://generativelanguage.googleapis.com/v1beta';
const BATCH = +(process.env.BATCH || 100);
const PAUSE = +(process.env.PAUSE_MS || 4000);
const OUT = path.resolve('reviews/i18n');
const CACHE = path.join(OUT, 'cache');
fs.mkdirSync(CACHE, { recursive: true });

const NATIVE = {
  'zh-Hans': 'Simplified Chinese as written in mainland China',
  'zh-Hant': 'Traditional Chinese as written in Taiwan and Hong Kong',
  ja: 'Japanese',
  ar: 'Modern Standard Arabic as used in Gulf (UAE) apps',
  hi: 'Hindi as used in modern Indian apps. The owner chose pure Hindi words (हाथ, अभ्यास, खेल): do NOT suggest English loanwords such as हैंड, प्रैक्टिस, गेम, डिस्कार्ड in their place; keep existing loanwords like टाइल and ऐप',
};

const GLOSSARY = `Mahjong context. JongClub is a premium online mahjong club and game, made for India first.
Terms (keep consistent): tile, wall, discard, draw, hand, set/meld, pung (three of a kind), kong (four), chow (run of three),
pair, eye, concealed/exposed, self-drawn win, East/South/West/North wind and seat, round, dealer, flowers, seasons, jokers,
dragons (Red, Green, White), bonus tiles, Small Card / Big Card (club house-rule cards), Jong Points (in-game currency, a brand
name), Mei (the teacher character, a name), JongBot (the AI helper, a name), India Rules, Riichi, faan/fan, yaku, crochet, knit.
Placeholders like {n}, {name}, {total}, {lesson} must be kept exactly. Brand names stay in Latin script: JongClub, Mei, JongBot.
Strings are short UI labels, buttons, tooltips and messages: keep them concise and natural for an app.`;

async function pickModel() {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  const r = await fetch(`${API}/models?key=${KEY}&pageSize=200`);
  if (!r.ok) throw new Error(`models: ${r.status} ${await r.text()}`);
  const names = (await r.json()).models
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace('models/', ''))
    .filter((n) => /^gemini-[\d.]+-(pro|flash)$/.test(n) || /^gemini-[\d.]+-(pro|flash)-latest$/.test(n));
  const ver = (n) => parseFloat(n.split('-')[1]);
  names.sort((a, b) => ver(b) - ver(a) || (a.includes('pro') ? -1 : 1));
  return process.env.PREFER_FLASH ? names.find((n) => n.includes('flash')) : names[0];
}

const SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      id: { type: 'INTEGER' },
      verdict: { type: 'STRING', enum: ['wrong', 'unnatural', 'inconsistent', 'typo'] },
      suggested: { type: 'STRING' },
      reason: { type: 'STRING', description: 'One short sentence in English.' },
    },
    required: ['id', 'verdict', 'suggested', 'reason'],
  },
};

let models = [];
let mi = 0;
async function review(lang, batch) {
  const prompt = `${GLOSSARY}

You are a native speaker of ${NATIVE[lang]} and an experienced mobile-game localiser who plays mahjong.
Review each translation below against its English source. Report ONLY rows that a native speaker would change:
mistranslations, meaning lost or added, unnatural or machine-sounding phrasing, wrong mahjong terminology,
inconsistent terms, grammar or typos. Do not report rows that are already natural, and do not rewrite for taste.
For each reported row give the full corrected string in "suggested" (keep every {placeholder}, emoji and symbol).
Plural rows are given as JSON objects of plural forms; suggest the whole object as a JSON string.
Return [] if every row is fine.

Rows (id, English, current ${lang}):
${batch.map((r) => JSON.stringify([r.id, r.en, r.cell])).join('\n')}`;
  for (let attempt = 0; attempt < 60; attempt++) {
    const model = models[mi % models.length];
    const r = await fetch(`${API}/models/${model}:generateContent?key=${KEY}`, {
      method: 'POST',
      signal: AbortSignal.timeout(240000),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: SCHEMA },
      }),
    });
    if (r.status === 429 || r.status >= 500) {
      // A busy model (503) hands over to the next one in GEMINI_MODEL; a rate limit (429) waits.
      // Each model has its own quota, so both a busy model (503) and a rate limit (429) hand over to the
      // next one in GEMINI_MODEL; after a full lap without luck, wait a minute.
      const body = await r.text();
      if (process.env.DEBUG) console.warn(body.slice(0, 1500));
      if (r.status === 429 && body.includes('PerDay')) {
        // The free tier allows a few requests per model per day: drop this model until tomorrow.
        models = models.filter((m) => m !== model);
        console.warn(`  daily quota used on ${model}; ${models.length} models left`);
        if (!models.length) { console.error('Every model has used its daily quota. Run again tomorrow: finished batches are cached.'); process.exit(3); }
        continue;
      }
      mi++;
      if (models.length > 1 && (attempt + 1) % models.length) { console.warn(`  ${r.status} on ${model}, trying ${models[mi % models.length]}`); continue; }
      const wait = 60000;
      console.warn(`  ${r.status} on ${model}, waiting ${wait / 1000}s`);
      await new Promise((ok) => setTimeout(ok, wait));
      continue;
    }
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    const j = await r.json();
    const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '[]';
    return { model, res: JSON.parse(text) };
  }
  throw new Error('gave up after repeated rate limits');
}

const rows = await loadRows();
const langs = process.argv.slice(2).length ? process.argv.slice(2) : LANGS;
models = (await pickModel()).split(',').map((m) => m.trim()).filter(Boolean);
console.log(`models ${models.join(', ')}, ${rows.length} rows`);
for (const lang of langs) {
  const col = LANGS.indexOf(lang) + 1;
  const items = rows
    .map((r) => ({ id: r.id, en: r.en, cell: r.cells[col] }))
    .filter((r) => r.cell && (typeof r.cell !== 'string' || r.cell.trim()))
    .map((r) => ({ ...r, cell: typeof r.cell === 'string' ? r.cell : JSON.stringify(r.cell) }));
  const found = [];
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const cacheFile = path.join(CACHE, `${lang}-${BATCH}-${i}.json`);
    let model, res;
    if (fs.existsSync(cacheFile)) ({ model, res } = JSON.parse(fs.readFileSync(cacheFile, 'utf8')));
    else {
      ({ model, res } = await review(lang, batch));
      fs.writeFileSync(cacheFile, JSON.stringify({ model, res }));
      await new Promise((ok) => setTimeout(ok, PAUSE));
    }
    const byId = new Map(batch.map((b) => [b.id, b]));
    for (const s of res) {
      const src = byId.get(s.id);
      if (!src || s.suggested === src.cell) continue;
      found.push({ id: s.id, file: rows[s.id].file, en: src.en, current: src.cell, ...s, model });
    }
    console.log(`${lang} ${Math.min(i + BATCH, items.length)}/${items.length}: ${found.length} suggestions`);
  }
  fs.writeFileSync(path.join(OUT, `${lang}.json`), JSON.stringify({ models, lang, reviewed: items.length, suggestions: found }, null, 1));
}
