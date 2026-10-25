import './style.css';
import './ui/headings.css';
import { loadTileFonts, primeFaces, setFaceDetail, setTileSet } from './render/tileFaces';
import { detectQuality, qualitySpec, tierFaceDetail } from './render/quality';
import { loadProfile } from './progression/profile';
import { loadSettings } from './ui/screens/settings';
import './ui/accessibility';
import { App } from './ui/app';
import { installTooltips } from './ui/tooltip';
import { preloadAudio } from './audio/audioPack';
import { authGate } from './auth/signin';
import { registerServiceWorker } from './pwa/register';
import { startProfileSync, syncProfileDown } from './progression/cloudSync';
import { startReminders } from './ui/reminders';

// Tile faces are drawn to canvas, so wait briefly for the CJK and UI fonts.
installTooltips();
// Opens with the saved account's profile, or as a guest: newcomers play first (src/auth).
// With a club server, a signed-in account's profile is brought down first (src/progression/cloudSync.ts).
/**
 * Before the table appears: pick the face detail the table will use and load the equipped set's
 * faces kept on this device, so no tile is ever shown soft or drawn mid-game (render/faceStore.ts).
 */
async function primeTileFaces() {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
    setFaceDetail(tierFaceDetail(qualitySpec(detectQuality(gl))));
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    setTileSet(loadProfile().loadout.tileSet);
    // How many faces came from the device, for automated checks.
    (window as unknown as { jongclubPrimed: number }).jongclubPrimed = await primeFaces(loadSettings().labels);
  } catch {
    /* faces are drawn as needed */
  }
}

Promise.all([loadTileFonts(), authGate().then(syncProfileDown).then(primeTileFaces)]).then(() => {
  startProfileSync();
  const app = new App(document.getElementById('app')!);
  // Handy for debugging in the console and for automated play-tests.
  (window as unknown as { jongclub: App }).jongclub = app;
  // Recorded voices load in the background once the club is on screen.
  window.setTimeout(preloadAudio, 1500);
  // Offline play and "Install app" on the plain web build (src/pwa).
  void registerServiceWorker();
  // Opt-in reminders (Settings) are checked while the club is open.
  startReminders(() => app.club);
});
