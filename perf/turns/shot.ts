// Turn-order arrows harness (perf/turns): the Academy "Turn by turn" board on its own.
import '../../src/style.css';
import { boardDiagram } from '../../src/ui/academy';
const host = document.getElementById('a')!;
host.className = 'lesson story playing';
host.append(boardDiagram('turns'));
(window as unknown as { ready: boolean }).ready = true;
