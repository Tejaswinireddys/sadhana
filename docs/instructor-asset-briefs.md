# Asset production briefs — instructor pilot

One brief per pilot pose. These are shooting instructions: hand them to a
studio or a rigger as-is. Manifest rows for every deliverable already exist in
`client/src/data/instructorMediaManifest.ts` (all at `missing`), so producing
an asset is a matter of filling a row in, not inventing a shape for it.

Review requirements for every clip are in
[`instructor-content-workflow.md`](./instructor-content-workflow.md).

## House style — applies to every clip

**Instructor.** One performer for the whole pilot. Same person, same hair
styling, no jewellery that swings. If the pilot cannot be shot in one block,
record wardrobe and lighting settings for continuity.

**Wardrobe.** Fitted, matte, mid-tone clothing that contrasts with the
background. Bare feet. Nothing that obscures the knee, elbow or hip line —
loose trousers make alignment unreadable, which defeats the point.

**Background.** Seamless, neutral, no props or furniture except the equipment
the brief calls for. No text, no logos, no windows.

**Lighting.** Soft key at 45°, fill to keep the shadow side readable, no hard
shadow across the mat. Constant across all clips — a relit second session will
not cut against the first.

**Camera.** Locked off on a tripod. No zoom, no pan, no handheld, no rack
focus. 1080p minimum, 30fps or higher, shutter appropriate to frame rate.

- **Front** — camera square to the mat's long edge, lens at the performer's
  mid-torso height in the held shape.
- **Side** — 90° from front, same height, same distance.

**Framing.** Full body including hands, feet, and every prop, with headroom
above the highest reach and floor visible below the lowest contact point. Frame
for the *largest* moment of the sequence, not the held shape. Nothing that
matters may leave frame at any point.

**Performance.** Enter at teaching speed — slower than a practice pace, fast
enough to look natural. Hold still and breathing. Exit with the same control as
entry. No talking, no counting on camera; narration is recorded separately.

**Per clip, one continuous take covering:** preparation (in the starting
position with props set) → entry → hold → exit → return to the starting
position. Phase boundaries are logged as timecodes and become the manifest's
`segments` array.

**Delivery.** Master file plus timecode log per clip. Audio is not used from
set. Performer release with full buy-out for every clip.

---

## 1. Mountain Pose — Tadasana (`pilot-tadasana`)

**Sides:** one (symmetrical). **Props:** none for the full pose; a wall for the
supported version.

| Deliverable | Manifest id |
| --- | --- |
| Full pose, front | `filmed-instructor/tadasana/front` |
| Full pose, side | `filmed-instructor/tadasana/side` |
| Supported variation, front | `filmed-instructor/tadasana/beginner-front` |
| Wall-supported adaptation, front | `filmed-instructor/tadasana/wall-supported` |

**Starting position.** Standing at the front of the mat, feet hip-width, arms
by the sides, weight even.

**Movement sequence.** Spread the toes and settle the weight through the whole
foot · lift the arches without gripping · lengthen up through the crown ·
release the shoulders down the back · let the arms hang with the palms turning
slightly forward · steady the gaze.

**Entry.** ~8s, gradual — this is a pose of small adjustments, so the camera has
to catch the settling, not a jump into a finished shape.

**Hold.** 20s still, breathing visibly.

**Exit.** ~5s. Soften the knees, release the lift, return to a neutral stand.

**Supported variation.** Back against a wall, heels a few inches out, shoulder
blades and back of the head in light contact. The wall must be visible in
frame. Show the contact points clearly in the side view of the adaptation.

**Side view matters most here** — the pilot's alignment cues are about stacking,
which the front view cannot show.

---

## 2. Child's Pose — Balasana (`pilot-balasana`)

**Sides:** one. **Props:** bolster and blanket for the supported version.

| Deliverable | Manifest id |
| --- | --- |
| Full pose, front | `filmed-instructor/balasana/front` |
| Full pose, side | `filmed-instructor/balasana/side` |
| Supported variation, front | `filmed-instructor/balasana/beginner-front` |
| Knee-supported adaptation, front | `filmed-instructor/balasana/knee-supported` |

**Starting position.** Kneeling, sitting back on the heels, hands on the thighs.

**Movement sequence.** Bring the big toes together and widen the knees · walk
the hands forward · lower the torso between the thighs · settle the hips back
toward the heels · rest the forehead on the mat · let the arms extend or bring
them alongside the body.

**Entry.** ~10s, one continuous fold. Do not cut between kneeling and folded —
the descent *is* the instruction.

**Hold.** 30s. Visible breath into the back of the ribs.

**Exit.** ~8s. Walk the hands back, stack the spine, return to kneeling. Head
comes up last.

**Supported variation.** Bolster lengthwise between the thighs supporting the
chest and head; blanket behind the knees. Show the props being positioned
during the preparation phase — where the bolster goes is most of the teaching.

**Framing note.** The folded shape is low and long. Frame wide enough that the
extended hands and the feet are both in shot in the side view.

---

## 3. Cat–Cow — Marjaryasana–Bitilasana (`pilot-marjaryasana-bitilasana`)

**Sides:** one. **Props:** blanket under the knees.

| Deliverable | Manifest id |
| --- | --- |
| Full pose, front | `filmed-instructor/marjaryasana-bitilasana/front` |
| Full pose, side | `filmed-instructor/marjaryasana-bitilasana/side` |
| Supported variation, front | `filmed-instructor/marjaryasana-bitilasana/beginner-front` |
| Fist/forearm adaptation, front | `filmed-instructor/marjaryasana-bitilasana/wrist-fist` |

**This pose is a repeating movement, not a held shape.** Its "hold" phase is
the repetition. Shoot at least six full Cat–Cow cycles at an even breath pace
so the player can loop the hold segment without a visible seam.

**Starting position.** Tabletop — wrists under shoulders, knees under hips,
spine neutral.

**Movement sequence.** Inhale to Cow: tilt the pelvis, let the belly lower,
draw the chest forward, lift the gaze without crushing the neck · Exhale to
Cat: tuck the tailbone, press the floor away, round the spine, release the
head. One cycle per full breath.

**Entry.** ~8s to set tabletop and find neutral.

**Hold (repetition).** 40s of even cycles. The first and last cycle must start
and end in neutral so the segment can loop cleanly.

**Exit.** ~6s. Return to neutral tabletop, then sit back toward the heels.

**Wrist adaptation.** Same sequence on closed fists (wrists straight) or on
forearms with elbows under shoulders. This is a *different shape* from the
base pose — the existing `dolphin-plank` presentation clip is not a substitute
and must never be labelled as one.

**Side view is the primary teaching angle** for spinal movement. Shoot it
first.

---

## 4. Warrior II — Virabhadrasana II (`pilot-virabhadrasana-ii`)

**Sides:** BOTH. Shoot left and right as separate full takes — do not mirror
in post. **Props:** block for the supported version.

| Deliverable | Manifest id |
| --- | --- |
| Full pose, front, left | `filmed-instructor/virabhadrasana-ii/front-left` |
| Full pose, side, left | `filmed-instructor/virabhadrasana-ii/side-left` |
| Full pose, front, right | `filmed-instructor/virabhadrasana-ii/front-right` |
| Full pose, side, right | `filmed-instructor/virabhadrasana-ii/side-right` |
| Supported variation, front, left | `filmed-instructor/virabhadrasana-ii/beginner-front-left` |
| Supported variation, front, right | `filmed-instructor/virabhadrasana-ii/beginner-front-right` |

**Starting position.** Standing at the top of the mat, feet together.

**Movement sequence (left side described; mirror the description for right).**
Step the left foot back into a wide stance · turn the left foot out ~90°,
right foot slightly in · bend the right knee toward stacking over the right
ankle · raise the arms parallel to the floor · turn the head over the right
hand · settle the shoulders down.

**Entry.** ~12s. The step back and the stance width are the part people get
wrong; shoot it unhurried and in full.

**Hold.** 25s. Front knee tracking over the ankle, back arm active, torso
upright rather than leaning over the front thigh.

**Exit.** ~8s. Straighten the front leg, lower the arms, turn the feet forward,
step the feet together.

**Supported variation.** Block under the front thigh, or a shorter stance with
a shallower knee bend. Show the block being placed.

**Critical:** the on-screen side must match the manifest's `side` field. The
player says "on the left side" — the footage has to agree, and a flipped clip
will contradict the narration.

---

## 5. Plank — Kumbhakasana (`pilot-kumbhakasana`)

**Sides:** one. **Props:** blanket under the knees for the modifications.

| Deliverable | Manifest id |
| --- | --- |
| Full pose, front | `filmed-instructor/kumbhakasana/front` |
| Full pose, side | `filmed-instructor/kumbhakasana/side` |
| Supported variation, front | `filmed-instructor/kumbhakasana/beginner-front` |
| Forearm adaptation, front | `filmed-instructor/kumbhakasana/wrist-forearm` |
| Knees-down pregnancy modification, front | `filmed-instructor/kumbhakasana/pregnancy-modify` |

**Starting position.** Tabletop.

**Movement sequence.** Set the hands under the shoulders, fingers spread ·
step one foot back, then the other · lengthen from the crown to the heels ·
draw the lower belly in so the hips neither sag nor pike · gaze slightly
forward of the hands, neck long.

**Entry.** ~10s, stepping back one foot at a time — not jumping back.

**Hold.** 20s. The hips must stay honest for the whole hold; reshoot rather
than publish a take that sags at the end.

**Exit.** ~8s. Knees down first, then sit back toward the heels.

**Supported variation.** Knees down on a blanket, same line from crown to
knees. The blanket is visible.

**Forearm adaptation (wrists).** Elbows under shoulders, forearms parallel or
hands clasped. Shot from the front *and* from a low side angle so the elbow
position is unambiguous.

**Pregnancy modification.** Knees down, shorter lever, shorter hold. This must
be performed and reviewed with appropriate prenatal expertise, or not shot at
all — a knees-down plank filmed by someone without that background is not a
prenatal modification.

**Side view is the primary teaching angle** — sagging and piking are invisible
from the front.

---

## Narration

Record separately, same voice for the whole pilot, in a treated room. One take
per phase per clip so timings can be adjusted without re-recording the pose.
Deliver with a cue-point list (`{t, text}`) aligned to the clip's phase
timecodes. Approved human narration replaces the current neural TTS; until it
exists the manifest's `narration.url` stays null and the player falls back to
the existing pose narration, labelled as such.
