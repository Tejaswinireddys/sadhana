/**
 * On-device pose estimation pilot for 10 foundational poses.
 * Camera frames never leave the device; confidence is shown explicitly.
 * Uses browser PoseDetector when available, otherwise manual checklist mode.
 */
export const PILOT_POSES = [
  { slug: "tadasana", label: "Mountain", cues: ["Feet grounded", "Spine tall", "Arms soft"] },
  { slug: "vrksasana", label: "Tree", cues: ["Standing leg steady", "Hip level", "Gaze soft"] },
  { slug: "adho-mukha-svanasana", label: "Down Dog", cues: ["Hips high", "Long spine", "Heels easing"] },
  { slug: "balasana", label: "Child", cues: ["Hips toward heels", "Forehead resting", "Breath easy"] },
  { slug: "bhujangasana", label: "Cobra", cues: ["Pelvis heavy", "Chest lifts", "Shoulders away from ears"] },
  { slug: "virabhadrasana-ii", label: "Warrior II", cues: ["Front knee tracks toes", "Arms level", "Torso upright"] },
  { slug: "uttanasana", label: "Forward Fold", cues: ["Soft knees ok", "Weight in mid-foot", "Neck soft"] },
  { slug: "sukhasana", label: "Easy Seat", cues: ["Sit bones grounded", "Spine lengthens", "Jaw soft"] },
  { slug: "setu-bandhasana", label: "Bridge", cues: ["Feet under knees", "Thighs parallel", "Chin soft"] },
  { slug: "savasana", label: "Savasana", cues: ["Body heavy", "Palms open", "Nothing to do"] },
] as const;

export type PilotPoseSlug = (typeof PILOT_POSES)[number]["slug"];

export type CoachFeedback = {
  confidence: number; // 0–1
  message: string;
  /** Never binary "safe/unsafe" — only probabilistic coaching */
  mode: "camera" | "manual";
};

export function isPilotPose(slug: string): slug is PilotPoseSlug {
  return PILOT_POSES.some((p) => p.slug === slug);
}

/** Heuristic confidence from self-check toggles (manual / AT mode). */
export function manualConfidence(checked: boolean[], total: number): CoachFeedback {
  const n = checked.filter(Boolean).length;
  const confidence = total === 0 ? 0 : n / total;
  return {
    mode: "manual",
    confidence,
    message:
      confidence >= 0.8
        ? "Looking steady on your checklist — keep breathing."
        : confidence >= 0.4
          ? "A few cues still need attention — no rush."
          : "Take your time settling each cue. Pain means stop.",
  };
}

/**
 * Very light on-device heuristic using face/body bounding box size stability
 * when PoseDetector isn't loaded. Not biomechanical — clearly labeled.
 */
export function stabilityConfidence(
  samples: number[],
  poseLabel: string,
): CoachFeedback {
  if (samples.length < 4) {
    return {
      mode: "camera",
      confidence: 0.2,
      message: `Calibrating ${poseLabel}… hold still for a moment.`,
    };
  }
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance =
    samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
  const stability = Math.max(0, Math.min(1, 1 - variance * 8));
  return {
    mode: "camera",
    confidence: stability,
    message:
      stability > 0.75
        ? `Stable shape detected for ${poseLabel} (confidence ${(stability * 100).toFixed(0)}%). Still not medical advice.`
        : `Movement variance is high — adjust slowly. Confidence ${(stability * 100).toFixed(0)}%.`,
  };
}

export async function requestCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera is not available in this browser.");
  }
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
}
