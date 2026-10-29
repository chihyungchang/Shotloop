# 3 · Street: truck right with the pulse along the poles to the provider.
#
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.
# Runs in the namespace of world/world.py (see engine/shotloop/blender/run_shot.py).
kit.Shot('03-street', at(0), at(DUR), lens=28, target=street_pulse, move='truck', frm=(6, Y - 34, 6), to=(46, Y - 34, 6), clip=(0.5, 400))
