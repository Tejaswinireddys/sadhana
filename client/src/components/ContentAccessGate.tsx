import type { ReactNode } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { INSTRUCTOR_PILOT_SLUGS } from "@/data/instructorPilot";
import { ASANAS, PATHWAYS } from "@/data/content";
import { usePractice } from "@/context/PracticeContext";
import { useEntitlement } from "@/hooks/useEntitlement";
import { Button } from "@/components/ui/button";

/** Gate before mounting lessons or players, including restored practice queues. */
export function ContentAccessGate({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { todays, meta } = usePractice();
  const { canAccess, isLoading } = useEntitlement();
  const path = location.split("?")[0].replace(/\/+$/, "");
  const [, poseParams] = useRoute("/asanas/:slug");
  const [, programParams] = useRoute("/pathways/:slug");
  const pose = ASANAS.find((row) => row.slug === poseParams?.slug);
  const program = PATHWAYS.find((row) => row.slug === programParams?.slug);
  const session = ["/practice", "/guided", "/instructor"].includes(path);
  const instructorPoses = path === "/instructor"
    ? ASANAS.filter((row) => INSTRUCTOR_PILOT_SLUGS.some((slug) => slug === row.slug))
    : [];
  const content = [pose, program, ...instructorPoses, ...(session ? [
    PATHWAYS.find((row) => row.slug === meta.pathwaySlug),
    ...todays.map((row) => ASANAS.find((pose) => pose.slug === row.slug)),
  ] : [])].filter((row) => row !== undefined);
  if (!content.some((row) => row.isPlus)) return <>{children}</>;
  if (isLoading) return <p role="status">Checking access…</p>;
  if (content.some((row) => !canAccess(row))) return (
    <section className="space-y-4 p-6" data-testid="plus-upgrade-screen">
      <h1 className="font-serif text-3xl">Continue with Sadhana Plus</h1>
      <p>This practice is for Plus members. Subscribe using Stripe test mode.</p>
      <Button asChild><Link href="/plus" data-testid="button-upgrade-plus">Subscribe</Link></Button>
      <Button variant="outline" asChild><Link href="/pathways">Browse classes</Link></Button>
    </section>
  );
  return <>{children}</>;
}
