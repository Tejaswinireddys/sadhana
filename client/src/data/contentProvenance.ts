/**
 * Content review + catalog schema versioning for safety-sensitive guidance.
 */
export const CONTENT_SCHEMA_VERSION = "2026.07.31";

export const CONTENT_REVIEW = {
  version: CONTENT_SCHEMA_VERSION,
  reviewedAt: "July 31, 2026",
  note:
    "Pose contraindications and modifications are educational author notes, not medical advice or clinical clearance. Catalog copy was last editor-reviewed on the date above; it has not been certified by a medical board.",
} as const;
