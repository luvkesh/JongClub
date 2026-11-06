"""Draws the website's decorative SVGs into website/assets/deco/:
blossom.svg  a cherry-blossom branch for section corners (drawn, not a photo)
waves.svg    fine gold wave lines for the bottom corners of a section
Run: python3 website/tools/deco.py"""
import math, os, random

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "deco")
os.makedirs(OUT, exist_ok=True)
R = random.Random(7)
f = lambda v: f"{v:.1f}"


def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return tuple(u**3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t**3 * d for a, b, c, d in zip(p0, p1, p2, p3))


def limb(p0, p1, p2, p3, w0, w1, n=40):
    """A tapered branch as one filled outline along a cubic curve."""
    pts = [bez(p0, p1, p2, p3, i / n) for i in range(n + 1)]
    left, right = [], []
    for i, (x, y) in enumerate(pts):
        a = pts[max(i - 1, 0)]; b = pts[min(i + 1, n)]
        dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        w = (w0 + (w1 - w0) * i / n) / 2 * (1 + 0.12 * math.sin(i * 1.7))
        left.append((x + nx * w, y + ny * w)); right.append((x - nx * w, y - ny * w))
    d = "M" + " L".join(f"{f(x)},{f(y)}" for x, y in left) + " L" + " L".join(f"{f(x)},{f(y)}" for x, y in reversed(right)) + "Z"
    return d, pts


def petal(r):
    """One sakura petal pointing up from the centre, with the notch at its tip."""
    w = r * 0.62
    return (f"M0,0 C{f(-w*0.9)},{f(-r*0.2)} {f(-w*1.05)},{f(-r*0.85)} {f(-w*0.34)},{f(-r)} "
            f"L0,{f(-r*0.86)} L{f(w*0.34)},{f(-r)} C{f(w*1.05)},{f(-r*0.85)} {f(w*0.9)},{f(-r*0.2)} 0,0Z")


def flower(x, y, r, rot, blur=False, open_=1.0):
    sc = r / 30
    r = 30
    g = [f'<g transform="translate({f(x)},{f(y)}) rotate({f(rot)}) scale({sc:.3f})"{" filter=\"url(#soft)\" opacity=\"0.85\"" if blur else ""}>']
    # a darker under-layer gives the petals a little depth
    for k in range(5):
        a = k * 72 + 36
        g.append(f'<path d="{petal(r*0.9)}" transform="rotate({f(a)})" fill="#c9637f" opacity="0.55"/>')
    for k in range(5):
        a = k * 72 + R.uniform(-6, 6)
        rr = r * R.uniform(0.92, 1.05) * open_
        g.append(f'<path d="{petal(rr)}" transform="rotate({f(a)})" fill="url(#pet)" stroke="#d9849d" stroke-opacity="0.35" stroke-width="0.6"/>')
        g.append(f'<path d="M0,0 L0,{f(-rr*0.55)}" transform="rotate({f(a)})" stroke="#c25b7a" stroke-opacity="0.25" stroke-width="0.8"/>')
    g.append(f'<circle r="{f(r*0.26)}" fill="url(#eye)"/>')
    for k in range(14):
        a = math.radians(k * 360 / 14 + R.uniform(-8, 8)); L = r * R.uniform(0.34, 0.5)
        ex, ey = math.cos(a) * L, math.sin(a) * L
        g.append(f'<path d="M0,0 L{f(ex)},{f(ey)}" stroke="#b5476a" stroke-width="0.7" stroke-opacity="0.8"/><circle cx="{f(ex)}" cy="{f(ey)}" r="{f(r*0.045+0.6)}" fill="#f2c45a"/>')
    g.append("</g>")
    return "".join(g)


def bud(x, y, r, rot):
    return (f'<g transform="translate({f(x)},{f(y)}) rotate({f(rot)})"><ellipse cx="0" cy="{f(-r)}" rx="{f(r*0.62)}" ry="{f(r)}" fill="url(#bud)"/>'
            f'<path d="M{f(-r*0.5)},{f(-r*0.2)} Q0,{f(r*0.5)} {f(r*0.5)},{f(-r*0.2)} L0,{f(r*0.25)}Z" fill="#5a2a1e"/></g>')


def blossom():
    W, H = 760, 420
    parts = []
    # main limb from the top-left corner out to the right, with side twigs
    d, main = limb((-30, 40), (180, 30), (330, 120), (720, 150), 30, 3)
    parts.append(f'<path d="{d}" fill="url(#bark)"/>')
    twigs = [((0.22, -1), (110, -10), 9), ((0.38, 1), (120, 110), 7), ((0.55, -1), (140, -60), 6), ((0.7, 1), (110, 90), 5), ((0.45, -1), (60, -95), 5)]
    tips = [main[-1]]
    for (t, s), (dx, dy), w in twigs:
        p = main[int(t * 40)]
        p3 = (p[0] + dx, p[1] + dy)
        dd, pts = limb(p, (p[0] + dx * 0.3, p[1] + dy * 0.1), (p[0] + dx * 0.7, p[1] + dy * 0.8), p3, w, 1.5, 20)
        parts.append(f'<path d="{dd}" fill="url(#bark)"/>')
        tips.append(p3)
    # a fine highlight along the top of the main limb
    parts.append('<path d="M-20,32 C180,22 330,110 700,146" stroke="#b07a52" stroke-opacity="0.35" stroke-width="2" fill="none"/>')
    flowers = []
    for (x, y) in tips:
        flowers.append((x, y, R.uniform(24, 30)))
    for t in (0.08, 0.18, 0.3, 0.4, 0.5, 0.62, 0.72, 0.84, 0.94):
        x, y = main[int(t * 40)]
        flowers.append((x + R.uniform(-14, 14), y + R.uniform(-24, 20), R.uniform(18, 32)))
        if R.random() < 0.6:
            flowers.append((x + R.uniform(-30, 30), y + R.uniform(-34, 30), R.uniform(14, 22)))
    for (x, y, r) in flowers:
        parts.append(flower(x, y, r, R.uniform(0, 72)))
    for (x, y) in [(420, 70), (600, 120), (260, 150), (520, 210), (330, 30)]:
        parts.append(bud(x, y, R.uniform(7, 10), R.uniform(-60, 60)))
    # two out-of-focus flowers in front, for depth
    parts.append(flower(150, 120, 30, 20, blur=True))
    parts.append(flower(640, 70, 22, 50, blur=True, open_=0.9))
    # falling petals
    for (x, y, r, a) in [(560, 300, 22, 30), (700, 360, 18, -40), (380, 340, 16, 70)]:
        parts.append(f'<path d="{petal(30)}" transform="translate({x},{y}) rotate({a}) scale({r/30:.2f},{r/30*0.7:.2f})" fill="url(#pet)" opacity="0.9"/>')
    defs = """<defs>
<radialGradient id="pet" cx="0" cy="0" r="31" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#e86f93"/><stop offset="0.28" stop-color="#f7b3c6"/><stop offset="0.6" stop-color="#ffe3ea"/><stop offset="1" stop-color="#f7a8bf"/></radialGradient>
<radialGradient id="eye"><stop offset="0" stop-color="#9c2f52"/><stop offset="1" stop-color="#e2708f" stop-opacity="0"/></radialGradient>
<radialGradient id="bud" cx="0.4" cy="0.35"><stop offset="0" stop-color="#ffc2d2"/><stop offset="1" stop-color="#d2577c"/></radialGradient>
<linearGradient id="bark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4a32"/><stop offset="0.5" stop-color="#4a2a1c"/><stop offset="1" stop-color="#2a1610"/></linearGradient>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2"/></filter>
<filter id="shade" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity="0.45"/></filter>
</defs>"""
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{defs}<g filter="url(#shade)">{"".join(parts)}</g></svg>'
    open(os.path.join(OUT, "blossom.svg"), "w").write(svg)


def waves():
    W, H = 900, 260
    lines = []
    for i in range(7):
        y0 = 240 - i * 13
        amp = 26 + i * 6
        d = f"M0,{y0} C{180},{y0 - amp} {300},{y0 + amp*0.2} {470},{y0 - amp*0.9} S{760},{y0 - amp*1.9} {900},{y0 - amp*2.2}"
        op = 0.55 - i * 0.06
        lines.append(f'<path d="{d}" fill="none" stroke="url(#gw)" stroke-width="{1.4 - i*0.1:.2f}" stroke-opacity="{op:.2f}"/>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="none">'
           '<defs><linearGradient id="gw" x1="0" x2="1"><stop offset="0" stop-color="#cfa95f" stop-opacity="0"/><stop offset="0.35" stop-color="#f0d9a0"/><stop offset="1" stop-color="#cfa95f" stop-opacity="0.1"/></linearGradient></defs>'
           + "".join(lines) + "</svg>")
    open(os.path.join(OUT, "waves.svg"), "w").write(svg)


blossom()
waves()
print("wrote", os.listdir(OUT))
