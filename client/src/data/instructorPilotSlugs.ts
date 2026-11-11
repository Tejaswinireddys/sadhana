/**
 * The five pilot poses. Kept out of `instructorPilot.ts` so the access gate
 * can name them without pulling the teaching model or the pose catalog.
 */
export const INSTRUCTOR_PILOT_SLUGS = [
  "tadasana",
  "balasana",
  "marjaryasana-bitilasana",
  "virabhadrasana-ii",
  "kumbhakasana",
] as const;

export type InstructorPilotSlug = (typeof INSTRUCTOR_PILOT_SLUGS)[number];
