# Sadhana end-user fix list — September 20, 2026

Tested: September 20, 2026 (America/New_York)

Site: https://sadhana-ou9m.onrender.com/

## Scope and limits

Manual first-time guest walkthrough on desktop. No account was created. No payment, camera, microphone, push, or real password-reset email delivery was completed. Audio output could not be verified through browser automation; narration controls and live captions were exercised. This is a usability and product-gap review, not a security or clinical review of yoga content.

## What worked well

- Landing / welcome loaded promptly (no cold-start wait observed) with a clear product story and an obvious **Get my plan** CTA.
- Trust copy is strong for a first visit: no email wall, no streak shame, account optional.
- Five-question quiz produced **Your Calm Reset** (7 guided poses · 12 min) and a clear start action.
- Guest path via **Explore the app first** reached a usable home without forcing signup.
- Guided player showed pose illustration, timer, captions, and controls for pause, skip, mute, pace, repeat, and exit.
- Exiting before completion clearly warned the session would not count toward a streak.
- Progress empty state and custom-practice empty state were understandable.
- Poses has Filter / Favorites; global search exists in the shell.

## Prioritized fix list

P1 = blocks trust or account recovery. P2 = clear usability or reliability defect. P3 = polish or discoverability.

### 1. Password reset email is not configured — P1

**Pages:** `/account` (or Sign in → **Reset**)

**What a user sees:** Reset tab states that email delivery is not configured on this server, so a reset code cannot be sent. The primary action is disabled and labeled **Email is unavailable.**

**Why it matters:** Anyone who creates an email/password account and later forgets the password cannot recover access. That is a hard trust break for an optional-account product that still invites signup.

**Suggested direction:** Configure transactional email for reset codes in the deployed environment, or hide Reset until it works and point users to a working recovery path. Keep the failure message honest if email is down.

**Acceptance check:** Entering a known account email on Reset sends a code (or magic link); the user can set a new password and sign in. If email is intentionally unavailable in an environment, Reset is not offered as a working action.

### 2. Today / home overflows horizontally on desktop — P2

**Pages:** `/` (Today)

**What a user sees:** A horizontal scrollbar at the bottom of the viewport; content carousels extend past the page width.

**Why it matters:** First home after onboarding looks unfinished even when the practice recommendation is good.

**Suggested direction:** Constrain carousels and hero layout to the content column (`overflow-x` / max-width), and verify at ~1280px and wider desktop widths.

**Acceptance check:** Today at desktop width has no horizontal page scrollbar; all cards remain reachable without sideways page scroll.

### 3. Pathways pose thumbnails 404 in the network log — P2

**Pages:** Practice → Pathways (warm-up / quick-flow cards)

**What a user sees:** Cards still show images, but the session produced six 404 responses for pose thumbnail URLs. Failure is mostly silent.

**Why it matters:** Broken asset URLs will surface as missing images on slower networks or when fallbacks change. Silent 404s also hide a packaging or path bug.

**Suggested direction:** Trace the six failing URLs to the asset map / CDN path, fix the sources or fallbacks, and fail closed to a known placeholder rather than a 404.

**Acceptance check:** Loading Pathways produces no pose-thumbnail 404s; every warm-up / quick-flow card still shows a correct image.

### 4. Secondary sections are hard to find from primary nav — P2

**Pages:** App shell nav vs Home scroll

**What a user sees:** Primary nav exposes only **Today**, **Practice**, **Poses**, **Progress**, and **You**. **Kids**, **Breathing**, **Pathways**, and **Challenges** are reached by scrolling a long Home or via deeper Practice routes.

**Why it matters:** A parent looking for kids yoga, or someone looking for breathing, may never discover those surfaces.

**Suggested direction:** Surface Kids and Breathing in nav, Practice sub-nav, or search results with clear labels; keep Home focused on the next recommended practice.

**Acceptance check:** A new guest can open Kids and Breathing in two taps or fewer from Home without reading the full Home scroll.

### 5. Health / privacy notice interrupts the live player — P2

**Pages:** Guided session player

**What a user sees:** A health/privacy notice appeared while the player was open and could not be dismissed until leaving the session.

**Why it matters:** Interrupting an active practice breaks focus and makes the app feel unsafe to start mid-session.

**Suggested direction:** Show the notice before Start (or once, on first visit), not over an in-progress player. Dismissal must return to the same player state.

**Acceptance check:** Starting a guided session never overlays an undismissable legal notice mid-pose; any required notice is acknowledged before playback begins.

### 6. Account options are email/password only — P3

**Pages:** Sign in / Create

**What a user sees:** No Google / Apple (or other) social sign-in. Reset depends on email delivery (currently broken).

**Why it matters:** Wellness users often refuse another password, especially when recovery is unreliable.

**Suggested direction:** Add at least one social provider after reset email works, or keep accounts optional and make guest backup clearer.

**Acceptance check:** Users can create or recover access without a dead-end password path; social login is optional but if advertised, it completes end-to-end.

### 7. No prominent in-app Help when something fails — P3

**Pages:** Account / Reset and shell footer

**What a user sees:** About, Privacy, Terms, Cancel, Health exist; there is no clear Help / FAQ / “something’s wrong” path when Reset fails.

**Why it matters:** The Reset failure already tells users to contact whoever runs the deploy or email privacy@sadhana.app; a Help entry would make that discoverable before failure.

**Suggested direction:** Add a short Help page (reset, guest vs account, kids gate, how streaks work) linked from You / Settings and from error states.

**Acceptance check:** From Reset’s failure state, one tap reaches a Help article that explains recovery options.

### 8. Player illustration letterboxes on desktop — P3

**Pages:** Guided player

**What a user sees:** Pose illustration sits in a narrow column with black side bars on desktop.

**Why it matters:** Reduces polish for the core experience after a strong onboarding.

**Suggested direction:** Use a desktop layout that fills the available practice area without cropping critical pose cues, or use a soft background instead of hard black bars.

**Acceptance check:** On a ~1280px desktop, the player illustration does not show large empty black side bars.

### 9. Challenges guest buddy code lacks privacy explanation — P3

**Pages:** Challenges

**What a user sees:** A guest buddy code is shown without a plain explanation of what another person can see.

**Why it matters:** Sharing codes without scope/privacy copy creates hesitation, especially for guests.

**Suggested direction:** Add one sentence: what the code shares, what it does not, and how to stop sharing.

**Acceptance check:** Next to the buddy code, a guest can read what others can see before copying it.

### 10. Kids gate is appropriate but heavy on first visit — P3

**Pages:** Kids entry

**What a user sees:** Grown-up math gate plus press-and-hold entry.

**Why it matters:** Protects kids content, but stacks two frictions before a parent can preview the section.

**Suggested direction:** Keep the gate; consider remembering a short local “adult verified” window so returning parents are not blocked every visit in the same browser.

**Acceptance check:** First entry still requires an adult check; a second visit in the same browser within a short window does not re-ask both steps unless cleared.

## Suggested build order

1. Wire password-reset email (or remove Reset until it works).
2. Fix Today horizontal overflow.
3. Fix Pathways thumbnail 404s.
4. Make Kids / Breathing discoverable without a long Home scroll.
5. Move the health/privacy notice out of the live player.
6. Then P3 polish: Help, social login, player letterboxing, buddy-code copy, Kids gate memory.

## Relation to earlier reports

Older guest audits (for example September 3–13, 2026) already flagged onboarding/home consistency, instructor waitlist gaps, and internal copy leaking into customer flows. This September 20 pass focuses on a clean first-time guest path and the account-recovery / discoverability issues above; it does not claim those earlier items are all resolved.
