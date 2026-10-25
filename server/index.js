// `npm run server`: start the JongClub server with settings from the environment.
import { startServer } from './app.js';

const s = await startServer();
console.log(`JongClub server on ${s.url} (storage: ${s.store.kind}). Point the game at it with VITE_JONGCLUB_SERVER=${s.url}`);
const stop = () => s.close().then(() => process.exit(0));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
