# 1 · Room: three-quarter from behind-left; her hands, the keys and the
# screen in one frame. Slow dolly in.
#
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.
# Runs in the namespace of world/world.py (see engine/shotloop/blender/run_shot.py).
kit.Shot('01-room', at(0), at(DUR), lens=35, target=(KEYS.x - 0.1, KEYS.y + 0.15, 0.95), move='dolly', frm=(KEYS.x - 2.5, KEYS.y - 2.2, 1.7), to=(KEYS.x - 2.15, KEYS.y - 1.9, 1.64), clip=(0.05, 40))
