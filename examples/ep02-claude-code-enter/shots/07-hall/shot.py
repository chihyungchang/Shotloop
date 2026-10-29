# 6 · Machine hall: dolly down the cold aisle.
#
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.
# Runs in the namespace of world/world.py (see engine/shotloop/blender/run_shot.py).
kit.Shot('07-hall', at(0), at(DUR), lens=24, target=H + Vector((6, 0, 1.1)), move='dolly', frm=H + Vector((-10.5, 0, 1.6)), to=H + Vector((-7.5, 0, 1.55)), clip=(0.05, 60))
