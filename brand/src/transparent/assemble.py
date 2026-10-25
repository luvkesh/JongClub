import re
def paths(n):
    s = open(n).read()
    out = []
    for m in re.finditer(r'<path d="([^"]+)" fill="#000000" transform="translate\(([-\d.]+),([-\d.]+)\)"/>', s):
        out.append(f'<path d="{m.group(1).strip()}" transform="translate({m.group(2)} {m.group(3)})"/>')
    return '\n'.join(out)
S = 1558
defs = '''<defs>
<linearGradient id="jcGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e2a6"/><stop offset=".45" stop-color="#c9a45c"/><stop offset=".7" stop-color="#e7c983"/><stop offset="1" stop-color="#8f6a2c"/></linearGradient>
<linearGradient id="jcBase" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9cd86"/><stop offset=".55" stop-color="#b68b3e"/><stop offset="1" stop-color="#6e4a1c"/></linearGradient>
<radialGradient id="jcIvory" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#fbf6e9"/><stop offset=".7" stop-color="#eee3c8"/><stop offset="1" stop-color="#d9c9a4"/></radialGradient>
<linearGradient id="jcJade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f8f56"/><stop offset="1" stop-color="#11502c"/></linearGradient>
</defs>'''
color = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" width="{S}" height="{S}">
<title>JongClub crest</title>
{defs}
<g fill="url(#jcGold)">{paths('L-lines.svg')}</g>
<g fill="url(#jcBase)">{paths('L-tile.svg')}</g>
<g fill="url(#jcIvory)">{paths('L-face.svg')}</g>
<g fill="#d4b061">{paths('L-charo.svg')}</g>
<g fill="url(#jcJade)">{paths('L-char.svg')}</g>
</svg>'''
open('crest-vector.svg', 'w').write(color)
mono = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" width="{S}" height="{S}">
<title>JongClub crest, one colour</title>
<g fill="currentColor" style="color:#c9a45c">{paths('mono1.svg')}</g>
</svg>'''
open('crest-mono.svg', 'w').write(mono)

def inner_svg(path, x, y, w, h):
    s = open(path).read()
    s = re.sub(r'<metadata>.*?</metadata>', '', s, flags=re.S)
    s = re.sub(r'\s*xmlns:c2pa="[^"]*"', '', s)
    s = s.replace('<svg ', f'<svg x="{x}" y="{y}" width="{w}" height="{h}" ', 1)
    s = re.sub(r'\s(role|aria-label)="[^"]*"', '', s, count=2)
    return s
def body(svg):
    return svg.split('>', 1)[1].rsplit('</svg>', 1)[0]
B = '/home/user/jongclub/brand/'
WW = 1400; WH = round(WW * 152 / 979.2); GAP = 70; TH = S + GAP + WH + 10
lock = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {TH}" width="{S}" height="{TH}">
<title>JongClub</title>
{body(color).replace('<title>JongClub crest</title>', '')}
{inner_svg(B + 'jongclub-wordmark-embossed.svg', (S - WW) // 2, S + GAP, WW, WH)}
</svg>'''
open('lockup-vector.svg', 'w').write(lock)
WH2 = round(WW * 128 / 955.2)
lockm = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S + GAP + WH2 + 10}" width="{S}" height="{S + GAP + WH2 + 10}" style="color:#c9a45c">
<title>JongClub, one colour</title>
<g fill="currentColor">{paths('mono1.svg')}</g>
{inner_svg(B + 'jongclub-wordmark-mono.svg', (S - WW) // 2, S + GAP, WW, WH2).replace(' color="#c9a45c"', '')}
</svg>'''
open('lockup-mono.svg', 'w').write(lockm)
print(S, TH)
