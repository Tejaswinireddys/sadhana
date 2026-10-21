/**
 * One authoritative timeline for teaching a catalog pose.
 *
 * Everything the lesson shows — demonstration segment, narration, caption,
 * step number, body-area highlight, side, variation, phase and remaining time
 * — is read from the segment that is current at time t. Previously the step
 * index came from narration timing, the figure came from a video scrub, the
 * highlight came from a regex over the cue text, and the "Hold ~45s" label came
 * from a catalog field none of them consulted, so they routinely disagreed.
 *
 * Static poses:   preparation → entry → hold → exit ( → side change → repeat )
 * Dynamic poses:  preparation → entry → cycle × rounds → exit
 *
 * Every pose teaches the complete trainer progression:
 * Starting position → small movement steps → breathing → alignment checks →
 * easier option → hold → exact exit → next-pose transition.
 */
import type { Asana, Variation } from "@/data/content";
import { asanaBySlug } from "@/data/content";
import {
  isDynamicPractice,
  poseDemoAvailability,
  type PoseDemoAvailability,
  type VariationLevel,
} from "@/data/poseDemoAvailability";
import type { FocusZone } from "@/lib/poseMoments";

export type { VariationLevel };

export type LessonPhase =
  | "preparation"
  | "entry"
  | "hold"
  | "cycle"
  | "exit"
  | "side_change";

export type BreathMovement = "inhale" | "exhale" | "neutral";

export type LessonSegment = {
  id: string;
  phase: LessonPhase;
  /** 1-based teaching step, or null for transitions that are not steps. */
  stepNumber: number | null;
  startSec: number;
  durationSec: number;
  /** The single primary instruction on screen. */
  cue: string;
  caption: string;
  breathCue: string | null;
  side: "left" | "right" | "both";
  /**
   * Authored highlight only. Inferred coordinates pointed at the wrong body
   * part often enough (Warrior II "arms extended" → the head) that guessing is
   * worse than omitting.
   */
  focus: FocusZone | null;
  /** Present on `cycle` segments. */
  cycle: { round: number; totalRounds: number; movement: BreathMovement } | null;
};

export type PoseLesson = {
  slug: string;
  english: string;
  level: VariationLevel;
  kind: "dynamic" | "static";
  sides: "once" | "each";
  segments: LessonSegment[];
  totalSec: number;
  /** Rounds for a dynamic practice; null for a hold. */
  rounds: number | null;
  /** "8 rounds · about 1:20" or "Hold about 40s each side" — never both. */
  durationLabel: string;
  props: string[];
  demo: PoseDemoAvailability;
  /**
   * Set when the picture on screen does not depict the selected variation —
   * e.g. Tree's beginner setup is toes-down with a hand on a wall, but the only
   * image is the unsupported balance. Disclosing beats silently showing a
   * different variation.
   */
  variationVisualMismatch: string | null;
  /** Steps as displayed in the numbered list, matching the segments. */
  steps: Array<{ number: number; text: string }>;
};

function pushSegment(
  out: LessonSegment[],
  cursor: { t: number },
  seg: Omit<LessonSegment, "startSec">,
): void {
  out.push({ ...seg, startSec: cursor.t });
  cursor.t += Math.max(0, seg.durationSec);
}

/**
 * Poses whose authored focus zones have been checked against the illustration
 * that is actually on screen, at the framing it is actually rendered at.
 *
 * Empty, deliberately. The catalog's zones are hand-written normalized
 * coordinates that assume a particular figure framing, and at least one is
 * demonstrably wrong: Warrior II's "Arms extended" is {cy: 0.30, r: 0.26},
 * which spans from the crown to the waist — the reported bug where the arms
 * cue highlighted the head. Until a reviewer confirms a pose's zones land on
 * the right body parts, no halo is drawn for it.
 */
export const VERIFIED_FOCUS_POSES = new Set<string>();

/**
 * Authored zones only, and only for poses whose zones have been verified.
 * Pointing at the wrong body part teaches the wrong thing, so the fallback is
 * no highlight rather than an approximate one.
 */
function authoredFocus(
  slug: string,
  step: { focusZone?: FocusZone | null } | undefined,
): FocusZone | null {
  if (!VERIFIED_FOCUS_POSES.has(slug)) return null;
  return step?.focusZone ?? null;
}

function variationFor(asana: Asana, level: VariationLevel): Variation | undefined {
  return asana.variations?.[level];
}

/**
 * Identify the starting position for a pose so preparation cues always begin
 * from an explicit anatomical base.
 */
export function startingPositionFor(asana: Asana): string {
  const first = asana.steps[0]?.text ?? "";
  if (/all fours|tabletop|hands and knees/i.test(first)) {
    return "neutral Tabletop on hands and knees";
  }
  if (/lie on your back|supine|on your back/i.test(first)) {
    return "a comfortable supine position on your back";
  }
  if (/belly|prone|on your stomach/i.test(first)) {
    return "a prone position on your belly";
  }
  if (/sit|seated|dandasana|cross-legged|staff/i.test(first) || asana.category === "Seated") {
    return "Staff Pose (Dandasana) with a tall spine";
  }
  if (/kneel|shins/i.test(first)) {
    return "a comfortable kneeling position on your shins";
  }
  return "Mountain Pose (Tadasana) at the top of your mat";
}

/**
 * Adapt every step of a pose to the selected difficulty and modification so
 * beginner instructions never contradict themselves (e.g. Warrior II saying
 * "bend the front knee partway" in setup and then "bend toward 90°" in Step 2,
 * or Tree Pose saying "toes on the floor" and then "sole on the inner thigh").
 */
export function stepsForVariation(
  asana: Asana,
  level: VariationLevel,
): Array<{ text: string; pose?: string; focusZone?: FocusZone | null }> {
  const v = variationFor(asana, level);
  if (v?.steps && v.steps.length > 0) return v.steps;

  const base = asana.steps;
  const slug = asana.slug;

  if (slug === "virabhadrasana-ii") {
    if (level === "beginner") {
      return [
        {
          text: "Start in Mountain Pose (Tadasana). Step your feet to a shortened stance about 3 to 3.5 feet apart, turn the right foot out 90° and the back foot slightly in.",
          pose: base[0]?.pose,
          focusZone: base[0]?.focusZone ?? null,
        },
        {
          text: "Exhale and bend the right knee only partway (about 45°–60°), keeping the kneecap stacked over the ankle without forcing a deep lunge.",
          pose: base[1]?.pose,
          focusZone: base[1]?.focusZone ?? null,
        },
        {
          text: "Inhale to float your arms to shoulder height, palms down — or rest your hands on your hips anytime your shoulders tire (easier option).",
          pose: base[2]?.pose,
          focusZone: base[2]?.focusZone ?? null,
        },
        {
          text: "Check that your torso stays stacked upright over your pelvis, soften your shoulders, and gaze steadily over your right fingertips as you breathe.",
          pose: base[3]?.pose,
          focusZone: base[3]?.focusZone ?? null,
        },
      ];
    }
    if (level === "advanced") {
      return [
        {
          text: "Start in Mountain Pose. Step the feet 4 to 4.5 feet apart, align front heel to back arch, and turn the right foot out 90°.",
          pose: base[0]?.pose,
          focusZone: base[0]?.focusZone ?? null,
        },
        {
          text: "Exhale and lower the right thigh parallel to the floor (a full 90° knee bend), tracking the right knee cleanly toward the second toe.",
          pose: base[1]?.pose,
          focusZone: base[1]?.focusZone ?? null,
        },
        {
          text: "Inhale to extend both arms strongly from the shoulder blades, broadening across the collarbones while rooting the outer left heel.",
          pose: base[2]?.pose,
          focusZone: base[2]?.focusZone ?? null,
        },
        {
          text: "Hold with a longer, unhurried breath, keeping the spine vertical and gaze locked over the front middle finger.",
          pose: base[3]?.pose,
          focusZone: base[3]?.focusZone ?? null,
        },
      ];
    }
  }

  if (slug === "vrksasana") {
    if (level === "beginner") {
      return [
        {
          text: "Start in Mountain Pose beside a wall. Shift your weight into the left foot and rest your fingertips lightly on the wall for balance.",
          pose: base[0]?.pose,
          focusZone: base[0]?.focusZone ?? null,
        },
        {
          text: "Turn the right knee gently out and place the right heel against the inner left ankle with the toes of the lifted foot resting on the floor as a kickstand.",
          pose: base[1]?.pose,
          focusZone: base[1]?.focusZone ?? null,
        },
        {
          text: "Bring your free hand to your heart or keep both hands on your hips (easier option) while lengthening tall through the crown of your head.",
          pose: base[2]?.pose,
          focusZone: base[2]?.focusZone ?? null,
        },
        {
          text: "Fix a calm gaze at eye level, check that both hips stay level, and breathe smoothly through the nose.",
          pose: base[3]?.pose,
          focusZone: base[3]?.focusZone ?? null,
        },
      ];
    }
    if (level === "advanced") {
      return [
        {
          text: "Start in Mountain Pose at the center of your mat and root evenly through all four corners of the left foot.",
          pose: base[0]?.pose,
          focusZone: base[0]?.focusZone ?? null,
        },
        {
          text: "Draw the right foot up and press the sole firmly into the inner left thigh above the knee, resisting thigh and foot equally into the midline.",
          pose: base[1]?.pose,
          focusZone: base[1]?.focusZone ?? null,
        },
        {
          text: "Inhale to reach both arms overhead with palms facing or touching, softening the tops of the shoulders away from the ears.",
          pose: base[2]?.pose,
          focusZone: base[2]?.focusZone ?? null,
        },
        {
          text: "Hold steady with deep nasal breath; if stable, experiment with lifting the gaze slightly or softly closing the eyes.",
          pose: base[3]?.pose,
          focusZone: base[3]?.focusZone ?? null,
        },
      ];
    }
  }

  if (slug === "marjaryasana-bitilasana" && level === "beginner") {
    return [
      {
        text: "Start on all fours in Tabletop with a folded blanket under your knees, wrists under shoulders, and knees under hips.",
        pose: base[0]?.pose,
        focusZone: base[0]?.focusZone ?? null,
      },
      {
        text: "Inhale: let the belly soften slightly and lift the chest and gaze forward in a gentle, comfortable arc (Cow Pose).",
        pose: base[1]?.pose,
        focusZone: base[1]?.focusZone ?? null,
      },
      {
        text: "Exhale: press into your palms, draw the navel in, and round the upper back gently toward the ceiling (Cat Pose).",
        pose: base[2]?.pose,
        focusZone: base[2]?.focusZone ?? null,
      },
      {
        text: "Press into your palms first and inhale to lengthen the spine back into a flat, neutral Tabletop.",
        pose: base[3]?.pose,
        focusZone: base[3]?.focusZone ?? null,
      },
    ];
  }

  if (level === "beginner" && v) {
    const desc = v.description ?? "";
    const partialBend = /partway|smaller range|shorten|gentle|micro-bend|bend the knees/i.test(desc);
    return base.map((s, idx) => {
      let text = s.text;
      if (partialBend) {
        text = text
          .replace(/toward 90°/gi, "partway to a comfortable angle (about 45°–60°)")
          .replace(/to 90°/gi, "to a comfortable, supported angle")
          .replace(/parallel to the floor/gi, "toward a comfortable, supported depth");
      }
      if (idx === base.length - 1 && asana.modifications && !text.includes(asana.modifications)) {
        text = `${text} Easier option: ${asana.modifications}`;
      }
      return {
        text,
        pose: s.pose,
        focusZone: s.focusZone ?? null,
      };
    });
  }

  return base;
}

function stepsFor(asana: Asana, level: VariationLevel): Array<{ text: string; focusZone?: FocusZone | null }> {
  return stepsForVariation(asana, level);
}

function sidesFor(asana: Asana): "once" | "each" {
  return /each side/i.test(asana.hold ?? "") ? "each" : "once";
}

/**
 * Swap the left/right words in a cue.
 *
 * Catalog steps are written for one side ("turn the right foot out 90°").
 * Replaying that verbatim on the second side tells the practitioner to set up
 * the side they have just finished.
 */
export function mirrorCue(text: string): string {
  return text.replace(/\b(left|right|Left|Right)\b/g, (m) => {
    switch (m) {
      case "left":
        return "right";
      case "right":
        return "left";
      case "Left":
        return "Right";
      default:
        return "Left";
    }
  });
}

/** Which side the catalog steps are written for, so the mirror goes the right way. */
export function namedSideIn(steps: Array<{ text: string }>): "left" | "right" {
  let left = 0;
  let right = 0;
  for (const s of steps) {
    left += (s.text.match(/\bleft\b/gi) ?? []).length;
    right += (s.text.match(/\bright\b/gi) ?? []).length;
  }
  // Warrior II and Tree both name the working side more often than the
  // supporting one; ties fall back to right, the conventional first side.
  return left > right ? "left" : "right";
}

/**
 * The variation actually changes the shape, but the catalog authors no
 * per-variation steps — every level falls back to the same generic cues. That
 * is how a beginner reading "place the sole on the inner thigh" was shown a
 * variation described as "toes on the floor, one hand on a wall".
 *
 * The variation's own description is authored content, so surface it as the
 * setup instruction rather than inventing new cueing.
 */
export function variationSetupCue(asana: Asana, level: VariationLevel): string | null {
  const v = variationFor(asana, level);
  const description = v?.description?.trim();
  if (!description) return null;
  const props = (v?.props ?? []).filter((p) => p && p !== "none");
  const propLine = props.length ? ` Props: ${props.join(", ")}.` : "";
  return `${description}${propLine}`;
}

function sideSuffix(side: "left" | "right" | "both"): string {
  return side === "both" ? "" : ` · ${side} side`;
}

/**
 * Exact anatomical exit cue explaining which body part moves first and how to
 * return to a neutral position — never a vague "Come out of … with control."
 */
export function exactExitCueFor(
  asana: Asana,
  side: "left" | "right" | "both" = "both",
  mirrored = false,
): string {
  const say = (text: string) => (mirrored ? mirrorCue(text) : text);
  const slug = asana.slug;

  const authoredExits: Record<string, string> = {
    "virabhadrasana-ii":
      "Inhale to press firmly into the right heel and straighten the right knee first, lower both arms to your sides, turn the right toes in to parallel, and step the feet together into neutral Mountain Pose.",
    "virabhadrasana-i":
      "Exhale to lower your hands to your hips first, inhale to press into the right heel and straighten the front leg, then step the back foot forward into neutral Mountain Pose.",
    "virabhadrasana-iii":
      "Soften the standing knee first, lower the lifted leg to the mat beside your standing foot, bring your hands to your hips, and rise upright into neutral Mountain Pose.",
    vrksasana:
      "Exhale to bring your hands to your hips first, guide the right knee forward to center, set the right foot flat on the mat beside the left foot, and stand tall in neutral Mountain Pose.",
    trikonasana:
      "Look down at your front foot and soften the right knee first, press through the right heel to inhale the torso upright, lower your arms, turn the right toes in, and step back to Mountain Pose.",
    "utthita-parsvakonasana":
      "Press firmly through the back heel and front foot first, inhale to lift the torso upright, straighten the right knee, lower both arms, and step the feet together into Mountain Pose.",
    anjaneyasana:
      "Exhale to frame the front foot with both hands first, shift the hips slightly back to take weight off the front knee, and step the front knee back beside the other into neutral Tabletop.",
    uttanasana:
      "Soften both knees first, bring your hands to your hips, press evenly through your heels, and inhale to hinge upright with a long spine into neutral Mountain Pose.",
    "ardha-uttanasana":
      "Soften both knees first, bring your hands to your hips, and inhale to rise all the way up into neutral Mountain Pose.",
    "adho-mukha-svanasana":
      "Exhale to bend both knees first and lower them gently to the mat, untuck the toes, and stack your shoulders over your wrists in neutral Tabletop.",
    balasana:
      "Walk your hands back toward your knees first, press into your palms, and inhale to stack the spine upright vertebra by vertebra into a neutral kneeling seat.",
    "salamba-balasana":
      "Slide your hands back beside your ribs first, press into the palms, and inhale to lift the torso upright off the bolster into a neutral kneeling seat.",
    "marjaryasana-bitilasana":
      "Press evenly into your palms first, inhale to lengthen the spine back to a flat, neutral Tabletop, and let your breath settle.",
    kumbhakasana:
      "Exhale to lower both knees gently to the mat first, untuck the toes, and shift your hips back slightly into neutral Tabletop.",
    bhujangasana:
      "Exhale to bend the elbows first and slowly lower the lower ribs, chest, and forehead back to the mat, resting in neutral prone position.",
    "setu-bandhasana":
      "Release your hands out from under your back first, lift the heels slightly, and exhale to roll the upper spine, mid-back, and sacrum down to the mat into neutral constructive rest.",
    "setu-bandha-sarvangasana":
      "Release your hands out from under your back first, lift the heels slightly, and exhale to roll the upper spine, mid-back, and sacrum down to the mat into neutral constructive rest.",
    paschimottanasana:
      "Release your feet or shins with your hands first, inhale to walk your palms back along your legs, and stack the spine upright into neutral Staff Pose.",
    "baddha-konasana":
      "Use your hands on the outer thighs to draw both knees together first, plant the feet flat on the floor, and lengthen the spine in a neutral upright seat.",
    "viparita-karani":
      "Bend both knees first and slide your feet down the wall toward your pelvis, roll gently onto one side for a breath, and press up with your hands to a neutral seat.",
    savasana:
      "Wiggle your fingers and toes first, bend your knees one at a time to plant your feet on the mat, roll gently onto your side, and press up into a comfortable neutral seat.",
  };

  if (authoredExits[slug]) {
    return say(authoredExits[slug]!);
  }

  const startPos = startingPositionFor(asana);
  if (asana.category === "Standing") {
    return say(
      `Soften the working knee and bring your hands to your hips first, press through your feet to lift the torso upright, and step back into neutral ${startPos}${sideSuffix(side)}.`,
    );
  }
  if (asana.category === "Forward Bends" || asana.category === "Seated") {
    return say(
      `Release your hands first, walk your palms back toward your hips, and inhale to stack the spine upright into neutral ${startPos}${sideSuffix(side)}.`,
    );
  }
  if (asana.category === "Backbends") {
    return say(
      `Release your grip or soften your elbows first, and exhale to lower the spine vertebra by vertebra back into neutral ${startPos}${sideSuffix(side)}.`,
    );
  }
  return say(
    `Release the active limb first, unwind the spine slowly on an exhale, and return to neutral ${startPos}${sideSuffix(side)}.`,
  );
}

/**
 * Exact side-change cue explaining how to release the first side to neutral
 * before setting up on the second side.
 */
export function exactSideChangeCueFor(
  asana: Asana,
  firstSide: "left" | "right",
  secondSide: "left" | "right",
): string {
  if (asana.slug === "virabhadrasana-ii") {
    return `Release ${asana.english}: press through the ${firstSide} heel to straighten the ${firstSide} knee first, lower your arms, parallel your feet in Mountain Pose, then turn the ${secondSide} foot out 90° for the ${secondSide} side.`;
  }
  if (asana.slug === "vrksasana") {
    return `Release ${asana.english}: bring your hands to your hips first, set the ${firstSide} foot down beside the ${secondSide} in neutral Mountain Pose, then shift your weight into the ${firstSide} foot for the ${secondSide} side.`;
  }
  return `Release ${asana.english} by unwinding the ${firstSide} side first, return to ${startingPositionFor(asana)}, and set up on the ${secondSide} side.`;
}

/** Rounds for a flowing practice, derived from the variation's time budget. */
export function roundsFor(asana: Asana, level: VariationLevel): number {
  const seconds = variationFor(asana, level)?.holdSeconds ?? asana.holdSeconds ?? 60;
  // One round is one full breath in and out — about 8 seconds at a teaching pace.
  return Math.max(4, Math.min(12, Math.round(seconds / 8)));
}

const SECONDS_PER_HALF_CYCLE = 4;

/**
 * Cat–Cow and friends: a neutral setup, then distinct inhale and exhale
 * movements repeated for a number of rounds, finishing back in neutral.
 */
function buildDynamicSegments(opts: {
  asana: Asana;
  level: VariationLevel;
  steps: Array<{ text: string; focusZone?: FocusZone | null }>;
  out: LessonSegment[];
  cursor: { t: number };
}): number {
  const { asana, level, steps, out, cursor } = opts;
  const rounds = roundsFor(asana, level);
  const slug = asana.slug;

  // Step 1 — the starting position, held still long enough to copy.
  const setup = variationSetupCue(asana, level);
  pushSegment(out, cursor, {
    id: `${slug}-prep`,
    phase: "preparation",
    stepNumber: 1,
    durationSec: 10,
    cue: setup
      ? `${steps[0]?.text ?? "Set up your starting position."} ${setup}`.trim()
      : steps[0]?.text ?? "Set up your starting position.",
    caption: `${asana.english} · set up`,
    breathCue: "Settle your breath before you move.",
    side: "both",
    focus: authoredFocus(slug, steps[0]),
    cycle: null,
  });

  // The two shapes taught once each, slowly, before they are repeated.
  const inhaleStep = steps[1];
  const exhaleStep = steps[2];

  pushSegment(out, cursor, {
    id: `${slug}-teach-inhale`,
    phase: "entry",
    stepNumber: 2,
    durationSec: 8,
    cue: inhaleStep?.text ?? "Inhale into the first shape.",
    caption: `${asana.english} · first shape`,
    breathCue: "Inhale",
    side: "both",
    focus: authoredFocus(slug, inhaleStep),
    cycle: null,
  });

  pushSegment(out, cursor, {
    id: `${slug}-teach-exhale`,
    phase: "entry",
    stepNumber: 3,
    durationSec: 8,
    cue: exhaleStep?.text ?? "Exhale into the second shape.",
    caption: `${asana.english} · second shape`,
    breathCue: "Exhale",
    side: "both",
    focus: authoredFocus(slug, exhaleStep),
    cycle: null,
  });

  // Then the practice itself: one movement per breath, for real rounds.
  for (let round = 1; round <= rounds; round++) {
    pushSegment(out, cursor, {
      id: `${slug}-cycle-${round}-inhale`,
      phase: "cycle",
      stepNumber: 4,
      durationSec: SECONDS_PER_HALF_CYCLE,
      cue: inhaleStep?.text ?? "Inhale into the first shape.",
      caption: `Round ${round} of ${rounds} · inhale`,
      breathCue: "Inhale",
      side: "both",
      focus: authoredFocus(slug, inhaleStep),
      cycle: { round, totalRounds: rounds, movement: "inhale" },
    });
    pushSegment(out, cursor, {
      id: `${slug}-cycle-${round}-exhale`,
      phase: "cycle",
      stepNumber: 4,
      durationSec: SECONDS_PER_HALF_CYCLE,
      cue: exhaleStep?.text ?? "Exhale into the second shape.",
      caption: `Round ${round} of ${rounds} · exhale`,
      breathCue: "Exhale",
      side: "both",
      focus: authoredFocus(slug, exhaleStep),
      cycle: { round, totalRounds: rounds, movement: "exhale" },
    });
  }

  // Finish where we started with an explicit anatomical exit.
  pushSegment(out, cursor, {
    id: `${slug}-exit`,
    phase: "exit",
    stepNumber: steps.length,
    durationSec: 8,
    cue: exactExitCueFor(asana, "both", false),
    caption: `${asana.english} · return to neutral`,
    breathCue: "Let the breath settle.",
    side: "both",
    focus: authoredFocus(slug, steps[steps.length - 1]),
    cycle: null,
  });

  return rounds;
}

/** A held shape: prepare, enter, hold, exit — per side when the pose needs both. */
function buildStaticSideSegments(opts: {
  asana: Asana;
  level: VariationLevel;
  steps: Array<{ text: string; focusZone?: FocusZone | null }>;
  side: "left" | "right" | "both";
  holdSec: number;
  /** True when this side's cues must be mirrored from the authored text. */
  mirrored: boolean;
  out: LessonSegment[];
  cursor: { t: number };
}): void {
  const { asana, level, steps, side, holdSec, mirrored, out, cursor } = opts;
  const slug = asana.slug;
  const tag = side === "both" ? "" : `-${side}`;
  const say = (text: string) => (mirrored ? mirrorCue(text) : text);

  // Everything before the last step teaches getting in; the last step is the
  // hold itself. Splitting here is what lets the hold timer start after entry.
  const entrySteps = steps.slice(0, Math.max(1, steps.length - 1));
  const holdStep = steps[steps.length - 1];
  const setup = variationSetupCue(asana, level);

  pushSegment(out, cursor, {
    id: `${slug}${tag}-prep`,
    phase: "preparation",
    stepNumber: 1,
    durationSec: 10,
    // The variation's own setup leads, because it is what the practitioner is
    // about to do; the adapted first step follows it.
    cue: setup
      ? `${setup} ${say(entrySteps[0]?.text ?? "")}`.trim()
      : say(entrySteps[0]?.text ?? `Set up for ${asana.english}.`),
    caption: `${asana.english} · ${level} · set up${sideSuffix(side)}`,
    breathCue: `Start in ${startingPositionFor(asana)} and settle your breath.`,
    side,
    focus: authoredFocus(slug, entrySteps[0]),
    cycle: null,
  });

  for (let i = 1; i < entrySteps.length; i++) {
    const stepText = say(entrySteps[i]!.text);
    const stepBreath =
      /\binhale\b/i.test(stepText)
        ? "Inhale as you lengthen into this step."
        : /\bexhale\b/i.test(stepText)
          ? "Exhale as you settle into this step."
          : i === 1
            ? "Exhale smoothly as you move into the shape."
            : "Inhale to lengthen the spine and check alignment.";
    pushSegment(out, cursor, {
      id: `${slug}${tag}-entry-${i}`,
      phase: "entry",
      stepNumber: i + 1,
      durationSec: 8,
      cue: stepText,
      caption: `${asana.english} · step ${i + 1}${sideSuffix(side)}`,
      breathCue: stepBreath,
      side,
      focus: authoredFocus(slug, entrySteps[i]),
      cycle: null,
    });
  }

  pushSegment(out, cursor, {
    id: `${slug}${tag}-hold`,
    phase: "hold",
    stepNumber: steps.length,
    durationSec: holdSec,
    cue: say(holdStep?.text ?? "Hold with steady breath."),
    caption: `Hold${sideSuffix(side)}`,
    breathCue: asana.breathing,
    side,
    focus: authoredFocus(slug, holdStep),
    cycle: null,
  });

  pushSegment(out, cursor, {
    id: `${slug}${tag}-exit`,
    phase: "exit",
    stepNumber: null,
    durationSec: 6,
    cue: exactExitCueFor(asana, side, mirrored),
    caption: `Exit to neutral${sideSuffix(side)}`,
    breathCue: "Exhale to release back to neutral.",
    side,
    focus: null,
    cycle: null,
  });
}

/**
 * There is one base catalog illustration per pose, so any variation whose setup
 * differs visibly from that base artwork is noted while the stage trainer guide
 * adjusts to demonstrate the selected variation.
 */
export function variationVisualMismatchFor(
  asana: Asana,
  level: VariationLevel,
): string | null {
  const v = variationFor(asana, level);
  const description = v?.description?.trim();
  if (!v || !description) return null;
  const props = (v.props ?? []).filter((p) => p && p !== "none");
  const changesTheShape =
    props.length > 0 ||
    /\b(kickstand|toes? on the floor|hand on a wall|knees? down|forearms?|fists?|partway|shorten(ed)? (the )?stance|chair|blanket|bolster|block|strap|wall)\b/i.test(
      description,
    );
  if (!changesTheShape) return null;
  return `The base illustration shows ${asana.english} in its standard shape, not the ${level} variation described here${
    props.length ? ` (${props.join(", ")})` : ""
  }. The stage trainer guide adjusts for your selected ${level} modification — follow the setup cues.`;
}

export function buildPoseLesson(opts: {
  slug: string;
  level?: VariationLevel;
}): PoseLesson | null {
  const asana = asanaBySlug(opts.slug);
  if (!asana) return null;
  const level = opts.level ?? "intermediate";
  const steps = stepsFor(asana, level);
  const dynamic = isDynamicPractice(asana);
  const sides = dynamic ? "once" : sidesFor(asana);
  const variation = variationFor(asana, level);
  const holdSec = variation?.holdSeconds ?? asana.holdSeconds ?? 30;

  const segments: LessonSegment[] = [];
  const cursor = { t: 0 };
  let rounds: number | null = null;

  if (dynamic) {
    rounds = buildDynamicSegments({ asana, level, steps, out: segments, cursor });
  } else if (sides === "each") {
    // Teach the side the catalog text is written for first, then mirror.
    const firstSide = namedSideIn(asana.steps);
    const secondSide = firstSide === "right" ? "left" : "right";
    buildStaticSideSegments({
      asana,
      level,
      steps,
      side: firstSide,
      holdSec,
      mirrored: false,
      out: segments,
      cursor,
    });
    pushSegment(segments, cursor, {
      id: `${asana.slug}-side-change`,
      phase: "side_change",
      stepNumber: null,
      durationSec: 8,
      cue: exactSideChangeCueFor(asana, firstSide, secondSide),
      caption: `Switch sides · now the ${secondSide} side`,
      breathCue: "Take a resetting breath in neutral before the second side.",
      side: "both",
      focus: null,
      cycle: null,
    });
    buildStaticSideSegments({
      asana,
      level,
      steps,
      side: secondSide,
      holdSec,
      mirrored: true,
      out: segments,
      cursor,
    });
  } else {
    buildStaticSideSegments({
      asana,
      level,
      steps,
      side: "both",
      holdSec,
      mirrored: false,
      out: segments,
      cursor,
    });
  }

  return {
    slug: asana.slug,
    english: asana.english,
    level,
    kind: dynamic ? "dynamic" : "static",
    sides,
    segments,
    totalSec: cursor.t,
    rounds,
    durationLabel: durationLabelFor({
      dynamic,
      rounds,
      totalSec: cursor.t,
      holdSec,
      sides,
    }),
    props: variation?.props?.length ? variation.props.filter((p) => p !== "none") : [],
    demo: poseDemoAvailability(asana.slug, level),
    variationVisualMismatch: variationVisualMismatchFor(asana, level),
    steps: steps.map((s, i) => ({ number: i + 1, text: s.text })),
  };
}

export function formatLessonClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/**
 * A flowing practice gets rounds and a duration; a held shape gets a hold.
 * Never "Hold ~45s" for something the instructions tell you to keep moving in.
 */
export function durationLabelFor(opts: {
  dynamic: boolean;
  rounds: number | null;
  totalSec: number;
  holdSec: number;
  sides: "once" | "each";
}): string {
  if (opts.dynamic && opts.rounds) {
    return `${opts.rounds} rounds · about ${formatLessonClock(opts.totalSec)}`;
  }
  const each = opts.sides === "each" ? " each side" : "";
  return `Hold about ${Math.round(opts.holdSec)}s${each}`;
}

export function segmentAt(lesson: PoseLesson, timeSec: number): (LessonSegment & { index: number }) | null {
  const segs = lesson.segments;
  if (segs.length === 0) return null;
  const t = Math.max(0, timeSec);
  for (let i = segs.length - 1; i >= 0; i--) {
    if (t >= segs[i]!.startSec) return { ...segs[i]!, index: i };
  }
  return { ...segs[0]!, index: 0 };
}

/** Start of the segment containing `timeSec` — used by Replay. */
export function segmentStartAt(lesson: PoseLesson, timeSec: number): number {
  return segmentAt(lesson, timeSec)?.startSec ?? 0;
}

/**
 * Step boundaries for Back / Next. Consecutive segments that share a step
 * number are one teaching step, so Next from mid-cycle goes to the exit rather
 * than to the next breath.
 */
export function stepBoundaries(lesson: PoseLesson): number[] {
  const out: number[] = [];
  let lastKey = "";
  for (const seg of lesson.segments) {
    const key = `${seg.stepNumber ?? "x"}-${seg.side}-${seg.phase === "cycle" ? "cycle" : seg.phase}`;
    if (key !== lastKey) {
      out.push(seg.startSec);
      lastKey = key;
    }
  }
  return out;
}

export function nextStepStart(lesson: PoseLesson, timeSec: number): number {
  const bounds = stepBoundaries(lesson);
  for (const b of bounds) if (b > timeSec + 0.01) return b;
  return lesson.totalSec;
}

export function previousStepStart(lesson: PoseLesson, timeSec: number): number {
  const bounds = stepBoundaries(lesson);
  const current = bounds.filter((b) => b <= timeSec + 0.01).pop() ?? 0;
  const before = bounds.filter((b) => b < current - 0.01).pop();
  return before ?? 0;
}

export function phaseLabelFor(phase: LessonPhase): string {
  switch (phase) {
    case "preparation":
      return "Set up";
    case "entry":
      return "Move in";
    case "hold":
      return "Hold";
    case "cycle":
      return "Flow";
    case "exit":
      return "Come out";
    case "side_change":
      return "Switch sides";
  }
}
