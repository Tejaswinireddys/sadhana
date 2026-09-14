/**
 * Self-check helper for 10 foundational poses.
 *
 * There is NO body/pose estimation here. The optional camera is a private,
 * on-device preview (a mirror) to help you frame yourself — frames never upload
 * and the app does not analyze or score your posture. The only "confidence" is
 * derived from the cues YOU manually check off. Do not present this as posture
 * correction or a safe/unsafe verdict.
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
  confidence: number; // 0–1, derived only from your own self-check toggles
  message: string;
  /** Only "manual" — the app never scores your body from the camera. */
  mode: "manual";
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

export type CameraRequestStatus =
  | "idle"
  | "pending"
  | "ready"
  | "denied"
  | "unavailable"
  | "timeout";

export const CAMERA_REQUEST_TIMEOUT_MS = 8_000;

export function cameraStatusMessage(status: CameraRequestStatus): string | null {
  switch (status) {
    case "pending":
      return "Waiting for camera permission…";
    case "denied":
      return "Camera permission was denied. You can still use the checklist, or allow the camera in your browser settings and try again.";
    case "unavailable":
      return "No camera is available on this device. You can still use the checklist.";
    case "timeout":
      return "The camera request timed out. Try again, or continue with the checklist.";
    default:
      return null;
  }
}

export function classifyCameraError(err: unknown): Exclude<CameraRequestStatus, "idle" | "pending" | "ready"> {
  const name = err instanceof DOMException ? err.name : err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || /denied|permission/i.test(message)) {
    return "denied";
  }
  if (name === "AbortError" || /timed? ?out/i.test(message)) return "timeout";
  return "unavailable";
}

export async function requestCameraStream(opts?: { timeoutMs?: number }): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    const err = new Error("Camera is not available in this browser.");
    err.name = "NotFoundError";
    throw err;
  }
  const timeoutMs = opts?.timeoutMs ?? CAMERA_REQUEST_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error("Camera request timed out.");
      err.name = "AbortError";
      reject(err);
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      }),
      timeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
