# Illustrations that need re-drawing

Generated from `client/src/data/poseImageAccuracy.ts`. Reviewed 2026-09-23.

These are **not** missing assets. Each pose ships an illustration; each of these
illustrations shows a different shape from the one the pose's own `steps`
describe. Until they are replaced, the product shows the existing art with the
difference stated — on the preparation screen, on the demonstration itself, and
in the alt text — rather than presenting it as an accurate depiction.

## Why this is separate from `pose-demo-production.md`

That document is about *motion*: the generated `/videos/poses/*` clips are
montages of stills, and 205 of them open on a different pose. This one is about
*stills that are the wrong shape*. A reviewed video of the wrong pose would not
fix these; a corrected illustration would.

## The briefs

### `pose-illustration/salamba-balasana/bolster-lengthwise`

**Pose:** Supported Child's Pose (`salamba-balasana`)

**Current illustration shows:** kneeling and folded forward with a small round
cushion under the chest, arms stretched along the floor, forehead low.

**The steps ask for:** a bolster or stack of pillows placed *lengthwise between
the knees*; the whole torso resting along that support; one cheek resting on it;
arms wrapping the bolster or resting alongside it.

**Why the difference matters:** the supported version exists so the chest and
head are carried by the prop and the practitioner can stay for two to five
minutes. Copying the current picture gives an unsupported fold, which is a
different pose with a different point — and one that many of the people this
session is recommended to ("I'm tired", "I'm anxious") cannot hold comfortably.

### `pose-illustration/chair-viparita-karani/calves-on-seat`

**Pose:** Legs on a Chair (`chair-viparita-karani`)

**Current illustration shows:** lying on the back with both legs extended
straight up past the back of a chair, hips on the floor.

**The steps ask for:** calves resting along the chair seat, knees bent roughly
above the hips, thighs vertical.

**Why the difference matters:** the whole reason this variation exists is that
it is gentler than legs-up-the-wall — the chair takes the weight of the lower
leg and the hamstrings are not lengthened at all. The drawn version is closer to
the pose it is supposed to be an alternative *to*.

## Specification for both

Match the existing catalog style exactly: 600×1200 portrait, watercolour on the
warm neutral ground, same figure proportions and palette as the rest of
`client/public/poses/`, props drawn in the same muted green/cream as the
existing bolsters and blankets.

## When one lands

1. Replace `client/public/poses/<slug>.png` and regenerate the WebP
   (`npm run gen:pose-webp`).
2. Update `POSE_IMAGE_ALT[<slug>]` to describe the new drawing.
3. Delete the entry from `POSE_IMAGE_MISMATCHES`.
4. `client/src/data/poseImageAccuracy.test.ts` pins the list, so it will fail
   until its expectation is updated too — which is the point: the list cannot
   shrink by accident.
