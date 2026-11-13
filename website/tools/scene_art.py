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

HERE = "/tmp/claude-0/-home-user/3c149e02-453f-5db3-9c67-e9087aa306bb/scratchpad/art/tools"
SITE = os.path.normpath(os.path.join(HERE, ".."))
REFS = "/mnt/project-files/jongclub/website/refs"
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
    im = load("hero")[66:]
    o = 66
    im = fill_smooth(im, [(505, 418 - o, 1210, 540 - o), (615, 532 - o, 1095, 600 - o), (575, 600 - o, 1125, 672 - o)], edge=6)
    im = erase_glyphs(im, (660, 684 - o, 1046, 720 - o), v=95, grow=4, radius=5, blur=3)
    im = paint_out(im, [(563, 630, 657, 640), (1042, 630, 1138, 640)], radius=3, soften=False)
    im = paint_out(im, [(536, 676, 1160, 752)], radius=9)
    im = fill_smooth(im, [(528, 670, 1168, 758)], edge=10, noise=2.2)
    save(im, "hero")

def cards():
    im = load("regulars")
    os.makedirs(os.path.join(SITE, "cast"), exist_ok=True)
    names = ["mei", "rex", "hiro", "lucky", "amara", "friends"]
    for i, n in enumerate(names):
        x0 = [716, 1004, 1292][i % 3]; y0 = [106, 486][i // 3]
        c = im[y0:y0 + 370, x0:x0 + 278].copy()
        c = erase_glyphs(c, (40, 232, 238, 268), v=120, grow=3, radius=4, blur=1.5)
        c = erase_glyphs(c, (18, 266, 260, 342), v=105, grow=3, radius=4, blur=1.5)
        pil = Image.fromarray(cv2.cvtColor(c, cv2.COLOR_BGR2RGB))
        pil.save(os.path.join(SITE, "cast", n + ".png"))

hero(); cards()
