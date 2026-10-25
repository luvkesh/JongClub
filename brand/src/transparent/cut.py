import numpy as np
from PIL import Image
from scipy import ndimage as ndi
src = np.asarray(Image.open('/home/user/jongclub/brand/source/jongclub-logo-original.png').convert('RGB')).astype(np.float32)
H, W, _ = src.shape
# background estimate: low percentile in a wide window, on a downscaled copy
small = np.asarray(Image.fromarray(src.astype(np.uint8)).resize((256, 256), Image.BILINEAR)).astype(np.float32)
lum = small.mean(2)
bgS = np.zeros_like(small)
for c in range(3):
    bgS[..., c] = ndi.percentile_filter(small[..., c], 25, size=17)
bgS = ndi.gaussian_filter(bgS, (6, 6, 0))
bg = np.asarray(Image.fromarray(np.clip(bgS, 0, 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)).astype(np.float32)
d = src - bg
dist = np.sqrt((np.clip(d, 0, None) ** 2).sum(2))   # only lighter than the ground counts
T0, T1 = 34.0, 78.0
alpha = np.clip((dist - T0) / (T1 - T0), 0, 1)
yy, xx = np.mgrid[0:H, 0:W]
r = np.hypot(yy - 872, xx - 1068)
alpha = np.where(r < 800, alpha, np.where(yy > 1640, alpha, 0))
# drop isolated specks (texture)
keep = ndi.binary_opening(alpha > 0.35, iterations=1)
lab2, n2 = ndi.label(ndi.binary_dilation(keep, iterations=2))
sizes = ndi.sum(np.ones_like(alpha), lab2, range(1, n2 + 1))
big = np.isin(lab2, 1 + np.nonzero(sizes > 400)[0])
alpha = alpha * ndi.gaussian_filter(big.astype(np.float32), 0.8)
# the tile: one solid blob
strong = dist > 60
lab, n = ndi.label(strong)
cy, cx = 872 - 0, 1068
box = lab[500:1200, 800:1330]
ids, cnt = np.unique(box[box > 0], return_counts=True)
tid = ids[cnt.argmax()]
print('tile label', tid)
tile = ndi.binary_fill_holes(lab == tid)
tile = ndi.binary_closing(tile, iterations=22)
tile = ndi.binary_fill_holes(tile)
# include the green bottom edge just under the tile
tile = ndi.binary_fill_holes(tile)
from scipy.spatial import ConvexHull
from PIL import ImageDraw
ys, xs = np.nonzero(tile)
pts = np.c_[np.r_[xs, xs + 7], np.r_[ys, ys + 13]]
hull = pts[ConvexHull(pts).vertices]
mk = Image.new('L', (W, H), 0); ImageDraw.Draw(mk).polygon([tuple(map(float, q)) for q in hull], fill=255)
tile = np.asarray(mk) > 0
box = (yy >= ys.min() - 4) & (yy <= ys.max() + 16) & (xx >= xs.min() - 4) & (xx <= xs.max() + 10)
low = box & (dist > 16)
tile = ndi.binary_fill_holes(ndi.binary_opening(tile | low, iterations=2))
print('tile bbox', ys.min(), ys.max(), xs.min(), xs.max())
alpha = ndi.median_filter(alpha, size=5)
alpha = alpha * alpha * (3 - 2 * alpha)
ta = ndi.gaussian_filter(tile.astype(np.float32), 1.2)
alpha = np.maximum(alpha, ta)
a = np.maximum(alpha, 1e-4)[..., None]
col = np.where(ta[..., None] > 0.5, src, bg + d / a)
col = np.clip(col, 0, 255)
out = np.dstack([col, alpha * 255]).astype(np.uint8)
im = Image.fromarray(out, 'RGBA')
# split: crest only (above the wordmark) and full
crest = im.crop((1068 - 826, 872 - 826, 1068 + 826, 872 + 826))
crest.save('crest-full.png')
im.save('full.png')
Image.fromarray((tile * 255).astype(np.uint8)).save('tile-mask.png')

# ---- exports
crestA = alpha.copy(); crestA[yy > 1700] = 0
ys, xs = np.nonzero(crestA > 0.02)
pad = 24
y0, y1, x0, x1 = ys.min() - pad, ys.max() + pad, xs.min() - pad, xs.max() + pad
side = max(y1 - y0, x1 - x0); cyy, cxx = (y0 + y1) // 2, (x0 + x1) // 2
box = (cxx - side // 2, cyy - side // 2, cxx - side // 2 + side, cyy - side // 2 + side)
print('crest box', box, side)
tight = Image.fromarray(np.dstack([col, crestA * 255]).astype(np.uint8), 'RGBA').crop(box)
tight.save('crest-tight.png')
# mono: gold lines, the tile's rim and its character
inner = ndi.binary_erosion(tile, iterations=16)
rim = tile & ~inner
g = src[..., 1] - np.maximum(src[..., 0], src[..., 2])
char = inner & ndi.binary_opening(g > 18, iterations=1)
lines = (crestA > 0.5) & ~tile
mono = lines | rim | char
mono[yy > 1700] = False
Image.fromarray(np.where(mono, 0, 255).astype(np.uint8)).crop(box).save('mono-mask.png')

# ---- layer masks for the vector crest (crest box coordinates)
x0b, y0b, x1b, y1b = box
def save_mask(m, name):
    Image.fromarray(np.where(m, 0, 255).astype(np.uint8)).crop(box).filter(__import__('PIL.ImageFilter', fromlist=['x']).GaussianBlur(1.0)).point(lambda v: 0 if v < 128 else 255).save(name)
mx = src.max(2); mn = src.min(2)
face = tile & (mx > 135) & ((mx - mn) < 58)
face = ndi.binary_fill_holes(ndi.binary_closing(face, iterations=4))
face = ndi.binary_opening(face, iterations=3)
lab3, n3 = ndi.label(face); sz = ndi.sum(face, lab3, range(1, n3 + 1)); face = lab3 == (1 + sz.argmax())
face = ndi.binary_fill_holes(face)
charg = inner & (g > 14)
charg = ndi.binary_opening(charg, iterations=1)
# gold outline round the character: gold pixels just outside it
goldish = (src[..., 0] > src[..., 2] + 25) & (mx > 110)
charo = ndi.binary_dilation(charg, iterations=6)
save_mask(lines, 'L-lines.png'); save_mask(tile, 'L-tile.png'); save_mask(face, 'L-face.png'); save_mask(charg, 'L-char.png'); save_mask(charo, 'L-charo.png')
