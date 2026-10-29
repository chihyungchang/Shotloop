# 4b · Seabed: truck right with the pulse along the cable.
#
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.
# Runs in the namespace of world/world.py (see engine/shotloop/blender/run_shot.py).
track(kit.Shot('05-seabed', at(0), at(DUR), lens=24, target=sea_pulse, move='lock', frm=(0, Y - 7, SEABED + 1.4), clip=(0.2, 200)), sea_pulse, -5)
