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
| Wrist forearm-plank filmed adaptation | **Missing** | Teaching uses `dolphin-plank` presentation clip + reviewed text; id `filmed-instructor/kumbhakasana/wrist-forearm`. |
| Fist/forearm Cat–Cow adaptation media | **Missing** | Player shows **Demonstration unavailable** — must **not** load base `marjaryasana-bitilasana` clip labeled as the adapted reference. |
| Other adaptation media (pregnancy plank, supported Child’s, wall Mountain) | **Missing** | Same unavailable state when `mediaMatchesAdaptation` is false. |

## Precise missing asset ids

See `INSTRUCTOR_PILOT_MISSING_ASSETS` in `client/src/data/instructorPilot.ts`:

- `filmed-instructor/{slug}/front`
- `filmed-instructor/{slug}/side`
- `filmed-instructor/{slug}/beginner-front`
- `human-narration/{slug}`
- `filmed-instructor/kumbhakasana/wrist-forearm`
- `filmed-instructor/kumbhakasana/pregnancy-modify`
- `filmed-instructor/balasana/knee-supported`
- `filmed-instructor/tadasana/wall-supported`
- `filmed-instructor/marjaryasana-bitilasana/wrist-fist`

Per phase (each pilot pose × variation × side when applicable):

| Phase | Required deliverable |
| --- | --- |
| preparation | Filmed or reviewed 3D setup (props in frame) |
| entry | Motion into the shape, cue-aligned |
| hold | Steady demonstration (or intentional quiet hold) |
| exit | Clean exit to transition |
| transition | Bridge into the next pose |

**Status:** none of the filmed/human assets above are shipped. Presentation animations and static posters remain labeled placeholders — not completed instructor lessons.

## Adaptation media rule

`ADAPTATIONS[*].mediaMatchesAdaptation` must be `true` only when the referenced clip/poster is a reviewed visual match for that variation. Otherwise:

1. `mediaSlug` is `null` (or ignored).
2. `mediaForAdaptation` returns `kind: "missing"` with **no** base-pose video/poster.
3. The stage shows an explicit unavailable state beside correct text cues.
4. Never label base-pose `marjaryasana-bitilasana` (or similar) media as “Fist/forearm Cat–Cow reference.”

## Integration pipeline (when media arrives)

1. Place reviewed files under a staging folder, e.g. `.data/instructor-media/{poseId}/{variantId}/{phase}-{angle}.{mp4,webm,vtt,mp3}`.
2. Register ids in `INSTRUCTOR_PILOT_MISSING_ASSETS` → flip status to `ready` and remove from the “needed” list.
3. Wire `InstructorMediaRef` in `instructorPilot.ts` / `ADAPTATIONS` to the new URLs (keep `kind: "filmed_instructor"` or `reviewed_3d` only when reviewStatus is `instructor_reviewed`). Set `mediaMatchesAdaptation: true` only after visual review.
4. Extend `buildSessionTimeline` media windows so prep/entry/hold/exit scrub or play the matching clip; keep the shared clock as the single source of truth for captions + narration + timers.
5. Run `client/src/data/instructorPilot.test.ts` and a manual Learn session (both sides, wrist adaptation, pause/repeat) before claiming the phase complete.
6. Do **not** mark static posters or free-running presentation loops as complete instructor media.

## Review honesty

- `reviewStatus` is `not_reviewed` or `editor_catalog_note` only until filmed/reviewed assets land.
- UI copy says **Not instructor-reviewed video** when media is shown.
- Camera pose analysis is **not** part of this pilot. `/pose-coach` remains a labeled mirror / self-check.
- Consumer practice UI does not show raw asset path ids; the precise manifest stays on setup + this doc.

## Player behavior without filmed media

- Entry/exit may scrub the presentation animation when `kind === presentation_animation`.
- Hold phases stay quiet and do **not** fake instruction by free-running or zooming a still.
- If accurate motion media is unavailable, show the unavailable panel + consumer-facing media label (not raw paths on the practice screen).
