// Static personalization presets. Each profile bundles a recommended set of
// asanas + breathing techniques and a cadence (minutes/session, days/week).
// The active profile id is persisted via the backend (/api/profile/active).

export type Profile = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: string; // lucide icon name (resolved at render time)
  accent: string; // a tailwind-friendly accent token class
  minutesPerSession: number;
  daysPerWeek: number; // 7 = daily
  recommendedAsanas: string[]; // asana slugs
  recommendedBreathing: string[]; // breathing slugs
  recommendedAffirmationsTag: string;
  why: string; // "Why this profile?" — brief science/intent
};

export const PROFILES: Profile[] = [
  {
    id: "busy-mom",
    name: "Busy Mom",
    tagline: "Strength and breath in 15 minutes — between everything else",
    description:
      "A quick, energizing flow designed to fit into the busiest day. Build strength, steady your breath, and reset — no mat-marathon required.",
    icon: "Baby",
    accent: "primary",
    minutesPerSession: 15,
    daysPerWeek: 4,
    recommendedAsanas: ["tadasana", "urdhva-hastasana", "vrksasana", "utkatasana", "anjaneyasana", "balasana", "savasana"],
    recommendedBreathing: ["ujjayi"],
    recommendedAffirmationsTag: "energy",
    why: "Short, full-body sequences keep the nervous system regulated and energy steady through demanding days. Standing and balancing poses wake up the body fast, while child's pose and savasana give the brief recovery that makes a habit sustainable.",
  },
  {
    id: "stress-relief",
    name: "Stress Relief",
    tagline: "Soften the edges of a long day",
    description:
      "Calming, gentle shapes paired with slow exhalations to downshift the nervous system and release held tension.",
    icon: "HeartHandshake",
    accent: "secondary",
    minutesPerSession: 20,
    daysPerWeek: 5,
    recommendedAsanas: ["sukhasana", "simhasana", "balasana", "viparita-karani", "savasana", "paschimottanasana", "shashankasana"],
    recommendedBreathing: ["four-seven-eight", "nadi-shodhana"],
    recommendedAffirmationsTag: "calm",
    why: "Long exhalations and forward folds activate the parasympathetic ('rest and digest') response, lowering heart rate and cortisol. Legs-up-the-wall and seated folds are among the most reliably calming shapes in yoga.",
  },
  {
    id: "better-sleep",
    name: "Better Sleep",
    tagline: "Wind down into deep, easy rest",
    description:
      "A short restorative sequence to do before bed. Quiet the body, lengthen the breath, and prepare for sleep.",
    icon: "Moon",
    accent: "secondary",
    minutesPerSession: 15,
    daysPerWeek: 7,
    recommendedAsanas: [
      "constructive-rest",
      "chair-viparita-karani",
      "salamba-balasana",
      "pawanmuktasana",
      "parsva-savasana",
      "salamba-matsyasana",
    ],
    recommendedBreathing: ["four-seven-eight"],
    recommendedAffirmationsTag: "calm",
    why: "Restorative, low-effort postures and 4-7-8 breathing cue the body toward sleep by extending the exhale and reducing sympathetic arousal. A consistent nightly ritual is one of the strongest evidence-based sleep aids.",
  },
  {
    id: "calm-focused-mind",
    name: "Calm & Focused Mind",
    tagline: "Steady the mind, sharpen attention",
    description:
      "A meditation-forward practice: comfortable seats, a balancing pose, and breath techniques that anchor a wandering mind.",
    icon: "Brain",
    accent: "primary",
    minutesPerSession: 20,
    daysPerWeek: 4,
    recommendedAsanas: ["sukhasana", "padmasana", "vrksasana", "balasana"],
    recommendedBreathing: ["nadi-shodhana", "bhramari"],
    recommendedAffirmationsTag: "focus",
    why: "Stable seated postures support longer, steadier attention. Alternate-nostril breathing is associated with improved focus and balanced autonomic activity, while humming-breath (bhramari) calms mental chatter.",
  },
  {
    id: "memory-clarity",
    name: "Memory & Clarity",
    tagline: "Gentle inversions for a clear head",
    description:
      "Mild inversions and grounding seats paired with breath work that supports circulation and mental clarity.",
    icon: "Lightbulb",
    accent: "secondary",
    minutesPerSession: 15,
    daysPerWeek: 5,
    recommendedAsanas: ["adho-mukha-svanasana", "viparita-karani", "sukhasana", "padmasana", "vrksasana"],
    recommendedBreathing: ["bhramari", "nadi-shodhana"],
    recommendedAffirmationsTag: "focus",
    why: "Gentle inversions encourage blood flow toward the head and a refreshed feeling on standing. Combined with slow, balanced breathing, this practice supports calm alertness — a good state for focus and recall.",
  },
  {
    id: "weight-loss-energy",
    name: "Weight Loss & Energy",
    tagline: "Dynamic, warming, alive",
    description:
      "A vigorous sequence of standing strength and core work to build heat, raise energy, and keep you moving.",
    icon: "Flame",
    accent: "primary",
    minutesPerSession: 25,
    daysPerWeek: 5,
    recommendedAsanas: [
      "virabhadrasana-i",
      "virabhadrasana-ii",
      "utkatasana",
      "navasana",
      "trikonasana",
      "adho-mukha-svanasana",
      "setu-bandhasana",
    ],
    recommendedBreathing: ["kapalabhati", "ujjayi"],
    recommendedAffirmationsTag: "energy",
    why: "Strong standing poses and core holds raise the heart rate and build lean strength. Kapalabhati ('breath of fire') is an energizing, warming breath that complements an active practice. Pair with mindful eating for best results.",
  },
  {
    id: "flexibility-splits",
    name: "Flexibility & Splits",
    tagline: "Your front-splits journey, one step at a time",
    description:
      "A progressive hip- and hamstring-opening path that builds, pose by pose, toward Hanumanasana (the full front split).",
    icon: "StretchHorizontal",
    accent: "secondary",
    minutesPerSession: 30,
    daysPerWeek: 4,
    recommendedAsanas: [
      "anjaneyasana",
      "utthan-pristhasana",
      "eka-pada-rajakapotasana",
      "ardha-hanumanasana",
      "samakonasana",
      "hanumanasana",
      "paschimottanasana",
    ],
    recommendedBreathing: [],
    recommendedAffirmationsTag: "patience",
    why: "Splits come from patient, progressive loading of the hip flexors and hamstrings. This ordered sequence warms and opens the right tissues — low lunge to lizard to pigeon to half-split — so the full split arrives safely over time.",
  },
  {
    id: "working-professional",
    name: "Working Professional",
    tagline: "Ten-minute desk relief",
    description:
      "A short antidote to long hours at a screen: undo the slump, twist out the spine, and reset your breath between meetings.",
    icon: "Briefcase",
    accent: "primary",
    minutesPerSession: 10,
    daysPerWeek: 4,
    recommendedAsanas: ["tadasana", "urdhva-hastasana", "uttanasana", "ardha-matsyendrasana", "parsva-balasana", "balasana"],
    recommendedBreathing: ["ujjayi", "four-seven-eight"],
    recommendedAffirmationsTag: "focus",
    why: "Sitting all day shortens hip flexors and rounds the upper back. Standing forward folds, gentle twists, and posture-resetting shapes counteract desk strain in minutes, while slow breathing breaks the stress loop of back-to-back meetings.",
  },
  {
    id: "mens-strength",
    name: "For Men",
    tagline: "Strong hips, open chest, athletic recovery",
    description:
      "Built for bodies that lift, run, and sit — hip-flexor length, thoracic mobility, and wrist-friendly strength without fluff.",
    icon: "Dumbbell",
    accent: "primary",
    minutesPerSession: 20,
    daysPerWeek: 4,
    recommendedAsanas: [
      "standing-figure-four",
      "couch-hip-flexor",
      "runner-lunge-twist",
      "dolphin-plank",
      "reverse-tabletop",
      "kneeling-thoracic-opener",
      "wall-chest-opener",
      "prasarita-c",
      "twisted-lizard",
      "standing-side-stretch",
      "wall-calf-stretch",
      "ninety-ninety-hip",
      "strap-shoulder-opener",
      "half-kneeling-hamstring",
      "sumo-hinge",
    ],
    recommendedBreathing: ["ujjayi", "box-breathing"],
    recommendedAffirmationsTag: "energy",
    why: "Athletic training and desk work both tighten hip flexors and round the upper back. This profile pairs deep hip opening with chest and thoracic mobility so strength gains don't cost posture or range.",
  },
  {
    id: "womens-wellness",
    name: "For Women",
    tagline: "Restore, open, and settle with care",
    description:
      "A softer, hip-centered practice — yin-inspired shapes, restorative holds, and side-body space for breath and hormonal calm.",
    icon: "Flower2",
    accent: "secondary",
    minutesPerSession: 25,
    daysPerWeek: 4,
    recommendedAsanas: [
      "wall-butterfly",
      "deer-pose",
      "swan-pose",
      "banana-pose",
      "mermaid-pose",
      "caterpillar",
      "dragonfly",
      "wide-child-pose",
      "seated-side-bend",
      "supported-squat",
      "supported-fish-block",
      "reclined-goddess",
      "melting-heart",
      "legs-up-bolster",
      "side-lying-stretch",
    ],
    recommendedBreathing: ["four-seven-eight", "nadi-shodhana"],
    recommendedAffirmationsTag: "calm",
    why: "Longer, quieter holds support the parasympathetic system and give the hips and side body room to release. Ideal across the cycle when intensity should flex with energy — restore first, effort second.",
  },
];

export function profileById(id: string | null | undefined): Profile | undefined {
  if (!id) return undefined;
  return PROFILES.find((p) => p.id === id);
}
