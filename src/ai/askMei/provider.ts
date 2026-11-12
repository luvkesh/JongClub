// Where Ask Mei's answers come from. Two ways, first found wins:
//   1. The JongClub server's /api/ask-mei route (server/app.js), which keeps the
//      Gemini key on the server: the way to run it once the club is hosted.
//      Used when the game points at a server (src/net/api.ts) or when
//      VITE_ASK_MEI_ENDPOINT names the route at build time.
//   2. A key the player pasted into Ask Mei, kept only on this device.
// A key is never built into the page: the game is published as one HTML file,
// and anyone who could open it could read the key out of it. With neither of
// these, Ask Mei shows its "needs a key" card instead of a chat.
//
// Only Google's Gemini API is reachable from the cloud the club is built in,
// so Gemini is the one model provider for now.

import { serverUrl } from '../../net/api';

export interface ChatTurn {
  role: 'user' | 'mei';
  text: string;
}

export type ProviderKind = 'proxy' | 'device-key';

export interface AskProvider {
  kind: ProviderKind;
  ask(system: string, turns: ChatTurn[], signal?: AbortSignal): Promise<string>;
}

export type AskErrorCode = 'needs-key' | 'bad-key' | 'quota' | 'network' | 'blocked' | 'server' | 'empty' | 'aborted';

export class AskMeiError extends Error {
  constructor(
    public code: AskErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AskMeiError';
  }
}

/** Models tried in order; a busy or missing one hands over to the next. */
export const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
export const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';

const DEVICE_KEY = 'jongclub.askmei.key.v1';

const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}) as Record<string, string | undefined>;

const store = {
  get(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key: string, v: string | null) {
    try {
      if (v === null) globalThis.localStorage?.removeItem(key);
      else globalThis.localStorage?.setItem(key, v);
    } catch {
      /* storage unavailable */
    }
  },
};

/** A key the player pasted on this device, or null. */
export const deviceKey = (): string | null => store.get(DEVICE_KEY);

/** Keep (or forget, with null) a key on this device. A key is trimmed; an empty one is forgotten. */
export function setDeviceKey(key: string | null) {
  const k = key?.trim() ?? '';
  store.set(DEVICE_KEY, k ? k : null);
}

/** Looks like a Google API key (AIza… and about 39 characters) so a paste of something else is caught early. */
export const looksLikeKey = (k: string) => /^AIza[0-9A-Za-z_-]{30,}$/.test(k.trim());

/** The server route that answers for Ask Mei, or null when the game runs without one. */
export function askEndpoint(): string | null {
  const own = env.VITE_ASK_MEI_ENDPOINT?.trim();
  if (own) return own.replace(/\/+$/, '');
  const s = serverUrl();
  return s ? `${s}/api/ask-mei` : null;
}

/** Gemini's request body for a system prompt and the conversation so far. */
export function geminiBody(system: string, turns: ChatTurn[]) {
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: turns.map((t) => ({ role: t.role === 'user' ? 'user' : 'model', parts: [{ text: t.text }] })),
    generationConfig: { temperature: 0.4, topP: 0.9, maxOutputTokens: 900 },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };
}

interface GeminiReply {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
}

/** The reply text out of a Gemini response, or an AskMeiError. */
export function readGemini(status: number, body: GeminiReply): string {
  if (status === 400 || status === 403) throw new AskMeiError('bad-key', body.error?.message ?? 'The key was refused.');
  if (status === 429) throw new AskMeiError('quota', body.error?.message ?? 'Too many questions for now.');
  if (status >= 500 || status === 404) throw new AskMeiError('server', body.error?.message ?? `Gemini answered ${status}.`);
  if (status !== 200) throw new AskMeiError('server', body.error?.message ?? `Gemini answered ${status}.`);
  if (body.promptFeedback?.blockReason) throw new AskMeiError('blocked', 'That question was blocked.');
  const c = body.candidates?.[0];
  const text = (c?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  if (!text) throw new AskMeiError(c?.finishReason === 'SAFETY' ? 'blocked' : 'empty', 'Mei had nothing to say.');
  return text;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Ask Gemini directly with a key, trying each model in turn when one is busy or missing. */
export async function geminiGenerate(key: string, system: string, turns: ChatTurn[], o: { fetch?: FetchLike; models?: string[]; signal?: AbortSignal } = {}): Promise<string> {
  const f = o.fetch ?? ((u, i) => fetch(u, i));
  const models = o.models ?? GEMINI_MODELS;
  let last: AskMeiError | null = null;
  for (const model of models) {
    let r: Response;
    try {
      r = await f(`${GEMINI_API}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(geminiBody(system, turns)),
        signal: o.signal,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new AskMeiError('aborted', 'Stopped.');
      throw new AskMeiError('network', 'Mei could not reach the network.');
    }
    const body = (await r.json().catch(() => ({}))) as GeminiReply;
    try {
      return readGemini(r.status, body);
    } catch (e) {
      const err = e as AskMeiError;
      // A busy, missing or rate-limited model hands over to the next one.
      if (err.code === 'server' || err.code === 'quota') {
        last = err;
        continue;
      }
      throw err;
    }
  }
  throw last ?? new AskMeiError('server', 'Mei is away from the table for a moment.');
}

/** Ask through the JongClub server, which holds the key. */
export async function proxyGenerate(endpoint: string, system: string, turns: ChatTurn[], o: { fetch?: FetchLike; signal?: AbortSignal } = {}): Promise<string> {
  const f = o.fetch ?? ((u, i) => fetch(u, i));
  let r: Response;
  try {
    r = await f(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ system, turns }), signal: o.signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new AskMeiError('aborted', 'Stopped.');
    throw new AskMeiError('network', 'Mei could not reach the club server.');
  }
  const body = (await r.json().catch(() => ({}))) as { text?: string; error?: string; message?: string };
  if (r.status === 501) throw new AskMeiError('needs-key', body.message ?? 'The server has no key for Ask Mei.');
  if (r.status === 429) throw new AskMeiError('quota', body.message ?? 'Too many questions for now.');
  if (r.status !== 200) throw new AskMeiError('server', body.message ?? `The server answered ${r.status}.`);
  if (!body.text) throw new AskMeiError('empty', 'Mei had nothing to say.');
  return body.text;
}

/** The provider to use now, or null when Ask Mei needs a key. */
export function resolveProvider(o: { fetch?: FetchLike } = {}): AskProvider | null {
  const endpoint = askEndpoint();
  if (endpoint) return { kind: 'proxy', ask: (s, t, signal) => proxyGenerate(endpoint, s, t, { fetch: o.fetch, signal }) };
  const mine = deviceKey();
  if (mine) return { kind: 'device-key', ask: (s, t, signal) => geminiGenerate(mine, s, t, { fetch: o.fetch, signal }) };
  return null;
}
