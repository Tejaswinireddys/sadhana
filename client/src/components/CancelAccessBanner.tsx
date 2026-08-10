/**
 * In-app banner after cancellation — shows the date access ends.
 */
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";

type Entitlement = {
  plan: string;
  cancelAtPeriodEnd?: boolean;
  accessUntil?: string | null;
};

function formatUntil(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function CancelAccessBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { data } = useQuery<Entitlement>({
    queryKey: ["/api/billing/entitlement"],
    staleTime: 30_000,
  });

  if (dismissed || !data?.cancelAtPeriodEnd || !data.accessUntil) return null;

  return (
    <div
      className="flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm"
      role="status"
      data-testid="banner-cancel-access"
    >
      <div className="flex-1 space-y-1">
        <p className="font-medium">Subscription canceled</p>
        <p className="text-muted-foreground">
          You keep access until <strong className="text-foreground">{formatUntil(data.accessUntil)}</strong>.
          No further charges.{" "}
          <Link href="/cancel" className="underline underline-offset-2">
            Details
          </Link>
        </p>
      </div>
      <button
        type="button"
        className="rounded-md p-1 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
