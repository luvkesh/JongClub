// Prints every narration line as JSON, for recording Mei's voice clips.
import { narrationLines } from '../src/ui/academy';
console.log(JSON.stringify(narrationLines(), null, 1));
