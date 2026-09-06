/**
 * Pathway-specific check-in copy. Stored numbers reuse
 * frontSplitInches / backSplitInches; labels change per program.
 */

export type MobilityCheckInMode =
  | "splits"
  | "backbend"
  | "chair"
  | "prenatal"
  | "hips"
  | "comfort";

export type MobilityCheckInCopy = {
  mode: MobilityCheckInMode;
  title: string;
  banner: string;
  prompt: string;
  followUpPrompt: string;
  primaryLabel: string;
  primaryPlaceholder: string;
  primaryHint: string;
  secondaryLabel: string;
  secondaryPlaceholder: string;
  chartValue: string;
  chartUnit: string;
  higherIsBetter: boolean;
  min: number;
  max: number;
};

const SPLIT_SLUGS = new Set(["sixty-day-splits", "front-splits"]);
const BACKBEND_SLUGS = new Set(["wheel-backbend", "7-day-backbend-journey"]);
const CHAIR_SLUGS = new Set(["chair-limited-mobility"]);
const PRENATAL_SLUGS = new Set(["prenatal-gentle-week"]);
const HIP_SLUGS = new Set(["7-day-hip-opening"]);

export function mobilityCheckInMode(pathwaySlug: string): MobilityCheckInMode {
  if (CHAIR_SLUGS.has(pathwaySlug)) return "chair";
  if (PRENATAL_SLUGS.has(pathwaySlug)) return "prenatal";
  if (HIP_SLUGS.has(pathwaySlug)) return "hips";
  if (SPLIT_SLUGS.has(pathwaySlug)) return "splits";
  if (BACKBEND_SLUGS.has(pathwaySlug)) return "backbend";
  return "comfort";
}

function scaleCopy(
  mode: MobilityCheckInMode,
  title: string,
  prompt: string,
  followUpPrompt: string,
  extras: Partial<MobilityCheckInCopy> = {},
): MobilityCheckInCopy {
  return {
    mode,
    title,
    banner: extras.banner ?? `Optional ${title.toLowerCase()} — how this week felt, not a flexibility test.`,
    prompt,
    followUpPrompt,
    primaryLabel: extras.primaryLabel ?? "Comfort (1–10)",
    primaryPlaceholder: extras.primaryPlaceholder ?? "e.g. 7",
    primaryHint: extras.primaryHint ?? "How the practice felt in your body",
    secondaryLabel: extras.secondaryLabel ?? "Practice days this week (0–7, optional)",
    secondaryPlaceholder: extras.secondaryPlaceholder ?? "optional",
    chartValue: extras.chartValue ?? "Comfort",
    chartUnit: extras.chartUnit ?? "1–10",
    higherIsBetter: extras.higherIsBetter ?? true,
    min: extras.min ?? 1,
    max: extras.max ?? 10,
  };
}

export function mobilityCheckInCopy(pathwaySlug: string): MobilityCheckInCopy {
  const mode = mobilityCheckInMode(pathwaySlug);
  if (mode === "chair") {
    return scaleCopy(
      mode,
      "Chair mobility check-in",
      "Record how seated practice felt this week. Comfort is 1 (very uncomfortable) to 10 (easy). Seated range is how far you can comfortably reach or turn without leaving the chair (1 = very limited, 10 = full comfortable range).",
      "Log this week's seated comfort (1–10) and optional seated range. Stay in the chair — no floor measurements.",
      {
        banner: "Optional seated comfort check-in — stay in the chair, no floor measurements.",
        secondaryLabel: "Seated range (1–10, optional)",
        primaryHint: "How the practice felt in your body",
      },
    );
  }
  if (mode === "prenatal") {
    return scaleCopy(
      mode,
      "Prenatal comfort check-in",
      "How is this week of gentle prenatal practice feeling? Comfort is 1 (very uncomfortable) to 10 (easy and spacious). This is not a flexibility test — no floor-gap or half-split measurements.",
      "Log this week's prenatal comfort (1–10) and optional practice days. Skip any shape that does not feel right.",
      {
        banner: "Optional prenatal comfort check-in — no floor-gap or half-split measurements.",
        primaryHint: "How the week felt in your body, not a depth score",
      },
    );
  }
  if (mode === "hips") {
    return scaleCopy(
      mode,
      "Hip comfort check-in",
      "How open and comfortable do your hips feel this week? 1 = tight or irritated, 10 = easy and spacious. This is a comfort score — not a deepest half-split or inches-to-floor measurement.",
      "Log this week's hip comfort (1–10) and optional practice days. No floor-gap measurement.",
      {
        banner: "Optional hip comfort check-in — a 1–10 feel score, not a floor measurement.",
        primaryHint: "How the hips felt, not inches to the floor",
      },
    );
  }
  if (mode === "backbend") {
    return scaleCopy(
      mode,
      "Backbend check-in",
      "Record a comfort score for your deepest supported backbend this week (1 = very limited, 10 = easy and spacious). Optional: how many days you practiced.",
      "Log this week's backbend comfort (1–10) and optional practice days.",
      {
        banner: "Optional backbend comfort check-in — how the shape felt, not a floor measurement.",
        primaryLabel: "Backbend comfort (1–10)",
        primaryHint: "How the shape felt, not a floor measurement",
      },
    );
  }
  if (mode === "comfort") {
    return scaleCopy(
      mode,
      "Practice check-in",
      "Record how this week's practice felt. Comfort is 1 (very uncomfortable) to 10 (easy). Optional: how many days you practiced. This is not a splits or backbend measurement.",
      "Log this week's comfort (1–10) and optional practice days.",
      {
        banner: "Optional practice check-in — how the week felt, not a flexibility test.",
      },
    );
  }
  return {
    mode: "splits",
    title: "Mobility check-in",
    banner: "Record your starting front-split gap — optional, never a judgment.",
    prompt:
      "Record your starting measurement — the distance in inches between your front hip and the floor in your deepest half-split. This is your baseline; not a judgment.",
    followUpPrompt:
      "Log the distance in inches between your front hip and the floor in your deepest half-split. Optional: your backbend depth.",
    primaryLabel: "Front split (inches to floor)",
    primaryPlaceholder: "e.g. 8",
    primaryHint: "Inches between front hip and floor",
    secondaryLabel: "Backbend depth (optional)",
    secondaryPlaceholder: "optional",
    chartValue: "Front split gap",
    chartUnit: "inches",
    higherIsBetter: false,
    min: 0,
    max: 48,
  };
}

/** True when the form asks for a floor-gap / half-split measurement. */
export function asksForFloorSplitMeasurement(copy: MobilityCheckInCopy): boolean {
  return copy.mode === "splits" || /inches to floor|front split \(inches/i.test(copy.primaryLabel);
}
