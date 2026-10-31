/** Build-time snapshots keep marketing facts derived without shipping the catalog. */
import { ASANAS, asanaBySlug } from "../client/src/data/content";
import { QUICK_SESSIONS } from "../client/src/data/quickSessions";
import { REPRESENTATIVE_SESSIONS, SAMPLE_PRACTICE } from "../client/src/data/samplePractice";
import { buildQuizPlan } from "../client/src/data/quizPlan";
import { buildSessionPreflight, type PreflightPose } from "../client/src/lib/sessionPreflight";
import { benefitClaimsNeedingReview } from "../client/src/lib/benefitClaims";
import { writeFile } from "node:fs/promises";
export const PERSONALISATION_EXAMPLE = [
  { id: "new-10", who: "New to yoga · 10 minutes", answers: { goal: "calm", body: "full", experience: "new", time: "10" } },
  { id: "some-20", who: "Some experience · 20 minutes", answers: { goal: "calm", body: "full", experience: "some", time: "20" } },
] as const;
function resolve(poses: Array<{ slug: string; holdSeconds: number; sides?: "once" | "each" }>): PreflightPose[] {
  return poses.flatMap((p) => { const a = asanaBySlug(p.slug); return a ? [{ ...a, ...p }] : []; });
}
function landingPose(p: PreflightPose) {
  return { slug: p.slug, english: p.english, sanskrit: p.sanskrit, imageAlt: p.imageAlt,
    modifications: p.modifications, holdSeconds: p.holdSeconds, sides: p.sides, steps: p.steps };
}
export function buildLandingContent() {
  const samplePoses = resolve(SAMPLE_PRACTICE.poses);
  return {
    poseCount: ASANAS.length,
    samplePoses: samplePoses.map(landingPose),
    samplePreflight: buildSessionPreflight({ poses: samplePoses }),
    sessions: REPRESENTATIVE_SESSIONS.map((tile) => {
      const poses = resolve(tile.poses ?? QUICK_SESSIONS.find((q) => q.id === tile.quickSessionId)?.poses ?? []);
      return { tile, poses: poses.map(landingPose), preflight: buildSessionPreflight({ poses }) };
    }),
    personalisation: PERSONALISATION_EXAMPLE.map((ex) => {
      const plan = buildQuizPlan({ ...ex.answers });
      const poses = resolve(plan.poses);
      return { ex, plan: { poses: poses.map((p) => ({ slug: p.slug, holdSeconds: p.holdSeconds, english: p.english })) }, preflight: buildSessionPreflight({ poses }) };
    }),
    flaggedBenefitLines: benefitClaimsNeedingReview().length,
  };
}
export async function writeLandingContent() {
  await writeFile("client/src/data/landing.generated.json", JSON.stringify(buildLandingContent()));
}
