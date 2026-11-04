# A product promo for Shotloop, the Mac app that turns one…

## Idea

Shotloop is a free, open-source macOS app that turns one sentence into a short video made of shots: the AI writes the copy, the storyboard and each shot's code, and when one shot is wrong you fix that shot in plain words — only it renders again.

## Hook

One shot is wrong, and the whole film renders again.

## Copy

The problem, in the maker's own words: the explainers on oliverz.dev were made with a pipeline that rendered the whole film for every check. Feedback was almost always about one shot — the subject too small, hidden behind a caption, nothing moving — but each check still cost a full render: about 8 minutes as a draft, about an hour final, most of it re-rendering shots that had not changed.

Shotloop answers that with shots. You start with one sentence on Home; 2D or 3D, the length, the style and the theme can stay on Auto, and the AI picks how to show it from your idea.

Before anything renders you get the plan: the hook, the script and sourced facts, and the shots with what each one shows — all editable. Then the AI builds every shot.

In the Studio you look at a shot and say what is wrong in plain words, such as "it's too still: add some motion". The AI offers a few ways to change that shot, you pick one, and it changes the shot and shows you a before and after. A fix re-renders that shot only, not the whole film.

Export joins the shots, adds the voice-over, subtitles and music, designs a cover and writes the post for each platform, into a folder of its own.

The one thing to remember: fix one shot, not the whole film. Free and open source, for macOS.

## Facts

- Shotloop's tagline: "Short videos with AI. Fix one shot, not the whole film." (source: Shotloop README and product page, https://oliverz.dev/products/shotloop)
- Feedback was nearly always about one shot, but each check meant rendering the whole 48 s: ~8 min as a draft, ~1 h final; most of that time re-rendered shots that had not changed. (source: Shotloop docs/PRD.md, §2 Problem, https://github.com/chihyungchang/Shotloop)
- A film is a list of shots; each shot is cached by a hash of its inputs, so a fix re-renders one shot in seconds, and Export only joins clips. (source: Shotloop README, "How it works", https://github.com/chihyungchang/Shotloop)
- On Home you start with one sentence: 2D or 3D, the length, the style and the theme can stay on Auto; the AI picks 2D or 3D, and how to show it, from your idea. (source: Shotloop README, "Product tour" (screenshot docs/screenshots/home.jpg))
- Copy & storyboard: the hook, the script and sourced facts, and the shots with what each one shows, all editable before anything renders. (source: Shotloop README, "Product tour" (screenshot docs/screenshots/plan.jpg))
- Tell the shot assistant what's wrong and it offers two to four concrete ways to change the shot; you pick one and it changes that shot and shows a before/after. (source: Shotloop release notes 0.12.1, https://github.com/chihyungchang/Shotloop/releases)
- Export joins the shots, lays the voice-over with its subtitles and the music under them, designs a cover and writes the post for each platform, into a folder of its own. (source: Shotloop README, "What is Shotloop" (screenshot docs/screenshots/export.jpg))
- Shotloop is out, free, and open source under the Apache 2.0 license; this version runs on Macs with Apple silicon. (source: https://oliverz.dev/products/shotloop, "Availability")
