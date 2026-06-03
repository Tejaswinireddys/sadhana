// Static content for Sadhana. Asanas, pathways, and affirmations live here (not in DB).
import { EXTRAS } from "./variations";

export type Difficulty = "Beginner" | "Intermediate" | "Advanced";
export type Category =
  | "Standing"
  | "Seated"
  | "Forward Bends"
  | "Backbends"
  | "Hip Openers"
  | "Inversions"
  | "Restorative";

export const CATEGORIES: Category[] = [
  "Standing",
  "Seated",
  "Forward Bends",
  "Backbends",
  "Hip Openers",
  "Inversions",
  "Restorative",
];

export type StepMotionKey =
  | "limb-rotate"
  | "torso-fold"
  | "hip-shift"
  | "arm-extend"
  | "leg-extend"
  | "inhale"
  | "exhale"
  | "lift"
  | "twist"
  | "ground"
  | "balance"
  | "settle";

export type Step = {
  text: string;
  pose?: string; // optional per-step SVG key
  stepMotion?: StepMotionKey; // animated mini-clip primitive
};

export type Severity = "avoid" | "modify" | "caution";
export type AvoidRow = { condition: string; severity: Severity };

export type Variation = {
  description: string;
  props: string[];
  cues: string[];
  holdSeconds: number;
};

export type Variations = {
  beginner: Variation;
  intermediate: Variation;
  advanced: Variation;
};

export type Asana = {
  slug: string;
  sanskrit: string;
  english: string;
  category: Category;
  difficulty: Difficulty;
  hold: string; // hold duration label
  holdSeconds: number; // used by the timer
  pose: string; // PoseSvg key
  summary: string;
  breathing: string;
  benefits: string[];
  contraindications: string[]; // legacy flat list (kept for back-compat)
  avoidIf: AvoidRow[]; // structured "who should avoid"
  modifications: string;
  steps: Step[];
  variations: Variations;
};

// Raw asana literals (without the merged extras). The fully-typed ASANAS
// array below is produced by merging EXTRAS into these at module load.
type RawAsana = Omit<Asana, "avoidIf" | "variations">;

const RAW_ASANAS: RawAsana[] = [
  {
    slug: "tadasana",
    sanskrit: "Tadasana",
    english: "Mountain Pose",
    category: "Standing",
    difficulty: "Beginner",
    hold: "30–60 sec",
    holdSeconds: 45,
    pose: "mountain",
    summary: "The foundation of all standing poses — grounded, tall, and steady.",
    breathing: "Breathe slow and even through the nose, lengthening the spine on each inhale.",
    benefits: ["Improves posture and body awareness", "Strengthens thighs, knees, and ankles", "Calms the mind and steadies the breath"],
    contraindications: ["Low blood pressure (rise slowly)", "Dizziness or vertigo"],
    modifications: "Stand with feet hip-width apart for more stability, or against a wall to feel alignment.",
    steps: [
      { text: "Stand at the top of your mat, feet together or hip-width apart, weight even across both feet.", pose: "mountain" },
      { text: "Engage the thighs, lift the kneecaps gently, and lengthen the tailbone down.", pose: "mountain" },
      { text: "Roll the shoulders back and down, arms relaxed alongside the body, palms facing forward.", pose: "mountain" },
      { text: "Crown of the head reaches upward; soften the face and breathe steadily.", pose: "mountain" },
    ],
  },
  {
    slug: "vrksasana",
    sanskrit: "Vrksasana",
    english: "Tree Pose",
    category: "Standing",
    difficulty: "Beginner",
    hold: "30 sec each side",
    holdSeconds: 30,
    pose: "tree",
    summary: "A balancing pose that cultivates focus, calm, and rootedness.",
    breathing: "Steady ujjayi breath; fix your gaze on one still point to hold balance.",
    benefits: ["Improves balance and concentration", "Strengthens ankles, calves, and core", "Opens the hips and chest"],
    contraindications: ["Recent ankle or knee injury", "Migraine or severe low blood pressure"],
    modifications: "Rest the foot on the calf instead of the thigh, or keep toes lightly on the floor with heel on ankle.",
    steps: [
      { text: "Begin in Mountain Pose and shift your weight into the left foot.", pose: "mountain" },
      { text: "Bend the right knee and place the sole of the right foot on the inner left thigh or calf (avoid the knee).", pose: "tree" },
      { text: "Press foot and leg into each other and find a steady gaze.", pose: "tree" },
      { text: "Bring hands to heart or reach the arms overhead like branches.", pose: "tree" },
      { text: "Hold, then switch sides.", pose: "tree" },
    ],
  },
  {
    slug: "virabhadrasana-ii",
    sanskrit: "Virabhadrasana II",
    english: "Warrior II",
    category: "Standing",
    difficulty: "Beginner",
    hold: "30–45 sec each side",
    holdSeconds: 40,
    pose: "warrior-2",
    summary: "A powerful standing pose that builds stamina and steady focus.",
    breathing: "Breathe deeply into the ribs; soften the shoulders as you settle into the lunge.",
    benefits: ["Strengthens legs, glutes, and shoulders", "Opens the hips and chest", "Builds endurance and concentration"],
    contraindications: ["Knee injury (mind front-knee tracking)", "High blood pressure", "Diarrhea"],
    modifications: "Shorten the stance to reduce intensity; rest the back hand on the hip.",
    steps: [
      { text: "From a wide stance, turn the right foot out 90° and the left foot in slightly.", pose: "mountain" },
      { text: "Bend the right knee toward 90°, keeping it stacked over the ankle.", pose: "warrior-2" },
      { text: "Extend the arms parallel to the floor, reaching actively in both directions.", pose: "warrior-2" },
      { text: "Turn the head to gaze over the front fingertips; sink the hips.", pose: "warrior-2" },
      { text: "Hold with steady breath, then repeat on the other side.", pose: "warrior-2" },
    ],
  },
  {
    slug: "virabhadrasana-i",
    sanskrit: "Virabhadrasana I",
    english: "Warrior I",
    category: "Standing",
    difficulty: "Intermediate",
    hold: "30–45 sec each side",
    holdSeconds: 40,
    pose: "warrior-1",
    summary: "A grounding lunge with uplifted arms that opens the front body.",
    breathing: "Inhale to lengthen up through the arms; exhale to root the back heel.",
    benefits: ["Strengthens legs and core", "Stretches hip flexors and chest", "Improves focus and balance"],
    contraindications: ["High blood pressure", "Shoulder issues (keep arms wider)", "Heart conditions"],
    modifications: "Keep hands on hips, or shorten the stance and lift the back heel.",
    steps: [
      { text: "Step the left foot back, heel turned down at 45°, hips facing forward.", pose: "low-lunge" },
      { text: "Bend the front knee over the ankle.", pose: "warrior-1" },
      { text: "Sweep the arms overhead, biceps by the ears, palms facing.", pose: "warrior-1" },
      { text: "Lift the chest, soften the shoulders, and gaze forward or up. Switch sides.", pose: "warrior-1" },
    ],
  },
  {
    slug: "trikonasana",
    sanskrit: "Trikonasana",
    english: "Triangle Pose",
    category: "Standing",
    difficulty: "Beginner",
    hold: "30–45 sec each side",
    holdSeconds: 40,
    pose: "triangle",
    summary: "A long lateral stretch that lengthens the side body and hamstrings.",
    breathing: "Inhale to lengthen the spine; exhale to settle deeper into the side bend.",
    benefits: ["Stretches hamstrings, hips, and side body", "Strengthens legs and core", "Relieves back stiffness"],
    contraindications: ["Low blood pressure", "Neck issues (don't turn head up)", "Headache"],
    modifications: "Rest the bottom hand on a block or shin instead of the floor.",
    steps: [
      { text: "From a wide stance, turn the front foot out and extend the arms wide.", pose: "warrior-2" },
      { text: "Reach forward over the front leg, then lower the front hand to shin, block, or floor.", pose: "triangle" },
      { text: "Extend the top arm to the sky, stacking the shoulders.", pose: "triangle" },
      { text: "Lengthen evenly through both sides of the waist. Switch sides.", pose: "triangle" },
    ],
  },
  {
    slug: "utkatasana",
    sanskrit: "Utkatasana",
    english: "Chair Pose",
    category: "Standing",
    difficulty: "Beginner",
    hold: "30 sec",
    holdSeconds: 30,
    pose: "chair",
    summary: "A heating pose that builds strength in the legs and core.",
    breathing: "Inhale to lift the arms; exhale to sit deeper, drawing the navel in.",
    benefits: ["Strengthens thighs, glutes, and ankles", "Tones the core", "Builds heat and stamina"],
    contraindications: ["Knee pain", "Low blood pressure", "Insomnia"],
    modifications: "Keep hands at heart center, or sit less deeply to ease knee load.",
    steps: [
      { text: "Stand with feet together or hip-width apart.", pose: "mountain" },
      { text: "Bend the knees and sit the hips back as if into a chair.", pose: "chair" },
      { text: "Sweep the arms overhead, biceps by the ears.", pose: "chair" },
      { text: "Keep the chest lifted and weight in the heels; breathe steadily.", pose: "chair" },
    ],
  },
  {
    slug: "ardha-chandrasana",
    sanskrit: "Ardha Chandrasana",
    english: "Half Moon Pose",
    category: "Standing",
    difficulty: "Intermediate",
    hold: "20–30 sec each side",
    holdSeconds: 25,
    pose: "half-moon",
    summary: "A balancing pose that builds coordination, strength, and openness.",
    breathing: "Breathe smoothly; lengthen on the inhale, stabilize on the exhale.",
    benefits: ["Strengthens ankles, legs, and core", "Improves balance and coordination", "Opens chest and hips"],
    contraindications: ["Low blood pressure", "Headache or migraine", "Neck injury"],
    modifications: "Use a block under the lower hand and practice with the back against a wall.",
    steps: [
      { text: "From Triangle, bend the front knee and walk the bottom hand forward onto a block.", pose: "triangle" },
      { text: "Shift weight onto the front foot and float the back leg parallel to the floor.", pose: "half-moon" },
      { text: "Stack the hips and open the chest, top arm reaching up.", pose: "half-moon" },
      { text: "Find a steady gaze. Switch sides.", pose: "half-moon" },
    ],
  },
  {
    slug: "sukhasana",
    sanskrit: "Sukhasana",
    english: "Easy Seat",
    category: "Seated",
    difficulty: "Beginner",
    hold: "1–5 min",
    holdSeconds: 60,
    pose: "seated",
    summary: "A simple cross-legged seat for breathwork and meditation.",
    breathing: "Long, smooth diaphragmatic breaths; let the belly soften.",
    benefits: ["Opens the hips", "Lengthens the spine", "Calms the nervous system"],
    contraindications: ["Knee injury (sit elevated)", "Sciatica"],
    modifications: "Sit on a folded blanket or cushion to lift the hips above the knees.",
    steps: [
      { text: "Sit and cross the shins comfortably, each foot under the opposite knee.", pose: "seated" },
      { text: "Lift the hips onto a cushion so the knees rest below the hips.", pose: "seated" },
      { text: "Stack the spine tall, shoulders relaxed, hands on knees.", pose: "seated" },
      { text: "Soften the gaze or close the eyes and breathe.", pose: "seated" },
    ],
  },
  {
    slug: "padmasana",
    sanskrit: "Padmasana",
    english: "Lotus Pose",
    category: "Seated",
    difficulty: "Advanced",
    hold: "1–5 min",
    holdSeconds: 60,
    pose: "seated",
    summary: "The classic meditation seat — requires open hips and knees.",
    breathing: "Slow, even breath to settle into stillness.",
    benefits: ["Deeply opens hips", "Steadies the mind for meditation", "Improves posture"],
    contraindications: ["Knee or ankle injury", "Tight hips (use Half Lotus or Easy Seat instead)"],
    modifications: "Practice Half Lotus or Easy Seat; never force the knee.",
    steps: [
      { text: "From a seated position, place the right foot on the left thigh.", pose: "seated" },
      { text: "Then place the left foot on the right thigh (Half Lotus if only one).", pose: "seated" },
      { text: "Lengthen the spine and rest the hands on the knees.", pose: "seated" },
      { text: "Breathe softly and stay only as long as the knees feel safe.", pose: "seated" },
    ],
  },
  {
    slug: "navasana",
    sanskrit: "Navasana",
    english: "Boat Pose",
    category: "Seated",
    difficulty: "Intermediate",
    hold: "20–30 sec",
    holdSeconds: 25,
    pose: "boat",
    summary: "A core-strengthening balance on the sit bones.",
    breathing: "Breathe steadily; avoid holding the breath as the core engages.",
    benefits: ["Strengthens the core and hip flexors", "Improves balance", "Tones the spine"],
    contraindications: ["Low back injury", "Pregnancy", "Recent abdominal surgery"],
    modifications: "Bend the knees, keep shins parallel to the floor, or hold the backs of the thighs.",
    steps: [
      { text: "Sit with knees bent, feet on the floor, hands behind the thighs.", pose: "seated" },
      { text: "Lean back slightly and lift the feet, shins parallel to the floor.", pose: "boat" },
      { text: "If steady, straighten the legs toward a V shape.", pose: "boat" },
      { text: "Reach the arms forward and lift the chest.", pose: "boat" },
    ],
  },
  {
    slug: "baddha-konasana",
    sanskrit: "Baddha Konasana",
    english: "Butterfly / Bound Angle",
    category: "Hip Openers",
    difficulty: "Beginner",
    hold: "1–3 min",
    holdSeconds: 60,
    pose: "butterfly",
    summary: "A gentle, grounding hip opener for the inner thighs and groin.",
    breathing: "Long exhales; let the knees soften toward the floor with gravity.",
    benefits: ["Opens hips and inner thighs", "Stimulates circulation", "Soothes the nervous system"],
    contraindications: ["Groin or knee injury", "Sciatica (sit elevated)"],
    modifications: "Sit on a cushion and place blocks under the knees for support.",
    steps: [
      { text: "Sit tall and bring the soles of the feet together, knees falling open.", pose: "butterfly" },
      { text: "Hold the feet or ankles and lengthen the spine.", pose: "butterfly" },
      { text: "To deepen, hinge forward from the hips with a long spine.", pose: "butterfly" },
      { text: "Relax the inner thighs and breathe.", pose: "butterfly" },
    ],
  },
  {
    slug: "eka-pada-rajakapotasana",
    sanskrit: "Eka Pada Rajakapotasana",
    english: "Pigeon Pose",
    category: "Hip Openers",
    difficulty: "Intermediate",
    hold: "1–2 min each side",
    holdSeconds: 60,
    pose: "pigeon",
    summary: "A deep hip and glute opener that releases stored tension.",
    breathing: "Slow, surrendering breaths; relax deeper on each exhale.",
    benefits: ["Opens hip rotators and glutes", "Stretches hip flexors of the back leg", "Releases low-back tension"],
    contraindications: ["Knee injury", "Sacroiliac issues", "Tight hips (use a prop)"],
    modifications: "Place a blanket or block under the front-leg hip to keep the pelvis level.",
    steps: [
      { text: "From all fours, bring the right knee toward the right wrist, shin angled across.", pose: "low-lunge" },
      { text: "Extend the left leg straight back, top of the foot on the floor.", pose: "pigeon" },
      { text: "Square the hips and support the front hip with a prop if needed.", pose: "pigeon" },
      { text: "Stay upright or fold forward over the front shin. Switch sides.", pose: "pigeon" },
    ],
  },
  {
    slug: "anjaneyasana",
    sanskrit: "Anjaneyasana",
    english: "Low Lunge",
    category: "Hip Openers",
    difficulty: "Beginner",
    hold: "30–60 sec each side",
    holdSeconds: 45,
    pose: "low-lunge",
    summary: "A foundational lunge that opens the hip flexors and front body.",
    breathing: "Inhale to lift the chest; exhale to sink the hips forward.",
    benefits: ["Stretches hip flexors and quadriceps", "Opens the chest", "Builds leg stability"],
    contraindications: ["Knee sensitivity (pad the back knee)", "High blood pressure (keep hands down)"],
    modifications: "Cushion the back knee with a blanket; keep hands on the front thigh.",
    steps: [
      { text: "From Downward Dog, step the right foot forward between the hands.", pose: "down-dog" },
      { text: "Lower the back knee to the floor and untuck the toes.", pose: "low-lunge" },
      { text: "Sink the hips forward to feel the front of the back hip open.", pose: "low-lunge" },
      { text: "Sweep the arms up or rest hands on the front thigh. Switch sides.", pose: "low-lunge" },
    ],
  },
  {
    slug: "utthan-pristhasana",
    sanskrit: "Utthan Pristhasana",
    english: "Lizard Pose",
    category: "Hip Openers",
    difficulty: "Intermediate",
    hold: "45–90 sec each side",
    holdSeconds: 60,
    pose: "lizard",
    summary: "A deep lunge targeting the hips and hamstrings — key for splits.",
    breathing: "Breathe into any tightness; soften with each exhale.",
    benefits: ["Deeply opens hips and hip flexors", "Stretches hamstrings", "Prepares the body for splits"],
    contraindications: ["Knee or hip injury", "Recent groin strain"],
    modifications: "Stay on the hands or place forearms on a block instead of the floor.",
    steps: [
      { text: "From a low lunge, walk the front foot out toward the edge of the mat.", pose: "low-lunge" },
      { text: "Lower onto the forearms (or a block) inside the front foot.", pose: "lizard" },
      { text: "Keep the back leg active, knee lifted or lowered.", pose: "lizard" },
      { text: "Breathe and stay; switch sides." , pose: "lizard" },
    ],
  },
  {
    slug: "uttanasana",
    sanskrit: "Uttanasana",
    english: "Standing Forward Fold",
    category: "Forward Bends",
    difficulty: "Beginner",
    hold: "30–60 sec",
    holdSeconds: 45,
    pose: "forward-fold",
    summary: "A calming forward fold that lengthens the entire back body.",
    breathing: "Lengthen the spine on the inhale; fold a little deeper on the exhale.",
    benefits: ["Stretches hamstrings and calves", "Calms the mind", "Relieves tension in the neck and back"],
    contraindications: ["Low back injury (bend knees)", "High blood pressure", "Glaucoma"],
    modifications: "Bend the knees generously and rest the hands on blocks or shins.",
    steps: [
      { text: "From standing, hinge at the hips and fold forward with a long spine.", pose: "mountain" },
      { text: "Let the head hang heavy and bend the knees as needed.", pose: "forward-fold" },
      { text: "Rest hands on the floor, blocks, or opposite elbows.", pose: "forward-fold" },
      { text: "Release the neck and breathe into the back of the legs.", pose: "forward-fold" },
    ],
  },
  {
    slug: "paschimottanasana",
    sanskrit: "Paschimottanasana",
    english: "Seated Forward Bend",
    category: "Forward Bends",
    difficulty: "Beginner",
    hold: "1–3 min",
    holdSeconds: 60,
    pose: "seated-fold",
    summary: "A quieting forward fold over straight legs.",
    breathing: "Inhale to lengthen; exhale to fold from the hips, not the spine.",
    benefits: ["Stretches the entire back body", "Calms the nervous system", "Aids digestion"],
    contraindications: ["Low back injury", "Sciatica (sit elevated, bend knees)", "Asthma"],
    modifications: "Sit on a cushion, bend the knees, and loop a strap around the feet.",
    steps: [
      { text: "Sit with legs extended forward, spine tall.", pose: "seated" },
      { text: "Inhale and reach the arms up to lengthen the spine.", pose: "seated" },
      { text: "Exhale and hinge from the hips, reaching toward the feet.", pose: "seated-fold" },
      { text: "Hold the shins, feet, or a strap. Keep the spine long.", pose: "seated-fold" },
    ],
  },
  {
    slug: "parsvottanasana",
    sanskrit: "Parsvottanasana",
    english: "Pyramid Pose",
    category: "Forward Bends",
    difficulty: "Intermediate",
    hold: "30–45 sec each side",
    holdSeconds: 40,
    pose: "pyramid",
    summary: "An intense hamstring stretch over a straight front leg.",
    breathing: "Lengthen the spine with each inhale before folding deeper.",
    benefits: ["Deeply stretches hamstrings", "Improves balance", "Strengthens legs"],
    contraindications: ["High blood pressure", "Low back injury", "Hamstring tear"],
    modifications: "Place blocks under the hands and keep a soft bend in the front knee.",
    steps: [
      { text: "From standing, step one foot back, both feet facing forward, hips square.", pose: "mountain" },
      { text: "Place hands on hips or blocks beside the front foot.", pose: "pyramid" },
      { text: "Hinge forward over the front leg, keeping the spine long.", pose: "pyramid" },
      { text: "Draw the front-leg hip back to square the pelvis. Switch sides.", pose: "pyramid" },
    ],
  },
  {
    slug: "bhujangasana",
    sanskrit: "Bhujangasana",
    english: "Cobra Pose",
    category: "Backbends",
    difficulty: "Beginner",
    hold: "20–30 sec",
    holdSeconds: 25,
    pose: "cobra",
    summary: "A gentle backbend that strengthens the spine and opens the chest.",
    breathing: "Inhale to lift; keep the breath flowing as the chest opens.",
    benefits: ["Strengthens the spine", "Opens chest and shoulders", "Soothes sciatica"],
    contraindications: ["Back injury", "Pregnancy", "Carpal tunnel syndrome"],
    modifications: "Keep the elbows bent and lift only slightly (Baby Cobra).",
    steps: [
      { text: "Lie on the belly, hands under the shoulders, legs extended back.", pose: "savasana" },
      { text: "Press the tops of the feet and pubic bone down.", pose: "cobra" },
      { text: "Inhale and lift the chest, drawing the shoulders back.", pose: "cobra" },
      { text: "Keep a slight bend in the elbows and the neck long.", pose: "cobra" },
    ],
  },
  {
    slug: "setu-bandhasana",
    sanskrit: "Setu Bandha Sarvangasana",
    english: "Bridge Pose",
    category: "Backbends",
    difficulty: "Beginner",
    hold: "30–60 sec",
    holdSeconds: 45,
    pose: "bridge",
    summary: "A supported backbend that opens the chest and strengthens the back.",
    breathing: "Breathe into the chest; keep the throat soft and relaxed.",
    benefits: ["Strengthens back, glutes, and hamstrings", "Opens the chest", "Calms the mind"],
    contraindications: ["Neck injury", "Shoulder issues"],
    modifications: "Place a block under the sacrum for a restorative supported bridge.",
    steps: [
      { text: "Lie on your back, knees bent, feet hip-width apart near the hips.", pose: "savasana" },
      { text: "Press the feet down and lift the hips toward the sky.", pose: "bridge" },
      { text: "Interlace the hands beneath you and roll the shoulders under.", pose: "bridge" },
      { text: "Keep the knees parallel and breathe into the chest.", pose: "bridge" },
    ],
  },
  {
    slug: "ustrasana",
    sanskrit: "Ustrasana",
    english: "Camel Pose",
    category: "Backbends",
    difficulty: "Intermediate",
    hold: "20–30 sec",
    holdSeconds: 25,
    pose: "camel",
    summary: "A heart-opening kneeling backbend.",
    breathing: "Keep the breath steady; never hold the breath in a backbend.",
    benefits: ["Opens chest, abdomen, and hip flexors", "Strengthens the back", "Improves posture"],
    contraindications: ["Neck or low back injury", "High or low blood pressure", "Migraine"],
    modifications: "Tuck the toes to raise the heels, or keep hands on the low back.",
    steps: [
      { text: "Kneel with knees hip-width, shins down, hands on the low back.", pose: "seated" },
      { text: "Lift the chest and press the hips forward.", pose: "camel" },
      { text: "Reach the hands back toward the heels (or keep them on the back).", pose: "camel" },
      { text: "Lengthen the neck and breathe; rise slowly to exit.", pose: "camel" },
    ],
  },
  {
    slug: "urdhva-dhanurasana",
    sanskrit: "Urdhva Dhanurasana",
    english: "Wheel Pose",
    category: "Backbends",
    difficulty: "Advanced",
    hold: "15–30 sec",
    holdSeconds: 20,
    pose: "wheel",
    summary: "A full backbend that opens the entire front body.",
    breathing: "Breathe smoothly; press evenly through hands and feet.",
    benefits: ["Deeply opens chest, shoulders, and hip flexors", "Strengthens arms, legs, and spine", "Energizes the body"],
    contraindications: ["Back, wrist, or shoulder injury", "High or low blood pressure", "Heart conditions"],
    modifications: "Practice Bridge Pose first, or press up onto the crown before fully extending.",
    steps: [
      { text: "Lie on your back, knees bent, feet flat near the hips.", pose: "savasana" },
      { text: "Place the hands by the ears, fingers toward the shoulders.", pose: "bridge" },
      { text: "Press into hands and feet to lift the hips and crown off the floor.", pose: "wheel" },
      { text: "Straighten the arms, opening the chest. Lower with control.", pose: "wheel" },
    ],
  },
  {
    slug: "sirsasana",
    sanskrit: "Sirsasana",
    english: "Headstand",
    category: "Inversions",
    difficulty: "Advanced",
    hold: "30 sec–3 min",
    holdSeconds: 45,
    pose: "headstand",
    summary: "The 'king' of asanas — a balancing inversion requiring core control.",
    breathing: "Steady, even breath; engage the core to avoid weight on the head.",
    benefits: ["Strengthens the core and shoulders", "Improves circulation and focus", "Calms the mind"],
    contraindications: ["Neck injury", "High blood pressure", "Glaucoma", "Pregnancy"],
    modifications: "Practice against a wall, or stay in Dolphin Pose to build strength first.",
    steps: [
      { text: "Kneel and interlace the fingers, forearms on the floor, elbows shoulder-width.", pose: "child" },
      { text: "Place the crown of the head down, cradled by the hands.", pose: "child" },
      { text: "Lift the hips and walk the feet in, then float the legs up.", pose: "headstand" },
      { text: "Stack hips over shoulders; press firmly through the forearms.", pose: "headstand" },
    ],
  },
  {
    slug: "adho-mukha-svanasana",
    sanskrit: "Adho Mukha Svanasana",
    english: "Downward-Facing Dog",
    category: "Inversions",
    difficulty: "Beginner",
    hold: "30–60 sec",
    holdSeconds: 45,
    pose: "down-dog",
    summary: "A foundational pose that stretches and strengthens the whole body.",
    breathing: "Breathe deeply; pedal the feet to ease into the hamstrings.",
    benefits: ["Stretches hamstrings, calves, and shoulders", "Strengthens arms and legs", "Energizes the body"],
    contraindications: ["Wrist injury (carpal tunnel)", "High blood pressure", "Late pregnancy"],
    modifications: "Bend the knees generously and lift the heels; use blocks under the hands.",
    steps: [
      { text: "From all fours, tuck the toes and lift the hips up and back.", pose: "cat" },
      { text: "Straighten the legs as comfortable, forming an inverted V.", pose: "down-dog" },
      { text: "Spread the fingers and press the floor away, lengthening the spine.", pose: "down-dog" },
      { text: "Relax the neck and draw the heels toward the floor.", pose: "down-dog" },
    ],
  },
  {
    slug: "viparita-karani",
    sanskrit: "Viparita Karani",
    english: "Legs Up the Wall",
    category: "Restorative",
    difficulty: "Beginner",
    hold: "5–15 min",
    holdSeconds: 120,
    pose: "legs-up",
    summary: "A deeply restorative inversion that calms the nervous system.",
    breathing: "Slow natural breath; let the body grow heavy and still.",
    benefits: ["Relieves tired legs and feet", "Calms the mind", "Eases mild anxiety and insomnia"],
    contraindications: ["Glaucoma", "Serious back or neck issues"],
    modifications: "Place a folded blanket under the hips for support and comfort.",
    steps: [
      { text: "Sit sideways against a wall, then swing the legs up as you lie back.", pose: "savasana" },
      { text: "Scoot the hips close to the wall, legs resting up.", pose: "legs-up" },
      { text: "Let the arms rest open at your sides, palms up.", pose: "legs-up" },
      { text: "Close the eyes and breathe softly.", pose: "legs-up" },
    ],
  },
  {
    slug: "balasana",
    sanskrit: "Balasana",
    english: "Child's Pose",
    category: "Restorative",
    difficulty: "Beginner",
    hold: "1–3 min",
    holdSeconds: 60,
    pose: "child",
    summary: "A gentle resting pose that releases the back and quiets the mind.",
    breathing: "Breathe into the back of the ribs; let each exhale soften you.",
    benefits: ["Releases the back and hips", "Calms the nervous system", "Relieves fatigue"],
    contraindications: ["Knee injury", "Pregnancy (widen the knees)", "Recent ankle injury"],
    modifications: "Widen the knees, rest the forehead on a block, or place a bolster under the torso.",
    steps: [
      { text: "Kneel and sit back toward the heels, knees together or wide.", pose: "seated" },
      { text: "Fold forward and rest the forehead on the floor or a block.", pose: "child" },
      { text: "Extend the arms forward or rest them alongside the body.", pose: "child" },
      { text: "Soften completely and breathe slowly.", pose: "child" },
    ],
  },
  {
    slug: "savasana",
    sanskrit: "Savasana",
    english: "Corpse Pose",
    category: "Restorative",
    difficulty: "Beginner",
    hold: "5–10 min",
    holdSeconds: 180,
    pose: "savasana",
    summary: "Total relaxation — the essential closing pose of every practice.",
    breathing: "Let the breath become natural and effortless; fully release control.",
    benefits: ["Deeply relaxes body and mind", "Lowers stress and blood pressure", "Integrates the practice"],
    contraindications: ["Late pregnancy (lie on side)", "Low back discomfort (bend knees)"],
    modifications: "Place a bolster under the knees and a blanket over the body for warmth.",
    steps: [
      { text: "Lie on your back, legs extended, arms a little away from the body, palms up.", pose: "savasana" },
      { text: "Let the feet fall open and the whole body grow heavy.", pose: "savasana" },
      { text: "Soften the face, jaw, and breath.", pose: "savasana" },
      { text: "Rest in stillness, then slowly return when ready.", pose: "savasana" },
    ],
  },
  {
    slug: "ardha-hanumanasana",
    sanskrit: "Ardha Hanumanasana",
    english: "Half Split",
    category: "Forward Bends",
    difficulty: "Intermediate",
    hold: "45–90 sec each side",
    holdSeconds: 60,
    pose: "half-split",
    summary: "A focused hamstring stretch and the key stepping stone to the full split.",
    breathing: "Lengthen the spine on each inhale; ease forward on each exhale.",
    benefits: ["Stretches hamstrings and calves", "Prepares the body for Hanumanasana", "Lengthens the spine"],
    contraindications: ["Hamstring tear", "Knee sensitivity (pad the back knee)"],
    modifications: "Place blocks under the hands and keep the front knee slightly bent.",
    steps: [
      { text: "From a low lunge, straighten the front leg and shift the hips back.", pose: "low-lunge" },
      { text: "Flex the front foot, toes pointing up.", pose: "half-split" },
      { text: "Walk the hands back beside the front hip onto blocks.", pose: "half-split" },
      { text: "Hinge forward over the straight leg with a long spine. Switch sides.", pose: "half-split" },
    ],
  },
  {
    slug: "hanumanasana",
    sanskrit: "Hanumanasana",
    english: "Front Splits",
    category: "Hip Openers",
    difficulty: "Advanced",
    hold: "30–60 sec each side",
    holdSeconds: 45,
    pose: "full-split",
    summary: "The full front split — front-leg hamstrings and back-leg hip flexors fully lengthened.",
    breathing: "Stay patient; breathe slowly and never force the descent.",
    benefits: ["Deeply stretches hamstrings and hip flexors", "Opens the entire lower body", "Builds focus and patience"],
    contraindications: ["Hamstring or groin injury", "Recent hip surgery", "Sacroiliac instability"],
    modifications: "Place blocks under both hands and a bolster or block under the front-leg hip.",
    steps: [
      { text: "From a low lunge, place blocks on either side of the front foot.", pose: "low-lunge" },
      { text: "Slowly slide the front heel forward and the back knee back.", pose: "half-split" },
      { text: "Support the front hip with a block or bolster as you descend.", pose: "full-split" },
      { text: "Keep the hips square and the back toes pointed. Rise gently; switch sides.", pose: "full-split" },
    ],
  },
  {
    slug: "marichyasana-twist",
    sanskrit: "Marichyasana",
    english: "Seated Twist",
    category: "Seated",
    difficulty: "Intermediate",
    hold: "30–45 sec each side",
    holdSeconds: 40,
    pose: "twist",
    summary: "A detoxifying seated twist that mobilizes the spine.",
    breathing: "Inhale to lengthen the spine; exhale to twist a little deeper.",
    benefits: ["Improves spinal mobility", "Aids digestion", "Relieves back tension"],
    contraindications: ["Spinal injury", "Pregnancy", "Recent abdominal surgery"],
    modifications: "Keep both legs extended and twist gently with the opposite hand on the knee.",
    steps: [
      { text: "Sit with the legs extended, then bend the right knee, foot flat.", pose: "seated" },
      { text: "Inhale and lengthen the spine tall.", pose: "seated" },
      { text: "Exhale and twist toward the bent knee, hooking the opposite elbow.", pose: "twist" },
      { text: "Gaze over the back shoulder. Switch sides.", pose: "twist" },
    ],
  },
];

// Merge per-asana extras (variations, structured contraindications, step
// motions) from variations.ts into the fully-typed ASANAS array.
export const ASANAS: Asana[] = RAW_ASANAS.map((raw) => {
  const extra = EXTRAS[raw.slug];
  const steps: Step[] = raw.steps.map((step, i) => ({
    ...step,
    stepMotion: step.stepMotion ?? extra?.stepMotions[i],
  }));
  return {
    ...raw,
    steps,
    avoidIf: extra?.avoidIf ?? [],
    variations: extra?.variations ?? {
      beginner: { description: raw.modifications, props: [], cues: [], holdSeconds: raw.holdSeconds },
      intermediate: { description: raw.summary, props: [], cues: [], holdSeconds: raw.holdSeconds },
      advanced: { description: raw.summary, props: [], cues: [], holdSeconds: raw.holdSeconds },
    },
  };
});

// ---- Warm-up routine (shown above pathways) ----
export const WARMUP = {
  title: "Always warm up first — 5 min",
  description: "A short cat/cow and sun-salutation sequence to wake up the spine and joints before any pathway.",
  steps: [
    { name: "Cat / Cow", pose: "cat", detail: "8–10 rounds, syncing spine movement with breath" },
    { name: "Sun Salutation A", pose: "forward-fold", detail: "3–5 slow rounds to build gentle heat" },
    { name: "Low Lunge", pose: "low-lunge", detail: "30 sec each side to open the hip flexors" },
    { name: "Forward Fold", pose: "forward-fold", detail: "30 sec to lengthen the hamstrings" },
  ],
};

export type PathwayWeek = {
  week: number;
  focus: string;
  warmup: string;
  asanas: { name: string; hold: string }[];
};

export type Pathway = {
  slug: string;
  name: string;
  target: string; // target pose english name
  targetPose: string; // PoseSvg key
  weeks: number;
  sessionsPerWeek: number;
  timePerSession: string;
  summary: string;
  schedule: PathwayWeek[];
};

export const PATHWAYS: Pathway[] = [
  {
    slug: "front-splits",
    name: "Front Splits",
    target: "Hanumanasana",
    targetPose: "full-split",
    weeks: 8,
    sessionsPerWeek: 4,
    timePerSession: "15 min, 4x/week",
    summary:
      "A patient 8-week progression toward the full front split, building from gentle hip-flexor and hamstring openers to active flexibility and the approach to Hanumanasana with props.",
    schedule: [
      {
        week: 1,
        focus: "Warm-ups & gentle opening",
        warmup: "5 min cat/cow + sun salutation",
        asanas: [
          { name: "Low Lunge", hold: "45 sec each side" },
          { name: "Butterfly / Bound Angle", hold: "2 min" },
          { name: "Standing Forward Fold", hold: "1 min" },
        ],
      },
      {
        week: 2,
        focus: "Hip flexor & hamstring stretches",
        warmup: "5 min cat/cow + sun salutation",
        asanas: [
          { name: "Low Lunge", hold: "60 sec each side" },
          { name: "Half Split", hold: "45 sec each side" },
          { name: "Pigeon Pose", hold: "1 min each side" },
        ],
      },
      {
        week: 3,
        focus: "Deepening — Lizard & Couch Stretch",
        warmup: "5 min cat/cow + sun salutation",
        asanas: [
          { name: "Lizard Pose", hold: "60 sec each side" },
          { name: "Couch Stretch", hold: "45 sec each side" },
          { name: "Half Split", hold: "60 sec each side" },
        ],
      },
      {
        week: 4,
        focus: "Deepening — Half Hanumanasana with blocks",
        warmup: "5 min cat/cow + sun salutation",
        asanas: [
          { name: "Half Split (Ardha Hanumanasana) on blocks", hold: "90 sec each side" },
          { name: "Lizard Pose", hold: "75 sec each side" },
          { name: "Pigeon Pose", hold: "90 sec each side" },
        ],
      },
      {
        week: 5,
        focus: "Active flexibility — Pyramid",
        warmup: "5 min cat/cow + sun salutation",
        asanas: [
          { name: "Pyramid Pose", hold: "45 sec each side" },
          { name: "Half Split", hold: "90 sec each side" },
          { name: "Low Lunge (active)", hold: "60 sec each side" },
        ],
      },
      {
        week: 6,
        focus: "Active flexibility — Standing Splits",
        warmup: "5 min cat/cow + sun salutation",
        asanas: [
          { name: "Standing Splits", hold: "30 sec each side" },
          { name: "Pyramid Pose", hold: "60 sec each side" },
          { name: "Half Split", hold: "2 min each side" },
        ],
      },
      {
        week: 7,
        focus: "Approach full pose — blocks under hands",
        warmup: "5 min cat/cow + sun salutation",
        asanas: [
          { name: "Hanumanasana — blocks under both hands", hold: "30 sec each side" },
          { name: "Half Split", hold: "2 min each side" },
          { name: "Lizard Pose", hold: "90 sec each side" },
        ],
      },
      {
        week: 8,
        focus: "Approach full pose — block under hip, progressive depth",
        warmup: "5 min cat/cow + sun salutation",
        asanas: [
          { name: "Hanumanasana — block under front hip, lowering progressively", hold: "45 sec each side" },
          { name: "Hanumanasana — hands on floor if available", hold: "30 sec each side" },
          { name: "Pigeon Pose (cool down)", hold: "2 min each side" },
        ],
      },
    ],
  },
  {
    slug: "wheel-backbend",
    name: "Backbend / Wheel Pose",
    target: "Urdhva Dhanurasana",
    targetPose: "wheel",
    weeks: 6,
    sessionsPerWeek: 3,
    timePerSession: "18 min, 3x/week",
    summary:
      "A 6-week plan that builds spinal mobility, shoulder opening, and hip-flexor length to safely reach full Wheel Pose.",
    schedule: [
      {
        week: 1,
        focus: "Spine awareness",
        warmup: "5 min cat/cow + sun salutation",
        asanas: [
          { name: "Cobra Pose", hold: "30 sec x3" },
          { name: "Bridge Pose", hold: "45 sec x3" },
          { name: "Low Lunge", hold: "45 sec each side" },
        ],
      },
      {
        week: 2,
        focus: "Chest & shoulder opening",
        warmup: "5 min cat/cow + sun salutation",
        asanas: [
          { name: "Bridge Pose (clasped hands)", hold: "60 sec x3" },
          { name: "Cobra Pose", hold: "30 sec x3" },
          { name: "Low Lunge with backbend", hold: "45 sec each side" },
        ],
      },
      {
        week: 3,
        focus: "Hip flexor length",
        warmup: "5 min cat/cow + sun salutation",
        asanas: [
          { name: "Camel Pose (hands on back)", hold: "20 sec x3" },
          { name: "Bridge Pose", hold: "60 sec x3" },
          { name: "Couch Stretch", hold: "45 sec each side" },
        ],
      },
      {
        week: 4,
        focus: "Deeper backbends",
        warmup: "5 min cat/cow + sun salutation",
        asanas: [
          { name: "Camel Pose (full)", hold: "25 sec x3" },
          { name: "Bridge Pose (one-legged)", hold: "30 sec each side" },
          { name: "Cobra to Upward Dog", hold: "30 sec x4" },
        ],
      },
      {
        week: 5,
        focus: "Wheel prep — crown lifts",
        warmup: "5 min cat/cow + sun salutation",
        asanas: [
          { name: "Wheel Pose — press to crown, hold", hold: "15 sec x3" },
          { name: "Camel Pose", hold: "25 sec x3" },
          { name: "Bridge Pose", hold: "60 sec x3" },
        ],
      },
      {
        week: 6,
        focus: "Full Wheel Pose",
        warmup: "5 min cat/cow + sun salutation",
        asanas: [
          { name: "Wheel Pose — full extension", hold: "20 sec x3" },
          { name: "Camel Pose", hold: "25 sec x2" },
          { name: "Child's Pose (counter-stretch)", hold: "1 min" },
        ],
      },
    ],
  },
  {
    slug: "forward-fold",
    name: "Full Forward Fold",
    target: "Uttanasana / Paschimottanasana",
    targetPose: "forward-fold",
    weeks: 4,
    sessionsPerWeek: 5,
    timePerSession: "12 min, 5x/week",
    summary:
      "A focused 4-week plan to release the hamstrings and lower back for a deep, comfortable forward fold.",
    schedule: [
      {
        week: 1,
        focus: "Gentle hamstring awareness",
        warmup: "5 min cat/cow + sun salutation",
        asanas: [
          { name: "Standing Forward Fold (bent knees)", hold: "1 min" },
          { name: "Half Split", hold: "45 sec each side" },
          { name: "Seated Forward Bend (strap)", hold: "1 min" },
        ],
      },
      {
        week: 2,
        focus: "Lengthening the back body",
        warmup: "5 min cat/cow + sun salutation",
        asanas: [
          { name: "Pyramid Pose", hold: "45 sec each side" },
          { name: "Seated Forward Bend", hold: "90 sec" },
          { name: "Downward-Facing Dog", hold: "1 min" },
        ],
      },
      {
        week: 3,
        focus: "Deepening the fold",
        warmup: "5 min cat/cow + sun salutation",
        asanas: [
          { name: "Standing Forward Fold (straight legs)", hold: "90 sec" },
          { name: "Half Split", hold: "90 sec each side" },
          { name: "Seated Forward Bend", hold: "2 min" },
        ],
      },
      {
        week: 4,
        focus: "Full forward fold",
        warmup: "5 min cat/cow + sun salutation",
        asanas: [
          { name: "Standing Forward Fold (hands flat)", hold: "2 min" },
          { name: "Seated Forward Bend (chest to thighs)", hold: "2 min" },
          { name: "Pyramid Pose", hold: "60 sec each side" },
        ],
      },
    ],
  },
];

export const AFFIRMATIONS: string[] = [
  "My body is strong, supple, and capable.",
  "I breathe in calm, I exhale tension.",
  "Progress, not perfection.",
  "I meet my body where it is today.",
  "Every breath returns me to the present moment.",
  "I am grounded, steady, and at ease.",
  "My practice is a gift I give myself.",
  "I release what no longer serves me.",
  "Stillness lives within me.",
  "I move with patience and kindness toward myself.",
  "My breath is my anchor.",
  "I am exactly where I need to be.",
  "Flexibility grows from consistency, not force.",
  "I honor my limits and trust my growth.",
  "Peace begins with a single breath.",
  "I am open to receiving this moment fully.",
  "My mind is calm, my body is free.",
  "I let go of comparison and return to myself.",
  "Each pose teaches me something new.",
  "I am rooted like a tree and free like the wind.",
  "I trust the process of my unfolding.",
  "Tension melts with every exhale.",
  "I am worthy of rest and renewal.",
  "Strength and softness live within me.",
  "I show up for myself, one breath at a time.",
  "My spine lengthens, my mind clears.",
  "I am present, patient, and at peace.",
  "I greet challenge with steady breath.",
  "Today I choose stillness over rush.",
  "My practice is a sanctuary.",
  "I am grateful for this body and this breath.",
  "Calm is my natural state.",
  "I bend so I do not break.",
  "With each practice, I come home to myself.",
  // --- v3.1 expansion: calm, strength, motherhood, clarity, self-love, sleep ---
  "Each breath returns me to this moment.",
  "I let go of what I cannot control.",
  "Peace is not a place \u2014 it is a practice.",
  "I release the day with a soft exhale.",
  "I am stronger than the moments that try me.",
  "My body knows how to heal.",
  "Every challenge has prepared me for now.",
  "I rise gently, again and again.",
  "The small care I give myself is enough.",
  "Five minutes of mine are also sacred.",
  "I do not need to be everything to be enough.",
  "Rest is part of the work.",
  "My mind is clear and present.",
  "I trust what I already know.",
  "I focus on what is mine to do.",
  "I meet myself with kindness today.",
  "My worth is not measured in productivity.",
  "I am allowed to grow at my own pace.",
  "I release this day with gratitude.",
  "Tomorrow will receive me ready.",
  "Sleep is a soft return.",
  "I breathe slowly and the noise grows quiet.",
  "There is room in me for ease.",
  "I soften where I have been holding on.",
  "This breath is enough for this moment.",
  "I carry calm with me into the day.",
  "My pace is gentle and it is mine.",
  "I am held by my own steady breath.",
  "I forgive myself and begin again.",
  "Quiet moments restore me.",
  "I welcome rest without guilt.",
];

export const MOODS = ["Calm", "Grounded", "Energized", "Tired", "Stressed"] as const;
export type Mood = (typeof MOODS)[number];

export function asanaBySlug(slug: string) {
  return ASANAS.find((a) => a.slug === slug);
}
export function pathwayBySlug(slug: string) {
  return PATHWAYS.find((p) => p.slug === slug);
}

// Deterministic daily affirmation based on date
export function dailyAffirmation(date = new Date()): string {
  const epochDay = Math.floor(date.getTime() / 86400000) - date.getTimezoneOffset() / 1440;
  const idx = Math.abs(Math.floor(epochDay)) % AFFIRMATIONS.length;
  return AFFIRMATIONS[idx];
}


// ---- Pranayama (breathing techniques) ----

export type BreathTechnique = {
  slug: string;
  name: string;
  sanskrit?: string;
  tagline: string;
  description: string;
  // phase pattern, e.g. [{label:"Inhale", seconds:4}, ...]
  phases: { label: string; seconds: number }[];
  defaultRounds: number;
  alternateNostril?: boolean;
  rapid?: boolean;
  pattern: string; // human-readable rhythm label, e.g. "4-4-4-4"
  benefits: string[]; // exactly 3
  avoid: string; // "who should avoid"
};

export const BREATHING: BreathTechnique[] = [
  {
    slug: "box-breathing",
    name: "Box Breathing",
    sanskrit: "Sama Vritti",
    tagline: "Equal four-count breath to steady the nervous system.",
    description:
      "A balanced, square rhythm \u2014 inhale, hold, exhale, hold, each for the same count. Used widely to calm the mind and sharpen focus before a demanding task.",
    phases: [
      { label: "Inhale", seconds: 4 },
      { label: "Hold", seconds: 4 },
      { label: "Exhale", seconds: 4 },
      { label: "Hold", seconds: 4 },
    ],
    defaultRounds: 5,
    pattern: "4-4-4-4",
    benefits: [
      "Calms the nervous system and lowers stress",
      "Improves focus and mental clarity",
      "Easy to learn and practice anywhere",
    ],
    avoid: "Generally safe for everyone. If holding the breath causes anxiety, shorten the holds or skip them.",
  },
  {
    slug: "four-seven-eight",
    name: "4-7-8 Breath",
    sanskrit: "Relaxing Breath",
    tagline: "A long exhale that invites the body toward rest.",
    description:
      "Inhale for four, hold for seven, and exhale slowly for eight. The extended exhale activates the parasympathetic system, making it a favorite for winding down before sleep.",
    phases: [
      { label: "Inhale", seconds: 4 },
      { label: "Hold", seconds: 7 },
      { label: "Exhale", seconds: 8 },
    ],
    defaultRounds: 4,
    pattern: "4-7-8",
    benefits: [
      "Eases the body toward sleep",
      "Reduces anxiety and racing thoughts",
      "Slows the heart rate",
    ],
    avoid: "Start with fewer rounds if you feel lightheaded. Those with low blood pressure should rise slowly afterward.",
  },
  {
    slug: "ujjayi",
    name: "Ujjayi",
    sanskrit: "Victorious Breath",
    tagline: "A soft ocean-sound breath that anchors a flow.",
    description:
      "A gentle constriction at the back of the throat creates a soft, audible ocean sound on an even five-count inhale and exhale. Often paired with movement to keep the mind absorbed.",
    phases: [
      { label: "Inhale", seconds: 5 },
      { label: "Exhale", seconds: 5 },
    ],
    defaultRounds: 8,
    pattern: "5-5",
    benefits: [
      "Builds focus and internal heat",
      "Steadies and lengthens the breath",
      "Soothes the mind during practice",
    ],
    avoid: "Ease off the throat constriction if it strains the voice. Skip if you have a throat infection.",
  },
  {
    slug: "nadi-shodhana",
    name: "Nadi Shodhana",
    sanskrit: "Alternate Nostril",
    tagline: "Balancing breath alternating between the nostrils.",
    description:
      "Breathe through one nostril at a time, switching sides each round, to balance the left and right energy channels. The visualizer indicates which nostril is active each round.",
    phases: [
      { label: "Inhale", seconds: 4 },
      { label: "Hold", seconds: 4 },
      { label: "Exhale", seconds: 4 },
      { label: "Hold", seconds: 4 },
    ],
    defaultRounds: 6,
    alternateNostril: true,
    pattern: "4-4-4-4 \u00b7 alternating sides",
    benefits: [
      "Balances the left and right hemispheres",
      "Calms the mind and reduces stress",
      "Improves respiratory function",
    ],
    avoid: "Skip the nostril blocking if you have a cold or blocked sinuses; breathe evenly through both instead.",
  },
  {
    slug: "bhramari",
    name: "Bhramari",
    sanskrit: "Humming Bee Breath",
    tagline: "A humming exhale that quiets a busy mind.",
    description:
      "Inhale gently, then hum softly like a bee on a long exhale, feeling the vibration in the head and chest. The sound and vibration are deeply soothing to the nervous system.",
    phases: [
      { label: "Inhale", seconds: 4 },
      { label: "Exhale (hum)", seconds: 8 },
    ],
    defaultRounds: 6,
    pattern: "4-8 \u00b7 humming",
    benefits: [
      "Relieves stress, anger, and anxiety",
      "Soothes the nervous system through vibration",
      "Helps quiet mental chatter",
    ],
    avoid: "Avoid forcing the hum. Skip if you have an active ear infection.",
  },
  {
    slug: "kapalabhati",
    name: "Kapalabhati",
    sanskrit: "Skull-Shining Breath",
    tagline: "Rapid, energizing breath of fire.",
    description:
      "Short, forceful exhales through the nose with passive inhales, performed in rapid bursts followed by a rest. Energizing and cleansing \u2014 practice on an empty stomach.",
    phases: [
      { label: "Rapid breaths", seconds: 15 },
      { label: "Rest", seconds: 10 },
    ],
    defaultRounds: 3,
    rapid: true,
    pattern: "rapid pumping \u00b7 rest",
    benefits: [
      "Energizes the body and mind",
      "Strengthens the diaphragm and core",
      "Clears and invigorates the lungs",
    ],
    avoid: "Avoid during pregnancy, with high blood pressure, heart conditions, hernia, or on a full stomach.",
  },
];

export function breathBySlug(slug: string) {
  return BREATHING.find((b) => b.slug === slug);
}

// Deterministic "breath of the day" based on date.
export function breathOfTheDay(date = new Date()): BreathTechnique {
  const epochDay = Math.floor(date.getTime() / 86400000) - date.getTimezoneOffset() / 1440;
  const idx = Math.abs(Math.floor(epochDay)) % BREATHING.length;
  return BREATHING[idx];
}
