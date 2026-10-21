/**
 * poseKeyframes — articulated human yoga instructor keyframes per step.
 *
 * Each pose sequence maps step-by-step instructions to joint rotations on the
 * human skeleton (`poseRig.ts`) so the instructor demonstrates the exact bodily
 * entry, alignment refinement, breath articulation, and hold rather than playing
 * a static crossfade clip.
 *
 * Also exports `resolvePoseSequence(slug)` which returns the hand-authored
 * sequence when present or synthesizes a step-by-step sequence from the catalog
 * pose archetype (`POSE_ARCHETYPE_RIGS`) for any pose in the 239-pose library.
 */
import { asanaBySlug } from "@/data/content";
import { HIP_HEIGHT, lerpPose, type RigPose } from "@/lib/poseRig";

export type PoseSequence = {
  /** Narration-step keyframes, in order. Length matches `steps` in content.ts. */
  frames: RigPose[];
  /**
   * Where the camera should look, per step, as a fraction of figure height
   * (0 = floor, 1 = crown) plus a dolly distance multiplier.
   */
  focus?: { y: number; zoom: number }[];
  /** Ground contact hint for the shadow ellipse. */
  groundSpread?: number;
  /** Default camera azimuth in radians (0 = front, ~1.35 = side profile). */
  cameraAzimuth?: number;
};

/* ---------------------------------------------------------------- *
 * Tadasana — Mountain Pose (4 steps)
 * ---------------------------------------------------------------- */
const TADASANA: PoseSequence = {
  groundSpread: 0.28,
  cameraAzimuth: 0.36,
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
    // 1. "Engage the thighs, lift the kneecaps gently, and lengthen the tailbone down."
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
    // 2. "Roll the shoulders back and down, arms relaxed alongside the body, palms facing forward."
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
    // 3. "Crown of the head reaches upward; soften the face and breathe steadily."
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
    { y: 0.14, zoom: 1.0 },
    { y: 0.38, zoom: 1.04 },
    { y: 0.72, zoom: 1.08 },
    { y: 0.56, zoom: 1.02 },
  ],
};

/* ---------------------------------------------------------------- *
 * Virabhadrasana II — Warrior II (5 steps)
 * ---------------------------------------------------------------- */
const WARRIOR_II: PoseSequence = {
  groundSpread: 0.95,
  cameraAzimuth: 0.28,
  frames: [
    // 0. "From a wide stance, turn the right foot out 90° and the left foot in slightly."
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
    // 2. "Extend the arms parallel to the floor, reaching actively in both directions."
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
    { y: 0.25, zoom: 0.94 },
    { y: 0.36, zoom: 1.0 },
    { y: 0.64, zoom: 0.92 },
    { y: 0.72, zoom: 0.98 },
    { y: 0.5, zoom: 0.92 },
  ],
};

/* ---------------------------------------------------------------- *
 * Adho Mukha Svanasana — Downward Dog (4 steps)
 * ---------------------------------------------------------------- */
const DOWN_DOG: PoseSequence = {
  groundSpread: 1.05,
  cameraAzimuth: 1.25,
  frames: [
    // 0. "From all fours, tuck the toes and lift the hips up and back."
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
    { y: 0.42, zoom: 0.92 },
    { y: 0.52, zoom: 0.88 },
    { y: 0.42, zoom: 0.92 },
    { y: 0.36, zoom: 0.92 },
  ],
};

/* ---------------------------------------------------------------- *
 * Bhujangasana — Cobra Pose (4 steps)
 * ---------------------------------------------------------------- */
const COBRA: PoseSequence = {
  groundSpread: 0.7,
  cameraAzimuth: 1.18,
  frames: [
    // 0. "Lie on the belly, hands under the shoulders, legs extended back."
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
    {
      root: { position: [0, 0.1, 0], rotation: [0, 0, 0] },
      joints: {
        spine: [46, 0, 0], chest: [-14, 0, 0], neck: [-10, 0, 0],
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
    { y: 0.18, zoom: 0.92 },
    { y: 0.14, zoom: 0.94 },
    { y: 0.36, zoom: 0.98 },
    { y: 0.34, zoom: 0.96 },
  ],
};

/* ---------------------------------------------------------------- *
 * Trikonasana — Triangle Pose (4 steps)
 * ---------------------------------------------------------------- */
const TRIANGLE: PoseSequence = {
  groundSpread: 1.0,
  cameraAzimuth: 0.24,
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
    // 1. "Reach forward over the front leg, then lower the front hand to shin, block, or floor."
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
    { y: 0.62, zoom: 0.92 },
    { y: 0.42, zoom: 0.94 },
    { y: 0.65, zoom: 0.92 },
    { y: 0.52, zoom: 0.9 },
  ],
};

/* ---------------------------------------------------------------- *
 * Marjaryasana–Bitilasana — Cat–Cow (5 steps)
 * Step 0: Tabletop neutral
 * Step 1: Inhale Cow (drop belly, lift chest & tailbone, gaze rises)
 * Step 2: Exhale Cat (press floor away, round spine up, head hangs)
 * Step 3: Flowing between Cow & Cat
 * Step 4: Neutral tabletop
 * ---------------------------------------------------------------- */
export const TABLETOP_NEUTRAL_POSE: RigPose = {
  root: { position: [0, 0.43, -0.22], rotation: [0, 0, 0] },
  joints: {
    spine: [90, 0, 0],
    chest: [0, 0, 0],
    neck: [-12, 0, 0],
    shoulderL: [-90, 0, -4],
    shoulderR: [-90, 0, 4],
    elbowL: [0, 0, 0],
    elbowR: [0, 0, 0],
    wristL: [0, 0, 0],
    wristR: [0, 0, 0],
    hipL: [0, 0, -3],
    hipR: [0, 0, 3],
    kneeL: [90, 0, 0],
    kneeR: [90, 0, 0],
    ankleL: [0, 0, 0],
    ankleR: [0, 0, 0],
  },
};

export const COW_INHALE_POSE: RigPose = {
  root: { position: [0, 0.43, -0.22], rotation: [12, 0, 0] },
  joints: {
    spine: [98, 0, 0],
    chest: [-28, 0, 0],
    neck: [-34, 0, 0],
    shoulderL: [-78, 0, -5],
    shoulderR: [-78, 0, 5],
    elbowL: [0, 0, 0],
    elbowR: [0, 0, 0],
    wristL: [-6, 0, 0],
    wristR: [-6, 0, 0],
    hipL: [-10, 0, -3],
    hipR: [-10, 0, 3],
    kneeL: [88, 0, 0],
    kneeR: [88, 0, 0],
    ankleL: [0, 0, 0],
    ankleR: [0, 0, 0],
  },
};

export const CAT_EXHALE_POSE: RigPose = {
  root: { position: [0, 0.44, -0.22], rotation: [-14, 0, 0] },
  joints: {
    spine: [74, 0, 0],
    chest: [32, 0, 0],
    neck: [42, 0, 0],
    shoulderL: [-104, 0, -4],
    shoulderR: [-104, 0, 4],
    elbowL: [0, 0, 0],
    elbowR: [0, 0, 0],
    wristL: [6, 0, 0],
    wristR: [6, 0, 0],
    hipL: [12, 0, -3],
    hipR: [12, 0, 3],
    kneeL: [90, 0, 0],
    kneeR: [90, 0, 0],
    ankleL: [0, 0, 0],
    ankleR: [0, 0, 0],
  },
};

const CAT_COW: PoseSequence = {
  groundSpread: 0.78,
  cameraAzimuth: 1.28,
  frames: [
    TABLETOP_NEUTRAL_POSE,
    COW_INHALE_POSE,
    CAT_EXHALE_POSE,
    COW_INHALE_POSE,
    TABLETOP_NEUTRAL_POSE,
  ],
  focus: [
    { y: 0.34, zoom: 0.98 },
    { y: 0.36, zoom: 1.02 },
    { y: 0.38, zoom: 1.02 },
    { y: 0.36, zoom: 0.98 },
    { y: 0.34, zoom: 0.98 },
  ],
};

/* ---------------------------------------------------------------- *
 * Balasana — Child's Pose (4 steps)
 * ---------------------------------------------------------------- */
const CHILDS_POSE: PoseSequence = {
  groundSpread: 0.75,
  cameraAzimuth: 1.22,
  frames: [
    // 0. "Kneel and sit back toward the heels, knees together or wide."
    {
      root: { position: [0, 0.16, -0.24], rotation: [0, 0, 0] },
      joints: {
        spine: [18, 0, 0], chest: [6, 0, 0], neck: [6, 0, 0],
        shoulderL: [-20, 0, -8], shoulderR: [-20, 0, 8],
        elbowL: [-28, 0, 0], elbowR: [-28, 0, 0],
        hipL: [-58, 0, -10], hipR: [-58, 0, 10],
        kneeL: [148, 0, 0], kneeR: [148, 0, 0],
        ankleL: [12, 0, 0], ankleR: [12, 0, 0],
      },
    },
    // 1. "Fold forward and rest the forehead on the floor or a block."
    {
      root: { position: [0, 0.14, -0.26], rotation: [0, 0, 0] },
      joints: {
        spine: [76, 0, 0], chest: [16, 0, 0], neck: [18, 0, 0],
        shoulderL: [-85, 0, -10], shoulderR: [-85, 0, 10],
        elbowL: [-24, 0, 0], elbowR: [-24, 0, 0],
        hipL: [-66, 0, -12], hipR: [-66, 0, 12],
        kneeL: [154, 0, 0], kneeR: [154, 0, 0],
        ankleL: [14, 0, 0], ankleR: [14, 0, 0],
      },
    },
    // 2. "Extend the arms forward or rest them alongside the body."
    {
      root: { position: [0, 0.13, -0.26], rotation: [0, 0, 0] },
      joints: {
        spine: [82, 0, 0], chest: [14, 0, 0], neck: [16, 0, 0],
        shoulderL: [-162, 0, -8], shoulderR: [-162, 0, 8],
        elbowL: [-8, 0, 0], elbowR: [-8, 0, 0],
        wristL: [-8, 0, 0], wristR: [-8, 0, 0],
        hipL: [-68, 0, -12], hipR: [-68, 0, 12],
        kneeL: [156, 0, 0], kneeR: [156, 0, 0],
        ankleL: [14, 0, 0], ankleR: [14, 0, 0],
      },
    },
    // 3. "Soften completely and breathe slowly."
    {
      root: { position: [0, 0.125, -0.26], rotation: [0, 0, 0] },
      joints: {
        spine: [84, 0, 0], chest: [14, 0, 0], neck: [18, 0, 0],
        shoulderL: [-164, 0, -9], shoulderR: [-164, 0, 9],
        elbowL: [-10, 0, 0], elbowR: [-10, 0, 0],
        wristL: [-8, 0, 0], wristR: [-8, 0, 0],
        hipL: [-68, 0, -12], hipR: [-68, 0, 12],
        kneeL: [156, 0, 0], kneeR: [156, 0, 0],
        ankleL: [14, 0, 0], ankleR: [14, 0, 0],
      },
    },
  ],
  focus: [
    { y: 0.25, zoom: 0.98 },
    { y: 0.2, zoom: 1.02 },
    { y: 0.18, zoom: 1.02 },
    { y: 0.18, zoom: 1.0 },
  ],
};

/* ---------------------------------------------------------------- *
 * Kumbhakasana — Plank Pose (5 steps)
 * ---------------------------------------------------------------- */
const PLANK: PoseSequence = {
  groundSpread: 0.92,
  cameraAzimuth: 1.26,
  frames: [
    // 0. "From hands and knees, stack the shoulders over the wrists, fingers spread wide."
    TABLETOP_NEUTRAL_POSE,
    // 1. "Step the feet back one at a time into one long line from heels to crown."
    {
      root: { position: [0, 0.42, -0.08], rotation: [0, 0, 0] },
      joints: {
        spine: [72, 0, 0], chest: [0, 0, 0], neck: [-10, 0, 0],
        shoulderL: [-72, 0, -4], shoulderR: [-72, 0, 4],
        elbowL: [0, 0, 0], elbowR: [0, 0, 0],
        wristL: [-18, 0, 0], wristR: [-18, 0, 0],
        hipL: [66, 0, -2], hipR: [66, 0, 2],
        kneeL: [0, 0, 0], kneeR: [0, 0, 0],
        ankleL: [-110, 0, 0], ankleR: [-110, 0, 0],
      },
    },
    // 2. "Draw the lower belly up and lengthen the tailbone toward the heels."
    {
      root: { position: [0, 0.43, -0.08], rotation: [-2, 0, 0] },
      joints: {
        spine: [74, 0, 0], chest: [2, 0, 0], neck: [-10, 0, 0],
        shoulderL: [-74, 0, -4], shoulderR: [-74, 0, 4],
        elbowL: [0, 0, 0], elbowR: [0, 0, 0],
        wristL: [-18, 0, 0], wristR: [-18, 0, 0],
        hipL: [65, 0, -2], hipR: [65, 0, 2],
        kneeL: [0, 0, 0], kneeR: [0, 0, 0],
        ankleL: [-112, 0, 0], ankleR: [-112, 0, 0],
      },
    },
    // 3. "Press the floor away, broadening across the upper back."
    {
      root: { position: [0, 0.435, -0.08], rotation: [-2, 0, 0] },
      joints: {
        spine: [74, 0, 0], chest: [4, 0, 0], neck: [-12, 0, 0],
        shoulderL: [-76, 0, -5], shoulderR: [-76, 0, 5],
        elbowL: [0, 0, 0], elbowR: [0, 0, 0],
        wristL: [-18, 0, 0], wristR: [-18, 0, 0],
        hipL: [65, 0, -2], hipR: [65, 0, 2],
        kneeL: [0, 0, 0], kneeR: [0, 0, 0],
        ankleL: [-112, 0, 0], ankleR: [-112, 0, 0],
      },
    },
    // 4. "Keep the neck long, gaze just past the fingertips, and hold with steady breath."
    {
      root: { position: [0, 0.435, -0.08], rotation: [-2, 0, 0] },
      joints: {
        spine: [74, 0, 0], chest: [3, 0, 0], neck: [-8, 0, 0],
        shoulderL: [-75, 0, -4], shoulderR: [-75, 0, 4],
        elbowL: [0, 0, 0], elbowR: [0, 0, 0],
        wristL: [-18, 0, 0], wristR: [-18, 0, 0],
        hipL: [65, 0, -2], hipR: [65, 0, 2],
        kneeL: [0, 0, 0], kneeR: [0, 0, 0],
        ankleL: [-112, 0, 0], ankleR: [-112, 0, 0],
      },
    },
  ],
  focus: [
    { y: 0.34, zoom: 0.96 },
    { y: 0.3, zoom: 0.92 },
    { y: 0.32, zoom: 0.96 },
    { y: 0.34, zoom: 0.98 },
    { y: 0.32, zoom: 0.94 },
  ],
};

/* ---------------------------------------------------------------- *
 * Vrksasana — Tree Pose (5 steps)
 * ---------------------------------------------------------------- */
const TREE_POSE: PoseSequence = {
  groundSpread: 0.35,
  cameraAzimuth: 0.22,
  frames: [
    // 0. "Begin in Mountain Pose and shift your weight into the left foot."
    {
      root: { position: [-0.04, HIP_HEIGHT, 0], rotation: [0, 0, 0] },
      joints: {
        shoulderL: [0, 0, -8], shoulderR: [0, 0, 8],
        hipL: [0, 0, -2], hipR: [-8, 0, 8],
        kneeL: [0, 0, 0], kneeR: [22, 0, 0],
        ankleL: [-90, 0, 0], ankleR: [-72, 0, 0],
        spine: [0, 0, 0], chest: [-2, 0, 0], neck: [0, 0, 0],
      },
    },
    // 1. "Bend the right knee and place the sole of the right foot on the inner left thigh or calf (avoid the knee)."
    {
      root: { position: [-0.05, HIP_HEIGHT, 0], rotation: [0, 0, 0] },
      joints: {
        shoulderL: [-10, 0, -14], shoulderR: [-10, 0, 14],
        hipL: [0, 0, 0], kneeL: [0, 0, 0], ankleL: [-90, 0, 0],
        hipR: [-28, -58, 54], kneeR: [112, 0, 0], ankleR: [-60, 0, 0],
        spine: [0, 0, 0], chest: [-3, 0, 0], neck: [0, 0, 0],
      },
    },
    // 2. "Press foot and leg into each other and find a steady gaze."
    {
      root: { position: [-0.05, HIP_HEIGHT + 0.006, 0], rotation: [0, 0, 0] },
      joints: {
        shoulderL: [-24, 18, -22], shoulderR: [-24, -18, 22],
        elbowL: [-95, 0, 28], elbowR: [-95, 0, -28],
        wristL: [0, 0, 12], wristR: [0, 0, -12],
        hipL: [0, 0, 0], kneeL: [0, 0, 0], ankleL: [-90, 0, 0],
        hipR: [-26, -62, 56], kneeR: [116, 0, 0], ankleR: [-58, 0, 0],
        spine: [0, 0, 0], chest: [-4, 0, 0], neck: [0, 0, 0],
      },
    },
    // 3. "Bring hands to heart or reach the arms overhead like branches."
    {
      root: { position: [-0.05, HIP_HEIGHT + 0.01, 0], rotation: [0, 0, 0] },
      joints: {
        shoulderL: [0, 0, -162], shoulderR: [0, 0, 162],
        elbowL: [0, 0, 8], elbowR: [0, 0, -8],
        wristL: [0, 0, 6], wristR: [0, 0, -6],
        hipL: [0, 0, 0], kneeL: [0, 0, 0], ankleL: [-90, 0, 0],
        hipR: [-26, -62, 56], kneeR: [116, 0, 0], ankleR: [-58, 0, 0],
        spine: [-1, 0, 0], chest: [-6, 0, 0], neck: [-2, 0, 0],
      },
    },
    // 4. "Hold, then switch sides."
    {
      root: { position: [-0.05, HIP_HEIGHT + 0.012, 0], rotation: [0, 0, 0] },
      joints: {
        shoulderL: [0, 0, -164], shoulderR: [0, 0, 164],
        elbowL: [0, 0, 10], elbowR: [0, 0, -10],
        wristL: [0, 0, 8], wristR: [0, 0, -8],
        hipL: [0, 0, 0], kneeL: [0, 0, 0], ankleL: [-90, 0, 0],
        hipR: [-26, -62, 56], kneeR: [116, 0, 0], ankleR: [-58, 0, 0],
        spine: [-1, 0, 0], chest: [-6, 0, 0], neck: [-2, 0, 0],
      },
    },
  ],
  focus: [
    { y: 0.28, zoom: 1.0 },
    { y: 0.38, zoom: 1.04 },
    { y: 0.62, zoom: 1.02 },
    { y: 0.72, zoom: 0.92 },
    { y: 0.56, zoom: 0.92 },
  ],
};

/* ---------------------------------------------------------------- *
 * Virabhadrasana I — Warrior I (4 steps)
 * ---------------------------------------------------------------- */
const WARRIOR_I: PoseSequence = {
  groundSpread: 0.88,
  cameraAzimuth: 0.92,
  frames: [
    // 0. "Step the left foot back, heel turned down at 45°, hips facing forward."
    {
      root: { position: [0, 0.78, 0.04], rotation: [0, 0, 0] },
      joints: {
        hipR: [-22, 0, 2], kneeR: [10, 0, 0], ankleR: [-80, 0, 0],
        hipL: [24, 18, -2], kneeL: [0, 0, 0], ankleL: [-110, 18, 0],
        shoulderL: [0, 0, -8], shoulderR: [0, 0, 8],
        spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0],
      },
    },
    // 1. "Bend the front knee over the ankle."
    {
      root: { position: [0, 0.66, 0.08], rotation: [0, 0, 0] },
      joints: {
        hipR: [-52, 0, 2], kneeR: [54, 0, 0], ankleR: [-88, 0, 0],
        hipL: [34, 18, -2], kneeL: [0, 0, 0], ankleL: [-118, 18, 0],
        shoulderL: [0, 0, -10], shoulderR: [0, 0, 10],
        spine: [-2, 0, 0], chest: [-4, 0, 0], neck: [0, 0, 0],
      },
    },
    // 2. "Sweep the arms overhead, biceps by the ears, palms facing."
    {
      root: { position: [0, 0.65, 0.08], rotation: [0, 0, 0] },
      joints: {
        hipR: [-54, 0, 2], kneeR: [56, 0, 0], ankleR: [-88, 0, 0],
        hipL: [35, 18, -2], kneeL: [0, 0, 0], ankleL: [-118, 18, 0],
        shoulderL: [-168, 0, -6], shoulderR: [-168, 0, 6],
        elbowL: [0, 0, 0], elbowR: [0, 0, 0],
        spine: [-4, 0, 0], chest: [-8, 0, 0], neck: [-4, 0, 0],
      },
    },
    // 3. "Lift the chest, soften the shoulders, and gaze forward or up. Switch sides."
    {
      root: { position: [0, 0.65, 0.08], rotation: [0, 0, 0] },
      joints: {
        hipR: [-54, 0, 2], kneeR: [56, 0, 0], ankleR: [-88, 0, 0],
        hipL: [35, 18, -2], kneeL: [0, 0, 0], ankleL: [-118, 18, 0],
        shoulderL: [-170, 0, -5], shoulderR: [-170, 0, 5],
        elbowL: [0, 0, 0], elbowR: [0, 0, 0],
        spine: [-5, 0, 0], chest: [-12, 0, 0], neck: [-12, 0, 0],
      },
    },
  ],
  focus: [
    { y: 0.32, zoom: 0.94 },
    { y: 0.42, zoom: 0.96 },
    { y: 0.72, zoom: 0.9 },
    { y: 0.58, zoom: 0.92 },
  ],
};

/* ---------------------------------------------------------------- *
 * Utkatasana — Chair Pose (4 steps)
 * ---------------------------------------------------------------- */
const CHAIR_POSE: PoseSequence = {
  groundSpread: 0.36,
  cameraAzimuth: 1.05,
  frames: [
    // 0. "Stand with feet together or hip-width apart."
    TADASANA.frames[0]!,
    // 1. "Bend the knees and sit the hips back as if into a chair."
    {
      root: { position: [0, 0.62, -0.1], rotation: [0, 0, 0] },
      joints: {
        spine: [28, 0, 0], chest: [-6, 0, 0], neck: [-10, 0, 0],
        shoulderL: [-24, 0, -8], shoulderR: [-24, 0, 8],
        hipL: [-54, 0, -2], hipR: [-54, 0, 2],
        kneeL: [62, 0, 0], kneeR: [62, 0, 0],
        ankleL: [-98, 0, 0], ankleR: [-98, 0, 0],
      },
    },
    // 2. "Sweep the arms overhead, biceps by the ears."
    {
      root: { position: [0, 0.6, -0.11], rotation: [0, 0, 0] },
      joints: {
        spine: [30, 0, 0], chest: [-10, 0, 0], neck: [-12, 0, 0],
        shoulderL: [-156, 0, -6], shoulderR: [-156, 0, 6],
        elbowL: [0, 0, 0], elbowR: [0, 0, 0],
        hipL: [-58, 0, -2], hipR: [-58, 0, 2],
        kneeL: [66, 0, 0], kneeR: [66, 0, 0],
        ankleL: [-100, 0, 0], ankleR: [-100, 0, 0],
      },
    },
    // 3. "Keep the chest lifted and weight in the heels; breathe steadily."
    {
      root: { position: [0, 0.59, -0.12], rotation: [0, 0, 0] },
      joints: {
        spine: [28, 0, 0], chest: [-12, 0, 0], neck: [-10, 0, 0],
        shoulderL: [-160, 0, -5], shoulderR: [-160, 0, 5],
        elbowL: [0, 0, 0], elbowR: [0, 0, 0],
        hipL: [-60, 0, -2], hipR: [-60, 0, 2],
        kneeL: [68, 0, 0], kneeR: [68, 0, 0],
        ankleL: [-100, 0, 0], ankleR: [-100, 0, 0],
      },
    },
  ],
  focus: [
    { y: 0.45, zoom: 0.98 },
    { y: 0.38, zoom: 1.0 },
    { y: 0.62, zoom: 0.94 },
    { y: 0.5, zoom: 0.94 },
  ],
};

/* ---------------------------------------------------------------- *
 * Setu Bandhasana — Bridge Pose (4 steps)
 * ---------------------------------------------------------------- */
const BRIDGE_POSE: PoseSequence = {
  groundSpread: 0.72,
  cameraAzimuth: 1.32,
  frames: [
    // 0. "Lie on your back, knees bent, feet hip-width apart near the hips."
    {
      root: { position: [0, 0.09, 0], rotation: [0, 0, 0] },
      joints: {
        spine: [-88, 0, 0], chest: [0, 0, 0], neck: [6, 0, 0],
        shoulderL: [84, 0, -10], shoulderR: [84, 0, 10],
        elbowL: [0, 0, 0], elbowR: [0, 0, 0],
        hipL: [-54, 0, -4], hipR: [-54, 0, 4],
        kneeL: [118, 0, 0], kneeR: [118, 0, 0],
        ankleL: [-154, 0, 0], ankleR: [-154, 0, 0],
      },
    },
    // 1. "Press the feet down and lift the hips toward the sky."
    {
      root: { position: [0, 0.34, 0], rotation: [0, 0, 0] },
      joints: {
        spine: [-118, 0, 0], chest: [-10, 0, 0], neck: [24, 0, 0],
        shoulderL: [114, 0, -8], shoulderR: [114, 0, 8],
        elbowL: [0, 0, 0], elbowR: [0, 0, 0],
        hipL: [-16, 0, -4], hipR: [-16, 0, 4],
        kneeL: [98, 0, 0], kneeR: [98, 0, 0],
        ankleL: [-168, 0, 0], ankleR: [-168, 0, 0],
      },
    },
    // 2. "Interlace the hands beneath you and roll the shoulders under."
    {
      root: { position: [0, 0.38, 0], rotation: [0, 0, 0] },
      joints: {
        spine: [-122, 0, 0], chest: [-14, 0, 0], neck: [28, 0, 0],
        shoulderL: [124, 0, 6], shoulderR: [124, 0, -6],
        elbowL: [0, 0, 0], elbowR: [0, 0, 0],
        hipL: [-12, 0, -3], hipR: [-12, 0, 3],
        kneeL: [94, 0, 0], kneeR: [94, 0, 0],
        ankleL: [-170, 0, 0], ankleR: [-170, 0, 0],
      },
    },
    // 3. "Keep the knees parallel and breathe into the chest."
    {
      root: { position: [0, 0.39, 0], rotation: [0, 0, 0] },
      joints: {
        spine: [-124, 0, 0], chest: [-16, 0, 0], neck: [30, 0, 0],
        shoulderL: [124, 0, 6], shoulderR: [124, 0, -6],
        elbowL: [0, 0, 0], elbowR: [0, 0, 0],
        hipL: [-10, 0, -3], hipR: [-10, 0, 3],
        kneeL: [92, 0, 0], kneeR: [92, 0, 0],
        ankleL: [-170, 0, 0], ankleR: [-170, 0, 0],
      },
    },
  ],
  focus: [
    { y: 0.18, zoom: 0.96 },
    { y: 0.26, zoom: 0.98 },
    { y: 0.28, zoom: 1.0 },
    { y: 0.28, zoom: 0.98 },
  ],
};

/* ---------------------------------------------------------------- *
 * Archetype rigs for any catalog pose (by `asana.pose` key)
 * ---------------------------------------------------------------- */
export const POSE_ARCHETYPE_RIGS: Record<string, RigPose> = {
  mountain: TADASANA.frames[2]!,
  "down-dog": DOWN_DOG.frames[2]!,
  tree: TREE_POSE.frames[3]!,
  "warrior-2": WARRIOR_II.frames[3]!,
  "warrior-1": WARRIOR_I.frames[2]!,
  triangle: TRIANGLE.frames[2]!,
  chair: CHAIR_POSE.frames[2]!,
  cobra: COBRA.frames[2]!,
  bridge: BRIDGE_POSE.frames[2]!,
  child: CHILDS_POSE.frames[2]!,
  cat: CAT_EXHALE_POSE,
  cow: COW_INHALE_POSE,
  plank: PLANK.frames[2]!,
  "forward-fold": {
    root: { position: [0, HIP_HEIGHT - 0.04, 0], rotation: [0, 0, 0] },
    joints: {
      spine: [128, 0, 0], chest: [22, 0, 0], neck: [18, 0, 0],
      shoulderL: [-135, 0, -6], shoulderR: [-135, 0, 6],
      elbowL: [-12, 0, 0], elbowR: [-12, 0, 0],
      hipL: [0, 0, -2], hipR: [0, 0, 2],
      kneeL: [8, 0, 0], kneeR: [8, 0, 0],
      ankleL: [-90, 0, 0], ankleR: [-90, 0, 0],
    },
  },
  seated: {
    root: { position: [0, 0.11, 0], rotation: [0, 0, 0] },
    joints: {
      spine: [0, 0, 0], chest: [-4, 0, 0], neck: [0, 0, 0],
      shoulderL: [-12, 0, -14], shoulderR: [-12, 0, 14],
      elbowL: [-42, 0, 12], elbowR: [-42, 0, -12],
      hipL: [-82, 36, -38], hipR: [-82, -36, 38],
      kneeL: [118, 0, 0], kneeR: [118, 0, 0],
      ankleL: [-65, 0, 0], ankleR: [-65, 0, 0],
    },
  },
  "seated-fold": {
    root: { position: [0, 0.11, -0.15], rotation: [0, 0, 0] },
    joints: {
      spine: [64, 0, 0], chest: [14, 0, 0], neck: [10, 0, 0],
      shoulderL: [-82, 0, -6], shoulderR: [-82, 0, 6],
      elbowL: [-10, 0, 0], elbowR: [-10, 0, 0],
      hipL: [-88, 0, -3], hipR: [-88, 0, 3],
      kneeL: [2, 0, 0], kneeR: [2, 0, 0],
      ankleL: [-90, 0, 0], ankleR: [-90, 0, 0],
    },
  },
  boat: {
    root: { position: [0, 0.11, 0], rotation: [0, 0, 0] },
    joints: {
      spine: [-36, 0, 0], chest: [-6, 0, 0], neck: [18, 0, 0],
      shoulderL: [-54, 0, -6], shoulderR: [-54, 0, 6],
      elbowL: [0, 0, 0], elbowR: [0, 0, 0],
      hipL: [-132, 0, -3], hipR: [-132, 0, 3],
      kneeL: [6, 0, 0], kneeR: [6, 0, 0],
      ankleL: [-75, 0, 0], ankleR: [-75, 0, 0],
    },
  },
  butterfly: {
    root: { position: [0, 0.11, 0], rotation: [0, 0, 0] },
    joints: {
      spine: [4, 0, 0], chest: [-4, 0, 0], neck: [2, 0, 0],
      shoulderL: [8, 0, -10], shoulderR: [8, 0, 10],
      elbowL: [-32, 0, 16], elbowR: [-32, 0, -16],
      hipL: [-78, 48, -46], hipR: [-78, -48, 46],
      kneeL: [124, 0, 0], kneeR: [124, 0, 0],
      ankleL: [-60, 0, 0], ankleR: [-60, 0, 0],
    },
  },
  "low-lunge": {
    root: { position: [0, 0.44, 0.08], rotation: [0, 0, 0] },
    joints: {
      spine: [-6, 0, 0], chest: [-10, 0, 0], neck: [-8, 0, 0],
      shoulderL: [-166, 0, -6], shoulderR: [-166, 0, 6],
      hipR: [-78, 0, 2], kneeR: [82, 0, 0], ankleR: [-90, 0, 0],
      hipL: [34, 0, -2], kneeL: [62, 0, 0], ankleL: [10, 0, 0],
    },
  },
  savasana: {
    root: { position: [0, 0.08, 0], rotation: [0, 0, 0] },
    joints: {
      spine: [-90, 0, 0], chest: [0, 0, 0], neck: [4, 0, 0],
      shoulderL: [90, -24, -22], shoulderR: [90, 24, 22],
      elbowL: [0, 0, 0], elbowR: [0, 0, 0],
      hipL: [-90, 12, -10], hipR: [-90, -12, 10],
      kneeL: [0, 0, 0], kneeR: [0, 0, 0],
      ankleL: [-76, 0, 0], ankleR: [-76, 0, 0],
    },
  },
  "legs-up": {
    root: { position: [0, 0.09, 0], rotation: [0, 0, 0] },
    joints: {
      spine: [-90, 0, 0], chest: [0, 0, 0], neck: [4, 0, 0],
      shoulderL: [90, -20, -28], shoulderR: [90, 20, 28],
      hipL: [-176, 0, -3], hipR: [-176, 0, 3],
      kneeL: [0, 0, 0], kneeR: [0, 0, 0],
      ankleL: [-90, 0, 0], ankleR: [-90, 0, 0],
    },
  },
  squat: {
    root: { position: [0, 0.26, 0], rotation: [0, 0, 0] },
    joints: {
      spine: [8, 0, 0], chest: [-8, 0, 0], neck: [-4, 0, 0],
      shoulderL: [-28, 18, -24], shoulderR: [-28, -18, 24],
      elbowL: [-92, 0, 26], elbowR: [-92, 0, -26],
      hipL: [-112, 24, -36], hipR: [-112, -24, 36],
      kneeL: [126, 0, 0], kneeR: [126, 0, 0],
      ankleL: [-104, 0, 0], ankleR: [-104, 0, 0],
    },
  },
};

/** Slugs with hand-authored per-step rig keyframes. */
export const POSE_KEYFRAMES: Record<string, PoseSequence> = {
  tadasana: TADASANA,
  "virabhadrasana-ii": WARRIOR_II,
  "adho-mukha-svanasana": DOWN_DOG,
  bhujangasana: COBRA,
  trikonasana: TRIANGLE,
  "marjaryasana-bitilasana": CAT_COW,
  balasana: CHILDS_POSE,
  kumbhakasana: PLANK,
  vrksasana: TREE_POSE,
  "virabhadrasana-i": WARRIOR_I,
  utkatasana: CHAIR_POSE,
  "setu-bandhasana": BRIDGE_POSE,
};

export function hasRigSequence(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(POSE_KEYFRAMES, slug);
}

/**
 * Resolves a full step-by-step `PoseSequence` for any catalog pose.
 * Uses the hand-authored `POSE_KEYFRAMES[slug]` when present, or synthesizes a
 * smooth multi-step progression from the pose's entry shape to its peak shape.
 */
export function resolvePoseSequence(slug: string): PoseSequence | null {
  if (hasRigSequence(slug)) {
    return POSE_KEYFRAMES[slug]!;
  }
  const asana = asanaBySlug(slug);
  if (!asana) return null;

  const peakRig = POSE_ARCHETYPE_RIGS[asana.pose] ?? TADASANA.frames[2]!;
  const firstStepKey = asana.steps[0]?.pose ?? asana.pose;
  const prepRig =
    POSE_ARCHETYPE_RIGS[firstStepKey] ?? lerpPose(TADASANA.frames[0]!, peakRig, 0.35);

  const count = Math.max(1, asana.steps.length);
  const frames: RigPose[] = [];
  const focus: { y: number; zoom: number }[] = [];

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 1 : i / (count - 1);
    const stepKey = asana.steps[i]?.pose;
    const stepTarget = (stepKey && POSE_ARCHETYPE_RIGS[stepKey]) || peakRig;
    frames.push(lerpPose(prepRig, stepTarget, Math.min(1, 0.25 + 0.75 * t)));
    focus.push({
      y: peakRig.root.position[1] < 0.35 ? 0.26 : 0.52,
      zoom: 0.96,
    });
  }

  return {
    groundSpread: peakRig.root.position[1] < 0.35 ? 0.75 : 0.55,
    cameraAzimuth: peakRig.root.position[1] < 0.5 ? 1.15 : 0.42,
    frames,
    focus,
  };
}

export const RIG_PILOT_SLUGS = Object.keys(POSE_KEYFRAMES);

export type TrainerPhase =
  | "preparation"
  | "entry"
  | "hold"
  | "cycle"
  | "exit"
  | "side_change"
  | "side_switch"
  | "transition";

export type TrainerStageInput = {
  slug: string;
  level?: "beginner" | "intermediate" | "advanced";
  phase?: TrainerPhase;
  /** 1-based step number from PoseLesson, or null. */
  stepNumber?: number | null;
  /** 0-based step index when driven directly by GuidedSession. */
  stepIndex?: number;
  /** 0–1 progress through the current segment/step. */
  stepProgress?: number;
  side?: "left" | "right" | "both" | 1 | 2;
  /** First side taught in the catalog text (default "right"). */
  firstSide?: "left" | "right";
  breathMovement?: "inhale" | "exhale" | "neutral" | null;
  breathCue?: string | null;
  training?: boolean;
};

export type TrainerStageResolved = {
  sequence: PoseSequence;
  stepIndex: number;
  stepProgress: number;
  side: 1 | 2;
  overridePose: RigPose | null;
  breathMode: "inhale" | "exhale" | "steady";
  coachBadge: string;
};

/**
 * Computes the exact 3D Human Yoga Instructor posture, bilateral mirror side,
 * breath mode, and live coaching badge for any lesson or practice segment.
 */
export function resolveTrainerStageState(input: TrainerStageInput): TrainerStageResolved | null {
  const sequence = resolvePoseSequence(input.slug);
  if (!sequence || sequence.frames.length === 0) return null;

  const frames = sequence.frames;
  const lastIdx = frames.length - 1;
  const progress = Math.max(0, Math.min(1, input.stepProgress ?? 1));
  const firstSide = input.firstSide ?? "right";
  const levelLabel =
    input.level === "beginner"
      ? " · Beginner mod"
      : input.level === "advanced"
        ? " · Advanced"
        : "";

  let side: 1 | 2 = 1;
  if (input.side === 2) {
    side = 2;
  } else if (input.side === "left" || input.side === "right") {
    side = input.side === firstSide ? 1 : 2;
  }

  let breathMode: "inhale" | "exhale" | "steady" = "steady";
  if (
    input.breathMovement === "inhale" ||
    (input.breathCue && /\binhale\b/i.test(input.breathCue) && !/\bexhale\b/i.test(input.breathCue))
  ) {
    breathMode = "inhale";
  } else if (
    input.breathMovement === "exhale" ||
    (input.breathCue && /\bexhale\b/i.test(input.breathCue) && !/\binhale\b/i.test(input.breathCue))
  ) {
    breathMode = "exhale";
  }

  // Idle preview (before lesson starts): show the settled peak posture
  if (input.training === false) {
    const peakIdx = input.slug === "marjaryasana-bitilasana" ? 1 : lastIdx;
    return {
      sequence,
      stepIndex: peakIdx,
      stepProgress: 1,
      side: 1,
      overridePose: null,
      breathMode: "steady",
      coachBadge: `Pose guide · ${input.level ? `${input.level[0]!.toUpperCase()}${input.level.slice(1)} setup` : "Ready"}`,
    };
  }

  const phase = input.phase;
  if (!phase) {
    const idx = Math.max(0, Math.min(lastIdx, input.stepIndex ?? lastIdx));
    return {
      sequence,
      stepIndex: idx,
      stepProgress: progress,
      side,
      overridePose: null,
      breathMode,
      coachBadge: `Step ${idx + 1} of ${frames.length}${levelLabel}`,
    };
  }

  if (phase === "preparation" || phase === "transition") {
    return {
      sequence,
      stepIndex: 0,
      stepProgress: progress,
      side,
      overridePose: null,
      breathMode,
      coachBadge: `Foundation setup${levelLabel}`,
    };
  }

  if (phase === "entry") {
    const idx =
      input.stepNumber != null
        ? Math.max(0, Math.min(lastIdx, input.stepNumber - 1))
        : Math.max(0, Math.min(lastIdx, Math.floor(progress * lastIdx)));
    // Settle briskly into the step's target alignment so the practitioner sees
    // the full demonstrated shape while listening to the cue.
    const stepSettle = Math.min(1, 0.72 + (progress / 0.22) * 0.28);
    return {
      sequence,
      stepIndex: idx,
      stepProgress: stepSettle,
      side,
      overridePose: null,
      breathMode,
      coachBadge:
        breathMode === "inhale"
          ? `Inhale · Expand into shape${levelLabel}`
          : breathMode === "exhale"
            ? `Exhale · Articulate spine${levelLabel}`
            : `Step ${idx + 1} · Joint alignment${levelLabel}`,
    };
  }

  if (phase === "cycle") {
    // Dynamic flow rounds (e.g. Cat–Cow): alternate smoothly between inhale & exhale shapes
    const inhaleFrame = frames[Math.min(1, lastIdx)]!;
    const exhaleFrame = frames[Math.min(2, lastIdx)]!;
    const isExhale = breathMode === "exhale";
    const fromPose = isExhale ? inhaleFrame : exhaleFrame;
    const toPose = isExhale ? exhaleFrame : inhaleFrame;
    const smoothT = Math.min(1, progress / 0.75);
    return {
      sequence,
      stepIndex: isExhale ? Math.min(2, lastIdx) : Math.min(1, lastIdx),
      stepProgress: progress,
      side,
      overridePose: lerpPose(fromPose, toPose, smoothT),
      breathMode: isExhale ? "exhale" : "inhale",
      coachBadge: isExhale ? "Exhale · Round spine (Cat)" : "Inhale · Lift chest (Cow)",
    };
  }

  if (phase === "hold") {
    const holdIdx = input.slug === "marjaryasana-bitilasana" ? 1 : lastIdx;
    const isDynamic = input.slug === "marjaryasana-bitilasana";
    if (isDynamic && frames.length >= 3) {
      // In InstructorSession where Cat-Cow has a "hold" phase representing the flow window,
      // oscillate smoothly with the breath every 8 seconds.
      const wave = (Math.sin(progress * Math.PI * 4 - Math.PI / 2) + 1) / 2;
      return {
        sequence,
        stepIndex: wave < 0.5 ? 1 : 2,
        stepProgress: 1,
        side,
        overridePose: lerpPose(frames[1]!, frames[2]!, wave),
        breathMode: wave < 0.5 ? "inhale" : "exhale",
        coachBadge: wave < 0.5 ? "Inhale · Cow arch" : "Exhale · Cat round",
      };
    }
    return {
      sequence,
      stepIndex: holdIdx,
      stepProgress: 1,
      side,
      overridePose: null,
      breathMode: "steady",
      coachBadge: `Steady hold${side === 2 ? " · Left side" : ""}`,
    };
  }

  if (phase === "side_change" || phase === "side_switch") {
    const holdPose = frames[lastIdx]!;
    const neutralPose = frames[0]!;
    return {
      sequence,
      stepIndex: 0,
      stepProgress: progress,
      side: 1,
      overridePose: lerpPose(holdPose, neutralPose, Math.min(1, progress / 0.7)),
      breathMode: "steady",
      coachBadge: "Release & switch sides",
    };
  }

  // phase === "exit"
  const fromPose = frames[lastIdx]!;
  const toPose = frames[0]!;
  return {
    sequence,
    stepIndex: 0,
    stepProgress: progress,
    side,
    overridePose: lerpPose(fromPose, toPose, Math.min(1, progress / 0.75)),
    breathMode: "steady",
    coachBadge: "Return to neutral",
  };
}

