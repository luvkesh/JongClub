"""Pronunciation of the game's non-English words for the Kokoro recordings.

Kokoro reads text through an English phonemizer, which turns "Chi" into the
Greek letter ("kai"), spells out "Phỗng" and "Chiếu" letter by letter and
reads "Kan" and "Gang" as English words. Each word here is given as IPA in
the language it belongs to (Kokoro's phoneme set), and the rest of the line is
phonemized as English as before. Kokoro has no Vietnamese or tones, so the
Vietnamese words are the closest sounds it can make, without the tone.
"""
import re

# Japanese
JA = {
    'Chi': 'ʧˈiː', 'chi': 'ʧˈiː', 'Pon': 'pˈon', 'Kan': 'kˈɑn', 'Ron': 'ɾˈon', 'Tsumo': 'ʦˈumo',
    'Riichi': 'ɾˈiːʧi', 'riichi': 'ɾˈiːʧi', 'tenpai': 'tˈempai', 'yaku': 'jˈɑku', 'dora': 'dˈoɾa', 'furiten': 'fˈuɾiten',
    'yakuman': 'jˈɑkuman', 'shanten': 'ʃˈanten', 'suji': 'sˈuʤi', 'Pin': 'pˈin', 'Sou': 'sˈoː', 'Man': 'mˈɑn',
}
# Mandarin (pinyin calls), plus the three characters on the tiles.
ZH = {
    'Pong': 'pˈɔŋ', 'Peng': 'pʰˈəŋ', 'Gang': 'ɡˈɑŋ', 'Hu': 'hˈuː', 'Zimo': 'ʦˈɨ mˈwɔ',
    '萬': 'wˈɑn', '發': 'fˈɑ', '中': 'ʤˈʊŋ',
    # the winds and dragons by their Chinese names
    'Dong': 'dˈʊŋ', 'Nan': 'nˈɑn', 'Xi': 'ʃˈiː', 'Bei': 'bˈeɪ', 'Zhong': 'ʤˈʊŋ', 'Fa': 'fˈɑ', 'Bai': 'bˈaɪ',
}
# Chi in a Mandarin line (MCR, Sichuan, the pinyin calls) is 吃 chī.
ZH_CHI = 'ʈʂʰˈɻ'
# Vietnamese, closest sounds without tones.
VI = {
    'Ăn': 'ˈan', 'ăn': 'ˈan', 'Phỗng': 'fˈoŋ', 'Chiếu': 'ʧˈiəw', 'Ù': 'ˈuː', 'phán': 'fˈaːn', 'Phán': 'fˈaːn',
    'Xin chào': 'sˈin ʧˈaːw', 'Mạt chược': 'mˈaːt ʧˈɨək', 'Khung': 'kʰˈuŋ',
}
# Cantonese and others that English spelling gets wrong.
OTHER = {'faan': 'fˈɑːn', 'Faan': 'fˈɑːn', 'tai': 'tˈaɪ', 'han': 'hˈɑn', 'Han': 'hˈɑn',
         # India Rules
         'qwong': 'kwˈɒŋ', 'Qwong': 'kwˈɒŋ', 'crochet': 'kɹoʊʃˈeɪ', 'crochets': 'kɹoʊʃˈeɪz', 'Ulta Pulta': 'ˈʊltə pˈʊltə'}

WORDS = {**OTHER, **VI, **ZH, **JA}
_PAT = re.compile(r'(?<![\w])(' + '|'.join(sorted(map(re.escape, WORDS), key=len, reverse=True)) + r')(?![\w])')


def mandarin_line(text: str) -> bool:
    """A line using the Mandarin calls (Peng, Gang, Zimo) and not about Japan."""
    return bool(re.search(r'\b(Peng|Gang|Zimo|Sichuan)\b', text)) and 'Japan' not in text


def phonemes(text: str, phonemize) -> str:
    """IPA for a sentence: the special words from the tables above, the rest via `phonemize` (English)."""
    zh = mandarin_line(text)
    out, at = [], 0
    for m in _PAT.finditer(text):
        if m.start() > at:
            out.append(phonemize(text[at:m.start()]))
        w = m.group(1)
        out.append(ZH_CHI if zh and w in ('Chi', 'chi') else WORDS[w])
        at = m.end()
    if at < len(text):
        out.append(phonemize(text[at:]))
    s = ' '.join(x.strip() for x in out if x.strip())
    # Punctuation the English pass returned on its own sits against the word before it.
    return re.sub(r' ([,.!?;:…])', r'\1', s)


# The words the plain English pass got wrong: lines with any of them are re-recorded.
_WRONG = re.compile(r'(?<![\w])(Chi|chi|Pon|Kan|Gang|Peng|Pong|Hu|Zimo|Ăn|ăn|Phỗng|Chiếu|Ù|phán|Phán|Xin chào|Mạt chược|Khung|萬|發|中|Dong|Nan|Xi|Bei|Zhong|Fa|Bai|yakuman|shanten|suji|Pin|Sou|Man|qwong|Qwong|crochet|crochets|Ulta Pulta)(?![\w])')


def has_special(text: str) -> bool:
    return bool(_WRONG.search(text))
