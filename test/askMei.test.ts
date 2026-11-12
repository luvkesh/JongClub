// Ask Mei (src/ai/askMei): the knowledge packs built from the game's own rules
// and lessons, which packs a question brings in, how Mei's reply is read, the
// Gemini and server providers, and the server route that keeps the key.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { knowledgePacks, scorePack, selectPacks, tokens } from '../src/ai/askMei/knowledge';
import { MEI_BRIEF, composeSystem } from '../src/ai/askMei/persona';
import { AskMeiChat, blocks, parseReply, runs } from '../src/ai/askMei/chat';
import { AskMeiError, GEMINI_MODELS, geminiBody, geminiGenerate, looksLikeKey, proxyGenerate, readGemini, type ChatTurn } from '../src/ai/askMei/provider';
import { VARIATIONS } from '../src/engine/rules';
import { LESSONS } from '../src/ui/academy';
import { startServer, type RunningServer } from '../server/app.js';

const ids = (packs: { id: string }[]) => packs.map((p) => p.id);

describe('knowledge packs', () => {
  const packs = knowledgePacks();

  it('has the core, one pack per playable variation, and the Foundations lessons', () => {
    expect(packs.filter((p) => p.kind === 'core')).toHaveLength(1);
    for (const v of VARIATIONS) if (v.profile) expect(ids(packs), v.id).toContain(`variation:${v.id}`);
    for (const l of ['basics', 'scoring', 'rounds', 'shapes', 'strategy', 'words', 'efficiency', 'waits', 'defence', 'value']) expect(ids(packs)).toContain(`lesson:${l}`);
    for (const l of ['india-east', 'india-south', 'india-west', 'india-north']) expect(ids(packs)).toContain(`lesson:${l}`);
  });

  it('every pack has text, a word count and a real lesson to link', () => {
    for (const p of packs) {
      expect(p.words, p.id).toBeGreaterThan(20);
      expect(p.text.length, p.id).toBeGreaterThan(100);
      if (p.lesson) expect(LESSONS[p.lesson], `${p.id} links ${p.lesson}`).toBeDefined();
    }
    // The India rulebook notes reached the round packs.
    expect(packs.find((p) => p.id === 'lesson:india-south')!.text).toMatch(/Small Card/i);
    expect(packs.find((p) => p.id === 'lesson:india-west')!.text).toMatch(/goulash/i);
    expect(packs.find((p) => p.id === 'variation:riichi')!.text).toMatch(/furiten/i);
  });

  it('the core names every variation and the lesson ids Mei may link', () => {
    const core = packs.find((p) => p.kind === 'core')!;
    for (const v of VARIATIONS) if (v.profile) expect(core.text).toContain(v.name);
    expect(core.text).toContain('[[lesson:india-south]]');
    expect(core.text).toContain('[[lesson:basics]]');
    expect(core.text).toMatch(/India Rules is the club’s main game/);
  });

  it('tokenises words and drops possessives', () => {
    expect(tokens('East’s double, the 3-faan minimum!')).toEqual(['east', 'double', 'the', '3-faan', 'minimum']);
  });
});

describe('selecting packs for a question', () => {
  it('always starts with the core and keeps to the budget', () => {
    const sel = selectPacks('What is a passport?', { budget: 4000 });
    expect(sel[0].id).toBe('core');
    expect(sel.reduce((a, p) => a + p.words, 0)).toBeLessThanOrEqual(4000);
  });

  it('brings the East round for a passport question, Riichi for furiten, American for the Charleston', () => {
    expect(ids(selectPacks('How does a passport work in the East round?')).slice(1, 3)).toContain('lesson:india-east');
    expect(ids(selectPacks('What is furiten?'))[1]).toBe('variation:riichi');
    expect(ids(selectPacks('Explain the Charleston to me'))[1]).toBe('variation:american');
    expect(ids(selectPacks('How do animals score in Singapore?'))[1]).toBe('variation:singapore');
  });

  it('a question that names no game falls back to India Rules first', () => {
    const sel = selectPacks('xyzzy plugh');
    expect(ids(sel)).toContain('variation:india');
    expect(ids(sel).indexOf('variation:india')).toBeLessThan(ids(sel).indexOf('lesson:basics'));
  });

  it('the open lesson and the last table played count for something', () => {
    const sel = selectPacks('What should I discard first?', { lesson: 'efficiency' });
    expect(ids(sel)).toContain('lesson:efficiency');
    const hk = selectPacks('What is the minimum to win?', { variation: 'hongkong' });
    expect(ids(hk)).toContain('variation:hongkong');
  });

  it('earlier turns steer a follow-up question', () => {
    const riichi = knowledgePacks().find((p) => p.id === 'variation:riichi')!;
    const cold = scorePack(riichi, 'And how is it paid?');
    const warm = scorePack(riichi, 'And how is it paid?', ['What is riichi?', 'What does dora do?']);
    expect(warm).toBeGreaterThan(cold);
  });

  it('the system prompt carries the brief and the chosen notes', () => {
    const sys = composeSystem(selectPacks('What is a Small Card?'));
    expect(sys.startsWith(MEI_BRIEF)).toBe(true);
    expect(sys).toContain('### India Rules:');
    expect(sys).toMatch(/\[\[lesson:ID\]\]/);
  });
});

describe('reading a reply', () => {
  it('lifts one real lesson tag out and ignores the rest', () => {
    expect(parseReply('A passport is a fixed shape.\n[[lesson:india-east]]')).toEqual({ body: 'A passport is a fixed shape.', lesson: 'india-east' });
    expect(parseReply('Nope [[lesson:nothing-here]] [[ lesson: scoring ]] [[lesson:basics]]')).toEqual({ body: 'Nope', lesson: 'scoring' });
    expect(parseReply('Plain answer.').lesson).toBeNull();
  });

  it('turns bullets and bold into blocks', () => {
    expect(runs('Keep the **7 Bamboo** now')).toEqual([{ text: 'Keep the ' }, { text: '7 Bamboo', bold: true }, { text: ' now' }]);
    const b = blocks('Two things.\n- First **one**\n- Second\n\n## A heading\nThen a line\nand its continuation.');
    expect(b).toEqual([
      { kind: 'p', runs: [{ text: 'Two things.' }] },
      { kind: 'ul', items: [[{ text: 'First ' }, { text: 'one', bold: true }], [{ text: 'Second' }]] },
      { kind: 'p', runs: [{ text: 'A heading Then a line and its continuation.' }] },
    ]);
  });
});

describe('a conversation', () => {
  const memory = () => {
    let v: string | null = null;
    return { get: () => v, set: (x: string | null) => void (v = x) };
  };

  it('keeps the turns, sends the recent history and remembers the thread', async () => {
    const store = memory();
    const seen: { system: string; turns: ChatTurn[] }[] = [];
    const chat = new AskMeiChat(store, () => ({ kind: 'device-key', ask: async (system, turns) => (seen.push({ system, turns }), `Reply ${turns.length} [[lesson:basics]]`) }));
    const a = await chat.ask('What is a chow?', { lesson: 'basics' });
    expect(a.text).toBe('Reply 1 [[lesson:basics]]');
    expect(seen[0].turns).toEqual([{ role: 'user', text: 'What is a chow?' }]);
    expect(seen[0].system).toContain('### Lesson: Mahjong for beginners');
    await chat.ask('And a pung?');
    expect(seen[1].turns.map((t) => t.role)).toEqual(['user', 'mei', 'user']);
    const again = new AskMeiChat(store, () => null);
    expect(again.messages.map((m) => m.role)).toEqual(['user', 'mei', 'user', 'mei']);
  });

  it('keeps a failed answer as an error the player can retry, and leaves it out of the history', async () => {
    const chat = new AskMeiChat(memory(), () => ({ kind: 'device-key', ask: async () => { throw new AskMeiError('quota', 'busy'); } }));
    const m = await chat.ask('Hello?');
    expect(m.error).toBe('quota');
    expect(chat.lastFailed()).toBe('Hello?');
    expect(chat.turnsFor('Next').map((t) => t.text)).toEqual(['Next']);
    chat.dropFailed();
    expect(chat.messages).toEqual([]);
  });

  it('refuses to ask without a provider or while busy', async () => {
    const chat = new AskMeiChat(memory(), () => null);
    await expect(chat.ask('Anyone there?')).rejects.toMatchObject({ code: 'needs-key' });
    expect(chat.messages).toEqual([]);
  });
});

describe('the Gemini provider', () => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const reply = (text: string) => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] });

  it('shapes the request with the brief as the system instruction', () => {
    const b = geminiBody('brief', [{ role: 'user', text: 'q' }, { role: 'mei', text: 'a' }]);
    expect(b.systemInstruction.parts[0].text).toBe('brief');
    expect(b.contents.map((c) => c.role)).toEqual(['user', 'model']);
  });

  it('reads a reply and names each failure', () => {
    expect(readGemini(200, reply(' Hello '))).toBe('Hello');
    expect(() => readGemini(403, { error: { message: 'bad' } })).toThrow(expect.objectContaining({ code: 'bad-key' }));
    expect(() => readGemini(429, {})).toThrow(expect.objectContaining({ code: 'quota' }));
    expect(() => readGemini(200, { promptFeedback: { blockReason: 'SAFETY' } })).toThrow(expect.objectContaining({ code: 'blocked' }));
    expect(() => readGemini(200, { candidates: [{ finishReason: 'SAFETY' }] })).toThrow(expect.objectContaining({ code: 'blocked' }));
    expect(() => readGemini(200, { candidates: [] })).toThrow(expect.objectContaining({ code: 'empty' }));
  });

  it('sends the key in a header and hands over to the next model when one is busy', async () => {
    const calls: string[] = [];
    const f = async (url: string, init?: RequestInit) => {
      calls.push(url);
      expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('AIzaTEST');
      return calls.length === 1 ? json(503, { error: { message: 'busy' } }) : json(200, reply('Here I am.'));
    };
    expect(await geminiGenerate('AIzaTEST', 'brief', [{ role: 'user', text: 'q' }], { fetch: f })).toBe('Here I am.');
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain(`/models/${GEMINI_MODELS[0]}:generateContent`);
    expect(calls[1]).toContain(`/models/${GEMINI_MODELS[1]}:generateContent`);
  });

  it('a refused key stops at once; no network is a network error', async () => {
    await expect(geminiGenerate('k', 's', [{ role: 'user', text: 'q' }], { fetch: async () => json(400, { error: { message: 'API key not valid' } }) })).rejects.toMatchObject({ code: 'bad-key' });
    await expect(geminiGenerate('k', 's', [{ role: 'user', text: 'q' }], { fetch: async () => { throw new TypeError('fetch failed'); } })).rejects.toMatchObject({ code: 'network' });
  });

  it('the server proxy passes the brief and turns and reads the text back', async () => {
    let sent: unknown;
    const f = async (_url: string, init?: RequestInit) => ((sent = JSON.parse(String(init?.body))), json(200, { text: 'From the club.' }));
    expect(await proxyGenerate('http://club/api/ask-mei', 'brief', [{ role: 'user', text: 'q' }], { fetch: f })).toBe('From the club.');
    expect(sent).toEqual({ system: 'brief', turns: [{ role: 'user', text: 'q' }] });
    await expect(proxyGenerate('http://club/api/ask-mei', 'b', [{ role: 'user', text: 'q' }], { fetch: async () => json(501, { error: 'not_configured', message: 'no key' }) })).rejects.toMatchObject({ code: 'needs-key' });
  });

  it('knows what a Google key looks like', () => {
    expect(looksLikeKey('AIzaSyA-0123456789abcdefghijklmnopqrstu')).toBe(true);
    expect(looksLikeKey('sk-not-a-google-key')).toBe(false);
  });
});

describe('the server route', () => {
  let srv: RunningServer;
  let upstream: (url: string, init?: RequestInit) => Promise<Response>;
  const post = (body: unknown) => fetch(`${srv.url}/api/ask-mei`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  beforeAll(async () => {
    (globalThis as { window?: unknown }).window ??= globalThis;
    srv = await startServer({ port: 0, env: { JONGCLUB_STORE: 'memory', SESSION_SECRET: 'test', GEMINI_API_KEY: 'AIzaSERVER', GEMINI_MODEL: 'test-model,spare-model' }, fetch: (u: string, i?: RequestInit) => upstream(u, i) });
  });
  afterAll(async () => {
    await srv?.close();
  });

  it('answers with Gemini, keeping the key on the server', async () => {
    let seenKey = '';
    let seenUrl = '';
    upstream = async (url, init) => {
      seenUrl = url;
      seenKey = (init?.headers as Record<string, string>)['x-goog-api-key'];
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Pung is three of a kind.' }] } }] }), { status: 200 });
    };
    const r = await post({ system: 'brief', turns: [{ role: 'user', text: 'What is a pung?' }] });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ text: 'Pung is three of a kind.', model: 'test-model' });
    expect(seenKey).toBe('AIzaSERVER');
    expect(seenUrl).toContain('/models/test-model:generateContent');
    const cfg = await (await fetch(`${srv.url}/api/config`)).json();
    expect(cfg.askMei).toBe(true);
  });

  it('tries the spare model when the first is busy', async () => {
    const urls: string[] = [];
    upstream = async (url) => (urls.push(url), urls.length === 1 ? new Response('{}', { status: 503 }) : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Spare.' }] } }] }), { status: 200 }));
    const r = await post({ system: 'brief', turns: [{ role: 'user', text: 'q' }] });
    expect((await r.json()).model).toBe('spare-model');
  });

  it('rejects a malformed conversation', async () => {
    expect((await post({ system: '', turns: [{ role: 'user', text: 'q' }] })).status).toBe(400);
    expect((await post({ system: 'b', turns: [] })).status).toBe(400);
    expect((await post({ system: 'b', turns: [{ role: 'mei', text: 'a' }] })).status).toBe(400);
    expect((await post({ system: 'b', turns: [{ role: 'user', text: 'x'.repeat(5000) }] })).status).toBe(400);
  });

  it('says so when no key is set', async () => {
    const bare = await startServer({ port: 0, env: { JONGCLUB_STORE: 'memory', SESSION_SECRET: 'test', GEMINI_API_KEY: '' } });
    try {
      const r = await fetch(`${bare.url}/api/ask-mei`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ system: 'b', turns: [{ role: 'user', text: 'q' }] }) });
      expect(r.status).toBe(501);
      expect((await (await fetch(`${bare.url}/api/config`)).json()).askMei).toBe(false);
    } finally {
      await bare.close();
    }
  });
});
