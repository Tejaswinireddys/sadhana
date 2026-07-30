/**
 * Maps a narration step's stylised PoseSvg key (see components/PoseSvg.tsx) to a
 * representative asana slug that has a hand-composed HUMAN illustration under
 * client/public/poses/{slug}.png.
 *
 * The illustration set uses one consistent character across every pose, so
 * crossfading between these images as the narration advances reads as the same
 * person moving through the shape — a real human demonstrating, rather than an
 * abstract 3D/stick figure.
 */
export const POSE_KEY_TO_SLUG: Record<string, string> = {
  mountain: "tadasana",
  standing: "tadasana",
  "down-dog": "adho-mukha-svanasana",
  tree: "vrksasana",
  "warrior-2": "virabhadrasana-ii",
  "warrior-1": "virabhadrasana-i",
  triangle: "trikonasana",
  "forward-fold": "uttanasana",
  pyramid: "parsvottanasana",
  "standing-split": "urdhva-prasarita-eka-padasana",
  chair: "utkatasana",
  seated: "sukhasana",
  "seated-fold": "paschimottanasana",
  boat: "navasana",
  butterfly: "baddha-konasana",
  cobra: "bhujangasana",
  bridge: "setu-bandhasana",
  wheel: "urdhva-dhanurasana",
  camel: "ustrasana",
  child: "balasana",
  pigeon: "eka-pada-rajakapotasana",
  "low-lunge": "anjaneyasana",
  lizard: "utthan-pristhasana",
  "half-split": "ardha-hanumanasana",
  "full-split": "hanumanasana",
  "couch-stretch": "couch-hip-flexor",
  cat: "marjaryasana-bitilasana",
  cow: "marjaryasana-bitilasana",
  plank: "kumbhakasana",
  headstand: "sirsasana",
  "legs-up": "viparita-karani",
  savasana: "savasana",
  supine: "constructive-rest",
  twist: "ardha-matsyendrasana",
  "half-moon": "ardha-chandrasana",
  goddess: "utkata-konasana",
  "side-angle": "utthita-parsvakonasana",
  "side-bend": "seated-side-bend",
  "side-plank": "vasisthasana",
  squat: "malasana",
};

/**
 * The human illustration to show for a given narration step.
 *
 * Rules (so users never open a pose and see a different asana):
 * 1. No step key → this pose's own illustration.
 * 2. Step key matches the asana's pose key → this pose's own illustration
 *    (never remap via POSE_KEY_TO_SLUG — that would steal a sibling's PNG).
 * 3. Step key maps to this asana's slug → keep this pose's illustration.
 * 4. Otherwise crossfade to the mapped entry/transition shape.
 */
export function humanStepSlug(
  asanaSlug: string,
  asanaPoseKey: string,
  stepPoseKey?: string | null,
): string {
  if (!stepPoseKey || stepPoseKey === asanaPoseKey) return asanaSlug;
  const mapped = POSE_KEY_TO_SLUG[stepPoseKey];
  if (!mapped || mapped === asanaSlug) return asanaSlug;
  return mapped;
}

/** True when narration steps crossfade across more than one illustration. */
export function poseHasShapeJourney(asanaSlug: string, asanaPoseKey: string, stepPoseKeys: Array<string | undefined>): boolean {
  const shapes = new Set(
    stepPoseKeys.map((key) => humanStepSlug(asanaSlug, asanaPoseKey, key)),
  );
  return shapes.size > 1;
}
