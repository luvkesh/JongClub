// A mini-game adds one browser-history entry ({ mini: id }) on top of the hub's
// (play.ts). Once the game is gone (Back off a finished game, Leave, Back then
// "Leave"), that entry stays behind as Forward history: Forward would land on it
// and show the hub, and the next Back would stay on the hub once. So whenever
// the browser lands on a game entry while no game is open, it steps straight
// back to the hub's entry: Forward does nothing visible and Back works at once.

let live: object | null = null;
let installed = false;

/** The open game (or null once it has gone). Installs the guard the first time. */
export function setLiveMini(owner: object | null, on: boolean) {
  if (on) live = owner;
  else if (live === owner) live = null;
  if (!installed && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    installed = true;
    window.addEventListener('popstate', skipStaleEntry);
  }
}

/** On popstate: a game entry with no game open is stale, so go back past it. True when it did. */
export function skipStaleEntry(): boolean {
  if (live) return false;
  let state: { mini?: unknown } | null = null;
  try {
    state = history.state as { mini?: unknown } | null;
  } catch {
    return false;
  }
  if (!state || typeof state !== 'object' || !state.mini) return false;
  try {
    history.back();
  } catch {
    return false;
  }
  return true;
}
