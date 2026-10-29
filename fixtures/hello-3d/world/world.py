"""Hello, Shotloop: the smallest 3D project, used to test the engine
without downloaded assets. A floor, a cable and an amber packet that
travels along it over the whole film (film time, in seconds)."""

import kit

DURATION = 2.4
AMBER = (1.0, 0.62, 0.18)

s = kit.reset(DURATION, samples=16)
kit.world_color((0.55, 0.7, 0.9), strength=0.8)
kit.sun(energy=3.0)

kit.box('floor', (12, 6, 0.1), (0, 0, -0.05), kit.mat('floor', (0.35, 0.5, 0.3), roughness=0.9), bevel=0)
kit.box('cable', (10, 0.06, 0.06), (0, 0, 0.03), kit.mat('cable', (0.08, 0.09, 0.1)), bevel=0)
for x in (-4, 0, 4):
    kit.box(f'post-{x}', (0.3, 0.3, 1.2), (x, 1.2, 0.6), kit.mat('post', (0.8, 0.8, 0.82)), bevel=0.01)

# Built at the origin and moved by its location: kit.box bakes the
# location into the mesh in recent Blender versions
packet = kit.box('packet', (0.4, 0.25, 0.25), (0, 0, 0.15), kit.mat('packet', AMBER, emission=AMBER, strength=3))
packet.location.x = -4
packet.keyframe_insert('location', frame=1)
packet.location.x = 4
packet.keyframe_insert('location', frame=round(DURATION * kit.FPS))
