# Pose demonstration videos

Sadhana’s pose explanation UI leads with a narration-synced **3D figurine
stage** (CSS perspective + PoseSvg mannequin, focus halo, stepMotion cue).
Looping Ken Burns clips from still PNGs are optional fallbacks when `prefer3D`
is turned off — not the primary teaching visual.

## File convention

For each asana slug (e.g. `tadasana`, `adho-mukha-svanasana`):

| Asset | Path |
|-------|------|
| WebM (preferred) | `client/public/videos/poses/{slug}.webm` |
| MP4 fallback | `client/public/videos/poses/{slug}.mp4` |
| Captions | `client/public/captions/poses/{slug}.vtt` |
| Poster | Reuses `client/public/poses/{slug}.png` by default |

Create the folders if missing:

```bash
mkdir -p client/public/videos/poses client/public/captions/poses
```

## Generating clips from illustrations

Every pose PNG under `client/public/poses/` can be turned into a short looping
WebM + MP4 (subtle breathing zoom) with:

```bash
# requires: brew install ffmpeg
npm run gen:pose-videos
# or: npx tsx script/gen-pose-videos.ts --force
```

The script writes files to `client/public/videos/poses/` and regenerates
`client/src/data/poseVideosReady.generated.ts`, which `poseMedia.ts` imports as
`POSE_VIDEOS_READY`. Incremental runs skip existing non-empty outputs unless
`--force` is passed.

## Enabling a pose clip

After adding files for a slug, register it so the player attempts video:

1. Drop files under the paths above (or run `npm run gen:pose-videos`).
2. Ensure the slug is in `POSE_VIDEOS_READY` (auto-updated by the generator),
   **or** add a `POSE_MEDIA_OVERRIDES` entry for CDN URLs.

Unregistered slugs skip video entirely (no 404 probes) and use the illustrated guide.

If you host clips externally, add entries in
`client/src/data/poseMedia.ts` → `POSE_MEDIA_OVERRIDES`:

```ts
export const POSE_MEDIA_OVERRIDES = {
  tadasana: {
    webm: "https://your-cdn.example/poses/tadasana.webm",
    mp4: "https://your-cdn.example/poses/tadasana.mp4",
    captions: "https://your-cdn.example/poses/tadasana.vtt",
  },
};
```

Do **not** commit placeholder remote URLs that 404.

## Capture guidelines

1. Film one clear demonstration per pose (front ¾ preferred; optional side cut later).
2. Neutral background, good lighting, full body in frame.
3. Length: **8–20 seconds**, seamless loop (start ≈ end posture).
4. Mute-friendly — voice guidance already comes from `/voice/pose-{slug}.mp3`.
5. Export WebM (VP9) + H.264 MP4; add English WebVTT for any on-screen or spoken form cues in the clip.
6. Resolution: 1080×1920 (portrait) or 1280×720 (landscape) — portrait matches the illustration stage best.

## UX behavior (3D-first)

Pose explanation and guided practice use:

- 3D figurine stage with camera / focus moments timed to narration steps
- Soft PNG poster under the figurine for recognition
- Narration-synced steps + Form / Breath / Align teaching rail
- Guided practice tip sheet + richer hold cues

Optional looping WebM/MP4 clips remain supported via `prefer3D={false}` on
`PoseDemoStage` for design-system / capture review.

## Related code

- `client/src/components/PoseFigurine3D.tsx` — CSS-perspective 3D teaching stage
- `client/src/lib/poseMoments.ts` — camera / phase from focusZone + stepMotion
- `script/gen-pose-videos.ts` — regenerate illustration-based WebM/MP4 clips
- `client/src/data/poseVideosReady.generated.ts` — allowlist written by the script
- `client/src/data/poseMedia.ts` — URL resolution
- `client/src/components/PoseDemoStage.tsx` — 3D (default) + optional video stage
- `client/src/components/PoseExplanation.tsx` — detail-page experience
- `client/src/components/PoseTipsSheet.tsx` — in-practice tips
