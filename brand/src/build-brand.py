"""Generates the JongClub minimal logo set (SVG) from font outlines.

Usage: python3 brand/src/build-brand.py <cinzel.woff2> <noto-serif-tc-east.woff2>
Writes SVGs into brand/. PNG/ICO exports come from brand/src/render-brand.mjs.
The 東 glyph is Noto Serif TC Black (OFL), the wordmark is Cinzel SemiBold (OFL),
both converted to paths so no font is needed at runtime.
"""
import sys, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

GOLD_HI, GOLD, GOLD_LO = "#f0d9a0", "#c9a45c", "#8f6a2c"
IVORY, IVORY_LO = "#f6efdf", "#e2d5b8"
JADE, JADE_DEEP = "#1f6e3d", "#0f4a27"
FELT, FELT_DEEP = "#163128", "#0a1814"


def glyph_run(fontfile, text, size, tracking=0.0):
    f = TTFont(fontfile)
    gs, cmap, upm = f.getGlyphSet(), f.getBestCmap(), f["head"].unitsPerEm
    s, x, cmds = size / upm, 0.0, []
    bp = BoundsPen(gs)
    for ch in text:
        g = cmap[ord(ch)]
        pen = SVGPathPen(gs, ntos=lambda v: ("%.2f" % v).rstrip("0").rstrip("."))
        gs[g].draw(TransformPen(pen, (s, 0, 0, -s, x, 0)))
        gs[g].draw(TransformPen(bp, (s, 0, 0, -s, x, 0)))
        cmds.append(pen.getCommands())
        x += gs[g].width * s + tracking * size
    return " ".join(cmds), bp.bounds  # bounds: xmin, ymin, xmax, ymax (y down)


def fitted(fontfile, text, box_w, box_h, cx, cy, tracking=0.0):
    """Path for text scaled to fit box and centred on (cx, cy)."""
    _, (x0, y0, x1, y1) = glyph_run(fontfile, text, 1000, tracking)
    k = min(box_w / (x1 - x0), box_h / (y1 - y0))
    d, (x0, y0, x1, y1) = glyph_run(fontfile, text, 1000 * k, tracking)
    tx, ty = cx - (x0 + x1) / 2, cy - (y0 + y1) / 2
    return d, tx, ty, (x1 - x0), (y1 - y0)


def diamond(cx, cy, r):
    return f"M{cx} {cy - r}L{cx + r} {cy}L{cx} {cy + r}L{cx - r} {cy}Z"


def write(name, body):
    with open(os.path.join(OUT, name), "w") as fh:
        fh.write(body.strip() + "\n")
    print("wrote", name)


def main(cinzel, east_font):
    # ---- shared geometry on a 512 canvas -------------------------------
    C = 256
    R_OUT, R_IN = 236, 206          # ring radii
    TW, TH, TR = 194, 254, 24       # tile width/height/corner radius
    tx0, ty0 = C - TW / 2 - 6, C - TH / 2 - 6   # face sits up-left of its gold body
    DEPTH = 14
    east_d, ex, ey, _, _ = fitted(east_font, "東", TW * 0.66, TH * 0.70, tx0 + TW / 2, ty0 + TH / 2)
    # four NEWS diamonds sit on the ring at the cardinal points
    RM = (R_OUT + R_IN) / 2
    dia_outer = " ".join(diamond(C + dx, C + dy, 26) for dx, dy in [(0, -RM), (RM, 0), (0, RM), (-RM, 0)])
    dia_inner = " ".join(diamond(C + dx, C + dy, 11) for dx, dy in [(0, -RM), (RM, 0), (0, RM), (-RM, 0)])

    defs = f"""
  <defs>
    <linearGradient id="jcGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{GOLD_HI}"/><stop offset=".45" stop-color="{GOLD}"/><stop offset="1" stop-color="{GOLD_LO}"/>
    </linearGradient>
    <linearGradient id="jcIvory" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{IVORY}"/><stop offset="1" stop-color="{IVORY_LO}"/>
    </linearGradient>
    <linearGradient id="jcJade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{JADE}"/><stop offset="1" stop-color="{JADE_DEEP}"/>
    </linearGradient>
  </defs>"""

    ring = f"""
  <g fill="none" stroke="url(#jcGold)">
    <circle cx="{C}" cy="{C}" r="{R_OUT}" stroke-width="7"/>
    <circle cx="{C}" cy="{C}" r="{R_IN}" stroke-width="4"/>
  </g>
  <path d="{dia_outer}" fill="{FELT_DEEP}" stroke="url(#jcGold)" stroke-width="5" stroke-linejoin="round"/>
  <path d="{dia_inner}" fill="url(#jcGold)"/>"""

    tile = f"""
  <rect x="{tx0 + DEPTH}" y="{ty0 + DEPTH}" width="{TW}" height="{TH}" rx="{TR}" fill="url(#jcGold)"/>
  <rect x="{tx0}" y="{ty0}" width="{TW}" height="{TH}" rx="{TR}" fill="url(#jcIvory)"/>
  <path transform="translate({ex:.2f} {ey:.2f})" d="{east_d}" fill="url(#jcJade)" stroke="{GOLD}" stroke-width="3" paint-order="stroke"/>"""

    # 1. full-colour mark (transparent background, for dark surfaces)
    write("jongclub-mark.svg", f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="JongClub">{defs}{ring}{tile}
</svg>""")

    # 2. one-colour mark: everything in currentColor, tile face knocked out
    mono = f"""
  <defs>
    <mask id="jcCut">
      <rect width="512" height="512" fill="#fff"/>
      <path transform="translate({ex:.2f} {ey:.2f})" d="{east_d}" fill="#000"/>
    </mask>
  </defs>
  <g fill="none" stroke="currentColor">
    <circle cx="{C}" cy="{C}" r="{R_OUT}" stroke-width="8"/>
    <circle cx="{C}" cy="{C}" r="{R_IN}" stroke-width="5"/>
  </g>
  <path d="{dia_outer}" fill="currentColor"/>
  <rect x="{tx0}" y="{ty0}" width="{TW}" height="{TH}" rx="{TR}" fill="currentColor" mask="url(#jcCut)"/>"""
    write("jongclub-mark-mono.svg", f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="JongClub" color="#c9a45c">{mono}
</svg>""")

    # 3. tile glyph: just the tile, readable at 16px (favicon, tab icon, avatars)
    t2w, t2h = 360, 460
    gx, gy = 256 - t2w / 2 - 10, 256 - t2h / 2 - 10
    e2, e2x, e2y, _, _ = fitted(east_font, "東", t2w * 0.70, t2h * 0.72, gx + t2w / 2, gy + t2h / 2)
    write("jongclub-tile.svg", f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="JongClub">{defs}
  <rect x="{gx + 22}" y="{gy + 22}" width="{t2w}" height="{t2h}" rx="44" fill="url(#jcGold)"/>
  <rect x="{gx}" y="{gy}" width="{t2w}" height="{t2h}" rx="44" fill="url(#jcIvory)"/>
  <path transform="translate({e2x:.2f} {e2y:.2f})" d="{e2}" fill="url(#jcJade)"/>
</svg>""")

    # 4. app icon: felt square, ring and tile, no wordmark
    write("jongclub-app-icon.svg", f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="JongClub">{defs.replace('</defs>', f'''  <radialGradient id="jcFelt" cx=".5" cy=".38" r=".75">
      <stop offset="0" stop-color="{FELT}"/><stop offset="1" stop-color="{FELT_DEEP}"/>
    </radialGradient>
  </defs>''')}
  <rect width="512" height="512" rx="112" fill="url(#jcFelt)"/>
  <g transform="translate(256 256) scale(.9) translate(-256 -256)">{ring}{tile}
  </g>
</svg>""")

    # 5. wordmark (gold and one-colour), Cinzel with wide tracking like the logo
    wd, wx, wy, ww, wh = fitted(cinzel, "JONGCLUB", 1000, 120, 0, 0, tracking=0.22)
    pad = 4
    vb = f"{-ww / 2 - pad:.1f} {-wh / 2 - pad:.1f} {ww + 2 * pad:.1f} {wh + 2 * pad:.1f}"
    write("jongclub-wordmark.svg", f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="JongClub">
  <defs><linearGradient id="jcWm" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{GOLD_HI}"/><stop offset=".55" stop-color="{GOLD}"/><stop offset="1" stop-color="{GOLD_LO}"/>
  </linearGradient></defs>
  <path transform="translate({wx:.2f} {wy:.2f})" d="{wd}" fill="url(#jcWm)"/>
</svg>""")
    # 5b. embossed wordmark: bevelled gold letters set slightly into the surface,
    # like the lettering on the original logo. Use this one wherever JONGCLUB is shown.
    epad = 16
    evb = f"{-ww / 2 - epad:.1f} {-wh / 2 - epad:.1f} {ww + 2 * epad:.1f} {wh + 2 * epad:.1f}"
    write("jongclub-wordmark-embossed.svg", f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="{evb}" role="img" aria-label="JongClub">
  <defs>
    <linearGradient id="jcEmb" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff3cf"/><stop offset=".28" stop-color="#e9cf92"/>
      <stop offset=".55" stop-color="#c39a52"/><stop offset=".78" stop-color="#9a7234"/><stop offset="1" stop-color="#d9b874"/>
    </linearGradient>
    <filter id="jcBevel" x="-5%" y="-30%" width="110%" height="160%" color-interpolation-filters="sRGB">
      <!-- recess: a dark rim above and a faint light lip below, as if pressed into felt -->
      <feMorphology in="SourceAlpha" operator="dilate" radius="2.2" result="rim"/>
      <feOffset in="rim" dy="-1.6" result="rimUp"/>
      <feFlood flood-color="#000" flood-opacity=".75"/><feComposite in2="rimUp" operator="in" result="darkRim"/>
      <feOffset in="rim" dy="2.2" result="rimDown"/>
      <feFlood flood-color="#f6e2b0" flood-opacity=".22"/><feComposite in2="rimDown" operator="in" result="lightLip"/>
      <!-- bevel: lit from the upper left -->
      <feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="bump"/>
      <feSpecularLighting in="bump" surfaceScale="4" specularConstant=".9" specularExponent="22" lighting-color="#fff4d6" result="spec">
        <feDistantLight azimuth="235" elevation="48"/>
      </feSpecularLighting>
      <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
      <feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k1="0" k2="1" k3=".85" k4="0" result="lit"/>
      <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="soft"/>
      <feOffset in="soft" dx="1" dy="1.6" result="softOff"/>
      <feComposite in="SourceAlpha" in2="softOff" operator="out" result="innerHi"/>
      <feFlood flood-color="#fffbe8" flood-opacity=".55"/><feComposite in2="innerHi" operator="in" result="edgeHi"/>
      <feMerge><feMergeNode in="lightLip"/><feMergeNode in="darkRim"/><feMergeNode in="lit"/><feMergeNode in="edgeHi"/></feMerge>
    </filter>
  </defs>
  <path transform="translate({wx:.2f} {wy:.2f})" d="{wd}" fill="url(#jcEmb)" filter="url(#jcBevel)"/>
</svg>""")
    write("jongclub-wordmark-mono.svg", f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="JongClub" color="#c9a45c">
  <path transform="translate({wx:.2f} {wy:.2f})" d="{wd}" fill="currentColor"/>
</svg>""")

    # 6. horizontal lockup: mark + wordmark
    s = 120 / 512
    lw = 120 + 34 + ww * (54 / wh)
    write("jongclub-lockup.svg", f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {lw:.1f} 120" role="img" aria-label="JongClub">{defs}
  <g transform="scale({s:.5f})">{ring}{tile}
  </g>
  <g transform="translate({154 + ww * (54 / wh) / 2:.2f} 60) scale({54 / wh:.5f})">
    <path transform="translate({wx:.2f} {wy:.2f})" d="{wd}" fill="url(#jcGold)"/>
  </g>
</svg>""")

    # 7. stacked lockup, the minimal take on the original logo
    sw = 0.62
    write("jongclub-lockup-stacked.svg", f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 700" role="img" aria-label="JongClub">{defs}
  <g transform="translate(64 8)">{ring}{tile}
  </g>
  <g transform="translate(320 640) scale({sw})">
    <path transform="translate({wx:.2f} {wy:.2f})" d="{wd}" fill="url(#jcGold)"/>
  </g>
</svg>""")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
