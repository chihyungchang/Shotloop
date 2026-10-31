# 01-no-battery: No battery?. Slow push-in with a ~20° orbit around the floating watch.
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.
# Aim above the watch so it sits in the lower 60%, under the caption.
AIM = WATCH_C + Vector((0, 0, 0.85))
kit.Shot('01-no-battery', at(0), at(DUR), lens=35, target=tuple(AIM),
         move='dolly', frm=(-1.5, -8.4, 2.3), to=(1.2, -7.1, 2.0), clip=(0.1, 80))
