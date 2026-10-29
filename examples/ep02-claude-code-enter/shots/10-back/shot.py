# 9 · Way back: truck left with the tokens on the seabed cable.
#
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.
# Runs in the namespace of world/world.py (see engine/shotloop/blender/run_shot.py).
track(kit.Shot('10-back', at(0), at(DUR), lens=24, target=back_lead, move='lock', frm=(0, Y - 7, SEABED + 1.4), clip=(0.2, 200)), back_lead, 6)
