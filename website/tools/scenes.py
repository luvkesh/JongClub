#!/usr/bin/env python3
"""Builds the website's scene pictures from the user's section references (website/refs/*.png).

Each reference is a painted mock-up of one section with its words baked in. The page keeps the
painting and puts the real words back as HTML, so for every scene this tool paints out the
baked text (and anything the page draws itself), composites the game's real screens into the
laptop and tablet mock-ups, and cuts the small 3D objects out for the phone layout.

    python3 website/tools/scenes.py            # everything
    python3 website/tools/scenes.py hero club  # just those scenes

Writes website/scenes/<name>.jpg (+ -1200.jpg for phones) and website/assets/cut/<name>.webp.
"""
import os, sys
import numpy as np
import cv2
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.normpath(os.path.join(HERE, ".."))
REFS = os.path.join(SITE, "refs")
OUT = os.path.join(SITE, "scenes")
CUT = os.path.join(SITE, "assets", "cut")
os.makedirs(OUT, exist_ok=True)
os.makedirs(CUT, exist_ok=True)


def load(name):
    return cv2.cvtColor(np.array(Image.open(os.path.join(REFS, name + ".png")).convert("RGB")), cv2.COLOR_RGB2BGR)


def paint_out(img, rects, radius=9, soften=True):
    """Paints the baked words out: Telea inpainting, then a soft blur inside the patch so no streaks show."""
    mask = np.zeros(img.shape[:2], np.uint8)
    for x0, y0, x1, y1 in rects:
        cv2.rectangle(mask, (int(x0), int(y0)), (int(x1), int(y1)), 255, -1)
    out = cv2.inpaint(img, mask, radius, cv2.INPAINT_TELEA)
    if soften:
        blur = cv2.GaussianBlur(out, (0, 0), 7)
        m = cv2.erode(mask, np.ones((9, 9), np.uint8))
        m = cv2.GaussianBlur(m, (0, 0), 4).astype(np.float32)[..., None] / 255
        out = (out * (1 - m) + blur * m).astype(np.uint8)
    return out


def feather_mask(shape, rects, edge=10):
    m = np.zeros(shape[:2], np.float32)
    for x0, y0, x1, y1 in rects:
        m[int(y0):int(y1), int(x0):int(x1)] = 1
    return cv2.GaussianBlur(m, (0, 0), edge)[..., None] if edge else m[..., None]


def _ring(img, rect, r):
    """The blurred ring just outside a patch: the boundary values the smooth fill grows from."""
    x0, y0, x1, y1 = rect
    H, W = img.shape[:2]
    return img[max(0, y0 - r):min(H, y1 + r), max(0, x0 - r):min(W, x1 + r)]


def fill_smooth(img, rects, edge=8, noise=1.4, down=6):
    """Paints a patch of plain wall: the smoothest surface that meets the picture all round the patch
    (a membrane / harmonic fill, solved coarse to fine), plus a breath of grain so it is not dead flat.
    Patches are filled one after another, so a later patch can lean on an earlier fill."""
    img = img.copy()
    rng = np.random.default_rng(7)
    for rect in rects:
        x0, y0, x1, y1 = map(int, rect)
        w, h = x1 - x0, y1 - y0
        e = min(edge, h / 5, w / 5)  # a thin strip gets a thin feather, or its middle would show through
        reg = _ring(img.astype(np.float32), (x0, y0, x1, y1), down)
        ry0, rx0 = max(0, y0 - down), max(0, x0 - down)
        oy, ox = y0 - ry0, x0 - rx0
        f = None
        for d in [down * 4, down * 2, down]:
            sw, sh = max(3, round(reg.shape[1] / d)), max(3, round(reg.shape[0] / d))
            small = cv2.resize(reg, (sw, sh), interpolation=cv2.INTER_AREA)
            if f is None:
                f = small.copy()
            else:
                f = cv2.resize(f, (sw, sh), interpolation=cv2.INTER_LINEAR)
            # the boundary cells keep the picture, the inner cells relax to the average of their neighbours
            bx0, by0 = max(1, round(ox / d)), max(1, round(oy / d))
            bx1, by1 = min(sw - 1, round((ox + w) / d)), min(sh - 1, round((oy + h) / d))
            if bx1 <= bx0 or by1 <= by0:
                continue
            fixed = np.ones((sh, sw), bool); fixed[by0:by1, bx0:bx1] = False
            cur = f.copy(); cur[fixed] = small[fixed]
            n = int(min(4000, 3 * max(sw, sh) ** 2 / 4 + 200))
            for _ in range(n):
                nb = 0.25 * (np.roll(cur, 1, 0) + np.roll(cur, -1, 0) + np.roll(cur, 1, 1) + np.roll(cur, -1, 1))
                cur = np.where(fixed[..., None], cur, nb)
            f = cur
        full = cv2.resize(f, (reg.shape[1], reg.shape[0]), interpolation=cv2.INTER_CUBIC)
        patch = full[oy:oy + h, ox:ox + w]
        if noise:
            patch = patch + rng.normal(0, noise, (h, w, 1)).astype(np.float32)
        out = img.astype(np.float32)
        out[y0:y1, x0:x1] = patch
        m = feather_mask(img.shape, [(x0, y0, x1, y1)], e)
        img = (img.astype(np.float32) * (1 - m) + out * m).clip(0, 255).astype(np.uint8)
    return img


def fill_textured(img, rect, donor, edge=10, hp=9, gain=1.0):
    """Paints a patch of felt or cloth: a smooth fill for the lighting, with the weave borrowed
    from a donor patch of the same cloth nearby (mirror-tiled so no seam shows)."""
    x0, y0, x1, y1 = map(int, rect)
    w, h = x1 - x0, y1 - y0
    low = fill_smooth(img, [rect], edge=0, noise=0).astype(np.float32)
    dx0, dy0, dx1, dy1 = map(int, donor)
    D = img[dy0:dy1, dx0:dx1].astype(np.float32)
    tex = D - cv2.GaussianBlur(D, (0, 0), hp)
    # mirror-tile the weave over the patch
    ty = np.concatenate([tex, tex[::-1]], axis=0)
    tx = np.concatenate([ty, ty[:, ::-1]], axis=1)
    reps = (h // tx.shape[0] + 1, w // tx.shape[1] + 1, 1)
    tile = np.tile(tx, reps)[:h, :w]
    out = img.astype(np.float32).copy()
    out[y0:y1, x0:x1] = low[y0:y1, x0:x1] + tile * gain
    m = feather_mask(img.shape, [rect], edge)
    return (img.astype(np.float32) * (1 - m) + out * m).clip(0, 255).astype(np.uint8)


def erase_glyphs(img, rect, v=110, s=None, grow=3, radius=5, blur=2.2):
    """Paints out lettering that sits on a picture: only the letter strokes (the bright pixels, or the
    pale low-saturation ones with s=) are inpainted, so the picture behind them keeps its detail."""
    x0, y0, x1, y1 = map(int, rect)
    hsv = cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_BGR2HSV)
    m = hsv[..., 2] > v
    if s is not None:
        m &= hsv[..., 1] < s
    mask = np.zeros(img.shape[:2], np.uint8)
    mask[y0:y1, x0:x1] = m.astype(np.uint8) * 255
    mask = cv2.dilate(mask, np.ones((2 * grow + 1, 2 * grow + 1), np.uint8))
    out = cv2.inpaint(img, mask, radius, cv2.INPAINT_TELEA)
    soft = cv2.GaussianBlur(out, (0, 0), blur)
    mm = cv2.GaussianBlur(mask, (0, 0), 2).astype(np.float32)[..., None] / 255
    return (out * (1 - mm) + soft * mm).astype(np.uint8)


def clone(img, rect, dx=0, dy=0, edge=10):
    """Covers a patch with the same-sized patch beside it (felt from just below, for instance)."""
    x0, y0, x1, y1 = map(int, rect)
    out = img.astype(np.float32).copy()
    out[y0:y1, x0:x1] = img[y0 + dy:y1 + dy, x0 + dx:x1 + dx]
    m = feather_mask(img.shape, [rect], edge)
    return (img.astype(np.float32) * (1 - m) + out * m).clip(0, 255).astype(np.uint8)


def save(img, name, widths=(None, 1200), quality=86):
    """The scene at full size and a narrow copy for phones."""
    pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    for w in widths:
        im = pil
        suffix = ""
        if w and pil.width > w:
            im = pil.resize((w, round(pil.height * w / pil.width)), Image.LANCZOS)
            suffix = f"-{w}"
        im.save(os.path.join(OUT, f"{name}{suffix}.jpg"), quality=quality, optimize=True, progressive=True)
    print("scene", name, pil.size)


def screen(img, shot, quad, radius=0, crop=None):
    """Puts a real screenshot into a mock-up's screen: the shot is cropped to the screen's shape,
    warped onto its four corners and blended in with a soft edge (and rounded corners for the tablet)."""
    quad = np.float32(quad)
    w = int(max(np.linalg.norm(quad[1] - quad[0]), np.linalg.norm(quad[2] - quad[3])))
    h = int(max(np.linalg.norm(quad[3] - quad[0]), np.linalg.norm(quad[2] - quad[1])))
    s = cv2.cvtColor(np.array(Image.open(shot).convert("RGB")), cv2.COLOR_RGB2BGR)
    if crop:  # a region of the page, so the screen shows it larger
        x0, y0, x1, y1 = crop; s = s[y0:y1, x0:x1]
    # crop the shot to the screen's aspect, keeping its top (the game's header and title)
    sh, sw = s.shape[:2]
    if sw / sh > w / h:
        nw = int(sh * w / h); x = (sw - nw) // 2; s = s[:, x:x + nw]
    else:
        nh = int(sw * h / w); s = s[:nh]
    s = cv2.resize(s, (w * 2, h * 2), interpolation=cv2.INTER_AREA)
    s = cv2.resize(s, (w, h), interpolation=cv2.INTER_AREA)
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    M = cv2.getPerspectiveTransform(src, quad)
    H, W = img.shape[:2]
    warped = cv2.warpPerspective(s, M, (W, H), flags=cv2.INTER_LINEAR)
    m = np.zeros((h, w), np.float32)
    if radius:
        m8 = np.zeros((h, w), np.uint8)
        cv2.rectangle(m8, (radius, 0), (w - radius, h), 255, -1); cv2.rectangle(m8, (0, radius), (w, h - radius), 255, -1)
        for cx, cy in [(radius, radius), (w - radius, radius), (radius, h - radius), (w - radius, h - radius)]:
            cv2.circle(m8, (cx, cy), radius, 255, -1)
        m = m8.astype(np.float32) / 255
    else:
        m[:] = 1
    mask = cv2.warpPerspective(m, M, (W, H), flags=cv2.INTER_LINEAR)
    mask = cv2.GaussianBlur(mask, (0, 0), 0.8)[..., None]
    # the screen glows a little into the room, like a real display
    glow = cv2.GaussianBlur(mask[..., 0], (0, 0), 6)[..., None] * 0.08
    out = img.astype(np.float32)
    out = out * (1 - mask) + warped.astype(np.float32) * mask
    out = np.clip(out + glow * 255 * np.float32([0.45, 0.75, 0.55]), 0, 255)
    return out.astype(np.uint8)


def cut(img, name, box, pad=18, feather=22, size=None):
    """Cuts a small object out of a scene for the phone cards: a rectangle with soft edges,
    so it sits on any dark card without a visible seam."""
    x0, y0, x1, y1 = box
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(img.shape[1], x1 + pad), min(img.shape[0], y1 + pad)
    crop = img[y0:y1, x0:x1]
    h, w = crop.shape[:2]
    a = np.ones((h, w), np.float32)
    f = min(feather, w // 3, h // 3)
    ramp = np.linspace(0, 1, f, dtype=np.float32)
    a[:f, :] *= ramp[:, None]; a[-f:, :] *= ramp[::-1][:, None]
    a[:, :f] *= ramp[None, :]; a[:, -f:] *= ramp[::-1][None, :]
    rgba = np.dstack([cv2.cvtColor(crop, cv2.COLOR_BGR2RGB), (a * 255).astype(np.uint8)])
    im = Image.fromarray(rgba, "RGBA")
    if size and im.width > size:
        im = im.resize((size, round(im.height * size / im.width)), Image.LANCZOS)
    im.save(os.path.join(CUT, name + ".webp"), quality=88, method=6)
    print("cut", name, im.size)


def cut_alpha(img, name, box, size=None, soft=(18, 60), feather=1.2):
    """Cuts an object out with a real alpha channel: pixels close to the plain background colour
    (the median of the box's edge) fade out, so a flag or a stamp sits on any card without a halo."""
    x0, y0, x1, y1 = map(int, box)
    crop = img[y0:y1, x0:x1].astype(np.float32)
    ring = np.concatenate([crop[:3].reshape(-1, 3), crop[-3:].reshape(-1, 3), crop[:, :3].reshape(-1, 3), crop[:, -3:].reshape(-1, 3)])
    bg = np.median(ring, axis=0)
    dist = np.sqrt(((crop - bg) ** 2).sum(axis=2))
    lo, hi = soft
    a = ((dist - lo) / (hi - lo)).clip(0, 1)
    a = cv2.GaussianBlur(a, (0, 0), feather)
    # keep the object solid: fill holes inside the strongest pixels
    core = (a > 0.6).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(core, 8)
    if n > 1:
        big = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        mask = (lab == big).astype(np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
        a = np.maximum(a, cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 0.8) * 0.999)
    rgba = np.dstack([cv2.cvtColor(crop.astype(np.uint8), cv2.COLOR_BGR2RGB), (a * 255).astype(np.uint8)])
    im = Image.fromarray(rgba, "RGBA")
    if size and im.width > size:
        im = im.resize((size, round(im.height * size / im.width)), Image.LANCZOS)
    im.save(os.path.join(CUT, name + ".webp"), quality=90, method=6)
    print("cut_alpha", name, im.size)


def cut_disc(img, name, centre, r, feather=1.5, size=None):
    """Cuts a round object (a passport stamp) with a soft circular alpha edge."""
    cx, cy = centre
    x0, y0, x1, y1 = int(cx - r - 2), int(cy - r - 2), int(cx + r + 3), int(cy + r + 3)
    crop = img[y0:y1, x0:x1]
    h, w = crop.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt((xx - (cx - x0)) ** 2 + (yy - (cy - y0)) ** 2)
    a = ((r - d) / feather + 0.5).clip(0, 1).astype(np.float32)
    rgba = np.dstack([cv2.cvtColor(crop, cv2.COLOR_BGR2RGB), (a * 255).astype(np.uint8)])
    im = Image.fromarray(rgba, "RGBA")
    if size and im.width > size:
        im = im.resize((size, round(im.height * size / im.width)), Image.LANCZOS)
    im.save(os.path.join(CUT, name + ".webp"), quality=90, method=6)
    print("cut_disc", name, im.size)


def crop_scene(img, name, box, **kw):
    x0, y0, x1, y1 = box
    save(img[y0:y1, x0:x1], name, **kw)


SHOTS = os.path.join(SITE, "shots")


def hero():
    im = load("hero")
    im = im[66:]  # the mock-up's own menu bar; the page has a real one
    o = 66
    # the wall behind the wordmark and the words (the crest stays painted), the felt under the buttons
    im = fill_smooth(im, [(505, 418 - o, 1210, 540 - o), (615, 532 - o, 1095, 600 - o),
                          (575, 600 - o, 1125, 672 - o), (645, 680 - o, 1045, 722 - o)], edge=6)
    im = clone(im, (536, 736 - o, 1160, 816 - o), dy=84, edge=8)
    save(im, "hero")
    save(im[:, 380:1330], "hero-tall", widths=(900,))


def prologue():
    im = load("prologue")
    im = fill_textured(im, (245, 400, 910, 720), (905, 520, 1290, 700), edge=12)
    save(im, "prologue")


def regulars():
    im = load("regulars")
    im = fill_smooth(im, [(112, 148, 690, 648), (705, 52, 1612, 98), (700, 92, 1620, 872)], edge=8, down=8)
    save(im, "regulars")
    save(im[:, 0:700], "regulars-side", widths=(700,))


def learn():
    im = load("learn")
    for i, (name, x) in enumerate([("guided", 320), ("voiced", 600), ("placement", 895), ("drills", 1185), ("analysis", 1475)]):
        cut(im, "badge-" + name, (x - 62, 592, x + 62, 704), pad=6, feather=10, size=180)
    im = screen(im, os.path.join(SHOTS, "learn.jpg"), [(252, 91), (946, 97), (956, 502), (236, 500)], crop=(430, 0, 3170, 1600))
    im = fill_smooth(im, [(1050, 50, 1572, 535)], edge=8)
    im = erase_glyphs(im, (1560, 290, 1604, 480), v=110)
    im = fill_smooth(im, [(152, 690, 1650, 824)], edge=8)
    save(im, "learn")
    crop_scene(im, "learn-laptop", (120, 40, 1000, 600), widths=(900,))


def play():
    im = load("play")
    im = fill_smooth(im, [(50, 35, 480, 262), (480, 185, 668, 236)], edge=6)
    save(im[0:290], "play-top")
    save(im[1222:1331], "play-foot", widths=(None,))


def rounds():
    im = load("rounds")
    crop_scene(im, "ritual-tray", (640, 500, 1570, 800), widths=(900,))
    crop_scene(im, "rounds-stand", (600, 60, 1570, 470), widths=(900,))
    for name, box in [("tea", (118, 828, 186, 902)), ("gold", (578, 828, 650, 902)), ("dice", (1043, 828, 1115, 902))]:
        cut(im, "ritual-" + name, box, pad=4, feather=8, size=140)
    im = erase_glyphs(im, (420, 250, 625, 302), v=120, grow=4)
    im = fill_smooth(im, [(100, 55, 472, 302), (100, 296, 625, 432)], edge=6)
    im = fill_smooth(im, [(100, 536, 672, 815)], edge=8)
    # the wind names on the stand's plates and the words on the three side-table cards are set in HTML
    for x in (735, 921, 1106, 1292):
        im = erase_glyphs(im, (x + 6, 366, x + 130, 396), v=120, grow=3, radius=4, blur=1.5)
    for x0, x1 in ((200, 545), (670, 1000), (1140, 1470)):
        im = erase_glyphs(im, (x0, 832, x1, 905), v=105, grow=3, radius=4, blur=1.5)
    save(im[0:482], "rounds")
    save(im[482:1002], "ritual")


def interlude():
    im = load("interlude")
    im = erase_glyphs(im, (560, 20, 1320, 130), v=170, s=70, grow=4, radius=5, blur=3)
    im = fill_smooth(im, [(915, 22, 965, 80), (585, 95, 730, 106), (1150, 95, 1300, 106)], edge=4)
    im = erase_glyphs(im, (130, 468, 720, 712), v=115, grow=8, radius=8, blur=6)
    im = erase_glyphs(im, (700, 540, 950, 712), v=115, grow=8, radius=8, blur=6)
    save(im, "interlude")


def club():
    im = load("club")
    for name, box in [("ratings", (140, 632, 250, 732)), ("seasons", (565, 632, 670, 732)), ("tournaments", (965, 632, 1075, 736)), ("clubs", (1385, 632, 1505, 736))]:
        cut(im, "club-" + name, box, pad=8, feather=12, size=200)
    im = screen(im, os.path.join(SHOTS, "club.jpg"), [(256, 117), (943, 117), (945, 498), (255, 497)], radius=22, crop=(215, 180, 3385, 1941))
    im = fill_smooth(im, [(1028, 82, 1708, 518), (112, 615, 1770, 750)], edge=8, down=8)
    save(im, "club")
    crop_scene(im, "club-tablet", (130, 60, 1060, 610), widths=(900,))


def final():
    im = load("final")
    im = fill_smooth(im, [(600, 40, 1380, 700)], edge=12, down=8)
    save(im, "final")


def about():
    im = load("about")
    im = fill_smooth(im, [(232, 42, 945, 712), (1028, 318, 1372, 522)], edge=8, down=8)
    save(im[0:800], "about")
    crop_scene(im, "about-tile", (1150, 380, 1746, 800), widths=(900,))


def stats():
    im = load("stats")
    for name, cx in [("variations", 345), ("destinations", 830), ("tilesets", 1320), ("rooms", 1815)]:
        cut(im, "arch-" + name, (cx - 205, 50, cx + 205, 412), pad=0, feather=26, size=410)
    # the numbers and their words are the page's own (real counts)
    im = fill_smooth(im, [(cx - 135, 408, cx + 135, 604) for cx in (345, 830, 1320, 1815)], edge=8)
    save(im, "stats")


def details():
    im = load("details")
    for name, box in [("table", (100, 325, 300, 495)), ("frame", (515, 325, 690, 500)), ("avatar", (915, 330, 1095, 500)), ("accessory", (1305, 345, 1495, 500)),
                      ("winAnimation", (235, 585, 425, 765)), ("tableEffect", (700, 595, 890, 765)), ("sound", (1160, 590, 1340, 765))]:
        cut_alpha(im, "detail-" + name, box, soft=(14, 60), size=300)
    im = fill_smooth(im, [(432, 42, 1348, 288), (85, 310, 1700, 535), (200, 550, 1575, 780)], edge=8, down=8)
    save(im, "details")


def earn():
    im = load("earn")
    for name, box in [("coins", (285, 295, 495, 440)), ("calendar", (680, 280, 900, 440)), ("stamp", (1050, 290, 1290, 440)), ("tag", (1450, 280, 1670, 440))]:
        cut(im, "earn-" + name, box, pad=8, feather=14, size=320)
    im = fill_smooth(im, [(562, 32, 1410, 256), (260, 665, 1420, 725), (195, 255, 1750, 635)], edge=8, down=8)
    save(im, "earn")


def variations():
    im = load("variations")
    cut(im, "var-dish", (520, 55, 840, 268), pad=4, feather=14, size=400)
    cut_alpha(im, "var-waves", (478, 368, 598, 432), soft=(40, 100), size=240)
    cut_alpha(im, "var-city", (522, 470, 620, 553), soft=(40, 100), size=240)
    cut_alpha(im, "var-palm", (548, 604, 625, 660), soft=(40, 100), size=240)
    for name, x in [("hk", 135), ("jp", 310), ("tw", 479), ("us", 651), ("in", 825), ("ae", 997)]:
        cut_alpha(im, "flag-" + name, (x - 36, 856, x + 36, 908), soft=(16, 40), size=160)
    # passport stamps: the painted discs without their city names (the page writes those)
    for name, cx in [("hk", 541), ("jp", 671), ("tw", 800), ("ae", 929)]:
        st = erase_glyphs(im, (cx - 46, 1226, cx + 46, 1262), v=120, grow=2, radius=4, blur=1.5)
        cut_disc(st, "stamp-" + name, (cx, 1222), 54, size=160)
    # the top of the section as a backdrop: the spotlight and the dish stay, the words and cards go
    top = im[0:772].copy()
    top = erase_glyphs(top, (40, 262, 600, 296), v=120, grow=3, radius=4, blur=1.5)
    top = fill_smooth(top, [(30, 8, 240, 68), (1020, 12, 1100, 60), (40, 92, 525, 258), (40, 325, 705, 712), (712, 292, 1100, 720), (30, 755, 700, 772)], edge=8)
    save(top, "var-top", widths=(None,))
    im = fill_smooth(im, [(52, 1122, 468, 1302), (470, 1150, 1075, 1298)], edge=8)
    save(im[1100:1320, 40:1082], "var-tour", widths=(None,))


def minigames():
    im = load("minigames")
    for name, x in [("daily", 114), ("points", 450), ("levels", 788), ("rating", 1122)]:
        cut(im, "mg-" + name, (x - 34, 840, x + 34, 898), pad=4, feather=8, size=120)
    im = fill_smooth(im, [(560, 26, 880, 64), (470, 76, 975, 150), (660, 158, 740, 166), (365, 180, 1085, 225),
                          (302, 716, 1148, 788), (508, 952, 942, 1024)], edge=6)
    # the words on the four note cards are set in HTML over the painted cards
    for x0, x1 in ((158, 382), (500, 711), (842, 1053), (1171, 1382)):
        im = erase_glyphs(im, (x0, 838, x1, 900), v=105, grow=3, radius=4, blur=1.5)
    save(im, "minigames")


ALL = dict(hero=hero, prologue=prologue, regulars=regulars, learn=learn, play=play, rounds=rounds, interlude=interlude,
           club=club, final=final, about=about, stats=stats, details=details, earn=earn, variations=variations, minigames=minigames)
for k in (sys.argv[1:] or ALL):
    ALL[k]()
