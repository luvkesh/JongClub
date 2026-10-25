#!/usr/bin/env python3
"""Three-way file sync between local copy and shared folder using a base snapshot.
usage: jsync.py pull|push|status"""
import os, sys, shutil, filecmp
L='/home/user/jongclub'; S='/mnt/project-files/jongclub'; B='/tmp/claude-0/jbase'
SKIP_DIRS={'node_modules','dist','dist-artifact','dist-standalone','.git','previews','docs'}
def files(root):
    out=set()
    if not os.path.isdir(root): return out
    for d,ds,fs in os.walk(root):
        ds[:]=[x for x in ds if x not in SKIP_DIRS]
        for f in fs:
            r=os.path.relpath(os.path.join(d,f),root)
            if r=='JongClub-standalone.html': continue
            out.add(r)
    return out
def same(a,b):
    ea,eb=os.path.exists(a),os.path.exists(b)
    if ea!=eb: return False
    return (not ea) or filecmp.cmp(a,b,shallow=False)
def cp(src,dst):
    if os.path.exists(src):
        os.makedirs(os.path.dirname(dst),exist_ok=True); shutil.copy2(src,dst)
    elif os.path.exists(dst): os.remove(dst)
mode=sys.argv[1]
allf=files(L)|files(S)|files(B)
for f in sorted(allf):
    l,s,b=(os.path.join(x,f) for x in (L,S,B))
    lc=not same(l,b); sc=not same(s,b)
    if mode=='pull' and sc:
        if lc and not same(l,s):
            import subprocess
            if not (os.path.exists(l) and os.path.exists(s) and os.path.exists(b)): print('BOTH CHANGED',f); continue
            r=subprocess.run(['git','merge-file','-p',l,b,s],capture_output=True)
            if r.returncode!=0: print('MERGE CONFLICT',f); continue
            open(l,'wb').write(r.stdout); cp(s,b); print('merged',f); continue
        cp(s,l); cp(s,b); print('pulled',f)
    elif mode=='push' and lc:
        if sc and not same(l,s): print('CONFLICT (shared changed too)',f); continue
        cp(l,s); cp(l,b); print('pushed',f)
    elif mode=='status' and (lc or sc): print(('L' if lc else ' ')+('S' if sc else ' '),f)
