/**
 * Tap 2 of cancel: one confirmation screen stating access-until, then done.
 * No retention copy, no survey, no chat, no multi-step confirmation chain.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion";

type Preview = {
  plan: string;
  accessUntil: string;
  alreadyCanceling: boolean;
  amount: number | null;
  currency: string;
  interval: string;
};

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

export default function CancelConfirm() {
  useDocumentTitle("Confirm cancellation · Sadhana");
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data, error, isLoading } = useQuery<Preview>({
    queryKey: ["/api/billing/cancel-preview"],
  });

  const cancel = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const body = (await res.json()) as { accessUntil?: string; error?: string };
      if (!res.ok) throw new Error(body.error || "Cancel failed");
      return body;
    },
    onSuccess: (body) => {
      void qc.invalidateQueries({ queryKey: ["/api/billing/entitlement"] });
      navigate(`/cancel?done=1&until=${encodeURIComponent(body.accessUntil || "")}`);
    },
  });

  return (
    <FadeIn className="mx-auto max-w-lg space-y-6 py-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Cancel subscription
        </p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Confirm cancellation</h1>
        <p className="text-sm text-muted-foreground">
          One step. No phone, chat, email, or retention pitch — confirm and you&apos;re done.
        </p>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading your plan…</p>}
      {error && (
        <div className="space-y-3 rounded-2xl border border-border p-4 text-sm">
          <p>No active paid subscription found on this device.</p>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/cancel">How to cancel</Link>
          </Button>
          {import.meta.env.DEV && (
            <Button
              variant="secondary"
              className="min-h-11 w-full"
              data-testid="button-demo-subscribe"
              onClick={() => {
                void fetch("/api/billing/demo-subscribe", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ plan: "plus", email: "demo@sadhana.app" }),
                }).then(() => window.location.reload());
              }}
            >
              Load demo subscription (dev)
            </Button>
          )}
        </div>
      )}

      {data && (
        <section className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-soft">
          <p className="text-sm text-muted-foreground">
            Plan: <strong className="text-foreground">Sadhana {data.plan}</strong>
          </p>
          <p className="font-serif text-xl leading-snug">
            {data.alreadyCanceling ? (
              <>
                Already canceled. You keep access until{" "}
                <span className="whitespace-nowrap">{formatUntil(data.accessUntil)}</span>.
              </>
            ) : (
              <>
                After you confirm, you keep access until{" "}
                <span className="whitespace-nowrap">{formatUntil(data.accessUntil)}</span>. No further
                charges.
              </>
            )}
          </p>
          {!data.alreadyCanceling && (
            <Button
              className="min-h-12 w-full"
              size="lg"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate()}
              data-testid="button-confirm-cancel"
            >
              {cancel.isPending ? "Canceling…" : "Confirm cancellation"}
            </Button>
          )}
          {cancel.isError && (
            <p className="text-sm text-destructive">{(cancel.error as Error).message}</p>
          )}
          <Button asChild variant="ghost" className="min-h-11 w-full">
            <Link href="/">Keep subscription · back to Home</Link>
          </Button>
        </section>
      )}
    </FadeIn>
  );
}
