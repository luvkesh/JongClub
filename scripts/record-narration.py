"""Record Mei's narration with the open Kokoro TTS model (Apache-2.0) and embed it.

Usage: [OUT=src/audio/x.gen.ts] [SEED=1 [KEEP_SPECIAL=1]] [REDO=key,key] python3 scripts/record-narration.py <lines.json> <voice> [workdir]
  SEED=1 reuses the clips already recorded (lines with words from pronounce.py are re-synthesised unless
  KEEP_SPECIAL=1); REDO lists clip keys to synthesise again even when seeded (a clip found cut off, say).
  voice: a Kokoro voice id (e.g. zf_xiaoxiao) or a blend "a+b@w" (w = share of b).
Writes src/audio/narration.gen.<n>.ts parts (each under 50 MB, so GitHub accepts them) with every line as an
MP3 data URL keyed by clipKey(), and src/audio/narration.gen.ts, the index that merges the parts.
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

audio_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'audio')
# GitHub refuses files over 100 MB and warns over 50 MB, so the narration is written in parts.
PART_BYTES = 45 * 1024 * 1024


def narration_files():
    """The narration data files: the numbered parts narration.gen.<n>.ts, or an old single narration.gen.ts."""
    parts = sorted((f for f in os.listdir(audio_dir) if re.fullmatch(r'narration\.gen\.\d+\.ts', f)),
                   key=lambda f: int(f.split('.')[2]))
    return [os.path.join(audio_dir, f) for f in parts] or [os.path.join(audio_dir, 'narration.gen.ts')]


def write_narration_parts(entries, header):
    """Write src/audio/narration.gen.<n>.ts parts of at most PART_BYTES each and the index
    src/audio/narration.gen.ts that merges them; stale parts of an earlier, longer run are removed."""
    parts, size = [[]], 0
    for e in entries:
        if size + len(e) + 1 > PART_BYTES and parts[-1]:
            parts.append([])
            size = 0
        parts[-1].append(e)
        size += len(e) + 1
    for i, chunk in enumerate(parts):
        path = os.path.join(audio_dir, f'narration.gen.{i}.ts')
        open(path, 'w').write('\n'.join([f'{header} Part {i + 1} of {len(parts)}.',
                                         f"export const VOICE_NAME = {json.dumps(voice_spec)};",
                                         'export const CLIPS: Record<string, string> = {', *chunk, '};']) + '\n')
        print('wrote', path, f'({len(chunk)} clips)')
    for f in os.listdir(audio_dir):
        m = re.fullmatch(r'narration\.gen\.(\d+)\.ts', f)
        if m and int(m.group(1)) >= len(parts):
            os.remove(os.path.join(audio_dir, f))
    index = [f'{header} Index: the clips live in the numbered parts beside this file, each under 50 MB so GitHub accepts them.']
    index += [f"import {{ CLIPS as PART{i}{', VOICE_NAME' if i == 0 else ''} }} from './narration.gen.{i}';" for i in range(len(parts))]
    index += ['', 'export { VOICE_NAME };', '', 'export const CLIPS: Record<string, string> = {',
              *[f'  ...PART{i},' for i in range(len(parts))], '};']
    open(os.path.join(audio_dir, 'narration.gen.ts'), 'w').write('\n'.join(index) + '\n')
    print('wrote', os.path.join(audio_dir, 'narration.gen.ts'), f'({len(parts)} parts)')


# Seed the cache from the clips already recorded, so only new lines
# (and lines with words from pronounce.py) are synthesised.
redo = set(filter(None, os.environ.get('REDO', '').split(',')))
keep_special = os.environ.get('KEEP_SPECIAL') == '1'
for key in redo:
    for ext in ('.mp3', '.wav'):
        if os.path.exists(os.path.join(cache, key + ext)):
            os.remove(os.path.join(cache, key + ext))
if os.environ.get('SEED') == '1':
    have = {}
    # With OUT (the Atelier pitches), the clips already in that file seed it too.
    for gen in narration_files() + ([os.environ['OUT']] if os.environ.get('OUT') else []):
        if os.path.exists(gen):
            have.update(re.findall(r'"([0-9a-z]+)": \'data:audio/mpeg;base64,([^\']+)\'', open(gen).read()))
    seeded = 0
    for l in lines:
        key = clip_key(l)
        mp3 = os.path.join(cache, key + '.mp3')
        if key in have and key not in redo and (keep_special or not has_special(l)) and not os.path.exists(mp3):
            open(mp3, 'wb').write(base64.b64decode(have[key]))
            seeded += 1
    print('seeded', seeded, 'clips from the narration files', flush=True)

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
        # A clip must end in the silence padded after its last sentence; one that ends mid-word was cut off.
        pcm = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', mp3, '-ac', '1', '-f', 'f32le', '-'], capture_output=True).stdout, dtype=np.float32)
        if len(pcm) and np.sqrt(np.mean(pcm[-int(0.03 * sr):] ** 2)) > 10 ** (-50 / 20):
            print(f'WARNING {key} ends mid-sound (cut off?): listen to it and REDO={key}', flush=True)
        print(f'{i + 1}/{len(lines)} {key}', flush=True)

if shard[1] == 1 or only_render:
    missing = [l for l in lines if not os.path.exists(os.path.join(cache, clip_key(l) + '.mp3'))]
    if missing:
        sys.exit(f'{len(missing)} lines not recorded yet')
    header = "// Generated by scripts/record-narration.py: Mei's recorded lines as data URLs, keyed by clipKey(text)."
    entries = []
    for l in lines:
        key = clip_key(l)
        data = base64.b64encode(open(os.path.join(cache, key + '.mp3'), 'rb').read()).decode()
        entries.append(f"  {json.dumps(key)}: 'data:audio/mpeg;base64,{data}',")
    if os.environ.get('OUT'):
        # OUT writes another, smaller clip file as one module (e.g. src/audio/pitch.gen.ts, the Atelier pitches).
        dst = os.environ['OUT']
        open(dst, 'w').write('\n'.join([header, f"export const VOICE_NAME = {json.dumps(voice_spec)};",
                                        'export const CLIPS: Record<string, string> = {', *entries, '};']) + '\n')
        print('wrote', dst)
    else:
        write_narration_parts(entries, header)
