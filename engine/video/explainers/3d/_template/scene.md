# NN · Scene

Step 3½ (3D track): the world the storyboard happens in. Write it
before the code; the code reads straight from these tables.

Units: 1 = one metre-ish. +Y up, the camera starts on +Z looking at
the origin.

## Literal check

Every step of the story, and the real thing that shows it. No step
without an object (see "Make it literal" in ../README.md).

| Step in the story | What's on screen (a thing you could point at) | Built from |
| --- | --- | --- |
| | | `lib/voxel.js` … |

## Locations

Where each part of the journey happens, laid out along one route.

| Place | Position | Props |
| --- | --- | --- |
| | | |

## Objects

| Name | Geometry | Material | Where | Notes |
| --- | --- | --- | --- | --- |
| | | | | |

## Camera path

One keyframe per beat that matters; the code eases between them.

| t (s) | Position | Looks at | Lens (fov) | Why |
| --- | --- | --- | --- | --- |
| 0.0 | 0, 0, 10 | 0, 0, 0 | 40 | |

## Lights and look

| Light | Colour | Intensity | Where |
| --- | --- | --- | --- |
| Ambient | | | |
| Key | | | |

Bloom: <on/off, strength>. Fog: <colour, near, far>.

## Text over the scene

Captions are DOM on top of the canvas, not 3D text: they stay sharp
and inside the safe area. List which shot carries which line.
