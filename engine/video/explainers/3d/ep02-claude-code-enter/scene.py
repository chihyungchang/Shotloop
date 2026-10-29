"""02 · What happens when you press Enter in Claude Code? (Blender cut)

Step 4a of the 3D track: builds the world in real metres from scene.md
and declares the shots. Run through engine/video/blender.mjs.

Layout (Blender: Z up, metres). The outbound route runs +X, so seen
from −Y it moves left → right on screen (README, Camera).
  room ................ around the origin
  street, provider .... y 100, x −10 → 65
  coast, sea, seabed .. x 65 → 187, seabed at z −12
  far shore, DC ....... x 187 → 240
  machine hall ........ y −300
  chip bench .......... y −400
  model ............... y −500
"""

import glob
import math
import os
import random
import sys

import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'lib'))
import kit  # noqa: E402

ASSETS = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'assets'))
KENNEY = os.path.join(ASSETS, 'kenney')
OUT = os.path.join(HERE, 'out')
FURNITURE = 1.9  # Kenney furniture units → metres (desk 0.38 → 0.72 m tall)
CITY = 10.0      # Kenney city kits → metres

AMBER = (1.0, 0.62, 0.18)
BAR = 2.4
DURATION = 20 * BAR
F = kit.FPS


def fr(t):
    """Seconds → frame."""
    return round(t * F) + 1


def kenney(name, location=(0, 0, 0), rot=0.0, scale=FURNITURE):
    path = glob.glob(os.path.join(KENNEY, '**', 'GLB format', name + '.glb'), recursive=True) \
        or glob.glob(os.path.join(KENNEY, '**', name + '.glb'), recursive=True)
    return kit.import_model(path[0], location=location, rotation=(0, 0, math.radians(rot)), scale=scale)


def bounds(objs):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    return lo, hi


def deformed_bounds(objs):
    """World bounds of meshes after armature deformation (bound_box is the
    undeformed mesh, which is wrong for posed characters)."""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in objs:
        if o.type != 'MESH' or o.hide_render:
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        pts += [ev.matrix_world @ v.co for v in me.vertices]
        ev.to_mesh_clear()
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    return lo, hi


def constant(id_data, path):
    """Step (no tween) interpolation on id_data's keys for one data path."""
    for fc in kit.fcurves(id_data.animation_data.action):
        if fc.data_path == path:
            for k in fc.keyframe_points:
                k.interpolation = 'CONSTANT'


def visible(obj, windows):
    """Render obj only during [(start, end), …] seconds."""
    obj.hide_render = True
    obj.keyframe_insert('hide_render', frame=1)
    for a, b in windows:
        obj.hide_render = False
        obj.keyframe_insert('hide_render', frame=fr(a))
        obj.hide_render = True
        obj.keyframe_insert('hide_render', frame=fr(b))
    constant(obj, 'hide_render')


def text(body, location, size, material):
    """Upright text facing −Y (towards the cameras)."""
    data = bpy.data.curves.new(body, 'FONT')
    data.body = body
    data.size = size
    data.extrude = 0.01
    data.align_x = 'CENTER'
    data.align_y = 'CENTER'
    data.materials.append(material)
    obj = bpy.data.objects.new(body, data)
    obj.location = location
    obj.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.collection.objects.link(obj)
    return obj


def pulse(name, length, radius, strength=4.0):
    """A light pulse travelling in a cable: a short glowing capsule along Y."""
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=length, vertices=12, location=(0, 0, 0))
    o = bpy.context.object
    o.name = name
    o.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    o.data.materials.append(kit.mat(name, AMBER, emission=AMBER, strength=strength))
    return o


def ride(obj, path, t0, t1, u0=0.0, u1=1.0, linear=False):
    """obj travels along the curve `path` from u0 to u1 between t0 and t1 s."""
    c = obj.constraints.new('FOLLOW_PATH')
    c.target = path
    c.use_fixed_location = True
    c.use_curve_follow = True
    c.forward_axis = 'FORWARD_Y'
    c.offset_factor = u0
    c.keyframe_insert('offset_factor', frame=fr(t0))
    c.offset_factor = u1
    c.keyframe_insert('offset_factor', frame=fr(t1))
    if linear:  # constant speed, so a tracking camera can keep pace
        for fc in kit.fcurves(obj.animation_data.action):
            if 'offset_factor' in fc.data_path:
                for k in fc.keyframe_points:
                    k.interpolation = 'LINEAR'
    return c


def track(shot, subject, offset_x):
    """Turn a locked shot into a truck that keeps pace with `subject`
    along X (one move, parallel to the cable), offset_x metres from it."""
    cam = shot.cam
    c = cam.constraints.new('COPY_LOCATION')
    c.target = subject
    c.use_y = c.use_z = False
    c.use_offset = True
    cam.location.x = offset_x
    cam.constraints.move(len(cam.constraints) - 1, 0)


def lamp(name, path, t0, t1, u0, u1, windows, energy, linear=False):
    """An amber point light riding with a pulse, so the cable lights up
    around it (README, Scale: show far travellers with light)."""
    lt = kit.point((0, 0, 0), energy=energy, color=AMBER, radius=0.1)
    lt.name = name
    ride(lt, path, t0, t1, u0, u1, linear)
    visible(lt, windows)
    return lt


s = kit.reset(DURATION, samples=32)
world = kit.world_hdri(os.path.join(ASSETS, 'hdri', 'kloofendal_48d_partly_cloudy_puresky_2k.hdr'), strength=0.6)
sun = kit.sun(direction=(0.45, -0.55, -0.6), energy=3.0)
random.seed(2)
cable_mat = kit.mat('cable', (0.08, 0.09, 0.1), roughness=0.5)
sign_bg = kit.mat('sign-bg', (0.11, 0.16, 0.27), roughness=0.6)
sign_ink = kit.mat('sign-ink', (1, 1, 1), emission=(1, 1, 1), strength=1.5)

# ================================================================ ROOM
# Floor 3 × 2 tiles (5.7 × 3.8 m), back wall at y = 3.8, right wall at x = 5.7.
T = FURNITURE
floor_objs = []
for i in range(3):
    for j in range(2):
        floor_objs += kenney('floorFull', (i * T, j * T, 0))[1]
FLOOR = bounds(floor_objs)[1].z  # the tiles' top surface, above z 0
for i in range(3):
    kenney('wallWindow' if i == 1 else 'wall', (i * T, 2 * T, 0))
for j in range(2):
    kenney('wall', (3 * T, j * T, 0), rot=90)

desk, desk_objs = kenney('desk', (2.2, 2 * T - 0.78, 0))
lo, hi = bounds(desk_objs)
top = hi.z
screen_root, screen_objs = kenney('computerScreen', ((lo.x + hi.x) / 2 - 0.37, hi.y - 0.35, top))
kb, kb_objs = kenney('computerKeyboard', ((lo.x + hi.x) / 2 - 0.27, lo.y + 0.12, top))
kenney('computerMouse', ((lo.x + hi.x) / 2 + 0.38, lo.y + 0.18, top))
kenney('lampRoundTable', (hi.x - 0.35, hi.y - 0.35, top))
# Bookcase and plant stand left of the desk: the right side is kept clear
# so the cable to the router stays in view (shot 2)
kenney('pottedPlant', (0.45, 3.2, 0))
kenney('bookcaseOpenLow', (0.9, 2 * T - 0.5, 0))
kenney('rugRectangle', (1.5, 0.8, 0.002))
kblo, kbhi = bounds(kb_objs)
KEYS = Vector(((kblo.x + kbhi.x) / 2, (kblo.y + kbhi.y) / 2, top))
chair, chair_objs = kenney('chairDesk', (0, 0, 0), rot=180)
clo, chi = bounds(chair_objs)
chair.location += Vector((KEYS.x - (clo.x + chi.x) / 2, lo.y - 0.32 - (clo.y + chi.y) / 2, 0))

# The monitor's picture: screen.html rendered by blender.mjs to
# out/screen/NNNNN.png (frame-numbered), on a plane 1 cm proud of the panel
slo, shi = bounds(screen_objs)
SCREEN = Vector(((slo.x + shi.x) / 2, slo.y, slo.z + (shi.z - slo.z) * 0.6))
shots = sorted(glob.glob(os.path.join(OUT, 'screen', '*.png')))
if shots:
    img = bpy.data.images.load(shots[0])
    img.source = 'SEQUENCE'
    m = bpy.data.materials.new('screen')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    tex.image_user.frame_start = 1
    tex.image_user.frame_offset = 0
    tex.image_user.frame_duration = s.frame_end
    tex.image_user.use_auto_refresh = True
    emit = nt.nodes.new('ShaderNodeEmission')
    emit.inputs['Strength'].default_value = 1.2
    nt.links.new(tex.outputs['Color'], emit.inputs['Color'])
    nt.links.new(emit.outputs['Emission'], nt.nodes['Material Output'].inputs['Surface'])
    bpy.ops.mesh.primitive_plane_add(size=1, location=SCREEN - Vector((0, 0.01, 0)))
    pic = bpy.context.object
    pic.name = 'screen-picture'
    pic.rotation_euler = (math.radians(90), 0, 0)
    pic.scale = ((shi.x - slo.x) * 0.86, (shi.x - slo.x) * 0.86 * 0.625, 1)
    pic.data.materials.append(m)

# The person: a Kenney mini character, sitting, scaled to a real seated height
person, person_objs = kenney('character-female-b', (0, 0, 0), rot=180, scale=1.0)
body = [o for o in person_objs if o.type == 'MESH' and o.name.split('.')[0] in ('body-mesh', 'head-mesh')]
for o in person_objs:
    if o.type == 'MESH' and o.name.split('.')[0] == 'Icosphere':
        o.hide_render = True
rig = [o for o in person_objs if o.type == 'ARMATURE'][0]
rig.animation_data_create()
rig.animation_data.action = bpy.data.actions['sit']
s.frame_set(1)
# Seated head height of a real adult ≈ 1.25 m: scale the posed figure to it
plo, phi = deformed_bounds(body)
k = 1.25 / (phi.z - plo.z)
person.scale = (k, k, k)
clo, chi = bounds(chair_objs)
person.location = (KEYS.x, (clo.y + chi.y) / 2 + 0.05, 0.0)
plo, phi = deformed_bounds(body)
# The posed figure's lowest point (feet) to the floor, then up onto the seat
SEAT_LIFT = 0.30
person.location.z += 0.0 - plo.z + SEAT_LIFT

# Typing: bake the sit pose into a new action, then swing both arms
# forward over the keyboard about the figure's own left-right axis (in
# armature space, so both arms move the same way whatever their local
# bone axes), with a small alternating tap and the two Enter presses.
base = {pb.name: pb.matrix.copy() for pb in rig.pose.bones}
rig.animation_data.action = bpy.data.actions.new('typing')
for pb in rig.pose.bones:
    pb.rotation_mode = 'QUATERNION'
REACH = math.radians(-52)  # forward is −Y in the figure's own space
TYPE_WINDOWS = [(0.0, 1.95), (35.9, 36.5)]
PRESSES = [1.95, 36.6]


def swing(name, angle):
    pb = rig.pose.bones[name]
    head = base[name].to_translation()
    pb.matrix = Matrix.Translation(head) @ Matrix.Rotation(angle, 4, 'X') @ Matrix.Translation(-head) @ base[name]


for f in range(1, s.frame_end + 1, 2):
    t = (f - 1) / F
    typing_now = any(a <= t <= b for a, b in TYPE_WINDOWS)
    for pb in rig.pose.bones:
        pb.matrix = base[pb.name]
    for name, phase in (('arm-left', 0.0), ('arm-right', 1.7)):
        tap = math.sin(t * 22 + phase) * math.radians(4) if typing_now else 0
        press = sum(max(0, 1 - abs(t - p) / 0.12) for p in PRESSES) * math.radians(-8) if name == 'arm-right' else 0
        swing(name, REACH + tap + press)
        bpy.context.view_layer.update()
    for pb in rig.pose.bones:
        pb.keyframe_insert('rotation_quaternion', frame=f)
        pb.keyframe_insert('location', frame=f)

kit.point((hi.x - 0.2, hi.y - 0.2, top + 0.45), energy=40, color=(1, 0.8, 0.55))

# Router on the floor by the right wall; the cable runs from the monitor,
# down the desk leg, through the router and into the wall socket.
ROUTER = Vector((5.1, 2 * T - 0.45, FLOOR))
kit.box('router', (0.26, 0.17, 0.05), ROUTER + Vector((0, 0, 0.026)), kit.mat('router', (0.92, 0.93, 0.95), roughness=0.4), bevel=0.006)
for dx in (-0.1, 0.1):
    kit.box('antenna', (0.012, 0.012, 0.16), ROUTER + Vector((dx, 0.07, 0.132)), kit.mat('antenna', (0.12, 0.13, 0.16)), bevel=0.002)
leds = [kit.box('router-led', (0.012, 0.004, 0.006), ROUTER + Vector((-0.06 + i * 0.04, -0.088, 0.03)),
                kit.mat('router-led', (0.3, 1, 0.55), emission=(0.3, 1, 0.55), strength=3), bevel=0) for i in range(4)]
WALL_X = 3 * T - 0.06
desk_cable = kit.curve('desk-cable', [
    SCREEN + Vector((0.0, 0.14, -0.12)),
    Vector((hi.x - 0.06, SCREEN.y + 0.14, top + 0.01)),
    Vector((hi.x + 0.03, SCREEN.y + 0.14, top - 0.15)),
    Vector((hi.x + 0.04, SCREEN.y + 0.14, FLOOR + 0.12)),
    Vector((hi.x + 0.3, ROUTER.y, FLOOR + 0.008)),
    ROUTER + Vector((-0.13, 0, 0.02)),
    ROUTER + Vector((0.13, 0, 0.02)),
    Vector((WALL_X - 0.12, ROUTER.y, FLOOR + 0.03)),
    Vector((WALL_X, ROUTER.y, FLOOR + 0.12)),
], bevel=0.006, material=cable_mat, smooth=True)
kit.box('wall-socket', (0.03, 0.08, 0.08), (WALL_X, ROUTER.y, FLOOR + 0.12), kit.mat('socket', (0.9, 0.9, 0.88)), bevel=0.004)

# The request leaves the computer: one 4 cm amber packet runs the desk cable
packet = kit.box('packet', (0.04, 0.04, 0.04), (0, 0, 0), kit.mat('packet', AMBER, emission=AMBER, strength=4), bevel=0.004)
ride(packet, desk_cable, 2.8, 6.8)
visible(packet, [(2.6, 7.2)])
lamp('packet-glow', desk_cable, 2.8, 6.8, 0, 1, [(2.6, 7.2)], 4)
for i, led in enumerate(leds):
    blink = [(5.3 + n * 0.16, 5.38 + n * 0.16) for n in range(i % 2, 10, 2)]
    visible(led, [(0, 5.3)] + blink + [(7.0, DURATION)])

# ================================================================ STREET (y 100)
Y = 100.0
grass = kit.mat('grass', (0.32, 0.55, 0.26), roughness=0.9)
sand = kit.mat('sand', (0.72, 0.62, 0.44), roughness=0.95)
asphalt = kit.mat('asphalt', (0.16, 0.17, 0.18), roughness=0.85)
kit.box('ground', (75, 80, 0.2), (27.5, Y, -0.1), grass, bevel=0)          # x −10 → 65, top 0
kit.box('road', (75, 6, 0.04), (27.5, Y - 8, 0.01), asphalt, bevel=0)      # top 0.03
for x in range(-8, 64, 6):
    kit.box('road-line', (2.5, 0.15, 0.01), (x, Y - 8, 0.035), kit.mat('paint', (0.95, 0.95, 0.9)), bevel=0)
kit.box('beach', (9, 80, 0.2), (69.5, Y, -0.05), sand, bevel=0)            # x 65 → 74, top 0.05
house, house_objs = kenney('building-type-a', (-4, Y + 4, 0), scale=CITY * 0.8)
hlo, hhi = bounds(house_objs)
poles = []
for x in (8, 20, 32, 44):
    _, p_objs = kenney('electricity-pole', (x, Y - 3.5, 0), rot=90, scale=CITY)
    poles.append(bounds(p_objs))
_, prov_objs = kenney('building-c', (56, Y + 6, 0), scale=CITY)
plo2, phi2 = bounds(prov_objs)
sign_z = min(phi2.z - 1.4, 9.0)
kit.box('sign-panel', (min(phi2.x - plo2.x - 1.0, 9.0), 0.15, 1.4), ((plo2.x + phi2.x) / 2, plo2.y - 0.1, sign_z), sign_bg, bevel=0.02)
text('INTERNET PROVIDER', ((plo2.x + phi2.x) / 2, plo2.y - 0.2, sign_z), 0.8, sign_ink)
pole_tops = [Vector(((a.x + b.x) / 2, (a.y + b.y) / 2, b.z - 0.4)) for a, b in poles]
street_pts = [Vector((hhi.x, (hlo.y + hhi.y) / 2, min(hhi.z * 0.6, 5.0)))] + pole_tops + \
    [Vector((plo2.x + 0.1, (plo2.y + phi2.y) / 2, min(phi2.z * 0.5, 6.0)))]
street_cable = kit.curve('street-cable', street_pts, bevel=0.03, material=cable_mat)
street_pulse = pulse('street-pulse', 1.2, 0.08)
ride(street_pulse, street_cable, 7.6, 11.6)
visible(street_pulse, [(7.4, 12.0)])
lamp('street-glow', street_cable, 7.6, 11.6, 0, 1, [(7.4, 12.0)], 150)

# ================================================================ SEA (x 65 → 187)
SEABED = -12.0
water = kit.mat('water', (0.08, 0.36, 0.55), roughness=0.08)
water.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = 0.5
kit.box('sea', (122, 80, 0.2), (126, Y, -0.1), water, bevel=0)             # top 0, under both beaches
bpy.ops.mesh.primitive_plane_add(size=1, location=(126, Y, SEABED))
seabed = bpy.context.object
seabed.name = 'seabed'
seabed.scale = (126, 80, 1)
bpy.ops.object.transform_apply(scale=True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.subdivide(number_cuts=80)
bpy.ops.object.mode_set(mode='OBJECT')
dunes = bpy.data.textures.new('dunes', 'CLOUDS')
dunes.noise_scale = 6
d = seabed.modifiers.new('dunes', 'DISPLACE')
d.texture = dunes
d.strength = 0.6
bpy.ops.object.shade_smooth()
seabed.data.materials.append(sand)
# The water as a volume, so the camera underwater looks through blue water
bpy.ops.mesh.primitive_cube_add(size=1, location=(126, Y, (SEABED - 0.4) / 2))
vol = bpy.context.object
vol.name = 'sea-volume'
vol.scale = (122, 80, -SEABED - 0.4)
vm = bpy.data.materials.new('sea-volume')
vm.use_nodes = True
vm.node_tree.nodes.remove(vm.node_tree.nodes['Principled BSDF'])
pv = vm.node_tree.nodes.new('ShaderNodeVolumePrincipled')
pv.inputs['Color'].default_value = (0.1, 0.45, 0.62, 1)
pv.inputs['Density'].default_value = 0.07
vm.node_tree.links.new(pv.outputs['Volume'], vm.node_tree.nodes['Material Output'].inputs['Volume'])
vol.data.materials.append(vm)
for i in range(16):
    x = random.uniform(84, 172)
    yy = Y + random.choice([-1, 1]) * random.uniform(4, 22)
    kenney(random.choice(['rocks-sand-a', 'rocks-sand-b', 'rocks-a', 'rocks-c']), (x, yy, SEABED - 0.2), rot=random.uniform(0, 360), scale=3.0)
kenney('ship-wreck', (128, Y + 16, SEABED - 0.3), rot=30, scale=4.0)
sea_pts = [street_pts[-1],
           Vector((63, (plo2.y + phi2.y) / 2 - 3, 0.25)), Vector((70, Y, 0.0)), Vector((76, Y, -4.0)),
           Vector((84, Y, SEABED + 0.4)), Vector((126, Y, SEABED + 0.4)), Vector((170, Y, SEABED + 0.4)),
           Vector((178, Y, -4.0)), Vector((184, Y, 0.0)), Vector((190, Y, 0.25)), Vector((197, Y, 1.0))]
sea_cable = kit.curve('sea-cable', sea_pts, bevel=0.08, material=kit.mat('sea-cable', (0.1, 0.1, 0.11), roughness=0.4), smooth=True)
sea_pulse = pulse('sea-pulse', 1.2, 0.13)
ride(sea_pulse, sea_cable, 12.0, 20.0, linear=True)
visible(sea_pulse, [(12.0, 19.4)])
lamp('sea-glow', sea_cable, 12.0, 20.0, 0, 1, [(12.0, 19.4)], 250, linear=True)

# ================================================================ FAR SHORE, DATA CENTRE
kit.box('far-beach', (9, 80, 0.2), (182.5, Y, -0.05), sand, bevel=0)       # x 178 → 187, top 0.05
kit.box('far-ground', (53, 80, 0.2), (213.5, Y, -0.1), grass, bevel=0)     # x 187 → 240, top 0
DC = Vector((212, Y + 6, 0))
kit.box('dc', (34, 22, 10), DC + Vector((0, 0, 5)), kit.mat('dc-wall', (0.82, 0.85, 0.88), roughness=0.5), bevel=0.08)
for i in range(16):
    kit.box('dc-fin', (0.25, 0.4, 9), DC + Vector((-15.75 + i * 2.1, -11.25, 5)), kit.mat('dc-fin', (0.6, 0.64, 0.68)), bevel=0.02)
for i in range(6):
    for j in range(2):
        c = DC + Vector((-13 + i * 5.2, -5 + j * 8, 0))
        kit.box('chiller', (4, 3, 1.6), c + Vector((0, 0, 10.82)), kit.mat('chiller', (0.72, 0.75, 0.78)), bevel=0.05)
        bpy.ops.mesh.primitive_cylinder_add(radius=1.1, depth=0.1, location=c + Vector((0, 0, 11.64)))
        bpy.context.object.data.materials.append(kit.mat('fan', (0.15, 0.16, 0.18)))
kit.box('dc-sign', (12, 0.15, 1.8), DC + Vector((0, -11.6, 7.6)), sign_bg, bevel=0.02)
text('DATA CENTER', DC + Vector((0, -11.7, 7.6)), 1.2, sign_ink)

# ================================================================ MACHINE HALL (y −300)
# A cold aisle between two rows of racks (fronts facing in), cable trays
# and lights above; see scene.md for the reference.
H = Vector((0, -300, 0))
kit.box('hall-floor', (30, 30, 0.2), H + Vector((0, 0, -0.1)), kit.mat('raised-floor', (0.55, 0.58, 0.62), roughness=0.4), bevel=0)
kit.box('hall-ceiling', (30, 30, 0.2), H + Vector((0, 0, 3.7)), kit.mat('ceiling', (0.2, 0.22, 0.25)), bevel=0)
hall_wall = kit.mat('hall-wall', (0.3, 0.32, 0.36))
for sy in (-1, 1):
    kit.box('hall-wall', (30, 0.2, 3.6), H + Vector((0, sy * 6, 1.8)), hall_wall, bevel=0)
kit.box('hall-end', (0.2, 11.8, 3.6), H + Vector((9, 0, 1.8)), hall_wall, bevel=0)
rack_body = kit.mat('rack', (0.09, 0.1, 0.12), roughness=0.45, metallic=0.3)
server = kit.mat('server', (0.22, 0.24, 0.28), roughness=0.4, metallic=0.4)
led_g = kit.mat('rack-led', (0.25, 1, 0.5), emission=(0.25, 1, 0.5), strength=3)
led_b = kit.mat('rack-led-b', (0.3, 0.6, 1), emission=(0.3, 0.6, 1), strength=3)
for row, face in ((-1.2, 1), (1.2, -1)):
    for i in range(14):
        c = H + Vector((-8 + i * 0.62, row, 1.01))
        kit.box('rack', (0.6, 1.0, 2.0), c, rack_body, bevel=0.01)
        for u in range(10):
            z = -0.85 + u * 0.18
            kit.box('server', (0.54, 0.02, 0.15), c + Vector((0, face * 0.512, z)), server, bevel=0.003)
            kit.box('led', (0.02, 0.01, 0.012), c + Vector((-0.2 + (u % 3) * 0.06, face * 0.528, z)),
                    led_g if (i + u) % 4 else led_b, bevel=0)
for i in range(5):
    x = -7 + i * 2.8
    kit.box('hall-lamp', (0.2, 3.0, 0.04), H + Vector((x, 0, 3.57)), kit.mat('hall-lamp', (1, 1, 1), emission=(0.9, 0.95, 1), strength=3), bevel=0)
    for row in (-1.2, 1.2):
        kit.box('tray', (2.4, 0.3, 0.06), H + Vector((x, row, 2.6)), kit.mat('tray', (0.85, 0.7, 0.1), metallic=0.6, roughness=0.4), bevel=0.01)
area = bpy.data.lights.new('hall-area', 'AREA')
area.energy = 800
area.size = 8
ao = bpy.data.objects.new('hall-area', area)
ao.location = H + Vector((-2, 0, 3.4))
bpy.context.collection.objects.link(ao)

# ================================================================ CHIP (y −400)
# An accelerator board: package, die, HBM stacks beside it, VRMs.
C = Vector((0, -400, 0))
kit.box('bench', (1.2, 0.8, 0.9), C + Vector((0, 0, 0.45)), kit.mat('bench', (0.25, 0.27, 0.3)), bevel=0.01)
Z0 = 0.9
kit.box('pcb', (0.30, 0.13, 0.006), C + Vector((0, 0, Z0 + 0.0035)), kit.mat('pcb', (0.05, 0.28, 0.17), roughness=0.5), bevel=0.001)
kit.box('package', (0.075, 0.075, 0.004), C + Vector((0, 0, Z0 + 0.0085)), kit.mat('package', (0.12, 0.13, 0.12), roughness=0.4), bevel=0.0008)
die = kit.box('die', (0.033, 0.026, 0.0015), C + Vector((0, 0, Z0 + 0.0112)),
              kit.mat('die', (0.25, 0.2, 0.15), metallic=0.8, roughness=0.25, emission=AMBER, strength=0.0), bevel=0.0003)
for dx in (-0.025, 0.025):
    for dy in (-0.022, 0.0, 0.022):
        kit.box('hbm', (0.011, 0.016, 0.003), C + Vector((dx, dy, Z0 + 0.012)), kit.mat('hbm', (0.55, 0.57, 0.6), metallic=0.9, roughness=0.3), bevel=0.0003)
for i in range(28):
    kit.box('vrm', (0.006, 0.006, 0.004), C + Vector((-0.12 + (i % 14) * 0.018, -0.052 + (i // 14) * 0.104, Z0 + 0.0085)),
            kit.mat('vrm', (0.2, 0.2, 0.22)), bevel=0.0005)
glow = die.data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Emission Strength']
for t, v in ((24.6, 0.0), (25.4, 2.5)):
    glow.default_value = v
    glow.keyframe_insert('default_value', frame=fr(t))
kit.point(C + Vector((0.3, -0.3, Z0 + 0.4)), energy=30, color=(0.85, 0.9, 1))
kit.point(C + Vector((-0.4, 0.2, Z0 + 0.3)), energy=10, color=(0.7, 0.8, 1))

# ================================================================ MODEL (y −500)
# The network the way it is usually visualised: one column of neurons per
# layer on a translucent panel, every neuron wired to every neuron of the
# next layer, a grid floor. Simplified (scene.md): columns stand for
# token inputs, the embedding, three transformer blocks and the
# next-token output; the wiring is drawn dense, as in an MLP.
#
# Motion: the signal crosses one gap at a time, left to right. The
# strongest connections of that gap light up amber and grow from the left
# column to the right one; the neurons they reach light up; last the
# output's winner flares. The camera trucks along with the signal.
M = Vector((0, -500, 0))
kit.box('model-floor', (60, 30, 0.2), M + Vector((6, 0, -0.15)), kit.mat('model-floor', (0.02, 0.03, 0.06)), bevel=0)
bpy.ops.mesh.primitive_grid_add(x_subdivisions=60, y_subdivisions=30, size=1, location=M + Vector((6, 0, 0.0)))
grid = bpy.context.object
grid.name = 'model-grid'
grid.scale = (60, 30, 1)
bpy.ops.object.transform_apply(scale=True)
wf = grid.modifiers.new('lines', 'WIREFRAME')
wf.thickness = 0.02
grid.data.materials.append(kit.mat('grid', (0.5, 0.65, 1), emission=(0.5, 0.65, 1), strength=0.5))

COLS = [('tokens', 5), ('embedding', 18), ('block 1', 27), ('block 2', 27), ('block 3', 27), ('next token', 5)]
DX = 2.6                 # column spacing
ZC = 2.1                 # column centre height (captions own the top)
T_WAVE = 26.9            # the signal leaves the tokens
STEP = 0.6               # one gap every STEP s
GROW = 0.35              # lines grow over GROW s
TOKENS = ['explain', 'how', 'auth', 'works', 'here']
NEXT = ['Requests', 'Auth', 'The', 'It', 'Each']
node_mat = kit.mat('neuron', (0.92, 0.95, 1), emission=(0.92, 0.95, 1), strength=0.6)
lit_mat = kit.mat('neuron-lit', AMBER, emission=AMBER, strength=4)
panel_mat = kit.mat('panel', (0.12, 0.3, 0.65), roughness=0.3, emission=(0.12, 0.3, 0.65), strength=0.25)
panel_mat.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = 0.35
wire_mat = kit.mat('wire', (0.85, 0.9, 1), emission=(0.85, 0.9, 1), strength=0.12)
light_ink = kit.mat('light-ink', (0.9, 0.92, 0.95), emission=(0.9, 0.92, 0.95), strength=0.6)


def column(k, n):
    x = M.x + k * DX
    h = 0.12 if n > 5 else 0.45
    return [Vector((x, M.y, ZC + (n - 1) / 2 * h - r * h)) for r in range(n)]


def wires(name, pairs, bevel, material):
    """All connections of one gap as one curve object, one spline each."""
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.bevel_depth = bevel
    data.bevel_resolution = 0
    data.bevel_factor_mapping_end = 'SPLINE'
    for p0, p1 in pairs:
        sp = data.splines.new('POLY')
        sp.points.add(1)
        sp.points[0].co = (*p0, 1)
        sp.points[1].co = (*p1, 1)
    data.materials.append(material)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return obj


cols = [column(k, n) for k, (_, n) in enumerate(COLS)]
for k, ((title, n), pts) in enumerate(zip(COLS, cols)):
    top, bottom = pts[0].z, pts[-1].z
    kit.box('panel', (1.5, 0.02, top - bottom + 0.9), (pts[0].x, M.y + 0.3, (top + bottom) / 2), panel_mat, bevel=0)
    text(title, (pts[0].x, M.y - 0.02, top + 0.62), 0.2, light_ink)
    text(f'neurons: {n}', (pts[0].x, M.y - 0.02, top + 0.36), 0.12, light_ink)
    for pt in pts:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.06, segments=16, ring_count=8, location=pt)
        bpy.context.object.data.materials.append(node_mat)
    for r, pt in enumerate(pts):
        if k == 0:
            text(TOKENS[r], pt + Vector((-0.5, -0.02, 0)), 0.14, light_ink)
        if k == len(COLS) - 1:
            text(NEXT[r], pt + Vector((0.6, -0.02, 0)), 0.14, light_ink)

rng = random.Random(5)
for g in range(len(COLS) - 1):
    a0, a1 = cols[g], cols[g + 1]
    wires(f'wires-{g}', [(p, q) for p in a0 for q in a1], 0.0025, wire_mat)
    t0 = T_WAVE + g * STEP
    strong = [(p, q) for p in a0 for q in a1 if rng.random() < 0.22]
    if g == len(COLS) - 2:  # into the output: everything feeds the winner
        strong = [(p, a1[0]) for p in a0] + [(p, q) for p, q in strong if q is not a1[0]][:12]
    gm = kit.mat(f'signal-{g}', AMBER, emission=AMBER, strength=3)
    sig = wires(f'signal-{g}', strong, 0.008, gm)
    sig.data.bevel_factor_end = 0.0
    sig.data.keyframe_insert('bevel_factor_end', frame=fr(t0))
    sig.data.bevel_factor_end = 1.0
    sig.data.keyframe_insert('bevel_factor_end', frame=fr(t0 + GROW))
    st = gm.node_tree.nodes['Principled BSDF'].inputs['Emission Strength']
    for t, v in ((t0 + GROW, 3.0), (t0 + GROW + 0.8, 0.7)):
        st.default_value = v
        st.keyframe_insert('default_value', frame=fr(t))
    reached = {id(q): q for _, q in strong}.values()
    for q in reached:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.075, segments=16, ring_count=8, location=q)
        o = bpy.context.object
        o.data.materials.append(lit_mat)
        visible(o, [(t0 + GROW, DURATION)])
# the tokens themselves are lit from the start of the shot
for q in cols[0]:
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.075, segments=16, ring_count=8, location=q)
    bpy.context.object.data.materials.append(lit_mat)
# the winner flares
T_OUT = T_WAVE + (len(COLS) - 2) * STEP + GROW
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.16, segments=24, ring_count=12, location=cols[-1][0])
win = bpy.context.object
win_mat = kit.mat('winner', AMBER, emission=AMBER, strength=4)
win.data.materials.append(win_mat)
visible(win, [(T_OUT, DURATION)])
win.scale = (0.3, 0.3, 0.3)
kit.ease_keys(win, 'scale', [fr(T_OUT)])
win.scale = (1, 1, 1)
kit.ease_keys(win, 'scale', [fr(T_OUT + 0.3)])
kit.point(cols[-1][0] + Vector((0, -0.4, 0)), energy=0, color=AMBER).name = 'winner-light'
wl = bpy.data.objects['winner-light'].data
for t, v in ((T_OUT, 0), (T_OUT + 0.3, 60)):
    wl.energy = v
    wl.keyframe_insert('energy', frame=fr(t))
kit.point(M + Vector((6, -6, 7)), energy=800, color=(0.7, 0.8, 1), radius=3)

# The camera's aim travels with the signal (for the truck in shot 9)
model_aim = bpy.data.objects.new('model-aim', None)
bpy.context.collection.objects.link(model_aim)
model_aim.location = (M.x + 0.6 * DX, M.y, 3.4)
kit.ease_keys(model_aim, 'location', [fr(26.6)])
model_aim.location = (M.x + (len(COLS) - 1.4) * DX, M.y, 3.4)
kit.ease_keys(model_aim, 'location', [fr(30.6)])

# ================================================================ THE WAY BACK
for i in range(5):
    bp = pulse(f'back-{i}', 1.2, 0.13)
    ride(bp, sea_cable, 30.4 + i * 0.3, 35.4 + i * 0.3, 0.85, 0.15, linear=True)
    visible(bp, [(31.0, 33.8)])
    if i == 0:
        back_lead = bp
lamp('back-glow', sea_cable, 31.0, 36.0, 0.85, 0.15, [(31.0, 33.8)], 300, linear=True)

# ================================================================ OVERVIEW LOOP
# The whole route as a diorama at dusk, cut away at the front so the sea
# and the seabed cable show in section. The route glows faintly; a bright
# trail of light runs out along it and back, faster each lap (request,
# reply, tool result, again and again).
earth = kit.mat('earth', (0.33, 0.24, 0.16), roughness=0.95)
kit.box('earth-near', (75, 80, 13.8), (27.5, Y, -7.11), earth, bevel=0)
kit.box('earth-far', (53, 80, 13.8), (213.5, Y, -7.11), earth, bevel=0)
kit.box('earth-sea', (122, 80, 1.6), (126, Y, -13.21), earth, bevel=0)
route = kit.curve('route', street_pts + sea_pts[1:], bevel=0.12, smooth=True,
                  material=kit.mat('route', AMBER, emission=AMBER, strength=0.8))
visible(route, [(16 * BAR, DURATION)])
trail = kit.curve('trail', street_pts + sea_pts[1:], bevel=0.35, smooth=True,
                  material=kit.mat('trail', AMBER, emission=AMBER, strength=4))
trail.data.bevel_factor_mapping_start = trail.data.bevel_factor_mapping_end = 'SPLINE'
visible(trail, [(16 * BAR, DURATION)])
LEN = 0.14
laps, t, lap = [], 16 * BAR + 0.2, 2.6
while t < DURATION:
    laps.append((t, lap))
    t += lap
    lap = max(0.8, lap * 0.78)


def head(t):
    """Trail head position (0 home → 1 data centre) and direction."""
    for n, (t0, d) in enumerate(laps):
        if t0 <= t < t0 + d:
            k = (t - t0) / d
            k = k * k * (3 - 2 * k)  # ease each trip
            return (k, 1) if n % 2 == 0 else (1 - k, -1)
    return 0.0, 1


spot = kit.point((0, 0, 0), energy=20000, color=AMBER, radius=2)
sc_ = spot.constraints.new('FOLLOW_PATH')
sc_.target = trail
sc_.use_fixed_location = True
spot.location.z = 3  # a little above the cable
visible(spot, [(16 * BAR, DURATION)])
for f in range(fr(16 * BAR), s.frame_end + 1):
    u, dirn = head((f - 1) / F)
    sc_.offset_factor = u
    sc_.keyframe_insert('offset_factor', frame=f)
    lo_, hi_ = (u - LEN, u) if dirn > 0 else (u, u + LEN)
    trail.data.bevel_factor_start = min(max(lo_, 0.0), 1.0)
    trail.data.bevel_factor_end = min(max(hi_, 0.0), 1.0)
    trail.data.keyframe_insert('bevel_factor_start', frame=f)
    trail.data.keyframe_insert('bevel_factor_end', frame=f)

# ================================================================ LIGHT PER PLACE
# Daylight for home, street, sea and shore; the interiors are lit only by
# their own lamps.
bg_strength = world.inputs['Strength']
for t, on in ((0, True), (21.6, False), (31.2, True), (16 * BAR, 'dusk')):
    bg_strength.default_value = 0.25 if on == 'dusk' else 0.6 if on else 0.02
    bg_strength.keyframe_insert('default_value', frame=fr(t))
    sun.data.energy = 0.5 if on == 'dusk' else 3.0 if on else 0.0
    sun.data.keyframe_insert('energy', frame=fr(t))
constant(world.id_data, 'nodes["Background"].inputs[1].default_value')
# Underwater shots: the sky gives way to deep blue (keyed mix)
wnt = world.id_data
deep = wnt.nodes.new('ShaderNodeBackground')
deep.inputs['Color'].default_value = (0.02, 0.13, 0.22, 1)
deep.inputs['Strength'].default_value = 1.0
mix = wnt.nodes.new('ShaderNodeMixShader')
wout = [n for n in wnt.nodes if n.type == 'OUTPUT_WORLD'][0]
wnt.links.new(world.outputs['Background'], mix.inputs[1])
wnt.links.new(deep.outputs['Background'], mix.inputs[2])
wnt.links.new(mix.outputs['Shader'], wout.inputs['Surface'])
UNDER = [(14.4, 19.2), (31.2, 33.6)]
for t, v in [(0, 0)] + [x for a, b in UNDER for x in ((a, 1), (b, 0))]:
    mix.inputs['Fac'].default_value = v
    mix.inputs['Fac'].keyframe_insert('default_value', frame=fr(t))
    if v:
        sun.data.energy = 1.6
        sun.data.keyframe_insert('energy', frame=fr(t))
    else:
        sun.data.energy = 3.0
        sun.data.keyframe_insert('energy', frame=fr(t))
sun.data.energy = 0.5
sun.data.keyframe_insert('energy', frame=fr(16 * BAR))
for fc in kit.fcurves(wnt.animation_data.action):
    for k in fc.keyframe_points:
        k.interpolation = 'CONSTANT'
constant(sun.data, 'energy')

# ================================================================ SHOTS (scene.md)
# 1 · Room: three-quarter from behind-left; her hands, the keys and the
# screen in one frame. Slow dolly in.
kit.Shot('01-room', 0, BAR, lens=35, target=(KEYS.x - 0.1, KEYS.y + 0.15, 0.95),
         move='dolly', frm=(KEYS.x - 2.5, KEYS.y - 2.2, 1.7), to=(KEYS.x - 2.15, KEYS.y - 1.9, 1.64), clip=(0.05, 40))
# 2 · The cable: from in front of the desk's right end, pedestal down with
# the packet from desktop to floor.
kit.Shot('02-cable', BAR, 3 * BAR, lens=35, target=packet,
         move='pedestal', frm=(4.35, 2.3, 1.0), to=(4.35, 2.3, 0.3), clip=(0.05, 40))
# 3 · Street: truck right with the pulse along the poles to the provider.
kit.Shot('03-street', 3 * BAR, 5 * BAR, lens=28, target=street_pulse,
         move='truck', frm=(6, Y - 34, 6), to=(46, Y - 34, 6), clip=(0.5, 400))
# 4a · Coast: crane down from the beach through the surface.
kit.Shot('04-coast', 5 * BAR, 5 * BAR + 2.4, lens=24, target=(74, Y, -1.5),
         move='crane', frm=(58, Y - 22, 14), to=(60, Y - 20, 5), clip=(0.3, 400))
# 4b · Seabed: truck right with the pulse along the cable.
track(kit.Shot('05-seabed', 5 * BAR + 2.4, 8 * BAR, lens=24, target=sea_pulse,
               move='lock', frm=(0, Y - 7, SEABED + 1.4), clip=(0.2, 200)), sea_pulse, -5)
# 5 · Far shore: dolly in on the data centre.
kit.Shot('06-shore', 8 * BAR, 9 * BAR, lens=35, target=DC + Vector((0, 0, 5)),
         move='dolly', frm=(186, Y - 62, 10), to=(192, Y - 50, 8.5), clip=(0.5, 500))
# 6 · Machine hall: dolly down the cold aisle.
kit.Shot('07-hall', 9 * BAR, 10 * BAR, lens=24, target=H + Vector((6, 0, 1.1)),
         move='dolly', frm=H + Vector((-10.5, 0, 1.6)), to=H + Vector((-7.5, 0, 1.55)), clip=(0.05, 60))
# 7 · Chip: macro orbit, shallow focus on the die.
kit.Shot('08-chip', 10 * BAR, 11 * BAR, lens=85, target=C + Vector((0, 0, Z0 + 0.012)),
         move='orbit', frm=(200,), to=(230,), radius=0.65, height=Z0 + 0.3, f_stop=4, clip=(0.05, 20))
# 8 · Model: truck right with the signal, slightly behind it for depth.
track(kit.Shot('09-model', 11 * BAR, 13 * BAR, lens=28, target=model_aim,
               move='lock', frm=(0, M.y - 9.2, 2.6), clip=(0.1, 80)), model_aim, -2.2)
# 9 · Way back: truck left with the tokens on the seabed cable.
track(kit.Shot('10-back', 13 * BAR, 14 * BAR, lens=24, target=back_lead,
               move='lock', frm=(0, Y - 7, SEABED + 1.4), clip=(0.2, 200)), back_lead, 6)
# 10 · Screen: over her right shoulder, the answer, the tool prompt, y.
kit.Shot('11-screen', 14 * BAR, 16 * BAR, lens=50, target=SCREEN + Vector((0, 0, -0.05)),
         move='dolly', frm=(KEYS.x + 1.55, KEYS.y - 1.45, 1.55), to=(KEYS.x + 1.4, KEYS.y - 1.15, 1.5), clip=(0.05, 40))

# 12 · Overview: from behind the home end, looking down the route, so
# the trail races away into the frame and back; a slow orbit.
kit.Shot('12-overview', 16 * BAR, DURATION, lens=28, target=(110, Y, -2),
         move='orbit', frm=(-98,), to=(-84,), radius=150, height=95, clip=(2, 800))

a = kit.args()
kit.render(a['out'], frames=a['frames'], stills=a['stills'], is_draft=a['draft'])
