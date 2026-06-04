// MoodCheckIn — a small, optional mood prompt shown before and after a practice
// session (v3.4). Uses the same five mood chips as the Journal page.
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MOODS, type Mood } from "@/data/content";
import { MOOD_ICONS } from "@/lib/moods";

export function MoodCheckIn({
  open,
  title,
  description,
  confirmLabel,
  onPick,
  onSkip,
  testIdPrefix,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  onPick: (mood: Mood) => void;
  onSkip: () => void;
  testIdPrefix: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onSkip()}>
      <DialogContent className="max-w-md" data-testid={`dialog-${testIdPrefix}`}>
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-wrap justify-center gap-2 py-2">
          {MOODS.map((m) => {
            const Icon = MOOD_ICONS[m as Mood];
            return (
              <Button
                key={m}
                type="button"
                variant="outline"
                className="flex h-auto flex-col gap-1.5 px-4 py-3"
                onClick={() => onPick(m)}
                data-testid={`${testIdPrefix}-mood-${m.toLowerCase()}`}
              >
                <Icon className="h-6 w-6 text-primary" />
                <span className="text-xs">{m}</span>
              </Button>
            );
          })}
        </div>
        <DialogFooter className="sm:justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            data-testid={`${testIdPrefix}-skip`}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
