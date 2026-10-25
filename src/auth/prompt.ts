// Gentle sign-in offers for guests: "Save your progress?". Anything in the
// club can call `promptSignIn(reason)` when a guest has earned something worth
// keeping; `saveProgressCard` is the same offer laid inline (the results card).
// Both respect the rules in nudge.ts, so a guest is never nagged.

import { fmt, h } from '../ui/dom';
import { activate, currentAccount, type Account } from './account';
import { markAsked, markDeclined, loadNudge, nudgeAllowed } from './nudge';
import { signInScreen } from './signin';
import './auth.css';
import { tr } from '../i18n';

export type SignInReason = 'results' | 'points' | 'lesson' | 'placement' | 'manual';

/** Fired on window after someone signs in from an offer, so the app can load that account's profile. */
export const ACCOUNT_EVENT = 'jongclub:account';

export interface PromptOpts {
  /** Jong Points to name in the offer ("Save your 120 Jong Points?"). */
  points?: number;
  /** Ask even if the guest was asked recently (a button the player pressed). */
  force?: boolean;
}

export const isGuest = () => (currentAccount()?.provider ?? 'guest') === 'guest';

/** Would an offer show right now? */
export const canPromptSignIn = (force = false) => isGuest() && (force || nudgeAllowed(loadNudge()));

const COPY: Record<SignInReason, (pts?: number) => [string, string]> = {
  results: (pts) => [pts ? tr('Save your {n} Jong Points?', { n: fmt(pts) }) : tr('Save your progress?'), tr('Sign in to keep your Jong Points, games and collection with your own account.')],
  points: (pts) => [pts ? tr('Save your {n} Jong Points?', { n: fmt(pts) }) : tr('Save your progress?'), tr('Sign in to keep what you have earned with your own account.')],
  lesson: () => [tr('Save your progress?'), tr('Nicely done. Sign in to keep your lessons and Jong Points with your own account.')],
  placement: () => [tr('Save your placement?'), tr('Sign in to keep your result and the lessons it marked as done with your own account.')],
  manual: () => [tr('Save your progress?'), tr('Sign in to keep your Jong Points, lessons and collection with your own account.')],
};

/** The full sign-in screen with a way back. Resolves true once someone signs in. */
export function openSignIn(): Promise<boolean> {
  return new Promise((resolve) => {
    // Escape closes it like the other dialogs, and the page behind can't be tabbed into meanwhile.
    const shell = document.getElementById('shell');
    const done = () => {
      document.removeEventListener('keydown', onKey, true);
      if (shell) shell.inert = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !screen.isConnected) return;
      e.preventDefault();
      done();
      screen.remove();
      resolve(false);
    };
    const screen = signInScreen({
      cancelLabel: tr('Keep playing as a guest'),
      onCancel: () => {
        done();
        screen.remove();
        resolve(false);
      },
      onAccount: (a) => {
        done();
        signedIn(a);
        screen.classList.add('leaving');
        window.setTimeout(() => screen.remove(), 350);
        resolve(true);
      },
    });
    document.body.append(screen);
    document.addEventListener('keydown', onKey, true);
    if (shell) shell.inert = true;
  });
}

/** Switch to the account; its slot starts from the guest's progress the first time (account.ts). */
function signedIn(a: Account) {
  activate(a);
  window.dispatchEvent(new CustomEvent(ACCOUNT_EVENT, { detail: a }));
}

/** The offer's content: a short line, then Sign in / Not now. `close` runs when either is chosen. */
function offer(reason: SignInReason, opts: PromptOpts, close: (signed: boolean) => void, cls: string): HTMLElement {
  const [title, body] = COPY[reason](opts.points);
  const later = () => {
    markDeclined();
    close(false);
  };
  return h(
    'div',
    { class: `save-offer ${cls}`, role: 'group', 'aria-label': title },
    h('div', { class: 'save-offer-text' }, h('b', {}, title), h('span', {}, body)),
    h(
      'div',
      { class: 'save-offer-btns' },
      h('button', { type: 'button', class: 'btn ghost sm', onclick: later }, tr('Not now')),
      h('button', { type: 'button', class: 'btn primary sm', onclick: () => void openSignIn().then((ok) => ok && close(true)) }, tr('Sign in')),
    ),
  );
}

/**
 * Offer a guest the chance to sign in, as a small card at the foot of the screen.
 * Does nothing for signed-in players, or when the guest was asked recently
 * (unless `force`). Resolves true if they signed in.
 */
export function promptSignIn(reason: SignInReason = 'manual', opts: PromptOpts = {}): Promise<boolean> {
  if (!canPromptSignIn(opts.force)) return Promise.resolve(false);
  document.querySelector('.save-offer.floating')?.remove();
  markAsked();
  return new Promise((resolve) => {
    const el = offer(reason, opts, (signed) => {
      el.classList.add('leaving');
      window.setTimeout(() => el.remove(), 300);
      resolve(signed);
    }, 'floating');
    el.setAttribute('role', 'dialog');
    document.body.append(el);
  });
}

/** The same offer laid inline (inside the results card), or null when it shouldn't show. */
export function saveProgressCard(reason: SignInReason, opts: PromptOpts = {}): HTMLElement | null {
  if (!canPromptSignIn(opts.force)) return null;
  markAsked();
  const el = offer(reason, opts, (signed) => {
    if (!signed) return el.remove();
    el.replaceChildren(h('div', { class: 'save-offer-text' }, h('b', {}, tr('Progress saved')), h('span', {}, tr('Signed in as {name}.', { name: currentAccount()?.name ?? tr('you') }))));
  }, 'inline');
  return el;
}
