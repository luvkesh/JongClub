// The installable app: registers the service worker that the plain web build
// ships (sw.js beside index.html, written by scripts/pwa-plugin.mjs) and keeps
// the browser's install prompt for Settings. The single-file builds (claude.ai
// Artifact, standalone file) have no service worker, and a page inside a
// sandboxed frame or opened from file:// never registers one.

/** What the page knows about where it runs; injectable so the rules can be tested. */
export interface PageEnv {
  /** Vite build mode: only the plain build ('production') ships sw.js. */
  mode: string;
  protocol: string;
  hostname: string;
  /** window.origin: 'null' in a sandboxed frame. */
  origin: string;
  secure: boolean;
  framed: boolean;
  supported: boolean;
}

/** Hosts that serve the game as a claude.ai Artifact preview. */
const ARTIFACT_HOST = /(^|\.)(claude\.ai|claudeusercontent\.com|anthropic\.com)$/i;

/** Whether this page should register the service worker. */
export function shouldRegister(env: PageEnv): boolean {
  if (env.mode !== 'production' || !env.supported) return false;
  if (env.protocol !== 'https:' && env.protocol !== 'http:') return false;
  // http only counts on localhost, where browsers treat it as secure.
  if (!env.secure) return false;
  if (env.framed || env.origin === 'null' || !env.origin) return false;
  return !ARTIFACT_HOST.test(env.hostname);
}

function pageEnv(): PageEnv {
  let framed = true;
  try {
    framed = window.self !== window.top;
  } catch {
    /* a cross-origin parent: framed */
  }
  return {
    mode: import.meta.env.MODE,
    protocol: location.protocol,
    hostname: location.hostname,
    origin: String(window.origin ?? location.origin),
    secure: window.isSecureContext,
    framed,
    supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  };
}

let registration: Promise<ServiceWorkerRegistration | null> | null = null;

/** Register the service worker once, when this page should have one. Never throws. */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  registration ??= (async () => {
    try {
      if (!shouldRegister(pageEnv())) return null;
      return await navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href, { scope: './' });
    } catch {
      return null;
    }
  })();
  return registration;
}

/**
 * The service worker registration, once it is active (for notifications and
 * the like), or null where there is none. Safe to call from anywhere, any time.
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  const reg = await registerServiceWorker();
  if (!reg) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return reg;
  }
}

// ------------------------------------------------------------ install prompt

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((f) => f());

if (typeof window !== 'undefined') {
  // Chrome and Edge offer installation with this event; keep it for the Settings button.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedNow = true;
    changed();
  });
}

/** iPhone and iPad Safari install through Share, then Add to Home Screen. */
export function isIos(ua: string, touchPoints = 0, platform = ''): boolean {
  return /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && touchPoints > 1);
}

/** Already running as an installed app. */
function standalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

export type InstallState = 'prompt' | 'ios' | 'installed' | 'none';

/** What Settings can offer: a real install button, the iOS hint, or nothing. */
export function installState(): InstallState {
  if (typeof window === 'undefined') return 'none';
  if (installedNow || standalone()) return 'installed';
  if (deferred) return 'prompt';
  const env = pageEnv();
  // Only where the app can actually work offline, so not in the Artifact preview.
  if (shouldRegister(env) && isIos(navigator.userAgent, navigator.maxTouchPoints, navigator.platform)) return 'ios';
  return 'none';
}

/** Show the browser's install dialog. Resolves true when the player accepted. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null;
  try {
    await e.prompt();
    const { outcome } = await e.userChoice;
    changed();
    return outcome === 'accepted';
  } catch {
    changed();
    return false;
  }
}

/** Be told when installation becomes possible or has happened. Returns an unsubscribe. */
export function onInstallChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
