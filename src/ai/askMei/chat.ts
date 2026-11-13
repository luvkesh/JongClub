// An Ask Mei conversation: the messages, what is sent with each question, and
// how Mei's reply is read (her one optional lesson link, bullets and bold).
// No DOM here; the Learn section (src/ui/askMei.ts) draws it.

import { linkableLessons, selectPacks } from './knowledge';
import { composeSystem } from './persona';
import { AskMeiError, resolveProvider, type AskProvider, type ChatTurn } from './provider';

export interface Message {
  role: 'user' | 'mei';
  text: string;
  at: number;
  /** A failed answer (shown faded, with a retry). */
  error?: AskMeiError['code'];
}

export interface AskContext {
  lesson?: string | null;
  variation?: string | null;
}

/** Turns sent with a question (the latest first in time, oldest dropped). */
const HISTORY = 8;
/** Characters kept of each earlier turn. */
const TURN_CHARS = 1500;
/** Messages kept on the device. */
const KEEP = 40;
const CHAT_KEY = 'jongclub.askmei.chat.v1';

export interface ChatStore {
  get(): string | null;
  set(v: string | null): void;
}

const sessionStore: ChatStore = {
  get() {
    try {
      return globalThis.sessionStorage?.getItem(CHAT_KEY) ?? null;
    } catch {
      return null;
    }
  },
  set(v) {
    try {
      if (v === null) globalThis.sessionStorage?.removeItem(CHAT_KEY);
      else globalThis.sessionStorage?.setItem(CHAT_KEY, v);
    } catch {
      /* this session only */
    }
  },
};

/** Mei's reply split into what to show and the lesson she links (only a real lesson id counts). */
export function parseReply(text: string): { body: string; lesson: string | null } {
  const ids = new Set(linkableLessons());
  let lesson: string | null = null;
  const body = text
    .replace(/\[\[\s*lesson:\s*([\w-]+)\s*\]\]/gi, (_, id: string) => {
      if (!lesson && ids.has(id)) lesson = id;
      return '';
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { body, lesson };
}

export interface Run {
  text: string;
  bold?: boolean;
}
export type Block = { kind: 'p'; runs: Run[] } | { kind: 'ul'; items: Run[][] };

/** Bold runs out of a line: **like this**. */
export function runs(line: string): Run[] {
  const out: Run[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let at = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > at) out.push({ text: line.slice(at, m.index) });
    out.push({ text: m[1], bold: true });
    at = m.index + m[0].length;
  }
  if (at < line.length) out.push({ text: line.slice(at) });
  return out.length ? out : [{ text: line }];
}

/** Mei's reply as paragraphs and bullet lists (the only shapes she is asked to use). */
export function blocks(body: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  let list: Run[][] | null = null;
  const flushPara = () => {
    if (para.length) out.push({ kind: 'p', runs: runs(para.join(' ')) });
    para = [];
  };
  const flushList = () => {
    if (list?.length) out.push({ kind: 'ul', items: list });
    list = null;
  };
  for (const raw of body.split('\n')) {
    const line = raw.replace(/^#{1,6}\s+/, '').trim();
    const bullet = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (bullet) {
      flushPara();
      (list ??= []).push(runs(bullet[1]));
    } else if (!line) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return out;
}

export class AskMeiChat {
  messages: Message[] = [];
  busy = false;
  private abort: AbortController | null = null;

  constructor(
    private store: ChatStore = sessionStore,
    private provider: () => AskProvider | null = () => resolveProvider(),
  ) {
    this.load();
  }

  private load() {
    try {
      const v: unknown = JSON.parse(this.store.get() ?? '[]');
      if (Array.isArray(v)) this.messages = v.filter((m): m is Message => !!m && typeof m === 'object' && typeof (m as Message).text === 'string' && ((m as Message).role === 'user' || (m as Message).role === 'mei'));
    } catch {
      this.messages = [];
    }
  }

  private save() {
    this.messages = this.messages.slice(-KEEP);
    this.store.set(this.messages.length ? JSON.stringify(this.messages) : null);
  }

  /** The turns Gemini sees: the recent conversation, failures left out, then the question. */
  turnsFor(question: string): ChatTurn[] {
    // A question whose answer failed (or never came) is left out with its answer.
    const past = this.messages.filter((m, i, all) => !m.error && (m.role === 'mei' || (all[i + 1]?.role === 'mei' && !all[i + 1].error))).slice(-HISTORY);
    // The conversation must begin with the player: drop a leading reply of Mei's.
    while (past.length && past[0].role === 'mei') past.shift();
    return [...past.map((m) => ({ role: m.role, text: m.text.length > TURN_CHARS ? m.text.slice(0, TURN_CHARS) + '…' : m.text })), { role: 'user', text: question }];
  }

  /** The system prompt for a question: Mei's brief and the notes that fit it. */
  systemFor(question: string, ctx: AskContext = {}): string {
    const recent = this.messages.filter((m) => m.role === 'user' && !m.error).slice(-3).map((m) => m.text);
    return composeSystem(selectPacks(question, { recent, lesson: ctx.lesson, variation: ctx.variation }));
  }

  /** Ask a question. Resolves with Mei's message (or a message carrying the error), after both are kept. */
  async ask(question: string, ctx: AskContext = {}): Promise<Message> {
    const q = question.trim();
    if (!q || this.busy) throw new AskMeiError('empty', 'Nothing to ask.');
    const provider = this.provider();
    if (!provider) throw new AskMeiError('needs-key', 'Ask Mei needs a key.');
    this.busy = true;
    this.abort = new AbortController();
    const system = this.systemFor(q, ctx);
    const turns = this.turnsFor(q);
    this.messages.push({ role: 'user', text: q, at: Date.now() });
    this.save();
    let reply: Message;
    try {
      const text = await provider.ask(system, turns, this.abort.signal);
      reply = { role: 'mei', text, at: Date.now() };
    } catch (e) {
      const err = e instanceof AskMeiError ? e : new AskMeiError('server', String((e as Error)?.message ?? e));
      reply = { role: 'mei', text: err.message, at: Date.now(), error: err.code };
    } finally {
      this.busy = false;
      this.abort = null;
    }
    this.messages.push(reply);
    this.save();
    return reply;
  }

  /** Stop a question that is still being answered. */
  stop() {
    this.abort?.abort();
  }

  /** Forget the conversation. */
  clear() {
    this.stop();
    this.messages = [];
    this.save();
  }

  /** The last question, when its answer failed (for a retry). */
  lastFailed(): string | null {
    const n = this.messages.length;
    const last = this.messages[n - 1];
    return last?.role === 'mei' && last.error && this.messages[n - 2]?.role === 'user' ? this.messages[n - 2].text : null;
  }

  /** Drop the failed answer and its question, so a retry asks again cleanly. */
  dropFailed() {
    if (this.lastFailed() !== null) {
      this.messages.splice(-2, 2);
      this.save();
    }
  }
}
