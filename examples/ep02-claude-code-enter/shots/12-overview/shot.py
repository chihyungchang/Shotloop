# 12 · Overview: from behind the home end, looking down the route, so
# the trail races away into the frame and back; a slow orbit.
#
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.
# Runs in the namespace of world/world.py (see engine/shotloop/blender/run_shot.py).
kit.Shot('12-overview', at(0), at(DUR), lens=28, target=(110, Y, -2), move='orbit', frm=(-98,), to=(-84,), radius=150, height=95, clip=(2, 800))
