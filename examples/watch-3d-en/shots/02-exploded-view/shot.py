# 02-exploded-view: the watch flies apart along +Z; each layer gets a label.
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.

# Aim point rises with the stack, so the camera tilts down a little more
aim = empty('02.aim', None, (0.8, 0, 3.0))
for t, z in ((0.0, 3.0), (DUR, 4.4)):
    aim.location = (0.8, 0, z)
    kit.ease_keys(aim, 'location', [fr(at(t))])

shot = kit.Shot('02-exploded-view', at(0), at(DUR), lens=28, target=aim,
                move='dolly', frm=(0.8, -9.2, 3.4), to=(0.8, -8.9, 6.1), clip=(0.1, 80))

# Leader anchors on each layer (layer space), labels in one column on the right
ANCHOR = {'crystal': (0.80, 0, 0.18), 'hands': (0.0, 0, 0.12), 'dial': (0.86, 0, 0.09),
          'train': (0.66, 0.05, 0.035), 'barrel': (-0.14, 0, -0.03), 'escapement': (0.53, -0.2, -0.034),
          'balance': (0.256, -0.537, -0.083), 'mainplate': (0.84, 0, -0.115), 'case': (1.0, 0, 0.0)}
for i, name in enumerate(LAYERS):
    a = ANCHOR[name]
    # Labels appear once the watch lies dial-up, top layer first
    callout(LABELS[name], a, (1.2, 0, a[2]), size=0.18, parent=watch['layers'][name],
            cam=shot.cam, show=(5.0 + 0.2 * i, 8.4))
