"""The JongClub tile, modelled in Blender (bpy): a rounded block bevelled on every edge and split flush
into the face layer and the coloured back, a domed metal bezel round the face, and the face plate.

Used two ways:
  * export: `python tile_model.py export OUT.json` writes the meshes (two levels of detail) that
    src/render/tileMesh.gen.ts carries into the game, so every 3D tile is Blender's tile;
  * build_tile(): the same tile as Blender objects, for the Cycles renders (tile_render.py).
Units are the game's (a tile is 0.3 x 0.4 x 0.22); the face is toward +Z.
"""
import math, json, sys
import bpy, bmesh
from mathutils import Vector

TW, TH, TD = 0.3, 0.4, 0.22
EDGE_R = 0.03
BODY_Z0, BODY_Z1 = TD / 2 - TD * 0.64, TD / 2
FACE_HW, FACE_HH, FACE_R, FACE_LIFT = 0.116, 0.161, 0.016, 0.0012
# The bezel: a domed band whose inner foot tucks just under the face plate's edge.
RIM_CX, RIM_CY = 0.1185, 0.1635   # half sizes of the band's centre line
RIM_CR = 0.0195                   # corner radius of the centre line
RIM_HW = 0.0034                   # half width of the band
RIM_H = 0.0028                   # height of the dome above the front
RIM_SINK = 0.0004                 # the band's feet sit this far into the front, so no gap shows

LODS = {'lo': dict(bevel=3, corner=5, profile=5), 'hi': dict(bevel=8, corner=12, profile=12)}


def block_bmesh(seg):
    """Rounded block, cut at the layer line. Returns bmesh with faces tagged by layer (0 body, 1 back)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * TW, v.co.y * TH, v.co.z * TD))
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=EDGE_R, offset_type='OFFSET', segments=seg,
                    profile=0.5, affect='EDGES', clamp_overlap=True)
    # The layer line: a straight cut through the block, both halves keep their faces.
    geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, BODY_Z0), plane_no=(0, 0, 1))
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    return bm


def block_normal(p):
    """Exact normal of the rounded block: from the nearest point of the inner box."""
    hx, hy, hz = TW / 2 - EDGE_R, TH / 2 - EDGE_R, TD / 2 - EDGE_R
    q = Vector((max(-hx, min(hx, p.x)), max(-hy, min(hy, p.y)), max(-hz, min(hz, p.z))))
    d = p - q
    return d.normalized() if d.length > 1e-9 else Vector((0, 0, 1))


def rim_path(corner):
    """Centre line of the bezel: a rounded rectangle, counter-clockwise, as (point, outward normal)."""
    pts = []
    for cx, cy, a0 in ((RIM_CX - RIM_CR, RIM_CY - RIM_CR, 0), (-(RIM_CX - RIM_CR), RIM_CY - RIM_CR, 90),
                       (-(RIM_CX - RIM_CR), -(RIM_CY - RIM_CR), 180), (RIM_CX - RIM_CR, -(RIM_CY - RIM_CR), 270)):
        for i in range(corner + 1):
            a = math.radians(a0 + 90 * i / corner)
            n = (math.cos(a), math.sin(a))
            pts.append(((cx + RIM_CR * n[0], cy + RIM_CR * n[1]), n))
    return pts


def rim_mesh(corner, profile):
    """The bezel swept along its path; profile is a half ellipse (feet sunk RIM_SINK into the front).
    Returns (verts, normals, tris)."""
    path = rim_path(corner)
    prof = []
    for j in range(profile + 1):
        t = math.pi * j / profile           # 0 = outer foot, pi = inner foot
        s, c = math.sin(t), math.cos(t)
        off = RIM_HW * c                    # outward offset from the centre line
        z = (RIM_H + RIM_SINK) * s - RIM_SINK
        # normal of the ellipse (a = RIM_HW across, b = height up)
        nx, nz = c / RIM_HW, s / (RIM_H + RIM_SINK)
        l = math.hypot(nx, nz)
        prof.append((off, z, nx / l, nz / l))
    verts, norms, tris = [], [], []
    for (p, n) in path:
        for off, z, nx, nz in prof:
            verts.append((p[0] + n[0] * off, p[1] + n[1] * off, BODY_Z1 + z))
            norms.append((n[0] * nx, n[1] * nx, nz))
    P, R = len(path), len(prof)
    for i in range(P):
        i2 = (i + 1) % P
        for j in range(R - 1):
            a, b, c, d = i * R + j, i2 * R + j, i2 * R + j + 1, i * R + j + 1
            tris += [(a, b, c), (a, c, d)]
    return verts, norms, tris


def plate_mesh(n=8):
    """The face plate: a rounded rectangle with 0..1 UVs (dense enough for Cycles displacement)."""
    bm = bmesh.new()
    pts = []
    for cx, cy, a0 in ((FACE_HW - FACE_R, FACE_HH - FACE_R, 0), (-(FACE_HW - FACE_R), FACE_HH - FACE_R, 90),
                       (-(FACE_HW - FACE_R), -(FACE_HH - FACE_R), 180), (FACE_HW - FACE_R, -(FACE_HH - FACE_R), 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append(bm.verts.new((cx + FACE_R * math.cos(a), cy + FACE_R * math.sin(a), BODY_Z1 + FACE_LIFT)))
    bm.faces.new(pts)
    return bm


def export_lod(lod):
    o = LODS[lod]
    bm = block_bmesh(o['bevel'])
    parts = {'body': ([], [], []), 'back': ([], [], [])}
    index = {'body': {}, 'back': {}}
    for f in bm.faces:
        part = 'body' if f.calc_center_median().z > BODY_Z0 else 'back'
        V, N, T = parts[part]
        ids = []
        for v in f.verts:
            k = index[part].get(v.index)
            if k is None:
                k = index[part][v.index] = len(V)
                V.append(tuple(round(c, 6) for c in v.co))
                n = block_normal(v.co)
                N.append(tuple(round(c, 5) for c in n))
            ids.append(k)
        T.append(tuple(ids))
    rv, rn, rt = rim_mesh(o['corner'], o['profile'])
    return {
        'body': {'p': parts['body'][0], 'n': parts['body'][1], 't': parts['body'][2]},
        'back': {'p': parts['back'][0], 'n': parts['back'][1], 't': parts['back'][2]},
        'rim': {'p': [tuple(round(c, 6) for c in v) for v in rv], 'n': [tuple(round(c, 5) for c in n) for n in rn], 't': rt},
    }


def to_object(name, verts, tris, normals=None, mat=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], tris)
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    if normals is not None:
        me.normals_split_custom_set_from_vertices(normals)
    ob = bpy.data.objects.new(name, me)
    if mat:
        me.materials.append(mat)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def build_tile(mats, lod='hi', face=True):
    """One tile as Blender objects parented to an empty; mats: body, back, rim, face."""
    d = export_lod(lod)
    root = bpy.data.objects.new('tile', None)
    bpy.context.scene.collection.objects.link(root)
    for part, key in (('body', 'body'), ('back', 'back'), ('rim', 'rim')):
        g = d[part]
        ob = to_object(part, g['p'], g['t'], g['n'], mats[key])
        ob.parent = root
    if face:
        bm = plate_mesh(10)
        me = bpy.data.meshes.new('plate')
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new('plate', me)
        me.materials.append(mats['face'])
        bpy.context.scene.collection.objects.link(ob)
        # dense, planar UV 0..1 and subdivided for displacement
        bpy.context.view_layer.objects.active = ob
        me.uv_layers.new(name='UV')
        for loop in me.loops:
            co = me.vertices[loop.vertex_index].co
            me.uv_layers[0].data[loop.index].uv = ((co.x + FACE_HW) / (2 * FACE_HW), (co.y + FACE_HH) / (2 * FACE_HH))
        ob.parent = root
    # Box-projected UVs for body and back (the finish textures), the back's frame across the back face.
    for ob in root.children:
        if ob.name.startswith(('body', 'back')):
            me = ob.data
            uv = me.uv_layers.new(name='UV')
            for loop in me.loops:
                co = me.vertices[loop.vertex_index].co
                n = block_normal(co)
                ax = max(range(3), key=lambda i: abs(n[i]))
                if ax == 2:
                    u = 0.5 + co.x / TW if n.z > 0 else 0.5 - co.x / TW
                    v = 0.5 + co.y / TH
                elif ax == 0:
                    u, v = 0.5 + co.z / TD * (1 if n.x < 0 else -1), 0.5 + co.y / TH
                else:
                    u, v = 0.5 + co.x / TW, 0.5 + co.z / TD
                uv.data[loop.index].uv = (u, v)
    return root


if __name__ == '__main__' and len(sys.argv) > 2 and sys.argv[1] == 'export':
    out = {lod: export_lod(lod) for lod in LODS}
    json.dump(out, open(sys.argv[2], 'w'), separators=(',', ':'))
    for lod in LODS:
        print(lod, {k: (len(v['p']), len(v['t'])) for k, v in out[lod].items()})
