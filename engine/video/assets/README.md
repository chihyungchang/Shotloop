# Video assets

Downloaded third-party assets for the video workflows. The files are
not committed (see `.gitignore`); this list is how a fresh checkout
gets them back. **CC0 only**: check the licence on the asset's page and
in its bundled licence file before using it, and note it here.

Kenney and itch.io downloads go through a browser (an optional
donation step), so they are fetched by hand and unzipped into the
folder named below.

| Folder | Asset | Source | Licence | Size | Used by |
| --- | --- | --- | --- | --- | --- |
| `hdri/kloofendal_48d_partly_cloudy_puresky_2k.hdr` | Kloofendal 48d Partly Cloudy (Pure Sky), 2K | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky | CC0 | 5.2 MB | 3D ep02 |
| `hdri/studio_small_09_2k.hdr` | Studio Small 09, 2K | https://polyhaven.com/a/studio_small_09 | CC0 | 6.0 MB | 3D ep02 |
| `kenney/mini-characters/` | Mini Characters | https://kenney.nl/assets/mini-characters | CC0 | to fetch | 3D ep02 |
| `kenney/furniture-kit/` | Furniture Kit | https://kenney.nl/assets/furniture-kit | CC0 | to fetch | 3D ep02 |
| `kenney/city-kit-suburban/` | City Kit (Suburban) | https://kenney.nl/assets/city-kit-suburban | CC0 | to fetch | 3D ep02 |
| `kenney/city-kit-commercial/` | City Kit (Commercial) | https://kenney.nl/assets/city-kit-commercial | CC0 | to fetch | 3D ep02 |
| `kenney/city-kit-roads/` | City Kit (Roads) | https://kenney.nl/assets/city-kit-roads | CC0 | to fetch | 3D ep02 |
| `kenney/pirate-kit/` | Pirate Kit (rocks, wreck) | https://kenney.nl/assets/pirate-kit | CC0 | optional | 3D ep02 |
| `quaternius/fish/` | LowPoly Animated Fish | https://quaternius.itch.io/lowpoly-animated-fish | CC0 on the pack page; Quaternius's general licence (QAL, 2026) is not CC0, so check the bundled licence file | 1 MB | 3D ep02 |

```bash
# Poly Haven files can be fetched directly
curl -fsSL -o engine/video/assets/hdri/<name>_2k.hdr \
  https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/<name>_2k.hdr
```

Built in code instead (no CC0 asset fits): utility poles and cables,
server racks, the accelerator board, the router, the seabed.
