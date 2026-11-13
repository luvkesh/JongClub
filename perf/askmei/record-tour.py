"""Record one website tour line in Mei's voice, with caption timings.
Usage: python3 perf/askmei/record-tour.py <key> [workdir]   (reads website/tour/lines.json, writes tour/mei-<key>.mp3 and captions.json)
"""
import json, os, subprocess, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
sys.path.insert(0, 'scripts')
from pronounce import has_special, phonemes  # noqa
import re
SAY = [
    (r'Mah ?Jongg?', 'Mahjong'), (r'JongBot', 'Jong Bot'), (r'JongClub', 'Jong Club'),
    (r'\bfaan\b', 'fahn'), (r'\btai\b', 'tie'), (r'\bhan\b', 'hahn'), (r'\byaku\b', 'yah koo'),
    (r'\bTsumo\b', 'Tsoo moh'), (r'\bRon\b', 'Rohn'), (r'\briichi\b', 'ree chee'), (r'\bRiichi\b', 'Ree chee'),
    (r'\bfuriten\b', 'foo ree ten'), (r'\bdora\b', 'doh rah'), (r'\bpung\b', 'pung'), (r'’', "'"),
]
def speakable(t):
    for a, b in SAY:
        t = re.sub(a, b, t)
    return t
def sentences(text):
    out = re.findall(r'[^.!?…]+[.!?…]+["”’)]*|[^.!?…]+$', re.sub(r'\s+', ' ', text))
    return [x.strip() for x in out if x.strip()] or [text]
def pause_after(sent):
    end = sent.rstrip('"”’)')[-1:]
    return 0.75 if end in '!?' else 0.8 if end == '…' else 0.65
key = sys.argv[1]; work = sys.argv[2] if len(sys.argv) > 2 else '/tmp/claude-0/tts'
lines = json.load(open('website/tour/lines.json')); text = lines[key]
k = Kokoro(os.path.join(work, 'kokoro-v1.0.onnx'), os.path.join(work, 'voices-v1.0.bin'))
style = k.get_voice_style('af_heart') * 0.5 + k.get_voice_style('zf_xiaoxiao') * 0.5
sr = 24000; parts = [np.zeros(int(sr * 0.12), dtype=np.float32)]; cues = []; t = 0.12
for sent in sentences(text):
    lively = sent.rstrip('"”’)').endswith(('!', '?'))
    speed = 1.0 if lively else 0.93
    if has_special(sent):
        audio, sr = k.create(phonemes(sent.replace('’', "'"), lambda s: k.tokenizer.phonemize(speakable(s), 'en-us')), voice=style, speed=speed, is_phonemes=True)
    else:
        audio, sr = k.create(speakable(sent), voice=style, speed=speed, lang='en-us')
    audio = audio.astype(np.float32)
    if lively:
        a, b = f'{work}/_in.wav', f'{work}/_out.wav'; sf.write(a, audio, sr)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', a, '-af', 'rubberband=pitch=1.06:formant=preserved,volume=1.12', b], check=True)
        audio, _ = sf.read(b, dtype='float32')
    cues.append({'t': round(t, 2), 'text': sent}); t += len(audio) / sr + pause_after(sent)
    parts += [audio, np.zeros(int(sr * pause_after(sent)), dtype=np.float32)]
wav = f'{work}/{key}.wav'; sf.write(wav, np.concatenate(parts), sr)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-af', 'loudnorm=I=-18', '-ac', '1', '-ar', '24000', '-b:a', '48k', f'website/tour/mei-{key}.mp3'], check=True)
cp = 'website/tour/captions.json'; caps = json.load(open(cp)); caps[key] = cues
json.dump(caps, open(cp, 'w'), ensure_ascii=False, indent=2); open(cp, 'a').write('\n')
print(key, round(t, 1), 's', cues)
