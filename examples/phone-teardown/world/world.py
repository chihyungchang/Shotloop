"""World of 「拆开一部手机」: a generic phone built from primitives in a
dark product studio, and the helpers the shots animate it with.

Blender: +Z up, units are 10x real size (the phone is 0.72 x 1.48 x
0.078). The phone stands upright, screen towards -Y. Its seven layers
(front to back) are children of one root and separate along Y.

Shots never keyframe by hand: they call
  bake(T0, DUR, lambda t: dict(explode=..., spin=..., pull={...}))
  camera(name, T0, DUR, lambda t: (position, aim), lens=..., f_stop=...)
both pure functions of shot-local time t, baked once per frame.
"""

import math
import random

import bmesh
import bpy
from mathutils import Euler, Vector

import kit

DURATION = 24.0
W, H, D = 0.72, 1.48, 0.078  # phone body
R = 0.105  # corner radius
SKIN = 0.006  # front and back glass thickness
RIM = 0.022  # frame wall
BG = (0.010, 0.011, 0.014)  # studio background (linear)

s = kit.reset(DURATION, size=(1080, 1920), samples=64)
s.view_settings.look = 'AgX - Medium High Contrast'
s.render.film_transparent = False


# ---------------------------------------------------------------- helpers

def ease(x):
    """Cubic ease in-out on [0, 1], clamped."""
    x = min(1.0, max(0.0, x))
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def seg(t, a, b):
    """0 → 1 between t = a and t = b, eased."""
    return ease((t - a) / (b - a)) if b > a else float(t >= a)


def lerp(a, b, k):
    if isinstance(a, (tuple, list, Vector)):
        return Vector(a).lerp(Vector(b), k)
    return a + (b - a) * k


def link(o, parent=None):
    if o.name not in bpy.context.collection.objects:
        bpy.context.collection.objects.link(o)
    if parent is not None:
        o.parent = parent
    return o


def empty(name, parent=None, loc=(0, 0, 0)):
    o = bpy.data.objects.new(name, None)
    o.location = loc
    return link(o, parent)


def rrect(name, w, h, d, r, mat=None, edge=0.003, seg_=10, parent=None, loc=(0, 0, 0)):
    """A slab w (X) x d (Y) x h (Z) with corners rounded by r in the XZ
    plane and its edges softened by `edge`."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * w, v.co.y * d, v.co.z * h))
    if r > 0:
        edges = [e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).y) > d * 0.5]
        bmesh.ops.bevel(bm, geom=edges, offset=min(r, w / 2 - 1e-4, h / 2 - 1e-4), segments=seg_,
                        profile=0.5, affect='EDGES', clamp_overlap=True)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    o = link(bpy.data.objects.new(name, mesh), parent)
    o.location = loc
    finish(o, mat, edge)
    return o


def finish(o, mat=None, edge=0.003):
    """Smooth shading with sharp creases, a small edge bevel, a material."""
    m = o.data
    for p in m.polygons:
        p.use_smooth = True
    if edge:
        b = o.modifiers.new('Bevel', 'BEVEL')
        b.width = edge
        b.segments = 3
        b.limit_method = 'ANGLE'
        b.angle_limit = math.radians(40)
        b.harden_normals = True
    try:
        with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o],
                                       selected_editable_objects=[o]):
            bpy.ops.object.shade_auto_smooth(angle=math.radians(35))
    except Exception:
        pass
    if mat:
        m.materials.append(mat)
    return o


def cylinder(name, r, depth, mat, parent=None, loc=(0, 0, 0), axis='Y', verts=64, edge=0.002):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r, depth=depth)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    o = link(bpy.data.objects.new(name, mesh), parent)
    if axis == 'Y':
        o.rotation_euler = (math.radians(90), 0, 0)
    o.location = loc
    finish(o, mat, edge)
    return o


def cut(target, cutters):
    """Boolean-subtract cutters from target and bake the result."""
    for c in cutters:
        b = target.modifiers.new('Cut', 'BOOLEAN')
        b.operation = 'DIFFERENCE'
        b.solver = 'EXACT'
        b.object = c
        # Booleans go first so the bevel runs on the cut shape
        target.modifiers.move(len(target.modifiers) - 1, 0)
    dg = bpy.context.evaluated_depsgraph_get()
    keep = [m for m in target.modifiers if m.type != 'BOOLEAN' and m.type != 'BEVEL']
    for m in list(target.modifiers):
        if m.type == 'BEVEL':
            m.show_viewport = m.show_render = False
    ev = target.evaluated_get(dg)
    mesh = bpy.data.meshes.new_from_object(ev)
    old = target.data
    target.modifiers.clear()
    target.data = mesh
    bpy.data.meshes.remove(old)
    for c in cutters:
        bpy.data.objects.remove(c, do_unlink=True)
    return target


# ---------------------------------------------------------------- materials

def principled(name, color, rough=0.4, metal=0.0, coat=0.0, coat_rough=0.05):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    p.inputs['Coat Weight'].default_value = coat
    p.inputs['Coat Roughness'].default_value = coat_rough
    return m, m.node_tree, p


def brushed(name, color, rough=0.26, streak=0.12, scale=(1.0, 1.0, 1.0)):
    """Brushed metal: roughness streaks from a stretched noise."""
    m, nt, p = principled(name, color, rough, 1.0)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = scale
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 60
    nz.inputs['Detail'].default_value = 8
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['To Min'].default_value = rough - streak / 2
    mr.inputs['To Max'].default_value = rough + streak / 2
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], nz.inputs['Vector'])
    nt.links.new(nz.outputs['Fac'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], p.inputs['Roughness'])
    return m


def glass(name, tint=(0.96, 0.98, 1.0), edge=0.9, rough=0.02):
    """Clear glass that works without ray tracing: transparent face-on,
    glossy towards grazing angles and wherever a light reflects."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    tr.inputs['Color'].default_value = (*tint, 1)
    gl = nt.nodes.new('ShaderNodeBsdfGlossy')
    gl.inputs['Roughness'].default_value = rough
    lw = nt.nodes.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.25
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['To Min'].default_value = 0.02
    mr.inputs['To Max'].default_value = edge
    mr.clamp = True
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lw.outputs['Fresnel'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], mix.inputs['Fac'])
    nt.links.new(tr.outputs['BSDF'], mix.inputs[1])
    nt.links.new(gl.outputs['BSDF'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    m.surface_render_method = 'BLENDED'
    m.use_backface_culling = True
    return m


def wallpaper(name):
    """The lit screen: a soft aurora gradient, emissive."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.2, 1.2, 0.6)
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 1.1
    nz.inputs['Detail'].default_value = 1.5
    nz.inputs['Distortion'].default_value = 1.2
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    mix = nt.nodes.new('ShaderNodeMath')
    mix.operation = 'MULTIPLY_ADD'
    mix.inputs[1].default_value = 0.55
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    cr = ramp.color_ramp
    cr.interpolation = 'B_SPLINE'
    stops = [(0.08, (0.002, 0.004, 0.03)), (0.3, (0.01, 0.05, 0.6)), (0.45, (0.2, 0.03, 0.75)),
             (0.56, (0.85, 0.06, 0.35)), (0.64, (1.0, 0.35, 0.05)), (0.78, (0.06, 0.01, 0.08)),
             (1.0, (0.003, 0.003, 0.012))]
    cr.elements[0].position, cr.elements[0].color = stops[0][0], (*stops[0][1], 1)
    cr.elements[1].position, cr.elements[1].color = stops[1][0], (*stops[1][1], 1)
    for pos, col in stops[2:]:
        e = cr.elements.new(pos)
        e.color = (*col, 1)
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = 1.1
    nt.links.new(tc.outputs['Generated'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], nz.inputs['Vector'])
    nt.links.new(tc.outputs['Generated'], sep.inputs['Vector'])
    # Diagonal flow: noise plus height, so it reads dark at the bottom
    nt.links.new(nz.outputs['Fac'], mix.inputs[0])
    nt.links.new(sep.outputs['Z'], mix.inputs[2])
    nt.links.new(mix.outputs['Value'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    # Reveal: rows below `reveal` (0 = bottom, 1 = top) are lit, with a
    # bright scan line at the edge; above 1.1 the whole screen is on
    rv = nt.nodes.new('ShaderNodeValue')
    rv.name = 'reveal'
    rv.outputs[0].default_value = 1.2

    def math(op, a, b):
        n = nt.nodes.new('ShaderNodeMath')
        n.operation = op
        for i, v in enumerate((a, b)):
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                nt.links.new(v, n.inputs[i])
        return n.outputs[0]

    z = sep.outputs['Z']
    on = nt.nodes.new('ShaderNodeMapRange')
    on.interpolation_type = 'SMOOTHSTEP'
    nt.links.new(z, on.inputs['Value'])
    nt.links.new(math('SUBTRACT', rv.outputs[0], 0.05), on.inputs['From Min'])
    nt.links.new(rv.outputs[0], on.inputs['From Max'])
    on.inputs['To Min'].default_value = 1.1
    on.inputs['To Max'].default_value = 0.0
    edge = math('MULTIPLY', math('MAXIMUM', math('SUBTRACT', 1.0,
                math('DIVIDE', math('ABSOLUTE', math('SUBTRACT', z, rv.outputs[0]), 0), 0.035)), 0.0), 2.2)
    nt.links.new(math('ADD', on.outputs['Result'], edge), em.inputs['Strength'])
    return m, rv


M = {}
M['frame'] = brushed('frame', (0.56, 0.55, 0.53), rough=0.28, scale=(1, 1, 0.02))
M['back'], _, p = principled('back-glass', (0.1, 0.15, 0.24), rough=0.5, coat=0.5, coat_rough=0.35)
M['glass'] = glass('glass', edge=0.45)
M['black'], _, _ = principled('black-gloss', (0.006, 0.006, 0.007), rough=0.12)
M['panel'], _, _ = principled('panel', (0.02, 0.02, 0.024), rough=0.35, metal=0.4)
M['screen'], REVEAL = wallpaper('screen')
M['pcb'], _, _ = principled('pcb', (0.006, 0.03, 0.034), rough=0.42, coat=0.25, coat_rough=0.2)
M['chip'], _, _ = principled('chip', (0.018, 0.018, 0.02), rough=0.45)
M['lid'] = brushed('lid', (0.42, 0.42, 0.44), rough=0.34, streak=0.1, scale=(1, 0.02, 1))
M['shield'] = brushed('shield', (0.5, 0.5, 0.52), rough=0.38, streak=0.12, scale=(0.02, 1, 1))
M['gold'], _, _ = principled('gold', (1.0, 0.72, 0.38), rough=0.25, metal=1.0)
M['passive'], _, _ = principled('passive', (0.52, 0.46, 0.38), rough=0.5)
M['flex'], _, _ = principled('flex', (0.55, 0.28, 0.04), rough=0.35, coat=0.6)
M['battery'] = brushed('battery', (0.12, 0.12, 0.13), rough=0.38, streak=0.08, scale=(0.05, 1, 1))
M['label'], _, _ = principled('label', (0.045, 0.045, 0.05), rough=0.6)
M['accent'], _, _ = principled('accent', (0.9, 0.42, 0.08), rough=0.4)
M['plate'], _, _ = principled('plate', (0.025, 0.025, 0.028), rough=0.45)
M['ring'], _, _ = principled('ring', (0.85, 0.84, 0.82), rough=0.1, metal=1.0)
M['lens'], _, _ = principled('lens', (0.004, 0.004, 0.008), rough=0.03, coat=1.0, coat_rough=0.0)
M['coating'], _, _ = principled('coating', (0.05, 0.02, 0.12), rough=0.05, metal=0.8)
M['flash'], _, _ = principled('flash', (0.95, 0.9, 0.75), rough=0.3)
for p in (M['lens'],):
    p.node_tree.nodes['Principled BSDF'].inputs['Coat Tint'].default_value = (0.6, 0.7, 1.0, 1)


# ---------------------------------------------------------------- studio

def studio_world():
    """The camera sees near-black; reflections see a softbox studio."""
    w = bpy.data.worlds.new('Studio')
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs['Vector'])

    def band(src, lo, hi, soft=0.08):
        a = nt.nodes.new('ShaderNodeMapRange')
        a.interpolation_type = 'SMOOTHSTEP'
        a.inputs['From Min'].default_value = lo - soft
        a.inputs['From Max'].default_value = lo + soft
        b = nt.nodes.new('ShaderNodeMapRange')
        b.interpolation_type = 'SMOOTHSTEP'
        b.inputs['From Min'].default_value = hi + soft
        b.inputs['From Max'].default_value = hi - soft
        nt.links.new(src, a.inputs['Value'])
        nt.links.new(src, b.inputs['Value'])
        m = nt.nodes.new('ShaderNodeMath')
        m.operation = 'MULTIPLY'
        nt.links.new(a.outputs['Result'], m.inputs[0])
        nt.links.new(b.outputs['Result'], m.inputs[1])
        return m.outputs['Value']

    def add(a, b, k=1.0):
        m = nt.nodes.new('ShaderNodeMath')
        m.operation = 'MULTIPLY_ADD'
        nt.links.new(b, m.inputs[0])
        m.inputs[1].default_value = k
        nt.links.new(a, m.inputs[2])
        return m.outputs['Value']

    def mul(a, b):
        m = nt.nodes.new('ShaderNodeMath')
        m.operation = 'MULTIPLY'
        nt.links.new(a, m.inputs[0])
        nt.links.new(b, m.inputs[1])
        return m.outputs['Value']

    # Softboxes: a big one overhead, two tall strips at the sides
    top = band(sep.outputs['Z'], 0.75, 1.2, 0.12)
    left = mul(band(sep.outputs['X'], -0.95, -0.7, 0.06), band(sep.outputs['Z'], -0.3, 0.55, 0.1))
    right = mul(band(sep.outputs['X'], 0.72, 0.95, 0.06), band(sep.outputs['Z'], -0.2, 0.45, 0.1))
    front = mul(band(sep.outputs['Y'], -0.98, -0.8, 0.06), band(sep.outputs['Z'], 0.1, 0.6, 0.1))
    lit = add(add(add(mul(top, top), left, 1.0), right, 0.8), front, 0.15)
    base = nt.nodes.new('ShaderNodeMath')
    base.operation = 'MULTIPLY_ADD'
    nt.links.new(lit, base.inputs[0])
    base.inputs[1].default_value = 1.6
    base.inputs[2].default_value = 0.008
    env = nt.nodes.new('ShaderNodeBackground')
    env.inputs['Color'].default_value = (1.0, 0.98, 0.96, 1)
    nt.links.new(base.outputs['Value'], env.inputs['Strength'])
    # What the camera sees: a seamless backdrop, a touch lighter around
    # the horizon so the dark has depth
    cam_bg = nt.nodes.new('ShaderNodeBackground')
    cam_bg.inputs['Color'].default_value = (*BG, 1)
    glow = nt.nodes.new('ShaderNodeMapRange')
    glow.interpolation_type = 'SMOOTHSTEP'
    nt.links.new(sep.outputs['Z'], glow.inputs['Value'])
    glow.inputs['From Min'].default_value = 0.55
    glow.inputs['From Max'].default_value = -0.05
    glow.inputs['To Min'].default_value = 0.7
    glow.inputs['To Max'].default_value = 1.9
    nt.links.new(glow.outputs['Result'], cam_bg.inputs['Strength'])
    lp = nt.nodes.new('ShaderNodeLightPath')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs['Fac'])
    nt.links.new(env.outputs['Background'], mix.inputs[1])
    nt.links.new(cam_bg.outputs['Background'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    bpy.context.scene.world = w


def area(name, loc, aim, size, energy, color=(1, 1, 1), shape='RECTANGLE', spec=1.0):
    d = bpy.data.lights.new(name, 'AREA')
    d.specular_factor = spec
    d.shape = shape
    d.size, d.size_y = size
    d.energy = energy
    d.color = color
    o = link(bpy.data.objects.new(name, d))
    o.location = loc
    o.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o


studio_world()
area('key', (-3.2, -3.6, 3.4), (0, 0, 0), (2.6, 1.6), 650, (1.0, 0.97, 0.93))
area('top', (0.4, 0.4, 4.2), (0, 0, 0), (3.0, 3.0), 500, (1.0, 0.99, 0.97))
area('rim-left', (-3.6, 2.6, 0.6), (0, 0, 0.1), (0.5, 4.0), 600, (0.82, 0.9, 1.0), spec=0.5)
area('rim-right', (3.8, 1.2, 1.0), (0, 0, 0.1), (0.5, 4.0), 550, (1.0, 0.9, 0.8), spec=0.35)
area('fill', (2.5, -4.0, 0.2), (0, 0, 0), (2.0, 2.0), 160, (0.9, 0.94, 1.0))


# ---------------------------------------------------------------- the phone

random.seed(11)
ROOT = empty('phone')  # spin and float
ROOT.location = (0, 0, 0)

# Layer order front (-Y) to back (+Y); `rest` is the assembled Y
LAYERS = ['glass', 'display', 'frame', 'board', 'battery', 'camera', 'back']
PART = {n: empty(n, ROOT) for n in LAYERS}
y_front = -D / 2
y_back = D / 2

# Front glass: flush with the frame's outer outline
rrect('glass.slab', W, H, SKIN, R, M['glass'], edge=0.0025, parent=PART['glass'])
ink = rrect('glass.ink', W - 0.006, H - 0.006, 0.0008, R - 0.003, M['black'], edge=0, parent=PART['glass'],
            loc=(0, SKIN / 2 - 0.0006, 0))
cut(ink, [rrect('glass.ink-hole', W - 0.03, H - 0.03, 0.01, R - 0.015, None, edge=0)])
PART['glass'].location.y = y_front + SKIN / 2

# Display: black panel, lit pixels inset by a thin border, a camera pill
dsp = PART['display']
iw, ih, ir = W - 2 * RIM + 0.004, H - 2 * RIM + 0.004, R - RIM + 0.002
rrect('display.panel', iw, ih, 0.006, ir, M['panel'], edge=0.0015, parent=dsp)
rrect('display.pixels', iw - 0.026, ih - 0.026, 0.0015, ir - 0.013, M['screen'], edge=0, parent=dsp,
      loc=(0, -0.0035, 0))
rrect('display.pill', 0.17, 0.05, 0.002, 0.025, M['black'], edge=0, parent=dsp, loc=(0, -0.0045, ih / 2 - 0.075))
PART['display'].location.y = y_front + SKIN + 0.003

# Frame: a metal band with buttons
frm = PART['frame']
band_ = rrect('frame.band', W, H, D - 2 * SKIN, R, M['frame'], edge=0.004, parent=frm)
hole = rrect('frame.hole', W - 2 * RIM, H - 2 * RIM, D, R - RIM, None, edge=0, parent=frm)
cut(band_, [hole])
finish(band_, None, 0.004)
for i, (z, h) in enumerate(((0.38, 0.16), (0.18, 0.1), (0.04, 0.1))):
    side = 1 if i == 0 else -1
    rrect(f'frame.button{i}', 0.012, h, 0.022, 0.006, M['frame'], edge=0.002, parent=frm,
          loc=(side * (W / 2 + 0.003), 0, z))
for k in range(6):  # speaker holes on the bottom edge
    cylinder(f'frame.grille{k}', 0.006, 0.02, M['black'], parent=frm, axis='Z',
             loc=(-0.2 + k * 0.025 if k < 3 else 0.12 + (k - 3) * 0.025, 0, -H / 2 + 0.006), verts=16, edge=0)
cylinder('frame.port', 0.016, 0.02, M['black'], parent=frm, axis='Z', loc=(0, 0, -H / 2 + 0.006), verts=24, edge=0)
frm.children[-1].scale = (3.0, 1.0, 1.0)
frm.location.y = 0

# Mainboard: a dark PCB in the top third, components on its front face
brd = PART['board']
BW, BH, BT = 0.6, 0.44, 0.006
BZ = H / 2 - RIM - BH / 2 - 0.02
rrect('board.pcb', BW, BH, BT, 0.04, M['pcb'], edge=0.0015, parent=brd, loc=(0, 0, BZ))
fy = -BT / 2  # front face of the PCB


def part(name, w, h, d, x, z, mat, r=0.006, edge=0.0015):
    return rrect(f'board.{name}', w, h, d, r, mat, edge=edge, parent=brd, loc=(x, fy - d / 2, BZ + z))


part('soc', 0.15, 0.15, 0.007, -0.1, 0.03, M['chip'])
part('soc.lid', 0.1, 0.1, 0.0015, -0.1, 0.03, M['lid'], r=0.004, edge=0.0006).location.y = fy - 0.0078
part('ram', 0.11, 0.07, 0.005, 0.12, 0.1, M['chip'])
part('storage', 0.11, 0.09, 0.005, 0.12, -0.02, M['chip'])
part('shield', 0.22, 0.1, 0.006, -0.12, -0.15, M['shield'], r=0.01)
part('pmic', 0.06, 0.06, 0.004, 0.06, -0.15, M['chip'])
part('conn.a', 0.08, 0.03, 0.004, 0.2, -0.16, M['gold'], r=0.003)
part('conn.b', 0.03, 0.08, 0.004, -0.255, 0.12, M['gold'], r=0.003)
part('ic.a', 0.045, 0.045, 0.003, 0.24, 0.17, M['chip'], r=0.003)
part('ic.b', 0.035, 0.05, 0.003, -0.24, -0.05, M['chip'], r=0.003)
part('shield.b', 0.1, 0.07, 0.005, 0.0, 0.17, M['shield'], r=0.008)
for i, (x, z) in enumerate(((-0.27, 0.19), (0.27, -0.19), (-0.27, -0.19), (0.27, 0.19))):  # screw pads
    cylinder(f'board.pad{i}', 0.014, 0.002, M['gold'], parent=brd, loc=(x, fy - 0.001, BZ + z), edge=0)
    cylinder(f'board.screw{i}', 0.008, 0.004, M['shield'], parent=brd, loc=(x, fy - 0.002, BZ + z), edge=0.001)
for i in range(130):  # passives in loose clusters around the big chips
    cx, cz = random.choice(((0.02, 0.13), (0.02, -0.07), (0.22, 0.05), (-0.22, -0.02), (0.15, -0.18), (-0.02, -0.2)))
    x = cx + random.uniform(-0.035, 0.035)
    z = cz + random.uniform(-0.03, 0.03)
    w, h = random.choice(((0.012, 0.006), (0.006, 0.012), (0.009, 0.005)))
    part(f'passive{i}', w, h, 0.003, x, z, M['passive'] if i % 3 else M['chip'], r=0.0, edge=0.0005)
brd.location.y = -0.016

# Battery: the biggest part, below the board
bat = PART['battery']
AW, AH, AT = 0.6, 0.86, 0.034
AZ = -H / 2 + RIM + AH / 2 + 0.03
rrect('battery.cell', AW, AH, AT, 0.035, M['battery'], edge=0.004, parent=bat, loc=(0, 0, AZ))
rrect('battery.label', AW - 0.08, AH * 0.42, 0.001, 0.02, M['label'], edge=0, parent=bat,
      loc=(0, -AT / 2 - 0.0006, AZ + 0.1))
rrect('battery.stripe', AW - 0.08, 0.012, 0.0012, 0.0, M['accent'], edge=0, parent=bat,
      loc=(0, -AT / 2 - 0.0009, AZ + 0.1 - AH * 0.21 - 0.02))
rrect('battery.flex', 0.07, 0.12, 0.002, 0.004, M['flex'], edge=0, parent=bat,
      loc=(0.18, -AT / 2 - 0.0015, AZ + AH / 2 + 0.03))
rrect('battery.plug', 0.08, 0.035, 0.006, 0.004, M['shield'], edge=0.001, parent=bat,
      loc=(0.18, -AT / 2 - 0.003, AZ + AH / 2 + 0.085))
bat.location.y = 0.006

# Camera module: a dark plate with three lenses, a flash, behind the back
cam_ = PART['camera']
CX, CZ = 0.17, H / 2 - 0.2
LENSES = [(-0.06, 0.06), (-0.06, -0.075), (0.065, -0.005)]
rrect('camera.plate', 0.3, 0.3, 0.014, 0.06, M['plate'], edge=0.002, parent=cam_, loc=(CX, 0, CZ))
for i, (dx, dz) in enumerate(LENSES):
    x, z = CX + dx, CZ + dz
    cylinder(f'camera.barrel{i}', 0.058, 0.046, M['ring'], parent=cam_, loc=(x, 0.016, z), edge=0.003)
    cylinder(f'camera.coat{i}', 0.047, 0.004, M['coating'], parent=cam_, loc=(x, 0.0395, z), edge=0.001)
    cylinder(f'camera.glass{i}', 0.036, 0.004, M['lens'], parent=cam_, loc=(x, 0.0405, z), edge=0.002)
cylinder('camera.flash', 0.02, 0.012, M['flash'], parent=cam_, loc=(CX + 0.07, 0.03, CZ + 0.09), edge=0.001)
cam_.location.y = 0.01

# Back glass: frosted, with holes for the lenses and the flash
bk = PART['back']
back = rrect('back.slab', W, H, SKIN, R, M['back'], edge=0.0025, parent=bk)
holes = [cylinder(f'back.hole{i}', 0.0605, 0.05, None, parent=bk, loc=(CX + dx, 0, CZ + dz), edge=0)
         for i, (dx, dz) in enumerate(LENSES)]
holes.append(cylinder('back.hole-flash', 0.022, 0.05, None, parent=bk, loc=(CX + 0.07, 0, CZ + 0.09), edge=0))
cut(back, holes)
finish(back, None, 0.0025)
bk.location.y = y_back - SKIN / 2

REST = {n: Vector(PART[n].location) for n in LAYERS}

# Exploded offsets: spread along Y around the frame, and slightly down
# towards the front so the stack reads as a descending diagonal
GAP = Vector((0.0, 0.42, 0.22))
EXPLODE = {n: GAP * (i - 3) for i, n in enumerate(LAYERS)}


# ---------------------------------------------------------------- posing

# Pivot of each part for pulls that turn it (its own centre)
PIVOT = {n: Vector((0, 0, 0)) for n in LAYERS}
PIVOT['board'] = Vector((0, 0, BZ))
PIVOT['battery'] = Vector((0, 0, AZ))
PIVOT['camera'] = Vector((CX, 0.02, CZ))


def pose(explode=0.0, spin=0.0, tilt=0.0, rise=0.0, pull=None, reveal=1.2):
    """Places every part. explode 0..1; spin and tilt in degrees (the
    whole phone around Z and X); rise lifts it; pull maps a layer to an
    extra offset (x, y, z), or to (offset, (rx, ry, rz) in degrees) to
    also turn it about its own centre: slides one part out of the stack."""
    ROOT.rotation_euler = (math.radians(tilt), 0, math.radians(spin))
    ROOT.location = (0, 0, rise)
    REVEAL.outputs[0].default_value = reveal
    for n in LAYERS:
        p = REST[n] + EXPLODE[n] * explode
        rot = Euler((0, 0, 0))
        if pull and n in pull:
            off = pull[n]
            if len(off) == 2:
                off, r = off
                rot = Euler([math.radians(a) for a in r])
                c = PIVOT[n]
                p = p + c - rot.to_matrix() @ c
            p = p + Vector(off)
        PART[n].location = p
        PART[n].rotation_euler = rot


def bake(t0, dur, fn):
    """Bakes fn(t) → pose kwargs for every frame of a shot (shot-local t)."""
    fps = kit.FPS
    first = round(t0 * fps)
    n = round(dur * fps)
    objs = [ROOT] + [PART[k] for k in LAYERS]
    for f in range(0, n + 2):  # one frame either side for motion blur
        pose(**fn((f - 1) / fps))
        for o in objs:
            o.keyframe_insert('location', frame=first + f)
            o.keyframe_insert('rotation_euler', frame=first + f)
        REVEAL.outputs[0].keyframe_insert('default_value', frame=first + f)


def camera(name, t0, dur, fn, lens=50, f_stop=None, clip=(0.05, 60)):
    """One camera for a shot: fn(t) → (position, aim), shot-local t,
    baked per frame. The aim is also the focus point."""
    fps = kit.FPS
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.sensor_fit = 'VERTICAL'
    data.sensor_height = 24
    data.clip_start, data.clip_end = clip
    cam = link(bpy.data.objects.new(name, data))
    aim = empty(name + '.aim')
    tr = cam.constraints.new('TRACK_TO')
    tr.target = aim
    tr.track_axis = 'TRACK_NEGATIVE_Z'
    tr.up_axis = 'UP_Y'
    if f_stop:
        data.dof.use_dof = True
        data.dof.aperture_fstop = f_stop
        data.dof.focus_object = aim
    first = round(t0 * fps)
    for f in range(0, round(dur * fps) + 2):
        loc, target = fn((f - 1) / fps)
        cam.location = loc
        aim.location = target
        cam.keyframe_insert('location', frame=first + f)
        aim.keyframe_insert('location', frame=first + f)
    return cam


def orbit(angle, radius, height, center=(0, 0, 0)):
    """A point on a circle around center: angle 0 is in front (-Y),
    positive angles swing to the right (+X)."""
    a = math.radians(angle)
    c = Vector(center)
    return Vector((c.x + radius * math.sin(a), c.y - radius * math.cos(a), height))


pose()
