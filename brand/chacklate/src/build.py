"""Chacklate Experiences placeholder mark (designed for JongClub; swap for the official logo).

Usage: python3 brand/chacklate/src/build.py <Cinzel-SemiBold.woff2> <Jost-Medium.woff2>
A square of chocolate with a bite out of one corner and a gold play mark
pressed into it, beside CHACKLATE / GAMES set as paths (Cinzel and Jost, OFL).
"""
import os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
GOLD_HI, GOLD, GOLD_LO = "#f0d9a0", "#cfa95f", "#8f6a2c"
COCOA_HI, COCOA, COCOA_LO = "#7a4a2c", "#4a2a19", "#24130b"
CREAM, INK = "#f3ecdc", "#2a170d"


def run(fontfile, text, size, tracking=0.0):
    f = TTFont(fontfile)
    gs, cmap, upm = f.getGlyphSet(), f.getBestCmap(), f["head"].unitsPerEm
    s, x, cmds, bp = size / upm, 0.0, [], BoundsPen(f.getGlyphSet())
    for ch in text:
        g = cmap[ord(ch)]
        pen = SVGPathPen(gs, ntos=lambda v: ("%.2f" % v).rstrip("0").rstrip("."))
        gs[g].draw(TransformPen(pen, (s, 0, 0, -s, x, 0)))
        gs[g].draw(TransformPen(bp, (s, 0, 0, -s, x, 0)))
        cmds.append(pen.getCommands())
        x += gs[g].width * s + tracking * size
    return " ".join(cmds), bp.bounds


def placed(fontfile, text, height, tracking, left, cy):
    _, (x0, y0, x1, y1) = run(fontfile, text, 1000, tracking)
    k = height / (y1 - y0)
    d, (x0, y0, x1, y1) = run(fontfile, text, 1000 * k, tracking)
    return d, left - x0, cy - (y0 + y1) / 2, x1 - x0


def _path(geom):
    """A shapely (Multi)Polygon as one SVG path (even-odd)."""
    polys = getattr(geom, "geoms", [geom])
    f = lambda v: ("%.2f" % v).rstrip("0").rstrip(".")
    out = []
    for p in polys:
        for ring in [p.exterior, *p.interiors]:
            pts = list(ring.coords)[:-1]
            out.append("M" + "L".join(f"{f(x)} {f(y)}" for x, y in pts) + "Z")
    return "".join(out)


def _shapes():
    """The bite is cut out of the geometry itself (no mask), so it shows in every renderer and at every size."""
    from shapely.geometry import box, Point, LineString
    from shapely.ops import unary_union
    rr = lambda a, r: box(a + r, a + r, 240 - a - r, 240 - a - r).buffer(r, quad_segs=24)
    bite = unary_union([Point(214, 26).buffer(40, quad_segs=32), Point(178, 12).buffer(16, quad_segs=16), Point(230, 62).buffer(16, quad_segs=16)])
    body = rr(10, 34).difference(bite)
    rim = body.difference(body.buffer(-3, quad_segs=16))
    hole = bite.buffer(26, quad_segs=24)
    panel = rr(36, 20).difference(hole)
    edge = lambda pts: LineString(pts).buffer(1.5, cap_style=2)
    # shade on the panel's top and right, light on its bottom and left
    shade = edge([(56, 36), (184, 36), (198, 42), (204, 56)]).intersection(panel.buffer(1.6)).difference(hole)
    light = edge([(204, 184), (198, 198), (184, 204), (56, 204), (42, 198), (36, 184)]).intersection(panel.buffer(1.6))
    return {k: _path(v) for k, v in dict(body=body, rim=rim, panel=panel, shade=shade, light=light).items()}


PLAY = "M104 82L166 120L104 158Z"


def mark(uid, mono=None):
    """The chocolate square on a 240 box (origin top-left)."""
    g = _shapes()
    if mono:
        return f'''<path fill="{mono}" fill-rule="evenodd" d="{g['rim']}"/><path fill="{mono}" fill-rule="evenodd" d="{g['panel']}" opacity=".35"/><path fill="{mono}" d="{PLAY}"/>'''
    return f'''<defs>
<linearGradient id="{uid}c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{COCOA_HI}"/><stop offset=".55" stop-color="{COCOA}"/><stop offset="1" stop-color="{COCOA_LO}"/></linearGradient>
<linearGradient id="{uid}p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{COCOA}"/><stop offset="1" stop-color="{COCOA_HI}"/></linearGradient>
<linearGradient id="{uid}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{GOLD_HI}"/><stop offset=".5" stop-color="{GOLD}"/><stop offset="1" stop-color="{GOLD_LO}"/></linearGradient>
</defs>
<path fill="url(#{uid}c)" fill-rule="evenodd" d="{g['body']}"/>
<path fill="url(#{uid}g)" fill-rule="evenodd" d="{g['rim']}"/>
<path fill="url(#{uid}p)" fill-rule="evenodd" d="{g['panel']}"/>
<path fill="#000" fill-opacity=".35" d="{g['shade']}"/>
<path fill="#fff" fill-opacity=".12" d="{g['light']}"/>
<path d="{PLAY}" fill="url(#{uid}g)" stroke="{GOLD_HI}" stroke-opacity=".6" stroke-width="1.5" stroke-linejoin="round"/>'''


def lockup(cinzel, jost, text_fill, gold, uid, mono=None):
    d1, tx1, ty1, w1 = placed(cinzel, "CHACKLATE", 66, 0.12, 290, 98)
    d2, tx2, ty2, w2 = placed(jost, "EXPERIENCES", 22, 0.62, 290, 166)
    W = int(290 + max(w1, w2) + 20)
    line_x = 290 + w2 + 26
    body = mark(uid, mono)
    return W, f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} 240" width="{W}" height="240" role="img" aria-label="Chacklate Experiences">
{body}
<path fill="{text_fill}" transform="translate({tx1:.2f} {ty1:.2f})" d="{d1}"/>
<path fill="{gold}" transform="translate({tx2:.2f} {ty2:.2f})" d="{d2}"/>
<rect x="{line_x:.1f}" y="165" width="{W - line_x - 20:.1f}" height="2" fill="{gold}" opacity=".7"/>
</svg>'''


def main(cinzel, jost):
    os.makedirs(OUT, exist_ok=True)
    def w(name, s):
        open(os.path.join(OUT, name), "w").write(s.strip() + "\n"); print("wrote", name)
    w("chacklate-mark.svg", f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" role="img" aria-label="Chacklate Experiences">{mark("m")}</svg>')
    w("chacklate-mark-mono.svg", f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" role="img" aria-label="Chacklate Experiences" style="color:{GOLD}">{mark("mm", "currentColor")}</svg>')
    _, s = lockup(cinzel, jost, CREAM, GOLD, "d"); w("chacklate-logo-dark-bg.svg", s)
    _, s = lockup(cinzel, jost, INK, GOLD_LO, "l"); w("chacklate-logo-light-bg.svg", s)
    _, s = lockup(cinzel, jost, "currentColor", "currentColor", "o", "currentColor"); w("chacklate-logo-mono.svg", s.replace('role="img"', f'role="img" style="color:{GOLD}"'))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
