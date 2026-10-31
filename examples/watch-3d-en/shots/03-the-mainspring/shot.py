# 03-the-mainspring: close on the open barrel while the crown winds the spring.
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.
# Aim above the barrel (+Y) so barrel and crown sit in the lower 60% of the frame.
_aim = bench_at('barrel') + Vector((-0.12, 0.5, 0.0))
kit.Shot('03-the-mainspring', at(0), at(DUR), lens=40, target=_aim,
         move='dolly', frm=_aim + Vector((0, -1.5, 3.9)), to=_aim + Vector((0, -1.3, 3.3)),
         clip=(0.1, 80))
