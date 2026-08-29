/**
 * SavePracticePrompt — the two rungs of the "keep your practice" ladder.
 *
 * `SavePracticeBanner` is dismissible and lives on Home.
 * `SavePracticeCompleteCard` sits on the session-complete screen — after
 * they've earned something worth keeping, never before the practice starts.
 */
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { buildExport, downloadExport } from "@/lib/dataPortability";
import { stakeSummary } from "@/lib/savePracticePrompt";
import { CloudOff, Download, X } from "lucide-react";

function useExportNow() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      downloadExport(await buildExport());
      toast({ title: "Backup downloaded", description: "Import it any time from Settings." });
    } catch {
      toast({ title: "Export failed", description: "Check your connection and try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  return { run, busy };
}

export function SavePracticeBanner({
  totalSessions,
  currentStreak,
  onDismiss,
}: {
  totalSessions: number;
  currentStreak: number;
  onDismiss: () => void;
}) {
  const { run, busy } = useExportNow();
  return (
    <div
      className="relative rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-soft"
      data-testid="save-practice-banner"
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss for today"
        className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid="button-dismiss-save-banner"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Keep {stakeSummary(totalSessions, currentStreak)} across your devices
          </p>
          <p className="text-sm text-muted-foreground">
            A free account (or a backup file) means this practice is still here next time you open
            Sadhana.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" asChild data-testid="button-save-practice-account">
              <Link href="/account?tab=create">Create a free account</Link>
            </Button>
            <Button size="sm" variant="outline" onClick={run} disabled={busy}>
              <Download className="mr-1.5 h-4 w-4" /> Download a backup
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SavePracticeCompleteCard({
  totalSessions,
  currentStreak,
  onDismiss,
}: {
  totalSessions: number;
  currentStreak: number;
  onDismiss: () => void;
}) {
  const { run, busy } = useExportNow();
  return (
    <div
      className="mx-auto w-full max-w-md rounded-2xl border border-primary/30 bg-primary/5 p-4 text-left shadow-soft"
      data-testid="save-practice-complete"
    >
      <p className="font-serif text-xl">Keep this practice with you</p>
      <p className="mt-2 text-sm text-muted-foreground">
        That's {stakeSummary(totalSessions, currentStreak)}. A free account saves it across
        devices — so it's here next time you open Sadhana.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button className="min-h-11" asChild data-testid="button-gate-create-account">
          <Link href="/account?tab=create">Create a free account</Link>
        </Button>
        <Button
          className="min-h-11"
          variant="outline"
          onClick={run}
          disabled={busy}
          data-testid="button-gate-export"
        >
          <Download className="mr-1.5 h-4 w-4" /> Download a backup
        </Button>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-11 text-sm text-muted-foreground underline-offset-2 hover:underline"
          data-testid="button-gate-continue-guest"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
