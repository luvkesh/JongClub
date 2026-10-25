// When to offer a guest the chance to sign in. Newcomers play first; the
// club asks only once they have something worth keeping, and never nags:
// at most once a session, then not again for a few sessions, and not at all
// after a guest has said "Not now" a few times (Settings always has it).

const KEY = 'jongclub.auth.nudge.v1';
const SESSION_FLAG = 'jongclub.auth.nudge.session';

/** Sessions to wait after an ask before asking again. */
export const NUDGE_GAP = 3;
/** After this many "Not now"s the club stops asking on its own. */
export const NUDGE_MAX_DECLINES = 3;

export interface NudgeState {
  /** Visits to the club on this device (page loads in a new tab). */
  sessions: number;
  /** The session of the last ask, or 0 if never asked. */
  askedSession: number;
  asks: number;
  declines: number;
}

const fresh = (): NudgeState => ({ sessions: 0, askedSession: 0, asks: 0, declines: 0 });

export function loadNudge(): NudgeState {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? JSON.parse(raw) : null;
    if (s && typeof s === 'object' && !Array.isArray(s)) return { ...fresh(), ...s };
  } catch {
    /* defaults */
  }
  return fresh();
}

function save(s: NudgeState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: asks are simply not remembered */
  }
}

/** Count this visit. Reloads in the same tab (signing in, signing out) are the same session. */
export function noteSession() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (sessionStorage.getItem(SESSION_FLAG)) return;
      sessionStorage.setItem(SESSION_FLAG, '1');
    }
  } catch {
    /* no session storage: count every load */
  }
  const s = loadNudge();
  s.sessions++;
  save(s);
}

/** May the club ask now? Pure, so the rules can be tested. */
export function nudgeAllowed(s: NudgeState): boolean {
  if (s.declines >= NUDGE_MAX_DECLINES) return false;
  if (!s.askedSession) return true;
  // Once a session at most, then a few sessions' rest.
  return s.sessions - s.askedSession >= NUDGE_GAP;
}

export function markAsked() {
  const s = loadNudge();
  s.askedSession = Math.max(1, s.sessions);
  s.asks++;
  save(s);
}

export function markDeclined() {
  const s = loadNudge();
  s.declines++;
  save(s);
}
