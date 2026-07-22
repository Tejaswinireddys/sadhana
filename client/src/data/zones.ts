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
  "ardha-matsyendrasana": [
    { region: "Spine & mid-back", sensation: "A satisfying wringing-out through the torso", intensity: "medium", primary: true },
    { region: "Outer hip", sensation: "A deep stretch in the twisted hip", intensity: "medium", primary: true },
    { region: "Shoulders", sensation: "A gentle opening across the upper back", intensity: "low", primary: false },
  ],
  "upavistha-konasana": [
    { region: "Inner thighs", sensation: "A wide, honest opening through the adductors", intensity: "strong", primary: true },
    { region: "Hamstrings", sensation: "A long stretch down the back of the legs", intensity: "medium", primary: true },
    { region: "Lower back", sensation: "A gentle lengthening when the spine stays long", intensity: "low", primary: false },
  ],
  halasana: [
    { region: "Spine & back body", sensation: "A deep forward fold while inverted", intensity: "strong", primary: true },
    { region: "Shoulders", sensation: "A firm stretch as the shoulder blades tuck under", intensity: "medium", primary: true },
    { region: "Hamstrings", sensation: "A strong pull if the legs are straight", intensity: "medium", primary: false },
  ],
  sarvangasana: [
    { region: "Shoulders & upper arms", sensation: "Steady strength holding the inversion", intensity: "strong", primary: true },
    { region: "Core", sensation: "Quiet engagement to keep the legs lifted", intensity: "medium", primary: true },
    { region: "Neck", sensation: "Soft and still — never strained", intensity: "low", primary: false },
  ],
  bakasana: [
    { region: "Arms & wrists", sensation: "Strong, focused weight-bearing", intensity: "strong", primary: true },
    { region: "Core", sensation: "A deep hug of the belly toward the spine", intensity: "strong", primary: true },
    { region: "Inner thighs", sensation: "Squeezing into the upper arms", intensity: "medium", primary: false },
  ],
  "parivrtta-anjaneyasana": [
    { region: "Hip flexors", sensation: "A deep stretch in the back-leg hip", intensity: "strong", primary: true },
    { region: "Spine", sensation: "A bright twisting length through the torso", intensity: "medium", primary: true },
    { region: "Chest", sensation: "An opening as the heart lifts", intensity: "medium", primary: false },
  ],
  purvottanasana: [
    { region: "Front body", sensation: "A full opening from ankles to throat", intensity: "strong", primary: true },
    { region: "Arms & wrists", sensation: "Steady strength pressing the floor away", intensity: "strong", primary: true },
    { region: "Glutes & hamstrings", sensation: "Engagement to keep the hips lifted", intensity: "medium", primary: false },
  ],
  apanasana: [
    { region: "Lower back", sensation: "A soft release as the knees draw in", intensity: "medium", primary: true },
    { region: "Hips", sensation: "A gentle flexion without effort", intensity: "low", primary: true },
    { region: "Belly", sensation: "A light massage with the breath", intensity: "low", primary: false },
  ],
  "supta-padangusthasana": [
    { region: "Hamstrings", sensation: "A focused lengthening down the raised leg", intensity: "strong", primary: true },
    { region: "Calves", sensation: "A stretch as the foot flexes", intensity: "medium", primary: true },
    { region: "Hip", sensation: "A gentle opening in the raised-leg hip", intensity: "low", primary: false },
  ],
  parighasana: [
    { region: "Side body", sensation: "A long stretch from hip to fingertips", intensity: "strong", primary: true },
    { region: "Inner thigh", sensation: "An opening in the extended leg", intensity: "medium", primary: true },
    { region: "Ribs", sensation: "Space for a fuller breath", intensity: "medium", primary: false },
  ],
  "ardha-pincha-mayurasana": [
    { region: "Shoulders", sensation: "Deep strength and stretch through the upper arms", intensity: "strong", primary: true },
    { region: "Hamstrings", sensation: "A strong pull as the hips lift", intensity: "medium", primary: true },
    { region: "Upper back", sensation: "Engagement as the chest reaches toward the thighs", intensity: "medium", primary: false },
  ],
  "parivrtta-trikonasana": [
    { region: "Hamstrings", sensation: "A precise stretch in the front leg", intensity: "strong", primary: true },
    { region: "Spine", sensation: "A deep rotational stretch", intensity: "medium", primary: true },
    { region: "Standing legs", sensation: "Steady strength through both feet", intensity: "medium", primary: false },
  ],
  natarajasana: [
    { region: "Standing leg", sensation: "Balance and strength through the foot and thigh", intensity: "strong", primary: true },
    { region: "Hip flexors & chest", sensation: "A bright opening as the back leg lifts", intensity: "strong", primary: true },
    { region: "Shoulders", sensation: "A stretch as the arm reaches back", intensity: "medium", primary: false },
  ],
  agnistambhasana: [
    { region: "Outer hips & glutes", sensation: "A deep, honest stretch in both hips", intensity: "strong", primary: true },
    { region: "Groin", sensation: "A secondary opening as the shins stack", intensity: "medium", primary: false },
    { region: "Lower back", sensation: "A gentle release when folding forward", intensity: "low", primary: false },
  ],
  "salamba-bhujangasana": [
    { region: "Lower back", sensation: "A gentle strengthening arch", intensity: "medium", primary: true },
    { region: "Chest & throat", sensation: "A soft opening across the front body", intensity: "medium", primary: true },
    { region: "Shoulders", sensation: "Melting down away from the ears", intensity: "low", primary: false },
  ],
  skandasana: [
    { region: "Inner thighs", sensation: "A wide opening in the straight leg", intensity: "strong", primary: true },
    { region: "Hips", sensation: "A deep squat stretch in the bent leg", intensity: "strong", primary: true },
    { region: "Ankles", sensation: "Mobility as the bent heel roots", intensity: "medium", primary: false },
  ],
  makarasana: [
    { region: "Lower back", sensation: "A complete release into the floor", intensity: "low", primary: true },
    { region: "Belly", sensation: "Natural diaphragmatic breath against the mat", intensity: "low", primary: true },
    { region: "Whole body", sensation: "Prone heaviness and rest", intensity: "low", primary: false },
  ],
  vajrasana: [
    { region: "Ankles & feet", sensation: "A firm stretch across the tops of the feet", intensity: "medium", primary: true },
    { region: "Knees", sensation: "A gentle kneeling stretch — never pain", intensity: "low", primary: true },
    { region: "Spine", sensation: "Easy upright length for stillness", intensity: "low", primary: false },
  ],
  "ardha-uttanasana": [
    { region: "Hamstrings", sensation: "A moderate stretch with soft or straight knees", intensity: "medium", primary: true },
    { region: "Spine", sensation: "Lengthening from tail to crown", intensity: "medium", primary: true },
    { region: "Back body", sensation: "Gentle strengthening to hold the flat back", intensity: "low", primary: false },
  ],
  padahastasana: [
    { region: "Hamstrings", sensation: "A deep stretch down the back of the legs", intensity: "strong", primary: true },
    { region: "Spine & neck", sensation: "Traction as the crown hangs heavy", intensity: "medium", primary: true },
    { region: "Calves", sensation: "A firm stretch as the legs straighten", intensity: "medium", primary: false },
  ],
  "utthita-hasta-padangusthasana": [
    { region: "Standing ankle & leg", sensation: "Steady strength and balance", intensity: "strong", primary: true },
    { region: "Hamstrings", sensation: "A focused stretch in the raised leg", intensity: "strong", primary: true },
    { region: "Core", sensation: "Quiet engagement to stay upright", intensity: "medium", primary: false },
  ],
  "parivrtta-parsvakonasana": [
    { region: "Legs", sensation: "Strong endurance through the lunge", intensity: "strong", primary: true },
    { region: "Spine", sensation: "A deep twisting length", intensity: "medium", primary: true },
    { region: "Chest", sensation: "An opening as the top arm reaches", intensity: "medium", primary: false },
  ],
  chakravakasana: [
    { region: "Core", sensation: "Deep stabilizing engagement", intensity: "medium", primary: true },
    { region: "Back body", sensation: "Gentle strength along the spine", intensity: "medium", primary: true },
    { region: "Shoulders", sensation: "Steady support through the grounded arm", intensity: "low", primary: false },
  ],
  "parivrtta-janu-sirsasana": [
    { region: "Side body", sensation: "A long stretch from hip to fingertips", intensity: "strong", primary: true },
    { region: "Hamstrings", sensation: "A stretch in the extended leg", intensity: "medium", primary: true },
    { region: "Shoulders", sensation: "An opening through the top arm", intensity: "medium", primary: false },
  ],
  kurmasana: [
    { region: "Hamstrings", sensation: "A deep, introspective stretch", intensity: "strong", primary: true },
    { region: "Spine", sensation: "A profound forward fold", intensity: "strong", primary: true },
    { region: "Shoulders", sensation: "An opening as the arms slide under", intensity: "medium", primary: false },
  ],
  bhekasana: [
    { region: "Quadriceps", sensation: "A deep stretch down the front thighs", intensity: "strong", primary: true },
    { region: "Hip flexors", sensation: "An opening as the feet press down", intensity: "strong", primary: true },
    { region: "Chest", sensation: "A lift and opening through the heart", intensity: "medium", primary: false },
  ],
  "karna-pidasana": [
    { region: "Spine", sensation: "A cocooning forward fold while inverted", intensity: "strong", primary: true },
    { region: "Shoulders", sensation: "Weight-bearing with the neck free", intensity: "medium", primary: true },
    { region: "Back body", sensation: "A deep stretch from hips to neck", intensity: "medium", primary: false },
  ],
  "pincha-mayurasana": [
    { region: "Shoulders & upper arms", sensation: "Intense strength holding the balance", intensity: "strong", primary: true },
    { region: "Core", sensation: "Powerful engagement to stay stacked", intensity: "strong", primary: true },
    { region: "Wrists & elbows", sensation: "Steady forearm support", intensity: "medium", primary: false },
  ],
  shashankasana: [
    { region: "Spine", sensation: "A soft forward fold over the thighs", intensity: "low", primary: true },
    { region: "Shoulders", sensation: "A gentle release as the arms rest", intensity: "low", primary: true },
    { region: "Nervous system", sensation: "A quieting, inward settle", intensity: "low", primary: false },
  ],
  "urdhva-hastasana": [
    { region: "Side body", sensation: "A lift from the waist to the fingertips", intensity: "medium", primary: true },
    { region: "Shoulders", sensation: "An opening as the arms reach up", intensity: "medium", primary: true },
    { region: "Spine", sensation: "Lengthening tall from the feet", intensity: "low", primary: false },
  ],
  "ashtanga-namaskara": [
    { region: "Arms & chest", sensation: "A soft strengthening lower", intensity: "medium", primary: true },
    { region: "Core", sensation: "Engagement to keep the hips lifted", intensity: "medium", primary: true },
    { region: "Wrists", sensation: "Steady weight-bearing", intensity: "low", primary: false },
  ],
  "parivrtta-utkatasana": [
    { region: "Thighs", sensation: "A strong burn in Chair legs", intensity: "strong", primary: true },
    { region: "Spine", sensation: "A deep twist through the torso", intensity: "medium", primary: true },
    { region: "Core", sensation: "Heat and focus under effort", intensity: "medium", primary: false },
  ],
  "supta-virasana": [
    { region: "Quadriceps", sensation: "A deep, melting front-thigh stretch", intensity: "strong", primary: true },
    { region: "Hip flexors", sensation: "An opening across the front hips", intensity: "strong", primary: true },
    { region: "Chest", sensation: "A soft opening when reclined", intensity: "low", primary: false },
  ],
  "anantasana": [
    { region: "Hamstrings", sensation: "A long stretch in the raised leg", intensity: "strong", primary: true },
    { region: "Side body", sensation: "Length along the bottom waist", intensity: "medium", primary: true },
    { region: "Inner thigh", sensation: "A gentle opening as the leg lifts", intensity: "medium", primary: false },
  ],
  "krounchasana": [
    { region: "Hamstrings", sensation: "A focused stretch in the lifted leg", intensity: "strong", primary: true },
    { region: "Core", sensation: "Steady engagement to sit tall", intensity: "medium", primary: true },
    { region: "Folded knee", sensation: "A Hero-leg stretch — never pain", intensity: "low", primary: false },
  ],
  "simhasana": [
    { region: "Jaw & face", sensation: "A full release of held tension", intensity: "medium", primary: true },
    { region: "Throat", sensation: "An opening with the lion's exhale", intensity: "medium", primary: true },
    { region: "Hands & wrists", sensation: "A spread through the lion's paws", intensity: "low", primary: false },
  ],
  "samakonasana": [
    { region: "Inner thighs", sensation: "A deep adductor opening", intensity: "strong", primary: true },
    { region: "Hips", sensation: "Wide, honest hip mobility", intensity: "strong", primary: true },
    { region: "Groin", sensation: "A careful stretch — no forcing", intensity: "medium", primary: false },
  ],
  "adho-mukha-vrksasana": [
    { region: "Shoulders & arms", sensation: "Full inverted strength", intensity: "strong", primary: true },
    { region: "Core", sensation: "Powerful midline engagement", intensity: "strong", primary: true },
    { region: "Wrists", sensation: "Steady handstand support", intensity: "medium", primary: false },
  ],
  "pasasana": [
    { region: "Spine", sensation: "A deep bound twist", intensity: "strong", primary: true },
    { region: "Hips & ankles", sensation: "A profound squat opening", intensity: "strong", primary: true },
    { region: "Shoulders", sensation: "A bind stretch across the chest", intensity: "medium", primary: false },
  ],
  "constructive-rest": [
    { region: "Lower back", sensation: "A complete release with knees bent", intensity: "low", primary: true },
    { region: "Whole body", sensation: "Heaviness settling into the floor", intensity: "low", primary: true },
    { region: "Nervous system", sensation: "A deep downshift toward sleep", intensity: "low", primary: false },
  ],
  "pawanmuktasana": [
    { region: "Lower back", sensation: "A soft massage as the knees draw in", intensity: "medium", primary: true },
    { region: "Belly", sensation: "Gentle compression for digestion", intensity: "medium", primary: true },
    { region: "Hips", sensation: "A comfortable flexion", intensity: "low", primary: false },
  ],
  "chair-viparita-karani": [
    { region: "Legs", sensation: "A draining release through the calves", intensity: "low", primary: true },
    { region: "Lower back", sensation: "Soft support with hips grounded", intensity: "low", primary: true },
    { region: "Nervous system", sensation: "Quiet, heavy calm", intensity: "low", primary: false },
  ],
  "salamba-matsyasana": [
    { region: "Chest & throat", sensation: "A soft propped opening", intensity: "medium", primary: true },
    { region: "Shoulders", sensation: "Melting toward the floor", intensity: "low", primary: true },
    { region: "Jaw", sensation: "An easy unclenching", intensity: "low", primary: false },
  ],
  "parsva-savasana": [
    { region: "Whole body", sensation: "Side-lying heaviness and rest", intensity: "low", primary: true },
    { region: "Hips", sensation: "Soft stacking with pillow support", intensity: "low", primary: true },
    { region: "Spine", sensation: "Neutral, comfortable alignment", intensity: "low", primary: false },
  ],
  "salamba-balasana": [
    { region: "Back body", sensation: "A melting fold over the bolster", intensity: "low", primary: true },
    { region: "Hips", sensation: "A gentle kneeling release", intensity: "low", primary: true },
    { region: "Nervous system", sensation: "Contained, quiet calm", intensity: "low", primary: false },
  ],
  "supta-gomukhasana": [
    { region: "Outer hips", sensation: "A deep stacked-thigh stretch", intensity: "medium", primary: true },
    { region: "Glutes", sensation: "A slow melt on each exhale", intensity: "medium", primary: true },
    { region: "Lower back", sensation: "Supported and quiet", intensity: "low", primary: false },
  ],
  "supta-garudasana": [
    { region: "Outer hip & IT band", sensation: "A wrapping compression stretch", intensity: "medium", primary: true },
    { region: "Glutes", sensation: "A focused outer-hip release", intensity: "medium", primary: true },
    { region: "Lower back", sensation: "Gentle as the legs draw in", intensity: "low", primary: false },
  ],
  "dandasana": [
    { region: "Spine", sensation: "Tall upright length", intensity: "medium", primary: true },
    { region: "Hamstrings", sensation: "A mild stretch with flexed feet", intensity: "low", primary: true },
    { region: "Core", sensation: "Quiet support for the posture", intensity: "low", primary: false },
  ],
  "mayurasana": [
    { region: "Arms & wrists", sensation: "Intense balancing strength", intensity: "strong", primary: true },
    { region: "Core", sensation: "Full-front-body engagement", intensity: "strong", primary: true },
    { region: "Shoulders", sensation: "Stable support through the elbows", intensity: "medium", primary: false },
  ],
  "rajakapotasana": [
    { region: "Hip flexors & quads", sensation: "Deep, strong opening through the back leg", intensity: "strong", primary: true },
    { region: "Shoulders & chest", sensation: "Broadening as the arm reaches back", intensity: "strong", primary: true },
    { region: "Spine", sensation: "Full-length backbend curve", intensity: "medium", primary: false },
  ],
  "astavakrasana": [
    { region: "Wrists & forearms", sensation: "Strong weight-bearing engagement", intensity: "strong", primary: true },
    { region: "Obliques & core", sensation: "Deep compression and twist", intensity: "strong", primary: true },
    { region: "Shoulders", sensation: "Stabilizing engagement", intensity: "medium", primary: false },
  ],
  "tittibhasana": [
    { region: "Hamstrings & inner groin", sensation: "Deep stretch as the legs straighten", intensity: "strong", primary: true },
    { region: "Shoulders & wrists", sensation: "Strong weight-bearing engagement", intensity: "strong", primary: true },
    { region: "Core", sensation: "Steady engagement to hold the lift", intensity: "medium", primary: false },
  ],
  "parsva-bakasana": [
    { region: "Spine & obliques", sensation: "Deep rotation and compression", intensity: "strong", primary: true },
    { region: "Wrists & forearms", sensation: "Strong weight-bearing engagement", intensity: "strong", primary: true },
    { region: "Core", sensation: "Steady engagement to hold the twist aloft", intensity: "medium", primary: false },
  ],
  "eka-pada-koundinyasana-ii": [
    { region: "Front hip & groin", sensation: "Deep opening as the shin hooks the arm", intensity: "strong", primary: true },
    { region: "Shoulders & wrists", sensation: "Strong weight-bearing engagement", intensity: "strong", primary: true },
    { region: "Core & back leg", sensation: "Active reaching engagement", intensity: "medium", primary: false },
  ],
  "vrischikasana": [
    { region: "Shoulders & upper back", sensation: "Strong weight-bearing engagement", intensity: "strong", primary: true },
    { region: "Spine", sensation: "Deep backbend arch", intensity: "strong", primary: true },
    { region: "Core", sensation: "Steady engagement to protect the low back", intensity: "medium", primary: false },
  ],
  "parivrtta-ardha-chandrasana": [
    { region: "Spine", sensation: "Deep rotation while balancing", intensity: "strong", primary: true },
    { region: "Standing leg & hip", sensation: "Strong stabilizing engagement", intensity: "strong", primary: true },
    { region: "Hamstrings (lifted leg)", sensation: "Active lengthening", intensity: "medium", primary: false },
  ],
  "padangusthasana": [
    { region: "Hamstrings", sensation: "Long, steady pull down the back of the legs", intensity: "strong", primary: true },
    { region: "Calves", sensation: "Gentle lengthening", intensity: "medium", primary: false },
    { region: "Spine", sensation: "Lengthening on the halfway lift", intensity: "low", primary: false },
  ],
  "ardha-baddha-padmottanasana": [
    { region: "Bound hip & knee", sensation: "Deep rotational opening", intensity: "strong", primary: true },
    { region: "Standing-leg hamstring", sensation: "Long stretch while folding", intensity: "strong", primary: true },
    { region: "Ankle (bound foot)", sensation: "Gentle stretch across the top of the foot", intensity: "medium", primary: false },
  ],
  "high-lunge": [
    { region: "Back-leg hip flexor", sensation: "Steady stretch across the front of the back hip", intensity: "medium", primary: true },
    { region: "Front thigh & glute", sensation: "Building strength as the knee bends", intensity: "strong", primary: true },
    { region: "Core", sensation: "Engaging to stabilize the balance", intensity: "medium", primary: false },
  ],
  "baddha-virabhadrasana": [
    { region: "Front thigh & hip", sensation: "Strong work as the knee bends", intensity: "strong", primary: true },
    { region: "Shoulders & chest", sensation: "Opening as the arms lift behind the back", intensity: "medium", primary: true },
    { region: "Hamstrings", sensation: "Gentle lengthening in the fold", intensity: "low", primary: false },
  ],
  "baddha-parsvakonasana": [
    { region: "Front hip & groin", sensation: "Deep opening in the bent-leg hip", intensity: "strong", primary: true },
    { region: "Shoulders & chest", sensation: "Spiraling open through the bind", intensity: "medium", primary: true },
    { region: "Back leg", sensation: "Strong, grounding engagement", intensity: "medium", primary: false },
  ],
  "parivrtta-hasta-padangusthasana": [
    { region: "Standing-leg hamstring & hip", sensation: "Steady work to stay tall", intensity: "strong", primary: true },
    { region: "Lifted-leg hamstring", sensation: "Long stretch through the extended leg", intensity: "strong", primary: true },
    { region: "Core & waist", sensation: "Twisting and stabilizing the torso", intensity: "medium", primary: false },
  ],
  "parivrtta-paschimottanasana": [
    { region: "Hamstrings", sensation: "Long pull down the extended leg", intensity: "strong", primary: true },
    { region: "Spine & waist", sensation: "Twisting and lengthening together", intensity: "medium", primary: true },
    { region: "Outer hip (crossed leg)", sensation: "Gentle compression and stretch", intensity: "medium", primary: false },
  ],
  "jathara-parivartanasana": [
    { region: "Lower back", sensation: "Soft release as the knees settle", intensity: "medium", primary: true },
    { region: "Waist & belly", sensation: "Gentle wringing through the twist", intensity: "medium", primary: true },
    { region: "Chest & shoulders", sensation: "Opening across the grounded shoulder", intensity: "low", primary: false },
  ],
  "uttana-padasana": [
    { region: "Core", sensation: "Clear, honest engagement through the belly", intensity: "strong", primary: true },
    { region: "Hip flexors", sensation: "Working to keep the legs lifted", intensity: "medium", primary: true },
    { region: "Low back", sensation: "Stabilizing against the floor", intensity: "medium", primary: false },
  ],
  "tolasana": [
    { region: "Wrists & arms", sensation: "Pressing power to lift the hips", intensity: "strong", primary: true },
    { region: "Core", sensation: "Drawing in to hover", intensity: "strong", primary: true },
    { region: "Hips", sensation: "Light lift away from the floor", intensity: "medium", primary: false },
  ],
  "bhujapidasana": [
    { region: "Arms & wrists", sensation: "Bearing weight in the balance", intensity: "strong", primary: true },
    { region: "Core", sensation: "Lifting the hips and legs", intensity: "strong", primary: true },
    { region: "Inner thighs & hips", sensation: "Squeezing into the upper arms", intensity: "medium", primary: false },
  ],
  "galavasana": [
    { region: "Outer hip (folded leg)", sensation: "Deep figure-four opening", intensity: "strong", primary: true },
    { region: "Arms & shoulders", sensation: "Supporting the float", intensity: "strong", primary: true },
    { region: "Core", sensation: "Keeping the back leg light", intensity: "medium", primary: false },
  ],
  "eka-pada-bakasana": [
    { region: "Arms & wrists", sensation: "Holding Crow while one leg extends", intensity: "strong", primary: true },
    { region: "Core", sensation: "Controlling the extended leg", intensity: "strong", primary: true },
    { region: "Shoulders", sensation: "Stable shelf for the remaining knee", intensity: "medium", primary: false },
  ],
  "ardha-navasana": [
    { region: "Core", sensation: "Steady endurance through the belly", intensity: "strong", primary: true },
    { region: "Hip flexors", sensation: "Working to keep the shins lifted", intensity: "medium", primary: true },
    { region: "Spine", sensation: "Lengthening while leaning back", intensity: "low", primary: false },
  ],
  "marichyasana-a": [
    { region: "Hamstrings", sensation: "Long stretch on the extended leg", intensity: "strong", primary: true },
    { region: "Shoulders", sensation: "Opening through the bind", intensity: "medium", primary: true },
    { region: "Spine", sensation: "Folding and wrapping", intensity: "medium", primary: false },
  ],
  "eka-pada-adho-mukha-svanasana": [
    { region: "Lifted-leg hip", sensation: "Opening as the leg reaches high", intensity: "medium", primary: true },
    { region: "Shoulders & arms", sensation: "Bearing weight in Down Dog", intensity: "strong", primary: true },
    { region: "Standing-leg hamstring", sensation: "Steady stretch", intensity: "medium", primary: false },
  ],
  "parsva-uttanasana": [
    { region: "Hamstrings", sensation: "Deep stretch in the fold", intensity: "strong", primary: true },
    { region: "Side waist", sensation: "Lengthening toward the foot", intensity: "medium", primary: true },
    { region: "Low back", sensation: "Softening with bent knees as needed", intensity: "low", primary: false },
  ],
  "salamba-setu-bandhasana": [
    { region: "Chest", sensation: "Gentle opening over the block", intensity: "low", primary: true },
    { region: "Hip flexors", sensation: "Soft stretch as hips rest elevated", intensity: "low", primary: true },
    { region: "Low back", sensation: "Supported and eased", intensity: "low", primary: false },
  ],
  "parivrtta-upavistha-konasana": [
    { region: "Inner thighs", sensation: "Wide-leg opening", intensity: "strong", primary: true },
    { region: "Hamstrings", sensation: "Long pull on the folded side", intensity: "strong", primary: true },
    { region: "Side waist", sensation: "Lengthening in the twist-fold", intensity: "medium", primary: false },
  ],
  "camatkarasana": [
    { region: "Chest & shoulders", sensation: "Opening as the top arm reaches back", intensity: "medium", primary: true },
    { region: "Supporting arm", sensation: "Strong press into the floor", intensity: "strong", primary: true },
    { region: "Hip flexors", sensation: "Stretch as the hips lift", intensity: "medium", primary: false },
  ],
  "makara-adho-mukha-svanasana": [
    { region: "Shoulders", sensation: "Building strength on the forearms", intensity: "strong", primary: true },
    { region: "Hamstrings", sensation: "Stretch as the hips lift", intensity: "medium", primary: true },
    { region: "Core", sensation: "Engaging to support the inverted V", intensity: "medium", primary: false },
  ],
};

