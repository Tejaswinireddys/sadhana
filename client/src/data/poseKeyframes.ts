/**
 * poseKeyframes — one rig keyframe per narration step, for the pilot poses.
 *
 * This is the payload that makes the figure *teach*: step 2 of Warrior II says
 * "bend the right knee toward 90°", so keyframe 2 is the same body with the
 * knee bent. The renderer tweens between consecutive keyframes across the
 * seconds that step is actually spoken, so limbs travel while the sentence
 * plays and settle as it ends.
 *
 * Pilot scope: 5 poses. Everything else falls back to the existing CSS stage.
 * Angles are degrees; see poseRig.ts for the sign conventions.
 */
import { HIP_HEIGHT, type RigPose } from "@/lib/poseRig";

export type PoseSequence = {
  /** Narration-step keyframes, in order. Length should match `steps` in content.ts. */
  frames: RigPose[];
  /**
   * Where the camera should look, per step, as a fraction of figure height
   * (0 = floor, 1 = crown) plus a dolly distance multiplier.
   */
  focus?: { y: number; zoom: number }[];
  /** Ground contact hint for the shadow ellipse. */
  groundSpread?: number;
};

/* ---------------------------------------------------------------- *
 * Tadasana — Mountain. Small, honest changes: this pose is about
 * lengthening, not travel, and pretending otherwise would teach badly.
 * ---------------------------------------------------------------- */
const TADASANA: PoseSequence = {
  groundSpread: 0.28,
  frames: [
    // 0. "Stand at the top of your mat, feet together or hip-width apart…"
    {
      root: { position: [0, HIP_HEIGHT - 0.012, 0], rotation: [0, 0, 0] },
      joints: {
        shoulderL: [0, 0, -7], shoulderR: [0, 0, 7],
        elbowL: [0, 0, -2], elbowR: [0, 0, 2],
        hipL: [0, 0, -2], hipR: [0, 0, 2],
        kneeL: [3, 0, 0], kneeR: [3, 0, 0],
        ankleL: [-87, 0, 0], ankleR: [-87, 0, 0],
        spine: [2, 0, 0], chest: [1, 0, 0], neck: [2, 0, 0],
      },
    },
    // 1. "Engage the thighs, lift the kneecaps, lengthen the tailbone down."
    {
      root: { position: [0, HIP_HEIGHT - 0.004, 0], rotation: [-4, 0, 0] },
      joints: {
        shoulderL: [0, 0, -7], shoulderR: [0, 0, 7],
        elbowL: [0, 0, -2], elbowR: [0, 0, 2],
        hipL: [0, 0, -1], hipR: [0, 0, 1],
        kneeL: [0, 0, 0], kneeR: [0, 0, 0],
        ankleL: [-90, 0, 0], ankleR: [-90, 0, 0],
        spine: [1, 0, 0], chest: [0, 0, 0], neck: [1, 0, 0],
      },
    },
    // 2. "Roll the shoulders back and down, palms facing forward."
    {
      root: { position: [0, HIP_HEIGHT, 0], rotation: [-4, 0, 0] },
      joints: {
        shoulderL: [-8, -10, -9], shoulderR: [-8, 10, 9],
        elbowL: [0, -6, -3], elbowR: [0, 6, 3],
        wristL: [0, -12, 0], wristR: [0, 12, 0],
        hipL: [0, 0, -1], hipR: [0, 0, 1],
        kneeL: [0, 0, 0], kneeR: [0, 0, 0],
        ankleL: [-90, 0, 0], ankleR: [-90, 0, 0],
        spine: [0, 0, 0], chest: [-6, 0, 0], neck: [2, 0, 0],
      },
    },
    // 3. "Crown of the head reaches upward; soften the face and breathe."
    {
      root: { position: [0, HIP_HEIGHT + 0.01, 0], rotation: [-3, 0, 0] },
      joints: {
        shoulderL: [-7, -10, -8], shoulderR: [-7, 10, 8],
        elbowL: [0, -6, -3], elbowR: [0, 6, 3],
        wristL: [0, -12, 0], wristR: [0, 12, 0],
        hipL: [0, 0, -1], hipR: [0, 0, 1],
        kneeL: [0, 0, 0], kneeR: [0, 0, 0],
        ankleL: [-90, 0, 0], ankleR: [-90, 0, 0],
        spine: [-1, 0, 0], chest: [-5, 0, 0], neck: [-2, 0, 0],
      },
    },
  ],
  focus: [
    { y: 0.08, zoom: 1.0 },
    { y: 0.34, zoom: 1.06 },
    { y: 0.78, zoom: 1.1 },
    { y: 0.92, zoom: 1.04 },
  ],
};

/* ---------------------------------------------------------------- *
 * Virabhadrasana II — Warrior II, right leg forward (+X).
 * Hip height is set by the straight BACK leg; the front knee stacks
 * over its ankle, which means thigh abduction and shin return are
 * equal and opposite.
 * ---------------------------------------------------------------- */
const WARRIOR_II: PoseSequence = {
  groundSpread: 0.95,
  frames: [
    // 0. "From a wide stance, turn the right foot out 90°, left foot in slightly."
    {
      root: { position: [0, 0.792, 0], rotation: [0, 0, 0] },
      joints: {
        hipR: [0, 0, 18], kneeR: [0, 0, 0], ankleR: [-90, 78, 0],
        hipL: [0, 0, -18], kneeL: [0, 0, 0], ankleL: [-90, -14, 0],
        shoulderL: [0, 0, -9], shoulderR: [0, 0, 9],
        spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0],
      },
    },
    // 1. "Bend the right knee toward 90°, keeping it stacked over the ankle."
    {
      root: { position: [0.06, 0.672, 0], rotation: [0, 0, 0] },
      joints: {
        hipR: [0, 0, 52], kneeR: [0, 0, -52], ankleR: [-90, 78, 0],
        hipL: [0, 0, -37], kneeL: [0, 0, 0], ankleL: [-90, -14, 0],
        shoulderL: [0, 0, -11], shoulderR: [0, 0, 11],
        spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0],
      },
    },
    // 2. "Extend the arms parallel to the floor, reaching in both directions."
    {
      root: { position: [0.06, 0.665, 0], rotation: [0, 0, 0] },
      joints: {
        hipR: [0, 0, 52], kneeR: [0, 0, -52], ankleR: [-90, 78, 0],
        hipL: [0, 0, -37], kneeL: [0, 0, 0], ankleL: [-90, -14, 0],
        shoulderL: [0, 0, -92], shoulderR: [0, 0, 92],
        elbowL: [0, 0, 0], elbowR: [0, 0, 0],
        wristL: [0, 0, -8], wristR: [0, 0, 8],
        spine: [0, 0, 0], chest: [-3, 0, 0], neck: [0, 0, 0],
      },
    },
    // 3. "Turn the head to gaze over the front fingertips; sink the hips."
    {
      root: { position: [0.06, 0.648, 0], rotation: [0, 0, 0] },
      joints: {
        hipR: [0, 0, 56], kneeR: [0, 0, -56], ankleR: [-90, 78, 0],
        hipL: [0, 0, -38], kneeL: [0, 0, 0], ankleL: [-90, -14, 0],
        shoulderL: [0, 0, -92], shoulderR: [0, 0, 92],
        elbowL: [0, 0, 0], elbowR: [0, 0, 0],
        wristL: [0, 0, -8], wristR: [0, 0, 8],
        spine: [0, 0, 0], chest: [-3, 0, 0], neck: [0, 74, 0],
      },
    },
    // 4. "Hold with steady breath, then repeat on the other side."
    {
      root: { position: [0.06, 0.652, 0], rotation: [0, 0, 0] },
      joints: {
        hipR: [0, 0, 55], kneeR: [0, 0, -55], ankleR: [-90, 78, 0],
        hipL: [0, 0, -38], kneeL: [0, 0, 0], ankleL: [-90, -14, 0],
        shoulderL: [0, 0, -90], shoulderR: [0, 0, 90],
        elbowL: [0, 0, 0], elbowR: [0, 0, 0],
        wristL: [0, 0, -6], wristR: [0, 0, 6],
        spine: [0, 0, 0], chest: [-4, 0, 0], neck: [0, 72, 0],
      },
    },
  ],
  focus: [
    { y: 0.1, zoom: 0.94 },
    { y: 0.36, zoom: 1.02 },
    { y: 0.74, zoom: 0.92 },
    { y: 0.86, zoom: 1.0 },
    { y: 0.5, zoom: 0.92 },
  ],
};

/* ---------------------------------------------------------------- *
 * Adho Mukha Svanasana — Downward Dog. Hips are the apex; torso and
 * arms form one line down to the floor, legs form the other.
 * ---------------------------------------------------------------- */
const DOWN_DOG: PoseSequence = {
  groundSpread: 1.05,
  frames: [
    // 0. "From all fours, tuck the toes and lift the hips up and back."
    //    Torso near horizontal, thighs vertical, shins back along the floor.
    {
      root: { position: [0, 0.43, 0], rotation: [0, 0, 0] },
      joints: {
        spine: [100, 0, 0], chest: [0, 0, 0], neck: [42, 0, 0],
        shoulderL: [-100, 0, -4], shoulderR: [-100, 0, 4],
        elbowL: [0, 0, 0], elbowR: [0, 0, 0],
        wristL: [-4, 0, 0], wristR: [-4, 0, 0],
        hipL: [6, 0, -3], hipR: [6, 0, 3],
        kneeL: [78, 0, 0], kneeR: [78, 0, 0],
        ankleL: [-74, 0, 0], ankleR: [-74, 0, 0],
      },
    },
    // 1. "Straighten the legs as comfortable, forming an inverted V."
    //    hip→hand and hip→heel are both ~0.83–0.92, so the hips must sit near
    //    0.72 for both ends to actually touch the floor.
    {
      root: { position: [0, 0.72, 0], rotation: [0, 0, 0] },
      joints: {
        spine: [142, 0, 0], chest: [0, 0, 0], neck: [26, 0, 0],
        shoulderL: [172, 0, -4], shoulderR: [172, 0, 4],
        elbowL: [0, 0, 0], elbowR: [0, 0, 0],
        wristL: [-46, 0, 0], wristR: [-46, 0, 0],
        hipL: [30, 0, -4], hipR: [30, 0, 4],
        kneeL: [-2, 0, 0], kneeR: [-2, 0, 0],
        ankleL: [-118, 0, 0], ankleR: [-118, 0, 0],
      },
    },
    // 2. "Spread the fingers and press the floor away, lengthening the spine."
    {
      root: { position: [0, 0.75, 0], rotation: [0, 0, 0] },
      joints: {
        spine: [146, 0, 0], chest: [-2, 0, 0], neck: [28, 0, 0],
        shoulderL: [170, 0, -3], shoulderR: [170, 0, 3],
        elbowL: [0, 0, 0], elbowR: [0, 0, 0],
        wristL: [-48, 0, 0], wristR: [-48, 0, 0],
        hipL: [28, 0, -4], hipR: [28, 0, 4],
        kneeL: [0, 0, 0], kneeR: [0, 0, 0],
        ankleL: [-116, 0, 0], ankleR: [-116, 0, 0],
      },
    },
    // 3. "Relax the neck and draw the heels toward the floor."
    {
      root: { position: [0, 0.735, 0], rotation: [0, 0, 0] },
      joints: {
        spine: [145, 0, 0], chest: [-2, 0, 0], neck: [40, 0, 0],
        shoulderL: [171, 0, -3], shoulderR: [171, 0, 3],
        elbowL: [0, 0, 0], elbowR: [0, 0, 0],
        wristL: [-47, 0, 0], wristR: [-47, 0, 0],
        hipL: [25, 0, -4], hipR: [25, 0, 4],
        kneeL: [0, 0, 0], kneeR: [0, 0, 0],
        ankleL: [-126, 0, 0], ankleR: [-126, 0, 0],
      },
    },
  ],
  focus: [
    { y: 0.62, zoom: 0.9 },
    { y: 0.72, zoom: 0.86 },
    { y: 0.4, zoom: 0.94 },
    { y: 0.2, zoom: 0.94 },
  ],
};

/* ---------------------------------------------------------------- *
 * Bhujangasana — Cobra. Prone: legs run backward along -Z on the
 * floor, the torso hinges up out of the pelvis.
 * ---------------------------------------------------------------- */
const COBRA: PoseSequence = {
  groundSpread: 0.7,
  frames: [
    // 0. "Lie on the belly, hands under the shoulders, legs extended back."
    //    spine 90° = torso flat along the floor; hips 90° = legs straight back.
    {
      root: { position: [0, 0.085, 0], rotation: [0, 0, 0] },
      joints: {
        spine: [88, 0, 0], chest: [0, 0, 0], neck: [-16, 0, 0],
        shoulderL: [-52, 0, -34], shoulderR: [-52, 0, 34],
        elbowL: [78, 0, 0], elbowR: [78, 0, 0],
        wristL: [-14, 0, 0], wristR: [-14, 0, 0],
        hipL: [90, 0, -2], hipR: [90, 0, 2],
        kneeL: [0, 0, 0], kneeR: [0, 0, 0],
        ankleL: [0, 0, 0], ankleR: [0, 0, 0],
      },
    },
    // 1. "Press the tops of the feet and pubic bone down."
    {
      root: { position: [0, 0.08, 0], rotation: [0, 0, 0] },
      joints: {
        spine: [86, 0, 0], chest: [0, 0, 0], neck: [-14, 0, 0],
        shoulderL: [-50, 0, -34], shoulderR: [-50, 0, 34],
        elbowL: [76, 0, 0], elbowR: [76, 0, 0],
        wristL: [-12, 0, 0], wristR: [-12, 0, 0],
        hipL: [92, 0, -2], hipR: [92, 0, 2],
        kneeL: [0, 0, 0], kneeR: [0, 0, 0],
        ankleL: [6, 0, 0], ankleR: [6, 0, 0],
      },
    },
    // 2. "Inhale and lift the chest, drawing the shoulders back."
    //    Torso swings from 86° to 46°; the arms straighten to take the weight.
    {
      root: { position: [0, 0.1, 0], rotation: [0, 0, 0] },
      joints: {
        spine: [46, 0, 0], chest: [-14, 0, 0], neck: [-10, 0, 0],
        // Arm world angle = spine + chest + shoulder. The hands sit just behind
        // the shoulders, so that sum needs to land near 36°.
        shoulderL: [4, 0, -14], shoulderR: [4, 0, 14],
        elbowL: [12, 0, 0], elbowR: [12, 0, 0],
        wristL: [-40, 0, 0], wristR: [-40, 0, 0],
        hipL: [92, 0, -2], hipR: [92, 0, 2],
        kneeL: [0, 0, 0], kneeR: [0, 0, 0],
        ankleL: [6, 0, 0], ankleR: [6, 0, 0],
      },
    },
    // 3. "Keep a slight bend in the elbows and the neck long."
    {
      root: { position: [0, 0.1, 0], rotation: [0, 0, 0] },
      joints: {
        spine: [50, 0, 0], chest: [-16, 0, 0], neck: [0, 0, 0],
        shoulderL: [2, 0, -14], shoulderR: [2, 0, 14],
        elbowL: [22, 0, 0], elbowR: [22, 0, 0],
        wristL: [-46, 0, 0], wristR: [-46, 0, 0],
        hipL: [92, 0, -2], hipR: [92, 0, 2],
        kneeL: [0, 0, 0], kneeR: [0, 0, 0],
        ankleL: [6, 0, 0], ankleR: [6, 0, 0],
      },
    },
  ],
  focus: [
    { y: 0.18, zoom: 0.9 },
    { y: 0.1, zoom: 0.92 },
    { y: 0.52, zoom: 1.0 },
    { y: 0.42, zoom: 0.98 },
  ],
};

/* ---------------------------------------------------------------- *
 * Trikonasana — Triangle, right side. The side bend lives in the root
 * so the whole torso tips as one long line, which is the actual cue.
 * ---------------------------------------------------------------- */
const TRIANGLE: PoseSequence = {
  groundSpread: 1.0,
  frames: [
    // 0. "From a wide stance, turn the front foot out and extend the arms wide."
    {
      root: { position: [0, 0.75, 0], rotation: [0, 0, 0] },
      joints: {
        hipR: [0, 0, 28], kneeR: [0, 0, 0], ankleR: [-90, 76, 0],
        hipL: [0, 0, -28], kneeL: [0, 0, 0], ankleL: [-90, -12, 0],
        shoulderL: [0, 0, -90], shoulderR: [0, 0, 90],
        spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0],
      },
    },
    // 1. "Reach forward over the front leg, then lower the front hand down."
    //    The side bend lives in the SPINE, not the root — rotating the root
    //    would tip the legs and lift the feet off the floor.
    {
      root: { position: [0, 0.75, 0], rotation: [0, 0, 0] },
      joints: {
        hipR: [0, 0, 28], kneeR: [0, 0, 0], ankleR: [-90, 76, 0],
        hipL: [0, 0, -28], kneeL: [0, 0, 0], ankleL: [-90, -12, 0],
        shoulderL: [0, 0, -86], shoulderR: [0, 0, 94],
        spine: [0, 0, -32], chest: [0, 0, -10], neck: [0, 0, 28],
      },
    },
    // 2. "Extend the top arm to the sky, stacking the shoulders."
    {
      root: { position: [0, 0.748, 0], rotation: [0, 0, 0] },
      joints: {
        hipR: [0, 0, 28], kneeR: [0, 0, 0], ankleR: [-90, 76, 0],
        hipL: [0, 0, -28], kneeL: [0, 0, 0], ankleL: [-90, -12, 0],
        shoulderL: [0, 0, -90], shoulderR: [0, 0, 90],
        elbowL: [0, 0, 0], elbowR: [0, 0, 0],
        spine: [0, 0, -50], chest: [0, 0, -12], neck: [0, 0, 46],
      },
    },
    // 3. "Lengthen evenly through both sides of the waist. Switch sides."
    {
      root: { position: [0, 0.752, 0], rotation: [0, 0, 0] },
      joints: {
        hipR: [0, 0, 28], kneeR: [0, 0, 0], ankleR: [-90, 76, 0],
        hipL: [0, 0, -28], kneeL: [0, 0, 0], ankleL: [-90, -12, 0],
        shoulderL: [0, 0, -92], shoulderR: [0, 0, 92],
        elbowL: [0, 0, 0], elbowR: [0, 0, 0],
        spine: [0, 0, -52], chest: [0, 0, -12], neck: [0, 0, 48],
      },
    },
  ],
  focus: [
    { y: 0.72, zoom: 0.92 },
    { y: 0.4, zoom: 0.94 },
    { y: 0.8, zoom: 0.92 },
    { y: 0.55, zoom: 0.9 },
  ],
};

/** Slugs with hand-authored rig keyframes. Everything else uses the CSS stage. */
export const POSE_KEYFRAMES: Record<string, PoseSequence> = {
  tadasana: TADASANA,
  "virabhadrasana-ii": WARRIOR_II,
  "adho-mukha-svanasana": DOWN_DOG,
  bhujangasana: COBRA,
  trikonasana: TRIANGLE,
};

export function hasRigSequence(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(POSE_KEYFRAMES, slug);
}

export const RIG_PILOT_SLUGS = Object.keys(POSE_KEYFRAMES);
