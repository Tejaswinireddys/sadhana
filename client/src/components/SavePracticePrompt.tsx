/**
 * SavePracticePrompt — the two rungs of the "don't lose your practice" ladder.
 *
 * `SavePracticeBanner` is dismissible and lives on Home.
 * `SavePracticeDialog` blocks the start of a session once there's a streak to
 * lose, and always offers both an account and a download.
 *
 * Tone matters here. This is not a paywall and shouldn't read like one: it
 * states a real risk, in real numbers, and gives two honest ways out.
 */
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
            {stakeSummary(totalSessions, currentStreak)} saved only on this device
          </p>
          <p className="text-sm text-muted-foreground">
            Clearing your browser data — or your browser doing it for you — would lose it. A free
            account keeps it safe across devices.
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

export function SavePracticeDialog({
  open,
  totalSessions,
  currentStreak,
  onContinueAsGuest,
}: {
  open: boolean;
  totalSessions: number;
  currentStreak: number;
  onContinueAsGuest: () => void;
}) {
  const { run, busy } = useExportNow();
  return (
    <AlertDialog open={open}>
      <AlertDialogContent data-testid="save-practice-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-2xl">
            Keep your practice before you go further
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-left">
            <span className="block">
              You've built {stakeSummary(totalSessions, currentStreak)} — and right now it exists
              only in this browser. There's no way for us to give it back if it's cleared.
            </span>
            <span className="block">
              An account takes a few seconds and keeps everything, on every device.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Button className="w-full" size="lg" asChild data-testid="button-gate-create-account">
            <Link href="/account?tab=create">Create a free account</Link>
          </Button>
          <Button
            className="w-full"
            size="lg"
            variant="outline"
            onClick={run}
            disabled={busy}
            data-testid="button-gate-export"
          >
            <Download className="mr-1.5 h-4 w-4" /> Download a backup instead
          </Button>
          {/* Deliberately a quiet text link, not a button: it stays available,
              because holding someone's own practice hostage is a dark pattern. */}
          <button
            type="button"
            onClick={onContinueAsGuest}
            className="mx-auto block pt-1 text-sm text-muted-foreground underline-offset-2 hover:underline"
            data-testid="button-gate-continue-guest"
          >
            Continue as a guest
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
