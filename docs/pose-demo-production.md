# Pose demonstration media — audit and production manifest

## What the generated clips actually are

`script/gen-pose-videos.ts` does not film anything. For each pose it picks 2–3
still illustrations and crossfades between them — `HOLD = 1.6s`, `FADE = 0.65s`
— producing a **2.57-second** file. Measured:

```
$ ffprobe -show_entries format=duration client/public/videos/poses/*.mp4
marjaryasana-bitilasana  2.566667
virabhadrasana-ii        2.566667
vrksasana                2.566667
```

Against 63–77s of narration per pose, a step cue scrubbed into a 2.57s clip
lands somewhere inside a dissolve.

Worse, when a pose's own steps never leave its peak shape the encoder prepends
**a different pose's illustration**, chosen by category (`defaultEntrySlug`):

| Category | Entry illustration | Affected pilot pose |
| --- | --- | --- |
| Standing | `tadasana` | Warrior II, Tree Pose |
| Restorative | `sukhasana` | Cat–Cow |
| Backbends | `bhujangasana` | — |
| Seated / Forward Bends / Inversions / Hip Openers | various | — |

That is the exact source of the reported bugs:

- **Warrior II** — "Bend the right knee toward 90°" showed a figure standing
  upright with feet together: the clip opens on 1.6s of Mountain Pose.
- **Cat–Cow** — "Come to all fours" showed someone sitting cross-legged: the
  clip opens on Easy Seat, because Cat–Cow is filed `Restorative`.
- **Both** — "transparent standing and final-pose figures overlapping" is the
  0.65s crossfade.

**205 of the catalog's poses** have a generated clip that blends in at least one
foreign illustration. Verify with
`posesWithMisleadingGeneratedClips()` in `client/src/data/poseDemoAvailability.ts`.

**A dissolve between two stills is not a body moving.** These clips are no
longer played in any teaching context.

## What ships instead, today

`poseDemoAvailability(slug, level)` returns `static_reference` for every pose:
this pose's **own** illustration, held still, labelled
**"Static reference — movement demonstration unavailable"**, with a sentence
under the lesson saying it does not show the movement into or out of the pose.

`REVIEWED_MOVEMENT_DEMOS` is empty. Code must never add to it — an entry means
a named human watched the footage and confirmed it teaches the pose.

## Production manifest

Nine deliverables for the three audited poses. Each is one continuous take, no
cuts, no dissolves between different bodies.

| Asset id | Pose | Variation | Deliverable |
| --- | --- | --- | --- |
| `movement-demo/marjaryasana-bitilasana/beginner` | Cat-Cow | beginner | starting position → entry → repeated movement cycles → exit |
| `movement-demo/marjaryasana-bitilasana/intermediate` | Cat-Cow | intermediate | starting position → entry → repeated movement cycles → exit |
| `movement-demo/marjaryasana-bitilasana/advanced` | Cat-Cow | advanced | starting position → entry → repeated movement cycles → exit |
| `movement-demo/virabhadrasana-ii/beginner` | Warrior II | beginner | starting position → entry → hold → exit, both sides |
| `movement-demo/virabhadrasana-ii/intermediate` | Warrior II | intermediate | starting position → entry → hold → exit, both sides |
| `movement-demo/virabhadrasana-ii/advanced` | Warrior II | advanced | starting position → entry → hold → exit, both sides |
| `movement-demo/vrksasana/beginner` | Tree Pose | beginner | starting position → entry → hold → exit, both sides |
| `movement-demo/vrksasana/intermediate` | Tree Pose | intermediate | starting position → entry → hold → exit, both sides |
| `movement-demo/vrksasana/advanced` | Tree Pose | advanced | starting position → entry → hold → exit, both sides |

Regenerate with `missingDemoManifest()`.

### Per-pose requirements

**Cat–Cow** is a *flowing practice*, not a hold. The take must show a neutral
tabletop, then Cow and Cat as two distinct continuous movements, then at least
eight clean rounds at one movement per breath, finishing back in neutral. The
first and last round must start and end in neutral so the cycle can loop.
Beginner needs a blanket under the knees, visible in frame.

**Warrior II** and **Tree** are two-sided. Shoot left and right as separate
full takes; a mirrored clip contradicts the spoken side. Tree's beginner take
must show what the variation actually describes — toes of the lifted foot on
the floor (kickstand), heel at the ankle, **one hand on a wall** — because that
is what the lesson tells a beginner to do.

Wardrobe, background, lighting and framing: follow the house style in
[`instructor-asset-briefs.md`](./instructor-asset-briefs.md). Full body in
frame at every moment, including hands, feet and props.

### Delivery

1. Upload to the existing stream infrastructure (`server/streamConfig.ts`).
   **Never put video in the app bundle.**
2. Add the entry to `REVIEWED_MOVEMENT_DEMOS` with `reviewer`, `reviewedOn` and
   `version` filled in by the person who watched it.
3. Run `npm test` and `npx playwright test e2e/pose-lesson.spec.ts`.

## Body-area highlights

Highlights are **off for every pose** (`VERIFIED_FOCUS_POSES` is empty).

The catalog authors normalized focus zones per step, but they assume a
particular figure framing and at least one is wrong: Warrior II's
`"Arms extended"` is `{cx: 0.5, cy: 0.30, r: 0.26}` — a circle spanning from the
crown to the waist, which is the reported bug where the arms cue highlighted
the head. The rendered illustration is also letterboxed by `object-contain`, so
container-relative coordinates drift off the figure.

To re-enable a pose, check every one of its zones against the illustration at
the size it actually renders, then add the slug to `VERIFIED_FOCUS_POSES`.
Pointing at the wrong body part teaches the wrong thing; no halo is better.

## Variation visuals

There is one illustration per pose, so a variation whose setup changes the
shape cannot be depicted. `variationVisualMismatchFor()` detects this from the
variation's props and description, and the lesson says so:

> The picture shows Tree Pose in its standard shape, not the beginner variation
> described here (wall). Follow the written setup.

Producing per-variation stills would remove those notices.

## Status

The movement-demonstration feature is **not complete**. The player, the lesson
timeline, the data model and the honesty labelling are done and tested; no pose
in the catalog has a demonstration of how it is entered, held or exited. That
remains blocked on the nine assets above being produced and reviewed.
