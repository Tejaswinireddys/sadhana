// Focus zones (per-step) and stretch zones (per-asana) for the Sadhana library.
// Kept in a dedicated module so the large literal maps don't clutter content.ts.
import type { StretchZone } from "./content";

export type FocusZone = { cx: number; cy: number; r: number; label: string };

// Default focus zone — full body — used by DemoMode when a step has none.
export const DEFAULT_FOCUS_ZONE: FocusZone = { cx: 0.5, cy: 0.5, r: 0.4, label: "Whole body" };

// Per-step focus zones, keyed by asana slug. Coordinates are normalized (0-1)
// assuming a portrait 3:4 image with the figure centered. For the 8 most-used
// asanas we provide a zone for every step; for the rest we provide a zone on
// the LAST step only (sparse arrays — undefined holes are fine).
export const FOCUS_ZONES: Record<string, (FocusZone | undefined)[]> = {
  // --- 8 key asanas: every step ---
  tadasana: [
    { cx: 0.5, cy: 0.82, r: 0.16, label: "Feet & footing" },
    { cx: 0.5, cy: 0.6, r: 0.18, label: "Thighs & tailbone" },
    { cx: 0.5, cy: 0.27, r: 0.2, label: "Shoulders" },
    { cx: 0.5, cy: 0.13, r: 0.16, label: "Crown of the head" },
  ],
  vrksasana: [
    { cx: 0.5, cy: 0.82, r: 0.14, label: "Standing foot" },
    { cx: 0.42, cy: 0.58, r: 0.16, label: "Right hip & knee" },
    { cx: 0.5, cy: 0.7, r: 0.16, label: "Standing leg" },
    { cx: 0.5, cy: 0.18, r: 0.2, label: "Arms overhead" },
    { cx: 0.5, cy: 0.45, r: 0.22, label: "Whole standing line" },
  ],
  "virabhadrasana-i": [
    { cx: 0.65, cy: 0.78, r: 0.18, label: "Back heel & leg" },
    { cx: 0.35, cy: 0.7, r: 0.16, label: "Front knee" },
    { cx: 0.5, cy: 0.18, r: 0.2, label: "Arms overhead" },
    { cx: 0.5, cy: 0.32, r: 0.2, label: "Chest & shoulders" },
  ],
  "virabhadrasana-ii": [
    { cx: 0.42, cy: 0.78, r: 0.18, label: "Stance & feet" },
    { cx: 0.35, cy: 0.7, r: 0.16, label: "Front knee" },
    { cx: 0.5, cy: 0.3, r: 0.26, label: "Arms extended" },
    { cx: 0.32, cy: 0.2, r: 0.16, label: "Gaze over fingertips" },
    { cx: 0.5, cy: 0.58, r: 0.22, label: "Hips sinking" },
  ],
  anjaneyasana: [
    { cx: 0.35, cy: 0.7, r: 0.16, label: "Front foot" },
    { cx: 0.65, cy: 0.78, r: 0.16, label: "Back knee" },
    { cx: 0.6, cy: 0.58, r: 0.2, label: "Back hip flexor" },
    { cx: 0.5, cy: 0.18, r: 0.2, label: "Arms reaching up" },
  ],
  uttanasana: [
    { cx: 0.5, cy: 0.4, r: 0.22, label: "Hip hinge" },
    { cx: 0.5, cy: 0.13, r: 0.16, label: "Head hanging" },
    { cx: 0.5, cy: 0.85, r: 0.16, label: "Hands toward floor" },
    { cx: 0.5, cy: 0.72, r: 0.2, label: "Back of the legs" },
  ],
  bhujangasana: [
    { cx: 0.5, cy: 0.45, r: 0.22, label: "Belly down" },
    { cx: 0.6, cy: 0.78, r: 0.18, label: "Feet & pubic bone" },
    { cx: 0.5, cy: 0.32, r: 0.22, label: "Chest lifting" },
    { cx: 0.5, cy: 0.4, r: 0.2, label: "Spine & neck" },
  ],
  "adho-mukha-svanasana": [
    { cx: 0.5, cy: 0.58, r: 0.22, label: "Hips lifting" },
    { cx: 0.5, cy: 0.72, r: 0.22, label: "Legs & hamstrings" },
    { cx: 0.4, cy: 0.3, r: 0.2, label: "Hands & shoulders" },
    { cx: 0.6, cy: 0.82, r: 0.18, label: "Heels & calves" },
  ],
  // --- Remaining 21 asanas: LAST step only ---
  trikonasana: [undefined, undefined, undefined, { cx: 0.5, cy: 0.45, r: 0.24, label: "Side body & waist" }],
  utkatasana: [undefined, undefined, undefined, { cx: 0.5, cy: 0.62, r: 0.22, label: "Thighs & glutes" }],
  "ardha-chandrasana": [undefined, undefined, undefined, { cx: 0.6, cy: 0.72, r: 0.2, label: "Standing leg & hip" }],
  sukhasana: [undefined, undefined, undefined, { cx: 0.5, cy: 0.55, r: 0.22, label: "Hips & spine" }],
  padmasana: [undefined, undefined, undefined, { cx: 0.5, cy: 0.6, r: 0.22, label: "Hips & knees" }],
  navasana: [undefined, undefined, undefined, { cx: 0.5, cy: 0.45, r: 0.2, label: "Core" }],
  "baddha-konasana": [undefined, undefined, undefined, { cx: 0.5, cy: 0.6, r: 0.22, label: "Inner thighs & groin" }],
  "eka-pada-rajakapotasana": [undefined, undefined, undefined, { cx: 0.42, cy: 0.6, r: 0.2, label: "Front-leg outer hip" }],
  "utthan-pristhasana": [undefined, undefined, undefined, { cx: 0.42, cy: 0.62, r: 0.2, label: "Front hip & hamstring" }],
  paschimottanasana: [undefined, undefined, undefined, { cx: 0.5, cy: 0.7, r: 0.22, label: "Hamstrings & back" }],
  parsvottanasana: [undefined, undefined, undefined, { cx: 0.4, cy: 0.7, r: 0.2, label: "Front-leg hamstring" }],
  "setu-bandhasana": [undefined, undefined, undefined, { cx: 0.5, cy: 0.4, r: 0.22, label: "Chest & back" }],
  ustrasana: [undefined, undefined, undefined, { cx: 0.5, cy: 0.35, r: 0.22, label: "Chest & front body" }],
  "urdhva-dhanurasana": [undefined, undefined, undefined, { cx: 0.5, cy: 0.4, r: 0.24, label: "Whole front body" }],
  sirsasana: [undefined, undefined, undefined, { cx: 0.5, cy: 0.35, r: 0.2, label: "Shoulders & core" }],
  "viparita-karani": [undefined, undefined, undefined, { cx: 0.5, cy: 0.5, r: 0.28, label: "Whole body release" }],
  balasana: [undefined, undefined, undefined, { cx: 0.5, cy: 0.4, r: 0.24, label: "Lower back & hips" }],
  savasana: [undefined, undefined, undefined, { cx: 0.5, cy: 0.5, r: 0.32, label: "Complete release" }],
  "ardha-hanumanasana": [undefined, undefined, undefined, { cx: 0.4, cy: 0.7, r: 0.2, label: "Front-leg hamstring" }],
  hanumanasana: [undefined, undefined, undefined, { cx: 0.42, cy: 0.7, r: 0.22, label: "Hamstring & hip flexor" }],
  "marichyasana-twist": [undefined, undefined, undefined, { cx: 0.5, cy: 0.42, r: 0.2, label: "Spine & twist" }],

  "marjaryasana-bitilasana": [
    { cx: 0.5, cy: 0.6, r: 0.24, label: "Tabletop base" },
    { cx: 0.5, cy: 0.45, r: 0.22, label: "Belly drops, chest lifts" },
    { cx: 0.5, cy: 0.35, r: 0.22, label: "Spine rounding" },
    { cx: 0.5, cy: 0.45, r: 0.26, label: "Whole spine flowing" },
    { cx: 0.5, cy: 0.5, r: 0.22, label: "Neutral spine" },
  ],
  "supta-matsyendrasana": [
    { cx: 0.5, cy: 0.55, r: 0.2, label: "Knees to chest" },
    { cx: 0.62, cy: 0.6, r: 0.2, label: "Knees dropping right" },
    { cx: 0.35, cy: 0.3, r: 0.18, label: "Opposite shoulder" },
    { cx: 0.5, cy: 0.5, r: 0.24, label: "Lower back releasing" },
    { cx: 0.5, cy: 0.55, r: 0.2, label: "Back to center" },
  ],
  "supta-kapotasana": [
    { cx: 0.5, cy: 0.65, r: 0.2, label: "Feet grounded" },
    { cx: 0.55, cy: 0.55, r: 0.18, label: "Ankle over thigh" },
    { cx: 0.5, cy: 0.5, r: 0.2, label: "Thigh drawing in" },
    { cx: 0.6, cy: 0.55, r: 0.18, label: "Outer hip opening" },
    { cx: 0.4, cy: 0.3, r: 0.18, label: "Shoulders heavy" },
  ],
  "parsva-balasana": [
    { cx: 0.5, cy: 0.6, r: 0.22, label: "Tabletop base" },
    { cx: 0.45, cy: 0.25, r: 0.18, label: "Arm reaching up" },
    { cx: 0.4, cy: 0.45, r: 0.2, label: "Arm threading through" },
    { cx: 0.55, cy: 0.4, r: 0.2, label: "Upper back softening" },
    { cx: 0.5, cy: 0.45, r: 0.2, label: "Unwinding" },
  ],
  "uttana-shishosana": [
    { cx: 0.6, cy: 0.6, r: 0.2, label: "Hips over knees" },
    { cx: 0.35, cy: 0.55, r: 0.2, label: "Chest lowering" },
    { cx: 0.3, cy: 0.6, r: 0.16, label: "Forehead resting" },
    { cx: 0.45, cy: 0.4, r: 0.22, label: "Heart melting" },
    { cx: 0.6, cy: 0.6, r: 0.2, label: "Sitting back" },
  ],
  malasana: [
    { cx: 0.5, cy: 0.8, r: 0.18, label: "Feet & stance" },
    { cx: 0.5, cy: 0.6, r: 0.22, label: "Hips sinking" },
    { cx: 0.5, cy: 0.4, r: 0.18, label: "Palms at heart" },
    { cx: 0.5, cy: 0.2, r: 0.16, label: "Crown lifting" },
    { cx: 0.5, cy: 0.85, r: 0.16, label: "Heels grounding" },
  ],
  virasana: [
    { cx: 0.5, cy: 0.7, r: 0.2, label: "Kneeling base" },
    { cx: 0.5, cy: 0.6, r: 0.2, label: "Seat settling" },
    { cx: 0.5, cy: 0.45, r: 0.2, label: "Spine lengthening" },
    { cx: 0.5, cy: 0.3, r: 0.18, label: "Shoulders softening" },
    { cx: 0.5, cy: 0.5, r: 0.24, label: "Steady seat" },
  ],
  "supta-baddha-konasana": [
    { cx: 0.5, cy: 0.6, r: 0.2, label: "Lying back" },
    { cx: 0.5, cy: 0.6, r: 0.24, label: "Knees falling open" },
    { cx: 0.5, cy: 0.62, r: 0.22, label: "Thighs supported" },
    { cx: 0.5, cy: 0.4, r: 0.18, label: "Heart & belly" },
    { cx: 0.5, cy: 0.55, r: 0.22, label: "Complete rest" },
  ],
};

// Per-asana stretch zones — powers the "You'll feel this in..." card.
export const STRETCH_ZONES: Record<string, StretchZone[]> = {
  tadasana: [
    { region: "Feet", sensation: "Grounding through the four corners", intensity: "medium", primary: true },
    { region: "Spine", sensation: "Lengthening tall and upward", intensity: "medium", primary: true },
    { region: "Shoulders", sensation: "Softening down away from the ears", intensity: "low", primary: false },
  ],
  vrksasana: [
    { region: "Standing ankle & calf", sensation: "Balance and grounding through the foot", intensity: "strong", primary: true },
    { region: "Inner thigh", sensation: "Opening as the lifted foot presses in", intensity: "medium", primary: true },
    { region: "Core", sensation: "Engaging quietly to hold balance", intensity: "medium", primary: false },
  ],
  "virabhadrasana-ii": [
    { region: "Front thigh & glute", sensation: "Strong burn as the knee bends deep", intensity: "strong", primary: true },
    { region: "Inner thighs & groin", sensation: "Broad opening across the wide stance", intensity: "medium", primary: true },
    { region: "Shoulders", sensation: "Endurance as the arms reach long", intensity: "medium", primary: false },
  ],
  "virabhadrasana-i": [
    { region: "Back-leg hip flexor", sensation: "Deep stretch across the front of the back hip", intensity: "strong", primary: true },
    { region: "Front thigh", sensation: "Strengthening as the knee bends", intensity: "strong", primary: true },
    { region: "Chest & shoulders", sensation: "Opening as the arms lift overhead", intensity: "medium", primary: false },
  ],
  trikonasana: [
    { region: "Front hamstring", sensation: "Long pull down the back of the front leg", intensity: "strong", primary: true },
    { region: "Side body", sensation: "Lengthening along the top waist", intensity: "medium", primary: true },
    { region: "Hips", sensation: "Opening as the pelvis tilts", intensity: "medium", primary: false },
  ],
  utkatasana: [
    { region: "Thighs & quads", sensation: "Building heat as you sit deep", intensity: "strong", primary: true },
    { region: "Glutes", sensation: "Engaging as the hips sink back", intensity: "medium", primary: true },
    { region: "Shoulders", sensation: "Reaching long as the arms lift", intensity: "low", primary: false },
  ],
  "ardha-chandrasana": [
    { region: "Standing leg & hip", sensation: "Strength and balance through the base", intensity: "strong", primary: true },
    { region: "Hamstring", sensation: "Stretch down the standing leg", intensity: "medium", primary: true },
    { region: "Chest & side body", sensation: "Opening as the top arm reaches up", intensity: "medium", primary: false },
  ],
  sukhasana: [
    { region: "Hips & outer hips", sensation: "Gentle opening in the cross-legged seat", intensity: "low", primary: true },
    { region: "Spine", sensation: "Lengthening tall from the base", intensity: "low", primary: true },
    { region: "Knees", sensation: "Soft settling toward the floor", intensity: "low", primary: false },
  ],
  padmasana: [
    { region: "Hips", sensation: "Deep external rotation of both hips", intensity: "strong", primary: true },
    { region: "Knees", sensation: "Sensitive folding — never force", intensity: "medium", primary: true },
    { region: "Ankles", sensation: "Stretch across the top of the foot", intensity: "medium", primary: false },
  ],
  navasana: [
    { region: "Core & abdominals", sensation: "Intense engagement to hold the V", intensity: "strong", primary: true },
    { region: "Hip flexors", sensation: "Working to lift the legs", intensity: "medium", primary: true },
    { region: "Spine", sensation: "Lengthening to stay tall", intensity: "low", primary: false },
  ],
  "baddha-konasana": [
    { region: "Inner thighs & groin", sensation: "Broad opening as the knees fall wide", intensity: "strong", primary: true },
    { region: "Hips", sensation: "External rotation through both hips", intensity: "medium", primary: true },
    { region: "Lower back", sensation: "Gentle lengthening if you fold forward", intensity: "low", primary: false },
  ],
  "eka-pada-rajakapotasana": [
    { region: "Front-leg outer hip & piriformis", sensation: "Deep release in the glute and rotators", intensity: "strong", primary: true },
    { region: "Back-leg hip flexor", sensation: "Long stretch across the front of the back hip", intensity: "medium", primary: true },
    { region: "Lower back", sensation: "Easing of stored tension", intensity: "low", primary: false },
  ],
  anjaneyasana: [
    { region: "Back-leg hip flexor", sensation: "Opening across the front of the back hip", intensity: "strong", primary: true },
    { region: "Quadriceps", sensation: "Stretch down the back-leg thigh", intensity: "medium", primary: true },
    { region: "Chest", sensation: "Lifting and opening as the arms rise", intensity: "low", primary: false },
  ],
  "utthan-pristhasana": [
    { region: "Front hip & inner groin", sensation: "Deep opening as you sink to the forearms", intensity: "strong", primary: true },
    { region: "Hamstrings", sensation: "Lengthening at the back of the front leg", intensity: "medium", primary: true },
    { region: "Back-leg hip flexor", sensation: "Stretch across the front of the back hip", intensity: "medium", primary: false },
  ],
  uttanasana: [
    { region: "Hamstrings", sensation: "Long pull down the back of the legs", intensity: "strong", primary: true },
    { region: "Calves", sensation: "Stretch through the lower legs", intensity: "medium", primary: true },
    { region: "Neck & back", sensation: "Releasing as the head hangs heavy", intensity: "low", primary: false },
  ],
  paschimottanasana: [
    { region: "Hamstrings", sensation: "Deep lengthening over the straight legs", intensity: "strong", primary: true },
    { region: "Lower back", sensation: "Long stretch up the spine", intensity: "medium", primary: true },
    { region: "Calves", sensation: "Pull through the backs of the legs", intensity: "medium", primary: false },
  ],
  parsvottanasana: [
    { region: "Front-leg hamstring", sensation: "Intense stretch over the straight front leg", intensity: "strong", primary: true },
    { region: "Hips", sensation: "Squaring as the pelvis levels", intensity: "medium", primary: true },
    { region: "Spine", sensation: "Lengthening as you fold forward", intensity: "low", primary: false },
  ],
  bhujangasana: [
    { region: "Spine & back", sensation: "Back-bending compression along the spine", intensity: "strong", primary: true },
    { region: "Chest", sensation: "Opening across the front body", intensity: "medium", primary: true },
    { region: "Abdominals", sensation: "Long stretch up the belly", intensity: "medium", primary: false },
  ],
  "setu-bandhasana": [
    { region: "Chest", sensation: "Opening as the sternum lifts", intensity: "medium", primary: true },
    { region: "Hip flexors", sensation: "Lengthening across the front of the hips", intensity: "medium", primary: true },
    { region: "Back & glutes", sensation: "Strengthening as the hips lift", intensity: "medium", primary: false },
  ],
  ustrasana: [
    { region: "Front body, chest & quads", sensation: "Deep opening across the entire front", intensity: "strong", primary: true },
    { region: "Shoulders", sensation: "Stretch as the arms reach back", intensity: "medium", primary: false },
    { region: "Throat & front of neck", sensation: "Gentle lengthening as the head releases back", intensity: "low", primary: false },
  ],
  "urdhva-dhanurasana": [
    { region: "Chest & shoulders", sensation: "Deep opening across the front body", intensity: "strong", primary: true },
    { region: "Hip flexors", sensation: "Strong stretch across the front of the hips", intensity: "strong", primary: true },
    { region: "Spine", sensation: "Full back-bending extension", intensity: "strong", primary: false },
  ],
  sirsasana: [
    { region: "Shoulders", sensation: "Strong engagement to bear the weight", intensity: "strong", primary: true },
    { region: "Core", sensation: "Stabilizing to stay light on the head", intensity: "medium", primary: true },
    { region: "Neck", sensation: "Gentle loading — keep it long and safe", intensity: "low", primary: false },
  ],
  "adho-mukha-svanasana": [
    { region: "Hamstrings", sensation: "Long pull down the backs of the legs", intensity: "strong", primary: true },
    { region: "Calves", sensation: "Stretch as the heels reach down", intensity: "medium", primary: true },
    { region: "Shoulders", sensation: "Opening as you press the floor away", intensity: "medium", primary: true },
  ],
  "viparita-karani": [
    { region: "Legs & feet", sensation: "Relief as blood drains from tired legs", intensity: "low", primary: true },
    { region: "Lower back", sensation: "Gentle release along the spine", intensity: "low", primary: true },
    { region: "Nervous system", sensation: "Settling into deep calm", intensity: "low", primary: false },
  ],
  balasana: [
    { region: "Lower back", sensation: "Soft release along the spine", intensity: "low", primary: true },
    { region: "Hips", sensation: "Gentle opening as you sit back", intensity: "low", primary: true },
    { region: "Shoulders", sensation: "Lengthening if the arms extend forward", intensity: "low", primary: false },
  ],
  savasana: [
    { region: "Full body", sensation: "Complete release from head to toe", intensity: "low", primary: true },
    { region: "Nervous system", sensation: "Settling into deep stillness", intensity: "low", primary: false },
  ],
  "ardha-hanumanasana": [
    { region: "Front-leg hamstring", sensation: "Focused stretch over the straight front leg", intensity: "strong", primary: true },
    { region: "Calf", sensation: "Pull through the flexed-foot lower leg", intensity: "medium", primary: true },
    { region: "Lower back", sensation: "Lengthening as the spine reaches forward", intensity: "low", primary: false },
  ],
  hanumanasana: [
    { region: "Front-leg hamstring", sensation: "Maximal lengthening as the heel slides forward", intensity: "strong", primary: true },
    { region: "Back-leg hip flexor & psoas", sensation: "Deep stretch across the front of the back hip", intensity: "strong", primary: true },
    { region: "Inner groin", sensation: "Broad opening as the hips descend", intensity: "medium", primary: false },
  ],
  "marichyasana-twist": [
    { region: "Spine", sensation: "Wringing rotation through the whole back", intensity: "strong", primary: true },
    { region: "Outer hip & glute", sensation: "Stretch around the bent-knee hip", intensity: "medium", primary: true },
    { region: "Chest & shoulders", sensation: "Opening as you turn and gaze back", intensity: "low", primary: false },
  ],

  // --- v5 additions ---
  "virabhadrasana-iii": [
    { region: "Standing leg & glute", sensation: "Strong stabilizing work to hold the balance", intensity: "strong", primary: true },
    { region: "Back & core", sensation: "Engaging to keep the long horizontal line", intensity: "medium", primary: true },
    { region: "Lifted-leg hamstring", sensation: "Active lengthening as the heel reaches back", intensity: "medium", primary: false },
  ],
  "utthita-parsvakonasana": [
    { region: "Side body & waist", sensation: "Long line of length from hip to top fingertips", intensity: "strong", primary: true },
    { region: "Front thigh & groin", sensation: "Deep opening as the knee bends over the ankle", intensity: "strong", primary: true },
    { region: "Chest & shoulders", sensation: "Broadening as the chest turns skyward", intensity: "medium", primary: false },
  ],
  "urdhva-prasarita-eka-padasana": [
    { region: "Standing-leg hamstring", sensation: "Intense lengthening down the back of the leg", intensity: "strong", primary: true },
    { region: "Hips", sensation: "Opening as the top leg lifts high", intensity: "medium", primary: true },
    { region: "Standing ankle & calf", sensation: "Balancing effort through the base", intensity: "medium", primary: false },
  ],
  garudasana: [
    { region: "Upper back & shoulders", sensation: "Broad stretch across the wrapped shoulder blades", intensity: "strong", primary: true },
    { region: "Outer hips", sensation: "Opening as the thighs wrap and squeeze", intensity: "medium", primary: true },
    { region: "Ankles & thighs", sensation: "Strengthening as you balance in the squat", intensity: "medium", primary: false },
  ],
  gomukhasana: [
    { region: "Shoulders & triceps", sensation: "Deep opening through the bound arms", intensity: "strong", primary: true },
    { region: "Outer hips & thighs", sensation: "Stretch across the stacked knees", intensity: "strong", primary: true },
    { region: "Chest", sensation: "Lifting and broadening the collarbones", intensity: "medium", primary: false },
  ],
  bharadvajasana: [
    { region: "Spine", sensation: "Gentle, even rotation through the whole back", intensity: "medium", primary: true },
    { region: "Outer hips", sensation: "Soft opening in the swept-leg hip", intensity: "low", primary: true },
    { region: "Chest & shoulders", sensation: "Easy opening as you turn", intensity: "low", primary: false },
  ],
  "janu-sirsasana": [
    { region: "Extended-leg hamstring", sensation: "Focused stretch over the straight leg", intensity: "strong", primary: true },
    { region: "Spine & lower back", sensation: "Lengthening as you fold forward", intensity: "medium", primary: true },
    { region: "Bent-leg outer hip", sensation: "Gentle opening in the folded hip", intensity: "low", primary: false },
  ],
  dhanurasana: [
    { region: "Front body", sensation: "Strong opening across the belly and chest", intensity: "strong", primary: true },
    { region: "Quadriceps", sensation: "Deep stretch down the front of the thighs", intensity: "medium", primary: true },
    { region: "Shoulders", sensation: "Opening as the arms draw the bowstring back", intensity: "medium", primary: false },
  ],
  salabhasana: [
    { region: "Lower back & spine", sensation: "Strengthening engagement along the back", intensity: "strong", primary: true },
    { region: "Glutes & hamstrings", sensation: "Working to lift and hold the legs", intensity: "medium", primary: true },
    { region: "Chest", sensation: "Gentle opening as the collarbones broaden", intensity: "low", primary: false },
  ],
  matsyasana: [
    { region: "Chest & throat", sensation: "Deep opening across the front of the chest and neck", intensity: "strong", primary: true },
    { region: "Upper back", sensation: "Arching lift between the shoulder blades", intensity: "medium", primary: true },
    { region: "Hip flexors", sensation: "Mild lengthening across the front of the hips", intensity: "low", primary: false },
  ],
  mandukasana: [
    { region: "Inner thighs & adductors", sensation: "Deep, patient opening across the groin", intensity: "strong", primary: true },
    { region: "Hips", sensation: "Broad external rotation of both hips", intensity: "strong", primary: true },
    { region: "Lower back", sensation: "Gentle release as the hips ease back", intensity: "low", primary: false },
  ],
  "ananda-balasana": [
    { region: "Inner thighs & groin", sensation: "Gentle opening as the knees draw down", intensity: "medium", primary: true },
    { region: "Lower back & sacrum", sensation: "Soft release into the floor", intensity: "low", primary: true },
    { region: "Hips", sensation: "Easy opening as you rock side to side", intensity: "low", primary: false },
  ],
  "prasarita-padottanasana": [
    { region: "Hamstrings", sensation: "Long pull down the backs of the wide legs", intensity: "strong", primary: true },
    { region: "Spine & back", sensation: "Lengthening as the crown releases down", intensity: "medium", primary: true },
    { region: "Neck & shoulders", sensation: "Releasing as the head hangs free", intensity: "low", primary: false },
  ],
  kumbhakasana: [
    { region: "Core & abdominals", sensation: "Strong bracing to hold the straight line", intensity: "strong", primary: true },
    { region: "Shoulders & arms", sensation: "Supporting the body's weight", intensity: "strong", primary: true },
    { region: "Wrists", sensation: "Loading through the hands — keep them grounded", intensity: "medium", primary: false },
  ],
  vasisthasana: [
    { region: "Obliques & side core", sensation: "Intense engagement to hold the hips high", intensity: "strong", primary: true },
    { region: "Supporting shoulder & wrist", sensation: "Bearing the body's weight on one arm", intensity: "strong", primary: true },
    { region: "Chest", sensation: "Opening as the top arm reaches up", intensity: "medium", primary: false },
  ],
  // ---- v5.1 additions ----
  "utkata-konasana": [
    { region: "Inner thighs & groin", sensation: "Broad opening across the wide stance", intensity: "medium", primary: true },
    { region: "Quads & glutes", sensation: "Building heat as the hips sink low", intensity: "strong", primary: true },
    { region: "Pelvic floor & hips", sensation: "Grounded engagement and external rotation", intensity: "medium", primary: false },
  ],
  "viparita-virabhadrasana": [
    { region: "Side body & waist", sensation: "Long stretch up the top side as you arc back", intensity: "strong", primary: true },
    { region: "Front thigh", sensation: "Working to hold the deep front-knee bend", intensity: "medium", primary: true },
    { region: "Chest & shoulders", sensation: "Opening as the top arm reaches overhead", intensity: "medium", primary: false },
  ],
  "chaturanga-dandasana": [
    { region: "Shoulders & triceps", sensation: "Strong load holding the low hover", intensity: "strong", primary: true },
    { region: "Core & abdominals", sensation: "Bracing to keep the body in one line", intensity: "strong", primary: true },
    { region: "Wrists", sensation: "Loading through the hands — keep them grounded", intensity: "medium", primary: false },
  ],
  "urdhva-mukha-svanasana": [
    { region: "Chest & abdomen", sensation: "Broad opening across the front body", intensity: "strong", primary: true },
    { region: "Shoulders", sensation: "Rolling back and open as the chest lifts", intensity: "medium", primary: true },
    { region: "Spine", sensation: "An energizing lengthening backbend", intensity: "medium", primary: false },
  ],

  "marjaryasana-bitilasana": [
    { region: "Spine", sensation: "A wave of movement through every vertebra", intensity: "medium", primary: true },
    { region: "Core & belly", sensation: "Alternating gentle stretch and engagement", intensity: "low", primary: false },
    { region: "Neck", sensation: "A soft release as the head lifts and hangs", intensity: "low", primary: false },
  ],
  "supta-matsyendrasana": [
    { region: "Lower back", sensation: "A satisfying wringing-out along the spine", intensity: "medium", primary: true },
    { region: "Outer hip", sensation: "A slow melt in the hip of the top leg", intensity: "medium", primary: true },
    { region: "Chest", sensation: "A light opening across the front shoulder", intensity: "low", primary: false },
  ],
  "supta-kapotasana": [
    { region: "Outer hip & glute", sensation: "A deep, focused stretch in the crossed leg", intensity: "strong", primary: true },
    { region: "Lower back", sensation: "Gentle traction as the thigh draws in", intensity: "low", primary: false },
  ],
  "parsva-balasana": [
    { region: "Upper back", sensation: "A spreading release between the shoulder blades", intensity: "medium", primary: true },
    { region: "Rear shoulder", sensation: "A deep stretch behind the threaded shoulder", intensity: "medium", primary: true },
    { region: "Neck", sensation: "A gentle unwinding with the head at rest", intensity: "low", primary: false },
  ],
  "uttana-shishosana": [
    { region: "Shoulders & armpits", sensation: "A long opening down the sides of the arms", intensity: "medium", primary: true },
    { region: "Chest", sensation: "The heart melting toward the floor", intensity: "medium", primary: true },
    { region: "Mid back", sensation: "A sweet lengthening through the thoracic spine", intensity: "low", primary: false },
  ],
  malasana: [
    { region: "Hips & groin", sensation: "A wide, deep opening through the inner hips", intensity: "strong", primary: true },
    { region: "Ankles", sensation: "A strong stretch as the heels root down", intensity: "medium", primary: true },
    { region: "Lower back", sensation: "A pleasant decompression at the base of the spine", intensity: "low", primary: false },
  ],
  virasana: [
    { region: "Front thighs", sensation: "A steady lengthening down the quadriceps", intensity: "medium", primary: true },
    { region: "Ankles & feet", sensation: "A firm stretch across the tops of the feet", intensity: "medium", primary: false },
    { region: "Knees", sensation: "A gentle, cared-for stretch - never pain", intensity: "low", primary: false },
  ],
  "supta-baddha-konasana": [
    { region: "Inner thighs & groin", sensation: "A slow, passive opening with zero effort", intensity: "medium", primary: true },
    { region: "Chest", sensation: "A soft widening with each breath", intensity: "low", primary: false },
    { region: "Whole body", sensation: "Heaviness settling into the floor", intensity: "low", primary: false },
  ],
};
