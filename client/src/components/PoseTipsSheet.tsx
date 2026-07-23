/**
 * Compact teaching tips for guided practice — opens as a bottom sheet so
 * practitioners can glance at form / breath / watch-outs without leaving flow.
 *
 * Uses an in-place overlay (not a portaled Sheet) so it stacks correctly above
 * the full-screen GuidedSession chrome.
 */
import { useMemo, useState } from "react";
import type { Asana } from "@/data/content";
import { buildPoseExplanation } from "@/lib/poseExplanation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Lightbulb,
  Wind,
  Target,
  AlertTriangle,
  Heart,
  AlignCenter,
  X,
} from "lucide-react";

type TipTab = "form" | "breath" | "align" | "watch" | "feel";

const TABS: { id: TipTab; label: string; icon: typeof Target }[] = [
  { id: "form", label: "Form", icon: Target },
  { id: "breath", label: "Breath", icon: Wind },
  { id: "align", label: "Align", icon: AlignCenter },
  { id: "watch", label: "Watch outs", icon: AlertTriangle },
  { id: "feel", label: "Feel it", icon: Heart },
];

type PoseTipsSheetProps = {
  asana: Asana | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PoseTipsSheet({ asana, open, onOpenChange }: PoseTipsSheetProps) {
  const [tab, setTab] = useState<TipTab>("form");
  const expl = useMemo(
    () => (asana ? buildPoseExplanation(asana) : null),
    [asana],
  );

  if (!open || !asana || !expl) return null;

  const body =
    tab === "form"
      ? expl.formCues
      : tab === "breath"
        ? [expl.breathCue]
        : tab === "align"
          ? expl.alignmentTips
          : tab === "watch"
            ? expl.watchOuts
            : expl.feelIt;

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col justify-end bg-background/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pose-tips-title"
      data-testid="pose-tips-sheet"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="max-h-[78vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-5 shadow-soft-lg animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="pose-tips-title" className="font-serif text-xl">
              {asana.english}
            </h2>
            <p className="text-sm italic text-muted-foreground">
              {asana.sanskrit} · pose tips
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close pose tips"
            data-testid="button-close-pose-tips"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-2" role="tablist">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                tab === id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
              data-testid={`pose-tips-tab-${id}`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        <ul className="mt-3 space-y-3 pb-2" data-testid={`pose-tips-panel-${tab}`}>
          {body.map((line, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                aria-hidden
              />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Compact trigger button for the practice chrome. */
export function PoseTipsTrigger({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onClick}
      className={className}
      aria-label="Open pose explanation tips"
      data-testid="button-pose-tips"
    >
      <Lightbulb className="h-5 w-5" />
    </Button>
  );
}
