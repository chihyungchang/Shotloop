# 03 · Screen: the cover glass slides away and the display comes forward,
# turning towards the camera; it goes dark and its pixels light up again
# row by row, bottom to top.
DISPLAY = EXPLODE['display'] + REST['display']  # display centre in the stack
OUT = Vector((0.05, -0.4, 0.1))  # where it comes forward to


def parts(t):
    k = seg(t, 0.1, 1.8)
    off = seg(t, 0.55, 0.95)  # top-down off, then bottom-up on
    on = seg(t, 1.15, 2.7)
    return dict(explode=1, reveal=1.2 - 1.32 * off + 1.32 * on,
                pull={'glass': (-1.0 * k, -0.1 * k, 0.0), 'display': (OUT * k, (0, 0, 12 * k))})


bake(T0, DUR, parts)
c = DISPLAY + OUT
camera('03-screen', T0, DUR,
       lambda t: (orbit(30 - 8 * ease(t / DUR), 5.6 - 0.5 * ease(t / DUR), c.z + 0.5, center=c),
                  c + Vector((0, 0, 0.38))),
       lens=50, f_stop=2.8)
