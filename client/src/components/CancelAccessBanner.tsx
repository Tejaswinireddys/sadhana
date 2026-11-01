import { BILLING_ENABLED } from "@/lib/publicConfig";
/**
 * Today's billing notice once a cancel is scheduled or access has ended — one
 * notice, worded for whether the plan is still active (see
 * `subscriptionNotice`). Home's cancel entry point renders only when this
 * does not, so the two never stack.
 */
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import { subscriptionNotice, subscriptionNoticeCopy, type EntitlementView } from "@/lib/subscriptionNotice";

export function useEntitlementView() {
  return useQuery<EntitlementView>({
    queryKey: ["/api/billing/entitlement"],
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function CancelAccessBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { data } = useEntitlementView();
  const notice = subscriptionNotice(data);
  if (dismissed || !notice || notice.kind === "cancel-cta") return null;
  const copy = subscriptionNoticeCopy(notice);

  return (
    <div
      className="flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm"
      role="status"
      data-testid="banner-cancel-access"
      data-kind={notice.kind}
    >
      <div className="flex-1 space-y-1">
        <p className="font-medium" data-testid="banner-cancel-access-title">{copy.title}</p>
        <p className="text-muted-foreground">
          {copy.body}{" "}
          {BILLING_ENABLED && notice.kind === "ending" && (
            <Link href="/cancel/confirm" className="underline underline-offset-2" data-testid="banner-cancel-access-details">
              Details
            </Link>
          )}
          {BILLING_ENABLED && notice.kind === "ending" && " · "}
          <Link href="/plus" className="underline underline-offset-2" data-testid="banner-cancel-access-resubscribe">
            Resubscribe
          </Link>
        </p>
      </div>
      <button
        type="button"
        className="inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
