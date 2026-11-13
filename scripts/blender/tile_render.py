"""Cycles renders of JongClub tiles, from Blender's own tile model (tile_model.py) dressed in a set's real
faces and finishes exported from the game (perf/tiles3d/capture.cjs DIR dump SET KINDS).

  python tile_render.py DUMP_DIR SET OUT.png SCENE [W H SAMPLES]
SCENE: closeup (one tile standing, one face down) | trio (three standing, one face down: the Atelier
portrait) | row:K1,K2,... (a row of standing tiles).
"""
import sys, os, json, math
import bpy
from mathutils import Vector, Euler
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tile_model as tm


def hex_rgb(h, a=1.0):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, a)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 10
    sc.cycles.glossy_bounces = 6
    sc.cycles.transmission_bounces = 8
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    return sc


def node_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    return m, nt, bsdf


def img(path, color=True):
    im = bpy.data.images.load(path, check_existing=True)
    im.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
    return im


def finish_inputs(b, f, ivory_like=False):
    b.inputs['Roughness'].default_value = f.get('roughness', 0.3)
    b.inputs['Metallic'].default_value = f.get('metalness', 0)
    b.inputs['Coat Weight'].default_value = f.get('clearcoat', 0)
    b.inputs['Coat Roughness'].default_value = f.get('clearcoatRoughness', 0.1)
    if f.get('sheen'):
        b.inputs['Sheen Weight'].default_value = f['sheen'] * 0.5
        b.inputs['Sheen Tint'].default_value = hex_rgb(f.get('sheenColor', '#ffffff'))
    if f.get('iridescence'):
        b.inputs['Thin Film Thickness'].default_value = 380
        b.inputs['Thin Film IOR'].default_value = 1.35
    if f.get('opacity') is not None:
        b.inputs['Transmission Weight'].default_value = 1 - f['opacity'] * 0.6
    if ivory_like:
        # Ivory, bone and porcelain let a little light into the surface: the soft glow of the real thing.
        b.inputs['Subsurface Weight'].default_value = 0.35
        b.inputs['Subsurface Radius'].default_value = (1.0, 0.82, 0.62)
        b.inputs['Subsurface Scale'].default_value = 0.006


def tex_node(nt, image, uv=True):
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = image
    t.interpolation = 'Cubic'
    return t


def materials(d, st, fin):
    style = st
    iv = lambda f: f in ('ivory', 'bone', 'porcelain', 'pearl', 'marble')
    # face
    fm, nt, b = node_mat('face')
    ft = tex_node(nt, img(f'{d}/face-K.png'.replace('K', '0') if False else f'{d}/face-31.png'))
    fm['dir'] = d
    finish_inputs(b, fin['ground'], iv(style['ground']))
    b.inputs['Coat Weight'].default_value = max(0.8, fin['ground'].get('clearcoat', 0))
    b.inputs['Coat Roughness'].default_value = min(0.06, max(0.03, fin['ground'].get('clearcoatRoughness', 0.06)))
    nt.links.new(ft.outputs['Color'], b.inputs['Base Color'])
    st_ = tex_node(nt, img(f'{d}/surface-31.png', False))
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(st_.outputs['Color'], sep.inputs['Color'])
    nt.links.new(sep.outputs['Green'], b.inputs['Roughness'])
    nt.links.new(sep.outputs['Blue'], b.inputs['Metallic'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.25
    bump.inputs['Distance'].default_value = 0.0012
    nt.links.new(sep.outputs['Red'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Coat Normal'])
    fm['tex'] = ft.name
    fm['surf'] = st_.name
    # body
    bm, nt, b = node_mat('body')
    finish_inputs(b, fin['body'], iv(style['bodyFinish']))
    if style.get('stripes'):
        # layered resin: one colour per layer through the body's depth
        geo = nt.nodes.new('ShaderNodeNewGeometry')
        sepx = nt.nodes.new('ShaderNodeSeparateXYZ')
        mr = nt.nodes.new('ShaderNodeMapRange')
        mr.inputs['From Min'].default_value = tm.BODY_Z0
        mr.inputs['From Max'].default_value = tm.BODY_Z1
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.interpolation = 'CONSTANT'
        cols = style['stripes']
        els = ramp.color_ramp.elements
        while len(els) < len(cols):
            els.new(0.5)
        for i, c in enumerate(cols):
            els[i].position = i / len(cols)
            els[i].color = hex_rgb(c)
        tco = nt.nodes.new('ShaderNodeTexCoord')
        nt.links.new(tco.outputs['Object'], sepx.inputs['Vector'])
        nt.links.new(sepx.outputs['Z'], mr.inputs['Value'])
        nt.links.new(mr.outputs['Result'], ramp.inputs['Fac'])
        nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    else:
        t = tex_node(nt, img(f'{d}/body.png'))
        nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    micro(bm)
    # back
    km, nt, b = node_mat('back')
    finish_inputs(b, fin['back'], False)
    t = tex_node(nt, img(f'{d}/back.png'))
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    # bezel
    rm, nt, b = node_mat('rim')
    t = hex_rgb(style['trim'])
    # polished metal reads brighter than its paint swatch: lift the trim toward its own highlight
    b.inputs['Base Color'].default_value = tuple(min(1.0, c * 1.35 + 0.06) for c in t[:3]) + (1,)
    b.inputs['Metallic'].default_value = 1
    b.inputs['Roughness'].default_value = 0.1
    return {'face': fm, 'body': bm, 'back': km, 'rim': rm}


def micro(m, scale=900.0, strength=0.035):
    """A faint hand-polished ripple in the surface (bump only), so highlights run like on a real piece."""
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = scale
    n.inputs['Detail'].default_value = 4
    bp = nt.nodes.new('ShaderNodeBump')
    bp.inputs['Strength'].default_value = strength
    bp.inputs['Distance'].default_value = 0.0002
    nt.links.new(n.outputs['Fac'], bp.inputs['Height'])
    if not b.inputs['Normal'].is_linked:
        nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])


def face_material(base, d, kind):
    m = base.copy()
    nt = m.node_tree
    nt.nodes[base['tex']].image = img(f'{d}/face-{kind}.png')
    nt.nodes[base['surf']].image = img(f'{d}/surface-{kind}.png', False)
    return m


CARVE = {'on': True, 'res': (540, 720)}


def carved_plate(d, kind, mat):
    """The face plate as real geometry: a fine grid lifted and sunk by the game's own relief map (R of the
    surface map: ground 214, enamel 186 sunk into the face, metal wires 255 standing proud), so every stroke
    is carved with true walls that catch light and throw shadow, and the paint sits down in the grooves."""
    import numpy as np
    from PIL import Image, ImageFilter
    rel = Image.open(f'{d}/surface-{kind}.png').split()[0]
    rel = rel.resize((rel.width * 2, rel.height * 2), Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.2))
    a = np.asarray(rel, dtype=np.float32) / 255.0
    nx, ny = CARVE['res']
    u = np.linspace(0, 1, nx)
    v = np.linspace(0, 1, ny)
    U, V = np.meshgrid(u, v)
    # bilinear sample (image row 0 is the top: v = 1)
    H, W = a.shape
    fx = U * (W - 1)
    fy = (1 - V) * (H - 1)
    x0 = np.floor(fx).astype(int); y0 = np.floor(fy).astype(int)
    x1 = np.minimum(x0 + 1, W - 1); y1 = np.minimum(y0 + 1, H - 1)
    tx = fx - x0; ty = fy - y0
    h = (a[y0, x0] * (1 - tx) * (1 - ty) + a[y0, x1] * tx * (1 - ty) + a[y1, x0] * (1 - tx) * ty + a[y1, x1] * tx * ty)
    # the ground's guilloche is a whisper, not a wave: keep a fifth of it
    g = (h > 205 / 255) & (h < 230 / 255)
    h = np.where(g, 214 / 255 + (h - 214 / 255) * 0.2, h)
    depth = 0.017  # metres per unit of relief: ink sinks ~0.0011, wires stand ~0.0017 (a real tile: ~0.4 / 0.6 mm)
    z = (h - 214 / 255) * depth
    X = (U - 0.5) * 2 * tm.FACE_HW
    Y = (V - 0.5) * 2 * tm.FACE_HH
    # the carved plate stands a touch proud so its deepest strokes stay above the body's front
    Z = tm.BODY_Z1 + tm.FACE_LIFT + 0.0016 + z
    co = np.stack([X, Y, Z], -1).reshape(-1, 3)
    # quads, skipping those outside the plate's rounded corners
    ix = np.arange(nx * ny).reshape(ny, nx)
    q = np.stack([ix[:-1, :-1], ix[:-1, 1:], ix[1:, 1:], ix[1:, :-1]], -1).reshape(-1, 4)
    cx = np.abs(co[q[:, 0], 0] + co[q[:, 2], 0]) / 2
    cy = np.abs(co[q[:, 0], 1] + co[q[:, 2], 1]) / 2
    r = tm.FACE_R
    dx = np.maximum(cx - (tm.FACE_HW - r), 0); dy = np.maximum(cy - (tm.FACE_HH - r), 0)
    q = q[(dx * dx + dy * dy) <= r * r]
    me = bpy.data.meshes.new('carved')
    me.vertices.add(len(co))
    me.vertices.foreach_set('co', co.ravel())
    me.loops.add(len(q) * 4)
    me.loops.foreach_set('vertex_index', q.ravel())
    me.polygons.add(len(q))
    me.polygons.foreach_set('loop_start', np.arange(0, len(q) * 4, 4))
    me.polygons.foreach_set('use_smooth', np.ones(len(q), dtype=bool))
    me.update(calc_edges=True)
    uv = me.uv_layers.new(name='UV')
    uvs = np.stack([U, V], -1).reshape(-1, 2)[q.ravel()]
    uv.data.foreach_set('uv', uvs.ravel())
    me.materials.append(mat)
    ob = bpy.data.objects.new('plate', me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def tile(mats, d, kind, loc, rot):
    m = dict(mats)
    if kind is not None:
        m['face'] = face_material(mats['face'], d, kind)
    r = tm.build_tile(m, 'hi', face=kind is not None and not CARVE['on'])
    if kind is not None and CARVE['on']:
        carved_plate(d, kind, m['face']).parent = r
    col = bpy.data.collections.get('tiles') or bpy.data.collections.new('tiles')
    for o in [r, *r.children]:
        col.objects.link(o)
    r.location = loc
    r.rotation_euler = rot
    return r


def studio(stage):
    sc = bpy.context.scene
    w = bpy.data.worlds.new('w')
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.035, 0.032, 0.03, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 1
    # A polished dark plinth that mirrors the tiles, sweeping up into the backdrop without a horizon line
    # (a photographer's cyclorama), the far wall in the stage's velvet colour.
    prof = [(y, 0.0) for y in (-8.0, -1.0, 0.6)]
    R = 1.4
    for i in range(1, 13):
        a_ = math.pi / 2 * i / 12
        prof.append((0.6 + R * math.sin(a_), R * (1 - math.cos(a_))))
    prof.append((0.6 + R, 8.0))
    verts, faces = [], []
    for j, (y, z) in enumerate(prof):
        verts += [(-8.0, y, z), (8.0, y, z)]
        if j:
            faces.append((2 * j - 2, 2 * j - 1, 2 * j + 1, 2 * j))
    me = bpy.data.meshes.new('cyc')
    me.from_pydata(verts, [], faces)
    for p_ in me.polygons:
        p_.use_smooth = True
    cyc = bpy.data.objects.new('cyc', me)
    sc.collection.objects.link(cyc)
    m, nt, b = node_mat('cyc')
    # floor colour near the tiles, velvet up the wall
    tco = nt.nodes.new('ShaderNodeTexCoord')
    sepx = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tco.outputs['Object'], sepx.inputs['Vector'])
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = 0.05
    mr.inputs['From Max'].default_value = 0.9
    nt.links.new(sepx.outputs['Z'], mr.inputs['Value'])
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.inputs['A'].default_value = tuple(c * 0.3 for c in hex_rgb(stage)[:3]) + (1,)
    mix.inputs['B'].default_value = tuple(c * 0.55 for c in hex_rgb(stage)[:3]) + (1,)
    nt.links.new(mr.outputs['Result'], mix.inputs['Factor'])
    nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])
    rr = nt.nodes.new('ShaderNodeMapRange')
    rr.inputs['From Min'].default_value = 0.05
    rr.inputs['From Max'].default_value = 0.6
    rr.inputs['To Min'].default_value = 0.25
    rr.inputs['To Max'].default_value = 0.85
    nt.links.new(sepx.outputs['Z'], rr.inputs['Value'])
    nt.links.new(rr.outputs['Result'], b.inputs['Roughness'])
    cw = nt.nodes.new('ShaderNodeMapRange')
    cw.inputs['From Min'].default_value = 0.05
    cw.inputs['From Max'].default_value = 0.5
    cw.inputs['To Min'].default_value = 0.8
    cw.inputs['To Max'].default_value = 0.0
    nt.links.new(sepx.outputs['Z'], cw.inputs['Value'])
    nt.links.new(cw.outputs['Result'], b.inputs['Coat Weight'])
    b.inputs['Coat Roughness'].default_value = 0.04
    cyc.data.materials.append(m)

    def area(name, loc, target, size, power, color=(1, 1, 1), shape='RECTANGLE', sy=None):
        l = bpy.data.lights.new(name, 'AREA')
        l.energy = power
        l.color = color
        l.shape = shape
        l.size = size
        l.size_y = sy or size
        o = bpy.data.objects.new(name, l)
        o.location = loc
        d = Vector(target) - Vector(loc)
        o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        sc.collection.objects.link(o)
        return o
    # Studio light: a big soft key from the upper left, a long strip from the right that draws a clean
    # highlight down every edge, a cool rim from behind, and a pool of light on the backdrop.
    area('key', (-1.7, -1.5, 2.3), (0, 0, 0.15), 1.4, 220, (1, 0.93, 0.84))
    area('strip', (1.8, -0.7, 1.2), (0, 0, 0.15), 0.25, 70, (1, 1, 1), 'RECTANGLE', 1.6)
    rim = area('rim', (0.5, 1.7, 1.3), (0, 0, 0.2), 0.8, 70, (0.85, 0.9, 1.0))
    # The rim light only touches the tiles (light linking), so it never shows as a bright card in the plinth.
    tiles = bpy.data.collections.get('tiles') or bpy.data.collections.new('tiles')
    rim.light_linking.receiver_collection = tiles
    area('top', (0, -0.3, 2.6), (0, 0, 0), 1.0, 50)
    # White cards out of shot, as a jeweller's photographer uses: metal mirrors its surroundings, and these
    # give every bezel, wire and gilt stroke something bright to reflect.
    for x, z, rz in ((-1.4, 0.5, -0.9), (1.4, 0.4, 0.9), (0.0, 0.9, 0.0)):
        bpy.ops.mesh.primitive_plane_add(size=1.2, location=(x, -1.6 if x else -2.0, z))
        card = bpy.context.object
        card.rotation_euler = (math.pi / 2 - 0.25, 0, rz)
        cm, cnt, cb = node_mat('card')
        cb.inputs['Base Color'].default_value = (0, 0, 0, 1)
        cb.inputs['Emission Color'].default_value = (1, 0.97, 0.93, 1)
        cb.inputs['Emission Strength'].default_value = 1.6
        card.data.materials.append(cm)
        card.visible_camera = False
    sp = bpy.data.lights.new('pool', 'SPOT')
    sp.energy = 120
    sp.spot_size = 0.9
    sp.spot_blend = 1
    sp.color = (1, 0.93, 0.85)
    so = bpy.data.objects.new('pool', sp)
    so.location = (0, 0.2, 2.2)
    so.rotation_euler = (Vector((0, 2.0, 0.9)) - Vector(so.location)).to_track_quat('-Z', 'Y').to_euler()
    sc.collection.objects.link(so)


def hero_set(stage):
    """A club table at night: tiles on deep green felt, warm lamps glowing out of focus behind."""
    import random
    rnd = random.Random(7)
    for o in list(bpy.data.objects):
        if o.name.startswith('cyc'):
            bpy.data.objects.remove(o)
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
    fl = bpy.context.object
    m, nt, b = node_mat('felt')
    b.inputs['Base Color'].default_value = hex_rgb('#06261a')
    b.inputs['Roughness'].default_value = 0.95
    b.inputs['Sheen Weight'].default_value = 0.3
    b.inputs['Sheen Tint'].default_value = hex_rgb('#3f7a5f')
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = 2600
    n.inputs['Detail'].default_value = 6
    bp = nt.nodes.new('ShaderNodeBump')
    bp.inputs['Strength'].default_value = 0.35
    bp.inputs['Distance'].default_value = 0.0006
    nt.links.new(n.outputs['Fac'], bp.inputs['Height'])
    nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    fl.data.materials.append(m)
    # lamps and candles far behind: they become soft discs of light through a wide lens
    for i in range(46):
        x = rnd.uniform(-5, 5)
        y = rnd.uniform(3.5, 9)
        z = rnd.uniform(0.2, 2.6)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=rnd.uniform(0.03, 0.09), location=(x, y, z), segments=12, ring_count=8)
        o = bpy.context.object
        em, ent, eb = node_mat('lamp')
        warm = rnd.choice([(1, 0.62, 0.3), (1, 0.75, 0.45), (1, 0.55, 0.35), (0.95, 0.8, 0.6)])
        eb.inputs['Base Color'].default_value = (0, 0, 0, 1)
        eb.inputs['Emission Color'].default_value = (*warm, 1)
        eb.inputs['Emission Strength'].default_value = rnd.uniform(3, 9)
        o.data.materials.append(em)
        o.visible_shadow = False
        o.visible_glossy = False
        o.visible_diffuse = False
    bpy.context.scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.02, 0.014, 0.01, 1)



def box(name, size, loc, mat, bevel=0.004):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new('bev', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o


def mat_simple(name, color, rough=0.3, metal=0.0, coat=0.0, coat_rough=0.05, sheen=0.0, sheen_tint=None):
    m, nt, b = node_mat(name)
    b.inputs['Base Color'].default_value = hex_rgb(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Coat Roughness'].default_value = coat_rough
    if sheen:
        b.inputs['Sheen Weight'].default_value = sheen
        b.inputs['Sheen Tint'].default_value = hex_rgb(sheen_tint or color)
    return m, nt, b


def grain(nt, b, c0, c1, stretch=(0.6, 14, 1), scale=3.0, veins=False):
    """Long wood grain (or marble veins) from stretched noise, fed into the base colour."""
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = stretch
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = scale
    n.inputs['Detail'].default_value = 8 if not veins else 12
    n.inputs['Distortion'].default_value = 1.2 if not veins else 4.0
    nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = hex_rgb(c0)
    ramp.color_ramp.elements[1].color = hex_rgb(c1)
    if veins:
        # mostly the light stone, thin dark veins where the noise crosses its middle
        ramp.color_ramp.elements[0].position = 0.47
        ramp.color_ramp.elements[1].position = 0.5
        e = ramp.color_ramp.elements.new(0.53)
        e.color = hex_rgb(c0)
        ramp.color_ramp.elements[0].color = hex_rgb(c0)
        ramp.color_ramp.elements[1].color = hex_rgb(c1)
    nt.links.new(n.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])


# Each style: the stand the tiles are shown on, the counter under it, the room behind and its lamps.
#   stand   steps | dais | slab | tray | glass | cushion | block
#   floor   (c0, c1, roughness, coat, grain stretch or None for plain)
#   wall    colour, glow (emission at the bottom of the wall, fading upward), stripes (a screen)
#   lamps   colours of the out-of-focus lamps, their strength
SHOWCASE = {
    'lacquer': dict(stand='steps', standc=('#1c110b', '#e7b766'), floor=('#120904', '#3a2010', 0.35, 1.0, True),
                    wall=('#5a2a0e', 1.3, 0), lamps=[(1, 0.62, 0.3), (1, 0.75, 0.45), (1, 0.55, 0.35)], lampk=0.22, bokeh=(34, 0.04, 0.09)),
    'dais': dict(stand='dais', standc=('#0b2a1d', '#e2b35e'), floor=('#06180f', '#0c2a1c', 0.9, 0.0, False),
                 wall=('#0f4a30', 1.2, 0), lamps=[(0.55, 1, 0.65), (0.9, 0.85, 0.45), (0.45, 0.9, 0.7)], lampk=0.2, velvet=True, bokeh=(18, 0.08, 0.16)),
    'marble': dict(stand='slab', standc=('#f2f1ee', '#8d8f94'), floor=('#bfc2c7', '#d2d4d8', 0.25, 0.6, False),
                   wall=('#9aa3ad', 0.9, 0), lamps=[(0.85, 0.92, 1), (1, 1, 1)], lampk=0.06, lie=True, bokeh=(0, 0, 0)),
    'tray': dict(stand='tray', standc=('#8a130c', '#e7b766'), floor=('#1a0605', '#2a0b08', 0.3, 1.0, False),
                 wall=('#8a2410', 1.3, 0), lamps=[(1, 0.7, 0.25), (1, 0.5, 0.2), (1, 0.85, 0.4)], lampk=0.24, bokeh=(10, 0.14, 0.24)),
    'glass': dict(stand='glass', standc=('#030308', '#5d7bff'), floor=('#020205', '#05050c', 0.04, 1.0, False),
                  wall=('#141a55', 0.9, 0), lamps=[(0.35, 0.45, 1), (0.6, 0.35, 1), (0.3, 0.75, 1)], lampk=0.4, bokeh=(140, 0.012, 0.035), facekey=3.0),
    'cushion': dict(stand='cushion', standc=('#d9a3a0', '#f3d6c4'), floor=('#2a1416', '#3a1c1f', 0.85, 0.0, False),
                    wall=('#7a3a40', 1.1, 0), lamps=[(1, 0.6, 0.6), (1, 0.8, 0.55), (1, 0.7, 0.75)], lampk=0.22, lie=True, bokeh=(14, 0.05, 0.1)),
    'bamboo': dict(stand='block', standc=('#b88a58', '#6e4a28'), floor=('#2a1a0e', '#3b2615', 0.6, 0.2, True),
                   wall=('#5a4220', 1.1, 1), lamps=[(1, 0.78, 0.45), (1, 0.85, 0.6)], lampk=0.14, bokeh=(4, 0.1, 0.16)),
}
# the season sets each take a style in their city's colours
SHOWCASE['neon'] = dict(SHOWCASE['glass'], wall=('#2a0a3a', 1.0, 0), lamps=[(1, 0.2, 0.7), (0.2, 0.9, 1), (1, 0.4, 0.9), (0.3, 1, 0.8)], lampk=0.55, bokeh=(90, 0.02, 0.06))
SHOWCASE['maple'] = dict(SHOWCASE['tray'], standc=('#2a0c06', '#e2a24a'), wall=('#a3300e', 1.3, 0), lamps=[(1, 0.45, 0.12), (1, 0.6, 0.2), (0.95, 0.3, 0.1)])
SHOWCASE['desert'] = dict(SHOWCASE['bamboo'], standc=('#c9a27a', '#8a6a4a'), floor=('#a87a4c', '#c49464', 0.85, 0.0, False),
                          wall=('#c4521c', 1.6, 0), lamps=[(1, 0.85, 0.5)], lampk=0.8, bokeh=(1, 0.5, 0.5))
SHOWCASE['lantern'] = dict(SHOWCASE['lacquer'], wall=('#6a140a', 1.3, 0), lamps=[(1, 0.18, 0.08), (1, 0.45, 0.12), (1, 0.3, 0.1)], lampk=0.5, bokeh=(12, 0.16, 0.26))
SHOWCASE['garden'] = dict(SHOWCASE['dais'], standc=('#123a22', '#e7c27a'), wall=('#2a6a2a', 1.2, 0), lamps=[(0.7, 1, 0.4), (1, 0.9, 0.5), (0.5, 1, 0.55)])
SHOWCASE['lotus'] = dict(SHOWCASE['tray'], standc=('#5a1028', '#e7b766'), wall=('#5a1430', 1.2, 0), lamps=[(1, 0.5, 0.7), (1, 0.75, 0.5), (1, 0.6, 0.8)])


def showcase(style, mats, d, ks, stage, W):
    st = SHOWCASE[style]
    sc = bpy.context.scene
    h = tm.TH / 2
    hero_set(stage)
    for o in list(bpy.data.objects):
        if o.name.startswith(('Plane', 'top', 'cyc')):
            bpy.data.objects.remove(o)
    # the counter
    c0, c1, fr, fcoat, fgrain = st['floor']
    bpy.ops.mesh.primitive_plane_add(size=24, location=(0, 0, 0))
    fl = bpy.context.object
    m, nt, b = mat_simple('floor', c0, fr, coat=fcoat, sheen=0.6 if st.get('velvet') else 0, sheen_tint=c1)
    if fgrain:
        grain(nt, b, c0, c1)
    fl.data.materials.append(m)
    # the room: a wall lit low and warm, falling dark above, optionally a slatted screen
    wc, glow, stripes = st['wall']
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 10, 4))
    wall = bpy.context.object
    wall.scale = (40, 16, 1)
    wall.rotation_euler = (math.pi / 2, 0, 0)
    wm, wnt, wb = node_mat('wall')
    wb.inputs['Base Color'].default_value = hex_rgb(wc)
    wb.inputs['Emission Color'].default_value = hex_rgb(wc)
    wb.inputs['Roughness'].default_value = 1
    gtc = wnt.nodes.new('ShaderNodeTexCoord')
    gsep = wnt.nodes.new('ShaderNodeSeparateXYZ')
    wnt.links.new(gtc.outputs['Generated'], gsep.inputs['Vector'])
    gmr = wnt.nodes.new('ShaderNodeMapRange')
    gmr.inputs['From Min'].default_value = 0.24
    gmr.inputs['From Max'].default_value = 0.42
    gmr.inputs['To Min'].default_value = glow
    gmr.inputs['To Max'].default_value = glow * 0.1
    wnt.links.new(gsep.outputs['Y'], gmr.inputs['Value'])
    if stripes:
        # a bamboo screen: bright slats with dark gaps
        wv = wnt.nodes.new('ShaderNodeTexWave')
        wv.wave_type = 'BANDS'
        wv.bands_direction = 'X'
        wv.inputs['Scale'].default_value = 34
        wv.inputs['Distortion'].default_value = 0.3
        mul = wnt.nodes.new('ShaderNodeMath')
        mul.operation = 'MULTIPLY'
        ramp = wnt.nodes.new('ShaderNodeMapRange')
        ramp.inputs['From Min'].default_value = 0.2
        ramp.inputs['From Max'].default_value = 0.5
        ramp.inputs['To Min'].default_value = 0.03
        ramp.inputs['To Max'].default_value = 1.0
        wnt.links.new(wv.outputs['Fac'], ramp.inputs['Value'])
        wnt.links.new(ramp.outputs['Result'], mul.inputs[0])
        wnt.links.new(gmr.outputs['Result'], mul.inputs[1])
        wnt.links.new(mul.outputs['Value'], wb.inputs['Emission Strength'])
    else:
        wnt.links.new(gmr.outputs['Result'], wb.inputs['Emission Strength'])
    wall.data.materials.append(wm)
    # the lamps behind, recoloured for the room
    import random
    rnd = random.Random(sum(map(ord, style)))
    for o in list(bpy.data.objects):
        if o.name.startswith('Sphere'):
            bpy.data.objects.remove(o)
    n_, r0, r1 = st['bokeh']
    for i in range(n_):
        loc = (0.6, 9.5, 0.9) if n_ == 1 else (rnd.uniform(-5, 5), rnd.uniform(3.5, 9), rnd.uniform(0.3, 2.8))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=rnd.uniform(r0, r1), location=loc, segments=16, ring_count=10)
        o = bpy.context.object
        em, _, eb = node_mat('lamp')
        eb.inputs['Base Color'].default_value = (0, 0, 0, 1)
        eb.inputs['Emission Color'].default_value = (*rnd.choice(st['lamps']), 1)
        eb.inputs['Emission Strength'].default_value = rnd.uniform(3, 9) * st['lampk'] * (0.25 if r1 > 0.2 else 1)
        o.data.materials.append(em)
        o.visible_shadow = o.visible_glossy = o.visible_diffuse = False
    # the stand
    sc0, sc1 = st['standc']
    base, _, bb = mat_simple('stand', sc0, 0.22, coat=1.0, coat_rough=0.03)
    trim, _, tb = mat_simple('trim', sc1, 0.18, metal=1.0)
    pc = bpy.data.collections.get('plinths') or bpy.data.collections.new('plinths')
    if pc.name not in sc.collection.children:
        sc.collection.children.link(pc)
    kind = st['stand']
    xs = [(i - 1.5) * 0.41 for i in range(4)]
    places = []  # (kind or None for the back, x, y, z, yaw, lying)
    order = [None, *ks]
    if kind == 'steps':
        tops = [0.10, 0.15, 0.13, 0.085]
        for x, top in zip(xs, tops):
            w0, d0, w1, d1, band = 0.39, 0.40, 0.34, 0.34, 0.006
            h0 = top * 0.45
            box('plinth', (w0, d0, h0), (x, 0, h0 / 2), base)
            box('plinthgold', (w0 + 0.008, d0 + 0.008, band), (x, 0, band / 2), trim, 0.002)
            box('plinthgold', (w0 + 0.004, d0 + 0.004, band), (x, 0, h0 - band / 2), trim, 0.002)
            box('plinth', (w1, d1, top - h0), (x, 0, h0 + (top - h0) / 2), base)
            box('plinthgold', (w1 + 0.004, d1 + 0.004, band), (x, 0, top - band / 2), trim, 0.002)
        for i, (x, top) in enumerate(zip(xs, tops)):
            places.append((order[i], x, 0, top, 0.08 if i == 0 else -0.04 * (i - 2), False))
    elif kind == 'dais':
        # one round dais in velvet with a polished gold rim; the tiles stand in a gentle arc on it
        top = 0.12
        bpy.ops.mesh.primitive_cylinder_add(radius=0.98, depth=top, location=(0, 0.36, top / 2), vertices=128)
        o = bpy.context.object; o.name = 'plinthdais'; bpy.ops.object.shade_smooth()
        vel, _, vb = mat_simple('velvet', sc0, 0.95, sheen=1.0, sheen_tint='#3f8a62')
        o.data.materials.append(vel)
        for z, r in ((top, 0.98), (0.004, 0.99)):
            bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.012, location=(0, 0.36, z), major_segments=160, minor_segments=16)
            t = bpy.context.object; t.name = 'plinthrim'; bpy.ops.object.shade_smooth(); t.data.materials.append(trim)
        for i, x in enumerate(xs):
            u = (i - 1.5) / 1.5
            places.append((order[i], x * 0.98, -0.12 + 0.12 * u * u, top, -u * 0.22, False))
    elif kind == 'slab':
        # a slab of white marble; three tiles stand on it and the fourth lies face down in front
        top = 0.09
        o = box('plinthslab', (1.8, 0.72, top), (0, 0.06, top / 2), base, 0.01)
        mm, mnt, mb = mat_simple('marble', sc0, 0.12, coat=0.6)
        grain(mnt, mb, sc0, sc1, stretch=(1.2, 1.2, 1.2), scale=2.2, veins=True)
        o.data.materials.clear(); o.data.materials.append(mm)
        for i, x in enumerate((-0.58, -0.18, 0.22)):
            places.append((ks[i], x, 0.14, top, 0.0, False))
        places.append((None, 0.62, -0.14, top, -0.3, True))
    elif kind == 'tray':
        # a lacquer tray with a raised rim and a fine gold lip; the tiles fan out across it
        top = 0.045
        box('plinthtray', (1.95, 0.82, top), (0, 0.05, top / 2), base, 0.008)
        for (sx, sy, x, y) in ((1.95, 0.05, 0, 0.05 - 0.385), (1.95, 0.05, 0, 0.05 + 0.385), (0.05, 0.82, -0.95, 0.05), (0.05, 0.82, 0.95, 0.05)):
            box('plinthrim', (sx, sy, 0.09), (x, y, 0.045), base, 0.012)
            box('plinthlip', (sx + 0.004, sy + 0.004, 0.006), (x, y, 0.09), trim, 0.002)
        for i, x in enumerate(xs):
            u = (i - 1.5) / 1.5
            places.append((order[i], x * 1.02, 0.02 + 0.16 * u * u, top, -u * 0.5, False))
    elif kind == 'glass':
        # a stage of black glass with a thin line of light along its front edge
        top = 0.07
        o = box('plinthglass', (2.1, 0.8, top), (0, 0.05, top / 2), base, 0.004)
        em, _, eb = node_mat('edge')
        eb.inputs['Base Color'].default_value = (0, 0, 0, 1)
        eb.inputs['Emission Color'].default_value = hex_rgb(sc1)
        eb.inputs['Emission Strength'].default_value = 6
        box('plinthedge', (2.1, 0.004, 0.004), (0, 0.05 - 0.401, top - 0.006), em, 0)
        tops = [top] * 4
        for i, x in enumerate(xs):
            u = (i - 1.5) / 1.5
            # a V: the middle pair forward, the outer pair set back and turned in
            places.append((order[i], x * 1.05, 0.18 * abs(u) - 0.05, top, -u * 0.35, False))
    elif kind == 'cushion':
        # an open jeweller's box: gold case, tufted satin cushion, the lid standing open behind lined in satin;
        # three tiles lean back into the cushion and one lies face down in front
        top = 0.13
        sat, _, sb = mat_simple('satin', sc0, 0.35, sheen=1.0, sheen_tint=sc1)
        box('plinthbox', (1.9, 0.86, 0.11), (0, 0.06, 0.055), trim, 0.01)
        box('plinthcushion', (1.82, 0.78, top - 0.03), (0, 0.06, 0.03 + (top - 0.03) / 2), sat, 0.045)
        for ix in range(7):
            for iy in range(3):
                bpy.ops.mesh.primitive_uv_sphere_add(radius=0.012, location=(-0.78 + ix * 0.26, -0.22 + iy * 0.28, top + 0.002), segments=12, ring_count=8)
                t = bpy.context.object; t.name = 'plinthbutton'; bpy.ops.object.shade_smooth(); t.data.materials.append(trim)
        lid = box('caselid', (1.9, 0.05, 0.78), (0, 0.52, 0.44), trim, 0.01)
        lid.rotation_euler = (-0.22, 0, 0)
        lin = box('caselining', (1.8, 0.01, 0.7), (0, 0.49, 0.44), sat, 0.004)
        lin.rotation_euler = (-0.22, 0, 0)
        for i, x in enumerate((-0.56, -0.16, 0.24)):
            places.append((ks[i], x, 0.12, top - 0.01, 0.04 * (1 - i), 'lean'))
        places.append((None, 0.64, -0.14, top, -0.45, True))
    elif kind == 'block':
        # a single block of raw wood, end grain showing, the tiles in a row on top
        top = 0.16
        o = box('plinthblock', (1.9, 0.62, top), (0, 0.05, top / 2), base, 0.006)
        wm2, wnt2, wb2 = mat_simple('rawwood', sc0, 0.6)
        grain(wnt2, wb2, sc0, sc1, stretch=(0.5, 9, 1), scale=4)
        o.data.materials.clear(); o.data.materials.append(wm2)
        for i, x in enumerate(xs):
            places.append((order[i], x, 0.12 if i % 2 else -0.02, top, 0.1 if i % 2 else -0.08, False))
    for o in bpy.data.objects:
        if o.name.startswith('plinth') and o.type == 'MESH':
            pc.objects.link(o)
    for k, x, y, z, yaw, lying in places:
        if lying is True:
            tile(mats, d, None, (x, y, z + tm.TD / 2), Euler((math.pi, 0, yaw)))
        elif lying == 'lean':
            r_ = tile(mats, d, k, (x, y, z + h * math.cos(0.18)), STAND(yaw))
            r_.rotation_euler = Euler((math.pi / 2 - 0.18, 0, yaw))
        else:
            tile(mats, d, k, (x, y, z + h), STAND((math.pi if k is None else 0.0) + yaw))
    # light: a raking key from the left, and a low strip that lights only the stand
    kl = bpy.data.lights.new('rake', 'AREA'); kl.energy = 70; kl.size = 0.6; kl.color = (1, 0.88, 0.74)
    ko = bpy.data.objects.new('rake', kl); ko.location = (-2.4, -1.2, 1.0)
    ko.rotation_euler = (Vector((0, 0, 0.3)) - Vector(ko.location)).to_track_quat('-Z', 'Y').to_euler()
    sc.collection.objects.link(ko)
    fl_ = bpy.data.lights.new('plinthfill', 'AREA'); fl_.energy = 14; fl_.shape = 'RECTANGLE'; fl_.size = 3.0; fl_.size_y = 0.25; fl_.color = (1, 0.85, 0.7)
    fo = bpy.data.objects.new('plinthfill', fl_); fo.location = (0, -2.0, 0.12)
    fo.rotation_euler = (Vector((0, 0, 0.08)) - Vector(fo.location)).to_track_quat('-Z', 'Y').to_euler()
    sc.collection.objects.link(fo)
    fo.light_linking.receiver_collection = pc
    if st.get('facekey'):
        # dark tiles: a broad soft light high over the lens, lighting only the tiles, so dark faces still read
        kf = bpy.data.lights.new('facekey', 'AREA'); kf.energy = 60 * st['facekey']; kf.size = 1.6; kf.color = (1, 0.95, 0.88)
        ok = bpy.data.objects.new('facekey', kf); ok.location = (0.3, -2.2, 2.0)
        ok.rotation_euler = (Vector((0, 0, 0.25)) - Vector(ok.location)).to_track_quat('-Z', 'Y').to_euler()
        sc.collection.objects.link(ok)
        ok.light_linking.receiver_collection = bpy.data.collections['tiles']
    look = (0, 0.05, 0.3)
    cam = (0, -2.45, 0.5)
    c = camera(cam, look, 50)
    c.data.dof.aperture_fstop = 0.55
    c.data.dof.focus_distance = (Vector(look) - Vector(cam)).length
    sc.render.resolution_x, sc.render.resolution_y = W, int(W * 11 / 20)


def camera(loc, look, lens):
    c = bpy.data.cameras.new('cam')
    c.lens = lens
    c.dof.use_dof = True
    o = bpy.data.objects.new('cam', c)
    o.location = loc
    o.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.collection.objects.link(o)
    bpy.context.scene.camera = o
    c.dof.focus_distance = (Vector(look) - Vector(loc)).length
    c.dof.aperture_fstop = 5.6
    return o


# Blender is Z-up: the tile's face (+Z in tile space) is turned to face the camera (-Y), standing on z = 0.
STAND = lambda yaw: Euler((math.pi / 2, 0, yaw))


def main():
    d, sid, out, scene = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    W, H, S = (int(x) for x in (sys.argv[5:8] if len(sys.argv) > 7 else (1200, 1200, 96)))
    d = os.path.join(d, sid)
    meta = json.load(open(f'{d}/style.json'))
    st, fin = meta['style'], meta['finish']
    sc = reset()
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.cycles.samples = S
    stage = '#1d5240' if st.get('stage') == 'suede' else '#2a2622'
    studio(stage)
    mats = materials(d, st, fin)
    h = tm.TH / 2
    if scene == 'closeup':
        tile(mats, d, 31, (-0.05, 0, h), STAND(-0.42 + 0))
        tile(mats, d, None, (0.36, 0.42, tm.TD / 2), Euler((math.pi, 0, -0.75)))
        camera((0.22, -1.05, 0.42), (0.02, 0.05, 0.18), 58)
    elif scene == 'trio':
        for i, k in enumerate((31, 13, 8)):
            tile(mats, d, k, ((i - 1) * 0.37 - 0.16, abs(i - 1) * 0.05, h), STAND((1 - i) * 0.16))
        tile(mats, d, None, (0.5, -0.16, tm.TD / 2), Euler((math.pi, 0, 0.42)))
        sc.render.resolution_x, sc.render.resolution_y = W, int(W * 528 / 960)
        camera((0.05, -2.45, 0.72), (0.08, 0, 0.16), 46)
    elif scene == 'hero':
        hero_set(stage)
        ks = [27, 31, 13, 8, 33]
        # a short row standing as on a rack, turned toward the lens, so faces, edges and layers all read
        for i, k in enumerate(ks):
            yaw = 0.12
            tile(mats, d, k, ((i - 2) * 0.315 * math.cos(yaw), (i - 2) * 0.315 * math.sin(yaw), h), STAND(yaw))
        tile(mats, d, None, (0.95, 0.75, tm.TD / 2), Euler((math.pi, 0, 0.2)))
        for o in list(bpy.data.objects):
            if o.name.startswith('top'):
                bpy.data.objects.remove(o)
        # a low raking key from the left draws every carved line in light and shadow
        kl = bpy.data.lights.new('rake', 'AREA'); kl.energy = 90; kl.size = 0.5; kl.color = (1, 0.9, 0.78)
        ko = bpy.data.objects.new('rake', kl); ko.location = (-2.2, -0.6, 0.55)
        ko.rotation_euler = (Vector((0, 0, 0.2)) - Vector(ko.location)).to_track_quat('-Z', 'Y').to_euler()
        sc.collection.objects.link(ko)
        c = camera((0.95, -1.7, 0.33), (-0.04, 0.02, 0.18), 36)
        # the set is built ten times life size, so the lens opens ten times wider for a true close-up blur
        c.data.dof.aperture_fstop = 0.8
        c.data.dof.focus_distance = (Vector((0.0, 0.0, 0.2)) - Vector((0.95, -1.7, 0.33))).length
        sc.render.resolution_x, sc.render.resolution_y = W, int(W * 9 / 16)
    elif scene.startswith('show:'):
        # show:STYLE:K1,K2,K3 - the set on its own stand in its own room (SHOWCASE)
        _, style, kk = scene.split(':')
        showcase(style, mats, d, [int(k) for k in kk.split(',')], stage, W)
    elif scene == 'deck':
        # Every tile of the set lying face up, row by row: three suits, honours, flowers and seasons,
        # then the jokers and the animals.
        rows = [list(range(0, 9)), list(range(9, 18)), list(range(18, 27)), list(range(27, 34)),
                list(range(34, 42)), list(range(42, 51))]
        for r, ks in enumerate(rows):
            for i, k in enumerate(ks):
                tile(mats, d, k, ((i - 4) * 0.34, (2.5 - r) * 0.46, tm.TD / 2), Euler((0, 0, 0)))
        # Lying face up, the faces would mirror the overhead light straight into the lens: light them from
        # the sides instead, and look from lower down.
        for o in list(bpy.data.objects):
            if o.name.startswith(('top', 'rim')) or (o.name.startswith('Plane') and abs(o.location.x) < 0.01 and o.location.z > 0.8):
                bpy.data.objects.remove(o)
        c = camera((0, -3.3, 3.3), (0, 0.05, 0), 40)
        c.data.dof.aperture_fstop = 16
    elif scene.startswith('row:'):
        ks = [int(k) for k in scene[4:].split(',')]
        n = len(ks)
        for i, k in enumerate(ks):
            tile(mats, d, k, ((i - (n - 1) / 2) * 0.33, 0, h), STAND(0))
        camera((0, -0.35 * n - 0.6, 0.45), (0, 0, 0.18), 60)
    sc.render.filepath = out
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    main()
