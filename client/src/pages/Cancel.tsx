/**
 * Public /cancel — plain instructions, no upsell.
 * Linked from the paywall, footer, renewal emails, and post-cancel confirmation.
 */
import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion";
import { readUrlParam } from "@/lib/hashQuery";
import { useEffect, useState } from "react";

function formatUntil(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Cancel() {
  useDocumentTitle("Cancel subscription · Sadhana");
  const [done, setDone] = useState(false);
  const [until, setUntil] = useState<string | null>(null);
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    setDone(readUrlParam("done") === "1");
    setUntil(readUrlParam("until"));
    const token = readUrlParam("token");
    if (!token) return;
    setTokenBusy(true);
    void fetch("/api/billing/cancel-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const body = (await res.json()) as { accessUntil?: string; error?: string };
        if (!res.ok) throw new Error(body.error || "Cancel link failed");
        setDone(true);
        setUntil(body.accessUntil || null);
      })
      .catch((e: Error) => setTokenError(e.message))
      .finally(() => setTokenBusy(false));
  }, []);

  return (
    <FadeIn className="mx-auto max-w-lg space-y-6 py-6" data-testid="page-cancel">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Sadhana</p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Cancel your subscription</h1>
        <p className="text-sm text-muted-foreground">
          Plain instructions. No upsell. No chat. No phone number to call.
        </p>
      </header>

      {(done || tokenBusy) && (
        <section
          className="rounded-3xl border border-primary/30 bg-primary/10 p-5 text-sm"
          data-testid="cancel-done"
        >
          {tokenBusy ? (
            <p>Canceling…</p>
          ) : (
            <>
              <p className="font-medium">You&apos;re canceled.</p>
              {until && (
                <p className="mt-1 text-muted-foreground">
                  Access continues until <strong className="text-foreground">{formatUntil(until)}</strong>.
                  A confirmation email is on its way if we have your address on file.
                </p>
              )}
            </>
          )}
          {tokenError && <p className="mt-2 text-destructive">{tokenError}</p>}
        </section>
      )}

      <section className="space-y-3 rounded-3xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-serif text-xl">From the app (two taps)</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            On the <Link href="/" className="underline underline-offset-2">Home</Link> screen, tap{" "}
            <strong className="text-foreground">Cancel subscription</strong>.
          </li>
          <li>
            On the confirmation screen, tap{" "}
            <strong className="text-foreground">Confirm cancellation</strong>. You&apos;ll see the date
            your access ends.
          </li>
        </ol>
        <Button asChild className="min-h-11 w-full" data-testid="cancel-start-two-tap">
          <Link href="/cancel/confirm">Cancel now</Link>
        </Button>
      </section>

      <section className="space-y-2 text-sm text-muted-foreground">
        <h2 className="font-serif text-xl text-foreground">What happens next</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Access continues until the end of the period you already paid for.</li>
          <li>We email an immediate confirmation with that date.</li>
          <li>An in-app banner shows the same access-until date.</li>
          <li>We never require a call, chat, or retention survey to cancel.</li>
        </ul>
      </section>

      <section className="space-y-2 text-sm text-muted-foreground">
        <h2 className="font-serif text-xl text-foreground">First-charge refund</h2>
        <p>
          Within 14 days of your first charge, open{" "}
          <Link href="/plus" className="underline underline-offset-2">
            Plans
          </Link>{" "}
          and tap <strong className="text-foreground">Request a refund</strong> — auto-approved, no
          questions.
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        See{" "}
        <Link href="/terms" className="underline underline-offset-2">
          Terms
        </Link>{" "}
        for our fair-billing commitments.
      </p>
    </FadeIn>
  );
}
