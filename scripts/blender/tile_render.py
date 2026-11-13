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
        b.inputs['Subsurface Weight'].default_value = 0.12
        b.inputs['Subsurface Scale'].default_value = 0.004


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
    bump.inputs['Strength'].default_value = 1.0
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
    # back
    km, nt, b = node_mat('back')
    finish_inputs(b, fin['back'], False)
    t = tex_node(nt, img(f'{d}/back.png'))
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    # bezel
    rm, nt, b = node_mat('rim')
    b.inputs['Base Color'].default_value = hex_rgb(style['trim'])
    b.inputs['Metallic'].default_value = 1
    b.inputs['Roughness'].default_value = 0.16
    return {'face': fm, 'body': bm, 'back': km, 'rim': rm}


def face_material(base, d, kind):
    m = base.copy()
    nt = m.node_tree
    nt.nodes[base['tex']].image = img(f'{d}/face-{kind}.png')
    nt.nodes[base['surf']].image = img(f'{d}/surface-{kind}.png', False)
    return m


def tile(mats, d, kind, loc, rot):
    m = dict(mats)
    if kind is not None:
        m['face'] = face_material(mats['face'], d, kind)
    r = tm.build_tile(m, 'hi', face=kind is not None)
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
    area('key', (-1.7, -1.5, 2.3), (0, 0, 0.15), 1.4, 220, (1, 0.975, 0.95))
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
    elif scene == 'deck':
        # Every tile of the set lying face up, row by row: three suits, honours, flowers and seasons,
        # then the jokers and the animals.
        rows = [list(range(0, 9)), list(range(9, 18)), list(range(18, 27)), list(range(27, 34)),
                list(range(34, 42)), list(range(42, 51))]
        for r, ks in enumerate(rows):
            for i, k in enumerate(ks):
                tile(mats, d, k, ((i - 4) * 0.34, (2.5 - r) * 0.46, tm.TD / 2), Euler((0, 0, 0)))
        c = camera((0, -1.9, 4.1), (0, 0.02, 0), 38)
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
