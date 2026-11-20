# AI trainer lessons

Three catalog poses ship a pilot trainer video: Mountain Pose (`tadasana`),
Warrior II (`virabhadrasana-ii`), and Downward-Facing Dog
(`adho-mukha-svanasana`). The other poses — and any class moment whose pose
is not one of these — show that pose's own labelled still. Nothing in the
app may claim a video that is not in the manifest.

These clips are **not** reviewed movement demonstrations. They stay out of
`REVIEWED_MOVEMENT_DEMOS` and `instructorMediaManifest`. The player labels
them "AI trainer preview".

## What the files actually are

Each lesson is three same-origin files:

| File | Path |
| --- | --- |
| Video | `client/public/videos/ai-trainer/{slug}-{version}.mp4` |
| Captions | `client/public/captions/ai-trainer/{slug}-{version}.vtt` |
| Poster | `client/public/videos/ai-trainer/{slug}-{version}-poster.jpg` |

`{version}` is `assetVersion` in
`client/src/data/aiTrainerLessons.manifest.json` (currently `v3`).

The v3 files are **720×1280 slides**, about 2½ minutes, with English WebVTT.
The human-like trainer is a **16:9 picture centered in the slide**; the rest
of the frame is a beige title card (pose name, Sanskrit, pronunciation) and
empty margin. The player uses a 16:9 box and `object-fit: cover` /
`object-position: center` so that margin is cropped and the trainer fills the
frame. Do not switch the player back to a 9:16 `object-contain` box — that
is what made the trainer tiny.

The generator that rendered these three slides is **not in this repo**. The
files were dropped in as finished media. Do not synthesize stand-in mp4s.

## Adding another pose (data only)

1. Render the lesson (see below) as MP4 + WebVTT + JPEG poster.
2. Name them with the catalog slug and the current `assetVersion`.
3. Add one object to `lessons` in `aiTrainerLessons.manifest.json`:

```json
{ "slug": "vrksasana", "english": "Tree Pose", "sanskrit": "Vrksasana", "durationHint": "About 2½ minutes" }
```

Paths, the "AI trainer preview" label, and the frame size are derived. No
component edit. `client/src/data/aiTrainerLessons.test.ts` fails if a row
points at a missing file, if the slug is not in the catalog, or if the VTT
is not WebVTT.

Check locally:

```bash
npx tsx --test client/src/data/aiTrainerLessons.test.ts
```

A new version of an existing pose means bumping `assetVersion` (so browsers
do not keep the old file) and shipping every lesson at that version.

## What it takes to make the other videos

The catalog has 207 poses. 204 of them have no trainer video. To produce
one you need, per slug:

1. **Script**, from the catalog (do not invent cues): English name, Sanskrit,
   a spoken pronunciation, what the pose is for, a caution, then the pose's
   own `steps` in order. The v3 Mountain Pose VTT is the pattern
   (`client/public/captions/ai-trainer/tadasana-v3.vtt`).
2. **Picture**: a full-body human-like trainer performing that pose, framed
   16:9, on a plain background. Entry, the shape, and a release — not a
   crossfade of the illustration. The current pilots composite that picture
   into the 720×1280 title slide; a plain 16:9 master is also fine, because
   the player crops to 16:9.
3. **Voice**: English narration matching the VTT timings. Captions use a
   period in timestamps (`00:00:01.000`), not a comma.
4. **Poster**: one JPEG of a representative frame, same pixel size as the
   video.
5. **Drop the three files in and add the manifest row.** That is the only
   repo change.

Until that media exists, guided practice, pose pages, and class moments for
that slug stay on the labelled still. The class player
(`client/src/lib/classPoseCues.ts`) will swap in the trainer automatically
when the pose on screen has a lesson.
