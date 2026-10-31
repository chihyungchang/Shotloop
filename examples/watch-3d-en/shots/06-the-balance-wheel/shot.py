# 06-the-balance-wheel: close on the swinging balance and hairspring; the camera
# orbits ~30° around it while a floating counter rolls to 8 a second, then
# ≈691,200 a day.
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.

_bal = bench_at('balance')
_R, _H = 1.85, 2.65                    # orbit radius and height above the balance
_A0, _A1 = -104, -76                   # camera azimuth, start and end


def _frame(deg):
    """Camera, aim and counter points for a camera at azimuth deg."""
    out = ang(deg)                                   # balance -> camera, horizontal
    right = Vector((-out.y, out.x, 0))               # screen right
    fwd = Vector((-out.x, -out.y, 0))                # away from the camera
    cam = _bal + Vector((out.x * _R, out.y * _R, _H))
    # Aim right of and beyond the balance: it sits low-left, the counter right
    aim = _bal + right * 0.3 + fwd * 0.55
    # Counter floats well above the chapter ring, inside the safe right edge
    counter = _bal + right * 0.42 + fwd * 0.2 + Vector((0, 0, 0.38))
    return cam, aim, counter


_c0, _a0, _k0 = _frame(_A0)
_c1, _a1, _k1 = _frame(_A1)

_aim = empty('06.aim', None, _a0)
holder = empty('06.counter', None, _k0)
for t, a, k in ((at(0), _a0, _k0), (at(DUR), _a1, _k1)):
    _aim.location = a
    holder.location = k
    kit.ease_keys(_aim, 'location', [fr(t)])
    kit.ease_keys(holder, 'location', [fr(t)])

shot = kit.Shot('06-the-balance-wheel', at(0), at(DUR), lens=40, target=_aim,
                move='dolly', frm=_c0, to=_c1, clip=(0.1, 80))

# A spark where the impulse pin meets the fork horns, at every beat
_horn = FORK + ang(225) * 0.19
for tb in beats(at(0.1), at(DUR - 0.2)):
    flash((_horn.x, _horn.y, -0.035), tb, 0.025, bench['root'])

# Counter: 0 -> 8 a second, then 8 -> ≈691,200 a day, each easing out
_vals = [(at(0.25), '0')]
for i in range(1, 9):
    _vals.append((at(0.25 + 1.15 * (1 - (1 - i / 8) ** 2)), str(i)))
_n = 14
for i in range(1, _n):
    u = 1 - (1 - i / _n) ** 3
    v = 8 + (691200 - 8) * u
    v = int(round(v, -2)) if v > 1000 else int(v)
    _vals.append((at(2.3 + 1.3 * i / _n), f'{v:,}'))
_vals.append((at(3.6), '≈691,200'))

face(holder, shot.cam)
ticker(_vals, (0, 0.03, 0.01), 0.09, holder, color=WHITE)
ticker([(at(0.25), 'a second'), (at(2.3), 'a day')], (0, -0.072, 0.01), 0.05, holder, color=GOLD)


def _rounded(w, h, r, n=8):
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90),
                       (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for k in range(n + 1):
            d = ang(a0 + 90 * k / n)
            pts.append((cx + d.x * r, cy + d.y * r))
    return pts


# Dark badge with a gold edge, so the white number reads over the gilt plate
prism('06.badge', _rounded(0.52, 0.28, 0.05), -0.012, -0.004, _flat_mat('badge', INK, 0.0, None), holder)
prism('06.badge.edge', _rounded(0.535, 0.295, 0.057), -0.016, -0.013, _flat_mat('edge', GLOW, 1.4, None), holder)

# Grow in, then land each count with a small bounce
for t, sc in ((0.0, 0.001), (0.2, 0.001), (0.6, 1.0),
              (1.4, 1.0), (1.55, 1.14), (1.75, 0.96), (1.9, 1.0),
              (3.6, 1.0), (3.75, 1.16), (3.95, 0.95), (4.12, 1.0)):
    holder.scale = (sc, sc, sc)
    kit.ease_keys(holder, 'scale', [fr(at(t))])
