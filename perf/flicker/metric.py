import sys, glob, numpy as np
from PIL import Image
prefix=sys.argv[1]
ld=lambda v:[np.asarray(Image.open(f).convert('L'),dtype=np.float32) for f in sorted(glob.glob(f'{prefix}-{v}-*.png')) if 'flick' not in f]
mask=None
try:
    b=ld('base')[0]; n=ld('norack')[0]; mask=np.abs(b-n)>6
    print('rack px', mask.sum())
except Exception as e: pass
for v in sys.argv[2].split(','):
    fs=ld(v)
    acc=np.zeros_like(fs[0])
    for i in range(1,len(fs)-1): acc+=np.abs(fs[i]-(fs[i-1]+fs[i+1])/2)
    acc/=len(fs)-2
    m = acc[mask] if mask is not None else acc
    print(v, 'all %.3f  rack mean %.3f p99 %.2f p999 %.2f'%(acc.mean(), m.mean(),np.percentile(m,99),np.percentile(m,99.9)))
    Image.fromarray(np.clip(acc*10,0,255).astype(np.uint8)).save(f'{prefix}-{v}-flick.png')
