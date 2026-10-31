# 04-the-gear-train: track sideways along the train from barrel to hands while
# a gold pulse passes barrel -> centre -> third -> fourth, ending at the hands.
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.

# Contact points between the wheels (bench root space, no rotation on the root)
_bc = (B.x + R_B, B.y, 0.0)                                   # barrel -> centre pinion
_ct = tuple(C + ang(40) * R_C) + (0.057,)                     # centre wheel -> third pinion
_tf = tuple(T + ang(-40) * R_T) + (0.033,)                    # third wheel -> fourth pinion

# The pulse: each wheel flares as the energy arrives, keeping a low ember after
_pulse = [(bench['barrel'], 0.1), (bench['centre'], 0.9), (bench['third'], 1.6), (bench['fourth'], 2.3)]
for obj, t0 in _pulse:
    glow(obj, [(at(t0 - 0.05), 0.0), (at(t0 + 0.35), 1.4), (at(t0 + 1.1), 0.2), (at(DUR), 0.2)])
for loc, t0 in ((_bc, 0.75), (_ct, 1.45), (_tf, 2.15)):
    flash(loc, at(t0), 0.06, bench['root'])
# Last stop: the hands on the centre arbor light up
for name in ('minute', 'hour'):
    glow(bench[name], [(at(2.7), 0.0), (at(3.3), 1.8), (at(DUR), 1.2)])
flash((0, 0, 0.13), at(2.9), 0.09, bench['root'])

# Aim above the train (+Y) so the gears sit in the lower 60%, under the caption
_off = Vector((0, 0.42, 0))
_a0 = bench_at('barrel') + _off + Vector((0.12, 0, 0))
_a1 = bench_at('third') + _off + Vector((-0.02, -0.15, 0))
_aim = empty('04.aim', None, _a0)
for t, p in ((at(0), _a0), (at(DUR), _a1)):
    _aim.location = p
    kit.ease_keys(_aim, 'location', [fr(t)])

kit.Shot('04-the-gear-train', at(0), at(DUR), lens=40, target=_aim,
         move='dolly', frm=_a0 + Vector((0, -1.75, 3.9)), to=_a1 + Vector((0, -1.55, 3.45)),
         clip=(0.1, 80))
