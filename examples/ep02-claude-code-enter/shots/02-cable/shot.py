# 2 · The cable: from in front of the desk's right end, pedestal down with
# the packet from desktop to floor.
#
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.
# Runs in the namespace of world/world.py (see engine/shotloop/blender/run_shot.py).
kit.Shot('02-cable', at(0), at(DUR), lens=35, target=packet, move='pedestal', frm=(4.35, 2.3, 1.0), to=(4.35, 2.3, 0.3), clip=(0.05, 40))
