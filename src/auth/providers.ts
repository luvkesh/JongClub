// Real Google and Apple web sign-in. Each loads the provider's own script only
// when its client ID is configured (src/auth/config.ts).

import { AUTH_CONFIG } from './config';
import { jwtClaims, providerAccount, type Account } from './account';
import { ApiError, cloudIdToken, serverUrl } from '../net/api';

const loaded = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  let p = loaded.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('The sign-in service could not be reached. Check your connection and try again.'));
      document.head.append(s);
    });
    loaded.set(src, p);
  }
  return p;
}

interface GoogleId {
  initialize(o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string; auto_select?: boolean }): void;
  renderButton(el: HTMLElement, o: Record<string, unknown>): void;
}
interface AppleAuth {
  init(o: { clientId: string; scope: string; redirectURI: string; usePopup: boolean; state?: string }): void;
  signIn(): Promise<{ authorization: { id_token: string; code: string }; user?: { name?: { firstName?: string; lastName?: string }; email?: string } }>;
}

/**
 * Render Google's own sign-in button into `slot`. Google requires its rendered
 * button (or One Tap) to issue an ID token, so this replaces our placeholder.
 */
export async function mountGoogleButton(slot: HTMLElement, onAccount: (a: Account) => void, onError: (m: string) => void) {
  try {
    await loadScript('https://accounts.google.com/gsi/client');
    const gid = (window as unknown as { google?: { accounts: { id: GoogleId } } }).google?.accounts.id;
    if (!gid) throw new Error('Google sign-in did not load.');
    gid.initialize({
      client_id: AUTH_CONFIG.googleClientId,
      // With a club server, the server checks the token's signature and holds the account.
      callback: (r) => (serverUrl() ? cloudIdToken('google', r.credential).then(onAccount, (e: Error) => onError(e.message)) : onAccount(providerAccount('google', jwtClaims(r.credential)))),
    });
    slot.replaceChildren();
    gid.renderButton(slot, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: Math.min(360, slot.clientWidth || 320) });
  } catch (e) {
    onError((e as Error).message);
  }
}

export async function appleSignIn(): Promise<Account> {
  await loadScript('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js');
  const apple = (window as unknown as { AppleID?: { auth: AppleAuth } }).AppleID?.auth;
  if (!apple) throw new Error('Apple sign-in did not load.');
  apple.init({ clientId: AUTH_CONFIG.appleServicesId, scope: 'name email', redirectURI: AUTH_CONFIG.appleRedirectUri, usePopup: true });
  try {
    const r = await apple.signIn();
    // Apple sends the name only the first time someone signs in to the app.
    const n = r.user?.name;
    const name = n ? [n.firstName, n.lastName].filter(Boolean).join(' ') : undefined;
    if (serverUrl()) return await cloudIdToken('apple', r.authorization.id_token, name);
    return providerAccount('apple', { ...jwtClaims(r.authorization.id_token), ...(r.user?.email ? { email: r.user.email } : {}) }, name);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    const code = (e as { error?: string }).error;
    throw new Error(code === 'popup_closed_by_user' ? 'Apple sign-in was closed before it finished.' : 'Apple sign-in didn’t complete. Please try again.');
  }
}
