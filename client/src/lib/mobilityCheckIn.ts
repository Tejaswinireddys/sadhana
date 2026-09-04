/**
 * Pathway-specific mobility check-in copy. Stored numbers reuse
 * frontSplitInches / backSplitInches; labels change per program.
 */

export type MobilityCheckInMode = "splits" | "backbend" | "chair" | "comfort";

export type MobilityCheckInCopy = {
  mode: MobilityCheckInMode;
  title: string;
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

export function mobilityCheckInMode(pathwaySlug: string): MobilityCheckInMode {
  if (CHAIR_SLUGS.has(pathwaySlug)) return "chair";
  if (SPLIT_SLUGS.has(pathwaySlug)) return "splits";
  if (BACKBEND_SLUGS.has(pathwaySlug)) return "backbend";
  return "comfort";
}

export function mobilityCheckInCopy(pathwaySlug: string): MobilityCheckInCopy {
  const mode = mobilityCheckInMode(pathwaySlug);
  if (mode === "chair") {
    return {
      mode,
      title: "Chair mobility check-in",
      prompt:
        "Record how seated practice felt this week. Comfort is 1 (very uncomfortable) to 10 (easy). Seated range is how far you can comfortably reach or turn without leaving the chair (1 = very limited, 10 = full comfortable range).",
      followUpPrompt:
        "Log this week's seated comfort (1–10) and optional seated range. Stay in the chair — no floor measurements.",
      primaryLabel: "Comfort (1–10)",
      primaryPlaceholder: "e.g. 7",
      primaryHint: "How the practice felt in your body",
      secondaryLabel: "Seated range (1–10, optional)",
      secondaryPlaceholder: "optional",
      chartValue: "Comfort",
      chartUnit: "1–10",
      higherIsBetter: true,
      min: 1,
      max: 10,
    };
  }
  if (mode === "backbend") {
    return {
      mode,
      title: "Backbend check-in",
      prompt:
        "Record a comfort score for your deepest supported backbend this week (1 = very limited, 10 = easy and spacious). Optional: how many days you practiced.",
      followUpPrompt: "Log this week's backbend comfort (1–10) and optional practice days.",
      primaryLabel: "Backbend comfort (1–10)",
      primaryPlaceholder: "e.g. 6",
      primaryHint: "How the shape felt, not a floor measurement",
      secondaryLabel: "Practice days this week (0–7, optional)",
      secondaryPlaceholder: "optional",
      chartValue: "Comfort",
      chartUnit: "1–10",
      higherIsBetter: true,
      min: 1,
      max: 10,
    };
  }
  if (mode === "comfort") {
    return {
      mode,
      title: "Practice check-in",
      prompt:
        "Record how this week's practice felt. Comfort is 1 (very uncomfortable) to 10 (easy). Optional: how many days you practiced.",
      followUpPrompt: "Log this week's comfort (1–10) and optional practice days.",
      primaryLabel: "Comfort (1–10)",
      primaryPlaceholder: "e.g. 7",
      primaryHint: "How the practice felt in your body",
      secondaryLabel: "Practice days this week (0–7, optional)",
      secondaryPlaceholder: "optional",
      chartValue: "Comfort",
      chartUnit: "1–10",
      higherIsBetter: true,
      min: 1,
      max: 10,
    };
  }
  return {
    mode: "splits",
    title: "Mobility check-in",
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
