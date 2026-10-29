# 2D explainers

For flat subjects: numbers, comparisons, lists, text. The page is plain
DOM and CSS; every property is set from `render(t)`.

Steps and shared rules: [../README.md](../README.md). Start from
[`_template/`](_template/).

## Code (step 4)

- Layout in absolutely positioned scenes, one `<section>` per shot;
  `render(t)` shows the right one and sets every opacity and transform.
- No CSS animations or transitions, no `setTimeout`, no
  `requestAnimationFrame` outside `?play`: the recorder steps time.
- A little depth is fine with CSS 3D (`perspective`,
  `transform-style: preserve-3d`), as in ep01's GPU rig and slot drums.
  When the idea needs real geometry, light or a camera moving through
  space, it belongs in the 3D track.
- Helpers in the template: `rise(t, start, duration)` for an eased
  0 → 1, `lift(el, p)` to fade and rise, `pop(el, p)` to stamp in.

## Episodes

| # | Topic |
| --- | --- |
| [01](ep01-password-crack-time/) | How long would a hacker need to crack your password? |
