/**
 * Content review + catalog schema versioning for safety-sensitive guidance.
 */
export const CONTENT_SCHEMA_VERSION = "2026.07.31";

export const CONTENT_REVIEW = {
  version: CONTENT_SCHEMA_VERSION,
  reviewedAt: "July 31, 2026",
  note:
    "Pose contraindications and modifications are authored educational guidance, not clinical clearance. A credentialed yoga/clinical review board should re-approve this catalog before commercial medical claims.",
} as const;
