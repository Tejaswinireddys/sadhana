# Virtual instructor pilot — media status

Pilot poses: `tadasana`, `balasana`, `marjaryasana-bitilasana`, `virabhadrasana-ii`, `kumbhakasana`.

## Implemented now

| Asset | Status | Notes |
| --- | --- | --- |
| Catalog presentation animations (`/videos/poses/{slug}.{mp4,webm}`) | Present | Short illustration journeys — **not** filmed instructors. Labeled in UI. |
| Pose posters (`/poses/{slug}.png`) | Present | Used for static-reference fallback (especially beginner variants). |
| Neural TTS narration (`/audio/pose-{slug}.mp3`) | Present | Catalog neural audio; **not** approved human VO. |
| WebVTT captions | Present where generated | Teaching captions also come from the structured timeline. |
| Filmed instructor front/side | **Missing** | Do not claim otherwise. |
| Anatomically reviewed 3D | **Missing** | Do not claim otherwise. |
| Beginner/supported variation film | **Missing** | Beginner UI uses static reference + missing-asset id. |
| Human voiceover aligned to timeline | **Missing** | |

## Precise missing asset ids

See `INSTRUCTOR_PILOT_MISSING_ASSETS` in `client/src/data/instructorPilot.ts`:

- `filmed-instructor/{slug}/front`
- `filmed-instructor/{slug}/side`
- `filmed-instructor/{slug}/beginner-front`
- `human-narration/{slug}`

## Review honesty

- `reviewStatus` is `not_reviewed` or `editor_catalog_note` only.
- UI copy says **Not instructor-reviewed video**.
- Camera pose analysis is **not** part of this pilot. `/pose-coach` remains a labeled mirror / self-check.

## Player behavior without filmed media

- Entry/exit may scrub the presentation animation when `kind === presentation_animation`.
- Hold phases stay quiet and do **not** fake instruction by zooming a still.
- If accurate motion media is unavailable, show poster + missing asset id.
