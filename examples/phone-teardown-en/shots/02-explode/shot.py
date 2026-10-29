# 02 · Explode: the layers separate into a rising diagonal stack while
# the camera pulls back and rises a little.
bake(T0, DUR, lambda t: dict(spin=-18 + 18 * ease(t / DUR), tilt=-5 + 5 * ease(t / DUR),
                             explode=seg(t, 0.35, 3.9)))
camera('02-explode', T0, DUR,
       lambda t: (orbit(-8 - 16 * ease(t / DUR), 5.0 + 3.8 * ease(t / DUR), 0.3 + 1.2 * ease(t / DUR)),
                  (0, 0, 0.22 + 0.2 * ease(t / DUR))),
       lens=45)
