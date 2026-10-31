/**
 * Shown on /cancel and /cancel/confirm while BILLING_ENABLED is off.
 *
 * Plus is waitlist-only until payments launch, so there is no subscription to
 * cancel and no charge to refund. These pages stay reachable (bookmarks,
 * renewal-email links) but say so plainly instead of describing a cancel and
 * refund process for a plan nobody can buy.
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
      <h2 className="font-serif text-xl">Sadhana Plus is not available yet</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Plus is on a waitlist. It can&apos;t be bought yet, so there is no subscription to cancel.</li>
        <li>Nobody has been charged, so there is nothing to refund.</li>
        <li>Everything in the app is free to use today.</li>
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild className="min-h-11" data-testid="link-plus-waitlist">
          <Link href="/plus#waitlist">Join the Plus waitlist</Link>
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
