// The sign-in screen: Google, Apple or email, with guest play always open.
// Shown from Settings and from the gentle "Save your progress?" offers (prompt.ts).

import { brandSvg, brandWordmark } from '../brand';
import { h } from '../ui/dom';
import { activate, currentAccount, demoAccount, guestAccount, PROVIDER_LABEL, registerEmail, signInEmail, signOut, type Account } from './account';
import { appleLive, googleLive } from './config';
import { noteSession } from './nudge';
import { appleSignIn, mountGoogleButton } from './providers';
import { serverUrl } from '../net/api';
import './auth.css';
import { tr } from '../i18n';

const GOOGLE_G =
  '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const APPLE_LOGO =
  '<svg viewBox="0 0 814 1000" width="16" height="18" aria-hidden="true"><path fill="currentColor" d="M788 341c-6 4-106 61-106 186 0 145 127 196 131 197-1 3-20 70-67 138-42 60-85 120-152 120s-84-39-161-39c-75 0-102 40-163 40s-104-56-153-125C60 777 14 655 14 539c0-187 121-285 241-285 64 0 117 42 157 42 38 0 98-45 171-45 28 0 128 3 205 90zM554 167c30-36 51-85 51-135 0-7-1-14-2-20-49 2-106 33-141 73-27 31-53 80-53 131 0 8 1 15 2 18 3 1 9 2 14 2 44 0 99-30 129-69z"/></svg>';

interface Opts {
  /** Offer "Play as a guest" (first visit) or "Cancel" (from Settings). */
  onGuest?: () => void;
  onCancel?: () => void;
  /** Label for the way back (default "Cancel"). */
  cancelLabel?: string;
  onAccount: (a: Account) => void;
}

/** A full-screen sign-in panel. The caller removes it once `onAccount` or `onGuest` fires. */
export function signInScreen(opts: Opts): HTMLElement {
  const err = h('p', { class: 'auth-err', role: 'alert' });
  const fail = (m: string) => (err.textContent = m);
  const body = h('div', { class: 'auth-body' });
  const card = h(
    'div',
    { class: 'auth-card' },
    h('div', { class: 'auth-logo', html: brandSvg('mark') }),
    h('p', { class: 'auth-mark' }, brandWordmark()),
    h('p', { class: 'auth-tag' }, tr('The Table Awaits.')),
    body,
    err,
  );
  const root = h('div', { class: 'auth', role: 'dialog', 'aria-modal': 'true', 'aria-label': tr('Sign in to JongClub') }, card);

  const done = (a: Account) => opts.onAccount(a);

  const main = () => {
    err.textContent = '';
    const googleSlot = h('div', { class: 'auth-google-slot' });
    const googleBtn = h('button', { type: 'button', class: 'auth-btn google', html: `${GOOGLE_G}<span>${tr('Continue with Google')}</span>` });
    googleSlot.append(googleBtn);
    if (googleLive()) {
      googleBtn.disabled = true;
      void mountGoogleButton(googleSlot, done, fail);
    } else googleBtn.onclick = () => demo('google');

    const appleBtn = h('button', { type: 'button', class: 'auth-btn apple', html: `${APPLE_LOGO}<span>${tr('Continue with Apple')}</span>` });
    appleBtn.onclick = () => {
      if (!appleLive()) return demo('apple');
      err.textContent = '';
      appleBtn.disabled = true;
      appleSignIn()
        .then(done, (e: Error) => fail(e.message))
        .finally(() => (appleBtn.disabled = false));
    };

    body.replaceChildren(
      h('h2', { class: 'auth-title' }, tr('Sign in to the club')),
      h('p', { class: 'auth-lede' }, tr('Keep your Jong Points, collection and rating with your account.')),
      googleSlot,
      appleBtn,
      h('div', { class: 'auth-or' }, h('span', {}, tr('or use email'))),
      emailForm(),
      opts.onGuest
        ? h('button', { type: 'button', class: 'auth-link', onclick: opts.onGuest }, tr('Play as a guest'))
        : opts.onCancel
          ? h('button', { type: 'button', class: 'auth-link', onclick: opts.onCancel }, opts.cancelLabel ?? tr('Cancel'))
          : '',
      h('p', { class: 'auth-fine' }, serverUrl() ? tr('Your account is kept by the club, so it works on every device. You can switch accounts any time in Settings.') : tr('Accounts are saved on this device for now. You can switch accounts any time in Settings.')),
    );
  };

  const emailForm = () => {
    let mode: 'in' | 'up' = 'in';
    const name = h('input', { type: 'text', name: 'name', autocomplete: 'nickname', placeholder: tr('Name at the table'), maxlength: '24', 'aria-label': tr('Name at the table') }) as HTMLInputElement;
    const email = h('input', { type: 'email', name: 'email', autocomplete: 'email', placeholder: tr('Email'), required: true, 'aria-label': tr('Email') }) as HTMLInputElement;
    const pass = h('input', { type: 'password', name: 'password', autocomplete: 'current-password', placeholder: tr('Password'), required: true, minlength: '8', 'aria-label': tr('Password') }) as HTMLInputElement;
    const submit = h('button', { type: 'submit', class: 'btn primary auth-submit' }, tr('Sign in')) as HTMLButtonElement;
    const nameRow = h('div', { class: 'auth-name', hidden: true }, name);
    const tabIn = h('button', { type: 'button', class: 'on', role: 'tab' }, tr('Sign in'));
    const tabUp = h('button', { type: 'button', role: 'tab' }, tr('Create account'));
    const setMode = (m: 'in' | 'up') => {
      mode = m;
      err.textContent = '';
      tabIn.classList.toggle('on', m === 'in');
      tabUp.classList.toggle('on', m === 'up');
      nameRow.hidden = m === 'in';
      name.required = m === 'up';
      pass.autocomplete = m === 'up' ? 'new-password' : 'current-password';
      pass.placeholder = m === 'up' ? tr('Password (8+ characters)') : tr('Password');
      submit.textContent = m === 'up' ? tr('Create account') : tr('Sign in');
    };
    tabIn.onclick = () => setMode('in');
    tabUp.onclick = () => setMode('up');
    const form = h('form', { class: 'auth-form', novalidate: true }, h('div', { class: 'seg auth-tabs', role: 'tablist' }, tabIn, tabUp), nameRow, email, pass, submit) as HTMLFormElement;
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      err.textContent = '';
      submit.disabled = true;
      try {
        done(mode === 'up' ? await registerEmail(name.value, email.value, pass.value) : await signInEmail(email.value, pass.value));
      } catch (e) {
        fail((e as Error).message);
      } finally {
        submit.disabled = false;
      }
    };
    return form;
  };

  /** The stand-in for a provider that isn't configured yet, labelled as a demo. */
  const demo = (provider: 'google' | 'apple') => {
    err.textContent = '';
    const label = PROVIDER_LABEL[provider];
    const name = h('input', { type: 'text', placeholder: tr('Your name'), maxlength: '24', 'aria-label': tr('Your name') }) as HTMLInputElement;
    const email = h('input', { type: 'email', placeholder: tr('Your {provider} email', { provider: label }), 'aria-label': tr('Your {provider} email', { provider: label }) }) as HTMLInputElement;
    const form = h(
      'form',
      { class: 'auth-form', novalidate: true },
      name,
      email,
      h('button', { type: 'submit', class: `auth-btn ${provider}`, html: `${provider === 'google' ? GOOGLE_G : APPLE_LOGO}<span>${tr('Continue (demo)')}</span>` }),
    ) as HTMLFormElement;
    form.onsubmit = (ev) => {
      ev.preventDefault();
      try {
        done(demoAccount(provider, name.value, email.value));
      } catch (e) {
        fail((e as Error).message);
      }
    };
    body.replaceChildren(
      h('span', { class: 'auth-demo-badge' }, tr('Demo sign-in')),
      h('h2', { class: 'auth-title' }, tr('{provider} sign-in', { provider: label })),
      h('p', { class: 'auth-lede' }, tr('{provider} sign-in isn’t connected to JongClub yet, so this creates a demo account on this device. Nothing is sent to {provider}.', { provider: label })),
      form,
      h('button', { type: 'button', class: 'auth-link', onclick: main }, tr('Back')),
    );
    name.focus();
  };

  main();
  return root;
}

/**
 * Before the club opens: use the saved account, or let a first visit in as a
 * guest. Newcomers play first; sign-in is offered later (prompt.ts) once
 * there is something worth keeping, and is always in Settings.
 */
export function authGate(): Promise<void> {
  noteSession();
  activate(currentAccount() ?? guestAccount());
  return Promise.resolve();
}

/** The Account row in Settings: who is signed in, and a way to switch. */
export function accountField(): HTMLElement {
  const a = currentAccount() ?? guestAccount();
  const who =
    a.provider === 'guest'
      ? tr('Playing as a guest')
      : `${a.name}${a.email ? ` · ${a.email}` : ''}`;
  const via = a.provider === 'guest' ? tr('Progress is saved on this device only.') : tr(a.demo ? 'Signed in with {provider} (demo)' : 'Signed in with {provider}', { provider: PROVIDER_LABEL[a.provider] });
  const switchTo = () => {
    const screen = signInScreen({
      onCancel: () => screen.remove(),
      onAccount: (next) => {
        activate(next);
        location.reload();
      },
    });
    document.body.append(screen);
  };
  return h(
    'div',
    { class: 'field account-field' },
    h('span', {}, tr('Account')),
    h(
      'div',
      { class: 'account-row' },
      h('div', { class: 'account-who' }, h('b', {}, who), h('small', {}, via)),
      a.provider === 'guest'
        ? h('button', { type: 'button', class: 'btn sm', onclick: switchTo }, tr('Sign in'))
        : h(
            'button',
            {
              type: 'button',
              class: 'btn sm ghost',
              onclick: () => {
                signOut();
                location.reload();
              },
            },
            tr('Sign out'),
          ),
    ),
  );
}
