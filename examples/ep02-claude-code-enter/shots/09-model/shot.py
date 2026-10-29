# 8 · Model: truck right with the signal, slightly behind it for depth.
#
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.
# Runs in the namespace of world/world.py (see engine/shotloop/blender/run_shot.py).
track(kit.Shot('09-model', at(0), at(DUR), lens=28, target=model_aim, move='lock', frm=(0, M.y - 9.2, 2.6), clip=(0.1, 80)), model_aim, -2.2)
