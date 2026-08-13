# Pose demonstration videos

Sadhana’s pose training UI leads with **HD how-to video + coaching voice** for
every catalog asana. Illustration / 3D stages remain fallbacks when video cannot
play (Save-Data, error, missing clip).

Clips are **step journeys** (entry → mid → peak with crossfades) encoded at
portrait HD (**1080×1920**). They are not Ken Burns zooms on a single still, and
they are not filmed studio instructors — for that, publish real captures via
`POSE_MEDIA_OVERRIDES` (see Filmed studio clips below).

## File convention

For each asana slug (e.g. `tadasana`, `adho-mukha-svanasana`):

| Asset | Path |
|-------|------|
| WebM (preferred) | `client/public/videos/poses/{slug}.webm` |
| MP4 fallback | `client/public/videos/poses/{slug}.mp4` |
| Captions | `client/public/captions/poses/{slug}.vtt` |
| Voice | `client/public/voice/pose-{slug}.mp3` (served at `/audio/`) |
| Poster | Reuses `client/public/poses/{slug}.png` by default |

Create the folders if missing:

```bash
mkdir -p client/public/videos/poses client/public/captions/poses
```

## Generating clips from illustrations

Every catalog asana becomes a short **step-journey** clip (entry → peak with
crossfades) at studio-friendly portrait HD:

```bash
# requires: brew install ffmpeg
npm run gen:pose-videos -- --force
npm run gen:pose-captions -- --force
# or: npx tsx script/gen-pose-videos.ts --force
```

The video script writes files to `client/public/videos/poses/` and regenerates
`client/src/data/poseVideosReady.generated.ts`. Captions write
`client/public/captions/poses/{slug}.vtt` and
`client/src/data/poseCaptionsReady.generated.ts`. Incremental runs skip existing
non-empty outputs unless `--force` is passed.

**Coverage rule:** every entry in `ASANAS` must have both `.webm` and `.mp4`,
appear in `POSE_VIDEOS_READY`, and ship narration under
`client/public/voice/pose-{slug}.mp3`. Unit tests enforce video + audio coverage
and a minimum HD width sample.

**Presentation UI:** idle pose detail, asana library cards, Trainer composed
lists, Search results, and guided transition/idle moments play the looping
journey clip via `PoseTrainerStage` / `PoseCardVideo`.

**Teaching UI:** once step-by-step training or a guided hold/instruction is
active, `PoseTrainerStage` keeps the how-to clip on screen and **scrubs it to
the spoken cue** (`videoTimeForNarration` in `client/src/lib/videoNarrationSync.ts`).
Each narration step owns a slice of the journey; progress within the sentence
advances that slice so the demonstrated action lands with the voice.

Kids story poses play Ken Burns clips when generated:

```bash
npm run gen:kids-pose-videos
```

## Enabling a pose clip

After adding files for a slug, register it so the player attempts video:

1. Drop files under the paths above (or run `npm run gen:pose-videos`).
2. Ensure the slug is in `POSE_VIDEOS_READY` (auto-updated by the generator),
   **or** add a `POSE_MEDIA_OVERRIDES` entry for CDN URLs.
3. Run `npm run gen:pose-captions` so English WebVTT ships with the clip.

Unregistered slugs skip video entirely (no 404 probes) and use the illustrated guide.

## Filmed studio clips (NordicTrack / iFIT-class)

True filmed instructor video (live coach, studio lighting, ambient audio) is
**not** generated from illustrations. To upgrade a pose to real captures:

1. Film one clear demonstration per pose (front ¾ preferred; optional side cut).
2. Neutral background, good lighting, full body in frame; **8–20 s** seamless loop.
3. Host WebM + H.264 MP4 + English WebVTT on your CDN (do not invent URLs).
4. Add entries in `client/src/data/poseMedia.ts` → `POSE_MEDIA_OVERRIDES`:

```ts
export const POSE_MEDIA_OVERRIDES = {
  tadasana: {
    webm: "https://your-cdn.example/poses/tadasana.webm",
    mp4: "https://your-cdn.example/poses/tadasana.mp4",
    captions: "https://your-cdn.example/poses/tadasana.vtt",
  },
};
```

Do **not** commit placeholder remote URLs that 404. Voice coaching continues to
use `/audio/pose-{slug}.mp3` unless you replace those files too.

## Capture guidelines (generated or filmed)

1. Full body in frame; portrait **1080×1920** preferred (or 1280×720 landscape).
2. Mute-friendly video — coaching voice comes from `/voice/pose-{slug}.mp3`.
3. Export WebM (VP9) + H.264 MP4 (High profile); add English WebVTT for form cues.
4. Keep start ≈ end posture for seamless idle loops.

## UX behavior (correct pose first)

Pose explanation and guided practice use `PoseTrainerStage`:

- **Idle / watch:** looping HD demo video for **this pose's slug** when
  registered in `POSE_VIDEOS_READY`
- **Active training:** same clip scrubbed to the spoken cue; focus halo + caption
- **Filmed CDN:** `POSE_MEDIA_OVERRIDES` always prefers real trainer clips
- Video load failures / Save-Data fall back to the human trainer stage
- Narration-synced steps + Form / Breath / Align teaching rail

`humanStepSlug` in `poseKeyImages.ts` must never remap a pose onto another
asana's artwork at idle or peak — see `poseKeyImages.test.ts`.

## Related code

- `client/src/components/PoseTrainerStage.tsx` — video-first trainer demo with illustrated fallback
- `client/src/components/PoseHumanStage.tsx` — illustrated figure + body momentum fallback
- `client/src/components/PoseDemoStage.tsx` — video / 3D / illustration stage
- `script/gen-pose-videos.ts` — regenerate illustration-based WebM/MP4 clips (1080×1920)
- `script/gen-pose-captions.ts` — English WebVTT for every asana
- `client/src/data/poseVideosReady.generated.ts` — video allowlist
- `client/src/data/poseCaptionsReady.generated.ts` — captions allowlist
- `client/src/data/poseMedia.ts` — URL resolution + filmed overrides
- `client/src/components/PoseExplanation.tsx` — detail-page experience
- `client/src/components/PoseTipsSheet.tsx` — in-practice tips

---

## Rigged 3D stage (pilot)

Five poses now render through a **real WebGL humanoid** whose joints are driven
by per-narration-step keyframes, rather than a flat SVG on a rotated plane:

    tadasana · virabhadrasana-ii · adho-mukha-svanasana · bhujangasana · trikonasana

As a step is spoken, the limbs tween from the previous keyframe into that step's
shape and settle before the sentence ends. Everything outside this list still
uses the CSS `PoseFigurine3D` stage, and so does any device without WebGL or
with Save-Data on.

### Why it works now

Step boundaries used to be `floor(currentTime / duration * stepCount)` — an
even split that ignored how long each sentence actually takes to speak. That is
replaced by `useNarrationTiming`, which prefers a generated timing file and
falls back to a syllable-weighted estimate:

```bash
npm run gen:voice-timings                # all poses, skips existing
npm run gen:voice-timings -- --force     # regenerate
```

Writes `client/public/voice/timings/{slug}.timing.json` from edge-tts
WordBoundary events. Offline, free, and must use the same voice/rate/pitch as
`script/gen-missing-voices.py` or the boundaries won't match the shipped mp3s.

### Reviewing keyframes

Joint angles are unreadable as text. Render them:

```bash
npm run rig:preview                          # contact sheet of every keyframe
npm run rig:preview -- --slug trikonasana
npm run rig:preview -- --tween               # include mid-transition frames
```

Writes `rig-preview.png` — front and side view per (pose, step). This runs the
same forward kinematics as the WebGL stage with no browser or GPU, so it works
in CI. **Look at the sheet before trusting new angles**; the first pass of
Down Dog rendered as a tabletop and Triangle floated off the floor.

### Adding a pose to the pilot

1. Add a `PoseSequence` to `client/src/data/poseKeyframes.ts` with exactly one
   frame per narration step in `content.ts` (a test enforces this).
2. Run `npm run rig:preview -- --slug <slug>` and check both views.
3. Nothing else — `PoseDemoStage` picks it up via `hasRigSequence()`.

### Body shape

The figure is built from three.js primitives — no glTF, no download. What makes
it read as a person rather than plumbing is in `SKELETON` (`poseRig.ts`):

- **Standard 7.5-head proportions** for a 1.72 m adult. Quickest eye check: with
  the arms hanging, the fingertips should land at mid-thigh.
- **Tapered segments.** Each bone has `r0` (at the joint) and `r1` (at the far
  end), so a thigh thins toward the knee and a forearm toward the wrist.
- **Elliptical cross-sections.** `sx`/`sz` make the torso ~1.35× wider than deep
  and flatten the hands and feet. Uniform circular capsules were the single
  biggest reason the first version looked like tubing.
- **Shapes.** `torso` (broad frustum), `limb` (tapered, rounded ends), `slab`
  (hands and feet), `head` (ovoid skull + jaw + nose — the nose is small but it
  is what makes the facing direction unmistakable in a still frame).

`script/rig-preview.mjs` mirrors this shading so the contact sheet and the app
agree; if you change a radius in one, change it in both.

### Conventions and gotchas

See the header of `client/src/lib/poseRig.ts` for rotation signs. Two that
cost real time:

- **Put standing side-bends in `spine`/`chest`, never `root`.** The leg chains
  are children of the root, so rotating it lifts the feet off the floor.
- Composed X-rotations are additive down a chain. A limb's world angle is the
  sum of its ancestors' `x` values, which is how Down Dog's `shoulder.x: 172`
  is derived: the arm has to continue the torso line, not hang from it.

### Cost

three.js is dynamically imported, so it lands in its own chunk
(`PoseFigurineGL-*.js`, ~131 kB gzip) that is only fetched when a rigged pose
opens. `index.js` is unchanged. Verify with `npm run build` before shipping
more poses.

### Related code

- `client/src/lib/poseRig.ts` — skeleton, pose interpolation, mirroring, breath
- `client/src/data/poseKeyframes.ts` — per-step keyframes for the pilot poses
- `client/src/components/PoseFigurineGL.tsx` — three.js scene + animation loop
- `client/src/components/PoseStageGL.tsx` — lazy loader, chrome, CSS fallback
- `client/src/lib/narrationTiming.ts` — step boundaries from text or timing file
- `client/src/hooks/use-narration-timing.ts` — the hook the players call
- `script/gen-voice-timings.py` — WordBoundary → timing JSON
- `script/rig-preview.mjs` — keyframe contact sheet
