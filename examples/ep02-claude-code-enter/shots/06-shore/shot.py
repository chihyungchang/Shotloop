# 5 · Far shore: dolly in on the data centre.
#
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.
# Runs in the namespace of world/world.py (see engine/shotloop/blender/run_shot.py).
kit.Shot('06-shore', at(0), at(DUR), lens=35, target=DC + Vector((0, 0, 5)), move='dolly', frm=(186, Y - 62, 10), to=(192, Y - 50, 8.5), clip=(0.5, 500))
