# 02 · Scene

Step 3½. Blender: metres, +Z up. Built by `scene.py` with `../lib/kit.py`
and Kenney CC0 kits (furniture, mini characters, city suburban /
commercial / roads, pirate) listed in `engine/video/assets/README.md`.

## Literal check

| Step in the story | What's on screen | Built from |
| --- | --- | --- |
| You press Enter | A person at a desk typing; the terminal on her monitor | `character-female-b` (sit pose + typing arms), Kenney desk, chair, computer; `screen.html` as an image sequence on the monitor |
| The request leaves with its context | A 4 cm amber packet leaving the computer | `packet` on `desk-cable` |
| Over your home connection | The cable down the desk, through the router (LEDs blink), into the wall socket | `router`, `desk-cable`, `wall-socket` |
| Through your internet provider | House, overhead cable on poles, provider building with a sign | `building-type-a`, `electricity-pole` ×4, `building-c`, sign; `street-pulse` + lamp |
| Across an ocean | Shore landing, then the cable on the seabed under blue water, rocks, a wreck | sea surface, `sea-volume`, displaced seabed, pirate-kit rocks and wreck; `sea-pulse` + lamp |
| To a data centre | A large windowless building, fins, chillers on the roof | `dc`, `dc-fin`, `chiller`, sign |
| Inside | A cold aisle: two rows of racks, servers, LEDs, cable trays | `rack`, `server`, `tray` |
| On AI chips | An accelerator board: package, die, six HBM stacks, VRMs; the die lights | `pcb`, `package`, `die`, `hbm`, `vrm` |
| The model computes | Tokens → embedding vectors → 4 blocks (attention arcs, MLP row, residual rails) lighting in turn → next-token probability bars | `token`, `emb`, `attn`, `mlp`, `residual`, `prob` |
| Streamed back | Five amber pulses right → left along the seabed cable | `back-*` + lamp |
| The tool loop | Over her shoulder: answer, `Read(src/app.ts)`, `Allow? (y/n) y` | `screen.html`, the y press in the typing action |
| Again and again | Top-down on the whole route, pulses shuttling out and back | `route` (hidden), `loop-*` |

References for the expert-drawn parts: the transformer follows Vaswani
et al. 2017, fig. 1 (decoder-only, causal attention); the accelerator
follows vendor photos of HBM packages (die flanked by memory stacks); the
hall follows hot/cold aisle containment diagrams.

## Locations

The outbound route runs +X, so seen from −Y it moves left → right.

| Place | Position |
| --- | --- |
| Room | origin; floor 5.7 × 3.8 m, desk against the back wall |
| Street, provider | y 100, x −10 … 65 |
| Coast, sea | x 65 … 187, surface z 0, seabed z −12 |
| Far shore, data centre | x 187 … 240, DC at (212, 106) |
| Machine hall | y −300 |
| Chip bench | y −400 |
| Model | y −500 |

## Shots

| # | Time (s) | Lens | Move | Subject |
| --- | --- | --- | --- | --- |
| 1 Room | 0–2.4 | 35 | dolly in | her hands, keys, screen |
| 2 Cable | 2.4–7.2 | 35 | pedestal down | the packet |
| 3 Street | 7.2–12 | 28 | truck right | the pulse on the wire |
| 4 Coast | 12–14.4 | 24 | crane down | the cable entering the sea |
| 5 Seabed | 14.4–19.2 | 24 | truck right, keeping pace | the pulse |
| 6 Shore | 19.2–21.6 | 35 | dolly in | the data centre |
| 7 Hall | 21.6–24 | 24 | dolly down the aisle | the far end |
| 8 Chip | 24–26.4 | 85, f/4 | orbit | the die |
| 9 Model | 26.4–31.2 | 24 | crane up | tokens → probabilities |
| 10 Way back | 31.2–33.6 | 24 | truck left, keeping pace | the pulses |
| 11 Screen | 33.6–38.4 | 50 | dolly in | the tool prompt |
| 12 Overview | 38.4–48 | 24 | pedestal down (top-down) | the route |

## Lights

| Light | Where |
| --- | --- |
| HDRI sky (0.6) + sun | room, street, sea, shore; dimmed to 0.02 / off for the interiors (21.6–31.2) |
| Deep-blue world mix, sun 1.6 | underwater (14.4–19.2, 31.2–33.6), with the sea volume |
| Desk lamp (warm point) | room |
| Amber point lamp riding each pulse | street, seabed, way back |
| Area light + ceiling strips | hall |
| Two cool points | chip, model |

## Scale

| Object | Size |
| --- | --- |
| Seated person | 1.25 m |
| Desk | 0.73 m tall |
| Packet | 4 cm |
| Street / sea pulse | 1.2 m long, in a 6 / 16 cm cable |
| Rack | 0.6 × 1.0 × 2.0 m |
| Package / die | 75 mm / 33 × 26 mm |
