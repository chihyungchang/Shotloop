# 10 · Screen: over her right shoulder, the answer, the tool prompt, y.
#
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.
# Runs in the namespace of world/world.py (see engine/shotloop/blender/run_shot.py).
kit.Shot('11-screen', at(0), at(DUR), lens=50, target=SCREEN + Vector((0, 0, -0.05)), move='dolly', frm=(KEYS.x + 1.55, KEYS.y - 1.45, 1.55), to=(KEYS.x + 1.4, KEYS.y - 1.15, 1.5), clip=(0.05, 40))
