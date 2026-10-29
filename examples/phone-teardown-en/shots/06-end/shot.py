# 06 · End: the camera module goes home and the stack closes back into
# one phone, which settles into the hero pose under the end card.
CAM_OUT = Vector((0.85, -1.5, -0.75))  # where 05 left the camera module


def parts(t):
    m = 1 - seg(t, 0.0, 1.1)
    return dict(explode=1 - seg(t, 0.4, 2.3), spin=-20 * seg(t, 0.4, 3.8), tilt=-5 * seg(t, 1.0, 3.0),
                pull={'camera': (CAM_OUT * m, (0, 0, 162 * m))})


bake(T0, DUR, parts)
camera('06-end', T0, DUR,
       lambda t: (orbit(-24 + 6 * ease(t / DUR), 8.6 - 3.4 * ease(t / DUR), 1.5 - 1.25 * ease(t / DUR)),
                  (0, 0, 0.42 - 0.06 * ease(t / DUR))),
       lens=45)
