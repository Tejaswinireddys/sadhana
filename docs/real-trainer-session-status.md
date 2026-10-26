# Real trainer sessions

The previous `HumanPoseTrainerMovie` warped a still illustration in canvas and
added a procedural stick figure. That is not footage of a trainer performing a
pose. The shared fallback now displays an explicitly labelled static reference
across lessons and practice, preserving withheld-image and accurate-alt rules.
No footage has been added or marked reviewed by this change.

The instructor stage now checks the source against its published manifest row,
requires complete preparation / entry / hold / exit coverage, rejects invalid
segment boundaries, and attaches HLS through the existing streaming helper.
Progressive MP4 and WebM remain supported. A source URL or a `showsMovement`
flag alone cannot turn an animation into a reviewed demonstration.

## What is still required for real trainer coverage

Supply recorded footage for each pose and taught variation, including both
sides where applicable, plus performer usage rights and the actual instructor's
review. Record continuous preparation, entry, hold and exit. Narration and
captions must describe the movement in that recording. Publish through the
existing CDN, then enter the actual segment timestamps and review details in
the media manifest according to `instructor-content-workflow.md`.

The instructor session currently covers the pilot catalog; the rest of the
catalog still needs recordings and integration into the lesson/player media
registry. Do not describe the whole app as filmed trainer sessions until that
coverage exists. The existing `missingDemoManifest` accepts a list of all
catalog slugs to enumerate pose/variation production requirements.
