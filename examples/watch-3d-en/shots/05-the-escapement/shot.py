# 05-the-escapement: macro on the escape wheel and pallet fork, a spark per tick.
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.
import math
from mathutils import Vector

# Centre of escape wheel + fork (bench world space)
S = bench_at('escape') * 0.6 + bench_at('fork') * 0.4


def cam_pose(az, dist, elev, lift):
    """Camera point at azimuth az (deg, from S) and the aim that puts S low in frame."""
    h = Vector((math.cos(math.radians(az)), math.sin(math.radians(az)), 0))
    e = math.radians(elev)
    pos = S + h * (dist * math.cos(e)) + Vector((0, 0, dist * math.sin(e)))
    up = -h * math.sin(e) + Vector((0, 0, math.cos(e)))
    return pos, S + up * lift


# Slow push-in with a slight orbit (from -60 to -45 degrees)
p0, a0 = cam_pose(-60, 2.1, 50, 0.12)
p1, a1 = cam_pose(-48, 1.8, 50, 0.10)
aim = empty('05.aim', None, a0)
for t, a in ((0.0, a0), (DUR, a1)):
    aim.location = a
    kit.ease_keys(aim, 'location', [fr(at(t))])

shot = kit.Shot('05-the-escapement', at(0), at(DUR), lens=50, target=aim,
                move='dolly', frm=p0, to=p1, clip=(0.05, 80))

# Floating label above the wheel and fork, facing the camera
up1 = (a1 - S).normalized()
label('escapement', (S - bench['root'].location) + up1 * 0.165 + Vector((0, 0, 0.02)), size=0.05,
      parent=bench['root'], cam=shot.cam, show=(at(0.4), None))

# A spark at the pallet stone that locks the next tooth, on every tick
for t in beats(at(0.1), at(DUR - 0.2)):
    k = round(t / BEAT - 0.5)
    q = PALLET_A if k % 2 == 0 else PALLET_B
    d = (q - E).normalized()
    tip = q - FORK - d * (PALLET_LEN / 2)
    flash((tip.x, tip.y, -0.024), t, size=0.03, parent=bench['fork'])
