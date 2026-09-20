# Instructor demonstration — content workflow

How a demonstration goes from nothing to something the player is allowed to
present as instruction. The stages are encoded in
`client/src/data/instructorMediaManifest.ts` as `ReviewStage`, and the rules
below are enforced by `instructorMediaManifest.test.ts` — they are not
guidance, they are a gate.

```
missing → draft → content_review → playback_qa → published
```

**No code path may advance an asset to `published`.** Promotion is a human
edit to the manifest, made by the reviewer named in the same commit.

## Stages

| Stage | What it means | Who moves it on | Player behaviour |
| --- | --- | --- | --- |
| `missing` | Not shot. The manifest row is a production order. | Producer | Unavailable panel + text cues |
| `draft` | Footage or render exists; not yet judged. | Yoga content lead | Not shown to practitioners |
| `content_review` | A qualified teacher is checking the shape, cueing, and safety of the modification. | Registered teacher (RYT-500 or equivalent) | Not shown to practitioners |
| `playback_qa` | Teaching approved; now checking it *plays* — phase segments line up with narration and captions, both sides read correctly, it survives pause/seek/buffering. | Engineer + QA | Not shown to practitioners |
| `published` | Both reviews passed. | Content lead, recorded in `review.reviewer` / `review.reviewedOn` | Shown as a real demonstration |

Only `published` clips pass `isMovementDemonstration()`. Everything else falls
back to text cues and an explicit unavailable state.

## What blocks publication

`manifestViolations()` fails a clip that:

- is `published` with no named reviewer, no review date, or no version
- is `published` with no media source
- is `published` without `preparation`, `entry`, `hold` and `exit` segments —
  a free-running loop is not a lesson
- is `published` with a `presentation_animation` or `static_reference` source —
  an illustration cannot be promoted into instruction
- is `ai_generated` without recording what generated it
- is `licensed` without recording the licence terms
- has a phase segment that ends before it starts or runs past the end of the clip

## Content review checklist

The teacher signing off `content_review` confirms, for each clip:

1. The shape matches the pose named in the manifest row, not a near neighbour.
2. Entry and exit are safe at the stated level, and demonstrated at a speed a
   practitioner can follow.
3. The modification actually modifies what it claims to — a knees-down plank is
   not a forearm plank, and neither is a beginner variation.
4. Props in frame match `equipment` exactly.
5. Both sides are shot for bilateral poses, and the side in frame matches the
   `side` field. A mirrored clip is not a substitute unless labelled as one.
6. Nothing in the footage contradicts the spoken cues.

Sign-off records a real name and date. **"Reviewed by Sadhana" is not a review.**

## Playback QA checklist

1. Phase segments line up with what the body is doing, within ~0.3s.
2. The hold countdown starts when entry ends, not when the pose is announced.
3. Pause, resume, repeat, previous/next and extend-hold all keep video,
   narration, captions and timer together.
4. Extending a hold does not replay entry or exit.
5. Buffering stalls the timeline rather than letting narration run ahead.
6. Captions do not cover the moving part of the frame at 320x568 and 390x844.
7. Left/right labelling is correct on screen and in narration.
8. Reduced-motion and enlarged-text settings do not break the layout.

## Integration steps when footage arrives

1. Upload to the existing stream infrastructure (Bunny Stream by default — see
   `server/streamConfig.ts` and `server/poseStreamStore.ts`). **Do not put video
   in the application bundle**; the manifest carries URLs and playback IDs.
2. Fill in the manifest row: sources, poster, captions, narration + cues,
   `durationSec`, and the `segments` array.
3. Set `provenance` — source kind, creator, capture date, rights, and the
   licence note. For AI-generated movement, `generatedWith` is required.
4. Move the row to `draft`, then through the two reviews above.
5. On `published`, set `reviewer`, `reviewedOn` and `version`, and remove the
   id from the missing-asset list.
6. Run `npm test` and the pilot e2e (`npx playwright test e2e/instructor-pilot.spec.ts`)
   before shipping.

## Honesty rules that do not move

- Do not describe the feature as delivering realistic movement demonstrations
  until at least one clip is `published` and integrated.
- Do not claim clinical or instructor review that did not happen.
- Do not present a base-pose clip as a modification it does not depict.
- Do not use zoom, pan, cross-fade or a breathing animation on a still and call
  it a movement demonstration.
