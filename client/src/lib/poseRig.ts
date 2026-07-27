/**
 * poseRig — a real jointed humanoid skeleton, expressed as data.
 *
 * The old PoseSvg approach stored each pose as a frozen SVG path string, so
 * there was no such thing as "an arm" to move. Here a pose is a set of joint
 * rotations on a shared skeleton, which means:
 *   - any two poses can be interpolated (limbs travel between shapes)
 *   - a narration step can own its own keyframe, so the body moves to the words
 *   - the same data drives a genuine 3D scene, not a rotated flat card
 *
 * Conventions
 * -----------
 * Right-handed, Y up. The figure faces +Z (toward the camera).
 * Rotations are local Euler angles in DEGREES, applied XYZ in the parent's space.
 *
 * Every bone extends along its local axis (+Y for the spine chain, -Y for limbs
 * and the head-to-toe hanging chains). With that convention:
 *
 *   spine  rotation.x > 0   → torso folds forward (+Z)
 *   hip    rotation.x < 0   → thigh swings forward (hip flexion)
 *   knee   rotation.x > 0   → heel travels backward (knee flexion)
 *   shoulder rotation.z     → arm sweeps out to the side; +Z lifts the RIGHT
 *                             arm, -Z lifts the LEFT arm (mirror negates z & y)
 *   neck   rotation.y       → head turns (gaze)
 *
 * Units are roughly metres; the assembled figure stands about 1.72 tall.
 */

export type Vec3 = [number, number, number];

export type JointName =
  | "spine"
  | "chest"
  | "neck"
  | "head"
  | "shoulderL"
  | "elbowL"
  | "wristL"
  | "shoulderR"
  | "elbowR"
  | "wristR"
  | "hipL"
  | "kneeL"
  | "ankleL"
  | "hipR"
  | "kneeR"
  | "ankleR";

export type BoneShape = "limb" | "torso" | "head" | "slab";

export type BoneSpec = {
  name: JointName;
  parent: JointName | null;
  /** Socket offset from the parent joint's origin, in parent local space. */
  offset: Vec3;
  /** Bone length along `axis`. */
  length: number;
  /** Which way the bone points at zero rotation. */
  axis: "up" | "down";
  /** Cross-section radius at the joint end. */
  r0: number;
  /** Cross-section radius at the far end — limbs taper, so r1 !== r0. */
  r1: number;
  /**
   * Cross-section is an ellipse, not a circle. A human torso is ~1.4× wider
   * than it is deep and a shin is slightly flattened; circles are exactly what
   * made the old figure read as plumbing.
   */
  sx?: number;
  sz?: number;
  shape?: BoneShape;
};

/*
 * Proportions follow the standard 7.5-head adult canon for a 1.72 m figure:
 * leg ≈ 0.48 H, hip→shoulder ≈ 0.29 H, shoulder→wrist ≈ 0.32 H, head ≈ 0.13 H.
 * Fingertips land at mid-thigh when the arms hang, which is the quickest way
 * to sanity-check a humanoid rig by eye.
 */
const SPINE_LEN = 0.22;   // pelvis → lower ribs
const CHEST_LEN = 0.28;   // lower ribs → shoulder line
const NECK_LEN = 0.075;
const HEAD_LEN = 0.195;
const UPPER_ARM = 0.3;
const FOREARM = 0.25;
const HAND = 0.17;
const THIGH = 0.43;
const SHIN = 0.4;
const FOOT = 0.18;

/** Half the biacromial (shoulder) width. */
const SHOULDER_X = 0.19;
/** Half the distance between hip joints. */
export const HIP_X = 0.095;

/** Hip height at rest — the root sits here so the feet land on y = 0. */
export const HIP_HEIGHT = THIGH + SHIN;

/**
 * Bones in parent-before-child order, so a single pass can build the hierarchy.
 */
export const SKELETON: BoneSpec[] = [
  // Torso: ONE continuous taper — wide at the hips, narrowest at the natural
  // waist (spine top == chest bottom, so the radii must match exactly), then
  // broad at the shoulders. The spine's base doubles as the pelvis; drawing a
  // separate hip blob on top of it is what produced a ball on the belly.
  { name: "spine", parent: null, offset: [0, 0, 0], length: SPINE_LEN, axis: "up", r0: 0.106, r1: 0.076, sx: 1.22, sz: 0.76, shape: "torso" },
  { name: "chest", parent: "spine", offset: [0, SPINE_LEN, 0], length: CHEST_LEN, axis: "up", r0: 0.076, r1: 0.112, sx: 1.46, sz: 0.72, shape: "torso" },
  { name: "neck", parent: "chest", offset: [0, CHEST_LEN - 0.01, 0], length: NECK_LEN, axis: "up", r0: 0.054, r1: 0.048, sx: 1, sz: 0.95 },
  { name: "head", parent: "neck", offset: [0, NECK_LEN - 0.03, 0], length: HEAD_LEN, axis: "up", r0: 0.095, r1: 0.095, sx: 0.9, sz: 1, shape: "head" },

  // Arms hang from the top of the chest, a shoulder-width apart.
  { name: "shoulderL", parent: "chest", offset: [-SHOULDER_X, CHEST_LEN - 0.035, 0], length: UPPER_ARM, axis: "down", r0: 0.052, r1: 0.04 },
  { name: "elbowL", parent: "shoulderL", offset: [0, -UPPER_ARM, 0], length: FOREARM, axis: "down", r0: 0.042, r1: 0.028 },
  { name: "wristL", parent: "elbowL", offset: [0, -FOREARM, 0], length: HAND, axis: "down", r0: 0.03, r1: 0.024, sx: 1.15, sz: 0.42, shape: "slab" },

  { name: "shoulderR", parent: "chest", offset: [SHOULDER_X, CHEST_LEN - 0.035, 0], length: UPPER_ARM, axis: "down", r0: 0.052, r1: 0.04 },
  { name: "elbowR", parent: "shoulderR", offset: [0, -UPPER_ARM, 0], length: FOREARM, axis: "down", r0: 0.042, r1: 0.028 },
  { name: "wristR", parent: "elbowR", offset: [0, -FOREARM, 0], length: HAND, axis: "down", r0: 0.03, r1: 0.024, sx: 1.15, sz: 0.42, shape: "slab" },

  // Legs hang from the root (pelvis), not from the spine.
  { name: "hipL", parent: null, offset: [-HIP_X, 0, 0], length: THIGH, axis: "down", r0: 0.076, r1: 0.055 },
  { name: "kneeL", parent: "hipL", offset: [0, -THIGH, 0], length: SHIN, axis: "down", r0: 0.055, r1: 0.033, sz: 0.92 },
  { name: "ankleL", parent: "kneeL", offset: [0, -SHIN, 0], length: FOOT, axis: "down", r0: 0.038, r1: 0.03, sx: 0.62, sz: 0.5, shape: "slab" },

  { name: "hipR", parent: null, offset: [HIP_X, 0, 0], length: THIGH, axis: "down", r0: 0.076, r1: 0.055 },
  { name: "kneeR", parent: "hipR", offset: [0, -THIGH, 0], length: SHIN, axis: "down", r0: 0.055, r1: 0.033, sz: 0.92 },
  { name: "ankleR", parent: "kneeR", offset: [0, -SHIN, 0], length: FOOT, axis: "down", r0: 0.038, r1: 0.03, sx: 0.62, sz: 0.5, shape: "slab" },
];

/**
 * The hip sockets sit at ±HIP_X, well inside the spine's base half-width
 * (0.106 × 1.22 ≈ 0.129), so the torso already covers them. No separate pelvis
 * mesh — one less seam, one less blob.
 */

export const JOINT_NAMES = SKELETON.map((b) => b.name);

export type RigPose = {
  /** Pelvis placement. Position is in world units; rotation in degrees. */
  root: { position: Vec3; rotation: Vec3 };
  joints: Partial<Record<JointName, Vec3>>;
};

const ZERO: Vec3 = [0, 0, 0];

/** Anatomical rest: standing, arms hanging, feet flat. */
export const REST_POSE: RigPose = {
  root: { position: [0, HIP_HEIGHT, 0], rotation: [0, 0, 0] },
  joints: {
    shoulderL: [0, 0, -6],
    shoulderR: [0, 0, 6],
    // Ankles rotate the foot from "hanging down" to "flat on the floor".
    ankleL: [-90, 0, 0],
    ankleR: [-90, 0, 0],
  },
};

/** Fills in every joint so interpolation never reads undefined. */
export function normalizePose(pose: RigPose): Required<RigPose> {
  const joints = {} as Record<JointName, Vec3>;
  for (const bone of SKELETON) {
    joints[bone.name] = pose.joints[bone.name] ?? REST_POSE.joints[bone.name] ?? ZERO;
  }
  return { root: pose.root, joints };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolate along the shorter arc so 170° → -170° travels 20°, not 340°. */
function lerpAngle(a: number, b: number, t: number): number {
  let d = ((b - a) % 360 + 540) % 360 - 180;
  return a + d * t;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function lerpAngles(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerpAngle(a[0], b[0], t), lerpAngle(a[1], b[1], t), lerpAngle(a[2], b[2], t)];
}

/** Ease-in-out — a body accelerates out of stillness and settles into the shape. */
export function easeInOut(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2;
}

export function lerpPose(a: RigPose, b: RigPose, t: number): Required<RigPose> {
  const A = normalizePose(a);
  const B = normalizePose(b);
  const joints = {} as Record<JointName, Vec3>;
  for (const bone of SKELETON) {
    joints[bone.name] = lerpAngles(
      A.joints[bone.name] ?? ZERO,
      B.joints[bone.name] ?? ZERO,
      t,
    );
  }
  return {
    root: {
      position: lerpVec3(A.root.position, B.root.position, t),
      rotation: lerpAngles(A.root.rotation, B.root.rotation, t),
    },
    joints,
  };
}

/** Mirrors a pose left↔right for "switch sides" cues. */
export function mirrorPose(pose: RigPose): RigPose {
  const src = normalizePose(pose);
  const joints: Partial<Record<JointName, Vec3>> = {};
  const swap: Partial<Record<JointName, JointName>> = {
    shoulderL: "shoulderR", shoulderR: "shoulderL",
    elbowL: "elbowR", elbowR: "elbowL",
    wristL: "wristR", wristR: "wristL",
    hipL: "hipR", hipR: "hipL",
    kneeL: "kneeR", kneeR: "kneeL",
    ankleL: "ankleR", ankleR: "ankleL",
  };
  for (const bone of SKELETON) {
    const from = swap[bone.name] ?? bone.name;
    const [x, y, z] = src.joints[from] ?? ZERO;
    // Mirroring across the YZ plane negates rotation about Y and Z.
    joints[bone.name] = [x, -y, -z];
  }
  const [rx, ry, rz] = src.root.rotation;
  const [px, py, pz] = src.root.position;
  return {
    root: { position: [-px, py, pz], rotation: [rx, -ry, -rz] },
    joints,
  };
}

/* ------------------------------------------------------------------ *
 * Breath — a small live overlay so a held pose is never dead-still.
 * ------------------------------------------------------------------ */

/**
 * Applies a subtle inhale/exhale ripple through the spine and shoulders.
 * `phase` is 0–1 through one breath cycle; `amount` scales the whole effect.
 */
export function applyBreath(pose: Required<RigPose>, phase: number, amount = 1): Required<RigPose> {
  const s = Math.sin(phase * Math.PI * 2) * amount;
  const joints = { ...pose.joints };
  const bump = (name: JointName, d: Vec3) => {
    const [x, y, z] = joints[name] ?? ([0, 0, 0] as Vec3);
    joints[name] = [x + d[0], y + d[1], z + d[2]];
  };
  bump("chest", [-1.1 * s, 0, 0]);
  bump("spine", [-0.5 * s, 0, 0]);
  bump("shoulderL", [0, 0, -1.4 * s]);
  bump("shoulderR", [0, 0, 1.4 * s]);
  return {
    root: {
      position: [pose.root.position[0], pose.root.position[1] + 0.006 * s, pose.root.position[2]],
      rotation: pose.root.rotation,
    },
    joints,
  };
}
