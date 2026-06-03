// ParentGate — a simple math-question modal shown when a kid (or anyone) first
// enters the Kids section in a session. Prevents young children from navigating
// to adult content. On a correct answer, sets a transient session flag via the
// KidsGate context (NOT localStorage), so it re-appears next session.
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useKidsGate } from "@/context/KidsGateContext";
import { useLocation } from "wouter";
import { Lock } from "lucide-react";

export function ParentGate() {
  const { unlocked, unlock } = useKidsGate();
  const [, navigate] = useLocation();
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState(false);

  // Stable question for this mount
  const { a, b } = useMemo(() => {
    const a = 4 + Math.floor(Math.random() * 6); // 4..9
    const b = 3 + Math.floor(Math.random() * 6); // 3..8
    return { a, b };
  }, []);

  if (unlocked) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parseInt(answer, 10) === a + b) {
      unlock();
    } else {
      setError(true);
      setAnswer("");
    }
  };

  return (
    <Dialog open={!unlocked} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="parent-gate"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-2xl">
            <Lock className="h-5 w-5 text-primary" /> Grown-ups only
          </DialogTitle>
          <DialogDescription>
            Ask a grown-up to solve this so we know it's okay to start the yoga adventure.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-center font-serif text-3xl" data-testid="text-parent-gate-question">
            What is {a} + {b}?
          </p>
          <Input
            type="number"
            inputMode="numeric"
            autoFocus
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              setError(false);
            }}
            placeholder="Type the answer"
            className="text-center text-lg"
            data-testid="input-parent-gate"
          />
          {error && (
            <p className="text-center text-sm text-primary" data-testid="text-parent-gate-error">
              Not quite — try again.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/")}
              data-testid="button-parent-gate-exit"
            >
              Go back
            </Button>
            <Button type="submit" className="flex-1" data-testid="button-parent-gate-submit">
              Enter
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
