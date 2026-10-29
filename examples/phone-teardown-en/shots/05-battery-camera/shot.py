# 05 · Battery, then camera: the board goes home and the battery slides
# out to the left; then the battery goes back and the camera module comes
# forward to the right, turning round to show its lenses. The camera
# swings across between the two.
BAT = EXPLODE['battery'] + REST['battery'] + Vector((0, 0, AZ))
BAT_OUT = Vector((-1.15, -0.85, -0.05))
CAM = EXPLODE['camera'] + REST['camera'] + PIVOT['camera']
CAM_OUT = Vector((0.85, -1.5, -0.75))
BOARD_OUT, BOARD_TURN = Vector((1.15, -0.85, -0.3)), -24  # where 04 left the board


def parts(t):
    b = 1 - seg(t, 0.0, 0.9)
    k = seg(t, 0.0, 1.5) - seg(t, 2.4, 3.3)
    m = seg(t, 2.4, 3.9)
    return dict(explode=1, pull={'board': (BOARD_OUT * b, (0, 0, BOARD_TURN * b)),
                                 'battery': (BAT_OUT * k, (0, 0, 22 * k)),
                                 'camera': (CAM_OUT * m, (0, 0, 162 * m))})


bake(T0, DUR, parts)


def view(t):
    # Follow the battery as it comes out, then swing over to the module
    a = BAT + BAT_OUT * seg(t, 0.0, 1.5)
    b = CAM + CAM_OUT
    k = seg(t, 2.3, 3.8)
    c = lerp(a, b, k)
    ang = lerp(28, -18, k)
    dist = lerp(3.8, 2.3, k)
    return orbit(ang, dist, c.z + lerp(0.8, 0.5, k), center=c), c + Vector((0, 0, lerp(0.48, 0.22, k)))


camera('05-battery-camera', T0, DUR, view, lens=50, f_stop=2.8)
