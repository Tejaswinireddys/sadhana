# Artlist instructor video production pack

This pack prepares short visual assets for the instructor player. It does not
claim that generated footage is a real teacher or medically reviewed yoga
instruction. An actual qualified teacher must validate every movement and cue;
the app's instructor manifest remains `missing` until the footage completes
content review and playback QA.

## Production settings

- Generate landscape 16:9 at the model's highest native resolution (choose
  native 4K when the selected Artlist model offers it). Keep a 4K master and
  export delivery encodes for the existing Bunny Stream pipeline.
- Create each pose, side, and camera angle as a separate generation. If the
  model offers multi-shot output, use the shot sequence below as the connected
  sequence; otherwise generate the shots separately and edit them together.
- Keep one adult instructor, outfit, mat, light direction, and studio across
  takes. Use warm terracotta, deep teal, sunlit cream, and natural wood as the
  visual palette. The body and alignment must remain easy to read.
- Use energetic camera motion only for establishing and transition shots.
  Lock the camera for entry, alignment, and held-pose instruction. Do not use
  speed ramps, cuts, or camera moves that conceal a joint or foot placement.
- Generate clean footage without titles, labels, logos, captions, or spoken
  audio. Add reviewed narration and captions separately in the player.
- Inspect anatomy, pose identity, props, left/right, continuity, and every cut
  at full resolution. Reject malformed hands/feet, changing limbs, drifting
  props, invented transitions, or frames that contradict the authored cues.

## Reusable visual prompt

> A calm, experienced adult yoga instructor demonstrates **[POSE AND VARIANT]**
> in a bright, uncluttered contemporary yoga studio. Full body and the entire
> mat stay in frame. Photorealistic live-action appearance, natural human
> proportions, realistic balance and contact with the floor, consistent
> clothing and set, warm daylight, rich terracotta and deep teal accents,
> premium cinematic color, crisp 4K detail. The instructor moves slowly and
> continuously at an accessible teaching pace. Preserve the exact pose shape
> and the listed alignment: **[REVIEWED ALIGNMENT NOTES]**. Show no extra limbs,
> no shape morphing, no floating body parts, no props unless listed, no
> text/graphics, no camera crossing the body, no abrupt jump into the pose.

## Shot sequence for a single lesson

1. **Prepare (3–5 seconds):** medium-wide three-quarter view; instructor
   arranges the mat and any required props, then starts in the documented
   neutral position. A subtle dolly-in is okay while the whole body remains
   visible.
2. **Enter (8–12 seconds):** uninterrupted, locked side or front view chosen
   for the pose. Show the full transition from neutral to the final shape at a
   slow, teachable pace. Keep the relevant contact points in frame.
3. **Hold (8–12 seconds):** stable framing and a natural breath. Include a
   modest push-in only if it does not crop alignment landmarks. For dynamic
   practices, show complete, even repetitions with a neutral reset.
4. **Exit (5–8 seconds):** uninterrupted, locked view of the safe return to
   neutral. End ready for the next practice step; do not invent a transition.
5. **Optional variation (separate asset):** repeat the whole sequence for a
   specific reviewed modification. Do not morph the base pose into a different
   shape mid-shot.

## Pilot prompts

Use the common visual prompt and sequence above, filling in these details.
Create left/right versions as separate takes where specified.

### Mountain Pose — Tadasana

- **Camera:** front for the full lesson; separate side-angle take for stacked
  posture review.
- **Alignment:** feet grounded and parallel, knees soft, pelvis neutral, ribs
  stacked over pelvis, shoulders relaxed, arms by sides. No exaggerated chest
  lift or locked knees.
- **Variation:** separate wall-supported take; show gentle contact of the
  back and shoulder blades with the wall.

### Child's Pose — Balasana

- **Camera:** low side angle, wide enough to keep feet, hips, torso, forehead,
  and hands visible through the whole fold.
- **Alignment:** begin kneeling, walk hands forward, fold between thighs, and
  lower forehead. Show one continuous descent and an unhurried return with
  head rising last.
- **Supported variation:** separate take only; bolster lengthwise under chest
  and head, blanket behind knees. Show prop placement before entering.

### Cat–Cow — Marjaryasana–Bitilasana

- **Camera:** locked side view; keep shoulders, pelvis, hands, and knees in
  frame.
- **Movement:** begin in tabletop with wrists below shoulders and knees below
  hips. Show at least six even inhale-to-Cow / exhale-to-Cat cycles; each cycle
  returns through a clear neutral tabletop. Keep neck movement gentle.
- **Adaptation:** fists or forearms are separate, clearly labelled assets; do
  not substitute a different pose.

### Warrior II — Virabhadrasana II

- **Camera:** full-body front and side takes; record left and right sides
  separately, never mirror in post.
- **Movement:** start standing, step back into a wide stance, turn feet, bend
  the front knee over the ankle, extend arms, and turn gaze over the front
  hand. Hold without changing stance; reverse the entry calmly to exit.
- **Alignment:** torso upright, front knee tracks toward the middle toes, back
  foot grounded. Keep both feet and both hands visible throughout.
- **Variation:** a shorter stance or reviewed block support gets its own take;
  show the block being placed.

## Handoff into the app

Export each approved segment with stable framing and no baked-in text. Upload
through the existing stream/CDN workflow. Record the Artlist model and prompt
version, generation date, rights terms, source URL, clip duration, and phase
timecodes. Then have a qualified yoga teacher complete content review and QA
each side, caption, seek, pause, and transition. Only the named human reviewer
may promote an asset in `client/src/data/instructorMediaManifest.ts` to
`published`; generated visuals alone never unlock the teaching label.
