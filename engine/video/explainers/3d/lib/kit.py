"""Blender helpers for the 3D explainer track (see ../README.md).

An episode's scene.py imports this, builds its world in real metres,
and declares its shots with the camera helpers below, which enforce the
camera rules: one move per shot, eased, a fixed lens per shot.

Run by engine/video/blender.mjs as
  blender -b -P scene.py -- --out <dir> [--frames a-b] [--stills f1,f2]
"""

import math
import random
import sys

import bpy
from mathutils import Vector

FPS = 30


# ---------------------------------------------------------------- scene

def args():
    """Arguments after `--` on Blender's command line."""
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = {'out': '/tmp/frames', 'frames': None, 'stills': None, 'draft': '--draft' in argv}
    for i, a in enumerate(argv):
        if a == '--out':
            out['out'] = argv[i + 1]
        elif a == '--frames':
            lo, hi = argv[i + 1].split('-')
            out['frames'] = (int(lo), int(hi))
        elif a == '--stills':
            out['stills'] = [int(f) for f in argv[i + 1].split(',')]
    return out


def reset(duration, size=(1080, 1920), seed=7, samples=48):
    """Empty scene with the track's render settings."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    random.seed(seed)
    s = bpy.context.scene
    s.render.engine = 'BLENDER_EEVEE'
    s.render.resolution_x, s.render.resolution_y = size
    s.render.resolution_percentage = 100
    s.render.fps = FPS
    s.frame_start = 1
    s.frame_end = round(duration * FPS)
    s.view_settings.view_transform = 'AgX'
    try:
        s.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass
    e = s.eevee
    e.taa_render_samples = samples
    e.use_raytracing = True
    e.use_fast_gi = True
    e.use_shadows = True
    s.render.use_motion_blur = True
    s.render.motion_blur_shutter = 0.5
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_mode = 'RGB'
    bloom(s)
    return s


def bloom(s, threshold=1.0, strength=0.35):
    """Compositor: render layers → bloom glare → output. Threshold ≥ 1 so
    only real emitters glow (README, Look)."""
    ng = bpy.data.node_groups.new('Composite', 'CompositorNodeTree')
    ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    rl = ng.nodes.new('CompositorNodeRLayers')
    glare = ng.nodes.new('CompositorNodeGlare')
    out = ng.nodes.new('NodeGroupOutput')
    for name, value in (('Type', 'Bloom'), ('Threshold', threshold), ('Strength', strength), ('Size', 0.6)):
        sock = glare.inputs.get(name)
        if sock is not None:
            try:
                sock.default_value = value
            except (TypeError, AttributeError):
                pass
    if hasattr(glare, 'glare_type'):
        glare.glare_type = 'BLOOM'
    ng.links.new(rl.outputs['Image'], glare.inputs['Image'])
    ng.links.new(glare.outputs['Image'], out.inputs[0])
    s.compositing_node_group = ng
    return glare


def world_hdri(path, strength=1.0, rotation=0.0):
    """Sky and fill light from an HDRI (Poly Haven)."""
    w = bpy.data.worlds.new('World')
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    coord = nt.nodes.new('ShaderNodeTexCoord')
    mapping = nt.nodes.new('ShaderNodeMapping')
    mapping.inputs['Rotation'].default_value[2] = rotation
    env = nt.nodes.new('ShaderNodeTexEnvironment')
    env.image = bpy.data.images.load(path, check_existing=True)
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = strength
    out = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(coord.outputs['Generated'], mapping.inputs['Vector'])
    nt.links.new(mapping.outputs['Vector'], env.inputs['Vector'])
    nt.links.new(env.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    bpy.context.scene.world = w
    return bg


def world_color(rgb, strength=1.0):
    w = bpy.data.worlds.new('World')
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs[0].default_value = (*rgb, 1)
    bg.inputs[1].default_value = strength
    bpy.context.scene.world = w
    return bg


def sun(direction=(0.4, -0.5, -0.75), energy=3.0, color=(1, 0.96, 0.9), angle=2.0):
    data = bpy.data.lights.new('Sun', 'SUN')
    data.energy = energy
    data.color = color
    data.angle = math.radians(angle)
    obj = bpy.data.objects.new('Sun', data)
    bpy.context.collection.objects.link(obj)
    obj.rotation_euler = Vector(direction).to_track_quat('-Z', 'Y').to_euler()
    return obj


def point(location, energy=200, color=(1, 1, 1), radius=0.2):
    data = bpy.data.lights.new('Point', 'POINT')
    data.energy = energy
    data.color = color
    data.shadow_soft_size = radius
    obj = bpy.data.objects.new('Point', data)
    obj.location = location
    bpy.context.collection.objects.link(obj)
    return obj


# ---------------------------------------------------------------- materials and props

_mats = {}


def mat(name, color, roughness=0.6, metallic=0.0, emission=None, strength=0.0):
    """A Principled material. Emission strength is capped (README, Look)."""
    key = (name, tuple(color), roughness, metallic, tuple(emission or ()), strength)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = metallic
    if emission:
        p.inputs['Emission Color'].default_value = (*emission, 1)
        p.inputs['Emission Strength'].default_value = min(strength, 4.0)
    _mats[key] = m
    return m


def box(name, size, location, material, bevel=0.004, parent=None):
    """A bevelled box: size and location in metres (location = centre)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = 'ANGLE'
    o.data.materials.append(material)
    if parent:
        o.parent = parent
    return o


def import_model(path, location=(0, 0, 0), rotation=(0, 0, 0), scale=1.0):
    """Import a glTF/GLB or FBX; returns an empty parenting everything."""
    before = set(bpy.data.objects)
    if path.lower().endswith(('.glb', '.gltf')):
        bpy.ops.import_scene.gltf(filepath=path)
    elif path.lower().endswith('.fbx'):
        bpy.ops.import_scene.fbx(filepath=path)
    elif path.lower().endswith('.obj'):
        bpy.ops.wm.obj_import(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new(path.rsplit('/', 1)[-1], None)
    bpy.context.collection.objects.link(root)
    for o in new:
        if o.parent is None:
            o.parent = root
    root.location = location
    root.rotation_euler = rotation
    root.scale = (scale, scale, scale)
    return root, new


# ---------------------------------------------------------------- motion

def ease_keys(obj, path, frames):
    """Bezier-eased keys on a data path (auto-clamped handles ease in/out)."""
    for f in frames:
        obj.keyframe_insert(data_path=path, frame=f)
    ad = obj.animation_data
    if ad and ad.action:
        for fc in fcurves(ad.action):
            if fc.data_path == path:
                for k in fc.keyframe_points:
                    k.interpolation = 'BEZIER'
                    k.handle_left_type = k.handle_right_type = 'AUTO_CLAMPED'


def fcurves(action):
    """F-curves of an action (layered actions in Blender 4.4+/5.x)."""
    if hasattr(action, 'fcurves') and action.fcurves:
        return list(action.fcurves)
    out = []
    for layer in getattr(action, 'layers', []):
        for strip in layer.strips:
            for bag in getattr(strip, 'channelbags', []):
                out.extend(bag.fcurves)
    return out


def follow(obj, curve, start, end, frm=0.0, to=1.0):
    """Move obj along a curve object between two frames, eased."""
    c = obj.constraints.new('FOLLOW_PATH')
    c.target = curve
    c.use_fixed_location = True
    c.forward_axis = 'FORWARD_Y'
    c.use_curve_follow = False
    c.offset_factor = frm
    c.keyframe_insert('offset_factor', frame=start)
    c.offset_factor = to
    c.keyframe_insert('offset_factor', frame=end)
    return c


def curve(name, points, bevel=0.0, material=None, smooth=False):
    """A cable through points (Bezier); bevel > 0 gives it thickness.
    smooth=True makes a NURBS that only approaches the inner points but
    never leaves their convex hull: use it where a Bezier would overshoot
    (a cable dipping below the seabed after a steep slope)."""
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.use_path = True  # off by default for data-API curves; Follow Path needs it
    if smooth:
        sp = data.splines.new('NURBS')
        sp.points.add(len(points) - 1)
        for pt, p in zip(sp.points, points):
            pt.co = (*p, 1)
        sp.use_endpoint_u = True
        sp.order_u = 3
        sp.resolution_u = 24
    else:
        sp = data.splines.new('BEZIER')
        sp.bezier_points.add(len(points) - 1)
        for bp, p in zip(sp.bezier_points, points):
            bp.co = p
            bp.handle_left_type = bp.handle_right_type = 'AUTO'
    data.bevel_depth = bevel
    data.bevel_resolution = 4
    data.use_fill_caps = True
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    if material:
        data.materials.append(material)
    return obj


# ---------------------------------------------------------------- cameras

class Shot:
    """One shot: a camera with a fixed lens and exactly one move.

    move is one of 'lock', 'dolly', 'truck', 'pedestal', 'crane',
    'orbit'. 'frm'/'to' are camera positions (for orbit: angles in
    degrees around `target`, at `radius` and `height`). The camera aims
    at `target` (a point, or an object to track) for the whole shot, so
    position is the only thing that moves.
    """

    def __init__(self, name, start, end, lens=35, target=(0, 0, 0), move='lock',
                 frm=(0, -5, 1.6), to=None, radius=None, height=None,
                 f_stop=None, focus=None, clip=(0.05, 100), hold=0.4):
        s = bpy.context.scene
        cam_data = bpy.data.cameras.new(name)
        cam_data.lens = lens
        cam_data.clip_start, cam_data.clip_end = clip
        cam_data.sensor_fit = 'VERTICAL'
        cam = bpy.data.objects.new(name, cam_data)
        bpy.context.collection.objects.link(cam)
        self.cam = cam

        if isinstance(target, bpy.types.Object):
            aim = target
        else:
            aim = bpy.data.objects.new(name + '.aim', None)
            aim.location = target
            bpy.context.collection.objects.link(aim)
        track = cam.constraints.new('TRACK_TO')
        track.target = aim
        track.track_axis = 'TRACK_NEGATIVE_Z'
        track.up_axis = 'UP_Y'

        if f_stop:
            cam_data.dof.use_dof = True
            cam_data.dof.aperture_fstop = f_stop
            cam_data.dof.focus_object = focus if isinstance(focus, bpy.types.Object) else aim

        a = round(start * FPS) + 1
        b = round(end * FPS)
        h = round(hold * FPS)
        if move == 'lock':
            cam.location = frm
        elif move == 'orbit':
            c = Vector(target if not isinstance(target, bpy.types.Object) else target.location)
            pivot = bpy.data.objects.new(name + '.pivot', None)
            pivot.location = (c.x, c.y, height if height is not None else c.z)
            bpy.context.collection.objects.link(pivot)
            cam.parent = pivot
            cam.location = (0, -radius, 0)
            pivot.rotation_euler = (0, 0, math.radians(frm[0] if isinstance(frm, tuple) else frm))
            ease_keys(pivot, 'rotation_euler', [a + h])
            pivot.rotation_euler = (0, 0, math.radians(to[0] if isinstance(to, tuple) else to))
            ease_keys(pivot, 'rotation_euler', [b - h])
        else:
            cam.location = frm
            ease_keys(cam, 'location', [a + h])
            cam.location = to
            ease_keys(cam, 'location', [b - h])

        marker = s.timeline_markers.new(name, frame=a)
        marker.camera = cam


# ---------------------------------------------------------------- render

def draft():
    """Preview quality: half resolution, few samples, no motion blur or
    ray tracing. About 0.3 s a frame against 1.7 s, for checking framing
    and motion; the final render uses the full settings."""
    s = bpy.context.scene
    s.render.resolution_percentage = 50
    s.eevee.taa_render_samples = 8
    s.eevee.use_raytracing = False
    s.render.use_motion_blur = False


def render(out_dir, frames=None, stills=None, is_draft=False):
    s = bpy.context.scene
    if is_draft:
        draft()
    todo = stills or list(range(*(frames or (s.frame_start, s.frame_end)))) + ([frames[1]] if frames else [s.frame_end])
    for f in todo:
        s.frame_set(f)
        s.render.filepath = f'{out_dir}/{f:05d}.png'
        bpy.ops.render.render(write_still=True)
        print(f'FRAME {f}', flush=True)
