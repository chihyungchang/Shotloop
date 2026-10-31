"""World: a mechanical watch in a dark studio. Blender metres, +Z up;
film time in seconds (30.5 s). Two sets share one movement design and
one clock:

WATCH (watch['root'] at WATCH_C): the complete watch, 2 m across, floating.
  0-3.5   hero: dial faces the camera at -Y (three-quarter), then turns to
          show the sapphire caseback; seconds hand sweeps.
  3.5-5   lies dial-up: 12 o'clock at +Y, crown (9 o'clock) on the left.
  4.15-7  layers rise one after another along +Z (the case stays):
          LAYERS top to bottom, layer_z(name) = world z when exploded,
          watch['layers'][name] = the empty each layer hangs on.
  27-29.3 layers come back down; 28.3-30.2 it turns back to the hero pose.
BENCH (bench['root'] at BENCH_C, x = 12): the same movement assembled, no
  case or dial (a chapter ring and hour/minute hands float above it),
  dial-side up, crown on the left (-X): the set for shots 3-6.
  bench_at(part) -> world point: 'barrel', 'centre', 'third', 'fourth',
  'escape', 'fork', 'balance', 'crown', 'hands', 'movement'.
Clock: the balance swings (SWING), crossing zero at beats(); at each beat
  the pallet fork flips and the escape wheel steps half a tooth; the train
  follows at 2.5:1 per stage (barrel -> centre -> third -> fourth ->
  escape). wind(t) 0..1: the crown winds the mainspring tight between 8.4
  and 12.2 s, and the spring glows gold as it does (gold glow = energy).

Helpers (t is film time):
  label(text, loc, size, parent, cam, show=(t_in, t_out))  white text
  callout(text, anchor, at, size, parent, cam, show)  label + leader + dot;
                        anchor/at in parent space, text on the side of at
                        (+x = screen right on the dial-up watch and bench)
  face(obj, cam)        turn text towards a shot's camera (kit.Shot(...).cam)
  glow(obj, [(t, 0-4), ...])  eased gold emission on obj and its children
  flash(loc, t, size, parent)  a short gold spark (a tick)
  ticker([(t, 'text'), ...], loc, size, parent, cam)  text that changes;
                        returns an empty to scale or move
  beats(t0, t1)         film times of the ticks in [t0, t1]
Palette: STEEL GOLD BRASS BLUE_STEEL RUBY DIAL_WHITE INK GLOW WHITE; M[...]
are the shared materials. Captions own the top 40% of the frame.
"""

import math
import os

import bmesh
import bpy
from mathutils import Vector

import kit

DURATION = 30.5
FPS = kit.FPS
FRAMES = round(DURATION * FPS)

s = kit.reset(DURATION, size=(1080, 1920), samples=32)
try:
    # Full-resolution, denoised ray tracing: no speckle on the matte dial
    s.eevee.ray_tracing_options.resolution_scale = '1'
    s.eevee.ray_tracing_options.use_denoise = True
except (AttributeError, TypeError):
    pass


def fr(t):
    """Film seconds to a (fractional) frame; frame 1 is t = 0."""
    return t * FPS + 1


def smooth(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def ang(deg):
    return Vector((math.cos(math.radians(deg)), math.sin(math.radians(deg))))


# ---- Palette and materials ----
BG = (0.0055, 0.006, 0.0072)
STEEL = (0.80, 0.81, 0.83)
GOLD = (1.0, 0.74, 0.40)
BRASS = (0.92, 0.69, 0.36)
BLUE_STEEL = (0.04, 0.13, 0.62)
RUBY = (0.55, 0.01, 0.04)
DIAL_WHITE = (0.92, 0.92, 0.90)
INK = (0.012, 0.012, 0.015)
GLOW = (1.0, 0.60, 0.18)
WHITE = (1.0, 1.0, 1.0)

M = {
    'case': kit.mat('case', STEEL, roughness=0.3, metallic=1.0),
    'steel': kit.mat('steel', STEEL, roughness=0.16, metallic=1.0),
    'gold': kit.mat('gold', GOLD, roughness=0.24, metallic=1.0),
    'plate': kit.mat('plate', (0.86, 0.62, 0.32), roughness=0.38, metallic=1.0),
    'brass': kit.mat('brass', BRASS, roughness=0.28, metallic=1.0),
    'blue': kit.mat('blue-steel', BLUE_STEEL, roughness=0.22, metallic=1.0),
    'ruby': kit.mat('ruby', RUBY, roughness=0.12, emission=(0.9, 0.0, 0.04), strength=0.35),
    'dial': kit.mat('dial', DIAL_WHITE, roughness=0.55),
    'ink': kit.mat('ink', INK, roughness=0.3, metallic=0.4),
    'spring': kit.mat('mainspring', STEEL, roughness=0.2, metallic=1.0),
}


def _glass():
    """Sapphire: fully see-through, with Fresnel reflections on top."""
    m = bpy.data.materials.new('sapphire')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    clear = nt.nodes.new('ShaderNodeBsdfTransparent')
    shine = nt.nodes.new('ShaderNodeBsdfPrincipled')
    shine.inputs['Base Color'].default_value = (0, 0, 0, 1)
    shine.inputs['Roughness'].default_value = 0.03
    shine.inputs['IOR'].default_value = 1.77
    add = nt.nodes.new('ShaderNodeAddShader')
    nt.links.new(clear.outputs[0], add.inputs[0])
    nt.links.new(shine.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], out.inputs['Surface'])
    try:
        m.surface_render_method = 'BLENDED'
    except (AttributeError, TypeError):
        m.blend_method = 'BLEND'
    return m


M['glass'] = _glass()


# ---- Mesh builders (local coordinates, parented) ----
def empty(name, parent=None, loc=(0, 0, 0)):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.parent = parent
    o.location = loc
    return o


def mesh(name, verts, faces, mat, parent=None, loc=(0, 0, 0), sharp=35):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    try:
        me.set_sharp_from_angle(angle=math.radians(sharp))
    except (AttributeError, TypeError):
        pass
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.parent = parent
    o.location = loc
    return o


def circle(r, n=64):
    return [(2 * math.pi * i / n, r) for i in range(n)]


def teeth(n, r_root, r_tip, phase=0.0, kind='gear'):
    """Outline of a toothed rim as (angle, radius); 'saw' leans to +angle."""
    p = 2 * math.pi / n
    out = []
    for j in range(n):
        a = phase + j * p
        if kind == 'gear':
            out += [(a - 0.27 * p, r_root), (a - 0.12 * p, r_tip), (a + 0.12 * p, r_tip), (a + 0.27 * p, r_root)]
        else:
            out += [(a - 0.45 * p, r_root), (a + 0.25 * p, r_tip), (a + 0.33 * p, r_tip), (a + 0.36 * p, r_root)]
    return out


def ring(name, outline, r_in, z0, z1, mat, parent=None, loc=(0, 0, 0)):
    """Prism of an outline around Z; a hole of radius r_in, or solid."""
    n = len(outline)
    v = []
    for a, r in outline:
        v += [(r * math.cos(a), r * math.sin(a), z0), (r * math.cos(a), r * math.sin(a), z1)]
    f = []
    if r_in > 0:
        for a, _ in outline:
            v += [(r_in * math.cos(a), r_in * math.sin(a), z0), (r_in * math.cos(a), r_in * math.sin(a), z1)]
    for i in range(n):
        j = (i + 1) % n
        f.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
        if r_in > 0:
            o = 2 * n
            f.append((o + 2 * j, o + 2 * i, o + 2 * i + 1, o + 2 * j + 1))
            f.append((2 * i + 1, 2 * j + 1, o + 2 * j + 1, o + 2 * i + 1))
            f.append((2 * j, 2 * i, o + 2 * i, o + 2 * j))
    if r_in <= 0:
        f.append(tuple(2 * i + 1 for i in range(n)))
        f.append(tuple(2 * i for i in reversed(range(n))))
    return mesh(name, v, f, mat, parent, loc)


def disc(name, r, z0, z1, mat, parent=None, at=(0, 0), segs=48):
    return ring(name, circle(r, segs), 0, z0, z1, mat, parent, (at[0], at[1], 0))


def prism(name, pts, z0, z1, mat, parent=None, loc=(0, 0, 0)):
    n = len(pts)
    v = [(x, y, z0) for x, y in pts] + [(x, y, z1) for x, y in pts]
    f = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    f += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return mesh(name, v, f, mat, parent, loc)


def slab(name, p0, p1, w, z0, z1, mat, parent=None):
    """A flat bar from p0 to p1 (xy), w wide."""
    a, b = Vector(p0), Vector(p1)
    d = (b - a).normalized()
    nrm = Vector((-d.y, d.x)) * (w / 2)
    return prism(name, [a + nrm, b + nrm, b - nrm, a - nrm], z0, z1, mat, parent)


def spiral(name, radii, turns, thick, z0, z1, mat, parent=None):
    """Flat ribbon spring: radii(u) for u in 0..1 along `turns` turns."""
    v, f = [], []
    n = len(radii)
    for i, r in enumerate(radii):
        a = 2 * math.pi * turns * i / (n - 1)
        c, si = math.cos(a), math.sin(a)
        for rr in (r - thick / 2, r + thick / 2):
            v += [(rr * c, rr * si, z0), (rr * c, rr * si, z1)]
    for i in range(n - 1):
        b, m = 4 * i, 4 * i + 4
        f += [(b, m, m + 1, b + 1), (b + 2, b + 3, m + 3, m + 2), (b + 1, m + 1, m + 3, b + 3), (b, b + 2, m + 2, m)]
    f += [(0, 1, 3, 2), (4 * n - 4, 4 * n - 2, 4 * n - 1, 4 * n - 3)]
    return mesh(name, v, f, mat, parent, sharp=60)


def spiral_points(n, fn, thick, z0, z1, turns):
    out = []
    for i in range(n):
        u = i / (n - 1)
        r = fn(u)
        a = 2 * math.pi * turns * u
        c, si = math.cos(a), math.sin(a)
        for rr in (r - thick / 2, r + thick / 2):
            out += [(rr * c, rr * si, z0), (rr * c, rr * si, z1)]
    return out


def wheel(name, n, R, z0, z1, mat, parent, spokes=5, kind='gear', phase=0.0):
    """Spoked wheel: toothed rim, crossings and hub."""
    c = 2 * math.pi * R / n
    tip, root = (R + 0.30 * c, R - 0.36 * c) if kind == 'gear' else (R, R - 0.035)
    rim_in = root - max(0.022, 0.1 * R)
    ring(name + '.rim', teeth(n, root, tip, phase, kind), rim_in, z0, z1, mat, parent)
    hub = max(0.028, 0.15 * R)
    disc(name + '.hub', hub, z0, z1, mat, parent)
    for k in range(spokes):
        d = ang(math.degrees(phase) + 90 + 360 * k / spokes)
        slab(f'{name}.spoke{k}', d * (hub * 0.7), d * (rim_in + 0.004), max(0.014, 0.09 * R),
             z0 + 0.002, z1 - 0.002, mat, parent)


def pinion(name, n, r, z0, z1, parent):
    c = 2 * math.pi * r / n
    ring(name, teeth(n, r - 0.36 * c, r + 0.30 * c), 0.008, z0, z1, M['steel'], parent)


def arbor(name, xy, parent, z_lo, z_hi):
    """Rotating axis: a steel pivot with a ruby jewel on top."""
    e = empty(name, parent, (xy[0], xy[1], 0))
    disc(name + '.arbor', 0.011, z_lo, z_hi, M['steel'], e, segs=24)
    disc(name + '.jewel', 0.02, z_hi, z_hi + 0.006, M['ruby'], e, segs=24)
    return e


def hand(name, length, w, tail, z0, z1, mat, parent):
    pts = [(-w * 0.3, -tail), (w * 0.3, -tail), (w * 0.5, 0.0), (w * 0.32, length * 0.86),
           (0.0, length), (-w * 0.32, length * 0.86), (-w * 0.5, 0.0)]
    return prism(name, pts, z0, z1, mat, parent)


# ---- Movement layout (local xy, dial side up, crown at 9 o'clock = -x) ----
RATIO = 2.5                      # every wheel/pinion stage
R_B, N_B = 0.32, 60              # barrel teeth
R_CP, N_CP = 0.128, 24           # centre pinion
R_C, N_C = 0.22, 55              # centre wheel (minute hand)
R_TP, N_TP = 0.088, 22
R_T, N_T = 0.20, 50              # third wheel
R_FP, N_FP = 0.08, 20
R_F, N_F = 0.19, 50              # fourth wheel
R_EP, N_EP = 0.076, 20
ESC_TIP, N_E = 0.15, 15          # escape wheel

C = Vector((0.0, 0.0))
B = C + ang(180) * (R_B + R_CP)
T = C + ang(40) * (R_C + R_TP)
F4 = T + ang(-40) * (R_T + R_FP)
E = F4 + ang(-110) * (R_F + R_EP)
PALLET_LEN = 0.06                            # ruby pallet stones
R_PC = ESC_TIP + 0.005 + PALLET_LEN / 2      # stone centres from E, at rest
FORK = E + ang(225) * (R_PC / math.cos(math.radians(42)))
BAL = FORK + ang(225) * 0.22
FORK_SWING = 0.027 / (R_PC * math.tan(math.radians(42)))   # 0.027 deep when locked


def _phase(phi_a, alpha, n_a, n_b):
    """Pinion phase that meshes with a wheel of phase phi_a at contact alpha."""
    return alpha + math.pi - (phi_a - alpha) * n_a / n_b - math.pi / n_b


def _angle(v):
    return math.atan2(v.y, v.x)


PHI = [0.0]
PHI.append(_phase(PHI[0], _angle(C - B), N_B, N_CP))
PHI.append(_phase(PHI[1], _angle(T - C), N_C, N_TP))
PHI.append(_phase(PHI[2], _angle(F4 - T), N_T, N_FP))
PHI.append(_phase(PHI[3], _angle(E - F4), N_F, N_EP))
SIGN = [1, -1, 1, -1, 1]         # barrel ... escape (centre turns clockwise)


def _rot2(v, a):
    return Vector((v.x * math.cos(a) - v.y * math.sin(a), v.x * math.sin(a) + v.y * math.cos(a)))


_pallets = [E + ang(225 + 42) * R_PC, E + ang(225 - 42) * R_PC]
_d = [((FORK + _rot2(q - FORK, FORK_SWING)) - E).length for q in _pallets]
PALLET_A, PALLET_B = _pallets if _d[0] < _d[1] else _pallets[::-1]
# Escape teeth offset: a gap sits under pallet B when the wheel is at rest
PSI = _angle(PALLET_B - E) - 0.58 * 2 * math.pi / N_E - PHI[4]

# ---- The clock ----
BEAT = 0.4                       # s between ticks (slowed down to be seen)
STEP = 2 * math.pi / (2 * N_E)   # escape advance per tick: half a tooth
SWING = math.radians(120)        # balance amplitude


def _beat(t):
    tau = t / BEAT - 0.5
    k = math.floor(tau + 0.5)
    return k, (tau - k) * 2 + 0.5


def escape_turn(t):
    k, u = _beat(t)
    return STEP * (k + smooth((u - 0.4) / 0.4))


def fork_side(t):
    k, u = _beat(t)
    before, after = (-1) ** (k - 1), (-1) ** k
    return before + (after - before) * smooth(u)


def balance_angle(t):
    return SWING * math.sin(math.pi * (t / BEAT - 0.5))


def wind(t):
    return smooth((t - 8.4) / 3.8)


def beats(t0, t1):
    """Film times of the ticks (balance through centre) within [t0, t1]."""
    k = math.ceil(t0 / BEAT - 0.5)
    out = []
    while (k + 0.5) * BEAT <= t1:
        out.append((k + 0.5) * BEAT)
        k += 1
    return out


def train(k, t):
    """Angle of train arbor k (0 barrel .. 4 escape)."""
    return PHI[k] + SIGN[k] * escape_turn(t) / RATIO ** (4 - k)


# ---- Animation baking: one linear key per frame, pure function of t ----
def bake(owner, path, fn, index=-1):
    owner.keyframe_insert(path, index=index, frame=1)
    want = max(index, 0)
    fc = next(c for c in kit.fcurves(owner.animation_data.action)
              if c.data_path == path and c.array_index == want)
    kp = fc.keyframe_points
    frames = range(0, FRAMES + 2)
    kp.add(len(frames) - 1)
    co = []
    for f in frames:
        co += (f, fn((f - 1) / FPS))
    kp.foreach_set('co', co)
    for k in kp:
        k.interpolation = 'LINEAR'
    fc.update()


# ---- Layers of the watch, top to bottom ----
LAYERS = ['crystal', 'hands', 'dial', 'train', 'barrel', 'escapement', 'balance', 'mainplate', 'case']
LABELS = {'crystal': 'Sapphire crystal', 'hands': 'Hands', 'dial': 'Dial', 'train': 'Gear train',
          'barrel': 'Mainspring barrel', 'escapement': 'Escapement', 'balance': 'Balance wheel',
          'mainplate': 'Mainplate', 'case': 'Case'}
LAYER_MID = {'crystal': 0.18, 'hands': 0.12, 'dial': 0.09, 'train': 0.035, 'barrel': -0.03,
             'escapement': -0.034, 'balance': -0.07, 'mainplate': -0.115, 'case': 0.0}
SPREAD = 0.38                    # gap between exploded layers
CASE_GAP = 0.55                  # the case is thick: more room above it


def crown(name, parent, stem):
    """Crown and stem along -x from (-0.99, 0); returns the spinning part."""
    pivot = empty(name, parent, (-0.99, 0, -0.002))
    pivot.rotation_euler = (0, -math.pi / 2, 0)
    spin = empty(name + '.spin', pivot)
    disc(name + '.tube', 0.05, 0.0, 0.04, M['case'], pivot)
    ring(name + '.knurl', teeth(30, 0.098, 0.108), 0, 0.04, 0.13, M['steel'], spin)
    disc(name + '.cap', 0.085, 0.13, 0.137, M['steel'], spin)
    disc(name + '.stem', 0.016, -stem, 0.0, M['steel'], spin, segs=16)
    return spin


def build(tag, root, kind):
    """The watch ('watch') or the assembled movement ('bench')."""
    lay = {n: empty(f'{tag}.{n}', root) for n in LAYERS}
    p = {'root': root, 'layers': lay}

    # Hands (on the centre axis)
    hl = lay['hands']
    disc(f'{tag}.hands.cap', 0.03, 0.108, 0.134, M['ink'], hl)
    spec = [('hour', 0.45, 0.07, 0.08, 0.110, 0.116), ('minute', 0.70, 0.052, 0.10, 0.118, 0.124)]
    if kind == 'watch':
        spec.append(('second', 0.78, 0.014, 0.2, 0.126, 0.130))
    for name, length, w, tail, z0, z1 in spec:
        piv = empty(f'{tag}.{name}', hl)
        hand(f'{tag}.{name}.hand', length, w, tail, z0, z1, M['ink'], piv)
        p[name] = piv
    if kind == 'watch':
        disc(f'{tag}.second.weight', 0.03, 0.126, 0.130, M['ink'], p['second'], at=(0, -0.16))

    # Dial, or a chapter ring on the bench
    dl = lay['dial']
    if kind == 'watch':
        disc(f'{tag}.dial', 0.862, 0.08, 0.10, M['dial'], dl, segs=128)
        for i in range(60):
            d = ang(90 - 6 * i)
            if i % 5:
                slab(f'{tag}.tick{i}', d * 0.80, d * 0.83, 0.008, 0.10, 0.103, M['ink'], dl)
            elif i == 0:
                for off in (-0.032, 0.032):
                    side = Vector((off, 0))
                    slab(f'{tag}.index12{off}', d * 0.62 + side, d * 0.78 + side, 0.04, 0.10, 0.107, M['ink'], dl)
            else:
                slab(f'{tag}.index{i}', d * 0.64, d * 0.78, 0.05, 0.10, 0.107, M['ink'], dl)
    else:
        ring(f'{tag}.chapter', circle(0.862, 128), 0.822, 0.09, 0.10, M['dial'], dl)
        for i in range(12):
            d = ang(90 - 30 * i)
            slab(f'{tag}.index{i}', d * 0.828, d * 0.856, 0.022 if i else 0.04, 0.10, 0.104, M['ink'], dl)

    # Gear train: centre, third and fourth wheels with their pinions
    tr = lay['train']
    p['centre'] = c = arbor(f'{tag}.centre', C, tr, -0.02, 0.072)
    pinion(f'{tag}.centre.pinion', N_CP, R_CP, -0.012, 0.008, c)
    wheel(f'{tag}.centre.wheel', N_C, R_C, 0.050, 0.064, M['brass'], c, spokes=4)
    p['third'] = th = arbor(f'{tag}.third', T, tr, 0.018, 0.072)
    pinion(f'{tag}.third.pinion', N_TP, R_TP, 0.050, 0.064, th)
    wheel(f'{tag}.third.wheel', N_T, R_T, 0.026, 0.040, M['brass'], th)
    p['fourth'] = fo = arbor(f'{tag}.fourth', F4, tr, -0.006, 0.072)
    pinion(f'{tag}.fourth.pinion', N_FP, R_FP, 0.026, 0.040, fo)
    wheel(f'{tag}.fourth.wheel', N_F, R_F, 0.002, 0.016, M['brass'], fo)

    # Barrel: open drum (lid cut away), mainspring, arbor with ratchet
    bl = lay['barrel']
    b = empty(f'{tag}.barrel', bl, (B.x, B.y, 0))
    p['barrel'] = drum = empty(f'{tag}.barrel.drum', b)
    ring(f'{tag}.barrel.wall', circle(0.306, 96), 0.285, -0.07, -0.012, M['brass'], drum)
    cb = 2 * math.pi * R_B / N_B
    ring(f'{tag}.barrel.teeth', teeth(N_B, R_B - 0.36 * cb, R_B + 0.30 * cb), 0.285, -0.012, 0.008, M['brass'], drum)
    disc(f'{tag}.barrel.floor', 0.286, -0.07, -0.062, M['brass'], drum, segs=96)
    p['barrel_arbor'] = arb = empty(f'{tag}.barrel.arbor', b)
    disc(f'{tag}.barrel.axle', 0.04, -0.074, 0.012, M['steel'], arb)
    ring(f'{tag}.barrel.ratchet', teeth(16, 0.04, 0.052, kind='saw'), 0, 0.012, 0.022, M['steel'], arb)
    disc(f'{tag}.barrel.jewel', 0.018, 0.022, 0.028, M['ruby'], arb, segs=24)
    n_sp, turns = 7 * 72, 7

    def loose(u):
        return 0.055 + (0.272 - 0.055) * u

    def tight(u):
        core = 0.055 + 0.0075 * turns * u
        return core + (0.272 - core) * smooth((u - 0.8) / 0.2)

    spring = spiral(f'{tag}.mainspring', [loose(i / (n_sp - 1)) for i in range(n_sp)],
                    turns, 0.006, -0.058, -0.004, M['spring'], arb)
    spring.shape_key_add(name='Basis')
    key = spring.shape_key_add(name='tight', from_mix=False)
    for i, co in enumerate(spiral_points(n_sp, tight, 0.006, -0.058, -0.004, turns)):
        key.data[i].co = co
    p['spring'] = spring

    # Escapement: escape wheel and pallet fork with two ruby pallets
    el = lay['escapement']
    p['escape'] = e = arbor(f'{tag}.escape', E, el, -0.046, 0.022)
    pinion(f'{tag}.escape.pinion', N_EP, R_EP, 0.002, 0.016, e)
    wheel(f'{tag}.escape.wheel', N_E, ESC_TIP, -0.040, -0.028, M['steel'], e, kind='saw', phase=PSI)
    p['fork'] = fk = empty(f'{tag}.fork', el, (FORK.x, FORK.y, 0))
    disc(f'{tag}.fork.hub', 0.02, -0.044, -0.026, M['steel'], fk, segs=24)
    disc(f'{tag}.fork.arbor', 0.007, -0.06, -0.018, M['steel'], fk, segs=16)
    disc(f'{tag}.fork.jewel', 0.014, -0.018, -0.013, M['ruby'], fk, segs=16)
    for i, q in enumerate((PALLET_A, PALLET_B)):
        d = (q - E).normalized()
        cq = q - FORK
        slab(f'{tag}.fork.arm{i}', (0, 0), cq, 0.022, -0.040, -0.030, M['steel'], fk)
        slab(f'{tag}.fork.pallet{i}', cq - d * PALLET_LEN / 2, cq + d * PALLET_LEN / 2, 0.016,
             -0.042, -0.026, M['ruby'], fk)
    lever = ang(225)
    side = Vector((-lever.y, lever.x))
    slab(f'{tag}.fork.lever', (0, 0), lever * 0.178, 0.02, -0.040, -0.030, M['steel'], fk)
    for sgn in (-1, 1):
        o = side * (0.017 * sgn)
        slab(f'{tag}.fork.horn{sgn}', lever * 0.165 + o, lever * 0.205 + o, 0.01, -0.040, -0.028, M['steel'], fk)

    # Balance wheel and hairspring
    bal_l = lay['balance']
    p['balance'] = bw = empty(f'{tag}.balance', bal_l, (BAL.x, BAL.y, 0))
    ring(f'{tag}.balance.rim', circle(0.21, 96), 0.186, -0.092, -0.074, M['gold'], bw)
    for k in range(3):
        d = ang(90 + 120 * k)
        slab(f'{tag}.balance.arm{k}', d * 0.015, d * 0.19, 0.022, -0.089, -0.077, M['gold'], bw)
    for k in range(14):
        disc(f'{tag}.balance.screw{k}', 0.009, -0.074, -0.067, M['gold'], bw, at=ang(360 * k / 14) * 0.198, segs=12)
    disc(f'{tag}.balance.hub', 0.025, -0.094, -0.072, M['gold'], bw, segs=24)
    disc(f'{tag}.balance.arbor', 0.008, -0.098, -0.02, M['steel'], bw, segs=16)
    disc(f'{tag}.balance.jewel', 0.015, -0.02, -0.014, M['ruby'], bw, segs=16)
    disc(f'{tag}.balance.roller', 0.036, -0.054, -0.047, M['steel'], bw, segs=32)
    disc(f'{tag}.balance.pin', 0.0065, -0.054, -0.030, M['ruby'], bw, at=(0.03, 0), segs=12)
    p['hairspring'] = hs = empty(f'{tag}.hairspring', bal_l, (BAL.x, BAL.y, 0))
    spiral(f'{tag}.hairspring.coil', [0.03 + 0.095 * i / 767 for i in range(768)], 12, 0.0035,
           -0.068, -0.061, M['blue'], hs)

    # Mainplate: gilt plate, ruby jewels, a window under the balance
    ml = lay['mainplate']
    plate = disc(f'{tag}.plate', 0.84, -0.13, -0.10, M['plate'], ml, segs=128)
    cutter = disc(f'{tag}.plate.cut', 0.225, -0.2, 0.0, M['plate'], ml, at=BAL, segs=64)
    cutter.hide_render = True
    cutter.display_type = 'WIRE'
    mod = plate.modifiers.new('window', 'BOOLEAN')
    mod.object = cutter
    mod.operation = 'DIFFERENCE'
    for poly in plate.data.polygons:
        poly.use_smooth = False   # flat: the cut would bend smooth normals
    br = ang(315)
    slab(f'{tag}.plate.bridge', BAL - br * 0.3, BAL + br * 0.3, 0.07, -0.13, -0.112, M['plate'], ml)
    for nm, xy in (('b', B), ('c', C), ('t', T), ('f', F4), ('e', E), ('k', FORK), ('bal', BAL)):
        disc(f'{tag}.plate.jewel.{nm}', 0.022, -0.134, -0.096 if nm != 'bal' else -0.108, M['ruby'], ml, at=xy, segs=24)

    if kind == 'watch':
        # Crystal
        disc(f'{tag}.crystal', 0.868, 0.165, 0.20, M['glass'], lay['crystal'], segs=128)
        # Case: mid-case, bezel, lugs, exhibition caseback, crown
        cl = lay['case']
        ring(f'{tag}.case.mid', circle(1.0, 128), 0.875, -0.155, 0.145, M['case'], cl)
        ring(f'{tag}.case.bezel', circle(0.985, 128), 0.85, 0.145, 0.205, M['steel'], cl)
        ring(f'{tag}.case.back', circle(0.95, 128), 0.60, -0.195, -0.155, M['case'], cl)
        disc(f'{tag}.case.window', 0.605, -0.19, -0.165, M['glass'], cl, segs=96)
        for sx in (-1, 1):
            for sy in (-1, 1):
                # Lug: tapers down and out from the mid-case
                x0, x1, y0, y1 = 0.56 * sx - 0.065, 0.56 * sx + 0.065, 0.80 * sy, 1.17 * sy
                v = [(x0, y0, -0.11), (x1, y0, -0.11), (x1, y1, -0.11), (x0, y1, -0.11),
                     (x0, y0, 0.10), (x1, y0, 0.10), (x1, y1, -0.02), (x0, y1, -0.02)]
                f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
                mesh(f'{tag}.case.lug{sx}{sy}', v, f, M['case'], cl)
        p['crown'] = crown(f'{tag}.crown', cl, 0.13)
        # Warm glow inside the case: the gilt movement shows through the window
        glim = kit.point((0, 0, -0.145), energy=8, color=(1.0, 0.75, 0.45), radius=0.45)
        glim.parent = cl
    else:
        p['crown'] = crown(f'{tag}.crown', root, 0.19)
    return p


def animate(p, kind):
    """Run the movement on the film clock."""
    bake(p['barrel'], 'rotation_euler', lambda t: train(0, t), 2)
    for k, name in ((1, 'centre'), (2, 'third'), (3, 'fourth'), (4, 'escape')):
        bake(p[name], 'rotation_euler', lambda t, k=k: train(k, t), 2)
    bake(p['fork'], 'rotation_euler', lambda t: FORK_SWING * fork_side(t), 2)
    base = _angle(FORK - BAL)
    bake(p['balance'], 'rotation_euler', lambda t: base + balance_angle(t), 2)
    bake(p['hairspring'], 'rotation_euler', lambda t: base + 0.35 * balance_angle(t), 2)
    for i in (0, 1):
        bake(p['hairspring'], 'scale', lambda t: 1 - 0.05 * balance_angle(t) / SWING, i)
    bake(p['barrel_arbor'], 'rotation_euler', lambda t: -2 * math.pi * 1.25 * wind(t), 2)
    bake(p['spring'].data.shape_keys, 'key_blocks["tight"].value', wind)
    bake(p['crown'], 'rotation_euler', lambda t: 2 * math.pi * 3 * wind(t), 2)
    if kind == 'watch':
        bake(p['second'], 'rotation_euler', lambda t: -math.radians(120 + 6 * t), 2)
        bake(p['minute'], 'rotation_euler', lambda t: -math.radians(60 + 0.1 * t), 2)
        bake(p['hour'], 'rotation_euler', lambda t: -math.radians(305 + 0.1 * t / 12), 2)
    else:
        c0 = train(1, 0)
        bake(p['minute'], 'rotation_euler', lambda t: -math.radians(48) + train(1, t) - c0, 2)
        bake(p['hour'], 'rotation_euler', lambda t: -math.radians(64) + (train(1, t) - c0) / 12, 2)
    glow(p['spring'], [(8.4, 0.0), (12.2, 2.4)])


# ---- Text and effects ----
def _font():
    for path in ('/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/Library/Fonts/Arial Bold.ttf',
                 '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'C:/Windows/Fonts/arialbd.ttf'):
        if os.path.exists(path):
            try:
                return bpy.data.fonts.load(path, check_existing=True)
            except RuntimeError:
                pass
    return None


FONT = _font()


def _flat_mat(name, color, strength, show):
    """Unlit-looking text/line material, faded in and out over `show`."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    pb = m.node_tree.nodes['Principled BSDF']
    pb.inputs['Base Color'].default_value = (0, 0, 0, 1)
    pb.inputs['Roughness'].default_value = 1.0
    pb.inputs['Specular IOR Level'].default_value = 0.0
    pb.inputs['Emission Color'].default_value = (*color, 1)
    pb.inputs['Emission Strength'].default_value = strength
    if show:
        try:
            m.surface_render_method = 'BLENDED'
        except (AttributeError, TypeError):
            m.blend_method = 'BLEND'
        a = pb.inputs['Alpha']
        t_in, t_out = show
        for t, v in [(t_in, 0.0), (t_in + 0.3, 1.0)] + ([(t_out - 0.3, 1.0), (t_out, 0.0)] if t_out else []):
            a.default_value = v
            a.keyframe_insert('default_value', frame=fr(t))
    return m


def face(obj, cam):
    """Keep obj parallel to the image plane of cam (a shot's camera)."""
    con = obj.constraints.new('COPY_ROTATION')
    con.target = cam
    return obj


def label(text, loc, size=0.1, parent=None, cam=None, show=None, color=WHITE, align='CENTER', strength=1.2,
          material=None):
    """Floating text at loc (parent space); show=(t_in, t_out or None) fades it."""
    cu = bpy.data.curves.new('label', 'FONT')
    cu.body = text
    cu.size = size
    cu.align_x = align
    cu.align_y = 'CENTER'
    if FONT:
        cu.font = FONT
    cu.materials.append(material or _flat_mat('label', color, strength, show))
    o = bpy.data.objects.new('label', cu)
    bpy.context.collection.objects.link(o)
    o.parent = parent
    o.location = loc
    if cam:
        face(o, cam)
    return o


def callout(text, anchor, at, size=0.1, parent=None, cam=None, show=None, color=WHITE):
    """Label at `at` with a thin leader line and a dot at `anchor` (parent space)."""
    m = _flat_mat('callout', color, 1.2, show)
    a, b = Vector(anchor), Vector(at)
    gap = Vector((-1 if b.x > a.x else 1, 0, 0)) * size * 0.4
    line = kit.curve('leader', [a, b + gap], bevel=size * 0.03, material=m)
    line.parent = parent
    dot = bpy.data.objects.new('dot', bpy.data.meshes.new('dot'))
    bpy.context.collection.objects.link(dot)
    dot.parent = parent
    dot.location = a
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=size * 0.12)
    bm.to_mesh(dot.data)
    bm.free()
    dot.data.materials.append(m)
    txt = label(text, b, size, parent, cam, show, color, 'LEFT' if b.x > a.x else 'RIGHT', material=m)
    return txt


def glow(obj, keys, color=GLOW):
    """Eased emission keys [(t, strength 0-4), ...] on obj and its children."""
    objs = [o for o in [obj, *obj.children_recursive] if o.type in ('MESH', 'CURVE', 'FONT')]
    done = {}
    for o in objs:
        for slot in o.material_slots:
            m = slot.material
            if m is None:
                continue
            if m.name not in done:
                g = m if m.get('glow') else m.copy()
                g['glow'] = True
                pb = g.node_tree.nodes['Principled BSDF']
                pb.inputs['Emission Color'].default_value = (*color, 1)
                inp = pb.inputs['Emission Strength']
                for t, v in keys:
                    inp.default_value = min(v, 4.0)
                    inp.keyframe_insert('default_value', frame=fr(t))
                done[m.name] = g
            slot.link = 'OBJECT'
            slot.material = done[m.name]


def flash(loc, t, size=0.05, parent=None, color=GLOW):
    """A short gold spark at film time t."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    me = bpy.data.meshes.new('flash')
    bm.to_mesh(me)
    bm.free()
    me.materials.append(kit.mat('flash', color, emission=color, strength=4.0))
    o = bpy.data.objects.new('flash', me)
    bpy.context.collection.objects.link(o)
    o.parent = parent
    o.location = loc
    for tt, sc in ((t - 0.04, 1e-4), (t + 0.05, size), (t + 0.3, 1e-4)):
        o.scale = (sc, sc, sc)
        kit.ease_keys(o, 'scale', [fr(tt)])
    return o


def ticker(values, loc, size=0.12, parent=None, cam=None, color=WHITE, align='CENTER'):
    """Text that changes at film times: values = [(t, 'text'), ...] in order."""
    holder = empty('ticker', parent, loc)
    if cam:
        face(holder, cam)
    m = _flat_mat('ticker', color, 1.2, None)
    for i, (t, text) in enumerate(values):
        o = label(text, (0, 0, 0), size, holder, None, None, color, align, material=m)
        on = round(fr(t))
        off = round(fr(values[i + 1][0])) if i + 1 < len(values) else FRAMES + 10
        for f, hide in ((0, True), (on, False), (off, True)):
            o.hide_render = hide
            o.keyframe_insert('hide_render', frame=f)
    return holder


# ---- Studio: dark background, softboxes seen only in reflections ----
def studio():
    w = bpy.data.worlds.new('studio')
    s.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    n, ln = nt.nodes.new, nt.links.new
    out = n('ShaderNodeOutputWorld')
    path = n('ShaderNodeLightPath')
    mix = n('ShaderNodeMixShader')
    back = n('ShaderNodeBackground')
    back.inputs['Color'].default_value = (*BG, 1)
    env = n('ShaderNodeBackground')
    coord = n('ShaderNodeTexCoord')
    xyz = n('ShaderNodeSeparateXYZ')
    ln(coord.outputs['Generated'], xyz.inputs[0])

    def band(sock, lo, hi):
        m = n('ShaderNodeMapRange')
        m.interpolation_type = 'SMOOTHSTEP'
        ln(sock, m.inputs['Value'])
        m.inputs['From Min'].default_value = lo
        m.inputs['From Max'].default_value = hi
        return m.outputs['Result']

    def tint(fac, color, k):
        v = n('ShaderNodeVectorMath')
        v.operation = 'SCALE'
        v.inputs[0].default_value = tuple(c * k for c in color)
        ln(fac, v.inputs['Scale'])
        return v.outputs['Vector']

    def add(a, b):
        v = n('ShaderNodeVectorMath')
        v.operation = 'ADD'
        ln(a, v.inputs[0])
        if isinstance(b, tuple):
            v.inputs[1].default_value = b
        else:
            ln(b, v.inputs[1])
        return v.outputs['Vector']

    neg_x = n('ShaderNodeMath')
    neg_x.operation = 'MULTIPLY'
    ln(xyz.outputs['X'], neg_x.inputs[0])
    neg_x.inputs[1].default_value = -1.0
    top = tint(band(xyz.outputs['Z'], 0.6, 0.85), (1.0, 0.95, 0.88), 0.9)
    left = tint(band(neg_x.outputs[0], 0.7, 0.92), (1.0, 0.78, 0.55), 0.7)
    rear = tint(band(xyz.outputs['Y'], 0.65, 0.9), (0.6, 0.74, 1.0), 0.5)
    neg_y = n('ShaderNodeMath')
    neg_y.operation = 'MULTIPLY'
    ln(xyz.outputs['Y'], neg_y.inputs[0])
    neg_y.inputs[1].default_value = -1.0
    front = tint(band(neg_y.outputs[0], 0.75, 0.95), (1.0, 0.9, 0.78), 0.25)
    ln(add(add(add(add(top, left), rear), front), (0.004, 0.004, 0.005)), env.inputs['Color'])
    ln(path.outputs['Is Camera Ray'], mix.inputs['Fac'])
    ln(env.outputs[0], mix.inputs[1])
    ln(back.outputs[0], mix.inputs[2])
    ln(mix.outputs[0], out.inputs['Surface'])


def area(name, loc, aim, energy, color, size):
    d = bpy.data.lights.new(name, 'AREA')
    d.energy = energy
    d.color = color
    d.size = size
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o


WARM = (1.0, 0.84, 0.68)
COOL = (0.62, 0.76, 1.0)
EMBER = (1.0, 0.66, 0.36)


def rig(c, aim):
    """Warm key front-left, cool rim back-right, warm kicker back-left, fill."""
    c, aim = Vector(c), Vector(aim)
    area('key', c + Vector((-3.4, -3.8, 2.6)), aim, 450, WARM, 2.5)
    area('rim', c + Vector((3.6, 3.4, 2.0)), aim, 1100, COOL, 1.5)
    area('kicker', c + Vector((-3.8, 3.0, -0.2)), aim, 900, EMBER, 1.2)
    area('fill', c + Vector((2.5, -4.5, -1.4)), aim, 60, (0.85, 0.9, 1.0), 4.0)


studio()

# ---- The watch ----
WATCH_C = Vector((0.0, 0.0, 1.4))
STACK_C = WATCH_C + Vector((0, 0, 3.5 * SPREAD + CASE_GAP / 2))   # middle of the exploded stack
watch = build('watch', empty('watch', None, WATCH_C), 'watch')
animate(watch, 'watch')
subject = watch['root']


def layer_z(name):
    """World z of a layer when the watch is exploded and lying dial-up."""
    i = LAYERS.index(name)
    return WATCH_C.z + LAYER_MID[name] + ((7 - i) * SPREAD + CASE_GAP if name != 'case' else 0.0)


# Pose: hero three-quarter -> shows the back -> dial-up -> back to hero
root = watch['root']
for t, tilt, yaw in ((0.0, 75, 25), (3.5, 75, -115), (5.0, 0, 0), (28.3, 0, 0), (30.2, 75, 25)):
    root.rotation_euler = (math.radians(tilt), 0, math.radians(yaw))
    kit.ease_keys(root, 'rotation_euler', [fr(t)])
bake(root, 'location', lambda t: WATCH_C.z + 0.02 * math.sin(2 * math.pi * t / 3.2), 2)

# Explode: top layer first; reassemble: bottom layer first
for i, name in enumerate(LAYERS[:-1]):
    ly = watch['layers'][name]
    up = (7 - i) * SPREAD + CASE_GAP
    t0, r0 = 4.15 + 0.2 * i, 27.0 + 0.16 * (7 - i)
    for t, z in ((t0, 0.0), (t0 + 1.5, up), (r0, up), (r0 + 1.2, 0.0)):
        ly.location = (0, 0, z)
        kit.ease_keys(ly, 'location', [fr(t)])

rig(WATCH_C, WATCH_C + Vector((0, 0, 1.2)))

# ---- The bench: the same movement, assembled, for the close-ups ----
BENCH_C = Vector((12.0, 0.0, 1.0))
bench = build('bench', empty('bench', None, BENCH_C), 'bench')
animate(bench, 'bench')
rig(BENCH_C + Vector((0, 0, -1.0)), BENCH_C)

_BENCH_LOCAL = {
    'barrel': (B.x, B.y, -0.03), 'centre': (0, 0, 0.05), 'third': (T.x, T.y, 0.03),
    'fourth': (F4.x, F4.y, 0.01), 'escape': (E.x, E.y, -0.034), 'fork': (FORK.x, FORK.y, -0.034),
    'balance': (BAL.x, BAL.y, -0.07), 'crown': (-1.06, 0, 0), 'hands': (0, 0, 0.12), 'movement': (0, 0, 0),
}


def bench_at(part):
    """World point of a bench part, for camera targets and labels."""
    return BENCH_C + Vector(_BENCH_LOCAL[part])


