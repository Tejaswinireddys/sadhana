import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { INSTRUCTOR_PILOT_SLUGS } from "@/data/instructorPilotSlugs";
import { loadCatalog, peekCatalog, subscribeCatalog } from "@/lib/catalogRegistry";
import { prefetchShellPage, routeReadsQueue } from "@/lib/shellRoutes";
import { usePractice } from "@/context/PracticeContext";
import { useEntitlement } from "@/hooks/useEntitlement";
import { Button } from "@/components/ui/button";
import { BILLING_ENABLED, STRIPE_MODE } from "@/lib/publicConfig";
import { billingCopy, billingState } from "@/lib/billingCopy";

/** Gate before mounting lessons or players, including restored practice queues. */
export function ContentAccessGate({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { todays, meta, queuePending } = usePractice();
  const { canAccess, isLoading } = useEntitlement();
  const catalog = useSyncExternalStore(subscribeCatalog, peekCatalog, peekCatalog);
  const path = location.split("?")[0].replace(/\/+$/, "");
  const [, poseParams] = useRoute("/asanas/:slug");
  const [, programParams] = useRoute("/pathways/:slug");
  const session = ["/practice", "/guided", "/instructor"].includes(path);
  const plusRoute = Boolean(poseParams?.slug || programParams?.slug || session);
  const readsQueue = routeReadsQueue(location);
  const waitingOnQueue = readsQueue && queuePending;
  const waitingOnCatalog = plusRoute && !catalog;

  useEffect(() => {
    if (!waitingOnQueue && !plusRoute) return;
    prefetchShellPage(location);
    if ((waitingOnQueue || waitingOnCatalog) && !peekCatalog()) void loadCatalog();
  }, [waitingOnQueue, plusRoute, waitingOnCatalog, location]);

  if (waitingOnQueue) return <p role="status">Loading…</p>;
  if (waitingOnCatalog) return <p role="status">Checking access…</p>;
  if (!plusRoute || !catalog) return <>{children}</>;

  const pose = catalog.ASANAS.find((row) => row.slug === poseParams?.slug);
  const program = catalog.PATHWAYS.find((row) => row.slug === programParams?.slug);
  const instructorPoses = path === "/instructor"
    ? catalog.ASANAS.filter((row) => INSTRUCTOR_PILOT_SLUGS.some((slug) => slug === row.slug))
    : [];
  const content = [pose, program, ...instructorPoses, ...(session ? [
    catalog.PATHWAYS.find((row) => row.slug === meta.pathwaySlug),
    ...todays.map((row) => catalog.ASANAS.find((pose) => pose.slug === row.slug)),
  ] : [])].filter((row) => row !== undefined);
  if (!content.some((row) => row.isPlus)) return <>{children}</>;
  if (isLoading) return <p role="status">Checking access…</p>;
  const billing = billingCopy(billingState(BILLING_ENABLED, STRIPE_MODE));
  if (content.some((row) => !canAccess(row))) return (
    <section className="space-y-4 p-6" data-testid="plus-upgrade-screen">
      <h1 className="font-serif text-3xl">Continue with Sadhana Plus</h1>
      <p data-testid="plus-gate-billing">{billing.gateNote}</p>
      <Button asChild><Link href="/plus" data-testid="button-upgrade-plus">{billing.gateCta}</Link></Button>
      <Button variant="outline" asChild><Link href="/pathways">Browse classes</Link></Button>
    </section>
  );
  return <>{children}</>;
}
