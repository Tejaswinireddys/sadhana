// Per-asana difficulty variations, structured contraindications (avoidIf),
// and step-motion mappings. Merged into ASANAS at module load by content.ts.
//
// This keeps the large hand-authored content readable and separate from the
// core asana definitions.

import type { AvoidRow, Variations, StepMotionKey } from "./content";

export type AsanaExtras = {
  avoidIf: AvoidRow[];
  variations: Variations;
  stepMotions: StepMotionKey[]; // one per step, in order
};

export const EXTRAS: Record<string, AsanaExtras> = {
  tadasana: {
    avoidIf: [
      { condition: "Low blood pressure — rise slowly", severity: "caution" },
      { condition: "Dizziness or vertigo", severity: "caution" },
      { condition: "Difficulty standing — practice seated", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "Stand with feet hip-width apart and your back near a wall to feel alignment.",
        props: ["wall", "none"],
        cues: ["Feet hip-width for a wider base", "Press all four corners of the feet down", "Heels and shoulder blades lightly touch the wall"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Feet together, arms relaxed at the sides, finding stillness without support.",
        props: ["none"],
        cues: ["Big toes touching, heels slightly apart", "Lift the kneecaps and lengthen the tailbone", "Crown reaches up, shoulders soften down"],
        holdSeconds: 45,
      },
      advanced: {
        description: "Eyes closed, arms overhead, refining balance through subtle breath and micro-adjustments.",
        props: ["none"],
        cues: ["Close the eyes and feel the body sway and settle", "Reach the arms overhead, ribs knitting in", "Balance the weight evenly through both feet"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["ground", "ground", "settle", "inhale"],
  },

  vrksasana: {
    avoidIf: [
      { condition: "Recent ankle or knee injury", severity: "avoid" },
      { condition: "Migraine or severe low blood pressure", severity: "modify" },
      { condition: "Balance difficulty — use a wall", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Keep the toes of the lifted foot on the floor (kickstand) with the heel on the ankle, one hand on a wall.",
        props: ["wall", "none"],
        cues: ["Toes stay grounded for stability", "Hand rests lightly on a wall", "Fix the gaze on one still point"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Foot to the inner calf (avoiding the knee), hands at heart center.",
        props: ["none"],
        cues: ["Press foot and leg into each other", "Square the hips forward", "Lengthen the spine, hands at heart"],
        holdSeconds: 30,
      },
      advanced: {
        description: "Foot high on the inner thigh, arms branching overhead, eyes closed.",
        props: ["none"],
        cues: ["Sole presses high on the inner thigh", "Reach the arms up like branches", "Soften the gaze or close the eyes"],
        holdSeconds: 45,
      },
    },
    stepMotions: ["ground", "limb-rotate", "balance", "arm-extend", "balance"],
  },

  "virabhadrasana-ii": {
    avoidIf: [
      { condition: "Knee injury — mind front-knee tracking", severity: "modify" },
      { condition: "High blood pressure", severity: "caution" },
      { condition: "Diarrhea", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Shorten the stance and bend the front knee only partway; rest the back hand on the hip.",
        props: ["none"],
        cues: ["Shorter stance eases intensity", "Front knee tracks toward the small toe", "Back hand on hip if shoulders tire"],
        holdSeconds: 25,
      },
      intermediate: {
        description: "Wide stance, front thigh working toward parallel, arms reaching actively in both directions.",
        props: ["none"],
        cues: ["Front knee stacks over the ankle", "Reach actively through both arms", "Sink the hips, gaze over front fingertips"],
        holdSeconds: 40,
      },
      advanced: {
        description: "Front thigh parallel to the floor, deep and steady, holding with even ujjayi breath.",
        props: ["none"],
        cues: ["Front thigh fully parallel to the floor", "Draw the lower belly in and up", "Hold with slow, even breath"],
        holdSeconds: 55,
      },
    },
    stepMotions: ["hip-shift", "lift", "arm-extend", "balance", "settle"],
  },

  "virabhadrasana-i": {
    avoidIf: [
      { condition: "High blood pressure", severity: "modify" },
      { condition: "Shoulder issues — keep arms wider", severity: "modify" },
      { condition: "Heart conditions", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Lift the back heel and keep the hands on the hips to focus on a square pelvis.",
        props: ["none"],
        cues: ["Back heel lifts to ease the ankle", "Hands on hips to find square pelvis", "Shorten the stance if balance wavers"],
        holdSeconds: 25,
      },
      intermediate: {
        description: "Back heel grounded at 45°, arms sweeping overhead, hips facing forward.",
        props: ["none"],
        cues: ["Root the back heel firmly", "Sweep arms up, biceps by the ears", "Lift the chest, soften the front ribs"],
        holdSeconds: 40,
      },
      advanced: {
        description: "Deep front-knee bend with a gentle backbend through the upper spine, gazing up.",
        props: ["none"],
        cues: ["Front thigh toward parallel", "Lift the heart into a slight backbend", "Gaze up between the thumbs"],
        holdSeconds: 50,
      },
    },
    stepMotions: ["hip-shift", "lift", "arm-extend", "balance"],
  },

  trikonasana: {
    avoidIf: [
      { condition: "Low blood pressure", severity: "caution" },
      { condition: "Neck issues — don't turn the head up", severity: "modify" },
      { condition: "Headache", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Block at the inside of the front foot; the bottom hand rests on the block, not the floor.",
        props: ["block"],
        cues: ["Place a block inside the front shin/foot", "Bottom hand rests on the block", "Keep the chest open toward the ceiling"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Bottom hand to the shin or a low block, stacking the shoulders, top arm reaching up.",
        props: ["block", "none"],
        cues: ["Hand to shin or a low block", "Stack the top shoulder over the bottom", "Lengthen evenly through both waistlines"],
        holdSeconds: 40,
      },
      advanced: {
        description: "Bottom hand to the floor outside the foot, gaze up past the top thumb.",
        props: ["none"],
        cues: ["Bottom hand flat on the floor", "Open the chest fully toward the sky", "Turn the gaze up past the top hand"],
        holdSeconds: 50,
      },
    },
    stepMotions: ["arm-extend", "torso-fold", "arm-extend", "settle"],
  },

  utkatasana: {
    avoidIf: [
      { condition: "Knee pain", severity: "modify" },
      { condition: "Low blood pressure", severity: "caution" },
      { condition: "Insomnia", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Sit back only slightly with hands at heart center to protect the knees.",
        props: ["chair", "none"],
        cues: ["Sit back gently, weight in the heels", "Hands at heart to ease the shoulders", "Try hovering above a chair for feedback"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Sit hips back and down, arms sweeping overhead, navel drawing in.",
        props: ["none"],
        cues: ["Sit the hips back as if into a chair", "Sweep arms up alongside the ears", "Draw the lower ribs and navel in"],
        holdSeconds: 30,
      },
      advanced: {
        description: "Deep squat with thighs near parallel, heels grounded, holding with steady breath.",
        props: ["none"],
        cues: ["Sink the thighs toward parallel", "Keep the heels firmly down", "Lengthen the tailbone, lift the chest"],
        holdSeconds: 40,
      },
    },
    stepMotions: ["ground", "hip-shift", "arm-extend", "settle"],
  },

  "ardha-chandrasana": {
    avoidIf: [
      { condition: "Low blood pressure", severity: "caution" },
      { condition: "Headache or migraine", severity: "modify" },
      { condition: "Neck injury — keep gaze down", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "Bottom hand on a block, back against a wall, lifted leg resting at hip height.",
        props: ["block", "wall"],
        cues: ["Block under the bottom hand", "Practice with the back against a wall", "Lifted leg only to hip height"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Bottom hand on a block or fingertips, lifted leg parallel to the floor, chest open.",
        props: ["block", "none"],
        cues: ["Stack the hips and shoulders", "Flex the lifted foot, energize the leg", "Open the chest, top arm up"],
        holdSeconds: 25,
      },
      advanced: {
        description: "Bottom hand to the floor, gaze up to the top hand, balancing with a steady core.",
        props: ["none"],
        cues: ["Bottom hand floats to fingertips or floor", "Gaze up to the top hand", "Balance through a steady, lifted core"],
        holdSeconds: 30,
      },
    },
    stepMotions: ["torso-fold", "lift", "balance", "settle"],
  },

  sukhasana: {
    avoidIf: [
      { condition: "Knee injury — sit elevated", severity: "modify" },
      { condition: "Sciatica", severity: "modify" },
      { condition: "Tight hips — sit on a cushion", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Sit on a folded blanket or two so the hips are well above the knees; back near a wall.",
        props: ["bolster", "blanket", "wall"],
        cues: ["Elevate the hips generously", "Let the knees soften toward the floor", "Rest the back near a wall if needed"],
        holdSeconds: 60,
      },
      intermediate: {
        description: "Cross-legged on a cushion, spine tall, hands resting on the knees.",
        props: ["bolster", "none"],
        cues: ["Stack the spine over the pelvis", "Relax the shoulders down", "Soften the gaze and breathe slowly"],
        holdSeconds: 90,
      },
      advanced: {
        description: "Unsupported seat, refining stillness and long diaphragmatic breaths for meditation.",
        props: ["none"],
        cues: ["Sit tall without props if comfortable", "Lengthen each exhale", "Hold complete stillness"],
        holdSeconds: 180,
      },
    },
    stepMotions: ["settle", "lift", "ground", "inhale"],
  },

  padmasana: {
    avoidIf: [
      { condition: "Knee or ankle injury", severity: "avoid" },
      { condition: "Tight hips — use Half Lotus or Easy Seat", severity: "modify" },
      { condition: "Recent hip surgery", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Stay in Easy Seat or Half Lotus (one foot up) on a cushion — never force the knees.",
        props: ["bolster", "none"],
        cues: ["Easy Seat or Half Lotus only", "Elevate the hips on a cushion", "Open the hips first with Butterfly"],
        holdSeconds: 45,
      },
      intermediate: {
        description: "Half Lotus with one foot on the opposite thigh, spine tall.",
        props: ["bolster", "none"],
        cues: ["Place one foot on the opposite thigh", "Keep the knee heavy, not lifted", "Lengthen the spine and breathe"],
        holdSeconds: 60,
      },
      advanced: {
        description: "Full Lotus with both feet on the thighs, settling into long, still meditation.",
        props: ["none"],
        cues: ["Both feet rest on the thighs", "Soften the inner groins", "Rest in steady, even breath"],
        holdSeconds: 120,
      },
    },
    stepMotions: ["limb-rotate", "limb-rotate", "settle", "inhale"],
  },

  navasana: {
    avoidIf: [
      { condition: "Low back injury", severity: "avoid" },
      { condition: "Pregnancy", severity: "avoid" },
      { condition: "Recent abdominal surgery", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Knees bent with the hands holding the backs of the thighs, lifting the feet only an inch.",
        props: ["strap", "none"],
        cues: ["Hold behind the thighs for support", "Lift the chest, lengthen the spine", "Keep the feet low or toes touching"],
        holdSeconds: 15,
      },
      intermediate: {
        description: "Shins parallel to the floor, arms reaching forward, chest lifted.",
        props: ["none"],
        cues: ["Balance just behind the sit bones", "Shins parallel to the floor", "Reach the arms alongside the shins"],
        holdSeconds: 25,
      },
      advanced: {
        description: "Legs fully straight into a V, arms reaching, holding steadily without rounding.",
        props: ["none"],
        cues: ["Straighten the legs toward a V", "Lift the chest, avoid rounding the back", "Breathe steadily — do not hold the breath"],
        holdSeconds: 35,
      },
    },
    stepMotions: ["settle", "lift", "leg-extend", "arm-extend"],
  },

  "baddha-konasana": {
    avoidIf: [
      { condition: "Groin or knee injury", severity: "modify" },
      { condition: "Sciatica — sit elevated", severity: "modify" },
      { condition: "Recent hip surgery", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Sit on a cushion with blocks under both knees; stay upright rather than folding.",
        props: ["block", "bolster"],
        cues: ["Elevate the hips on a cushion", "Support each knee with a block", "Stay tall — no forward fold yet"],
        holdSeconds: 60,
      },
      intermediate: {
        description: "Soles together, hands holding the feet, gently easing the knees toward the floor.",
        props: ["none"],
        cues: ["Draw the heels toward the groin", "Let the knees soften with gravity", "Lengthen the spine on each inhale"],
        holdSeconds: 90,
      },
      advanced: {
        description: "Fold forward from the hips with a long spine, chest reaching toward the feet.",
        props: ["none"],
        cues: ["Hinge forward from the hips", "Keep the spine long, not rounded", "Relax the inner thighs and breathe"],
        holdSeconds: 120,
      },
    },
    stepMotions: ["settle", "ground", "torso-fold", "inhale"],
  },

  "eka-pada-rajakapotasana": {
    avoidIf: [
      { condition: "Knee injury", severity: "avoid" },
      { condition: "Sacroiliac issues", severity: "modify" },
      { condition: "Tight hips — use a prop under the hip", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Place a folded blanket or block under the front-leg hip and stay upright.",
        props: ["block", "bolster", "blanket"],
        cues: ["Support the front hip to keep the pelvis level", "Keep the front shin closer to parallel with the body", "Stay tall, hands by the hips"],
        holdSeconds: 45,
      },
      intermediate: {
        description: "Front shin angled across, hips squared, folding partway over the front leg.",
        props: ["block", "none"],
        cues: ["Square the hips forward", "Walk the hands forward to fold", "Soften deeper on each exhale"],
        holdSeconds: 60,
      },
      advanced: {
        description: "Front shin closer to parallel, full forehead-to-floor fold (or reach for the back foot).",
        props: ["none"],
        cues: ["Bring the front shin toward parallel", "Fold the forehead toward the floor", "Optionally bend the back knee and reach back"],
        holdSeconds: 90,
      },
    },
    stepMotions: ["hip-shift", "leg-extend", "settle", "torso-fold"],
  },

  anjaneyasana: {
    avoidIf: [
      { condition: "Knee sensitivity — pad the back knee", severity: "modify" },
      { condition: "High blood pressure — keep hands down", severity: "modify" },
      { condition: "Recent hip injury", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Cushion the back knee and keep the hands resting on the front thigh.",
        props: ["blanket", "none"],
        cues: ["Pad the back knee with a blanket", "Hands rest on the front thigh", "Sink the hips only as far as comfortable"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Sink the hips forward and sweep the arms overhead, opening the front body.",
        props: ["none"],
        cues: ["Stack the front knee over the ankle", "Sweep the arms up alongside the ears", "Draw the tailbone down, lift the chest"],
        holdSeconds: 45,
      },
      advanced: {
        description: "Add a gentle backbend, reaching the arms back; option to catch the back foot.",
        props: ["strap", "none"],
        cues: ["Lift the heart into a backbend", "Reach the fingertips back and up", "Optionally catch the back foot with a strap"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["hip-shift", "settle", "hip-shift", "arm-extend"],
  },

  "utthan-pristhasana": {
    avoidIf: [
      { condition: "Knee or hip injury", severity: "avoid" },
      { condition: "Recent groin strain", severity: "modify" },
      { condition: "Wrist sensitivity — use forearms on a block", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Stay tall on the hands with the back knee down on a blanket.",
        props: ["block", "blanket"],
        cues: ["Keep the back knee down and padded", "Stay up on the hands or fingertips", "Walk the front foot wide to the edge"],
        holdSeconds: 45,
      },
      intermediate: {
        description: "Lower onto the forearms or a block with the back knee lifted.",
        props: ["block", "none"],
        cues: ["Forearms to a block or the floor", "Lift the back knee, press the heel back", "Let the front hip sink and open"],
        holdSeconds: 60,
      },
      advanced: {
        description: "Forearms to the floor, back leg fully extended; option to twist or lift the front toes.",
        props: ["none"],
        cues: ["Forearms flat on the floor", "Straighten and energize the back leg", "Option: roll to the outer front foot to twist"],
        holdSeconds: 75,
      },
    },
    stepMotions: ["hip-shift", "torso-fold", "leg-extend", "inhale"],
  },

  uttanasana: {
    avoidIf: [
      { condition: "Low back injury — bend the knees", severity: "modify" },
      { condition: "High blood pressure", severity: "caution" },
      { condition: "Glaucoma or eye pressure", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Bend the knees generously and rest the hands on blocks or shins; a wedge under the heels eases the calves.",
        props: ["block", "none"],
        cues: ["Soften the knees as much as needed", "Hands rest on blocks or shins", "Let the head and neck hang heavy"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Lengthen the spine and fold from the hips with a soft knee bend, hands to the floor.",
        props: ["block", "none"],
        cues: ["Hinge from the hips, not the waist", "Lengthen the spine on each inhale", "Fingertips or palms toward the floor"],
        holdSeconds: 45,
      },
      advanced: {
        description: "Straight legs, chest drawing toward the thighs, hands flat beside or behind the feet.",
        props: ["none"],
        cues: ["Straighten the legs without locking", "Draw the chest toward the thighs", "Press the palms flat to the floor"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["torso-fold", "settle", "ground", "inhale"],
  },

  paschimottanasana: {
    avoidIf: [
      { condition: "Low back injury", severity: "modify" },
      { condition: "Sciatica — sit elevated, bend knees", severity: "modify" },
      { condition: "Asthma", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Sit on a cushion with bent knees and loop a strap around the feet.",
        props: ["strap", "bolster"],
        cues: ["Elevate the hips on a cushion", "Bend the knees as needed", "Loop a strap around the feet, spine tall"],
        holdSeconds: 45,
      },
      intermediate: {
        description: "Hinge from the hips with a long spine, holding the shins or feet.",
        props: ["strap", "none"],
        cues: ["Lead with the chest, not the head", "Hold the shins, feet, or a strap", "Keep the spine long, not rounded"],
        holdSeconds: 75,
      },
      advanced: {
        description: "Straight legs, chest folding toward the thighs, hands clasping beyond the feet.",
        props: ["none"],
        cues: ["Straighten the legs, flex the feet", "Fold the chest toward the thighs", "Clasp the hands beyond the feet"],
        holdSeconds: 120,
      },
    },
    stepMotions: ["settle", "inhale", "torso-fold", "settle"],
  },

  parsvottanasana: {
    avoidIf: [
      { condition: "High blood pressure", severity: "caution" },
      { condition: "Low back injury", severity: "modify" },
      { condition: "Hamstring tear", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Hands on blocks beside the front foot with a generous bend in the front knee.",
        props: ["block"],
        cues: ["Blocks under both hands", "Keep a soft bend in the front knee", "Draw the front hip back to square"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Hands on blocks or the floor, hinging over a straighter front leg with a long spine.",
        props: ["block", "none"],
        cues: ["Square the pelvis to the front", "Hinge from the hips, spine long", "Press the front thigh back"],
        holdSeconds: 40,
      },
      advanced: {
        description: "Reverse-prayer hands behind the back, folding fully over a straight front leg.",
        props: ["none"],
        cues: ["Take reverse prayer or clasp the elbows", "Straighten the front leg", "Fold the chest toward the shin"],
        holdSeconds: 50,
      },
    },
    stepMotions: ["hip-shift", "ground", "torso-fold", "hip-shift"],
  },

  bhujangasana: {
    avoidIf: [
      { condition: "Back injury", severity: "avoid" },
      { condition: "Pregnancy", severity: "avoid" },
      { condition: "Carpal tunnel syndrome", severity: "modify" },
      { condition: "Recent abdominal surgery", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Baby Cobra — keep the elbows bent and lift the chest only a few inches, hands light.",
        props: ["none"],
        cues: ["Lift only to mid-chest height", "Keep the elbows bent and hugging in", "Use the back, not the hands, to lift"],
        holdSeconds: 15,
      },
      intermediate: {
        description: "Press the hands lightly and lift the chest higher, shoulders drawing back and down.",
        props: ["none"],
        cues: ["Anchor the pubic bone and tops of the feet", "Draw the shoulders back and down", "Keep a slight bend in the elbows"],
        holdSeconds: 25,
      },
      advanced: {
        description: "Straighter arms into a deeper backbend, lengthening the front body, gaze gently up.",
        props: ["none"],
        cues: ["Straighten the arms as the back allows", "Lengthen the whole front body", "Keep the neck long, gaze softly up"],
        holdSeconds: 30,
      },
    },
    stepMotions: ["settle", "ground", "lift", "inhale"],
  },

  "setu-bandhasana": {
    avoidIf: [
      { condition: "Neck injury", severity: "avoid" },
      { condition: "Shoulder issues", severity: "modify" },
      { condition: "Late pregnancy", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Supported Bridge — rest the sacrum on a block for a passive, restorative version.",
        props: ["block"],
        cues: ["Slide a block under the sacrum", "Let the hips rest on the prop", "Relax and breathe into the chest"],
        holdSeconds: 60,
      },
      intermediate: {
        description: "Lift the hips actively, interlacing the hands beneath and rolling the shoulders under.",
        props: ["none"],
        cues: ["Press the feet down, lift the hips", "Interlace the hands, roll the shoulders under", "Keep the knees parallel"],
        holdSeconds: 45,
      },
      advanced: {
        description: "Lift higher and extend one leg toward the ceiling (one-legged bridge).",
        props: ["none"],
        cues: ["Lift the hips to their fullest", "Extend one leg up, hips level", "Press firmly through the standing foot"],
        holdSeconds: 30,
      },
    },
    stepMotions: ["settle", "lift", "ground", "inhale"],
  },

  ustrasana: {
    avoidIf: [
      { condition: "Neck or low back injury", severity: "avoid" },
      { condition: "High or low blood pressure", severity: "caution" },
      { condition: "Migraine", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "Hands stay on the low back, toes tucked to raise the heels, gentle lift of the chest.",
        props: ["none"],
        cues: ["Tuck the toes to bring the heels higher", "Keep the hands on the low back", "Lift the chest, hips press forward"],
        holdSeconds: 15,
      },
      intermediate: {
        description: "Reach one or both hands toward the heels, keeping the hips over the knees.",
        props: ["none"],
        cues: ["Press the hips forward over the knees", "Reach the hands toward the heels", "Lengthen the neck, breath steady"],
        holdSeconds: 25,
      },
      advanced: {
        description: "Both hands to the heels with feet flat, full chest and throat opening.",
        props: ["none"],
        cues: ["Hands to flat heels", "Open the chest fully to the sky", "Let the head release gently back"],
        holdSeconds: 30,
      },
    },
    stepMotions: ["settle", "lift", "limb-rotate", "inhale"],
  },

  "urdhva-dhanurasana": {
    avoidIf: [
      { condition: "Back, wrist, or shoulder injury", severity: "avoid" },
      { condition: "High or low blood pressure", severity: "avoid" },
      { condition: "Heart conditions", severity: "avoid" },
      { condition: "Pregnancy", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Practice Bridge Pose instead, or press only to the crown of the head and pause.",
        props: ["block", "none"],
        cues: ["Build with Bridge Pose first", "Press up to the crown and hold", "Keep the elbows hugging in"],
        holdSeconds: 10,
      },
      intermediate: {
        description: "Press all the way up onto straight arms, walking the feet slightly in.",
        props: ["none"],
        cues: ["Press evenly through hands and feet", "Straighten the arms, open the chest", "Walk the feet toward the hands"],
        holdSeconds: 15,
      },
      advanced: {
        description: "Deepen the arch, walking hands and feet closer and lifting onto the toes.",
        props: ["none"],
        cues: ["Walk the hands and feet closer", "Lift the hips higher, shins forward", "Breathe smoothly in the full expression"],
        holdSeconds: 20,
      },
    },
    stepMotions: ["settle", "ground", "lift", "arm-extend"],
  },

  sirsasana: {
    avoidIf: [
      { condition: "High blood pressure", severity: "avoid" },
      { condition: "Glaucoma or eye pressure", severity: "avoid" },
      { condition: "Neck injury", severity: "avoid" },
      { condition: "Pregnancy (after 1st trimester)", severity: "modify" },
      { condition: "First time practicing — use a wall", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Build strength in Dolphin Pose, or practice the headstand setup with the feet staying down.",
        props: ["wall"],
        cues: ["Strengthen with Dolphin first", "Keep the crown light, weight in the forearms", "Stay near a wall and keep the feet down"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Float the legs up against a wall, stacking the hips over the shoulders.",
        props: ["wall"],
        cues: ["Walk the feet in, then float up", "Stack hips over shoulders over elbows", "Press firmly through the forearms"],
        holdSeconds: 30,
      },
      advanced: {
        description: "Balanced headstand away from the wall, engaging the core, holding with even breath.",
        props: ["none"],
        cues: ["Balance away from the wall", "Engage the core, legs reaching up", "Keep minimal weight on the head"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["settle", "ground", "lift", "balance"],
  },

  "adho-mukha-svanasana": {
    avoidIf: [
      { condition: "Wrist injury / carpal tunnel", severity: "modify" },
      { condition: "High blood pressure", severity: "caution" },
      { condition: "Late pregnancy", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "Bend the knees generously, lift the heels, and use blocks under the hands.",
        props: ["block", "none"],
        cues: ["Keep the knees bent and heels lifted", "Lengthen the spine before the legs", "Spread the fingers, press the floor away"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Straighten the legs as comfortable into an inverted V, heels reaching down.",
        props: ["none"],
        cues: ["Form a long, even inverted V", "Draw the heels toward the floor", "Relax the neck between the arms"],
        holdSeconds: 45,
      },
      advanced: {
        description: "Heels grounded, full length through the spine, holding with deep ujjayi breath.",
        props: ["none"],
        cues: ["Ground the heels fully", "Externally rotate the upper arms", "Hold with long, steady breath"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["hip-shift", "leg-extend", "arm-extend", "settle"],
  },

  "viparita-karani": {
    avoidIf: [
      { condition: "Glaucoma or eye pressure", severity: "avoid" },
      { condition: "Serious back or neck issues", severity: "modify" },
      { condition: "Late pregnancy", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Legs up the wall with no prop, arms resting open — purely restful.",
        props: ["wall"],
        cues: ["Hips a few inches from the wall", "Arms rest open, palms up", "Let the legs be completely passive"],
        holdSeconds: 120,
      },
      intermediate: {
        description: "Place a folded blanket or bolster under the hips for a gentle inversion.",
        props: ["wall", "bolster", "blanket"],
        cues: ["Bolster under the sacrum", "Hips slightly higher than the heart", "Breathe slow and natural"],
        holdSeconds: 180,
      },
      advanced: {
        description: "Longer hold with a bolster, drawing awareness to a soft, even breath and stillness.",
        props: ["wall", "bolster"],
        cues: ["Settle for a longer restorative hold", "Soften the face and jaw", "Let the body grow heavy and still"],
        holdSeconds: 300,
      },
    },
    stepMotions: ["settle", "lift", "settle", "inhale"],
  },

  balasana: {
    avoidIf: [
      { condition: "Knee injury", severity: "modify" },
      { condition: "Pregnancy — widen the knees", severity: "modify" },
      { condition: "Recent ankle injury", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Knees together or wide with a bolster under the torso and a blanket under the ankles.",
        props: ["bolster", "blanket"],
        cues: ["Rest the torso on a bolster", "Pad under the ankles if they're tight", "Forehead supported, fully relax"],
        holdSeconds: 60,
      },
      intermediate: {
        description: "Knees wide, hips toward the heels, arms extended forward, forehead down.",
        props: ["block", "none"],
        cues: ["Take the knees wide, big toes touching", "Sink the hips toward the heels", "Extend the arms, forehead to the floor"],
        holdSeconds: 90,
      },
      advanced: {
        description: "Deepen the fold with the hips fully on the heels, arms reaching long, breath into the back ribs.",
        props: ["none"],
        cues: ["Hips settle onto the heels", "Reach the arms long and active", "Breathe into the back of the ribs"],
        holdSeconds: 120,
      },
    },
    stepMotions: ["settle", "torso-fold", "arm-extend", "inhale"],
  },

  savasana: {
    avoidIf: [
      { condition: "Late pregnancy — lie on the side", severity: "modify" },
      { condition: "Low back discomfort — bend the knees", severity: "modify" },
      { condition: "Acid reflux — slightly elevate the chest", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Bolster under the knees and a blanket over the body for warmth and full support.",
        props: ["bolster", "blanket"],
        cues: ["Bolster under the knees eases the back", "Cover the body to stay warm", "Let the feet fall open"],
        holdSeconds: 180,
      },
      intermediate: {
        description: "Flat on the back, arms a little away from the body, palms up, releasing all effort.",
        props: ["none"],
        cues: ["Arms rest away from the body, palms up", "Soften the face, jaw, and breath", "Let the whole body grow heavy"],
        holdSeconds: 300,
      },
      advanced: {
        description: "Extended stillness with a body-scan or breath awareness, fully releasing control.",
        props: ["none"],
        cues: ["Scan the body, releasing each part", "Let the breath become effortless", "Rest in complete stillness"],
        holdSeconds: 600,
      },
    },
    stepMotions: ["settle", "settle", "exhale", "inhale"],
  },

  "ardha-hanumanasana": {
    avoidIf: [
      { condition: "Hamstring tear", severity: "avoid" },
      { condition: "Knee sensitivity — pad the back knee", severity: "modify" },
      { condition: "Low back injury", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Blocks under both hands with a soft bend in the front knee; back knee padded.",
        props: ["block", "blanket"],
        cues: ["Blocks under both hands", "Keep the front knee softly bent", "Hinge from the hips with a long spine"],
        holdSeconds: 45,
      },
      intermediate: {
        description: "Front leg straighter, hands lighter on blocks, folding over the leg.",
        props: ["block", "none"],
        cues: ["Straighten the front leg, flex the foot", "Walk the hands beside the front hip", "Lengthen the spine over the leg"],
        holdSeconds: 60,
      },
      advanced: {
        description: "Straight front leg, chest folding toward the shin, hands to the floor.",
        props: ["none"],
        cues: ["Front leg fully straight, toes up", "Fold the chest toward the shin", "Keep both hips squared forward"],
        holdSeconds: 90,
      },
    },
    stepMotions: ["hip-shift", "leg-extend", "ground", "torso-fold"],
  },

  hanumanasana: {
    avoidIf: [
      { condition: "Hamstring or groin injury", severity: "avoid" },
      { condition: "Recent hip surgery", severity: "avoid" },
      { condition: "Sacroiliac instability", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "Blocks under both hands AND a bolster or block under the front-leg hip; descend only partway.",
        props: ["block", "bolster"],
        cues: ["Block or bolster under the front hip", "Blocks under both hands for height", "Slide forward only as far as is comfortable"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Blocks under the hands only, lowering the hips closer to the floor, pelvis squared.",
        props: ["block"],
        cues: ["Blocks under the hands only", "Slide the front heel forward, back knee back", "Keep the hips square and level"],
        holdSeconds: 40,
      },
      advanced: {
        description: "Full front split with the hands at heart center; option for a backbend reaching overhead.",
        props: ["none"],
        cues: ["Legs extend into the full split", "Square the hips, point the back toes", "Optional backbend: reach the arms overhead"],
        holdSeconds: 45,
      },
    },
    stepMotions: ["ground", "leg-extend", "lift", "balance"],
  },

  "marichyasana-twist": {
    avoidIf: [
      { condition: "Spinal injury", severity: "avoid" },
      { condition: "Pregnancy", severity: "modify" },
      { condition: "Recent abdominal surgery", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Keep both legs extended (or one knee bent) and twist gently, hand on the knee.",
        props: ["bolster", "none"],
        cues: ["Sit tall on a cushion if needed", "Hand on the opposite knee", "Twist gently, leading from the lower spine"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Bend one knee, foot flat, and hook the opposite elbow outside the knee.",
        props: ["none"],
        cues: ["Inhale to lengthen the spine", "Exhale to hook the elbow outside the knee", "Twist deeper from the base of the spine"],
        holdSeconds: 40,
      },
      advanced: {
        description: "Bind the arms around the bent knee and behind the back, deepening the twist.",
        props: ["strap", "none"],
        cues: ["Wrap the arm around the bent knee", "Clasp the hands (or a strap) behind the back", "Gaze over the back shoulder"],
        holdSeconds: 45,
      },
    },
    stepMotions: ["settle", "inhale", "twist", "twist"],
  },

  "virabhadrasana-iii": {
    avoidIf: [
      { condition: "Balance difficulty — use a wall or chair", severity: "modify" },
      { condition: "Low blood pressure or dizziness", severity: "caution" },
      { condition: "Recent ankle, hip, or shoulder injury", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Hands resting on a wall or chair back for support as you tip forward from Warrior I.",
        props: ["wall", "chair"],
        cues: ["Fingertips press into a wall at hip height", "Hinge from the hip, not the waist", "Keep the standing knee softly bent"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Torso, arms, and lifted leg reaching level with the floor, arms alongside the ears.",
        props: ["none"],
        cues: ["Reach the crown forward as the back heel reaches away", "Square both hips toward the floor", "Draw the belly in for a steady core"],
        holdSeconds: 30,
      },
      advanced: {
        description: "A long, level line held with the gaze forward and slow, even breathing.",
        props: ["none"],
        cues: ["Micro-adjust through the standing foot to stay steady", "Lengthen from fingertips to the lifted heel", "Soften the face and breathe smoothly"],
        holdSeconds: 45,
      },
    },
    stepMotions: ["ground", "hip-shift", "torso-fold", "leg-extend", "balance"],
  },

  "utthita-parsvakonasana": {
    avoidIf: [
      { condition: "Neck injury — keep the gaze down, not up", severity: "modify" },
      { condition: "High or low blood pressure", severity: "caution" },
      { condition: "Recent knee or hip injury", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Forearm rests on the front thigh instead of the hand to the floor, top arm on the hip.",
        props: ["none"],
        cues: ["Rest the forearm across the bent thigh", "Stack the top shoulder back and open the chest", "Keep the back leg strong and straight"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Bottom hand to a block or the floor outside the front foot, top arm reaching overhead.",
        props: ["block", "none"],
        cues: ["Bottom hand to a block for length", "Sweep the top arm past the ear", "Feel one long line from the back heel to the top fingers"],
        holdSeconds: 40,
      },
      advanced: {
        description: "Palm flat to the floor outside the foot with the gaze up beneath the top arm.",
        props: ["none"],
        cues: ["Root the whole palm outside the front foot", "Turn the gaze up under the reaching arm", "Press the back outer edge of the foot down"],
        holdSeconds: 45,
      },
    },
    stepMotions: ["ground", "hip-shift", "torso-fold", "arm-extend", "settle"],
  },

  "urdhva-prasarita-eka-padasana": {
    avoidIf: [
      { condition: "Hamstring tear or strain", severity: "avoid" },
      { condition: "Dizzy spells or vertigo when head is low", severity: "avoid" },
      { condition: "High blood pressure or glaucoma", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Hands to blocks in a half-fold with the lifted leg only slightly raised.",
        props: ["block", "wall"],
        cues: ["Hands to blocks to reduce the fold", "Lift the back leg only as high as feels steady", "Keep both hips level and facing down"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Standing forward fold with one leg lifting toward the ceiling, hands framing the standing foot.",
        props: ["none"],
        cues: ["Fold over the standing leg first", "Lift the back leg from the inner thigh", "Keep the standing kneecap lifted"],
        holdSeconds: 30,
      },
      advanced: {
        description: "Torso drawn close to the standing leg with the lifted leg reaching high and hips squared.",
        props: ["none"],
        cues: ["Draw the crown toward the shin", "Reach the lifted heel straight up", "Resist opening the lifted hip"],
        holdSeconds: 40,
      },
    },
    stepMotions: ["ground", "torso-fold", "leg-extend", "lift", "balance"],
  },

  "garudasana": {
    avoidIf: [
      { condition: "Knee injury — do not hook the foot, use a kickstand", severity: "modify" },
      { condition: "Shoulder injury — cross arms loosely", severity: "modify" },
      { condition: "Balance difficulty — practice near a wall", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Cross the arms and legs without wrapping, toes of the top foot resting on the floor.",
        props: ["wall", "none"],
        cues: ["Cross the thighs and rest the top toes down as a kickstand", "Cross the arms at the elbows without full wrap", "Keep a hand near a wall for balance"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Full double-wrap of arms and legs with a slight sit-back through the hips.",
        props: ["none"],
        cues: ["Wrap the top foot behind the calf if it reaches", "Hook the wrists and lift the elbows to shoulder height", "Sink the hips as if into a chair"],
        holdSeconds: 30,
      },
      advanced: {
        description: "Deep wrap held low with the elbows lifted and a folded forward variation.",
        props: ["none"],
        cues: ["Sit deeper to intensify the leg wrap", "Lift the elbows level with the shoulders", "Fold the chest slowly toward the arms"],
        holdSeconds: 40,
      },
    },
    stepMotions: ["ground", "limb-rotate", "arm-extend", "settle", "balance"],
  },

  "gomukhasana": {
    avoidIf: [
      { condition: "Shoulder injury — use a strap between the hands", severity: "modify" },
      { condition: "Knee injury — keep the bottom leg straight", severity: "modify" },
      { condition: "Sciatica — sit on a folded blanket", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Bottom leg extended straight, hands linked with a strap behind the back.",
        props: ["strap", "blanket"],
        cues: ["Sit on a folded blanket to lift the hips", "Keep the lower leg long on the floor", "Hold a strap between the hands"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Knees stacked with the shins crossing, fingers reaching to clasp behind the back.",
        props: ["strap", "none"],
        cues: ["Stack the top knee over the bottom knee", "Top elbow points up, bottom elbow down", "Walk the fingers toward a clasp or hold a strap"],
        holdSeconds: 45,
      },
      advanced: {
        description: "Knees fully stacked with a firm bind, chest lifting and spine tall.",
        props: ["none"],
        cues: ["Draw the heels evenly toward the hips", "Clasp the hands and lift the top elbow", "Keep the chest broad and the neck long"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["settle", "limb-rotate", "arm-extend", "lift", "settle"],
  },

  "bharadvajasana": {
    avoidIf: [
      { condition: "Pregnancy — practice extremely gently, keep the twist open", severity: "modify" },
      { condition: "Recent back or spinal surgery", severity: "avoid" },
      { condition: "Disc issues — twist only from the upper back", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Seated in a chair, feet flat, twisting gently using the chair back for leverage.",
        props: ["chair", "blanket"],
        cues: ["Sit tall with both sitting bones grounded", "Hold the chair back lightly", "Twist only as far as the breath allows"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Legs folded to one side, one hand behind and one on the opposite thigh.",
        props: ["blanket", "none"],
        cues: ["Sweep both shins to one side", "Lengthen up on the inhale, twist on the exhale", "Keep both hips heavy and even"],
        holdSeconds: 40,
      },
      advanced: {
        description: "A deeper bind reaching for the opposite arm with the gaze over the shoulder.",
        props: ["none"],
        cues: ["Reach the back hand toward the opposite elbow", "Root down through the front hip", "Turn the gaze last, over the back shoulder"],
        holdSeconds: 45,
      },
    },
    stepMotions: ["settle", "hip-shift", "inhale", "twist", "settle"],
  },

  "janu-sirsasana": {
    avoidIf: [
      { condition: "Knee injury — support the bent knee with a blanket", severity: "modify" },
      { condition: "Lower back injury — keep the spine long, fold less", severity: "caution" },
      { condition: "Diarrhea or recent abdominal surgery", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Sitting on a blanket with a strap around the extended foot, spine tall.",
        props: ["strap", "blanket"],
        cues: ["Sit on a folded blanket to tilt the pelvis forward", "Loop a strap around the extended foot", "Keep the chest lifted rather than rounding"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Bent knee open, torso folding over the straight leg with hands reaching the foot.",
        props: ["none"],
        cues: ["Place the sole against the inner thigh", "Turn the belly toward the straight leg", "Fold from the hips with a long spine"],
        holdSeconds: 45,
      },
      advanced: {
        description: "A full fold with the torso resting along the leg and hands clasping past the foot.",
        props: ["none"],
        cues: ["Lengthen the front body over the leg", "Clasp the hands beyond the foot", "Soften the shoulders away from the ears"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["settle", "hip-shift", "inhale", "torso-fold", "settle"],
  },

  "dhanurasana": {
    avoidIf: [
      { condition: "Pregnancy", severity: "avoid" },
      { condition: "Wrist injury", severity: "modify" },
      { condition: "High blood pressure", severity: "caution" },
      { condition: "Hernia or recent abdominal surgery", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Half bow — lifting and holding one ankle at a time with the chest gently raised.",
        props: ["strap", "blanket"],
        cues: ["Loop a strap around the ankle if the hand cannot reach", "Lift one leg at a time to learn the shape", "Keep the knees hip-width"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Both ankles held, kicking the feet back to lift the chest and thighs.",
        props: ["none"],
        cues: ["Grip the outer ankles, not the tops of the feet", "Kick the shins back to open the chest", "Draw the shoulder blades together"],
        holdSeconds: 30,
      },
      advanced: {
        description: "A tall bow with the thighs lifting high and a gentle rock on the breath.",
        props: ["none"],
        cues: ["Lift the thighs away from the floor", "Broaden across the collarbones", "Let the breath rock the body softly"],
        holdSeconds: 30,
      },
    },
    stepMotions: ["ground", "limb-rotate", "lift", "arm-extend", "settle"],
  },

  "salabhasana": {
    avoidIf: [
      { condition: "Pregnancy after the first trimester", severity: "avoid" },
      { condition: "Recent abdominal or back surgery", severity: "avoid" },
      { condition: "Headache or neck strain — keep the gaze down", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Lifting only the chest and arms, legs staying grounded and relaxed.",
        props: ["blanket", "none"],
        cues: ["Rest the forehead down to start", "Lift just the chest and hands", "Keep the legs heavy on the floor"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Chest, arms, and both legs lifting together, arms reaching back alongside the body.",
        props: ["none"],
        cues: ["Reach the fingertips toward the heels", "Lift both legs from the inner thighs", "Lengthen the tailbone toward the feet"],
        holdSeconds: 30,
      },
      advanced: {
        description: "A high, sustained lift with the legs together and the breath steady.",
        props: ["none"],
        cues: ["Draw the inner legs together and lift higher", "Keep the back of the neck long", "Hold with smooth, even breathing"],
        holdSeconds: 45,
      },
    },
    stepMotions: ["ground", "settle", "lift", "leg-extend", "settle"],
  },

  "matsyasana": {
    avoidIf: [
      { condition: "Neck injury — support the head, do not drop it back", severity: "modify" },
      { condition: "High or low blood pressure", severity: "caution" },
      { condition: "Migraine or headache", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "A supported version resting the upper back and head on a bolster along the spine.",
        props: ["bolster", "blanket"],
        cues: ["Lie back over a lengthwise bolster", "Let the head rest, not hang", "Open the arms out to the sides"],
        holdSeconds: 45,
      },
      intermediate: {
        description: "Forearms and elbows pressing down to lift the chest, crown lightly toward the floor.",
        props: ["none"],
        cues: ["Prop onto the forearms and lift the chest high", "Take the head back only as far as is comfortable", "Keep weight in the elbows, not the head"],
        holdSeconds: 30,
      },
      advanced: {
        description: "Legs in lotus or lifted, the classic fish with an open, arching chest.",
        props: ["none"],
        cues: ["Lift the chest to its fullest arch", "Reach the crown gently toward the mat", "Broaden the collarbones and breathe into the ribs"],
        holdSeconds: 30,
      },
    },
    stepMotions: ["settle", "ground", "lift", "arm-extend", "settle"],
  },

  "mandukasana": {
    avoidIf: [
      { condition: "Knee injury", severity: "avoid" },
      { condition: "Groin strain", severity: "avoid" },
      { condition: "Pregnancy", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Knees only slightly apart with padding beneath them, weight in the hands.",
        props: ["blanket", "bolster"],
        cues: ["Pad the knees generously", "Take the knees only a little wider than the hips", "Keep the hips over or in front of the knees"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Knees wide with ankles behind the knees, hips easing back toward the heels.",
        props: ["blanket", "none"],
        cues: ["Stack ankles directly behind the knees", "Ease the hips back on each exhale", "Rest onto the forearms to soften the lower back"],
        holdSeconds: 45,
      },
      advanced: {
        description: "A deep, wide frog with the hips level with the knees and chest lowering.",
        props: ["none"],
        cues: ["Widen the knees until the hips reach knee height", "Keep the inner ankles and feet grounded", "Breathe slowly and let the hips open gradually"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["ground", "hip-shift", "settle", "hip-shift", "settle"],
  },

  "ananda-balasana": {
    avoidIf: [
      { condition: "Pregnancy — knees to the sides of the belly", severity: "modify" },
      { condition: "Neck injury — keep the head resting down", severity: "caution" },
      { condition: "Recent hip or knee surgery", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Holding the backs of the thighs or a strap around the feet, knees gently bent.",
        props: ["strap", "none"],
        cues: ["Hold the backs of the thighs if the feet are out of reach", "Keep the head and shoulders relaxed on the mat", "Let the tailbone stay heavy"],
        holdSeconds: 45,
      },
      intermediate: {
        description: "Holding the outer edges of the feet, knees drawing toward the armpits.",
        props: ["none"],
        cues: ["Catch the outer edges of the feet", "Stack the ankles over the knees", "Gently draw the knees toward the floor beside the ribs"],
        holdSeconds: 60,
      },
      advanced: {
        description: "A deeper hold with a slow side-to-side rock to massage the lower back.",
        props: ["none"],
        cues: ["Draw the knees wide and down", "Keep the shoulders soft on the mat", "Rock gently side to side to release the spine"],
        holdSeconds: 90,
      },
    },
    stepMotions: ["settle", "lift", "limb-rotate", "settle", "settle"],
  },

  "prasarita-padottanasana": {
    avoidIf: [
      { condition: "Lower back injury — keep the spine long, hands on blocks", severity: "modify" },
      { condition: "High blood pressure or glaucoma", severity: "caution" },
      { condition: "Hamstring tear", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Hands to blocks or a chair in a flat-back half fold, knees softly bent.",
        props: ["block", "chair"],
        cues: ["Set the feet wide and parallel", "Hands to blocks at a comfortable height", "Keep a long spine rather than reaching the floor"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Folding forward with the hands walking back between the feet, crown descending.",
        props: ["block", "none"],
        cues: ["Hinge from the hips with a flat back first", "Walk the hands in line with the feet", "Let the crown release toward the floor"],
        holdSeconds: 45,
      },
      advanced: {
        description: "A full fold with the crown resting down and hands drawing the torso deeper.",
        props: ["none"],
        cues: ["Bring the crown toward the mat", "Draw the shoulders away from the ears", "Lift the sitting bones as the head descends"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["ground", "inhale", "torso-fold", "settle", "settle"],
  },

  "kumbhakasana": {
    avoidIf: [
      { condition: "Wrist injury — lower to the forearms (plank on elbows)", severity: "modify" },
      { condition: "Pregnancy after the second trimester", severity: "modify" },
      { condition: "Carpal tunnel syndrome", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Knees lowered to the floor, holding a straight line from the head to the knees.",
        props: ["blanket", "none"],
        cues: ["Lower the knees for a half plank", "Keep the shoulders stacked over the wrists", "Draw the belly in so the hips do not sag"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Full plank with a straight line from the crown to the heels, core engaged.",
        props: ["none"],
        cues: ["Press the floor away and broaden the upper back", "Reach the heels back as the crown reaches forward", "Firm the thighs and hug the midline"],
        holdSeconds: 30,
      },
      advanced: {
        description: "A long, steady hold with subtle shoulder taps or lifted-leg variations.",
        props: ["none"],
        cues: ["Keep the hips perfectly level", "Breathe smoothly without collapsing the low back", "Add slow shoulder taps to challenge stability"],
        holdSeconds: 45,
      },
    },
    stepMotions: ["ground", "arm-extend", "leg-extend", "lift", "settle"],
  },

  "vasisthasana": {
    avoidIf: [
      { condition: "Wrist injury — take the forearm version on the elbow", severity: "modify" },
      { condition: "Shoulder injury", severity: "avoid" },
      { condition: "Pregnancy after the second trimester", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Bottom knee down and top-hand on the hip, building side stability.",
        props: ["blanket", "none"],
        cues: ["Lower the bottom knee for support", "Stack the shoulder over the wrist", "Keep the top hand on the hip"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Legs stacked or staggered, top arm reaching up to a full side plank.",
        props: ["none"],
        cues: ["Stagger the top foot in front for a wider base", "Press the floor away and lift the hips", "Reach the top arm straight up"],
        holdSeconds: 30,
      },
      advanced: {
        description: "Feet stacked with the top leg lifted or the big toe held, gazing up.",
        props: ["strap", "none"],
        cues: ["Stack the feet and lift the hips high", "Reach or hold the top leg up", "Turn the gaze toward the top hand"],
        holdSeconds: 40,
      },
    },
    stepMotions: ["ground", "hip-shift", "lift", "arm-extend", "balance"],
  },

  // ---- v5.1 additions ----
  "utkata-konasana": {
    avoidIf: [
      { condition: "Knee injury — narrow the stance", severity: "modify" },
      { condition: "Late pregnancy — mind the balance", severity: "caution" },
      { condition: "Hip injury", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Take a narrower stance and stay higher, hands resting on the thighs.",
        props: ["none"],
        cues: ["Feet a little narrower for the knees", "Rise higher — don't sink to full depth", "Rest the hands on the thighs"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Wide stance, hips sinking toward knee height, cactus arms lifted.",
        props: ["none"],
        cues: ["Track the knees toward the little toes", "Sink the hips to knee height", "Cactus the arms, palms forward"],
        holdSeconds: 45,
      },
      advanced: {
        description: "Hold low with a subtle pulse or heels lifting, spine tall and steady.",
        props: ["none"],
        cues: ["Sink low and hold with a steady gaze", "Optionally pulse or lift the heels", "Keep the tailbone lengthening down"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["ground", "hip-shift", "lift", "arm-extend"],
  },

  "viparita-virabhadrasana": {
    avoidIf: [
      { condition: "Hip or knee injury", severity: "modify" },
      { condition: "Low back injury — keep the arc gentle", severity: "caution" },
      { condition: "High blood pressure", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Rest the back hand on the rear thigh and keep the side-bend shallow.",
        props: ["none"],
        cues: ["Back hand light on the rear thigh", "Keep the arc small and easy", "Front knee stays bent over the ankle"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Full arc, top arm reaching overhead, back hand sliding down the rear leg.",
        props: ["none"],
        cues: ["Float the top arm overhead", "Arc the torso back and up", "Keep the front thigh working toward parallel"],
        holdSeconds: 30,
      },
      advanced: {
        description: "Deep front-knee bend with a full side-body arc and open chest, held with ease.",
        props: ["none"],
        cues: ["Sink the front thigh toward parallel", "Lengthen through both sides of the waist", "Open the chest toward the ceiling"],
        holdSeconds: 40,
      },
    },
    stepMotions: ["ground", "arm-extend", "twist", "balance"],
  },

  "chaturanga-dandasana": {
    avoidIf: [
      { condition: "Wrist injury", severity: "avoid" },
      { condition: "Shoulder impingement", severity: "avoid" },
      { condition: "Pregnancy (2nd trimester onward)", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "Lower the knees to the mat, then bend the elbows halfway, hugging them in.",
        props: ["none"],
        cues: ["Knees down for support", "Elbows hug the ribs", "Lower only halfway with control"],
        holdSeconds: 5,
      },
      intermediate: {
        description: "Full-body hover, shoulders in line with the elbows, held briefly.",
        props: ["none"],
        cues: ["Shift forward past the wrists first", "Lower to elbows at 90 degrees", "Keep the body in one firm line"],
        holdSeconds: 8,
      },
      advanced: {
        description: "Lower slowly with control from plank and hold the hover a few breaths.",
        props: ["none"],
        cues: ["Descend slowly under control", "Hold the hover, gaze slightly forward", "Press the floor away through the hands"],
        holdSeconds: 12,
      },
    },
    stepMotions: ["hip-shift", "ground", "exhale", "balance"],
  },

  "urdhva-mukha-svanasana": {
    avoidIf: [
      { condition: "Lower back injury", severity: "avoid" },
      { condition: "Carpal tunnel syndrome", severity: "modify" },
      { condition: "Pregnancy (2nd trimester onward)", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "Practice Cobra instead, keeping the thighs on the floor and the lift gentle.",
        props: ["none"],
        cues: ["Keep the thighs down (Cobra)", "Lift only as high as feels easy", "Soften the lower back"],
        holdSeconds: 15,
      },
      intermediate: {
        description: "Press up onto straight arms, thighs and hips lifting clear of the floor.",
        props: ["none"],
        cues: ["Straighten the arms fully", "Lift the thighs off the mat", "Roll the shoulders back and down"],
        holdSeconds: 20,
      },
      advanced: {
        description: "Full lift with a broad chest, drawing forward through the arms in a smooth flow.",
        props: ["none"],
        cues: ["Draw the chest forward through the arms", "Broaden across the collarbones", "Lengthen the tailbone to protect the low back"],
        holdSeconds: 30,
      },
    },
    stepMotions: ["ground", "lift", "inhale", "settle"],
  },


  "marjaryasana-bitilasana": {
    avoidIf: [
      { condition: "Wrist pain - practice on fists or forearms", severity: "modify" },
      { condition: "Recent spinal injury or disc issue", severity: "avoid" },
      { condition: "Knee sensitivity - pad the knees", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "Small, slow movements with a blanket under the knees, pausing in neutral between rounds.",
        props: ["blanket"],
        cues: ["Move only as far as feels easy", "Pause in tabletop between rounds", "Let the breath set the pace"],
        holdSeconds: 45,
      },
      intermediate: {
        description: "Full-range flowing rounds, one breath per movement, eight to ten cycles.",
        props: ["none"],
        cues: ["Inhale Cow, exhale Cat - no holding", "Start the wave from the tailbone", "Spread the fingers and press the floor away"],
        holdSeconds: 60,
      },
      advanced: {
        description: "Add slow circles of the ribcage and hips, exploring the spine in every direction.",
        props: ["none"],
        cues: ["Circle the ribs over the wrists", "Find the stiff corners and breathe into them", "Keep the movement silky and unhurried"],
        holdSeconds: 90,
      },
    },
    stepMotions: ["ground", "inhale", "exhale", "settle", "settle"],
  },

  "supta-matsyendrasana": {
    avoidIf: [
      { condition: "Recent spinal or hip surgery", severity: "avoid" },
      { condition: "Late pregnancy - twist gently from the upper back", severity: "modify" },
      { condition: "Sacroiliac joint pain", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Knees drop onto a pillow, opposite shoulder anchored, head stays neutral.",
        props: ["pillow"],
        cues: ["Pillow under the knees for full support", "Keep both shoulders heavy", "Head center if the neck complains"],
        holdSeconds: 45,
      },
      intermediate: {
        description: "Knees stacked at hip height, gaze turned away, twist fully passive.",
        props: ["none"],
        cues: ["Stack the knees at hip height", "Turn the gaze away from the knees", "Exhale the knees heavier"],
        holdSeconds: 60,
      },
      advanced: {
        description: "Eagle-wrap the legs before dropping them for a deeper wring through the outer hip.",
        props: ["none"],
        cues: ["Wrap the top leg around the bottom", "Drop both legs together", "Keep the opposite shoulder glued down"],
        holdSeconds: 90,
      },
    },
    stepMotions: ["ground", "twist", "twist", "settle", "settle"],
  },

  "supta-kapotasana": {
    avoidIf: [
      { condition: "Recent knee ligament injury", severity: "avoid" },
      { condition: "Hip replacement - consult your provider", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Ankle crossed over the thigh with the bottom foot staying on the floor.",
        props: ["none"],
        cues: ["Bottom foot stays grounded", "Flex the crossed foot to guard the knee", "Press the knee away gently"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Bottom leg lifted, hands clasped behind the thigh, head heavy on the mat.",
        props: ["none", "strap"],
        cues: ["Thread the hand through the gap", "Draw the thigh in on the exhale", "Keep head and shoulders down"],
        holdSeconds: 45,
      },
      advanced: {
        description: "Clasp the shin instead of the thigh, drawing the legs closer while the spine stays long.",
        props: ["none"],
        cues: ["Clasp the shin for a deeper draw", "Elbow presses the knee wide", "Tailbone stays heavy - no curling up"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["ground", "limb-rotate", "leg-extend", "hip-shift", "settle"],
  },

  "parsva-balasana": {
    avoidIf: [
      { condition: "Neck injury - support the head on a block", severity: "modify" },
      { condition: "Shoulder instability or recent dislocation", severity: "avoid" },
      { condition: "Knee sensitivity - pad the knees", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "A shallow thread with the head on a block and the top hand pressing the floor for control.",
        props: ["block", "blanket"],
        cues: ["Head rests on a block", "Top hand stays planted", "Only thread as far as feels sweet"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Full thread with the shoulder and ear on the mat, hips stacked high over the knees.",
        props: ["none"],
        cues: ["Palm turns up as it threads", "Hips stay over the knees", "Soften between the shoulder blades"],
        holdSeconds: 45,
      },
      advanced: {
        description: "Reach the top arm overhead or wrap it behind the back for a deeper spiral.",
        props: ["none"],
        cues: ["Top arm reaches past the ear", "Or wrap it behind the waist", "Rotate the heart toward the sky"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["ground", "arm-extend", "twist", "settle", "twist"],
  },

  "uttana-shishosana": {
    avoidIf: [
      { condition: "Shoulder injury", severity: "avoid" },
      { condition: "Knee pain - pad the knees", severity: "modify" },
      { condition: "Late pregnancy - keep the belly comfortable", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Forehead on a block, hips slightly back toward the heels, arms soft.",
        props: ["block", "blanket"],
        cues: ["Forehead supported on a block", "Hips drift back for ease", "Elbows can bend softly"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Hips stacked over the knees, chest melting, forehead on the mat.",
        props: ["none"],
        cues: ["Hips stay over the knees", "Press the palms and lift the forearms", "Melt the heart, not the ribs"],
        holdSeconds: 45,
      },
      advanced: {
        description: "Chin to the mat with gaze forward, arms fully active - a deeper shoulder and throat opening.",
        props: ["none"],
        cues: ["Chin rests where the forehead was", "Reach the hands further forward", "Keep the lower ribs gently knit"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["ground", "torso-fold", "settle", "lift", "settle"],
  },

  malasana: {
    avoidIf: [
      { condition: "Knee injury - sit on a block instead", severity: "modify" },
      { condition: "Achilles or ankle injury", severity: "avoid" },
      { condition: "Recent hip surgery", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Squat onto a block with a rolled blanket under the heels - fully supported.",
        props: ["block", "blanket"],
        cues: ["Sit the hips onto a block", "Blanket under lifted heels", "Spine long, chest bright"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Free squat, palms at heart, elbows pressing the knees wide.",
        props: ["none"],
        cues: ["Heels reach for the floor", "Elbows press knees apart", "Crown lifts as the hips sink"],
        holdSeconds: 45,
      },
      advanced: {
        description: "Heels grounded with a gentle forward fold or hands clasped behind the back.",
        props: ["none"],
        cues: ["Heels fully rooted", "Fold the chest between the knees", "Or clasp hands behind and lift them"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["ground", "hip-shift", "settle", "lift", "ground"],
  },

  virasana: {
    avoidIf: [
      { condition: "Knee ligament injury - elevate the seat generously", severity: "modify" },
      { condition: "Ankle injury", severity: "caution" },
      { condition: "Legs going numb - come out and stretch", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Seated high on a block or two folded blankets, ankles padded.",
        props: ["block", "blanket"],
        cues: ["Height under the sitting bones", "Blanket under the ankles", "No pinching in the knees - ever"],
        holdSeconds: 45,
      },
      intermediate: {
        description: "Sitting between the heels on a thin support, spine tall and effortless.",
        props: ["block", "none"],
        cues: ["Thighs roll slightly inward", "Sitting bones root evenly", "Ribs float over the pelvis"],
        holdSeconds: 60,
      },
      advanced: {
        description: "Seat on the floor between the heels; explore reclining onto the forearms if the knees are happy.",
        props: ["none"],
        cues: ["Hips settle between the heels", "Knees stay together and content", "Recline only with zero knee protest"],
        holdSeconds: 120,
      },
    },
    stepMotions: ["ground", "hip-shift", "ground", "settle", "inhale"],
  },

  "supta-baddha-konasana": {
    avoidIf: [
      { condition: "Groin or knee strain - support the thighs well", severity: "modify" },
      { condition: "Lower-back discomfort - elevate the torso", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "Generous support under both thighs and the head - zero stretch sensation, pure rest.",
        props: ["pillow", "blanket", "block"],
        cues: ["Thighs fully propped", "Small pillow under the head", "Nothing should feel like effort"],
        holdSeconds: 90,
      },
      intermediate: {
        description: "Lighter support, feet drawn a little closer to the hips, arms open.",
        props: ["pillow", "none"],
        cues: ["Heels a hand-span from the hips", "Arms open, palms up", "Ride the wave of the breath"],
        holdSeconds: 120,
      },
      advanced: {
        description: "No props, heels close in, with a long stay and full attention on the breath.",
        props: ["none"],
        cues: ["Let the knees hang freely", "Stay five minutes or more", "Watch the breath without steering it"],
        holdSeconds: 180,
      },
    },
    stepMotions: ["ground", "limb-rotate", "settle", "settle", "exhale"],
  },

  "ardha-matsyendrasana": {
    avoidIf: [
      { condition: "Recent spinal surgery", severity: "avoid" },
      { condition: "Herniated disc — keep the twist mild", severity: "modify" },
      { condition: "Late pregnancy", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Bottom leg extended, hug the knee, sit on a blanket — gentle twist only.",
        props: ["blanket"],
        cues: ["Sit tall on a blanket", "Hug the knee instead of hooking the elbow", "Twist from the belly, not the neck"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Classic hook of the elbow outside the knee with a long spine.",
        props: ["none"],
        cues: ["Inhale length, exhale twist", "Bottom hand roots behind you", "Gaze soft over the shoulder"],
        holdSeconds: 45,
      },
      advanced: {
        description: "Deeper bind: wrap the arm around the knee and clasp behind the back.",
        props: ["none"],
        cues: ["Both sitting bones stay rooted", "Chest lifts as you bind", "Never force the neck"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["ground", "hip-shift", "twist", "inhale", "twist"],
  },

  "upavistha-konasana": {
    avoidIf: [
      { condition: "Hamstring tear", severity: "avoid" },
      { condition: "Groin injury", severity: "caution" },
      { condition: "Disc issues — fold less and sit higher", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "Sit high on a blanket, hands on blocks, spine long — barely fold.",
        props: ["blanket", "block"],
        cues: ["Toes and kneecaps face up", "Hinge from the hips", "Stop before the back rounds"],
        holdSeconds: 45,
      },
      intermediate: {
        description: "Walk the hands forward with a long spine into a moderate fold.",
        props: ["none"],
        cues: ["Inner thighs soften", "Crown reaches forward", "Breath fills the back body"],
        holdSeconds: 60,
      },
      advanced: {
        description: "Deeper fold with elbows or forehead toward the floor, legs active.",
        props: ["none"],
        cues: ["Legs stay strongly engaged", "Fold only while the spine stays long", "Long stay, quiet mind"],
        holdSeconds: 90,
      },
    },
    stepMotions: ["ground", "inhale", "torso-fold", "settle", "exhale"],
  },

  halasana: {
    avoidIf: [
      { condition: "Neck injury", severity: "avoid" },
      { condition: "Glaucoma or high blood pressure", severity: "avoid" },
      { condition: "Menstruation or pregnancy", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Feet rest on a chair or blocks; knees bent; hands support the back.",
        props: ["chair", "block", "blanket"],
        cues: ["Never turn the head", "Support the back with both hands", "Soft throat and jaw"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Toes reach the floor or a low prop with shoulder blades tucked under.",
        props: ["blanket"],
        cues: ["Walk the shoulders under", "Legs active, not collapsed", "Quiet, even breath"],
        holdSeconds: 45,
      },
      advanced: {
        description: "Full plow with arms extended on the floor, longer stay.",
        props: ["none"],
        cues: ["Arms press the floor for leverage", "Hips stack over shoulders", "Exit vertebra by vertebra"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["ground", "lift", "leg-extend", "settle", "exhale"],
  },

  sarvangasana: {
    avoidIf: [
      { condition: "Neck injury", severity: "avoid" },
      { condition: "Glaucoma or high blood pressure", severity: "avoid" },
      { condition: "Menstruation or pregnancy", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Legs-Up-the-Wall or supported shoulder stand with bent knees on blankets.",
        props: ["wall", "blanket"],
        cues: ["Blankets under the shoulders", "Head stays free and still", "Gaze toward the chest"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Classic supported shoulder stand with hands on the back.",
        props: ["blanket"],
        cues: ["Elbows walk in", "Hips over shoulders", "Legs reach up actively"],
        holdSeconds: 45,
      },
      advanced: {
        description: "Longer hold with legs together and quiet breath; exit via plow.",
        props: ["blanket"],
        cues: ["Throat soft", "Never turn the head", "Roll down slowly to exit"],
        holdSeconds: 90,
      },
    },
    stepMotions: ["ground", "lift", "balance", "settle", "exhale"],
  },

  bakasana: {
    avoidIf: [
      { condition: "Wrist injury", severity: "avoid" },
      { condition: "Shoulder instability", severity: "caution" },
      { condition: "Pregnancy", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Knees on upper arms with toes still touching; bolster in front as a safety net.",
        props: ["bolster", "block"],
        cues: ["Fingers spread wide", "Gaze slightly forward", "Lean until almost light"],
        holdSeconds: 10,
      },
      intermediate: {
        description: "Both feet lift; hold briefly with a rounded upper back.",
        props: ["none"],
        cues: ["Knees high on the arms", "Hug heels to hips", "Core draws in"],
        holdSeconds: 20,
      },
      advanced: {
        description: "Straighten the arms toward Crane (Kakasana) with hips lifting higher.",
        props: ["none"],
        cues: ["Press the floor away", "Legs squeeze in", "Quiet, focused gaze"],
        holdSeconds: 30,
      },
    },
    stepMotions: ["ground", "hip-shift", "balance", "lift", "settle"],
  },

  "parivrtta-anjaneyasana": {
    avoidIf: [
      { condition: "Knee injury — pad generously", severity: "modify" },
      { condition: "Recent spinal injury", severity: "caution" },
      { condition: "Late pregnancy", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Back knee down, bottom hand on a block, gentle twist only.",
        props: ["block", "blanket"],
        cues: ["Hips square forward", "Palm press creates space", "Gaze can stay down"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Classic revolved lunge with elbow outside the front thigh.",
        props: ["none"],
        cues: ["Inhale length, exhale twist", "Chest lifts away from the thigh", "Back hip sinks"],
        holdSeconds: 30,
      },
      advanced: {
        description: "Back knee lifted (high lunge twist) with a deeper bind option.",
        props: ["none"],
        cues: ["Back leg strong and straight", "Twist from the belly", "Steady gaze"],
        holdSeconds: 45,
      },
    },
    stepMotions: ["ground", "inhale", "twist", "lift", "twist"],
  },

  purvottanasana: {
    avoidIf: [
      { condition: "Wrist injury", severity: "modify" },
      { condition: "Shoulder injury", severity: "caution" },
      { condition: "Neck pain — keep the head neutral", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "Reverse tabletop — knees bent, hips lifting to a comfortable height.",
        props: ["none"],
        cues: ["Fingers point toward the feet", "Press into all four corners of the feet", "Chest opens"],
        holdSeconds: 15,
      },
      intermediate: {
        description: "Legs straight, hips high, neck neutral or gently tipped back.",
        props: ["none"],
        cues: ["Thighs squeeze together", "Toes point", "Shoulders stack over wrists"],
        holdSeconds: 30,
      },
      advanced: {
        description: "Full upward plank with a longer hold and lifted gaze.",
        props: ["none"],
        cues: ["Hips stay lifted", "Arms strong and straight", "Shake out wrists after"],
        holdSeconds: 40,
      },
    },
    stepMotions: ["ground", "lift", "arm-extend", "inhale", "settle"],
  },

  apanasana: {
    avoidIf: [
      { condition: "Recent abdominal surgery", severity: "caution" },
      { condition: "Late pregnancy — widen the knees", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "One knee at a time, or hold behind the thighs instead of the shins.",
        props: ["none"],
        cues: ["Head heavy on the floor", "Soft shoulders", "Gentle hug only"],
        holdSeconds: 45,
      },
      intermediate: {
        description: "Both knees hugged in with an optional side-to-side rock.",
        props: ["none"],
        cues: ["Exhale draws the knees in", "Lower back massages the floor", "Jaw soft"],
        holdSeconds: 60,
      },
      advanced: {
        description: "Longer stay with forehead toward the knees if comfortable.",
        props: ["none"],
        cues: ["Whole body softens", "Breath deep in the belly", "No forcing"],
        holdSeconds: 90,
      },
    },
    stepMotions: ["ground", "hip-shift", "settle", "exhale", "settle"],
  },

  "supta-padangusthasana": {
    avoidIf: [
      { condition: "Hamstring tear", severity: "avoid" },
      { condition: "Acute sciatica — keep mild", severity: "modify" },
      { condition: "Unstable SI joint", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Generous knee bend with a strap; opposite foot can press a wall.",
        props: ["strap", "wall"],
        cues: ["Shoulders stay heavy", "Flex the raised foot", "Never bounce"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Straighter raised leg with strap; both hips level.",
        props: ["strap"],
        cues: ["Bottom leg active on the floor", "Walk the hands up the strap", "Soft face"],
        holdSeconds: 45,
      },
      advanced: {
        description: "Hold the big toe with fingers; open the leg out to the side as a variation.",
        props: ["none"],
        cues: ["Hips stay square", "Core lightly engaged", "Equal breath both sides"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["ground", "hip-shift", "leg-extend", "inhale", "settle"],
  },

  parighasana: {
    avoidIf: [
      { condition: "Knee injury — pad well or practice seated", severity: "modify" },
      { condition: "Recent rib injury", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Top hand stays on the hip; bottom hand high on the shin.",
        props: ["blanket"],
        cues: ["Kneeling knee padded", "Chest opens to the sky", "Breathe into the long side"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Classic gate with the top arm reaching over the ear.",
        props: ["none"],
        cues: ["Extended leg strong", "Side bend without collapsing forward", "Even breath"],
        holdSeconds: 30,
      },
      advanced: {
        description: "Deeper side bend with the bottom hand toward the ankle or floor.",
        props: ["none"],
        cues: ["Both sides of the waist long", "Hips stay stacked", "Rise on an inhale"],
        holdSeconds: 45,
      },
    },
    stepMotions: ["ground", "arm-extend", "torso-fold", "inhale", "lift"],
  },

  "ardha-pincha-mayurasana": {
    avoidIf: [
      { condition: "Shoulder injury", severity: "caution" },
      { condition: "High blood pressure — keep the head high", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "Knees bent, heels high, chest reaching toward the thighs gently.",
        props: ["none"],
        cues: ["Elbows under shoulders", "Press forearms down", "Soft neck"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Classic dolphin with hips high and heels reaching down.",
        props: ["none"],
        cues: ["Chest toward thighs", "Legs strong", "Gaze between the forearms"],
        holdSeconds: 45,
      },
      advanced: {
        description: "Dolphin push-ups or hop preparations toward forearm stand.",
        props: ["none"],
        cues: ["Shoulders stay stable", "Core engages on each hop", "Rest in Child's Pose after"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["ground", "arm-extend", "lift", "settle", "exhale"],
  },

  "parivrtta-trikonasana": {
    avoidIf: [
      { condition: "Low back injury", severity: "caution" },
      { condition: "Tight hamstrings — use a block", severity: "modify" },
      { condition: "Migraine or dizziness", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Short stance, bottom hand on a block, gaze down.",
        props: ["block"],
        cues: ["Hips square forward", "Both sides of the waist long", "Soft standing feet"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Classic revolved triangle with the top arm reaching up.",
        props: ["none"],
        cues: ["Inhale length, exhale rotate", "Stack the shoulders", "Front leg strong"],
        holdSeconds: 30,
      },
      advanced: {
        description: "Longer stance, bottom hand on the floor, deeper twist.",
        props: ["none"],
        cues: ["Precision over depth", "Back heel roots", "Steady gaze"],
        holdSeconds: 45,
      },
    },
    stepMotions: ["ground", "torso-fold", "twist", "arm-extend", "balance"],
  },

  natarajasana: {
    avoidIf: [
      { condition: "Ankle or knee instability", severity: "caution" },
      { condition: "Low back pain — kick less", severity: "modify" },
      { condition: "Shoulder injury", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "Hold the back ankle with a strap; free hand on a wall.",
        props: ["strap", "wall"],
        cues: ["Soft standing knee", "Kick gently into the hand", "Chest lifts"],
        holdSeconds: 15,
      },
      intermediate: {
        description: "Classic dancer with one hand on the foot, free arm reaching forward.",
        props: ["none"],
        cues: ["Hips square", "Heart opens forward", "Gaze soft and steady"],
        holdSeconds: 30,
      },
      advanced: {
        description: "Both hands hold the foot overhead toward full dancer.",
        props: ["none"],
        cues: ["Kick up and back", "Standing leg strong", "Breath stays even"],
        holdSeconds: 40,
      },
    },
    stepMotions: ["ground", "balance", "lift", "arm-extend", "settle"],
  },

  agnistambhasana: {
    avoidIf: [
      { condition: "Knee injury — never force the stack", severity: "avoid" },
      { condition: "Hip replacement", severity: "avoid" },
      { condition: "Acute SI joint pain", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Half fire log — only one shin stacked; blanket between the legs.",
        props: ["blanket"],
        cues: ["Flex both feet", "Sit tall", "No pain in the knees — ever"],
        holdSeconds: 45,
      },
      intermediate: {
        description: "Full stack with an upright spine or a slight hinge.",
        props: ["none"],
        cues: ["Ankle over knee", "Outer hips soften on the exhale", "Long spine"],
        holdSeconds: 60,
      },
      advanced: {
        description: "Deeper forward fold over the stacked shins with a long stay.",
        props: ["none"],
        cues: ["Fold only if knees are happy", "Breath into the outer hips", "Switch sides mindfully"],
        holdSeconds: 90,
      },
    },
    stepMotions: ["ground", "limb-rotate", "settle", "torso-fold", "exhale"],
  },

  "salamba-bhujangasana": {
    avoidIf: [
      { condition: "Acute lower-back flare — keep very low", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "Elbows further forward, chest lower — barely a lift.",
        props: ["blanket"],
        cues: ["Pubic bone presses down", "Shoulders melt down the back", "Soft gaze"],
        holdSeconds: 45,
      },
      intermediate: {
        description: "Classic sphinx with elbows under the shoulders.",
        props: ["none"],
        cues: ["Chest reaches forward", "Legs active", "Breath into the front body"],
        holdSeconds: 60,
      },
      advanced: {
        description: "Longer hold or walk the hands closer toward a low Cobra.",
        props: ["none"],
        cues: ["Lower back stays comfortable", "Throat soft", "Rest on the belly after"],
        holdSeconds: 90,
      },
    },
    stepMotions: ["ground", "arm-extend", "lift", "inhale", "settle"],
  },

  skandasana: {
    avoidIf: [
      { condition: "Knee injury", severity: "caution" },
      { condition: "Groin strain", severity: "avoid" },
      { condition: "Ankle instability", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "Higher side squat, hands on blocks, bent-leg heel may lift.",
        props: ["block"],
        cues: ["Chest lifts", "Straight leg stays active", "No knee pain"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Deeper side lunge with the heel grounding and hands at heart or floor.",
        props: ["none"],
        cues: ["Hips sink toward the bent heel", "Inner thighs open", "Spine long"],
        holdSeconds: 30,
      },
      advanced: {
        description: "Low skandasana with a bind or transition toward a squat.",
        props: ["none"],
        cues: ["Even weight through the feet", "Core supports the fold", "Move side to side with control"],
        holdSeconds: 45,
      },
    },
    stepMotions: ["ground", "hip-shift", "leg-extend", "settle", "balance"],
  },

  makarasana: {
    avoidIf: [
      { condition: "Pregnancy — skip prone poses", severity: "avoid" },
      { condition: "Recent abdominal surgery", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Thin pillow under the pelvis; forehead on stacked hands.",
        props: ["pillow"],
        cues: ["Legs wide and soft", "Belly breathes into the floor", "Completely passive"],
        holdSeconds: 60,
      },
      intermediate: {
        description: "Classic crocodile with forearms stacked, long quiet stay.",
        props: ["none"],
        cues: ["Heels fall inward", "Jaw unclenches", "Nothing to fix"],
        holdSeconds: 90,
      },
      advanced: {
        description: "Longer restorative stay (3+ minutes) as a Savasana alternative.",
        props: ["none"],
        cues: ["Whole front body melts", "Mind watches the breath", "Exit via Child's Pose"],
        holdSeconds: 180,
      },
    },
    stepMotions: ["ground", "settle", "settle", "inhale", "exhale"],
  },

  vajrasana: {
    avoidIf: [
      { condition: "Knee injury — sit on a block between the heels", severity: "modify" },
      { condition: "Ankle injury", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Sit high on a block or folded blankets between the heels.",
        props: ["block", "blanket"],
        cues: ["Knees soft and happy", "Spine tall without strain", "Palms rest on the thighs"],
        holdSeconds: 60,
      },
      intermediate: {
        description: "Hips on the heels with a thin pad behind the knees if needed.",
        props: ["blanket", "none"],
        cues: ["Big toes close", "Crown lifts", "Shoulders melt"],
        holdSeconds: 90,
      },
      advanced: {
        description: "Long meditation stay; explore hands in a mudra.",
        props: ["none"],
        cues: ["Breath even and quiet", "Jaw soft", "Exit by shifting to one side"],
        holdSeconds: 180,
      },
    },
    stepMotions: ["ground", "hip-shift", "lift", "settle", "exhale"],
  },

  "ardha-uttanasana": {
    avoidIf: [
      { condition: "Acute lower-back flare — hands high, knees soft", severity: "modify" },
      { condition: "Vertigo — gaze at the floor", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Hands on blocks or shins, generous knee bend, long spine.",
        props: ["block"],
        cues: ["Flat back over depth", "Thighs press back", "Neck in line with spine"],
        holdSeconds: 15,
      },
      intermediate: {
        description: "Fingertips on the floor, legs straighter, heart reaching forward.",
        props: ["none"],
        cues: ["Inhale to lengthen", "Gaze slightly forward", "Core lightly engaged"],
        holdSeconds: 20,
      },
      advanced: {
        description: "Minimal knee bend with fingertips grazing the floor, long hold in flow.",
        props: ["none"],
        cues: ["Hinge from the hips", "Spine stays long", "Ready to fold or step"],
        holdSeconds: 30,
      },
    },
    stepMotions: ["torso-fold", "inhale", "lift", "leg-extend", "exhale"],
  },

  padahastasana: {
    avoidIf: [
      { condition: "Hamstring tear", severity: "avoid" },
      { condition: "Disc injury — fold less", severity: "modify" },
      { condition: "High blood pressure — keep the head elevated", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Hold the ankles or shins with soft knees — skip palms under feet.",
        props: ["none"],
        cues: ["Bend the knees freely", "Crown hangs heavy", "No bouncing"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Palms under the feet, knees soft to straight as available.",
        props: ["none"],
        cues: ["Toes press the wrists", "Exhale to soften", "Jaw unclenches"],
        holdSeconds: 45,
      },
      advanced: {
        description: "Legs straight, forehead toward the shins, longer stay.",
        props: ["none"],
        cues: ["Hamstrings active not yanked", "Spine long even in the fold", "Roll up slowly"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["torso-fold", "ground", "leg-extend", "settle", "lift"],
  },

  "utthita-hasta-padangusthasana": {
    avoidIf: [
      { condition: "Ankle instability", severity: "caution" },
      { condition: "Hamstring injury", severity: "modify" },
      { condition: "Vertigo", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Strap around the raised foot; heel can rest on a chair.",
        props: ["strap", "chair"],
        cues: ["Standing hip steady", "Soft standing knee", "Gaze at one point"],
        holdSeconds: 15,
      },
      intermediate: {
        description: "Hold the big toe, leg extended forward, hips level.",
        props: ["none"],
        cues: ["Both sides of the waist long", "Raised foot flexed", "Breath steady"],
        holdSeconds: 30,
      },
      advanced: {
        description: "Open the leg to the side, then fold the torso toward the raised leg.",
        props: ["none"],
        cues: ["Hips stay square", "Standing foot roots", "Exit with control"],
        holdSeconds: 40,
      },
    },
    stepMotions: ["ground", "balance", "leg-extend", "hip-shift", "settle"],
  },

  "parivrtta-parsvakonasana": {
    avoidIf: [
      { condition: "Knee injury", severity: "caution" },
      { condition: "Recent spinal injury", severity: "caution" },
      { condition: "Late pregnancy", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Back knee down, hands at heart, gentle twist only.",
        props: ["block", "blanket"],
        cues: ["Bottom hand on a block if needed", "Chest lifts", "Gaze can stay down"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Classic revolved side angle with elbow outside the thigh.",
        props: ["none"],
        cues: ["Inhale length, exhale twist", "Back heel roots or lifts with intention", "Top arm reaches"],
        holdSeconds: 30,
      },
      advanced: {
        description: "Full bind under the front thigh with a long stance.",
        props: ["none"],
        cues: ["Core supports the twist", "Front knee tracks the toes", "Steady breath"],
        holdSeconds: 45,
      },
    },
    stepMotions: ["ground", "twist", "lift", "arm-extend", "twist"],
  },

  chakravakasana: {
    avoidIf: [
      { condition: "Wrist pain — fists or forearms", severity: "modify" },
      { condition: "Knee sensitivity — pad the knees", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "Lift only the arm or only the leg; keep toes of the lifted leg touching.",
        props: ["blanket"],
        cues: ["Hips level", "Gaze down", "Slow and steady"],
        holdSeconds: 15,
      },
      intermediate: {
        description: "Opposite arm and leg reach long with a quiet hold.",
        props: ["none"],
        cues: ["Core draws in", "Reach through fingers and heel", "Spine stays neutral"],
        holdSeconds: 25,
      },
      advanced: {
        description: "Flow elbow to knee between reaches for a core series.",
        props: ["none"],
        cues: ["Exhale to draw in", "Inhale to reach long", "Hips stay square"],
        holdSeconds: 30,
      },
    },
    stepMotions: ["ground", "arm-extend", "leg-extend", "balance", "settle"],
  },

  "parivrtta-janu-sirsasana": {
    avoidIf: [
      { condition: "Hamstring tear", severity: "avoid" },
      { condition: "Shoulder injury — reach less", severity: "modify" },
      { condition: "Disc issues — keep mild", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "Sit on a blanket, soft knee, strap around the extended foot.",
        props: ["blanket", "strap"],
        cues: ["Side bend over forward fold", "Chest rotates up", "Breathe into the long waist"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "Hold the foot, top arm over the ear, moderate side bend.",
        props: ["none"],
        cues: ["Both sitting bones root", "Long side of the body opens", "Soft neck"],
        holdSeconds: 45,
      },
      advanced: {
        description: "Deeper fold with both hands near the extended foot.",
        props: ["none"],
        cues: ["Ribs spiral up", "Extended leg active", "Rise on an inhale"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["ground", "arm-extend", "torso-fold", "twist", "lift"],
  },

  kurmasana: {
    avoidIf: [
      { condition: "Hamstring injury", severity: "avoid" },
      { condition: "Lower-back injury", severity: "avoid" },
      { condition: "Shoulder injury", severity: "caution" },
      { condition: "Pregnancy", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Wide-legged seated fold only — prepare the shape without arms under.",
        props: ["blanket"],
        cues: ["Sit high", "Long spine first", "Never force the shoulders under"],
        holdSeconds: 30,
      },
      intermediate: {
        description: "One arm under at a time, chest walking forward.",
        props: ["none"],
        cues: ["Knees soft", "Breath into the back", "Jaw soft"],
        holdSeconds: 40,
      },
      advanced: {
        description: "Both arms under, legs straightening over the upper arms.",
        props: ["none"],
        cues: ["Forehead toward the floor", "Shoulders stay spacious", "Exit slowly"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["ground", "torso-fold", "arm-extend", "settle", "lift"],
  },

  bhekasana: {
    avoidIf: [
      { condition: "Knee injury", severity: "avoid" },
      { condition: "Ankle injury", severity: "caution" },
      { condition: "Lower-back flare — lift the chest less", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "One foot at a time with a strap; chest stays low.",
        props: ["strap"],
        cues: ["Press gently — never yank", "Pubic bone grounded", "Soft breath"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Both feet pressed beside the hips, chest lifting moderately.",
        props: ["none"],
        cues: ["Elbows lift", "Knees stay hip-width", "Thighs soften"],
        holdSeconds: 30,
      },
      advanced: {
        description: "Feet closer to the floor, deeper chest lift toward full frog.",
        props: ["none"],
        cues: ["Equal press both feet", "Heart opens forward", "Release one foot at a time"],
        holdSeconds: 45,
      },
    },
    stepMotions: ["ground", "limb-rotate", "hip-shift", "lift", "settle"],
  },

  "karna-pidasana": {
    avoidIf: [
      { condition: "Neck injury", severity: "avoid" },
      { condition: "Glaucoma or high blood pressure", severity: "avoid" },
      { condition: "Menstruation or pregnancy", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Stay in supported Plow with feet on a chair; knees higher.",
        props: ["chair", "blanket"],
        cues: ["Never turn the head", "Weight on the shoulders", "Soft throat"],
        holdSeconds: 15,
      },
      intermediate: {
        description: "Knees beside the ears with hands supporting the back.",
        props: ["blanket"],
        cues: ["Shoulder blades tucked under", "Quiet breath", "Cocoon without force"],
        holdSeconds: 30,
      },
      advanced: {
        description: "Arms wrap the knees; longer stay then roll down via Plow.",
        props: ["none"],
        cues: ["Senses turn inward", "No pressure on the neck", "Exit vertebra by vertebra"],
        holdSeconds: 40,
      },
    },
    stepMotions: ["lift", "torso-fold", "settle", "settle", "exhale"],
  },

  "pincha-mayurasana": {
    avoidIf: [
      { condition: "Shoulder or elbow injury", severity: "avoid" },
      { condition: "Neck injury", severity: "avoid" },
      { condition: "Glaucoma, high blood pressure, menstruation, or pregnancy", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Dolphin at the wall; practice hopping one foot with toes of the other grounded.",
        props: ["wall"],
        cues: ["Forearms press down", "Hips stack over shoulders", "Gaze slightly forward"],
        holdSeconds: 10,
      },
      intermediate: {
        description: "Kick up to the wall and hold briefly with legs together.",
        props: ["wall"],
        cues: ["Elbows shoulder-width", "Core strong", "Soft face"],
        holdSeconds: 15,
      },
      advanced: {
        description: "Freestanding forearm stand with a quiet balance.",
        props: ["none"],
        cues: ["Legs squeeze", "Shoulders stay stable", "Lower with control into Child's Pose"],
        holdSeconds: 30,
      },
    },
    stepMotions: ["ground", "arm-extend", "lift", "balance", "settle"],
  },

  shashankasana: {
    avoidIf: [
      { condition: "Knee injury — pad well or skip", severity: "modify" },
      { condition: "Vertigo — elevate the head on a block", severity: "modify" },
      { condition: "Late pregnancy — widen the knees", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "Forehead on a block, sit on a bolster between the heels.",
        props: ["block", "bolster"],
        cues: ["Completely passive fold", "Arms rest where quietest", "Slow back-body breath"],
        holdSeconds: 45,
      },
      intermediate: {
        description: "Classic hare with arms stretched forward, forehead near the knees.",
        props: ["none"],
        cues: ["Exhale to fold", "Shoulders soft", "Mind settles"],
        holdSeconds: 60,
      },
      advanced: {
        description: "Longer stay as a meditation fold; arms alongside the legs.",
        props: ["none"],
        cues: ["Forehead heavy", "Jaw unclenched", "Rise slowly on an inhale"],
        holdSeconds: 90,
      },
    },
    stepMotions: ["ground", "inhale", "torso-fold", "settle", "lift"],
  },

  "urdhva-hastasana": {
    avoidIf: [
      { condition: "Shoulder injury — soft elbows", severity: "modify" },
      { condition: "Dizziness — gaze forward", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Arms shoulder-width, soft elbows, gentle lift.",
        props: ["none"],
        cues: ["Feet root", "Ribs soft", "Smile optional but encouraged"],
        holdSeconds: 15,
      },
      intermediate: {
        description: "Palms touch overhead with long side body.",
        props: ["none"],
        cues: ["Inhale to lift", "Side ribs lengthen", "Lower ribs stay in"],
        holdSeconds: 20,
      },
      advanced: {
        description: "Slight backbend gaze up with arms firm.",
        props: ["none"],
        cues: ["Heart lifts", "Legs strong", "Breath wide"],
        holdSeconds: 30,
      },
    },
    stepMotions: ["ground", "inhale", "arm-extend", "lift", "exhale"],
  },

  "ashtanga-namaskara": {
    avoidIf: [
      { condition: "Wrist pain — fists or skip", severity: "modify" },
      { condition: "Pregnancy", severity: "avoid" },
      { condition: "Shoulder injury", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Knees down early from Plank; chest barely kisses the floor.",
        props: ["none"],
        cues: ["Elbows hug in", "Hips stay a little high", "Soft landing"],
        holdSeconds: 5,
      },
      intermediate: {
        description: "Classic knees-chest-chin with eight points touching.",
        props: ["none"],
        cues: ["Chin and chest down", "Toes tuck", "Ready for Cobra"],
        holdSeconds: 10,
      },
      advanced: {
        description: "Use as a mindful alternative inside fast sun A rounds.",
        props: ["none"],
        cues: ["Smooth transition", "Core stays awake", "No dumping in the low back"],
        holdSeconds: 15,
      },
    },
    stepMotions: ["ground", "exhale", "settle", "settle", "lift"],
  },

  "parivrtta-utkatasana": {
    avoidIf: [
      { condition: "Knee injury", severity: "caution" },
      { condition: "Low back injury — twist gently", severity: "modify" },
      { condition: "Pregnancy", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "High chair, hands at heart, mild twist.",
        props: ["none"],
        cues: ["Knees even", "Weight in the heels", "Chest lifts"],
        holdSeconds: 15,
      },
      intermediate: {
        description: "Classic revolved chair with elbow outside the thigh.",
        props: ["none"],
        cues: ["Inhale length, exhale twist", "Sit deeper", "Gaze up or forward"],
        holdSeconds: 25,
      },
      advanced: {
        description: "Deeper squat with a bind behind the back.",
        props: ["none"],
        cues: ["Thighs burn evenly", "Twist from the belly", "Steady breath"],
        holdSeconds: 40,
      },
    },
    stepMotions: ["ground", "inhale", "twist", "lift", "twist"],
  },

  "supta-virasana": {
    avoidIf: [
      { condition: "Knee injury — elevate a lot or skip", severity: "avoid" },
      { condition: "Ankle injury", severity: "caution" },
      { condition: "Lower-back pain without props", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "One leg at a time, reclined onto a high bolster stack.",
        props: ["bolster", "block", "blanket"],
        cues: ["Zero knee pain", "Come up if the back complains", "Soft belly breath"],
        holdSeconds: 45,
      },
      intermediate: {
        description: "Both legs in Hero, torso on a bolster.",
        props: ["bolster", "blanket"],
        cues: ["Walk down slowly", "Arms soft", "Jaw unclenched"],
        holdSeconds: 90,
      },
      advanced: {
        description: "Lower support or longer stay if knees are happy.",
        props: ["bolster", "none"],
        cues: ["Quads melt", "Front body opens", "Exit via the elbows"],
        holdSeconds: 180,
      },
    },
    stepMotions: ["ground", "settle", "exhale", "settle", "lift"],
  },

  anantasana: {
    avoidIf: [
      { condition: "Hamstring tear", severity: "avoid" },
      { condition: "Shoulder injury on the bottom side", severity: "modify" },
      { condition: "Neck discomfort — use a pillow", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "Strap around the raised foot, knee soft, head on a pillow.",
        props: ["strap", "pillow"],
        cues: ["Hips stacked", "Bottom waist long", "No forcing"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Hold the big toe with the leg extended skyward.",
        props: ["none"],
        cues: ["Flex the raised foot", "Gaze soft", "Breath steady"],
        holdSeconds: 30,
      },
      advanced: {
        description: "Straighter raised leg closer to the head.",
        props: ["none"],
        cues: ["Keep the chest open", "Equal both sides", "Smile if it feels playful"],
        holdSeconds: 45,
      },
    },
    stepMotions: ["ground", "hip-shift", "leg-extend", "settle", "settle"],
  },

  krounchasana: {
    avoidIf: [
      { condition: "Knee injury on the folded leg", severity: "avoid" },
      { condition: "Hamstring tear", severity: "avoid" },
      { condition: "Disc issues", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "Sit on a blanket, soft knee, strap around the foot.",
        props: ["blanket", "strap"],
        cues: ["Spine stays tall", "Folded knee happy", "Gentle draw-in"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Classic heron with the leg extending up.",
        props: ["none"],
        cues: ["Foot flexed", "Core supports", "Breath even"],
        holdSeconds: 30,
      },
      advanced: {
        description: "Straighter leg closer to the body with a long spine.",
        props: ["none"],
        cues: ["No rounding the back", "Equal both sides", "Release slowly"],
        holdSeconds: 45,
      },
    },
    stepMotions: ["ground", "hip-shift", "leg-extend", "inhale", "settle"],
  },

  simhasana: {
    avoidIf: [
      { condition: "Recent facial or dental surgery", severity: "avoid" },
      { condition: "Severe neck injury — head neutral", severity: "modify" },
    ],
    variations: {
      beginner: {
        description: "Seated in a chair; sigh out without full tongue stretch.",
        props: ["chair"],
        cues: ["Fingers spread", "Exhale audibly", "Relax the face after"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Classic lion: tongue out, eyes wide, strong 'haaa'.",
        props: ["none"],
        cues: ["Three to five rounds", "Let go of looking silly", "Soft face between rounds"],
        holdSeconds: 30,
      },
      advanced: {
        description: "Longer holds with a lifted gaze and full roar.",
        props: ["none"],
        cues: ["Jaw fully releases", "Throat opens", "End with a smile"],
        holdSeconds: 40,
      },
    },
    stepMotions: ["ground", "settle", "inhale", "exhale", "settle"],
  },

  samakonasana: {
    avoidIf: [
      { condition: "Groin strain", severity: "avoid" },
      { condition: "Hip injury", severity: "avoid" },
      { condition: "SI joint instability", severity: "caution" },
    ],
    variations: {
      beginner: {
        description: "High supported straddle with hands on blocks — barely lower.",
        props: ["block"],
        cues: ["Kneecaps face up", "No sharp pain", "Breathe into the inner thighs"],
        holdSeconds: 20,
      },
      intermediate: {
        description: "Deeper middle splits with steady hand support.",
        props: ["block"],
        cues: ["Melt on the exhale", "Never bounce", "Exit by walking feet in"],
        holdSeconds: 45,
      },
      advanced: {
        description: "Closer to the floor with a longer patient stay.",
        props: ["none"],
        cues: ["Honest edge only", "Inner thighs soften", "Rest after"],
        holdSeconds: 60,
      },
    },
    stepMotions: ["ground", "hip-shift", "settle", "exhale", "lift"],
  },

  "adho-mukha-vrksasana": {
    avoidIf: [
      { condition: "Wrist, shoulder, or neck injury", severity: "avoid" },
      { condition: "Glaucoma or high blood pressure", severity: "avoid" },
      { condition: "Menstruation or pregnancy", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "L-shape at the wall: hips stacked, one leg up.",
        props: ["wall"],
        cues: ["Fingers spread wide", "Push the floor away", "Soft gaze"],
        holdSeconds: 10,
      },
      intermediate: {
        description: "Kick up to the wall and hold briefly.",
        props: ["wall"],
        cues: ["Core strong", "Legs squeeze", "Come down with control"],
        holdSeconds: 15,
      },
      advanced: {
        description: "Freestanding handstand with a quiet balance.",
        props: ["none"],
        cues: ["Hollow body", "Shoulders stable", "Child's Pose after"],
        holdSeconds: 30,
      },
    },
    stepMotions: ["ground", "arm-extend", "lift", "balance", "settle"],
  },

  pasasana: {
    avoidIf: [
      { condition: "Knee or ankle injury", severity: "avoid" },
      { condition: "Lower-back injury", severity: "caution" },
      { condition: "Pregnancy", severity: "avoid" },
    ],
    variations: {
      beginner: {
        description: "Malasana on a block with a gentle twist, hands at heart.",
        props: ["block"],
        cues: ["Heels supported", "Chest lifts", "No forced bind"],
        holdSeconds: 15,
      },
      intermediate: {
        description: "Deeper squat twist with a strap for the bind.",
        props: ["strap"],
        cues: ["Twist from the belly", "Knees stay happy", "Breath steady"],
        holdSeconds: 25,
      },
      advanced: {
        description: "Full noose with hands clasped behind.",
        props: ["none"],
        cues: ["Heels ground", "Spine long in the twist", "Equal both sides"],
        holdSeconds: 40,
      },
    },
    stepMotions: ["ground", "twist", "arm-extend", "settle", "twist"],
  },
};
