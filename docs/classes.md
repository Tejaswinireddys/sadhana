# Video classes

The class library (`/classes`) is data in the `classes` table, not code: add
classes with the commands below, no deploy needed.

## Adding a class

### From a local video file (one command)

```bash
DATABASE_URL=… MUX_TOKEN_ID=… MUX_TOKEN_SECRET=… npm run class:upload -- \
  --file ./slow-flow.mp4 --title "Slow flow" --slug slow-flow \
  --level beginner --tier plus --focus "flexibility,stress" \
  --chapters ./slow-flow.chapters.json \
  [--captions https://example.com/slow-flow.en.vtt] [--thumbnail-time 42] \
  [--description "…"] [--instructor "…"] [--draft]
```

What it does:

1. Uploads the file to Mux with a direct upload. **Plus** classes get a
   **signed** playback id (they only play with tokens the server mints for
   Plus members); **free** classes get a public one. It asks for
   `video_quality: "plus"` and falls back to `"basic"` if the Mux plan does
   not allow it.
2. Waits until the asset is ready.
3. Captions: with `--captions <https URL>` Mux fetches that WebVTT file as an
   English subtitle track. Without it, Mux is asked to auto-generate English
   captions from the audio. Mux only ingests captions from a public `https`
   URL, so a local `.vtt` path is rejected before anything is uploaded — host
   the file first.
4. Saves the class (same rules as `class:add`), with the chapters, the
   asset's duration (rounded up to whole minutes) and a poster frame
   (`--thumbnail-time`, default a tenth of the way in, at most 30 s).
   A **Plus** poster is served from `/api/classes/<slug>/thumbnail.webp`:
   the server signs a Mux `t` token for that frame (time and width set
   inside the token), gets the image from Mux, caches it for an hour and
   sends back only the image. Browsers, locked cards included, never
   receive the playback id or the token. If signing is not configured, the
   API returns `thumbnailUrl: null` and the card shows its placeholder.

`--dry-run` checks the file, the chapters JSON (including pose slugs) and the
captions source, then stops: nothing is uploaded or saved. The command prints
only ids — never tokens or secrets.

### From an existing Mux asset

`npm run class:add -- --asset <muxAssetId> …` (same flags, no `--file`,
`--chapters` or `--captions`). It also attaches a real video to a placeholder:
`--slug steady-strength-flow`.

## Removing a class

```bash
npm run class:remove -- --slug slow-flow [--delete-mux-asset] [--yes] [--dry-run]
```

Uses the same `.env` as `class:upload` (`DATABASE_URL`; `MUX_TOKEN_ID` and
`MUX_TOKEN_SECRET` to find or delete the Mux asset). It looks the class up by
slug and prints what it will delete:

- the class row, and the chapters stored on it;
- every viewer's progress row for the class;
- ratings: none are stored per class. The effort rating at the end of a
  class is saved on the viewer's own practice session, which belongs to
  their history and is **kept**;
- the playback id, and the Mux asset id behind it (looked up from Mux, so
  it shows as unknown without Mux credentials).

Then it asks you to type `yes`, unless `--yes` is passed. Without a terminal
(CI, a pipe) it refuses rather than guess, so pass `--yes` there.
`--dry-run` prints the plan and changes nothing.

The class row and its progress rows are deleted in **one transaction**: a
failure rolls back both. The Mux asset is kept unless `--delete-mux-asset` is
given. In that case it is deleted after the database rows, so a failed Mux
call leaves an orphaned asset (its id is printed, so you can delete it in the
Mux dashboard) rather than a live class with no video. With
`--delete-mux-asset`, the command stops before deleting anything when the
asset cannot be found, when the playback id is Mux's public test clip (the
placeholders), or when another class uses the same playback id.

### Keeping removed placeholder classes removed

The six placeholder classes (`gentle-morning-wake-up`, `desk-back-relief`,
`unwind-before-sleep`, `steady-strength-flow`, `deep-hamstring-release`,
`full-practice-stress-reset`) are written by `seedPlaceholderClasses`, which
puts back every placeholder whose row is missing. A placeholder removed with
`class:remove` stays gone only as long as nothing seeds again.

- **`SEED_PLACEHOLDER_CLASSES` must stay unset in production.** With it set to
  `true`, every server boot against Postgres re-seeds, so a removed
  placeholder returns on the next deploy or restart. It is not in
  `render.yaml` or `.env.example`; keep it out of the Render dashboard too.
- **Don't run `npm run seed:classes` against the production database.** It
  does the same thing once. Nothing in the build, start command or CI runs it.
- The in-memory dev store (no `DATABASE_URL`) always seeds itself on boot. That
  never touches Postgres.

## chapters.json

A JSON array (or `{ "chapters": [ … ] }`) of chapters in time order:

| field      | required | meaning |
| ---------- | -------- | ------- |
| `startSec` | yes      | Where the chapter starts, in seconds from the start of the video (decimals allowed). Strictly increasing; must be before the video ends. |
| `title`    | yes      | 1–120 characters, shown in the chapter list and on the player timeline. |
| `poseSlug` | no       | A catalog pose slug (as in `/asanas/<slug>`). While that chapter plays, the player shows the pose's name as a small cue linking to its page. Unknown slugs are rejected. |

```json
[
  { "startSec": 0, "title": "Arrive and breathe" },
  { "startSec": 75, "title": "Mountain", "poseSlug": "tadasana" },
  { "startSec": 180, "title": "Downward dog", "poseSlug": "adho-mukha-svanasana" },
  { "startSec": 420, "title": "Child's pose to close", "poseSlug": "balasana" },
  { "startSec": 540, "title": "Final rest" }
]
```

Chapters are stored on the class row (`classes.chapters`). Existing rows read
as having no chapters.

## In the player

- The chapter list under the video jumps to a chapter and marks the current
  one; the same chapters appear on the player's timeline.
- Speed: 0.75×, 1× or 1.25×, remembered on this device.
- Keyboard: Space plays/pauses, ← / → skip 10 s, F full screen, C captions.
- At the end: time practised, an effort rating (the same 1–10 scale guided
  practice uses), and the next class with a 10-second countdown you can cancel.
  A finished class is logged like a guided practice (session + journal), so
  it counts on Progress and Today. Under a minute watched does not count.
