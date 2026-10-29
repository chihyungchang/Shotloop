# 7 · Chip: macro orbit, shallow focus on the die.
#
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.
# Runs in the namespace of world/world.py (see engine/shotloop/blender/run_shot.py).
kit.Shot('08-chip', at(0), at(DUR), lens=85, target=C + Vector((0, 0, Z0 + 0.012)), move='orbit', frm=(200,), to=(230,), radius=0.65, height=Z0 + 0.3, f_stop=4, clip=(0.05, 20))
