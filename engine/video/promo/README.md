# Product promo workflow (产品宣传视频)

Short promo videos for product pages, the way the Tsuba demo was made:
the product's story told in about 20–30 seconds, one version per site
language, autoplaying muted on the product page.

## Steps

Each product is a folder, `<product slug>/`, with one file per step:

| # | Step | File | Done when |
| --- | --- | --- | --- |
| 1 | Product story (产品故事) | `story.md` | The problem, who has it, what the product does about it, the one thing to remember. Facts from the product's own docs. |
| 2 | Script (脚本) | `script.md` | The on-screen words per scene and per language, timed. |
| 3 | Storyboard (分镜) | `storyboard.md` | One row per scene: picture, motion, where real product screenshots appear. |
| 4 | Code (代码) | `index.html` | Draws every frame from `render(t)`; `?lang=` switches the copy. |
| 5 | Render (渲染/录制) | — | `engine/video/record.mjs --lang en,zh,pt-br` |
| 6 | Video (视频) | `public/products/<slug>/demo.<lang>.mp4` | Inlined in the product page body as `![caption](demo.<lang>.mp4)`. |
| 7 | Publish (发布), when it also goes to social | `thumb.html` → `out/thumbnail.png`, `publish.md` | As for explainers (../explainers/README.md, step 6): a cover and the post per platform (X for product news). |

## Rules

- **Real product, fictional examples.** Screens are real screenshots
  (e.g. from `scripts/tsuba-shots.mjs`); attacker domains, file names
  and people are invented (`meetly.example`).
- **The site's look:** paper or ink ground, one accent, Archivo and
  JetBrains Mono, square corners, ruled frames.
- **Silent by default.** Product pages autoplay muted; add a
  `music.json` only for a version meant for social.
- **Re-record after a UI change** so the screenshots in the video
  match the product.

## Products

| Product | Length | Languages |
| --- | --- | --- |
| [Tsuba](tsuba/) | 24 s, 16:9 | en, zh, pt-br |

```bash
node engine/video/record.mjs engine/video/promo/tsuba/index.html \
  --out "public/products/tsuba/demo.{lang}.mp4" --lang en,zh,pt-br
```
