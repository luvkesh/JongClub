"""Speech levels shared by the record scripts: measure how loud the spoken part of a clip is, and level clips to a target.

active_db(): RMS (dBFS) of the 20 ms frames within 25 dB of the loudest frame, so pauses and
short clips do not skew it the way loudnorm's integrated loudness does on clips under a second.
Mei’s narration (loudnorm I=-18) measures about -17 dB this way; the callers are levelled to sit
just above her: discards at CALL_DISCARD_DB, claims and wins at CALL_SHOUT_DB.
"""
import subprocess
import numpy as np

CALL_DISCARD_DB = -15.0
CALL_SHOUT_DB = -13.0


def decode(path, sr=24000):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.float32)


def active_db(x, sr=24000):
    fr = int(0.02 * sr)
    n = len(x) // fr
    if n == 0:
        return -120.0
    e = (x[: n * fr].reshape(n, fr) ** 2).mean(1)
    edb = 10 * np.log10(e + 1e-12)
    keep = e[edb > edb.max() - 25]
    return float(10 * np.log10(keep.mean() + 1e-12))


def level(src, dst, target_db, bitrate='48k'):
    """Re-encode `src` to `dst` with its speech at `target_db`, peaks held under -1 dBFS."""
    gain = target_db - active_db(decode(src))
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-af', f'volume={gain:.2f}dB,alimiter=limit=0.89:attack=2:release=40:level=disabled',
                    '-ac', '1', '-ar', '24000', '-b:a', bitrate, dst], check=True)
    return gain
