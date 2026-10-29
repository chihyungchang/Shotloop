# 04 · Board: the mainboard slides out of the stack to the right and
# turns to face the camera, which moves in close over its chips.
BOARD = EXPLODE['board'] + REST['board'] + Vector((0, 0, BZ))  # board centre in the stack
OUT = Vector((1.15, -0.85, -0.3))
TURN = -24


def parts(t):
    k = seg(t, 0.0, 1.7)
    return dict(explode=1, pull={'board': (OUT * k, (0, 0, TURN * k))})


def view(t):
    # The camera rides along with the board as it comes out
    c = BOARD + OUT * seg(t, 0.0, 1.7)
    e = ease(t / DUR)
    return (orbit(-30 + 8 * e, 3.4 - 1.0 * e, c.z + 0.85 - 0.2 * e, center=c),
            c + Vector((0, 0, 0.27 - 0.03 * e)))


bake(T0, DUR, parts)
camera('04-board', T0, DUR, view, lens=50, f_stop=2.8)
