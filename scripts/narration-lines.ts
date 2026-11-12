// Prints every narration line as JSON, for recording Mei's voice clips.
import { narrationLines } from '../src/ui/academy';
import '../src/minigames/games';
import { miniGameLines } from '../src/minigames/narration';
console.log(JSON.stringify([...new Set([...narrationLines(), ...miniGameLines()])], null, 1));
