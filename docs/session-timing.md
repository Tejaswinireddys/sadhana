# Session length — one number, per teaching mode

## The rule

A session has no single length until you know **how it will be taught**.

`client/src/lib/guidedDuration.ts` is the authority. Every duration anywhere in
the product — home cards, the landing page, trainer results, adaptive plans,
the quiz, program previews, the preparation screen and the live footer — comes
from it, and every one of them passes the mode the practitioner will get.

```ts
type InstructionMode = "guided" | "brief" | "timer";
```

| Mode | When | Instruction seconds per pose |
| --- | --- | --- |
| `guided` | Voice on (the default) | Recorded narration, 55–70s (`narrationDurations.ts`) |
| `brief` | Voice off in settings | `BRIEF_INSTRUCTION_SECONDS` (12s of on-screen steps) |
| `timer` | The timer-only mode on `/practice` | 0 — no instruction phase exists |

Plus, in every mode: `TRANSITION_SECONDS` (5) per pose, `SIDE_SWITCH_SECONDS`
(2) on bilateral poses, and the hold — twice for a pose held on each side.

`GuidedSession` derives its own mode from the voice preference and the player's
`SILENT_INSTRUCTION_SECONDS` **is** `BRIEF_INSTRUCTION_SECONDS`, pinned by
`sessionDurationModes.test.ts`. Two constants drifting apart is exactly how the
estimate and the clock come to disagree.

## Why a "sum of holds" is always wrong

Four restorative poses with 90/45/120/120 second holds sum to 6 minutes 15. The
guided player runs them in about 11, because it also speaks about a minute of
instruction per pose and takes five seconds to get into each one. Every
over-run in the September audit — a 15-minute card that ran 22, a 5-minute
trainer result that opened as 14, a 10-minute adaptive selection that ran 21 —
was a generator budgeting holds and a player also speaking.

## Fitting a requested length

`sessionFit.ts` answers "does this queue fit what was asked for, in this mode?"

- `sessionOverheadSeconds` — the part holds cannot shrink.
- `holdBudgetSeconds` — what is left for holds after that.
- `evaluateSessionFit` — `fits`, `plannedSeconds`, a `floorSeconds` at minimum
  holds, an `explanation` and a `suggestedMinutes` when the request cannot be
  met by trimming at all.
- `nearestOfferedMinutes` — snaps that suggestion onto a chip the screen offers.

Tolerance is 15% or 45 seconds, whichever is larger. Rounding 5:20 to "5 min" is
honest; calling a 14-minute practice "5 min" is not.

**What a generator may trim, in order:** the number of poses first, then hold
length. Narration is fixed, so a short budget buys fewer poses — not shorter
ones. `quizPlan.fitToBudget` and `composeTrainerSession` both work this way, and
neither will stretch a hold past twice the pose's reviewed `holdSeconds`.

**What a screen must do when the request cannot be met:** show
`fit.explanation` once, before starting, and offer `nearestOfferedMinutes`.
Never label an over-budget session as fitting.

## Remaining time during a practice

`remainingFromPhases` computes from the live phase, never `total − elapsed`. It
has to account for four things that each produced a wrong countdown:

1. **The far side of a bilateral pose.** Before the switch, the second
   narration, the switch and the second hold are all still ahead — 99 seconds
   unaccounted for on a single Warrior II.
2. **Banked "+30s".** Pressed during narration, it buys hold time that has not
   started yet, so it lives in `pendingHoldExtension` and is counted there.
3. **Pace.** Slow (0.75) makes every remaining countdown second take 1⅓ real
   seconds, so the wall-clock estimate divides by pace.
4. **Skipping.** Poses after the current index are re-summed for the current
   mode, so a skip shortens the estimate immediately.

## Adding a screen that shows a duration

Do not compute one. Call the helper that matches your data:

| You have | Call |
| --- | --- |
| A quick-session pose list | `sessionSeconds / sessionMinutes / sessionTimeLabel` (`quickSessions.ts`) |
| A catalog/pathway pose list | `catalogSessionSeconds / catalogSessionMinutes / catalogSessionLabel` (`pathwayTiming.ts`) |
| A queued practice | `buildSessionPreflight({ poses, mode })` (`sessionPreflight.ts`) |
| A trainer/adaptive result | `session.totalMinutes` — already derived |

All of them take the mode. The default is `guided`, which is right for a card
shown before we know the practitioner's voice setting, and wrong to hard-code
anywhere the setting is known.
