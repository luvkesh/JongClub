// Prints every phrase the table callers say: each tile name and each call word.
// Usage: npx vite-node scripts/caller-phrases.ts > scripts/caller-phrases.json
import { callerPhrases } from '../src/audio/callers';
console.log(JSON.stringify(callerPhrases(), null, 1));
