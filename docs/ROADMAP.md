# Product roadmap

This is the gap between the web app and a complete yoga product. The pull
requests below are open for review. They are not on `main` until they are
merged. None of them invents a teacher, a clinical outcome, or a native
health sync.

Email delivery (SMTP or Resend, and a real `EMAIL_FROM`) is owner
configuration. It is not one of these changes.

## In review

| Pull request | What it adds |
| --- | --- |
| [#84](https://github.com/Tejaswinireddys/sadhana/pull/84) | When billing cannot charge, Subscribe is disabled and the page says Plus is coming soon. Everything free stays free. The Yearly control shows the configured price. |
| [#85](https://github.com/Tejaswinireddys/sadhana/pull/85) | Learn and Flow play a labeled AI trainer preview when one exists (Mountain Pose and the other pilot poses). Other poses stay a still, with copy that says it is not a movement demonstration. |
| [#86](https://github.com/Tejaswinireddys/sadhana/pull/86) | Practice generation and Today can leave out wrists, knees, lower back, pregnancy, inversions, and jumping, and can hide or prefer a pose. A generated session is refit so the requested length still holds. A chosen path stays that path. |
| [#87](https://github.com/Tejaswinireddys/sadhana/pull/87) | Dirga, Sama Vritti, and Sitali join the breath timer. Nadi Shodhana is a no-retention round. Kapalabhati and Bhastrika stay closed until experience is some or regular, with stop-immediately notes. |
| [#88](https://github.com/Tejaswinireddys/sadhana/pull/88) | Body scan, breath awareness, loving-kindness, a short and a long yoga nidra, and an unguided timer. Scripts are marked AI-written. Captions are on. Breath and meditation minutes are named in the weekly total. |
| [#89](https://github.com/Tejaswinireddys/sadhana/pull/89) | Gentle back care, plus who-should-skip and stop-if notes on the stress, chair, prenatal, and sleep weeks. Prenatal asks for the trimester and says to check with a provider. No week claims to treat a condition. |
| [#90](https://github.com/Tejaswinireddys/sadhana/pull/90) | Save the queued practice for offline: shell, pose images, and narration the server actually returns. The offline banner says a saved practice can still open. |
| [#91](https://github.com/Tejaswinireddys/sadhana/pull/91) | Reminders follow habit-plan days, so a rest day stays quiet. The weekly line and the streak treat planned rest days as rest, not as failure. Every session can be downloaded as CSV or JSON. |
| [#92](https://github.com/Tejaswinireddys/sadhana/pull/92) | One Eight Limbs card a day, with Devanagari, IAST, and a computer-voice guide that is labeled as such. Disputed translations are named. It is not a theology and not a claim of samādhi. |
| [#93](https://github.com/Tejaswinireddys/sadhana/pull/93) | Reduced motion and the in-app motion toggle cover every animation. Guided captions still start on, separate from the screen-reader announcements. |

## Needs more than code

### Native iOS and Android

The installable site is a PWA. App Store and Play policies, push on iOS
(which does not treat a browser the way Android does), offline media storage,
and a home-screen icon that survives browser cache clears all sit in a native
shell. A website cannot ship an Apple or Google binary, sign it, or keep a
background download the way those stores require.

### Apple Health and Health Connect

[#91](https://github.com/Tejaswinireddys/sadhana/pull/91) downloads sessions
as CSV and JSON so a person can keep them or import a file by hand. Writing
into Apple Health or Health Connect needs the platform APIs, which are only
available inside an iOS or Android app with the health entitlement and a
privacy disclosure those stores review. A browser origin cannot request that
access.

### Live classes and real teachers

A live class needs a person, a time, a camera, a consent and payment flow for
that person, and a decision about recording. The app can list a waitlist. It
cannot become a teacher, and it must not put a name on a class nobody taught.
Filmed instruction is the same kind of gap: a reviewed movement demo is still
empty on purpose until a person is filmed and a named reviewer signs it.

### Camera form feedback

The pose self-check can show a private camera mirror. Telling someone their
knee or back is "wrong" is a coaching judgment. Doing it from a camera needs
a model that has been tested on real bodies, a way to say when it is unsure,
and a reviewer who will own the mistakes. Shipping a score from an untested
model would be a fabricated correction.

### Teacher certification

A certificate is a credential from a school or a body that keeps records and
can stand behind them. The app can track hours a person practiced here. It
cannot decide that those hours meet a syllabus it does not run, and it cannot
sign a credential that implies a teacher examined the person.

### Multilingual human-led classes

Computer voices and translated captions can be added in software. A class
that is actually led in another language needs a teacher who speaks it, a
script they approve, and a recording or a live session. Machine translation
of a cue is not that class, and it should not be labeled as if it were.

### 1:1 clinics

A clinic is a person taking responsibility for one student: intake, a limit
on what they will advise, notes, and a way to follow up. Software can book a
slot and store a note. It cannot supply the clinician, their insurance, or
their judgment. The prenatal and back-care weeks say this in the product:
they are practices with stop-if notes, and they tell the reader to talk to
their own provider.
