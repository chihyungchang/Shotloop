# 07-end-card: the layers fall back into the watch, which turns to the hero pose.
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.

# Start wide on the exploded stack, end on a hero framing like shot 1's,
# pulled back so the whole watch sits between the caption and the bottom 20%.
END_AIM = WATCH_C + Vector((0, 0, 0.55))
aim = empty('07.aim', None, (0.4, 0, 4.1))
for t, xyz in ((0.0, (0.4, 0, 4.1)), (DUR, tuple(END_AIM))):
    aim.location = xyz
    kit.ease_keys(aim, 'location', [fr(at(t))])

kit.Shot('07-end-card', at(0), at(DUR), lens=35, target=aim,
         move='dolly', frm=(0.8, -16.0, 5.0), to=(1.5, -9.3, 2.0), clip=(0.1, 80))
