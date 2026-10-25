"""Cuts the JongClub crest (the original logo without its lettering) into a round,
transparent medallion and the app icons built from it.

Usage: python3 brand/src/build-crest.py   (reads brand/source/jongclub-logo-original.png)
"""
import os
from PIL import Image, ImageDraw, ImageFilter

B = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
src = Image.open(os.path.join(B, "source", "jongclub-logo-original.png")).convert("RGB")
CX, CY, R = 1068, 872, 826          # crest centre and crop radius in the 2048px original
crop = src.crop((CX - R, CY - R, CX + R, CY + R))
N = crop.size[0]

# soft round edge: solid to 94% of the radius, feathered to the rim
mask = Image.new("L", (N, N), 0)
ImageDraw.Draw(mask).ellipse((N * 0.03, N * 0.03, N * 0.97, N * 0.97), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(N * 0.012))
crest = crop.convert("RGBA")
crest.putalpha(mask)

os.makedirs(os.path.join(B, "png"), exist_ok=True)
for s in (1024, 512, 256, 128, 64):
    im = crest.resize((s, s), Image.LANCZOS)
    im.save(os.path.join(B, "png", f"jongclub-crest-{s}.png"), optimize=True)
    im.save(os.path.join(B, "png", f"jongclub-crest-{s}.webp"), quality=90, method=6)

# app icons and favicons: the crest on its own felt, a full square
sq = crop.resize((1024, 1024), Image.LANCZOS)
for s in (1024, 512, 192, 180, 48, 32, 16):
    sq.resize((s, s), Image.LANCZOS).save(os.path.join(B, "png", f"jongclub-app-icon-{s}.png"), optimize=True)
sq.resize((256, 256), Image.LANCZOS).save(os.path.join(B, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
print("crest written")
