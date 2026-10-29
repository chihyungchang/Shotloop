"""Renders one shot of a Shotloop 3D project in Blender.

Run by engine/shotloop/render3d.mjs:

  blender -b --python-exit-code 1 -P run_shot.py -- \
    --world world/world.py --shot shots/01-room/shot.py \
    --start 0 --duration 2.4 --fps 30 --size 1080x1920 \
    --out <frames dir> --shot-frames 1,2,3 [--draft] [--samples N]

The world script builds what every shot shares (sets, assets, lights,
anything animated on the film's timeline). The shot script then runs in
the world's namespace with three extra names:

  T0      the shot's start on the film timeline, in seconds
  DUR     the shot's duration, in seconds
  at(t)   shot-local seconds → film seconds (T0 + t)

and creates exactly one camera (kit.Shot). Frames are numbered from 1
at the shot's first frame.
"""

import os
import runpy
import sys

import bpy


def parse():
    argv = sys.argv[sys.argv.index('--') + 1:]
    a = {'draft': '--draft' in argv}
    for i, k in enumerate(argv):
        if k.startswith('--') and i + 1 < len(argv) and not argv[i + 1].startswith('--'):
            a[k[2:]] = argv[i + 1]
    return a


a = parse()
world_path = os.path.abspath(a['world'])
shot_path = os.path.abspath(a['shot'])
T0 = float(a['start'])
DUR = float(a['duration'])
FPS = int(a['fps'])
width, height = (int(x) for x in a['size'].split('x'))
frames = [int(f) for f in a['shot-frames'].split(',')]

# The world imports kit (engine/video/explainers/3d/lib) and may import
# helpers that live next to it
sys.path.insert(0, a['kit'])
sys.path.insert(0, os.path.dirname(world_path))
import kit  # noqa: E402

kit.FPS = FPS

# Keep the world's own render entry point (kit.args / kit.render at the
# bottom of a legacy scene) from rendering the whole film
kit.render = lambda *args, **kwargs: None

ns = runpy.run_path(world_path, run_name='__shotloop_world__')

before = {o.name for o in bpy.data.objects if o.type == 'CAMERA'}
g = dict(ns)
g.update({'T0': T0, 'DUR': DUR, 'at': lambda t: T0 + t, '__file__': shot_path, '__name__': '__shotloop_shot__'})
with open(shot_path, encoding='utf-8') as f:
    exec(compile(f.read(), shot_path, 'exec'), g)
cams = [o for o in bpy.data.objects if o.type == 'CAMERA' and o.name not in before]
if len(cams) != 1:
    raise SystemExit(f'shot.py must create exactly one camera, created {len(cams)}')

s = bpy.context.scene
s.camera = cams[0]
# Markers bind cameras to film time; this render has one camera only
for m in list(s.timeline_markers):
    if m.camera is not None:
        s.timeline_markers.remove(m)
s.render.resolution_x, s.render.resolution_y = width, height
s.render.resolution_percentage = 100
s.render.fps = FPS
if a['draft']:
    kit.draft()
elif 'samples' in a:
    # The project's final quality, whatever the world script asked for
    s.eevee.taa_render_samples = int(a['samples'])
s.render.image_settings.file_format = 'PNG'

first = round(T0 * FPS)  # the film frame before the shot's first frame
s.frame_end = max(s.frame_end, first + max(frames))
out = a['out']
os.makedirs(out, exist_ok=True)
for f in frames:
    s.frame_set(first + f)
    s.render.filepath = os.path.join(out, f'{f:05d}.png')
    bpy.ops.render.render(write_still=True)
    print(f'SHOTLOOP_FRAME {f}', flush=True)
