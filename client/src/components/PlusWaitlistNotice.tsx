/**
 * Shown on /cancel and /cancel/confirm while BILLING_ENABLED is off.
 *
 * With purchasing unavailable no new subscription can start and nothing can be
 * charged. These pages stay reachable (bookmarks, renewal-email links) but say
 * so plainly instead of describing a cancel and refund process for a plan
 * nobody can buy. Wording matches `billingCopy("disabled")`.
 */
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { SupportContact } from "@/components/SupportContact";

export function PlusWaitlistNotice() {
  return (
    <section
      className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-soft"
      data-testid="plus-not-available"
    >
      <h2 className="font-serif text-xl">Purchasing Sadhana Plus is unavailable</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Plus can&apos;t be bought on this server right now, so there is no subscription to cancel here.</li>
        <li>Nothing can be charged while purchasing is unavailable, so there is nothing to refund.</li>
        <li>Free practice, the safety library and the free video classes stay available.</li>
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild className="min-h-11" data-testid="link-plus-waitlist">
          <Link href="/plus#waitlist">About Sadhana Plus</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Questions: <SupportContact />
      </p>
    </section>
  );
}
