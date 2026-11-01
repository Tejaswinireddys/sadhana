import { z } from "zod";

const text = z.string().trim().min(1);
const texts = z.array(text).min(1);

/** Portable catalog contract; duration describes the catalog hold, not session runtime. */
export const poseExportSchema = z.object({
  id: text,
  isPlus: z.boolean(),
  slug: text.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  sanskrit: text,
  english: text,
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
  duration: z.object({ label: text, seconds: z.number().int().positive() }).strict(),
  focusAreas: texts,
  benefits: texts,
  steps: texts,
  cues: texts,
  cautions: z.array(z.object({
    condition: text,
    severity: z.enum(["avoid", "modify", "caution"]),
  }).strict()).min(1),
  contraindications: texts,
  relatedPoses: texts,
  imagePath: text,
  videoUrl: z.literal(""),
}).strict();

export type PoseExport = z.infer<typeof poseExportSchema>;

/** Reject incomplete records, duplicate identities/names, and broken related-pose links. */
export function validatePoseExport(input: unknown): PoseExport[] {
  const poses = z.array(poseExportSchema).length(207).parse(input);
  for (const field of ["id", "slug", "sanskrit", "english"] as const) {
    const seen = new Set<string>();
    for (const pose of poses) {
      const key = pose[field].toLowerCase();
      if (seen.has(key)) throw new Error(`Duplicate ${field}: ${pose[field]}`);
      seen.add(key);
    }
  }
  const slugs = new Set(poses.map((pose) => pose.slug));
  for (const pose of poses) {
    if (pose.id !== pose.slug) throw new Error(`Unstable id: ${pose.slug}`);
    if (new Set(pose.relatedPoses).size !== pose.relatedPoses.length) {
      throw new Error(`Duplicate related poses: ${pose.slug}`);
    }
    for (const related of pose.relatedPoses) {
      if (!slugs.has(related) || related === pose.slug) {
        throw new Error(`Invalid related pose: ${pose.slug} -> ${related}`);
      }
    }
  }
  return poses;
}
