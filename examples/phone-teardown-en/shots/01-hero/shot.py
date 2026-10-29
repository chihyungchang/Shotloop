# 01 · Hero: the phone turns slowly in the studio, screen lit.
# Shot-local time t: 0 → DUR. Slow push in, slightly low, while it turns.
bake(T0, DUR, lambda t: dict(spin=-38 + 20 * ease(t / DUR), tilt=-5, rise=0.015 * math.sin(t * 1.4)))
camera('01-hero', T0, DUR, lambda t: (lerp((-0.4, -5.6, 0.3), (-0.2, -4.9, 0.25), ease(t / DUR)), (0, 0, 0.22)),
       lens=50)
