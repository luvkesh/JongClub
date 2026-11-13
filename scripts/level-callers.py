"""Level every table-caller clip in src/audio/callers.gen.ts to the same speech level (audio_level.py).

Usage: python3 scripts/level-callers.py   (rewrites callers.gen.ts in place; record-callers.py calls level() itself)
loudnorm on clips under a second left the voices up to 10 dB apart, and Mei's tile names 5 dB above her lessons.
"""
import base64, json, os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audio_level import CALL_DISCARD_DB, CALL_SHOUT_DB, level  # noqa: E402

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
gen = os.path.join(root, 'src', 'audio', 'callers.gen.ts')
CALLS = {'Chow', 'Pung', 'Kong', 'Mahjong', 'Mah Jongg', 'Chi', 'Pon', 'Kan', 'Ron', 'Tsumo', 'Riichi', 'Pong', 'Gang', 'Hu', 'Zimo', 'Ăn', 'Phỗng', 'Chiếu', 'Ù'}
txt = open(gen).read()
head = txt[: txt.index('= [') + 2]
voices = json.loads(txt[txt.index('= [') + 2: txt.rindex(';')])
tmp = tempfile.mkdtemp()
for v in voices:
    for p, url in v['clips'].items():
        a, b = os.path.join(tmp, 'in.mp3'), os.path.join(tmp, 'out.mp3')
        open(a, 'wb').write(base64.b64decode(url.split(',', 1)[1]))
        level(a, b, CALL_SHOUT_DB if p in CALLS else CALL_DISCARD_DB)
        v['clips'][p] = 'data:audio/mpeg;base64,' + base64.b64encode(open(b, 'rb').read()).decode()
    print(v['name'], 'levelled', flush=True)
with open(gen, 'w') as f:
    f.write(head)
    json.dump(voices, f)
    f.write(';\n')
print('wrote', gen)
