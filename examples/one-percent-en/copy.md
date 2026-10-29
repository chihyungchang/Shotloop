# 1% better every day: what's a year worth?

## Idea

Do the actual math on the self-help line "get 1% better every day": multiply 1.01 by itself 365 times, and 0.99 by itself 365 times. How far apart do they end up?
Then add the honest footnote: real progress is never a steady 1%; what actually compounds is a small habit kept up every day.
16:9 landscape, about 26 seconds, paper background, deep green (growth) and muted red (decay).

## Facts

All computed from the formula below (double precision, rounded for display).

- 1.01^365 = 37.7834 → shown as "≈ 37.78"
- 0.99^365 = 0.025518 → shown as "≈ 0.026" (about 2.6% of the start); written as 0.0255 in the gap formula
- 1.01^365 ÷ 0.99^365 = (1.01 / 0.99)^365 = 1,480.66 → shown as "≈ 1,481×"
- 1.01^70 = 2.007 → "Day 70: doubled"
- 0.99^69 = 0.4998 → "Day 69: half gone"
- 1.01 and 0.99 differ by just 0.02 a day
- The habit calendar in 05-habits is illustrative (generated from a fixed seed), not real data

## Sources

- Formula: value after n days = (1 ± 0.01)^n, n = 365. Check with
  `node -e "console.log(1.01**365, 0.99**365, (1.01/0.99)**365)"`.
