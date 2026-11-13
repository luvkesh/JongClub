// Ask Mei: a conversation with Mei inside Learn. The player asks about rules,
// scoring, strategy or any of the club's games; Mei answers from the club's own
// rule sheets, scoring guides and lessons (src/ai/askMei). Without a key the
// section shows how to give her one instead of a chat.

import './askMei.css';
import { AskMeiChat, blocks, parseReply, type Message } from '../ai/askMei/chat';
import { looksLikeKey, resolveProvider, setDeviceKey, type AskErrorCode } from '../ai/askMei/provider';
import { LESSONS } from './academy';
import { clear, h } from './dom';
import { icon } from './icons';
import { lt } from '../i18n/lessons';
import { tr } from '../i18n';
import { lastTable } from './lastTable';
import { sound } from '../audio/sound';
import type { App } from './app';

/** One conversation for the whole visit (kept in sessionStorage by the chat itself). */
let chat: AskMeiChat | null = null;
const theChat = () => (chat ??= new AskMeiChat());

/** What Mei says when an answer fails, by cause. */
function errorLine(code: AskErrorCode): string {
  switch (code) {
    case 'needs-key': return tr('Ask Mei needs a key before she can answer.');
    case 'bad-key': return tr('That key was refused. Check it and save it again.');
    case 'billing': return tr('Google accepted the key, but its project needs billing turned on in Google AI Studio before Gemini will answer.');
    case 'quota': return tr('Too many questions for now. Give Mei a minute and try again.');
    case 'network': return tr('Mei can’t reach the network right now.');
    case 'blocked': return tr('Mei can’t answer that one. Try asking another way.');
    case 'empty': return tr('Mei had nothing to say to that. Try asking another way.');
    case 'aborted': return tr('Stopped.');
    default: return tr('Mei is away from the table for a moment. Try again shortly.');
  }
}

const STARTERS = () => [
  tr('What is a passport in the East round?'),
  tr('How do I win a hand in India Rules?'),
  tr('What does a Small Card do?'),
  tr('What is the difference between a chow and a pung?'),
  tr('How is a win paid in Riichi?'),
  tr('Which variation should I learn first?'),
];

/** The Ask Mei section of the Learn screen. */
export function askMeiSection(app: App): HTMLElement {
  const c = theChat();
  const lessonId = app.learnLesson;
  const lessonTitle = LESSONS[lessonId]?.title;
  const context = () => ({ lesson: app.learnLesson, variation: lastTable().variation ?? null });

  const thread = h('div', { class: 'am-thread', role: 'log', 'aria-live': 'polite', 'aria-label': tr('Conversation with Mei') });
  const input = h('textarea', { class: 'am-input', rows: '1', placeholder: tr('Ask a question…'), 'aria-label': tr('Ask a question…'), maxlength: '1500', enterkeyhint: 'send' });
  const send = h('button', { type: 'button', class: 'am-send', 'aria-label': tr('Send'), title: tr('Send'), html: icon('arrowRight') });
  const stop = h('button', { type: 'button', class: 'btn sm ghost am-stop', hidden: true, onclick: () => c.stop() }, tr('Stop'));
  const clearBtn = h('button', { type: 'button', class: 'btn sm ghost am-clear', hidden: !c.messages.length }, tr('Clear the conversation'));
  const status = h('p', { class: 'am-status', 'aria-live': 'polite' });
  const foot = h('p', { class: 'am-note' }, tr('Mei can slip up. The rule sheet on the Variations screen is final.'));
  const chips = h('div', { class: 'am-chips', role: 'group', 'aria-label': tr('Suggested questions') });
  const keyCard = h('div', { class: 'am-key' });
  const body = h('div', { class: 'am-body' });

  const grow = () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(140, input.scrollHeight)}px`;
  };

  function bubble(m: Message): HTMLElement {
    if (m.role === 'user') return h('div', { class: 'am-msg you' }, h('span', { class: 'am-sr' }, tr('You') + ': '), h('p', {}, m.text));
    const el = h('div', { class: `am-msg mei${m.error ? ' failed' : ''}` }, h('div', { class: 'narrator', 'aria-hidden': 'true' }, 'M'));
    const box = h('div', { class: 'am-say' });
    if (m.error) {
      box.append(h('p', {}, errorLine(m.error)));
      if (m.error !== 'aborted') {
        box.append(h('button', { type: 'button', class: 'btn sm ghost', onclick: () => retry() }, tr('Try again')));
      }
    } else {
      const { body: text, lesson } = parseReply(m.text);
      for (const b of blocks(text)) {
        if (b.kind === 'p') box.append(h('p', {}, ...b.runs.map((r) => (r.bold ? h('b', {}, r.text) : r.text))));
        else box.append(h('ul', {}, ...b.items.map((runs) => h('li', {}, ...runs.map((r) => (r.bold ? h('b', {}, r.text) : r.text))))));
      }
      if (lesson && LESSONS[lesson]) {
        box.append(h('button', { type: 'button', class: 'am-lesson', onclick: () => (sound.play('button'), app.ctx().openLesson(lesson)) }, h('span', { html: icon('lesson') }), `${tr('Open the lesson')}: ${lt(LESSONS[lesson].title)}`));
      }
    }
    el.append(box);
    return el;
  }

  function draw() {
    clear(thread);
    for (const m of c.messages) thread.append(bubble(m));
    if (c.busy) thread.append(h('div', { class: 'am-msg mei thinking' }, h('div', { class: 'narrator', 'aria-hidden': 'true' }, 'M'), h('div', { class: 'am-say' }, h('span', { class: 'am-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('span', { class: 'am-sr' }, tr('Mei is thinking…')))));
    thread.hidden = !thread.childElementCount;
    chips.hidden = c.messages.length > 0;
    clearBtn.hidden = !c.messages.length || c.busy;
    stop.hidden = !c.busy;
    send.disabled = c.busy || !input.value.trim();
    input.disabled = c.busy;
    if (thread.childElementCount) requestAnimationFrame(() => thread.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

  async function ask(q: string) {
    const text = q.trim();
    if (!text || c.busy) return;
    if (!resolveProvider()) return showKey();
    sound.play('button');
    input.value = '';
    grow();
    status.textContent = '';
    draw();
    await c.ask(text, context());
    draw();
    if (!input.disabled && matchMedia('(hover: hover)').matches) input.focus({ preventScroll: true });
  }

  function retry() {
    const q = c.lastFailed();
    if (q === null) return;
    c.dropFailed();
    void ask(q);
  }

  /** The "needs a key" card, or the chat, depending on what answers now. */
  function showKey() {
    clear(body);
    const p = resolveProvider();
    if (p) {
      body.append(chips, thread, composer, status, foot);
      sourceLine.textContent = p.kind === 'proxy' ? tr('Answers through the club server') : tr('Answers with the key on this device');
      forget.hidden = p.kind !== 'device-key';
      draw();
      return;
    }
    const field = h('input', { type: 'password', class: 'code-input am-keyfield', autocomplete: 'off', spellcheck: 'false', 'aria-label': tr('Gemini API key'), placeholder: 'AIza…' });
    const note = h('p', { class: 'am-keynote', 'aria-live': 'polite' });
    const save = h('button', { type: 'button', class: 'btn primary sm', onclick: () => {
      const k = field.value.trim();
      if (!looksLikeKey(k)) {
        note.textContent = tr('That doesn’t look like a Gemini key (they start with AIza or AQ.).');
        field.focus();
        return;
      }
      setDeviceKey(k);
      sound.play('button');
      status.textContent = tr('Key saved on this device');
      showKey();
    } }, tr('Save key'));
    field.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), save.click()));
    clear(keyCard).append(
      h('h3', { class: 'am-keytitle' }, h('span', { html: icon('keys') }), tr('Ask Mei needs a key')),
      h('p', {}, tr('Ask Mei answers through Google’s Gemini. Paste a Gemini API key to use it on this device; the key stays here and is never sent anywhere but Google.')),
      h('div', { class: 'am-keyrow' }, field, save),
      note,
      h('p', { class: 'muted small' }, tr('Once the club has its own server, set GEMINI_API_KEY there and Ask Mei runs through it for every player.')),
    );
    sourceLine.textContent = '';
    forget.hidden = true;
    body.append(keyCard, foot);
  }

  for (const q of [...(lessonTitle ? [tr('Sum up “{title}” for me', { title: lt(lessonTitle) })] : []), ...STARTERS()].slice(0, 6)) {
    chips.append(h('button', { type: 'button', class: 'am-chip', onclick: () => void ask(q) }, q));
  }

  input.addEventListener('input', () => {
    grow();
    send.disabled = c.busy || !input.value.trim();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void ask(input.value);
    }
  });
  send.addEventListener('click', () => void ask(input.value));
  clearBtn.addEventListener('click', () => {
    c.clear();
    status.textContent = '';
    draw();
  });
  const composer = h('form', { class: 'am-composer', onsubmit: (e: Event) => (e.preventDefault(), void ask(input.value)) }, input, send, stop);

  const forget = h('button', { type: 'button', class: 'am-forget', hidden: true, onclick: () => {
    setDeviceKey(null);
    c.stop();
    status.textContent = '';
    showKey();
  } }, tr('Forget the key'));
  const sourceLine = h('span', { class: 'am-source' });

  const section = h(
    'section',
    { class: 'lx-ask', 'aria-label': tr('Ask Mei') },
    h(
      'header',
      { class: 'am-head' },
      h('div', { class: 'am-portrait', 'aria-hidden': 'true' }, h('div', { class: 'narrator' }, 'M')),
      h('div', { class: 'am-head-text' }, h('p', { class: 'eyebrow' }, tr('Ask Mei')), h('h2', { class: 'am-title' }, tr('Ask Mei anything about Mahjong')), h('p', { class: 'am-sub' }, tr('Rules, scoring, strategy and all 31 variations, India Rules first. Mei answers from the club’s own rule sheets and lessons.'))),
      h('div', { class: 'am-tools' }, sourceLine, forget, clearBtn),
    ),
    body,
  );
  showKey();
  return section;
}
