# 4a · Coast: crane down from the beach through the surface.
#
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.
# Runs in the namespace of world/world.py (see engine/shotloop/blender/run_shot.py).
kit.Shot('04-coast', at(0), at(DUR), lens=24, target=(74, Y, -1.5), move='crane', frm=(58, Y - 22, 14), to=(60, Y - 20, 5), clip=(0.3, 400))
