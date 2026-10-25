"""Record Mei's narration with the open Kokoro TTS model (Apache-2.0) and embed it.

Usage: [OUT=src/audio/x.gen.ts] python3 scripts/record-narration.py <lines.json> <voice> [workdir]
  voice: a Kokoro voice id (e.g. zf_xiaoxiao) or a blend "a+b@w" (w = share of b).
Writes src/audio/narration.gen.ts with every line as an MP3 data URL keyed by clipKey().
Needs: pip install kokoro-onnx soundfile; ffmpeg; kokoro-v1.0.onnx and voices-v1.0.bin in workdir.
"""
import base64, hashlib, json, os, re, subprocess, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pronounce import has_special, phonemes  # noqa: E402

lines_path, voice_spec = sys.argv[1], sys.argv[2]
work = sys.argv[3] if len(sys.argv) > 3 else '/tmp/claude-0/tts'
shard = (int(os.environ.get('SHARD', '0')), int(os.environ.get('SHARDS', '1')))
only_render = os.environ.get('RENDER_ONLY') == '1'

def clip_key(text: str) -> str:
    t = re.sub(r'\s+', ' ', text).strip()
    h = 0x811C9DC5
    b = t.encode('utf-16-le')
    for i in range(0, len(b), 2):
        h ^= b[i] | (b[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF
    digits = '0123456789abcdefghijklmnopqrstuvwxyz'
    out = ''
    while True:
        h, r = divmod(h, 36)
        out = digits[r] + out
        if h == 0:
            return out

SAY = [
    (r'Mah ?Jongg?', 'Mahjong'), (r'JongBot', 'Jong Bot'), (r'JongClub', 'Jong Club'),
    (r'\bfaan\b', 'fahn'), (r'\btai\b', 'tie'), (r'\bhan\b', 'hahn'), (r'\byaku\b', 'yah koo'),
    (r'\bTsumo\b', 'Tsoo moh'), (r'\bRon\b', 'Rohn'), (r'\briichi\b', 'ree chee'), (r'\bRiichi\b', 'Ree chee'),
    (r'\bfuriten\b', 'foo ree ten'), (r'\bdora\b', 'doh rah'), (r'\bpung\b', 'pung'), (r'’', "'"),
]
def speakable(t: str) -> str:
    for a, b in SAY:
        t = re.sub(a, b, t)
    return t

def sentences(text: str):
    out = re.findall(r'[^.!?…]+[.!?…]+["”’)]*|[^.!?…]+$', re.sub(r'\s+', ' ', text))
    return [x.strip() for x in out if x.strip()] or [text]

def pause_after(sent: str) -> float:
    end = sent.rstrip('"”’)')[-1:]
    return 0.75 if end in '!?' else 0.8 if end == '…' else 0.65

def brighten(audio, sr):
    # About a semitone higher and a touch louder: more animated, same voice.
    tmp_in, tmp_out = os.path.join(cache, f'_in{os.getpid()}.wav'), os.path.join(cache, f'_out{os.getpid()}.wav')
    sf.write(tmp_in, audio, sr)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp_in, '-af', 'rubberband=pitch=1.06:formant=preserved,volume=1.12', tmp_out], check=True)
    out, _ = sf.read(tmp_out, dtype='float32')
    return out

lines = json.load(open(lines_path))
cache = os.path.join(work, 'cache', hashlib.sha1((voice_spec + '|v2').encode()).hexdigest()[:10])
os.makedirs(cache, exist_ok=True)

# Seed the cache from the clips already in narration.gen.ts, so only new lines
# (and lines with words from pronounce.py) are synthesised.
gen = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'audio', 'narration.gen.ts')
if os.environ.get('SEED') == '1' and os.path.exists(gen):
    have = dict(re.findall(r'"([0-9a-z]+)": \'data:audio/mpeg;base64,([^\']+)\'', open(gen).read()))
    seeded = 0
    for l in lines:
        key = clip_key(l)
        mp3 = os.path.join(cache, key + '.mp3')
        if key in have and not has_special(l) and not os.path.exists(mp3):
            open(mp3, 'wb').write(base64.b64decode(have[key]))
            seeded += 1
    print('seeded', seeded, 'clips from narration.gen.ts', flush=True)

if not only_render:
    k = Kokoro(os.path.join(work, 'kokoro-v1.0.onnx'), os.path.join(work, 'voices-v1.0.bin'))
    if '+' in voice_spec:
        a, rest = voice_spec.split('+')
        b, w = rest.split('@')
        style = k.get_voice_style(a) * (1 - float(w)) + k.get_voice_style(b) * float(w)
    else:
        style = voice_spec
    for i, line in enumerate(lines):
        if i % shard[1] != shard[0]:
            continue
        key = clip_key(line)
        mp3 = os.path.join(cache, key + '.mp3')
        if os.path.exists(mp3):
            continue
        # Sentence by sentence, so there is room to breathe between them, and so
        # exclamations and questions can sound a little brighter.
        sr = 24000
        parts = [np.zeros(int(sr * 0.12), dtype=np.float32)]
        for sent in sentences(line):
            lively = sent.rstrip('"”’)').endswith(('!', '?'))
            speed = 1.0 if lively else 0.93
            if has_special(sent):
                # Words from other languages, as IPA (pronounce.py); the rest as English.
                ph = phonemes(sent.replace('’', "'"), lambda t: k.tokenizer.phonemize(speakable(t), 'en-us'))
                audio, sr = k.create(ph, voice=style, speed=speed, is_phonemes=True)
            else:
                audio, sr = k.create(speakable(sent), voice=style, speed=speed, lang='en-us')
            audio = audio.astype(np.float32)
            if lively:
                audio = brighten(audio, sr)
            parts.append(audio)
            parts.append(np.zeros(int(sr * pause_after(sent)), dtype=np.float32))
        wav = os.path.join(cache, key + '.wav')
        sf.write(wav, np.concatenate(parts), sr)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-af', 'loudnorm=I=-18', '-ac', '1', '-ar', '24000', '-b:a', '48k', mp3], check=True)
        os.remove(wav)
        print(f'{i + 1}/{len(lines)} {key}', flush=True)

if shard[1] == 1 or only_render:
    missing = [l for l in lines if not os.path.exists(os.path.join(cache, clip_key(l) + '.mp3'))]
    if missing:
        sys.exit(f'{len(missing)} lines not recorded yet')
    out = ["// Generated by scripts/record-narration.py: Mei's recorded lines as data URLs, keyed by clipKey(text).",
           f"export const VOICE_NAME = {json.dumps(voice_spec)};", 'export const CLIPS: Record<string, string> = {']
    for l in lines:
        key = clip_key(l)
        data = base64.b64encode(open(os.path.join(cache, key + '.mp3'), 'rb').read()).decode()
        out.append(f"  {json.dumps(key)}: 'data:audio/mpeg;base64,{data}',")
    out.append('};')
    # OUT writes another clip file (e.g. src/audio/pitch.gen.ts, the Atelier pitches) instead of the narration.
    dst = os.environ.get('OUT') or os.path.join(os.path.dirname(__file__), '..', 'src', 'audio', 'narration.gen.ts')
    open(dst, 'w').write('\n'.join(out) + '\n')
    print('wrote', dst)
