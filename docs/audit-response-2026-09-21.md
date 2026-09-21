# Response to the September 2026 product audit

Branch: `fix/guest-blockers-sep20-retest`. Four commits, one per phase.
Nothing deployed.

Everything below was reproduced locally on this branch before it was changed,
and verified after. The live Render deployment was **not** re-tested; it is
running an older build.

---

## 1. Implemented changes

### Phase 1 — core practice

**Session timing is one number, per teaching mode.** The previous work made
durations derived; it still assumed one duration per session. The player speaks
55–70s of recorded narration per pose with voice on and reads the steps in a
12-second window with voice off, so a voice-off "I'm tired" ran roughly a third
of its advertised 11 minutes. `InstructionMode` (`guided` | `brief` | `timer`)
now runs through `guidedDuration`, `sessionFit`, `quickSessions`,
`pathwayTiming` and `sessionPreflight`, and each screen passes the mode the
practitioner will actually get. `GuidedSession`'s silent window *is* the shared
constant, pinned by a test.

**Remaining time survives the controls.** It was missing the far side of every
bilateral pose (99 seconds on one Warrior II), ignored time banked by "+30s"
during narration, and did not notice that Slow pace stretches every remaining
second by a third. All three are counted now, and skipping re-sums the tail.

**The quiz honours its budget.** `fitToBudget` stopped at "within two minutes",
which is how a 10-minute answer produced a 12-minute plan. A short budget buys
*fewer poses*, not shorter ones, so it now trims from the middle of the arc,
scales the remainder onto the target, and refuses to stretch any hold past twice
its reviewed length. All 48 goal × body × time combinations land on budget; an
unmeetable request is explained once with an alternative length.

**Teaching media.** The generated `/videos/poses/*` clips are crossfades of
stills that, for 205 of the 207 catalog poses, open on a *different* pose chosen by category
— Restorative opens on sukhasana, which is exactly why Supported Child's Pose
showed someone sitting cross-legged. The guided player is a teaching surface, so
it refuses them: it shows the pose's own illustration labelled "Static reference
— movement demonstration unavailable" until a reviewed clip exists. A step whose
pose key maps to another catalog slug is ignored while teaching, so Warrior I's
cues can no longer swap in Anjaneyasana's body.

**Mobile player.** The middle column could not shrink (`min-h-0` missing), so
the 58vh stage pushed the pose heading under the timer panel at 390×844 — the
heading was sliced in half. Media now takes what is left after the name, timer
and controls; safe-area insets are respected; Sanskrit drops on short viewports;
the transport panel scrolls rather than becoming unreachable. Verified at
390×844, 320×568 and 844×390 landscape.

**Preflight.** Before Begin: the queue's real length for the live mode, level,
intensity, the props you need in the room, the poses in order with their holds,
and the catalog's own modification lines. "I'm tired" now says it wants a chair
and a bolster (or a pillow) instead of letting you discover that lying on the
floor, and offers reviewed prop-free swaps. Equipment is **read from the pose
instructions** rather than authored, so it cannot drift: a prop named in a step
is required, one offered as an alternative ("or a strap", "if needed") or named
only in `modifications` is optional, and "into Chair Pose" is not furniture.

**Account recovery.** The recovery-code path was already in place from the
previous commit. One real defect remained: a recovery-code reset marked the
email **verified**, which is false — nothing was sent to that address, so
nothing about it was proven. Fixed, and pinned by the e2e spec. Email delivery
itself is deployment configuration; see §4.

**Completion.** "1 POSES" is "1 pose". "0 BREATHS" — a measurement of nothing,
presented as a result — is gone; breaths are estimated from hold time and the
tile now says so and only appears when there is something to estimate from. A
mood or effort rating added *after* the save now amends the saved session and
journal rows (new `PATCH /api/sessions/:id`) instead of being silently dropped,
which is what happened before. Skipping through still earns no credit.

### Phase 2 — Today

Home was a directory: mood sessions, curated sequences, the Trainer, the
Adaptive Plan, a profile card, a splits banner, affirmations, breath of the day
and a twenty-link shortcut grid, all weighted the same, under a header reading
"One clear next step below" above nine of them.

It now leads with one practice and says truthfully why that one.
`homeRecommendation.ts` ranks what the practitioner actually did — finish what
you started, then the program you joined, then the plan you built, then your
profile, then a practice composed for your stated focus — so every reason is
checkable against an input. It generates nothing itself.

The card carries the length the player will run, level, intensity, required
props, one Start, and Change time / Change focus / Preview poses beneath it.
Below: continue, a compact week, three genuinely different alternatives, one
thing to learn, one quiet card about where the data lives. The directory moved
to Practice, which is a catalogue on purpose.

States handled deliberately: a skeleton while any of the three queries load (no
first-time content flashes at a returning practitioner), an empty progress
section that explains itself instead of showing zeros, a finished-day state with
a reflection action and a next step, and storage copy that is about storage —
"Keep your practice safe" read as a warning about the yoga.

Two defects the new cards exposed: `composeTrainerSession` capped hold *length*
by experience but not difficulty, so Home offered a first-timer an Advanced
shape at a beginner's hold; and intensity was a headcount of categories, which
called the warm-up "Strong".

### Phase 3 — /welcome

The public page never said what the teaching is. It now leads with it —
illustrations, recorded voice, timed holds, captions — and states, in the same
type as everything else, that there is no filmed instruction and none is shot
yet. "Get my plan" is joined by a sample practice that starts the real player
with no quiz and no account. Three representative sessions show duration, level,
intensity, equipment and format computed from their own queues. A new section
separates what is free and working from what is not built. FAQs answer
equipment, offline, instruction format, progress storage and difficulty. The
pose count is read from the catalog instead of "200+", and the walkthrough is
described as what it is: a screen recording of the app.

### Phase 4 — simplification

`practicePreferences.ts` holds goal, ability, time and focus. The quiz, Today,
the Trainer and the Adaptive Plan read it for defaults and write back what was
chosen, so a length answered once is not asked for again. `benefitClaims.ts`
separates descriptions of sensation from claims about conditions and routes the
85 that make claims to `docs/benefit-claim-review.md`, with a standing caveat on
the pose page until a reviewer has been through them. The "Offline practice
pack" is an image cache, so it says so.

---

## 2. Tests performed and results

**Unit — `npm test`: 660 passing, 0 failing** (up from 610). New suites:

| Suite | Covers |
| --- | --- |
| `sessionDurationModes.test.ts` | Advertised vs generated vs player duration per mode; the silent-window constant; bilateral second side; banked +30s; pace; skip |
| `sessionPreflight.test.ts` | Equipment required vs optional vs pose-name; "I'm tired" disclosure; difficulty; intensity weighting; fit explanation; static-reference flag |
| `completionSummary.test.ts` | "1 pose"; hidden zero breaths; estimate labelling; skipped counts |
| `teachingMedia.test.ts` | Foreign shapes named; no mood-session pose claims a movement demo; the stage's refusal is enforced in source |
| `benefitClaims.test.ts` | Sensation vs claim; the outstanding count is pinned; no fabricated evidence |
| `practicePreferences.test.ts` | Round-trip; invalid values rejected; fallback order; every screen shares it |
| `quizPlan.test.ts` (extended) | Every goal × body × time lands on budget; holds never exceed twice the reviewed one; alternatives offered |

**End-to-end — `npx playwright test`.** New specs:

- `practice-session.spec.ts` — preflight disclosure, spec line, instruction
  mode, pose preview, prop-free swap actually changing the queue; player layout
  at 390×844, 320×568 and landscape (no overlap, nothing off-screen, no
  sideways scroll); the static-reference label with no `<video>` in the stage;
  a skipped-through session earning no credit and showing no zero breaths.
- `home-today.spec.ts` — one card with a real spec and one Start; the Start
  button naming the duration; a saved plan as the lead; change time and focus
  regenerating; preview without navigation; exactly three alternatives; the
  loading skeleton with no first-time flash; empty progress; the finished-day
  state; storage copy; the directory living on Practice; no overflow at four
  widths.
- `welcome-landing.spec.ts` — format disclosure; "no filmed instruction";
  sample route landing in the real preflight; representative sessions carrying
  derived figures; free vs not-built; the five practical FAQs; no fabricated
  social proof or credentials; the walkthrough muted and captioned; no overflow.
- `account-recovery.spec.ts` (extended) — a recovery-code reset must not mark
  the address verified.

**Manual inspection.** Desktop 1280×900 and 1920×1080; phone 390×844 and
320×568; landscape 844×390. Screenshots taken before and after the player fix.
All test data is synthetic; no user data was deleted and no secrets appear in
the repo.

**Not verified:** audio output (browser automation cannot confirm it — same
limitation as the original audit), and anything about the live Render
deployment.

---

## 3. Remaining issues and dependencies

**Needs reviewed media (cannot be fixed in code).**
205 of the 207 catalog poses have a generated clip that blends in another pose,
and none of the 207 has a reviewed movement demonstration. The product now says
so rather than showing a different body, but a still is not a demonstration.
`missingDemoManifest()` names what has to be produced per pose and level, and
`docs/pose-demo-production.md` describes the pipeline. `REVIEWED_MOVEMENT_DEMOS`
must stay empty until a named reviewer has watched real footage.

**Needs a qualified reviewer.**
85 benefit lines across 72 poses name a condition or a mechanism
(`docs/benefit-claim-review.md`). Each needs keeping, rewording or removing.
Until then the pose page carries a caveat. Nothing in the code should be changed
to make these look evidenced.

**Needs deployment configuration.**
Email delivery — see §4. Until it is set, accounts are recoverable only by the
one-time recovery code shown at signup, which is the designed fallback, not a
bug.

**Known limits left explicit rather than fixed.**
- Offline practice is an image cache; narration streams and is not downloaded.
  Real offline practice needs an audio caching strategy and a per-session
  manifest.
- The virtual instructor remains a five-pose pilot and says so.
- Human teachers are a waitlist. No teacher is bookable and none is named.
- Paid plans are a waitlist and cannot be charged.
- Session intensity is a heuristic over category, difficulty, strong stretch
  zones and hold time. It is honest about being derived, but it is not a
  clinical grading and should not be presented as one.
- Equipment is inferred from instruction text against a closed vocabulary. It
  is right on every case I checked, but a reworded step could change an answer;
  the tests pin the cases that matter.

**Not done.**
- No deployment (your call).
- Social sign-in (audit item 6 from the September 20 list) — still
  email/password only.
- The live site has not been re-audited against these changes.

---

## 4. Required environment configuration

Everything works without these; each one turns something on.

| Variable | Needed for | Notes |
| --- | --- | --- |
| `RESEND_API_KEY` **or** `EMAIL_WEBHOOK_URL` | Emailed verification and password reset | Either one flips `emailDeliveryConfigured()`. Without both, signup mints a one-time recovery code and signs the user in. |
| `EMAIL_FROM` | Both of the above | e.g. `Sadhana <no-reply@your-domain>`. With Resend the domain must be verified there first. |
| `PUBLIC_APP_URL` | Links inside those emails; OG/canonical tags; `/robots.txt` | Must be a real custom domain, not `*.onrender.com`. |
| `DATABASE_URL` | Persistence across restarts, account sync | Without it the server runs on an in-memory store that resets on restart. |
| `SESSION_SECRET` / `DEVICE_ID_SECRET` | Stable signed guest device cookies | Guests lose their practice on restart without a stable secret. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web push surviving a restart | Ephemeral keys are generated when unset. |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | Error monitoring | Optional. |

`docs/account-recovery-config.md` has both recovery paths, the failure/abuse
matrix, and how to confirm mail is really being delivered — the server logs
`[auth] password reset for user N via resend|webhook|log`, and `via log` means
nothing was sent. **Do not state that email works until that line says
`resend` or `webhook` on the target deployment.**

---

## 5. Release checklist

1. `npm run check` — clean.
2. `npm test` — 660 passing.
3. `npx playwright test` — full suite green against a local `npm run dev`.
4. Set `PUBLIC_APP_URL` to the real domain; confirm `/robots.txt` and the
   canonical tag pick it up.
5. Set `DATABASE_URL`, `SESSION_SECRET` and `DEVICE_ID_SECRET`, or accept that
   practice resets on restart.
6. Decide on email: set `RESEND_API_KEY` (or `EMAIL_WEBHOOK_URL`) + `EMAIL_FROM`,
   or ship with recovery codes and leave the Reset screen as it is. Both are
   honest; only one requires DNS.
7. If email is on, confirm delivery with §4's check before telling anyone it
   works, then re-run `e2e/account-recovery.spec.ts` against a no-email
   environment so the fallback stays covered.
8. Move off the Render free tier, or expect a 30–50s cold start on the first
   visit of the day.
9. Smoke on a real phone: Today → Start → preflight shows props → Begin → pose
   name, timer and controls all visible → exit early → no credit.
10. Confirm `REVIEWED_MOVEMENT_DEMOS` is still empty and
    `instructorMediaManifest` rows are still `missing`. If either changed, a
    piece of media is being presented as reviewed instruction — find out by whom.
